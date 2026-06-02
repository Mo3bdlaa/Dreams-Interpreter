"use client";

export interface DreamSummaryRow {
  id: string;
  title: string;
  dreamDate: number | null;
  mood: string | null;
  symbols: string[];
  summary: string | null;
  kind: string | null;
  shareToken: string | null;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "حدث خطأ ما.");
  }
  return data as T;
}

export const api = {
  register: (body: { name: string; email: string; password: string }) =>
    fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle),

  login: (body: { email: string; password: string }) =>
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle),

  logout: () => fetch("/api/auth/logout", { method: "POST" }).then(handle),

  me: () => fetch("/api/auth/me").then(handle),

  listDreams: () =>
    fetch("/api/dreams").then((r) =>
      handle<{ dreams: DreamSummaryRow[] }>(r),
    ),

  createDream: (body: { content?: string; dreamDate?: number | null }) =>
    fetch("/api/dreams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => handle<{ id: string }>(r)),

  getDream: (id: string) =>
    fetch(`/api/dreams/${id}`).then((r) =>
      handle<{ dream: DreamSummaryRow; messages: ChatMsg[] }>(r),
    ),

  patchDream: (id: string, body: { title?: string; dreamDate?: number | null }) =>
    fetch(`/api/dreams/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(handle),

  deleteDream: (id: string, hard = false) =>
    fetch(`/api/dreams/${id}${hard ? "?hard=1" : ""}`, {
      method: "DELETE",
    }).then(handle),

  restoreDream: (id: string) =>
    fetch(`/api/dreams/${id}/restore`, { method: "POST" }).then(handle),

  listTrash: () =>
    fetch("/api/dreams/trash").then((r) =>
      handle<{ dreams: DreamSummaryRow[] }>(r),
    ),

  shareDream: (id: string) =>
    fetch(`/api/dreams/${id}/share`, { method: "POST" }).then((r) =>
      handle<{ token: string }>(r),
    ),

  unshareDream: (id: string) =>
    fetch(`/api/dreams/${id}/share`, { method: "DELETE" }).then(handle),

  // Streamed reply — returns the raw Response so the caller can read chunks.
  sendMessageStream: (id: string, content: string) =>
    fetch(`/api/dreams/${id}/messages/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }),

  sendMessage: (id: string, content: string) =>
    fetch(`/api/dreams/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }).then((r) =>
      handle<{
        userMessage: ChatMsg;
        assistantMessage: ChatMsg;
        mood: string;
        symbols: string[];
      }>(r),
    ),

  summarizeDream: (id: string) =>
    fetch(`/api/dreams/${id}/summary`, { method: "POST" }).then((r) =>
      handle<{ summary: string; kind: string | null }>(r),
    ),

  summary: () =>
    fetch("/api/summary").then((r) =>
      handle<{
        total: number;
        topSymbols: { key: string; count: number }[];
        moods: Record<string, number>;
        summary: string;
      }>(r),
    ),
};
