import { ActivityIndicator, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 py-16">
      <ActivityIndicator color="#2FA396" />
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
      <Ionicons name="cloud-offline-outline" size={28} color="#D64827" />
      <Text className="text-center text-base font-semibold text-coral-700">
        Hindi ma-load — something went wrong
      </Text>
      <Text className="text-center text-sm text-coral-600">{message}</Text>
      {onRetry ? (
        <Button label="Try again" variant="secondary" size="md" onPress={onRetry} className="mt-1" />
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="items-center gap-3 rounded-3xl border border-dashed border-sand-300 bg-white/70 px-6 py-10">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-100">
        <Ionicons name={icon} size={26} color="#218578" />
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
      <Ionicons name="alert-circle-outline" size={16} color="#D64827" />
      <Text className="flex-1 text-sm text-coral-700">{message}</Text>
    </View>
  );
}
