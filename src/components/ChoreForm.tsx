import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { CHORE_RECURRENCES, CHORE_SUGGESTIONS } from '../lib/categories';
import type { ChoreRecurrence } from '../lib/database.types';
import { formatShortDate } from '../lib/format';
import { colors } from '../lib/theme';
import { useMembers, useSessionStore } from '../store/useSessionStore';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { SectionTitle } from './ui/Screen';
import { InlineError } from './ui/States';
import { TextField } from './ui/TextField';

export type ChoreFormValues = {
  title: string;
  description: string;
  recurrence: ChoreRecurrence;
  assigneeId: string | null;
  dueDate: Date;
};

/**
 * The chore form, shared by the create and edit screens.
 *
 * Both screens ask for exactly the same six things; the only differences are
 * what the assignee and date mean ("who goes first" vs "whose turn is it now")
 * and whether there is a delete button at the bottom. Keeping one form means a
 * field added here can't go missing from the other screen.
 */
export function ChoreForm({
  mode,
  initial,
  submitLabel,
  onSubmit,
  footer,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<ChoreFormValues>;
  submitLabel: string;
  onSubmit: (values: ChoreFormValues & { assigneeId: string }) => Promise<void>;
  /** Rendered under the save button — the edit screen's danger zone. */
  footer?: React.ReactNode;
}) {
  const members = useMembers();
  const userId = useSessionStore((state) => state.userId);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [recurrence, setRecurrence] = useState<ChoreRecurrence>(initial?.recurrence ?? 'weekly');
  // Falls back to "me" until someone picks explicitly, so the screen still works
  // if the member list arrives after mount.
  const [chosenAssignee, setChosenAssignee] = useState<string | null>(
    initial?.assigneeId ?? null
  );
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const assignee = chosenAssignee ?? userId ?? members[0]?.user_id ?? null;
  const canSubmit = title.trim().length > 0 && Boolean(assignee) && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !assignee) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ title, description, recurrence, assigneeId: assignee, dueDate });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-canvas"
    >
      <ScrollView
        contentContainerClassName="gap-6 p-5 pb-10"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View className="gap-4">
          <TextField
            label="Chore"
            autoFocus={mode === 'create'}
            placeholder="e.g. Wash the dishes"
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />

          {mode === 'create' ? (
            <View className="flex-row flex-wrap gap-2">
              {CHORE_SUGGESTIONS.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  accessibilityRole="button"
                  onPress={() => setTitle(suggestion)}
                  className="rounded-full border border-line bg-paper px-3 py-1.5 active:bg-page"
                >
                  <Text className="font-ui-semibold text-xs text-ink-soft">{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <TextField
            label="Notes (optional)"
            placeholder="e.g. Includes the pots and pans"
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
            <Text className="mt-2 font-ui text-xs leading-5 text-ink-muted">
              Once this is ticked off, the next turn moves automatically to the next housemate.
            </Text>
          ) : null}
        </View>

        <View>
          <SectionTitle>{mode === 'create' ? 'Who goes first?' : 'Whose turn is it?'}</SectionTitle>
          <View className="gap-2">
            {members.map((member) => {
              const selected = assignee === member.user_id;
              return (
                <Pressable
                  key={member.user_id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setChosenAssignee(member.user_id)}
                  className={`flex-row items-center gap-3 rounded-xl border p-3 ${
                    selected ? 'border-moss bg-wash-sage' : 'border-line bg-paper'
                  }`}
                >
                  <Avatar
                    name={member.profile.display_name}
                    userId={member.user_id}
                    avatarUrl={member.profile.avatar_url}
                    size={36}
                  />
                  <Text className="flex-1 font-ui-bold text-sm text-ink">
                    {member.profile.display_name}
                    {member.user_id === userId ? ' (you)' : ''}
                  </Text>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? colors.moss.DEFAULT : colors.ink.muted}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <SectionTitle>{mode === 'create' ? 'First due date' : 'Due date'}</SectionTitle>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Due ${formatShortDate(dueDate)}. Opens a date picker.`}
            onPress={() => setShowPicker(true)}
            className="flex-row items-center justify-between rounded-xl border border-line bg-paper px-4 py-4"
          >
            <Text className="font-mono-bold text-base text-ink">{formatShortDate(dueDate)}</Text>
            <Ionicons name="calendar-outline" size={20} color={colors.ink.muted} />
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
          label={submitLabel}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
        />

        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
