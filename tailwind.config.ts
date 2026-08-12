import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      :root {
  color-scheme: dark;

  /* Default theme — Brew at the Zoo (RGB channels for Tailwind alpha support) */
  --color-pine: 20 41 31;
  --color-moss: 35 64 47;
  --color-fern: 111 163 107;
  --color-amber: 232 163 61;
  --color-lantern: 246 196 83;
  --color-paper: 243 234 216;
  --color-ink: 29 22 16;
}
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