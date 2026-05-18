/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        acid: '#E8FF3D',
        iron: {
          950: '#090909',
          900: '#111111',
          800: '#181818',
          700: '#222222',
          600: '#2C2C2C',
          500: '#3A3A3A',
          400: '#555555',
          300: '#777777',
          200: '#AAAAAA',
          100: '#DDDDDD',
        },
        push: '#60A5FA',
        pull: '#4ADE80',
        legs: '#FB923C',
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['"DM Sans"', 'sans-serif'],
      },
      letterSpacing: {
        widest2: '0.2em',
      },
    },
  },
  plugins: [],
}
