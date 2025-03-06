import { activeSubgraphs, network, tokenSlug } from './stores/report';
import { get } from 'svelte/store';
import { tokenConfig } from '$lib/constants';

import { getOrders, getOrderTradesList } from '@rainlanguage/orderbook/js_api';

export const getTokenOrders = async () => {
	const tokenSlugValue = get(tokenSlug);
	if (!tokenSlugValue) {
		throw new Error('Token slug is not set');
	}
	const tokenSymbol = tokenConfig[tokenSlugValue.toUpperCase()]?.symbol;
	const tokenAddress = tokenConfig[tokenSlugValue.toUpperCase()]?.address;

	if (!tokenSymbol || !tokenAddress) {
		throw new Error('Token symbol or address is not set');
	}

	const allOrders = await getOrders(
		get(activeSubgraphs),
		{
			owners: [],
			active: undefined,
			orderHash: undefined
		},
		{ page: 1, pageSize: 1000 }
	);

	const tokenFilteredOrders = allOrders.filter(
		(order: any) =>
			order.order.inputs.some(
				(input: any) =>
					input.token.symbol === tokenSymbol &&
					input.token.address.toLowerCase() === tokenAddress.toLowerCase()
			) ||
			order.order.outputs.some(
				(output: any) =>
					output.token.symbol === tokenSymbol &&
					output.token.address.toLowerCase() === tokenAddress.toLowerCase()
			)
	);

	for (let order of tokenFilteredOrders) {
		const orderId = order.order.id;
		const trades = await getOrderTradesList(
			get(activeSubgraphs).filter((subgraph) => subgraph.name === get(network))[0].url,
			orderId,
			{
				page: 1,
				pageSize: 1000
			}
		);
		order.order['trades'] = trades.sort(
			(a: any, b: any) => b.tradeEvent.transaction.timestamp - a.tradeEvent.transaction.timestamp
		);
	}

	console.log(tokenFilteredOrders[0].order.trades.length);

	return tokenFilteredOrders;
};

export function formatTimestamp(timestamp: number) {
	if (!timestamp || timestamp === 0) {
		return 'N/A';
	}

	const dateObj = new Date(timestamp * 1000);

	const date = dateObj.toLocaleDateString('en-GB', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});

	const time = dateObj.toLocaleTimeString('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});

	return `${date} ${time}`;
}

export const formatBalance = (balance: number) => {
	if (!balance || isNaN(balance)) return '0.00';

	const absValue = Math.abs(balance);
	const sign = balance < 0 ? '-' : '';

	const formatter = new Intl.NumberFormat('en-US', {
		notation: 'compact',
		maximumFractionDigits: 2
	});

	return sign + formatter.format(absValue);
};
