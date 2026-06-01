export function newId(): string {
  return crypto.randomUUID();
}

const RTF = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function formatArabicDate(ms: number | null | undefined): string {
  if (!ms) return "بدون تاريخ";
  return RTF.format(new Date(ms));
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
