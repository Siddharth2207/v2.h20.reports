import { ethers } from 'ethers';
import { getTokenPriceUsd } from './price';
import { tokenConfig } from './constants';
import { settings } from '$lib/stores/report';
import { get } from 'svelte/store';
import axios from 'axios';
import type {
	LiquidityAnalysisResult,
	NetworkConfigSourceWithBlockTime,
	PoolData,
	PoolTrade,
	TradesByTimeStamp
} from './types';

export const uniswapV2PoolAbi = [
	'function token0() external view returns (address)',
	'function token1() external view returns (address)'
];

export const erc20Abi = [
	'function decimals() external view returns (uint8)',
	'function symbol() external view returns (string)'
];

export const uniswapV2SwapTopic =
	'0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822';
export const uniswapV3SwapTopic =
	'0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67';
export const pancakeSwapV3SwapTopic =
	'0x19b47279256b2a23a1665c810c8d55a1758940ee09377d4f8d26497a3577dc83';

export interface Block {
	number: number;
	timestamp: number;
}

export async function analyzeLiquidity(
	network: string,
	tokenSlug: string,
	fromTimestamp: number,
	toTimestamp: number
): Promise<LiquidityAnalysisResult> {
	const networkSettings = get(settings);
	if (!networkSettings?.networks) {
		throw new Error('Network settings not found');
	}

	const { tradesAccordingToTimeStamp, totalPoolVolumeUsdForDuration, totalPoolTradesForDuration } =
		await analyzeHyperSyncData(
			tokenSlug,
			network,
			networkSettings?.networks[network],
			fromTimestamp,
			toTimestamp
		);

	return {
		tradesAccordingToTimeStamp,
		totalTokenExternalVolForDurationUsd: totalPoolVolumeUsdForDuration,
		totalTokenExternalTradesForDuration: totalPoolTradesForDuration
	};
}

async function getBlockNumberForTimestampByBlockTime(
	network: NetworkConfigSourceWithBlockTime,
	targetTimestamp: number
): Promise<number> {
	const currentTimestamp = Math.floor(Date.now() / 1000);
	const diff = currentTimestamp - targetTimestamp;

	const provider = new ethers.providers.JsonRpcProvider(network.rpc);

	// Fetch the latest block
	const latestBlock = await provider.getBlock('latest');
	const latestBlockNumber = latestBlock.number;

	const approxNearBlock =
		latestBlockNumber - Math.floor(network.blockTime ? diff / network.blockTime : 0);

	// Query Hypersync for blocks
	const queryResponse = await axios.post(`https://${network['chain-id']}.hypersync.xyz/query`, {
		from_block: approxNearBlock,
		include_all_blocks: true,
		field_selection: {
			block: ['number', 'timestamp']
		}
	});

	// Parse and normalize block data
	//eslint-disable-next-line @typescript-eslint/no-explicit-any
	const allBlocks: Block[] = queryResponse.data.data.flatMap((item: any) =>
		//eslint-disable-next-line @typescript-eslint/no-explicit-any
		item.blocks.map((block: any) => ({
			number: block.number,
			timestamp: parseInt(block.timestamp, 16)
		}))
	);

	// Binary search to find the nearest block
	const findNearestBlock = (blocks: Block[], targetTimestamp: number): Block => {
		let left = 0;
		let right = blocks.length - 1;
		let nearestBlock: Block | null = null;

		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			const midTimestamp = blocks[mid].timestamp;

			if (
				nearestBlock === null ||
				Math.abs(midTimestamp - targetTimestamp) <
					Math.abs(nearestBlock.timestamp - targetTimestamp)
			) {
				nearestBlock = blocks[mid];
			}

			if (midTimestamp < targetTimestamp) {
				left = mid + 1;
			} else if (midTimestamp > targetTimestamp) {
				right = mid - 1;
			} else {
				return blocks[mid]; // Exact match
			}
		}

		if (!nearestBlock) {
			throw new Error('No nearest block found.');
		}

		return nearestBlock;
	};

	const nearestBlock = findNearestBlock(allBlocks, targetTimestamp);

	return nearestBlock.number;
}

