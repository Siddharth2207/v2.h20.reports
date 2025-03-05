<script lang="ts">
	import { formatTimestamp, formatBalance } from '$lib/orders';
	import { ethers } from 'ethers';

	export let filteredOrders: any[];
	export let networkValue: string;
</script>

<div class="overflow-x-auto w-full rounded-lg bg-white shadow-lg">
	<table class="w-full table-auto border-collapse border border-gray-200">
		<thead class="bg-gray-50 text-sm font-semibold text-gray-800">
			<th class="px-4 py-3 text-center">
				<p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">Network</p>
			</th>
			<th class="px-4 py-3 text-center">
				<p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">Order Active</p>
			</th>
			<th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="lastTradeAsc">Last Trade ↑</option>
					<option value="lastTradeDesc">Last Trade ↓</option>
				</select>
			</th>
			<th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="firstTradeAsc">First Trade ↑</option>
					<option value="firstTradeDesc">First Trade ↓</option>
				</select>
			</th>
			<th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="trades24hAsc">24h Trades ↑</option>
					<option value="trades24hDesc">24h Trades ↓</option>
				</select>
			</th>
			<th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="vol24hAsc">24h Volume ↑</option>
					<option value="vol24hDesc">24h Volume ↓</option>
				</select>
			</th>
			<th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="inputAsc">Input Balance ↑</option>
					<option value="inputDesc">Input Balance ↓</option>
				</select>
			</th>
			<th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="outputAsc">Output Balance ↑</option>
					<option value="outputDesc">Output Balance ↓</option>
				</select>
			</th>
            <th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="">Input Δ 24h ↑</option>
					<option value="">Input Δ 24h ↓</option>
				</select>
			</th>
			<th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="">Output Δ 24h ↑</option>
					<option value="">Output Δ 24h ↓</option>
				</select>
			</th>
			<th class="px-4 py-3 text-center">
				<p class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">Order Link</p>
			</th>
		</thead>
		<tbody>
			{#each filteredOrders as order (order.order.orderHash)}
				<tr class="border-t border-gray-300 text-gray-700">
					<td class="px-4 py-3 text-center text-sm">{networkValue}</td>
					<td class="px-4 py-3 text-center text-sm">
						<span
							class={`rounded px-2 py-1 ${order.order.active ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
						>
							{order.order.active ? 'Active' : 'Inactive'}
						</span>
					</td>

					<td class="px-4 py-3 text-center text-sm"
						>{order.order.trades.length > 0
							? formatTimestamp(order.order.trades[order.order.trades.length - 1].timestamp)
							: 'N/A'}</td
					>
					<td class="px-4 py-3 text-center text-sm"
						>{order.order.trades.length > 0
							? formatTimestamp(order.order.trades[0].timestamp)
							: 'N/A'}</td
					>
					<td class="px-4 py-3 text-center text-sm">
						{order.order.trades.length > 0
							? order.order.trades.filter((trade) => Date.now() / 1000 - trade.timestamp <= 86400)
									.length
							: 'N/A'}
					</td>
					<td class="px-4 py-3 text-center text-sm">
						{#if order.order.totalVolume24h.length > 0}
							{#each order.order.totalVolume24h as token (token)}
								<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
									<span class="font-semibold">{token.token}</span>
									<span class="text-gray-800">{formatBalance(token.totalVolume)}</span>
								</div>
							{/each}
							<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
								<span class="font-semibold">Total</span>
								<span class="text-gray-800">
									${
										formatBalance(
											order.order.totalVolume24h.reduce(
												(acc, token) => 
												acc + (token.totalVolume * order.order.tokenPriceUsdMap.get(token.tokenAddress)), 0)
										)
									}
								</span>
							</div>
						{:else}
							-
						{/if}
					</td>
					<td class="px-4 py-3 text-center text-sm">
						{#each order.order.inputs as input (input.id)}
							<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
								<span class="font-semibold">{input.token.symbol}</span>
								<span class="text-gray-800"
									>{formatBalance(
										parseFloat(
											ethers.utils.formatUnits(input.balance, input.token.decimals).toString()
										)
									)}</span
								>
							</div>
						{/each}
						<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
							<span class="font-semibold">Total</span>
							<span class="text-gray-800">
								${formatBalance(
									order.order.inputs.reduce(
										(acc, input) => 
										acc + (parseFloat(ethers.utils.formatUnits(input.balance, input.token.decimals).toString()) * order.order.tokenPriceUsdMap.get(input.token.address)), 0)
									)
								}
							</span>
						</div>
					</td>
					<td class="px-4 py-3 text-center text-sm">
						{#each order.order.outputs as output (output.id)}
							<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
								<span class="font-semibold">{output.token.symbol}</span>
								<span class="text-gray-800"
									>{formatBalance(
										parseFloat(
											ethers.utils.formatUnits(output.balance, output.token.decimals).toString()
										)
									)}</span
								>
							</div>
						{/each}
						<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
							<span class="font-semibold">Total</span>
							<span class="text-gray-800">
								${formatBalance(
									order.order.outputs.reduce(
										(acc, output) => 
										acc + (parseFloat(ethers.utils.formatUnits(output.balance, output.token.decimals).toString()) * order.order.tokenPriceUsdMap.get(output.token.address)), 0)
									)
								}
							</span>
						</div>
					</td>
                    <td class="px-4 py-3 text-center text-sm">
						{#each order.order.inputs as input (input.id)}
							<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
								<span class="font-semibold">{input.token.symbol}</span>
								<span class="font-medium {input.percentageChange24h >= 0 ? 'text-green-600' : 'text-red-600'}">
                                    {formatBalance(input.balanceChange24h)}  ({formatBalance(input.percentageChange24h)}%)
                                </span>
							</div>
						{/each}
					</td>
					<td class="px-4 py-3 text-center text-sm">
						{#each order.order.outputs as output (output.id)}
							<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
								<span class="font-semibold">{output.token.symbol}</span>
								<span class="font-medium {output.percentageChange24h >= 0 ? 'text-green-600' : 'text-red-600'}">
                                    {formatBalance(output.balanceChange24h)}  ({formatBalance(output.percentageChange24h)}%)
                                </span>
							</div>
						{/each}
					</td>
					<td class="px-4 py-3 text-center text-sm">
						<a
							href={`https://v2.raindex.finance/orders/${networkValue}-${order.order.orderHash}`}
							target="_blank"
						>
							<span class="text-blue-500 hover:text-blue-700"
								>{order.order.orderHash.slice(0, 6)}...{order.order.orderHash.slice(-4)}</span
							>
						</a>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
