"use client";

// Client-side convenience lock (a PIN gate over the app on this device).
// Not a security boundary — server auth still guards all data. The PIN hash
// lives in localStorage; the "unlocked" flag lives in sessionStorage so the
// lock re-engages when the tab/session closes.

const HASH_KEY = "pin_hash";
const UNLOCK_KEY = "pin_unlocked";

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode("dream::" + pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getPinHash(): string | null {
  try {
    return localStorage.getItem(HASH_KEY);
  } catch {
    return null;
  }
}

export async function setPin(pin: string): Promise<void> {
  localStorage.setItem(HASH_KEY, await hashPin(pin));
  sessionStorage.setItem(UNLOCK_KEY, "1");
}

export function clearPin(): void {
  localStorage.removeItem(HASH_KEY);
  sessionStorage.removeItem(UNLOCK_KEY);
}

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return true;
  }
}

export function setUnlocked(): void {
  sessionStorage.setItem(UNLOCK_KEY, "1");
}
