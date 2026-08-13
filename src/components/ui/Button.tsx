import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { haptics } from '../../lib/haptics';

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
  primary: 'bg-brand-500 active:bg-brand-600',
  secondary: 'bg-white border border-sand-300 active:bg-sand-100',
  ghost: 'bg-transparent active:bg-sand-100',
  danger: 'bg-coral-50 border border-coral-200 active:bg-coral-100',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-ink',
  ghost: 'text-brand-600',
  danger: 'text-coral-600',
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
      android_ripple={{ color: variant === 'primary' ? '#ffffff30' : '#2FA39620' }}
      className={`flex-row items-center justify-center rounded-2xl ${
        size === 'lg' ? 'h-14 px-6' : 'h-11 px-4'
      } ${CONTAINER[variant]} ${isDisabled ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : '#218578'} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon ? (
            <Ionicons
              name={icon}
              size={size === 'lg' ? 20 : 18}
              color={variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? '#D64827' : '#218578'}
            />
          ) : null}
          <Text
            className={`${LABEL[variant]} ${size === 'lg' ? 'text-base' : 'text-sm'} font-semibold`}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
