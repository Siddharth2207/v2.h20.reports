<script lang="ts">
	import { page } from '$app/stores';
	import { DEFAULT_ORDERS_PAGE_SIZE, networkConfig, tokenConfig } from '$lib/constants';
	import { queryRainSolverByOrder } from '$lib/queryRainSolver';
	import {
		Button,
		Table,
		TableBody,
		TableBodyRow,
		TableHeadCell,
		TableBodyCell,
		TableHead
	} from 'flowbite-svelte';
	import {
		type MultiSubgraphArgs,
		type SgVault,
		type SgOrderWithSubgraphName,
		getOrders
	} from '@rainlanguage/orderbook/js_api';
	import { createInfiniteQuery } from '@tanstack/svelte-query';
	import type {
		SgOrderWithSubgraphNameAndSolverLogs,
		RainSolverLog,
		RainSolverAttempt,
	} from '$lib/types';
	import { formatTimestamp } from '$lib/orders';

	const { activeSubgraphs, tokenSlug, network } = $page.data.stores;

	let activeSubgraphsValue: MultiSubgraphArgs[] = $activeSubgraphs;
	let tokenSlugValue: string = $tokenSlug;
	let networkValue: string = $network;

	export const tokenSymbol = tokenConfig[tokenSlugValue.toUpperCase()]?.symbol;
	export const tokenAddress = tokenConfig[tokenSlugValue.toUpperCase()]?.address;

	$: orderHash = undefined;
	$: orderOwner = undefined;

	$: solverQuery = createInfiniteQuery({
		queryKey: [orderHash, orderOwner],
		queryFn: async ({ pageParam = 0 }) => {
			const allOrders: SgOrderWithSubgraphName[] = await getOrders(
				activeSubgraphsValue,
				{
					owners: orderOwner ? [orderOwner] : [],
					active: true,
					orderHash: orderHash ? orderHash : undefined
				},
				{ page: pageParam + 1, pageSize: DEFAULT_ORDERS_PAGE_SIZE }
			);

			let filteredOrders = allOrders.filter(
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

			const ordersWithSolverLogs = await getSolverLogs(filteredOrders);

			return {
				orders: ordersWithSolverLogs,
				hasMore: allOrders.length === DEFAULT_ORDERS_PAGE_SIZE
			};
		},
		initialPageParam: 0,
		getNextPageParam(lastPage, _allPages, lastPageParam) {
			return lastPage.hasMore ? lastPageParam + 1 : undefined;
		},
		enabled: true
	});

	function isRainSolverAttempt(attemptDetails: any): attemptDetails is RainSolverAttempt {
		return (
			attemptDetails &&
			typeof attemptDetails.quote === 'object' &&
			typeof attemptDetails.fullAttempt === 'object' &&
			typeof attemptDetails.quote.maxOutput === 'string' &&
			typeof attemptDetails.quote.ratio === 'string' &&
			typeof attemptDetails.fullAttempt.marketPrice === 'string' &&
			typeof attemptDetails.fullAttempt.error === 'string'
		);
	}

	async function getSolverLogs(
		orders: SgOrderWithSubgraphName[]
	): Promise<SgOrderWithSubgraphNameAndSolverLogs[]> {
		const ordersWithSolverLogs: SgOrderWithSubgraphNameAndSolverLogs[] = [];
		for (const order of orders) {
			const orderSolverLogs: RainSolverLog[] = await queryRainSolverByOrder(
				networkConfig[tokenConfig[tokenSlugValue.toUpperCase()].network].chainId,
				order.order.orderHash,
				Date.now(),
				10
			);
			ordersWithSolverLogs.push({ ...order, solverLogs: orderSolverLogs });
		}
		return ordersWithSolverLogs;
	}
</script>

<div class="flex items-center justify-between border-b border-gray-400 p-2">
	<h1 class="text-2xl font-bold text-gray-800">
		{tokenSlugValue.toUpperCase()} Solver Logs
	</h1>
	<div class="flex gap-3">
		<input
			type="text"
			placeholder="Search by Order Hash"
			class="min-w-[200px] rounded border border-gray-300 p-2 text-gray-700 focus:outline-none"
			bind:value={orderHash}
		/>
		<input
			type="text"
			placeholder="Search by Order Owner"
			class="min-w-[200px] rounded border border-gray-300 p-2 text-gray-700 focus:outline-none"
			bind:value={orderOwner}
		/>
	</div>
</div>
{#if $solverQuery.isLoading}
	<div class="mt-10 flex flex-col items-center justify-start">
		<div
			class="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"
		></div>
		<p class="mt-3 text-lg font-medium text-gray-600">Loading...</p>
	</div>
{:else if $solverQuery.data?.pages[0].orders.length === 0}
	<div data-testid="emptyMessage" class="text-center text-gray-900 dark:text-white">None found</div>
{:else if $solverQuery.data?.pages[0].orders !== undefined && $solverQuery.data?.pages[0].orders.length > 0}
	<Table>
		<TableHead class="bg-gray-50 text-sm font-semibold text-gray-800">
			<TableHeadCell class="px-4 py-3 text-center">
				<p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">Network</p>
			</TableHeadCell>
			<TableHeadCell class="px-4 py-3 text-center">
				<p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">Order Link</p>
			</TableHeadCell>
			<TableHeadCell class="px-4 py-3 text-center">
				<p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">Solver Logs</p>
			</TableHeadCell>
		</TableHead>
		{#each $solverQuery.data.pages as page}
			{#each page.orders as order (order.order.orderHash)}
				<TableBody>
					<TableBodyRow class="border-gray-300 text-gray-700">
						<TableBodyCell class="px-4 py-3 text-center text-sm">{networkValue}</TableBodyCell>
						<TableBodyCell class="px-4 py-3 text-center text-sm">
							<a
								href={`https://v2.raindex.finance/orders/${networkValue}-${order.order.orderHash}`}
								target="_blank"
							>
								<span class="text-blue-500 hover:text-blue-700"
									>{order.order.orderHash.slice(0, 6)}...{order.order.orderHash.slice(-4)}</span
								>
							</a>
						</TableBodyCell>

						<TableBodyCell class="px-4 py-3 text-center text-sm">
							<Table>
								<TableHead>
									<TableHeadCell class=" px-4 py-3 text-center">Timestamp</TableHeadCell>
									<TableHeadCell class=" px-4 py-3 text-center">Pair</TableHeadCell>
									<TableHeadCell class=" px-4 py-3 text-center">Status</TableHeadCell>
									<TableHeadCell class=" px-4 py-3 text-center">Order Ratio</TableHeadCell>
									<TableHeadCell class=" px-4 py-3 text-center">Order Max Output</TableHeadCell>
									<TableHeadCell class=" px-4 py-3 text-center">Market Price</TableHeadCell>
									<TableHeadCell class=" px-4 py-3 text-center">Price Distance</TableHeadCell>
									<TableHeadCell class=" px-4 py-3 text-center">Error</TableHeadCell>
									<TableHeadCell class=" px-4 py-3 text-center">Transaction URL</TableHeadCell>
								</TableHead>
								<TableBody>
									{#if order.solverLogs.length === 0}
										<TableBodyRow>
											<TableBodyCell class="w-[40px] px-4 py-3 text-center">-</TableBodyCell>
											<TableBodyCell class="w-[40px] px-4 py-3 text-center">-</TableBodyCell>
											<TableBodyCell class="w-[150px] px-4 py-3 text-center"
												>Order not picked up by solver for the timeframe</TableBodyCell
											>
											<TableBodyCell class="w-[60px] px-4 py-3 text-center">-</TableBodyCell>
											<TableBodyCell class="w-[60px] px-4 py-3 text-center">-</TableBodyCell>
											<TableBodyCell class="w-[60px] px-4 py-3 text-center">-</TableBodyCell>
											<TableBodyCell class="w-[60px] px-4 py-3 text-center">-</TableBodyCell>
											<TableBodyCell class="w-[60px] px-4 py-3 text-center">-</TableBodyCell>
											<TableBodyCell class="w-[60px] px-4 py-3 text-center">-</TableBodyCell>
										</TableBodyRow>
									{:else if order.solverLogs.length > 0}
										{#each order.solverLogs as solverLog}
											<TableBodyRow>
												<TableBodyCell class="w-[40px] px-4 py-3 text-center"
													>{formatTimestamp(solverLog.timestamp)}</TableBodyCell
												>
												<TableBodyCell class="w-[40px] px-4 py-3 text-center"
													>{solverLog.pair}</TableBodyCell
												>
												<TableBodyCell class="w-[150px] px-4 py-3 text-center">
													<span
														class={`rounded px-2 py-1 ${solverLog.status === 'found opportunity' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
													>
														{solverLog.status}
													</span>
												</TableBodyCell>
												{#if isRainSolverAttempt(solverLog.attemptDetails)}
													<TableBodyCell class="w-[60px] px-4 py-3 text-center"
														>{parseFloat(solverLog.attemptDetails?.quote?.ratio).toFixed(
															6
														)}</TableBodyCell
													>
													<TableBodyCell class="w-[60px] px-4 py-3 text-center"
														>{parseFloat(solverLog.attemptDetails?.quote?.maxOutput).toFixed(
															6
														)}</TableBodyCell
													>
													<TableBodyCell class="w-[60px] px-4 py-3 text-center"
														>{parseFloat(
															solverLog.attemptDetails?.fullAttempt?.marketPrice
														).toFixed(6)}</TableBodyCell
													>
													<TableBodyCell class="w-[60px] px-4 py-3 text-center"
														>{(
															parseFloat(solverLog.attemptDetails?.quote?.ratio) -
															parseFloat(solverLog.attemptDetails?.fullAttempt?.marketPrice)
														).toFixed(6)}</TableBodyCell
													>
													<TableBodyCell class="w-[300px] px-4 py-3 text-center text-red-500"
														>{solverLog.attemptDetails?.fullAttempt?.error}</TableBodyCell
													>
													<TableBodyCell class="w-[60px] px-4 py-3 text-center">-</TableBodyCell>
												{:else if !isRainSolverAttempt(solverLog.attemptDetails)}
													<TableBodyCell class="w-[60px] px-4 py-3 text-center">-</TableBodyCell>
													<TableBodyCell class="w-[60px] px-4 py-3 text-center">-</TableBodyCell>
													<TableBodyCell class="w-[60px] px-4 py-3 text-center">-</TableBodyCell>
													<TableBodyCell class="w-[200px] px-4 py-3 text-center">-</TableBodyCell>
													<TableBodyCell class="w-[300px] px-4 py-3 text-center">-</TableBodyCell>
													<TableBodyCell class="w-[60px] px-4 py-3  text-center">
														<a href={solverLog.attemptDetails?.txUrl} target="_blank">
															{#if solverLog.attemptDetails?.txUrl}
																<span class="text-blue-500 hover:text-blue-700">Link</span>
															{:else}
																-
															{/if}
														</a>
													</TableBodyCell>
												{/if}
											</TableBodyRow>
										{/each}
									{/if}
								</TableBody>
							</Table>
						</TableBodyCell>
					</TableBodyRow>
				</TableBody>
			{/each}
		{/each}
	</Table>
	<div class="mt-2 flex justify-center">
		{#if $solverQuery.hasNextPage || $solverQuery.isFetchingNextPage}
			<Button
				data-testid="loadMoreButton"
				size="xs"
				color="dark"
				on:click={async () => {
					await $solverQuery.fetchNextPage();
				}}
				class="rounded bg-gray-800 px-2 py-1 text-sm text-white hover:bg-gray-600"
			>
				{#if $solverQuery.isFetchingNextPage}
					Loading more...
				{:else}
					Load More
				{/if}
			</Button>
		{/if}
	</div>
{/if}
