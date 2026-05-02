# whale-pulse-evm

Real-time **multichain EVM** large-transfer + whale-wallet radar powered by [ChainStream](https://chainstream.io) GraphQL `Transfers` cube, with optional [Claude](https://www.anthropic.com) AI reasoning.

> Why this exists: EVM whale tracking tools are everywhere, but every one of them is single-chain (only Ethereum) or single-token (only USDT) or behind a paywall (Arkham/Nansen). This radar is one screen of TypeScript that asks **one** GraphQL endpoint for ≥$N transfers across **Ethereum + Polygon + BSC + Arbitrum** in one shot, attaches CEX/bridge/treasury labels, classifies the pattern (`exchange_inflow / outflow / cex_to_cex / bridge_movement / treasury_movement / wallet_to_wallet`), and optionally lets Claude write a 1-2 sentence verdict per top hit.
>
> Companion to [chainstream-launch-radar](https://github.com/witness1993x/chainstream-launch-radar) (Solana side, DEXTrades-driven). Same author, same data backend, complementary lens.

## Install

```bash
npm install -g whale-pulse-evm
```

Or run from a clone:

```bash
git clone https://github.com/witness1993x/whale-pulse-evm
cd whale-pulse-evm
npm install
npm run build
```

## Configure

```bash
cp .env.example .env
# fill in CHAINSTREAM_API_KEY (required)
# fill in ANTHROPIC_API_KEY (only if you want --reasoning)
```

## Usage

```bash
# Default: 15-minute lookback, ≥$100k, all 4 chains
whale-pulse scan

# Tighter window, higher floor
whale-pulse scan --lookback 5 --min-usd 1000000

# Single chain
whale-pulse scan --chains ethereum

# JSON output (pipe into Discord webhook / dashboard)
whale-pulse scan --json

# Add Claude verdicts on top 5 (requires ANTHROPIC_API_KEY + `npm install @anthropic-ai/sdk`)
whale-pulse scan --reasoning
```

Sample pretty output:

```
=== Whale Pulse EVM @ 2026-05-02T10:30:00Z ===
chains=ethereum/polygon/bsc/arbitrum  lookback=15m  min=$100000  fetched=37
credits_used: ethereum=12CU polygon=8CU bsc=6CU arbitrum=4CU (total=30)

[1] ethereum USDT      $ 12500000 cex_to_cex          Binance 14 (cex) -> Coinbase 1 (cex)  2026-05-02T10:24:11Z
     verdict: Routine — Binance ↔ Coinbase rebalancing, very common at this size.
[2] polygon  USDC      $  3200000 exchange_outflow    Coinbase Custody (cex) -> 0x71a8c4ec…  2026-05-02T10:18:42Z
     verdict: Informative — institutional Coinbase outflow into a fresh wallet, often precedes OTC settlement.
[3] arbitrum WETH      $  1850000 wallet_to_wallet    0xe11ab23a… -> 0x5a3c6c11…  2026-05-02T10:15:09Z
```

## How it works

1. **`ChainStreamClient.fetchLargeTransfers`** — single GraphQL POST per chain with `X-API-KEY`, `EVM(network: <chain>) { Transfers(orderBy: descending Block_Time, where: { Block.Time.since=$cutoff, Transfer.AmountInUSD.gt=$minUsd }) }`. Default `limit: 25` per chain.
2. **`normalizeTransfer`** — flattens GraphQL response, lowercases addresses, attaches `lookupLabel(address)` results.
3. **`classifyPattern`** — buckets the transfer into 7 categories based on from/to label categories.
4. **`runScan`** — fans out across requested chains sequentially (so per-chain failure is isolated), merges, sorts by USD desc.
5. **`reasonAboutTransfer`** *(optional)* — sends top 5 to Claude Haiku 4.5 for a `routine / informative / suspicious` 1-2 sentence verdict. Falls back silently if SDK or key missing.
6. **CLI** — `pretty` or `--json` output. Exit codes: 0 success, 1 scan error, 2 bad args, 3 missing API key.

## Architecture

```
src/
├── index.ts          CLI entry, arg parser, orchestrator
├── chainstream.ts    GraphQL client + EVM Transfers query (multichain)
├── scanner.ts        Per-chain fan-out + transfer normalizer + pattern classifier
├── labels.ts         Curated CEX / bridge / treasury / DeFi / burn address dictionary
├── reasoning.ts      Optional Claude verdict layer
├── format.ts         Pretty / JSON formatters
└── types.ts          Shared interfaces
```

## Wallet labels

Bundled `labels.ts` covers the most common CEX hot wallets (Binance, Coinbase), official bridges (Polygon PoS, Wormhole, zkSync, Arbitrum One), DAO treasuries (Uniswap, MakerDAO), key DeFi routers, and burn addresses. ~30 entries — short on purpose, biased toward labels that **change interpretation**. PRs welcome.

## Testing

```bash
npm test
```

Uses Node's built-in test runner (`node:test`). No jest/vitest dependency. ~22 tests covering label lookup, pattern classification, transfer normalization, CLI parsing, and formatters.

## Roadmap (post-MVP)

- Stateful "new whale" detection (cross-scan diff)
- Webhook output (Discord / Slack / Telegram)
- ChainStream Kafka mode for true streaming
- More chains: Base, Optimism, Avalanche
- Configurable label file (`--labels-file ./my-labels.json`)

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgements

- [ChainStream](https://chainstream.io) for one-endpoint multichain EVM data
- [Anthropic Claude](https://www.anthropic.com) for the optional reasoning layer