async function getBlockNumberForTimestampByHyperSync(
	network: NetworkConfigSourceWithBlockTime,
	targetTimestamp: number
): Promise<number> {
	const HYPERSYNC_URL = `https://${network['chain-id']}.hypersync.xyz/query`;

	try {
		// Get the latest block number
		const provider = new ethers.providers.JsonRpcProvider(network.rpc);
		const latestBlock = await provider.getBlock('latest');
		const latestBlockNumber = latestBlock.number;

		let left = 0;
		let right = latestBlockNumber;

		let closestBlock = null;
		let smallestDiff = Infinity;

		// Binary search loop
		while (left <= right) {
			const mid = Math.floor((left + right) / 2);

			// Create Hypersync query for the mid block
			const query = {
				from_block: mid,
				to_block: mid + 1, // Exclusive upper bound
				logs: [{}], // Empty log selection for block data
				field_selection: {
					block: ['number', 'timestamp']
				}
			};

			try {
				// Fetch block data from Hypersync
				const response = await axios.post(HYPERSYNC_URL, query);
				//eslint-disable-next-line @typescript-eslint/no-explicit-any
				const blocks = response.data.data.flatMap((item: any) => item.blocks);

				if (blocks.length === 0) {
					right = mid - 1;
					continue;
				}

				const block = blocks[0];
				const blockTimestamp = parseInt(block.timestamp, 16); // Convert hex to integer

				// Calculate the difference from the target timestamp
				const diff = Math.abs(blockTimestamp - targetTimestamp);

				// Update closest block if this is a better match
				if (diff < smallestDiff) {
					smallestDiff = diff;
					closestBlock = block.number;
				}

				// Adjust binary search range
				if (blockTimestamp < targetTimestamp) {
					left = mid + 1;
				} else {
					right = mid - 1;
				}
			} catch {
				// Skip this block range and move backward
				right = mid - 1;
			}
		}

		if (closestBlock !== null) {
			return closestBlock;
		} else {
			return 0;
		}
	} catch {
		return 0;
	}
}

export async function getBlockNumberForTimestamp(
	network: NetworkConfigSourceWithBlockTime,
	targetTimestamp: number
): Promise<number> {
	return getBlockNumberForTimestampByHyperSync(network, targetTimestamp);
}

