import { Pressable, View } from 'react-native';
import type { ReactNode } from 'react';

import { press, pressRetention } from '../../lib/motion';
import { ripple } from '../../lib/theme';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
};

export function Card({ children, onPress, className = '' }: Props) {
  const base = `rounded-xl border border-line bg-paper p-4 ${className}`;

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        android_ripple={{ color: ripple.card }}
        pressRetentionOffset={pressRetention}
        className={`${base} ${press} active:bg-page`}
      >
        {children}
      </Pressable>
    );
  }

  return <View className={base}>{children}</View>;
}
