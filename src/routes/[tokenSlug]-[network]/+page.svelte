<script lang="ts">
	import '../../app.css';
	import { page } from '$app/stores';
	import { getTokenOrders } from '$lib/orders';
	import type { MultiSubgraphArgs } from '@rainlanguage/orderbook/js_api';
	import TradesTables from '$lib/components/TradesTables.svelte';
	import BalancesTable from '$lib/components/BalancesTable.svelte';
	import VaultsTable from '$lib/components/VaultsTable.svelte';
	import ProfitLossTable from '$lib/components/ProfitLossTable.svelte';
	import { ethers } from 'ethers';
	import { onMount } from 'svelte';
	const { activeSubgraphs, tokenSlug, network, orderActiveState, orderHashState } =
		$page.data.stores;
	let activeSubgraphsValue: MultiSubgraphArgs[] = $activeSubgraphs;
	let tokenSlugValue: string = $tokenSlug;
	let networkValue: string = $network;
	let orderActiveStateValue: boolean | undefined = $orderActiveState;
	let orderHashStateValue: string | undefined = $orderHashState;
	let orders: any[] = [];
	let loading = true;
	let errorMessage: string = '';
	let isStatusDropdownOpen = false;
	let activeTab = 'Trades';

	async function fetchOrders() {
		if (!tokenSlugValue || !networkValue || !activeSubgraphsValue) return;
		loading = true;
		try {
			let fetchedOrders = await getTokenOrders();
			orders = fetchedOrders ?? [];
			for (const order of orders) {
				order.order['totalVolume'] = calculateTradeVolume(order.order.trades);
				order.order['totalVolume24h'] = calculateTradeVolume(
					order.order.trades.filter((trade: any) => Date.now() / 1000 - trade.timestamp <= 86400)
				);
				calculateBalanceChanges(order);
				calculateTotalDepositsAndWithdrawals(order);
			}
		} catch (error) {
			console.error('Failed to fetch orders:', error);
			errorMessage = 'Failed to fetch orders';
		} finally {
			loading = false;
		}
	}
	onMount(fetchOrders);

	$: filteredByStatus = (orders ?? []).filter((order) => {
		if (orderActiveStateValue === undefined) {
			return true;
		}
		return order.order.active === orderActiveStateValue;
	});

	$: filteredOrders = filteredByStatus.filter((order) => {
		if (orderHashStateValue === undefined) {
			return true;
		}
		return order.order.orderHash.toLowerCase().includes(orderHashStateValue.toLowerCase());
	});

	function calculateTradeVolume(trades: any[]) {
		try {
			const tokenVolumes: Record<string, { totalVolume: number; tokenAddress: string }> = {};
			for (const trade of trades) {
				if (trade.outputVaultBalanceChange) {
					const { vault, amount } = trade.outputVaultBalanceChange;
					if (vault && vault.token) {
						const { symbol, decimals, address } = vault.token;
						const volume = parseFloat(ethers.utils.formatUnits(amount, decimals).toString());

						if (!tokenVolumes[symbol]) {
							tokenVolumes[symbol] = { totalVolume: 0, tokenAddress: address };
						}
						tokenVolumes[symbol].totalVolume += Math.abs(volume);
					}
				}
				if (trade.inputVaultBalanceChange) {
					const { vault, amount } = trade.inputVaultBalanceChange;
					if (vault && vault.token) {
						const { symbol, decimals, address } = vault.token;
						const volume = parseFloat(ethers.utils.formatUnits(amount, decimals).toString());

						if (!tokenVolumes[symbol]) {
							tokenVolumes[symbol] = { totalVolume: 0, tokenAddress: address };
						}
						tokenVolumes[symbol].totalVolume += Math.abs(volume);
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
		}
	}

	function calculateBalanceChanges(order: any) {
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

	function calculateTotalDepositsAndWithdrawals(order: any) {
		order.order['orderDuration'] =  (Date.now() / 1000) - order.order.timestampAdded;
		for (const input of order.order.inputs) {
			input['totalDeposits'] = input.balanceChanges
				.filter((change: any) => change.__typename === 'deposit')
				.reduce(
					(sum: any, change: any) =>
						sum +
						parseFloat(ethers.utils.formatUnits(change.data.amount, input.token.decimals).toString()),
					0
				);
			input['totalWithdrawals'] = input.balanceChanges
				.filter((change: any) => change.__typename === 'withdrawal')
				.reduce(
					(sum: any, change: any) => 
						sum +
						parseFloat(ethers.utils.formatUnits(change.data.amount, input.token.decimals).toString()),
					0
				);
			input['currentVaultInputs'] = input.totalWithdrawals + parseFloat(ethers.utils.formatUnits(input.balance, input.token.decimals).toString());
			input['curerentVaultDifferential'] = input.currentVaultInputs - input.totalDeposits;
			input['curerentVaultDifferentialPercentage'] = input.totalDeposits > 0 ? (input.curerentVaultDifferential / input.totalDeposits) * 100 : 0;
			input['currentVaultApy'] = (input.curerentVaultDifferential * 31536000) / order.order.orderDuration;
			input['currentVaultApyPercentage'] = (input.curerentVaultDifferentialPercentage * 31536000) / order.order.orderDuration;


		}
		for(const output of order.order.outputs) {
			output['totalDeposits'] = output.balanceChanges
				.filter((change: any) => change.__typename === 'deposit')
				.reduce(
					(sum: any, change: any) =>
						sum +
						parseFloat(ethers.utils.formatUnits(change.data.amount, output.token.decimals).toString()),
					0
				);
			output['totalWithdrawals'] = output.balanceChanges
				.filter((change: any) => change.__typename === 'withdrawal')
				.reduce(
					(sum: any, change: any) =>
						sum +
						parseFloat(ethers.utils.formatUnits(change.data.amount, output.token.decimals).toString()),
					0
				);
			output['currentVaultInputs'] = output.totalWithdrawals + parseFloat(ethers.utils.formatUnits(output.balance, output.token.decimals).toString());
			output['curerentVaultDifferential'] = output.currentVaultInputs - output.totalDeposits;
			output['curerentVaultDifferentialPercentage'] = output.totalDeposits > 0 ? (output.curerentVaultDifferential / output.totalDeposits) * 100 : 0;
			output['currentVaultApy'] = (output.curerentVaultDifferential * 31536000) / order.order.orderDuration;
			output['currentVaultApyPercentage'] = (output.curerentVaultDifferentialPercentage * 31536000) / order.order.orderDuration;
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
{#if loading}
	<div class="flex h-screen flex-col items-center justify-center">
		<div
			class="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"
		></div>
		<p class="mt-3 text-lg font-medium text-gray-600">Loading...</p>
	</div>
{:else if orders}
	<div class="flex items-center justify-between border-b border-gray-300 p-6">
		<h1 class="text-2xl font-bold text-gray-800">
			{tokenSlugValue.toUpperCase()} Order List
		</h1>
		<div class="flex gap-4">
			<div class="flex gap-4">
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
						<div
							class="absolute z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg"
						>
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
					class="rounded border border-gray-300 p-2 text-gray-700 focus:outline-none"
					bind:value={orderHashStateValue}
				/>
			</div>
		</div>
	</div>
	<div class="flex rounded-t-lg border-b border-gray-300 bg-gray-100">
		{#each ['Trades', 'Balances', 'Vaults', 'P&L'] as tab}
			<button
				class="border-b-2 px-6 py-3 text-sm font-medium transition-all {activeTab === tab
					? 'border-indigo-500 bg-white font-semibold text-indigo-600'
					: 'border-transparent hover:border-gray-300 hover:text-gray-600'}"
				on:click={() => (activeTab = tab)}
			>
				{tab}
			</button>
		{/each}
	</div>
	<div class="max-w-screen-3xl mx-auto rounded-lg p-8">
		{#if activeTab === 'Trades'}
			<TradesTables {filteredOrders} {networkValue} />
		{:else if activeTab === 'Balances'}
			<BalancesTable {filteredOrders} {networkValue} />
		{:else if activeTab === 'Vaults'}
			<VaultsTable {filteredOrders} {networkValue} />
		{:else if activeTab === 'P&L'}
			<ProfitLossTable {filteredOrders} {networkValue} />
		{/if}
	</div>
{:else}
	<p>No orders available</p>
{/if}
