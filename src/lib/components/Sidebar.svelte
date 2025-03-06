<script lang="ts">
	import { page } from '$app/stores';
	import {
		Sidebar,
		SidebarGroup,
		SidebarItem,
		SidebarWrapper,
		SidebarBrand
	} from 'flowbite-svelte';
	import { ClipboardListSolid } from 'flowbite-svelte-icons';
</script>

<Sidebar
	activeUrl={$page.url.pathname}
	asideClass="w-64 z-10 fixed min-h-screen bg-gray-100 shadow-lg"
	data-testid="sidebar"
>
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
			<SidebarItem label="" href="/">
				<svelte:fragment slot="icon">
					<ClipboardListSolid class="h-5 w-5" />
					<span class="px-3 text-lg text-gray-600 hover:text-indigo-600 dark:text-white"
						>Order List</span
					>
				</svelte:fragment>
			</SidebarItem>
		</SidebarGroup>
	</SidebarWrapper>
</Sidebar>
