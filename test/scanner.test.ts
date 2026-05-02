import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyPattern, normalizeTransfer } from "../src/scanner.js";
import { lookupLabel, describeLabel } from "../src/labels.js";
import { parseCliArgs } from "../src/index.js";
import { formatPretty, formatJson } from "../src/format.js";
import type { RawTransfer } from "../src/types.js";

const BINANCE_14 = "0x28C6c06298d514Db089934071355E5743bf21d60";
const BURN_ZERO = "0x0000000000000000000000000000000000000000";
const RANDO_A = "0x111111111111111111111111111111111111aaaa";
const RANDO_B = "0x222222222222222222222222222222222222bbbb";

function fakeRaw(opts: {
  from: string;
  to: string;
  amount: number;
  amountUsd: number;
  symbol?: string;
  blockTime?: string;
  hash?: string;
}): RawTransfer {
  return {
    Block: { Time: opts.blockTime ?? "2026-05-02T10:00:00Z" },
    Transaction: { Hash: opts.hash ?? "0xdeadbeef", From: opts.from, To: opts.to },
    Transfer: {
      Sender: opts.from,
      Receiver: opts.to,
      Amount: opts.amount,
      AmountInUSD: opts.amountUsd,
      Currency: { Symbol: opts.symbol ?? "USDC", SmartContract: "0xtoken", Decimals: 6 },
    },
  };
}

describe("labels.lookupLabel", () => {
  it("matches case-insensitively", () => {
    const a = lookupLabel(BINANCE_14);
    const b = lookupLabel(BINANCE_14.toLowerCase());
    assert.equal(a?.label, "Binance 14");
    assert.equal(b?.label, "Binance 14");
    assert.equal(a?.category, "cex");
  });

  it("returns null for unknown address", () => {
    assert.equal(lookupLabel(RANDO_A), null);
    assert.equal(lookupLabel(""), null);
    assert.equal(lookupLabel(undefined), null);
  });

  it("recognizes burn addresses", () => {
    assert.equal(lookupLabel(BURN_ZERO)?.category, "burn");
  });
});

describe("describeLabel", () => {
  it("formats label with category", () => {
    const lbl = lookupLabel(BINANCE_14);
    assert.equal(describeLabel(lbl), "Binance 14 (cex)");
  });

  it("returns empty string for null", () => {
    assert.equal(describeLabel(null), "");
  });
});

describe("classifyPattern", () => {
  it("cex_to_cex", () => {
    assert.equal(classifyPattern("cex", "cex"), "cex_to_cex");
  });
  it("exchange_inflow", () => {
    assert.equal(classifyPattern(null, "cex"), "exchange_inflow");
  });
  it("exchange_outflow", () => {
    assert.equal(classifyPattern("cex", null), "exchange_outflow");
  });
  it("bridge_movement either direction", () => {
    assert.equal(classifyPattern("bridge", null), "bridge_movement");
    assert.equal(classifyPattern(null, "bridge"), "bridge_movement");
  });
  it("treasury_movement", () => {
    assert.equal(classifyPattern("treasury", null), "treasury_movement");
  });
  it("wallet_to_wallet when both unlabeled", () => {
    assert.equal(classifyPattern(null, null), "wallet_to_wallet");
  });
});

describe("normalizeTransfer", () => {
  it("attaches labels and pattern", () => {
    const raw = fakeRaw({
      from: BINANCE_14,
      to: RANDO_A,
      amount: 1_000_000,
      amountUsd: 1_000_000,
    });
    const n = normalizeTransfer(raw, "ethereum");
    assert.equal(n.chain, "ethereum");
    assert.equal(n.fromLabel, "Binance 14 (cex)");
    assert.equal(n.toLabel, "");
    assert.equal(n.pattern, "exchange_outflow");
    assert.equal(n.amountUsd, 1_000_000);
  });

  it("classifies wallet-to-wallet transfer", () => {
    const raw = fakeRaw({
      from: RANDO_A,
      to: RANDO_B,
      amount: 500,
      amountUsd: 500_000,
    });
    const n = normalizeTransfer(raw, "polygon");
    assert.equal(n.pattern, "wallet_to_wallet");
    assert.equal(n.fromLabel, "");
    assert.equal(n.toLabel, "");
  });

  it("lowercases addresses for consistent comparison", () => {
    const raw = fakeRaw({
      from: BINANCE_14,
      to: RANDO_A,
      amount: 1,
      amountUsd: 100_000,
    });
    const n = normalizeTransfer(raw, "ethereum");
    assert.equal(n.fromAddress, BINANCE_14.toLowerCase());
    assert.equal(n.toAddress, RANDO_A.toLowerCase());
  });
});

