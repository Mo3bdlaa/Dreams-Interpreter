"use client";

import { useEffect, useMemo, useState } from "react";
import { formatArabicDate } from "@/lib/utils";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  createdAt: number;
  dreamCount: number;
}

interface AdminDream {
  id: string;
  title: string;
  mood: string | null;
  kind: string | null;
  deletedAt: number | null;
  createdAt: number;
}

interface AdminMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

interface DreamDetail {
  dream: AdminDream & { userId: string };
  owner: { id: string; email: string; name: string } | null;
  messages: AdminMessage[];
}

interface Stats {
  totals: {
    totalUsers: number;
    totalDreams: number;
    activeDreams: number;
    totalMessages: number;
    recentSignups: number;
  };
  byMood: { key: string | null; count: number }[];
  byKind: { key: string | null; count: number }[];
  topSymbols: { symbol: string; count: number }[];
}

const MOOD_LABEL: Record<string, string> = {
  positive: "إيجابي",
  neutral: "محايد",
  negative: "سلبي",
  mixed: "مختلط",
};
const moodLabel = (m: string | null) => (m ? MOOD_LABEL[m] || m : "غير محدّد");
const kindLabel = (k: string | null) => k || "غير مصنّف";

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "حدث خطأ");
  return data as T;
}

export function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [dreams, setDreams] = useState<Record<string, AdminDream[]>>({});
  const [detail, setDetail] = useState<DreamDetail | null>(null);

  // Filters
  const [userQuery, setUserQuery] = useState("");
  const [dreamQuery, setDreamQuery] = useState("");
  const [moodFilter, setMoodFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");

  useEffect(() => {
    Promise.all([
      jget<{ users: AdminUser[] }>("/api/admin/users").then((d) => setUsers(d.users)),
      jget<Stats>("/api/admin/stats").then(setStats),
    ])
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, userQuery]);

  function filterDreams(list: AdminDream[]): AdminDream[] {
    const q = dreamQuery.trim().toLowerCase();
    return list.filter(
      (d) =>
        (!q || d.title.toLowerCase().includes(q)) &&
        (!moodFilter || d.mood === moodFilter) &&
        (!kindFilter || d.kind === kindFilter),
    );
  }

  async function toggleUser(id: string) {
    if (openUser === id) {
      setOpenUser(null);
      return;
    }
    setOpenUser(id);
    if (!dreams[id]) {
      try {
        const d = await jget<{ dreams: AdminDream[] }>(`/api/admin/users/${id}`);
        setDreams((m) => ({ ...m, [id]: d.dreams }));
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }

  async function openDream(id: string) {
    try {
      setDetail(await jget<DreamDetail>(`/api/admin/dreams/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteDream(userId: string, id: string) {
    if (!confirm("حذف هذا الحلم نهائياً؟")) return;
    await fetch(`/api/admin/dreams/${id}`, { method: "DELETE" });
    setDreams((m) => ({ ...m, [userId]: (m[userId] || []).filter((d) => d.id !== id) }));
    setUsers((us) =>
      us.map((u) => (u.id === userId ? { ...u, dreamCount: u.dreamCount - 1 } : u)),
    );
    if (detail?.dream.id === id) setDetail(null);
  }

  async function deleteUser(id: string) {
    if (!confirm("حذف هذا المستخدم وكل أحلامه نهائياً؟ لا يمكن التراجع.")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error || "تعذّر الحذف");
      return;
    }
    setUsers((us) => us.filter((u) => u.id !== id));
    if (openUser === id) setOpenUser(null);
  }

  const filtersActive = dreamQuery || moodFilter || kindFilter;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">🛡️ لوحة الأدمن</h1>
        <a
          href="/api/admin/export"
          className="btn-ghost px-3 py-1.5 text-sm"
          title="تنزيل كل البيانات بصيغة JSON"
        >
          ⬇️ تصدير الكل
        </a>
      </div>

      {error && (
        <div className="card mb-4 border-red-500/40 p-4 text-sm text-red-300">{error}</div>
      )}

      {/* Statistics */}
      {stats && (
        <section className="mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="المستخدمون" value={stats.totals.totalUsers} icon="👥" />
            <Stat
              label="الأحلام"
              value={stats.totals.totalDreams}
              icon="🌙"
              hint={`${stats.totals.activeDreams} نشطة`}
            />
            <Stat label="الرسائل" value={stats.totals.totalMessages} icon="💬" />
            <Stat label="تسجيلات (٧ أيام)" value={stats.totals.recentSignups} icon="✨" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <BarCard title="حسب المزاج" rows={stats.byMood} labelFn={moodLabel} />
            <BarCard title="حسب النوع" rows={stats.byKind} labelFn={kindLabel} />
          </div>

          {stats.topSymbols.length > 0 && (
            <div className="card p-4">
              <h3 className="mb-3 text-sm font-bold text-night-100/80">
                أكثر الرموز شيوعاً
              </h3>
              <div className="flex flex-wrap gap-2">
                {stats.topSymbols.map((s) => (
                  <span
                    key={s.symbol}
                    className="rounded-full bg-white/10 px-3 py-1 text-sm"
                  >
                    {s.symbol}
                    <span className="mr-1.5 text-xs text-night-100/50">{s.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Filters toolbar */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          className="input"
          placeholder="🔍 بحث بالاسم أو الإيميل…"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
        />
        <input
          className="input"
          placeholder="🔍 بحث في عناوين الأحلام…"
          value={dreamQuery}
          onChange={(e) => setDreamQuery(e.target.value)}
        />
        <select
          className="input"
          value={moodFilter}
          onChange={(e) => setMoodFilter(e.target.value)}
        >
          <option value="">كل الأمزجة</option>
          {Object.entries(MOOD_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          className="input"
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
        >
          <option value="">كل الأنواع</option>
          <option value="رؤيا">رؤيا</option>
          <option value="أضغاث">أضغاث</option>
          <option value="حديث نفس">حديث نفس</option>
        </select>
      </div>

      {loading && (
        <div className="card p-6 text-center text-night-100/60">… جارٍ التحميل</div>
      )}
      {!loading && (
        <p className="mb-2 text-sm text-night-100/50">
          {filteredUsers.length} مستخدم
          {filtersActive ? " · فلترة الأحلام مُفعّلة" : ""}
        </p>
      )}

      <div className="space-y-3">
        {filteredUsers.map((u) => {
          const userDreams = dreams[u.id];
          const shown = userDreams ? filterDreams(userDreams) : undefined;
          return (
            <div key={u.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                <button
                  onClick={() => toggleUser(u.id)}
                  className="flex flex-1 items-center gap-3 text-right"
                >
                  <span className="text-lg">{openUser === u.id ? "▾" : "▸"}</span>
                  <span>
                    <span className="font-semibold">{u.name}</span>
                    <span className="mr-2 text-sm text-night-100/60">{u.email}</span>
                  </span>
                </button>
                <div className="flex items-center gap-3 text-sm">
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5">
                    {u.dreamCount} حلم
                  </span>
                  <span className="hidden text-night-100/50 sm:inline">
                    {formatArabicDate(u.createdAt)}
                  </span>
                  <button
                    onClick={() => deleteUser(u.id)}
                    className="rounded-lg px-2 py-1 text-red-300 hover:bg-red-500/15"
                    title="حذف المستخدم"
                  >
                    حذف
                  </button>
                </div>
              </div>

              {openUser === u.id && (
                <div className="border-t border-white/10 bg-black/20 p-3">
                  {!shown ? (
                    <p className="py-2 text-center text-sm text-night-100/50">… تحميل</p>
                  ) : shown.length === 0 ? (
                    <p className="py-2 text-center text-sm text-night-100/50">
                      {userDreams!.length === 0 ? "لا توجد أحلام" : "لا نتائج للفلترة"}
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {shown.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-white/5"
                        >
                          <button
                            onClick={() => openDream(d.id)}
                            className="flex-1 truncate text-right text-sm"
                          >
                            {d.deletedAt && (
                              <span className="text-red-300/70">[محذوف] </span>
                            )}
                            {d.title}
                            {d.kind && (
                              <span className="mr-2 text-xs text-night-100/50">
                                ({d.kind})
                              </span>
                            )}
                          </button>
                          <span className="hidden text-xs text-night-100/40 sm:inline">
                            {formatArabicDate(d.createdAt)}
                          </span>
                          <button
                            onClick={() => deleteDream(u.id, d.id)}
                            className="rounded px-2 py-0.5 text-xs text-red-300 hover:bg-red-500/15"
                          >
                            حذف
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="card max-h-[80vh] w-full max-w-2xl overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{detail.dream.title}</h2>
                <p className="text-sm text-night-100/60">
                  {detail.owner?.name} · {detail.owner?.email}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="btn-ghost px-3 py-1 text-sm">
                إغلاق
              </button>
            </div>
            <div className="space-y-3">
              {detail.messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "rounded-xl bg-night-500/20 p-3"
                      : "rounded-xl bg-white/5 p-3"
                  }
                >
                  <div className="mb-1 text-xs text-night-100/50">
                    {m.role === "user" ? "🧑 صاحب الحلم" : "🌙 المُعبِّر"}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: number;
  icon: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="mb-1 text-2xl">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-night-100/60">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-night-100/40">{hint}</div>}
    </div>
  );
}

function BarCard({
  title,
  rows,
  labelFn,
}: {
  title: string;
  rows: { key: string | null; count: number }[];
  labelFn: (k: string | null) => string;
}) {
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((r) => r.count));
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-sm font-bold text-night-100/80">{title}</h3>
      {sorted.length === 0 ? (
        <p className="text-sm text-night-100/40">لا بيانات</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((r) => (
            <div key={String(r.key)} className="flex items-center gap-2 text-sm">
              <span className="w-20 shrink-0 truncate text-night-100/70">
                {labelFn(r.key)}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-night-400"
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-left text-night-100/50">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
