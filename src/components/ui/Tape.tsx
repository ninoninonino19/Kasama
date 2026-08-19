import { View } from 'react-native';

import { colors } from '../../lib/theme';

/**
 * A strip of washi tape pinning a card to the board.
 *
 * Purely decorative, so it is hidden from screen readers and never takes a
 * touch — the card underneath owns the whole tap target. The rotation is
 * deliberately shallow: past about 6° the strip stops reading as tape and
 * starts reading as a layout bug.
 */
export function Tape({
  color = colors.mustard,
  /** Degrees of skew. Negative leans the strip up to the left. */
  rotate = -4,
  /** Sits at the card's top-left by default; `center` suits wide summary cards. */
  align = 'left',
}: {
  color?: string;
  rotate?: number;
  align?: 'left' | 'center';
}) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`absolute -top-2 h-5 w-16 rounded-[3px] ${
        align === 'center' ? 'left-1/2 -ml-8' : 'left-4'
      }`}
      style={{
        backgroundColor: color,
        // Tape is translucent — you can see the paper grain through it.
        opacity: 0.9,
        transform: [{ rotate: `${rotate}deg` }],
      }}
    />
  );
}
