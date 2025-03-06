<script lang="ts">
	import '../app.css';
    import Sidebar from '$lib/components/Sidebar.svelte';
    import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';

    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: Infinity
            }
        }
    });

</script>
<QueryClientProvider client={queryClient}>
    <div
        class="flex min-h-screen w-full justify-start bg-white dark:bg-gray-900 dark:text-gray-400"
    >
        <Sidebar />
        <main class="mx-auto h-full w-full grow overflow-x-auto px-4 pt-14 lg:ml-64 lg:p-8">
            <slot />
        </main>
    </div>
</QueryClientProvider>

