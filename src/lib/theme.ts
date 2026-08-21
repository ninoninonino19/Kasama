import type { TapeColor } from './database.types';

/**
 * The handful of palette values that have to be passed as props rather than
 * class names — icon tints, `RefreshControl` spinners, placeholder text and
 * ripple colours. Keeping them here means the Tailwind theme and the values
 * scattered through JSX can't drift apart.
 *
 * One palette, everywhere: the "shared fridge board" system — paper, moss,
 * mustard, brick, sage, slate. The teal/coral/sand set the app shipped with
 * before the redesign is gone; auth, onboarding, settings and the detail
 * modals now draw in these tokens like every other screen.
 *
 * Three roles, deliberately separated by value so each one does visible work:
 *
 *  - `canvas` is the ground a screen sits on.
 *  - `paper` is a card lifted off it.
 *  - `page` is recessed — pressed states, progress tracks, inset counters.
 *
 * Anything used as *text* is at least 4.5:1 against all three surfaces and
 * against its own wash; the `faint` entries are decorative (chevrons,
 * dividers, unchecked glyphs) and are never the only carrier of meaning.
 */
export const colors = {
  /** Recessed: pressed states, progress tracks, inset counters. */
  page: '#E6E9DB',
  /** The ground a screen sits on. */
  screenBg: '#F2F4EA',
  /** A pinned note. Every card in the system sits on this. */
  paper: '#FCFBF6',
  /** Hairline card border and divider. */
  line: '#DEDCCD',
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
   * Slate — the informational tone. Promoted out of the category tints rather
   * than invented: the Internet category has always been drawn in it, so the
   * palette gains a "here is something to know" voice without gaining a hue.
   * Without it, hints and callouts had to borrow sage, which reads as success.
   */
  slate: '#2F4B50',
  /**
   * Derived: low-saturation fills of the accents, for pill and banner
   * backgrounds. The accents themselves are far too loud behind text.
   */
  wash: {
    mustard: '#F8EACB',
    brick: '#F5E0DA',
    sage: '#E3ECDE',
    slate: '#DCE5E7',
  },
  /** Derived: darkened accents, each 4.5:1 or better on its own wash. */
  deep: {
    mustard: '#7A5B12',
    brick: '#8E3D2C',
    sage: '#33502C',
    slate: '#2A464B',
  },
  /** Near-black used for the tab bar and other "hardware" chrome. */
  bezel: '#1B211A',
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
 *    board post text, "your turn" tags. Never buttons, labels or dense UI.
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
 * Washi-tape colours, as palette *tokens* rather than hexes.
 *
 * `announcements.tape_color` stores one of these strings. Storing '#E8B94A'
 * instead would mean a data migration every time the palette is re-tuned —
 * and it has been re-tuned once already — leaving old notes wearing a colour
 * no card on screen uses any more.
 */
export const TAPE_TOKENS: readonly TapeColor[] = ['mustard', 'sage', 'brick', 'moss'];

export const TAPE_HEX: Record<TapeColor, string> = {
  mustard: colors.mustard,
  sage: colors.sage,
  brick: colors.brick,
  moss: colors.moss.light,
};

function isTapeToken(value: string): value is TapeColor {
  return (TAPE_TOKENS as readonly string[]).includes(value);
}

/**
 * The tape a note wears: whatever its author chose, or — for the notes written
 * before the column existed — a stable colour derived from its id, so a note
 * keeps the same tape between renders.
 */
export function tapeColorFor(seed: string, token?: string | null): string {
  if (token && isTapeToken(token)) return TAPE_HEX[token];

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100_000;
  }
  return TAPE_HEX[TAPE_TOKENS[hash % TAPE_TOKENS.length]];
}

/**
 * Caps for `maxFontSizeMultiplier`, by the kind of box the text sits in.
 *
 * The default is *no cap*: body copy, headings, card titles, hints and empty
 * states all grow with the reader's text size, which is the whole point of the
 * setting. These exist only for text inside a box that physically cannot grow
 * with it — where the alternative isn't bigger text, it's clipped text.
 *
 * Anything capped here has to carry its meaning somewhere else as well: the
 * week strip spells each day out in its accessibility label, the tab bar keeps
 * its icons, the swipe panels keep their glyphs, and an avatar's initials are
 * always sitting beside the name they stand for.
 */
export const textCap = {
  /** Cannot grow at all — a count inside an 18pt badge. */
  fixed: 1,
  /** One of N cells sharing a row's width: the week strip, the day grid. */
  grid: 1.2,
  /** A label inside a control that can stretch a little: chips, swipe panels. */
  control: 1.3,
  /** A label riding inline beside body text: pills, the "your turn" tag. */
  inline: 1.5,
} as const;

/** Android ripples, which want a translucent version of the surface tint. */
export const ripple = {
  moss: '#2F3D2C20',
  card: '#2F3D2C12',
  light: '#FFFFFF30',
} as const;
