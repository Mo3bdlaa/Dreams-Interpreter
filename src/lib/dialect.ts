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
  // الأسنان — العامية تُسقط الهمزة: «سناني/سنانه».
  سناني: "اسنان",
  سنانه: "اسنان",
  سنانك: "اسنان",
  سنانها: "اسنان",
  // الماء.
  مويه: "ماء",
  ميه: "ماء",
  مياه: "ماء",
  // النقود.
  فلوس: "مال",

  // ── الأفعال ──────────────────────────────────────────────────────────────
  // الأحلام تُروى بالأفعال لا بالأسماء ("حلمت إني وقعت"، "اتجوزت")، والمعاجم
  // مفهرسة بالأسماء. بدون هذه الطبقة يرجع الاسترجاع فارغاً لحلم كامل، أو —
  // أسوأ — يطابق جذراً خاطئاً بعد نزع الباء («بسوق عربية» ⇒ سوق + عرب).
  // كل قيمة هنا رمزٌ موجود فعلاً في المتن.
  // السقوط
  وقعت: "سقوط",
  بقع: "سقوط",
  اقع: "سقوط",
  وقوع: "سقوط",
  بوقع: "سقوط",
  // الزواج
  اتجوزت: "زواج",
  اتجوز: "زواج",
  بتجوز: "زواج",
  جوازي: "زواج",
  جوازه: "زواج",
  // المشي حافياً
  حافي: "حفاء",
  حفيان: "حفاء",
  // البكاء
  بعيط: "بكاء",
  عيطت: "بكاء",
  بيعيط: "بكاء",
  عياط: "بكاء",
  // الطيران (لا الطائر): «بطير» بعد نزع الباء تصير «طير».
  بطير: "طيران",
  طاير: "طيران",
  بأطير: "طيران",
  // القيادة/الركوب. ملاحظة: «بسوق» تحتمل «في سوقٍ» في الفصحى، لكن في رواية
  // الحلم بالعامية المصرية هي القيادة، وهي الغالبة على استعمال التطبيق.
  بسوق: "ركوب",
  سايق: "ركوب",
  سواقه: "ركوب",
  عربيه: "ركوب",
  عربيتي: "ركوب",
  // الهرب والمطاردة — بابها في المعاجم هو الخوف.
  بهرب: "خوف",
  اهرب: "خوف",
  هربت: "خوف",
  بتطاردني: "خوف",
  خايف: "خوف",
  خوفت: "خوف",
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

/**
 * An explicit gloss of the dialect words present in THIS dream, handed to the
 * model alongside the references.
 *
 * Normalizing the retrieval query is not enough on its own: the model still
 * reads the raw colloquial text, and weaker models misread it (one rendered
 * «وشه شبه وشي» as "a face resembling something" instead of "his face looks
 * like mine"). Spelling the mapping out makes any model read it correctly.
 */
export function dialectHints(text: string): string {
  const seen = new Map<string, string>();
  for (const tok of normalizeArabic(text).split(" ")) {
    const msa = DIALECT[tok];
    if (msa && !seen.has(tok)) seen.set(tok, msa);
  }
  if (seen.size === 0) return "";
  const pairs = [...seen]
    .map(([d, m]) => `«${d}» = «${m}»`)
    .join("، ");
  return (
    "ملاحظة لغوية: الرائي يروي حلمه بالعامية. في نصّه هذه الألفاظ بمعانيها الفصيحة: " +
    pairs +
    ". افهمها بهذا المعنى ولا تؤوّلها على ظاهر لفظها."
  );
}
