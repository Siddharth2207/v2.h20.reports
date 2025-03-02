import type { LayoutLoad } from './$types';
import { writable, derived,  } from 'svelte/store';
import { tokenConfig } from '$lib/constants';
import { tokenSlug, network } from '$lib/stores/report';
export const load = async ({ fetch, url, params }) => {

    
    // const response = await fetch(
	// 	'https://raw.githubusercontent.com/rainlanguage/rain.strategies/refs/heads/main/settings.json'
	// );
    // const settingsJson = await response.json();
    // const settings = writable(settingsJson);
    // console.log(params.tokenSlug);
    // console.log(params.network);

    // const { filteredActiveOrders, filteredInActiveOrders } = await fetchAndFilterOrders(
    //     params.tokenSlug.toUpperCase(),
    //     params.network,
    // );

    // return {
    //     stores: {
	// 		settings
    //     }
    // };
};

export const ssr = false;