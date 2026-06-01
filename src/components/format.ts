const FMT = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function formatArabicDate(ms: number | null | undefined): string {
  if (!ms) return "بدون تاريخ محدّد";
  return FMT.format(new Date(ms));
}

export function moodMeta(mood: string | null): {
  label: string;
  emoji: string;
  cls: string;
} {
  switch (mood) {
    case "positive":
      return {
        label: "إيجابي",
        emoji: "🌿",
        cls: "bg-emerald-500/15 text-emerald-300",
      };
    case "negative":
      return {
        label: "مقلق",
        emoji: "🌧",
        cls: "bg-rose-500/15 text-rose-300",
      };
    case "mixed":
      return {
        label: "مختلط",
        emoji: "🌗",
        cls: "bg-amber-500/15 text-amber-300",
      };
    case "neutral":
      return {
        label: "محايد",
        emoji: "🌫",
        cls: "bg-sky-500/15 text-sky-300",
      };
    default:
      return {
        label: "غير محدد",
        emoji: "✨",
        cls: "bg-white/5 text-night-100/70",
      };
  }
}
