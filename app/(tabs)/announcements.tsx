import { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { deleteAnnouncement } from '../../src/api/announcements';
import { Avatar } from '../../src/components/ui/Avatar';
import { Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { ListSkeleton } from '../../src/components/ui/Skeleton';
import { EmptyState, ErrorState, InlineError } from '../../src/components/ui/States';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { useAnnouncements } from '../../src/hooks/useHouseholdData';
import { useRefreshOnFocus } from '../../src/hooks/useRefreshOnFocus';
import { formatTimeAgo } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { colors } from '../../src/lib/theme';
import { useCurrentUserId, useHousehold, useProfile, useSessionStore } from '../../src/store/useSessionStore';

export default function AnnouncementsScreen() {
  const router = useRouter();
  const household = useHousehold();
  const profile = useProfile();
  const userId = useCurrentUserId();
  const role = useSessionStore((state) => state.role);
  const { data, loading, refreshing, error, refresh } = useAnnouncements();

  const [actionError, setActionError] = useState<string | null>(null);

  // Coming back from the compose screen should always show the new post.
  useRefreshOnFocus(refresh);

  const announcements = data ?? [];

  function confirmDelete(id: string) {
    haptics.tap();
    Alert.alert('Delete this announcement?', 'Hindi na ito makikita ng iba.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAnnouncement(id);
            await refresh({ silent: true });
          } catch (caught) {
            haptics.error();
            setActionError(messageFrom(caught));
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <ScreenHeader title="Feed" subtitle={household?.name ?? undefined} />

      {actionError ? (
        <View className="px-5 pb-2">
          <InlineError message={actionError} />
        </View>
      ) : null}

      {loading ? (
        <ListSkeleton rows={3} />
      ) : error && announcements.length === 0 ? (
        <View className="px-5">
          <ErrorState message={error} onRetry={() => void refresh()} />
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          contentContainerClassName="gap-3 px-5 pb-4"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.brand[500]}
            />
          }
          renderItem={({ item }) => {
            const name = item.profile?.display_name ?? 'Housemate';
            const canDelete = item.user_id === userId || role === 'admin';

            return (
              <View className="rounded-2xl border border-sand-200 bg-white p-4">
                <View className="flex-row items-center gap-3">
                  <Avatar
                    name={name}
                    userId={item.user_id}
                    avatarUrl={item.profile?.avatar_url}
                    size={36}
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-ink" numberOfLines={1}>
                      {name}
                      {item.user_id === userId ? ' (you)' : ''}
                    </Text>
                    <Text className="text-xs text-ink-muted">{formatTimeAgo(item.created_at)}</Text>
                  </View>
                  {canDelete ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete announcement from ${name}`}
                      hitSlop={12}
                      onPress={() => confirmDelete(item.id)}
                      // 44pt tap area around a visually small control.
                      className="h-11 w-11 items-center justify-center rounded-full active:bg-sand-100"
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.ink.muted} />
                    </Pressable>
                  ) : null}
                </View>
                <Text className="mt-3 text-base leading-6 text-ink">{item.content}</Text>
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="megaphone-outline"
              title="Tahimik pa dito"
              message="Post the first announcement — reminders sa bayad, bisita, o kung sino ang mag-aayos ng WiFi."
              actionLabel="Post one"
              onAction={() => router.push('/announcements/new')}
            />
          }
        />
      )}

      <ComposeBar
        name={profile?.display_name ?? 'You'}
        userId={userId ?? 'me'}
        avatarUrl={profile?.avatar_url}
        onPress={() => router.push('/announcements/new')}
      />
    </Screen>
  );
}

/**
 * Compose affordance pinned under the feed, where a chat app puts it.
 *
 * It is a button dressed as an input rather than a live text field: writing
 * happens on the full-screen composer, which has room for a few lines and
 * doesn't have to share the bottom of the screen with the tab bar once the
 * keyboard is up. Tapping anywhere along the bar goes straight there, which is
 * a bigger and more obvious target than the floating button it replaces.
 */
function ComposeBar({
  name,
  userId,
  avatarUrl,
  onPress,
}: {
  name: string;
  userId: string;
  avatarUrl?: string | null;
  onPress: () => void;
}) {
  return (
    <View className="border-t border-sand-200 bg-white px-4 py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Post an announcement"
        onPress={() => {
          haptics.tap();
          onPress();
        }}
        className="min-h-[48px] flex-row items-center gap-3 rounded-full border border-sand-300 bg-sand-50 py-2 pl-2 pr-2 active:bg-sand-100"
      >
        <Avatar name={name} userId={userId} avatarUrl={avatarUrl} size={32} />
        <Text className="flex-1 text-sm text-ink-muted" numberOfLines={1}>
          Ano'ng balita sa bahay?
        </Text>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-brand-500">
          <Ionicons name="send" size={16} color={colors.white} />
        </View>
      </Pressable>
    </View>
  );
}
