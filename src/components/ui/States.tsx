import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../lib/theme';
import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 py-16">
      <ActivityIndicator color={colors.brand[500]} />
      <Text className="text-sm text-ink-muted">{label}</Text>
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
    <View className="items-center gap-3 rounded-2xl border border-coral-200 bg-coral-50 p-6">
      <Ionicons name="cloud-offline-outline" size={28} color={colors.coral[600]} />
      <Text className="text-center text-base font-semibold text-coral-700">
        Hindi ma-load — something went wrong
      </Text>
      <Text className="text-center text-sm text-coral-700">{message}</Text>
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
      <View className="min-h-[64px] flex-row items-center gap-3 rounded-2xl border border-dashed border-sand-300 bg-white/60 px-4 py-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-100">
          <Ionicons name={icon} size={18} color={colors.brand[600]} />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-ink">{title}</Text>
          <Text className="mt-0.5 text-xs leading-4 text-ink-muted" numberOfLines={2}>
            {message}
          </Text>
        </View>
        {onAction ? <Ionicons name="add-circle" size={22} color={colors.brand[500]} /> : null}
      </View>
    );

    if (!onAction) return body;

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel ?? title}
        onPress={onAction}
        className="active:opacity-80"
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View className="items-center gap-3 rounded-3xl border border-dashed border-sand-300 bg-white/70 px-6 py-10">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-100">
        <Ionicons name={icon} size={26} color={colors.brand[600]} />
      </View>
      <Text className="text-center text-base font-semibold text-ink">{title}</Text>
      <Text className="text-center text-sm leading-5 text-ink-muted">{message}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} size="md" onPress={onAction} className="mt-2 px-6" />
      ) : null}
    </View>
  );
}

/** Thin banner for errors that shouldn't replace already-loaded content. */
export function InlineError({ message }: { message: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl bg-coral-50 px-3 py-2">
      <Ionicons name="alert-circle-outline" size={16} color={colors.coral[600]} />
      <Text className="flex-1 text-sm text-coral-700">{message}</Text>
    </View>
  );
}
