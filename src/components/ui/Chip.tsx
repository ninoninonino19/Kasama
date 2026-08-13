import { Pressable, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../lib/theme';
import { haptics } from '../../lib/haptics';

type ChipProps = {
  label: string;
  /** Small trailing count, e.g. the number of bills behind a filter. */
  count?: number;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, count, selected = false, onPress }: ChipProps) {
  const content = (
    <View className="flex-row items-center gap-1.5">
      <Text className={`text-sm font-semibold ${selected ? 'text-white' : 'text-ink-soft'}`}>
        {label}
      </Text>
      {typeof count === 'number' ? (
        // A count on the filter itself saves a tap to find out a tab is empty.
        <View
          className={`min-w-[20px] items-center rounded-full px-1.5 py-0.5 ${
            selected ? 'bg-white/25' : 'bg-sand-200'
          }`}
        >
          <Text
            className={`text-[11px] font-bold ${selected ? 'text-white' : 'text-ink-muted'}`}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </View>
  );

  // min-h-11 keeps every chip at the 44pt minimum touch target.
  const className = `min-h-11 items-center justify-center rounded-full border px-4 py-2 ${
    selected ? 'border-brand-500 bg-brand-500' : 'border-sand-300 bg-white'
  }`;

  if (!onPress) return <View className={className}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={typeof count === 'number' ? `${label}, ${count}` : label}
      onPress={() => {
        haptics.select();
        onPress();
      }}
      className={`${className} active:opacity-80`}
    >
      {content}
    </Pressable>
  );
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

const TONES: Record<BadgeTone, { bg: string; fg: string; icon: string }> = {
  neutral: { bg: 'bg-sand-100', fg: 'text-ink-muted', icon: colors.ink.muted },
  success: { bg: 'bg-brand-100', fg: 'text-brand-700', icon: colors.brand[700] },
  warning: { bg: 'bg-amber-100', fg: 'text-amber-700', icon: colors.amber[700] },
  danger: { bg: 'bg-coral-100', fg: 'text-coral-700', icon: colors.coral[700] },
  brand: { bg: 'bg-brand-500', fg: 'text-white', icon: colors.white },
};

/**
 * Status pill. `icon` matters as much as the tone here: the brief asks that
 * status never rides on colour alone, so "Paid" carries a checkmark and
 * "Overdue" an alert glyph for anyone who can't tell the two fills apart.
 */
export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  const style = TONES[tone];

  return (
    <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${style.bg}`}>
      {icon ? <Ionicons name={icon} size={12} color={style.icon} /> : null}
      <Text className={`text-xs font-bold ${style.fg}`}>{label}</Text>
    </View>
  );
}
