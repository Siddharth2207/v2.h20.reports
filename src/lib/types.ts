import type {
	SgOrderWithSubgraphName,
	OrderV3,
	SgOrder,
	SgTrade,
	SgVault,
	SgVaultBalanceChangeUnwrapped,
	NetworkConfigSource,
	ConfigSource
} from '@rainlanguage/orderbook/js_api';

export interface RaindexData {
	blockNumber: number;
	timestamp: number;
	transactionHash: string;
	orderHash: string;
	sender: string;
	tokenIn: string;
	tokenOut: string;
	amountIn: number;
	amountOut: number;
	amountInUsd: number;
	amountOutUsd: number;
	ioRatio: number;
}
export interface PoolData {
	token0Address: string;
	token1Address: string;
	token0Decimals: number;
	token1Decimals: number;
	token0Symbol: string;
	token1Symbol: string;
	poolAddress: string;
	poolType: string;
	poolTrades: PoolTrade[];
}

export interface PoolTrade {
	blockNumber: number;
	poolAddress: string;
	transactionHash: string;
	amount0: number;
	amount1: number;
	timestamp: number;
	ratio0: number;
	ratio1: number;
}
export interface VaultAnalyticsToken {
	address: string;
	symbol: string;
	decimals: number;
	totalVaults: number;
	totalTokenBalance: number;
	totalTokenBalanceUsd: number;
}

export interface VaultAnalyticsData {
	vaultId: string;
	name: string;
	tokenSymbol: string;
	tokenAddress: string;
	tokenDecimals: number;
	balance: number;
	volume: number;
}
export interface MarketAnalyticsData {
	plotData: MarketAnalytics[];
	totalRaindexTrades: number;
	totalExternalTrades: number;
	totalRaindexVolume: number;
	totalExternalVolume: number;
}

export interface MarketAnalytics {
	date: string;
	timestamp: number;
	raindexTrades: number;
	externalTrades: number;
	totalTrades: number;
	raindexVolume: number;
	externalVolume: number;
	totalVolume: number;
}

export interface LiquidityAnalysisResult {
	tradesAccordingToTimeStamp: TradesByTimeStamp[];
	totalTokenExternalVolForDurationUsd: number;
	totalTokenExternalTradesForDuration: number;
}

export interface TradesByTimeStamp {
	timestamp: number;
	transactionHash: string;
	amountInTokens: number;
	amountInUsd: number;
}

// Network Config Source with Block Time
export interface NetworkConfigSourceWithBlockTime extends NetworkConfigSource {
	blockTime?: number;
}

// Config Source with Block Time
export interface ConfigSourceWithBlockTime extends Omit<ConfigSource, 'networks'> {
	networks?: Record<string, NetworkConfigSourceWithBlockTime>;
}

// Order List Types
export interface OrderListTotalVolume {
	token: string;
	tokenAddress: string;
	totalVolume: number;
}

export interface OrderListVault extends Omit<SgVault, 'balanceChanges'> {
	balanceChanges: SgVaultBalanceChangeUnwrapped[];
	balanceChange24h: number;
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
	rpc: string[];
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
