import type { Config } from "tailwindcss";
import preset from "@smartmenu/ui/preset";

export default {
  darkMode: ["class"],
  // Estructura de tokens, radios y animaciones base vienen del design system.
  presets: [preset],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    // Escanear los primitivos compartidos para que Tailwind genere sus clases.
    "../packages/ui/src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", '"Segoe UI"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"Noto Sans CJK SC"', '"Malgun Gothic"', '"Noto Sans JP"', '"Noto Sans KR"', "sans-serif"],
        display: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      // Tokens específicos de admin que NO están en el preset compartido.
      colors: {
        table: {
          available: "hsl(var(--table-available))",
          occupied: "hsl(var(--table-occupied))",
          cleaning: "hsl(var(--table-cleaning))",
          reserved: "hsl(var(--table-reserved))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      keyframes: {
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "slide-in": {
          from: { transform: "translateX(-100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
      },
      animation: {
        "pulse-slow": "pulse-slow 2s ease-in-out infinite",
        "slide-in": "slide-in 0.3s ease-out",
      },
    },
  },
} satisfies Config;
