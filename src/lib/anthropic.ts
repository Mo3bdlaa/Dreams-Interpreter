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
 * System turns go to the top-level `system` field. The first one is the fixed
 * instruction prompt, so it carries the cache breakpoint; per-dream grounding
 * follows it uncached. No temperature: current Claude models reject sampling
 * parameters, and the prompt already steers toward grounded answers.
 */
function buildParams(model: string, turns: ChatTurn[], maxTokens: number, effort: Effort) {
  const systemTurns = turns.filter((t) => t.role === "system");
  const system: Anthropic.TextBlockParam[] = systemTurns.map((t, i) => ({
    type: "text",
    text: t.content,
    ...(i === 0 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
  const messages: Anthropic.MessageParam[] = turns
    .filter((t): t is ChatTurn & { role: "user" | "assistant" } => t.role !== "system")
    .map((t) => ({ role: t.role, content: t.content }));
  return {
    model,
    max_tokens: maxTokens + THINKING_HEADROOM,
    system,
    messages,
    output_config: { effort },
  };
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
  if (final.stop_reason === "refusal") {
    throw new RefusalError(`${model} declined the request`);
  }
}
