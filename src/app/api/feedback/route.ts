import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureSchema } from "@/db/init";
import { getSession } from "@/lib/auth";
import { newId } from "@/lib/utils";
import { retrieveSources } from "@/lib/rag";
import { serverError } from "@/lib/api-error";

const REASONS = new Set([
  "التفسير غير صحيح",
  "لا علاقة له بحلمي",
  "غير مفهوم",
  "المصادر غير مناسبة",
]);

/**
 * POST /api/feedback — record "هل التفسير ظبط؟" for one assistant reply.
 *
 * Alongside the verdict we snapshot the symbols retrieval grounded that reply
 * on, so ratings accumulate into a real eval set rather than a bare counter.
 */
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
    }

    const { messageId, rating, reason } = await req
      .json()
      .catch(() => ({} as Record<string, unknown>));

    if (!messageId || (rating !== "up" && rating !== "down")) {
      return NextResponse.json({ error: "بيانات ناقصة." }, { status: 400 });
    }
    const cleanReason =
      typeof reason === "string" && REASONS.has(reason) ? reason : null;

    // The message must be an assistant reply inside a dream this user owns.
    const rows = await db
      .select({ message: schema.messages, dream: schema.dreams })
      .from(schema.messages)
      .innerJoin(schema.dreams, eq(schema.messages.dreamId, schema.dreams.id))
      .where(
        and(
          eq(schema.messages.id, String(messageId)),
          eq(schema.dreams.userId, session.userId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row || row.message.role !== "assistant") {
      return NextResponse.json({ error: "الرسالة غير موجودة." }, { status: 404 });
    }

    // Snapshot the grounding: the symbols retrieved for the user turn that
    // prompted this reply.
    const turns = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.dreamId, row.message.dreamId))
      .orderBy(asc(schema.messages.createdAt));
    const idx = turns.findIndex((t) => t.id === row.message.id);
    const prompt = [...turns.slice(0, idx)].reverse().find((t) => t.role === "user");
    const symbols = prompt
      ? retrieveSources(prompt.content).map((s) => s.symbol)
      : [];

    // One verdict per reader per reply — re-rating replaces the old one.
    await db
      .delete(schema.feedback)
      .where(
        and(
          eq(schema.feedback.messageId, row.message.id),
          eq(schema.feedback.userId, session.userId),
        ),
      );
    await db.insert(schema.feedback).values({
      id: newId(),
      messageId: row.message.id,
      dreamId: row.message.dreamId,
      userId: session.userId,
      rating,
      reason: cleanReason,
      symbols: JSON.stringify(symbols),
    });

    return NextResponse.json({ ok: true, rating, reason: cleanReason });
  } catch (e) {
    return serverError(e);
  }
}
