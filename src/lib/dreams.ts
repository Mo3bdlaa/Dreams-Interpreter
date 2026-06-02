import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { newId } from "@/lib/utils";
import { interpretDream, extractMetadata, type ChatMessage } from "@/lib/ai";

/** Verify a dream belongs to the user; returns it or null. By default only
 *  active (non-trashed) dreams; pass includeDeleted for trash operations. */
export async function getOwnedDream(
  dreamId: string,
  userId: string,
  includeDeleted = false,
) {
  const where = includeDeleted
    ? and(eq(schema.dreams.id, dreamId), eq(schema.dreams.userId, userId))
    : and(
        eq(schema.dreams.id, dreamId),
        eq(schema.dreams.userId, userId),
        isNull(schema.dreams.deletedAt),
      );
  const rows = await db.select().from(schema.dreams).where(where).limit(1);
  return rows[0] ?? null;
}

export async function getMessages(dreamId: string) {
  return db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.dreamId, dreamId))
    .orderBy(asc(schema.messages.createdAt));
}

/**
 * Append a user message to a dream, generate the interpreter's reply,
 * persist it, refresh the dream's metadata (mood/symbols/title), and
 * return both new messages.
 */
export async function saveUserMessage(dreamId: string, content: string) {
  const msg = {
    id: newId(),
    dreamId,
    role: "user" as const,
    content,
    createdAt: new Date(),
  };
  await db.insert(schema.messages).values(msg);
  return msg;
}

export async function saveAssistantMessage(dreamId: string, content: string) {
  const msg = {
    id: newId(),
    dreamId,
    role: "assistant" as const,
    content,
    createdAt: new Date(),
  };
  await db.insert(schema.messages).values(msg);
  return msg;
}

/** Recompute mood/symbols from all of a dream's user turns and auto-title it. */
export async function refreshDreamMeta(dreamId: string, firstContent: string) {
  const history = await getMessages(dreamId);
  const userText = history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  const { mood, symbols } = extractMetadata(userText);

  const dream = (
    await db
      .select()
      .from(schema.dreams)
      .where(eq(schema.dreams.id, dreamId))
      .limit(1)
  )[0];

  const update: Record<string, unknown> = {
    mood,
    symbols: JSON.stringify(symbols),
    updatedAt: new Date(),
  };
  if (dream && dream.title === "حلم جديد") {
    update.title = makeTitle(firstContent);
  }
  await db.update(schema.dreams).set(update).where(eq(schema.dreams.id, dreamId));
  return { mood, symbols };
}

/** Non-streaming flow: append user turn, get full reply, persist + refresh. */
export async function addUserMessageAndReply(
  dreamId: string,
  content: string,
) {
  const userMsg = await saveUserMessage(dreamId, content);

  const history = await getMessages(dreamId);
  const chatHistory: ChatMessage[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const reply = await interpretDream(chatHistory);

  const assistantMsg = await saveAssistantMessage(dreamId, reply);
  const { mood, symbols } = await refreshDreamMeta(dreamId, content);

  return { userMsg, assistantMsg, mood, symbols };
}

function makeTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 40) return clean || "حلم جديد";
  return clean.slice(0, 40).trimEnd() + "…";
}
