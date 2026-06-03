import { NextResponse } from "next/server";

/** Map a thrown error to a user-facing Arabic reason + a raw detail string. */
export function diagnoseError(e: unknown): { error: string; detail: string } {
  const msg = e instanceof Error ? e.message : String(e);
  let error = "حدث خطأ في الخادم.";

  if (/AUTH_SECRET/i.test(msg)) {
    error = "إعداد AUTH_SECRET غير صحيح أو ناقص على الخادم (يجب أن يكون نصاً عشوائياً طويلاً).";
  } else if (
    /readonly|SQLITE_READONLY|unable to open database|file:local\.db/i.test(msg)
  ) {
    error =
      "قاعدة البيانات للقراءة فقط — على Vercel يجب ضبط DATABASE_URL و DATABASE_AUTH_TOKEN (Turso).";
  } else if (
    /libsql|sqlite|database|no such table|URL_INVALID|UNAUTHORIZED|auth.?token|Hrana|websocket/i.test(
      msg,
    )
  ) {
    error =
      "تعذّر الاتصال بقاعدة البيانات. تحقّق من DATABASE_URL و DATABASE_AUTH_TOKEN على Vercel.";
  }

  return { error, detail: msg };
}

/** Log the real error to the server and return a diagnosed 500 JSON response. */
export function serverError(e: unknown): NextResponse {
  const d = diagnoseError(e);
  console.error("[api-error]", d.detail);
  return NextResponse.json(d, { status: 500 });
}
