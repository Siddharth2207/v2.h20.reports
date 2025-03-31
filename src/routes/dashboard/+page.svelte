<script lang="ts">
	import type { SgTrade } from '@rainlanguage/orderbook/js_api';
	import { getOrderTradesList } from '@rainlanguage/orderbook/js_api';
	import type { OrderListOrderWithSubgraphName } from '$lib/types';
	import { page } from '$app/stores';
	import { DEFAULT_TRADES_PAGE_SIZE } from '$lib/constants';
	import { createInfiniteQuery } from '@tanstack/svelte-query';
	import { calculateTradeVolume, fetchAllPaginatedData, getTokenPriceUsdMap } from '$lib/orders';
	import OrderListTable from '$lib/components/OrderListTable.svelte';

	const { settings } = $page.data.stores;
	const now = Math.floor(Date.now() / 1000);

	let activeTab = '15min';
	const fetchAllNetworksOrderQuery = `query OrderTakesListQuery($skip: Int = 0, $first: Int = 1000, $timestampGt: Int!) {
  orders(
    orderBy: timestampAdded
    orderDirection: desc
    skip: $skip
    first: $first
    where: {
      or: [
        { trades_: { timestamp_gt: $timestampGt } } # Use variable for dynamic filtering
        { timestampAdded_gt: $timestampGt }
      ]
    }
  ) {
    id
    orderBytes
    orderHash
    owner
    orderbook {
      id
    }
    timestampAdded
    active
    addEvents {
      transaction {
        id
        from
        blockNumber
        timestamp
      }
    }
    removeEvents {
      transaction {
        id
        from
        blockNumber
        timestamp
      }
    }
    outputs {
      id
      owner
      balance
      vaultId
      token {
        id
        address
        name
        symbol
        decimals
      }
      orderbook {
        id
      }
    }
    inputs {
      id
      owner
      balance
      vaultId
      token {
        id
        address
        name
        symbol
        decimals
      }
      orderbook {
        id
      }
    }
  }
}
`;

	$: ordersQuery = createInfiniteQuery({
		queryKey: ['orders', activeTab],
		queryFn: async () => {
			const durationInSeconds =
				activeTab === '15min'
					? 15 * 60
					: activeTab === '1h'
						? 1 * 60 * 60
						: activeTab === '24h'
							? 24 * 60 * 60
							: activeTab === '1w'
								? 7 * 24 * 60 * 60
								: 30 * 24 * 60 * 60;
			let allOrdersForDuration: OrderListOrderWithSubgraphName[] = [];
			allOrdersForDuration = await getOrdersForDuration(durationInSeconds);

			allOrdersForDuration = await getTokenPriceUsdMap(allOrdersForDuration);
			for (let order of allOrdersForDuration) {
				order.order['totalVolume'] = calculateTradeVolume(order.order.trades);
				order.order['totalVolume24h'] = calculateTradeVolume(
					order.order.trades.filter(
						(trade: SgTrade) => Date.now() / 1000 - parseFloat(trade.timestamp) <= 86400
					)
				);
			}
			return {
				orders: allOrdersForDuration,
				hasMore: false
			};
		},
		initialPageParam: 0,
		getNextPageParam(lastPage, _allPages, lastPageParam) {
			return lastPage.hasMore ? lastPageParam + 1 : undefined;
		},
		enabled: true
	});

	async function getOrdersForDuration(
		elapsedTime: number
	): Promise<OrderListOrderWithSubgraphName[]> {
		let ordersForDuration: OrderListOrderWithSubgraphName[] = [];
		const networksArray: string[] = Object.keys($settings.subgraphs);
		const subgraphs: string[] = Object.values($settings.subgraphs);

		for (let i = 0; i < networksArray.length; i++) {
			const network = networksArray[i];
			const endpoint = subgraphs[i];

			const networkTrades = await fetchAllPaginatedData(
				endpoint,
				fetchAllNetworksOrderQuery,
				{ timestampGt: now - elapsedTime },
				'orders'
			);

			for (const order of networkTrades) {
				ordersForDuration.push({
					order: order,
					subgraphName: network
				});
			}
		}

		ordersForDuration = await fetchOrderTrades(ordersForDuration);

		return ordersForDuration;
	}

	async function fetchOrderTrades(
		raindexOrders: OrderListOrderWithSubgraphName[]
	): Promise<OrderListOrderWithSubgraphName[]> {
		for (const order of raindexOrders) {
			let allTrades: SgTrade[] = [];
			let currentPage = 1;
			let hasMore = true;

			while (hasMore) {
				const trades = await getOrderTradesList(
					$settings.subgraphs[order.subgraphName] || '',
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
</script>

<div>
	<div class="flex border-b border-gray-300 bg-gray-200">
		{#each ['15min', '1h', '24h', '1w', '1m'] as tab}
			<button
				class="border-b-2 border-gray-300 px-6 py-3 text-sm font-medium transition-all {activeTab ===
				tab
					? 'border-indigo-500 bg-white font-semibold text-indigo-600'
					: 'border-transparent hover:border-gray-400 hover:text-gray-600'}"
				on:click={() => (activeTab = tab)}
			>
				{tab}
			</button>
		{/each}
	</div>
</div>

<div>
	<OrderListTable
		query={ordersQuery}
		inputChangeFlag={false}
		outputChangeFlag={false}
		totalDepositsFlag={false}
		totalInputsFlag={false}
		absoluteChangeFlag={false}
		percentChangeFlag={false}
		tradesDurationFlag={false}
		orderDurationFlag={false}
		roiFlag={false}
		roiPercentFlag={false}
		apyFlag={false}
		apyPercentFlag={false}
	/>
</div>
