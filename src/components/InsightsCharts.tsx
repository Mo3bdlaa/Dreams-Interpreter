"use client";

import { useMemo } from "react";
import { type DreamSummaryRow } from "@/lib/client";
import { moodMeta } from "./format";

const monthFmt = new Intl.DateTimeFormat("ar-EG", { month: "short" });

export function InsightsCharts({ dreams }: { dreams: DreamSummaryRow[] }) {
  const { moodBars, monthBars, symbolBars } = useMemo(() => {
    // Mood distribution.
    const moods = new Map<string, number>();
    const symbols = new Map<string, number>();
    const months = new Map<string, number>();

    for (const d of dreams) {
      if (d.mood) moods.set(d.mood, (moods.get(d.mood) || 0) + 1);
      for (const s of d.symbols) symbols.set(s, (symbols.get(s) || 0) + 1);
    }

    // Dreams per month for the last 6 months.
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.set(`${dt.getFullYear()}-${dt.getMonth()}`, 0);
    }
    for (const d of dreams) {
      const dt = new Date(d.dreamDate ?? d.createdAt);
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      if (months.has(key)) months.set(key, (months.get(key) || 0) + 1);
    }

    const moodBars = [...moods.entries()].map(([k, v]) => ({
      label: moodMeta(k).label,
      emoji: moodMeta(k).emoji,
      value: v,
    }));
    const monthBars = [...months.entries()].map(([k, v]) => {
      const [y, m] = k.split("-").map(Number);
      return { label: monthFmt.format(new Date(y, m, 1)), value: v };
    });
    const symbolBars = [...symbols.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));

    return { moodBars, monthBars, symbolBars };
  }, [dreams]);

  if (dreams.length === 0) return null;
  const maxMonth = Math.max(1, ...monthBars.map((b) => b.value));
  const maxSym = Math.max(1, ...symbolBars.map((b) => b.value));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Dreams per month */}
      <div className="card p-4">
        <h3 className="mb-3 text-sm font-bold text-night-100/80">
          الأحلام عبر الأشهر
        </h3>
        <div className="flex h-32 items-end justify-between gap-2">
          {monthBars.map((b, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-night-400/70"
                style={{ height: `${(b.value / maxMonth) * 100}%` }}
                title={`${b.value}`}
              />
              <span className="text-[10px] text-night-100/60">{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mood distribution */}
      <div className="card p-4">
        <h3 className="mb-3 text-sm font-bold text-night-100/80">توزيع المزاج</h3>
        <div className="space-y-2">
          {moodBars.length === 0 ? (
            <p className="text-sm text-night-100/50">—</p>
          ) : (
            moodBars.map((b, i) => {
              const total = moodBars.reduce((s, x) => s + x.value, 0);
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0">
                    {b.emoji} {b.label}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-night-400/70"
                      style={{ width: `${(b.value / total) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-night-100/70">{b.value}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Top symbols */}
      {symbolBars.length > 0 && (
        <div className="card p-4 sm:col-span-2">
          <h3 className="mb-3 text-sm font-bold text-night-100/80">
            أكثر الرموز تكراراً
          </h3>
          <div className="space-y-2">
            {symbolBars.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 text-night-100/80">{b.label}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-indigo-400/70"
                    style={{ width: `${(b.value / maxSym) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-night-100/70">{b.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
