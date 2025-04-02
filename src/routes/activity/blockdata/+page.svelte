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
		try {
			if (poolData) {
				poolData.poolTrades = [];
			}
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

			poolData = await getBlockData(networkSettings, poolAddress, poolType, fromBlock, toBlock);
			poolData.poolTrades.sort((a, b) => b.blockNumber - a.blockNumber);
			isLoading = false;
		} catch {
			isLoading = false;
		}
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

<div class="flex min-h-screen flex-col p-2 md:p-4">
	<div class="mb-3 flex flex-col items-center gap-2 md:mb-5 md:gap-4">
		<h2 class="text-lg font-bold text-gray-800 md:text-2xl">Historical Block Data</h2>
	</div>
	<div
		class="mb-3 flex flex-col items-center gap-2 overflow-x-auto rounded-lg bg-white p-2 shadow-sm md:mb-5 md:flex-row md:gap-4 md:p-3"
	>
		<div class="w-full md:w-40">
			<select
				id="network-select"
				class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 md:px-3 md:py-2 md:text-sm"
				bind:value={network}
			>
				<option value="">Network</option>
				{#each Object.keys($settings.networks) as network}
					<option value={network}>{network}</option>
				{/each}
			</select>
		</div>

		<div class="w-full md:w-64">
			<input
				type="text"
				placeholder="Network RPC"
				class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 md:px-3 md:py-2 md:text-sm"
				bind:value={networkRpc}
			/>
		</div>

		<div class="w-full md:w-40">
			<select
				id="token-select"
				class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 md:px-3 md:py-2 md:text-sm"
				bind:value={token}
			>
				<option value="">Token</option>
				{#each Object.keys(tokenConfig).filter((token) => tokenConfig[token].network === network) as token}
					<option value={token}>{token}</option>
				{/each}
			</select>
		</div>

		{#if token && (tokenConfig[`${token}`].poolsV2.length > 0 || tokenConfig[`${token}`].poolsV3.length > 0 || tokenConfig[`${token}`].poolsPancakSwapV3.length > 0)}
			<div class="w-full md:w-64">
				<select
					id="pool-address-select"
					class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 md:px-3 md:py-2 md:text-sm"
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

			<div class="w-full md:w-44">
				<input
					type="datetime-local"
					placeholder="From"
					class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 md:px-3 md:py-2 md:text-sm"
					bind:value={fromTimestamp}
				/>
			</div>

			<div class="w-full md:w-44">
				<input
					type="datetime-local"
					placeholder="To"
					class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 md:px-3 md:py-2 md:text-sm"
					bind:value={toTimestamp}
				/>
			</div>

			<div class="w-full md:w-auto">
				<button
					on:click={getCsvData}
					disabled={!fromTimestamp || !toTimestamp || !poolAddress || !network || !token}
					class="w-full rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:px-4 md:py-2 md:text-sm"
				>
					Apply Filter
				</button>
			</div>
		{/if}
	</div>

	{#if isLoading}
		<div class="mt-4 flex flex-col items-center justify-start md:mt-10">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600 md:h-10 md:w-10"
			></div>
			<p class="mt-2 text-base font-medium text-gray-600 md:mt-3 md:text-lg">Loading...</p>
		</div>
	{/if}
	{#if poolData && poolData.poolTrades.length > 0}
		<div class="mb-2 flex justify-end md:mb-4">
			<button
				on:click={exportToCsv}
				class="rounded bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700 md:px-4 md:py-2 md:text-base"
			>
				Export to CSV
			</button>
		</div>
		<div class="relative h-[calc(100vh-200px)] w-full md:h-[calc(100vh-250px)]">
			<div class="absolute inset-0 overflow-auto rounded-lg">
				<div class="min-w-full overflow-x-auto">
					<Table class="relative w-full table-fixed border-collapse bg-white text-left">
						<TableHead class="sticky top-0 z-10 bg-gray-50 shadow-sm">
							<TableHeadCell
								class="w-20 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-900 md:w-32 md:px-6 md:py-3 md:text-xs"
							>
								Block Number
							</TableHeadCell>
							<TableHeadCell
								class="w-28 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-900 md:w-96 md:px-6 md:py-3 md:text-xs"
							>
								Transaction Hash
							</TableHeadCell>
							<TableHeadCell
								class="w-20 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-900 md:w-32 md:px-6 md:py-3 md:text-xs"
							>
								{poolData.token0Symbol} Amount
							</TableHeadCell>
							<TableHeadCell
								class="w-20 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-900 md:w-32 md:px-6 md:py-3 md:text-xs"
							>
								{poolData.token1Symbol} Amount
							</TableHeadCell>
							<TableHeadCell
								class="w-24 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-900 md:w-40 md:px-6 md:py-3 md:text-xs"
							>
								Timestamp
							</TableHeadCell>
							<TableHeadCell
								class="w-20 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-900 md:w-32 md:px-6 md:py-3 md:text-xs"
							>
								{poolData.token0Symbol}/{poolData.token1Symbol}
							</TableHeadCell>
							<TableHeadCell
								class="w-20 px-2 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-900 md:w-32 md:px-6 md:py-3 md:text-xs"
							>
								{poolData.token1Symbol}/{poolData.token0Symbol}
							</TableHeadCell>
						</TableHead>
						<TableBody tableBodyClass="divide-y divide-gray-200">
							{#each poolData.poolTrades as trade}
								<TableBodyRow class="hover:bg-gray-50">
									<TableBodyCell
										class="truncate px-2 py-2 text-[11px] text-gray-600 md:px-6 md:py-3 md:text-sm"
									>
										{trade.blockNumber}
									</TableBodyCell>
									<TableBodyCell
										class="truncate px-2 py-2 text-[11px] text-gray-600 md:px-6 md:py-3 md:text-sm"
									>
										{trade.transactionHash}
									</TableBodyCell>
									<TableBodyCell
										class="truncate px-2 py-2 text-[11px] text-gray-600 md:px-6 md:py-3 md:text-sm"
									>
										{trade.amount0}
									</TableBodyCell>
									<TableBodyCell
										class="truncate px-2 py-2 text-[11px] text-gray-600 md:px-6 md:py-3 md:text-sm"
									>
										{trade.amount1}
									</TableBodyCell>
									<TableBodyCell
										class="truncate px-2 py-2 text-[11px] text-gray-600 md:px-6 md:py-3 md:text-sm"
									>
										{trade.timestamp}
									</TableBodyCell>
									<TableBodyCell
										class="truncate px-2 py-2 text-[11px] text-gray-600 md:px-6 md:py-3 md:text-sm"
									>
										{trade.ratio0}
									</TableBodyCell>
									<TableBodyCell
										class="truncate px-2 py-2 text-[11px] text-gray-600 md:px-6 md:py-3 md:text-sm"
									>
										{trade.ratio1}
									</TableBodyCell>
								</TableBodyRow>
							{/each}
						</TableBody>
					</Table>
				</div>
			</div>
		</div>
	{:else if !isLoading}
		<div class="mt-4 text-center text-sm text-gray-500 md:text-base">
			No block data available. Please select the parameters and submit the query.
		</div>
	{/if}
</div>
