import { NextResponse } from "next/server";
import { ensureSchema } from "@/db/init";
import { getAdminSession } from "@/lib/auth";
import { getAdminStats } from "@/lib/admin";

// GET /api/admin/stats — aggregate app statistics (admin only).
export async function GET() {
  await ensureSchema();
  const admin = await getAdminSession();
  if (!admin)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  return NextResponse.json(await getAdminStats());
}
