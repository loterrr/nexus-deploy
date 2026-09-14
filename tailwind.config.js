/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['var(--font-serif)', 'Newsreader', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        background: '#ffffff',
        surface: '#ffffff',
        vellum: '#faf9f6',
        'surface-subtle': '#f8fafc',
        'surface-muted': '#f1f5f9',
        border: '#e2e8f0',
        'border-strong': '#cbd5e1',
        primary: '#2563eb',
        'primary-hover': '#1d4ed8',
        'primary-light': '#eff6ff',
        cobalt: '#2563eb',
        'cobalt-hover': '#1d4ed8',
        'cobalt-subtle': '#eff6ff',
        ink: '#0f172a',
        'ink-muted': '#475569',
        'ink-subtle': '#94a3b8',
        provenance: '#d97706',
        'provenance-subtle': '#fef3c7',
      },
      boxShadow: {
        'crisp-xs': '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
        'crisp-sm': '0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.08)',
        'crisp-md': '0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'), 
  ],
}