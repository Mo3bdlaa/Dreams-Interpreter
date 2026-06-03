import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureSchema } from "@/db/init";
import {
  verifyPassword,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";
import { serverError } from "@/lib/api-error";

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const { email, password } = await req.json().catch(() => ({}));

    if (!email || !password) {
      return NextResponse.json(
        { error: "البريد وكلمة المرور مطلوبان." },
        { status: 400 },
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    const user = rows[0];
    if (!user || !(await verifyPassword(String(password), user.passwordHash))) {
      return NextResponse.json(
        { error: "البريد أو كلمة المرور غير صحيحة." },
        { status: 401 },
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (e) {
    return serverError(e);
  }
}
