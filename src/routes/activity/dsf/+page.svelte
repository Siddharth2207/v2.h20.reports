<script lang="ts">
	import { page } from '$app/stores';
	import {
		Table,
		TableBody,
		TableBodyRow,
		TableHeadCell,
		TableBodyCell,
		TableHead
	} from 'flowbite-svelte';
	import { tokenConfig } from '$lib/constants';
	import { fetchAllPaginatedData, getDsfParams, isOrderDsf } from '$lib/orders';
	import { getTokenPriceUsd } from '$lib/price';
	import { ethers } from 'ethers';
	import type { DsfData } from '$lib/types';
	import type { SgTrade } from '@rainlanguage/orderbook/js_api';
	const { settings } = $page.data.stores;
	let network = '';
	let token = '';
	let fromTimestamp = '';
	let toTimestamp = '';

	let isLoading = false;
	let raindexData: DsfData[] = [];
	let currentPage = 1;
	let itemsPerPage = 50;
	let totalPages = 1;
	let visibleTrades: DsfData[] = [];

	let tokenPriceUsdMap = new Map<
		string,
		{ price: number; decimals: number; symbol: string; address: string }
	>();
	let orderHashMap = new Map<string, string>();
	let selectedOrderHash = '';
	let selectedTokenSymbol = '';

	interface TokenMapValue {
		symbol: string;
		address: string;
	}
	let tokenSymbolMap = new Map<string, TokenMapValue>();

	$: filteredTokens = Array.from(tokenSymbolMap.values()).filter(
		(t) => t.address.toLowerCase() !== (tokenConfig[token]?.address || '').toLowerCase()
	);

	function filterRaindexData(data: DsfData[]): DsfData[] {
		if (!data) return [];
		let filteredData = data;

		filteredData = filteredData.filter((trade) => {
			if (!trade.orderMeta) return false;
			return isOrderDsf(trade.orderMeta);
		});

		// Apply selected order hash filter
		if (selectedOrderHash) {
			filteredData = filteredData.filter((trade) => trade.orderHash === selectedOrderHash);
		}

		// Apply selected token symbol filter
		if (selectedTokenSymbol) {
			const [, selectedAddress] = selectedTokenSymbol.split('-');
			if (selectedAddress) {
				filteredData = filteredData.filter(
					(trade) =>
						trade.tokenIn.address === selectedAddress || trade.tokenOut.address === selectedAddress
				);
			}
		}

		return filteredData;
	}

	$: if (raindexData) {
		const filteredData = filterRaindexData(raindexData);
		totalPages = Math.ceil(filteredData.length / itemsPerPage);
		currentPage = Math.min(currentPage, totalPages) || 1;
		updateVisibleTrades(filteredData);
	}

	$: if (selectedOrderHash !== undefined || selectedTokenSymbol !== undefined) {
		currentPage = 1;
		if (raindexData) {
			const filteredData = filterRaindexData(raindexData);
			totalPages = Math.ceil(filteredData.length / itemsPerPage);
			updateVisibleTrades(filteredData);
		}
	}

	function updateVisibleTrades(data = raindexData) {
		if (!data) return;
		const filteredData = filterRaindexData(data);
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		visibleTrades = filteredData.slice(start, end);
	}

	function nextPage() {
		if (currentPage < totalPages) {
			currentPage++;
			updateVisibleTrades();
		}
	}

	function prevPage() {
		if (currentPage > 1) {
			currentPage--;
			updateVisibleTrades();
		}
	}

	// Custom query for fetching raindex data
	// Raindex orderbook sdk is intentionally not used here to avoid fetching unnecessary data.
	const fetchAllTradesQuery = `query OrderTakesListQuery($skip: Int = 0, $first: Int = 1000, $timestampGt: Int!, $timestampLt: Int!) {
    trades(
    orderBy: timestamp
    orderDirection: desc
    skip: $skip
    first: $first
    where: {
      and: [
        { timestamp_gt: $timestampGt }
        { timestamp_lt: $timestampLt }
      ]
    }
  ){
   id
    tradeEvent {
      transaction {
        id
        blockNumber
        timestamp
		from
      }
    }
	order {
      orderHash
	  meta
    }
    inputVaultBalanceChange {
	  amount
	  newVaultBalance
      vault {
        token {
          address
          decimals
          symbol
        }
      }
    }
	outputVaultBalanceChange {
      amount
	  newVaultBalance
      vault {
        token {
          address
          decimals
          symbol
        }
      }
    }
  }
    }`;

	async function getRaindexData() {
		try {
			raindexData = [];
			isLoading = true;

			const fromTimestampUnix = new Date(fromTimestamp).getTime() / 1000;
			const toTimestampUnix = new Date(toTimestamp).getTime() / 1000;
			const endpoint = $settings.subgraphs[network];
			let raindexTrades = await fetchAllPaginatedData(
				endpoint,
				fetchAllTradesQuery,
				{ timestampGt: fromTimestampUnix, timestampLt: toTimestampUnix },
				'trades'
			);

			raindexTrades = raindexTrades.filter((trade: SgTrade) => {
				return (
					trade.inputVaultBalanceChange.vault.token.address === tokenConfig[token].address ||
					trade.outputVaultBalanceChange.vault.token.address === tokenConfig[token].address
				);
			});

			for (const trade of raindexTrades) {
				if (!orderHashMap.has(trade.order.orderHash)) {
					orderHashMap.set(trade.order.orderHash, trade.order.orderHash);
				}
			}

			for (const trade of raindexTrades) {
				for (const token of [
					trade.inputVaultBalanceChange.vault.token,
					trade.outputVaultBalanceChange.vault.token
				]) {
					if (!tokenPriceUsdMap.has(token.address)) {
						const tokenPrice = await getTokenPriceUsd(
							network,
							token.address,
							token?.symbol || '',
							parseFloat(token?.decimals || '0')
						);
						tokenPriceUsdMap.set(token.address, {
							price: tokenPrice,
							decimals: token.decimals,
							symbol: token.symbol,
							address: token.address
						});
					}
				}
			}

			// Create nested map to track net amounts: orderHash -> tokenAddress -> amount
			const orderTokenNetAmounts = new Map<string, Map<string, ethers.BigNumber>>();

			// Process trades in reverse order
			for (let i = raindexTrades.length - 1; i >= 0; i--) {
				const trade = raindexTrades[i];
				const orderHash = trade.order.orderHash;
				const inputTokenAddress = trade.inputVaultBalanceChange.vault.token.address;
				const outputTokenAddress = trade.outputVaultBalanceChange.vault.token.address;

				// Initialize maps for this order if not exists
				if (!orderTokenNetAmounts.has(orderHash)) {
					orderTokenNetAmounts.set(orderHash, new Map<string, ethers.BigNumber>());
				}
				const orderAmounts = orderTokenNetAmounts.get(orderHash)!;

				// Initialize amounts for both tokens if not exists
				if (!orderAmounts.has(inputTokenAddress)) {
					orderAmounts.set(inputTokenAddress, ethers.BigNumber.from(0));
				}
				if (!orderAmounts.has(outputTokenAddress)) {
					orderAmounts.set(outputTokenAddress, ethers.BigNumber.from(0));
				}

				// Update net amounts for this order
				orderAmounts.set(
					inputTokenAddress,
					orderAmounts
						.get(inputTokenAddress)!
						.add(ethers.BigNumber.from(trade.inputVaultBalanceChange.amount).abs())
				);

				orderAmounts.set(
					outputTokenAddress,
					orderAmounts
						.get(outputTokenAddress)!
						.sub(ethers.BigNumber.from(trade.outputVaultBalanceChange.amount).abs())
				);

				const amountIn = ethers.utils.formatUnits(
					ethers.BigNumber.from(trade.inputVaultBalanceChange.amount).abs().toString(),
					trade.inputVaultBalanceChange.vault.token.decimals
				);
				const amountOut = ethers.utils.formatUnits(
					ethers.BigNumber.from(trade.outputVaultBalanceChange.amount).abs().toString(),
					trade.outputVaultBalanceChange.vault.token.decimals
				);

				let amountInUsd = '0';
				let amountOutUsd = '0';
				if (tokenPriceUsdMap.has(trade.inputVaultBalanceChange.vault.token.address)) {
					const tokenPriceMap = tokenPriceUsdMap.get(
						trade.inputVaultBalanceChange.vault.token.address
					);
					amountInUsd = (parseFloat(amountIn) * (tokenPriceMap?.price ?? 0)).toString();
				}
				if (tokenPriceUsdMap.has(trade.outputVaultBalanceChange.vault.token.address)) {
					const tokenPriceMap = tokenPriceUsdMap.get(
						trade.outputVaultBalanceChange.vault.token.address
					);
					amountOutUsd = (parseFloat(amountOut) * (tokenPriceMap?.price ?? 0)).toString();
				}
				const fp18AmountIn = ethers.BigNumber.from(trade.inputVaultBalanceChange.amount)
					.abs()
					.mul(
						ethers.BigNumber.from(
							'1' + '0'.repeat(18 - trade.inputVaultBalanceChange.vault.token.decimals)
						)
					);
				const fp18AmountOut = ethers.BigNumber.from(trade.outputVaultBalanceChange.amount)
					.abs()
					.mul(
						ethers.BigNumber.from(
							'1' + '0'.repeat(18 - trade.outputVaultBalanceChange.vault.token.decimals)
						)
					);
				const ioRatio = fp18AmountOut.gt(ethers.BigNumber.from(0))
					? fp18AmountIn
							.mul(ethers.BigNumber.from('1' + '0'.repeat(18)))
							.div(fp18AmountOut)
							.toString()
					: ethers.BigNumber.from(0).toString();
				const tokenInBalance = ethers.utils.formatUnits(
					ethers.BigNumber.from(trade.inputVaultBalanceChange.newVaultBalance).toString(),
					trade.inputVaultBalanceChange.vault.token.decimals
				);
				const tokenOutBalance = ethers.utils.formatUnits(
					ethers.BigNumber.from(trade.outputVaultBalanceChange.newVaultBalance).toString(),
					trade.outputVaultBalanceChange.vault.token.decimals
				);
				const dsfParams = getDsfParams(trade.order.meta);
				raindexData.push({
					blockNumber: trade.tradeEvent.transaction.blockNumber,
					timestamp: trade.tradeEvent.transaction.timestamp,
					transactionHash: trade.tradeEvent.transaction.id,
					orderHash: trade.order.orderHash,
					orderMeta: trade.order.meta,
					orderType: isOrderDsf(trade.order.meta) ? 'DSF' : 'NON-DSF',
					sender: trade.tradeEvent.transaction.from,
					tokenIn: {
						address: trade.inputVaultBalanceChange.vault.token.address,
						decimals: trade.inputVaultBalanceChange.vault.token.decimals,
						symbol: trade.inputVaultBalanceChange.vault.token.symbol,
						id: trade.inputVaultBalanceChange.vault.token.id
					},
					tokenOut: {
						address: trade.outputVaultBalanceChange.vault.token.address,
						decimals: trade.outputVaultBalanceChange.vault.token.decimals,
						symbol: trade.outputVaultBalanceChange.vault.token.symbol,
						id: trade.outputVaultBalanceChange.vault.token.id
					},
					amountIn: amountIn,
					amountOut: amountOut,
					amountInUsd: amountInUsd,
					amountOutUsd: amountOutUsd,
					tokenInBalance: tokenInBalance,
					tokenOutBalance: tokenOutBalance,
					ioRatio: ethers.utils.formatUnits(ioRatio, 18),
					netTokenInAmount: ethers.utils.formatUnits(
						orderAmounts.get(inputTokenAddress)?.toString() || '0',
						trade.inputVaultBalanceChange.vault.token.decimals
					),
					netTokenOutAmount: ethers.utils.formatUnits(
						orderAmounts.get(outputTokenAddress)?.toString() || '0',
						trade.outputVaultBalanceChange.vault.token.decimals
					),
					minTradeAmount: dsfParams[0] || 0,
					maxTradeAmount: dsfParams[1] || 0,
					nextTradeMultiplier: dsfParams[2] || 0,
					costBasisMultiplier: dsfParams[3] || 0,
					epochs: dsfParams[4] || 0,
					amount0FastExit: dsfParams[5] || 0,
					amount1FastExit: dsfParams[6] || 0
				});
			}
			currentPage = 1;
			totalPages = Math.ceil(raindexData.length / itemsPerPage);
			updateVisibleTrades();
			isLoading = false;

			// Create unique order hashes map
			orderHashMap = new Map(raindexData.map((trade) => [trade.orderHash, trade.orderHash]));
			// Create unique token symbols map
			tokenSymbolMap = new Map(
				Array.from(
					new Set([
						...raindexData.map((trade) => `${trade.tokenIn.symbol}-${trade.tokenIn.address}`),
						...raindexData.map((trade) => `${trade.tokenOut.symbol}-${trade.tokenOut.address}`)
					])
				)
					.filter(Boolean)
					.map((key) => {
						const [symbol, address] = key.split('-');
						return [key, { symbol, address }];
					})
			);
		} catch {
			isLoading = false;
		}
	}

	function exportToCsv() {
		if (!raindexData || raindexData.length === 0) return;

		const dataToExport = filterRaindexData(raindexData);
		const headers = [
			'Timestamp',
			'Order Hash',
			'Order Type',
			'Token In',
			'Token In Address',
			'Token Out',
			'Token Out Address',
			'Amount In',
			'Amount Out',
			'Amount In Usd',
			'Amount Out Usd',
			'IO Ratio',
			'Token In Balance',
			'Token Out Balance',
			'Net Token In Amount',
			'Net Token Out Amount',
			'Sender',
			'Transaction Hash',
			'Min Trade Amount',
			'Max Trade Amount',
			'Next Trade Multiplier',
			'Cost Basis Multiplier',
			'Epochs',
			'Amount 0 Fast Exit',
			'Amount 1 Fast Exit'
		];

		const csvData = dataToExport.map((item: DsfData) => [
			item.timestamp,
			item.orderHash,
			item.orderType,
			item.tokenIn.symbol,
			item.tokenIn.address,
			item.tokenOut.symbol,
			item.tokenOut.address,
			item.amountIn,
			item.amountOut,
			item.amountInUsd,
			item.amountOutUsd,
			item.ioRatio,
			item.tokenInBalance,
			item.tokenOutBalance,
			item.netTokenInAmount,
			item.netTokenOutAmount,
			item.sender,
			item.transactionHash,
			item.minTradeAmount,
			item.maxTradeAmount,
			item.nextTradeMultiplier,
			item.costBasisMultiplier,
			item.epochs,
			item.amount0FastExit,
			item.amount1FastExit
		]);

		const csvContent = [headers.join(','), ...csvData.map((row) => row.join(','))].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', `${token}-${network}-${fromTimestamp}-${toTimestamp}.csv`);
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

<div class="flex min-h-screen flex-col p-2 md:p-4">
	<div class="mb-3 flex flex-col items-center gap-2 md:mb-5 md:gap-4">
		<h2 class="text-lg font-bold text-gray-800 md:text-2xl">Raindex Dynamic Spread Data</h2>
	</div>
	<div
		class="mb-3 flex flex-col items-center gap-2 overflow-x-auto rounded-lg bg-white p-2 shadow-sm md:mb-5 md:flex-row md:gap-4 md:p-3"
	>
		<div class="w-full md:w-40">
			<select
				id="network-select"
				class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 md:px-3 md:py-2 md:text-sm"
				bind:value={network}
			>
				<option value="">Network</option>
				{#each Object.keys($settings.networks) as network}
					<option value={network}>{network}</option>
				{/each}
			</select>
		</div>

		<div class="w-full md:w-40">
			<select
				id="token-select"
				class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 md:px-3 md:py-2 md:text-sm"
				bind:value={token}
			>
				<option value="">Token</option>
				{#each Object.keys(tokenConfig).filter((token) => tokenConfig[token].network === network) as token}
					<option value={token}>{token}</option>
				{/each}
			</select>
		</div>

		<div class="w-full md:w-44">
			<input
				type="datetime-local"
				placeholder="From"
				class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 md:px-3 md:py-2 md:text-sm"
				bind:value={fromTimestamp}
			/>
		</div>

		<div class="w-full md:w-44">
			<input
				type="datetime-local"
				placeholder="To"
				class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 md:px-3 md:py-2 md:text-sm"
				bind:value={toTimestamp}
			/>
		</div>

		<div class="w-full md:w-auto">
			<button
				on:click={getRaindexData}
				disabled={!fromTimestamp || !toTimestamp || !network || !token}
				class="w-full rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:px-4 md:py-2 md:text-sm"
			>
				Apply
			</button>
		</div>
	</div>

	{#if isLoading}
		<div class="mt-4 flex flex-col items-center justify-start md:mt-10">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600 md:h-10 md:w-10"
			></div>
			<p class="mt-2 text-base font-medium text-gray-600 md:mt-3 md:text-lg">Loading...</p>
		</div>
	{/if}
	{#if raindexData && raindexData.length > 0}
		<div class="mb-2 flex flex-col gap-2 md:mb-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<button
						on:click={prevPage}
						disabled={currentPage === 1}
						class="rounded bg-gray-200 px-3 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Previous
					</button>
					<span class="text-sm text-gray-600">
						Page {currentPage} of {totalPages}
					</span>
					<button
						on:click={nextPage}
						disabled={currentPage === totalPages}
						class="rounded bg-gray-200 px-3 py-1.5 text-sm font-bold text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Next
					</button>
				</div>
				<div class="flex items-center gap-4">
					<div class="w-64">
						<select
							bind:value={selectedOrderHash}
							class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
						>
							<option value="">Filter by Order Hash</option>
							{#each Array.from(orderHashMap.keys()) as hash}
								<option value={hash}>{hash.slice(0, 6)}...{hash.slice(-4)}</option>
							{/each}
						</select>
					</div>
					<div class="w-64">
						<select
							bind:value={selectedTokenSymbol}
							class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
						>
							<option value="">Filter by Token</option>
							{#each filteredTokens as token}
								<option value={`${token.symbol}-${token.address}`}>
									{token.symbol}
								</option>
							{/each}
						</select>
					</div>
					<button
						on:click={exportToCsv}
						class="rounded bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700 md:px-4 md:py-2 md:text-base"
					>
						Export to CSV
					</button>
				</div>
			</div>
		</div>
		<div class="overflow-x-auto rounded-lg border">
			<div class="inline-block min-w-full align-middle">
				<div class="overflow-hidden">
					<Table class="min-w-full">
						<TableHead class="sticky top-0 z-10 border-b border-gray-200 bg-gray-50">
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Timestamp
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Order Hash
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Token In
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Token In Address
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Token Out
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Token Out Address
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Amount In
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Amount Out
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								IO Ratio
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Token In Balance
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Token Out Balance
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Net Token In Amount
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Net Token Out Amount
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Sender
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Transaction Hash
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Min Trade Amount
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Max Trade Amount
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Next Trade Multiplier
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Cost Basis Multiplier
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Epochs
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Amount 0 Fast Exit
							</TableHeadCell>
							<TableHeadCell
								class="whitespace-nowrap px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-900 md:px-4 md:py-3 md:text-xs"
							>
								Amount 1 Fast Exit
							</TableHeadCell>
						</TableHead>
						<TableBody tableBodyClass="divide-y divide-gray-200">
							{#each visibleTrades as trade}
								<TableBodyRow class="hover:bg-gray-50">
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{new Date(trade.timestamp * 1000).toLocaleString()}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										<a
											href={`https://v2.raindex.finance/orders/${network}-${trade.orderHash}`}
											target="_blank"
											class="text-blue-500 hover:text-blue-600"
										>
											{trade.orderHash.slice(0, 6)}...{trade.orderHash.slice(-4)}
										</a>
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.tokenIn.symbol}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.tokenIn.address}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.tokenOut.symbol}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.tokenOut.address}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{parseFloat(trade.amountIn).toFixed(2)}
										{trade.tokenIn.symbol} (${parseFloat(trade.amountInUsd).toFixed(2)})
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{parseFloat(trade.amountOut).toFixed(2)}
										{trade.tokenOut.symbol} (${parseFloat(trade.amountOutUsd).toFixed(2)})
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{parseFloat(trade.ioRatio).toFixed(6)}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.tokenInBalance}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.tokenOutBalance}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.netTokenInAmount}
										{trade.tokenIn.symbol}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.netTokenOutAmount}
										{trade.tokenOut.symbol}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.sender}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.transactionHash}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.minTradeAmount}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.maxTradeAmount}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.nextTradeMultiplier}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.costBasisMultiplier}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.epochs}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.amount0FastExit}
									</TableBodyCell>
									<TableBodyCell
										class="whitespace-nowrap px-2 py-2 text-[10px] text-gray-600 md:px-4 md:py-3 md:text-sm"
									>
										{trade.amount1FastExit}
									</TableBodyCell>
								</TableBodyRow>
							{/each}
						</TableBody>
					</Table>
				</div>
			</div>
		</div>
	{:else if !isLoading}
		{#if !fromTimestamp || !toTimestamp || !network || !token}
			<div class="mt-4 text-center text-sm text-gray-500 md:text-base">
				Please select the parameters and submit the query.
			</div>
		{:else if raindexData && raindexData.length === 0}
			<div class="mt-4 text-center text-sm text-gray-500 md:text-base">
				No raindex data available for the selected parameters.
			</div>
		{/if}
	{/if}
</div>
