import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { postAnnouncement } from '../../src/api/announcements';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { InlineError } from '../../src/components/ui/States';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { haptics } from '../../src/lib/haptics';
import { useHousehold, useProfile, useSessionStore } from '../../src/store/useSessionStore';

const MAX_LENGTH = 500;

/**
 * Composing lives on its own screen rather than in a bar above the tab bar.
 * An inline composer has to fight the keyboard for space with the tab bar in
 * between; here the keyboard simply has the screen, and there is room to write
 * more than one line.
 */
export default function NewAnnouncementScreen() {
  const router = useRouter();
  const household = useHousehold();
  const profile = useProfile();
  const userId = useSessionStore((state) => state.userId);

  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_LENGTH - content.length;
  const canPost = content.trim().length > 0 && !posting;

  async function handlePost() {
    if (!canPost || !household || !userId) return;
    setPosting(true);
    setError(null);
    try {
      await postAnnouncement(household.id, userId, content);
      haptics.success();
      router.back();
    } catch (caught) {
      haptics.error();
      setError(messageFrom(caught));
      setPosting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-sand-50"
    >
      <View className="flex-1 gap-4 p-5">
        <View className="flex-row items-center gap-3">
          <Avatar
            name={profile?.display_name ?? 'You'}
            userId={userId ?? 'me'}
            avatarUrl={profile?.avatar_url}
            size={36}
          />
          <View className="flex-1">
            <Text className="text-sm font-bold text-ink">
              {profile?.display_name ?? 'You'}
            </Text>
            <Text className="text-xs text-ink-muted">posting to {household?.name}</Text>
          </View>
        </View>

        <View className="flex-1 rounded-2xl border border-sand-300 bg-white p-4">
          <TextInput
            className="flex-1 text-base leading-6 text-ink"
            placeholder="Ano'ng balita sa bahay? e.g. Deadline ng kuryente sa Friday, pa-GCash na lang sa akin."
            placeholderTextColor="#A99B89"
            value={content}
            onChangeText={(value) => setContent(value.slice(0, MAX_LENGTH))}
            multiline
            autoFocus
            textAlignVertical="top"
            maxLength={MAX_LENGTH}
          />
        </View>

        <View className="flex-row items-center justify-between">
          <Text
            className={`text-xs ${remaining < 50 ? 'text-coral-600' : 'text-ink-muted'}`}
          >
            {remaining} characters left
          </Text>
        </View>

        {error ? <InlineError message={error} /> : null}

        <Button label="Post" icon="send" onPress={handlePost} loading={posting} disabled={!canPost} />
      </View>
    </KeyboardAvoidingView>
  );
}
