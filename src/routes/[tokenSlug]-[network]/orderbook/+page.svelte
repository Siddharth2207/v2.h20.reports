<script lang="ts">
	import MarketDepthTable from '$lib/components/MarketDepthTable.svelte';
	import {
		DEFAULT_ORDERS_PAGE_SIZE,
		getContext,
		interpreterV3Abi,
		qualifyNamespace,
		tokenConfig
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
	import { getSushiPrice } from '$lib/price';

	const { settings, tokenSlug, network } = $page.data.stores;

	let orderBookAddress = $settings.orderbooks[$network].address;
	let baseTokenAddress = tokenConfig[$tokenSlug].address;
	let quoteTokenAddress = '';
	let baseTokenSymbol = tokenConfig[$tokenSlug].symbol;
	let quoteTokenSymbol = '';
	let baseTokenDecimals = 18;
	let quoteTokenDecimals = 18;
	let networkRpc: string = '';
	let baseTokenPrice: number = 0;
	let quoteTokenPrice: number = 0;

	$: marketDepthQuery = createInfiniteQuery({
		queryKey: [network, baseTokenAddress, quoteTokenAddress, networkRpc],
		queryFn: async ({ pageParam = 0 }) => {
			const subgraph = $settings.subgraphs[$network];
			const allOrders: SgOrderWithSubgraphName[] = await getOrders(
				[
					{
						url: subgraph,
						name: $network
					}
				],
				{
					owners: [],
					active: true,
					orderHash: undefined
				},
				{ page: pageParam + 1, pageSize: DEFAULT_ORDERS_PAGE_SIZE }
			);
			const filteredBuySellOrders = await getFilteredBuySellOrders(allOrders);

			baseTokenPrice = await getSushiPrice(
				$network,
				baseTokenAddress,
				baseTokenDecimals,
				quoteTokenAddress,
				quoteTokenDecimals
			);
			quoteTokenPrice = await getSushiPrice(
				$network,
				quoteTokenAddress,
				quoteTokenDecimals,
				baseTokenAddress,
				baseTokenDecimals
			);

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
				hasMore: allOrders.length === DEFAULT_ORDERS_PAGE_SIZE
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
						baseTokenDecimals = currentOrder.validInputs[j].decimals;
					}
					if (currentOrder.validInputs[j].token.toLowerCase() === quoteTokenAddress.toLowerCase()) {
						isSellInput = true;
						sellInputIndex = j;
						quoteTokenDecimals = currentOrder.validInputs[j].decimals;
					}
				}

				for (let j = 0; j < currentOrder.validOutputs.length; j++) {
					if (
						currentOrder.validOutputs[j].token.toLowerCase() === quoteTokenAddress.toLowerCase()
					) {
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
						ratio: '',
						price: '',
						priceDistance: ''
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
						ratio: '',
						price: '',
						priceDistance: ''
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
				orderbook: $settings.orderbooks[$network].address
			}));

			const quoteSpecs: OrderQuoteValue[] = await doQuoteSpecs(
				orderBatchQuoteSpecs,
				$settings.subgraphs[$network],
				networkRpc === '' || networkRpc === undefined
					? $settings.networks[$network].rpc
					: networkRpc
			);

			for (let i = 0; i < orders.length; i++) {
				if (quoteSpecs[i].maxOutput !== undefined && quoteSpecs[i].ratio !== undefined) {
					orders[i].maxOutput = ethers.utils.formatEther(quoteSpecs[i].maxOutput).toString();
					orders[i].ratio = ethers.utils.formatEther(quoteSpecs[i].ratio).toString();
					if (orders[i].type === 'buy') {
						const price = parseFloat(ethers.utils.formatEther(quoteSpecs[i].ratio));
						orders[i]['price'] = (1 / price).toFixed(quoteTokenDecimals);
						orders[i]['priceDistance'] = (((quoteTokenPrice - price) / price) * 100)
							.toFixed(2)
							.toString();
					} else {
						const price = parseFloat(ethers.utils.formatEther(quoteSpecs[i].ratio).toString());
						orders[i]['price'] = price.toFixed(baseTokenDecimals);
						orders[i]['priceDistance'] = (((baseTokenPrice - price) / price) * 100)
							.toFixed(2)
							.toString();
					}
				} else {
					orders[i].maxOutput = '0';
					orders[i].ratio = '0';
				}
			}
			return orders
				.filter((order) => order.maxOutput !== '0' && order.ratio !== '0')
				.sort((a, b) => parseFloat(b.priceDistance) - parseFloat(a.priceDistance));
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
			networkRpc === '' || networkRpc === undefined ? $settings.networks[$network].rpc : networkRpc
		);
		const interpreterContract = new ethers.Contract(
			currentDecodedOrder.evaluable.interpreter,
			interpreterV3Abi,
			networkProvider
		);

		try {
			quoteTokenSymbol = await new ethers.Contract(
				quoteTokenAddress,
				[
					'function decimals() external view returns (uint8)',
					'function symbol() external view returns (string)'
				],
				networkProvider
			).symbol();
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
			return true;
		} catch {
			return false;
		}
	}
</script>

<div class="max-w-8xl m-2 mx-auto w-full p-5 font-sans">
	<div class="mb-5 flex flex-col gap-4">
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
		<div>
			<label for="orderbook-address-select" class="block font-semibold">Orderbook Address:</label>
			<input
				type="text"
				placeholder="Optional: Orderbook Address"
				class="mt-2 w-full rounded border border-gray-300 p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
				bind:value={orderBookAddress}
			/>
		</div>
	</div>

	{#if $network && baseTokenAddress && quoteTokenAddress}
		<div class="rounded-md border border-gray-300 bg-white p-5 shadow-md">
			<MarketDepthTable
				{marketDepthQuery}
				network={$network}
				{baseTokenSymbol}
				{quoteTokenSymbol}
			/>
		</div>
	{:else if !$network || !baseTokenAddress || !quoteTokenAddress}
		<div class="rounded-md border border-gray-300 bg-white p-5 shadow-md">
			<h2 class="text-lg font-medium text-gray-500">
				Please select a network, base token, and quote token
			</h2>
		</div>
	{/if}
</div>
