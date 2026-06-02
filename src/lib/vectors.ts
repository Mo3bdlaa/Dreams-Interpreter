// Optional semantic layer for RAG. Cosine similarity over precomputed
// embeddings. The corpus vectors are built offline by
// scripts/build-embeddings.mjs into src/data/embeddings.json (opt-in).
//
// This module is only used when that file exists AND an embeddings-capable
// provider is configured; otherwise retrieval stays purely lexical (free,
// offline, zero-latency). Kept dependency-free and unit-tested.

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface ScoredId {
  id: string;
  score: number;
}

/** Rank corpus vectors against a query vector, returning the top-k ids. */
export function rankByVector(
  query: number[],
  corpus: { id: string; vector: number[] }[],
  k = 6,
): ScoredId[] {
  return corpus
    .map((c) => ({ id: c.id, score: cosine(query, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
