import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { createHousehold } from '../../src/api/household';
import { Button } from '../../src/components/ui/Button';
import { Screen } from '../../src/components/ui/Screen';
import { InlineError } from '../../src/components/ui/States';
import { TextField } from '../../src/components/ui/TextField';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { colors } from '../../src/lib/theme';
import { useSessionStore } from '../../src/store/useSessionStore';

const SUGGESTIONS = ['Unit 4B', 'The Flat', 'Maple Street', 'Dorm 12'];

export default function CreateHouseholdScreen() {
  const router = useRouter();
  const userId = useSessionStore((state) => state.userId);

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length >= 2;

  async function handleSubmit() {
    if (!canSubmit || submitting || !userId) return;
    setSubmitting(true);
    setError(null);
    try {
      const household = await createHousehold(name);
      // Straight to the invite screen with the code already in hand, and
      // deliberately *before* refreshing the store: the moment a household
      // lands there, this stack's layout guard redirects to the dashboard, and
      // the code goes back to being three taps into Settings. The invite
      // screen does the refresh itself once it is the one on top.
      router.replace({
        pathname: '/invite',
        params: { code: household.invite_code, name: household.name },
      });
      // `submitting` stays true — the screen is on its way out, and a button
      // that goes idle for a frame on the way reads as a failed tap.
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
            className="h-10 w-10 items-center justify-center rounded-full border border-line bg-paper active:bg-page"
          >
            <Ionicons name="arrow-back" size={20} color={colors.ink.DEFAULT} />
          </Pressable>

          <View className="gap-2">
            <Text className="font-ui-black text-3xl text-ink">Name your household</Text>
            <Text className="font-ui text-base leading-6 text-ink-soft">
              This is the name everyone in the house will see.
            </Text>
          </View>

          <TextField
            label="Household name"
            placeholder="e.g. Unit 4B"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
            maxLength={60}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
          />

          <View className="gap-2">
            <Text className="font-ui-semibold text-sm text-ink-soft">Suggestions</Text>
            <View className="flex-row flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  accessibilityRole="button"
                  onPress={() => setName(suggestion)}
                  className="min-h-11 justify-center rounded-full border border-line bg-paper px-4 py-2 active:bg-page"
                >
                  <Text className="font-ui-semibold text-sm text-ink-soft">{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {error ? <InlineError message={error} /> : null}

          <View className="mt-auto gap-3">
            <View className="flex-row items-start gap-2 rounded-2xl bg-wash-slate p-4">
              <Ionicons name="information-circle-outline" size={18} color={colors.deep.slate} />
              <Text className="flex-1 font-ui text-sm leading-5 text-deep-slate">
                We'll generate a 6-character invite code you can send to your housemates.
              </Text>
            </View>
            <Button
              label="Create household"
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
