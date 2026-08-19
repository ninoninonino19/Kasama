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
        // --- "Shared fridge board" design system -------------------------
        // The fridge door itself, behind the pinned notes.
        page: '#EDEFE4',
        // Slightly lighter canvas for scrolling screens.
        canvas: '#F1F3EA',
        // A pinned note. Every card in the system sits on this.
        paper: '#FBFAF4',
        // Hairline card border and divider.
        line: '#E2E0D4',
        // Deep green — primary actions, active tab, "done".
        moss: {
          DEFAULT: '#2F3D2C',
          light: '#5C6E52',
        },
        // Warm yellow — money, "due soon", the default washi tape.
        mustard: '#E8B94A',
        // Terracotta — overdue, destructive, anything that needs chasing.
        brick: '#C05B45',
        // Soft green — settled, calm accents, streak fills.
        sage: '#A9BFA0',
        // Near-black for the tab bar and other "hardware" chrome.
        bezel: '#1B211A',

        // --- Deprecated ---------------------------------------------------
        // The original teal set, still used by the screens outside the design
        // brief (auth, onboarding, settings, add/detail modals).
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
        // Muted amber — "due soon", the step between settled and overdue.
        amber: {
          50: '#FDF6E7',
          100: '#FAECCC',
          200: '#F2D9A0',
          300: '#E4BC68',
          400: '#D0A03A',
          500: '#B5851F',
          600: '#9A6B12',
          700: '#7F5710',
          800: '#66450D',
          900: '#4E350A',
        },
        // Ink is shared by both palettes — the board system's near-black green
        // reads correctly on the old sand canvas too, so there is no second
        // scale to keep in sync. All three text tones clear 4.5:1 on `paper`.
        ink: {
          DEFAULT: '#23281F',
          // Derived: the system names one muted ink, but the app already
          // separates readable secondary text from metadata.
          soft: '#454C3F',
          muted: '#5C6455',
          // Decorative only — chevrons, dividers, disabled glyphs. Never text.
          faint: '#9BA391',
        },
      },
      // React Native matches a custom face by family name alone, so each weight
      // is its own family here rather than a `font-bold` away. Keys deliberately
      // avoid Tailwind's own `font-{weight}` utilities.
      fontFamily: {
        sans: ['Manrope_400Regular'],
        ui: ['Manrope_500Medium'],
        'ui-semibold': ['Manrope_600SemiBold'],
        'ui-bold': ['Manrope_700Bold'],
        'ui-black': ['Manrope_800ExtraBold'],
        // Caveat. Greetings, board posts, "your turn!" — never dense UI text.
        hand: ['Caveat_600SemiBold'],
        'hand-bold': ['Caveat_700Bold'],
        // IBM Plex Mono. Peso amounts, due dates, timestamps.
        mono: ['IBMPlexMono_500Medium'],
        'mono-bold': ['IBMPlexMono_600SemiBold'],
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
