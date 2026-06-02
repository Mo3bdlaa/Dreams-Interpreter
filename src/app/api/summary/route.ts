import { NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureSchema } from "@/db/init";
import { getSession } from "@/lib/auth";
import { generateOverallSummary, type DreamDigest } from "@/lib/ai";
import { formatArabicDate } from "@/lib/utils";

// Allow time for AI generation + embedding on serverless (Vercel).
export const maxDuration = 60;

// GET /api/summary — stats + an AI-written overall reflection of all dreams.
export async function GET() {
  await ensureSchema();
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const dreams = await db
    .select()
    .from(schema.dreams)
    .where(eq(schema.dreams.userId, session.userId))
    .orderBy(desc(schema.dreams.updatedAt));

  // Aggregate stats for the dashboard cards.
  const symbolCount = new Map<string, number>();
  const moodCount = new Map<string, number>();
  for (const d of dreams) {
    const symbols: string[] = d.symbols ? JSON.parse(d.symbols) : [];
    for (const s of symbols)
      symbolCount.set(s, (symbolCount.get(s) || 0) + 1);
    if (d.mood) moodCount.set(d.mood, (moodCount.get(d.mood) || 0) + 1);
  }

  const topSymbols = [...symbolCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => ({ key, count }));

  const moods = Object.fromEntries(moodCount);

  // Build digests for the AI summary (first user message as excerpt).
  const digests: DreamDigest[] = [];
  for (const d of dreams.slice(0, 30)) {
    const firstUser = (
      await db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.dreamId, d.id))
        .orderBy(asc(schema.messages.createdAt))
        .limit(3)
    ).find((m) => m.role === "user");
    digests.push({
      title: d.title,
      date: d.dreamDate ? formatArabicDate(d.dreamDate.getTime()) : null,
      mood: d.mood,
      symbols: d.symbols ? JSON.parse(d.symbols) : [],
      excerpt: firstUser ? firstUser.content.slice(0, 120) : "—",
    });
  }

  const summary = await generateOverallSummary(digests);

  return NextResponse.json({
    total: dreams.length,
    topSymbols,
    moods,
    summary,
  });
}
