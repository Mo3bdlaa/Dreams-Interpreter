"use client";

import { useState } from "react";
import { api } from "@/lib/client";

const REASONS = [
  "التفسير غير صحيح",
  "لا علاقة له بحلمي",
  "غير مفهوم",
  "المصادر غير مناسبة",
];

/**
 * "هل التفسير ظبط؟" — a verdict on one interpretation.
 *
 * A thumbs-down opens a short reason list, because "why" is what turns a
 * rating into something actionable. Optimistic: the choice shows immediately
 * and silently reverts if the request fails.
 */
export function FeedbackBar({
  messageId,
  initial,
}: {
  messageId: string;
  initial?: "up" | "down";
}) {
  const [rating, setRating] = useState<"up" | "down" | undefined>(initial);
  const [askReason, setAskReason] = useState(false);
  const [sentReason, setSentReason] = useState<string | null>(null);

  // Optimistic replies have a temporary client id until the thread reloads.
  if (messageId.startsWith("a-")) return null;

  async function vote(next: "up" | "down", reason?: string) {
    const prev = rating;
    setRating(next);
    setAskReason(next === "down" && !reason);
    if (reason) setSentReason(reason);
    try {
      await api.sendFeedback(messageId, next, reason);
    } catch {
      setRating(prev);
      setAskReason(false);
    }
  }

  return (
    <div className="mt-2 border-t border-white/10 pt-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="opacity-60">هل التفسير ظبط؟</span>
        <button
          onClick={() => vote("up")}
          aria-pressed={rating === "up"}
          title="التفسير ظبط"
          className={`rounded-lg px-2 py-1 transition ${
            rating === "up"
              ? "bg-emerald-400/20 text-emerald-200"
              : "opacity-60 hover:bg-white/10 hover:opacity-100"
          }`}
        >
          👍 ظبط
        </button>
        <button
          onClick={() => vote("down")}
          aria-pressed={rating === "down"}
          title="التفسير ما ظبطش"
          className={`rounded-lg px-2 py-1 transition ${
            rating === "down"
              ? "bg-rose-400/20 text-rose-200"
              : "opacity-60 hover:bg-white/10 hover:opacity-100"
          }`}
        >
          👎 ما ظبطش
        </button>
        {rating === "up" && <span className="opacity-60">شكراً لك 🌙</span>}
        {sentReason && <span className="opacity-60">سُجّلت: {sentReason}</span>}
      </div>

      {askReason && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => vote("down", r)}
              className="rounded-lg border border-white/10 px-2 py-1 opacity-70 transition hover:bg-white/10 hover:opacity-100"
            >
              {r}
            </button>
          ))}
          <button
            onClick={() => setAskReason(false)}
            className="rounded-lg px-2 py-1 opacity-50 hover:opacity-80"
          >
            تخطّي
          </button>
        </div>
      )}
    </div>
  );
}
