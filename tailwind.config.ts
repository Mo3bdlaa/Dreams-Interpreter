import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        night: {
          50: "#eef0ff",
          100: "#dadcff",
          200: "#bcc0ff",
          300: "#9398ff",
          400: "#6d6efc",
          500: "#574bf0",
          600: "#4a37d4",
          700: "#3f2eab",
          800: "#342989",
          900: "#1a1640",
          950: "#0e0b29",
        },
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(109,110,252,0.5)" },
          "50%": { boxShadow: "0 0 0 12px rgba(109,110,252,0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out",
        "pulse-glow": "pulseGlow 1.5s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
