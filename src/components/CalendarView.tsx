"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type DreamSummaryRow } from "@/lib/client";
import { DreamCard } from "./DreamCard";
import { moodMeta } from "./format";

const WEEKDAYS = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const monthLabel = new Intl.DateTimeFormat("ar-EG", {
  month: "long",
  year: "numeric",
});

/** Local YYYY-MM-DD key for a timestamp. */
function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// Column index with the week starting on Saturday.
const colOf = (date: Date) => (date.getDay() + 1) % 7;

export function CalendarView() {
  const [dreams, setDreams] = useState<DreamSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selected, setSelected] = useState<string | null>(dayKey(today.getTime()));

  useEffect(() => {
    api
      .listDreams()
      .then(({ dreams }) => setDreams(dreams))
      .finally(() => setLoading(false));
  }, []);

  // Group dreams by day (using the dream's date, else when it was recorded).
  const byDay = useMemo(() => {
    const map = new Map<string, DreamSummaryRow[]>();
    for (const d of dreams) {
      const key = dayKey(d.dreamDate ?? d.createdAt);
      (map.get(key) ?? map.set(key, []).get(key)!).push(d);
    }
    return map;
  }, [dreams]);

  const { year, month } = cursor;
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = colOf(firstOfMonth);

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectedDreams = selected ? byDay.get(selected) ?? [] : [];

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      return {
        year: c.year + Math.floor(m / 12),
        month: ((m % 12) + 12) % 12,
      };
    });
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="card p-4">
        {/* Month navigation */}
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => shiftMonth(-1)} className="btn-ghost px-3 py-1.5">
            ‹ السابق
          </button>
          <h2 className="text-lg font-bold">
            {monthLabel.format(firstOfMonth)}
          </h2>
          <button onClick={() => shiftMonth(1)} className="btn-ghost px-3 py-1.5">
            التالي ›
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-night-100/60">جارٍ التحميل…</p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-night-100/60">
              {WEEKDAYS.map((w) => (
                <div key={w} className="py-1 font-medium">
                  {w}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) return <div key={`b${i}`} />;
                const key = dayKey(new Date(year, month, day).getTime());
                const dayDreams = byDay.get(key) ?? [];
                const isToday = key === dayKey(today.getTime());
                const isSelected = key === selected;
                const mood = dayDreams[0] ? moodMeta(dayDreams[0].mood) : null;
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={`relative aspect-square rounded-lg border p-1 text-sm transition ${
                      isSelected
                        ? "border-night-400 bg-night-400/20"
                        : "border-white/5 hover:border-white/20"
                    } ${isToday ? "ring-1 ring-night-300/50" : ""}`}
                  >
                    <span className={dayDreams.length ? "font-bold" : "text-night-100/50"}>
                      {day}
                    </span>
                    {dayDreams.length > 0 && (
                      <span
                        className={`absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[10px] ${mood?.cls ?? ""}`}
                      >
                        {mood?.emoji} {dayDreams.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Selected day's dreams */}
      <div className="mt-6">
        <h3 className="mb-3 text-lg font-bold">
          {selected
            ? `أحلام ${new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(selected))}`
            : "اختر يوماً"}
        </h3>
        {selectedDreams.length === 0 ? (
          <div className="card p-6 text-center text-night-100/60">
            لا توجد أحلام في هذا اليوم. 🌙
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {selectedDreams.map((d) => (
              <DreamCard key={d.id} dream={d} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
