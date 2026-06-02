"use client";

import { useEffect, useState } from "react";
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

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "حدث خطأ");
  return data as T;
}

export function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openUser, setOpenUser] = useState<string | null>(null);
  const [dreams, setDreams] = useState<Record<string, AdminDream[]>>({});
  const [detail, setDetail] = useState<DreamDetail | null>(null);

  useEffect(() => {
    jget<{ users: AdminUser[] }>("/api/admin/users")
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">🛡️ لوحة الأدمن</h1>
        <span className="text-sm text-night-100/60">{users.length} مستخدم</span>
      </div>

      {error && (
        <div className="card mb-4 border-red-500/40 p-4 text-sm text-red-300">{error}</div>
      )}
      {loading && <div className="card p-6 text-center text-night-100/60">… جارٍ التحميل</div>}

      <div className="space-y-3">
        {users.map((u) => (
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
                {(dreams[u.id] || []).length === 0 ? (
                  <p className="py-2 text-center text-sm text-night-100/50">
                    {dreams[u.id] ? "لا توجد أحلام" : "… تحميل"}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {dreams[u.id].map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-white/5"
                      >
                        <button
                          onClick={() => openDream(d.id)}
                          className="flex-1 truncate text-right text-sm"
                        >
                          {d.deletedAt && <span className="text-red-300/70">[محذوف] </span>}
                          {d.title}
                          {d.kind && (
                            <span className="mr-2 text-xs text-night-100/50">({d.kind})</span>
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
        ))}
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
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
