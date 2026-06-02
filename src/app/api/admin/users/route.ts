import { NextResponse } from "next/server";
import { ensureSchema } from "@/db/init";
import { getAdminSession } from "@/lib/auth";
import { listAllUsers } from "@/lib/admin";

// GET /api/admin/users — all users with dream counts (admin only).
export async function GET() {
  await ensureSchema();
  const admin = await getAdminSession();
  if (!admin)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const users = await listAllUsers();
  return NextResponse.json({ users });
}
