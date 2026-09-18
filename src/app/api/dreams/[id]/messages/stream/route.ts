import { ensureSchema } from "@/db/init";
import { getSession } from "@/lib/auth";
import {
  getOwnedDream,
  getMessages,
  saveUserMessage,
  saveAssistantMessage,
  refreshDreamMeta,
} from "@/lib/dreams";
import { streamDreamReply, citedFooterFor, type ChatMessage } from "@/lib/ai";

// Allow time for AI generation + embedding on serverless (Vercel).
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

// POST /api/dreams/:id/messages/stream — Server-streamed interpretation.
// Streams plain UTF-8 text chunks; persists the full reply (+sources footer)
// and refreshes dream metadata once the stream completes.
export async function POST(req: Request, { params }: Params) {
  await ensureSchema();
  const session = await getSession();
  if (!session) return new Response("غير مصرّح", { status: 401 });

  const { id } = await params;
  const dream = await getOwnedDream(id, session.userId);
  if (!dream) return new Response("الحلم غير موجود", { status: 404 });

  const { content } = await req.json().catch(() => ({}));
  if (!content || !String(content).trim()) {
    return new Response("الرسالة فارغة.", { status: 400 });
  }
  const userContent = String(content).trim();

  await saveUserMessage(id, userContent);
  const history = await getMessages(id);
  const chatHistory: ChatMessage[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        // Drive the generator manually so we can read its RETURN value — the
        // reference list the reply was grounded on — and cite only what the
        // reply actually leaned on.
        const gen = streamDreamReply(chatHistory);
        let refs: Awaited<ReturnType<typeof gen.next>>["value"] = [];
        while (true) {
          const { value, done } = await gen.next();
          if (done) {
            refs = value ?? [];
            break;
          }
          full += value;
          controller.enqueue(encoder.encode(value as string));
        }
        const footer = citedFooterFor(full, Array.isArray(refs) ? refs : []);
        if (footer) {
          full += footer;
          controller.enqueue(encoder.encode(footer));
        }
      } catch (e) {
        const msg = "\n\n⚠️ تعذّر إكمال التفسير، حاول مرة أخرى.";
        full += msg;
        controller.enqueue(encoder.encode(msg));
        console.error("stream error", e);
      } finally {
        // Persist the assistant message and refresh metadata after streaming.
        if (full.trim()) await saveAssistantMessage(id, full);
        await refreshDreamMeta(id, userContent);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
