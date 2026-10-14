import type { Config } from 'tailwindcss';

// ONLY these colours exist in the website. They are sampled from the Figma colour slide.
// Because `theme.colors` is replaced (not extended), a class like bg-blue-500 or text-gray-600
// does not exist, so nobody can add an off-palette colour by accident.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',
      maroon: '#7A1C1C',   // headings, key buttons
      saffron: '#D97706',  // primary action, accents (not for small text: 3.2:1 contrast)
      charcoal: '#231A18', // body text, footer
      rose: '#F3E4E1',     // panels, highlights, borders
    },
    extend: {
      fontFamily: {
        // Serif headings (traditional feel). Cambria ships with Windows/Office; Georgia is the fallback.
        serif: ['Cambria', 'Georgia', '"Noto Serif Tamil"', '"Nirmala UI"', 'serif'],
        // Clean sans body. Nirmala UI (Windows) and Noto Sans Tamil cover Tamil text.
        sans: ['"Segoe UI"', '"Nirmala UI"', '"Noto Sans Tamil"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
