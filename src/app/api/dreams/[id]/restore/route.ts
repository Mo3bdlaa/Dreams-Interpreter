import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureSchema } from "@/db/init";
import { getSession } from "@/lib/auth";
import { getOwnedDream } from "@/lib/dreams";

type Params = { params: Promise<{ id: string }> };

// POST /api/dreams/:id/restore — bring a trashed dream back.
export async function POST(_req: Request, { params }: Params) {
  await ensureSchema();
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { id } = await params;
  const dream = await getOwnedDream(id, session.userId, true);
  if (!dream)
    return NextResponse.json({ error: "الحلم غير موجود" }, { status: 404 });

  await db
    .update(schema.dreams)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(schema.dreams.id, id));

  return NextResponse.json({ ok: true });
}
