<script lang="ts">
	import DashboardSidebar from '$lib/components/ActivitySidebar.svelte';
</script>

<div class="flex min-h-screen w-full justify-start bg-white dark:bg-gray-900 dark:text-gray-400">
	<DashboardSidebar />
	<main class="mx-auto h-full w-full grow overflow-x-auto px-4 pt-14 lg:ml-64 lg:p-8">
		<slot />
	</main>
</div>
