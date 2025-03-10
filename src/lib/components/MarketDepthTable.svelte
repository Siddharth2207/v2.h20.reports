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
</script>

<div>
	<div class="flex flex-col gap-5">
		<div class="rounded-md border border-gray-300 bg-white p-4 shadow-md">
			<h3 class="mb-3 text-lg font-bold text-green-600">Buy Orders</h3>
			<Table class="w-full border-collapse text-left">
				<TableHead>
					<TableHeadCell class="px-4 py-2 text-center">#</TableHeadCell>
					<TableHeadCell class="px-4 py-2 text-center">Max Output</TableHeadCell>
					<TableHeadCell class="px-4 py-2 text-center">Input Amount</TableHeadCell>
					<TableHeadCell class="px-4 py-2 text-center">Ratio</TableHeadCell>
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
										>{parseFloat(order.maxOutput).toFixed(4)}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center"
										>{(parseFloat(order.maxOutput) * parseFloat(order.ratio)).toFixed(
											4
										)}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center"
										>{parseFloat(order.ratio).toFixed(4)}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center"
										>{order.price}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center"
										>{order.priceDistance}%</TableBodyCell
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
					<TableHeadCell class="px-4 py-2 text-center">Max Output</TableHeadCell>
					<TableHeadCell class="px-4 py-2 text-center">Input Amount</TableHeadCell>
					<TableHeadCell class="px-4 py-2 text-center">Ratio</TableHeadCell>
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
										>{parseFloat(order.maxOutput).toFixed(4)}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center"
										>{(parseFloat(order.maxOutput) * parseFloat(order.ratio)).toFixed(
											4
										)}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center"
										>{parseFloat(order.ratio).toFixed(4)}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center"
										>{order.price}</TableBodyCell
									>
									<TableBodyCell class="px-4 py-2 text-center"
										>{order.priceDistance}%</TableBodyCell
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
