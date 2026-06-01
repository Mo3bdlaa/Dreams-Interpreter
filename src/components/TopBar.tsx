"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function TopBar({ name }: { name: string }) {
  const router = useRouter();

  async function logout() {
    await api.logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-night-950/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <span className="text-xl">🌙</span>
          <span>مُعبِّر الأحلام</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-night-100/70">أهلاً، {name}</span>
          <button onClick={logout} className="btn-ghost px-3 py-1.5 text-sm">
            خروج
          </button>
        </div>
      </div>
    </header>
  );
}
