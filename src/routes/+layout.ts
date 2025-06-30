import yaml from 'js-yaml';
export const ssr = false;

import { settings } from '$lib/stores/report';
export const load = async ({ fetch }) => {
	const response = await fetch(
		'https://raw.githubusercontent.com/rainlanguage/rain.strategies/refs/heads/main/settings.yaml'
	);
	const yamlText = await response.text();

	// Quote hex addresses to prevent them from being parsed as numbers
	const processedYamlText = yamlText.replace(/(0x[a-fA-F0-9]{40})/g, '"$1"');

	// Parse the processed YAML
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const settingsJson = yaml.load(processedYamlText) as any;

	// Transform networks from rpcs arrays to single rpc strings
	if (settingsJson.networks) {
		Object.keys(settingsJson.networks).forEach((networkKey) => {
			const network = settingsJson.networks[networkKey];
			if (network.rpcs && Array.isArray(network.rpcs) && network.rpcs.length > 0) {
				network.rpc = network.rpcs[0]; // Take the first RPC from the array
				delete network.rpcs; // Remove the rpcs array
			}
		});
	}
	settings.set(settingsJson);
	return {
		stores: {
			settings
		}
	};
};
