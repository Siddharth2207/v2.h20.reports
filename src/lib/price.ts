import { ethers } from 'ethers';
import { getSwap } from 'sushi';
import { type ExtractorSupportedChainId } from 'sushi/config';
import { RPParams , DataFetcher} from 'sushiswap/router';
import { Token } from 'sushiswap/currency';

export interface TokenPrice {
	averagePrice: number;
	currentPrice: number;
}

export async function getTokenPriceUsd(tokenAddress: string, tokenSymbol: string, network: string) {
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
}

export const fetchDexTokenPrice = async (
	chainId: number,
	baseTokenAddress: string,
	quoteTokenAddress: string,
	baseTokenDecimals: number,
	quoteTokenDecimals: number
): Promise<number> => {
	try {
		// Generate a recipient address dynamically
		const recipientAddress = ethers.Wallet.createRandom().address;

		// Fixed swap amount of 1 base token
		const amountIn = ethers.utils.parseUnits('1', baseTokenDecimals).toBigInt();

		// Get the swap data from SushiSwap
		const data = await getSwap({
			chainId: chainId as ExtractorSupportedChainId,
			tokenIn: baseTokenAddress as `0x${string}`,
			tokenOut: quoteTokenAddress as `0x${string}`,
			to: recipientAddress as `0x${string}`,
			amount: amountIn,
			maxSlippage: 0.005,
			includeTransaction: true
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

export async function getRpSwap() {
	let test: RPParams = {
		tokenIn: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`,
		amountIn: BigInt(1),
		tokenOut: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`,
		amountOutMin: BigInt(2),
		to: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`,
		routeCode: `0x123445`,
		data: `0x123345`
	};
	console.log(test);
	const dataFetcher = DataFetcher.onChain(1);
	const toToken = new Token({
        chainId: 8453,
        decimals: 18,
        address: '0x99b2b1a2adb02b38222adcd057783d7e5d1fcc7d'
    });
    const fromToken = new Token({
        chainId: 8453,
        decimals: 18,
        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    });
	const pools = await dataFetcher.fetchPoolsForToken(fromToken, toToken);
	console.log(pools);
}
