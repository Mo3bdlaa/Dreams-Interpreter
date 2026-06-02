"use client";

import { useEffect, useState } from "react";
import { getPinHash, hashPin, isUnlocked, setUnlocked } from "@/lib/pin";

// Public paths that should never be locked behind the device PIN.
const OPEN_PREFIXES = ["/share", "/login", "/register"];

export function PinGate() {
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    if (OPEN_PREFIXES.some((p) => path.startsWith(p))) return;
    if (getPinHash() && !isUnlocked()) setLocked(true);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = (await hashPin(pin)) === getPinHash();
    if (ok) {
      setUnlocked();
      setLocked(false);
    } else {
      setError(true);
      setPin("");
    }
  }

  if (!locked) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-night-950/95 backdrop-blur-md">
      <form onSubmit={submit} className="card w-full max-w-xs p-6 text-center">
        <div className="mb-3 text-4xl">🔒</div>
        <h2 className="mb-1 font-bold">التطبيق مقفول</h2>
        <p className="mb-4 text-sm text-night-100/60">أدخل رمز الـ PIN</p>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          className="input text-center tracking-[0.5em]"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
          placeholder="••••"
        />
        {error && (
          <p className="mt-2 text-sm text-red-300">رمز غير صحيح</p>
        )}
        <button type="submit" className="btn-primary mt-4 w-full">
          فتح
        </button>
      </form>
    </div>
  );
}
