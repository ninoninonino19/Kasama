import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../src/components/ui/Button';
import { NoteCard } from '../src/components/ui/NoteCard';
import { Screen } from '../src/components/ui/Screen';
import { InlineError } from '../src/components/ui/States';
import { TextField } from '../src/components/ui/TextField';
import { messageFrom } from '../src/hooks/useAsyncData';
import { haptics } from '../src/lib/haptics';
import { colors } from '../src/lib/theme';
import { useSession } from '../src/providers/SessionProvider';

/** Supabase rate-limits confirmation emails; roughly a minute between sends. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Finishing registration: redeem the six-digit code from the confirmation
 * email.
 *
 * Lives at the root rather than under `app/auth/` for the same reason the
 * recovery screens do — `AuthLayout` redirects away the instant a session
 * exists, and redeeming the code creates one. A confirmation screen inside
 * that group would be yanked off screen at the moment it succeeded.
 *
 * A code rather than the link in Supabase's default template: a link opens a
 * browser, and on a phone that browser has no way to hand the session back to
 * the app. Typing six digits always works. The README covers the email
 * template this needs.
 */
export default function ConfirmEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { confirmEmail, resendConfirmation } = useSession();

  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick the resend cooldown down, and never leave the interval running.
  useEffect(() => {
    if (cooldown <= 0) return;
    timer.current = setInterval(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [cooldown]);

  const canSubmit = email.trim().includes('@') && code.trim().length >= 6 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await confirmEmail(email, code);
      haptics.success();
      // Confirming signs them in; the entry point decides whether that means
      // onboarding or the tabs.
      router.replace('/');
    } catch (caught) {
      haptics.error();
      setError(messageFrom(caught));
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || !email.trim().includes('@')) return;
    setError(null);
    setNotice(null);
    try {
      await resendConfirmation(email);
      haptics.success();
      setNotice('Sent. Check your inbox — and the spam folder.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (caught) {
      haptics.error();
      setError(messageFrom(caught));
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
              Confirm your email
            </Text>
            <Text className="font-ui text-base leading-6 text-ink-soft">
              We sent a six-digit code to {email.trim() || 'your address'}. Enter it here to
              finish setting up your account.
            </Text>
          </View>

          <View className="gap-4">
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
              label="Six-digit code"
              autoFocus={Boolean(params.email)}
              placeholder="123456"
              autoCapitalize="none"
              autoComplete="one-time-code"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(value) => setCode(value.replace(/[^0-9]/g, ''))}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />
            {error ? <InlineError message={error} /> : null}
            {notice ? (
              <View className="rounded-xl bg-wash-slate px-3 py-2">
                <Text className="font-ui text-sm text-deep-slate">{notice}</Text>
              </View>
            ) : null}
          </View>

          <View className="gap-4">
            <Button
              label="Confirm and continue"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
            />
            <Button
              label={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Send a new code'}
              variant="ghost"
              size="md"
              disabled={cooldown > 0}
              onPress={handleResend}
            />
          </View>

          <NoteCard tape={colors.sage} className="pt-5">
            <Text className="font-ui text-xs leading-5 text-ink-muted">
              The code lasts an hour. If nothing arrives, check the spam folder — and that the
              address above is spelled the way you typed it when you signed up.
            </Text>
          </NoteCard>

          <Button
            label="Back to log in"
            variant="ghost"
            size="md"
            onPress={() => router.replace('/auth/sign-in')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
