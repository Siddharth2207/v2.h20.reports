<script lang="ts">
	import type { SgTrade, MultiSubgraphArgs } from '@rainlanguage/orderbook/js_api';
	import { getOrders, getOrderTradesList } from '@rainlanguage/orderbook/js_api';
	import * as Plot from '@observablehq/plot';
	import { analyzeLiquidity } from '$lib/analyzeLiquidity';
	import { page } from '$app/stores';
	import type {
		TradesByTimeStamp,
		OrderListOrderWithSubgraphName,
		OrderListVault,
		MarketAnalytics,
		LiquidityAnalysisResult,
		MarketAnalyticsData
	} from '$lib/types';
	import { tokenConfig, DEFAULT_TRADES_PAGE_SIZE } from '$lib/constants';

	const { tokenSlug, network, activeSubgraphs } = $page.data.stores;

	const tokenSymbol = tokenConfig[$tokenSlug.toUpperCase()]?.symbol;
	const tokenAddress = tokenConfig[$tokenSlug.toUpperCase()]?.address;
	const weekInSeconds = 60 * 60 * 24 * 7;
	const monthInSeconds = 60 * 60 * 24 * 30;
	const currentTimeInSeconds = new Date().getTime() / 1000;

	let activeTab = 'Market Analytics';
	let loading = true;
	let marketDataLoaded = false;
	let marketData: MarketAnalyticsData;

	let historicalTrades: HTMLElement;
	let historicalVolume: HTMLElement;
	let weeklyTrades: HTMLElement;
	let weeklyVolume: HTMLElement;
	let weeklyTradesByPercentage: HTMLElement;
	let weeklyVolumeByPercentage: HTMLElement;
	let totalTradesByType: HTMLElement;
	let totalVolumeByType: HTMLElement;

	async function fetchAndPlotData() {
		if (activeTab !== 'Market Analytics') return;

		loading = true;
		const raindexOrdersWithTrades: OrderListOrderWithSubgraphName[] =
			await fetchAllOrderWithTrades();
		const allTrades: LiquidityAnalysisResult = await analyzeLiquidity(
			$network,
			$tokenSlug.toUpperCase(),
			currentTimeInSeconds - monthInSeconds,
			currentTimeInSeconds
		);
		
		const data = getTradesByDay(raindexOrdersWithTrades, allTrades.tradesAccordingToTimeStamp);

		marketData = data;
		// Render the charts
		renderCharts(data);

		marketDataLoaded = true;
		loading = false;
	}
	$: {
		fetchAndPlotData();
	}

	$: if (activeTab === 'Market Analytics') {
		if (!marketDataLoaded) {
			fetchAndPlotData();
		} else if (marketData) {
			renderCharts(marketData);
		}
	}

	async function fetchAllOrderWithTrades(): Promise<OrderListOrderWithSubgraphName[]> {
		let raindexOrders: OrderListOrderWithSubgraphName[] = [];
		let currentPage = 1;
		let hasMore = true;

		while (hasMore) {
			const orders = await getOrders(
				$activeSubgraphs,
				{
					active: undefined,
					orderHash: undefined,
					owners: []
				},
				{ page: currentPage, pageSize: 1000 }
			);

			raindexOrders = [...raindexOrders, ...orders];
			hasMore = orders.length === 1000;
			currentPage++;
		}

		raindexOrders = raindexOrders.filter(
			(order: OrderListOrderWithSubgraphName) =>
				order.order.inputs.some(
					(input: OrderListVault) =>
						input.token.symbol === tokenSymbol &&
						input.token.address.toLowerCase() === tokenAddress.toLowerCase()
				) ||
				order.order.outputs.some(
					(output: OrderListVault) =>
						output.token.symbol === tokenSymbol &&
						output.token.address.toLowerCase() === tokenAddress.toLowerCase()
				)
		);

		for (const order of raindexOrders) {
			let allTrades: SgTrade[] = [];
			let currentPage = 1;
			let hasMore = true;

			while (hasMore) {
				const trades = await getOrderTradesList(
					$activeSubgraphs.find((subgraph: MultiSubgraphArgs) => subgraph.name === $network)?.url ||
						'',
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

		return raindexOrders;
	}

	function getTradesByDay(
		raindexOrdersWithTrades: OrderListOrderWithSubgraphName[],
		allTrades: TradesByTimeStamp[]
	): MarketAnalyticsData {
		const allRaindexTrades = raindexOrdersWithTrades.flatMap((order) => order.order.trades);
		const raindexTradesTransactionHash = new Set(
			allRaindexTrades.map((trade) => trade.tradeEvent.transaction.id)
		);

		const raindexTrades: TradesByTimeStamp[] = [];
		const externalTrades: TradesByTimeStamp[] = [];

		for (const trade of allTrades) {
			if (raindexTradesTransactionHash.has(trade.transactionHash)) {
				raindexTrades.push(trade);
			} else {
				externalTrades.push(trade);
			}
		}

		const groupTradesByDay = (trades: TradesByTimeStamp[]) => {
			const grouped: { [key: string]: { date: string; count: number; volume: number } } = {};
			trades.forEach((trade) => {
				const dateKey = new Date(trade.timestamp * 1000).toISOString().split('T')[0];
				if (!grouped[dateKey]) {
					grouped[dateKey] = { date: dateKey, count: 0, volume: 0 };
				}
				grouped[dateKey].count += 1;
				grouped[dateKey].volume += trade.amountInUsd || 0;
			});
			return grouped;
		};

		const raindexTradesByDay = groupTradesByDay(raindexTrades);
		const externalTradesByDay = groupTradesByDay(externalTrades);

		const totalRaindexVolume: number = raindexTrades.reduce(
			(sum, item) => sum + (item.amountInUsd || 0),
			0
		);
		const totalExternalVolume: number = externalTrades.reduce(
			(sum, item) => sum + (item.amountInUsd || 0),
			0
		);

		const plotData: MarketAnalytics[] = [];
		const allDates = Array.from(
			new Set([...Object.keys(raindexTradesByDay), ...Object.keys(externalTradesByDay)])
		).sort();

		allDates.forEach((date) => {
			const raindexStats = raindexTradesByDay[date] || { count: 0, volume: 0 };
			const externalStats = externalTradesByDay[date] || { count: 0, volume: 0 };
			plotData.push({
				date: new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
				timestamp: new Date(date).getTime() / 1000,
				raindexTrades: raindexStats.count,
				externalTrades: externalStats.count,
				totalTrades: raindexStats.count + externalStats.count,
				raindexVolume: raindexStats.volume,
				externalVolume: externalStats.volume,
				totalVolume: raindexStats.volume + externalStats.volume
			});
		});

		return {
			plotData,
			totalRaindexTrades: raindexTrades.length,
			totalExternalTrades: externalTrades.length,
			totalRaindexVolume,
			totalExternalVolume
		};
	}

	function renderCharts(data: MarketAnalyticsData) {
		const {
			plotData,
			totalRaindexTrades,
			totalExternalTrades,
			totalRaindexVolume,
			totalExternalVolume
		} = data;

		// Create all charts
		createChart(historicalTrades, plotData, {
			title: 'Historical Trade Distribution',
			chartType: 'weekly',
			yField: 'totalTrades',
			secondaryYField: 'raindexTrades',
			yLabel: 'Trades',
			width: 1800,
			height: 500,
			filterFn: () => true
		});

		createChart(historicalVolume, plotData, {
			title: 'Historical Volume Distribution',
			chartType: 'weekly',
			yField: 'totalVolume',
			secondaryYField: 'raindexVolume',
			yLabel: 'Volume',
			width: 1800,
			height: 500,
			filterFn: () => true,
			formatYTicks: true
		});

		createChart(weeklyTrades, plotData, {
			title: 'Weekly Trade Distribution',
			chartType: 'weekly',
			yField: 'totalTrades',
			secondaryYField: 'raindexTrades',
			yLabel: 'Trades'
		});

		createChart(weeklyVolume, plotData, {
			title: 'Weekly Volume Distribution',
			chartType: 'weekly',
			yField: 'totalVolume',
			secondaryYField: 'raindexVolume',
			yLabel: 'Volume',
			formatYTicks: true
		});

		const weeklyTradesByPercentageData = plotData
			.filter((trade: MarketAnalytics) => trade.timestamp > Date.now() / 1000 - weekInSeconds)
			.map((trade: MarketAnalytics) => ({
				date: trade.date,
				totalTradesPercentage: (trade.totalTrades / trade.totalTrades) * 100,
				raindexTradesPercentage: (trade.raindexTrades / trade.totalTrades) * 100
			}));

		createChart(weeklyTradesByPercentage, weeklyTradesByPercentageData, {
			title: 'Weekly Trade Distribution By Percentage',
			chartType: 'weekly',
			yField: 'totalTradesPercentage',
			secondaryYField: 'raindexTradesPercentage',
			yLabel: 'Trades',
			filterFn: () => true
		});

		const weeklyVolumeByPercentageData = plotData
			.filter((trade: MarketAnalytics) => trade.timestamp > Date.now() / 1000 - weekInSeconds)
			.map((trade: MarketAnalytics) => ({
				date: trade.date,
				totalVolumePercentage: (trade.totalVolume / trade.totalVolume) * 100,
				raindexVolumePercentage: (trade.raindexVolume / trade.totalVolume) * 100
			}));

		createChart(weeklyVolumeByPercentage, weeklyVolumeByPercentageData, {
			title: 'Weekly Volume Distribution By Percentage',
			chartType: 'weekly',
			yField: 'totalVolumePercentage',
			secondaryYField: 'raindexVolumePercentage',
			yLabel: 'Volume',
			filterFn: () => true
		});

		createChart(
			totalTradesByType,
			[
				{ type: 'Raindex', value: totalRaindexTrades },
				{ type: 'External', value: totalExternalTrades }
			],
			{
				title: 'Total Trades by Type',
				chartType: 'bar',
				yField: 'value',
				yLabel: 'Trades'
			}
		);

		createChart(
			totalVolumeByType,
			[
				{ type: 'Raindex', value: totalRaindexVolume },
				{ type: 'External', value: totalExternalVolume }
			],
			{
				title: 'Total Volume by Type',
				chartType: 'bar',
				yField: 'value',
				yLabel: 'Volume',
				formatYTicks: true
			}
		);
	}

	function createChart(
		element: HTMLElement,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		data: any[],
		options: {
			title: string;
			chartType: 'bar' | 'weekly';
			xField?: string;
			yField: string;
			secondaryYField?: string;
			xLabel?: string;
			yLabel?: string;
			width?: number;
			height?: number;
			colorDomain?: string[];
			colorRange?: string[];
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			filterFn?: (item: any) => boolean;
			formatYTicks?: boolean;
		}
	) {
		if (!element) return; // Skip if element doesn't exist

		const {
			title,
			chartType,
			xField = chartType === 'bar' ? 'type' : 'date',
			yField,
			secondaryYField,
			xLabel = chartType === 'bar' ? 'Source' : 'Date',
			yLabel = 'Value',
			width = 900,
			height = 500,
			colorDomain = ['External', 'Raindex'],
			colorRange = ['rgb(38, 128, 217)', 'rgb(11, 38, 65)'],
			filterFn = chartType === 'weekly'
				? (item) => item.timestamp > Date.now() / 1000 - weekInSeconds
				: () => true,
			formatYTicks = chartType === 'bar'
		} = options;

		// Filter data if needed (for weekly charts)
		const filteredData = filterFn ? data.filter(filterFn) : data;

		// Format function for y-axis ticks
		const formatTickValue = (d: number) => {
			if (!formatYTicks) return d.toString();
			const absD = Math.abs(d);
			if (absD >= 1e9) return (d / 1e9).toFixed(1) + 'B';
			if (absD >= 1e6) return (d / 1e6).toFixed(1) + 'M';
			if (absD >= 1e3) return (d / 1e3).toFixed(1) + 'K';
			return d.toString();
		};

		// Remove any existing chart
		while (element.firstChild) {
			element.removeChild(element.firstChild);
		}

		// Create marks based on chart type
		let marks = [Plot.frame(), Plot.ruleY([0])];

		if (chartType === 'bar') {
			marks.push(
				Plot.barY(filteredData, {
					x: xField,
					y: yField,
					fill: xField,
					tip: true
				})
			);
		} else {
			// weekly chart
			marks.push(
				Plot.barY(filteredData, {
					x: xField,
					y: yField,
					fill: colorRange[0],
					tip: { fontSize: 14, fontFamily: 'monospace' }
				})
			);

			if (secondaryYField) {
				marks.push(
					Plot.barY(filteredData, {
						x: xField,
						y: secondaryYField,
						fill: colorRange[1],
						tip: { fontSize: 14, fontFamily: 'monospace', dx: 20, dy: 20 }
					})
				);
			}
		}

		// Create and append the plot
		try {
			const plot = Plot.plot({
				grid: true,
				figure: true,
				color: {
					legend: true,
					domain: colorDomain,
					range: colorRange
				},
				title: title,
				style: {
					padding: '10px',
					marginTop: '5px',
					marginBottom: '10px',
					borderRadius: '8px',
					fontSize: '14px'
				},
				marks: marks,
				width: width,
				height: height,
				inset: 20,
				aspectRatio: 1,
				x: {
					padding: 0.4,
					label: xLabel,
					labelAnchor: 'center',
					tickPadding: 5
				},
				y: {
					padding: 0.4,
					labelOffset: chartType === 'bar' ? 70 : undefined,
					label: yLabel,
					labelAnchor: 'center',
					tickFormat: formatTickValue,
					tickPadding: 5
				},
				marginLeft: 70,
				marginBottom: chartType === 'weekly' ? 60 : undefined
			});
			element.appendChild(plot);
		} catch (error) {
			console.error('Error creating chart:', error);
		}
	}
</script>

<div class="flex rounded-t-lg border-b border-gray-300 bg-gray-100">
	{#each ['Market Analytics', 'Order Analytics', 'Vault Analytics'] as tab}
		<button
			class="rounded-t-lg border-b-2 border-gray-300 px-6 py-3 text-sm font-medium transition-all {activeTab ===
			tab
				? 'border-indigo-500 bg-white font-semibold text-indigo-600'
				: 'border-transparent hover:border-gray-400 hover:text-gray-600'}"
			on:click={() => {
				activeTab = tab;
				if (tab === 'Market Analytics' && marketData) {
					// Force chart recreation on tab switch
					setTimeout(() => renderCharts(marketData), 0);
				}
			}}
		>
			{tab}
		</button>
	{/each}
</div>

{#if loading}
	<div class="mt-10 flex flex-col items-center justify-start">
		<div
			class="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"
		></div>
		<p class="mt-3 text-lg font-medium text-gray-600">Loading...</p>
	</div>
{:else}
	<div class="max-w-screen-3xl mx-auto rounded-lg p-2">
		{#if activeTab === 'Market Analytics'}
			<div class="wrapper">
				<div class="flex flex-col md:flex-row">
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={totalTradesByType}
					></div>
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={totalVolumeByType}
					></div>
				</div>
				<div class="flex flex-col md:flex-row">
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={weeklyTrades}
					></div>
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={weeklyVolume}
					></div>
				</div>
				<div class="flex flex-col md:flex-row">
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={weeklyTradesByPercentage}
					></div>
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={weeklyVolumeByPercentage}
					></div>
				</div>
				<div class="flex flex-row">
					<div class="w-full rounded-lg p-2 shadow-lg md:p-2" bind:this={historicalTrades}></div>
				</div>
				<div class="flex flex-row">
					<div class="w-full rounded-lg p-2 shadow-lg md:p-2" bind:this={historicalVolume}></div>
				</div>
			</div>
		{:else if activeTab === 'Order Analytics'}
			<p>Order Analytics</p>
		{:else if activeTab === 'Vault Analytics'}
			<p>Vault Analytics</p>
		{/if}
	</div>
{/if}
