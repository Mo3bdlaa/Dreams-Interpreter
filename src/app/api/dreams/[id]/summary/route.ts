import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ensureSchema } from "@/db/init";
import { getSession } from "@/lib/auth";
import { getOwnedDream, getMessages } from "@/lib/dreams";
import { summarizeDream, type ChatMessage } from "@/lib/ai";

type Params = { params: Promise<{ id: string }> };

// POST /api/dreams/:id/summary — condense the conversation into a saved
// digest (full dream + final interpretation) pinned to the dream.
export async function POST(_req: Request, { params }: Params) {
  await ensureSchema();
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const { id } = await params;
  const dream = await getOwnedDream(id, session.userId);
  if (!dream)
    return NextResponse.json({ error: "الحلم غير موجود" }, { status: 404 });

  const msgs = await getMessages(id);
  if (msgs.length === 0) {
    return NextResponse.json(
      { error: "لا توجد محادثة لتلخيصها بعد." },
      { status: 400 },
    );
  }

  const history: ChatMessage[] = msgs.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const { summary, kind } = await summarizeDream(history);

  await db
    .update(schema.dreams)
    .set({ summary, kind: kind ?? dream.kind, updatedAt: new Date() })
    .where(eq(schema.dreams.id, id));

  return NextResponse.json({ summary, kind });
}
