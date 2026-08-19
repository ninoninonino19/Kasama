import { Pressable, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '../../lib/haptics';
import { colors } from '../../lib/theme';

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
export function BoardTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
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

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
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
            </View>
            <Text
              className={`text-[11px] ${focused ? 'font-ui-bold text-moss' : 'font-ui text-ink-muted'}`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
