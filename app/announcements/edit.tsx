import { useCallback } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { fetchAnnouncement, updateAnnouncement } from '../../src/api/announcements';
import { NoteComposer } from '../../src/components/NoteComposer';
import { FormScreen } from '../../src/components/ui/Screen';
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

  // None of these reaches `NoteComposer`, which is what carries the header on
  // the way through — so they have to bring their own, or a note that failed
  // to load is a screen with no way out of it.
  if (loading) {
    return (
      <FormScreen title="Edit note">
        <LoadingState label="Loading note…" />
      </FormScreen>
    );
  }

  if (error || !note) {
    return (
      <FormScreen title="Edit note">
        <View className="flex-1 justify-center p-5">
          <ErrorState
            message={error ?? 'This note is no longer on the board.'}
            onRetry={() => void refresh()}
          />
        </View>
      </FormScreen>
    );
  }

  // The policy would refuse anyway; failing here says why instead of throwing.
  if (note.user_id !== userId) {
    return (
      <FormScreen title="Edit note">
        <View className="flex-1 justify-center p-5">
          <ErrorState message="Only the person who wrote this note can edit it." />
        </View>
      </FormScreen>
    );
  }

  return (
    <NoteComposer
      title="Edit note"
      authorName={note.profile?.display_name ?? 'You'}
      authorId={note.user_id}
      authorAvatarUrl={note.profile?.avatar_url}
      subtitle={`written ${formatTimeAgo(note.created_at)}`}
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
