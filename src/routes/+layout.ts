import { ConfigSource } from '@rainlanguage/orderbook/js_api';
import { settings } from '$lib/stores/report';
export const load = async ({ fetch }) => {
	const response = await fetch(
		'https://raw.githubusercontent.com/rainlanguage/rain.strategies/refs/heads/2025-03-19-update-bsc-rpc-url/settings.json'
	);
	const settingsJson = await response.json();
	settings.set(settingsJson);
	return {
		stores: {
			settings
		}
	};
};

export const ssr = false;
