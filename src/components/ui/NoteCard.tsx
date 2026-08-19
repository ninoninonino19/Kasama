import { Pressable, View } from 'react-native';
import type { ReactNode } from 'react';

import { colors, ripple } from '../../lib/theme';
import { Tape } from './Tape';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  /**
   * Washi-tape colour. Omit for a plain card — not every surface should be
   * taped, or the board turns into confetti.
   */
  tape?: string | null;
  tapeAlign?: 'left' | 'center';
  /**
   * Degrees of pin-skew. Kept to a fraction of a degree: enough that a stack
   * of cards doesn't read as a table, small enough that text stays crisp.
   */
  rotate?: number;
  className?: string;
};

/**
 * The base surface of the whole design system: a paper-coloured note pinned to
 * the fridge board, optionally with a strip of tape across its top-left corner.
 *
 * The shadow is warm rather than neutral — a pure-black drop shadow against the
 * page's olive canvas looks like a hole rather than lift.
 */
export function NoteCard({
  children,
  onPress,
  tape = null,
  tapeAlign = 'left',
  rotate = 0,
  className = '',
}: Props) {
  const base = `rounded-xl border border-line bg-paper p-4 ${className}`;

  const shadow = {
    shadowColor: colors.bezel,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    ...(rotate === 0 ? null : { transform: [{ rotate: `${rotate}deg` }] }),
  };

  const body = (
    <>
      {tape ? <Tape color={tape} align={tapeAlign} /> : null}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        android_ripple={{ color: ripple.card }}
        className={`${base} active:bg-page`}
        style={shadow}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View className={base} style={shadow}>
      {body}
    </View>
  );
}
