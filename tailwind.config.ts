import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pine: "rgb(var(--color-pine) / <alpha-value>)",
        moss: "rgb(var(--color-moss) / <alpha-value>)",
        fern: "rgb(var(--color-fern) / <alpha-value>)",
        amber: "rgb(var(--color-amber) / <alpha-value>)",
        lantern: "rgb(var(--color-lantern) / <alpha-value>)",
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
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
