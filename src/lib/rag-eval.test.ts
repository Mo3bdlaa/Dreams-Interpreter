import { describe, it, expect } from "vitest";
import { retrieve, retrieveSources, buildCitedFooter, type KbEntry } from "./rag";

/**
 * Retrieval quality evals.
 *
 * Grounding precision is the single biggest driver of interpretation quality:
 * anything handed to the model as "a classical reference for this dream" WILL
 * be interpreted. Before these guards, a plain sentence retrieved the corpus
 * entries for "لي"، "بعد"، "شبه" and "لوح" and cited them as dream symbols.
 */

interface Case {
  name: string;
  dream: string;
  expect: string[]; // symbols that must be grounded
  forbid: string[]; // function words / bogus stems that must never appear
}

const CASES: Case[] = [
  {
    name: "colloquial face + light",
    dream:
      "حلمت إني ماشي في شارع ضلمة لوحدي ولقيت راجل وشه شبه وشي بالظبط، وكان بيبص لي وأنا خايف منه، وبعدين فجأة طلع نور قوي من السما وحسّيت إني اطمنّيت.",
    expect: ["وجه", "نور"],
    forbid: ["لي", "بعد", "شبه", "لوح"],
  },
  {
    name: "late mother, bread, house, tree",
    dream:
      "رأيت أمي المتوفاة تبتسم لي وتعطيني رغيف خبز ساخن، ثم دخلت بيتنا القديم ووجدت الشجرة التي في الحوش قد أثمرت.",
    expect: ["خبز", "بيت", "شجرة"],
    forbid: ["لي", "بعد"],
  },
  {
    name: "falling teeth at a wedding",
    dream:
      "حلمت إن أسناني بتقع في إيدي وأنا بحاول أمسكها، وكنت في فرح وناس كتير بتبص عليا وأنا مكسوف.",
    expect: ["أسنان"],
    forbid: ["لي", "بعد", "شبه"],
  },
  {
    name: "flying over the sea then clear water",
    dream:
      "شفت نفسي بطير فوق البحر وبعد كده وقعت في مياه صافية وطلعت منها تاني من غير ما أغرق.",
    expect: ["بحر", "ماء"],
    forbid: ["بعد", "غير", "لي"],
  },
];

describe("retrieval grounding precision", () => {
  for (const c of CASES) {
    it(`grounds the real symbols: ${c.name}`, () => {
      const grounded = retrieve(c.dream, 8)
        .filter((h) => h.symbolMatch)
        .map((h) => h.symbol);
      for (const s of c.expect) expect(grounded).toContain(s);
    });

    it(`never grounds function words: ${c.name}`, () => {
      const grounded = retrieve(c.dream, 8)
        .filter((h) => h.symbolMatch)
        .map((h) => h.symbol);
      for (const s of c.forbid) expect(grounded).not.toContain(s);
    });

    it(`never cites function words: ${c.name}`, () => {
      const cited = retrieveSources(c.dream).map((s) => s.symbol);
      for (const s of c.forbid) expect(cited).not.toContain(s);
    });
  }
});

/**
 * Coverage: dreams are narrated as ACTIONS ("حلمت إني وقعت"، "اتجوزت") while the
 * dictionaries are indexed by NOUNS. Without the verb layer these return no
 * grounding at all — or match a wrong root once the Egyptian present-tense "بـ"
 * is stripped ("بسوق عربية" → سوق + عرب, a market and the Arabs, for a dream
 * about driving a car).
 */
describe("action-dream grounding", () => {
  const CASES: { dream: string; expect: string; forbid?: string[] }[] = [
    { dream: "حلمت إني وقعت من مكان عالي", expect: "سقوط" },
    { dream: "حلمت إني اتجوزت واحدة معرفهاش", expect: "زواج" },
    { dream: "حلمت إني مشيت حافي في الشارع", expect: "حفاء" },
    { dream: "حلمت إني بعيط بصوت عالي ومحدش سامعني", expect: "بكاء" },
    { dream: "حلمت إني بطير في السما وفوق البيوت", expect: "طيران" },
    {
      dream: "حلمت إني بجري وبحاول أهرب من حاجة بتطاردني",
      expect: "خوف",
      forbid: ["حاجه"],
    },
    {
      dream: "حلمت إني بسوق عربية وفرملتها مش شغالة",
      expect: "ركوب",
      forbid: ["سوق", "عرب"],
    },
    {
      dream: "حلمت إني بحلق شعري وقصيته كله",
      expect: "شعر",
      forbid: ["كلة"], // "كله" must not match the symbol "كلة"
    },
  ];

  for (const c of CASES) {
    it(`grounds «${c.expect}»: ${c.dream.slice(12, 40)}`, () => {
      const grounded = retrieve(c.dream, 24)
        .filter((h) => h.symbolMatch)
        .map((h) => h.symbol);
      expect(grounded).toContain(c.expect);
      for (const bad of c.forbid ?? []) expect(grounded).not.toContain(bad);
    });
  }
});

describe("citation integrity", () => {  const refs = [
    {
      id: "a", symbol: "بحر", source: "تفسير الأحلام لابن سيرين",
      url: "https://x/b", text: "t1",
    },
    {
      id: "b", symbol: "نور", source: "تعطير الأنام في تعبير المنام للنابلسي",
      url: "https://x/n", text: "t2",
    },
    {
      id: "c", symbol: "خبز", source: "الإشارات في علم العبارات لابن شاهين",
      url: "https://x/k", text: "t3",
    },
  ] as KbEntry[];

  it("cites only the references the reply actually used", () => {
    const footer = buildCitedFooter("البحر سعةٌ ورزق [1]، والنور هداية [2].", refs);
    expect(footer).toContain("المراجع المستنَد إليها");
    expect(footer).toContain("بحر");
    expect(footer).toContain("نور");
    expect(footer).not.toContain("خبز"); // never referenced by the reply
  });

  it("attributes each citation to its book", () => {
    const footer = buildCitedFooter("البحر سعة [1]، والنور هداية [2].", refs);
    expect(footer).toContain("بحر — ابن سيرين");
    expect(footer).toContain("نور — النابلسي");
  });

  it("keeps the inline numbers so markers and footer agree", () => {
    // The reply leans on [3] only — the footer must say [3], not renumber to [1].
    const footer = buildCitedFooter("والخبز رزقٌ حاضر [3].", refs);
    expect(footer).toContain("[3] [خبز — ابن شاهين]");
    expect(footer).not.toContain("[1] [خبز");
  });

  it("does not claim sources when the reply cited none", () => {
    const footer = buildCitedFooter("تفسير بلا استناد صريح.", refs);
    expect(footer).not.toContain("المراجع المستنَد إليها");
    expect(footer).toContain("رموز ذات صلة");
  });

  it("ignores reference numbers that do not exist", () => {
    const footer = buildCitedFooter("كلام [9] لا أصل له.", refs);
    expect(footer).not.toContain("المراجع المستنَد إليها");
  });

  it("emits nothing when there was no grounding at all", () => {
    expect(buildCitedFooter("أي نص [1]", [])).toBe("");
  });
});
