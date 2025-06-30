import { tokenSlug, network, activeSubgraphs, settings } from '$lib/stores/report';
import { networkBlockTime } from '$lib/constants';
import { type NetworkConfigSourceWithBlockTime } from '$lib/types';
import yaml from 'js-yaml';

export const load = async ({ fetch, params }) => {
	const response = await fetch(
		'https://raw.githubusercontent.com/rainlanguage/rain.strategies/refs/heads/main/settings.yaml'
	);
	const yamlText = await response.text();
	
	// Quote hex addresses to prevent them from being parsed as numbers
	const processedYamlText = yamlText.replace(/(0x[a-fA-F0-9]{40})/g, '"$1"');
	
	// Parse the processed YAML
	const settingsJson = yaml.load(processedYamlText) as any;

	// Transform networks from rpcs arrays to single rpc strings
	if (settingsJson.networks) {
		Object.keys(settingsJson.networks).forEach(networkKey => {
			const network = settingsJson.networks[networkKey];
			if (network.rpcs && Array.isArray(network.rpcs) && network.rpcs.length > 0) {
				network.rpc = network.rpcs[0]; // Take the first RPC from the array
				delete network.rpcs; // Remove the rpcs array
			}
		});
	}
	// Add block time to each network
	settingsJson.networks = Object.fromEntries(
		Object.entries(settingsJson.networks).map((network: [string, unknown]) => {
			const networkConfig: NetworkConfigSourceWithBlockTime =
				network[1] as NetworkConfigSourceWithBlockTime;
			networkConfig.blockTime = networkBlockTime[(networkConfig as any)['chain-id']];
			return [network[0], networkConfig];
		})
	);

	settings.set(settingsJson);
	tokenSlug.set(params.tokenSlug.toUpperCase());
	network.set(params.network);
	activeSubgraphs.set([{ url: settingsJson.subgraphs[params.network], name: params.network }]);

	return {
		stores: {
			settings,
			tokenSlug,
			network,
			activeSubgraphs
		}
	};
};

export const ssr = false;
