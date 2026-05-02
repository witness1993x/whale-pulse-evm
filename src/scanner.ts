import type {
  ChainCreditsInfo,
  EvmChain,
  NormalizedTransfer,
  RawTransfer,
  ScanOptions,
  ScanResult,
  TransferPattern,
} from "./types.js";
import { ChainStreamClient } from "./chainstream.js";
import { describeLabel, lookupLabel } from "./labels.js";
import { reasonAboutTransfer } from "./reasoning.js";

export function classifyPattern(
  fromCategory: string | null,
  toCategory: string | null,
): TransferPattern {
  if (fromCategory === "cex" && toCategory === "cex") return "cex_to_cex";
  if (fromCategory === "cex") return "exchange_outflow";
  if (toCategory === "cex") return "exchange_inflow";
  if (fromCategory === "bridge" || toCategory === "bridge") return "bridge_movement";
  if (fromCategory === "treasury" || toCategory === "treasury") return "treasury_movement";
  if (!fromCategory && !toCategory) return "wallet_to_wallet";
  return "unknown";
}

export function normalizeTransfer(raw: RawTransfer, chain: EvmChain): NormalizedTransfer {
  const amount = Number(raw.Transfer.Amount ?? 0) || 0;
  const amountUsd = Number(raw.Transfer.AmountInUSD ?? 0) || 0;
  const fromAddr = (raw.Transfer.Sender ?? raw.Transaction?.From ?? "").toLowerCase();
  const toAddr = (raw.Transfer.Receiver ?? raw.Transaction?.To ?? "").toLowerCase();
  const fromLabel = lookupLabel(fromAddr);
  const toLabel = lookupLabel(toAddr);
  return {
    chain,
    blockTime: raw.Block.Time,
    txHash: raw.Transaction?.Hash ?? "",
    fromAddress: fromAddr,
    toAddress: toAddr,
    fromLabel: describeLabel(fromLabel),
    toLabel: describeLabel(toLabel),
    tokenAddress: (raw.Transfer.Currency.SmartContract ?? "").toLowerCase(),
    tokenSymbol: raw.Transfer.Currency.Symbol ?? "",
    amount,
    amountUsd,
    pattern: classifyPattern(fromLabel?.category ?? null, toLabel?.category ?? null),
  };
}

export async function runScan(options: ScanOptions): Promise<ScanResult> {
  const client = new ChainStreamClient({
    endpoint: options.endpoint,
    apiKey: options.apiKey,
  });
  const sinceIso = new Date(Date.now() - options.lookbackMinutes * 60_000).toISOString();
  const perChainLimit = options.perChainLimit ?? 25;

  const transfers: NormalizedTransfer[] = [];
  const creditsByChain: ChainCreditsInfo[] = [];
  const errors: Array<{ chain: EvmChain; message: string }> = [];
  let totalRaw = 0;

  for (const chain of options.chains) {
    try {
      const { transfers: rawTransfers, credits } = await client.fetchLargeTransfers({
        chain,
        sinceIso,
        minUsd: options.minUsd,
        limit: perChainLimit,
      });
      totalRaw += rawTransfers.length;
      for (const raw of rawTransfers) {
        transfers.push(normalizeTransfer(raw, chain));
      }
      if (credits) creditsByChain.push(credits);
    } catch (err) {
      errors.push({ chain, message: (err as Error).message });
    }
  }

  // Sort largest USD first across all chains.
  transfers.sort((a, b) => b.amountUsd - a.amountUsd);

  if (options.withReasoning && options.anthropicKey) {
    for (const t of transfers.slice(0, 5)) {
      try {
        t.reasoning = await reasonAboutTransfer(t, options.anthropicKey);
      } catch (err) {
        t.reasoning = `(reasoning failed: ${(err as Error).message})`;
      }
    }
  }

  const totalCreditsUsed = creditsByChain.reduce((sum, c) => sum + c.total, 0);

  return {
    scannedAt: new Date().toISOString(),
    lookbackMinutes: options.lookbackMinutes,
    chains: options.chains,
    minUsd: options.minUsd,
    totalTransfersFetched: totalRaw,
    transfers,
    creditsByChain,
    totalCreditsUsed,
    errors,
  };
}
