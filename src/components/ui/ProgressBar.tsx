import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { duration, easing } from '../../lib/motion';
import { colors } from '../../lib/theme';

type Tone = 'moss' | 'sage' | 'mustard' | 'brick';

const FILL: Record<Tone, string> = {
  moss: colors.moss.DEFAULT,
  // A finished bar in full moss is the darkest thing on the card, which puts
  // the loudest mark on the one row that needs nothing from you.
  sage: colors.sage,
  mustard: colors.mustard,
  brick: colors.brick,
};

/**
 * Slim "how far along is this" bar. It always sits next to the same count in
 * words ("2 of 3 paid") — on its own a bar is decoration, not information.
 *
 * The fill travels to a new value rather than jumping to it. Marking a share
 * paid is the one place in the app where a number the user just changed is
 * shown back to them as a shape, and a bar that teleports throws that away:
 * you see the new length, but not that it grew, or by how much. 320ms is
 * longer than anything else that moves here, because this is a value being
 * read rather than a control answering a finger.
 *
 * Width, not `scaleX`. Both are one animated property, but scaling a rounded
 * bar smears its end caps into ellipses; and this is the case where width is
 * cheap — a childless view clipped by its track, so nothing else re-lays-out
 * as it grows.
 */
export function ProgressBar({
  ratio,
  tone = 'moss',
  height = 6,
}: {
  ratio: number;
  tone?: Tone;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const reduced = useReducedMotion();

  // Starts at the first value it is given rather than at zero, so a bar that
  // is already half full when the screen opens doesn't fill itself in on
  // arrival — it only moves when the number behind it actually changes.
  const fill = useSharedValue(clamped);

  useEffect(() => {
    fill.set(
      reduced ? clamped : withTiming(clamped, { duration: duration.fill, easing: easing.out })
    );
  }, [clamped, fill, reduced]);

  const style = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="overflow-hidden rounded-full bg-page"
      style={{ height }}
    >
      <Animated.View
        style={[{ height: '100%', borderRadius: 999, backgroundColor: FILL[tone] }, style]}
      />
    </View>
  );
}
