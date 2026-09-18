import { describe, it, expect } from "vitest";
import {
  penalty,
  symbolKey,
  MIN_SAMPLES,
  type SymbolVerdicts,
} from "./feedback-penalty";

const v = (up: number, down: number): SymbolVerdicts => ({ up, down });

describe("symbolKey", () => {
  it("treats a symbol and its articled form as the same", () => {
    expect(symbolKey("الأسنان")).toBe(symbolKey("أسنان"));
    expect(symbolKey("الوجه")).toBe(symbolKey("وجه"));
  });
});

describe("penalty", () => {
  const map = (entries: Record<string, SymbolVerdicts>) =>
    new Map(Object.entries(entries).map(([k, val]) => [symbolKey(k), val]));

  it("is zero for a symbol nobody has rated", () => {
    expect(penalty("بحر", map({}))).toBe(0);
  });

  it("waits for enough ratings before acting", () => {
    // One bad day must not bury a symbol.
    expect(penalty("بحر", map({ بحر: v(0, MIN_SAMPLES - 1) }))).toBe(0);
  });

  it("is zero while readers accept at least half the time", () => {
    expect(penalty("بحر", map({ بحر: v(5, 5) }))).toBe(0);
    expect(penalty("بحر", map({ بحر: v(9, 1) }))).toBe(0);
  });

  it("rises with the rejection rate", () => {
    const mild = penalty("بحر", map({ بحر: v(3, 7) }));
    const severe = penalty("بحر", map({ بحر: v(1, 9) }));
    expect(mild).toBeGreaterThan(0);
    expect(severe).toBeGreaterThan(mild);
    expect(severe).toBeLessThanOrEqual(1);
  });

  it("matches regardless of the definite article", () => {
    expect(penalty("الوجه", map({ وجه: v(0, 10) }))).toBeGreaterThan(0);
  });
});