async function analyzeHyperSyncData(
	tokenSlug: string,
	networkLabel: string,
	network: NetworkConfigSourceWithBlockTime,
	fromTimestamp: number,
	toTimestamp: number
) {
	// Create hypersync client using the mainnet hypersync endpoint
	const hyperSyncClinet = `https://${network['chain-id']}.hypersync.xyz/query`;
	const token = tokenConfig[tokenSlug.toUpperCase()];

	const fromBlockNumber = await getBlockNumberForTimestamp(network, fromTimestamp);
	const toBlockNumber = await getBlockNumberForTimestamp(network, toTimestamp);

	if (fromBlockNumber === 0 || toBlockNumber === 0) {
		return {
			tradesAccordingToTimeStamp: [],
			totalPoolVolumeUsdForDuration: 0,
			totalPoolTradesForDuration: 0
		};
	}

	const provider = new ethers.providers.JsonRpcProvider(network.rpc);

	const totalVolumeForTokens: Record<string, { totalTokenVolumeForDuration: number }> = {};
	let totalPoolTradesForDuration = 0;

	const tradesAccordingToTimeStamp: TradesByTimeStamp[] = [];
	const currentTokenPrice = await getTokenPriceUsd(
		networkLabel,
		token.address,
		token.symbol,
		token.decimals
	);

	for (let i = 0; i < token.poolsV2.length; i++) {
		const poolContractAddress = token.poolsV2[i];
		const poolContract = new ethers.Contract(poolContractAddress, uniswapV2PoolAbi, provider);
		const token0Address = await poolContract.token0();
		const token1Address = await poolContract.token1();

		const token0Contract = new ethers.Contract(token0Address, erc20Abi, provider);
		const token1Contract = new ethers.Contract(token1Address, erc20Abi, provider);

		const token0Decimals = await token0Contract.decimals();
		const token1Decimals = await token1Contract.decimals();

		const swapQueryResult = await fetchLogs(
			hyperSyncClinet,
			poolContractAddress,
			uniswapV2SwapTopic,
			fromBlockNumber,
			toBlockNumber
		);

		let totalAmount0 = ethers.BigNumber.from(0);
		let totalAmount1 = ethers.BigNumber.from(0);
		totalPoolTradesForDuration += swapQueryResult.length;

		for (let i = 0; i < swapQueryResult.length; i++) {
			const log = swapQueryResult[i]?.data;

			if (log !== undefined) {
				const logBytes = ethers.utils.arrayify(log);
				const decodedAmount = ethers.utils.defaultAbiCoder.decode(
					['uint256', 'uint256', 'uint256', 'uint256'],
					logBytes
				);
				totalAmount0 = totalAmount0
					.add(ethers.BigNumber.from(decodedAmount[0]))
					.add(ethers.BigNumber.from(decodedAmount[2]));
				totalAmount1 = totalAmount1
					.add(ethers.BigNumber.from(decodedAmount[1]))
					.add(ethers.BigNumber.from(decodedAmount[3]));

				const tokenAmount =
					token0Address.toLowerCase() === token.address.toLowerCase()
						? ethers.utils
								.formatUnits(
									ethers.BigNumber.from(decodedAmount[0]).add(
										ethers.BigNumber.from(decodedAmount[2])
									),
									token0Decimals
								)
								.toString()
						: ethers.utils
								.formatUnits(
									ethers.BigNumber.from(decodedAmount[1]).add(
										ethers.BigNumber.from(decodedAmount[3])
									),
									token1Decimals
								)
								.toString();

				tradesAccordingToTimeStamp.push({
					timestamp: swapQueryResult[i].timestamp,
					transactionHash: swapQueryResult[i].transaction_hash,
					amountInTokens: parseFloat(tokenAmount),
					amountInUsd: parseFloat(tokenAmount) * currentTokenPrice
				});
			}
		}

		const totalAmount0Formated = parseFloat(
			ethers.utils.formatUnits(totalAmount0.toString(), token0Decimals)
		);
		const totalAmount1Formated = parseFloat(
			ethers.utils.formatUnits(totalAmount1.toString(), token1Decimals)
		);

		if (totalVolumeForTokens[token0Address.toLowerCase()]) {
			totalVolumeForTokens[token0Address.toLowerCase()].totalTokenVolumeForDuration +=
				totalAmount0Formated;
		} else {
			totalVolumeForTokens[token0Address.toLowerCase()] = {
				totalTokenVolumeForDuration: totalAmount0Formated
			};
		}

		if (totalVolumeForTokens[token1Address.toLowerCase()]) {
			totalVolumeForTokens[token1Address.toLowerCase()].totalTokenVolumeForDuration +=
				totalAmount1Formated;
		} else {
			totalVolumeForTokens[token1Address.toLowerCase()] = {
				totalTokenVolumeForDuration: totalAmount1Formated
			};
		}
	}

	for (let i = 0; i < token.poolsV3.length; i++) {
		const poolContractAddress = token.poolsV3[i];
		const poolContract = new ethers.Contract(poolContractAddress, uniswapV2PoolAbi, provider);
		const token0Address = await poolContract.token0();
		const token1Address = await poolContract.token1();

		const token0Contract = new ethers.Contract(token0Address, erc20Abi, provider);
		const token1Contract = new ethers.Contract(token1Address, erc20Abi, provider);
		const token0Decimals = await token0Contract.decimals();
		const token1Decimals = await token1Contract.decimals();

		let totalAmount0 = ethers.BigNumber.from(0);
		let totalAmount1 = ethers.BigNumber.from(0);

		const swapQueryResult = await fetchLogs(
			hyperSyncClinet,
			poolContractAddress,
			uniswapV3SwapTopic,
			fromBlockNumber,
			toBlockNumber
		);

		totalPoolTradesForDuration += swapQueryResult.length;
		for (let i = 0; i < swapQueryResult.length; i++) {
			const log = swapQueryResult[i]?.data;

			if (log !== undefined) {
				const logBytes = ethers.utils.arrayify(log);
				const decodedAmount = ethers.utils.defaultAbiCoder.decode(
					['int256', 'int256', 'uint160', 'uint128', 'int24'],
					logBytes
				);
				totalAmount0 = totalAmount0.add(ethers.BigNumber.from(decodedAmount[0]).abs());
				totalAmount1 = totalAmount1.add(ethers.BigNumber.from(decodedAmount[1]).abs());

				const tokenAmount =
					token0Address.toLowerCase() === token.address.toLowerCase()
						? ethers.utils
								.formatUnits(ethers.BigNumber.from(decodedAmount[0]).abs(), token0Decimals)
								.toString()
						: ethers.utils
								.formatUnits(ethers.BigNumber.from(decodedAmount[1]).abs(), token1Decimals)
								.toString();

				tradesAccordingToTimeStamp.push({
					timestamp: swapQueryResult[i].timestamp,
					transactionHash: swapQueryResult[i].transaction_hash,
					amountInTokens: parseFloat(tokenAmount),
					amountInUsd: parseFloat(tokenAmount) * currentTokenPrice
				});
			}
		}

		const totalAmount0Formated = parseFloat(
			ethers.utils.formatUnits(totalAmount0.toString(), token0Decimals)
		);
		const totalAmount1Formated = parseFloat(
			ethers.utils.formatUnits(totalAmount1.toString(), token1Decimals)
		);

		if (totalVolumeForTokens[token0Address.toLowerCase()]) {
			totalVolumeForTokens[token0Address.toLowerCase()].totalTokenVolumeForDuration +=
				totalAmount0Formated;
		} else {
			totalVolumeForTokens[token0Address.toLowerCase()] = {
				totalTokenVolumeForDuration: totalAmount0Formated
			};
		}

		if (totalVolumeForTokens[token1Address.toLowerCase()]) {
			totalVolumeForTokens[token1Address.toLowerCase()].totalTokenVolumeForDuration +=
				totalAmount1Formated;
		} else {
			totalVolumeForTokens[token1Address.toLowerCase()] = {
				totalTokenVolumeForDuration: totalAmount1Formated
			};
		}
	}

	for (let i = 0; i < token.poolsPancakSwapV3.length; i++) {
		const poolContractAddress = token.poolsPancakSwapV3[i];
		const poolContract = new ethers.Contract(poolContractAddress, uniswapV2PoolAbi, provider);
		const token0Address = await poolContract.token0();
		const token1Address = await poolContract.token1();

		const token0Contract = new ethers.Contract(token0Address, erc20Abi, provider);
		const token1Contract = new ethers.Contract(token1Address, erc20Abi, provider);
		const token0Decimals = await token0Contract.decimals();
		const token1Decimals = await token1Contract.decimals();

		let totalAmount0 = ethers.BigNumber.from(0);
		let totalAmount1 = ethers.BigNumber.from(0);

		const swapQueryResult = await fetchLogs(
			hyperSyncClinet,
			poolContractAddress,
			pancakeSwapV3SwapTopic,
			fromBlockNumber,
			toBlockNumber
		);

		totalPoolTradesForDuration += swapQueryResult.length;
		for (let i = 0; i < swapQueryResult.length; i++) {
			const log = swapQueryResult[i]?.data;

			if (log !== undefined) {
				const logBytes = ethers.utils.arrayify(log);
				const decodedAmount = ethers.utils.defaultAbiCoder.decode(
					['int256', 'int256', 'uint160', 'uint128', 'int24', 'uint128', 'uint128'],
					logBytes
				);
				totalAmount0 = totalAmount0.add(ethers.BigNumber.from(decodedAmount[0]).abs());
				totalAmount1 = totalAmount1.add(ethers.BigNumber.from(decodedAmount[1]).abs());

				const tokenAmount =
					token0Address.toLowerCase() === token.address.toLowerCase()
						? ethers.utils
								.formatUnits(ethers.BigNumber.from(decodedAmount[0]).abs(), token0Decimals)
								.toString()
						: ethers.utils
								.formatUnits(ethers.BigNumber.from(decodedAmount[1]).abs(), token1Decimals)
								.toString();

				tradesAccordingToTimeStamp.push({
					timestamp: swapQueryResult[i].timestamp,
					transactionHash: swapQueryResult[i].transaction_hash,
					amountInTokens: parseFloat(tokenAmount),
					amountInUsd: parseFloat(tokenAmount) * currentTokenPrice
				});
			}
		}

		const totalAmount0Formated = parseFloat(
			ethers.utils.formatUnits(totalAmount0.toString(), token0Decimals)
		);
		const totalAmount1Formated = parseFloat(
			ethers.utils.formatUnits(totalAmount1.toString(), token1Decimals)
		);

		if (totalVolumeForTokens[token0Address.toLowerCase()]) {
			totalVolumeForTokens[token0Address.toLowerCase()].totalTokenVolumeForDuration +=
				totalAmount0Formated;
		} else {
			totalVolumeForTokens[token0Address.toLowerCase()] = {
				totalTokenVolumeForDuration: totalAmount0Formated
			};
		}

		if (totalVolumeForTokens[token1Address.toLowerCase()]) {
			totalVolumeForTokens[token1Address.toLowerCase()].totalTokenVolumeForDuration +=
				totalAmount1Formated;
		} else {
			totalVolumeForTokens[token1Address.toLowerCase()] = {
				totalTokenVolumeForDuration: totalAmount1Formated
			};
		}
	}
	const totalPoolVolumeUsdForDuration =
		totalVolumeForTokens[token.address.toLowerCase()].totalTokenVolumeForDuration *
		currentTokenPrice;

	return { tradesAccordingToTimeStamp, totalPoolVolumeUsdForDuration, totalPoolTradesForDuration };
}

