import { Easing, ReduceMotion } from 'react-native-reanimated';

/**
 * The motion half of the design system.
 *
 * `theme.ts` is the single source for colour; this is the single source for
 * timing, and it exists for the same reason — five hand-typed curves that
 * almost match read as five different apps. Everything that moves in Kasama
 * uses a value from this file, whether it is expressed as a Tailwind class
 * (`tailwind.config.js` carries the same two curves) or driven from JS.
 *
 * The rules the values encode:
 *
 *  - **Nothing high-frequency animates.** The tab rail switches instantly and
 *    always will: four tabs tapped dozens of times a day are peers, and a
 *    transition there is a tax paid on every single switch.
 *  - **Press feedback is felt, not watched** — 100ms, small, and it starts on
 *    press-*in*. Waiting for the tap to complete is the latency people
 *    actually perceive.
 *  - **UI motion stays under 300ms.** The only thing here that runs longer is
 *    the progress fill, which is a value being read rather than a control
 *    responding.
 *  - **Reduced motion ships with the animation, not after it.** Every entrance
 *    and layout transition below carries `ReduceMotion.System`, so the system
 *    setting drops the movement while the opacity and colour changes — the
 *    part that explains what happened — stay.
 */

/**
 * `ease-in` never appears: it starts slow, delaying the exact moment the user
 * is watching. Reanimated's built-in `Easing.out(Easing.quad)` is as weak as
 * CSS's, so both curves here are the deliberate versions.
 */
export const easing = {
  /** Entrances, exits, and anything responding to a touch. */
  out: Easing.bezier(0.23, 1, 0.32, 1),
  /** Something moving or morphing while it stays on screen. */
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
} as const;

export const duration = {
  /** Press feedback. Felt rather than seen. */
  press: 100,
  /** A checkbox filling, a colour changing, a small state flip. */
  state: 150,
  /** A card arriving or leaving, a list closing the gap behind one. */
  panel: 240,
  /** A progress fill travelling to a new value — read, not reacted to. */
  fill: 320,
} as const;

/**
 * Apple's two designer parameters, which is the form Reanimated's spring
 * takes directly. Bounce is reserved for the one moment that earns it: a
 * chore being ticked off is the payoff the whole screen is built around.
 */
export const spring = {
  /** Default settle. No overshoot. */
  settle: { duration: 400, dampingRatio: 1, reduceMotion: ReduceMotion.System },
  /** A little overshoot, for a completion worth celebrating. */
  pop: { duration: 350, dampingRatio: 0.72, reduceMotion: ReduceMotion.System },
} as const;

/**
 * Press feedback as a class string, so every tappable surface in the app dips
 * by the same amount over the same 100ms.
 *
 * NativeWind compiles `transition-*` to a Reanimated shared value, so this
 * runs on the UI thread and costs no React render — the same mechanism a
 * hand-written `useAnimatedStyle` would use, without the wiring.
 *
 * Two things to keep in mind when using these:
 *
 *  - The transition class has to be on the element from its first render.
 *    NativeWind upgrades a component to an animated one once, and adding a
 *    transition later remounts it.
 *  - A `style` prop carrying its own `transform` array wins over the class,
 *    which silently kills the scale. `NoteCard` puts its pin-skew on a wrapper
 *    for exactly this reason.
 */
const PRESS_BASE = 'transition-transform duration-100 ease-out-strong';

/** The default: cards, buttons, rows, anything with a surface. */
export const press = `${PRESS_BASE} active:scale-[0.97]`;
/** Chips, day cells, icon buttons — small targets, so a smaller dip. */
export const pressSmall = `${PRESS_BASE} active:scale-[0.96]`;
/** The FAB. Big, round, and the most-pressed thing on a list screen. */
export const pressLarge = `${PRESS_BASE} active:scale-[0.94]`;

/**
 * A finger that drifts a few pixels mid-press meant to press. Without this the
 * press cancels, the surface springs back, and the tap does nothing — which
 * reads as the app missing the tap rather than as the user moving.
 */
export const pressRetention = { top: 8, bottom: 8, left: 8, right: 8 } as const;
