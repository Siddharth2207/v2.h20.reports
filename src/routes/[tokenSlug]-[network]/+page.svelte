<script lang="ts">
	import '../../app.css';
	import { page } from '$app/stores';
	import type { MultiSubgraphArgs, SgOrder, SgOrderWithSubgraphName, SgTrade, SgVault } from '@rainlanguage/orderbook/js_api';
	import OrderListTable from '$lib/components/OrderListTable.svelte';
	import { getTokenPriceUsd } from '$lib/price';
	import { ethers } from 'ethers';
	import { orderActiveState } from '$lib/stores/report';
	import {
		getOrders,
		getOrderTradesList,
		getVaultBalanceChanges
	} from '@rainlanguage/orderbook/js_api';
	import { createInfiniteQuery } from '@tanstack/svelte-query';
	import {
		DEFAULT_ORDERS_PAGE_SIZE,
		DEFAULT_TRADES_PAGE_SIZE,
		DEFAULT_VAULTS_PAGE_SIZE,
		tokenConfig
	} from '$lib/constants';
	import type { OrderListOrderWithSubgraphName, OrderListTotalVolume } from '$lib/types';
	const { activeSubgraphs, tokenSlug, network } = $page.data.stores;

	let activeSubgraphsValue: MultiSubgraphArgs[] = $activeSubgraphs;
	let tokenSlugValue: string = $tokenSlug;
	let networkValue: string = $network;

	export const tokenSymbol = tokenConfig[tokenSlugValue.toUpperCase()]?.symbol;
	export const tokenAddress = tokenConfig[tokenSlugValue.toUpperCase()]?.address;

	let orderActiveStateValue: boolean | undefined = true;
	$: orderHashStateValue = undefined;
	$: orderOwnerValue = undefined;

	let orders: any[] = [];
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
						(input: SgVault) =>
							input.token.symbol === tokenSymbol &&
							input.token.address.toLowerCase() === tokenAddress.toLowerCase()
					) ||
					order.order.outputs.some(
						(output: SgVault) =>
							output.token.symbol === tokenSymbol &&
							output.token.address.toLowerCase() === tokenAddress.toLowerCase()
					)
			);

			let filteredOrdersWithTrades: OrderListOrderWithSubgraphName[] = await orderWithTrades(filteredOrders);
			let filteredOrdersWithVaultBalanceChanges: OrderListOrderWithSubgraphName[] = await orderWithVaultBalanceChanges(filteredOrdersWithTrades);
			let filteredOrdersWithTokenPriceUsdMap: OrderListOrderWithSubgraphName[] = await getTokenPriceUsdMap(filteredOrdersWithVaultBalanceChanges);
			for (let order of filteredOrdersWithTokenPriceUsdMap) {
				order.order['totalVolume'] = calculateTradeVolume(order.order.trades);
				order.order['totalVolume24h'] = calculateTradeVolume(
					order.order.trades.filter((trade: any) => Date.now() / 1000 - trade.timestamp <= 86400)
				);
			}
			let ordersWithBalanceChanges: OrderListOrderWithSubgraphName[] = calculateBalanceChanges(filteredOrdersWithTokenPriceUsdMap);
			let ordersWithTotalDepositsAndWithdrawals: OrderListOrderWithSubgraphName[] = calculateTotalDepositsAndWithdrawals(ordersWithBalanceChanges);

			console.log("ordersWithTotalDepositsAndWithdrawals : ", JSON.stringify(ordersWithTotalDepositsAndWithdrawals));

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

	async function orderWithTrades(orders: SgOrderWithSubgraphName[]): Promise<OrderListOrderWithSubgraphName[]> {
		for (const order of orders) {
			let allTrades: any[] = [];
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
				(a: any, b: any) => b.tradeEvent.transaction.timestamp - a.tradeEvent.transaction.timestamp
			);
		}
		return orders as OrderListOrderWithSubgraphName[];
	}

	async function orderWithVaultBalanceChanges(orders: OrderListOrderWithSubgraphName[]): Promise<OrderListOrderWithSubgraphName[]> {
		for (const order of orders) {
			const vaultBalanceChangesMap = new Map();
			const allVaults = [...order.order.inputs, ...order.order.outputs];
			const uniqueVaults = allVaults.filter(
				(vault, index) => allVaults.findIndex((v) => v.id === vault.id) === index
			);
			for (const vault of uniqueVaults) {
				let allBalanceChanges: any[] = [];
				let currentPage = 1;
				let hasMore = true;
				while (hasMore) {
					const balanceChanges = await getVaultBalanceChanges(
						activeSubgraphsValue.find((subgraph) => subgraph.name === networkValue)?.url || '',
						vault.id,
						{ page: currentPage, pageSize: DEFAULT_VAULTS_PAGE_SIZE }
					);
					allBalanceChanges = [...allBalanceChanges, ...balanceChanges];
					hasMore = balanceChanges.length === DEFAULT_VAULTS_PAGE_SIZE;
					currentPage++;
				}
				vaultBalanceChangesMap.set(vault.id, allBalanceChanges);
			}
			order.order['inputs'] = order.order.inputs.map((input: any) => ({
				...input,
				balanceChanges: vaultBalanceChangesMap.get(input.id) || []
			}));
			order.order['outputs'] = order.order.outputs.map((output: any) => ({
				...output,
				balanceChanges: vaultBalanceChangesMap.get(output.id) || []
			}));
		}
		return orders;
	}

	function calculateTradeVolume(trades: SgTrade[]): OrderListTotalVolume[] {
		try {
			const tokenVolumes: Record<string, { totalVolume: number; tokenAddress: string }> = {};
			for (const trade of trades) {
				if (trade.outputVaultBalanceChange) {
					const { vault, amount } = trade.outputVaultBalanceChange;
					if (vault && vault.token) {
						const { symbol, decimals, address } = vault.token;
						const volume = parseFloat(ethers.utils.formatUnits(amount, decimals).toString());

						if(symbol){
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
			errorMessage = 'Failed to calculate trades volume';
			return [];
		}
	}

	function calculateBalanceChanges(orders: OrderListOrderWithSubgraphName[]): OrderListOrderWithSubgraphName[] {
		try {
			for (const order of orders) {
				const trades24h = order.order.trades.filter(
					(trade: any) => Date.now() / 1000 - trade.timestamp <= 86400
				);
				function calculateTokenBalanceChanges(item: any, isInput: boolean) {
					if (trades24h.length === 0) {
						item['balanceChange24h'] = 0;
						item['percentageChange24h'] = 0;
						return;
					}
					const oldestTrade = trades24h[trades24h.length - 1];
					const latestTrade = trades24h[0];
					const getBalance = (trade: any) => {
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

					item['balanceChange24h'] = formattedBalanceChange;
					item['percentageChange24h'] = percentageChange;
				}
				order.order.inputs.forEach((input: any) => calculateTokenBalanceChanges(input, true));
				order.order.outputs.forEach((output: any) => calculateTokenBalanceChanges(output, false));
			}
			return orders;
		} catch {
			errorMessage = 'Failed to calculate balance changes';
			return orders;
		}
	}

	function calculateTotalDepositsAndWithdrawals(orders: OrderListOrderWithSubgraphName[]): OrderListOrderWithSubgraphName[] {
		try {
			for (const order of orders) {
				order.order['orderDuration'] = Date.now() / 1000 - parseFloat(order.order.timestampAdded);
				for (const input of order.order.inputs) {
					input['totalDeposits'] = input.balanceChanges
						.filter((change: any) => change.__typename === 'Deposit')
						.reduce(
							(sum: any, change: any) =>
								sum +
								parseFloat(
									ethers.utils.formatUnits(change.amount, input.token.decimals).toString()
								),
							0
						);
					input['totalWithdrawals'] = input.balanceChanges
						.filter((change: any) => change.__typename === 'Withdrawal')
						.reduce(
							(sum: any, change: any) =>
								sum +
								parseFloat(
									ethers.utils.formatUnits(change.amount, input.token.decimals).toString()
								),
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
						.filter((change: any) => change.__typename === 'Deposit')
						.reduce(
							(sum: any, change: any) =>
								sum +
								parseFloat(
									ethers.utils.formatUnits(change.amount, output.token.decimals).toString()
								),
							0
						);
					output['totalWithdrawals'] = output.balanceChanges
						.filter((change: any) => change.__typename === 'Withdrawal')
						.reduce(
							(sum: any, change: any) =>
								sum +
								parseFloat(
									ethers.utils.formatUnits(change.amount, output.token.decimals).toString()
								),
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
					(acc: any, output: any) =>
						acc + output.totalDeposits * (order.order.tokenPriceUsdMap.get(output.token.address) || 0),
					0
				);
				const currentOrderTotalInputsUsd = order.order.inputs.reduce(
					(acc: any, input: any) =>
						acc + input.currentVaultInputs * (order.order.tokenPriceUsdMap.get(input.token.address) || 0),
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
			errorMessage = 'Failed to calculate total deposits and withdrawals';
			return orders;
		}
	}

	async function getTokenPriceUsdMap(orders: OrderListOrderWithSubgraphName[]): Promise<OrderListOrderWithSubgraphName[]> {
		try {
			const tokenPriceUsdMap = new Map<string, any>();
			for (const order of orders) {
				for (const input of order.order.inputs) {
					if (tokenPriceUsdMap.has(input.token.address)) {
						continue;
					}
					const tokenPrice = await getTokenPriceUsd(input.token.address, input.token?.symbol || '');
					tokenPriceUsdMap.set(input.token.address, tokenPrice.currentPrice);
				}
				for (const output of order.order.outputs) {
					if (tokenPriceUsdMap.has(output.token.address)) {
						continue;
					}
					const tokenPrice = await getTokenPriceUsd(output.token.address, output.token?.symbol || '');
					tokenPriceUsdMap.set(output.token.address, tokenPrice.currentPrice);
				}
				order.order['tokenPriceUsdMap'] = tokenPriceUsdMap;
			}
			for (const order of orders) {
				order.order['tokenPriceUsdMap'] = tokenPriceUsdMap;
			}
			return orders;
		} catch (error) {
			errorMessage = 'Failed to get token price usd map';
			return orders;
		}
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
