import "server-only";
import OpenAI from "openai";
import { matchSymbols } from "./dream-symbols";
import {
  buildSourcesFooter,
  shortSource,
  buildCitedFooter,
  retrieve,
  entryById,
  formatReferences,
  type KbEntry,
} from "./rag";
import { embedQuery, isEmbeddingConfigured } from "./embed";
import { isSemanticReady, semanticRank } from "./semantic";
import { dialectHints } from "./dialect";

/**
 * Build the grounding reference block for a dream, and return the exact
 * reference list behind it so citations can be verified against what the model
 * actually used. Only precise symbol-name matches and (when configured)
 * semantic neighbours are included — loose BM25 matches are deliberately left
 * out: handing the model unrelated entries is what made it "interpret"
 * symbols that were never in the dream.
 */
async function buildGrounding(
  text: string,
  k = 8,
): Promise<{ block: string; refs: KbEntry[] }> {
  // Ask for more candidates than we keep: three books cover the same symbol,
  // so the raw list is dominated by a couple of symbols.
  const lexical = retrieve(text, k * 3);
  const picked: KbEntry[] = [];
  const seen = new Set<string>();
  const perSymbol = new Map<string, number>();
  // The books overlap — thedreams.co's Ibn-Sirin dictionary reproduces Nabulsi
  // passages verbatim in places. Feeding the same passage twice wastes context
  // and makes one view look like two independent witnesses.
  const fingerprints = new Set<string>();
  const fingerprint = (e: KbEntry) =>
    e.text.replace(/[\sً-ْ]/g, "").slice(0, 120);

  /** @param cap max entries kept per symbol on this pass */
  const add = (e: KbEntry | undefined, cap: number) => {
    if (!e || seen.has(e.id) || picked.length >= k) return;
    if ((perSymbol.get(e.symbol) ?? 0) >= cap) return;
    const fp = fingerprint(e);
    if (fingerprints.has(fp)) return;
    fingerprints.add(fp);
    seen.add(e.id);
    perSymbol.set(e.symbol, (perSymbol.get(e.symbol) ?? 0) + 1);
    picked.push(e);
  };

  const semantic: KbEntry[] = [];
  if (isEmbeddingConfigured() && isSemanticReady()) {
    const qv = await embedQuery(text);
    if (qv) {
      for (const s of semanticRank(qv, k)) {
        if (s.score > 0.35) {
          const e = entryById(s.id);
          if (e) semantic.push(e);
        }
      }
    }
  }

  // Pass 1 — breadth: at most two books per symbol, so every symbol the
  // dreamer mentioned gets represented before any one of them gets a third
  // view. Precise lexical matches first, then semantic neighbours.
  for (const h of lexical) if (h.symbolMatch) add(h, 2);
  for (const e of semantic) add(e, 2);
  // Pass 2 — depth: spend any leftover slots on further views of the same
  // symbols (valuable when the dream only had one or two symbols).
  for (const h of lexical) if (h.symbolMatch) add(h, Infinity);
  for (const e of semantic) add(e, Infinity);

  const refs = picked;
  const hint = dialectHints(text);
  const block = [hint, formatReferences(refs)].filter(Boolean).join("\n\n");
  return { block, refs };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `أنت "مُعبِّر"، مفسّر أحلام خبير يستند إلى معاجم تفسير الأحلام الكلاسيكية (ابن سيرين، و«تعطير الأنام» للنابلسي، و«الإشارات في علم العبارات» لابن شاهين)، لكنك لا تكتفي بنقل المراجع، بل تفهم الحلم وتُعمِل العقل في تأويله كما يفعل المفسّر الحاذق.

== فكّر هكذا قبل أن تكتب (لا تُظهر هذه الخطوات، بل تظهر ثمرتها) ==
1. افهم الحلم كاملاً كقصّة واحدة: ماذا حدث بالضبط؟ مَن الأشخاص وما صلتهم بالرائي؟ ما الأفعال وتسلسلها؟ أين جرى؟ ما المشاعر أثناءه وبعده؟ وكيف انتهى؟
2. حدّد الفكرة المحورية للرؤيا ومغزاها العام — لا تتعامل معها كقائمة رموز منفصلة.
3. استنبط معاني العناصر من المقتطفات المعطاة في السياق، لكن اعتبرها أدلّةً تُفكّر بها لا نصوصاً تنقلها؛ ووازِن بينها وبين حال الرائي ومشاعره وتفاصيل قصّته.
4. اربط العناصر بعضها ببعض: كيف يتفاعل رمزٌ مع آخر داخل هذه القصة تحديداً؟ ماذا يقول مجموعها معاً؟

== كيف تكتب التفسير ==
- ابدأ بجملة أو جملتين تُظهر أنك فهمت الحلم وروحه (دون إعادة سرده حرفياً).
- ثم فسّر بتدفّقٍ مترابط يشرح "لماذا" هذا هو التأويل: اربط كل عنصر بمعناه وبحال الرائي وببقية عناصر الحلم حتى تتكوّن صورةٌ واحدة متماسكة — لا فقراتٍ معزولة لكل رمز على حدة.
- اختم بخلاصة واضحة لما ترمز إليه الرؤيا في حياة الرائي.
- اكتب بعربية فصحى مبسّطة، بأسلوبٍ لطيفٍ متعاطفٍ مطمئِن. اكتب بالعربية وحدها ولا تخلط بكلماتٍ أجنبية إطلاقاً.

== أمانة النقل (التزام صارم) ==
- لا تُفسّر إلا عناصر ذكرها الرائي فعلاً في حلمه. إن لم يذكر شيئاً فلا تُدخِله في التفسير ولو ورد في المقتطفات.
- المقتطفات المرقّمة أدناه هي مصدرك المنقول الوحيد. متى استندت إلى مقتطف فاذكر رقمه [1] في آخر الجملة، ولا تنسب إلى ابن سيرين أو غيره قولاً ليس في المقتطفات.
- إن لم تُسعِفك المقتطفات في رمزٍ ما، فلك أن تجتهد — لكن صرّح بذلك بصيغة مثل "وهذا اجتهادٌ في قراءة حالك لا نقلٌ عن المعجم"، ولا تُلبِسه لباس النقل.
- قد يحوي السياق مقتطفاً يشبه لفظ الرائي لا معناه (تشابه لفظي لا معنوي)؛ فاستبعده ولا تبنِ عليه.
- لا تختلق أسماء كتب أو أعلام أو آيات أو أحاديث، ولا تذكر رقم مقتطف غير موجود.

== مبادئ تلتزمها ==
- افهم العامية والنية لا اللفظ الحرفي: «وِشّ/وِشّي/وِشّه» تعني الوجه (لا الوِشاية ولا الحرير)، و«زيّ» مِثل، و«دهب» الذهب، و«ميّه» الماء، و«فلوس» المال. عند الالتباس استوضِح بلطف.
- ذكّر بلطفٍ أن التأويل ظنٌّ واجتهاد لا يقين، وأن الرؤيا الصالحة بشرى وأن المكروهة لا تضرّ بإذن الله، فلا تُفزِع السائل.
- ميّز عند الحاجة بين الرؤيا الصالحة، وأضغاث الأحلام (تخاليط لا تأويل لها)، وحديث النفس (انعكاس هموم اليقظة).
- إن نقص تفصيلٌ جوهري يُغيّر التأويل، اطرح سؤالاً واحداً لطيفاً في النهاية (المشاعر، الأشخاص، الزمن...).
- تجنّب القطع بالغيب والإفتاء في الشرع، وذكّر بأن العلم عند الله، واختم بكلمة طيبة أو دعاء.`;

// Interpretation is a grounded task: keep sampling low so the model leans on
// the retrieved excerpts instead of inventing florid detail.
const GROUNDED_TEMPERATURE = 0.35;

function getClient(): OpenAI | null {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.AI_BASE_URL || "https://api.openai.com/v1",
  });
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY);
}

