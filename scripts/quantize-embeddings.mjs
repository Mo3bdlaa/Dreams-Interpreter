#!/usr/bin/env node
/**
 * Compress the raw embeddings.json (float32, ~80MB) into a compact int8
 * representation (~6MB base64 JSON) that bundles cleanly into the app.
 *
 * Each vector is L2-normalized then quantized to int8 (×127). Since retrieval
 * uses cosine similarity, unit-normalization makes the quantization nearly
 * lossless for ranking purposes.
 *
 * Usage:  node scripts/quantize-embeddings.mjs
 * Input:  src/data/embeddings.json   ([{ id, vector }])
 * Output: src/data/kb-vectors.json   ({ dim, ids, data: <base64 int8> })
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "src/data/embeddings.json");
if (!fs.existsSync(src)) {
  console.error("embeddings.json not found. Run build-embeddings.mjs first.");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(src, "utf-8"));
const dim = raw[0].vector.length;
const ids = raw.map((e) => e.id);
const bytes = new Int8Array(raw.length * dim);

raw.forEach((e, i) => {
  const v = e.vector;
  let norm = 0;
  for (let j = 0; j < dim; j++) norm += v[j] * v[j];
  norm = Math.sqrt(norm) || 1;
  for (let j = 0; j < dim; j++) {
    const q = Math.round((v[j] / norm) * 127);
    bytes[i * dim + j] = Math.max(-127, Math.min(127, q));
  }
});

const b64 = Buffer.from(bytes.buffer).toString("base64");
const out = path.join(root, "src/data/kb-vectors.json");
fs.writeFileSync(out, JSON.stringify({ dim, count: raw.length, ids, data: b64 }));
const mb = (fs.statSync(out).size / 1e6).toFixed(1);
console.log(`Wrote ${raw.length} int8 vectors (dim ${dim}) to ${out} — ${mb} MB`);