// TODO: Introduce typechecking
async function fetchLogs(
	client: string,
	poolContract: string,
	eventTopic: string,
	startBlock: number,
	endBlock: number
	//eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Array<any>> {
	let currentBlock = startBlock;

	//eslint-disable-next-line @typescript-eslint/no-explicit-any
	let logs: Array<any> = [];

	while (currentBlock <= endBlock) {
		try {
			const queryResponse = await axios.post(client, {
				from_block: currentBlock,
				logs: [
					{
						address: [poolContract],
						topics: [[eventTopic]]
					}
				],
				field_selection: {
					log: [
						'block_number',
						'log_index',
						'transaction_index',
						'transaction_hash',
						'data',
						'address',
						'topic0'
					],
					block: ['number', 'timestamp']
				}
			});

			// Concatenate logs if there are any
			if (
				queryResponse.data.data &&
				queryResponse.data.data.length > 0 &&
				currentBlock != queryResponse.data.next_block
			) {
				logs = logs.concat(queryResponse.data.data);
			}

			// Update currentBlock for the next iteration
			currentBlock = queryResponse.data.next_block;

			// Exit the loop if nextBlock is invalid
			if (!currentBlock || currentBlock > endBlock) {
				break;
			}
		} catch {
			break; // Exit loop on error
		}
	}

	return logs.flatMap((entry) => {
		// Create a map of block_number to timestamp
		const blockMap = new Map(
			//eslint-disable-next-line @typescript-eslint/no-explicit-any
			entry.blocks.map((block: any) => [block.number, parseInt(block.timestamp, 16)])
		);

		// Map each log with the corresponding timestamp
		//eslint-disable-next-line @typescript-eslint/no-explicit-any
		return entry.logs.map((log: any) => ({
			...log,
			timestamp: blockMap.get(log.block_number) || null // Add timestamp if available
		}));
	});
}

