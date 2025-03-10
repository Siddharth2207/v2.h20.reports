<script lang="ts">
	import { page } from '$app/stores';
	import { Sidebar, SidebarGroup, SidebarItem, SidebarWrapper } from 'flowbite-svelte';
	import { ClipboardListSolid, DesktopPcSolid, BookOpenOutline } from 'flowbite-svelte-icons';

	export let network: string;
	export let tokenSlug: string;
</script>

<Sidebar
	activeUrl={$page.url.pathname}
	asideClass="w-64 z-10 fixed min-h-screen bg-gray-100 shadow-lg hidden md:block"
	data-testid="sidebar"
>
	<div class="flex items-center md:hidden">
		<button class="hamburger focus:outline-none">
			<span class="mb-1 block h-1 w-8 bg-gray-900"></span>
			<span class="mb-1 block h-1 w-8 bg-gray-900"></span>
			<span class="block h-1 w-8 bg-gray-900"></span>
		</button>
	</div>
	<SidebarWrapper divClass="py-6 px-4 bg-gray-100 dark:bg-gray-800 min-h-screen">
		<SidebarGroup class="flex items-center space-x-3 border-b pb-4">
			<img
				src="/h20-logo.png"
				alt="H20 Liquidity"
				class="h-14 w-14 rounded-lg object-contain p-2"
			/>
			<span class="text-xl font-bold text-gray-900 dark:text-white">H20 Liquidity</span>
		</SidebarGroup>

		<SidebarGroup border />

		<SidebarGroup class="gap-4 p-2">
			<SidebarItem label="" href="/{tokenSlug}-{network}">
				<svelte:fragment slot="icon">
					<ClipboardListSolid class="h-5 w-5" />
					<span class="px-3 text-base text-gray-600 hover:text-indigo-600 dark:text-white"
						>Order List</span
					>
				</svelte:fragment>
			</SidebarItem>
		</SidebarGroup>

		<SidebarGroup class="gap-4 p-2">
			<SidebarItem label="" href="/{tokenSlug}-{network}/solverlogs">
				<svelte:fragment slot="icon">
					<DesktopPcSolid class="h-5 w-5" />
					<span class="px-3 text-base text-gray-600 hover:text-indigo-600 dark:text-white"
						>Solver Logs</span
					>
				</svelte:fragment>
			</SidebarItem>
		</SidebarGroup>

		<SidebarGroup class="gap-4 p-2">
			<SidebarItem label="" href="/{tokenSlug}-{network}/orderbook">
				<svelte:fragment slot="icon">
					<BookOpenOutline class="h-5 w-5" />
					<span class="px-3 text-base text-gray-600 hover:text-indigo-600 dark:text-white"
						>Order Book</span
					>
				</svelte:fragment>
			</SidebarItem>
		</SidebarGroup>
	</SidebarWrapper>
</Sidebar>
