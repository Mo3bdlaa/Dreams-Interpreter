import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureSchema } from "@/db/init";
import { getSession } from "@/lib/auth";

// GET /api/dreams/trash — list the user's soft-deleted dreams.
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
        isNotNull(schema.dreams.deletedAt),
      ),
    )
    .orderBy(desc(schema.dreams.deletedAt));

  return NextResponse.json({
    dreams: rows.map((d) => ({
      ...d,
      symbols: d.symbols ? JSON.parse(d.symbols) : [],
    })),
  });
}
