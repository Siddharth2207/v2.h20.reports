<script lang="ts">
	import {
		Button,
		Table,
		TableBody,
		TableBodyRow,
		TableHeadCell,
		TableBodyCell,
		TableHead
	} from 'flowbite-svelte';
	import type { CreateInfiniteQueryResult, InfiniteData } from '@tanstack/svelte-query';
	import { formatTimestamp, formatBalance } from '$lib/orders';
	import { ethers } from 'ethers';
	import { DEFAULT_ORDERS_PAGE_SIZE } from '$lib/constants';
	import type {
		OrderListOrderWithSubgraphName,
		OrderListTotalVolume,
		OrderListVault
	} from '$lib/types';
	import type { SgTrade } from '@rainlanguage/orderbook/js_api';

	export let query: CreateInfiniteQueryResult<
		InfiniteData<{ orders: OrderListOrderWithSubgraphName[] }, unknown>,
		Error
	>;

	export let lastTradeFlag: boolean = true;
	export let firstTradeFlag: boolean = true;
	export let totalTradesFlag: boolean = true;
	export let trades24hFlag: boolean = true;
	export let volumeTotalFlag: boolean = true;
	export let volume24hFlag: boolean = true;
	export let inputBalanceFlag: boolean = true;
	export let outputBalanceFlag: boolean = true;
	export let inputChangeFlag: boolean = true;
	export let outputChangeFlag: boolean = true;
	export let totalDepositsFlag: boolean = true;
	export let totalInputsFlag: boolean = true;
	export let absoluteChangeFlag: boolean = true;
	export let percentChangeFlag: boolean = true;
	export let tradesDurationFlag: boolean = true;
	export let orderDurationFlag: boolean = true;
	export let roiFlag: boolean = true;
	export let roiPercentFlag: boolean = true;
	export let apyFlag: boolean = true;
	export let apyPercentFlag: boolean = true;
	export let durationInSeconds: number = 86400;

	let sortOrder: 'asc' | 'desc' = 'asc';
	let currentSort = 'totalTrades';
	$: sortedData = $query.data;

	function applySorting(
		data: InfiniteData<{ orders: OrderListOrderWithSubgraphName[] }, unknown> | undefined
	) {
		if (!data || !data.pages || data.pages.length === 0) return data;
		const allLoadedOrders = data.pages.flatMap(
			(page: { orders: OrderListOrderWithSubgraphName[] }) => page.orders
		);

		const sortedOrders = [...allLoadedOrders].sort(
			(a: OrderListOrderWithSubgraphName, b: OrderListOrderWithSubgraphName) => {
				switch (currentSort) {
					case 'totalTrades': {
						const comparison = a.order.trades.length - b.order.trades.length;
						return sortOrder === 'asc' ? comparison : -comparison;
					}

					case 'firstTrade': {
						const comparisonFirstTrade =
							parseFloat(a.order.trades[a.order.trades.length - 1].timestamp) -
							parseFloat(b.order.trades[b.order.trades.length - 1].timestamp);
						return sortOrder === 'asc' ? comparisonFirstTrade : -comparisonFirstTrade;
					}

					case 'lastTrade': {
						const comparisonLastTrade =
							parseFloat(a.order.trades[0].timestamp) - parseFloat(b.order.trades[0].timestamp);
						return sortOrder === 'asc' ? comparisonLastTrade : -comparisonLastTrade;
					}

					case 'orderDuration': {
						const comparisonOrderDuration = a.order.orderDuration - b.order.orderDuration;
						return sortOrder === 'asc' ? comparisonOrderDuration : -comparisonOrderDuration;
					}

					case 'tradesDuration': {
						const comparisonTradesDuration =
							parseFloat(a.order.trades[0].timestamp) -
							parseFloat(a.order.trades[a.order.trades.length - 1].timestamp) -
							(parseFloat(b.order.trades[0].timestamp) -
								parseFloat(b.order.trades[b.order.trades.length - 1].timestamp));
						return sortOrder === 'asc' ? comparisonTradesDuration : -comparisonTradesDuration;
					}

					case 'trades24h': {
						const comparisonTrades24h =
							a.order.trades.filter(
								(trade: SgTrade) => Date.now() / 1000 - parseFloat(trade.timestamp) <= durationInSeconds
							).length -
							b.order.trades.filter(
								(trade: SgTrade) => Date.now() / 1000 - parseFloat(trade.timestamp) <= durationInSeconds
							).length;
						return sortOrder === 'asc' ? comparisonTrades24h : -comparisonTrades24h;
					}

					case 'volumeTotal': {
						const comparisonVolumeTotal =
							a.order.totalVolume.reduce(
								(acc: number, token: OrderListTotalVolume) =>
									acc + token.totalVolume * (a.order.tokenPriceUsdMap.get(token.tokenAddress) || 0),
								0
							) -
							b.order.totalVolume.reduce(
								(acc: number, token: OrderListTotalVolume) =>
									acc + token.totalVolume * (b.order.tokenPriceUsdMap.get(token.tokenAddress) || 0),
								0
							);
						return sortOrder === 'asc' ? comparisonVolumeTotal : -comparisonVolumeTotal;
					}

					case 'volume24h': {
						const comparisonVolume24h =
							a.order.totalVolume24h.reduce(
								(acc: number, token: OrderListTotalVolume) =>
									acc + token.totalVolume * (a.order.tokenPriceUsdMap.get(token.tokenAddress) || 0),
								0
							) -
							b.order.totalVolume24h.reduce(
								(acc: number, token: OrderListTotalVolume) =>
									acc + token.totalVolume * (b.order.tokenPriceUsdMap.get(token.tokenAddress) || 0),
								0
							);
						return sortOrder === 'asc' ? comparisonVolume24h : -comparisonVolume24h;
					}

					case 'totalDeposits': {
						const comparisonTotalDeposits =
							a.order.outputs.reduce(
								(acc: number, output: OrderListVault) =>
									acc +
									output.totalDeposits * (a.order.tokenPriceUsdMap.get(output.token.address) || 0),
								0
							) -
							b.order.outputs.reduce(
								(acc: number, output: OrderListVault) =>
									acc +
									output.totalDeposits * (b.order.tokenPriceUsdMap.get(output.token.address) || 0),
								0
							);
						return sortOrder === 'asc' ? comparisonTotalDeposits : -comparisonTotalDeposits;
					}

					case 'totalInputs': {
						const comparisonTotalInputs =
							a.order.inputs.reduce(
								(acc: number, input: OrderListVault) =>
									acc +
									input.currentVaultInputs *
										(a.order.tokenPriceUsdMap.get(input.token.address) || 0),
								0
							) -
							b.order.inputs.reduce(
								(acc: number, input: OrderListVault) =>
									acc +
									input.currentVaultInputs *
										(b.order.tokenPriceUsdMap.get(input.token.address) || 0),
								0
							);
						return sortOrder === 'asc' ? comparisonTotalInputs : -comparisonTotalInputs;
					}

					case 'absoluteChange':
					case 'roi': {
						const comparisonAbsoluteChange = a.order.roi - b.order.roi;
						return sortOrder === 'asc' ? comparisonAbsoluteChange : -comparisonAbsoluteChange;
					}

					case 'percentChange':
					case 'roiPercent': {
						const comparisonRoiPercent = a.order.roiPercentage - b.order.roiPercentage;
						return sortOrder === 'asc' ? comparisonRoiPercent : -comparisonRoiPercent;
					}

					case 'apy':
					case 'apyPercent': {
						const comparisonApyPercent = a.order.apyPercentage - b.order.apyPercentage;
						return sortOrder === 'asc' ? comparisonApyPercent : -comparisonApyPercent;
					}

					case 'inputBalance': {
						const comparisonInputBalance =
							a.order.inputs.reduce(
								(acc: number, input: OrderListVault) =>
									acc +
									parseFloat(
										ethers.utils.formatUnits(input.balance, input.token.decimals).toString()
									) *
										(a.order.tokenPriceUsdMap.get(input.token.address) || 0),
								0
							) -
							b.order.inputs.reduce(
								(acc: number, input: OrderListVault) =>
									acc +
									parseFloat(
										ethers.utils.formatUnits(input.balance, input.token.decimals).toString()
									) *
										(b.order.tokenPriceUsdMap.get(input.token.address) || 0),
								0
							);
						return sortOrder === 'asc' ? comparisonInputBalance : -comparisonInputBalance;
					}

					case 'outputBalance': {
						const comparisonOutputBalance =
							a.order.outputs.reduce(
								(acc: number, output: OrderListVault) =>
									acc +
									parseFloat(
										ethers.utils.formatUnits(output.balance, output.token.decimals).toString()
									) *
										(a.order.tokenPriceUsdMap.get(output.token.address) || 0),
								0
							) -
							b.order.outputs.reduce(
								(acc: number, output: OrderListVault) =>
									acc +
									parseFloat(
										ethers.utils.formatUnits(output.balance, output.token.decimals).toString()
									) *
										(b.order.tokenPriceUsdMap.get(output.token.address) || 0),
								0
							);
						return sortOrder === 'asc' ? comparisonOutputBalance : -comparisonOutputBalance;
					}

					default: {
						return 0;
					}
				}
			}
		);

		const ordersPerPage = DEFAULT_ORDERS_PAGE_SIZE;
		const newPages = [];
		for (let i = 0; i < data.pages.length; i++) {
			const startIdx = i * ordersPerPage;
			const pageOrders = sortedOrders.slice(startIdx, startIdx + ordersPerPage);

			newPages.push({
				...data.pages[i],
				orders: pageOrders
			});
		}
		return {
			...data,
			pages: newPages
		};
	}

	function sortData(field: string) {
		if (currentSort === field) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		} else {
			currentSort = field;
			sortOrder = 'asc';
		}
		sortedData = applySorting($query.data);
	}
	function getDurationLabel(durationInSeconds: number) {
		const durationInMinutes = durationInSeconds / 60;
		const durationInHours = durationInMinutes / 60;
		const durationInDays = durationInHours / 24;
		return durationInDays > 1 ? `${durationInDays}d` : durationInHours > 1 ? `${durationInHours}h` : `${durationInMinutes}m`;
	}
