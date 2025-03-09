    <script lang="ts">
        import { DEFAULT_ORDERS_PAGE_SIZE, getContext, interpreterV3Abi, qualifyNamespace, tokenConfig } from '$lib/constants';
        import { page } from '$app/stores';
        import { type MultiSubgraphArgs, type SgOrderWithSubgraphName, type OrderV3, type SgVault } from '@rainlanguage/orderbook/js_api';
        import { getOrders, getOrderHash } from '@rainlanguage/orderbook/js_api';
        import { doQuoteSpecs, type BatchQuoteSpec, type QuoteSpec, type OrderQuoteValue } from '@rainlanguage/orderbook/quote';
        import { createInfiniteQuery } from '@tanstack/svelte-query';
        import { Table, TableHead, TableBody, TableHeadCell, TableBodyCell, TableBodyRow } from 'flowbite-svelte';
        import { ethers } from 'ethers';
        import type { MarketDepthOrder } from '$lib/types';
        import { OrderV3 as OrderV3Tuple } from '$lib/constants';

        
        export let network: string;
        export let baseTokenAddress: string;
        export let quoteTokenAddress: string;
        export let networkRpc: string;

        $: networkRpc = networkRpc === '' || networkRpc === undefined ? $settings.networks[network].rpc : networkRpc
        


        const {settings} = $page.data.stores;

        const marketDepthQuery = createInfiniteQuery({
            queryKey: [ network, baseTokenAddress, quoteTokenAddress, networkRpc],
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
                        orderHash: "0x652d85a9b2776155df85a0c81c8ab60cd39473807c7ec723a918a157bc2c8801"
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

        async function getFilteredBuySellOrders(orders: SgOrderWithSubgraphName[]): Promise<MarketDepthOrder[]> {

            let filteredBuySellOrders: MarketDepthOrder[] = [];
            
            for (const order of orders) {
                
                
                const currentOrder: OrderV3 = ethers.utils.defaultAbiCoder.decode([OrderV3Tuple], order.order.orderBytes)[0];
                
                let isBuyInput = false, isBuyOutput = false, buyInputIndex = 0, buyOutputIndex = 0;
                let isSellInput = false, isSellOutput = false, sellInputIndex = 0, sellOutputIndex = 0;

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
                        type: "buy",
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
                        type: "sell",
                        inputIOIndex: sellInputIndex,
                        outputIOIndex: sellOutputIndex,
                        maxOutput: '',
                        ratio: ''
                    });
                }    
            }

            return filteredBuySellOrders;
        }

        async function getOrderQuotes(orders: MarketDepthOrder[]): Promise<MarketDepthOrder[]> {
          

            const orderBatchQuoteSpecs: BatchQuoteSpec = orders.map(order => ({
                orderHash: order.sgOrder.orderHash,
                inputIOIndex: order.inputIOIndex,
                outputIOIndex: order.outputIOIndex,
                signedContext: [],
                orderbook: $settings.orderbooks[network].address
            }));

            const quoteSpecs: OrderQuoteValue[] = await doQuoteSpecs(orderBatchQuoteSpecs, $settings.subgraphs[network], networkRpc);

            for (let i = 0; i < orders.length; i++) {
                orders[i].maxOutput = ethers.utils.formatEther(quoteSpecs[i].maxOutput).toString();
                orders[i].ratio = ethers.utils.formatEther(quoteSpecs[i].ratio).toString();
            }
            return orders;
        }

        async function validateHandleIO(order: MarketDepthOrder): Promise<boolean> {
            console.log('here validateHandleIO : ', order.sgOrder.orderHash)
            const currentSgOrder = order.sgOrder;
            const currentDecodedOrder = order.decodedOrder;
            const orderbookAddress = currentSgOrder.orderbook.id;
            const takerAddress = ethers.Wallet.createRandom().address;

            let context = getContext()
            context[0][0] = takerAddress;
            context[0][1] = orderbookAddress;

            context[1][0] = currentSgOrder.orderHash;
            context[1][1] = currentDecodedOrder.owner;
            context[1][2] = takerAddress;

            context[2][0] = ethers.utils.parseEther(order.maxOutput).toString();
            context[2][1] = ethers.utils.parseEther(order.ratio).toString();
            
            context[3][0] = currentDecodedOrder.validInputs[order.inputIOIndex].token;
            context[3][1] = ethers.BigNumber.from(currentDecodedOrder.validInputs[order.inputIOIndex].decimals.toString()).mul(ethers.constants.WeiPerEther).toString();
            context[3][2] = currentDecodedOrder.validInputs[order.inputIOIndex].vaultId.toString();
            context[3][3] = ethers.BigNumber.from(
                            currentSgOrder.inputs.filter((input: SgVault) => {
                                return (
                                    input.token.address.toLowerCase() === currentDecodedOrder.validInputs[order.inputIOIndex].token.toLowerCase() &&
                                    input.token.decimals?.toString() === currentDecodedOrder.validInputs[order.inputIOIndex].decimals.toString() &&
                                    input.vaultId.toString() === currentDecodedOrder.validInputs[order.inputIOIndex].vaultId.toString() 
                                )
                            })[0].balance.toString()
                        ).mul(ethers.BigNumber.from('1'+'0'.repeat(18-Number(currentDecodedOrder.validInputs[order.inputIOIndex].decimals)))).toString();
            context[3][4] = ethers.utils.parseEther(order.ratio).mul(ethers.utils.parseEther(order.maxOutput)).div(ethers.BigNumber.from(ethers.constants.WeiPerEther)).toString()
            
            context[4][0] = currentDecodedOrder.validOutputs[order.outputIOIndex].token;
            context[4][1] = ethers.BigNumber.from(currentDecodedOrder.validOutputs[order.outputIOIndex].decimals.toString()).mul(ethers.constants.WeiPerEther).toString();
            context[4][2] = currentDecodedOrder.validOutputs[order.outputIOIndex].vaultId.toString();
            context[4][3] = ethers.BigNumber.from(
                currentSgOrder.outputs.filter((output: SgVault) => {
                    return (
                        output.token.address.toLowerCase() === currentDecodedOrder.validOutputs[order.outputIOIndex].token.toLowerCase() &&
                        output.token.decimals?.toString() === currentDecodedOrder.validOutputs[order.outputIOIndex].decimals.toString() &&
                        output.vaultId.toString() === currentDecodedOrder.validOutputs[order.outputIOIndex].vaultId.toString() 
                    )
                })[0].balance.toString()
            ).mul(ethers.BigNumber.from('1'+'0'.repeat(18-Number(currentDecodedOrder.validOutputs[order.outputIOIndex].decimals)))).toString();
            context[4][4] = ethers.utils.parseEther(order.maxOutput).toString();
            
            const networkProvider = new ethers.providers.JsonRpcProvider(networkRpc);
            const interpreterContract = new ethers.Contract(currentDecodedOrder.evaluable.interpreter, interpreterV3Abi, networkProvider);  
            
            console.log('context : ', JSON.stringify(context))
            let validHandleIO = false; 
            try{
                await interpreterContract.eval3(
                    currentDecodedOrder.evaluable.store,
                    ethers.BigNumber.from(qualifyNamespace(currentDecodedOrder.owner,orderbookAddress)).toString(),
                    currentDecodedOrder.evaluable.bytecode,
                    '1', // Handle IO source index is 1
                    context,
                    []
                );
                validHandleIO = true
            }catch(e){
                console.log('e : ', e)
                console.log(`HandleIO Eval failed for order ${currentSgOrder.orderHash}`)
            }
            return validHandleIO;
        }

    </script>

    <div>
        <div class="flex flex-col gap-5">
            <div class="rounded-md border border-gray-300 bg-white p-4 shadow-md">
                <h3 class="mb-3 text-lg font-bold text-green-600">Buy Orders</h3>
                <Table class="w-full border-collapse text-left">
                    <TableHead>
                        <TableHeadCell class="px-4 py-2">#</TableHeadCell>
                        <TableHeadCell class="px-4 py-2">Max Output</TableHeadCell>
                        <TableHeadCell class="px-4 py-2">Input Amount</TableHeadCell>
                        <TableHeadCell class="px-4 py-2">Ratio</TableHeadCell>
                        <TableHeadCell class="px-4 py-2">Order Hash</TableHeadCell>
                    </TableHead>
                    <TableBody>
                        {#if $marketDepthQuery.isLoading}
                            <div class="mt-10 flex flex-col items-center justify-start">
                                <div
                                    class="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"
                                ></div>
                                <p class="mt-3 text-lg font-medium text-gray-600">Loading...</p>
                            </div>
                        {:else if $marketDepthQuery.data?.pages[0].orders.length === 0}
                            <div data-testid="emptyMessage" class="text-center text-gray-900 dark:text-white">None found</div>
                        {:else if $marketDepthQuery.data?.pages[0].orders !== undefined && $marketDepthQuery.data?.pages[0].orders.length > 0}
                            {#each $marketDepthQuery.data?.pages as page}
                                {#each page.orders.filter(order => order.type === 'buy') as order, index}
                                <TableBodyRow>
                                    <TableBodyCell class="px-4 py-2">{index + 1}</TableBodyCell>
                                    <TableBodyCell class="px-4 py-2">{parseFloat(order.maxOutput).toFixed(4)}</TableBodyCell>
                                    <TableBodyCell class="px-4 py-2">{(parseFloat(order.maxOutput) * parseFloat(order.ratio)).toFixed(4)}</TableBodyCell>
                                    <TableBodyCell class="px-4 py-2">{parseFloat(order.ratio).toFixed(4)}</TableBodyCell>
                                    <TableBodyCell class="px-4 py-2 text-blue-500 underline">
                                        <a
                                            href={`https://v2.raindex.finance/orders/${network}-${order.sgOrder.orderHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            >
                                            {`${order.sgOrder.orderHash.slice(0, 6)}...${order.sgOrder.orderHash.slice(-4)}`}
                                        </a>
                                    </TableBodyCell>
                                </TableBodyRow>
                                {/each}
                            {/each}
                        {/if}
                    </TableBody>
                </Table>
            </div>
            <div class="rounded-md border border-gray-300 bg-white p-4 shadow-md">
                <h3 class="mb-3 text-lg font-bold text-red-600">Sell Orders</h3>
                <Table class="w-full border-collapse text-left">
                    <TableHead>
                        <TableHeadCell class="px-4 py-2">#</TableHeadCell>
                        <TableHeadCell class="px-4 py-2">Max Output</TableHeadCell>
                        <TableHeadCell class="px-4 py-2">Input Amount</TableHeadCell>
                        <TableHeadCell class="px-4 py-2">Ratio</TableHeadCell>
                        <TableHeadCell class="px-4 py-2">Order Hash</TableHeadCell>
                    </TableHead>
                    <TableBody>
                        {#if $marketDepthQuery.isLoading}
                            <div class="mt-10 flex flex-col items-center justify-start">
                                <div
                                    class="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"
                                ></div>
                                <p class="mt-3 text-lg font-medium text-gray-600">Loading...</p>
                            </div>
                        {:else if $marketDepthQuery.data?.pages[0].orders.length === 0}
                            <div data-testid="emptyMessage" class="text-center text-gray-900 dark:text-white">None found</div>
                        {:else if $marketDepthQuery.data?.pages[0].orders !== undefined && $marketDepthQuery.data?.pages[0].orders.length > 0}
                            {#each $marketDepthQuery.data?.pages as page}
                                {#each page.orders.filter(order => order.type === 'sell') as order, index}
                                <TableBodyRow>
                                    <TableBodyCell class="px-4 py-2">{index + 1}</TableBodyCell>
                                    <TableBodyCell class="px-4 py-2">{parseFloat(order.maxOutput).toFixed(4)}</TableBodyCell>
                                    <TableBodyCell class="px-4 py-2">{(parseFloat(order.maxOutput) * parseFloat(order.ratio)).toFixed(4)}</TableBodyCell>
                                    <TableBodyCell class="px-4 py-2">{parseFloat(order.ratio).toFixed(4)}</TableBodyCell>
                                    <TableBodyCell class="px-4 py-2 text-blue-500 underline">
                                        <a
                                            href={`https://v2.raindex.finance/orders/${network}-${order.sgOrder.orderHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            >
                                            {`${order.sgOrder.orderHash.slice(0, 6)}...${order.sgOrder.orderHash.slice(-4)}`}
                                        </a>
                                    </TableBodyCell>
                                </TableBodyRow>
                                {/each}
                            {/each}
                        {/if}
                    </TableBody>
                </Table>
            </div>

        </div>
    </div>
