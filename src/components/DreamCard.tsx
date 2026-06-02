"use client";

import { useState } from "react";
import Link from "next/link";
import { type DreamSummaryRow } from "@/lib/client";
import { Markdown } from "./Markdown";
import { formatArabicDate, moodMeta } from "./format";

export function DreamCard({
  dream,
  onDelete,
}: {
  dream: DreamSummaryRow;
  onDelete?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const mood = moodMeta(dream.mood);

  return (
    <li className="card group p-4 transition hover:border-night-400/40">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/dreams/${dream.id}`} className="flex-1">
          <h3 className="font-bold leading-snug">{dream.title}</h3>
          <p className="mt-1 text-xs text-night-100/60">
            {formatArabicDate(dream.dreamDate)}
          </p>
        </Link>
        {onDelete && (
          <button
            onClick={() => onDelete(dream.id)}
            className="text-night-100/40 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
            title="حذف"
          >
            🗑
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-xs ${mood.cls}`}>
          {mood.emoji} {mood.label}
        </span>
        {dream.kind && (
          <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-300">
            {dream.kind}
          </span>
        )}
        {dream.symbols.slice(0, 3).map((s) => (
          <span
            key={s}
            className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-night-100/70"
          >
            {s}
          </span>
        ))}
        {dream.summary && (
          <span className="rounded-full bg-night-400/15 px-2 py-0.5 text-xs text-night-200">
            📌 ملخّص
          </span>
        )}
      </div>

      {dream.summary && (
        <div className="mt-3 border-t border-white/10 pt-2">
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs font-medium text-night-200 hover:text-night-100"
          >
            {open ? "▲ إخفاء الخلاصة" : "📖 عرض خلاصة الحلم وتفسيره"}
          </button>
          {open && (
            <div className="mt-2 rounded-xl bg-night-950/50 p-3 text-sm leading-relaxed text-night-100/90 animate-fade-in">
              <Markdown content={dream.summary} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}
