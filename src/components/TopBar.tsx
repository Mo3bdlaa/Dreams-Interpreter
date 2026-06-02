"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { ThemeToggle } from "./ThemeToggle";
import { clearPin, getPinHash, setPin } from "@/lib/pin";

export function TopBar({ name }: { name: string }) {
  const router = useRouter();

  async function logout() {
    await api.logout();
    router.push("/login");
    router.refresh();
  }

  async function managePin() {
    if (getPinHash()) {
      if (confirm("يوجد رمز PIN. هل تريد إزالته؟")) {
        clearPin();
        alert("تم إزالة القفل.");
      }
      return;
    }
    const pin = prompt("اختر رمز PIN (4 أرقام أو أكثر) لقفل التطبيق على هذا الجهاز:");
    if (pin && pin.trim().length >= 4) {
      await setPin(pin.trim());
      alert("تم تفعيل القفل. سيُطلب الرمز عند فتح التطبيق.");
    } else if (pin !== null) {
      alert("الرمز يجب أن يكون 4 أرقام على الأقل.");
    }
  }

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-night-950/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold">
            <span className="text-xl">🌙</span>
            <span className="hidden sm:inline">مُعبِّر الأحلام</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/dashboard"
              className="rounded-lg px-3 py-1.5 text-night-100/80 hover:bg-white/10"
            >
              الرئيسية
            </Link>
            <Link
              href="/calendar"
              className="rounded-lg px-3 py-1.5 text-night-100/80 hover:bg-white/10"
            >
              📅 التقويم
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="hidden text-night-100/70 sm:inline">أهلاً، {name}</span>
          <ThemeToggle />
          <button
            onClick={managePin}
            className="rounded-lg px-2 py-1.5 text-lg hover:bg-white/10"
            title="قفل بـ PIN"
            aria-label="قفل بـ PIN"
          >
            🔒
          </button>
          <button onClick={logout} className="btn-ghost px-3 py-1.5 text-sm">
            خروج
          </button>
        </div>
      </div>
    </header>
  );
}
