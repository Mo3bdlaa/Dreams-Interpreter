import { describe, it, expect } from "vitest";
import { normalizeArabic, tokenMatches, tokenize, stripArticle } from "./arabic";

describe("normalizeArabic", () => {
  it("strips diacritics and unifies letters", () => {
    expect(normalizeArabic("البَحْرُ")).toBe("البحر");
    expect(normalizeArabic("رؤية")).toBe("رويه");
    expect(normalizeArabic("أسد")).toBe("اسد");
    expect(normalizeArabic("ذكرى")).toBe("ذكري");
  });

  it("detaches Arabic punctuation from the word it follows", () => {
    // Left attached, "خايف،" matches nothing and the dream loses its grounding.
    expect(normalizeArabic("خايف، وبعدين")).toBe("خايف وبعدين");
    expect(normalizeArabic("بحر؟ نور؛ ماء.")).toBe("بحر نور ماء");
  });

  it("drops digits and tatweel", () => {
    expect(normalizeArabic("بحـــر")).toBe("بحر");
    expect(normalizeArabic("٣ بيوت 5")).toBe("بيوت");
  });
});

describe("stripArticle", () => {
  it("removes the definite article but keeps root letters", () => {
    expect(stripArticle("البحر")).toBe("بحر");
    expect(stripArticle("والبحر")).toBe("بحر");
    // root letters that look like clitics must NOT be stripped
    expect(stripArticle("بحر")).toBe("بحر");
    expect(stripArticle("وجه")).toBe("وجه");
  });
});

describe("tokenMatches", () => {
  it("matches article-prefixed and base forms symmetrically", () => {
    expect(tokenMatches("البحر", "بحر")).toBe(true);
    expect(tokenMatches("بحر", "البحر")).toBe(true);
  });

  it("tolerates short inflectional suffixes", () => {
    expect(tokenMatches("اسناني", "الاسنان")).toBe(true);
    expect(tokenMatches("نورا", "نور")).toBe(true);
  });

  it("does not confuse the root baa with the preposition bi", () => {
    // بحر must not be reduced to حر
    expect(tokenMatches("بحر", "حر")).toBe(false);
    expect(tokenMatches("وجه", "جه")).toBe(false);
  });

  it("rejects unrelated tokens", () => {
    expect(tokenMatches("ثعبان", "بحر")).toBe(false);
    expect(tokenMatches("دينار", "نار")).toBe(false);
  });
});

describe("tokenize", () => {
  it("splits normalized text into tokens", () => {
    expect(tokenize("رأيت البحر")).toEqual(["رايت", "البحر"]);
  });
});