export async function fetchPoolData(
	client: string,
	poolContract: string,
	eventTopic: string,
	startBlock: number,
	endBlock: number
) {
	let currentBlock = startBlock;
	//eslint-disable-next-line @typescript-eslint/no-explicit-any
	let logs: any[] = [];
	while (currentBlock <= endBlock) {
		try {
			const queryResponse = await axios.post(client, {
				from_block: currentBlock,
				logs: [
					{
						address: [poolContract],
						topics: [[eventTopic]]
					}
				],
				field_selection: {
					log: ['block_number', 'transaction_hash', 'data', 'address', 'topic0'],
					block: ['number', 'timestamp']
				}
			});
			// Concatenate logs if there are any
			if (
				queryResponse.data.data &&
				queryResponse.data.data.length > 0 &&
				currentBlock != queryResponse.data.next_block
			) {
				logs = logs.concat(queryResponse.data.data);
			}
			// Update currentBlock for the next iteration
			currentBlock = queryResponse.data.next_block;
			// Exit the loop if nextBlock is invalid
			if (!currentBlock || currentBlock > endBlock) {
				break;
			}
		} catch {
			break;
		}
	}
	const combinedData = logs.flatMap((entry) => {
		// Create a map of block_number to timestamp
		const blockMap = new Map(
			//eslint-disable-next-line @typescript-eslint/no-explicit-any
			entry.blocks.map((block: any) => [block.number, parseInt(block.timestamp, 16)])
		);

		// Map each log with the corresponding timestamp
		//eslint-disable-next-line @typescript-eslint/no-explicit-any
		return entry.logs.map((log: any) => ({
			...log,
			timestamp: blockMap.get(log.block_number) || null
		}));
	});

	//eslint-disable-next-line @typescript-eslint/no-explicit-any
	return Array.from(new Map(combinedData.map((log: any) => [log.transaction_hash, log])).values());
}

