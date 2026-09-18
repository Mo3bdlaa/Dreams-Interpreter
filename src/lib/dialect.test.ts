import { describe, it, expect } from "vitest";
import { mapDialectToken, normalizeDialectText } from "./dialect";
import { retrieve } from "./rag";

describe("dialect normalization", () => {
  it("maps Egyptian face words to وجه", () => {
    expect(mapDialectToken("وشي")).toBe("وجه");
    expect(mapDialectToken("وشه")).toBe("وجه");
    expect(mapDialectToken("وش")).toBe("وجه");
  });

  it("maps common phonetic substitutions", () => {
    expect(mapDialectToken("دهب")).toBe("ذهب");
    expect(mapDialectToken("ميه")).toBe("ماء");
  });

  it("leaves فصحى / unknown words untouched", () => {
    expect(mapDialectToken("بحر")).toBe("بحر");
    expect(mapDialectToken("شبه")).toBe("شبه");
  });

  it("sees through an attached article or proclitic", () => {
    // Dream text glues particles on: "بقطة"، "والدكتور"، "المقابر".
    expect(mapDialectToken("بقطه")).toBe("قط");
    expect(mapDialectToken("للدكتور")).toBe("طبيب");
    expect(mapDialectToken("المقابر")).toBe("قبر");
  });

  it("does not gut short roots that merely start with a proclitic", () => {
    for (const w of ["بحر", "بيت", "لبن", "وجه", "كلب"]) {
      expect(mapDialectToken(w)).toBe(w);
    }
  });

  it("maps modern words onto their classical symbol", () => {
    expect(mapDialectToken("قطه")).toBe("قط");
    expect(mapDialectToken("ميت")).toBe("موت");
    expect(mapDialectToken("حريق")).toBe("نار");
    expect(mapDialectToken("مستشفي")).toBe("مرض");
  });

  it("rewrites a colloquial sentence for retrieval", () => {
    expect(normalizeDialectText("لقيت واحد وشه شبه وشي")).toBe(
      "لقيت واحد وجه شبه وجه",
    );
  });
});

describe("dialect-aware retrieval", () => {
  it("retrieves الوجه (not the silk symbol وشي) for the colloquial face", () => {
    const hits = retrieve("لقيت واحد وشه شبه وشي");
    const symbols = hits.map((h) => h.symbol);
    // The dreamer's intended symbol (الوجه) is grounded as an exact match...
    expect(symbols).toContain("وجه");
    expect(hits.find((h) => h.symbol === "وجه")?.symbolMatch).toBe(true);
    // ...and the look-alike classical symbol وشي (= حرير) is NOT retrieved.
    expect(symbols).not.toContain("وشي");
  });
});
