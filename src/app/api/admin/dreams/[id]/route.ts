import { NextResponse } from "next/server";
import { ensureSchema } from "@/db/init";
import { getAdminSession } from "@/lib/auth";
import { getDreamForAdmin, deleteDreamAsAdmin } from "@/lib/admin";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/dreams/:id — full dream + owner + messages (admin only).
export async function GET(_req: Request, { params }: Params) {
  await ensureSchema();
  const admin = await getAdminSession();
  if (!admin)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const { id } = await params;
  const data = await getDreamForAdmin(id);
  if (!data)
    return NextResponse.json({ error: "غير موجود" }, { status: 404 });
  return NextResponse.json(data);
}

// DELETE /api/admin/dreams/:id — hard-delete a dream (admin only).
export async function DELETE(_req: Request, { params }: Params) {
  await ensureSchema();
  const admin = await getAdminSession();
  if (!admin)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const { id } = await params;
  await deleteDreamAsAdmin(id);
  return NextResponse.json({ ok: true });
}
