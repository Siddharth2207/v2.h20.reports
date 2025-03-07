<script lang="ts">
    import Sidebar from '$lib/components/Sidebar.svelte';
    import { page } from '$app/stores';
    const { network, tokenSlug } = $page.params;
</script>

<div class="flex min-h-screen w-full justify-start bg-white dark:bg-gray-900 dark:text-gray-400">
    <Sidebar {network} {tokenSlug} />
    <main class="mx-auto h-full w-full grow overflow-x-auto px-4 pt-14 lg:ml-64 lg:p-8">
        <slot />
    </main>
</div>