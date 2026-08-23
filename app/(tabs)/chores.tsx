import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

import { nextAssigneeId, openAssignment, setAssignmentCompleted } from '../../src/api/chores';
import { Avatar } from '../../src/components/ui/Avatar';
import { NoteCard } from '../../src/components/ui/NoteCard';
import { Pill } from '../../src/components/ui/Pill';
import { Screen, ScreenHeader, SectionTitle } from '../../src/components/ui/Screen';
import { EmptyState, ErrorState, InlineError } from '../../src/components/ui/States';
import { SwipeRow } from '../../src/components/ui/SwipeRow';
import { messageFrom } from '../../src/hooks/useAsyncData';
import { useChoreStreaks, useChores } from '../../src/hooks/useHouseholdData';
import { useRefreshOnFocus } from '../../src/hooks/useRefreshOnFocus';
import { Fab } from '../../src/components/ui/Fab';
import { ListSkeleton } from '../../src/components/ui/Skeleton';
import { haptics } from '../../src/lib/haptics';
import { duration, easing, pressSmall } from '../../src/lib/motion';
import {
  addDays,
  endOfWeek,
  formatRelativeDate,
  fromDateString,
  startOfWeek,
  toDateString,
  todayString,
  WEEKDAY_INITIALS,
} from '../../src/lib/format';
import { colors, textCap } from '../../src/lib/theme';
import { useCurrentUserId, useHousehold, useMembers } from '../../src/store/useSessionStore';
import type { AssignmentWithProfile, ChoreWithAssignments, MemberWithProfile } from '../../src/types';

/** How long a just-ticked chore stays in place before it moves to "Done". */
const PAYOFF_MS = 1600;

/**
 * What happens at the end of that payoff.
 *
 * A ticked chore doesn't stay where it is: it leaves its section and reappears
 * under "Done this week", and the rows below it close the gap. Without these
 * three the whole screen re-lays-out between two frames, a second and a half
 * after the tap that caused it — which reads as the list glitching rather than
 * as the consequence of ticking a box.
 *
 * `ROW_MOVE` is what does the real work: it's the only motion here the user is
 * meant to follow. The fades are there so a row doesn't wink in and out at the
 * two ends of it.
 *
 * All three defer to the system's reduced-motion setting, where they collapse
 * to the opacity change alone — the row still leaves and arrives, it just
 * doesn't travel.
 */
const ROW_IN = FadeIn.duration(duration.state).reduceMotion(ReduceMotion.System);
const ROW_OUT = FadeOut.duration(duration.state).reduceMotion(ReduceMotion.System);
const ROW_MOVE = LinearTransition.duration(duration.panel)
  .easing(easing.inOut)
  .reduceMotion(ReduceMotion.System);

type Entry = { chore: ChoreWithAssignments; assignment: AssignmentWithProfile };

