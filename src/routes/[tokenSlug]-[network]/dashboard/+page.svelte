<script lang="ts">
	import { ethers } from 'ethers';
	import type {
		SgTrade,
		MultiSubgraphArgs,
		SgVaultBalanceChangeUnwrapped
	} from '@rainlanguage/orderbook/js_api';
	import {
		getOrders,
		getOrderTradesList,
		getVaultBalanceChanges
	} from '@rainlanguage/orderbook/js_api';
	import { page } from '$app/stores';
	const { tokenSlug, network, activeSubgraphs } = $page.data.stores;
	import type {
		OrderListOrderWithSubgraphName,
		OrderListVault,
		OrderListTotalVolume
	} from '$lib/types';
	import {
		DEFAULT_ORDERS_PAGE_SIZE,
		DEFAULT_TRADES_PAGE_SIZE,
		DEFAULT_VAULTS_PAGE_SIZE,
		tokenConfig
	} from '$lib/constants';
	import { onMount } from 'svelte';
	import { getTokenPriceUsd } from '$lib/price';

	const tokenSymbol = tokenConfig[$tokenSlug.toUpperCase()]?.symbol;
	const tokenAddress = tokenConfig[$tokenSlug.toUpperCase()]?.address;

	let dashboard: HTMLElement;
	let errorMessage: string = '';
	let orders: OrderListOrderWithSubgraphName[] = [];
	let loading = true;
	let tokenUsdPrice: number = 0;

	async function fetchAndCreateDashboard() {
		orders = await fetchAllOrderWithTrades();
		orders = await getTokenPriceUsdMap(orders);
		orders = await orderWithVaultBalanceChanges(orders);

		for (let order of orders) {
			order.order['totalVolume'] = calculateTradeVolume(order.order.trades);
			order.order['totalVolume24h'] = calculateTradeVolume(
				order.order.trades.filter(
					(trade: SgTrade) => Date.now() / 1000 - parseFloat(trade.timestamp) <= 86400
				)
			);
		}
		orders = calculateTotalDepositsAndWithdrawals(orders);

		tokenUsdPrice = (await getTokenPriceUsd(tokenAddress, tokenSymbol)).currentPrice;
		// Only create dashboard if element exists
		if (dashboard) {
			// Clear existing content
			dashboard.innerHTML = '';

			// Create container
			const container = document.createElement('div');
			container.className = 'p-4 mb-6';

			// Add title
			const title = document.createElement('h2');
			title.className = 'text-center text-lg font-semibold mb-4 text-gray-800';
			title.textContent = `${tokenSymbol} Dashboard`;
			container.appendChild(title);

			// Create metrics grid
			const grid = document.createElement('div');
			grid.className = 'grid grid-cols-3 gap-2';

			// Total Orders
			const ordersCard = document.createElement('div');
			ordersCard.className =
				'backdrop-blur-lg bg-white/30 rounded-2xl p-8 min-h-[160px] shadow-xl border border-white/20 flex items-center justify-center';
			ordersCard.innerHTML = `
				<div class="text-center flex flex-col justify-center">
					<div class="text-sm font-medium text-gray-800 mb-2">Total Orders</div>
					<div class="text-3xl font-bold text-gray-600">${orders.length}</div>
				</div>
			`;

			// Active Orders
			const ordersActiveCard = document.createElement('div');
			ordersActiveCard.className =
				'backdrop-blur-lg bg-white/30 rounded-2xl p-8 min-h-[160px] shadow-xl border border-white/20 flex items-center justify-center';
			ordersActiveCard.innerHTML = `
				<div class="text-center flex flex-col justify-center">
					<div class="text-sm font-medium text-gray-800 mb-2">Total Active Orders</div>
					<div class="text-3xl font-bold text-gray-600">${orders.filter((order) => order.order.active).length}</div>
				</div>
			`;

			// Inactive Orders
			const ordersInactiveCard = document.createElement('div');
			ordersInactiveCard.className =
				'backdrop-blur-lg bg-white/30 rounded-2xl p-8 min-h-[160px] shadow-xl border border-white/20 flex items-center justify-center';
			ordersInactiveCard.innerHTML = `
				<div class="text-center">
					<div class="text-sm font-medium text-gray-800 mb-2">Total Inactive Orders</div>
					<div class="text-3xl font-bold text-gray-600">${orders.filter((order) => !order.order.active).length}</div>
				</div>
			`;

			// Total Trades
			const totalTradesCard = document.createElement('div');
			totalTradesCard.className =
				'backdrop-blur-lg bg-white/30 rounded-2xl p-8 min-h-[160px] shadow-xl border border-white/20 flex items-center justify-center';
			totalTradesCard.innerHTML = `
				<div class="text-center">
					<div class="text-sm font-medium text-gray-800 mb-2">Total Across All Orders Trades</div>
					<div class="text-3xl font-bold text-gray-600">${orders.reduce((acc, order) => acc + order.order.trades.length, 0)}</div>
				</div>
			`;

			// Token Balance
			const totalTokenBalanceCard = document.createElement('div');
			const totalTokenBalance = Array.from(
				new Map(
					orders.flatMap((order) =>
						[...order.order.inputs, ...order.order.outputs].map((vault) => [vault.id, vault])
					)
				).values()
			).reduce(
				(acc, vault) =>
					acc +
					parseFloat(ethers.utils.formatUnits(vault.balance, vault.token.decimals).toString()),
				0
			);

			totalTokenBalanceCard.className =
				'backdrop-blur-lg bg-white/30 rounded-2xl p-8 min-h-[160px] shadow-xl border border-white/20 flex items-center justify-center';
			totalTokenBalanceCard.innerHTML = `
				<div class="text-center">
					<div class="text-sm font-medium text-gray-800 mb-2">Total ${tokenSymbol} Balance</div>
					<div class="text-3xl font-bold text-gray-600">${totalTokenBalance.toFixed(4)}</div>
				</div>
			`;

			// USD Balance
			const totalBalanceUsdCard = document.createElement('div');
			const totalBalanceUsd = totalTokenBalance * tokenUsdPrice;
			totalBalanceUsdCard.className =
				'backdrop-blur-lg bg-white/30 rounded-2xl p-8 min-h-[160px] shadow-xl border border-white/20 flex items-center justify-center';
			totalBalanceUsdCard.innerHTML = `
				<div class="text-center">
					<div class="text-sm font-medium text-gray-800 mb-2">Total ${tokenSymbol} Balance in USD</div>
					<div class="text-3xl font-bold text-gray-600">$ ${totalBalanceUsd.toFixed(2)}</div>
				</div>
			`;

			const totalVolumeCard = document.createElement('div');
			totalVolumeCard.className =
				'backdrop-blur-lg bg-white/30 rounded-2xl p-8 min-h-[160px] shadow-xl border border-white/20 flex items-center justify-center';
			totalVolumeCard.innerHTML = `
                <div class="text-center">
                <div class="text-sm font-medium text-gray-600 mb-1">Total Volume</div>
                <div class="text-3xl font-bold text-gray-600">${orders
									.reduce(
										(acc, order) =>
											acc +
											order.order.totalVolume
												.filter((volume) => volume.tokenAddress === tokenAddress)
												.reduce((acc, volume) => acc + volume.totalVolume, 0),
										0
									)
									.toFixed(2)}</div>
            `;

			const totalROICard = document.createElement('div');
			totalROICard.className =
				'backdrop-blur-lg bg-white/30 rounded-2xl p-8 min-h-[160px] shadow-xl border border-white/20 flex items-center justify-center';
			totalROICard.innerHTML = `
                <div class="text-center">
                <div class="text-sm font-medium text-gray-600 mb-1">Total ROI</div>
                <div class="text-3xl font-bold text-gray-600">$ ${orders.reduce((acc, order) => acc + order.order.roi, 0).toFixed(2)}</div>
            `;

			const totalROIPercentageCard = document.createElement('div');
			totalROIPercentageCard.className =
				'backdrop-blur-lg bg-white/30 rounded-2xl p-8 min-h-[160px] shadow-xl border border-white/20 flex items-center justify-center';
			totalROIPercentageCard.innerHTML = `
                <div class="text-center">
                <div class="text-sm font-medium text-gray-600 mb-1">Total ROI Percentage</div>
                <div class="text-3xl font-bold text-gray-600">${orders.reduce((acc, order) => acc + order.order.roiPercentage, 0).toFixed(2)}%</div>
            `;

			const totalApyCard = document.createElement('div');
			totalApyCard.className =
				'backdrop-blur-lg bg-white/30 rounded-2xl p-8 min-h-[160px] shadow-xl border border-white/20 flex items-center justify-center';
			totalApyCard.innerHTML = `
                <div class="text-center">
                <div class="text-sm font-medium text-gray-600 mb-1">Total APY</div>
                <div class="text-3xl font-bold text-gray-600">$ ${orders.reduce((acc, order) => acc + order.order.apy, 0).toFixed(2)}</div>
            `;

			const totalApyPercentageCard = document.createElement('div');
			totalApyPercentageCard.className =
				'backdrop-blur-lg bg-white/30 rounded-2xl p-8 min-h-[160px] shadow-xl border border-white/20 flex items-center justify-center';
			totalApyPercentageCard.innerHTML = `
                <div class="text-center">
                <div class="text-sm font-medium text-gray-600 mb-1">Total APY Percentage</div>
                <div class="text-3xl font-bold text-gray-600">${orders.reduce((acc, order) => acc + order.order.apyPercentage, 0).toFixed(2)}%</div>
            `;

			const ordersPositiveRoiCard = document.createElement('div');
			ordersPositiveRoiCard.className =
				'backdrop-blur-lg bg-white/30 rounded-2xl p-8 min-h-[160px] shadow-xl border border-white/20 flex items-center justify-center';
			ordersPositiveRoiCard.innerHTML = `
                <div class="text-center">
                <div class="text-sm font-medium text-gray-600 mb-1">Total Orders With Positive ROI</div>
                <div class="text-3xl font-bold text-gray-600">${orders.filter((order) => order.order.roi > 0).length}</div>
            `;

			const ordersNegativeRoiCard = document.createElement('div');
			ordersNegativeRoiCard.className =
				'backdrop-blur-lg bg-white/30 rounded-2xl p-8 min-h-[160px] shadow-xl border border-white/20 flex items-center justify-center';
			ordersNegativeRoiCard.innerHTML = `
                <div class="text-center">
                <div class="text-sm font-medium text-gray-600 mb-1">Total Orders With Negative ROI</div>
                <div class="text-3xl font-bold text-gray-600">${orders.filter((order) => order.order.roi < 0).length}</div>
            `;
			grid.appendChild(ordersCard);
			grid.appendChild(ordersActiveCard);
			grid.appendChild(ordersInactiveCard);
			grid.appendChild(totalTradesCard);
			grid.appendChild(totalTokenBalanceCard);
			grid.appendChild(totalBalanceUsdCard);
			grid.appendChild(totalVolumeCard);
			grid.appendChild(totalROICard);
			grid.appendChild(totalROIPercentageCard);
			grid.appendChild(totalApyCard);
			grid.appendChild(totalApyPercentageCard);
			grid.appendChild(ordersPositiveRoiCard);
			grid.appendChild(ordersNegativeRoiCard);
			container.appendChild(grid);
			dashboard.appendChild(container);
		}

		loading = false;
	}

	onMount(() => {
		fetchAndCreateDashboard();
	});

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
				{ page: currentPage, pageSize: DEFAULT_ORDERS_PAGE_SIZE }
			);

			raindexOrders = [...raindexOrders, ...orders];
			hasMore = orders.length === DEFAULT_ORDERS_PAGE_SIZE;
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

	async function orderWithVaultBalanceChanges(
		orders: OrderListOrderWithSubgraphName[]
	): Promise<OrderListOrderWithSubgraphName[]> {
		for (const order of orders) {
			const vaultBalanceChangesMap = new Map();
			const allVaults = [...order.order.inputs, ...order.order.outputs];
			const uniqueVaults = allVaults.filter(
				(vault, index) => allVaults.findIndex((v) => v.id === vault.id) === index
			);
			for (const vault of uniqueVaults) {
				let allBalanceChanges: SgVaultBalanceChangeUnwrapped[] = [];
				let currentPage = 1;
				let hasMore = true;
				while (hasMore) {
					const balanceChanges = await getVaultBalanceChanges(
						$activeSubgraphs.find((subgraph: MultiSubgraphArgs) => subgraph.name === $network)
							?.url || '',
						vault.id,
						{ page: currentPage, pageSize: DEFAULT_VAULTS_PAGE_SIZE }
					);
					allBalanceChanges = [...allBalanceChanges, ...balanceChanges];
					hasMore = balanceChanges.length === DEFAULT_VAULTS_PAGE_SIZE;
					currentPage++;
				}
				vaultBalanceChangesMap.set(vault.id, allBalanceChanges);
			}
			order.order['inputs'] = order.order.inputs.map((input: OrderListVault) => ({
				...input,
				balanceChanges: vaultBalanceChangesMap.get(input.id) || []
			}));
			order.order['outputs'] = order.order.outputs.map((output: OrderListVault) => ({
				...output,
				balanceChanges: vaultBalanceChangesMap.get(output.id) || []
			}));
		}
		return orders;
	}

	async function getTokenPriceUsdMap(
		orders: OrderListOrderWithSubgraphName[]
	): Promise<OrderListOrderWithSubgraphName[]> {
		try {
			const tokenPriceUsdMap = new Map<string, number>();
			for (const order of orders) {
				for (const input of order.order.inputs) {
					if (tokenPriceUsdMap.has(input.token.address)) {
						continue;
					}
					const tokenPrice = await getTokenPriceUsd(input.token.address, input.token?.symbol || '');
					tokenPriceUsdMap.set(input.token.address, tokenPrice.currentPrice);
				}
				for (const output of order.order.outputs) {
					if (tokenPriceUsdMap.has(output.token.address)) {
						continue;
					}
					const tokenPrice = await getTokenPriceUsd(
						output.token.address,
						output.token?.symbol || ''
					);
					tokenPriceUsdMap.set(output.token.address, tokenPrice.currentPrice);
				}
				order.order['tokenPriceUsdMap'] = tokenPriceUsdMap;
			}
			for (const order of orders) {
				order.order['tokenPriceUsdMap'] = tokenPriceUsdMap;
			}
			return orders;
		} catch {
			errorMessage = 'Failed to get token price usd map';
			return orders;
		}
	}

	function calculateTradeVolume(trades: SgTrade[]): OrderListTotalVolume[] {
		try {
			const tokenVolumes: Record<string, { totalVolume: number; tokenAddress: string }> = {};
			for (const trade of trades) {
				if (trade.outputVaultBalanceChange) {
					const { vault, amount } = trade.outputVaultBalanceChange;
					if (vault && vault.token) {
						const { symbol, decimals, address } = vault.token;
						const volume = parseFloat(ethers.utils.formatUnits(amount, decimals).toString());

						if (symbol) {
							if (!tokenVolumes[symbol]) {
								tokenVolumes[symbol] = { totalVolume: 0, tokenAddress: address };
							}
							tokenVolumes[symbol].totalVolume += Math.abs(volume);
						}
					}
				}
				if (trade.inputVaultBalanceChange) {
					const { vault, amount } = trade.inputVaultBalanceChange;
					if (vault && vault.token) {
						const { symbol, decimals, address } = vault.token;
						const volume = parseFloat(ethers.utils.formatUnits(amount, decimals).toString());

						if (symbol) {
							if (!tokenVolumes[symbol]) {
								tokenVolumes[symbol] = { totalVolume: 0, tokenAddress: address };
							}
							tokenVolumes[symbol].totalVolume += Math.abs(volume);
						}
					}
				}
			}
			return Object.entries(tokenVolumes).map(([symbol, data]) => ({
				token: symbol,
				tokenAddress: data.tokenAddress,
				totalVolume: data.totalVolume
			}));
		} catch {
			errorMessage = 'Failed to calculate trades volume';
			return [];
		}
	}

	function calculateTotalDepositsAndWithdrawals(
		orders: OrderListOrderWithSubgraphName[]
	): OrderListOrderWithSubgraphName[] {
		try {
			for (const order of orders) {
				order.order['orderDuration'] = Date.now() / 1000 - parseFloat(order.order.timestampAdded);
				for (const input of order.order.inputs) {
					input['totalDeposits'] = input.balanceChanges
						.filter((change: SgVaultBalanceChangeUnwrapped) => change.__typename === 'Deposit')
						.reduce(
							(sum: number, change: SgVaultBalanceChangeUnwrapped) =>
								sum +
								parseFloat(
									ethers.utils.formatUnits(change.amount, input.token.decimals).toString()
								),
							0
						);
					input['totalWithdrawals'] = input.balanceChanges
						.filter((change: SgVaultBalanceChangeUnwrapped) => change.__typename === 'Withdrawal')
						.reduce(
							(sum: number, change: SgVaultBalanceChangeUnwrapped) =>
								sum +
								parseFloat(
									ethers.utils.formatUnits(change.amount, input.token.decimals).toString()
								),
							0
						);
					input['currentVaultInputs'] =
						input.totalWithdrawals +
						parseFloat(ethers.utils.formatUnits(input.balance, input.token.decimals).toString());
					input['curerentVaultDifferential'] = input.currentVaultInputs - input.totalDeposits;
					input['curerentVaultDifferentialPercentage'] =
						input.totalDeposits > 0
							? (input.curerentVaultDifferential / input.totalDeposits) * 100
							: 0;
					input['currentVaultApy'] =
						(input.curerentVaultDifferential * 31536000) / order.order.orderDuration;
					input['currentVaultApyPercentage'] =
						(input.curerentVaultDifferentialPercentage * 31536000) / order.order.orderDuration;
				}
				for (const output of order.order.outputs) {
					output['totalDeposits'] = output.balanceChanges
						.filter((change: SgVaultBalanceChangeUnwrapped) => change.__typename === 'Deposit')
						.reduce(
							(sum: number, change: SgVaultBalanceChangeUnwrapped) =>
								sum +
								parseFloat(
									ethers.utils.formatUnits(change.amount, output.token.decimals).toString()
								),
							0
						);
					output['totalWithdrawals'] = output.balanceChanges
						.filter((change: SgVaultBalanceChangeUnwrapped) => change.__typename === 'Withdrawal')
						.reduce(
							(sum: number, change: SgVaultBalanceChangeUnwrapped) =>
								sum +
								parseFloat(
									ethers.utils.formatUnits(change.amount, output.token.decimals).toString()
								),
							0
						);
					output['currentVaultInputs'] =
						output.totalWithdrawals +
						parseFloat(ethers.utils.formatUnits(output.balance, output.token.decimals).toString());
					output['curerentVaultDifferential'] = output.currentVaultInputs - output.totalDeposits;
					output['curerentVaultDifferentialPercentage'] =
						output.totalDeposits > 0
							? (output.curerentVaultDifferential / output.totalDeposits) * 100
							: 0;
					output['currentVaultApy'] =
						(output.curerentVaultDifferential * 31536000) / order.order.orderDuration;
					output['currentVaultApyPercentage'] =
						(output.curerentVaultDifferentialPercentage * 31536000) / order.order.orderDuration;
				}
				const currentOrderTotalDepositsUsd = order.order.outputs.reduce(
					(acc: number, output: OrderListVault) =>
						acc +
						output.totalDeposits * (order.order.tokenPriceUsdMap.get(output.token.address) || 0),
					0
				);
				const currentOrderTotalInputsUsd = order.order.inputs.reduce(
					(acc: number, input: OrderListVault) =>
						acc +
						input.currentVaultInputs * (order.order.tokenPriceUsdMap.get(input.token.address) || 0),
					0
				);
				order.order['roi'] = currentOrderTotalInputsUsd - currentOrderTotalDepositsUsd;
				order.order['roiPercentage'] =
					currentOrderTotalInputsUsd > 0
						? (order.order['roi'] / currentOrderTotalDepositsUsd) * 100
						: 0;
				order.order['apy'] = (order.order['roi'] * 31536000) / order.order.orderDuration;
				order.order['apyPercentage'] =
					(order.order['roiPercentage'] * 31536000) / order.order.orderDuration;
			}
			return orders;
		} catch {
			errorMessage = 'Failed to calculate total deposits and withdrawals';
			return orders;
		}
	}
</script>

<div bind:this={dashboard}></div>

{#if errorMessage}
	<div
		class="error-message relative rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
		role="alert"
	>
		<span class="block sm:inline">{errorMessage}</span>
	</div>
{/if}

{#if loading}
	<div class="mt-10 flex flex-col items-center justify-start">
		<div
			class="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"
		></div>
		<p class="mt-3 text-lg font-medium text-gray-600">Loading...</p>
	</div>
{/if}
