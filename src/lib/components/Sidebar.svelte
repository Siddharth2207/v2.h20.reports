<script lang="ts">
	import { page } from '$app/stores';
	import {
		Sidebar,
		SidebarGroup,
		SidebarItem,
		SidebarWrapper,
		SidebarBrand
	} from 'flowbite-svelte';
    import { ClipboardListSolid} from 'flowbite-svelte-icons';

</script>

<Sidebar
		activeUrl={$page.url.pathname}
		asideClass="w-64 z-10 fixed min-h-screen  shadow-lg"
		data-testid="sidebar"
>
	<SidebarWrapper divClass="py-11 px-3 bg-gray-100 dark:bg-gray-800 min-h-screen">
		<SidebarGroup>
			<SidebarBrand 
            site={{
                name: 'H20 Liquidity',
                href: '/',
                img: '/h20-logo.png',
            }}
            
            imgClass="w-16 h-16 object-contain rounded-lg p-2"
            >
			</SidebarBrand>
		</SidebarGroup>
        <SidebarGroup border />
			

		<SidebarGroup>
			<SidebarItem label="Order List" href="/">
                <svelte:fragment slot="icon">
                    <ClipboardListSolid class="w-6 h-6 text-gray-700 transition duration-75 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
                </svelte:fragment>
			</SidebarItem>
		</SidebarGroup>

		
	</SidebarWrapper>
</Sidebar>
