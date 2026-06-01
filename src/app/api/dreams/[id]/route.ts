import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureSchema } from "@/db/init";
import { getSession } from "@/lib/auth";
import { getOwnedDream, getMessages } from "@/lib/dreams";

type Params = { params: Promise<{ id: string }> };

// GET /api/dreams/:id — a single dream with its full message thread.
export async function GET(_req: Request, { params }: Params) {
  await ensureSchema();
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { id } = await params;
  const dream = await getOwnedDream(id, session.userId);
  if (!dream)
    return NextResponse.json({ error: "الحلم غير موجود" }, { status: 404 });

  const messages = await getMessages(id);
  return NextResponse.json({
    dream: { ...dream, symbols: dream.symbols ? JSON.parse(dream.symbols) : [] },
    messages,
  });
}

// PATCH /api/dreams/:id — edit title and/or dream date.
export async function PATCH(req: Request, { params }: Params) {
  await ensureSchema();
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { id } = await params;
  const dream = await getOwnedDream(id, session.userId);
  if (!dream)
    return NextResponse.json({ error: "الحلم غير موجود" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof body.title === "string" && body.title.trim()) {
    update.title = body.title.trim();
  }
  if ("dreamDate" in body) {
    update.dreamDate = body.dreamDate ? new Date(Number(body.dreamDate)) : null;
  }

  await db
    .update(schema.dreams)
    .set(update)
    .where(eq(schema.dreams.id, id));

  return NextResponse.json({ ok: true });
}

// DELETE /api/dreams/:id
export async function DELETE(_req: Request, { params }: Params) {
  await ensureSchema();
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { id } = await params;
  const dream = await getOwnedDream(id, session.userId);
  if (!dream)
    return NextResponse.json({ error: "الحلم غير موجود" }, { status: 404 });

  await db.delete(schema.dreams).where(eq(schema.dreams.id, id));
  return NextResponse.json({ ok: true });
}
