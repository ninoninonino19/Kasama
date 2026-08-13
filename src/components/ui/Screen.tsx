import { Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
  /** Applies safe-area padding on top too. Turn off inside a stack with a header. */
  topInset?: boolean;
  className?: string;
};

export function Screen({ children, topInset = true, className = '' }: Props) {
  return (
    <SafeAreaView
      edges={topInset ? ['top', 'left', 'right'] : ['left', 'right']}
      className={`flex-1 bg-sand-50 ${className}`}
    >
      {children}
    </SafeAreaView>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View className="flex-row items-end justify-between px-5 pb-3 pt-2">
      <View className="flex-1 pr-3">
        <Text className="text-2xl font-bold text-ink">{title}</Text>
        {subtitle ? <Text className="mt-0.5 text-sm text-ink-muted">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <Text className={`mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted ${className}`}>
      {children}
    </Text>
  );
}
