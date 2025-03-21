<script lang="ts">
	import type { SgTrade, MultiSubgraphArgs } from '@rainlanguage/orderbook/js_api';
	import {
		getOrders,
		getOrderTradesList,
		getOrderVaultsVolume
	} from '@rainlanguage/orderbook/js_api';
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
	import { tokenConfig, DEFAULT_TRADES_PAGE_SIZE, generateColorPalette } from '$lib/constants';
	import { ethers } from 'ethers';
	import { getTokenPriceUsd } from '$lib/price';

	const { tokenSlug, network, activeSubgraphs } = $page.data.stores;

	const tokenSymbol = tokenConfig[$tokenSlug.toUpperCase()]?.symbol;
	const tokenAddress = tokenConfig[$tokenSlug.toUpperCase()]?.address;
	const weekInSeconds = 60 * 60 * 24 * 7;
	const monthInSeconds = 60 * 60 * 24 * 30;
	const currentTimeInSeconds = new Date().getTime() / 1000;

	let activeTab = 'Market Analytics';
	let loading = true;
	let analyticsDataLoaded = false;
	let dataFetchInProgress = false;
	let marketData: MarketAnalyticsData;

	let raindexOrdersWithTrades: OrderListOrderWithSubgraphName[];
	let allTrades: LiquidityAnalysisResult;
	let vaultVolume: any;
	let currentTokenPrice: number

	let historicalTrades: HTMLElement;
	let historicalVolume: HTMLElement;
	let weeklyTrades: HTMLElement;
	let weeklyVolume: HTMLElement;
	let weeklyTradesByPercentage: HTMLElement;
	let weeklyVolumeByPercentage: HTMLElement;
	let totalTradesByType: HTMLElement;
	let totalVolumeByType: HTMLElement;
	let topOrdersByTradesCount: HTMLElement;
	let topOrdersByVolume: HTMLElement;
	let ordersAdderPerDay: HTMLElement;
	let tradesPerDay: HTMLElement;
	let uniqueOrderOwners: HTMLElement;
	let cumulativeOrders: HTMLElement;

	let topVaultsByBalance: HTMLElement;
	let topVaultsByVolume: HTMLElement;
	let tokenVaultBalances: HTMLElement;
	let tokenVaultBalancesUsd: HTMLElement;
	let vaultHealthMetrics: HTMLElement;

	async function fetchAndPlotData() {
		if (dataFetchInProgress) return;

		try {
			dataFetchInProgress = true;
			loading = true;
			raindexOrdersWithTrades = await fetchAllOrderWithTrades();
			allTrades = await analyzeLiquidity(
				$network,
				$tokenSlug.toUpperCase(),
				currentTimeInSeconds - monthInSeconds,
				currentTimeInSeconds
			);
			vaultVolume = await prepareVaultVolumeData(raindexOrdersWithTrades);
			const { currentPrice } = await getTokenPriceUsd(tokenAddress, tokenSymbol);
			currentTokenPrice = currentPrice;

			marketData = getTradesByDay(raindexOrdersWithTrades, allTrades.tradesAccordingToTimeStamp);
			analyticsDataLoaded = true;
			if (activeTab === 'Market Analytics') {
				renderMarketDataCharts(marketData);
				loading = false;
			} else if (activeTab === 'Order Analytics') {
				renderOrderDataCharts(raindexOrdersWithTrades, allTrades.tradesAccordingToTimeStamp);
				loading = false;
			} else if (activeTab === 'Vault Analytics') {
				renderVaultsAnalytics(raindexOrdersWithTrades,vaultVolume,currentTokenPrice);
				loading = false;
			}
		} finally {
			dataFetchInProgress = false;
		}
	}

	$: if (activeTab === 'Market Analytics') {
		if (!analyticsDataLoaded) {
			fetchAndPlotData();
		} else if (marketData) {
			setTimeout(() => renderMarketDataCharts(marketData), 0);
		}
	} else if (activeTab === 'Order Analytics') {
		if (!analyticsDataLoaded) {
			fetchAndPlotData();
		} else {
			setTimeout(
				() => renderOrderDataCharts(raindexOrdersWithTrades, allTrades.tradesAccordingToTimeStamp),
				0
			);
		}
	} else if (activeTab === 'Vault Analytics') {
		if (!analyticsDataLoaded) {
			fetchAndPlotData();
		} else {
			setTimeout(() => renderVaultsAnalytics(raindexOrdersWithTrades,vaultVolume,currentTokenPrice), 0);
		}
	}

	function setDefaultHtml(element: HTMLElement): HTMLElement {
		element.innerHTML = `
			<div class="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
				<p class="text-lg font-medium text-gray-600">No data available</p>
			</div>
		`;
		return element;
	}

	function renderOrderDataCharts(
		raindexOrdersWithTrades: OrderListOrderWithSubgraphName[],
		allTrades: TradesByTimeStamp[]
	) {
		function prepareTopOrdersByTradeCount(
			raindexOrdersWithTrades: OrderListOrderWithSubgraphName[]
		): { orderHash: string; tradeCount: number; percentage: string }[] {
			try {
				const tradeCounts: { [key: string]: number } = {};
				let totalTrades = 0;

				for (const order of raindexOrdersWithTrades) {
					const { orderHash } = order.order;
					if (!tradeCounts[orderHash]) {
						tradeCounts[orderHash] = 0;
					}
					tradeCounts[orderHash] += order.order.trades.length;
					totalTrades += order.order.trades.length;
				}

				const groupedTrades: { orderHash: string; tradeCount: number; percentage: string }[] =
					Object.entries(tradeCounts).map(([orderHash, tradeCount]) => ({
						orderHash: `${orderHash.slice(0, 5)}...${orderHash.slice(-5)}`,
						tradeCount,
						percentage: ((tradeCount / totalTrades) * 100).toFixed(2)
					}));

				const sortedEntries = groupedTrades.sort((a, b) => b.tradeCount - a.tradeCount);

				const top5Orders = sortedEntries.slice(0, 5);
				const othersTradeCount = sortedEntries
					.slice(5)
					.reduce((sum, entry) => sum + entry.tradeCount, 0);

				top5Orders.push({
					orderHash: 'Others',
					tradeCount: othersTradeCount,
					percentage: ((othersTradeCount / totalTrades) * 100).toFixed(2)
				});

				return top5Orders;
			} catch {
				return [];
			}
		}

		function prepareTopOrdersByVolume(
			raindexOrdersWithTrades: OrderListOrderWithSubgraphName[],
			allTrades: TradesByTimeStamp[]
		) {
			try {
				const tradeMap = allTrades.reduce(
					(map: { [key: string]: { amountInTokens: number; amountInUsd: number } }, trade) => {
						map[trade.transactionHash] = {
							amountInTokens: trade.amountInTokens || 0,
							amountInUsd: trade.amountInUsd || 0
						};
						return map;
					},
					{}
				);

				const allRaindexTrades = raindexOrdersWithTrades.flatMap((order) => order.order.trades);

				const orderVolumes: { [orderHash: string]: { totalTokens: number; totalUsd: number } } = {};

				for (const raindexTrade of allRaindexTrades) {
					const orderHash = raindexTrade.order.orderHash;
					const tradeDetails = tradeMap[raindexTrade.tradeEvent.transaction.id];

					if (!tradeDetails) continue;

					if (!orderVolumes[orderHash]) {
						orderVolumes[orderHash] = { totalTokens: 0, totalUsd: 0 };
					}

					orderVolumes[orderHash].totalTokens += tradeDetails.amountInTokens;
					orderVolumes[orderHash].totalUsd += tradeDetails.amountInUsd;
				}

				const totalVolumeUsd = Object.values(orderVolumes).reduce(
					(sum, { totalUsd }) => sum + totalUsd,
					0
				);

				if (totalVolumeUsd === 0) return []; // Avoid division by zero

				const sortedOrders = Object.entries(orderVolumes)
					.map(([orderHash, { totalUsd }]) => ({
						orderHash,
						volume: totalUsd,
						percentage: (totalUsd / totalVolumeUsd) * 100
					}))
					.sort((a, b) => b.volume - a.volume);

				const top5Orders = sortedOrders.slice(0, 5).map((order) => ({
					orderHash: `${order.orderHash.slice(0, 5)}...${order.orderHash.slice(-5)}`,
					volume: order.volume,
					percentage: order.percentage
				}));

				if (sortedOrders.length > 5) {
					const othersVolume = sortedOrders.slice(5).reduce((sum, order) => sum + order.volume, 0);
					const othersPercentage = (othersVolume / totalVolumeUsd) * 100;

					if (othersVolume > 0) {
						top5Orders.push({
							orderHash: 'Others',
							volume: othersVolume,
							percentage: othersPercentage
						});
					}
				}

				return top5Orders;
			} catch {
				return [];
			}
		}

		function prepareOrdersAdderPerDay(raindexOrdersWithTrades: OrderListOrderWithSubgraphName[]) {
			try {
				const fromTimestamp = currentTimeInSeconds - monthInSeconds;
				const toTimestamp = currentTimeInSeconds;

				const ordersPerDay: { [key: string]: { ordersCount: number; tradesCount: number } } = {};

				// Initialize dates with 0 orders for the entire range
				for (
					let d = new Date(fromTimestamp * 1000);
					d <= new Date(toTimestamp * 1000);
					d.setDate(d.getDate() + 1)
				) {
					const dateStr = new Date(d).toISOString().split('T')[0];
					ordersPerDay[dateStr] = {
						ordersCount: 0,
						tradesCount: 0
					};
				}

				// Filter orders within the date range and count them
				raindexOrdersWithTrades
					.filter(
						(order) =>
							parseFloat(order.order.timestampAdded) >= fromTimestamp &&
							parseFloat(order.order.timestampAdded) <= toTimestamp
					)
					.forEach((order) => {
						const date = new Date(parseFloat(order.order.timestampAdded) * 1000)
							.toISOString()
							.split('T')[0];
						ordersPerDay[date].ordersCount += 1;
					});

				raindexOrdersWithTrades
					.flatMap((order) => order.order.trades)
					.filter(
						(trade) =>
							parseFloat(trade.tradeEvent.transaction.timestamp) >= fromTimestamp &&
							parseFloat(trade.tradeEvent.transaction.timestamp) <= toTimestamp
					)
					.forEach((trade) => {
						const date = new Date(parseFloat(trade.tradeEvent.transaction.timestamp) * 1000)
							.toISOString()
							.split('T')[0];
						ordersPerDay[date].tradesCount += 1;
					});

				return Object.entries(ordersPerDay).map(([date, count]) => ({
					date,
					ordersCount: count.ordersCount,
					tradesCount: count.tradesCount
				}));
			} catch {
				return [];
			}
		}

		function prepareUniqueOrderOwners(raindexOrdersWithTrades: OrderListOrderWithSubgraphName[]) {
			try {
				const fromTimestamp = currentTimeInSeconds - monthInSeconds;
				const toTimestamp = currentTimeInSeconds;
				const dailyOwners: { [key: string]: Set<string> } = {};

				// Initialize dates with 0 orders for the entire range
				for (
					let d = new Date(fromTimestamp * 1000);
					d <= new Date(toTimestamp * 1000);
					d.setDate(d.getDate() + 1)
				) {
					const dateStr = new Date(d).toISOString().split('T')[0];
					dailyOwners[dateStr] = new Set();
				}

				for (const order of raindexOrdersWithTrades) {
					const orderAddedDate = new Date(parseFloat(order.order.timestampAdded) * 1000)
						.toISOString()
						.split('T')[0];
					const orderRemovedDate =
						order.order.removeEvents.length > 0
							? new Date(parseFloat(order.order.removeEvents[0].transaction.timestamp) * 1000)
									.toISOString()
									.split('T')[0]
							: null;

					if (
						parseFloat(order.order.timestampAdded) >= fromTimestamp &&
						parseFloat(order.order.timestampAdded) <= toTimestamp
					) {
						for (
							let d = new Date(orderAddedDate);
							d <= new Date(toTimestamp * 1000);
							d.setDate(d.getDate() + 1)
						) {
							const dateStr = new Date(d).toISOString().split('T')[0];
							if (orderRemovedDate && dateStr > orderRemovedDate) break;
							dailyOwners[dateStr].add(order.order.owner);
						}
					}
				}

				return Object.entries(dailyOwners).map(([date, owners]) => ({
					date,
					uniqueOrderOwners: owners.size
				}));
			} catch {
				return [];
			}
		}

		function prepareCummulativeOrdersData(
			raindexOrdersWithTrades: OrderListOrderWithSubgraphName[]
		) {
			try {
				const timeline = [];
				for (const order of raindexOrdersWithTrades) {
					const addedDate = new Date(parseFloat(order.order.timestampAdded) * 1000)
						.toISOString()
						.split('T')[0];
					timeline.push({ date: addedDate, activeChange: 1, inactiveChange: 0 });
					if (order.order.removeEvents.length > 0) {
						const removedDate = new Date(
							parseFloat(order.order.removeEvents[0].transaction.timestamp) * 1000
						)
							.toISOString()
							.split('T')[0];
						timeline.push({ date: removedDate, activeChange: -1, inactiveChange: 1 });
					}
				}

				const aggregated = timeline.reduce(
					(acc: { [key: string]: { date: string; active: number; inactive: number } }, curr) => {
						if (!acc[curr.date]) {
							acc[curr.date] = { date: curr.date, active: 0, inactive: 0 };
						}
						acc[curr.date].active += curr.activeChange;
						acc[curr.date].inactive += curr.inactiveChange;
						return acc;
					},
					{}
				);

				const sortedDates = Object.keys(aggregated).sort();
				let cumulativeActive = 0;
				let cumulativeInactive = 0;

				return sortedDates.map((date) => {
					cumulativeActive += aggregated[date].active;
					cumulativeInactive += aggregated[date].inactive;

					return {
						date,
						active: cumulativeActive,
						inactive: cumulativeInactive
					};
				});
			} catch {
				return [];
			}
		}

		if (!topOrdersByTradesCount) return;
		const top5OrdersByTrades = prepareTopOrdersByTradeCount(raindexOrdersWithTrades);

		// Render top orders by trades
		if (top5OrdersByTrades.length > 0) {
			createBarChart(topOrdersByTradesCount, top5OrdersByTrades, {
				title: 'Trade Count by Order',
				chartType: 'bar',
				xField: 'orderHash',
				yField: 'tradeCount',
				xLabel: 'Order Hash',
				yLabel: 'Number of Trades',
				width: 900,
				height: 500,
				colorDomain: top5OrdersByTrades.map((order) => order.orderHash),
				colorRange: generateColorPalette(top5OrdersByTrades.length)
			});
		} else {
			topOrdersByTradesCount = setDefaultHtml(topOrdersByTradesCount);
		}

		const top5OrdersByVolume = prepareTopOrdersByVolume(raindexOrdersWithTrades, allTrades);
		if (top5OrdersByVolume.length > 0) {
			createBarChart(topOrdersByVolume, top5OrdersByVolume, {
				title: 'Volume by Order',
				chartType: 'bar',
				xField: 'orderHash',
				yField: 'volume',
				xLabel: 'Order Hash',
				yLabel: 'Volume',
				width: 900,
				height: 500,
				colorDomain: top5OrdersByVolume.map((order) => order.orderHash),
				colorRange: generateColorPalette(top5OrdersByVolume.length),
				tickPrefix: '$'
			});
		} else {
			topOrdersByVolume = setDefaultHtml(topOrdersByVolume);
		}

		const ordersAdderPerDayData = prepareOrdersAdderPerDay(raindexOrdersWithTrades);
		if (ordersAdderPerDayData.length > 0) {
			createLineChart(ordersAdderPerDay, ordersAdderPerDayData, {
				title: 'Orders Added Per Day',
				xField: 'date',
				yField: 'ordersCount',
				xLabel: 'Date',
				xLabelRotate: 45,
				yLabel: 'Orders Added',
				lineColor: 'rgb(38, 128, 217)',
				formatYTicks: false
			});
			createLineChart(tradesPerDay, ordersAdderPerDayData, {
				title: 'Trades Per Day',
				xField: 'date',
				yField: 'tradesCount',
				xLabel: 'Date',
				xLabelRotate: 45,
				yLabel: 'Trades',
				lineColor: 'rgb(38, 128, 217)',
				formatYTicks: false
			});
		} else {
			ordersAdderPerDay = setDefaultHtml(ordersAdderPerDay);
			tradesPerDay = setDefaultHtml(tradesPerDay);
		}

		const uniqueOrderOwnersData = prepareUniqueOrderOwners(raindexOrdersWithTrades);
		if (uniqueOrderOwnersData.length > 0) {
			createLineChart(uniqueOrderOwners, uniqueOrderOwnersData, {
				title: 'Unique Order Owners',
				xField: 'date',
				yField: 'uniqueOrderOwners',
				xLabel: 'Date',
				xLabelRotate: 45,
				yLabel: 'Unique Order Owners',
				lineColor: 'rgb(38, 128, 217)',
				formatYTicks: false,
				integerTicks: true
			});
		} else {
			uniqueOrderOwners = setDefaultHtml(uniqueOrderOwners);
		}
		const cummulativeOrdersData = prepareCummulativeOrdersData(raindexOrdersWithTrades);

		if (cummulativeOrdersData.length > 0) {
			createAreaChart(cumulativeOrders, cummulativeOrdersData, {
				title: 'Cummulative Orders',
				xField: 'date',
				stackFields: ['inactive', 'active'],
				yLabel: 'Orders Count',
				colors: ['rgb(86, 97, 111)', 'rgb(38, 128, 217)'],
				width: 900,
				height: 500,
				integerTicks: true
			});
		} else {
			cumulativeOrders = setDefaultHtml(cumulativeOrders);
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
						input.token.address.toLowerCase() === tokenAddress.toLowerCase()
				) ||
				order.order.outputs.some(
					(output: OrderListVault) =>
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

	async function prepareVaultVolumeData(
		raindexOrdersWithTrades: OrderListOrderWithSubgraphName[]
	) {
		const vaultVolumes = [];
		for (const order of raindexOrdersWithTrades) {
			const orderVaultsVolume = await getOrderVaultsVolume(
				$activeSubgraphs.find((subgraph: MultiSubgraphArgs) => subgraph.name === $network)?.url ||
					'',
				order.order.id
			);
			for (const vaultVolume of orderVaultsVolume.filter(
				(vaultVolume: any) => vaultVolume.token.address === tokenAddress
			)) {
				vaultVolumes.push({
					orderId: order.order.id,
					vaultId: ethers.BigNumber.from(vaultVolume.id).toHexString(),
					volume: parseFloat(
						ethers.utils.formatUnits(vaultVolume.volDetails.totalVol, vaultVolume.token.decimals)
					)
				});
			}
		}

		// Aggregate volumes by vault ID
		const vaultVolumeMap = vaultVolumes.reduce(
			(
				acc: { [vaultId: string]: { vaultId: string; name: string; volume: number } },
				curr: { orderId: string; vaultId: string; volume: number }
			) => {
				const vaultId = curr.vaultId;
				if (!acc[vaultId]) {
					acc[vaultId] = {
						vaultId: vaultId,
						name: `Vault ${vaultId.slice(0, 6)}...`,
						volume: Number(curr.volume)
					};
				}
				acc[vaultId].volume += Number(curr.volume);
				return acc;
			},
			{}
		);

		// Convert to array and sort by volume
		return Object.values(vaultVolumeMap).sort((a: any, b: any) => b.volume - a.volume);
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

	function renderMarketDataCharts(data: MarketAnalyticsData) {
		const {
			plotData,
			totalRaindexTrades,
			totalExternalTrades,
			totalRaindexVolume,
			totalExternalVolume
		} = data;

		createBarChart(historicalTrades, plotData, {
			title: 'Historical Trade Distribution',
			chartType: 'weekly',
			yField: 'totalTrades',
			secondaryYField: 'raindexTrades',
			yLabel: 'Trades',
			width: 1800,
			height: 500,
			filterFn: () => true,
			tickPrefix: ''
		});

		createBarChart(historicalVolume, plotData, {
			title: 'Historical Volume Distribution',
			chartType: 'weekly',
			yField: 'totalVolume',
			secondaryYField: 'raindexVolume',
			yLabel: 'Volume',
			width: 1800,
			height: 500,
			filterFn: () => true,
			formatYTicks: true,
			tickPrefix: '$'
		});

		createBarChart(weeklyTrades, plotData, {
			title: 'Weekly Trade Distribution',
			chartType: 'weekly',
			yField: 'totalTrades',
			secondaryYField: 'raindexTrades',
			yLabel: 'Trades',
			tickPrefix: ''
		});

		createBarChart(weeklyVolume, plotData, {
			title: 'Weekly Volume Distribution',
			chartType: 'weekly',
			yField: 'totalVolume',
			secondaryYField: 'raindexVolume',
			yLabel: 'Volume',
			formatYTicks: true,
			tickPrefix: '$'
		});

		const weeklyTradesByPercentageData = plotData
			.filter((trade: MarketAnalytics) => trade.timestamp > Date.now() / 1000 - weekInSeconds)
			.map((trade: MarketAnalytics) => ({
				date: trade.date,
				totalTradesPercentage: (trade.totalTrades / trade.totalTrades) * 100,
				raindexTradesPercentage: (trade.raindexTrades / trade.totalTrades) * 100
			}));

		createBarChart(weeklyTradesByPercentage, weeklyTradesByPercentageData, {
			title: 'Weekly Trade Distribution By Percentage',
			chartType: 'weekly',
			yField: 'totalTradesPercentage',
			secondaryYField: 'raindexTradesPercentage',
			yLabel: 'Trades',
			filterFn: () => true,
			tickSuffix: '%'
		});

		const weeklyVolumeByPercentageData = plotData
			.filter((trade: MarketAnalytics) => trade.timestamp > Date.now() / 1000 - weekInSeconds)
			.map((trade: MarketAnalytics) => ({
				date: trade.date,
				totalVolumePercentage: (trade.totalVolume / trade.totalVolume) * 100,
				raindexVolumePercentage: (trade.raindexVolume / trade.totalVolume) * 100
			}));

		createBarChart(weeklyVolumeByPercentage, weeklyVolumeByPercentageData, {
			title: 'Weekly Volume Distribution By Percentage',
			chartType: 'weekly',
			yField: 'totalVolumePercentage',
			secondaryYField: 'raindexVolumePercentage',
			yLabel: 'Volume',
			filterFn: () => true,
			tickSuffix: '%'
		});

		createBarChart(
			totalTradesByType,
			[
				{ type: 'Raindex', value: totalRaindexTrades },
				{ type: 'Total', value: totalExternalTrades + totalRaindexTrades }
			],
			{
				title: 'Total Trades by Type',
				chartType: 'bar',
				yField: 'value',
				yLabel: 'Trades',
				tickPrefix: ''
			}
		);

		createBarChart(
			totalVolumeByType,
			[
				{ type: 'Raindex', value: totalRaindexVolume },
				{ type: 'Total', value: totalExternalVolume + totalRaindexVolume }
			],
			{
				title: 'Total Volume by Type',
				chartType: 'bar',
				yField: 'value',
				yLabel: 'Volume',
				formatYTicks: true,
				tickPrefix: '$'
			}
		);
	}

	function renderVaultsAnalytics(raindexOrdersWithTrades: OrderListOrderWithSubgraphName[],vaultVolumeData: any[],currentTokenPrice: number) {
		
		function prepareVaultBalanceData(raindexOrdersWithTrades: OrderListOrderWithSubgraphName[]) {
			// Create a more comprehensive data structure for vault analysis
			const vaultData: {
				[vaultId: string]: {
					name: string;
					tokenSymbol: string;
					tokenAddress: string;
					tokenDecimals: number;
					balance: number;
					orderCount: number;
					lastUpdated: number;
					isInput: boolean;
					isOutput: boolean;
				};
			} = {};

			// Process all orders to collect vault data
			raindexOrdersWithTrades.forEach((order) => {
				// Process input vaults
				order.order.inputs.forEach((entry) => {
					processVaultEntry(entry, true, false, order.order.timestampAdded);
				});

				// Process output vaults
				order.order.outputs.forEach((entry) => {
					processVaultEntry(entry, false, true, order.order.timestampAdded);
				});
			});

			function processVaultEntry(
				entry: OrderListVault,
				isInput: boolean,
				isOutput: boolean,
				timestamp: string
			) {
				const vaultId = entry.id;
				const balance = parseFloat(ethers.utils.formatUnits(entry.balance, entry.token.decimals));

				if (!vaultData[vaultId]) {
					vaultData[vaultId] = {
						name: `Vault ${entry.vaultId.slice(0, 6)}...`,
						tokenSymbol: entry.token.symbol || '',
						tokenAddress: entry.token.address,
						tokenDecimals: Number(entry.token.decimals),
						balance: 0,
						orderCount: 0,
						lastUpdated: 0,
						isInput: false,
						isOutput: false
					};
				}

				// Update vault data
				vaultData[vaultId].balance = balance; // Use the most recent balance
				vaultData[vaultId].orderCount += 1;
				vaultData[vaultId].isInput = vaultData[vaultId].isInput || isInput;
				vaultData[vaultId].isOutput = vaultData[vaultId].isOutput || isOutput;

				// Track the most recent update
				const entryTimestamp = parseFloat(timestamp);
				if (entryTimestamp > vaultData[vaultId].lastUpdated) {
					vaultData[vaultId].lastUpdated = entryTimestamp;
				}
			}

			// Convert to array and add additional metrics
			const vaultsArray = Object.values(vaultData).map((vault) => ({
				...vault,
				vaultType: getVaultType(vault.isInput, vault.isOutput),
				lastUpdatedDate: new Date(vault.lastUpdated * 1000).toISOString().split('T')[0],
				formattedBalance: formatBalance(vault.balance)
			}));

			// Sort by balance in descending order
			const sortedVaults = vaultsArray.sort((a, b) => b.balance - a.balance);

			return {
				allVaults: sortedVaults
			};
		}

		function prepareTopVaultBalancesWithOthers(vaults: any[]) {
			if (!vaults || vaults.length === 0) return [];

			// Calculate total balance for all vaults
			const totalBalance = vaults.reduce((sum, vault) => sum + vault.balance, 0);

			// Get top 5 vaults
			const top5 = vaults.slice(0, 5).map((vault) => ({
				...vault,
				percentage: ((vault.balance / totalBalance) * 100).toFixed(2)
			}));

			// Calculate "Others" if there are more than 5 vaults
			if (vaults.length > 5) {
				const othersBalance = vaults.slice(5).reduce((sum, vault) => sum + vault.balance, 0);

				if (othersBalance > 0) {
					top5.push({
						name: 'Others',
						balance: othersBalance,
						orderCount: vaults.slice(5).reduce((sum, vault) => sum + vault.orderCount, 0),
						formattedBalance: formatBalance(othersBalance),
						percentage: ((othersBalance / totalBalance) * 100).toFixed(2)
					});
				}
			}

			return top5;
		}

		function prepareTopVaultsByVolumeWithOthers(vaults: any[]) {
			if (!vaults || vaults.length === 0) return [];

			// Calculate total volume for all vaults
			const totalVolume = vaults.reduce((sum, vault) => sum + vault.volume, 0);

			// Get top 5 vaults
			const top5 = vaults.slice(0, 5).map((vault) => ({
				...vault,
				formattedVolume: formatBalance(vault.volume),
				percentage: ((vault.volume / totalVolume) * 100).toFixed(2)
			}));

			// Calculate "Others" if there are more than 5 vaults
			if (vaults.length > 5) {
				const othersVolume = vaults.slice(5).reduce((sum, vault) => sum + vault.volume, 0);

				// Always add the "Others" category, even if volume is 0
				top5.push({
					name: 'Others',
					volume: othersVolume,
					formattedVolume: formatBalance(othersVolume),
					percentage: ((othersVolume / totalVolume) * 100).toFixed(2)
				});
			}

			return top5;
		}

		function prepareTokenVaultBalances(
			raindexOrdersWithTrades: OrderListOrderWithSubgraphName[]
		) {
			const allTokens = raindexOrdersWithTrades.flatMap((order) =>
				[...order.order.outputs, ...order.order.inputs].map((item) => item.token)
			);
			const uniqueTokensMap = new Map<
				string,
				{
					address: string;
					symbol: string;
					decimals: number;
					totalVaults: number;
					totalTokenBalance: number;
					totalTokenBalanceUsd: number;
				}
			>();

			allTokens.forEach((token) => {
				if (!uniqueTokensMap.has(token.address)) {
					uniqueTokensMap.set(token.address, {
						address: token.address,
						symbol: token.symbol || '',
						decimals: Number(token.decimals),
						totalVaults: 0,
						totalTokenBalance: 0,
						totalTokenBalanceUsd: 0
					});
				}
			});

			for (const uniqueToken of Array.from(uniqueTokensMap.values())) {
				const { decimals: tokenDecimals, address: tokenAddress } = uniqueToken;
				
				const uniqueEntries = new Set<string>();

				const totalInputsVaults = raindexOrdersWithTrades
					.flatMap((order) => order.order.inputs)
					.filter((input) => input.token.address === tokenAddress);

				const totalOutputsVaults = raindexOrdersWithTrades
					.flatMap((order) => order.order.outputs)
					.filter((output) => output.token.address === tokenAddress);

				const totalInputs = totalInputsVaults.reduce((sum, input) => {
					const uniqueKey = input.id;
					uniqueEntries.add(uniqueKey); // Track all inputs
					return sum.add(ethers.BigNumber.from(input.balance));
				}, ethers.BigNumber.from(0));

				const totalOutputs = totalOutputsVaults.reduce((sum, output) => {
					const uniqueKey = output.id;
					if (!uniqueEntries.has(uniqueKey)) {
						// Only add if it's not already counted in inputs
						uniqueEntries.add(uniqueKey);
						return sum.add(ethers.BigNumber.from(output.balance));
					}
					return sum; // Skip duplicates
				}, ethers.BigNumber.from(0));
				const totalTokens = ethers.utils.formatUnits(totalInputs.add(totalOutputs), tokenDecimals);
				const totalVaults = uniqueEntries.size;
				const totalValueUsd = parseFloat(totalTokens) * currentTokenPrice;

				if (uniqueTokensMap.has(tokenAddress)) {
					const tokenData = uniqueTokensMap.get(tokenAddress)!;
					tokenData.totalVaults = totalVaults;
					tokenData.totalTokenBalance = parseFloat(totalTokens);
					tokenData.totalTokenBalanceUsd = totalValueUsd;
				}
			}

			return Array.from(uniqueTokensMap.values()).sort(
				(a, b) => b.totalTokenBalanceUsd - a.totalTokenBalanceUsd
			);
		}
		
		function getVaultType(isInput: boolean, isOutput: boolean): string {
			if (isInput && isOutput) return 'Both';
			if (isInput) return 'Input';
			if (isOutput) return 'Output';
			return 'Unknown';
		}

		const allVaults = prepareVaultBalanceData(raindexOrdersWithTrades).allVaults;
		const topVaultsWithOthers = prepareTopVaultBalancesWithOthers(allVaults);
		const topVaultsByVolumeData = prepareTopVaultsByVolumeWithOthers(vaultVolumeData);
		const tokenVaultBalancesArray = prepareTokenVaultBalances(raindexOrdersWithTrades);

		const activeRatio = (
			(topVaultsWithOthers.reduce((acc, vault) => {
				return acc + vault.balance;
			}, 0) /
				topVaultsByVolumeData.reduce((acc, vault) => acc + vault.volume, 0)) *
			100
		).toFixed(2);

		createBarChart(topVaultsByBalance, topVaultsWithOthers, {
			title: 'Top Vaults by Balance',
			chartType: 'bar',
			yField: 'balance',
			xField: 'name',
			yLabel: 'Balance',
			width: 900,
			height: 500,
			filterFn: () => true,
			colorDomain: topVaultsWithOthers.map((vault) => vault.name),
			colorRange: generateColorPalette(topVaultsWithOthers.length)
		});

		createBarChart(topVaultsByVolume, topVaultsByVolumeData, {
			title: 'Top Vaults by Volume',
			chartType: 'bar',
			yField: 'volume',
			xField: 'name',
			yLabel: 'Volume',
			width: 900,
			height: 500,
			filterFn: () => true,

			colorDomain: topVaultsByVolumeData.map((vault) => vault.name),
			colorRange: generateColorPalette(topVaultsByVolumeData.length)
		});

		createBarChart(tokenVaultBalances, tokenVaultBalancesArray, {
			title: 'Top Tokens by Balance',
			chartType: 'bar',
			yField: 'totalTokenBalance',
			xField: 'symbol',
			yLabel: 'Balance',
			width: 900,
			height: 500,
			filterFn: () => true,
			colorDomain: tokenVaultBalancesArray.map((vault) => vault.symbol),
			colorRange: generateColorPalette(tokenVaultBalancesArray.length)
		});

		createBarChart(tokenVaultBalancesUsd, tokenVaultBalancesArray, {
			title: 'Top Tokens by Balance in USD',
			chartType: 'bar',
			yField: 'totalTokenBalanceUsd',
			xField: 'symbol',
			yLabel: 'Balance in USD',
			width: 900,
			height: 500,
			filterFn: () => true,
			tickPrefix: '$',
			colorDomain: tokenVaultBalancesArray.map((vault) => vault.symbol),
			colorRange: generateColorPalette(tokenVaultBalancesArray.length)
		});

		createVaultHealthMetrics(vaultHealthMetrics, {
			totalOrders: raindexOrdersWithTrades.length,
			totalTokenBalance: tokenVaultBalancesArray.filter(
				(vault) => vault.address === tokenAddress
			)[0].totalTokenBalance,
			totalTokenBalanceUsd: tokenVaultBalancesArray.filter(
				(vault) => vault.address === tokenAddress
			)[0].totalTokenBalanceUsd,
			activeRatio: parseFloat(activeRatio)
		});
	}

	function formatBalance(balance: number): string {
		if (balance >= 1_000_000) return `${(balance / 1_000_000).toFixed(2)}M`;
		if (balance >= 1_000) return `${(balance / 1_000).toFixed(2)}K`;
		return balance.toFixed(2);
	}

	function createBarChart(
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
			tickPrefix?: string;
			tickSuffix?: string;
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
			colorDomain = ['Total', 'Raindex'],
			colorRange = ['rgb(38, 128, 217)', 'rgb(11, 38, 65)'],
			filterFn = chartType === 'weekly'
				? (item) => item.timestamp > Date.now() / 1000 - weekInSeconds
				: () => true,
			formatYTicks = chartType === 'bar',
			tickPrefix = '',
			tickSuffix = ''
		} = options;

		// Filter data if needed (for weekly charts)
		const filteredData = filterFn ? data.filter(filterFn) : data;

		// Format function for y-axis ticks
		const formatTickValue = (d: number, prefix = '', suffix = '') => {
			if (!formatYTicks) return prefix + d.toString() + suffix;
			const absD = Math.abs(d);
			if (absD >= 1e9) return prefix + (d / 1e9).toFixed(1) + 'B' + suffix;
			if (absD >= 1e6) return prefix + (d / 1e6).toFixed(1) + 'M' + suffix;
			if (absD >= 1e3) return prefix + (d / 1e3).toFixed(1) + 'K' + suffix;
			return prefix + d.toString() + suffix;
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
				labelAnchor: 'right',
				labelArrow: true,
				tickPadding: 5
			},
			y: {
				padding: 0.5,
				labelOffset: chartType === 'bar' ? 70 : undefined,
				label: yLabel,
				labelAnchor: 'top',
				tickFormat: (d: number) => formatTickValue(d, tickPrefix, tickSuffix),
				tickPadding: 5
			},
			marginLeft: 70,
			marginBottom: chartType === 'weekly' ? 60 : undefined
		});
		element.appendChild(plot);
	}

	function createVaultHealthMetrics(
		element: HTMLElement,
		data: {
			totalOrders: number;
			totalTokenBalance: number;
			totalTokenBalanceUsd: number;
			activeRatio: number;
		}
	) {
		if (!element) return;

		const formatNumber = (num: number): string => {
			if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
			if (num >= 1_000) return `${(num / 1_000).toFixed(2)}k`;
			return num.toFixed(2);
		};

		// Clear existing content
		while (element.firstChild) {
			element.removeChild(element.firstChild);
		}
		// Create container
		const container = document.createElement('div');
		container.className = 'bg-white rounded-lg shadow-md p-4 mb-6';

		// Add title
		const title = document.createElement('h2');
		title.className = 'text-center text-lg font-semibold mb-4 text-gray-800';
		title.textContent = 'Vault Health Metrics';
		container.appendChild(title);

		// Create metrics grid
		const grid = document.createElement('div');
		grid.className = 'grid grid-cols-2 gap-4';

		// Total Orders
		const ordersCard = document.createElement('div');
		ordersCard.className = 'bg-blue-50 rounded-lg p-4';
		ordersCard.innerHTML = `
			<div class="text-center">
			<div class="text-sm font-medium text-gray-600 mb-1">Total Orders</div>
			<div class="text-2xl font-bold text-blue-600">${data.totalOrders}</div>
			</div>
		`;

		// Total Tokens
		const tokensCard = document.createElement('div');
		tokensCard.className = 'bg-green-50 rounded-lg p-4';
		tokensCard.innerHTML = `
			<div class="text-center">
			<div class="text-sm font-medium text-gray-600 mb-1">Total Token Balance ${tokenSymbol}</div>
			<div class="text-2xl font-bold text-green-600">${formatNumber(data.totalTokenBalance)}</div>
			</div>
		`;

		// Total Value
		const valueCard = document.createElement('div');
		valueCard.className = 'bg-purple-50 rounded-lg p-4';
		valueCard.innerHTML = `
			<div class="text-center">
			<div class="text-sm font-medium text-gray-600 mb-1">Total Token Balance in USD</div>
			<div class="text-2xl font-bold text-purple-600">$${formatNumber(data.totalTokenBalanceUsd)}</div>
			</div>
		`;

		// Active Ratio
		const ratioCard = document.createElement('div');
		ratioCard.className = 'bg-blue-50 rounded-lg p-4';
		ratioCard.innerHTML = `
			<div class="text-center">
			<div class="text-sm font-medium text-gray-600 mb-1">Active Ratio</div>
			<div class="text-2xl font-bold text-blue-600">${data.activeRatio.toFixed(2)}%</div>
			</div>
		`;

		// Add cards to grid
		grid.appendChild(ordersCard);
		grid.appendChild(tokensCard);
		grid.appendChild(valueCard);
		grid.appendChild(ratioCard);

		// Add grid to container
		container.appendChild(grid);

		// Add container to element
		element.appendChild(container);

		return element;
	}

	function createLineChart(
		element: HTMLElement,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		data: any[],
		options: {
			title: string;
			xField?: string;
			yField?: string;
			xLabel?: string;
			yLabel?: string;
			xLabelRotate?: number;
			yLabelRotate?: number;
			width?: number;
			height?: number;
			lineColor?: string;
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			filterFn?: (item: any) => boolean;
			formatYTicks?: boolean;
			tickPrefix?: string;
			tickSuffix?: string;
			domainMin?: number;
			integerTicks?: boolean;
		}
	) {
		if (!element) return; // Skip if element doesn't exist

		const {
			title,
			xField = 'date',
			yField = 'ordersCount',
			xLabel = 'Date',
			yLabel = 'Value',
			xLabelRotate = 0,
			yLabelRotate = 0,
			width = 900,
			height = 500,
			lineColor = 'rgb(38, 128, 217)',
			filterFn = () => true,
			formatYTicks = false,
			tickPrefix = '',
			tickSuffix = '',
			domainMin = 0,
			integerTicks = false
		} = options;

		// Filter data if needed
		const filteredData = filterFn ? data.filter(filterFn) : data;

		// Format function for y-axis ticks
		const formatTickValue = (d: number, prefix = '', suffix = '') => {
			if (!formatYTicks) return prefix + d.toString() + suffix;
			const absD = Math.abs(d);
			if (absD >= 1e9) return prefix + (d / 1e9).toFixed(1) + 'B' + suffix;
			if (absD >= 1e6) return prefix + (d / 1e6).toFixed(1) + 'M' + suffix;
			if (absD >= 1e3) return prefix + (d / 1e3).toFixed(1) + 'K' + suffix;
			return prefix + d.toString() + suffix;
		};

		// Remove any existing chart
		while (element.firstChild) {
			element.removeChild(element.firstChild);
		}

		const plot = Plot.plot({
			grid: true,
			figure: true,
			title: title,
			style: {
				padding: '10px',
				marginTop: '5px',
				marginBottom: '10px',
				borderRadius: '8px',
				fontSize: '14px'
			},
			marks: [
				Plot.lineY(filteredData, { x: xField, y: yField, stroke: lineColor, strokeWidth: 2 }),
				Plot.dot(filteredData, { x: xField, y: yField, fill: lineColor, r: 3, tip: true }),
				Plot.frame(),
				Plot.ruleY([0])
			],
			width: width,
			height: height,
			inset: 20,
			x: {
				type: 'time',
				padding: 0.4,
				label: xLabel,
				tickRotate: xLabelRotate,
				labelAnchor: 'right',
				labelArrow: true,
				tickPadding: 5,
				tickFormat: (d: string) =>
					new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
			},
			y: {
				padding: 0.5,
				labelOffset: 70,
				label: yLabel,
				labelAnchor: 'top',
				domain: [domainMin, Math.max(...filteredData.map((d) => d[yField]), domainMin + 1)],
				tickRotate: yLabelRotate,
				interval: integerTicks ? 1 : undefined,
				tickFormat: (d: number) => {
					if (integerTicks) {
						return tickPrefix + Math.round(d).toString() + tickSuffix;
					}
					return formatTickValue(d, tickPrefix, tickSuffix);
				},
				tickPadding: 5
			},
			marginLeft: 70,
			marginBottom: 60
		});
		element.appendChild(plot);
	}

	function createAreaChart(
		element: HTMLElement,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		data: any[],
		options: {
			title: string;
			subtitle?: string;
			xField?: string;
			yField?: string;
			stackFields?: string[];
			xLabel?: string;
			yLabel?: string;
			width?: number;
			height?: number;
			colors?: string[];
			formatYTicks?: boolean;
			tickPrefix?: string;
			tickSuffix?: string;
			domainMin?: number;
			integerTicks?: boolean;
			legend?: boolean;
		}
	) {
		if (!element) return;

		const {
			title,
			subtitle,
			xField = 'date',
			stackFields = ['active', 'inactive'],
			xLabel = 'Date',
			yLabel = 'Orders Count',
			width = 900,
			height = 500,
			colors = ['rgb(38, 128, 217)', 'rgb(86, 97, 111)'],
			formatYTicks = false,
			tickPrefix = '',
			tickSuffix = '',
			domainMin = 0,
			integerTicks = true,
			legend = true
		} = options;

		// Format function for y-axis ticks
		const formatTickValue = (d: number, prefix = '', suffix = '') => {
			if (!formatYTicks) return prefix + d.toString() + suffix;
			const absD = Math.abs(d);
			if (absD >= 1e9) return prefix + (d / 1e9).toFixed(1) + 'B' + suffix;
			if (absD >= 1e6) return prefix + (d / 1e6).toFixed(1) + 'M' + suffix;
			if (absD >= 1e3) return prefix + (d / 1e3).toFixed(1) + 'K' + suffix;
			return prefix + d.toString() + suffix;
		};

		// Remove any existing chart
		while (element.firstChild) {
			element.removeChild(element.firstChild);
		}

		// Create the plot
		const marks = [Plot.frame()];

		// Add areas for each stack field in reverse order (to ensure proper stacking)
		for (let i = stackFields.length - 1; i >= 0; i--) {
			const field = stackFields[i];
			marks.push(
				Plot.areaY(data, {
					x: xField,
					y: field,
					fill: colors[i],
					fillOpacity: 0.7,
					stroke: colors[i],
					strokeWidth: 1.5,
					curve: 'monotone-x',
					tip: true
				})
			);
		}

		// Add grid lines
		marks.push(Plot.ruleY([0]));

		const plot = Plot.plot({
			title,
			subtitle,
			grid: true,
			style: {
				background: 'white',
				fontSize: '14px',
				overflow: 'visible'
			},
			marks,
			width,
			height,
			marginLeft: 60,
			marginRight: 40,
			marginBottom: 60,
			marginTop: 20,
			x: {
				type: 'time',
				tickFormat: (d: string) =>
					new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
				label: xLabel,
				labelOffset: 40
			},
			y: {
				domain: [
					domainMin,
					Math.max(...data.map((d) => stackFields.reduce((sum, field) => sum + d[field], 0)), 10)
				],
				label: yLabel,
				labelOffset: 45,
				interval: integerTicks ? 1 : undefined,
				tickFormat: (d: number) => {
					if (integerTicks) {
						return tickPrefix + Math.round(d).toString() + tickSuffix;
					}
					return formatTickValue(d, tickPrefix, tickSuffix);
				}
			},
			color: legend
				? {
						domain: stackFields.map((field) => field.charAt(0).toUpperCase() + field.slice(1)),
						range: colors,
						legend: true
					}
				: undefined
		});

		element.appendChild(plot);
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
					setTimeout(() => renderMarketDataCharts(marketData), 0);
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
			<div class="wrapper">
				<div class="flex flex-col md:flex-row">
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={topOrdersByTradesCount}
					></div>
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={topOrdersByVolume}
					></div>
				</div>
				<div class="flex flex-col md:flex-row">
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={ordersAdderPerDay}
					></div>
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={tradesPerDay}
					></div>
				</div>
				<div class="flex flex-col md:flex-row">
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={uniqueOrderOwners}
					></div>
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={cumulativeOrders}
					></div>
				</div>
			</div>
		{:else if activeTab === 'Vault Analytics'}
			<div class="wrapper">
				<div class="flex flex-row">
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={topVaultsByBalance}
					></div>
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={topVaultsByVolume}
					></div>
				</div>
				<div class="flex flex-row">
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={tokenVaultBalances}
					></div>
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={tokenVaultBalancesUsd}
					></div>
				</div>
				<div class="flex flex-row">
					<div
						class="m-2 w-full rounded-lg shadow-lg md:w-1/2 md:p-2"
						bind:this={vaultHealthMetrics}
					></div>
				</div>
			</div>
		{/if}
	</div>
{/if}
