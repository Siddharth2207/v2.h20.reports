<script lang="ts">
	import { page } from '$app/stores';

	const { settings, tokenSlug, network } = $page.data.stores;
	let tokenSlugValue: string | undefined = $tokenSlug;
	let networkValue: string | undefined = $network;
</script>

<h1>Orderbook</h1>
<pre>
    {JSON.stringify($settings, null, 2)}
    {tokenSlugValue}
    {networkValue}
</pre>
