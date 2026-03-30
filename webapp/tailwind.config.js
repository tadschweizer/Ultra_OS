/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-surface-dark)',
        secondary: 'var(--color-surface-dark-raised)',
        accent: 'var(--color-accent-amber)',
        paper: 'var(--color-page-background)',
        ink: 'var(--color-text-primary)',
        panel: 'var(--color-surface-dark)',
        card: 'var(--color-surface-dark-raised)',
        surface: {
          light: 'var(--color-surface-light)',
          white: 'var(--color-surface-white)',
          dark: 'var(--color-surface-dark)',
          raised: 'var(--color-surface-dark-raised)',
        },
        border: {
          subtle: 'var(--color-border-subtle)',
          DEFAULT: 'var(--color-border-default)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          faint: 'var(--color-text-faint)',
          dark: 'var(--color-text-on-dark)',
          dim: 'var(--color-text-muted-on-dark)',
        },
        amber: {
          DEFAULT: 'var(--color-accent-amber)',
          light: 'var(--color-accent-amber-light)',
          dim: 'var(--color-accent-amber-dim)',
        },
        category: {
          heat: 'var(--color-category-heat)',
          gut: 'var(--color-category-gut)',
          respiratory: 'var(--color-category-respiratory)',
          supplementation: 'var(--color-category-supplementation)',
          recovery: 'var(--color-category-recovery)',
          altitude: 'var(--color-category-altitude)',
          nutrition: 'var(--color-category-nutrition)',
          sleep: 'var(--color-category-sleep)',
        },
      },
      fontFamily: {
        display: ['"Iowan Old Style"', '"Palatino Linotype"', '"Book Antiqua"', 'Georgia', 'serif'],
        sans: ['"Aptos"', '"Segoe UI"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        warm: '0 18px 40px rgba(28, 26, 23, 0.06)',
        'warm-lg': '0 24px 60px rgba(28, 26, 23, 0.12)',
        panel: '0 40px 100px rgba(28, 26, 23, 0.20)',
      },
      borderRadius: {
        card: '16px',
        panel: '16px',
        pill: '9999px',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
        'fade-in-up': 'fadeInUp 200ms ease-out both',
        'slide-up': 'slideUp 0.28s ease-out',
      },
    },
  },
  plugins: [],
};
