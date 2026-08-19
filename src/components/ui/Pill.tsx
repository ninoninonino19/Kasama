import { Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../lib/theme';

/**
 * The design system names three tones — muted / warn / ok — but Kasama tracks
 * four bill states, and folding "due in two days" into "three weeks past due"
 * loses the one distinction the screen exists to make. `alert` is that fourth
 * tone: brick where `warn` is mustard.
 */
export type PillTone = 'muted' | 'warn' | 'alert' | 'ok';

const TONES: Record<PillTone, { container: string; label: string; icon: string }> = {
  muted: { container: 'bg-page', label: 'text-ink-muted', icon: colors.ink.muted },
  warn: { container: 'bg-wash-mustard', label: 'text-deep-mustard', icon: colors.deep.mustard },
  alert: { container: 'bg-wash-brick', label: 'text-deep-brick', icon: colors.deep.brick },
  ok: { container: 'bg-wash-sage', label: 'text-deep-sage', icon: colors.deep.sage },
};

/**
 * Small status badge — a bill's pending / overdue / paid state, a chore's turn.
 *
 * `icon` matters as much as the tone: nothing in Kasama's status system rides
 * on hue alone, so "Paid" carries a checkmark and "Overdue" an alert glyph for
 * anyone who can't separate mustard from brick.
 */
export function Pill({
  label,
  tone = 'muted',
  icon,
}: {
  label: string;
  tone?: PillTone;
  icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  const style = TONES[tone];

  return (
    <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-1 ${style.container}`}>
      {icon ? <Ionicons name={icon} size={12} color={style.icon} /> : null}
      <Text className={`font-ui-bold text-[11px] ${style.label}`}>{label}</Text>
    </View>
  );
}
