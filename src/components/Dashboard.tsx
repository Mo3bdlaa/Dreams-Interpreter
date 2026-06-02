"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type DreamSummaryRow } from "@/lib/client";
import { VoiceTextarea } from "./VoiceTextarea";
import { DreamCard } from "./DreamCard";
import { SummaryPanel } from "./SummaryPanel";
import { InsightsCharts } from "./InsightsCharts";
import { ReminderBanner } from "./ReminderBanner";

export function Dashboard() {
  const router = useRouter();
  const [dreams, setDreams] = useState<DreamSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [dreamDate, setDreamDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Search + filters + insights toggle.
  const [query, setQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [showInsights, setShowInsights] = useState(false);

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

  const filtered = useMemo(() => {
    const q = query.trim();
    return dreams.filter((d) => {
      if (moodFilter && d.mood !== moodFilter) return false;
      if (kindFilter && d.kind !== kindFilter) return false;
      if (q) {
        const hay = `${d.title} ${d.symbols.join(" ")} ${d.summary ?? ""}`;
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dreams, query, moodFilter, kindFilter]);

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
    if (!confirm("نقل هذا الحلم إلى سلة المهملات؟")) return;
    await api.deleteDream(id);
    setDreams((d) => d.filter((x) => x.id !== id));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <ReminderBanner dreams={dreams} onStart={() => setComposing(true)} />
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

      {/* Toolbar: search + filters + actions */}
      <section className="mt-6 flex flex-wrap items-center gap-2">
        <input
          className="input flex-1 min-w-[160px] py-2"
          placeholder="🔍 ابحث في الأحلام والرموز…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input w-auto py-2"
          value={moodFilter}
          onChange={(e) => setMoodFilter(e.target.value)}
        >
          <option value="">كل المشاعر</option>
          <option value="positive">إيجابي</option>
          <option value="negative">مقلق</option>
          <option value="mixed">مختلط</option>
          <option value="neutral">محايد</option>
        </select>
        <select
          className="input w-auto py-2"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
        >
          <option value="">كل الأنواع</option>
          <option value="رؤيا">رؤيا</option>
          <option value="أضغاث">أضغاث</option>
          <option value="حديث نفس">حديث نفس</option>
        </select>
        <button
          onClick={() => setShowInsights((s) => !s)}
          className="btn-ghost py-2 text-sm"
        >
          📈 إحصاءات
        </button>
        <a href="/api/export" className="btn-ghost py-2 text-sm" download>
          ⬇️ تصدير
        </a>
        <Link href="/trash" className="btn-ghost py-2 text-sm">
          🗑 السلة
        </Link>
      </section>

      {showInsights && (
        <section className="mt-4 animate-fade-in">
          <InsightsCharts dreams={dreams} />
        </section>
      )}

      {/* Dreams list */}
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">
          أحلامك{" "}
          <span className="text-sm font-normal text-night-100/50">
            ({filtered.length})
          </span>
        </h2>
        {loading ? (
          <p className="text-night-100/60">جارٍ التحميل…</p>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center text-night-100/60">
            {dreams.length === 0
              ? "لا توجد أحلام بعد. احكِ أول حلم ليبدأ كل شيء. 🌙"
              : "لا نتائج مطابقة للبحث/الفلاتر."}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filtered.map((d) => (
              <DreamCard key={d.id} dream={d} onDelete={remove} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
