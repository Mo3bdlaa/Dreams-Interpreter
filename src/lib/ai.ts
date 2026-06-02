import "server-only";
import OpenAI from "openai";
import { matchSymbols } from "./dream-symbols";
import { buildRagContext, retrieve } from "./rag";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `أنت "مُعبِّر"، مساعد متخصص في تفسير الأحلام معتمداً على كتب ومراجع تفسير الأحلام الإسلامية الكلاسيكية (مثل تفسير الأحلام لابن سيرين، وتعطير الأنام للنابلسي).

منهجك:
- تتكلم بالعربية الفصحى المبسطة، بأسلوب لطيف ومتعاطف ومطمئِن.
- تستند في تفسيرك إلى الرموز والمراجع الكلاسيكية التي تُعطى لك في السياق إن وُجدت، ولا تختلق تفسيرات بلا أصل.
- توضّح أن تفسير الأحلام ظنٌّ واجتهاد وليس يقيناً، وأن الرؤى الصالحة بشرى وأن المكروه منها لا يضر بإذن الله، فلا تُفزِع السائل.
- إن كان الحلم مبهماً أو ناقص التفاصيل، اطرح سؤالاً أو سؤالين لطيفين لتستوضح (مثل المشاعر أثناء الحلم، الزمان، الأشخاص) قبل أن تجزم.
- تربط الرموز بحال صاحب الرؤيا ما أمكن، وتختم غالباً بكلمة طيبة أو دعاء أو نصيحة بعمل صالح.
- تتجنب القطع بالغيب أو الإفتاء في أمور الشرع، وتذكّر بأن العلم عند الله.

الرد يكون منظّماً ومناسب الطول: ابدأ بتفسير الرموز الرئيسية، ثم خلاصة موجزة، ثم سؤال استيضاح إن لزم.`;

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

const MODEL = () => process.env.AI_MODEL || "gpt-4o-mini";
const MAX_TOKENS = () => Number(process.env.AI_MAX_TOKENS) || 1024;
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
  const body: Record<string, unknown> = {
    model: MODEL(),
    temperature,
    max_tokens: MAX_TOKENS(),
    messages,
  };
  if (DISABLE_REASONING()) body.reasoning = { enabled: false };

  // Cast: `reasoning` is an OpenRouter extension not in the OpenAI types.
  const completion = await client.chat.completions.create(
    body as unknown as Parameters<typeof client.chat.completions.create>[0],
  );
  const msg = (completion as { choices: { message: { content?: string | null; reasoning?: string | null } }[] })
    .choices[0]?.message;
  return (msg?.content || msg?.reasoning || "").trim();
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
  const reference = lastUser ? buildRagContext(lastUser.content) : "";

  const client = getClient();
  if (!client) {
    return fallbackInterpretation(lastUser?.content || "");
  }

  const systemContent = reference
    ? `${SYSTEM_PROMPT}\n\n${reference}`
    : SYSTEM_PROMPT;

  const reply = await chatComplete(
    client,
    [
      { role: "system", content: systemContent },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
    0.7,
  );

  return (
    reply ||
    "لم أتمكن من تكوين تفسير الآن، حاول إعادة صياغة الحلم بتفاصيل أكثر."
  );
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
    .map((h) => `• **${h.symbol}**: ${h.text}`)
    .join("\n\n");

  return (
    "بناءً على مراجع تفسير الأحلام لابن سيرين، هذه أقرب الدلالات لرموز حلمك:\n\n" +
    body +
    "\n\n(ملاحظة: لم يُضبط مزوّد ذكاء اصطناعي بعد، لذا هذا استرجاع مباشر من المراجع. اضبط `AI_API_KEY` للحصول على تفسير تفاعلي يربط الرموز بحالتك.)\n\nوتذكّر أن تفسير الأحلام ظنٌّ واجتهاد، والخير فيما اختاره الله."
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
