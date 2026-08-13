import { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { deleteAnnouncement } from '../../src/api/announcements';
import { Avatar } from '../../src/components/ui/Avatar';
import { Fab } from '../../src/components/ui/Fab';
import { Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { ListSkeleton } from '../../src/components/ui/Skeleton';
import { EmptyState, ErrorState, InlineError } from '../../src/components/ui/States';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { useAnnouncements } from '../../src/hooks/useHouseholdData';
import { useRefreshOnFocus } from '../../src/hooks/useRefreshOnFocus';
import { formatTimeAgo } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { useCurrentUserId, useHousehold, useSessionStore } from '../../src/store/useSessionStore';

export default function AnnouncementsScreen() {
  const router = useRouter();
  const household = useHousehold();
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
          contentContainerClassName="gap-3 px-5 pb-28"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor="#2FA396"
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
                      <Ionicons name="ellipsis-horizontal" size={18} color="#A99B89" />
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

      <Fab
        icon="create-outline"
        label="Post"
        accessibilityLabel="Post an announcement"
        onPress={() => router.push('/announcements/new')}
      />
    </Screen>
  );
}
