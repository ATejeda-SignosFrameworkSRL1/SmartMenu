import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#B8860B',
          light: '#DAA520',
          dark: '#8B6508',
          50: '#FDF8E8',
          100: '#F9ECC5',
          200: '#F0D48A',
          300: '#E7BC4F',
          400: '#DAA520',
          500: '#B8860B',
          600: '#946B09',
          700: '#705107',
          800: '#4C3705',
          900: '#2D2003',
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
      fontFamily: {
        // Fuentes display/body + fallbacks CJK del sistema (zh/ja/ko) para evitar "tofu".
        display: [
          'var(--font-playfair)',
          'Georgia',
          '"Songti SC"',
          '"Noto Serif CJK SC"',
          '"Yu Mincho"',
          '"Noto Serif JP"',
          'serif',
        ],
        body: [
          'var(--font-inter)',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Noto Sans CJK SC"',
          '"Malgun Gothic"',
          '"Noto Sans JP"',
          '"Noto Sans KR"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
