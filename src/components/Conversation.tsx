"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, type ChatMsg, type DreamSummaryRow } from "@/lib/client";
import { VoiceTextarea } from "./VoiceTextarea";
import { Markdown } from "./Markdown";
import { moodMeta } from "./format";

function toDateInput(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function Conversation({ dreamId }: { dreamId: string }) {
  const [dream, setDream] = useState<DreamSummaryRow | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const data = await api.getDream(dreamId);
      setDream(data.dream);
      setMessages(data.messages);
      setTitleDraft(data.dream.title);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dreamId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setText("");
    setSending(true);

    const userId = "u-" + Date.now();
    const asstId = "a-" + Date.now();
    setMessages((m) => [
      ...m,
      { id: userId, role: "user", content, createdAt: Date.now() },
      { id: asstId, role: "assistant", content: "", createdAt: Date.now() + 1 },
    ]);

    try {
      const res = await api.sendMessageStream(dreamId, content);
      if (!res.ok || !res.body) throw new Error("stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      // Stream chunks into the assistant bubble as they arrive.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) =>
          m.map((x) => (x.id === asstId ? { ...x, content: acc } : x)),
        );
      }
      // Refresh metadata (mood/symbols/title) now that the turn is saved.
      try {
        const data = await api.getDream(dreamId);
        setDream(data.dream);
      } catch {
        /* keep streamed content */
      }
    } catch {
      setMessages((m) => m.filter((x) => x.id !== userId && x.id !== asstId));
      setText(content);
    } finally {
      setSending(false);
    }
  }

  async function saveTitle() {
    setEditingTitle(false);
    const t = titleDraft.trim();
    if (!dream || !t || t === dream.title) return;
    setDream({ ...dream, title: t });
    await api.patchDream(dreamId, { title: t });
  }

  async function saveDate(value: string) {
    if (!dream) return;
    const ms = value ? new Date(value).getTime() : null;
    setDream({ ...dream, dreamDate: ms });
    await api.patchDream(dreamId, { dreamDate: ms });
  }

  async function share() {
    try {
      const { token } = await api.shareDream(dreamId);
      const url = `${window.location.origin}/share/${token}`;
      if (dream) setDream({ ...dream, shareToken: token });
      try {
        await navigator.clipboard.writeText(url);
        alert("تم إنشاء رابط مشاركة عام (للقراءة فقط) ونسخه:\n" + url);
      } catch {
        prompt("رابط المشاركة (انسخه):", url);
      }
    } catch {
      alert("تعذّر إنشاء رابط المشاركة.");
    }
  }

  async function saveSummary() {
    if (savingSummary) return;
    setSavingSummary(true);
    try {
      const { summary, kind } = await api.summarizeDream(dreamId);
      if (dream) setDream({ ...dream, summary, kind: kind ?? dream.kind });
      setShowSummary(true);
    } finally {
      setSavingSummary(false);
    }
  }

  if (loading) {
    return <p className="p-6 text-night-100/60">جارٍ التحميل…</p>;
  }
  if (!dream) {
    return (
      <div className="p-6 text-center">
        <p className="text-night-100/70">الحلم غير موجود.</p>
        <Link href="/dashboard" className="text-night-300 hover:underline">
          العودة للوحة
        </Link>
      </div>
    );
  }

  const mood = moodMeta(dream.mood);

  return (
    <div className="mx-auto flex h-[calc(100dvh-57px)] max-w-3xl flex-col px-4">
      {/* Dream header */}
      <div className="card my-4 p-4">
        <div className="flex items-center justify-between gap-2">
          {editingTitle ? (
            <input
              autoFocus
              className="input flex-1"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === "Enter" && saveTitle()}
            />
          ) : (
            <h1
              className="flex-1 cursor-pointer text-lg font-bold hover:text-night-300"
              onClick={() => setEditingTitle(true)}
              title="اضغط للتعديل"
            >
              {dream.title} <span className="text-xs opacity-40">✎</span>
            </h1>
          )}
          <span className={`rounded-full px-2 py-0.5 text-xs ${mood.cls}`}>
            {mood.emoji} {mood.label}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-night-100/70">
          <label className="flex items-center gap-2">
            📅 تاريخ الحلم:
            <input
              type="date"
              className="input w-auto py-1 text-sm"
              value={toDateInput(dream.dreamDate)}
              onChange={(e) => saveDate(e.target.value)}
            />
          </label>
          {dream.symbols.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {dream.symbols.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-white/5 px-2 py-0.5 text-xs"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Saved digest (full dream + final interpretation) */}
        {dream.summary && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <button
              onClick={() => setShowSummary((s) => !s)}
              className="flex w-full items-center justify-between text-sm font-medium text-night-200 hover:text-night-100"
            >
              <span>📌 خلاصة الحلم المحفوظة</span>
              <span>{showSummary ? "▲" : "▼"}</span>
            </button>
            {showSummary && (
              <div className="mt-2 rounded-xl bg-night-950/50 p-3 text-sm leading-relaxed text-night-100/90 animate-fade-in">
                <Markdown content={dream.summary} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.map((m) =>
          m.role === "assistant" && m.content === "" ? (
            <Bubble key={m.id} role="assistant" content="… يفسّر حلمك" pending />
          ) : (
            <Bubble key={m.id} role={m.role} content={m.content} />
          ),
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 bg-night-950/40 py-3 backdrop-blur-sm">
        <VoiceTextarea
          value={text}
          onChange={setText}
          rows={2}
          placeholder="أضف تفصيلاً أو اسأل عن رمز… (Ctrl+Enter للإرسال)"
          onSubmit={send}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard" className="btn-ghost px-3 py-1.5 text-sm">
              ← كل الأحلام
            </Link>
            <button
              onClick={saveSummary}
              disabled={savingSummary || messages.length === 0}
              className="btn-ghost px-3 py-1.5 text-sm"
              title="لخّص الحلم وتفسيره النهائي واحفظه"
            >
              {savingSummary ? "يلخّص…" : "📌 احفظ الخلاصة"}
            </button>
            <button
              onClick={share}
              className="btn-ghost px-3 py-1.5 text-sm"
              title="إنشاء رابط مشاركة عام للقراءة فقط"
            >
              🔗 مشاركة
            </button>
            <button
              onClick={() => window.print()}
              className="btn-ghost px-3 py-1.5 text-sm"
              title="طباعة أو حفظ PDF"
            >
              🖨️ طباعة
            </button>
          </div>
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="btn-primary"
          >
            إرسال
          </button>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  pending,
}: {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex animate-fade-in ${isUser ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 leading-relaxed ${
          isUser
            ? "rounded-bs-md bg-night-400 text-night-950"
            : "rounded-be-md border border-white/10 bg-white/5"
        } ${pending ? "animate-pulse text-night-100/60" : ""}`}
      >
        {!isUser && !pending && <div className="mb-1 text-xs opacity-60">🌙 مُعبِّر</div>}
        {pending ? content : <Markdown content={content} />}
      </div>
    </div>
  );
}
