import "server-only";
import { resolveEmbedModel } from "./embed-model";

// Server-side query embedding via an OpenAI-compatible /embeddings endpoint.
// Returns null (caller falls back to lexical) when not configured or on error.

/** Which embeddings model to use, or null to stay purely lexical. */
export function embedModel(): string | null {
  return resolveEmbedModel(process.env.AI_EMBED_MODEL, process.env.AI_BASE_URL);
}

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY && embedModel());
}

// Semantic retrieval is an enhancement, never a dependency: if the embeddings
// call is slow or rate-limited we drop it and interpret from lexical grounding
// rather than making the reader wait.
const TIMEOUT_MS = Number(process.env.AI_EMBED_TIMEOUT_MS) || 5000;

export async function embedQuery(text: string): Promise<number[] | null> {
  const model = embedModel();
  if (!model || !process.env.AI_API_KEY) return null;
  const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({ model, input: text.slice(0, 2000) }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`[embed] ${model} -> ${res.status}`);
      return null;
    }
    const json = await res.json();
    const vec = json?.data?.[0]?.embedding;
    return Array.isArray(vec) ? vec : null;
  } catch (e) {
    console.error("[embed] failed:", (e as Error)?.message || e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
