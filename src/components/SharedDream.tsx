"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Markdown } from "./Markdown";
import { moodMeta, formatArabicDate } from "./format";

interface Shared {
  dream: {
    title: string;
    dreamDate: number | null;
    mood: string | null;
    kind: string | null;
    symbols: string[];
    summary: string | null;
  };
  messages: { role: "user" | "assistant"; content: string }[];
}

export function SharedDream({ token }: { token: string }) {
  const [data, setData] = useState<Shared | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("الرابط غير صالح أو تم إلغاء المشاركة.");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="text-5xl">🌙</div>
        <p className="mt-4 text-night-100/70">{error}</p>
        <Link href="/" className="mt-4 inline-block text-night-300 hover:underline">
          إلى مُعبِّر الأحلام
        </Link>
      </main>
    );
  }
  if (!data) {
    return <p className="p-10 text-center text-night-100/60">جارٍ التحميل…</p>;
  }

  const mood = moodMeta(data.dream.mood);
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 text-center">
        <Link href="/" className="text-3xl">🌙</Link>
        <p className="mt-1 text-xs text-night-100/50">حلم مُشارَك — للقراءة فقط</p>
      </div>

      <div className="card p-5">
        <h1 className="text-xl font-bold">{data.dream.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-night-100/70">
          <span>📅 {formatArabicDate(data.dream.dreamDate)}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${mood.cls}`}>
            {mood.emoji} {mood.label}
          </span>
          {data.dream.kind && (
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs">
              {data.dream.kind}
            </span>
          )}
        </div>
      </div>

      {data.dream.summary && (
        <div className="card mt-4 p-5">
          <h2 className="mb-2 font-bold">📌 الخلاصة</h2>
          <div className="text-sm leading-relaxed text-night-100/90">
            <Markdown content={data.dream.summary} />
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {data.messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 leading-relaxed ${
              m.role === "user"
                ? "bg-night-400 text-night-950"
                : "ms-auto border border-white/10 bg-white/5"
            }`}
          >
            <Markdown content={m.content} />
          </div>
        ))}
      </div>
    </main>
  );
}
