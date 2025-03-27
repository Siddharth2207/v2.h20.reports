<script lang="ts">
	import '../../app.css';
	import { page } from '$app/stores';
	import type {
		MultiSubgraphArgs,
		SgOrderWithSubgraphName,
		SgTrade,
		SgVault
	} from '@rainlanguage/orderbook/js_api';
	import OrderListTable from '$lib/components/OrderListTable.svelte';
	import { orderActiveState } from '$lib/stores/report';
	import { getOrders, getOrderTradesList } from '@rainlanguage/orderbook/js_api';
	import { createInfiniteQuery } from '@tanstack/svelte-query';
	import { DEFAULT_ORDERS_PAGE_SIZE, DEFAULT_TRADES_PAGE_SIZE, tokenConfig } from '$lib/constants';
	import type { OrderListOrderWithSubgraphName } from '$lib/types';
	import {
		calculateBalanceChanges,
		calculateTotalDepositsAndWithdrawals,
		calculateTradeVolume,
		getTokenPriceUsdMap,
		orderWithVaultBalanceChanges
	} from '$lib/orders';
	const { activeSubgraphs, tokenSlug, network } = $page.data.stores;

	let activeSubgraphsValue: MultiSubgraphArgs[] = $activeSubgraphs;
	let tokenSlugValue: string = $tokenSlug;
	let networkValue: string = $network;

	export const tokenSymbol = tokenConfig[tokenSlugValue.toUpperCase()]?.symbol;
	export const tokenAddress = tokenConfig[tokenSlugValue.toUpperCase()]?.address;

	let orderActiveStateValue: boolean | undefined = true;
	$: orderHashStateValue = undefined;
	$: orderOwnerValue = undefined;

	let orders: OrderListOrderWithSubgraphName[] = [];
	let errorMessage: string = '';
	let isStatusDropdownOpen = false;
	let activeTab = 'Trades';

	$: ordersQuery = createInfiniteQuery({
		queryKey: ['orders', orderActiveStateValue, orderHashStateValue, orderOwnerValue],
		queryFn: async ({ pageParam }) => {
			const allOrders: SgOrderWithSubgraphName[] = await getOrders(
				activeSubgraphsValue,
				{
					owners: orderOwnerValue ? [orderOwnerValue] : [],
					active: orderActiveStateValue,
					orderHash: orderHashStateValue ? orderHashStateValue : undefined
				},
				{ page: pageParam + 1, pageSize: DEFAULT_ORDERS_PAGE_SIZE }
			);

			let filteredOrders: SgOrderWithSubgraphName[] = allOrders.filter(
				(order: SgOrderWithSubgraphName) =>
					order.order.inputs.some(
						(input: SgVault) => input.token.address.toLowerCase() === tokenAddress.toLowerCase()
					) ||
					order.order.outputs.some(
						(output: SgVault) => output.token.address.toLowerCase() === tokenAddress.toLowerCase()
					)
			);

			let filteredOrdersWithTrades: OrderListOrderWithSubgraphName[] =
				await orderWithTrades(filteredOrders);
			let filteredOrdersWithVaultBalanceChanges: OrderListOrderWithSubgraphName[] =
				await orderWithVaultBalanceChanges(
					activeSubgraphsValue.find((subgraph: MultiSubgraphArgs) => subgraph.name === networkValue)
						?.url || '',
					filteredOrdersWithTrades
				);
			let filteredOrdersWithTokenPriceUsdMap: OrderListOrderWithSubgraphName[] =
				await getTokenPriceUsdMap(filteredOrdersWithVaultBalanceChanges);
			for (let order of filteredOrdersWithTokenPriceUsdMap) {
				order.order['totalVolume'] = calculateTradeVolume(order.order.trades);
				order.order['totalVolume24h'] = calculateTradeVolume(
					order.order.trades.filter(
						(trade: SgTrade) => Date.now() / 1000 - parseFloat(trade.timestamp) <= 86400
					)
				);
			}
			let ordersWithBalanceChanges: OrderListOrderWithSubgraphName[] = calculateBalanceChanges(
				filteredOrdersWithTokenPriceUsdMap
			);
			let ordersWithTotalDepositsAndWithdrawals: OrderListOrderWithSubgraphName[] =
				calculateTotalDepositsAndWithdrawals(ordersWithBalanceChanges);

			return {
				orders: ordersWithTotalDepositsAndWithdrawals,
				hasMore: allOrders.length === DEFAULT_ORDERS_PAGE_SIZE
			};
		},
		initialPageParam: 0,
		getNextPageParam(lastPage, _allPages, lastPageParam) {
			return lastPage.hasMore ? lastPageParam + 1 : undefined;
		},
		enabled: true
	});

	async function orderWithTrades(
		orders: SgOrderWithSubgraphName[]
	): Promise<OrderListOrderWithSubgraphName[]> {
		for (const order of orders) {
			let allTrades: SgTrade[] = [];
			let currentPage = 1;
			let hasMore = true;

			while (hasMore) {
				const trades = await getOrderTradesList(
					activeSubgraphsValue.find((subgraph) => subgraph.name === networkValue)?.url || '',
					order.order.id,
					{
						page: currentPage,
						pageSize: DEFAULT_TRADES_PAGE_SIZE
					}
				);

				allTrades = [...allTrades, ...trades];
				hasMore = trades.length === DEFAULT_TRADES_PAGE_SIZE;
				currentPage++;
			}

			order.order['trades'] = allTrades.sort(
				(a: SgTrade, b: SgTrade) =>
					parseFloat(b.tradeEvent.transaction.timestamp) -
					parseFloat(a.tradeEvent.transaction.timestamp)
			);
		}
		return orders as OrderListOrderWithSubgraphName[];
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.relative')) {
			isStatusDropdownOpen = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

{#if errorMessage}
	<div
		class="error-message relative rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
		role="alert"
	>
		<span class="block sm:inline">{errorMessage}</span>
	</div>
{/if}
<div class="flex items-center justify-between border-b border-gray-400">
	<h1 class="text-2xl font-bold text-gray-800">
		{tokenSlugValue.toUpperCase()} Order List
	</h1>
	<div class="flex gap-3">
		<div class="p-2 text-gray-600">
			Total Orders: {orders.length}
		</div>
		<div class="relative">
			<button
				class="flex min-w-[120px] items-center justify-between rounded bg-gray-100 p-2 text-gray-700 focus:outline-none"
				on:click={() => (isStatusDropdownOpen = !isStatusDropdownOpen)}
			>
				<span>Status</span>
				<svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>

			{#if isStatusDropdownOpen}
				<div class="absolute z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg">
					<div class="p-2">
						<label class="flex cursor-pointer items-center rounded px-3 py-2 hover:bg-gray-100">
							<input
								type="checkbox"
								name="orderStatus"
								checked={orderActiveStateValue === true}
								on:change={() => {
									orderActiveStateValue = true;
									orderActiveState.set(true);
								}}
								class="mr-1"
							/>
							Active
						</label>
						<label class="flex cursor-pointer items-center rounded px-3 py-2 hover:bg-gray-100">
							<input
								type="checkbox"
								name="orderStatus"
								checked={orderActiveStateValue === false}
								on:change={() => {
									orderActiveStateValue = false;
									orderActiveState.set(false);
								}}
								class="mr-1"
							/>
							Inactive
						</label>
						<label class="flex cursor-pointer items-center rounded px-3 py-2 hover:bg-gray-100">
							<input
								type="checkbox"
								name="orderStatus"
								checked={orderActiveStateValue === undefined}
								on:change={() => {
									orderActiveStateValue = undefined;
									orderActiveState.set(undefined);
								}}
								class="mr-1"
							/>
							All
						</label>
					</div>
				</div>
			{/if}
		</div>

		<input
			type="text"
			placeholder="Search by Order Hash"
			class="min-w-[200px] rounded border border-gray-300 p-2 text-gray-700 focus:outline-none"
			bind:value={orderHashStateValue}
		/>
		<input
			type="text"
			placeholder="Search by Order Owner"
			class="min-w-[200px] rounded border border-gray-300 p-2 text-gray-700 focus:outline-none"
			bind:value={orderOwnerValue}
		/>
	</div>
</div>

<div class="flex rounded-t-lg border-b border-gray-300 bg-gray-100">
	{#each ['Trades', 'Balances', 'Vaults', 'P&L'] as tab}
		<button
			class="rounded-t-lg border-b-2 border-gray-300 px-6 py-3 text-sm font-medium transition-all {activeTab ===
			tab
				? 'border-indigo-500 bg-white font-semibold text-indigo-600'
				: 'border-transparent hover:border-gray-400 hover:text-gray-600'}"
			on:click={() => (activeTab = tab)}
		>
			{tab}
		</button>
	{/each}
</div>

<div class="max-w-screen-3xl mx-auto rounded-lg p-2">
	{#if activeTab === 'Trades'}
		<OrderListTable
			query={ordersQuery}
			{networkValue}
			inputChangeFlag={false}
			outputChangeFlag={false}
			totalDepositsFlag={false}
			totalInputsFlag={false}
			absoluteChangeFlag={false}
			percentChangeFlag={false}
			tradesDurationFlag={false}
			orderDurationFlag={false}
			roiFlag={false}
			roiPercentFlag={false}
			apyFlag={false}
			apyPercentFlag={false}
		/>
	{:else if activeTab === 'Balances'}
		<OrderListTable
			query={ordersQuery}
			{networkValue}
			totalTradesFlag={false}
			volumeTotalFlag={false}
			totalDepositsFlag={false}
			totalInputsFlag={false}
			absoluteChangeFlag={false}
			percentChangeFlag={false}
			tradesDurationFlag={false}
			orderDurationFlag={false}
			roiFlag={false}
			roiPercentFlag={false}
			apyFlag={false}
			apyPercentFlag={false}
		/>
	{:else if activeTab === 'Vaults'}
		<OrderListTable
			query={ordersQuery}
			{networkValue}
			trades24hFlag={false}
			volume24hFlag={false}
			inputBalanceFlag={false}
			outputBalanceFlag={false}
			inputChangeFlag={false}
			outputChangeFlag={false}
			tradesDurationFlag={false}
			orderDurationFlag={false}
			roiFlag={false}
			roiPercentFlag={false}
			apyFlag={false}
			apyPercentFlag={false}
		/>
	{:else if activeTab === 'P&L'}
		<OrderListTable
			query={ordersQuery}
			{networkValue}
			lastTradeFlag={false}
			firstTradeFlag={false}
			absoluteChangeFlag={false}
			percentChangeFlag={false}
			inputChangeFlag={false}
			outputChangeFlag={false}
			trades24hFlag={false}
			volume24hFlag={false}
			inputBalanceFlag={false}
			outputBalanceFlag={false}
		/>
	{/if}
</div>
