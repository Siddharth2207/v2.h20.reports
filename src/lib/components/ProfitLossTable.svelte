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
					<option value="">Trade Duration ↑</option>
					<option value="">Trade Duration ↓</option>
				</select>
			</th>
			<th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="">Order Duration ↑</option>
					<option value="">Order Duration ↓</option>
				</select>
			</th>

            <th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="totalTradesAsc">Total Trades ↑</option>
					<option value="totalTradesDesc">Total Trades ↓</option>
				</select>
			</th>

            <th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="volTotalAsc">Total Volume ↑</option>
					<option value="volTotalDesc">Total Volume ↓</option>
				</select>
			</th>

            <th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="volTotalAsc">Total Deposits ↑</option>
					<option value="volTotalDesc">Total Deposits ↓</option>
				</select>
			</th>

            <th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="volTotalAsc">Total Inputs (Withdrawals + Balances) ↑</option>
					<option value="volTotalDesc">Total Inputs (Withdrawals + Balances) ↓</option>
				</select>
			</th>

			<th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="">$ ROI ↑</option>
					<option value="">$ ROI ↓</option>
				</select>
			</th>

			<th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="">ROI % ↑</option>
					<option value="">ROI % ↓</option>
				</select>
			</th>

			<th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="">$ Projected APY ↑</option>
					<option value="">$ Projected APY ↓</option>
				</select>
			</th>

			<th class="px-4 py-3 text-center">
				<select class="rounded bg-gray-100 p-1 text-gray-700 focus:outline-none">
					<option value="">Projected APY % ↑</option>
					<option value="">Projected APY % ↓</option>
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
					<td class="px-4 py-3 text-center text-sm">{order.order.trades.length > 0 ? formatBalance((order.order.trades[0].timestamp - order.order.trades[order.order.trades.length - 1].timestamp) / 86400) + ' days' : '-'}</td>
					<td class="px-4 py-3 text-center text-sm">{order.order.orderDuration > 0 ? formatBalance(order.order.orderDuration/86400) + ' days' : '-'}</td>

					
					

                    <td class="px-4 py-3 text-center text-sm">{order.order.trades.length}</td>

                    <td class="px-4 py-3 text-center text-sm">
						{#if order.order.totalVolume.length > 0}
							{#each order.order.totalVolume as token (token)}
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
											order.order.totalVolume.reduce(
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
						{#each order.order.outputs as output (output.id)}
							<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
								<span class="font-semibold">{output.token.symbol}</span>
								<span class="text-gray-800">{formatBalance(output.totalDeposits)}</span>
							</div>
						{/each}
						<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
							<span class="font-semibold">Total</span>
							<span class="text-gray-800">
								${
									formatBalance(
										order.order.outputs.reduce((acc, output) => acc + output.totalDeposits * order.order.tokenPriceUsdMap.get(output.token.address), 0)
									)
								}
						</div>
					</td>

                    <td class="px-4 py-3 text-center text-sm">
						{#each order.order.inputs as input (input.id)}
							<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
								<span class="font-semibold">{input.token.symbol}</span>
								<span class="text-gray-800">{formatBalance(input.currentVaultInputs)}</span>
							</div>
						{/each}
						<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
							<span class="font-semibold">Total</span>
							<span class="text-gray-800">
								${formatBalance(order.order.inputs.reduce((acc, input) => acc + input.currentVaultInputs * order.order.tokenPriceUsdMap.get(input.token.address), 0))}
							</span>
						</div>
					</td>

					<td class="px-4 py-3 text-center text-sm">
						{#each order.order.inputs as input (input.id)}
							<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
								<span class="font-semibold">{input.token.symbol}</span>
								<span class="text-gray-800">{formatBalance(input.curerentVaultDifferential)}</span>
							</div>
						{/each}
						<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
							<span class="font-semibold">Total</span>
							<span class="text-gray-800">
								${formatBalance(order.order.roi)}
							</span>
						</div>
					</td>

                    <td class="px-4 py-3 text-center text-sm">
						{#each order.order.inputs as input (input.id)}
							<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
								<span class="font-semibold">{input.token.symbol}</span>
								<span class="font-medium {input.curerentVaultDifferentialPercentage > 0 ? 'text-green-600' : 'text-red-600'}">{formatBalance(input.curerentVaultDifferentialPercentage)}%</span>
							</div>
						{/each}
						<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
							<span class="font-semibold">Total</span>
							<span class="text-gray-800">
								{formatBalance(order.order.roiPercentage)}%
							</span>
						</div>
					</td>

					<td class="px-4 py-3 text-center text-sm">
						{#each order.order.inputs as input (input.id)}
							<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
								<span class="font-semibold">{input.token.symbol}</span>
								<span class="font-medium {input.currentVaultApy > 0 ? 'text-green-600' : 'text-red-600'}">{formatBalance(input.currentVaultApy)}</span>
							</div>
						{/each}
						<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
							<span class="font-semibold">Total</span>
							<span class="text-gray-800">
								{formatBalance(order.order.apy)}%
							</span>
						</div>
					</td>

					<td class="px-4 py-3 text-center text-sm">
						{#each order.order.inputs as input (input.id)}
							<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
								<span class="font-semibold">{input.token.symbol}</span>
								<span class="font-medium {input.currentVaultApyPercentage > 0 ? 'text-green-600' : 'text-red-600'}">{formatBalance(input.currentVaultApyPercentage)}%</span>
							</div>
						{/each}
						<div class="flex justify-between rounded-lg px-3 py-2 text-sm shadow-sm">
							<span class="font-semibold">Total</span>
							<span class="text-gray-800">
								{formatBalance(order.order.apyPercentage)}%
							</span>
						</div>
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
