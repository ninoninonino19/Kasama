import { useCallback } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { fetchAnnouncement, updateAnnouncement } from '../../src/api/announcements';
import { NoteComposer } from '../../src/components/NoteComposer';
import { ErrorState, LoadingState } from '../../src/components/ui/States';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import { formatTimeAgo } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { useCurrentUserId } from '../../src/store/useSessionStore';

/**
 * Rewriting your own note.
 *
 * No notification goes out on an edit. The house was already told when the
 * note went up, and buzzing everyone again because someone fixed a typo is
 * how a useful board becomes one people mute.
 */
export default function EditAnnouncementScreen() {
  const router = useRouter();
  const userId = useCurrentUserId();
  const { id } = useLocalSearchParams<{ id: string }>();

  const load = useCallback(() => (id ? fetchAnnouncement(id) : Promise.resolve(null)), [id]);
  const { data: note, loading, error, refresh } = useAsyncData(load, [id]);

  if (loading) return <LoadingState label="Loading note…" />;

  if (error || !note) {
    return (
      <View className="flex-1 justify-center bg-canvas p-5">
        <ErrorState
          message={error ?? 'This note is no longer on the board.'}
          onRetry={() => void refresh()}
        />
      </View>
    );
  }

  // The policy would refuse anyway; failing here says why instead of throwing.
  if (note.user_id !== userId) {
    return (
      <View className="flex-1 justify-center bg-canvas p-5">
        <ErrorState message="Ang may sulat lang ang pwedeng mag-edit ng note na ito." />
      </View>
    );
  }

  return (
    <NoteComposer
      authorName={note.profile?.display_name ?? 'You'}
      authorId={note.user_id}
      authorAvatarUrl={note.profile?.avatar_url}
      subtitle={`isinulat ${formatTimeAgo(note.created_at)}`}
      initialContent={note.content}
      initialTape={note.tape_color ?? 'mustard'}
      submitLabel="Save changes"
      onSubmit={async (content, tape) => {
        await updateAnnouncement(note.id, content, tape);
        haptics.success();
        router.back();
      }}
    />
  );
}
