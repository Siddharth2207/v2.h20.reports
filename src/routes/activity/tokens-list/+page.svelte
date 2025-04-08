<script lang="ts">
	import { tokenConfig } from '$lib/constants';

	// Group tokens by network
	const tokensByNetwork = Object.entries(tokenConfig).reduce(
		(acc, [slug, token]) => {
			if (!acc[token.network]) {
				acc[token.network] = [];
			}
			acc[token.network].push({
				slug,
				...token
			});
			return acc;
		},
		{} as Record<string, Array<{ slug: string; symbol: string; address: string; network: string }>>
	);
</script>

<div class="flex min-h-screen flex-col p-2 md:p-4">
	<div class="mb-3 flex flex-col items-center gap-2 md:mb-5 md:gap-4">
		<h2 class="text-lg font-bold text-gray-800 md:text-2xl">Networks & Tokens</h2>
	</div>

	<div class="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each Object.entries(tokensByNetwork) as [network, tokens]}
			<div class="rounded-lg border border-gray-200 bg-white p-3 shadow-sm md:p-4">
				<h3 class="mb-3 text-base font-semibold text-gray-900 md:mb-4 md:text-lg">
					{network.toUpperCase()}
				</h3>
				<div class="space-y-2">
					{#each tokens as token}
						<div class="rounded-md bg-gray-50 p-2 md:p-3">
							<div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
								<span class="text-sm font-medium text-gray-700 md:text-base">{token.slug}</span>
								<a
									href={`/${token.slug.toLowerCase()}-${token.network}`}
									class="break-all text-xs text-blue-500 hover:text-blue-600 md:text-sm"
								>
									{token.address}
								</a>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/each}
	</div>
</div>
