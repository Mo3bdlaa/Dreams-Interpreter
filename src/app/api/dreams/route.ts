import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureSchema } from "@/db/init";
import { getSession } from "@/lib/auth";
import { newId } from "@/lib/utils";
import { addUserMessageAndReply } from "@/lib/dreams";

// Allow time for AI generation + embedding on serverless (Vercel).
export const maxDuration = 60;

// GET /api/dreams — list the current user's active dreams (newest first).
export async function GET() {
  await ensureSchema();
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const rows = await db
    .select()
    .from(schema.dreams)
    .where(
      and(
        eq(schema.dreams.userId, session.userId),
        isNull(schema.dreams.deletedAt),
      ),
    )
    .orderBy(desc(schema.dreams.updatedAt));

  return NextResponse.json({
    dreams: rows.map((d) => ({
      ...d,
      symbols: d.symbols ? JSON.parse(d.symbols) : [],
    })),
  });
}

// POST /api/dreams — create a dream, optionally with a first message + date.
export async function POST(req: Request) {
  await ensureSchema();
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { content, dreamDate } = await req.json().catch(() => ({}));

  const id = newId();
  const now = new Date();
  await db.insert(schema.dreams).values({
    id,
    userId: session.userId,
    title: "حلم جديد",
    dreamDate: dreamDate ? new Date(Number(dreamDate)) : null,
    createdAt: now,
    updatedAt: now,
  });

  let firstReply = null;
  if (content && String(content).trim()) {
    const result = await addUserMessageAndReply(id, String(content).trim());
    firstReply = result.assistantMsg;
  }

  return NextResponse.json({ id, firstReply });
}
