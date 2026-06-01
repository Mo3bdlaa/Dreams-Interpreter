import { NextResponse } from "next/server";
import { ensureSchema } from "@/db/init";
import { getSession } from "@/lib/auth";
import { getOwnedDream, addUserMessageAndReply } from "@/lib/dreams";

type Params = { params: Promise<{ id: string }> };

// POST /api/dreams/:id/messages — send a turn, get the interpreter's reply.
export async function POST(req: Request, { params }: Params) {
  await ensureSchema();
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { id } = await params;
  const dream = await getOwnedDream(id, session.userId);
  if (!dream)
    return NextResponse.json({ error: "الحلم غير موجود" }, { status: 404 });

  const { content } = await req.json().catch(() => ({}));
  if (!content || !String(content).trim()) {
    return NextResponse.json({ error: "الرسالة فارغة." }, { status: 400 });
  }

  const result = await addUserMessageAndReply(id, String(content).trim());
  return NextResponse.json({
    userMessage: result.userMsg,
    assistantMessage: result.assistantMsg,
    mood: result.mood,
    symbols: result.symbols,
  });
}
