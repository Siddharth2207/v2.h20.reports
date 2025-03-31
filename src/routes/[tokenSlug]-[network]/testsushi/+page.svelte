<script lang="ts">
	import { DataFetcher, RPParams } from 'sushiswap/router';
	import { Token } from 'sushiswap/currency';

	async function getRpSwap() {
	let test: RPParams = {
		tokenIn: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`,
		amountIn: BigInt(1),
		tokenOut: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`,
		amountOutMin: BigInt(2),
		to: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`,
		routeCode: `0x123445`,
		data: `0x123345`
	};
	console.log(test);
	const dataFetcher = DataFetcher.onChain(1);
	const toToken = new Token({
        chainId: 8453,
        decimals: 18,
        address: '0x99b2b1a2adb02b38222adcd057783d7e5d1fcc7d'
    });
    const fromToken = new Token({
        chainId: 8453,
        decimals: 18,
        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    });
	const pools = await dataFetcher.fetchPoolsForToken(fromToken, toToken);
	console.log(pools);
}
</script>

<button
	on:click={() => {
		getRpSwap();
	}}
>
	Test
</button>
