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
    <View pointerEvents="box-none" className="absolute bottom-5 right-5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          haptics.tap();
          onPress();
        }}
        android_ripple={{ color: ripple.light, borderless: false }}
        // 56dp is the platform minimum for a comfortable primary target.
        className={`h-14 flex-row items-center justify-center rounded-full bg-moss active:bg-bezel ${
          label ? 'gap-2 px-5' : 'w-14'
        }`}
        style={{
          // Lifted off the surface so it reads as floating above the list.
          //
          // On the button itself, not a wrapper around it. Android draws an
          // elevated view's own background as the lifted surface, so elevation
          // on a transparent wrapper painted a light rectangle behind the
          // circle — the white box behind the add button. Here the elevated
          // view is the moss pill, and its rounded shape is what lifts.
          shadowColor: colors.bezel,
          shadowOpacity: 0.24,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
          backgroundColor: colors.moss.DEFAULT,
          ...(Platform.OS === 'android' ? { overflow: 'hidden' as const } : null),
        }}
      >
        <Ionicons name={icon} size={26} color={colors.paper} />
        {label ? <Text className="pr-1 font-ui-bold text-base text-paper">{label}</Text> : null}
      </Pressable>
    </View>
  );
}
