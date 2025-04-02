<script lang="ts">
	import { page } from '$app/stores';
	import { Sidebar, SidebarGroup, SidebarItem, SidebarWrapper } from 'flowbite-svelte';
	import { ClipboardListSolid, FileCsvSolid} from 'flowbite-svelte-icons';

	// Add state for mobile menu
	let isMobileMenuOpen = false;

	// Toggle mobile menu
	function toggleMobileMenu() {
		isMobileMenuOpen = !isMobileMenuOpen;
	}
</script>

<!-- Add hamburger button outside sidebar -->
<button
	class="fixed left-4 top-4 z-20 rounded-lg p-2 md:hidden"
	on:click={toggleMobileMenu}
	aria-label="Toggle Menu"
>
	<div class="space-y-2">
		<span
			class="block h-0.5 w-8 bg-gray-600 transition-transform duration-200 ease-in-out"
			class:rotate-45={isMobileMenuOpen}
			class:translate-y-2.5={isMobileMenuOpen}
		></span>
		<span
			class="block h-0.5 w-8 bg-gray-600 transition-opacity duration-200 ease-in-out"
			class:opacity-0={isMobileMenuOpen}
		></span>
		<span
			class="block h-0.5 w-8 bg-gray-600 transition-transform duration-200 ease-in-out"
			class:-rotate-45={isMobileMenuOpen}
			class:-translate-y-2.5={isMobileMenuOpen}
		></span>
	</div>
</button>

<Sidebar
	activeUrl={$page.url.pathname}
	asideClass="w-64 z-10 fixed min-h-screen bg-gray-100 shadow-lg transition-transform duration-300 ease-in-out {isMobileMenuOpen
		? 'translate-x-0'
		: '-translate-x-full'} md:translate-x-0"
	data-testid="sidebar"
>
	<SidebarWrapper divClass="py-6 px-4 bg-gray-100 dark:bg-gray-800 min-h-screen">
		<SidebarGroup class="flex items-center space-x-3 border-b pb-4">
			<img
				src="/h20-logo.png"
				alt="H20 Liquidity"
				class="hidden h-14 w-14 rounded-lg object-contain p-2 md:block"
			/>
			<span class="text-xl font-bold text-gray-900 dark:text-white">H20 Liquidity</span>
		</SidebarGroup>

		<SidebarGroup border />

		<SidebarGroup class="gap-4 p-2">
			<SidebarItem label="" href="/activity">
				<svelte:fragment slot="icon">
					<ClipboardListSolid class="h-5 w-5" />
					<span class="px-3 text-base text-gray-600 hover:text-indigo-600 dark:text-white"
						>Activity List</span
					>
				</svelte:fragment>
			</SidebarItem>
		</SidebarGroup>

		<SidebarGroup class="gap-4 p-2">
			<SidebarItem label="" href="/activity/blockdata">
				<svelte:fragment slot="icon">
					<FileCsvSolid class="h-5 w-5" />
					<span class="px-3 text-base text-gray-600 hover:text-indigo-600 dark:text-white"
						>Block Data</span
					>
				</svelte:fragment>
			</SidebarItem>
		</SidebarGroup>
	</SidebarWrapper>
</Sidebar>

<!-- Add overlay for mobile menu -->
{#if isMobileMenuOpen}
	<div
		class="fixed inset-0 z-[5] bg-gray-900 bg-opacity-50 md:hidden"
		on:click={toggleMobileMenu}
		aria-hidden="true"
	></div>
{/if}

<style>
	/* Optional: Prevent body scroll when mobile menu is open */
	:global(body.menu-open) {
		overflow: hidden;
	}
</style>
