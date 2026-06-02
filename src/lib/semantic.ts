import vecData from "@/data/kb-vectors.json";

// Loads the quantized corpus vectors (int8, L2-normalized ×127) and ranks
// them against a query embedding by cosine similarity. Decoded once at module
// load and reused across warm invocations.

interface VecFile {
  dim: number;
  count: number;
  ids: string[];
  data: string; // base64 of Int8Array, row-major count×dim
}

const file = vecData as VecFile;

let ROWS: Int8Array | null = null;
function rows(): Int8Array {
  if (!ROWS) {
    const buf = Buffer.from(file.data, "base64");
    ROWS = new Int8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  return ROWS;
}

export function isSemanticReady(): boolean {
  return Array.isArray(file.ids) && file.ids.length > 0;
}

export interface SemHit {
  id: string;
  score: number;
}

/**
 * Rank the whole corpus against a query embedding. The stored rows are unit
 * vectors quantized by ×127, so cosine ≈ Σ q̂[j]·(row[j]/127) with a
 * unit-normalized query.
 */
export function semanticRank(queryVec: number[], k = 8): SemHit[] {
  if (!isSemanticReady()) return [];
  const dim = file.dim;
  const data = rows();

  // Normalize the query.
  let qnorm = 0;
  for (let j = 0; j < dim; j++) qnorm += queryVec[j] * queryVec[j];
  qnorm = Math.sqrt(qnorm) || 1;
  const q = new Float32Array(dim);
  for (let j = 0; j < dim; j++) q[j] = queryVec[j] / qnorm;

  const hits: SemHit[] = [];
  for (let i = 0; i < file.count; i++) {
    const base = i * dim;
    let dot = 0;
    for (let j = 0; j < dim; j++) dot += q[j] * data[base + j];
    hits.push({ id: file.ids[i], score: dot / 127 });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, k);
}
