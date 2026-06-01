import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureSchema } from "@/db/init";
import {
  hashPassword,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";
import { newId, isValidEmail } from "@/lib/utils";

export async function POST(req: Request) {
  await ensureSchema();
  const { name, email, password } = await req.json().catch(() => ({}));

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "الاسم والبريد وكلمة المرور كلها مطلوبة." },
      { status: 400 },
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "صيغة البريد الإلكتروني غير صحيحة." },
      { status: 400 },
    );
  }
  if (String(password).length < 6) {
    return NextResponse.json(
      { error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل." },
      { status: 400 },
    );
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: "هذا البريد مسجّل بالفعل." },
      { status: 409 },
    );
  }

  const id = newId();
  const passwordHash = await hashPassword(String(password));
  await db.insert(schema.users).values({
    id,
    email: normalizedEmail,
    name: String(name).trim(),
    passwordHash,
  });

  const token = await createSessionToken({
    userId: id,
    email: normalizedEmail,
    name: String(name).trim(),
  });
  await setSessionCookie(token);

  return NextResponse.json({
    user: { id, email: normalizedEmail, name: String(name).trim() },
  });
}
