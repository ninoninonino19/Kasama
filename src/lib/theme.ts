/**
 * The handful of palette values that have to be passed as props rather than
 * class names — icon tints, `RefreshControl` spinners, placeholder text and
 * ripple colours. Keeping them here means the Tailwind theme and the values
 * scattered through JSX can't drift apart.
 *
 * Two palettes live here while the redesign lands:
 *
 *  - The top of `colors` is the "shared fridge board" system — paper, moss,
 *    mustard, brick — which Home, Bills, Chores and the Board are drawn in.
 *  - The `brand` / `coral` / `sand` / `amber` scales at the bottom are the
 *    original teal set, still used by the screens the design brief left out
 *    (auth, onboarding, settings, the add/detail modals). They are deprecated
 *    — nothing new should reach for them.
 *
 * Anything used as *text* is at least 4.5:1 against both the paper cards and
 * the page canvas; the `faint` entries are decorative (chevrons, dividers,
 * unchecked glyphs) and are never the only carrier of meaning.
 */
export const colors = {
  /** Behind the cards — the fridge door itself. */
  page: '#EDEFE4',
  /** Slightly lighter canvas for scrolling screens. */
  screenBg: '#F1F3EA',
  /** A pinned note. Every card in the system sits on this. */
  paper: '#FBFAF4',
  /** Hairline card border and divider. */
  line: '#E2E0D4',
  ink: {
    DEFAULT: '#23281F',
    /**
     * Secondary body text. Derived — the system names one muted ink, but the
     * codebase already distinguishes "soft" (readable secondary) from "muted"
     * (metadata), and collapsing them flattens every card's hierarchy.
     */
    soft: '#454C3F',
    muted: '#5C6455',
    /** Decorative only — chevrons, dividers, disabled glyphs. Never text. */
    faint: '#9BA391',
  },
  moss: {
    DEFAULT: '#2F3D2C',
    light: '#5C6E52',
  },
  mustard: '#E8B94A',
  brick: '#C05B45',
  sage: '#A9BFA0',
  /**
   * Derived: low-saturation fills of the three accents, for pill and banner
   * backgrounds. The accents themselves are far too loud behind text.
   */
  wash: {
    mustard: '#F8EACB',
    brick: '#F5E0DA',
    sage: '#E3ECDE',
  },
  /** Derived: darkened accents, each 4.5:1 or better on its own wash. */
  deep: {
    mustard: '#7A5B12',
    brick: '#8E3D2C',
    sage: '#33502C',
  },
  /** Near-black used for the tab bar and other "hardware" chrome. */
  bezel: '#1B211A',
  white: '#FFFFFF',

  // ---------------------------------------------------------------------
  // Deprecated: the original teal/coral palette. Still referenced by the
  // screens the design brief left out (auth, onboarding, settings, the
  // add/detail modals). Nothing new should reach for these.
  // ---------------------------------------------------------------------
  brand: {
    50: '#EFFAF8',
    100: '#D7F2EE',
    200: '#AFE5DD',
    300: '#7FD3C8',
    400: '#4FBCAF',
    500: '#2FA396',
    600: '#218578',
    700: '#1C6A61',
  },
  coral: {
    50: '#FFF4F0',
    100: '#FFE5DC',
    200: '#FFC8B6',
    400: '#FF7F5C',
    500: '#F2603A',
    600: '#D64827',
    700: '#B0381D',
  },
  amber: {
    50: '#FDF6E7',
    100: '#FAECCC',
    200: '#F2D9A0',
    600: '#9A6B12',
    700: '#7F5710',
  },
  sand: {
    50: '#FCFAF7',
    100: '#F7F3EE',
    200: '#EFE9E1',
    300: '#E2D9CD',
    400: '#C9BDAD',
    500: '#A99B89',
    600: '#8A7C6B',
    900: '#2C2722',
  },
} as const;

/**
 * Font family names as registered by `useFonts` in the root layout.
 *
 * React Native resolves a custom face by family name, not by family + weight,
 * so every weight is its own entry here and in `tailwind.config.js`. Setting
 * `fontWeight` on top of one of these does nothing useful — pick the family
 * that already is the weight you want.
 *
 * Usage rules from the design system:
 *  - `display` (Caveat) is for personal-feeling moments only — greetings,
 *    board post text, "your turn!" tags. Never buttons, labels or dense UI.
 *  - `mono` (IBM Plex Mono) is for peso amounts, due dates and timestamps.
 *  - Everything else is `body` (Manrope).
 */
export const fonts = {
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemibold: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  bodyExtrabold: 'Manrope_800ExtraBold',
  display: 'Caveat_600SemiBold',
  displayBold: 'Caveat_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoSemibold: 'IBMPlexMono_600SemiBold',
} as const;

/**
 * Washi-tape colours. A card picks one by context (moss for chores, mustard
 * for money, brick for anything overdue) or deterministically from an id, so
 * a note keeps the same tape between renders.
 */
export const TAPE_COLORS = [
  colors.mustard,
  colors.sage,
  colors.brick,
  colors.moss.light,
] as const;

export type TapeColor = (typeof TAPE_COLORS)[number];

/** Stable tape colour for a note, derived from its id. */
export function tapeColorFor(seed: string): TapeColor {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100_000;
  }
  return TAPE_COLORS[hash % TAPE_COLORS.length];
}

/** Android ripples, which want a translucent version of the surface tint. */
export const ripple = {
  brand: '#2F3D2C20',
  card: '#2F3D2C12',
  light: '#FFFFFF30',
} as const;
