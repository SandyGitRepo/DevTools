/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        primary: v('primary'),
        accent: v('accent'),
        cyan: v('hud-cyan'),
        navy: v('base'),
        base2: v('base-2'),
        fg: v('text-primary'),
        muted: v('text-secondary'),
        success: v('success'),
        danger: v('error'),
        warn: v('warn'),
      },
      fontFamily: {
        hud: ['Orbitron', 'Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
