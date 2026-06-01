import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { newId } from "@/lib/utils";
import { interpretDream, extractMetadata, type ChatMessage } from "@/lib/ai";

/** Verify a dream belongs to the user; returns it or null. */
export async function getOwnedDream(dreamId: string, userId: string) {
  const rows = await db
    .select()
    .from(schema.dreams)
    .where(
      and(eq(schema.dreams.id, dreamId), eq(schema.dreams.userId, userId)),
    )
    .limit(1);
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
export async function addUserMessageAndReply(
  dreamId: string,
  content: string,
) {
  const now = Date.now();
  const userMsg = {
    id: newId(),
    dreamId,
    role: "user" as const,
    content,
    createdAt: new Date(now),
  };
  await db.insert(schema.messages).values(userMsg);

  // Build the conversation history for the model.
  const history = await getMessages(dreamId);
  const chatHistory: ChatMessage[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const reply = await interpretDream(chatHistory);

  const assistantMsg = {
    id: newId(),
    dreamId,
    role: "assistant" as const,
    content: reply,
    createdAt: new Date(now + 1),
  };
  await db.insert(schema.messages).values(assistantMsg);

  // Refresh metadata from the combined user text of this dream.
  const userText = history
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  const { mood, symbols } = extractMetadata(userText);

  // Auto-title from the first user message if still default.
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
    updatedAt: new Date(now + 1),
  };
  if (dream && dream.title === "حلم جديد") {
    update.title = makeTitle(content);
  }

  await db
    .update(schema.dreams)
    .set(update)
    .where(eq(schema.dreams.id, dreamId));

  return { userMsg, assistantMsg, mood, symbols };
}

function makeTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 40) return clean || "حلم جديد";
  return clean.slice(0, 40).trimEnd() + "…";
}
