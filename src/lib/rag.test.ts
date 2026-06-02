import { describe, it, expect } from "vitest";
import { retrieve, retrieveSources, buildSourcesFooter, KB_SIZE } from "./rag";

describe("knowledge base", () => {
  it("has a substantial corpus", () => {
    expect(KB_SIZE).toBeGreaterThan(2000);
  });
});

describe("retrieve", () => {
  it("ranks the exact symbol first", () => {
    const hits = retrieve("رأيت البحر الواسع");
    expect(hits[0].symbol).toBe("بحر");
  });

  it("finds multiple symbols in one dream", () => {
    const hits = retrieve("رأيت ناراً ثم نوراً");
    const symbols = hits.map((h) => h.symbol);
    expect(symbols).toContain("نار");
    expect(symbols).toContain("نور");
  });

  it("returns empty for text with no known symbols", () => {
    expect(retrieve("xyz 123 ضضض").length).toBe(0);
  });
});

describe("retrieveSources", () => {
  it("only cites entries whose symbol appears in the dream", () => {
    const sources = retrieveSources("حلمت بثعبان قرب البحر");
    const symbols = sources.map((s) => s.symbol);
    expect(symbols).toContain("ثعبان");
    expect(symbols).toContain("بحر");
    // every cited source must carry a real URL
    expect(sources.every((s) => s.url.startsWith("http"))).toBe(true);
  });
});

describe("buildSourcesFooter", () => {
  it("renders markdown links", () => {
    const footer = buildSourcesFooter("رأيت قمراً");
    expect(footer).toContain("📚");
    expect(footer).toMatch(/\[.+\]\(https?:\/\/.+\)/);
  });

  it("is empty when nothing matches", () => {
    expect(buildSourcesFooter("zzz 999")).toBe("");
  });
});
