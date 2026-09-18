// Pure scoring for the reader-feedback signal. Kept out of feedback-signal.ts
// (which is "server-only") so the maths can be unit-tested.

import { normalizeArabic, stripArticle } from "./arabic";

export interface SymbolVerdicts {
  up: number;
  down: number;
}

/** Symbols compare by their article-stripped normalized form. */
export function symbolKey(symbol: string): string {
  return stripArticle(normalizeArabic(symbol));
}

// Below this many ratings a symbol has no track record worth acting on.
export const MIN_SAMPLES = 4;

/**
 * Rank penalty for a symbol: 0 when it has no track record or a decent one,
 * rising towards 1 the more consistently readers rejected replies grounded on
 * it. Only applied once there are enough ratings to mean something, and it
 * only reorders — a thumbs-down judges the whole answer, not one excerpt.
 */
export function penalty(
  symbol: string,
  verdicts: Map<string, SymbolVerdicts>,
): number {
  const v = verdicts.get(symbolKey(symbol));
  if (!v) return 0;
  const total = v.up + v.down;
  if (total < MIN_SAMPLES) return 0;
  const rejectRate = v.down / total;
  // Leave anything at or below half-rejected alone; ramp over the rest.
  return rejectRate <= 0.5 ? 0 : (rejectRate - 0.5) * 2;
}
