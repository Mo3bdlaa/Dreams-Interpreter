#!/usr/bin/env node
/**
 * OPTIONAL: build semantic embeddings for the dream-symbol corpus so RAG can
 * match by meaning, not just wording. Requires an OpenAI-compatible
 * embeddings endpoint.
 *
 * Usage:
 *   AI_API_KEY=...  \
 *   AI_BASE_URL=https://api.openai.com/v1  \
 *   AI_EMBED_MODEL=text-embedding-3-small  \
 *   node scripts/build-embeddings.mjs
 *
 * Writes src/data/embeddings.json: [{ id, vector }]. The app picks it up
 * automatically when present (see src/lib/rag.ts hybrid path). Without it,
 * retrieval stays purely lexical — free, offline, zero-latency.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const kb = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/knowledge-base.json"), "utf-8"),
);

const apiKey = process.env.AI_API_KEY;
const baseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";
const model = process.env.AI_EMBED_MODEL || "text-embedding-3-small";
if (!apiKey) {
  console.error("AI_API_KEY is required to build embeddings.");
  process.exit(1);
}

const BATCH = 64;
// OpenRouter caps free models at 20 requests/minute, so pace requests and
// back off when the window is exhausted rather than dying mid-corpus.
const MIN_GAP_MS = Number(process.env.EMBED_MIN_GAP_MS || 3500);
const MAX_RETRIES = 6;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function embed(texts) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, input: texts }),
    });
    if (res.ok) {
      const json = await res.json();
      return json.data.map((d) => d.embedding);
    }
    const body = await res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) {
      throw new Error(`embeddings ${res.status}: ${body}`);
    }
    // Honour the reset timestamp when the provider sends one.
    let waitMs = Math.min(60_000, 4000 * 2 ** attempt);
    const reset = Number(body.match(/"X-RateLimit-Reset":"(\d+)"/)?.[1]);
    if (reset) waitMs = Math.max(waitMs, Math.min(90_000, reset - Date.now() + 1500));
    console.log(`    … ${res.status}, retrying in ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }
}

const dest = path.join(root, "src/data/embeddings.json");

// Resume: keep vectors already built for entries still in the corpus.
const kbIds = new Set(kb.map((e) => e.id));
let out = [];
if (fs.existsSync(dest)) {
  try {
    out = JSON.parse(fs.readFileSync(dest, "utf-8")).filter((v) =>
      kbIds.has(v.id),
    );
  } catch {
    out = [];
  }
}
const done = new Set(out.map((v) => v.id));
const todo = kb.filter((e) => !done.has(e.id));
console.log(`${done.size} already embedded, ${todo.length} to go`);

for (let i = 0; i < todo.length; i += BATCH) {
  const slice = todo.slice(i, i + BATCH);
  const started = Date.now();
  const vectors = await embed(slice.map((e) => `${e.symbol}: ${e.text}`));
  slice.forEach((e, j) => out.push({ id: e.id, vector: vectors[j] }));
  // Checkpoint after every batch so a crash never loses completed work.
  fs.writeFileSync(dest, JSON.stringify(out));
  console.log(`  embedded ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  const gap = MIN_GAP_MS - (Date.now() - started);
  if (i + BATCH < todo.length && gap > 0) await sleep(gap);
}

console.log(`Wrote ${out.length} vectors to ${dest}`);
