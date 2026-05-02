export type EvmChain = "ethereum" | "polygon" | "bsc" | "arbitrum";

export interface RawTransfer {
  Block: { Time: string; Number?: number };
  Transaction?: { Hash?: string; From?: string; To?: string };
  Transfer: {
    Sender: string;
    Receiver: string;
    Amount: string | number;
    AmountInUSD?: string | number;
    Currency: {
      SmartContract?: string;
      Symbol?: string;
      Name?: string;
      Decimals?: number;
    };
  };
}

export interface NormalizedTransfer {
  chain: EvmChain;
  blockTime: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  fromLabel: string;
  toLabel: string;
  tokenAddress: string;
  tokenSymbol: string;
  amount: number;
  amountUsd: number;
  pattern: TransferPattern;
  reasoning?: string;
}

export type TransferPattern =
  | "exchange_inflow"
  | "exchange_outflow"
  | "bridge_movement"
  | "cex_to_cex"
  | "wallet_to_wallet"
  | "treasury_movement"
  | "unknown";

export interface ScanOptions {
  lookbackMinutes: number;
  minUsd: number;
  chains: EvmChain[];
  endpoint: string;
  apiKey: string;
  withReasoning: boolean;
  anthropicKey?: string;
  perChainLimit?: number;
}

export interface ChainCreditsInfo {
  chain: EvmChain;
  total: number;
  unit: string;
}

export interface ScanResult {
  scannedAt: string;
  lookbackMinutes: number;
  chains: EvmChain[];
  minUsd: number;
  totalTransfersFetched: number;
  transfers: NormalizedTransfer[];
  creditsByChain: ChainCreditsInfo[];
  totalCreditsUsed: number;
  errors: Array<{ chain: EvmChain; message: string }>;
}
