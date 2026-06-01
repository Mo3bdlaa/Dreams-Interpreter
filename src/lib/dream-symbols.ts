import symbolsData from "@/data/dream-symbols.json";
import { normalizeArabic as normalize, tokenMatches } from "./arabic";

export interface DreamSymbol {
  key: string;
  synonyms: string[];
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  interpretation: string;
}

export const SYMBOLS = symbolsData as DreamSymbol[];

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
