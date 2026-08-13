/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Required on web: with Tailwind's default `media` strategy, NativeWind's
  // color-scheme observer throws when the dev server injects the stylesheet.
  // Kasama is a light-only app, so this flag just keeps that path quiet.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Soft teal — the primary accent. Warm enough to feel friendly, not corporate.
        brand: {
          50: '#EFFAF8',
          100: '#D7F2EE',
          200: '#AFE5DD',
          300: '#7FD3C8',
          400: '#4FBCAF',
          500: '#2FA396',
          600: '#218578',
          700: '#1C6A61',
          800: '#18544D',
          900: '#134540',
        },
        // Warm coral — used for balances owed, alerts and highlights.
        coral: {
          50: '#FFF4F0',
          100: '#FFE5DC',
          200: '#FFC8B6',
          300: '#FFA486',
          400: '#FF7F5C',
          500: '#F2603A',
          600: '#D64827',
          700: '#B0381D',
          800: '#8B2C18',
          900: '#6E2414',
        },
        // Warm neutral canvas + ink.
        sand: {
          50: '#FCFAF7',
          100: '#F7F3EE',
          200: '#EFE9E1',
          300: '#E2D9CD',
          400: '#C9BDAD',
          500: '#A99B89',
          600: '#8A7C6B',
          700: '#6B5F52',
          800: '#4B423A',
          900: '#2C2722',
        },
        ink: {
          DEFAULT: '#1F2A2E',
          soft: '#5A6A6F',
          muted: '#8A979B',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
    },
  },
  plugins: [],
};
