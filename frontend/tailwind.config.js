/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:     { DEFAULT: '#0F172A', foreground: '#FFFFFF' },  // logo navy
        secondary:   { DEFAULT: '#0D9488', foreground: '#FFFFFF' },  // logo teal
        accent:      { DEFAULT: '#14B8A6', foreground: '#0F172A' },  // lighter teal, CTA/gradient end
        success:     '#16A34A',   // completed / credited
        destructive: '#DC2626',   // flagged / error
        warning:     '#D97706',   // pending / fraud-flagged
        background:  '#F8FAFC',
        foreground:  '#0F172A',
        card:        '#FFFFFF',
        muted:       { DEFAULT: '#E8ECF1', foreground: '#64748B' },
        border:      '#E2E8F0',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],  // use for ALL money amounts, balances, FX rates
      },
      borderRadius: {
        lg: '0.75rem',
      },
    },
  },
  plugins: [],
};
