import { describe, it, expect } from "vitest";
import { interpretDream } from "./ai";

/**
 * Live interpretation eval — calls the real model chain, so it is skipped
 * unless LIVE_EVAL=1 (and AI_API_KEY etc. are set):
 *
 *   LIVE_EVAL=1 AI_API_KEY=… AI_BASE_URL=https://openrouter.ai/api/v1 npx vitest run interpret.live
 *
 * Retrieval evals prove the right excerpts reach the model; this proves the
 * model then reads the dreamer's state, applies only rulings whose conditions
 * hold, and keeps both faces of a symbol. Each case lists points a competent
 * interpreter must make and mistakes it must not. Free models are noisy, so
 * read the printed report across a couple of runs rather than one pass/fail.
 */

interface Check {
  desc: string;
  re: RegExp;
}
interface Case {
  name: string;
  dream: string;
  must: Check[];
  mustNot: Check[];
}

const CASES: Case[] = [
  {
    name: "English, someone else's dream: soiling himself unseen",
    dream:
      "Someone told me he dreamed he was sitting and he pooped in his pants, felt relief, but still he tried hard to hold himself but couldn't at all, it was out of his control. People didn't see or feel anything. He was sitting half laid down speaking to people asking him about their problems and he was giving advice. Give me interpretation in arabic",
    must: [
      { desc: "يلتقط أن الناس لم يروا (ستر/عدم انكشاف)", re: /ستر|لم ي(رَ|ر|شعر|نتبه|لاحظ)|لا يشعر|دون أن ي|لم يفطن/ },
      { desc: "الغائط مال أو سرّ", re: /مال|سرّ|سره|سرٍّ|كتمان|يكتم/ },
      { desc: "الراحة = زوال همّ/انفراج", re: /(يذهب|زوال|ذهاب)\S*\s*(همّ|هم|غم)|انفراج|فرج|تنفيس/ },
      { desc: "يذكر وجه ابن سيرين المكروه (خطيئة/ذلة/كلام قبيح) أو التباين مع «والناس ينظرون»", re: /خطيئ|ذلّ|ذل[ةه]|كلام قبيح|ينظرون|فضيح/ },
      { desc: "يقرأ الحال: ضيق/أمر يكتمه ويغلبه", re: /يكتم|كتمان|يخفي|يُخفي|ضيق|همّ|هم[ٌّ]?\s|غلب|رغماً|رغم إرادته/ },
      { desc: "يتحدث عن صاحب الرؤيا بضمير الغائب", re: /صاحب الرؤيا|صديقك|صاحبك|الرائي|رآه/ },
    ],
    mustNot: [
      { desc: "ينقل «يأخذ دنانير» وشرطه (الأخذ والحمل) غير متحقق", re: /دنانير/ },
      { desc: "يقلب ما غلبه إلى فضيلة (سخاء/صدقة/رياء)", re: /(?<!ليس |ولا |لا )(سخاء|سخاؤ|صدقة|رياء)/ },
      { desc: "يستشهد بالتعرّي ولا تعرّي في الحلم", re: /تجرّد|تجرد|تعرّي|عري/ },
    ],
  },
  {
    name: "Egyptian dialect: face and light",
    dream:
      "حلمت إني ماشي في شارع ضلمة لوحدي ولقيت راجل وشه شبه وشي، وكنت خايف، وبعدين طلع نور قوي من السما واطمنت.",
    must: [
      { desc: "يفهم «وش» على أنه الوجه", re: /وجه/ },
      { desc: "النور هداية/فرج", re: /هداي|فرج|طمأنين|بشار/ },
      { desc: "يقرأ الانتقال من الخوف إلى الطمأنينة", re: /خوف|خائف|الخوف/ },
    ],
    mustNot: [{ desc: "يفسر «وش» بالوشاية أو الحرير", re: /وشاي|وِشاي|حرير/ }],
  },
  {
    name: "falling teeth at a wedding",
    dream: "حلمت إن أسناني بتقع في إيدي وأنا بحاول أمسكها، وكنت في فرح وناس كتير بتبص عليا وأنا مكسوف.",
    must: [
      { desc: "الأسنان أهل البيت/الأقارب", re: /أهل|أقارب|قراب|عائل|أسرت/ },
      { desc: "يلتفت للخجل أمام الناس", re: /خجل|حياء|مكسوف|حرج|أنظار|ينظرون/ },
      { desc: "يفهم «فرح» المصرية على أنها عرس", re: /عرس|زفاف|زواج/ },
    ],
    mustNot: [],
  },
  {
    name: "snake in the house, killed",
    dream: "حلمت إن في تعبان كبير جوه البيت عندنا وأنا مسكته وقتلته.",
    must: [
      { desc: "الثعبان عدو", re: /عدو|عداو/ },
      { desc: "في البيت = من الأهل/القريبين", re: /أهل|بيت|أقارب|قريب/ },
      { desc: "القتل = ظفر/انتصار", re: /ظفر|انتصار|تغلّب|تغلب|غلب|نصر/ },
    ],
    mustNot: [],
  },
  {
    name: "late mother giving bread",
    dream: "رأيت أمي المتوفاة تبتسم لي وتعطيني رغيف خبز ساخن.",
    must: [
      { desc: "الخبز رزق/خير", re: /رزق|خير|عيش/ },
      { desc: "يلتفت لابتسامة الميت/حاله الطيب", re: /ابتسام|تبسّم|رضا|حسن حال|طيب/ },
    ],
    mustNot: [],
  },
  {
    name: "friend's dream: drowning then rescued",
    dream: "صاحبي حكالي إنه حلم إنه بيغرق في البحر ومش قادر يتنفس، وفجأة حد مد إيده وطلّعه.",
    must: [
      { desc: "يتحدث عن الصديق بضمير الغائب", re: /صاحبك|صديقك|صاحب الرؤيا|الرائي/ },
      { desc: "الإنقاذ = نجاة/فرج", re: /نجا|نجاة|خلاص|فرج|إنقاذ/ },
    ],
    mustNot: [],
  },
];

const BODY_END = "\n---\n";

describe.skipIf(!process.env.LIVE_EVAL)("live interpretation eval", () => {
  const report: string[] = [];

  for (const c of CASES) {
    it(
      c.name,
      async () => {
        const reply = await interpretDream([{ role: "user", content: c.dream }]);
        const cut = reply.indexOf(BODY_END);
        const body = cut === -1 ? reply : reply.slice(0, cut);
        const footer = cut === -1 ? "" : reply.slice(cut);

        const checks: [string, boolean][] = [
          ...c.must.map((m) => [`✔ ${m.desc}`, m.re.test(body)] as [string, boolean]),
          ...c.mustNot.map((m) => [`✘ ${m.desc}`, !m.re.test(body)] as [string, boolean]),
          ["عربية خالصة (بلا كلمات لاتينية)", !/[A-Za-z]{3,}/.test(body)],
          ["يستشهد برقم مرجع واحد على الأقل", /\[\d+\]/.test(body)],
          ["كل الاستشهادات يطابقها نص المقتطف", !footer.includes("لم يطابقها")],
        ];
        const passed = checks.filter(([, ok]) => ok).length;
        report.push(
          `\n## ${c.name} — ${passed}/${checks.length}\n` +
            checks.map(([d, ok]) => `  ${ok ? "PASS" : "FAIL"}  ${d}`).join("\n") +
            `\n--- reply ---\n${reply}\n`,
        );
        for (const [d, ok] of checks) expect.soft(ok, d).toBe(true);
      },
      300_000,
    );
  }

  it("report", () => {
    console.log(report.join("\n"));
  });
});
