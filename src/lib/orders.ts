import type {
	OrderListOrderWithSubgraphName,
	OrderListVault,
	OrderListTotalVolume
} from '$lib/types';
import { DEFAULT_VAULTS_PAGE_SIZE } from '$lib/constants';
import type { SgTrade, SgVaultBalanceChangeUnwrapped } from '@rainlanguage/orderbook/js_api';
import { getVaultBalanceChanges } from '@rainlanguage/orderbook/js_api';
import { getTokenPriceUsd } from '$lib/price';
import { ethers } from 'ethers';

export function formatTimestamp(timestamp: number) {
	if (!timestamp || timestamp === 0) {
		return 'N/A';
	}

	const dateObj = new Date(timestamp * 1000);

	const date = dateObj.toLocaleDateString('en-GB', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});

	const time = dateObj.toLocaleTimeString('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});

	return `${date} ${time}`;
}

export const formatBalance = (balance: number) => {
	if (!balance || isNaN(balance)) return '0.00';

	const absValue = Math.abs(balance);
	const sign = balance < 0 ? '-' : '';

	const formatter = new Intl.NumberFormat('en-US', {
		notation: 'compact',
		maximumFractionDigits: 2
	});

	return sign + formatter.format(absValue);
};

export async function orderWithVaultBalanceChanges(
	subgraphUrl: string,
	orders: OrderListOrderWithSubgraphName[]
): Promise<OrderListOrderWithSubgraphName[]> {
	for (const order of orders) {
		const vaultBalanceChangesMap = new Map();
		const allVaults = [...order.order.inputs, ...order.order.outputs];
		const uniqueVaults = allVaults.filter(
			(vault, index) => allVaults.findIndex((v) => v.id === vault.id) === index
		);
		for (const vault of uniqueVaults) {
			let allBalanceChanges: SgVaultBalanceChangeUnwrapped[] = [];
			let currentPage = 1;
			let hasMore = true;
			while (hasMore) {
				const balanceChanges = await getVaultBalanceChanges(subgraphUrl, vault.id, {
					page: currentPage,
					pageSize: DEFAULT_VAULTS_PAGE_SIZE
				});
				allBalanceChanges = [...allBalanceChanges, ...balanceChanges];
				hasMore = balanceChanges.length === DEFAULT_VAULTS_PAGE_SIZE;
				currentPage++;
			}
			vaultBalanceChangesMap.set(vault.id, allBalanceChanges);
		}
		order.order['inputs'] = order.order.inputs.map((input: OrderListVault) => ({
			...input,
			balanceChanges: vaultBalanceChangesMap.get(input.id) || []
		}));
		order.order['outputs'] = order.order.outputs.map((output: OrderListVault) => ({
			...output,
			balanceChanges: vaultBalanceChangesMap.get(output.id) || []
		}));
	}
	return orders;
}

export async function getTokenPriceUsdMap(
	orders: OrderListOrderWithSubgraphName[]
): Promise<OrderListOrderWithSubgraphName[]> {
	try {
		const tokenPriceUsdMap = new Map<string, number>();
		for (const order of orders) {
			for (const input of order.order.inputs) {
				if (tokenPriceUsdMap.has(input.token.address)) {
					continue;
				}
				const tokenPrice = await getTokenPriceUsd(
					input.token.address,
					input.token?.symbol || '',
					order.subgraphName
				);
				tokenPriceUsdMap.set(input.token.address, tokenPrice.currentPrice);
			}
			for (const output of order.order.outputs) {
				if (tokenPriceUsdMap.has(output.token.address)) {
					continue;
				}
				const tokenPrice = await getTokenPriceUsd(
					output.token.address,
					output.token?.symbol || '',
					order.subgraphName
				);
				tokenPriceUsdMap.set(output.token.address, tokenPrice.currentPrice);
			}
			order.order['tokenPriceUsdMap'] = tokenPriceUsdMap;
		}
		for (const order of orders) {
			order.order['tokenPriceUsdMap'] = tokenPriceUsdMap;
		}
		return orders;
	} catch {
		return orders;
	}
}