</script>

{#if $query.isLoading || $query.isFetchingNextPage}
	<div class="mt-10 flex flex-col items-center justify-start">
		<div
			class="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"
		></div>
		<p class="mt-3 text-lg font-medium text-gray-600">Loading...</p>
	</div>
{:else if $query.data}
	<Table>
		<TableHead class="bg-gray-50 text-sm font-semibold text-gray-800">
			<TableHeadCell class="px-4 py-3 text-center">
				<p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">Network</p>
			</TableHeadCell>
			<TableHeadCell class="px-4 py-3 text-center">
				<p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">Order Active</p>
			</TableHeadCell>
			{#if tradesDurationFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('tradesDuration')}
					>
						<option selected={currentSort === 'tradesDuration' && sortOrder === 'asc'}
							>Trade Duration ↑</option
						>
						<option selected={currentSort === 'tradesDuration' && sortOrder === 'desc'}
							>Trade Duration ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}
			{#if orderDurationFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('orderDuration')}
					>
						<option selected={currentSort === 'orderDuration' && sortOrder === 'asc'}
							>Order Duration ↑</option
						>
						<option selected={currentSort === 'orderDuration' && sortOrder === 'desc'}
							>Order Duration ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if lastTradeFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('lastTrade')}
					>
						<option selected={currentSort === 'lastTrade' && sortOrder === 'asc'}
							>Last Trade ↑</option
						>
						<option selected={currentSort === 'lastTrade' && sortOrder === 'desc'}
							>Last Trade ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if firstTradeFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('firstTrade')}
					>
						<option selected={currentSort === 'firstTrade' && sortOrder === 'asc'}
							>First Trade ↑</option
						>
						<option selected={currentSort === 'firstTrade' && sortOrder === 'desc'}
							>First Trade ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if totalTradesFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('totalTrades')}
					>
						<option selected={currentSort === 'totalTrades' && sortOrder === 'asc'}>
							Total Trades ↑
						</option>
						<option selected={currentSort === 'totalTrades' && sortOrder === 'desc'}>
							Total Trades ↓
						</option>
					</select>
				</TableHeadCell>
			{/if}

			{#if trades24hFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('trades24h')}
					>
						<option selected={currentSort === 'trades24h' && sortOrder === 'asc'}
							>{getDurationLabel(durationInSeconds)} Trades ↑</option
						>
						<option selected={currentSort === 'trades24h' && sortOrder === 'desc'}
							>{getDurationLabel(durationInSeconds)} Trades ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if volumeTotalFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('volumeTotal')}
					>
						<option selected={currentSort === 'volumeTotal' && sortOrder === 'asc'}
							>Total Volume ↑</option
						>
						<option selected={currentSort === 'volumeTotal' && sortOrder === 'desc'}
							>Total Volume ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if volume24hFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('volume24h')}
					>
						<option selected={currentSort === 'volume24h' && sortOrder === 'asc'}
							>{getDurationLabel(durationInSeconds)} Volume↑</option
						>
						<option selected={currentSort === 'volume24h' && sortOrder === 'desc'}
							>{getDurationLabel(durationInSeconds)} Volume↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if totalDepositsFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('totalDeposits')}
					>
						<option selected={currentSort === 'totalDeposits' && sortOrder === 'asc'}
							>Total Deposits ↑</option
						>
						<option selected={currentSort === 'totalDeposits' && sortOrder === 'desc'}
							>Total Deposits ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if totalInputsFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('totalInputs')}
					>
						<option selected={currentSort === 'totalInputs' && sortOrder === 'asc'}
							>Total Inputs (Withdrawals + Balances) ↑</option
						>
						<option selected={currentSort === 'totalInputs' && sortOrder === 'desc'}
							>Total Inputs (Withdrawals + Balances) ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if absoluteChangeFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('absoluteChange')}
					>
						<option selected={currentSort === 'absoluteChange' && sortOrder === 'asc'}
							>Absolute Change ↑</option
						>
						<option selected={currentSort === 'absoluteChange' && sortOrder === 'desc'}
							>Absolute Change ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if percentChangeFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('percentChange')}
					>
						<option selected={currentSort === 'percentChange' && sortOrder === 'asc'}
							>Percentage Change ↑</option
						>
						<option selected={currentSort === 'percentChange' && sortOrder === 'desc'}
							>Percentage Change ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if inputBalanceFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('inputBalance')}
					>
						<option selected={currentSort === 'inputBalance' && sortOrder === 'asc'}
							>Input Balance ↑</option
						>
						<option selected={currentSort === 'inputBalance' && sortOrder === 'desc'}
							>Input Balance ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if outputBalanceFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('outputBalance')}
					>
						<option selected={currentSort === 'outputBalance' && sortOrder === 'asc'}
							>Output Balance ↑</option
						>
						<option selected={currentSort === 'outputBalance' && sortOrder === 'desc'}
							>Output Balance ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if inputChangeFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('inputChange')}
					>
						<option selected={currentSort === 'inputChange' && sortOrder === 'asc'}
							>Input Δ 24h ↑</option
						>
						<option selected={currentSort === 'inputChange' && sortOrder === 'desc'}
							>Input Δ 24h ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if outputChangeFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('outputChange')}
					>
						<option selected={currentSort === 'outputChange' && sortOrder === 'asc'}
							>Output Δ 24h ↑</option
						>
						<option selected={currentSort === 'outputChange' && sortOrder === 'desc'}
							>Output Δ 24h ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if roiFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('roi')}
					>
						<option selected={currentSort === 'roi' && sortOrder === 'asc'}>$ ROI ↑</option>
						<option selected={currentSort === 'roi' && sortOrder === 'desc'}>$ ROI ↓</option>
					</select>
				</TableHeadCell>
			{/if}

			{#if roiPercentFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('roiPercent')}
					>
						<option selected={currentSort === 'roiPercent' && sortOrder === 'asc'}>ROI % ↑</option>
						<option selected={currentSort === 'roiPercent' && sortOrder === 'desc'}>ROI % ↓</option>
					</select>
				</TableHeadCell>
			{/if}

			{#if apyFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('apy')}
					>
						<option selected={currentSort === 'apy' && sortOrder === 'asc'}
							>$ Projected APY ↑</option
						>
						<option selected={currentSort === 'apy' && sortOrder === 'desc'}
							>$ Projected APY ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			{#if apyPercentFlag}
				<TableHeadCell class="px-4 py-3 text-center">
					<select
						class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
						on:change={() => sortData('apyPercent')}
					>
						<option selected={currentSort === 'apyPercent' && sortOrder === 'asc'}
							>Projected APY % ↑</option
						>
						<option selected={currentSort === 'apyPercent' && sortOrder === 'desc'}
							>Projected APY % ↓</option
						>
					</select>
				</TableHeadCell>
			{/if}

			<TableHeadCell class="px-4 py-3 text-center">
				<p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">Order Link</p>
			</TableHeadCell>
		</TableHead>
		<TableBody>
			{#if sortedData}
				{#each sortedData.pages as page}
					{#if page.orders.length > 0}
						{#each page.orders as order (order.order.orderHash)}
							<TableBodyRow class="border-t border-gray-300 text-gray-700">
								<TableBodyCell class="px-4 py-3 text-center text-sm"
									>{order.subgraphName}</TableBodyCell
								>
								<TableBodyCell class="px-4 py-3 text-center text-sm">
									<span
										class={`rounded px-2 py-1 ${order.order.active ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
									>
										{order.order.active ? 'Active' : 'Inactive'}
									</span>
								</TableBodyCell>

								{#if tradesDurationFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{order.order.trades.length > 0
											? formatBalance(
													(parseFloat(order.order.trades[0].timestamp) -
														parseFloat(
															order.order.trades[order.order.trades.length - 1].timestamp
														)) /
														86400
												) + ' days'
											: '-'}
									</TableBodyCell>
								{/if}

								{#if orderDurationFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{order.order.orderDuration > 0
											? formatBalance(order.order.orderDuration / 86400) + ' days'
											: '-'}
									</TableBodyCell>
								{/if}

								{#if lastTradeFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm"
										>{order.order.trades.length > 0
											? formatTimestamp(parseFloat(order.order.trades[0].timestamp))
											: 'N/A'}</TableBodyCell
									>
								{/if}

								{#if firstTradeFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{order.order.trades.length > 0
											? formatTimestamp(
													parseFloat(order.order.trades[order.order.trades.length - 1].timestamp)
												)
											: 'N/A'}</TableBodyCell
									>
								{/if}

								{#if totalTradesFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm"
										>{order.order.trades.length}</TableBodyCell
									>
								{/if}
								{#if trades24hFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{order.order.trades.length > 0
											? order.order.trades.filter(
													(trade) => Date.now() / 1000 - parseFloat(trade.timestamp) <= durationInSeconds
												).length
											: 'N/A'}
									</TableBodyCell>
								{/if}

								{#if volumeTotalFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#if order.order.totalVolume.length > 0}
											{#each order.order.totalVolume as token (token)}
												<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
													<span class="font-semibold">{token.token}</span>
													<span class="text-gray-800">{formatBalance(token.totalVolume)}</span>
												</div>
											{/each}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">Total</span>
												<span class="text-gray-800">
													${formatBalance(
														order.order.trades.reduce(
															(acc, trade) =>
																acc +
																parseFloat(
																	ethers.utils
																		.formatUnits(
																			ethers.BigNumber.from(
																				trade.outputVaultBalanceChange.amount
																			).abs(),
																			trade.outputVaultBalanceChange.vault.token.decimals
																		)
																		.toString()
																) *
																	(order.order.tokenPriceUsdMap.get(
																		trade.outputVaultBalanceChange.vault.token.address
																	) || 0),
															0
														)
													)}
												</span>
											</div>
										{:else}
											-
										{/if}
									</TableBodyCell>
								{/if}

								{#if volume24hFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#if order.order.totalVolume24h.length > 0}
											{#each order.order.totalVolume24h as token (token)}
												<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
													<span class="font-semibold">{token.token}</span>
													<span class="text-gray-800">{formatBalance(token.totalVolume)}</span>
												</div>
											{/each}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">Total</span>
												<span class="text-gray-800">
													${formatBalance(
														order.order.trades
															.filter(
																(trade) => parseFloat(trade.timestamp) > Date.now() / 1000 - durationInSeconds
															)
															.reduce(
																(acc, trade) =>
																	acc +
																	parseFloat(
																		ethers.utils
																			.formatUnits(
																				ethers.BigNumber.from(
																					trade.outputVaultBalanceChange.amount
																				).abs(),
																				trade.outputVaultBalanceChange.vault.token.decimals
																			)
																			.toString()
																	) *
																		(order.order.tokenPriceUsdMap.get(
																			trade.outputVaultBalanceChange.vault.token.address
																		) || 0),
																0
															)
													)}
												</span>
											</div>
										{:else}
											-
										{/if}
									</TableBodyCell>
								{/if}

								{#if totalDepositsFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#each order.order.outputs as output (output.id)}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">{output.token.symbol}</span>
												<span class="text-gray-800">{formatBalance(output.totalDeposits)}</span>
											</div>
										{/each}
										<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
											<span class="font-semibold">Total</span>
											<span class="text-gray-800">
												${formatBalance(
													order.order.outputs.reduce(
														(acc, output) =>
															acc +
															output.totalDeposits *
																(order.order.tokenPriceUsdMap.get(output.token.address) || 0),
														0
													)
												)}
											</span>
										</div>
									</TableBodyCell>
								{/if}

								{#if totalInputsFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#each order.order.inputs as input (input.id)}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">{input.token.symbol}</span>
												<span class="text-gray-800">{formatBalance(input.currentVaultInputs)}</span>
											</div>
										{/each}
										<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
											<span class="font-semibold">Total</span>
											<span class="text-gray-800">
												${formatBalance(
													order.order.inputs.reduce(
														(acc, input) =>
															acc +
															input.currentVaultInputs *
																(order.order.tokenPriceUsdMap.get(input.token.address) || 0),
														0
													)
												)}
											</span>
										</div>
									</TableBodyCell>
								{/if}

								{#if absoluteChangeFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#each order.order.inputs as input (input.id)}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">{input.token.symbol}</span>
												<span class="text-gray-800"
													>{formatBalance(input.curerentVaultDifferential)}</span
												>
											</div>
										{/each}
										<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
											<span class="font-semibold">Total</span>
											<span class="text-gray-800">
												${formatBalance(order.order.roi)}
											</span>
										</div>
									</TableBodyCell>
								{/if}

								{#if percentChangeFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#each order.order.inputs as input (input.id)}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">{input.token.symbol}</span>
												<span
													class="font-medium {input.curerentVaultDifferentialPercentage > 0
														? 'text-green-600'
														: 'text-red-600'}"
													>{formatBalance(input.curerentVaultDifferentialPercentage)}%</span
												>
											</div>
										{/each}
										<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
											<span class="font-semibold">Total (USD)</span>
											<span class="text-gray-800">
												{formatBalance(order.order.roiPercentage)}%
											</span>
										</div>
									</TableBodyCell>
								{/if}

								{#if inputBalanceFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#each order.order.inputs as input (input.id)}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">{input.token.symbol}</span>
												<span class="text-gray-800"
													>{formatBalance(
														parseFloat(
															ethers.utils
																.formatUnits(input.balance, input.token.decimals)
																.toString()
														)
													)}</span
												>
											</div>
										{/each}
										<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
											<span class="font-semibold">Total</span>
											<span class="text-gray-800">
												${formatBalance(
													order.order.inputs.reduce(
														(acc, input) =>
															acc +
															parseFloat(
																ethers.utils
																	.formatUnits(input.balance, input.token.decimals)
																	.toString()
															) *
																(order.order.tokenPriceUsdMap.get(input.token.address) || 0),
														0
													)
												)}
											</span>
										</div>
									</TableBodyCell>
								{/if}

								{#if outputBalanceFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#each order.order.outputs as output (output.id)}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">{output.token.symbol}</span>
												<span class="text-gray-800"
													>{formatBalance(
														parseFloat(
															ethers.utils
																.formatUnits(output.balance, output.token.decimals)
																.toString()
														)
													)}</span
												>
											</div>
										{/each}
										<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
											<span class="font-semibold">Total</span>
											<span class="text-gray-800">
												${formatBalance(
													order.order.outputs.reduce(
														(acc, output) =>
															acc +
															parseFloat(
																ethers.utils
																	.formatUnits(output.balance, output.token.decimals)
																	.toString()
															) *
																(order.order.tokenPriceUsdMap.get(output.token.address) || 0),
														0
													)
												)}
											</span>
										</div>
									</TableBodyCell>
								{/if}

								{#if inputChangeFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#each order.order.inputs as input (input.id)}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">{input.token.symbol}</span>
												<span
													class="font-medium {input.percentageChange24h >= 0
														? 'text-green-600'
														: 'text-red-600'}"
												>
													{formatBalance(input.balanceChange24h)} ({formatBalance(
														input.percentageChange24h
													)}%)
												</span>
											</div>
										{/each}
									</TableBodyCell>
								{/if}

								{#if outputChangeFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#each order.order.outputs as output (output.id)}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">{output.token.symbol}</span>
												<span
													class="font-medium {output.percentageChange24h >= 0
														? 'text-green-600'
														: 'text-red-600'}"
												>
													{formatBalance(output.balanceChange24h)} ({formatBalance(
														output.percentageChange24h
													)}%)
												</span>
											</div>
										{/each}
									</TableBodyCell>
								{/if}

								{#if roiFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#each order.order.inputs as input (input.id)}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">{input.token.symbol}</span>
												<span class="text-gray-800"
													>{formatBalance(input.curerentVaultDifferential)}</span
												>
											</div>
										{/each}
										<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
											<span class="font-semibold">Total</span>
											<span class="text-gray-800">
												${formatBalance(order.order.roi)}
											</span>
										</div>
									</TableBodyCell>
								{/if}

								{#if roiPercentFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#each order.order.inputs as input (input.id)}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">{input.token.symbol}</span>
												<span
													class="font-medium {input.curerentVaultDifferentialPercentage > 0
														? 'text-green-600'
														: 'text-red-600'}"
													>{formatBalance(input.curerentVaultDifferentialPercentage)}%</span
												>
											</div>
										{/each}
										<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
											<span class="font-semibold">Total</span>
											<span class="text-gray-800">
												{formatBalance(order.order.roiPercentage)}%
											</span>
										</div>
									</TableBodyCell>
								{/if}

								{#if apyFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#each order.order.inputs as input (input.id)}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">{input.token.symbol}</span>
												<span
													class="font-medium {input.currentVaultApy > 0
														? 'text-green-600'
														: 'text-red-600'}">{formatBalance(input.currentVaultApy)}</span
												>
											</div>
										{/each}
										<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
											<span class="font-semibold">Total</span>
											<span class="text-gray-800">
												$ {formatBalance(order.order.apy)}
											</span>
										</div>
									</TableBodyCell>
								{/if}

								{#if apyPercentFlag}
									<TableBodyCell class="px-4 py-3 text-center text-sm">
										{#each order.order.inputs as input (input.id)}
											<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
												<span class="font-semibold">{input.token.symbol}</span>
												<span
													class="font-medium {input.currentVaultApyPercentage > 0
														? 'text-green-600'
														: 'text-red-600'}"
													>{formatBalance(input.currentVaultApyPercentage)}%</span
												>
											</div>
										{/each}
										<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
											<span class="font-semibold">Total</span>
											<span class="text-gray-800">
												{formatBalance(order.order.apyPercentage)}%
											</span>
										</div>
									</TableBodyCell>
								{/if}

								<TableBodyCell class="px-4 py-3 text-center text-sm">
									<a
										href={`https://v2.raindex.finance/orders/${order.subgraphName}-${order.order.orderHash}`}
										target="_blank"
									>
										<span class="text-blue-500 hover:text-blue-700"
											>{order.order.orderHash.slice(0, 6)}...{order.order.orderHash.slice(-4)}</span
										>
									</a>
								</TableBodyCell>
							</TableBodyRow>
						{/each}
					{:else}
						<TableBodyRow>
							<TableBodyCell colspan="100" class="text-center">No orders found</TableBodyCell>
						</TableBodyRow>
					{/if}
				{/each}
			{/if}
		</TableBody>
	</Table>
	<div class="mt-2 flex justify-center">
		{#if $query.hasNextPage || $query.isFetchingNextPage}
			<Button
				data-testid="loadMoreButton"
				size="xs"
				color="dark"
				on:click={async () => {
					await $query.fetchNextPage();
				}}
				class="rounded bg-gray-800 px-2 py-1 text-sm text-white hover:bg-gray-600"
			>
				{#if $query.isFetchingNextPage}
					Loading more...
				{:else if $query.hasNextPage}
					Load More
				{/if}
			</Button>
		{/if}
	</div>
{/if}
