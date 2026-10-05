/** @type {import('tailwindcss').Config} */
// Little Orange Fish brand (content-pack/brand/brand.yaml; KICKOFF §4f) replaces DESIGN-SYSTEM §2's accent,
// neutrals and type. cat.* = manifest.palette.groups, by name.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Carlito', 'Calibri', '"Segoe UI"', 'system-ui', 'sans-serif'],
        body: ['Carlito', 'Calibri', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        ink: { DEFAULT: '#222222', muted: '#555555' },
        paper: { DEFAULT: '#ffffff', 2: '#f3f3f3' },
        night: { DEFAULT: '#1b1d1f', 2: '#25282b', ink: '#e8e6e3', muted: '#b8b4ae' },
        brand: { orange: '#e8762b', fish: '#ee8544', slate: '#b6c3cc', head: '#fbe5d6', link: '#a84f17', linkdark: '#f0a46b', heading: '#e47229' },
        cat: {
          domain: '#e8762b', cross: '#3f6f8f', core: '#e8762b', ring: '#7a8791',
          verified: '#2e7d5b', changed: '#b3541e', open: '#9a6b00',
        },
      },
    },
  },
  plugins: [],
};
