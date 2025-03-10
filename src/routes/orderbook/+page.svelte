<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import MarketDepthTable from '$lib/components/MarketDepthTable.svelte';
	import {
		DEFAULT_ORDERS_PAGE_SIZE,
		getContext,
		interpreterV3Abi,
		qualifyNamespace
	} from '$lib/constants';
	import { page } from '$app/stores';
	import type { SgOrderWithSubgraphName, OrderV3, SgVault } from '@rainlanguage/orderbook/js_api';
	import { getOrders } from '@rainlanguage/orderbook/js_api';
	import type { BatchQuoteSpec, OrderQuoteValue } from '@rainlanguage/orderbook/quote';
	import { doQuoteSpecs } from '@rainlanguage/orderbook/quote';
	import { createInfiniteQuery } from '@tanstack/svelte-query';
	import type { MarketDepthOrder } from '$lib/types';
	import { ethers } from 'ethers';
	import { OrderV3 as OrderV3Tuple } from '$lib/constants';

	const { settings } = $page.data.stores;

	let network = '';
	let baseTokenAddress = '';
	let quoteTokenAddress = '';
	let networkRpc: string = '';

	$: marketDepthQuery = createInfiniteQuery({
		queryKey: [network, baseTokenAddress, quoteTokenAddress, networkRpc],
		queryFn: async ({ pageParam = 0 }) => {
			const subgraph = $settings.subgraphs[network];
			const allOrders: SgOrderWithSubgraphName[] = await getOrders(
				[
					{
						url: subgraph,
						name: network
					}
				],
				{
					owners: [],
					active: true,
					orderHash: undefined
				},
				{ page: pageParam + 1, pageSize: DEFAULT_ORDERS_PAGE_SIZE + 95 }
			);

			const filteredBuySellOrders = await getFilteredBuySellOrders(allOrders);
			const orderQuotes = await getOrderQuotes(filteredBuySellOrders);

			const filteredValidOrders: MarketDepthOrder[] = [];
			for (const order of orderQuotes) {
				const valid = await validateHandleIO(order);
				if (valid) {
					filteredValidOrders.push(order);
				}
			}
			return {
				orders: filteredValidOrders,
				hasMore: allOrders.length === DEFAULT_ORDERS_PAGE_SIZE + 95
			};
		},
		initialPageParam: 0,
		getNextPageParam(lastPage, _allPages, lastPageParam) {
			return lastPage.hasMore ? lastPageParam + 1 : undefined;
		},
		enabled: true
	});

	async function getFilteredBuySellOrders(
		orders: SgOrderWithSubgraphName[]
	): Promise<MarketDepthOrder[]> {
		try {
			let filteredBuySellOrders: MarketDepthOrder[] = [];

		for (const order of orders) {
			const currentOrder: OrderV3 = ethers.utils.defaultAbiCoder.decode(
				[OrderV3Tuple],
				order.order.orderBytes
			)[0];

			let isBuyInput = false,
				isBuyOutput = false,
				buyInputIndex = 0,
				buyOutputIndex = 0;
			let isSellInput = false,
				isSellOutput = false,
				sellInputIndex = 0,
				sellOutputIndex = 0;

			for (let j = 0; j < currentOrder.validInputs.length; j++) {
				if (currentOrder.validInputs[j].token.toLowerCase() === baseTokenAddress.toLowerCase()) {
					isBuyInput = true;
					buyInputIndex = j;
				}
				if (currentOrder.validInputs[j].token.toLowerCase() === quoteTokenAddress.toLowerCase()) {
					isSellInput = true;
					sellInputIndex = j;
				}
			}

			for (let j = 0; j < currentOrder.validOutputs.length; j++) {
				if (currentOrder.validOutputs[j].token.toLowerCase() === quoteTokenAddress.toLowerCase()) {
					isBuyOutput = true;
					buyOutputIndex = j;
				}
				if (currentOrder.validOutputs[j].token.toLowerCase() === baseTokenAddress.toLowerCase()) {
					isSellOutput = true;
					sellOutputIndex = j;
				}
			}

			if (isBuyInput && isBuyOutput) {
				filteredBuySellOrders.push({
					decodedOrder: currentOrder,
					sgOrder: order.order,
					type: 'buy',
					inputIOIndex: buyInputIndex,
					outputIOIndex: buyOutputIndex,
					maxOutput: '',
					ratio: ''
				});
			}

			if (isSellInput && isSellOutput) {
				filteredBuySellOrders.push({
					decodedOrder: currentOrder,
					sgOrder: order.order,
					type: 'sell',
					inputIOIndex: sellInputIndex,
					outputIOIndex: sellOutputIndex,
					maxOutput: '',
					ratio: ''
				});
			}
		}

		return filteredBuySellOrders;
		} catch {
			return [];
		}
	}

	async function getOrderQuotes(orders: MarketDepthOrder[]): Promise<MarketDepthOrder[]> {
		try {
			const orderBatchQuoteSpecs: BatchQuoteSpec = orders.map((order) => ({
				orderHash: order.sgOrder.orderHash,
				inputIOIndex: order.inputIOIndex,
				outputIOIndex: order.outputIOIndex,
				signedContext: [],
				orderbook: $settings.orderbooks[network].address
			}));

			const quoteSpecs: OrderQuoteValue[] = await doQuoteSpecs(
				orderBatchQuoteSpecs,
				$settings.subgraphs[network],
				networkRpc === '' || networkRpc === undefined ? $settings.networks[network].rpc : networkRpc
			);

			for (let i = 0; i < orders.length; i++) {
				if(quoteSpecs[i].maxOutput !== undefined && quoteSpecs[i].ratio !== undefined) {
					orders[i].maxOutput = ethers.utils.formatEther(quoteSpecs[i].maxOutput).toString();
					orders[i].ratio = ethers.utils.formatEther(quoteSpecs[i].ratio).toString();
				} else{
					orders[i].maxOutput = '0';
					orders[i].ratio = '0';
				}
			}
			return orders.filter((order) => order.maxOutput !== '0' && order.ratio !== '0');
		} catch {
			return [];
		}
	}

	async function validateHandleIO(order: MarketDepthOrder): Promise<boolean> {
		const currentSgOrder = order.sgOrder;
		const currentDecodedOrder = order.decodedOrder;
		const orderbookAddress = currentSgOrder.orderbook.id;
		const takerAddress = ethers.Wallet.createRandom().address;

		let context = getContext();
		context[0][0] = takerAddress;
		context[0][1] = orderbookAddress;

		context[1][0] = currentSgOrder.orderHash;
		context[1][1] = currentDecodedOrder.owner;
		context[1][2] = takerAddress;

		context[2][0] = ethers.utils.parseEther(order.maxOutput).toString();
		context[2][1] = ethers.utils.parseEther(order.ratio).toString();

		context[3][0] = currentDecodedOrder.validInputs[order.inputIOIndex].token;
		context[3][1] = ethers.BigNumber.from(
			currentDecodedOrder.validInputs[order.inputIOIndex].decimals.toString()
		)
			.mul(ethers.constants.WeiPerEther)
			.toString();
		context[3][2] = currentDecodedOrder.validInputs[order.inputIOIndex].vaultId.toString();
		context[3][3] = ethers.BigNumber.from(
			currentSgOrder.inputs
				.filter((input: SgVault) => {
					return (
						input.token.address.toLowerCase() ===
							currentDecodedOrder.validInputs[order.inputIOIndex].token.toLowerCase() &&
						input.token.decimals?.toString() ===
							currentDecodedOrder.validInputs[order.inputIOIndex].decimals.toString() &&
						input.vaultId.toString() ===
							currentDecodedOrder.validInputs[order.inputIOIndex].vaultId.toString()
					);
				})[0]
				.balance.toString()
		)
			.mul(
				ethers.BigNumber.from(
					'1' +
						'0'.repeat(18 - Number(currentDecodedOrder.validInputs[order.inputIOIndex].decimals))
				)
			)
			.toString();
		context[3][4] = ethers.utils
			.parseEther(order.ratio)
			.mul(ethers.utils.parseEther(order.maxOutput))
			.div(ethers.BigNumber.from(ethers.constants.WeiPerEther))
			.toString();

		context[4][0] = currentDecodedOrder.validOutputs[order.outputIOIndex].token;
		context[4][1] = ethers.BigNumber.from(
			currentDecodedOrder.validOutputs[order.outputIOIndex].decimals.toString()
		)
			.mul(ethers.constants.WeiPerEther)
			.toString();
		context[4][2] = currentDecodedOrder.validOutputs[order.outputIOIndex].vaultId.toString();
		context[4][3] = ethers.BigNumber.from(
			currentSgOrder.outputs
				.filter((output: SgVault) => {
					return (
						output.token.address.toLowerCase() ===
							currentDecodedOrder.validOutputs[order.outputIOIndex].token.toLowerCase() &&
						output.token.decimals?.toString() ===
							currentDecodedOrder.validOutputs[order.outputIOIndex].decimals.toString() &&
						output.vaultId.toString() ===
							currentDecodedOrder.validOutputs[order.outputIOIndex].vaultId.toString()
					);
				})[0]
				.balance.toString()
		)
			.mul(
				ethers.BigNumber.from(
					'1' +
						'0'.repeat(18 - Number(currentDecodedOrder.validOutputs[order.outputIOIndex].decimals))
				)
			)
			.toString();
		context[4][4] = ethers.utils.parseEther(order.maxOutput).toString();

		const networkProvider = new ethers.providers.JsonRpcProvider(
			networkRpc === '' || networkRpc === undefined ? $settings.networks[network].rpc : networkRpc
		);
		const interpreterContract = new ethers.Contract(
			currentDecodedOrder.evaluable.interpreter,
			interpreterV3Abi,
			networkProvider
		);

		let validHandleIO = false;
		try {
			await interpreterContract.eval3(
				currentDecodedOrder.evaluable.store,
				ethers.BigNumber.from(
					qualifyNamespace(currentDecodedOrder.owner, orderbookAddress)
				).toString(),
				currentDecodedOrder.evaluable.bytecode,
				'1', // Handle IO source index is 1
				context,
				[]
			);
			validHandleIO = true;
		} catch {
			console.log(`HandleIO Eval failed for order ${currentSgOrder.orderHash}`);
		}
		return validHandleIO;
	}
