import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        // Display now uses DM Sans (clean two-storey 'f', conventional letter
        // shapes) instead of Bricolage Grotesque, whose stylistic alternates
        // produced a curly `f` that read as unprofessional in headlines.
        // Bricolage stays loaded but is no longer the default — opt into it
        // via `font-bricolage` if a specific surface needs it.
        display: ['"DM Sans"', "ui-sans-serif", "system-ui"],
        bricolage: ['"Bricolage Grotesque"', "ui-sans-serif", "system-ui"],
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      keyframes: {
        "auth-scan": {
          "0%": { transform: "translateY(-30%)", opacity: "0" },
          "10%": { opacity: "0.6" },
          "90%": { opacity: "0.6" },
          "100%": { transform: "translateY(130%)", opacity: "0" },
        },
        "auth-pulse-ring": {
          "0%": { transform: "scale(0.6)", opacity: "0.6" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        "auth-tick": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-1px)" },
        },
      },
      animation: {
        "auth-scan": "auth-scan 9s linear infinite",
        "auth-pulse-ring": "auth-pulse-ring 2.4s cubic-bezier(0,0,0.2,1) infinite",
        "auth-tick": "auth-tick 1s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
