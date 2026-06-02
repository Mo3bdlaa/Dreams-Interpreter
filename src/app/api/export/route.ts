import { NextResponse } from "next/server";
import { and, asc, desc, eq, isNull, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureSchema } from "@/db/init";
import { getSession } from "@/lib/auth";

// GET /api/export — download all of the user's (active) dreams with their
// full conversations as a single JSON document.
export async function GET() {
  await ensureSchema();
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const dreams = await db
    .select()
    .from(schema.dreams)
    .where(
      and(
        eq(schema.dreams.userId, session.userId),
        isNull(schema.dreams.deletedAt),
      ),
    )
    .orderBy(desc(schema.dreams.updatedAt));

  const ids = dreams.map((d) => d.id);
  const msgs = ids.length
    ? await db
        .select()
        .from(schema.messages)
        .where(inArray(schema.messages.dreamId, ids))
        .orderBy(asc(schema.messages.createdAt))
    : [];

  const byDream = new Map<string, typeof msgs>();
  for (const m of msgs) {
    const arr = byDream.get(m.dreamId) ?? [];
    arr.push(m);
    byDream.set(m.dreamId, arr);
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    user: { name: session.name, email: session.email },
    count: dreams.length,
    dreams: dreams.map((d) => ({
      title: d.title,
      dreamDate: d.dreamDate,
      mood: d.mood,
      kind: d.kind,
      symbols: d.symbols ? JSON.parse(d.symbols) : [],
      summary: d.summary,
      createdAt: d.createdAt,
      messages: (byDream.get(d.id) ?? []).map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    })),
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dreams-export.json"`,
    },
  });
}
