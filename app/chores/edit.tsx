import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  deleteChore,
  fetchChore,
  openAssignment,
  updateAssignment,
  updateChore,
} from '../../src/api/chores';
import { ChoreForm } from '../../src/components/ChoreForm';
import { Button } from '../../src/components/ui/Button';
import { LoadingState, ErrorState } from '../../src/components/ui/States';
import { messageFrom, useAsyncData } from '../../src/hooks/useAsyncData';
import { fromDateString, toDateString } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';

export default function EditChoreScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const load = useCallback(() => (id ? fetchChore(id) : Promise.resolve(null)), [id]);
  const { data: chore, loading, error, refresh } = useAsyncData(load, [id]);

  const [deleting, setDeleting] = useState(false);

  if (loading) return <LoadingState label="Loading chore…" />;

  if (error || !chore) {
    return (
      <View className="flex-1 justify-center bg-canvas p-5">
        <ErrorState
          message={error ?? 'This chore no longer exists.'}
          onRetry={() => void refresh()}
        />
      </View>
    );
  }

  // Only the open turn is editable. Rewriting a finished one would quietly
  // rewrite history, including the streaks derived from it.
  const turn = openAssignment(chore);

  function confirmDelete() {
    haptics.tap();
    Alert.alert(
      'Delete this chore?',
      'Mawawala rin ang buong history nito — kasama ang mga natapos nang turn.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteChore(chore!.id);
              haptics.success();
              router.back();
            } catch (caught) {
              haptics.error();
              setDeleting(false);
              Alert.alert('Hindi ma-delete', messageFrom(caught));
            }
          },
        },
      ]
    );
  }

  return (
    <ChoreForm
      mode="edit"
      submitLabel="Save changes"
      initial={{
        title: chore.title,
        description: chore.description ?? '',
        recurrence: chore.recurrence,
        assigneeId: turn?.user_id ?? null,
        dueDate: turn ? fromDateString(turn.due_date) : new Date(),
      }}
      onSubmit={async (values) => {
        await updateChore(chore.id, {
          title: values.title,
          description: values.description || null,
          recurrence: values.recurrence,
        });

        // Only write the assignment if something about it actually moved —
        // an untouched turn shouldn't churn its row on every save.
        const nextDue = toDateString(values.dueDate);
        if (turn && (turn.user_id !== values.assigneeId || turn.due_date !== nextDue)) {
          await updateAssignment(turn.id, {
            userId: values.assigneeId,
            dueDate: nextDue,
          });
        }

        haptics.success();
        router.back();
      }}
      footer={
        <View className="gap-2 border-t border-line pt-6">
          {turn ? null : (
            <Text className="font-ui text-xs leading-5 text-ink-muted">
              Walang bukas na turn ngayon, kaya ang assignee at due date sa itaas ay hindi
              ise-save. Magkakaroon ulit ng turn pagka-tapos ng susunod na round.
            </Text>
          )}
          <Button
            label="Delete this chore"
            variant="danger"
            size="md"
            icon="trash-outline"
            loading={deleting}
            onPress={confirmDelete}
          />
        </View>
      }
    />
  );
}
