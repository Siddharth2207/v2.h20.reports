import { writable } from 'svelte/store';
import { type MultiSubgraphArgs } from '@rainlanguage/orderbook/js_api';
import { ConfigSourceWithBlockTime } from '$lib/types';

export const settings = writable<ConfigSourceWithBlockTime | undefined>(undefined);
export const tokenSlug = writable<string | undefined>(undefined);
export const network = writable<string | undefined>(undefined);
export const activeSubgraphs = writable<MultiSubgraphArgs[]>([]);
export const orderActiveState = writable<boolean | undefined>(true);
export const orderHashState = writable<string | undefined>(undefined);

export const ssr = false;
