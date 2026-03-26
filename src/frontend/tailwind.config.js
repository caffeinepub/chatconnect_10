/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: "oklch(var(--background) / <alpha-value>)",
        foreground: "oklch(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "oklch(var(--card) / <alpha-value>)",
          foreground: "oklch(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "oklch(var(--popover) / <alpha-value>)",
          foreground: "oklch(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
          foreground: "oklch(var(--destructive-foreground) / <alpha-value>)",
        },
        border: "oklch(var(--border) / <alpha-value>)",
        input: "oklch(var(--input) / <alpha-value>)",
        ring: "oklch(var(--ring) / <alpha-value>)",
        orange: {
          DEFAULT: "oklch(var(--orange) / <alpha-value>)",
          foreground: "oklch(var(--orange-foreground) / <alpha-value>)",
        },
        teal: {
          DEFAULT: "oklch(var(--teal) / <alpha-value>)",
          foreground: "oklch(var(--teal-foreground) / <alpha-value>)",
        },
        navy: {
          DEFAULT: "oklch(var(--navy) / <alpha-value>)",
          foreground: "oklch(var(--navy-foreground) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        display: ["Bricolage Grotesque", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        card: "0 4px 24px rgba(0,0,0,0.08)",
        hero: "0 20px 60px rgba(0,0,0,0.2)",
        glow: "0 0 40px rgba(124,58,237,0.3)",
      },
      backgroundImage: {
        "hero-gradient": "linear-gradient(135deg, #3A1C6E 0%, #2B2F7A 50%, #22C7B7 100%)",
        "card-gradient": "linear-gradient(135deg, #0B102A 0%, #14123A 100%)",
        "footer-gradient": "linear-gradient(135deg, #0B0F2A 0%, #1A1442 100%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
