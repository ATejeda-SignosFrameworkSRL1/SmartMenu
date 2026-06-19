// Config de Tailwind SOLO para Storybook (la app real usa su propio config + el preset).
const preset = require("./src/preset.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  presets: [preset],
  content: ["./src/**/*.{ts,tsx}", "./.storybook/**/*.{ts,tsx}"],
};
