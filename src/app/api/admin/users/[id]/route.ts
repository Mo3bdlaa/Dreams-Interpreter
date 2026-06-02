import { NextResponse } from "next/server";
import { ensureSchema } from "@/db/init";
import { getAdminSession } from "@/lib/auth";
import { listUserDreams, deleteUserAsAdmin } from "@/lib/admin";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/users/:id — that user's dreams (admin only).
export async function GET(_req: Request, { params }: Params) {
  await ensureSchema();
  const admin = await getAdminSession();
  if (!admin)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const { id } = await params;
  const dreams = await listUserDreams(id);
  return NextResponse.json({ dreams });
}

// DELETE /api/admin/users/:id — remove a user with all their data (admin only).
export async function DELETE(_req: Request, { params }: Params) {
  await ensureSchema();
  const admin = await getAdminSession();
  if (!admin)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const { id } = await params;
  if (id === admin.userId)
    return NextResponse.json(
      { error: "لا يمكنك حذف حسابك الخاص من هنا" },
      { status: 400 },
    );

  await deleteUserAsAdmin(id);
  return NextResponse.json({ ok: true });
}
