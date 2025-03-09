<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import MarketDepthTable from '$lib/components/MarketDepthTable.svelte';
	import { page } from '$app/stores';
	import { tokenConfig } from '$lib/constants';

    const {settings} = $page.data.stores;

	let network = '';
	let baseTokenAddress = '';
	let quoteTokenAddress = '';
    let networkRpc: string = ''
</script>

<Header />
<div
	class="m-2 mx-auto w-full max-w-7xl rounded-lg border border-gray-300 bg-gray-100 p-5 font-sans shadow-lg"
>
	<div class="mb-5 flex flex-col items-center gap-4">
		<img src="/h20-logo.png" alt="Raindex Logo" class="h-auto w-16" />
		<h2 class="text-2xl font-bold text-gray-800">Market Depth</h2>
	</div>
	<div class="mb-5 flex flex-col gap-4">
		<div>
			<label for="network-select" class="block font-semibold">Network:</label>
			<select
				id="network-select"
				class="mt-2 w-full rounded border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
				bind:value={network}
			>
				<option value="" disabled> Select a Network </option>
				{#each Object.keys($settings.subgraphs) as network}
					<option
						class="text-gray-700 hover:bg-gray-200 text-lg md:text-base"
						value={network}>{network}</option
					>
				{/each}
			</select>
            
		</div>
		<div>
			<label for="base-token-select" class="block font-semibold">Base Token:</label>
			<!-- <select
				id="base-token-select"
				class="mt-2 w-full rounded border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
				bind:value={baseToken}
			>
				<option value="" disabled> Select a Token </option>
				{#each Object.keys(tokenConfig) as token}
					<option value={token}>{token}</option>
				{/each}
			</select> -->
            <input
                type="text"
                placeholder="Base Token Address"
                class="mt-2 w-full rounded border border-gray-300 p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                bind:value={baseTokenAddress}
            />
		</div>
		<div>
			<label for="quote-token-select" class="block font-semibold">Quote Token:</label>
			<!-- <select
				id="quote-token-select"
				class="mt-2 w-full rounded border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
				bind:value={quoteToken}
			>
				<option value="" disabled> Select a Token </option>
				{#each Object.keys(tokenConfig) as token}
					<option class="text-gray-700 hover:bg-gray-200 text-lg md:text-base" value={token}>{token}</option>
				{/each}
			</select> -->
            <input
                type="text"
                placeholder="Quote Token Address"
                class="mt-2 w-full rounded border border-gray-300 p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                bind:value={quoteTokenAddress}
            />
		</div>
        <div>
            <label for="network-rpc-select" class="block font-semibold">Network RPC:</label>
            <input
                type="text"
                placeholder="Network RPC"
                class="mt-2 w-full rounded border border-gray-300 p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                bind:value={networkRpc}
            />
        </div>
        
	</div>

	{#if network && baseTokenAddress && quoteTokenAddress}
		<div class="rounded-md border border-gray-300 bg-white p-5 shadow-md">
			<MarketDepthTable 
				network={network}
				{baseTokenAddress} 
				{quoteTokenAddress} 
				{networkRpc} 
			/>
		</div>
	{:else if !network || !baseTokenAddress || !quoteTokenAddress}
		<div class="rounded-md border border-gray-300 bg-white p-5 shadow-md">
			<h2 class="text-lg font-medium text-gray-500">
				Please select a network, base token, and quote token
			</h2>
		</div>
	{/if}
</div>