describe("parseCliArgs", () => {
  it("defaults to scan with sane chains", () => {
    const args = parseCliArgs([]);
    assert.equal(args.command, "scan");
    assert.deepEqual(args.chains, ["ethereum", "polygon", "bsc", "arbitrum"]);
    assert.ok(args.minUsd > 0);
  });

  it("--chains restricts to subset", () => {
    const args = parseCliArgs(["scan", "--chains", "ethereum,polygon"]);
    assert.deepEqual(args.chains, ["ethereum", "polygon"]);
  });

  it("--min-usd and --lookback parse as numbers", () => {
    const args = parseCliArgs(["scan", "--min-usd", "250000", "--lookback", "30"]);
    assert.equal(args.minUsd, 250_000);
    assert.equal(args.lookbackMinutes, 30);
  });

  it("rejects invalid chain", () => {
    assert.throws(() => parseCliArgs(["scan", "--chains", "ethereum,fakechain"]), /Unsupported chain/);
  });

  it("rejects unknown flag", () => {
    assert.throws(() => parseCliArgs(["scan", "--banana"]), /Unknown argument/);
  });

  it("--help / --version recognized", () => {
    assert.equal(parseCliArgs(["--help"]).command, "help");
    assert.equal(parseCliArgs(["-v"]).command, "version");
  });

  it("rejects 0 lookback", () => {
    assert.throws(() => parseCliArgs(["scan", "--lookback", "0"]), /positive/);
  });
});

describe("formatters", () => {
  const fakeResult = {
    scannedAt: "2026-05-02T10:00:00Z",
    lookbackMinutes: 15,
    chains: ["ethereum" as const, "polygon" as const],
    minUsd: 100_000,
    totalTransfersFetched: 12,
    transfers: [
      {
        chain: "ethereum" as const,
        blockTime: "2026-05-02T09:55:00Z",
        txHash: "0xabc",
        fromAddress: BINANCE_14.toLowerCase(),
        toAddress: RANDO_A,
        fromLabel: "Binance 14 (cex)",
        toLabel: "",
        tokenAddress: "0xusdc",
        tokenSymbol: "USDC",
        amount: 5_000_000,
        amountUsd: 5_000_000,
        pattern: "exchange_outflow" as const,
      },
    ],
    creditsByChain: [
      { chain: "ethereum" as const, total: 12.5, unit: "CU" },
    ],
    totalCreditsUsed: 12.5,
    errors: [],
  };

  it("formatPretty contains key fields", () => {
    const text = formatPretty(fakeResult);
    assert.match(text, /Whale Pulse EVM/);
    assert.match(text, /USDC/);
    assert.match(text, /exchange_outflow/);
    assert.match(text, /Binance 14/);
    assert.match(text, /credits_used/);
  });

  it("formatJson is parseable", () => {
    const json = formatJson(fakeResult);
    const parsed = JSON.parse(json);
    assert.equal(parsed.transfers[0].chain, "ethereum");
    assert.equal(parsed.totalCreditsUsed, 12.5);
  });

  it("formatPretty handles empty transfers", () => {
    const text = formatPretty({ ...fakeResult, transfers: [] });
    assert.match(text, /no transfers above/);
  });

  it("formatPretty surfaces per-chain errors", () => {
    const text = formatPretty({
      ...fakeResult,
      errors: [{ chain: "bsc" as const, message: "GraphQL: schema mismatch" }],
    });
    assert.match(text, /! bsc:/);
  });
});
