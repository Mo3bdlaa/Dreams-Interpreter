"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { moodMeta } from "./format";

interface SummaryData {
  total: number;
  topSymbols: { key: string; count: number }[];
  moods: Record<string, number>;
  summary: string;
}

export function SummaryPanel({ dreamCount }: { dreamCount: number }) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reload whenever the dream count changes (e.g. after delete/create).
  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .summary()
      .then((d) => active && setData(d))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [dreamCount]);

  if (!data) {
    return (
      <section className="card p-5 text-night-100/60">
        {loading ? "جارٍ تحضير الملخص…" : "—"}
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="إجمالي الأحلام" value={String(data.total)} />
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm text-night-100/70">مزاج أحلامك</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(data.moods).length === 0 ? (
              <span className="text-night-100/50">—</span>
            ) : (
              Object.entries(data.moods).map(([mood, count]) => {
                const m = moodMeta(mood);
                return (
                  <span
                    key={mood}
                    className={`rounded-full px-2.5 py-1 text-xs ${m.cls}`}
                  >
                    {m.emoji} {m.label}: {count}
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>

      {data.topSymbols.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-night-100/70">أكثر الرموز تكراراً</p>
          <div className="flex flex-wrap gap-1.5">
            {data.topSymbols.map((s) => (
              <span
                key={s.key}
                className="rounded-full bg-night-400/15 px-2.5 py-1 text-xs text-night-100"
              >
                {s.key} · {s.count}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 border-t border-white/10 pt-4">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between text-sm font-medium text-night-200 hover:text-night-100"
        >
          <span>📖 نظرة عامة على رحلتك مع الأحلام</span>
          <span>{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <p className="mt-3 whitespace-pre-wrap leading-relaxed text-night-100/85 animate-fade-in">
            {data.summary}
          </p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-4 text-center">
      <div className="text-3xl font-bold text-night-300">{value}</div>
      <div className="mt-1 text-sm text-night-100/70">{label}</div>
    </div>
  );
}
