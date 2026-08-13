import { Platform, Pressable, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { haptics } from '../../lib/haptics';
import { colors, ripple } from '../../lib/theme';

/**
 * Floating action button pinned to the bottom-right.
 *
 * The primary action used to live in the screen header, which on a 6"+ phone
 * sits outside comfortable thumb reach when holding the device one-handed.
 * Down here it is the easiest thing on screen to hit.
 */
export function Fab({
  icon = 'add',
  label,
  onPress,
  accessibilityLabel,
}: {
  icon?: ComponentProps<typeof Ionicons>['name'];
  label?: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-5 right-5"
      style={{
        // Lifted off the surface so it reads as floating above the list.
        shadowColor: colors.brand[700],
        shadowOpacity: 0.28,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          haptics.tap();
          onPress();
        }}
        android_ripple={{ color: ripple.light, borderless: false }}
        // 56dp is the platform minimum for a comfortable primary target.
        className={`h-14 flex-row items-center justify-center rounded-full bg-brand-500 active:bg-brand-600 ${
          label ? 'gap-2 px-5' : 'w-14'
        }`}
        style={Platform.OS === 'android' ? { overflow: 'hidden' } : undefined}
      >
        <Ionicons name={icon} size={26} color={colors.white} />
        {label ? <Text className="pr-1 text-base font-bold text-white">{label}</Text> : null}
      </Pressable>
    </View>
  );
}
