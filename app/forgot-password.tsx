import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '../src/components/ui/Button';
import { NoteCard } from '../src/components/ui/NoteCard';
import { Screen } from '../src/components/ui/Screen';
import { InlineError } from '../src/components/ui/States';
import { TextField } from '../src/components/ui/TextField';
import { messageFrom } from '../src/hooks/useAsyncData';
import { haptics } from '../src/lib/haptics';
import { colors } from '../src/lib/theme';
import { useSession } from '../src/providers/SessionProvider';

/**
 * Step one of recovery: ask for the address, send a code.
 *
 * Lives at the root rather than under `app/auth/` on purpose. `AuthLayout`
 * redirects away the instant a session exists, and redeeming a recovery code
 * creates one — a recovery flow inside that group would be yanked off screen
 * halfway through.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordReset } = useSession();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().includes('@') && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      haptics.success();
      router.push({ pathname: '/reset-password', params: { email: email.trim() } });
    } catch (caught) {
      haptics.error();
      setError(messageFrom(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen topInset={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="grow justify-center gap-6 px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-2">
            <Text className="font-hand-bold text-4xl leading-[44px] text-ink">
              Forgot your password?
            </Text>
            <Text className="font-ui text-base leading-6 text-ink-soft">
              Enter your email address and we'll send you a six-digit code.
            </Text>
          </View>

          <View className="gap-4">
            <TextField
              label="Email"
              autoFocus
              placeholder="you@email.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={handleSubmit}
              returnKeyType="send"
            />
            {error ? <InlineError message={error} /> : null}
          </View>

          <View className="gap-4">
            <Button
              label="Send the code"
              icon="mail-outline"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
            />
            <Button
              label="I already have a code"
              variant="ghost"
              size="md"
              onPress={() =>
                router.push({ pathname: '/reset-password', params: { email: email.trim() } })
              }
            />
          </View>

          <NoteCard tape={colors.sage} className="pt-5">
            <Text className="font-ui text-xs leading-5 text-ink-muted">
              If that address has an account, the code arrives within a minute. If it doesn't,
              nothing is sent — we never say which, so nobody can use this screen to work out
              who has an account here.
            </Text>
          </NoteCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
