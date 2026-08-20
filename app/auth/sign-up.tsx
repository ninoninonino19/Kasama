import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';

import { Button } from '../../src/components/ui/Button';
import { Logo } from '../../src/components/ui/Logo';
import { Screen } from '../../src/components/ui/Screen';
import { InlineError } from '../../src/components/ui/States';
import { TextField } from '../../src/components/ui/TextField';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { useSession } from '../../src/providers/SessionProvider';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useSession();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = displayName.trim().length >= 2 && email.trim().length > 3 && password.length >= 6;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const { needsConfirmation } = await signUp(email, password, displayName);

      if (needsConfirmation) {
        // Straight into the code screen rather than a notice telling them to
        // go and find an email: the confirmation is part of signing up, not
        // an errand to run afterwards.
        router.replace({ pathname: '/confirm-email', params: { email: email.trim() } });
        return;
      }

      // Confirmations are off, so Supabase already returned a session and the
      // auth listener is taking it from here.
    } catch (caught) {
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
            <Text className="font-ui-black text-3xl text-ink">Join Kasama</Text>
            <Text className="font-ui text-base leading-6 text-ink-soft">
              One app for the whole house — bills, chores and notices in a single place.
            </Text>
          </View>

          <View className="gap-4">
            <TextField
              label="Your name"
              placeholder="e.g. Ana Reyes"
              autoCapitalize="words"
              value={displayName}
              onChangeText={setDisplayName}
            />
            <TextField
              label="Email"
              placeholder="you@email.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextField
              label="Password"
              placeholder="At least 6 characters"
              autoCapitalize="none"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              hint="Minimum of 6 characters."
            />
            {error ? <InlineError message={error} /> : null}
          </View>

          <View className="gap-4">
            <Button
              label="Create account"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
            />
            <View className="flex-row justify-center gap-1">
              <Text className="font-ui text-sm text-ink-muted">Already have an account?</Text>
              <Link href="/auth/sign-in" className="font-ui-semibold text-sm text-moss">
                Log in
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
