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

export default function SignInScreen() {
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      // The session listener takes it from here.
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
              <Logo />
            </View>
            <Text className="text-3xl font-bold text-ink">Welcome back!</Text>
            <Text className="text-base leading-6 text-ink-soft">
              Log in para makita ang bills, chores at balita ng bahay.
            </Text>
          </View>

          <View className="gap-4">
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
              placeholder="••••••••"
              autoCapitalize="none"
              autoComplete="current-password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />
            {error ? <InlineError message={error} /> : null}
          </View>

          <View className="gap-4">
            <Button
              label="Log in"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
            />
            <Link
              href="/forgot-password"
              className="text-center text-sm font-semibold text-brand-600"
            >
              Nakalimutan ang password?
            </Link>
            <View className="flex-row justify-center gap-1">
              <Text className="text-sm text-ink-muted">Bago dito?</Text>
              <Link href="/auth/sign-up" className="text-sm font-semibold text-brand-600">
                Create an account
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