</script>

<Header />
<div
	class="m-2 mx-auto w-full max-w-7xl rounded-lg border border-gray-300 bg-gray-100 p-5 font-sans shadow-lg"
>
	<div class="mb-5 flex flex-col items-center gap-4">
		<img src="/h20-logo.png" alt="Raindex Logo" class="h-auto w-16" />
		<h2 class="text-2xl font-bold text-gray-800">Market Depth</h2>
	</div>
	<div class="mb-5 flex flex-col gap-4">
		<div>
			<label for="network-select" class="block font-semibold">Network:</label>
			<select
				id="network-select"
				class="mt-2 w-full rounded border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
				bind:value={network}
			>
				<option value="" disabled> Select a Network </option>
				{#each Object.keys($settings.subgraphs) as network}
					<option class="text-lg text-gray-700 hover:bg-gray-200 md:text-base" value={network}
						>{network}</option
					>
				{/each}
			</select>
		</div>
		<div>
			<label for="base-token-select" class="block font-semibold">Base Token:</label>
			<input
				type="text"
				placeholder="Base Token Address"
				class="mt-2 w-full rounded border border-gray-300 p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
				bind:value={baseTokenAddress}
			/>
		</div>
		<div>
			<label for="quote-token-select" class="block font-semibold">Quote Token:</label>
			<input
				type="text"
				placeholder="Quote Token Address"
				class="mt-2 w-full rounded border border-gray-300 p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
				bind:value={quoteTokenAddress}
			/>
		</div>
		<div>
			<label for="network-rpc-select" class="block font-semibold">Network RPC:</label>
			<input
				type="text"
				placeholder="Optional: Network RPC"
				class="mt-2 w-full rounded border border-gray-300 p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
				bind:value={networkRpc}
			/>
		</div>
	</div>

	{#if network && baseTokenAddress && quoteTokenAddress}
		<div class="rounded-md border border-gray-300 bg-white p-5 shadow-md">
			<MarketDepthTable {marketDepthQuery} {network} />
		</div>
	{:else if !network || !baseTokenAddress || !quoteTokenAddress}
		<div class="rounded-md border border-gray-300 bg-white p-5 shadow-md">
			<h2 class="text-lg font-medium text-gray-500">
				Please select a network, base token, and quote token
			</h2>
		</div>
	{/if}
</div>
