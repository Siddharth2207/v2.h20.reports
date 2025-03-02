<script lang="ts">
    import { page } from '$app/stores';
    import { type MultiSubgraphArgs } from '@rainlanguage/orderbook/js_api';

    const { settings, tokenSlug, network, activeSubgraphs } = $page.data.stores;
    let tokenSlugValue: string | undefined = $tokenSlug; 
    let networkValue: string | undefined = $network;
    let activeSubgraphsValue: MultiSubgraphArgs[] | undefined = $activeSubgraphs;

    
</script>

<h1>Orderbook</h1>
<pre>
    {JSON.stringify($settings, null, 2)}
    {tokenSlugValue}
    {networkValue}
</pre>