export function calculateTradeVolume(trades: SgTrade[]): OrderListTotalVolume[] {
	try {
		const tokenVolumes: Record<string, { totalVolume: number; tokenAddress: string }> = {};
		for (const trade of trades) {
			if (trade.outputVaultBalanceChange) {
				const { vault, amount } = trade.outputVaultBalanceChange;
				if (vault && vault.token) {
					const { symbol, decimals, address } = vault.token;
					const volume = parseFloat(ethers.utils.formatUnits(amount, decimals).toString());

					if (symbol) {
						if (!tokenVolumes[symbol]) {
							tokenVolumes[symbol] = { totalVolume: 0, tokenAddress: address };
						}
						tokenVolumes[symbol].totalVolume += Math.abs(volume);
					}
				}
			}
			if (trade.inputVaultBalanceChange) {
				const { vault, amount } = trade.inputVaultBalanceChange;
				if (vault && vault.token) {
					const { symbol, decimals, address } = vault.token;
					const volume = parseFloat(ethers.utils.formatUnits(amount, decimals).toString());

					if (symbol) {
						if (!tokenVolumes[symbol]) {
							tokenVolumes[symbol] = { totalVolume: 0, tokenAddress: address };
						}
						tokenVolumes[symbol].totalVolume += Math.abs(volume);
					}
				}
			}
		}
		return Object.entries(tokenVolumes).map(([symbol, data]) => ({
			token: symbol,
			tokenAddress: data.tokenAddress,
			totalVolume: data.totalVolume
		}));
	} catch {
		return [];
	}
}

export function calculateTotalDepositsAndWithdrawals(
	orders: OrderListOrderWithSubgraphName[]
): OrderListOrderWithSubgraphName[] {
	try {
		for (const order of orders) {
			order.order['orderDuration'] = Date.now() / 1000 - parseFloat(order.order.timestampAdded);
			for (const input of order.order.inputs) {
				input['totalDeposits'] = input.balanceChanges
					.filter((change: SgVaultBalanceChangeUnwrapped) => change.__typename === 'Deposit')
					.reduce(
						(sum: number, change: SgVaultBalanceChangeUnwrapped) =>
							sum +
							parseFloat(ethers.utils.formatUnits(change.amount, input.token.decimals).toString()),
						0
					);
				input['totalWithdrawals'] = input.balanceChanges
					.filter((change: SgVaultBalanceChangeUnwrapped) => change.__typename === 'Withdrawal')
					.reduce(
						(sum: number, change: SgVaultBalanceChangeUnwrapped) =>
							sum +
							parseFloat(ethers.utils.formatUnits(change.amount, input.token.decimals).toString()),
						0
					);
				input['currentVaultInputs'] =
					input.totalWithdrawals +
					parseFloat(ethers.utils.formatUnits(input.balance, input.token.decimals).toString());
				input['curerentVaultDifferential'] = input.currentVaultInputs - input.totalDeposits;
				input['curerentVaultDifferentialPercentage'] =
					input.totalDeposits > 0
						? (input.curerentVaultDifferential / input.totalDeposits) * 100
						: 0;
				input['currentVaultApy'] =
					(input.curerentVaultDifferential * 31536000) / order.order.orderDuration;
				input['currentVaultApyPercentage'] =
					(input.curerentVaultDifferentialPercentage * 31536000) / order.order.orderDuration;
			}
			for (const output of order.order.outputs) {
				output['totalDeposits'] = output.balanceChanges
					.filter((change: SgVaultBalanceChangeUnwrapped) => change.__typename === 'Deposit')
					.reduce(
						(sum: number, change: SgVaultBalanceChangeUnwrapped) =>
							sum +
							parseFloat(ethers.utils.formatUnits(change.amount, output.token.decimals).toString()),
						0
					);
				output['totalWithdrawals'] = output.balanceChanges
					.filter((change: SgVaultBalanceChangeUnwrapped) => change.__typename === 'Withdrawal')
					.reduce(
						(sum: number, change: SgVaultBalanceChangeUnwrapped) =>
							sum +
							parseFloat(ethers.utils.formatUnits(change.amount, output.token.decimals).toString()),
						0
					);
				output['currentVaultInputs'] =
					output.totalWithdrawals +
					parseFloat(ethers.utils.formatUnits(output.balance, output.token.decimals).toString());
				output['curerentVaultDifferential'] = output.currentVaultInputs - output.totalDeposits;
				output['curerentVaultDifferentialPercentage'] =
					output.totalDeposits > 0
						? (output.curerentVaultDifferential / output.totalDeposits) * 100
						: 0;
				output['currentVaultApy'] =
					(output.curerentVaultDifferential * 31536000) / order.order.orderDuration;
				output['currentVaultApyPercentage'] =
					(output.curerentVaultDifferentialPercentage * 31536000) / order.order.orderDuration;
			}
			const currentOrderTotalDepositsUsd = order.order.outputs.reduce(
				(acc: number, output: OrderListVault) =>
					acc +
					output.totalDeposits * (order.order.tokenPriceUsdMap.get(output.token.address) || 0),
				0
			);
			const currentOrderTotalInputsUsd = order.order.inputs.reduce(
				(acc: number, input: OrderListVault) =>
					acc +
					input.currentVaultInputs * (order.order.tokenPriceUsdMap.get(input.token.address) || 0),
				0
			);
			order.order['roi'] = currentOrderTotalInputsUsd - currentOrderTotalDepositsUsd;
			order.order['roiPercentage'] =
				currentOrderTotalInputsUsd > 0
					? (order.order['roi'] / currentOrderTotalDepositsUsd) * 100
					: 0;
			order.order['apy'] = (order.order['roi'] * 31536000) / order.order.orderDuration;
			order.order['apyPercentage'] =
				(order.order['roiPercentage'] * 31536000) / order.order.orderDuration;
		}
		return orders;
	} catch {
		return orders;
	}
}

