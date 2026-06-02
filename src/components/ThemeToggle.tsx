"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("theme-light"));
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("theme-light", next);
    try {
      localStorage.setItem("theme", next ? "light" : "dark");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      className="rounded-lg px-2 py-1.5 text-lg hover:bg-white/10"
      title={light ? "الوضع الليلي" : "الوضع النهاري"}
      aria-label="تبديل الثيم"
    >
      {light ? "🌙" : "☀️"}
    </button>
  );
}
