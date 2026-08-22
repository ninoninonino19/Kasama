import { useRouter } from 'expo-router';

import { postAnnouncement } from '../../src/api/announcements';
import { notifyHousehold } from '../../src/api/notify';
import { NoteComposer } from '../../src/components/NoteComposer';
import { haptics } from '../../src/lib/haptics';
import { useHousehold, useProfile, useSessionStore } from '../../src/store/useSessionStore';

export default function NewAnnouncementScreen() {
  const router = useRouter();
  const household = useHousehold();
  const profile = useProfile();
  const userId = useSessionStore((state) => state.userId);

  return (
    <NoteComposer
      title="New note"
      authorName={profile?.display_name ?? 'You'}
      authorId={userId ?? 'me'}
      authorAvatarUrl={profile?.avatar_url}
      subtitle={`pinning to ${household?.name ?? 'your household'}`}
      submitLabel="Pin it up"
      onSubmit={async (content, tape) => {
        if (!household || !userId) return;
        await postAnnouncement(household.id, userId, content, tape);
        haptics.success();

        notifyHousehold({
          householdId: household.id,
          category: 'board',
          title: `${profile?.display_name.split(' ')[0] ?? 'A housemate'} pinned a note`,
          // A board post is short enough that the notification can just be
          // the note.
          body: content.trim().slice(0, 140),
          data: { screen: 'announcements' },
        });

        router.back();
      }}
    />
  );
}
