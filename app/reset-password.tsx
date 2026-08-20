import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../src/components/ui/Button';
import { Screen } from '../src/components/ui/Screen';
import { InlineError } from '../src/components/ui/States';
import { TextField } from '../src/components/ui/TextField';
import { messageFrom } from '../src/hooks/useAsyncData';
import { haptics } from '../src/lib/haptics';
import { useSession } from '../src/providers/SessionProvider';

const MIN_PASSWORD = 6;

/**
 * Step two: redeem the code and choose a new password.
 *
 * Both are collected on one screen because redeeming the code signs the user
 * in, and a two-screen flow would hand them a live session with the old
 * password still set — one interruption away from being locked out again with
 * a spent code.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { completePasswordReset } = useSession();

  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    email.trim().includes('@') &&
    code.trim().length >= 6 &&
    password.length >= MIN_PASSWORD &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await completePasswordReset(email, code, password);
      haptics.success();
      // The session listener has already signed them in; let the entry point
      // decide whether that means the tabs or onboarding.
      router.replace('/');
    } catch (caught) {
      haptics.error();
      setError(messageFrom(caught));
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
              Bagong password
            </Text>
            <Text className="font-ui text-base leading-6 text-ink-soft">
              Ilagay ang code na natanggap mo, tapos pumili ng bagong password.
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
              label="Six-digit code"
              autoFocus={Boolean(params.email)}
              placeholder="123456"
              autoCapitalize="none"
              autoComplete="one-time-code"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(value) => setCode(value.replace(/[^0-9]/g, ''))}
            />
            <TextField
              label="New password"
              placeholder={`At least ${MIN_PASSWORD} characters`}
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              hint={
                password.length > 0 && password.length < MIN_PASSWORD
                  ? undefined
                  : 'Ito na ang gagamitin mo sa susunod na log in.'
              }
              error={
                password.length > 0 && password.length < MIN_PASSWORD
                  ? `Kulang — at least ${MIN_PASSWORD} characters.`
                  : null
              }
            />
            {error ? <InlineError message={error} /> : null}
          </View>

          <View className="gap-4">
            <Button
              label="Set new password"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
            />
            <Button
              label="Send a new code"
              variant="ghost"
              size="md"
              onPress={() => router.replace('/forgot-password')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
