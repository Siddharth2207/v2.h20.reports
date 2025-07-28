import * as chains from 'viem/chains';

const networkToChainId: Record<string, number> = {
	flare: 14,
	base: 8453,
	polygon: 137,
	arbitrum: 42161,
	arbitrum2: 42161,
	bsc: 56,
	linea: 59144,
	ethereum: 1
};

export function getNetworkNameById(id: number): string | undefined {
	const chain = Object.values(chains).find((chain) => chain.id === id);
	return chain?.name;
}

export function getChainIdByName(name: string): number | undefined {
	return networkToChainId[name];
}
