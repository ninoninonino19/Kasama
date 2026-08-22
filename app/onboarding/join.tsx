import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { joinHouseholdByCode } from '../../src/api/household';
import { Button } from '../../src/components/ui/Button';
import { Screen } from '../../src/components/ui/Screen';
import { InlineError } from '../../src/components/ui/States';
import { TextField } from '../../src/components/ui/TextField';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { pressSmall } from '../../src/lib/motion';
import { colors, fonts } from '../../src/lib/theme';
import { useSession } from '../../src/providers/SessionProvider';

export default function JoinHouseholdScreen() {
  const router = useRouter();
  const { refreshHousehold } = useSession();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = code.trim().length === 6;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await joinHouseholdByCode(code);
      await refreshHousehold();
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
          contentContainerClassName="grow gap-6 px-6 py-6"
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            hitSlop={8}
            className={`h-10 w-10 items-center justify-center rounded-full border border-line bg-paper ${pressSmall} active:bg-page`}
          >
            <Ionicons name="arrow-back" size={20} color={colors.ink.DEFAULT} />
          </Pressable>

          <View className="gap-2">
            <Text className="font-ui-black text-3xl text-ink">Enter invite code</Text>
            <Text className="font-ui text-base leading-6 text-ink-soft">
              Ask whoever set up the household for the six-character code.
            </Text>
          </View>

          <TextField
            label="Invite code"
            placeholder="ABC123"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            value={code}
            onChangeText={(value) => setCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onSubmitEditing={handleSubmit}
            returnKeyType="go"
            style={{ letterSpacing: 6, fontSize: 20, fontFamily: fonts.monoSemibold }}
          />

          {error ? <InlineError message={error} /> : null}

          <View className="mt-auto">
            <Button
              label="Join household"
              onPress={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
