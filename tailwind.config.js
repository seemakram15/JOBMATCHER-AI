/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#121218',
        panel: '#1E1E2E',
        ink: '#E8EAED',
        muted: '#8B93A7',
        primary: '#4A90D9',
        success: '#4CAF70',
        warning: '#FFC107',
        danger: '#EF5350',
        cyan: '#00ACC1',
        line: '#2D2D3A',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        soft: '0 24px 80px rgba(0, 0, 0, 0.24)',
      },
    },
  },
  plugins: [],
}
