// Colloquial → Modern-Standard-Arabic mapping for dream narration.
//
// People describe dreams in dialect (mostly Egyptian here). The classical
// corpus is in فصحى, so a literal lexical match can land on the WRONG symbol:
// e.g. Egyptian «وِشّي / وِشّه» means the FACE (وجه), but the corpus has a
// classical symbol «وشي» that means embroidered silk. Without this layer the
// retriever cites silk and the model grounds on the wrong meaning entirely.
//
// This is applied to the RETRIEVAL QUERY ONLY — it never alters the text shown
// to the user. Keys are already-normalized tokens (see normalizeArabic: همزات
// → ا، ى → ي، ة → ه، تشكيل محذوف).

import { normalizeArabic } from "./arabic";

const DIALECT: Record<string, string> = {
  // الوجه — العامية المصرية «وش» ومشتقاتها (وليس «الوِشاية» ولا «الوَشْي»).
  وش: "وجه",
  وشه: "وجه",
  وشي: "وجه",
  وشك: "وجه",
  وشها: "وجه",
  وشهم: "وجه",
  وشكم: "وجه",
  وشو: "وجه",
  وشنا: "وجه",
  // إبدالات حرفية شائعة في النطق العامي (ذ→د، ث→ت).
  دهب: "ذهب",
  تلج: "ثلج",
  تور: "ثور",
  // الماء.
  مويه: "ماء",
  ميه: "ماء",
  مياه: "ماء",
  // النقود.
  فلوس: "مال",
};

/** Map a single normalized token to its MSA equivalent (or return it as-is). */
export function mapDialectToken(token: string): string {
  return DIALECT[token] ?? token;
}

/**
 * Rewrite dialect words in free text to their MSA equivalents so the RAG
 * retriever finds the symbol the dreamer actually means. For retrieval only —
 * never display this to the user.
 */
export function normalizeDialectText(text: string): string {
  return normalizeArabic(text)
    .split(" ")
    .map(mapDialectToken)
    .filter(Boolean)
    .join(" ");
}
