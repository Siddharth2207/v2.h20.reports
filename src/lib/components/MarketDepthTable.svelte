<script lang="ts">
	import {
		Table,
		TableHead,
		TableBody,
		TableHeadCell,
		TableBodyCell,
		TableBodyRow
	} from 'flowbite-svelte';
	import type { CreateInfiniteQueryResult, InfiniteData } from '@tanstack/svelte-query';
	import type { MarketDepthOrder } from '$lib/types';

	export let network: string;
	export let marketDepthQuery: CreateInfiniteQueryResult<
		InfiniteData<{ orders: MarketDepthOrder[] }, unknown>,
		Error
	>;
	export let baseTokenSymbol: string;
	export let quoteTokenSymbol: string;
</script>

<div>
	<div class="max-w-8xl m-2 mx-auto w-full p-5 font-sans">
		<div class="relative mb-5 flex flex-col items-center gap-4">
			<button
				on:click={() => $marketDepthQuery.refetch()}
				class="absolute right-0 top-0 rounded-full p-2 transition-all duration-200 hover:bg-gray-100 focus:outline-none"
				aria-label="Refresh data"
			>
				<svg
					class="h-5 w-5 text-gray-600 {$marketDepthQuery.isFetching ? 'animate-spin' : ''}"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
			</button>
			<h2 class="text-2xl font-bold text-gray-800">Orderbook Market Depth</h2>
		</div>
	</div>
	<div class="flex flex-col gap-5">
		<div class="rounded-md border border-gray-300 bg-white p-4 shadow-md">
			<h3 class="mb-3 text-lg font-bold text-green-600">Buy Orders</h3>
			<Table class="w-full border-collapse text-left">
				<TableHead>
					<TableHeadCell class="px-4 py-2 text-center">#</TableHeadCell>
					<TableHeadCell class="px-4 py-2 text-center">Max Output {quoteTokenSymbol}</TableHeadCell>
					<TableHeadCell class="px-4 py-2 text-center">Input Amount {baseTokenSymbol}</TableHeadCell
					>
					<TableHeadCell class="px-4 py-2 text-center"
						>Ratio {baseTokenSymbol}/{quoteTokenSymbol}</TableHeadCell
					>
					<TableHeadCell class="px-4 py-2 text-center">Price</TableHeadCell>
					<TableHeadCell class="px-4 py-2 text-center">Price Distance</TableHeadCell>
					<TableHeadCell class="px-4 py-2 text-center">Order Hash</TableHeadCell>
				</TableHead>
				<TableBody>
					{#if $marketDepthQuery.isLoading}
						<TableBodyRow>
							<TableBodyCell colspan="7" class="h-32 text-center">
								<div class="flex h-full flex-col items-center justify-center">
									<div
										class="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"
									></div>
									<p class="mt-3 text-lg font-medium text-gray-600">Loading...</p>
								</div>
							</TableBodyCell>
						</TableBodyRow>
					{:else if $marketDepthQuery.data?.pages[0].orders.length === 0}
						<div data-testid="emptyMessage" class="text-center text-gray-900 dark:text-white">
							None found
						</div>
					{:else if $marketDepthQuery.data?.pages[0].orders !== undefined && $marketDepthQuery.data?.pages[0].orders.length > 0}
						{#each $marketDepthQuery.data?.pages as page}
							{#each page.orders.filter((order) => order.type === 'buy') as order, index}
								<TableBodyRow>
									<TableBodyCell class="px-4 py-2 text-center">{index + 1}</TableBodyCell>
									<TableBodyCell class="px-4 py-2 text-center"
										>{parseFloat(order.maxOutput).toFixed(18)}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center"
										>{(parseFloat(order.maxOutput) * parseFloat(order.ratio)).toFixed(
											18
										)}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center"
										>{parseFloat(order.ratio).toFixed(18)}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center">{order.price}</TableBodyCell>
									<TableBodyCell class="px-4 py-2 text-center"
										>{parseFloat(order.priceDistance).toFixed(2)}%</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center text-blue-500 underline">
										<a
											href={`https://v2.raindex.finance/orders/${network}-${order.sgOrder.orderHash}`}
											target="_blank"
											rel="noopener noreferrer"
										>
											{`${order.sgOrder.orderHash.slice(0, 6)}...${order.sgOrder.orderHash.slice(-4)}`}
										</a>
									</TableBodyCell>
								</TableBodyRow>
							{/each}
						{/each}
					{/if}
				</TableBody>
			</Table>
		</div>
		<div class="rounded-md border border-gray-300 bg-white p-4 shadow-md">
			<h3 class="mb-3 text-lg font-bold text-red-600">Sell Orders</h3>
			<Table class="w-full border-collapse text-left">
				<TableHead>
					<TableHeadCell class="px-4 py-2 text-center">#</TableHeadCell>
					<TableHeadCell class="px-4 py-2 text-center">Max Output {baseTokenSymbol}</TableHeadCell>
					<TableHeadCell class="px-4 py-2 text-center"
						>Input Amount {quoteTokenSymbol}</TableHeadCell
					>
					<TableHeadCell class="px-4 py-2 text-center"
						>Ratio {quoteTokenSymbol}/{baseTokenSymbol}</TableHeadCell
					>
					<TableHeadCell class="px-4 py-2 text-center">Price</TableHeadCell>
					<TableHeadCell class="px-4 py-2 text-center">Price Distance</TableHeadCell>
					<TableHeadCell class="px-4 py-2 text-center">Order Hash</TableHeadCell>
				</TableHead>
				<TableBody>
					{#if $marketDepthQuery.isLoading}
						<TableBodyRow>
							<TableBodyCell colspan="7" class="h-32 text-center">
								<div class="flex h-full flex-col items-center justify-center">
									<div
										class="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"
									></div>
									<p class="mt-3 text-lg font-medium text-gray-600">Loading...</p>
								</div>
							</TableBodyCell>
						</TableBodyRow>
					{:else if $marketDepthQuery.data?.pages[0].orders.length === 0}
						<div data-testid="emptyMessage" class="text-center text-gray-900 dark:text-white">
							None found
						</div>
					{:else if $marketDepthQuery.data?.pages[0].orders !== undefined && $marketDepthQuery.data?.pages[0].orders.length > 0}
						{#each $marketDepthQuery.data?.pages as page}
							{#each page.orders.filter((order) => order.type === 'sell') as order, index}
								<TableBodyRow>
									<TableBodyCell class="px-4 py-2 text-center">{index + 1}</TableBodyCell>
									<TableBodyCell class="px-4 py-2 text-center"
										>{parseFloat(order.maxOutput).toFixed(18)}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center"
										>{(parseFloat(order.maxOutput) * parseFloat(order.ratio)).toFixed(
											18
										)}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center"
										>{parseFloat(order.ratio).toFixed(18)}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center">{order.price}</TableBodyCell>
									<TableBodyCell class="px-4 py-2 text-center"
										>{parseFloat(order.priceDistance).toFixed(2)}%</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center text-blue-500 underline">
										<a
											href={`https://v2.raindex.finance/orders/${network}-${order.sgOrder.orderHash}`}
											target="_blank"
											rel="noopener noreferrer"
										>
											{`${order.sgOrder.orderHash.slice(0, 6)}...${order.sgOrder.orderHash.slice(-4)}`}
										</a>
									</TableBodyCell>
								</TableBodyRow>
							{/each}
						{/each}
					{/if}
				</TableBody>
			</Table>
		</div>
	</div>
</div>
