import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutrals mirror learn.shareai.run (zinc)
        bg: { DEFAULT: "#ffffff", subtle: "#f4f4f5", muted: "#e4e4e7" },
        ink: {
          DEFAULT: "#09090b", // zinc-950
          soft: "#3f3f46", // zinc-700 (body)
          faint: "#71717a", // zinc-500 (captions = ref --color-text-secondary)
        },
        line: { DEFAULT: "#e4e4e7" }, // zinc-200 (dark handled via dark: utilities)
        // Warm amber accent (ref uses amber/orange for active states, progress, accents)
        brand: { DEFAULT: "#f59e0b", soft: "#fbbf24", deep: "#d97706" },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto",
          "Helvetica Neue", "Arial", "PingFang SC", "Hiragino Sans GB",
          "Microsoft YaHei", "sans-serif",
        ],
        mono: [
          "ui-monospace", "SFMono-Regular", "Menlo", "Consolas",
          "Liberation Mono", "monospace",
        ],
      },
      borderRadius: { xl2: "0.75rem" },
      keyframes: {
        fadeUp: { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
      animation: { fadeUp: "fadeUp 0.35s ease both" },
    },
  },
  plugins: [],
};
export default config;
