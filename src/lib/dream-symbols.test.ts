import { describe, it, expect } from "vitest";
import { matchSymbols } from "./dream-symbols";

describe("matchSymbols", () => {
  it("matches symbols with attached clitics and inflections", () => {
    const keys = matchSymbols("رأيت ثعباناً في البحر").map((s) => s.key);
    expect(keys).toContain("ثعبان");
  });

  it("classifies sentiment via the curated set", () => {
    const water = matchSymbols("ماء صافٍ");
    expect(water[0]?.sentiment).toBe("positive");
  });

  it("returns nothing for unrelated text", () => {
    expect(matchSymbols("اجتماع عمل غداً").length).toBe(0);
  });
});
