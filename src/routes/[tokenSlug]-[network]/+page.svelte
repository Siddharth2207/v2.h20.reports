<script lang="ts">
	import '../../app.css';
	import { page } from '$app/stores';
	import { getTokenOrders, formatTimestamp, formatBalance } from '$lib/orders';
	import type { MultiSubgraphArgs } from '@rainlanguage/orderbook/js_api';
	import { ethers } from 'ethers';
	import { onMount } from 'svelte';
	const { settings, activeSubgraphs, tokenSlug, network, orderActiveState, orderHashState } =
		$page.data.stores;
	let activeSubgraphsValue: MultiSubgraphArgs[] = $activeSubgraphs;
	let settingsValue: any = $settings;
	let tokenSlugValue: string = $tokenSlug;
	let networkValue: string = $network;
	let orderActiveStateValue: boolean | undefined = $orderActiveState;
	let orderHashStateValue: string | undefined = $orderHashState;
	let orders: any[] = [];
	let volumes: any = null;
	let loading = true;
	let errorMessage: string = '';
	let isStatusDropdownOpen = false;

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
			}
			console.log('Orders fetched:', JSON.stringify(orders));
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

	$: console.log(JSON.stringify(volumes));

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
                                            orderActiveStateValue = true
                                            orderActiveState.set(true)
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
                                            orderActiveStateValue = false
                                            orderActiveState.set(false)
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
                                            orderActiveStateValue = undefined
                                            orderActiveState.set(undefined)
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
	<div class="max-w-screen-3xl mx-auto rounded-lg p-8">
		<div class="overflow-hidden rounded-lg bg-white shadow-lg">
			<table class="w-full table-auto border-collapse border border-gray-200">
				<thead class="bg-gray-50 text-sm font-semibold text-gray-800">
					<th class="px-4 py-3 text-center">
						<p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">Network</p>
					</th>
					<th class="px-4 py-3 text-center">
						<p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">Order Active</p>
					</th>
					<th class="px-4 py-3 text-center">
						<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
							<option value="lastTradeAsc">Last Trade ↑</option>
							<option value="lastTradeDesc">Last Trade ↓</option>
						</select>
					</th>

					<th class="px-4 py-3 text-center">
						<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
							<option value="firstTradeAsc">First Trade ↑</option>
							<option value="firstTradeDesc">First Trade ↓</option>
						</select>
					</th>

					<th class="px-4 py-3 text-center">
						<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
							<option value="totalTradesAsc">Total Trades ↑</option>
							<option value="totalTradesDesc">Total Trades ↓</option>
						</select>
					</th>

					<th class="px-4 py-3 text-center">
						<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
							<option value="trades24hAsc">24h Trades ↑</option>
							<option value="trades24hDesc">24h Trades ↓</option>
						</select>
					</th>

					<th class="px-4 py-3 text-center">
						<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
							<option value="volTotalAsc">Total Volume ↑</option>
							<option value="volTotalDesc">Total Volume ↓</option>
						</select>
					</th>

					<th class="px-4 py-3 text-center">
						<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
							<option value="vol24hAsc">24h Volume ↑</option>
							<option value="vol24hDesc">24h Volume ↓</option>
						</select>
					</th>

					<th class="px-4 py-3 text-center">
						<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
							<option value="inputAsc">Input Balance ↑</option>
							<option value="inputDesc">Input Balance ↓</option>
						</select>
					</th>

					<th class="px-4 py-3 text-center">
						<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
							<option value="outputAsc">Output Balance ↑</option>
							<option value="outputDesc">Output Balance ↓</option>
						</select>
					</th>

					<th class="px-4 py-3 text-center">
						<p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">Order Link</p>
					</th>
				</thead>
				<tbody>
					{#each filteredOrders as order (order.order.orderHash)}
						<tr class="border-t border-gray-300 text-gray-700">
							<td class="px-4 py-3 text-center text-sm">{networkValue}</td>
							<td class="px-4 py-3 text-center text-sm">
								<span
									class={`rounded px-2 py-1 ${order.order.active ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
								>
									{order.order.active ? 'Active' : 'Inactive'}
								</span>
							</td>

							<td class="px-4 py-3 text-center text-sm"
								>{order.order.trades.length > 0
									? formatTimestamp(order.order.trades[order.order.trades.length - 1].timestamp)
									: 'N/A'}</td
							>
							<td class="px-4 py-3 text-center text-sm"
								>{order.order.trades.length > 0
									? formatTimestamp(order.order.trades[0].timestamp)
									: 'N/A'}</td
							>
							<td class="px-4 py-3 text-center text-sm">{order.order.trades.length}</td>
							<td class="px-4 py-3 text-center text-sm">
								{order.order.trades.length > 0
									? order.order.trades.filter(
											(trade) => Date.now() / 1000 - trade.timestamp <= 86400
										).length
									: 'N/A'}
							</td>
							<td class="px-4 py-3 text-center text-sm">
								{#each order.order.totalVolume as token (token)}
									<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
										<span class="font-semibold">{token.token}</span>
										<span class="text-gray-800">{formatBalance(token.totalVolume)}</span>
									</div>
								{/each}
							</td>
							<td class="px-4 py-3 text-center text-sm">
								{#each order.order.totalVolume24h as token (token)}
									<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
										<span class="font-semibold">{token.token}</span>
										<span class="text-gray-800">{formatBalance(token.totalVolume)}</span>
									</div>
								{/each}
							</td>
							<td class="px-4 py-3 text-center text-sm">
								{#each order.order.inputs as input (input.id)}
									<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
										<span class="font-semibold">{input.token.symbol}</span>
										<span class="text-gray-800"
											>{formatBalance(
												parseFloat(
													ethers.utils.formatUnits(input.balance, input.token.decimals).toString()
												)
											)}</span
										>
									</div>
								{/each}
							</td>
							<td class="px-4 py-3 text-center text-sm">
								{#each order.order.outputs as output (output.id)}
									<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
										<span class="font-semibold">{output.token.symbol}</span>
										<span class="text-gray-800"
											>{formatBalance(
												parseFloat(
													ethers.utils.formatUnits(output.balance, output.token.decimals).toString()
												)
											)}</span
										>
									</div>
								{/each}
							</td>
							<td class="px-4 py-3 text-center text-sm">
								<a
									href={`https://v2.raindex.finance/orders/${networkValue}-${order.order.orderHash}`}
									target="_blank"
								>
									<span class="text-blue-500 hover:text-blue-700"
										>{order.order.orderHash.slice(0, 6)}...{order.order.orderHash.slice(-4)}</span
									>
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{:else}
	<p>No orders available</p>
{/if}
