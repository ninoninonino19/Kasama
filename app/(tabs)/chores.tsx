import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { nextAssigneeId, openAssignment, setAssignmentCompleted } from '../../src/api/chores';
import { Avatar } from '../../src/components/ui/Avatar';
import { Badge } from '../../src/components/ui/Chip';
import { Card } from '../../src/components/ui/Card';
import { Screen, ScreenHeader, SectionTitle } from '../../src/components/ui/Screen';
import { EmptyState, ErrorState, InlineError, LoadingState } from '../../src/components/ui/States';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { useChores } from '../../src/hooks/useHouseholdData';
import { endOfWeek, formatRelativeDate, startOfWeek, toDateString, todayString } from '../../src/lib/format';
import { useCurrentUserId, useMembers } from '../../src/store/useSessionStore';
import type { AssignmentWithProfile, ChoreWithAssignments, MemberWithProfile } from '../../src/types';

export default function ChoresScreen() {
  const router = useRouter();
  const userId = useCurrentUserId();
  const members = useMembers();
  const { data, loading, refreshing, error, refresh } = useChores();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const chores = useMemo(() => data ?? [], [data]);

  const weekEnd = toDateString(endOfWeek());
  const today = todayString();

  const { overdue, thisWeek, upcoming } = useMemo(() => {
    const open = chores
      .map((chore) => ({ chore, assignment: openAssignment(chore) }))
      .filter((entry): entry is { chore: ChoreWithAssignments; assignment: AssignmentWithProfile } =>
        Boolean(entry.assignment)
      )
      .sort((a, b) => a.assignment.due_date.localeCompare(b.assignment.due_date));

    return {
      overdue: open.filter((entry) => entry.assignment.due_date < today),
      thisWeek: open.filter(
        (entry) => entry.assignment.due_date >= today && entry.assignment.due_date <= weekEnd
      ),
      upcoming: open.filter((entry) => entry.assignment.due_date > weekEnd),
    };
  }, [chores, today, weekEnd]);

  const doneThisWeek = useMemo(() => {
    const from = toDateString(startOfWeek());
    return chores
      .flatMap((chore) => chore.assignments.map((assignment) => ({ chore, assignment })))
      .filter(
        ({ assignment }) =>
          assignment.completed && assignment.due_date >= from && assignment.due_date <= weekEnd
      );
  }, [chores, weekEnd]);

  const handleToggle = useCallback(
    async (chore: ChoreWithAssignments, assignment: AssignmentWithProfile, completed: boolean) => {
      setBusyId(assignment.id);
      setActionError(null);
      try {
        await setAssignmentCompleted(chore, assignment, completed, members);
        await refresh({ silent: true });
      } catch (caught) {
        setActionError(messageFrom(caught));
      } finally {
        setBusyId(null);
      }
    },
    [members, refresh]
  );

  const hasOpenWork = overdue.length + thisWeek.length + upcoming.length > 0;

  return (
    <Screen>
      <ScreenHeader
        title="Chores"
        subtitle={
          hasOpenWork
            ? `${overdue.length + thisWeek.length} due this week`
            : 'Walang pending — salamat, mga kasama!'
        }
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a chore"
            onPress={() => router.push('/chores/new')}
            className="h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 active:bg-brand-600"
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        }
      />

      {loading ? (
        <LoadingState label="Kinukuha ang chores…" />
      ) : error && chores.length === 0 ? (
        <View className="px-5">
          <ErrorState message={error} onRetry={() => void refresh()} />
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="gap-6 px-5 pb-10"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor="#2FA396"
            />
          }
        >
          {actionError ? <InlineError message={actionError} /> : null}

          {chores.length === 0 ? (
            <EmptyState
              icon="sparkles-outline"
              title="No chores yet — set up your first one"
              message="Hugas plato, walis, labada… assign it once and Kasama rotates it around the house."
              actionLabel="Add a chore"
              onAction={() => router.push('/chores/new')}
            />
          ) : null}

          {overdue.length > 0 ? (
            <View>
              <SectionTitle>Overdue</SectionTitle>
              <View className="gap-2">
                {overdue.map(({ chore, assignment }) => (
                  <ChoreCard
                    key={assignment.id}
                    chore={chore}
                    assignment={assignment}
                    userId={userId}
                    members={members}
                    busy={busyId === assignment.id}
                    overdue
                    onToggle={handleToggle}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {thisWeek.length > 0 ? (
            <View>
              <SectionTitle>This week</SectionTitle>
              <View className="gap-2">
                {thisWeek.map(({ chore, assignment }) => (
                  <ChoreCard
                    key={assignment.id}
                    chore={chore}
                    assignment={assignment}
                    userId={userId}
                    members={members}
                    busy={busyId === assignment.id}
                    onToggle={handleToggle}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {upcoming.length > 0 ? (
            <View>
              <SectionTitle>Coming up</SectionTitle>
              <View className="gap-2">
                {upcoming.map(({ chore, assignment }) => (
                  <ChoreCard
                    key={assignment.id}
                    chore={chore}
                    assignment={assignment}
                    userId={userId}
                    members={members}
                    busy={busyId === assignment.id}
                    onToggle={handleToggle}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {chores.length > 0 && !hasOpenWork ? (
            <EmptyState
              icon="happy-outline"
              title="Tapos na lahat!"
              message="Every chore on the board is done. New turns appear as they come around."
            />
          ) : null}

          {doneThisWeek.length > 0 ? (
            <View>
              <SectionTitle>Done this week</SectionTitle>
              <View className="gap-2">
                {doneThisWeek.map(({ chore, assignment }) => (
                  <Card key={assignment.id} className="flex-row items-center gap-3 opacity-80">
                    <Ionicons name="checkmark-circle" size={22} color="#218578" />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-ink line-through">
                        {chore.title}
                      </Text>
                      <Text className="text-xs text-ink-muted">
                        {assignment.profile?.display_name ?? 'Housemate'} ·{' '}
                        {formatRelativeDate(assignment.due_date)}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Mark as not done"
                      hitSlop={8}
                      onPress={() => void handleToggle(chore, assignment, false)}
                    >
                      <Text className="text-xs font-semibold text-ink-muted">Undo</Text>
                    </Pressable>
                  </Card>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function ChoreCard({
  chore,
  assignment,
  userId,
  members,
  busy,
  overdue = false,
  onToggle,
}: {
  chore: ChoreWithAssignments;
  assignment: AssignmentWithProfile;
  userId: string | null;
  members: MemberWithProfile[];
  busy: boolean;
  overdue?: boolean;
  onToggle: (
    chore: ChoreWithAssignments,
    assignment: AssignmentWithProfile,
    completed: boolean
  ) => void;
}) {
  const name = assignment.profile?.display_name ?? 'Housemate';
  const isMine = assignment.user_id === userId;

  const upNextId = nextAssigneeId(assignment.user_id, members);
  const upNext = members.find((member) => member.user_id === upNextId);
  const rotates = chore.recurrence !== 'once' && members.length > 1;

  return (
    <View
      className={`rounded-2xl border p-4 ${
        overdue ? 'border-coral-200 bg-coral-50' : 'border-sand-200 bg-white'
      } ${busy ? 'opacity-60' : ''}`}
    >
      <View className="flex-row items-center gap-3">
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: assignment.completed, busy }}
          accessibilityLabel={`Mark ${chore.title} as done`}
          disabled={busy}
          hitSlop={8}
          onPress={() => onToggle(chore, assignment, true)}
          className="h-7 w-7 items-center justify-center rounded-lg border-2 border-brand-400"
        >
          {assignment.completed ? <Ionicons name="checkmark" size={18} color="#218578" /> : null}
        </Pressable>

        <View className="flex-1">
          <Text className="text-base font-bold text-ink">{chore.title}</Text>
          {chore.description ? (
            <Text className="mt-0.5 text-xs text-ink-muted" numberOfLines={2}>
              {chore.description}
            </Text>
          ) : null}
        </View>

        {isMine ? <Badge label="Ikaw" tone="brand" /> : null}
      </View>

      <View className="mt-3 flex-row items-center gap-2 border-t border-sand-200 pt-3">
        <Avatar
          name={name}
          userId={assignment.user_id}
          avatarUrl={assignment.profile?.avatar_url}
          size={26}
        />
        <Text className="text-xs text-ink-soft">
          {isMine ? 'You' : name} · {formatRelativeDate(assignment.due_date)}
        </Text>
        {rotates && upNext ? (
          <>
            <Ionicons name="arrow-forward" size={12} color="#C9BDAD" />
            <Text className="flex-1 text-xs text-ink-muted" numberOfLines={1}>
              Next: {upNext.user_id === userId ? 'you' : upNext.profile.display_name.split(' ')[0]}
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}
