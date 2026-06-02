import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureSchema } from "@/db/init";
import { getSession } from "@/lib/auth";
import { getOwnedDream } from "@/lib/dreams";
import { newId } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

// POST /api/dreams/:id/share — create (or return) a public read-only token.
export async function POST(_req: Request, { params }: Params) {
  await ensureSchema();
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { id } = await params;
  const dream = await getOwnedDream(id, session.userId);
  if (!dream)
    return NextResponse.json({ error: "الحلم غير موجود" }, { status: 404 });

  const token = dream.shareToken ?? newId().replace(/-/g, "");
  if (!dream.shareToken) {
    await db
      .update(schema.dreams)
      .set({ shareToken: token })
      .where(eq(schema.dreams.id, id));
  }
  return NextResponse.json({ token });
}

// DELETE /api/dreams/:id/share — revoke sharing.
export async function DELETE(_req: Request, { params }: Params) {
  await ensureSchema();
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { id } = await params;
  const dream = await getOwnedDream(id, session.userId);
  if (!dream)
    return NextResponse.json({ error: "الحلم غير موجود" }, { status: 404 });

  await db
    .update(schema.dreams)
    .set({ shareToken: null })
    .where(eq(schema.dreams.id, id));
  return NextResponse.json({ ok: true });
}
