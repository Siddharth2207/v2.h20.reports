export const ssr = false;

import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
	window.Buffer = Buffer;
}


import { settings } from '$lib/stores/report';
export const load = async ({ fetch }) => {
	const response = await fetch(
		'https://raw.githubusercontent.com/rainlanguage/rain.strategies/refs/heads/main/settings.json'
	);
	const settingsJson = await response.json();
	settings.set(settingsJson);
	return {
		stores: {
			settings
		}
	};
};
