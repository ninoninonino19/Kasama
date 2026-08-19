import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { nextAssigneeId, openAssignment, setAssignmentCompleted } from '../../src/api/chores';
import { Avatar } from '../../src/components/ui/Avatar';
import { Badge } from '../../src/components/ui/Chip';
import { Card } from '../../src/components/ui/Card';
import { Screen, ScreenHeader, SectionTitle } from '../../src/components/ui/Screen';
import { EmptyState, ErrorState, InlineError } from '../../src/components/ui/States';
import { SwipeRow } from '../../src/components/ui/SwipeRow';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { useChores } from '../../src/hooks/useHouseholdData';
import { useRefreshOnFocus } from '../../src/hooks/useRefreshOnFocus';
import { Fab } from '../../src/components/ui/Fab';
import { ListSkeleton } from '../../src/components/ui/Skeleton';
import { haptics } from '../../src/lib/haptics';
import { endOfWeek, formatRelativeDate, startOfWeek, toDateString, todayString } from '../../src/lib/format';
import { colors } from '../../src/lib/theme';
import { useCurrentUserId, useMembers } from '../../src/store/useSessionStore';
import type { AssignmentWithProfile, ChoreWithAssignments, MemberWithProfile } from '../../src/types';

/** How long a just-ticked chore stays in place before it moves to "Done". */
const PAYOFF_MS = 1600;

export default function ChoresScreen() {
  const router = useRouter();
  const userId = useCurrentUserId();
  const members = useMembers();
  const { data, loading, refreshing, error, refresh, setData } = useChores();

  const [actionError, setActionError] = useState<string | null>(null);
  // Assignments ticked in the last moment. They stay in their original section,
  // struck through, instead of vanishing into "Done this week" the instant the
  // box is tapped — the brief asks for a visible payoff, and a row that
  // disappears under your thumb reads as a mis-tap.
  const [celebrating, setCelebrating] = useState<string[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    []
  );

  useRefreshOnFocus(refresh);

  const chores = useMemo(() => data ?? [], [data]);

  const weekEnd = toDateString(endOfWeek());
  const today = todayString();

  const { overdue, thisWeek, upcoming } = useMemo(() => {
    const open = chores
      .flatMap((chore) => {
        const next = openAssignment(chore);
        const held = chore.assignments.filter(
          (assignment) => assignment.completed && celebrating.includes(assignment.id)
        );
        return [
          ...held.map((assignment) => ({ chore, assignment })),
          ...(next ? [{ chore, assignment: next }] : []),
        ];
      })
      .sort((a, b) => a.assignment.due_date.localeCompare(b.assignment.due_date));

    return {
      overdue: open.filter((entry) => entry.assignment.due_date < today),
      thisWeek: open.filter(
        (entry) => entry.assignment.due_date >= today && entry.assignment.due_date <= weekEnd
      ),
      upcoming: open.filter((entry) => entry.assignment.due_date > weekEnd),
    };
  }, [celebrating, chores, today, weekEnd]);

  const doneThisWeek = useMemo(() => {
    const from = toDateString(startOfWeek());
    return chores
      .flatMap((chore) => chore.assignments.map((assignment) => ({ chore, assignment })))
      .filter(
        ({ assignment }) =>
          assignment.completed &&
          !celebrating.includes(assignment.id) &&
          assignment.due_date >= from &&
          assignment.due_date <= weekEnd
      );
  }, [celebrating, chores, weekEnd]);

  /**
   * Ticks the box straight away rather than after the round trip — completing a
   * chore should feel instant. The server may also queue the next turn in the
   * rotation, so a silent refetch follows either way.
   */
  const handleToggle = useCallback(
    async (chore: ChoreWithAssignments, assignment: AssignmentWithProfile, completed: boolean) => {
      haptics.select();
      setActionError(null);

      if (completed) {
        setCelebrating((current) =>
          current.includes(assignment.id) ? current : [...current, assignment.id]
        );
        timers.current.push(
          setTimeout(
            () => setCelebrating((current) => current.filter((id) => id !== assignment.id)),
            PAYOFF_MS
          )
        );
      } else {
        setCelebrating((current) => current.filter((id) => id !== assignment.id));
      }

      setData(
        (current) =>
          current?.map((entry) =>
            entry.id === chore.id
              ? {
                  ...entry,
                  assignments: entry.assignments.map((item) =>
                    item.id === assignment.id
                      ? {
                          ...item,
                          completed,
                          completed_at: completed ? new Date().toISOString() : null,
                        }
                      : item
                  ),
                }
              : entry
          ) ?? current
      );

      try {
        await setAssignmentCompleted(chore, assignment, completed, members);
        if (completed) haptics.success();
        await refresh({ silent: true });
      } catch (caught) {
        haptics.error();
        setActionError(messageFrom(caught));
        await refresh({ silent: true });
      }
    },
    [members, refresh, setData]
  );

  const hasOpenWork = overdue.length + thisWeek.length + upcoming.length > 0;
  // Rows held for the payoff moment are already done, so they shouldn't count
  // towards "still to do" in the header.
  const stillDue = [...overdue, ...thisWeek].filter(({ assignment }) => !assignment.completed).length;

  return (
    <Screen>
      <ScreenHeader
        title="Chores"
        subtitle={
          stillDue > 0
            ? `${stillDue} due this week`
            : 'Walang pending — salamat, mga kasama!'
        }
      />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : error && chores.length === 0 ? (
        <View className="px-5">
          <ErrorState message={error} onRetry={() => void refresh()} />
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="gap-6 px-5 pb-28"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.brand[500]}
            />
          }
        >
          {actionError ? <InlineError message={actionError} /> : null}

          {hasOpenWork ? (
            <View className="-mb-3 flex-row items-center gap-1.5">
              <Ionicons name="hand-left-outline" size={13} color={colors.ink.muted} />
              <Text className="flex-1 text-xs text-ink-muted">
                Tap the box — or swipe a chore across — to tick it off.
              </Text>
            </View>
          ) : null}

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
                    <Ionicons name="checkmark-circle" size={22} color={colors.brand[600]} />
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
                      accessibilityLabel={`Mark ${chore.title} as not done`}
                      hitSlop={12}
                      onPress={() => void handleToggle(chore, assignment, false)}
                      className="min-h-[44px] justify-center px-2"
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

      <Fab accessibilityLabel="Add a chore" onPress={() => router.push('/chores/new')} />
    </Screen>
  );
}

