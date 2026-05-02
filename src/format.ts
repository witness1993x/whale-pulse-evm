import type { NormalizedTransfer, ScanResult } from "./types.js";

export function formatPretty(result: ScanResult): string {
  const lines: string[] = [];
  lines.push(`=== Whale Pulse EVM @ ${result.scannedAt} ===`);
  lines.push(
    `chains=${result.chains.join("/")}  lookback=${result.lookbackMinutes}m  min=$${result.minUsd}  fetched=${result.totalTransfersFetched}`,
  );
  if (result.totalCreditsUsed > 0) {
    const breakdown = result.creditsByChain
      .map((c) => `${c.chain}=${c.total}${c.unit}`)
      .join(" ");
    lines.push(`credits_used: ${breakdown} (total=${result.totalCreditsUsed})`);
  }
  if (result.errors.length > 0) {
    for (const e of result.errors) {
      lines.push(`! ${e.chain}: ${e.message}`);
    }
  }
  lines.push("");
  if (result.transfers.length === 0) {
    lines.push("(no transfers above the USD threshold; try a longer --lookback or lower --min-usd)");
    return lines.join("\n");
  }
  result.transfers.slice(0, 20).forEach((t, idx) => {
    lines.push(formatTransferLine(idx, t));
    if (t.reasoning) lines.push(`     verdict: ${t.reasoning}`);
  });
  return lines.join("\n");
}

function formatTransferLine(idx: number, t: NormalizedTransfer): string {
  const sym = t.tokenSymbol || t.tokenAddress.slice(0, 8);
  const from = t.fromLabel || `${t.fromAddress.slice(0, 8)}…`;
  const to = t.toLabel || `${t.toAddress.slice(0, 8)}…`;
  return `[${idx + 1}] ${t.chain.padEnd(8)} ${sym.padEnd(8)} $${t.amountUsd.toFixed(0).padStart(10)} ${t.pattern.padEnd(18)} ${from} -> ${to}  ${t.blockTime}`;
}

export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}
