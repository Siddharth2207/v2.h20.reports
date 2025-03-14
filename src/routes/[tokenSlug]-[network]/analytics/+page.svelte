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
		LiquidityAnalysisResult
	} from '$lib/types';
	import { tokenConfig, DEFAULT_TRADES_PAGE_SIZE } from '$lib/constants';

	const { tokenSlug, network, activeSubgraphs } = $page.data.stores;

	const tokenSymbol = tokenConfig[$tokenSlug.toUpperCase()]?.symbol;
	const tokenAddress = tokenConfig[$tokenSlug.toUpperCase()]?.address;

	let activeTab = 'Market Analytics';
	let loading = true;

	let historicalTrades: HTMLElement;
	let historicalVolume: HTMLElement;
	let weeklyTrades: HTMLElement;
	let weeklyVolume: HTMLElement;
	let weeklyTradesByPercentage: HTMLElement;
	let weeklyVolumeByPercentage: HTMLElement;

	async function fetchAndPlotData() {
		const raindexOrdersWithTrades: OrderListOrderWithSubgraphName[] =
			await fetchAllOrderWithTrades();
		const allTrades: LiquidityAnalysisResult = await analyzeLiquidity(
			$network,
			$tokenSlug.toUpperCase(),
			new Date().getTime() / 1000 - 60 * 60 * 24 * 7,
			new Date().getTime() / 1000
		);

		const plotData = getTradesByDay(raindexOrdersWithTrades, allTrades.tradesAccordingToTimeStamp);

		{
			historicalTrades?.firstChild?.remove();
			historicalTrades?.append(
				Plot.plot({
					grid: true,
					figure: true,
					color: { legend: true },
					title: 'Historical Trade Distribution',

					marks: [
						Plot.frame(),
						Plot.ruleY([0]),
						Plot.barY(plotData, {
							x: 'date',
							y: 'totalTrades',
							fill: 'rgb(38, 128, 217)',
							tip: { fontSize: 14, fontFamily: 'monospace' }
						}),
						Plot.barY(plotData, {
							x: 'date',
							y: 'raindexTrades',
							fill: 'rgb(11, 38, 65)',
							tip: { fontSize: 14, fontFamily: 'monospace', dx: 20, dy: 20 }
						})
					],

					width: 1800,
					height: 500,
					inset: 10,
					aspectRatio: 1,
					x: {
						padding: 0.4,
						label: 'Date',
						labelAnchor: 'center'
					},
					y: {
						label: 'Trades',
						labelAnchor: 'center'
					}
				})
			);
		}
		{
			historicalVolume?.firstChild?.remove();
			historicalVolume?.append(
				Plot.plot({
					grid: true,
					figure: true,
					color: { legend: true },
					title: 'Historical Volume Distribution',

					marks: [
						Plot.frame(),
						Plot.ruleY([0]),
						Plot.barY(plotData, {
							x: 'date',
							y: 'totalVolume',
							fill: 'rgb(38, 128, 217)',
							tip: { fontSize: 14, fontFamily: 'monospace' }
						}),
						Plot.barY(plotData, {
							x: 'date',
							y: 'raindexVolume',
							fill: 'rgb(11, 38, 65)',
							tip: { fontSize: 14, fontFamily: 'monospace', dx: 20, dy: 20 }
						})
					],

					width: 1800,
					height: 500,
					inset: 10,
					aspectRatio: 1,
					x: {
						padding: 0.4,
						label: 'Date',
						labelAnchor: 'center'
					},
					y: {
						label: 'Volume',
						labelAnchor: 'center'
					}
				})
			);
		}
		{
			weeklyTrades?.firstChild?.remove();
			weeklyTrades?.append(
				Plot.plot({
					grid: true,
					figure: true,
					color: { legend: true },
					title: 'Weekly Trade Distribution',

					marks: [
						Plot.frame(),
						Plot.ruleY([0]),
						Plot.barY(
							plotData.filter((trade) => trade.timestamp > Date.now() / 1000 - 60 * 60 * 24 * 7),
							{
								x: 'date',
								y: 'totalTrades',
								fill: 'rgb(38, 128, 217)',
								tip: { fontSize: 14, fontFamily: 'monospace' }
							}
						),
						Plot.barY(
							plotData.filter((trade) => trade.timestamp > Date.now() / 1000 - 60 * 60 * 24 * 7),
							{
								x: 'date',
								y: 'raindexTrades',
								fill: 'rgb(11, 38, 65)',
								tip: { fontSize: 14, fontFamily: 'monospace', dx: 20, dy: 20 }
							}
						)
					],

					width: 900,
					height: 500,
					inset: 10,
					aspectRatio: 1,
					x: {
						padding: 0.4,
						label: 'Date',
						labelAnchor: 'center'
					},
					y: {
						label: 'Trades',
						labelAnchor: 'center'
					}
				})
			);
		}
		{
			weeklyVolume?.firstChild?.remove();
			weeklyVolume?.append(
				Plot.plot({
					grid: true,
					figure: true,
					color: { legend: true },
					title: 'Weekly Volume Distribution',

					marks: [
						Plot.frame(),
						Plot.ruleY([0]),
						Plot.barY(
							plotData.filter((trade) => trade.timestamp > Date.now() / 1000 - 60 * 60 * 24 * 7),
							{
								x: 'date',
								y: 'totalVolume',
								fill: 'rgb(38, 128, 217)',
								tip: { fontSize: 14, fontFamily: 'monospace' }
							}
						),
						Plot.barY(
							plotData.filter((trade) => trade.timestamp > Date.now() / 1000 - 60 * 60 * 24 * 7),
							{
								x: 'date',
								y: 'raindexVolume',
								fill: 'rgb(11, 38, 65)',
								tip: { fontSize: 14, fontFamily: 'monospace', dx: 20, dy: 20 }
							}
						)
					],

					width: 900,
					height: 500,
					inset: 10,
					aspectRatio: 1,
					x: {
						padding: 0.4,
						label: 'Date',
						labelAnchor: 'center'
					},
					y: {
						label: 'Volume',
						labelAnchor: 'center'
					}
				})
			);
		}
		{
			const weeklyTradesByPercentageData = plotData
				.filter((trade) => trade.timestamp > Date.now() / 1000 - 60 * 60 * 24 * 7)
				.map((trade) => ({
					date: trade.date,
					totalTradesPercentage: (trade.totalTrades / trade.totalTrades) * 100,
					raindexTradesPercentage: (trade.raindexTrades / trade.totalTrades) * 100
				}));

			weeklyTradesByPercentage?.firstChild?.remove();
			weeklyTradesByPercentage?.append(
				Plot.plot({
					grid: true,
					figure: true,
					color: { legend: true },
					title: 'Weekly Trade Distribution By Percentage',

					marks: [
						Plot.frame(),
						Plot.ruleY([0]),
						Plot.barY(weeklyTradesByPercentageData, {
							x: 'date',
							y: 'totalTradesPercentage',
							fill: 'rgb(38, 128, 217)',
							tip: { fontSize: 14, fontFamily: 'monospace' }
						}),
						Plot.barY(weeklyTradesByPercentageData, {
							x: 'date',
							y: 'raindexTradesPercentage',
							fill: 'rgb(11, 38, 65)',
							tip: { fontSize: 14, fontFamily: 'monospace', dx: 20, dy: 20 }
						})
					],

					width: 900,
					height: 500,
					inset: 10,
					aspectRatio: 1,
					x: {
						padding: 0.4,
						label: 'Date',
						labelAnchor: 'center'
					},
					y: {
						label: 'Trades',
						labelAnchor: 'center'
					}
				})
			);
		}
		{
			const weeklyVolumeByPercentageData = plotData
				.filter((trade) => trade.timestamp > Date.now() / 1000 - 60 * 60 * 24 * 7)
				.map((trade) => ({
					date: trade.date,
					totalVolumePercentage: (trade.totalVolume / trade.totalVolume) * 100,
					raindexVolumePercentage: (trade.raindexVolume / trade.totalVolume) * 100
				}));

			weeklyVolumeByPercentage?.firstChild?.remove();
			weeklyVolumeByPercentage?.append(
				Plot.plot({
					grid: true,
					figure: true,
					color: { legend: true },
					title: 'Weekly Volume Distribution By Percentage',

					marks: [
						Plot.frame(),
						Plot.ruleY([0]),
						Plot.barY(weeklyVolumeByPercentageData, {
							x: 'date',
							y: 'totalVolumePercentage',
							fill: 'rgb(38, 128, 217)',
							tip: { fontSize: 14, fontFamily: 'monospace' }
						}),
						Plot.barY(weeklyVolumeByPercentageData, {
							x: 'date',
							y: 'raindexVolumePercentage',
							fill: 'rgb(11, 38, 65)',
							tip: { fontSize: 14, fontFamily: 'monospace', dx: 20, dy: 20 }
						})
					],

					width: 900,
					height: 500,
					inset: 10,
					aspectRatio: 1,
					x: {
						padding: 0.4,
						label: 'Date',
						labelAnchor: 'center'
					},
					y: {
						label: 'Volume',
						labelAnchor: 'center'
					}
				})
			);
		}
		loading = false;
	}
	$: {
		fetchAndPlotData();
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
	): MarketAnalytics[] {
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

		return plotData;
	}
</script>

<div class="flex rounded-t-lg border-b border-gray-300 bg-gray-100">
	{#each ['Market Analytics', 'Order Analytics', 'Vault Analytics'] as tab}
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
				<div class="flex flex-row">
					<div class="m-2 w-1/2 rounded-lg shadow-lg" bind:this={weeklyTrades}></div>
					<div class="m-2 w-1/2 rounded-lg shadow-lg" bind:this={weeklyVolume}></div>
				</div>
				<div class="flex flex-row">
					<div class="m-2 w-1/2 rounded-lg shadow-lg" bind:this={weeklyTradesByPercentage}></div>
					<div class="m-2 w-1/2 rounded-lg shadow-lg" bind:this={weeklyVolumeByPercentage}></div>
				</div>
				<div bind:this={historicalTrades}></div>
				<div bind:this={historicalVolume}></div>
			</div>
		{/if}
	</div>
{/if}
