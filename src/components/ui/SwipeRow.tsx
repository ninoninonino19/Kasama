import { useRef } from 'react';
import { Text, View } from 'react-native';
import type { ComponentProps, ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable, {
  SwipeDirection,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { colors, textCap } from '../../lib/theme';

type Tone = 'moss' | 'muted';

export type SwipeActionConfig = {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  tone: Tone;
  onTrigger: () => void;
};

/** Wide enough for a glyph and a one-word label at the default text size. */
const PANEL_WIDTH = 92;

const TONE_BG: Record<Tone, string> = {
  moss: 'bg-moss',
  muted: 'bg-ink-muted',
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
      className={`items-center justify-center rounded-xl ${TONE_BG[action.tone]}`}
      style={{ width: PANEL_WIDTH }}
    >
      <Ionicons name={action.icon} size={22} color={colors.paper} />
      <Text
        className="mt-1 px-1 text-center font-ui-bold text-[11px] text-paper"
        numberOfLines={1}
        // PANEL_WIDTH is fixed, and the glyph above already names the action.
        maxFontSizeMultiplier={textCap.control}
      >
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
