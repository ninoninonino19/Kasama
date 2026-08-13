import { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { deleteAnnouncement, postAnnouncement } from '../../src/api/announcements';
import { Avatar } from '../../src/components/ui/Avatar';
import { Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { EmptyState, ErrorState, InlineError, LoadingState } from '../../src/components/ui/States';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { useAnnouncements } from '../../src/hooks/useHouseholdData';
import { formatTimeAgo } from '../../src/lib/format';
import { useCurrentUserId, useHousehold, useSessionStore } from '../../src/store/useSessionStore';

const MAX_LENGTH = 500;

export default function AnnouncementsScreen() {
  const household = useHousehold();
  const userId = useCurrentUserId();
  const role = useSessionStore((state) => state.role);
  const { data, loading, refreshing, error, refresh } = useAnnouncements();

  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const announcements = data ?? [];
  const canPost = draft.trim().length > 0 && !posting;

  async function handlePost() {
    if (!canPost || !household || !userId) return;
    setPosting(true);
    setPostError(null);
    try {
      await postAnnouncement(household.id, userId, draft);
      setDraft('');
      await refresh({ silent: true });
    } catch (caught) {
      setPostError(messageFrom(caught));
    } finally {
      setPosting(false);
    }
  }

  function confirmDelete(id: string) {
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
            setPostError(messageFrom(caught));
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        className="flex-1"
      >
        <ScreenHeader title="Feed" subtitle={household?.name ?? undefined} />

        {loading ? (
          <LoadingState label="Kinukuha ang feed…" />
        ) : error && announcements.length === 0 ? (
          <View className="px-5">
            <ErrorState message={error} onRetry={() => void refresh()} />
          </View>
        ) : (
          <FlatList
            data={announcements}
            keyExtractor={(item) => item.id}
            contentContainerClassName="gap-3 px-5 pb-4"
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
                      <Text className="text-sm font-bold text-ink">
                        {name}
                        {item.user_id === userId ? ' (you)' : ''}
                      </Text>
                      <Text className="text-xs text-ink-muted">{formatTimeAgo(item.created_at)}</Text>
                    </View>
                    {canDelete ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Delete announcement"
                        hitSlop={8}
                        onPress={() => confirmDelete(item.id)}
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
              />
            }
          />
        )}

        <View className="border-t border-sand-200 bg-white px-4 pb-4 pt-3">
          {postError ? (
            <View className="mb-2">
              <InlineError message={postError} />
            </View>
          ) : null}
          <View className="flex-row items-end gap-2">
            <View className="flex-1 rounded-2xl border border-sand-300 bg-sand-50 px-4 py-2">
              <TextInput
                className="max-h-28 min-h-[36px] text-base text-ink"
                placeholder="Ano'ng balita sa bahay?"
                placeholderTextColor="#A99B89"
                value={draft}
                onChangeText={(value) => setDraft(value.slice(0, MAX_LENGTH))}
                multiline
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Post announcement"
              accessibilityState={{ disabled: !canPost, busy: posting }}
              disabled={!canPost}
              onPress={handlePost}
              className={`h-12 w-12 items-center justify-center rounded-2xl ${
                canPost ? 'bg-brand-500 active:bg-brand-600' : 'bg-sand-300'
              }`}
            >
              <Ionicons name="send" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
          {draft.length > MAX_LENGTH - 100 ? (
            <Text className="mt-1 text-right text-xs text-ink-muted">
              {MAX_LENGTH - draft.length} characters left
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
