import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        // Tema warm/gold portado del portal público (reservation-app) para el wizard de reservas.
        gold: {
          DEFAULT: '#B8860B',
          light: '#DAA520',
        },
        warm: {
          50: '#FDFCF9',
          100: '#FAF7F0',
          200: '#F5EDE0',
          300: '#E8DCC8',
          400: '#D4C5A9',
          500: '#B8A88A',
          600: '#8C7B64',
          700: '#6B5D4A',
          800: '#4A3F33',
          900: '#2C2520',
          950: '#1C1917',
        },
      },
    },
  },
  plugins: [],
};

export default config;
