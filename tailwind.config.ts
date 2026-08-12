import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pine: "var(--color-pine)",
        moss: "var(--color-moss)",
        fern: "var(--color-fern)",
        amber: "var(--color-amber)",
        lantern: "var(--color-lantern)",
        paper: "var(--color-paper)",
        ink: "var(--color-ink)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      boxShadow: {
        card: "0 2px 0 rgba(0,0,0,0.35)",
        tape: "0 6px 18px rgba(0,0,0,0.25)",
      },
    },
  },
  plugins: [],
};
export default config;