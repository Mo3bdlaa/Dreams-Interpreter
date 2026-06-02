"use client";

import { useEffect, useState } from "react";
import { type DreamSummaryRow } from "@/lib/client";

const todayKey = () => new Date().toISOString().slice(0, 10);

export function ReminderBanner({
  dreams,
  onStart,
}: {
  dreams: DreamSummaryRow[];
  onStart: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const today = todayKey();
    const dismissed = (() => {
      try {
        return localStorage.getItem("reminder_dismissed") === today;
      } catch {
        return false;
      }
    })();
    const recordedToday = dreams.some(
      (d) => new Date(d.createdAt).toISOString().slice(0, 10) === today,
    );
    setShow(!dismissed && !recordedToday);
  }, [dreams]);

  function dismiss() {
    try {
      localStorage.setItem("reminder_dismissed", todayKey());
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="card mb-4 flex items-center justify-between gap-3 border-night-400/30 bg-night-400/10 p-3 animate-fade-in">
      <span className="text-sm">
        🌅 صباح الخير! دوّن حلمك قبل ما تنساه — التفاصيل الطازجة تعطي تفسيراً أدق.
      </span>
      <div className="flex shrink-0 gap-2">
        <button onClick={onStart} className="btn-primary px-3 py-1.5 text-sm">
          سجّل الآن
        </button>
        <button
          onClick={dismiss}
          className="rounded-lg px-2 py-1.5 text-night-100/50 hover:bg-white/10"
          aria-label="إغلاق"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
