/**
 * Curated wallet/contract labels. Lowercased addresses → human label.
 *
 * Sources: public on-chain analytics conventions (Etherscan / Arkham / Nansen
 * style buckets). This list is intentionally short and biased toward CEXes,
 * bridges, and DAO treasuries — the labels that materially change how a whale
 * transfer should be interpreted. PRs welcome to extend.
 */

export type LabelCategory = "cex" | "bridge" | "treasury" | "defi" | "burn" | "stable_issuer";

export interface WalletLabel {
  label: string;
  category: LabelCategory;
}

const RAW: Record<string, WalletLabel> = {
  // -------------------- Ethereum mainnet CEX hot wallets --------------------
  "0x28c6c06298d514db089934071355e5743bf21d60": { label: "Binance 14", category: "cex" },
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549": { label: "Binance 15", category: "cex" },
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d": { label: "Binance 16", category: "cex" },
  "0x56eddb7aa87536c09ccc2793473599fd21a8b17f": { label: "Binance 17", category: "cex" },
  "0x9696f59e4d72e237be84ffd425dcad154bf96976": { label: "Binance 18", category: "cex" },
  "0xf977814e90da44bfa03b6295a0616a897441acec": { label: "Binance 8", category: "cex" },
  "0x5a52e96bacdabb82fd05763e25335261b270efcb": { label: "Binance 19", category: "cex" },
  "0xa910f92acdaf488fa6ef02174fb86208ad7722ba": { label: "Coinbase Custody", category: "cex" },
  "0x71660c4005ba85c37ccec55d0c4493e66fe775d3": { label: "Coinbase 1", category: "cex" },
  "0x503828976d22510aad0201ac7ec88293211d23da": { label: "Coinbase 2", category: "cex" },
  "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740": { label: "Coinbase 3", category: "cex" },
  "0x3cd751e6b0078be393132286c442345e5dc49699": { label: "Coinbase 4", category: "cex" },
  "0xb5d85cbf7cb3ee0d56b3bb207d5fc4b82f43f511": { label: "Coinbase 5", category: "cex" },
  "0xfe9e8709d3215310075d67e3ed32a380ccf451c8": { label: "Coinbase 6", category: "cex" },
  "0x32400084c286cf3e17e7b677ea9583e60a000324": { label: "zkSync Era Bridge", category: "bridge" },
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": { label: "WETH (ERC20)", category: "stable_issuer" },
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { label: "USDC issuer", category: "stable_issuer" },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": { label: "USDT issuer", category: "stable_issuer" },

  // -------------------- Bridges --------------------
  "0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf": { label: "Polygon PoS Bridge", category: "bridge" },
  "0x8484ef722627bf18ca5ae6bcf031c23e6e922b30": { label: "Polygon Plasma Bridge", category: "bridge" },
  "0xa0c68c638235ee32657e8f720a23cec1bfc77c77": { label: "Polygon ERC20 Bridge", category: "bridge" },
  "0x3ee18b2214aff97000d974cf647e7c347e8fa585": { label: "Wormhole Bridge", category: "bridge" },
  "0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f": { label: "Arbitrum One Bridge", category: "bridge" },

  // -------------------- DAO treasuries --------------------
  "0x9aa99c23f67c81701c772b106b4f83f6e858dd2e": { label: "Uniswap Treasury", category: "treasury" },
  "0x4750c43867ef5f89869132eccf19b9b6c4286e1a": { label: "MakerDAO PauseProxy", category: "treasury" },

  // -------------------- DeFi key contracts --------------------
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": { label: "Uniswap V2 Router", category: "defi" },
  "0xe592427a0aece92de3edee1f18e0157c05861564": { label: "Uniswap V3 Router", category: "defi" },
  "0x000000000022d473030f116ddee9f6b43ac78ba3": { label: "Permit2", category: "defi" },

  // -------------------- Burn --------------------
  "0x000000000000000000000000000000000000dead": { label: "Burn (0xdead)", category: "burn" },
  "0x0000000000000000000000000000000000000000": { label: "Burn / Zero", category: "burn" },
};

const LOOKUP = new Map<string, WalletLabel>(
  Object.entries(RAW).map(([k, v]) => [k.toLowerCase(), v]),
);

export function lookupLabel(address: string | undefined | null): WalletLabel | null {
  if (!address) return null;
  return LOOKUP.get(address.toLowerCase()) ?? null;
}

export function describeLabel(label: WalletLabel | null): string {
  return label ? `${label.label} (${label.category})` : "";
}
