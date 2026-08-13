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
import { useSession } from '../../src/providers/SessionProvider';
import { useSessionStore } from '../../src/store/useSessionStore';

const SUGGESTIONS = ['Unit 4B', 'Bahay ni Lola', 'Katipunan Dorm', 'Casa Malingap'];

export default function CreateHouseholdScreen() {
  const router = useRouter();
  const userId = useSessionStore((state) => state.userId);
  const { refreshHousehold } = useSession();

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length >= 2;

  async function handleSubmit() {
    if (!canSubmit || submitting || !userId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createHousehold(name);
      // Layout guard sends us to the dashboard as soon as the household lands.
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
            className="h-10 w-10 items-center justify-center rounded-full bg-white"
          >
            <Ionicons name="arrow-back" size={20} color="#1F2A2E" />
          </Pressable>

          <View className="gap-2">
            <Text className="text-3xl font-bold text-ink">Name your household</Text>
            <Text className="text-base leading-6 text-ink-soft">
              Ito ang makikita ng lahat ng kasama mo sa bahay.
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
            <Text className="text-sm font-semibold text-ink-soft">Mga suggestion</Text>
            <View className="flex-row flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  accessibilityRole="button"
                  onPress={() => setName(suggestion)}
                  className="rounded-full border border-sand-300 bg-white px-4 py-2 active:bg-sand-100"
                >
                  <Text className="text-sm text-ink-soft">{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {error ? <InlineError message={error} /> : null}

          <View className="mt-auto gap-3">
            <View className="flex-row items-start gap-2 rounded-2xl bg-brand-50 p-4">
              <Ionicons name="information-circle-outline" size={18} color="#218578" />
              <Text className="flex-1 text-sm leading-5 text-brand-700">
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
