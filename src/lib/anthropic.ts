import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Native Claude provider, used first when ANTHROPIC_API_KEY is set. The rest of
// the app stays provider-agnostic: if every Claude model here fails (outage,
// rate limit, a safety decline — Haiku has no server-side fallback), ai.ts
// carries on down the OpenAI-compatible chain.

export type ChatTurn = { role: "system" | "user" | "assistant"; content: string };
export type Effort = "low" | "medium" | "high";

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Claude models to try, in order (comma-separated ANTHROPIC_MODEL). */
export const ANTHROPIC_MODELS = (): string[] =>
  (process.env.ANTHROPIC_MODEL || "claude-haiku-5-5")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Effort for the interpretation itself; utility calls pass "low". */
export const INTERPRET_EFFORT = (): Effort => {
  const e = process.env.ANTHROPIC_EFFORT;
  return e === "low" || e === "high" ? e : "medium";
};

// Thinking is on by default on current Claude models and counts toward
// max_tokens, so the caller's budget (sized for the visible reply) gets
// headroom on top — otherwise a long think ends the turn before any text.
const THINKING_HEADROOM = 4000;

let client: Anthropic | null = null;
function getAnthropic(): Anthropic {
  // Reads ANTHROPIC_API_KEY from the environment.
  return (client ??= new Anthropic());
}

/**
 * Lay the request out for prompt caching, most stable first:
 *
 *   1. system — the fixed instruction prompt (the first system turn). Same
 *      bytes for every user and every dream, so one cache entry serves all
 *      traffic; it carries breakpoint #1.
 *   2. the conversation so far, with breakpoint #2 on the last assistant
 *      reply — a follow-up in the same dream reads the whole earlier exchange
 *      from cache.
 *   3. the newest user turn, with this turn's grounding (any further system
 *      turns) appended to it. Grounding changes every turn; anywhere earlier
 *      it would invalidate everything after it, which is why it is not in
 *      `system` here even though the OpenAI-compatible path sends it there.
 *
 * Prefixes under the model's minimum (512 tokens on current models) simply
 * don't cache — no error, no write charge — so the short utility prompts are
 * safe to mark too. No temperature: current Claude models reject sampling
 * parameters, and the prompt already steers toward grounded answers.
 */
export function buildParams(model: string, turns: ChatTurn[], maxTokens: number, effort: Effort) {
  const [fixed, ...extraSystem] = turns.filter((t) => t.role === "system");
  const system: Anthropic.TextBlockParam[] = fixed
    ? [{ type: "text", text: fixed.content, cache_control: { type: "ephemeral" } }]
    : [];

  const convo = turns.filter(
    (t): t is ChatTurn & { role: "user" | "assistant" } => t.role !== "system",
  );
  let lastAssistant = -1;
  convo.forEach((t, i) => {
    if (t.role === "assistant" && i < convo.length - 1) lastAssistant = i;
  });

  const messages: Anthropic.MessageParam[] = convo.map((t, i) => {
    const blocks: Anthropic.TextBlockParam[] = [{ type: "text", text: t.content }];
    if (i === lastAssistant) blocks[0].cache_control = { type: "ephemeral" };
    if (i === convo.length - 1 && t.role === "user") {
      for (const g of extraSystem) blocks.push({ type: "text", text: g.content });
    }
    return { role: t.role, content: blocks };
  });

  return {
    model,
    max_tokens: maxTokens + THINKING_HEADROOM,
    system,
    messages,
    output_config: { effort },
  };
}

/** One line per call in the server log, so cache hits can be checked live. */
function logUsage(model: string, usage: Anthropic.Usage) {
  console.info(
    `[claude] ${model} in=${usage.input_tokens} cache_read=${usage.cache_read_input_tokens ?? 0} ` +
      `cache_write=${usage.cache_creation_input_tokens ?? 0} out=${usage.output_tokens}`,
  );
}

class RefusalError extends Error {
  status = 400;
}

/** One non-streaming call; returns the reply text (thinking blocks skipped). */
export async function anthropicComplete(
  model: string,
  turns: ChatTurn[],
  maxTokens: number,
  effort: Effort,
): Promise<string> {
  const response = await getAnthropic().messages.create(
    buildParams(model, turns, maxTokens, effort),
  );
  logUsage(model, response.usage);
  if (response.stop_reason === "refusal") {
    throw new RefusalError(`${model} declined the request`);
  }
  return response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

/** Streaming call; yields text deltas only. */
export async function* anthropicStream(
  model: string,
  turns: ChatTurn[],
  maxTokens: number,
  effort: Effort,
): AsyncGenerator<string> {
  const stream = getAnthropic().messages.stream(
    buildParams(model, turns, maxTokens, effort),
  );
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
  const final = await stream.finalMessage();
  logUsage(model, final.usage);
  if (final.stop_reason === "refusal") {
    throw new RefusalError(`${model} declined the request`);
  }
}
