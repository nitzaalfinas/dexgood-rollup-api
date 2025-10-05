export interface BridgeDeposit {
  id: string;
  depositId: bigint;
  user: string;
  token: string;
  amount: bigint;
  sourceChain: 'L1' | 'L2';
  targetChain: 'L1' | 'L2';
  status: BridgeStatus;
  txHash: string;
  blockNumber: bigint;
  timestamp: Date;
  completedTxHash?: string;
  completedAt?: Date;
  failureReason?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum BridgeStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface L1DepositEvent {
  depositId: bigint;
  user: string;
  token: string;
  amount: bigint;
  nonce: bigint;
  timestamp: bigint;
  transactionHash: string;
  blockNumber: bigint;
}

export interface L2MintEvent {
  depositId: bigint;
  to: string;
  token: string;
  amount: bigint;
  timestamp: bigint;
  transactionHash: string;
  blockNumber: bigint;
}

export interface BridgeJob {
  depositId: string;
  user: string;
  token: string;
  amount: string;
  sourceChain: 'L1' | 'L2';
  targetChain: 'L1' | 'L2';
  txHash: string;
  blockNumber: string;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  bridgeContract: string;
  confirmationBlocks: number;
  gasLimit: bigint;
  maxGasPrice: bigint;
}

export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  l1Address?: string;
  l2Address?: string;
  minBridgeAmount: bigint;
  maxBridgeAmount: bigint;
  isNative: boolean;
}

export interface BridgeConfig {
  l1: ChainConfig;
  l2: ChainConfig;
  tokens: Record<string, TokenConfig>;
  feePercentage: number;
  minConfirmations: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface BridgeStats {
  totalDeposits: number;
  totalVolume: string;
  completedBridges: number;
  pendingBridges: number;
  failedBridges: number;
  averageProcessingTime: number;
  dailyVolume: Record<string, string>;
  tokenStats: Record<string, {
    volume: string;
    count: number;
  }>;
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: {
    database: boolean;
    redis: boolean;
    l1Provider: boolean;
    l2Provider: boolean;
    eventListener: boolean;
  };
  version: string;
  uptime: number;
}