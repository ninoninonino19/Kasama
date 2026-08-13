import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { Button } from '../../src/components/ui/Button';
import { Logo } from '../../src/components/ui/Logo';
import { Screen } from '../../src/components/ui/Screen';
import { InlineError } from '../../src/components/ui/States';
import { TextField } from '../../src/components/ui/TextField';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { useSession } from '../../src/providers/SessionProvider';

export default function SignUpScreen() {
  const { signIn, signUp } = useSession();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = displayName.trim().length >= 2 && email.trim().length > 3 && password.length >= 6;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await signUp(email, password, displayName);
      // With email confirmation off, Supabase returns a session immediately;
      // with it on, the user has to confirm before signing in.
      try {
        await signIn(email, password);
      } catch {
        setNotice('Account created! Check your email to confirm, then log in.');
      }
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
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
              <Logo tone="coral" />
            </View>
            <Text className="text-3xl font-bold text-ink">Join Kasama</Text>
            <Text className="text-base leading-6 text-ink-soft">
              Isang app para sa bills, chores at anunsyo ng buong bahay.
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
              placeholder="ikaw@email.com"
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
            {notice ? (
              <View className="rounded-xl bg-brand-50 px-3 py-2">
                <Text className="text-sm text-brand-700">{notice}</Text>
              </View>
            ) : null}
          </View>

          <View className="gap-4">
            <Button
              label="Create account"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
            />
            <View className="flex-row justify-center gap-1">
              <Text className="text-sm text-ink-muted">May account ka na?</Text>
              <Link href="/auth/sign-in" className="text-sm font-semibold text-brand-600">
                Log in
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
