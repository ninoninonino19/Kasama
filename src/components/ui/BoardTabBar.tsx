import { Pressable, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '../../lib/haptics';
import { colors, textCap } from '../../lib/theme';

export type TabBadge = { count?: number; dot?: boolean; label: string };

/**
 * The board's bottom rail.
 *
 * Selection is a soft pill behind the icon plus a colour change, not a full
 * swap of the bar's fill — the four tabs are meant to read as one strip of
 * paper with one of them currently lifted, and a solid active block makes the
 * bar look like it belongs to a different app on every tab change.
 *
 * The filled-vs-outline glyph is still supplied by the layout, so the active
 * tab never rests on hue alone.
 */
export function BoardTabBar({
  state,
  descriptors,
  navigation,
  badges = {},
}: BottomTabBarProps & { badges?: Record<string, TabBadge | undefined> }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row border-t border-line bg-paper px-2 pt-2"
      // The rail sits above the home indicator; 10 is the floor on hardware
      // that reports no bottom inset at all.
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = options.title ?? route.name;
        const tint = focused ? colors.moss.DEFAULT : colors.ink.muted;
        const badge = badges[route.name];

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            // The badge is part of what this tab says, so it belongs in the
            // label a screen reader announces rather than only in the paint.
            accessibilityLabel={
              badge && !(focused && badge.dot) ? `${label}, ${badge.label}` : label
            }
            onPress={() => {
              haptics.select();
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            className="min-h-[52px] flex-1 items-center justify-center gap-1 py-1"
          >
            <View
              className={`h-8 w-16 items-center justify-center rounded-full ${
                focused ? 'bg-wash-sage' : ''
              }`}
            >
              {options.tabBarIcon?.({ focused, color: tint, size: 22 })}
              {/* A dot means "something here you haven't seen", so it has no
                  business on the tab you are currently looking at — without
                  this, a note arriving while you read the board lights the dot
                  on the board's own tab until you leave it. A count is a
                  different claim ("three bills are late") and stays put. */}
              {badge && !(focused && badge.dot) ? <Badge badge={badge} /> : null}
            </View>
            <Text
              className={`text-[11px] ${focused ? 'font-ui-bold text-moss' : 'font-ui text-ink-muted'}`}
              numberOfLines={1}
              // Tab labels can't wrap and can't shrink the rail, so they stop
              // growing before they'd start clipping. The icon above carries
              // the same meaning either way.
              maxFontSizeMultiplier={textCap.grid}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Two shapes rather than one: a count where the number is the point ("three
 * bills are late") and a plain dot where it isn't ("something new on the
 * board"). A board dot showing "7" would invite you to clear it like an inbox,
 * which is not what a house board is for.
 */
function Badge({ badge }: { badge: TabBadge }) {
  if (badge.dot) {
    return (
      <View
        // Hidden from screen readers: the tab's own label already says it.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="absolute right-3 top-0.5 h-2.5 w-2.5 rounded-full border border-paper bg-mustard"
      />
    );
  }

  if (!badge.count) return null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      // Tucked against the glyph rather than the pill's far edge — the pill is
      // 64 wide and the icon only 22, so a badge pinned right floats alone.
      className="absolute right-2 -top-1 min-w-[18px] items-center justify-center rounded-full border border-paper bg-brick px-1"
    >
      <Text className="font-ui-bold text-[10px] leading-4 text-paper" maxFontSizeMultiplier={textCap.fixed}>
        {badge.count > 9 ? '9+' : badge.count}
      </Text>
    </View>
  );
}
