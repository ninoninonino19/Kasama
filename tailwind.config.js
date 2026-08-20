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
        // One palette for the whole app. The three surfaces are separated by
        // value on purpose, so each one does visible work: `canvas` is the
        // ground, `paper` is a card lifted off it, `page` is recessed.
        //
        // Recessed — pressed states, progress tracks, inset counters. Deep
        // enough that pressing a paper card is actually visible.
        page: '#E6E9DB',
        // The ground a screen sits on.
        canvas: '#F2F4EA',
        // A pinned note. Every card in the system sits on this.
        paper: '#FCFBF6',
        // Hairline card border and divider.
        line: '#DEDCCD',
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
        // Slate — the informational tone: hints, callouts, "here is something
        // to know". Promoted out of the category tints rather than invented,
        // so the palette gains a voice without gaining a hue.
        slate: '#2F4B50',
        // Derived: low-saturation fills of the accents, for pill and banner
        // backgrounds — the accents themselves are too loud behind text.
        wash: {
          mustard: '#F8EACB',
          brick: '#F5E0DA',
          sage: '#E3ECDE',
          slate: '#DCE5E7',
        },
        // Derived: darkened accents, each 4.5:1 or better on its own wash.
        deep: {
          mustard: '#7A5B12',
          brick: '#8E3D2C',
          sage: '#33502C',
          slate: '#2A464B',
        },
        // Near-black for the tab bar and other "hardware" chrome.
        bezel: '#1B211A',
        // All three text tones clear 4.5:1 on `canvas`, `paper` and `page`.
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
        // Caveat. Greetings, board posts, "your turn" — never dense UI text.
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
