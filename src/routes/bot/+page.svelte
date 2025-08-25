<script lang="ts">
	import { onMount } from 'svelte';
	import txData from './take_orders.json';

	let stats = {
		totalTransactions: 0,
		firstTimestamp: 0,
		lastTimestamp: 0,
		firstDate: '',
		lastDate: '',
		uniqueMakers: 0,
		uniqueTakers: 0,
		totalInputAmount: 0,
		totalOutputAmount: 0,
		averageDowntime: 0,
		totalDowntime: 0,
		longestDowntime: 0,
		shortestDowntime: 0,
		downtimePeriods: 0
	};

	let chartContainer: HTMLElement;
	let chartExpanded = true;
	let selectedTimeFilter = '1w';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let filteredData: any[] = [];

	const timeFilters = [
		{ value: 'all', label: 'All Time' },
		{ value: '1d', label: '1 Day' },
		{ value: '1w', label: '1 Week' },
		{ value: '1m', label: '1 Month' },
		{ value: '3m', label: '3 Months' },
		{ value: '6m', label: '6 Months' },
		{ value: '1y', label: '1 Year' }
	];

	onMount(() => {
		applyTimeFilter();
	});

	function applyTimeFilter() {
		const now = Math.floor(Date.now() / 1000);
		let cutoffTime = 0;

		switch (selectedTimeFilter) {
			case '1d':
				cutoffTime = now - 24 * 60 * 60;
				break;
			case '1w':
				cutoffTime = now - 7 * 24 * 60 * 60;
				break;
			case '1m':
				cutoffTime = now - 30 * 24 * 60 * 60;
				break;
			case '3m':
				cutoffTime = now - 90 * 24 * 60 * 60;
				break;
			case '6m':
				cutoffTime = now - 180 * 24 * 60 * 60;
				break;
			case '1y':
				cutoffTime = now - 365 * 24 * 60 * 60;
				break;
			default:
				cutoffTime = 0;
		}

		// Filter transactions based on timestamp
		filteredData = txData.filter((tx) => tx.block_timestamp && tx.block_timestamp >= cutoffTime);

		// Recalculate statistics with filtered data
		calculateStats(filteredData);

		// Reinitialize chart if expanded
		if (chartExpanded) {
			setTimeout(() => {
				initializeChart();
			}, 100);
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function calculateStats(transactions: any[]) {
		if (!transactions || transactions.length === 0) {
			// Reset stats if no data
			stats = {
				totalTransactions: 0,
				firstTimestamp: 0,
				lastTimestamp: 0,
				firstDate: '',
				lastDate: '',
				uniqueMakers: 0,
				uniqueTakers: 0,
				totalInputAmount: 0,
				totalOutputAmount: 0,
				averageDowntime: 0,
				totalDowntime: 0,
				longestDowntime: 0,
				shortestDowntime: 0,
				downtimePeriods: 0
			};
			return;
		}

		// Calculate statistics
		stats.totalTransactions = transactions.length;

		// Find first and last timestamps
		const timestamps = transactions.map((tx) => tx.block_timestamp).filter((ts) => ts);
		if (timestamps.length > 0) {
			stats.firstTimestamp = Math.min(...timestamps);
			stats.lastTimestamp = Math.max(...timestamps);

			// Convert to readable dates
			stats.firstDate = new Date(stats.firstTimestamp * 1000).toLocaleString();
			stats.lastDate = new Date(stats.lastTimestamp * 1000).toLocaleString();
		}

		// Count unique addresses
		const makers = new Set(transactions.map((tx) => tx.maker).filter((m) => m));
		const takers = new Set(transactions.map((tx) => tx.taker).filter((t) => t));
		stats.uniqueMakers = makers.size;
		stats.uniqueTakers = takers.size;

		// Calculate total amounts
		stats.totalInputAmount = transactions.reduce(
			(sum, tx) => sum + (parseInt(tx.input_amount) || 0),
			0
		);
		stats.totalOutputAmount = transactions.reduce(
			(sum, tx) => sum + (parseInt(tx.output_amount) || 0),
			0
		);

		// Calculate downtime analysis
		calculateDowntimeAnalysis(transactions);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function calculateDowntimeAnalysis(transactions: any[]) {
		// Sort transactions by timestamp
		const sortedTxs = transactions
			.filter((tx) => tx.block_timestamp)
			.sort((a, b) => a.block_timestamp - b.block_timestamp);

		if (sortedTxs.length < 2) return;

		const downtimes: number[] = [];
		let totalDowntime = 0;

		// Calculate time between consecutive trades
		for (let i = 1; i < sortedTxs.length; i++) {
			const timeDiff = sortedTxs[i].block_timestamp - sortedTxs[i - 1].block_timestamp;
			downtimes.push(timeDiff);
			totalDowntime += timeDiff;
		}

		// Calculate statistics
		stats.downtimePeriods = downtimes.length;
		stats.totalDowntime = totalDowntime;
		stats.averageDowntime = totalDowntime / downtimes.length;
		stats.longestDowntime = Math.max(...downtimes);
		stats.shortestDowntime = Math.min(...downtimes);
	}

	function formatDuration(seconds: number): string {
		if (seconds < 60) return `${Math.round(seconds)}s`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
		if (seconds < 86400)
			return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
		return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
	}

	function toggleChart() {
		chartExpanded = !chartExpanded;
		if (chartExpanded) {
			setTimeout(() => {
				initializeChart();
			}, 100);
		}
	}

	async function initializeChart() {
		if (!chartContainer || !chartExpanded) return;

		// Dynamically import Observable Plot
		const Plot = await import('@observablehq/plot');

		// Prepare data for the chart
		const sortedTxs = filteredData
			.filter((tx) => tx.block_timestamp)
			.sort((a, b) => a.block_timestamp - b.block_timestamp);

		if (sortedTxs.length < 2) return;

		const chartData: Array<{ date: Date; downtime: number; type: string }> = [];

		// Create data for the actual downtime line
		for (let i = 1; i < sortedTxs.length; i++) {
			const timeDiff = sortedTxs[i].block_timestamp - sortedTxs[i - 1].block_timestamp;
			const date = new Date(sortedTxs[i].block_timestamp * 1000);

			chartData.push({
				date: date,
				downtime: timeDiff,
				type: 'Actual'
			});
		}

		// Create data for the average line (horizontal line spanning the entire chart)
		const firstDate = new Date(sortedTxs[0].block_timestamp * 1000);
		const lastDate = new Date(sortedTxs[sortedTxs.length - 1].block_timestamp * 1000);
		const averageData = [
			{ date: firstDate, downtime: stats.averageDowntime, type: 'Average' },
			{ date: lastDate, downtime: stats.averageDowntime, type: 'Average' }
		];

		// Create the plot
		const plot = Plot.plot({
			height: 400,
			width: chartContainer.clientWidth,
			style: {
				background: 'transparent'
			},
			marks: [
				Plot.line(chartData, {
					x: 'date',
					y: 'downtime',
					stroke: '#3b82f6',
					strokeWidth: 2,
					title: (d: { date: Date; downtime: number; type: string }) =>
						`Downtime: ${formatDuration(d.downtime)}\nDate: ${d.date.toLocaleString()}`
				}),
				Plot.line(averageData, {
					x: 'date',
					y: 'downtime',
					stroke: '#ef4444',
					strokeWidth: 2,
					strokeDasharray: '5,5',
					title: (d: { date: Date; downtime: number; type: string }) =>
						`Average: ${formatDuration(d.downtime)}`
				}),
				Plot.dot(chartData, {
					x: 'date',
					y: 'downtime',
					fill: '#3b82f6',
					r: 3,
					title: (d: { date: Date; downtime: number; type: string }) =>
						`Downtime: ${formatDuration(d.downtime)}\nDate: ${d.date.toLocaleString()}`
				})
			],
			x: {
				type: 'time',
				grid: true
			},
			y: {
				grid: true,
				zero: true
			},
			title: `Downtime Between Trades Over Time (${timeFilters.find((f) => f.value === selectedTimeFilter)?.label})`
		});

		// Clear container and append the plot
		chartContainer.innerHTML = '';
		chartContainer.appendChild(plot);
	}
</script>

<div class="min-h-screen bg-gray-50 p-6">
	<div class="mx-auto max-w-7xl">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900">Bot Downtime</h1>
		</div>

		<!-- Time Filter Controls -->
		<div class="mb-6 flex flex-wrap items-center gap-4 rounded-lg bg-white p-4 shadow">
			<h3 class="text-lg font-semibold text-gray-900">Time Filter:</h3>
			<div class="flex flex-wrap gap-2">
				{#each timeFilters as filter}
					<button
						class="rounded-lg px-4 py-2 text-sm font-medium transition-colors {selectedTimeFilter ===
						filter.value
							? 'bg-blue-600 text-white'
							: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
						on:click={() => {
							selectedTimeFilter = filter.value;
							applyTimeFilter();
						}}
					>
						{filter.label}
					</button>
				{/each}
			</div>
			<div class="ml-auto text-sm text-gray-600">
				Showing {filteredData.length} transactions
			</div>
		</div>

		<!-- Stats Grid -->
		<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			<!-- Total Transactions -->
			<div class="rounded-lg bg-white p-6 shadow">
				<div class="flex items-center">
					<div class="rounded-lg bg-blue-100 p-2">
						<svg
							class="h-6 w-6 text-blue-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
							></path>
						</svg>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-600">Total Transactions</p>
						<p class="text-2xl font-semibold text-gray-900">{stats.totalTransactions}</p>
					</div>
				</div>
			</div>

			<!-- Unique Makers -->
			<div class="rounded-lg bg-white p-6 shadow">
				<div class="flex items-center">
					<div class="rounded-lg bg-green-100 p-2">
						<svg
							class="h-6 w-6 text-green-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
							></path>
						</svg>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-600">Unique Makers</p>
						<p class="text-2xl font-semibold text-gray-900">{stats.uniqueMakers}</p>
					</div>
				</div>
			</div>

			<!-- Unique Takers -->
			<div class="rounded-lg bg-white p-6 shadow">
				<div class="flex items-center">
					<div class="rounded-lg bg-purple-100 p-2">
						<svg
							class="h-6 w-6 text-purple-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
							></path>
						</svg>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-600">Unique Takers</p>
						<p class="text-2xl font-semibold text-gray-900">{stats.uniqueTakers}</p>
					</div>
				</div>
			</div>

			<!-- Average Downtime -->
			<div class="rounded-lg bg-white p-6 shadow">
				<div class="flex items-center">
					<div class="rounded-lg bg-orange-100 p-2">
						<svg
							class="h-6 w-6 text-orange-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
					</div>
					<div class="ml-4">
						<p class="text-sm font-medium text-gray-600">Avg Downtime</p>
						<p class="text-2xl font-semibold text-gray-900">
							{formatDuration(stats.averageDowntime)}
						</p>
						<p class="text-sm text-gray-500">{Math.round(stats.averageDowntime)} seconds</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Downtime Analysis Section -->
		<div class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Average Downtime -->
			<div class="rounded-lg bg-white p-6 shadow">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Downtime Analysis</h3>
				<div class="space-y-3">
					<div class="flex justify-between">
						<span class="text-gray-600">Average:</span>
						<span class="font-medium">{formatDuration(stats.averageDowntime)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Longest:</span>
						<span class="font-medium">{formatDuration(stats.longestDowntime)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Shortest:</span>
						<span class="font-medium">{formatDuration(stats.shortestDowntime)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Total Periods:</span>
						<span class="font-medium">{stats.downtimePeriods}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Avg (seconds):</span>
						<span class="font-mono font-medium">{Math.round(stats.averageDowntime)}s</span>
					</div>
				</div>
			</div>

			<!-- First Transaction -->
			<div class="rounded-lg bg-white p-6 shadow">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">First Transaction</h3>
				<div class="space-y-3">
					<div class="flex justify-between">
						<span class="text-gray-600">Timestamp:</span>
						<span class="font-mono text-sm">{stats.firstTimestamp}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Date:</span>
						<span class="font-medium">{stats.firstDate || 'N/A'}</span>
					</div>
				</div>
			</div>

			<!-- Last Transaction -->
			<div class="rounded-lg bg-white p-6 shadow">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Last Transaction</h3>
				<div class="space-y-3">
					<div class="flex justify-between">
						<span class="text-gray-600">Timestamp:</span>
						<span class="font-mono text-sm">{stats.lastTimestamp}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-600">Date:</span>
						<span class="font-medium">{stats.lastDate || 'N/A'}</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Expandable Downtime Chart -->
		<div class="mb-8 rounded-lg bg-white p-6 shadow">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-gray-900">Downtime Pattern Visualization</h3>
				<button
					class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
					on:click={toggleChart}
				>
					{#if chartExpanded}
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"
							></path>
						</svg>
						Collapse Chart
					{:else}
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4v16m8-8H4"
							></path>
						</svg>
						Expand Chart
					{/if}
				</button>
			</div>

			{#if chartExpanded}
				<div class="mb-4 h-96 w-full" bind:this={chartContainer}>
					<!-- Chart will be rendered here -->
				</div>
				<div class="border-t border-gray-200 pt-6">
					<p class="text-center text-sm text-gray-600">
						Blue line shows actual downtime between trades, red dashed line shows the average
					</p>
				</div>
			{:else}
				<div
					class="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-300"
				>
					<p class="text-gray-500">Click "Expand Chart" to view the downtime visualization</p>
				</div>
			{/if}
		</div>

		<!-- Recent Transactions Preview -->
		<div class="rounded-lg bg-white shadow">
			<div class="border-b border-gray-200 px-6 py-4">
				<h3 class="text-lg font-semibold text-gray-900">Recent Transactions Preview</h3>
				<p class="mt-1 text-sm text-gray-600">
					Showing filtered transactions based on selected time period
				</p>
			</div>
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
								>Transaction Hash</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
								>Maker</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
								>Taker</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
								>Output Amount</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
								>Input Amount</th
							>
							<th
								class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
								>Block</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white">
						{#if filteredData && filteredData.length > 0}
							{#each filteredData.slice(0, 10) as tx}
								<tr class="hover:bg-gray-50">
									<td class="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-900">
										{#if tx.transaction_hash}
											<a
												href="https://basescan.org/tx/{tx.transaction_hash}"
												target="_blank"
												class="text-blue-600 hover:text-blue-800 hover:underline"
											>
												{tx.transaction_hash.slice(0, 8)}...{tx.transaction_hash.slice(-6)}
											</a>
										{:else}
											N/A
										{/if}
									</td>
									<td class="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-900">
										{tx.maker ? `${tx.maker.slice(0, 6)}...${tx.maker.slice(-4)}` : 'N/A'}
									</td>
									<td class="whitespace-nowrap px-6 py-4 font-mono text-sm text-gray-900">
										{tx.taker ? `${tx.taker.slice(0, 6)}...${tx.taker.slice(-4)}` : 'N/A'}
									</td>
									<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
										{tx.input_amount ? parseInt(tx.input_amount).toLocaleString() : 'N/A'}
									</td>
									<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
										{tx.output_amount ? parseInt(tx.output_amount).toLocaleString() : 'N/A'}
									</td>
									<td class="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
										{tx.block_number || 'N/A'}
									</td>
								</tr>
							{/each}
						{:else}
							<tr>
								<td colspan="6" class="px-6 py-8 text-center text-gray-500">
									No transactions found for the selected time period
								</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>
