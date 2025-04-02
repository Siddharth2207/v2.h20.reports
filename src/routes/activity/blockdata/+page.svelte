<script lang="ts">
	import { page } from '$app/stores';
	import { getBlockData, getBlockNumberForTimestamp } from '$lib/analyzeLiquidity';
	import {
		Table,
		TableBody,
		TableBodyRow,
		TableHeadCell,
		TableBodyCell,
		TableHead
	} from 'flowbite-svelte';
	import { tokenConfig } from '$lib/constants';
	import type { PoolData } from '$lib/types';

	const { settings } = $page.data.stores;
	let network = '';
	let networkRpc = '';
	let token = '';
	let poolAddress = '';
	let poolType = '';
	let fromTimestamp = '';
	let toTimestamp = '';

	let isLoading = false;
	let poolData: PoolData;

	$: {
		if (fromTimestamp && toTimestamp) {
			getCsvData();
		}
	}

	$: if (poolAddress) {
		if (tokenConfig[token].poolsV2.includes(poolAddress)) {
			poolType = 'v2';
		} else if (tokenConfig[token].poolsV3.includes(poolAddress)) {
			poolType = 'v3';
		} else if (tokenConfig[token].poolsPancakSwapV3.includes(poolAddress)) {
			poolType = 'pancakSwapV3';
		}
	}

	async function getCsvData() {
		isLoading = true;

		const fromBlock = await getBlockNumberForTimestamp(
			$settings.networks[network],
			new Date(fromTimestamp).getTime() / 1000
		);
		const toBlock = await getBlockNumberForTimestamp(
			$settings.networks[network],
			new Date(toTimestamp).getTime() / 1000 - 300
		);
		let networkSettings = $settings.networks[network];
		networkSettings['rpc'] = networkRpc ? networkRpc : networkSettings['rpc'];

		poolData = await getBlockData(
			networkSettings,
			poolAddress,
			poolType,
			fromBlock,
			toBlock
		);
		poolData.poolTrades.sort((a, b) => b.blockNumber - a.blockNumber);
		isLoading = false;
	}

	function exportToCsv() {
		if (!poolData || poolData.poolTrades.length === 0) return;

		const headers = [
			'Block Number',
			'Transaction Hash',
			`${poolData.token0Symbol} Amount`,
			`${poolData.token1Symbol} Amount`,
			'Timestamp',
			`${poolData.token0Symbol}/${poolData.token1Symbol} Ratio`,
			`${poolData.token1Symbol}/${poolData.token0Symbol} Ratio`
		];

		const csvData = poolData.poolTrades.map((item) => [
			item.blockNumber,
			item.transactionHash,
			item.amount0,
			item.amount1,
			item.timestamp,
			item.ratio0,
			item.ratio1
		]);

		const csvContent = [headers.join(','), ...csvData.map((row) => row.join(','))].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', `block_data_${new Date().toISOString()}.csv`);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

<div class="flex flex-col">
	<div class="mb-5 flex flex-col items-center gap-4">
		<h2 class="text-2xl font-bold text-gray-800">Historical Block Data</h2>
	</div>
	<div class="items-right mb-5 flex gap-4 bg-white p-3 shadow-sm">
		<div class="w-40">
			<select
				id="network-select"
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				bind:value={network}
			>
				<option value="">Network</option>
				{#each Object.keys($settings.networks) as network}
					<option value={network}>{network}</option>
				{/each}
			</select>
		</div>

		<div class="w-64">
			<input
				type="text"
				placeholder="Network RPC"
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				bind:value={networkRpc}
			/>
		</div>

		<div class="w-40">
			<select
				id="token-select"
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				bind:value={token}
			>
				<option value="">Token</option>
				{#each Object.keys(tokenConfig).filter((token) => tokenConfig[token].network === network) as token}
					<option value={token}>{token}</option>
				{/each}
			</select>
		</div>

		{#if token && (tokenConfig[`${token}`].poolsV2.length > 0 || tokenConfig[`${token}`].poolsV3.length > 0 || tokenConfig[`${token}`].poolsPancakSwapV3.length > 0)}
			<div class="w-64">
				<select
					id="pool-address-select"
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					bind:value={poolAddress}
				>
					<option value="">Pool Address</option>
					{#each tokenConfig[token].poolsV2 as pool}
						<option value={pool}>{pool}</option>
					{/each}
					{#each tokenConfig[token].poolsV3 as pool}
						<option value={pool}>{pool}</option>
					{/each}
					{#each tokenConfig[token].poolsPancakSwapV3 as pool}
						<option value={pool}>{pool}</option>
					{/each}
				</select>
			</div>

			<div class="w-44">
				<input
					type="datetime-local"
					placeholder="From"
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					bind:value={fromTimestamp}
				/>
			</div>

			<div class="w-44">
				<input
					type="datetime-local"
					placeholder="To"
					class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
					bind:value={toTimestamp}
				/>
			</div>
		{/if}
	</div>
	<div>
		{#if isLoading}
			<div class="mt-10 flex flex-col items-center justify-start">
				<div
					class="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"
				></div>
				<p class="mt-3 text-lg font-medium text-gray-600">Loading...</p>
			</div>
		{/if}
		{#if poolData && poolData.poolTrades.length > 0}
			<div class="mb-4 flex justify-end">
				<button
					on:click={exportToCsv}
					class="rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
				>
					Export to CSV
				</button>
			</div>
			<div class="relative h-[calc(100vh-250px)]">
				<div class="absolute inset-0 overflow-auto">
					<Table class="relative w-full table-fixed border-collapse bg-white">
						<TableHead class="sticky top-0 z-10 bg-gray-50 shadow-sm">
							<TableHeadCell
								class="w-32 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-900"
								>Block Number</TableHeadCell
							>
							<TableHeadCell
								class="w-96 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-900"
								>Transaction Hash</TableHeadCell
							>
							<TableHeadCell
								class="w-32 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-900"
								>{poolData.token0Symbol} Amount</TableHeadCell
							>
							<TableHeadCell
								class="w-32 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-900"
								>{poolData.token1Symbol} Amount</TableHeadCell
							>
							<TableHeadCell
								class="w-40 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-900"
								>timestamp</TableHeadCell
							>
							<TableHeadCell
								class="w-32 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-900"
								>{poolData.token0Symbol}/{poolData.token1Symbol} Ratio</TableHeadCell
							>
							<TableHeadCell
								class="w-32 px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-900"
								>{poolData.token1Symbol}/{poolData.token0Symbol} Ratio</TableHeadCell
							>
						</TableHead>
						<TableBody tableBodyClass="divide-y divide-gray-200">
							{#each poolData.poolTrades as trade}
								<TableBodyRow class="hover:bg-gray-50">
									<TableBodyCell class="truncate px-6 py-3 text-sm text-gray-600"
										>{trade.blockNumber}</TableBodyCell
									>
									<TableBodyCell class="truncate px-6 py-3 text-sm text-gray-600"
										>{trade.transactionHash}</TableBodyCell
									>
									<TableBodyCell class="truncate px-6 py-3 text-sm text-gray-600"
										>{trade.amount0}</TableBodyCell
									>
									<TableBodyCell class="truncate px-6 py-3 text-sm text-gray-600"
										>{trade.amount1}</TableBodyCell
									>
									<TableBodyCell class="truncate px-6 py-3 text-sm text-gray-600"
										>{trade.timestamp}</TableBodyCell
									>
									<TableBodyCell class="truncate px-6 py-3 text-sm text-gray-600"
										>{trade.ratio0}</TableBodyCell
									>
									<TableBodyCell class="truncate px-6 py-3 text-sm text-gray-600"
										>{trade.ratio1}</TableBodyCell
									>
								</TableBodyRow>
							{/each}
						</TableBody>
					</Table>
				</div>
			</div>
		{:else if !isLoading}
			<div class="mt-4 text-center text-gray-500">
				No block data available. Please select the parameters and submit the query.
			</div>
		{/if}
	</div>
</div>
