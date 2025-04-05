import { ethers } from 'ethers';
import { getSwap } from 'sushi';
import { type ExtractorSupportedChainId } from 'sushiswap/config';
import { Token } from 'sushiswap/currency';
import { DataFetcher, Router } from 'sushiswap/router';
import { USDC } from 'sushiswap/currency';
import { ChainId } from 'sushiswap/chain';
import { publicClientConfig } from 'sushiswap/config';
import { networkConfig } from '$lib/constants';

import { http, fallback, webSocket, PublicClient, Chain, createPublicClient } from 'viem';
export interface TokenPrice {
	averagePrice: number;
	currentPrice: number;
}

export async function getTokenPriceUsd(
	network: string,
	tokenAddress: string,
	tokenSymbol: string,
	tokenDecimals: number
): Promise<number> {
	try {
		const dexScreenerPrice = await getDexScreenerUsdPrice(network, tokenAddress, tokenSymbol);
		if (dexScreenerPrice.currentPrice > 0) {
			return dexScreenerPrice.currentPrice;
		}
		const sushiPrice = await getSushiUsdPrice(network, tokenAddress, tokenDecimals);
		return sushiPrice;
	} catch {
		return 0;
	}
}

export const getDexScreenerUsdPrice = async (
	network: string,
	tokenAddress: string,
	tokenSymbol: string
) => {
	try {
		if (tokenSymbol.includes('USD')) {
			return {
				averagePrice: 1,
				currentPrice: 1
			};
		}
		const response = await fetch(`https://api.dexscreener.io/latest/dex/search?q=${tokenAddress}`);
		const data = await response.json();

		//eslint-disable-next-line @typescript-eslint/no-explicit-any
		const pairs = data?.pairs.filter((pair: any) => pair.chainId === network) || [];
		if (pairs.length === 0) {
			return { averagePrice: 0, currentPrice: 0 };
		}

		let currentPrice = 0;
		let averagePrice = 0;

		// Handle WFLR special case
		if (tokenAddress.toLowerCase() === '0x1d80c49bbbcd1c0911346656b529df9e5c2f783d') {
			const specialPair = pairs.find(
				// eslint-disable-next-line
				(pair: any) =>
					pair.baseToken.address.toLowerCase() ===
						'0xfbda5f676cb37624f28265a144a48b0d6e87d3b6'.toLowerCase() &&
					pair.quoteToken.address.toLowerCase() ===
						'0x1d80c49bbbcd1c0911346656b529df9e5c2f783d'.toLowerCase()
			);

			if (specialPair) {
				currentPrice = 1 / parseFloat(specialPair.priceNative) || 0;

				const priceChange24h = parseFloat(specialPair.priceChange?.h24) || 0;
				if (currentPrice > 0 && priceChange24h !== 0) {
					const priceStart = currentPrice / (1 + priceChange24h / 100);
					averagePrice = (currentPrice + priceStart) / 2;
				} else {
					averagePrice = currentPrice;
				}

				return { averagePrice, currentPrice };
			} else {
				return { averagePrice: 0, currentPrice: 0 };
			}
		}

		// Default case: use the first pair
		const firstPair = pairs[0];
		currentPrice = parseFloat(firstPair?.priceUsd) || 0;

		const priceChange24h = parseFloat(firstPair?.priceChange?.h24) || 0;
		if (currentPrice > 0 && priceChange24h !== 0) {
			const priceStart = currentPrice / (1 + priceChange24h / 100);
			averagePrice = (currentPrice + priceStart) / 2;
		} else {
			averagePrice = currentPrice;
		}
		return { averagePrice, currentPrice };
	} catch {
		return { averagePrice: 0, currentPrice: 0 };
	}
};

export const getSushiUsdPrice = async (
	network: string,
	targetTokenAddress: string,
	targetTokenDecimals: number
): Promise<number> => {
	try {
		const taregtChainId = networkConfig[network].chainId;
		const urls = networkConfig[network].rpc;
		const fallbacks = urls.map((v) =>
			v.startsWith('http')
				? http(v, {
						timeout: 10000
					})
				: webSocket(v, {
						timeout: 10000,
						keepAlive: true,
						reconnect: true
					})
		);
		const configuration = { rank: false, retryCount: 3 };
		if (publicClientConfig[taregtChainId as ChainId]?.chain) {
			const publicClient: PublicClient = createPublicClient({
				chain: publicClientConfig[taregtChainId as ChainId]?.chain as Chain,
				transport: fallback(fallbacks, configuration)
			});
			const dataFetcher = new DataFetcher(taregtChainId as ChainId, publicClient);
			dataFetcher.startDataFetching(undefined);
			dataFetcher.stopDataFetching();
			// @ts-expect-error ChainId type is not supported
			const toToken: Token = USDC[taregtChainId as ChainId];
			const fromToken: Token = new Token({
				chainId: taregtChainId,
				decimals: targetTokenDecimals,
				address: targetTokenAddress
			});
			await dataFetcher.fetchPoolsForToken(fromToken, toToken);
			const pcMap = dataFetcher.getCurrentPoolCodeMap(fromToken, toToken);
			const amountIn = ethers.BigNumber.from('1' + '0'.repeat(targetTokenDecimals));
			const route = Router.findBestRoute(
				pcMap,
				taregtChainId as ChainId,
				fromToken,
				amountIn.toBigInt(),
				toToken,
				Number(await dataFetcher.web3Client.getGasPrice()),
				undefined
			);
			const amountOut = ethers.utils.formatUnits(route.amountOutBI, toToken.decimals);
			return parseFloat(amountOut);
		}
		return 0;
	} catch {
		return 0;
	}
};

// TODO: Remove this function
export const fetchDexTokenPrice = async (
	chainId: number,
	baseTokenAddress: string,
	quoteTokenAddress: string,
	baseTokenDecimals: number,
	quoteTokenDecimals: number
): Promise<number> => {
	try {
		// Generate a recipient address dynamically
		const senderAddress = ethers.Wallet.createRandom().address;

		// Fixed swap amount of 1 base token
		const amountIn = ethers.utils.parseUnits('1', baseTokenDecimals).toBigInt();

		// Get the swap data from SushiSwap
		const data = await getSwap({
			chainId: chainId as ExtractorSupportedChainId,
			tokenIn: baseTokenAddress as `0x${string}`,
			tokenOut: quoteTokenAddress as `0x${string}`,
			amount: amountIn,
			sender: senderAddress as `0x${string}`,
			maxSlippage: 0.005
		});

		if (data.status === 'Success') {
			const amountInFormatted: number = parseFloat(
				ethers.utils.formatUnits(data.amountIn, baseTokenDecimals)
			);
			const amountOutFormatted: number = parseFloat(
				ethers.utils.formatUnits(data.assumedAmountOut, quoteTokenDecimals)
			);
			const price = amountOutFormatted / amountInFormatted;
			return parseFloat(price.toFixed(18));
		}

		return 0;
	} catch {
		return 0;
	}
};
