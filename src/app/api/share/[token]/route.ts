import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureSchema } from "@/db/init";

type Params = { params: Promise<{ token: string }> };

// GET /api/share/:token — public, read-only access to a shared dream.
// No authentication: the unguessable token is the capability.
export async function GET(_req: Request, { params }: Params) {
  await ensureSchema();
  const { token } = await params;
  if (!token || token.length < 10) {
    return NextResponse.json({ error: "رابط غير صالح" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(schema.dreams)
    .where(
      and(
        eq(schema.dreams.shareToken, token),
        isNull(schema.dreams.deletedAt),
      ),
    )
    .limit(1);

  const dream = rows[0];
  if (!dream) {
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  }

  const messages = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.dreamId, dream.id))
    .orderBy(asc(schema.messages.createdAt));

  return NextResponse.json({
    dream: {
      title: dream.title,
      dreamDate: dream.dreamDate,
      mood: dream.mood,
      kind: dream.kind,
      symbols: dream.symbols ? JSON.parse(dream.symbols) : [],
      summary: dream.summary,
    },
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
}
