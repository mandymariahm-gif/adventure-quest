import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pine: "#14291F",
        moss: "#23402F",
        fern: "#6FA36B",
        amber: "#E8A33D",
        lantern: "#F6C453",
        paper: "#F3EAD8",
        ink: "#1D1610",
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
