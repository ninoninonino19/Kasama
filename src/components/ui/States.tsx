import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { press } from '../../lib/motion';
import { colors } from '../../lib/theme';
import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 py-16">
      <ActivityIndicator color={colors.moss.DEFAULT} />
      <Text className="font-ui text-sm text-ink-muted">{label}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View className="items-center gap-3 rounded-xl border border-brick/30 bg-wash-brick p-6">
      <Ionicons name="cloud-offline-outline" size={28} color={colors.deep.brick} />
      <Text className="text-center font-ui-bold text-base text-deep-brick">
        Couldn't load this
      </Text>
      <Text className="text-center font-ui text-sm text-deep-brick">{message}</Text>
      {onRetry ? (
        <Button label="Try again" variant="secondary" size="md" onPress={onRetry} className="mt-1" />
      ) : null}
    </View>
  );
}

type EmptyStateProps = {
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * One-line version for places where an empty section sits next to sections
   * that do have content — three full-height dashed boxes stacked down the
   * dashboard read as a broken screen rather than a fresh one.
   */
  compact?: boolean;
};

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  if (compact) {
    const body = (
      <View className="min-h-[64px] flex-row items-center gap-3 rounded-xl border border-dashed border-line bg-paper/70 px-4 py-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-wash-sage">
          <Ionicons name={icon} size={18} color={colors.moss.DEFAULT} />
        </View>
        <View className="flex-1">
          <Text className="font-ui-bold text-sm text-ink">{title}</Text>
          <Text className="mt-0.5 font-ui text-xs leading-4 text-ink-muted" numberOfLines={2}>
            {message}
          </Text>
        </View>
        {onAction ? <Ionicons name="add-circle" size={22} color={colors.moss.light} /> : null}
      </View>
    );

    if (!onAction) return body;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel ?? title}
        onPress={onAction}
        className={`${press} active:opacity-80`}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View className="items-center gap-3 rounded-2xl border border-dashed border-line bg-paper/70 px-6 py-10">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-wash-sage">
        <Ionicons name={icon} size={26} color={colors.moss.DEFAULT} />
      </View>
      {/* The one handwritten line on an otherwise quiet screen — an empty
          board should feel like a blank note, not an error. */}
      <Text className="text-center font-hand-bold text-2xl leading-7 text-ink">{title}</Text>
      <Text className="text-center font-ui text-sm leading-5 text-ink-muted">{message}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} size="md" onPress={onAction} className="mt-2 px-6" />
      ) : null}
    </View>
  );
}

/** Thin banner for errors that shouldn't replace already-loaded content. */
export function InlineError({ message }: { message: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg bg-wash-brick px-3 py-2">
      <Ionicons name="alert-circle-outline" size={16} color={colors.deep.brick} />
      <Text className="flex-1 font-ui text-sm text-deep-brick">{message}</Text>
    </View>
  );
}
