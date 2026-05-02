import type { NormalizedTransfer } from "./types.js";

interface AnthropicMessage {
  content: Array<{ type: string; text?: string }>;
}

interface AnthropicClient {
  messages: {
    create: (req: {
      model: string;
      max_tokens: number;
      messages: Array<{ role: string; content: string }>;
    }) => Promise<AnthropicMessage>;
  };
}

type AnthropicCtor = new (opts: { apiKey: string }) => AnthropicClient;

/**
 * Optional Claude AI reasoning layer. Returns a 1-2 sentence verdict per
 * transfer: is this whale move suspicious / informative / routine?
 *
 * The model is *not* asked to recommend trades — only to label the pattern.
 */
export async function reasonAboutTransfer(
  transfer: NormalizedTransfer,
  anthropicApiKey: string,
): Promise<string> {
  if (!anthropicApiKey) {
    throw new Error("Anthropic API key required for reasoning");
  }

  let Anthropic: AnthropicCtor;
  try {
    // @ts-expect-error optional peer dep, may not be installed
    const mod = await import("@anthropic-ai/sdk");
    Anthropic = (mod.default ?? mod) as AnthropicCtor;
  } catch {
    throw new Error(
      "@anthropic-ai/sdk is not installed; run `npm install @anthropic-ai/sdk` to enable reasoning",
    );
  }

  const client = new Anthropic({ apiKey: anthropicApiKey });
  const prompt = buildPrompt(transfer);
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  if (block && block.type === "text" && typeof block.text === "string") {
    return block.text.trim();
  }
  return "(no reasoning produced)";
}

function buildPrompt(t: NormalizedTransfer): string {
  return [
    "You are an on-chain whale-watching analyst.",
    "Given this transfer, write 1-2 sentences classifying it as 'routine' (CEX rebalancing, treasury moves), 'informative' (notable cohort or pattern), or 'suspicious' (mixer, unknown actor accumulating, sudden new wallet).",
    "Be specific: cite the from/to labels, the chain, the USD size, and any pattern hint. Do NOT recommend trades.",
    "",
    `Chain: ${t.chain}`,
    `Token: ${t.tokenSymbol || t.tokenAddress.slice(0, 10)}`,
    `Amount: ${t.amount} (~$${t.amountUsd.toFixed(0)} USD)`,
    `From: ${t.fromAddress} ${t.fromLabel ? `[${t.fromLabel}]` : "(unlabeled)"}`,
    `To:   ${t.toAddress} ${t.toLabel ? `[${t.toLabel}]` : "(unlabeled)"}`,
    `Pattern: ${t.pattern}`,
    `Block time: ${t.blockTime}`,
    `Tx: ${t.txHash}`,
  ].join("\n");
}
