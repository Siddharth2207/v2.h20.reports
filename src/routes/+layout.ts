import { ConfigSource } from '@rainlanguage/orderbook/js_api';
import { writable, derived } from 'svelte/store';

export const load = async ({ fetch }) => {
	const response = await fetch(
		'https://raw.githubusercontent.com/rainlanguage/rain.strategies/refs/heads/main/settings.json'
	);
	const settingsJson = await response.json();
	const settings = writable<ConfigSource | undefined>(settingsJson);
	return {
		stores: {
			settings
		}
	};
};

export const ssr = false;