function ChoreCard({
  chore,
  assignment,
  userId,
  members,
  overdue = false,
  onToggle,
}: {
  chore: ChoreWithAssignments;
  assignment: AssignmentWithProfile;
  userId: string | null;
  members: MemberWithProfile[];
  overdue?: boolean;
  onToggle: (
    chore: ChoreWithAssignments,
    assignment: AssignmentWithProfile,
    completed: boolean
  ) => void;
}) {
  const name = assignment.profile?.display_name ?? 'Housemate';
  const isMine = assignment.user_id === userId;
  const done = assignment.completed;

  const upNextId = nextAssigneeId(assignment.user_id, members);
  const upNext = members.find((member) => member.user_id === upNextId);
  const rotates = chore.recurrence !== 'once' && members.length > 1;

  return (
    <SwipeRow
      left={
        done
          ? undefined
          : {
              label: 'Done',
              icon: 'checkmark-circle',
              tone: 'moss',
              onTrigger: () => onToggle(chore, assignment, true),
            }
      }
      right={
        done
          ? {
              label: 'Undo',
              icon: 'arrow-undo',
              tone: 'muted',
              onTrigger: () => onToggle(chore, assignment, false),
            }
          : undefined
      }
    >
      <View
        className={`rounded-2xl border p-4 ${
          done
            ? 'border-brand-200 bg-brand-50'
            : overdue
              ? 'border-coral-200 bg-coral-50'
              : 'border-sand-200 bg-white'
        }`}
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={`${chore.title}, ${done ? 'done' : 'not done'}`}
            accessibilityHint="Double tap to switch between done and not done"
            hitSlop={16}
            onPress={() => onToggle(chore, assignment, !done)}
            className={`h-8 w-8 items-center justify-center rounded-lg border-2 ${
              done ? 'border-brand-500 bg-brand-500' : 'border-brand-400 active:bg-brand-100'
            }`}
          >
            {done ? <Ionicons name="checkmark" size={20} color={colors.white} /> : null}
          </Pressable>

          <View className="flex-1">
            <Text
              className={`text-base font-bold ${done ? 'text-ink-soft line-through' : 'text-ink'}`}
            >
              {chore.title}
            </Text>
            {chore.description ? (
              <Text className="mt-0.5 text-xs text-ink-muted" numberOfLines={2}>
                {chore.description}
              </Text>
            ) : null}
          </View>

          {done ? (
            <Badge label="Tapos!" tone="success" icon="checkmark-circle" />
          ) : overdue ? (
            <Badge label="Overdue" tone="danger" icon="alert-circle" />
          ) : isMine ? (
            <Badge label="Ikaw" tone="brand" />
          ) : null}
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
              <Ionicons name="arrow-forward" size={12} color={colors.ink.faint} />
              <Text className="flex-1 text-xs text-ink-muted" numberOfLines={1}>
                Next: {upNext.user_id === userId ? 'you' : upNext.profile.display_name.split(' ')[0]}
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </SwipeRow>
  );
}
