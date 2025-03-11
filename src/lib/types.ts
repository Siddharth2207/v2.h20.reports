import type {
	SgOrderWithSubgraphName,
	OrderV3,
	SgOrder,
	SgTrade,
	SgVault,
	SgVaultBalanceChangeUnwrapped
} from '@rainlanguage/orderbook/js_api';

// Order List Types
export interface OrderListTotalVolume {
	token: string;
	tokenAddress: string;
	totalVolume: number;
}

export interface OrderListVault extends Omit<SgVault, 'balanceChanges'> {
	balanceChanges: SgVaultBalanceChangeUnwrapped[];
	balanceChange24h: string;
	percentageChange24h: number;
	totalDeposits: number;
	totalWithdrawals: number;
	currentVaultInputs: number;
	curerentVaultDifferential: number;
	curerentVaultDifferentialPercentage: number;
	currentVaultApy: number;
	currentVaultApyPercentage: number;
}

export interface OrderListOrder extends Omit<SgOrder, 'trades' | 'outputs' | 'inputs'> {
	trades: SgTrade[];
	outputs: OrderListVault[];
	inputs: OrderListVault[];
	tokenPriceUsdMap: Map<string, number>;
	totalVolume: OrderListTotalVolume[];
	totalVolume24h: OrderListTotalVolume[];
	orderDuration: number;
	roi: number;
	roiPercentage: number;
	apy: number;
	apyPercentage: number;
}

export interface OrderListOrderWithSubgraphName {
	order: OrderListOrder;
	subgraphName: string;
}

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

// eslint-disable-next-line
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

// Market Depth Types
export interface MarketDepthOrder {
	decodedOrder: OrderV3;
	sgOrder: SgOrder;
	type: 'buy' | 'sell';
	inputIOIndex: number;
	outputIOIndex: number;
	maxOutput: string;
	ratio: string;
	price: string;
	priceDistance: string;
}
