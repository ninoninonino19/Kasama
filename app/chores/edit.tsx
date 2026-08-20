import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  deleteChore,
  fetchChore,
  openAssignment,
  updateAssignment,
  updateChore,
} from '../../src/api/chores';
import { Ionicons } from '@expo/vector-icons';

import { ChoreForm } from '../../src/components/ChoreForm';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { useConfirm, useDialog } from '../../src/components/ui/Dialog';
import { SectionTitle } from '../../src/components/ui/Screen';
import { LoadingState, ErrorState } from '../../src/components/ui/States';
import { messageFrom, useAsyncData } from '../../src/hooks/useAsyncData';
import { formatRelativeDate, fromDateString, toDateString } from '../../src/lib/format';
import { colors } from '../../src/lib/theme';
import { haptics } from '../../src/lib/haptics';
import { useCurrentUserId } from '../../src/store/useSessionStore';
import type { AssignmentWithProfile } from '../../src/types';

/** How many past turns to show. Enough to see the rotation, not a ledger. */
const HISTORY_LENGTH = 8;

export default function EditChoreScreen() {
  const router = useRouter();
  const confirm = useConfirm();
  const dialog = useDialog();
  const userId = useCurrentUserId();
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

  // Everything already done, newest first. The chore fetch has always carried
  // this and nothing has ever shown it — "whose turn was it last time" is
  // exactly the argument a rota exists to settle.
  const history = chore.assignments
    .filter((assignment) => assignment.completed)
    .sort((a, b) => b.due_date.localeCompare(a.due_date))
    .slice(0, HISTORY_LENGTH);

  function confirmDelete() {
    haptics.tap();
    void confirm({
      title: 'Delete this chore?',
      message: 'Its whole history goes with it, including every turn already completed.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setDeleting(true);
        try {
          await deleteChore(chore!.id);
          haptics.success();
          router.back();
        } catch (caught) {
          haptics.error();
          setDeleting(false);
          void dialog({
            title: "Couldn't delete this chore",
            message: messageFrom(caught),
            actions: [{ label: 'OK', style: 'cancel' }],
          });
        }
      },
    });
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
        <View className="gap-6">
          {history.length > 0 ? (
            <View className="border-t border-line pt-6">
              <SectionTitle>Past turns</SectionTitle>
              <View className="gap-2">
                {history.map((assignment) => (
                  <HistoryRow key={assignment.id} assignment={assignment} userId={userId} />
                ))}
              </View>
            </View>
          ) : null}

          <View className="gap-2 border-t border-line pt-6">
          {turn ? null : (
            <Text className="font-ui text-xs leading-5 text-ink-muted">
              There is no open turn right now, so the assignee and due date above won't be
              saved. A new turn appears once the next round comes around.
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
        </View>
      }
    />
  );
}

function HistoryRow({
  assignment,
  userId,
}: {
  assignment: AssignmentWithProfile;
  userId: string | null;
}) {
  const name =
    assignment.user_id === userId ? 'You' : (assignment.profile?.display_name ?? 'Housemate');

  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-line bg-paper p-3">
      <Avatar
        name={assignment.profile?.display_name ?? 'Housemate'}
        userId={assignment.user_id}
        avatarUrl={assignment.profile?.avatar_url}
        size={28}
      />
      <Text className="flex-1 font-ui-semibold text-sm text-ink" numberOfLines={1}>
        {name}
      </Text>
      {/* The due date, not completed_at: the rota is about whose turn it was,
          and someone ticking Tuesday's dishes on Thursday still had Tuesday. */}
      <Text className="font-mono text-[11px] text-ink-muted">
        {formatRelativeDate(assignment.due_date)}
      </Text>
      <Ionicons name="checkmark-circle" size={16} color={colors.deep.sage} />
    </View>
  );
}
