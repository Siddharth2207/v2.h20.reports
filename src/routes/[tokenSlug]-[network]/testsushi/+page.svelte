<script lang="ts">
	import { getRpSwap } from '$lib/price';
</script>

<button
	on:click={() => {
		getRpSwap();
	}}
>
	Test
</button>
