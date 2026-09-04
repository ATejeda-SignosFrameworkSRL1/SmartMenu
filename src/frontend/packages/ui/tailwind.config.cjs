
const preset = require("./src/preset.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  presets: [preset],
  content: ["./src/**/*.{ts,tsx}", "./.storybook/**/*.{ts,tsx}"],
};
