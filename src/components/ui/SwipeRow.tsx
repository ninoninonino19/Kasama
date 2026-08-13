import { useRef } from 'react';
import { Text, View } from 'react-native';
import type { ComponentProps, ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable, {
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { colors } from '../../lib/theme';

type Tone = 'brand' | 'sand';

export type SwipeActionConfig = {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  tone: Tone;
  onTrigger: () => void;
};

/** Wide enough for a glyph and a one-word label at the default text size. */
const PANEL_WIDTH = 92;

const TONE_BG: Record<Tone, string> = {
  brand: 'bg-brand-500',
  sand: 'bg-sand-400',
};

/**
 * Row wrapper that adds a swipe shortcut beside the row's own tap target.
 *
 * Tapping stays the primary way to do the thing — this is the secondary
 * gesture the brief asks for, so it never carries an action you can't reach
 * any other way. Releasing past the threshold fires the action and snaps shut
 * instead of parking the row open, which keeps a half-open row from sitting
 * there covering the content behind it.
 */
export function SwipeRow({
  children,
  left,
  right,
  enabled = true,
}: {
  children: ReactNode;
  /** Revealed by swiping right — the affirmative action (done, paid). */
  left?: SwipeActionConfig;
  /** Revealed by swiping left — the undo side. */
  right?: SwipeActionConfig;
  enabled?: boolean;
}) {
  const swipeable = useRef<SwipeableMethods>(null);

  if (!enabled || (!left && !right)) return <>{children}</>;

  const panel = (action: SwipeActionConfig) => (
    <View
      className={`items-center justify-center rounded-2xl ${TONE_BG[action.tone]}`}
      style={{ width: PANEL_WIDTH }}
    >
      <Ionicons name={action.icon} size={22} color={colors.white} />
      <Text className="mt-1 px-1 text-center text-[11px] font-bold text-white" numberOfLines={1}>
        {action.label}
      </Text>
    </View>
  );

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      overshootFriction={8}
      leftThreshold={PANEL_WIDTH * 0.55}
      rightThreshold={PANEL_WIDTH * 0.55}
      enableTrackpadTwoFingerGesture
      renderLeftActions={left ? () => panel(left) : undefined}
      renderRightActions={right ? () => panel(right) : undefined}
      onSwipeableWillOpen={(direction) => {
        // `direction` is the direction of the swipe, so a rightward swipe is
        // the one that reveals the left-hand panel.
        const action = direction === SwipeDirection.RIGHT ? left : right;
        if (!action) return;
        swipeable.current?.close();
        action.onTrigger();
      }}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