export async function getBlockData(
	network: NetworkConfigSourceWithBlockTime,
	poolAddress: string,
	poolType: string,
	fromBlock: number,
	toBlock: number
): Promise<PoolData> {
	const hyperSyncClinet = `https://${network['chain-id']}.hypersync.xyz/query`;

	const provider = new ethers.providers.JsonRpcProvider(network.rpc);

	const poolContract = new ethers.Contract(poolAddress, uniswapV2PoolAbi, provider);
	const token0Address = await poolContract.token0();
	const token1Address = await poolContract.token1();
	const token0Contract = new ethers.Contract(token0Address, erc20Abi, provider);
	const token1Contract = new ethers.Contract(token1Address, erc20Abi, provider);
	const token0Decimals = await token0Contract.decimals();
	const token1Decimals = await token1Contract.decimals();
	const token0Symbol = await token0Contract.symbol();
	const token1Symbol = await token1Contract.symbol();
	const poolTrades: PoolTrade[] = [];

	if (poolType === 'v2') {
		const swapQueryResult = await fetchPoolData(
			hyperSyncClinet,
			poolAddress,
			uniswapV2SwapTopic,
			fromBlock,
			toBlock
		);

		for (let i = 0; i < swapQueryResult.length; i++) {
			const log = swapQueryResult[i]?.data;
			if (log !== undefined) {
				const logBytes = ethers.utils.arrayify(log);
				const decodedAmount = ethers.utils.defaultAbiCoder.decode(
					['uint256', 'uint256', 'uint256', 'uint256'],
					logBytes
				);
				const amount0 = ethers.BigNumber.from(decodedAmount[0]).add(
					ethers.BigNumber.from(decodedAmount[2])
				);
				const amount1 = ethers.BigNumber.from(decodedAmount[1]).add(
					ethers.BigNumber.from(decodedAmount[3])
				);
				const amount0Formated = ethers.utils.formatUnits(amount0.toString(), token0Decimals);
				const amount1Formated = ethers.utils.formatUnits(amount1.toString(), token1Decimals);

				const fpAmount0 = ethers.BigNumber.from(amount0)
					.abs()
					.mul(ethers.BigNumber.from('1' + '0'.repeat(18 - token0Decimals)));
				const fpAmount1 = ethers.BigNumber.from(amount1)
					.abs()
					.mul(ethers.BigNumber.from('1' + '0'.repeat(18 - token1Decimals)));
				const ratio0 = fpAmount1.gt(ethers.BigNumber.from(0))
					? fpAmount0
							.mul(ethers.BigNumber.from('1' + '0'.repeat(18)))
							.div(fpAmount1)
							.toString()
					: ethers.BigNumber.from(0).toString();
				const ratio1 = fpAmount0.gt(ethers.BigNumber.from(0))
					? fpAmount1
							.mul(ethers.BigNumber.from('1' + '0'.repeat(18)))
							.div(fpAmount0)
							.toString()
					: ethers.BigNumber.from(0).toString();

				poolTrades.push({
					blockNumber: swapQueryResult[i].block_number,
					poolAddress: poolAddress,
					transactionHash: swapQueryResult[i].transaction_hash,
					amount0: amount0Formated,
					amount1: amount1Formated,
					timestamp: swapQueryResult[i].timestamp,
					ratio0: ethers.utils.formatUnits(ratio0, 18),
					ratio1: ethers.utils.formatUnits(ratio1, 18)
				});
			}
		}
	} else if (poolType === 'v3' || poolType === 'pancakSwapV3') {
		const swapQueryResult = await fetchPoolData(
			hyperSyncClinet,
			poolAddress,
			poolType === 'v3' ? uniswapV3SwapTopic : pancakeSwapV3SwapTopic,
			fromBlock,
			toBlock
		);
		for (let i = 0; i < swapQueryResult.length; i++) {
			const log = swapQueryResult[i]?.data;
			if (log !== undefined) {
				const logBytes = ethers.utils.arrayify(log);
				const decodedAmount = ethers.utils.defaultAbiCoder.decode(
					['int256', 'int256', 'uint160', 'uint128', 'int24'],
					logBytes
				);
				const totalAmount0 = ethers.BigNumber.from(decodedAmount[0]).abs();
				const totalAmount1 = ethers.BigNumber.from(decodedAmount[1]).abs();

				const priceEthInUsdc = Math.pow(parseInt(decodedAmount[2]) / Math.pow(2, 96), 2);
				const ratio = Math.pow(10, token1Decimals) / Math.pow(10, token0Decimals);
				const ratio0 = ratio / priceEthInUsdc;
				const ratio1 = 1 / ratio0;

				// Format values to avoid scientific notation
				const formatDecimal = (value: number): string => {
					return value.toLocaleString('fullwide', {
						useGrouping: false,
						maximumFractionDigits: 20
					});
				};

				poolTrades.push({
					blockNumber: swapQueryResult[i].block_number,
					poolAddress: poolAddress,
					transactionHash: swapQueryResult[i].transaction_hash,
					amount0: ethers.utils.formatUnits(totalAmount0.toString(), token0Decimals),
					amount1: ethers.utils.formatUnits(totalAmount1.toString(), token1Decimals),
					timestamp: swapQueryResult[i].timestamp,
					ratio0: formatDecimal(ratio0),
					ratio1: formatDecimal(ratio1)
				});
			}
		}
	}
	const poolData: PoolData = {
		token0Address: token0Address,
		token1Address: token1Address,
		token0Decimals: token0Decimals,
		token1Decimals: token1Decimals,
		token0Symbol: token0Symbol,
		token1Symbol: token1Symbol,
		poolAddress: poolAddress,
		poolType: poolType,
		poolTrades: poolTrades
	};
	return poolData;
}
