import type { Config } from 'tailwindcss';

// ONLY these colours exist in the website. They are sampled from the Figma colour slide.
// Because `theme.colors` is replaced (not extended), a class like bg-blue-500 or text-gray-600
// does not exist, so nobody can add an off-palette colour by accident.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
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
        // Headings: Lora for English, Noto Serif Tamil for Tamil (the browser picks per letter).
        serif: ['Lora', '"Noto Serif Tamil"', 'Georgia', 'serif'],
        // Big display headings (hero): Cormorant Garamond, with Tamil falling back to Noto Serif Tamil.
        display: ['"Cormorant Garamond"', '"Noto Serif Tamil"', 'Georgia', 'serif'],
        // Body and menu: Mukta Malar covers English and Tamil in one matching family.
        sans: ['"Mukta Malar"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        kenburns: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'scroll-dot': {
          '0%': { opacity: '0', transform: 'translateY(0)' },
          '40%': { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateY(10px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) both',
        kenburns: 'kenburns 30s ease-in-out infinite alternate',
        float: 'float 7s ease-in-out infinite',
        'scroll-dot': 'scroll-dot 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