export default function ChoresScreen() {
  const router = useRouter();
  const userId = useCurrentUserId();
  const household = useHousehold();
  const members = useMembers();
  const { data, loading, refreshing, error, refresh, setData } = useChores();
  const { data: streaks } = useChoreStreaks();

  const [actionError, setActionError] = useState<string | null>(null);
  /** `null` means the whole week — the day strip's leftmost option. */
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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

  /** Every open turn falling on each day of the current week, for the strip. */
  const countsByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of [...thisWeek, ...overdue]) {
      const day = entry.assignment.due_date;
      counts[day] = (counts[day] ?? 0) + 1;
    }
    return counts;
  }, [overdue, thisWeek]);

  // Anything already listed under Overdue is left out — a past day's turns are
  // on screen above, and showing them twice makes the list look longer than the
  // work actually is.
  const selectedEntries = useMemo(
    () =>
      selectedDay
        ? [...thisWeek, ...upcoming].filter(
            (entry) => entry.assignment.due_date === selectedDay
          )
        : [],
    [selectedDay, thisWeek, upcoming]
  );

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

  const renderList = (entries: Entry[], overdueSection = false) => (
    <View className="gap-2.5">
      {entries.map(({ chore, assignment }, index) => (
        <Animated.View
          key={assignment.id}
          layout={ROW_MOVE}
          entering={ROW_IN}
          exiting={ROW_OUT}
        >
          <ChoreCard
            chore={chore}
            assignment={assignment}
            userId={userId}
            members={members}
            overdue={overdueSection || assignment.due_date < today}
            rotate={index % 2 === 0 ? -0.4 : 0.4}
            onEdit={() => router.push({ pathname: '/chores/edit', params: { id: chore.id } })}
            onToggle={handleToggle}
          />
        </Animated.View>
      ))}
    </View>
  );

  return (
    <Screen>
      <ScreenHeader title="Chores" subtitle={household?.name ?? undefined} />

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
              tintColor={colors.moss.DEFAULT}
            />
          }
        >
          {actionError ? <InlineError message={actionError} /> : null}

          {chores.length > 0 ? (
            <View className="gap-4">
              <WeekPicker
                today={today}
                counts={countsByDay}
                selected={selectedDay}
                onSelect={setSelectedDay}
              />
              <StreakRow members={members} streaks={streaks ?? {}} userId={userId} />
            </View>
          ) : null}

          {hasOpenWork ? (
            <View className="-mb-3 flex-row items-center gap-1.5">
              <Ionicons name="hand-left-outline" size={13} color={colors.ink.muted} />
              <Text className="flex-1 font-ui text-xs text-ink-muted">
                Tap the box — or swipe a chore across — to tick it off.
              </Text>
            </View>
          ) : null}

          {chores.length === 0 ? (
            <EmptyState
              icon="sparkles-outline"
              title="No chores yet"
              message="Dishes, sweeping, laundry — assign it once and Kasama rotates it around the house."
              actionLabel="Add a chore"
              onAction={() => router.push('/chores/new')}
            />
          ) : null}

          {/* Overdue never hides behind a day: something three days late is the
              one thing that has to stay on screen whichever day you tapped. */}
          {overdue.length > 0 ? (
            <View>
              <SectionTitle>Overdue</SectionTitle>
              {renderList(overdue, true)}
            </View>
          ) : null}

          {selectedDay ? (
            <View>
              <SectionTitle>{formatRelativeDate(selectedDay)}</SectionTitle>
              {selectedEntries.length > 0 ? (
                renderList(selectedEntries)
              ) : selectedDay >= today ? (
                <EmptyState
                  compact
                  icon="cafe-outline"
                  title="Nothing scheduled"
                  message="Nothing falls on this day. Enjoy it."
                />
              ) : null}
            </View>
          ) : (
            <>
              {thisWeek.length > 0 ? (
                <View>
                  <SectionTitle>This week</SectionTitle>
                  {renderList(thisWeek)}
                </View>
              ) : null}

              {upcoming.length > 0 ? (
                <View>
                  <SectionTitle>Coming up</SectionTitle>
                  {renderList(upcoming)}
                </View>
              ) : null}
            </>
          )}

          {chores.length > 0 && !hasOpenWork ? (
            <EmptyState
              icon="happy-outline"
              title="All done"
              message="Every chore on the board is done. New turns appear as they come around."
            />
          ) : null}

          {doneThisWeek.length > 0 ? (
            <View>
              <SectionTitle>Done this week</SectionTitle>
              <View className="gap-2.5">
                {doneThisWeek.map(({ chore, assignment }) => (
                  <Animated.View
                    key={assignment.id}
                    layout={ROW_MOVE}
                    entering={ROW_IN}
                    exiting={ROW_OUT}
                  >
                    <NoteCard className="flex-row items-center gap-3 opacity-80">
                      <Ionicons name="checkmark-circle" size={22} color={colors.deep.sage} />
                      <View className="flex-1">
                        <Text className="font-ui-semibold text-sm text-ink line-through">
                          {chore.title}
                        </Text>
                        <Text className="font-mono text-[11px] text-ink-muted">
                          {assignment.profile?.display_name ?? 'Housemate'} ·{' '}
                          {formatRelativeDate(assignment.due_date)}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Mark ${chore.title} as not done`}
                        hitSlop={12}
                        onPress={() => void handleToggle(chore, assignment, false)}
                        className={`min-h-[44px] justify-center px-2 ${pressSmall}`}
                      >
                        <Text className="font-ui-semibold text-xs text-ink-muted">Undo</Text>
                      </Pressable>
                    </NoteCard>
                  </Animated.View>
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

/**
 * The current week as seven cells, with the whole week as the leading option.
 *
 * It filters rather than scrolls: on a household with a daily rotation the
 * unfiltered list runs well past a screen, and "what's on for Thursday" is the
 * question a rota actually gets asked. Tapping the selected day again returns
 * to the whole week, so the filter can't strand anyone.
 */
function WeekPicker({
  today,
  counts,
  selected,
  onSelect,
}: {
  today: string;
  counts: Record<string, number>;
  selected: string | null;
  onSelect: (day: string | null) => void;
}) {
  const days = useMemo(() => {
    const monday = startOfWeek();
    return Array.from({ length: 7 }, (_, index) => toDateString(addDays(monday, index)));
  }, []);

  return (
    <View className="flex-row items-stretch gap-1.5">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: selected === null }}
        accessibilityLabel="Show the whole week"
        onPress={() => {
          haptics.select();
          onSelect(null);
        }}
        className={`min-h-[56px] items-center justify-center rounded-xl border px-2.5 ${pressSmall} ${
          selected === null ? 'border-moss bg-moss' : 'border-line bg-paper'
        }`}
      >
        {/* A glyph rather than the two stacked words this used to be: seven
            day cells and a text label do not share a row at any text size
            above the default, and "All week" was the first thing to clip. */}
        <Ionicons
          name="calendar-outline"
          size={18}
          color={selected === null ? colors.paper : colors.ink.muted}
        />
        <Text
          className={`mt-0.5 font-ui-bold text-[11px] uppercase tracking-wider ${
            selected === null ? 'text-paper' : 'text-ink-muted'
          }`}
          numberOfLines={1}
          maxFontSizeMultiplier={textCap.grid}
        >
          All
        </Text>
      </Pressable>

      {days.map((day, index) => {
        const isSelected = day === selected;
        const isToday = day === today;
        const count = counts[day] ?? 0;

        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${formatRelativeDate(day)}, ${count} ${
              count === 1 ? 'chore' : 'chores'
            }`}
            onPress={() => {
              haptics.select();
              onSelect(isSelected ? null : day);
            }}
            className={`min-h-[56px] flex-1 items-center justify-center gap-0.5 rounded-xl border ${pressSmall} ${
              isSelected
                ? 'border-moss bg-moss'
                : isToday
                  ? 'border-moss-light bg-paper'
                  : 'border-line bg-paper'
            }`}
          >
            {/* Seven cells share the width of the screen, so nothing in here
                is allowed to grow much: the accessible label on the cell
                spells the day and its count out in full for anyone who needs
                it larger than this can go. */}
            <Text
              className={`font-ui-bold text-[11px] uppercase ${
                isSelected ? 'text-paper/80' : 'text-ink-muted'
              }`}
              maxFontSizeMultiplier={textCap.grid}
            >
              {WEEKDAY_INITIALS[index]}
            </Text>
            <Text
              className={`font-mono-bold text-sm ${isSelected ? 'text-paper' : 'text-ink'}`}
              maxFontSizeMultiplier={textCap.grid}
            >
              {fromDateString(day).getDate()}
            </Text>
            {/* A dot rather than a number: at this width a count is illegible,
                and the row underneath says exactly how many. */}
            <View
              className={`h-1.5 w-1.5 rounded-full ${
                count === 0 ? 'bg-transparent' : isSelected ? 'bg-mustard' : 'bg-moss-light'
              }`}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Per-housemate streaks — consecutive finished turns, counted by the
 * `chore_streaks` view.
 *
 * Deliberately understated: a leaderboard between people who share a kitchen
 * turns a chore rota into a scoreboard, and nobody wants to lose one at home.
 */
function StreakRow({
  members,
  streaks,
  userId,
}: {
  members: MemberWithProfile[];
  streaks: Record<string, number>;
  userId: string | null;
}) {
  const withStreaks = members.filter((member) => (streaks[member.user_id] ?? 0) > 0);
  if (withStreaks.length === 0) return null;

  return (
    <NoteCard tape={colors.sage} className="gap-3 pt-5">
      <Text className="font-ui-bold text-[11px] uppercase tracking-[1.2px] text-ink-muted">
        On a roll
      </Text>
      <View className="flex-row flex-wrap gap-x-4 gap-y-3">
        {withStreaks.map((member) => {
          const streak = streaks[member.user_id] ?? 0;
          const name =
            member.user_id === userId ? 'You' : member.profile.display_name.split(' ')[0];

          return (
            <View key={member.id} className="flex-row items-center gap-2">
              <Avatar
                name={member.profile.display_name}
                userId={member.user_id}
                avatarUrl={member.profile.avatar_url}
                size={28}
              />
              <View>
                <Text className="font-ui-semibold text-xs text-ink" numberOfLines={1}>
                  {name}
                </Text>
                <View className="flex-row items-center gap-1">
                  <Ionicons name="flame" size={11} color={colors.deep.mustard} />
                  <Text className="font-mono-bold text-[11px] text-deep-mustard">
                    {streak} in a row
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </NoteCard>
  );
}

/** The one handwritten note on the screen: this turn is yours. */
function TurnTag() {
  return (
    <View
      className="rounded-md bg-mustard px-2.5 py-0.5"
      style={{ transform: [{ rotate: '-3deg' }] }}
    >
      <Text
        className="font-hand-bold text-base leading-5 text-ink"
        maxFontSizeMultiplier={textCap.inline}
      >
        your turn
      </Text>
    </View>
  );
}

function ChoreCard({
  chore,
  assignment,
  userId,
  members,
  overdue = false,
  rotate = 0,
  onEdit,
  onToggle,
}: {
  chore: ChoreWithAssignments;
  assignment: AssignmentWithProfile;
  userId: string | null;
  members: MemberWithProfile[];
  overdue?: boolean;
  rotate?: number;
  onEdit: () => void;
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

  const tape = done ? colors.sage : overdue ? colors.brick : isMine ? colors.mustard : colors.moss.light;

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
      <NoteCard
        tape={tape}
        rotate={rotate}
        className={`pt-5 ${done ? 'bg-wash-sage' : overdue ? 'bg-wash-brick' : ''}`}
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={`${chore.title}, ${done ? 'done' : 'not done'}`}
            accessibilityHint="Double tap to switch between done and not done"
            hitSlop={16}
            onPress={() => onToggle(chore, assignment, !done)}
            className={`h-8 w-8 items-center justify-center rounded-lg border-2 ${pressSmall} ${
              done ? 'border-moss bg-moss' : 'border-moss-light active:bg-wash-sage'
            }`}
          >
            {/* The tick is always mounted, at nothing-yet size, so that
                checking the box has something to animate from — a glyph that
                only appears once it is already checked has no way to arrive.
                Its box fills instantly underneath: the fill is the app saying
                "got it", and delaying that by even 150ms is the one latency
                the finger notices. The tick is the part worth watching, and it
                grows into a box that has already turned. */}
            <View
              // The property list is spelled out rather than left as a bare
              // `transition`: that one compiles to twenty-two properties, and
              // naming the two that actually change here is the difference
              // between a transition and a standing invitation to animate
              // whatever this view is restyled with next.
              className={`transition-[opacity,scaleX,scaleY] duration-150 ease-out-strong ${
                done ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
              }`}
            >
              <Ionicons name="checkmark" size={20} color={colors.paper} />
            </View>
          </Pressable>

          <View className="flex-1">
            <Text
              className={`font-ui-bold text-base ${done ? 'text-ink-soft line-through' : 'text-ink'}`}
            >
              {chore.title}
            </Text>
            {chore.description ? (
              <Text className="mt-0.5 font-ui text-xs text-ink-muted" numberOfLines={2}>
                {chore.description}
              </Text>
            ) : null}
          </View>

          {done ? (
            <Pill label="Done" tone="ok" icon="checkmark-circle" />
          ) : overdue ? (
            <Pill label="Overdue" tone="alert" icon="alert-circle" />
          ) : isMine ? (
            <TurnTag />
          ) : null}
        </View>

        <View className="mt-3 flex-row items-center gap-2 border-t border-line pt-3">
          <Avatar
            name={name}
            userId={assignment.user_id}
            avatarUrl={assignment.profile?.avatar_url}
            size={26}
          />
          <Text className="font-mono text-[11px] text-ink-soft">
            {isMine ? 'You' : name} · {formatRelativeDate(assignment.due_date)}
          </Text>
          {rotates && upNext ? (
            <>
              <Ionicons name="arrow-forward" size={12} color={colors.ink.faint} />
              <Text className="flex-1 font-ui text-xs text-ink-muted" numberOfLines={1}>
                Next: {upNext.user_id === userId ? 'you' : upNext.profile.display_name.split(' ')[0]}
              </Text>
            </>
          ) : (
            <View className="flex-1" />
          )}
          {/* Edit lives on this row rather than beside the title: the checkbox
              already owns the top of the card, and a second control up there
              turns ticking a chore off into a game of aim. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${chore.title}`}
            hitSlop={12}
            onPress={() => {
              haptics.tap();
              onEdit();
            }}
            className={`-my-2 h-9 w-9 items-center justify-center rounded-full ${pressSmall} active:bg-page`}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={colors.ink.muted} />
          </Pressable>
        </View>
      </NoteCard>
    </SwipeRow>
  );
}
