// Shared Arabic text utilities used by both the curated symbol matcher and
// the RAG retriever. Pure functions (no server-only deps) so they can run
// anywhere.

/** Normalize Arabic: strip diacritics + unify alef/ya/ta-marbuta + drop punctuation. */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ْٰ]/g, "") // tashkeel
    .replace(/[أإآٱ]/g, "ا") // hamza alefs -> alef
    .replace(/ى/g, "ي") // alef maqsura -> ya
    .replace(/ة/g, "ه") // ta marbuta -> ha
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^؀-ۿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The definite article (alone or fused with a leading conjunction/preposition),
// longest first. We deliberately do NOT strip bare single-letter clitics
// (و/ف/ب/ك/ل) because they are ambiguous with root letters — stripping the
// "ب" of بحر or "و" of وجه would corrupt the word. The article "ال" is safe
// and symmetric, which is what matters for matching.
const ARTICLES = ["وال", "فال", "بال", "كال", "لل", "ال"];

export function stripArticle(token: string): string {
  for (const p of ARTICLES) {
    if (token.startsWith(p) && token.length - p.length >= 2) {
      return token.slice(p.length);
    }
  }
  return token;
}

// Single-letter proclitics (conjunctions/prepositions) that may attach to a
// noun: و/ف/ب/ك/ل. Ambiguous with root letters, so we only strip them from the
// dream-side token (not the dictionary term) and require a long-enough stem.
const PROCLITICS = ["و", "ف", "ب", "ك", "ل"];

function coreMatch(a: string, b: string): boolean {
  if (a === b) return true;
  // The dream token (a) may carry inflectional suffixes on the dictionary
  // term (b), e.g. "نورا" -> "نور". We only allow the term to be a prefix of
  // the token (not the reverse) to avoid citing longer unrelated symbols.
  if (b.length >= 3 && a.startsWith(b) && a.length - b.length <= 2) return true;
  return false;
}

/** True if a single text token matches a term, tolerating the definite
 *  article, attached proclitics, and short inflectional suffixes (ـاً،ـها…).
 *  Both inputs must already be normalized. */
export function tokenMatches(token: string, term: string): boolean {
  const a = stripArticle(token);
  const b = stripArticle(term);
  if (coreMatch(a, b)) return true;
  // Try stripping one leading proclitic from the (longer) dream token, e.g.
  // "بثعبان" -> "ثعبان". Guard with length so "بحر"/"بيت" aren't gutted.
  if (token.length >= 4 && PROCLITICS.includes(token[0])) {
    const stripped = stripArticle(token.slice(1));
    if (stripped.length >= 3 && coreMatch(stripped, b)) return true;
  }
  return false;
}

export function tokenize(text: string): string[] {
  return normalizeArabic(text).split(" ").filter(Boolean);
}

// Very common Arabic words that carry no retrieval signal.
export const STOPWORDS = new Set(
  [
    "في", "من", "على", "الى", "عن", "مع", "او", "ان", "انه", "اذا", "التي",
    "الذي", "هذا", "هذه", "ذلك", "كان", "قد", "ما", "لا", "هو", "هي", "كل",
    "به", "له", "ثم", "وقد", "وهو", "وهي", "يدل", "تدل", "دليل", "ربما",
    "رؤيه", "المنام", "الاحلام", "الحلم", "رايت", "حلمت", "وكان", "فان",
  ].map(normalizeArabic),
);
