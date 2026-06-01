import symbolsData from "@/data/dream-symbols.json";

export interface DreamSymbol {
  key: string;
  synonyms: string[];
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  interpretation: string;
}

export const SYMBOLS = symbolsData as DreamSymbol[];

/** Normalize Arabic text: strip diacritics + unify alef/ya/ta-marbuta. */
function normalize(text: string): string {
  return text
    .replace(/[ً-ْٰ]/g, "") // tashkeel
    .replace(/[أإآٱ]/g, "ا") // hamza alefs -> alef
    .replace(/ى/g, "ي") // alef maqsura -> ya
    .replace(/ة/g, "ه") // ta marbuta -> ha
    .replace(/[^؀-ۿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Leading clitics in Arabic (conjunctions/prepositions + definite article),
// longest first so we strip the biggest matching cluster.
const PREFIXES = ["وال", "فال", "بال", "كال", "لل", "ال", "و", "ف", "ب", "ك", "ل"];

function stripPrefix(token: string): string {
  for (const p of PREFIXES) {
    if (token.startsWith(p) && token.length - p.length >= 2) {
      return token.slice(p.length);
    }
  }
  return token;
}

/** True if a single-word term matches a single text token, tolerating
 *  attached clitics and short inflectional suffixes (ـاً، ـها، ـون…). */
function tokenMatches(token: string, term: string): boolean {
  if (token === term) return true;
  const t = stripPrefix(token);
  const r = stripPrefix(term);
  if (t === r) return true;
  // Allow inflectional suffixes after the stem (cap the extra length so we
  // don't match unrelated longer words that merely share a prefix).
  return r.length >= 3 && t.startsWith(r) && t.length - r.length <= 3;
}

/**
 * Scan free-text dream content and return the classical Islamic symbol
 * entries that appear in it. Single-word terms match per-token (tolerating
 * Arabic clitics/suffixes); multi-word terms match as a normalized substring.
 */
export function matchSymbols(text: string): DreamSymbol[] {
  const normalizedText = normalize(text);
  const tokens = normalizedText.split(" ").filter(Boolean);
  const matches: DreamSymbol[] = [];

  for (const symbol of SYMBOLS) {
    const terms = [symbol.key, ...symbol.synonyms];
    const hit = terms.some((raw) => {
      const term = normalize(raw);
      if (!term) return false;
      if (term.includes(" ")) return normalizedText.includes(term);
      return tokens.some((tok) => tokenMatches(tok, term));
    });
    if (hit) matches.push(symbol);
  }

  return matches;
}

/**
 * Build a compact reference block to ground the AI on the classical
 * interpretations of the symbols detected in the dream. Returns an empty
 * string when nothing matched.
 */
export function buildReferenceContext(text: string): string {
  const matched = matchSymbols(text);
  if (matched.length === 0) return "";

  const lines = matched
    .map((s) => `- ${s.key}: ${s.interpretation}`)
    .join("\n");

  return `مراجع من كتب تفسير الأحلام الكلاسيكية (مثل تفسير ابن سيرين والنابلسي) للرموز الواردة في هذا الحلم:\n${lines}`;
}
