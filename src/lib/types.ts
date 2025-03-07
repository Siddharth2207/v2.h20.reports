import { SgOrderWithSubgraphName } from '@rainlanguage/orderbook/js_api';

// Solver Types
export type SgOrderWithSubgraphNameAndSolverLogs = SgOrderWithSubgraphName & {
	solverLogs: RainSolverLog[];
};

export type RainSolverLog = {
	spanId: string;
	status: string;
	pair: string;
	timestamp: number;
	orderHash?: string;
	attemptDetails?: RainSolverTrade | RainSolverAttempt;
};

export type RainSolverTrade = {
	txUrl: string;
};

export type RainSolverOrderQuote = {
	maxOutput: string;
	ratio: string;
};

export type RainSolverAttempt = {
	quote: RainSolverOrderQuote;
	fullAttempt: RainSolverFullAttempt;
	partialAttempt?: RainSolverPartialAttempt;
};

export type RainSolverFullAttempt = {
	marketPrice: string;
	error: string;
	route: string;
};

export type RainSolverPartialAttempt = {
	amountIn: string;
	marketPrice: string;
	error: string;
	route?: string;
};

// Constants Types
export interface NetworkConfig {
	chainId: number;
	blockTime: number;
	rpc: string;
	subgraphUrl: string;
	stables: StablesConfig[];
}

export interface StablesConfig {
	symbol: string;
	decimals: number;
	address: string;
}

export interface NetworkConfigurations extends Record<string, NetworkConfig> {}

export interface TokenConfig {
	symbol: string;
	decimals: number;
	network: string;
	address: string;
	poolsV2: string[];
	poolsV3: string[];
	poolsPancakSwapV3: string[];
}

export interface Config {
	[key: string]: TokenConfig;
}