export function calculateBalanceChanges(
	orders: OrderListOrderWithSubgraphName[]
): OrderListOrderWithSubgraphName[] {
	function calculateTokenBalanceChanges(
		trades24h: SgTrade[],
		item: OrderListVault,
		isInput: boolean
	) {
		if (trades24h.length === 0) {
			item['balanceChange24h'] = 0;
			item['percentageChange24h'] = 0;
			return;
		}
		const oldestTrade = trades24h[trades24h.length - 1];
		const latestTrade = trades24h[0];
		const getBalance = (trade: SgTrade) => {
			const primaryChange = isInput
				? trade.inputVaultBalanceChange
				: trade.outputVaultBalanceChange;
			const secondaryChange = isInput
				? trade.outputVaultBalanceChange
				: trade.inputVaultBalanceChange;

			return item.token.address === primaryChange?.vault.token.address
				? primaryChange?.newVaultBalance
				: secondaryChange?.newVaultBalance;
		};

		const oldBalance = parseFloat(getBalance(oldestTrade) || '0');
		const newBalance = parseFloat(getBalance(latestTrade) || '0');
		const balanceChange = newBalance - oldBalance;
		const percentageChange = oldBalance > 0 ? (balanceChange / oldBalance) * 100 : 0;

		const balanceChangeBigNum = ethers.BigNumber.from(
			balanceChange.toLocaleString('fullwide', { useGrouping: false })
		);
		const formattedBalanceChange = parseFloat(
			ethers.utils.formatUnits(balanceChangeBigNum, item.token.decimals).toString()
		).toFixed(2);

		item['balanceChange24h'] = parseFloat(formattedBalanceChange);
		item['percentageChange24h'] = percentageChange;
	}
	try {
		for (const order of orders) {
			const trades24h = order.order.trades.filter(
				(trade: SgTrade) => Date.now() / 1000 - parseFloat(trade.timestamp) <= 86400
			);
			order.order.inputs.forEach((input: OrderListVault) =>
				calculateTokenBalanceChanges(trades24h, input, true)
			);
			order.order.outputs.forEach((output: OrderListVault) =>
				calculateTokenBalanceChanges(trades24h, output, false)
			);
		}
		return orders;
	} catch {
		return orders;
	}
}
