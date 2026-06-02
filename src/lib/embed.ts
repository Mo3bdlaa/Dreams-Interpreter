import "server-only";

// Server-side query embedding via an OpenAI-compatible /embeddings endpoint.
// Returns null (caller falls back to lexical) when not configured or on error.

export function isEmbeddingConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY && process.env.AI_EMBED_MODEL);
}

export async function embedQuery(text: string): Promise<number[] | null> {
  if (!isEmbeddingConfigured()) return null;
  const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";
  try {
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.AI_EMBED_MODEL,
        input: text.slice(0, 2000),
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const vec = json?.data?.[0]?.embedding;
    return Array.isArray(vec) ? vec : null;
  } catch {
    return null;
  }
}
