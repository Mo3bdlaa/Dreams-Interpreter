"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type DreamSummaryRow } from "@/lib/client";
import { formatArabicDate } from "./format";

export function TrashView() {
  const [dreams, setDreams] = useState<DreamSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    api
      .listTrash()
      .then(({ dreams }) => setDreams(dreams))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function restore(id: string) {
    await api.restoreDream(id);
    setDreams((d) => d.filter((x) => x.id !== id));
  }
  async function purge(id: string) {
    if (!confirm("حذف هذا الحلم نهائياً؟ لا يمكن التراجع.")) return;
    await api.deleteDream(id, true);
    setDreams((d) => d.filter((x) => x.id !== id));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">🗑 سلة المهملات</h1>
        <Link href="/dashboard" className="btn-ghost px-3 py-1.5 text-sm">
          ← الرئيسية
        </Link>
      </div>

      {loading ? (
        <p className="text-night-100/60">جارٍ التحميل…</p>
      ) : dreams.length === 0 ? (
        <div className="card p-8 text-center text-night-100/60">
          السلة فارغة. 🌙
        </div>
      ) : (
        <ul className="space-y-2">
          {dreams.map((d) => (
            <li
              key={d.id}
              className="card flex items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <h3 className="truncate font-bold">{d.title}</h3>
                <p className="text-xs text-night-100/60">
                  حُذف: {formatArabicDate(d.deletedAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => restore(d.id)}
                  className="btn-ghost px-3 py-1.5 text-sm"
                >
                  ♻️ استرجاع
                </button>
                <button
                  onClick={() => purge(d.id)}
                  className="btn-ghost px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
                >
                  حذف نهائي
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
