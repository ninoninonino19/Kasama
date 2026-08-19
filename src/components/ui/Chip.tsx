import { Pressable, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { haptics } from '../../lib/haptics';
import { Pill } from './Pill';
import type { PillTone } from './Pill';

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
      <Text
        className={`font-ui-semibold text-sm ${selected ? 'text-paper' : 'text-ink-soft'}`}
      >
        {label}
      </Text>
      {typeof count === 'number' ? (
        // A count on the filter itself saves a tap to find out a tab is empty.
        <View
          className={`min-w-[20px] items-center rounded-full px-1.5 py-0.5 ${
            selected ? 'bg-paper/25' : 'bg-page'
          }`}
        >
          <Text
            className={`font-ui-bold text-[11px] ${selected ? 'text-paper' : 'text-ink-muted'}`}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </View>
  );

  // min-h-11 keeps every chip at the 44pt minimum touch target.
  const className = `min-h-11 items-center justify-center rounded-full border px-4 py-2 ${
    selected ? 'border-moss bg-moss' : 'border-line bg-paper'
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

/** The pre-redesign tone names, still used by the screens outside the brief. */
const LEGACY_TONES: Record<BadgeTone, PillTone> = {
  neutral: 'muted',
  success: 'ok',
  warning: 'warn',
  danger: 'alert',
  brand: 'strong',
};

/**
 * Compatibility wrapper around {@link Pill}.
 *
 * Auth, onboarding, settings and the bill detail screen are outside the design
 * brief but still show status badges; rather than leave a second badge
 * implementation drifting alongside the new one, `Badge` just translates the
 * old tone names and hands off. New code should use `Pill` directly.
 */
export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: BadgeTone | PillTone;
  icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  const resolved = tone in LEGACY_TONES ? LEGACY_TONES[tone as BadgeTone] : (tone as PillTone);
  return <Pill label={label} tone={resolved} icon={icon} />;
}
