import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { haptics } from '../../lib/haptics';
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
      className={`flex-row items-center justify-center rounded-xl ${
        size === 'lg' ? 'h-14 px-6' : 'h-11 px-4'
      } ${CONTAINER[variant]} ${isDisabled ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={ICON[variant]} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon ? (
            <Ionicons name={icon} size={size === 'lg' ? 20 : 18} color={ICON[variant]} />
          ) : null}
          <Text
            className={`font-ui-bold ${LABEL[variant]} ${size === 'lg' ? 'text-base' : 'text-sm'}`}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
