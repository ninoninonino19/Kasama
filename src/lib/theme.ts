/**
 * The handful of palette values that have to be passed as props rather than
 * class names — icon tints, `RefreshControl` spinners, placeholder text and
 * ripple colours. Keeping them here means the Tailwind theme and the values
 * scattered through JSX can't drift apart.
 *
 * Anything used as *text* is at least 4.5:1 against both the white cards and
 * the sand canvas; the `faint` entries are decorative (chevrons, dividers,
 * unchecked glyphs) and are never the only carrier of meaning.
 */
export const colors = {
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
  ink: {
    DEFAULT: '#1F2A2E',
    soft: '#5A6A6F',
    muted: '#67757A',
    faint: '#A3AEB2',
  },
  white: '#FFFFFF',
} as const;

/** Android ripples, which want a translucent version of the surface tint. */
export const ripple = {
  brand: '#2FA39620',
  card: '#2FA39615',
  light: '#FFFFFF30',
} as const;
