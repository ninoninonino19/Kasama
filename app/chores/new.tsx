import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { createChore } from '../../src/api/chores';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { Chip } from '../../src/components/ui/Chip';
import { SectionTitle } from '../../src/components/ui/Screen';
import { InlineError } from '../../src/components/ui/States';
import { TextField } from '../../src/components/ui/TextField';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { CHORE_RECURRENCES, CHORE_SUGGESTIONS } from '../../src/lib/categories';
import type { ChoreRecurrence } from '../../src/lib/database.types';
import { formatShortDate, toDateString } from '../../src/lib/format';
import { useHousehold, useMembers, useSessionStore } from '../../src/store/useSessionStore';

export default function NewChoreScreen() {
  const router = useRouter();
  const household = useHousehold();
  const members = useMembers();
  const userId = useSessionStore((state) => state.userId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recurrence, setRecurrence] = useState<ChoreRecurrence>('weekly');
  // Falls back to "me" until someone picks explicitly, so the screen still works
  // if the member list arrives after mount.
  const [chosenAssignee, setChosenAssignee] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const assignee = chosenAssignee ?? userId ?? members[0]?.user_id ?? null;
  const canSubmit = title.trim().length > 0 && Boolean(assignee) && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !household || !assignee) return;
    setSubmitting(true);
    setError(null);
    try {
      await createChore({
        householdId: household.id,
        title,
        description: description || null,
        recurrence,
        assigneeId: assignee,
        dueDate: toDateString(dueDate),
      });
      router.back();
    } catch (caught) {
      setError(messageFrom(caught));
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-sand-50"
    >
      <ScrollView contentContainerClassName="gap-6 p-5 pb-10" keyboardShouldPersistTaps="handled">
        <View className="gap-4">
          <TextField
            label="Chore"
            placeholder="e.g. Hugas plato"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />

          <View className="flex-row flex-wrap gap-2">
            {CHORE_SUGGESTIONS.map((suggestion) => (
              <Pressable
                key={suggestion}
                accessibilityRole="button"
                onPress={() => setTitle(suggestion)}
                className="rounded-full border border-sand-300 bg-white px-3 py-1.5 active:bg-sand-100"
              >
                <Text className="text-xs font-semibold text-ink-soft">{suggestion}</Text>
              </Pressable>
            ))}
          </View>

          <TextField
            label="Notes (optional)"
            placeholder="e.g. Kasama ang kaldero at kawali"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        <View>
          <SectionTitle>Repeats</SectionTitle>
          <View className="flex-row flex-wrap gap-2">
            {CHORE_RECURRENCES.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={recurrence === option.value}
                onPress={() => setRecurrence(option.value)}
              />
            ))}
          </View>
          {recurrence !== 'once' ? (
            <Text className="mt-2 text-xs leading-5 text-ink-muted">
              Pag na-check as done, awtomatikong lilipat ang susunod na turn sa kasunod na kasama.
            </Text>
          ) : null}
        </View>

        <View>
          <SectionTitle>Sino ang una?</SectionTitle>
          <View className="gap-2">
            {members.map((member) => {
              const selected = assignee === member.user_id;
              return (
                <Pressable
                  key={member.user_id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setChosenAssignee(member.user_id)}
                  className={`flex-row items-center gap-3 rounded-2xl border p-3 ${
                    selected ? 'border-brand-400 bg-brand-50' : 'border-sand-200 bg-white'
                  }`}
                >
                  <Avatar
                    name={member.profile.display_name}
                    userId={member.user_id}
                    avatarUrl={member.profile.avatar_url}
                    size={36}
                  />
                  <Text className="flex-1 text-sm font-bold text-ink">
                    {member.profile.display_name}
                    {member.user_id === userId ? ' (you)' : ''}
                  </Text>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? '#218578' : '#C9BDAD'}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <SectionTitle>First due date</SectionTitle>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPicker(true)}
            className="flex-row items-center justify-between rounded-2xl border border-sand-300 bg-white px-4 py-4"
          >
            <Text className="text-base text-ink">{formatShortDate(dueDate)}</Text>
            <Ionicons name="calendar-outline" size={20} color="#8A979B" />
          </Pressable>

          {showPicker ? (
            <DateTimePicker
              value={dueDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(event, selected) => {
                if (Platform.OS !== 'ios') setShowPicker(false);
                if (event.type === 'set' && selected) setDueDate(selected);
              }}
            />
          ) : null}

          {Platform.OS === 'ios' && showPicker ? (
            <Button
              label="Done"
              variant="secondary"
              size="md"
              className="mt-2"
              onPress={() => setShowPicker(false)}
            />
          ) : null}
        </View>

        {error ? <InlineError message={error} /> : null}

        <Button
          label="Save chore"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
