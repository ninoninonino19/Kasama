import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { haptics } from '../../lib/haptics';
import { press, pressRetention } from '../../lib/motion';
import { colors, ripple } from '../../lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  className?: string;
};

const CONTAINER: Record<Variant, string> = {
  primary: 'bg-moss active:bg-bezel',
  secondary: 'bg-paper border border-line active:bg-page',
  ghost: 'bg-transparent active:bg-page',
  danger: 'bg-wash-brick border border-brick/30 active:bg-wash-brick/70',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-paper',
  secondary: 'text-ink',
  ghost: 'text-moss',
  danger: 'text-deep-brick',
};

const ICON: Record<Variant, string> = {
  primary: colors.paper,
  secondary: colors.moss.DEFAULT,
  ghost: colors.moss.DEFAULT,
  danger: colors.deep.brick,
};

/**
 * Disabled is its own look, not a faded version of the enabled one.
 *
 * Every variant used to render at `opacity-50`. On the moss primary that
 * produces a washed olive that reads as a button someone got the colour wrong
 * on rather than one that is waiting for you — and the buttons it happens to
 * most are the ones that open disabled: Continue on the welcome screen, Create
 * household, Join household. Those are the first three buttons anyone sees, so
 * the app's first impression was a mis-painted control.
 *
 * `page` is already the design system's word for a recessed surface, so a
 * disabled button sits in it with muted ink on top — visibly inert, visibly
 * deliberate — and the moss comes back the moment the form is valid. Ghost
 * keeps its transparent background either way: filling it in would give a
 * button that has no surface one to say it can't be pressed.
 */
const DISABLED: Record<Variant, string> = {
  primary: 'bg-page border border-line',
  secondary: 'bg-page border border-line',
  ghost: 'bg-transparent',
  danger: 'bg-page border border-line',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  icon,
  className = '',
}: Props) {
  const isDisabled = disabled || loading;
  // Loading keeps the enabled colours. The action is under way, not
  // unavailable, and greying it out mid-press reads as the tap being rejected.
  const inert = disabled && !loading;
  const containerClass = inert ? DISABLED[variant] : CONTAINER[variant];
  const labelClass = inert ? 'text-ink-muted' : LABEL[variant];
  const iconTint = inert ? colors.ink.muted : ICON[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      android_ripple={{ color: variant === 'primary' ? ripple.light : ripple.moss }}
      // A press that starts a few pixels from where it ends is still a press.
      pressRetentionOffset={pressRetention}
      // The dip is on the button, not the label, so the icon and text travel
      // with it — that's what makes it read as a physical surface rather than
      // a colour swap. `press` also carries the transition, which NativeWind
      // has to see on the first render, so it is never conditional.
      className={`flex-row items-center justify-center rounded-xl ${press} ${
        size === 'lg' ? 'h-14 px-6' : 'h-11 px-4'
      } ${containerClass} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={ICON[variant]} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon ? <Ionicons name={icon} size={size === 'lg' ? 20 : 18} color={iconTint} /> : null}
          <Text className={`font-ui-bold ${labelClass} ${size === 'lg' ? 'text-base' : 'text-sm'}`}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
