import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Redirect } from 'expo-router';

import { Button } from '../src/components/ui/Button';
import { Logo } from '../src/components/ui/Logo';
import { NoteCard } from '../src/components/ui/NoteCard';
import { Screen } from '../src/components/ui/Screen';
import { InlineError } from '../src/components/ui/States';
import { TextField } from '../src/components/ui/TextField';
import { messageFrom } from '../src/hooks/useAsyncData';
import { haptics } from '../src/lib/haptics';
import { colors } from '../src/lib/theme';
import { useSession } from '../src/providers/SessionProvider';
import { useSessionStore } from '../src/store/useSessionStore';

const MIN_NAME = 2;

/**
 * The whole of getting in: say what to call you.
 *
 * Kasama is gated by the household code, not by an account — you can't see
 * anything without one, and the people who have one already know each other.
 * An email and a password on top of that would be a second door in front of a
 * house everyone already has the key to, plus a password to forget and a
 * recovery flow to maintain.
 *
 * So the name is all this asks for. It opens an anonymous session behind the
 * scenes, which keeps a real `auth.uid()` — and therefore every RLS policy —
 * without anyone having to register.
 */
export default function WelcomeScreen() {
  const { startSession } = useSession();
  const status = useSessionStore((state) => state.status);
  const session = useSessionStore((state) => state.session);

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length >= MIN_NAME && !submitting;

  /**
   * Every other route guards itself this way, and this one has to as well:
   * routing lives in `app/index.tsx`, but reaching this screen *is* index
   * redirecting, which unmounts it. So once the session opens there is no
   * mounted component left watching for it, and the Continue button below
   * spins forever on a session that already exists. Sending them back through
   * index keeps the create-or-join decision in the one place that makes it.
   */
  if (status === 'ready' && session) return <Redirect href="/" />;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await startSession(name);
      haptics.success();
      // `submitting` deliberately stays true: the guard above redirects as soon
      // as the auth listener has the session, and unmounting mid-spinner reads
      // better than a button that goes idle for a frame first.
    } catch (caught) {
      haptics.error();
      setError(messageFrom(caught));
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="grow justify-center gap-6 px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-2">
            <View className="mb-2">
              <Logo />
            </View>
            <Text className="font-hand-bold text-4xl leading-[44px] text-ink">
              What should we call you?
            </Text>
            <Text className="font-ui text-base leading-6 text-ink-soft">
              This is the name your housemates see next to bills, chores and notes. No email,
              no password — the household code is the door.
            </Text>
          </View>

          <View className="gap-4">
            <TextField
              label="Your name"
              autoFocus
              placeholder="e.g. Ana Reyes"
              autoCapitalize="words"
              autoComplete="name"
              value={name}
              onChangeText={setName}
              maxLength={40}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              hint={
                name.trim().length > 0 && name.trim().length < MIN_NAME
                  ? undefined
                  : 'You can change this later in Settings.'
              }
              error={
                name.trim().length > 0 && name.trim().length < MIN_NAME
                  ? 'A couple of characters at least.'
                  : null
              }
            />
            {error ? <InlineError message={error} /> : null}
          </View>

          <Button
            label="Continue"
            icon="arrow-forward"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!canSubmit}
          />

          <NoteCard tape={colors.mustard} className="pt-5">
            <Text className="font-ui text-xs leading-5 text-ink-muted">
              Next you'll create a household or join one with a six-character code from a
              housemate. Because there's no password, this name lives on this phone — keep the
              app installed and you stay yourself.
            </Text>
          </NoteCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
