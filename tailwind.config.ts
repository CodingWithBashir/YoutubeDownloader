import type { Config } from "tailwindcss";

const color = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: color("--canvas"),
        surface: color("--surface"),
        "surface-2": color("--surface-2"),
        ink: color("--ink"),
        muted: color("--muted"),
        line: color("--line"),
        brand: color("--brand"),
        "brand-soft": color("--brand-soft"),
        teal: color("--teal"),
        gold: color("--gold"),
        success: color("--success"),
        danger: color("--danger"),
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Newsreader Variable"', "Iowan Old Style", "Georgia", "serif"],
        mono: ['"SFMono-Regular"', "Consolas", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        soft: "0 20px 60px -30px rgb(15 23 42 / 0.35)",
        lift: "0 28px 80px -32px rgb(15 23 42 / 0.45)",
        inset: "inset 0 1px 0 rgb(255 255 255 / 0.45)",
      },
      transitionTimingFunction: {
        swift: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-12px) rotate(1.5deg)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.6" },
          "80%, 100%": { transform: "scale(1.7)", opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.65s cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scale-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        float: "float 7s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.22, 1, 0.36, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
