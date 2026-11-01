/* eslint-disable @typescript-eslint/no-require-imports */
import type { Config } from "tailwindcss";

const config: Config = {
  // use the conventional string 'class' (works with Tailwind)
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      colors: {
        // Raw brand values, for the few places that need the logo colour
        // directly rather than through a semantic token.
        navy: {
          DEFAULT: "hsl(var(--uudam-navy))",
          soft: "hsl(var(--uudam-navy-soft))",
          deep: "hsl(var(--uudam-navy-deep))",
          night: "hsl(var(--uudam-night))",
        },
        gold: {
          DEFAULT: "hsl(var(--uudam-gold))",
          text: "hsl(var(--uudam-gold-text))",
          soft: "hsl(var(--uudam-gold-soft))",
        },
        // Storefront surfaces (defined under .site-theme in globals.css).
        paper: "hsl(var(--paper))",
        sand: "hsl(var(--sand))",
        ink: {
          DEFAULT: "hsl(var(--ink))",
          soft: "hsl(var(--ink-soft))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      maxWidth: {
        site: "82rem",
      },
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.2, 0.7, 0.2, 1)",
      },
      boxShadow: {
        lift: "0 24px 48px -28px rgb(10 37 64 / 0.45)",
        panel: "0 1px 2px rgb(10 37 64 / 0.06), 0 12px 32px -16px rgb(10 37 64 / 0.22)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
