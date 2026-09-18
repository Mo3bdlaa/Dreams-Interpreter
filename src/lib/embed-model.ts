// Pure resolution of the embeddings model. Kept out of embed.ts (which is
// "server-only") so the branching can be unit-tested.

// Live free model on OpenRouter, 2048-dim — matches src/data/kb-vectors.json.
export const OPENROUTER_FREE_EMBED =
  "nvidia/llama-nemotron-embed-vl-1b-v2:free";

// Semantic retrieval sends the dream text to the embeddings provider, so it
// must be switchable off without a code change.
const OFF = /^(off|none|false|0|disabled)$/i;

/**
 * Which embeddings model to use, or null to stay purely lexical.
 *
 * An explicit model always wins (including "off"). With nothing set we default
 * to the free OpenRouter model, but only when the provider actually is
 * OpenRouter — pointing at another provider and silently guessing a model id
 * there would just produce 404s on every interpretation.
 */
export function resolveEmbedModel(
  explicit: string | undefined,
  baseUrl: string | undefined,
): string | null {
  const raw = (explicit || "").trim();
  if (OFF.test(raw)) return null;
  if (raw) return raw;
  return (baseUrl || "").includes("openrouter.ai")
    ? OPENROUTER_FREE_EMBED
    : null;
}
