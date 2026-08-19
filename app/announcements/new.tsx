import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { postAnnouncement } from '../../src/api/announcements';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { Tape } from '../../src/components/ui/Tape';
import { InlineError } from '../../src/components/ui/States';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { haptics } from '../../src/lib/haptics';
import { colors } from '../../src/lib/theme';
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
      className="flex-1 bg-canvas"
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
            <Text className="font-ui-bold text-sm text-ink">
              {profile?.display_name ?? 'You'}
            </Text>
            <Text className="font-ui text-xs text-ink-muted">
              pinning to {household?.name}
            </Text>
          </View>
        </View>

        {/* The sheet you are about to pin, drawn the way it will look on the
            board — same paper, same tape, same handwriting. */}
        <View className="flex-1 rounded-xl border border-line bg-paper p-4 pt-5">
          <Tape color={colors.mustard} />
          <TextInput
            className="flex-1 font-hand text-2xl leading-8 text-ink"
            placeholder="Ano'ng balita sa bahay? e.g. Deadline ng kuryente sa Friday, pa-GCash na lang sa akin."
            placeholderTextColor={colors.ink.faint}
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
            className={`font-mono text-xs ${
              remaining < 50 ? 'text-deep-brick' : 'text-ink-muted'
            }`}
          >
            {remaining} characters left
          </Text>
        </View>

        {error ? <InlineError message={error} /> : null}

        <Button
          label="Pin it up"
          icon="send"
          onPress={handlePost}
          loading={posting}
          disabled={!canPost}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