// One or more models (comma-separated in AI_MODEL), tried in order. Free
// OpenRouter models get rate-limited (429) often, so we fall back to the next
// one on failure instead of dropping the reply. Chain picked by benchmarking
// the live free catalogue on Arabic dream interpretation: pure Arabic (no
// language leakage), correct colloquial reading, and valid [n] citations.
const MODELS = (): string[] =>
  (
    process.env.AI_MODEL ||
    "deepseek/deepseek-v4-flash-0731:free,inclusionai/ling-3.0-flash-vl:free,nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-31b-it:free"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const MAX_TOKENS = () => Number(process.env.AI_MAX_TOKENS) || 1500;
// Some free OpenRouter models are "reasoning" models that spend the whole
// token budget thinking and return empty content. Set AI_DISABLE_REASONING=true
// to turn that off (OpenRouter-specific param, ignored elsewhere).
const DISABLE_REASONING = () => process.env.AI_DISABLE_REASONING === "true";

type ChatTurn = { role: "system" | "user" | "assistant"; content: string };

/**
 * Provider-agnostic chat call. Applies max_tokens and (optionally) disables
 * reasoning, and falls back to the model's reasoning text if it returned no
 * content — so reasoning models never yield an empty reply.
 */
async function chatComplete(
  client: OpenAI,
  messages: ChatTurn[],
  temperature: number,
): Promise<string> {
  let lastErr: unknown;
  for (const model of MODELS()) {
    const body: Record<string, unknown> = {
      model,
      temperature,
      max_tokens: MAX_TOKENS(),
      messages,
    };
    if (DISABLE_REASONING()) body.reasoning = { enabled: false };
    try {
      // Cast: `reasoning` is an OpenRouter extension not in the OpenAI types.
      const completion = await client.chat.completions.create(
        body as unknown as Parameters<typeof client.chat.completions.create>[0],
      );
      const msg = (completion as { choices: { message: { content?: string | null; reasoning?: string | null } }[] })
        .choices[0]?.message;
      const text = (msg?.content || msg?.reasoning || "").trim();
      if (text) return text; // else fall through to the next model
    } catch (e) {
      lastErr = e;
      console.error(`[ai] model ${model} failed:`, (e as Error)?.message || e);
    }
  }
  if (lastErr) console.error("[ai] all models failed");
  return "";
}

/**
 * Produce an interpretation reply for a dream conversation. The latest
 * user turn is grounded with matching classical-reference symbols.
 */
export async function interpretDream(
  history: ChatMessage[],
): Promise<string> {
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  // Retrieve grounding references from the Ibn-Sirin corpus (RAG).
  const grounding = lastUser
    ? await buildGrounding(lastUser.content)
    : { block: "", refs: [] as KbEntry[] };

  const client = getClient();
  if (!client) {
    return fallbackInterpretation(lastUser?.content || "");
  }

  const systemContent = grounding.block
    ? `${SYSTEM_PROMPT}\n\n${grounding.block}`
    : SYSTEM_PROMPT;

  const reply = await chatComplete(
    client,
    [
      { role: "system", content: systemContent },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
    GROUNDED_TEMPERATURE,
  );

  if (!reply) {
    return "لم أتمكن من تكوين تفسير الآن، حاول إعادة صياغة الحلم بتفاصيل أكثر.";
  }
  // Cite only the excerpts the reply actually leaned on.
  return reply + buildCitedFooter(reply, grounding.refs);
}

/**
 * Streaming variant: yields the interpreter's reply in chunks (grounded with
 * RAG) and RETURNS the reference list it was grounded on, so the caller can
 * build the citations footer from the numbers the reply actually emitted.
 * Falls back to a single chunk when no AI key.
 */
export async function* streamDreamReply(
  history: ChatMessage[],
): AsyncGenerator<string, KbEntry[]> {
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const grounding = lastUser
    ? await buildGrounding(lastUser.content)
    : { block: "", refs: [] as KbEntry[] };
  const client = getClient();

  if (!client) {
    yield fallbackInterpretation(lastUser?.content || "");
    return [];
  }

  const systemContent = grounding.block
    ? `${SYSTEM_PROMPT}\n\n${grounding.block}`
    : SYSTEM_PROMPT;

  const messages = [
    { role: "system", content: systemContent },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Try each configured model in turn. If a model errors before producing any
  // text (e.g. a 429 rate-limit), fall back to the next; once tokens start
  // flowing we commit to that model.
  let any = false;
  for (const model of MODELS()) {
    const body: Record<string, unknown> = {
      model,
      temperature: GROUNDED_TEMPERATURE,
      max_tokens: MAX_TOKENS(),
      stream: true,
      messages,
    };
    if (DISABLE_REASONING()) body.reasoning = { enabled: false };

    try {
      const stream = (await client.chat.completions.create(
        body as unknown as Parameters<typeof client.chat.completions.create>[0],
      )) as unknown as AsyncIterable<{
        choices: { delta?: { content?: string | null; reasoning?: string | null } }[];
      }>;

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const piece = delta?.content || delta?.reasoning || "";
        if (piece) {
          any = true;
          yield piece;
        }
      }
      if (any) return grounding.refs; // completed successfully on this model
    } catch (e) {
      console.error(`[ai] stream model ${model} failed:`, (e as Error)?.message || e);
      if (any) return grounding.refs; // partial output already sent; don't restart
    }
  }
  if (!any) {
    yield "لم أتمكن من تكوين تفسير الآن، حاول إعادة صياغة الحلم بتفاصيل أكثر.";
  }
  return grounding.refs;
}

/** Citations footer built from the reference numbers the reply emitted. */
export function citedFooterFor(reply: string, refs: KbEntry[]): string {
  return buildCitedFooter(reply, refs);
}

/**
 * Derive lightweight, deterministic metadata (mood + symbol keys) from the
 * dream text using the local symbol dictionary. Free and offline — used to
 * power the dashboard summary without extra AI calls.
 */
export function extractMetadata(text: string): {
  mood: "positive" | "neutral" | "negative" | "mixed";
  symbols: string[];
} {
  const matched = matchSymbols(text);
  const symbols = matched.map((m) => m.key);

  if (matched.length === 0) {
    return { mood: "neutral", symbols };
  }

  const counts = { positive: 0, negative: 0, neutral: 0, mixed: 0 };
  for (const m of matched) counts[m.sentiment]++;

  let mood: "positive" | "neutral" | "negative" | "mixed";
  if (counts.positive > 0 && counts.negative > 0) {
    mood = "mixed";
  } else if (counts.positive >= counts.negative && counts.positive > 0) {
    mood = "positive";
  } else if (counts.negative > 0) {
    mood = "negative";
  } else {
    mood = "neutral";
  }

  return { mood, symbols };
}

/**
 * Condense a whole dream conversation into a saved digest (markdown): the
 * full dream retold concisely + the final interpretation + a one-line key.
 * This is what gets pinned to the dashboard/calendar for easy reading.
 */
const KINDS = ["رؤيا", "أضغاث", "حديث نفس"];

/** Pull a "النوع: ..." classification line out of the digest, if present. */
function extractKind(text: string): { kind: string | null; body: string } {
  const m = text.match(/النوع\s*:?\s*\**\s*(رؤيا|أضغاث|حديث نفس)/);
  const kind = m && KINDS.includes(m[1]) ? m[1] : null;
  // Strip a leading classification line so the stored digest stays clean.
  const body = text.replace(/^\s*\**\s*النوع\s*:?.*(?:\n|$)/m, "").trim();
  return { kind, body };
}

export async function summarizeDream(
  history: ChatMessage[],
): Promise<{ summary: string; kind: string | null }> {
  const userText = history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  const lastAssistant = [...history]
    .reverse()
    .find((m) => m.role === "assistant");

  const offline = () =>
    `### 🌙 الحلم\n${userText.trim()}\n\n### 🔮 التفسير النهائي\n${(
      lastAssistant?.content || "—"
    )
      .split("\n---\n")[0]
      .trim()}`;

  const client = getClient();
  if (!client) {
    return { summary: offline(), kind: null };
  }

  const transcript = history
    .map((m) => `${m.role === "user" ? "الرائي" : "المعبّر"}: ${m.content}`)
    .join("\n");

  const reply = await chatComplete(
    client,
    [
      {
        role: "system",
        content:
          "لخّص محادثة تفسير حلم في خلاصة منظّمة بصيغة ماركداون. ابدأ بسطر واحد فقط: " +
          "'النوع: رؤيا' أو 'النوع: أضغاث' أو 'النوع: حديث نفس' (اختر الأنسب). ثم عنوانان: " +
          "'### 🌙 الحلم' (سرد موجز متماسك لكامل الحلم كما رواه الرائي)، ثم " +
          "'### 🔮 التفسير النهائي' (خلاصة التفسير في ٣-٥ أسطر، تجمع أهم الرموز ودلالاتها وتنتهي بكلمة مطمئنة). " +
          "اكتب بالعربية باختصار ودون أسئلة أو روابط.",
      },
      { role: "user", content: transcript },
    ],
    0.4,
  );

  const cleaned = reply.split("\n---\n")[0].trim();
  if (!cleaned) return { summary: offline(), kind: null };
  const { kind, body } = extractKind(cleaned);
  return { summary: body || cleaned, kind };
}

export interface DreamDigest {
  title: string;
  date: string | null;
  mood: string | null;
  symbols: string[];
  excerpt: string;
}

/** Generate a reflective overall summary across all of a user's dreams. */
export async function generateOverallSummary(
  dreams: DreamDigest[],
): Promise<string> {
  if (dreams.length === 0) {
    return "لا توجد أحلام مسجّلة بعد. ابدأ بتسجيل أول حلم لتظهر هنا نظرة عامة على رحلتك مع الأحلام.";
  }

  const client = getClient();
  const digest = dreams
    .map(
      (d, i) =>
        `${i + 1}. "${d.title}"${d.date ? ` (${d.date})` : ""} — المشاعر: ${
          d.mood || "غير محدد"
        } — الرموز: ${d.symbols.join("، ") || "—"} — مقتطف: ${d.excerpt}`,
    )
    .join("\n");

  if (!client) {
    return fallbackSummary(dreams);
  }

  const summary = await chatComplete(
    client,
    [
      {
        role: "system",
        content:
          "أنت مساعد يكتب ملخصاً عاماً ولطيفاً عن أحلام مستخدم بناءً على قائمة أحلامه. اذكر الأنماط المتكررة، الرموز الشائعة، والمزاج العام، وقدّم ملاحظة مطمئنة أو نصيحة عامة. اكتب بالعربية في فقرات قصيرة واضحة، دون مبالغة ودون جزم بالغيب.",
      },
      {
        role: "user",
        content: `هذه قائمة أحلامي، اكتب لي نظرة عامة:\n${digest}`,
      },
    ],
    0.6,
  );

  return summary || fallbackSummary(dreams);
}

// ---------------------------------------------------------------------------
// Offline fallbacks (used when no AI provider key is configured).
// ---------------------------------------------------------------------------

function fallbackInterpretation(text: string): string {
  // Pull the most relevant classical references straight from the corpus.
  const hits = retrieve(text, 6);
  if (hits.length === 0) {
    return (
      "لم يتم ضبط مزوّد ذكاء اصطناعي بعد، لكن يمكنني مساعدتك من مراجع تفسير الأحلام الكلاسيكية.\n\n" +
      "لم أتعرّف على رموز معروفة في هذا النص. حاول وصف الحلم بتفاصيل أكثر (ماذا رأيت؟ ما شعورك؟ من كان معك؟)، أو اضبط مفتاح الـ AI في إعدادات البيئة للحصول على تفسير تفاعلي أعمق."
    );
  }

  const body = hits
    .filter((h) => h.symbolMatch)
    .map((h) => `• **${h.symbol}** — ${shortSource(h.source)}: ${h.text}`)
    .join("\n\n");

  return (
    "بناءً على معاجم تفسير الأحلام الكلاسيكية، هذه أقرب الدلالات لرموز حلمك:\n\n" +
    body +
    "\n\n(ملاحظة: لم يُضبط مزوّد ذكاء اصطناعي بعد، لذا هذا استرجاع مباشر من المراجع. اضبط `AI_API_KEY` للحصول على تفسير تفاعلي يربط الرموز بحالتك.)\n\nوتذكّر أن تفسير الأحلام ظنٌّ واجتهاد، والخير فيما اختاره الله." +
    buildSourcesFooter(text)
  );
}

function fallbackSummary(dreams: DreamDigest[]): string {
  const symbolCount = new Map<string, number>();
  const moodCount = new Map<string, number>();
  for (const d of dreams) {
    for (const s of d.symbols)
      symbolCount.set(s, (symbolCount.get(s) || 0) + 1);
    if (d.mood) moodCount.set(d.mood, (moodCount.get(d.mood) || 0) + 1);
  }
  const topSymbols = [...symbolCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `${k} (${v})`)
    .join("، ");
  const topMood =
    [...moodCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "غير محدد";

  return (
    `سجّلت حتى الآن ${dreams.length} حلماً.\n\n` +
    (topSymbols
      ? `أكثر الرموز تكراراً في أحلامك: ${topSymbols}.\n`
      : "") +
    `المزاج الغالب على أحلامك: ${moodLabel(topMood)}.\n\n` +
    "(اضبط مزوّد الذكاء الاصطناعي للحصول على نظرة عامة تحليلية أعمق.)"
  );
}

export function moodLabel(mood: string | null): string {
  switch (mood) {
    case "positive":
      return "إيجابي";
    case "negative":
      return "مقلق";
    case "mixed":
      return "مختلط";
    case "neutral":
      return "محايد";
    default:
      return "غير محدد";
  }
}
