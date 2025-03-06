import { tokenSlug, network, activeSubgraphs, settings } from '$lib/stores/report';
export const load = async ({ fetch, params }) => {
	const response = await fetch(
		'https://raw.githubusercontent.com/rainlanguage/rain.strategies/refs/heads/main/settings.json'
	);
	const settingsJson = await response.json();

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
