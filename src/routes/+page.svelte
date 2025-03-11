<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Header from '$lib/components/Header.svelte';
</script>

<div class="mx-auto flex min-h-screen w-full flex-col">
	{#if $page.url.pathname === '/'}
		<Header />
		<div
			class="flex w-full flex-row justify-center border-b-2 border-gray-300 bg-gray-200 px-4 dark:border-gray-600 dark:bg-gray-700"
		>
			<div class="my-24 flex w-full max-w-4xl flex-col">
				<h1
					class="light:text-gray-900 text-left font-instrument-serif text-7xl font-light leading-tight dark:text-white lg:text-6xl"
				>
					H20 Reports
					<br />
					Get summaries of your orders
				</h1>
				<div class="mt-8 flex justify-start gap-x-4">
					<a href="https://v2.raindex.finance">
						<button
							class="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800"
							on:click={() => goto('https://v2.raindex.finance')}>Try Raindex</button
						>
					</a>
				</div>
			</div>
		</div>
	{:else}
		<slot />
	{/if}
</div>
