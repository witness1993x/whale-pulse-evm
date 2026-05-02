import type { ChainCreditsInfo, EvmChain, RawTransfer } from "./types.js";

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
  extensions?: { credits?: { total: number; unit: string } };
}

export interface ChainStreamClientOptions {
  endpoint: string;
  apiKey: string;
  userAgent?: string;
  fetchImpl?: typeof fetch;
}

export class ChainStreamError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly graphqlErrors?: Array<{ message: string; path?: string[] }>,
  ) {
    super(message);
    this.name = "ChainStreamError";
  }
}

const CHAIN_ROOT: Record<EvmChain, string> = {
  ethereum: "EVM(network: eth)",
  polygon: "EVM(network: matic)",
  bsc: "EVM(network: bsc)",
  arbitrum: "EVM(network: arbitrum)",
};

export class ChainStreamClient {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly userAgent: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ChainStreamClientOptions) {
    if (!options.endpoint) throw new ChainStreamError("ChainStream endpoint is required");
    if (!options.apiKey) throw new ChainStreamError("ChainStream API key is required");
    this.endpoint = options.endpoint;
    this.apiKey = options.apiKey;
    this.userAgent = options.userAgent ?? "whale-pulse-evm/0.1.0";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async query<T>(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<GraphQLResponse<T>> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-KEY": this.apiKey,
        "User-Agent": this.userAgent,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new ChainStreamError(
        `HTTP ${response.status} from ChainStream: ${detail.slice(0, 240)}`,
        response.status,
      );
    }

    const payload = (await response.json()) as GraphQLResponse<T>;
    if (payload.errors && payload.errors.length > 0) {
      throw new ChainStreamError(
        `GraphQL errors: ${payload.errors.map((e) => e.message).join("; ")}`,
        response.status,
        payload.errors,
      );
    }
    return payload;
  }

  async fetchLargeTransfers(opts: {
    chain: EvmChain;
    sinceIso: string;
    minUsd: number;
    limit?: number;
  }): Promise<{ transfers: RawTransfer[]; credits?: ChainCreditsInfo }> {
    const limit = opts.limit ?? 50;
    const root = CHAIN_ROOT[opts.chain];
    if (!root) throw new ChainStreamError(`Unsupported EVM chain: ${opts.chain}`);

    const query = `
      query WhalePulseLargeTransfers($since: DateTime!, $minUsd: Float!, $limit: Int!) {
        ${root} {
          Transfers(
            limit: { count: $limit }
            orderBy: { descending: Block_Time }
            where: {
              Block: { Time: { since: $since } }
              Transfer: { AmountInUSD: { gt: $minUsd } }
            }
          ) {
            Block { Time Number }
            Transaction { Hash From To }
            Transfer {
              Sender
              Receiver
              Amount
              AmountInUSD
              Currency { SmartContract Symbol Name Decimals }
            }
          }
        }
      }
    `;

    const payload = await this.query<Record<string, { Transfers: RawTransfer[] }>>(query, {
      since: opts.sinceIso,
      minUsd: opts.minUsd,
      limit,
    });
    // GraphQL returns the chain root as the top key (e.g., "EVM"); pick the first.
    const data = payload.data ?? {};
    const firstKey = Object.keys(data)[0];
    const transfers = firstKey ? (data[firstKey]?.Transfers ?? []) : [];

    let credits: ChainCreditsInfo | undefined;
    if (payload.extensions?.credits) {
      credits = {
        chain: opts.chain,
        total: payload.extensions.credits.total,
        unit: payload.extensions.credits.unit,
      };
    }
    return { transfers, credits };
  }
}
