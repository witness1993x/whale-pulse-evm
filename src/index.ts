#!/usr/bin/env node
import { runScan } from "./scanner.js";
import { formatJson, formatPretty } from "./format.js";
import type { EvmChain, ScanOptions } from "./types.js";

interface CliArgs {
  command: "scan" | "help" | "version";
  lookbackMinutes: number;
  minUsd: number;
  chains: EvmChain[];
  endpoint: string;
  output: "pretty" | "json";
  withReasoning: boolean;
  perChainLimit: number;
}

const HELP = `whale-pulse-evm — multichain EVM large-transfer + whale-wallet radar

Usage:
  whale-pulse scan [options]
  whale-pulse --help
  whale-pulse --version

Options:
  --lookback <minutes>     How far back to scan (default: env WHALE_PULSE_LOOKBACK_MINUTES or 15)
  --min-usd <n>            Minimum transfer USD value (default: env WHALE_PULSE_MIN_USD or 100000)
  --chains <list>          Comma list of EVM chains (default: env WHALE_PULSE_CHAINS or "ethereum,polygon,bsc,arbitrum")
  --per-chain-limit <n>    Max transfers fetched per chain (default: 25)
  --endpoint <url>         ChainStream GraphQL endpoint
  --json                   Emit JSON instead of pretty text
  --reasoning              Add Claude AI 1-2 sentence verdict per transfer (top 5)
  --help                   Show this help
  --version                Show version

Environment:
  CHAINSTREAM_API_KEY      required
  ANTHROPIC_API_KEY        required only with --reasoning
`;

const VALID_CHAINS = new Set<EvmChain>(["ethereum", "polygon", "bsc", "arbitrum"]);

function parseChainList(raw: string): EvmChain[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) as EvmChain[];
  for (const p of parts) {
    if (!VALID_CHAINS.has(p)) throw new Error(`Unsupported chain: ${p}`);
  }
  return parts;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const defaultChains = process.env.WHALE_PULSE_CHAINS ?? "ethereum,polygon,bsc,arbitrum";
  const args: CliArgs = {
    command: "scan",
    lookbackMinutes: Number(process.env.WHALE_PULSE_LOOKBACK_MINUTES ?? 15),
    minUsd: Number(process.env.WHALE_PULSE_MIN_USD ?? 100000),
    chains: parseChainList(defaultChains),
    endpoint:
      process.env.CHAINSTREAM_GRAPHQL_ENDPOINT ?? "https://graphql.chainstream.io/graphql",
    output: "pretty",
    withReasoning: false,
    perChainLimit: 25,
  };

  let i = 0;
  if (argv[0] === "scan") {
    args.command = "scan";
    i = 1;
  } else if (argv[0] === "--help" || argv[0] === "-h") {
    args.command = "help";
    return args;
  } else if (argv[0] === "--version" || argv[0] === "-v") {
    args.command = "version";
    return args;
  }

  for (; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case "--lookback":
        args.lookbackMinutes = Number(argv[++i]);
        break;
      case "--min-usd":
        args.minUsd = Number(argv[++i]);
        break;
      case "--chains":
        args.chains = parseChainList(String(argv[++i]));
        break;
      case "--per-chain-limit":
        args.perChainLimit = Number(argv[++i]);
        break;
      case "--endpoint":
        args.endpoint = String(argv[++i]);
        break;
      case "--json":
        args.output = "json";
        break;
      case "--reasoning":
        args.withReasoning = true;
        break;
      case "--help":
      case "-h":
        args.command = "help";
        return args;
      case "--version":
      case "-v":
        args.command = "version";
        return args;
      default:
        throw new Error(`Unknown argument: ${a}`);
    }
  }

  if (!Number.isFinite(args.lookbackMinutes) || args.lookbackMinutes <= 0) {
    throw new Error("--lookback must be a positive number");
  }
  if (!Number.isFinite(args.minUsd) || args.minUsd <= 0) {
    throw new Error("--min-usd must be a positive number");
  }
  if (!Number.isFinite(args.perChainLimit) || args.perChainLimit <= 0) {
    throw new Error("--per-chain-limit must be a positive number");
  }
  if (args.chains.length === 0) {
    throw new Error("--chains must include at least one chain");
  }
  return args;
}

async function main(argv: string[]): Promise<number> {
  let args: CliArgs;
  try {
    args = parseCliArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n\n${HELP}`);
    return 2;
  }

  if (args.command === "help") {
    process.stdout.write(HELP);
    return 0;
  }
  if (args.command === "version") {
    process.stdout.write("whale-pulse-evm 0.1.0\n");
    return 0;
  }

  const apiKey = process.env.CHAINSTREAM_API_KEY ?? "";
  if (!apiKey) {
    process.stderr.write("error: CHAINSTREAM_API_KEY is required. See .env.example.\n");
    return 3;
  }

  const opts: ScanOptions = {
    lookbackMinutes: args.lookbackMinutes,
    minUsd: args.minUsd,
    chains: args.chains,
    endpoint: args.endpoint,
    apiKey,
    withReasoning: args.withReasoning,
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    perChainLimit: args.perChainLimit,
  };

  if (args.withReasoning && !opts.anthropicKey) {
    process.stderr.write("warn: --reasoning requested but ANTHROPIC_API_KEY is unset; verdicts will be skipped.\n");
    opts.withReasoning = false;
  }

  try {
    const result = await runScan(opts);
    process.stdout.write(args.output === "json" ? formatJson(result) : formatPretty(result));
    process.stdout.write("\n");
    return 0;
  } catch (err) {
    process.stderr.write(`scan failed: ${(err as Error).message}\n`);
    return 1;
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
