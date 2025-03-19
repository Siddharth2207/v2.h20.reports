import { tokenSlug, network, activeSubgraphs, settings } from '$lib/stores/report';
import { get } from 'svelte/store';
import { ConfigSource } from '@rainlanguage/orderbook/js_api';
export const load = async ({ params }) => {
	const settingsJson: ConfigSource | undefined = get(settings);

	if (settingsJson && settingsJson.subgraphs) {
		activeSubgraphs.set([{ url: settingsJson.subgraphs[params.network], name: params.network }]);
	}
	settings.set(settingsJson);
	tokenSlug.set(params.tokenSlug.toUpperCase());
	network.set(params.network);

	return {
		stores: {
			tokenSlug,
			network,
			activeSubgraphs
		}
	};
};

export const ssr = false;
