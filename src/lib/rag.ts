import kb from "@/data/knowledge-base.json";
import {
  normalizeArabic,
  tokenize,
  tokenMatches,
  STOPWORDS,
} from "./arabic";

export interface KbEntry {
  id: string;
  symbol: string;
  source: string;
  url: string;
  text: string;
}

const ENTRIES = kb as KbEntry[];

// ---------------------------------------------------------------------------
// One-time index built at module load (reused across requests / serverless
// warm invocations). Lexical BM25-lite over the corpus + a strong boost when
// the entry's symbol name actually appears in the dream.
// ---------------------------------------------------------------------------

interface Indexed {
  entry: KbEntry;
  symbolTokens: string[]; // normalized tokens of the symbol name
  termFreq: Map<string, number>; // content token -> count
  len: number;
}

const df = new Map<string, number>(); // document frequency per token
let avgLen = 0;

const INDEX: Indexed[] = ENTRIES.map((entry) => {
  const symbolTokens = tokenize(entry.symbol);
  const contentTokens = tokenize(`${entry.symbol} ${entry.text}`).filter(
    (t) => t.length > 1 && !STOPWORDS.has(t),
  );
  const termFreq = new Map<string, number>();
  for (const t of contentTokens) termFreq.set(t, (termFreq.get(t) || 0) + 1);
  for (const t of termFreq.keys()) df.set(t, (df.get(t) || 0) + 1);
  return { entry, symbolTokens, termFreq, len: contentTokens.length };
});

avgLen =
  INDEX.reduce((s, d) => s + d.len, 0) / Math.max(INDEX.length, 1) || 1;

const N = INDEX.length;
const K1 = 1.4;
const B = 0.75;

function idf(token: string): number {
  const n = df.get(token) || 0;
  return Math.log(1 + (N - n + 0.5) / (n + 0.5));
}

export interface Retrieved extends KbEntry {
  score: number;
  symbolMatch: boolean;
}

/**
 * Retrieve the top-k most relevant classical interpretations for a dream.
 * Combines BM25 lexical scoring with a large boost for entries whose symbol
 * name is actually mentioned in the dream (clitic/suffix tolerant).
 */
export function retrieve(dreamText: string, k = 6): Retrieved[] {
  const queryTokens = tokenize(dreamText).filter(
    (t) => t.length > 1 && !STOPWORDS.has(t),
  );
  if (queryTokens.length === 0) return [];
  const querySet = [...new Set(queryTokens)];

  const scored = INDEX.map((doc) => {
    // BM25 over content (used for ranking within each tier).
    let bm25 = 0;
    for (const qt of querySet) {
      const tf = doc.termFreq.get(qt);
      if (!tf) continue;
      const denom = tf + K1 * (1 - B + (B * doc.len) / avgLen);
      bm25 += idf(qt) * ((tf * (K1 + 1)) / denom);
    }

    // Does the full symbol name appear in the dream? This is the strongest,
    // most precise signal — an entry that is literally about a thing the
    // dreamer saw — so these always outrank loose lexical matches.
    const symbolMatch =
      doc.symbolTokens.length > 0 &&
      doc.symbolTokens.every((st) =>
        queryTokens.some((qt) => tokenMatches(qt, st)),
      );

    return { entry: doc.entry, bm25, symbolMatch, n: doc.symbolTokens.length };
  });

  // Tier 1: exact symbol-name matches, longer (more specific) names first,
  // then by lexical relevance.
  const primary = scored
    .filter((s) => s.symbolMatch)
    .sort((a, b) => b.n - a.n || b.bm25 - a.bm25);

  // Tier 2: best remaining lexical matches fill any leftover slots.
  const chosen = new Set(primary.map((p) => p.entry.id));
  const secondary = scored
    .filter((s) => !chosen.has(s.entry.id) && s.bm25 > 2.5)
    .sort((a, b) => b.bm25 - a.bm25);

  return [...primary, ...secondary]
    .slice(0, k)
    .map((s) => ({
      ...s.entry,
      score: Number((s.bm25 + (s.symbolMatch ? 100 : 0)).toFixed(3)),
      symbolMatch: s.symbolMatch,
    }));
}

/**
 * Build a grounding block of the retrieved classical references to inject
 * into the interpreter's system context. Empty string when nothing relevant.
 */
export function buildRagContext(dreamText: string, k = 6): string {
  const hits = retrieve(dreamText, k);
  if (hits.length === 0) return "";
  const lines = hits
    .map((h) => `- [${h.symbol}] ${h.text}`)
    .join("\n");
  return (
    "مقتطفات من مراجع تفسير الأحلام الكلاسيكية (المصدر: تفسير الأحلام لابن سيرين) " +
    "ذات الصلة برموز هذا الحلم. اعتمد عليها في تفسيرك ولا تخرج عنها بلا داعٍ:\n" +
    lines
  );
}

export interface Source {
  symbol: string;
  url: string;
}

/**
 * Distinct (symbol → source page) citations. Only entries whose symbol name
 * actually appears in the dream are cited, so links stay precise (no loose
 * BM25 fillers).
 */
export function retrieveSources(dreamText: string, k = 8): Source[] {
  const hits = retrieve(dreamText, k).filter((h) => h.symbolMatch);
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const h of hits) {
    if (seen.has(h.symbol)) continue;
    seen.add(h.symbol);
    sources.push({ symbol: h.symbol, url: h.url });
  }
  return sources;
}

/** A compact markdown "sources" footer linking each cited symbol to its
 *  classical-reference page. Empty string when there is nothing to cite. */
export function buildSourcesFooter(dreamText: string, k = 6): string {
  const sources = retrieveSources(dreamText, k);
  if (sources.length === 0) return "";
  const links = sources.map((s) => `[${s.symbol}](${s.url})`).join(" · ");
  return `\n\n---\n📚 **المصادر** (تفسير ابن سيرين): ${links}`;
}

export const KB_SIZE = ENTRIES.length;
