"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        await api.register({ name, email, password });
      } else {
        await api.login({ email, password });
      }
      const next = params.get("next") || "/dashboard";
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="card animate-fade-in p-7">
        <Link href="/" className="mb-6 block text-center text-4xl">
          🌙
        </Link>
        <h1 className="mb-1 text-center text-2xl font-bold">
          {isRegister ? "إنشاء حساب جديد" : "تسجيل الدخول"}
        </h1>
        <p className="mb-6 text-center text-sm text-night-100/70">
          {isRegister
            ? "ابدأ رحلتك مع تفسير الأحلام"
            : "أهلاً بعودتك إلى مُعبِّر"}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="label">الاسم</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اسمك"
                required
              />
            </div>
          )}
          <div>
            <label className="label">البريد الإلكتروني</label>
            <input
              className="input"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="label">كلمة المرور</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-lg"
          >
            {loading
              ? "لحظة…"
              : isRegister
                ? "إنشاء الحساب"
                : "دخول"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-night-100/70">
          {isRegister ? (
            <>
              عندك حساب؟{" "}
              <Link href="/login" className="text-night-300 hover:underline">
                سجّل الدخول
              </Link>
            </>
          ) : (
            <>
              لسه ماعندكش حساب؟{" "}
              <Link href="/register" className="text-night-300 hover:underline">
                أنشئ حساباً
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
