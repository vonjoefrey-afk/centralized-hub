/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Aurora Signal semantic tokens (resolve from CSS vars in index.css,
        // so every one is light/dark aware automatically).
        surface: 'var(--surface-page)',
        'surface-card': 'var(--surface-card)',
        'surface-raised': 'var(--surface-raised)',
        ink: 'var(--text-primary)',
        muted: 'var(--text-secondary)',
        faint: 'var(--text-muted)',
        hairline: 'var(--border-subtle)',
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        'accent-2': 'rgb(var(--accent-2-rgb) / <alpha-value>)',
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(120deg, var(--accent-from), var(--accent-to))',
        'gradient-vitals': 'linear-gradient(120deg, var(--vitals-from), var(--vitals-to))',
      },
    },
  },
  plugins: [],
}



