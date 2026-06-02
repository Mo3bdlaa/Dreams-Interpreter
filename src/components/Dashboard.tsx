"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type DreamSummaryRow } from "@/lib/client";
import { VoiceTextarea } from "./VoiceTextarea";
import { DreamCard } from "./DreamCard";
import { SummaryPanel } from "./SummaryPanel";

export function Dashboard() {
  const router = useRouter();
  const [dreams, setDreams] = useState<DreamSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [dreamDate, setDreamDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const { dreams } = await api.listDreams();
      setDreams(dreams);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createDream() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { id } = await api.createDream({
        content: text.trim(),
        dreamDate: dreamDate ? new Date(dreamDate).getTime() : null,
      });
      router.push(`/dreams/${id}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا الحلم نهائياً؟")) return;
    await api.deleteDream(id);
    setDreams((d) => d.filter((x) => x.id !== id));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <SummaryPanel dreamCount={dreams.length} />

      {/* New dream composer */}
      <section className="card mt-6 p-5">
        {!composing ? (
          <button
            onClick={() => setComposing(true)}
            className="btn-primary w-full text-lg"
          >
            ＋ احكِ حلماً جديداً
          </button>
        ) : (
          <div className="space-y-3 animate-fade-in">
            <h2 className="font-bold">احكِ حلمك بالتفصيل</h2>
            <VoiceTextarea
              value={text}
              onChange={setText}
              rows={4}
              placeholder="رأيت في المنام… (تقدر تكتب أو تضغط المايك وتتكلم)"
              onSubmit={createDream}
            />
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label">تاريخ الحلم (اختياري)</label>
                <input
                  type="date"
                  className="input w-auto"
                  value={dreamDate}
                  onChange={(e) => setDreamDate(e.target.value)}
                />
              </div>
              <div className="ms-auto flex gap-2">
                <button
                  onClick={() => {
                    setComposing(false);
                    setText("");
                    setDreamDate("");
                  }}
                  className="btn-ghost"
                >
                  إلغاء
                </button>
                <button
                  onClick={createDream}
                  disabled={!text.trim() || submitting}
                  className="btn-primary"
                >
                  {submitting ? "جارٍ التفسير…" : "فسّر الحلم"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Dreams list */}
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">أحلامك</h2>
        {loading ? (
          <p className="text-night-100/60">جارٍ التحميل…</p>
        ) : dreams.length === 0 ? (
          <div className="card p-8 text-center text-night-100/60">
            لا توجد أحلام بعد. احكِ أول حلم ليبدأ كل شيء. 🌙
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {dreams.map((d) => (
              <DreamCard key={d.id} dream={d} onDelete={remove} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
