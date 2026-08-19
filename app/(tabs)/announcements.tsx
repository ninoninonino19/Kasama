import { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { deleteAnnouncement } from '../../src/api/announcements';
import { Avatar } from '../../src/components/ui/Avatar';
import { NoteCard } from '../../src/components/ui/NoteCard';
import { Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { ListSkeleton } from '../../src/components/ui/Skeleton';
import { EmptyState, ErrorState, InlineError } from '../../src/components/ui/States';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { useAnnouncements } from '../../src/hooks/useHouseholdData';
import { useRefreshOnFocus } from '../../src/hooks/useRefreshOnFocus';
import { formatTimeAgo } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { colors, tapeColorFor } from '../../src/lib/theme';
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
    Alert.alert('Take this note down?', 'Hindi na ito makikita ng iba.', [
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
      <ScreenHeader title="Board" subtitle={household?.name ?? undefined} />

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
          contentContainerClassName="gap-4 px-5 pb-4 pt-2"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.moss.DEFAULT}
            />
          }
          renderItem={({ item, index }) => {
            const name = item.profile?.display_name ?? 'Housemate';
            const canDelete = item.user_id === userId || role === 'admin';

            return (
              <NoteCard
                // The schema has no tape colour, so it is hashed from the note's
                // id: stable for the life of the post, and no two adjacent notes
                // reliably match. See the README note on making it a column.
                tape={tapeColorFor(item.id)}
                rotate={index % 2 === 0 ? -0.5 : 0.5}
                className="pt-5"
              >
                <View className="flex-row items-center gap-3">
                  <Avatar
                    name={name}
                    userId={item.user_id}
                    avatarUrl={item.profile?.avatar_url}
                    size={36}
                  />
                  <View className="flex-1">
                    <Text className="font-ui-bold text-sm text-ink" numberOfLines={1}>
                      {name}
                      {item.user_id === userId ? ' (you)' : ''}
                    </Text>
                    <Text className="font-mono text-[11px] text-ink-muted">
                      {formatTimeAgo(item.created_at)}
                    </Text>
                  </View>
                  {canDelete ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Take down the note from ${name}`}
                      hitSlop={12}
                      onPress={() => confirmDelete(item.id)}
                      // 44pt tap area around a visually small control.
                      className="h-11 w-11 items-center justify-center rounded-full active:bg-page"
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.ink.muted} />
                    </Pressable>
                  ) : null}
                </View>
                {/* The whole point of the board: a note in someone's hand. */}
                <Text className="mt-2 font-hand text-2xl leading-8 text-ink">{item.content}</Text>
              </NoteCard>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="reader-outline"
              title="Tahimik pa dito"
              message="Pin the first note — reminders sa bayad, bisita, o kung sino ang mag-aayos ng WiFi."
              actionLabel="Write one"
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
 * It is a button dressed as a blank note rather than a live text field: writing
 * happens on the full-screen composer, which has room for a few lines and
 * doesn't have to share the bottom of the screen with the tab bar once the
 * keyboard is up. Tapping anywhere along the bar goes straight there, which is
 * a bigger and more obvious target than a floating button.
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
    <View className="border-t border-line bg-paper px-4 py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Write a note"
        onPress={() => {
          haptics.tap();
          onPress();
        }}
        className="min-h-[48px] flex-row items-center gap-3 rounded-full border border-line bg-page py-2 pl-2 pr-2 active:opacity-80"
      >
        <Avatar name={name} userId={userId} avatarUrl={avatarUrl} size={32} ring={false} />
        <Text className="flex-1 font-hand text-xl text-ink-muted" numberOfLines={1}>
          Ano'ng balita sa bahay?
        </Text>
        <View className="h-9 w-9 items-center justify-center rounded-full bg-moss">
          <Ionicons name="create" size={16} color={colors.paper} />
        </View>
      </Pressable>
    </View>
  );
}
