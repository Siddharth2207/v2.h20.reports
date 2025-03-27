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
	import { formatBalance } from '$lib/orders';

	const tokenSymbol = tokenConfig[$tokenSlug.toUpperCase()]?.symbol;
	const tokenAddress = tokenConfig[$tokenSlug.toUpperCase()]?.address;

	let dashboard: HTMLElement;
	let errorMessage: string = '';
	let orders: OrderListOrderWithSubgraphName[] = [];
	let loading = true;
	let isLoading = false;
	let isInitialized = true;

	let fromTimestamp: string;
	let toTimestamp: string;

	// Convert date string to timestamp
	function dateStringToTimestamp(dateString: string): number {
		return Math.floor(new Date(dateString).getTime() / 1000);
	}

	// Handle date changes
	async function handleDateChange() {
		if (isLoading) return;
		if (fromTimestamp && toTimestamp) {
			fetchAndCreateDashboard();
		}
	}

	async function fetchAndCreateDashboard() {
		if (isLoading) return;
		isLoading = true;
		loading = true;
		while (dashboard.firstChild) {
			dashboard.removeChild(dashboard.firstChild);
		}
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

		// Only create dashboard if element exists
		if (dashboard) {
			// Clear existing content
			dashboard.innerHTML = '';

			// Create container
			const container = document.createElement('div');
			container.className = 'p-4 mb-6';

			// Update the card classes to be more responsive
			const cardBaseClass = `
				backdrop-blur-lg 
				bg-white/20 
				rounded-2xl 
				p-4 
				sm:p-6 
				lg:p-8 
				min-h-[140px] 
				sm:min-h-[160px] 
				shadow-xl 
				border 
				border-white/20 
				flex 
				items-center 
				justify-center
			`;

			// Create tokens map with prices
			const tokensMap = new Map();

			// First collect all unique tokens
			orders.forEach((order) => {
				[...order.order.inputs, ...order.order.outputs].forEach((vault) => {
					if (!tokensMap.has(vault.token.address.toLowerCase())) {
						tokensMap.set(vault.token.address.toLowerCase(), {
							address: vault.token.address,
							symbol: vault.token.symbol,
							decimals: vault.token.decimals,
							price: 0 // Initialize price to 0
						});
					}
				});
			});

			// Then fetch all prices in parallel
			await Promise.all(
				Array.from(tokensMap.values()).map(async (token) => {
					const tokenPrice = await getTokenPriceUsd(token.address, token.symbol);
					token.price = tokenPrice.currentPrice;
				})
			);

			// Now create the tokensArray and proceed with balance cards
			const tokensArray = Array.from(tokensMap.values());

			// Create orders section container
			const ordersSection = document.createElement('div');
			ordersSection.className = 'mb-8'; // Add margin bottom for spacing between sections

			// Add orders heading
			const ordersHeading = document.createElement('h2');
			ordersHeading.className = 'text-xl font-semibold text-gray-800 mb-4';
			ordersHeading.textContent = 'Orders';
			ordersSection.appendChild(ordersHeading);

			// Create metrics grid
			const ordersGrid = document.createElement('div');
			ordersGrid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-4 px-4';

			// Create a combined orders card
			const combinedOrdersCard = document.createElement('div');
			combinedOrdersCard.className = `${cardBaseClass} flex flex-col sm:flex-row gap-4`;
			combinedOrdersCard.innerHTML = `
				<div class="flex-1 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-200 pb-4 sm:pb-0 sm:pr-4">
					<div class="text-sm font-medium text-gray-800 mb-2">Total Orders</div>
					<div class="text-2xl sm:text-3xl font-bold text-gray-600">${orders.length}</div>
				</div>
				
				<div class="flex-1 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-200 pb-4 sm:pb-0 sm:pr-4">
					<div class="text-sm font-medium text-gray-800 mb-2">Active Orders</div>
					<div class="text-2xl sm:text-3xl font-bold text-gray-600">${orders.filter((order) => order.order.active).length}</div>
				</div>
				
				<div class="flex-1 flex flex-col items-center justify-center">
					<div class="text-sm font-medium text-gray-800 mb-2">Inactive Orders</div>
					<div class="text-2xl sm:text-3xl font-bold text-gray-600">${orders.filter((order) => !order.order.active).length}</div>
				</div>
			`;
			ordersGrid.appendChild(combinedOrdersCard);

			// Create combined ROI metrics card
			const combinedRoiMetricsCard = document.createElement('div');
			combinedRoiMetricsCard.className = `${cardBaseClass} flex flex-col sm:flex-row gap-4`;
			combinedRoiMetricsCard.innerHTML = `
				<div class="flex-1 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-200 pb-4 sm:pb-0 sm:pr-4">
					<div class="text-sm font-medium text-gray-600 mb-1">Total ROI</div>
					<div class="text-2xl sm:text-3xl font-bold text-gray-600">$ ${formatBalance(orders.reduce((acc, order) => acc + order.order.roi, 0))}</div>
				</div>
				
				<div class="flex-1 flex flex-col items-center justify-center">
					<div class="text-sm font-medium text-gray-600 mb-1">ROI Percentage</div>
					<div class="text-2xl sm:text-3xl font-bold text-gray-600">${formatBalance(orders.reduce((acc, order) => acc + order.order.roiPercentage, 0))}%</div>
				</div>
			`;
			ordersGrid.appendChild(combinedRoiMetricsCard);

			// Create combined ROI card
			const combinedRoiCard = document.createElement('div');
			combinedRoiCard.className = `${cardBaseClass} flex flex-col sm:flex-row gap-4`;
			combinedRoiCard.innerHTML = `
				<div class="flex-1 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-200 pb-4 sm:pb-0 sm:pr-4">
					<div class="text-sm font-medium text-gray-600 mb-1">Orders With Positive ROI</div>
					<div class="text-2xl sm:text-3xl font-bold text-green-600">${orders.filter((order) => order.order.roi > 0).length}</div>
				</div>
				
				<div class="flex-1 flex flex-col items-center justify-center">
					<div class="text-sm font-medium text-gray-600 mb-1">Orders With Negative ROI</div>
					<div class="text-2xl sm:text-3xl font-bold text-red-600">${orders.filter((order) => order.order.roi < 0).length}</div>
				</div>
			`;
			ordersGrid.appendChild(combinedRoiCard);

			// Add orders grid to section
			ordersSection.appendChild(ordersGrid);

			// Create balances section
			const balancesSection = document.createElement('div');
			balancesSection.className = 'mb-8';

			// Add balances heading
			const balancesHeading = document.createElement('h2');
			balancesHeading.className = 'text-xl font-semibold text-gray-800 mb-4';
			balancesHeading.textContent = 'Balances';
			balancesSection.appendChild(balancesHeading);

			// Create balance grid
			const balanceGrid = document.createElement('div');
			balanceGrid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-4';

			// Create balance cards for each token
			tokensArray.forEach((token) => {
				const totalTokenBalance = Array.from(
					new Map(
						orders.flatMap((order) =>
							[...order.order.inputs, ...order.order.outputs]
								.filter(
									(vault) => vault.token.address.toLowerCase() === token.address.toLowerCase()
								)
								.map((vault) => [vault.id, vault])
						)
					).values()
				).reduce(
					(acc, vault) =>
						acc +
						parseFloat(ethers.utils.formatUnits(vault.balance, vault.token.decimals).toString()),
					0
				);

				const totalBalanceUsd = totalTokenBalance * token.price;

				// Create combined balance card
				const combinedBalanceCard = document.createElement('div');
				combinedBalanceCard.className = `${cardBaseClass} flex flex-col sm:flex-row gap-4`;
				combinedBalanceCard.innerHTML = `
					<div class="flex-1 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-200 pb-4 sm:pb-0 sm:pr-4">
						<div class="text-sm font-medium text-gray-800 mb-2">Total ${token.symbol} Balance</div>
						<div class="text-2xl sm:text-3xl font-bold text-gray-600">${formatBalance(totalTokenBalance)}</div>
					</div>
					
					<div class="flex-1 flex flex-col items-center justify-center">
						<div class="text-sm font-medium text-gray-800 mb-2">Total ${token.symbol} Balance in USD</div>
						<div class="text-2xl sm:text-3xl font-bold text-gray-600">$ ${formatBalance(totalBalanceUsd)}</div>
					</div>
				`;
				balanceGrid.appendChild(combinedBalanceCard);
			});

			// Add balance grid to section
			balancesSection.appendChild(balanceGrid);

			// Create volumes section
			const volumesSection = document.createElement('div');
			volumesSection.className = 'mb-8';

			// Add volumes heading
			const volumesHeading = document.createElement('h2');
			volumesHeading.className = 'text-xl font-semibold text-gray-800 mb-4';
			volumesHeading.textContent = 'Volumes';
			volumesSection.appendChild(volumesHeading);

			// Create volume grid
			const volumeGrid = document.createElement('div');
			volumeGrid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-4';

			// Create volume cards for each token
			tokensArray.forEach((token) => {
				const totalVolume = orders
					.reduce(
						(acc, order) =>
							acc +
							order.order.totalVolume
								.filter((volume) => volume.tokenAddress === token.address)
								.reduce((acc, volume) => acc + volume.totalVolume, 0),
						0
					)
					.toFixed(2);

				const totalVolumeUsd = parseFloat(totalVolume) * token.price;

				const totalVolumeCard = document.createElement('div');
				totalVolumeCard.className = `${cardBaseClass} flex flex-col sm:flex-row gap-4`;
				totalVolumeCard.innerHTML = `
					<div class="flex-1 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-200 pb-4 sm:pb-0 sm:pr-4">
						<div class="text-sm font-medium text-gray-600 mb-1">Total ${token.symbol} Volume</div>
						<div class="text-2xl sm:text-3xl font-bold text-gray-600">${formatBalance(parseFloat(totalVolume))}</div>
					</div>
					
					<div class="flex-1 flex flex-col items-center justify-center">
						<div class="text-sm font-medium text-gray-600 mb-1">Total ${token.symbol} Volume in USD</div>
						<div class="text-2xl sm:text-3xl font-bold text-gray-600">$ ${formatBalance(totalVolumeUsd)}</div>
					</div>
				`;
				volumeGrid.appendChild(totalVolumeCard);
			});

			// Add volume grid to section
			volumesSection.appendChild(volumeGrid);

			// Create volumes section
			const totalDepositsSection = document.createElement('div');
			totalDepositsSection.className = 'mb-8';

			// Add volumes heading
			const totalDepositsHeading = document.createElement('h2');
			totalDepositsHeading.className = 'text-xl font-semibold text-gray-800 mb-4';
			totalDepositsHeading.textContent = 'Total Deposits';
			totalDepositsSection.appendChild(totalDepositsHeading);

			// Create volume grid
			const totalDepositsGrid = document.createElement('div');
			totalDepositsGrid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-4';

			tokensArray.forEach((token) => {
				const totalDeposits = orders
					.reduce(
						(acc, order) =>
							acc +
							order.order.outputs
								.filter((output) => output.token.address === token.address)
								.reduce((acc, output) => acc + output.totalDeposits, 0),
						0
					)
					.toFixed(2);

				const totalDepositsUsd = parseFloat(totalDeposits) * token.price;

				const totalDepositsCard = document.createElement('div');
				totalDepositsCard.className = `${cardBaseClass} flex flex-col sm:flex-row gap-4`;
				totalDepositsCard.innerHTML = `
					<div class="flex-1 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-200 pb-4 sm:pb-0 sm:pr-4">
						<div class="text-sm font-medium text-gray-600 mb-1">Total ${token.symbol} Deposits</div>
						<div class="text-2xl sm:text-3xl font-bold text-gray-600">${formatBalance(parseFloat(totalDeposits))}</div>
					</div>
					
					<div class="flex-1 flex flex-col items-center justify-center">
						<div class="text-sm font-medium text-gray-600 mb-1">Total ${token.symbol} Deposits in USD</div>
						<div class="text-2xl sm:text-3xl font-bold text-gray-600">$ ${formatBalance(totalDepositsUsd)}</div>
					</div>
				`;
				totalDepositsGrid.appendChild(totalDepositsCard);
			});

			totalDepositsSection.appendChild(totalDepositsGrid);

			const totalWithdrawalsSection = document.createElement('div');
			totalWithdrawalsSection.className = 'mb-8';

			const totalWithdrawalsHeading = document.createElement('h2');
			totalWithdrawalsHeading.className = 'text-xl font-semibold text-gray-800 mb-4';
			totalWithdrawalsHeading.textContent = 'Total Withdrawals';
			totalWithdrawalsSection.appendChild(totalWithdrawalsHeading);

			const totalWithdrawalsGrid = document.createElement('div');
			totalWithdrawalsGrid.className = 'grid grid-cols-1 lg:grid-cols-3 gap-4';

			tokensArray.forEach((token) => {
				const totalWithdrawals = orders
					.reduce(
						(acc, order) =>
							acc +
							order.order.inputs
								.filter((input) => input.token.address === token.address)
								.reduce((acc, input) => acc + input.totalDeposits, 0),
						0
					)
					.toFixed(2);

				const totalWithdrawalsUsd = parseFloat(totalWithdrawals) * token.price;

				const totalWithdrawalsCard = document.createElement('div');
				totalWithdrawalsCard.className = `${cardBaseClass} flex flex-col sm:flex-row gap-4`;
				totalWithdrawalsCard.innerHTML = `
					<div class="flex-1 flex flex-col items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-200 pb-4 sm:pb-0 sm:pr-4">
						<div class="text-sm font-medium text-gray-600 mb-1">Total ${token.symbol} Withdrawals</div>
						<div class="text-2xl sm:text-3xl font-bold text-gray-600">${formatBalance(parseFloat(totalWithdrawals))}</div>
					</div>
					
					<div class="flex-1 flex flex-col items-center justify-center">
						<div class="text-sm font-medium text-gray-600 mb-1">Total ${token.symbol} Withdrawals in USD</div>
						<div class="text-2xl sm:text-3xl font-bold text-gray-600">$ ${formatBalance(totalWithdrawalsUsd)}</div>
					</div>
				`;
				totalWithdrawalsGrid.appendChild(totalWithdrawalsCard);
			});

			totalWithdrawalsSection.appendChild(totalWithdrawalsGrid);

			// Add sections to dashboard
			container.appendChild(ordersSection);
			container.appendChild(balancesSection);
			container.appendChild(volumesSection);
			container.appendChild(totalDepositsSection);
			container.appendChild(totalWithdrawalsSection);
			dashboard.appendChild(container);
		}

		loading = false;
		isLoading = false;
	}

	onMount(async () => {
		await fetchAndCreateDashboard();
		isInitialized = false;
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

		// Add date filtering
		const fromTime = fromTimestamp ? dateStringToTimestamp(fromTimestamp) : 0;
		const toTime = toTimestamp
			? dateStringToTimestamp(toTimestamp) + 86400
			: Number.MAX_SAFE_INTEGER;

		raindexOrders = raindexOrders.filter((order: OrderListOrderWithSubgraphName) => {
			const orderTimestamp = parseFloat(order.order.timestampAdded);
			return (
				orderTimestamp >= fromTime &&
				orderTimestamp <= toTime &&
				(order.order.inputs.some(
					(input: OrderListVault) =>
						input.token.address.toLowerCase() === tokenAddress.toLowerCase()
				) ||
					order.order.outputs.some(
						(output: OrderListVault) =>
							output.token.address.toLowerCase() === tokenAddress.toLowerCase()
					))
			);
		});

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

{#if errorMessage}
	<div
		class="error-message relative rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700"
		role="alert"
	>
		<span class="block sm:inline">{errorMessage}</span>
	</div>
{/if}

<div class="mb-4 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
	<div class="text-center sm:text-left">
		<h2 class="text-2xl font-semibold text-gray-800">
			{tokenSymbol} Dashboard
		</h2>
	</div>

	{#if !isInitialized}
		<div class="flex flex-col gap-4 sm:flex-row">
			<div class="flex w-full flex-col sm:w-auto">
				<label for="from-date" class="mb-1 text-sm text-gray-600">From Date</label>
				<input
					id="from-date"
					type="date"
					bind:value={fromTimestamp}
					on:change={handleDateChange}
					class="w-full rounded border p-2"
				/>
			</div>
			<div class="flex w-full flex-col sm:w-auto">
				<label for="to-date" class="mb-1 text-sm text-gray-600">To Date</label>
				<input
					id="to-date"
					type="date"
					bind:value={toTimestamp}
					on:change={handleDateChange}
					class="w-full rounded border p-2"
				/>
			</div>
		</div>
	{/if}
</div>
<hr class=" w-full border-t border-gray-200" />
{#if loading}
	<div class="mt-10 flex flex-col items-center justify-start">
		<div
			class="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600"
		></div>
		<p class="mt-3 text-lg font-medium text-gray-600">Loading...</p>
	</div>
{/if}

<div bind:this={dashboard} class="dashboard-container"></div>
