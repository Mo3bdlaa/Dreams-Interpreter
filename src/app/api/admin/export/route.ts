import { NextResponse } from "next/server";
import { ensureSchema } from "@/db/init";
import { getAdminSession } from "@/lib/auth";
import { exportAllData } from "@/lib/admin";

// GET /api/admin/export — download all app data as JSON (admin only, no passwords).
export async function GET() {
  await ensureSchema();
  const admin = await getAdminSession();
  if (!admin)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const data = await exportAllData();
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dreams-export-${stamp}.json"`,
    },
  });
}
