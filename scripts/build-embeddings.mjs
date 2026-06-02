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

async function embed(texts) {
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data.map((d) => d.embedding);
}

const out = [];
for (let i = 0; i < kb.length; i += BATCH) {
  const slice = kb.slice(i, i + BATCH);
  const inputs = slice.map((e) => `${e.symbol}: ${e.text}`);
  const vectors = await embed(inputs);
  slice.forEach((e, j) => out.push({ id: e.id, vector: vectors[j] }));
  console.log(`  embedded ${Math.min(i + BATCH, kb.length)}/${kb.length}`);
}

const dest = path.join(root, "src/data/embeddings.json");
fs.writeFileSync(dest, JSON.stringify(out));
console.log(`Wrote ${out.length} vectors to ${dest}`);
