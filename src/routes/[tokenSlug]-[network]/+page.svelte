<script lang="ts">
    import "../../app.css";
    import { page } from '$app/stores';
    import { getTokenOrders, formatTimestamp } from '$lib/orders';
    import { type MultiSubgraphArgs } from '@rainlanguage/orderbook/js_api';

    const { settings, activeSubgraphs, tokenSlug, network } = $page.data.stores;
    let activeSubgraphsValue: MultiSubgraphArgs[] = $activeSubgraphs;
    let settingsValue: any = $settings;
    let tokenSlugValue: string = $tokenSlug;
    let networkValue: string = $network;
    let orders: any = null;
    let loading = true;
    let errorMessage: string = '';

    $: {
        (async () => {
            if (tokenSlugValue && networkValue && activeSubgraphsValue) {
                try {
                    orders = await getTokenOrders();
                    loading = false;
                } catch (error) {
                    console.error("Failed to fetch orders:", error);
                    loading = false;
                    errorMessage = "Failed to fetch orders";
                }
            }
        })()
    }
    $: console.log(JSON.stringify(orders));
</script>

{#if errorMessage}
    <div class="error-message bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <span class="block sm:inline">{errorMessage}</span>
    </div>
{/if}
{#if loading}
    <div class="flex flex-col items-center justify-center h-screen">
        <div class="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"></div>
        <p class="mt-3 text-lg font-medium text-gray-600">Loading...</p>
    </div>
{:else if orders}
    <h1 class="text-2xl font-bold text-center mb-4 mt-4">Orders for {tokenSlugValue} on {networkValue}</h1>
    <div class="max-w-screen-3xl mx-auto rounded-lg bg-gray-100 p-8 shadow-lg">
        <div class="overflow-hidden rounded-lg bg-white shadow-lg">
            <table class="w-full table-auto border-collapse border border-gray-200">
                <thead class="bg-gray-50 text-sm font-semibold text-gray-800">
                    <th class="px-4 py-3 text-center">
                        <p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
                            Network
                        </p>
                    </th>
                    <th class="px-4 py-3 text-center">
                    <select
                        class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
                    >
                        <option value="lastTradeAsc">Last Trade ↑</option>
                        <option value="lastTradeDesc">Last Trade ↓</option>
                    </select>
                    </th>
            
                    <th class="px-4 py-3 text-center">
                    <select
                        class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
                    >
                        <option value="firstTradeAsc">First Trade ↑</option>
                        <option value="firstTradeDesc">First Trade ↓</option>
                    </select>
                    </th>
            
                    <th class="px-4 py-3 text-center">
                    <select
                        class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
                    >
                        <option value="totalTradesAsc">Total Trades ↑</option>
                        <option value="totalTradesDesc">Total Trades ↓</option>
                    </select>
                    </th>
            
                    <th class="px-4 py-3 text-center">
                    <select
                        class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
                    >
                        <option value="trades24hAsc">24h Trades ↑</option>
                        <option value="trades24hDesc">24h Trades ↓</option>
                    </select>
                    </th>
            
                    <th class="px-4 py-3 text-center">
                    <select
                        class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
                    >
                        <option value="volTotalAsc">Total Volume ↑</option>
                        <option value="volTotalDesc">Total Volume ↓</option>
                    </select>
                    </th>
            
                    <th class="px-4 py-3 text-center">
                    <select
                        class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
                        
                    >
                        <option value="vol24hAsc">24h Volume ↑</option>
                        <option value="vol24hDesc">24h Volume ↓</option>
                    </select>
                    </th>
            
                    <th class="px-4 py-3 text-center">
                    <select
                        class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
                    >
                        <option value="inputAsc">Input Balance ↑</option>
                        <option value="inputDesc">Input Balance ↓</option>
                    </select>
                    </th>
            
                    <th class="px-4 py-3 text-center">
                    <select
                        class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none"
                    >
                        <option value="outputAsc">Output Balance ↑</option>
                        <option value="outputDesc">Output Balance ↓</option>
                    </select>
                    </th>

                    <th class="px-4 py-3 text-center">
                        <p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
                            Order Link
                        </p>
                    </th>
                </thead>
                <tbody>
                    {#each orders as order (order.order.orderHash)}
                        <tr class="border-t border-gray-300 text-gray-700">
                            <td class="px-4 py-3 text-center text-sm">{networkValue}</td>
                            <td class="px-4 py-3 text-center text-sm" >{ order.order.trades.length > 0 ? formatTimestamp(order.order.trades[order.order.trades.length - 1].timestamp) : 'N/A'}</td>
                            <td class="px-4 py-3 text-center text-sm" >{ order.order.trades.length > 0 ? formatTimestamp(order.order.trades[0].timestamp) : 'N/A'}</td>
                            <td class="px-4 py-3 text-center text-sm" >{order.order.trades.length}</td>
                            <td class="px-4 py-3 text-center text-sm" >{order.order.trades.length > 0 ? order.order.trades.filter((trade: any) => (Date.now() / 1000) - trade.timestamp <= 86400).length : 'N/A'}</td>
                            <td class="px-4 py-3 text-center text-sm">-</td>
                            <td class="px-4 py-3 text-center text-sm">-</td>
                            <td class="px-4 py-3 text-center text-sm">-</td>
                            <td class="px-4 py-3 text-center text-sm">-</td>
                            <td class="px-4 py-3 text-center text-sm">
                                <a href={`https://raindex.finance/my-strategies/${order.order.orderHash}-${networkValue}`} target="_blank">
                                    <span class="text-blue-500 hover:text-blue-700">{order.order.orderHash.slice(0, 6)}...{order.order.orderHash.slice(-4)}</span>
                                </a>
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    </div>

    
{:else}
    <p>No orders available</p>
{/if}

