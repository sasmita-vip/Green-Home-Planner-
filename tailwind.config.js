/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mint: {
          50: '#f4f8f4',
          100: '#e9f1ea',
          200: '#d7e6da',
          300: '#bcd4c2',
        },
        pine: {
          900: '#0d2118',
          800: '#12291f',
          700: '#1c3a2c',
          600: '#2c5040',
          500: '#456b58',
          400: '#6a8577',
        },
        accent: {
          DEFAULT: '#2f6b4f',
          light: '#4d8a6b',
          dark: '#1f4c37',
        },
        marigold: {
          DEFAULT: '#e8a020',
          light: '#f2bd5c',
          dark: '#b87b0c',
        },
        clay: '#b4553f',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.03em',
      },
      maxWidth: {
        content: '68rem',
      },
    },
  },
  plugins: [],
};
