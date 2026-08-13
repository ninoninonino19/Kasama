import { Pressable, View } from 'react-native';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
};

export function Card({ children, onPress, className = '' }: Props) {
  const base = `rounded-2xl border border-sand-200 bg-white p-4 ${className}`;

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} className={`${base} active:bg-sand-50`}>
        {children}
      </Pressable>
    );
  }

  return <View className={base}>{children}</View>;
}
