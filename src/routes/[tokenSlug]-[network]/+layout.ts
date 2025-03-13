import { tokenSlug, network, activeSubgraphs, settings } from '$lib/stores/report';
import { networkBlockTime } from '$lib/constants';
import { type NetworkConfigSourceWithBlockTime } from '$lib/types';
export const load = async ({ fetch, params }) => {
	const response = await fetch(
		'https://raw.githubusercontent.com/rainlanguage/rain.strategies/refs/heads/main/settings.json'
	);
	const settingsJson = await response.json();

	// Add block time to each network
	settingsJson.networks = Object.fromEntries(
		Object.entries(settingsJson.networks).map((network: [string, unknown]) => {
			const networkConfig: NetworkConfigSourceWithBlockTime = network[1] as NetworkConfigSourceWithBlockTime;
			networkConfig.blockTime = networkBlockTime[networkConfig['chain-id']];
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
