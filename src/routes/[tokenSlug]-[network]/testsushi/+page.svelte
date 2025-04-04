<script lang="ts">
	import { getTokenPriceUsd } from '$lib/price';
	import { page } from '$app/stores';
	import { tokenConfig } from '$lib/constants';

	const { tokenSlug, network } = $page.data.stores;

	const token = tokenConfig[$tokenSlug.toUpperCase()];
	const tokenDecimals = token?.decimals;
	let price = 0;

	async function getRpSwap() {
		price = await getTokenPriceUsd($network, token.address, token.symbol, tokenDecimals);
	}
</script>

<button
	on:click={() => {
		getRpSwap();
	}}
>
	Test : {price}
</button>
