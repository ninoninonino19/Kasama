import { useCallback, useMemo } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { isBillSettled } from '../../src/api/bills';
import { openAssignment } from '../../src/api/chores';
import { MonthBalanceCard } from '../../src/components/MonthBalanceCard';
import { Avatar } from '../../src/components/ui/Avatar';
import { NoteCard } from '../../src/components/ui/NoteCard';
import { Pill } from '../../src/components/ui/Pill';
import { Screen, SectionTitle } from '../../src/components/ui/Screen';
import { EmptyState, ErrorState } from '../../src/components/ui/States';
import { DashboardSkeleton } from '../../src/components/ui/Skeleton';
import {
  useAnnouncements,
  useBills,
  useChores,
  useMyLeaveRequest,
  useOpenLeaveRequests,
} from '../../src/hooks/useHouseholdData';
import { useRefreshOnFocus } from '../../src/hooks/useRefreshOnFocus';
import { formatRelativeDate, formatTimeAgo, todayString } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { press, pressSmall } from '../../src/lib/motion';
import { colors, tapeColorFor } from '../../src/lib/theme';
import { useCurrentUserId, useHousehold, useMembers, useProfile } from '../../src/store/useSessionStore';
import type {
  AssignmentWithProfile,
  ChoreWithAssignments,
  MemberWithProfile,
} from '../../src/types';

export default function HomeScreen() {
  const router = useRouter();
  const household = useHousehold();
  const profile = useProfile();
  const members = useMembers();
  const userId = useCurrentUserId();

  const bills = useBills();
  const chores = useChores();
  const announcements = useAnnouncements(3);
  const openRequests = useOpenLeaveRequests();
  const myRequest = useMyLeaveRequest();

  const loading = bills.loading || chores.loading || announcements.loading;
  const refreshing = bills.refreshing || chores.refreshing || announcements.refreshing;
  const error = bills.error ?? chores.error ?? announcements.error;

  const today = todayString();

  /**
   * The one chore the dashboard leads with: mine and due, if I have one —
   * otherwise whatever the house owes next. A dashboard that opens on someone
   * else's Thursday laundry when your own dishes are two days late is worse
   * than no card at all.
   */
  const todaysChore = useMemo(() => {
    const open = (chores.data ?? [])
      .map((chore) => ({ chore, assignment: openAssignment(chore) }))
      .filter((entry): entry is { chore: ChoreWithAssignments; assignment: AssignmentWithProfile } =>
        Boolean(entry.assignment)
      )
      .sort((a, b) => a.assignment.due_date.localeCompare(b.assignment.due_date));

    const mineAndDue = open.find(
      (entry) => entry.assignment.user_id === userId && entry.assignment.due_date <= today
    );
    return mineAndDue ?? open[0] ?? null;
  }, [chores.data, today, userId]);

  /**
   * Requests waiting on the person reading this, and the state of their own.
   *
   * The dashboard is the only screen everybody opens, and a request nobody
   * answers holds up a housemate indefinitely — so it gets a line here rather
   * than living only in a settings screen people visit twice a year. Yours is
   * separate: waiting on a vote isn't a thing to answer, it's a thing to know.
   */
  const toAnswer = useMemo(
    () =>
      (openRequests.data ?? []).filter(
        (request) =>
          request.user_id !== userId &&
          // Already answered, so it is not asking anything of you any more.
          !request.votes.some((vote) => vote.voter_id === userId)
      ),
    [openRequests.data, userId]
  );

  const myRequestPending = myRequest.data?.status === 'pending';

  const latestPost = (announcements.data ?? [])[0] ?? null;
  const unpaidCount = useMemo(
    () => (bills.data ?? []).filter((bill) => !isBillSettled(bill)).length,
    [bills.data]
  );

  // A household with nothing in it at all gets one "here's how this works"
  // card instead of three stacked empty states, which read as a broken screen.
  const isFreshHousehold =
    !loading &&
    (bills.data ?? []).length === 0 &&
    (chores.data ?? []).length === 0 &&
    (announcements.data ?? []).length === 0;

  // Depend on the refresh functions themselves, which useAsyncData keeps stable.
  // Depending on the hook results instead gives this callback a new identity on
  // every render, which turns the focus effect below into a refetch loop.
  const refreshBills = bills.refresh;
  const refreshChores = chores.refresh;
  const refreshAnnouncements = announcements.refresh;

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshBills({ silent: true }),
      refreshChores({ silent: true }),
      refreshAnnouncements({ silent: true }),
    ]);
  }, [refreshBills, refreshChores, refreshAnnouncements]);

  // The dashboard summarises the other three tabs, so it goes stale the fastest.
  useRefreshOnFocus(refreshAll);

  const firstName = profile?.display_name.split(' ')[0] ?? 'there';

  return (
    <Screen>
      <ScrollView
        contentContainerClassName="gap-6 px-5 pb-24 pt-2"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void Promise.all([refreshBills(), refreshChores(), refreshAnnouncements()]);
            }}
            tintColor={colors.moss.DEFAULT}
          />
        }
      >
        {/* Greeting ------------------------------------------------- */}
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="font-ui text-sm text-ink-muted">{greeting()},</Text>
            {/* Someone's name in their own house — the clearest case in the
                app for the handwritten face. */}
            <Text className="font-hand-bold text-4xl leading-[42px] text-ink" numberOfLines={1}>
              {firstName}!
            </Text>
            <Text className="mt-0.5 font-ui text-sm text-ink-soft" numberOfLines={1}>
              {household?.name ?? 'Your household'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => {
              haptics.tap();
              router.push('/settings/account');
            }}
            className={`h-11 w-11 items-center justify-center rounded-xl border border-line bg-paper ${pressSmall} active:bg-page`}
          >
            {/* A cog, not a face. The avatar row directly below is already the
                app's picture of a person, and two person glyphs a few points
                apart read as the same control twice. */}
            <Ionicons name="settings-outline" size={22} color={colors.ink.soft} />
          </Pressable>
        </View>

        <HousemateRow
          members={members}
          userId={userId}
          onPress={() => router.push('/settings/household')}
        />

        {/* Above everything the dashboard normally leads with, because it is
            the only thing on it that somebody else is waiting on. */}
        {toAnswer.length > 0 ? (
          <LeaveNotice
            tone="ask"
            icon="exit-outline"
            title={
              toAnswer.length === 1
                ? `${toAnswer[0].profile?.display_name.split(' ')[0] ?? 'A housemate'} wants to leave`
                : `${toAnswer.length} housemates want to leave`
            }
            message="Check what's still outstanding between you, then accept or decline."
            onPress={() => router.push('/settings/household')}
          />
        ) : myRequestPending ? (
          <LeaveNotice
            tone="waiting"
            icon="hourglass-outline"
            title="Your housemates are deciding"
            message="You'll leave once everyone has accepted. Nothing has changed yet."
            onPress={() => router.push('/settings/household')}
          />
        ) : null}

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {error ? <ErrorState message={error} onRetry={() => void refreshAll()} /> : null}

            {isFreshHousehold ? (
              <GetStarted
                onAddBill={() => router.push('/bills/new')}
                onAddChore={() => router.push('/chores/new')}
                onPost={() => router.navigate('/(tabs)/announcements')}
              />
            ) : (
              <>
                {/* Money --------------------------------------------- */}
                {/* One card, not two. "Where you stand" and "next bill due"
                    were always halves of the same question — how much is left
                    and what is coming — and split across two cards the
                    dashboard answered it twice, in two different units. */}
                {userId ? (
                  <View>
                    <View className="mb-2 flex-row items-center justify-between">
                      <SectionTitle className="mb-0">This month</SectionTitle>
                      {unpaidCount > 1 ? (
                        // 11pt uppercase is a small thing to hit, and it sits
                        // in the corner of a section header where a thumb has
                        // nothing else to aim at.
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={12}
                          onPress={() => router.navigate('/(tabs)/bills')}
                          className={`${pressSmall} active:opacity-60`}
                        >
                          <Text className="font-ui-bold text-[11px] uppercase tracking-wider text-moss">
                            {unpaidCount - 1} more
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {(bills.data ?? []).length > 0 ? (
                      <MonthBalanceCard
                        bills={bills.data ?? []}
                        userId={userId}
                        compact
                        onPressBill={(bill) => router.push(`/bills/${bill.id}`)}
                      />
                    ) : (
                      <EmptyState
                        compact
                        icon="receipt-outline"
                        title="No bills yet"
                        message="Add one when the next electricity or internet bill arrives."
                        actionLabel="Add a bill"
                        onAction={() => router.push('/bills/new')}
                      />
                    )}
                  </View>
                ) : null}

                {/* Today's chore ------------------------------------- */}
                <View>
                  <SectionTitle>Today on the board</SectionTitle>
                  {todaysChore ? (
                    <TodaysChoreCard
                      chore={todaysChore.chore}
                      assignment={todaysChore.assignment}
                      userId={userId}
                      today={today}
                      onPress={() => router.navigate('/(tabs)/chores')}
                    />
                  ) : (
                    <EmptyState
                      compact
                      icon="checkmark-done-outline"
                      title="No chores lined up"
                      message="Set up a rotation so nobody has to track whose turn it is."
                      actionLabel="Add a chore"
                      onAction={() => router.push('/chores/new')}
                    />
                  )}
                </View>

                {/* Latest from the board ----------------------------- */}
                <View>
                  <View className="mb-2 flex-row items-center justify-between">
                    {/* Not "latest": the feed puts pinned notes first, so the
                        note leading the board may well be an older one. */}
                    <SectionTitle className="mb-0">On the board</SectionTitle>
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={12}
                      onPress={() => router.navigate('/(tabs)/announcements')}
                      className={`${pressSmall} active:opacity-60`}
                    >
                      <Text className="font-ui-bold text-[11px] uppercase tracking-wider text-moss">
                        See all
                      </Text>
                    </Pressable>
                  </View>

                  {latestPost ? (
                    <NoteCard
                      onPress={() => router.navigate('/(tabs)/announcements')}
                      tape={tapeColorFor(latestPost.id, latestPost.tape_color)}
                      rotate={-0.5}
                      className="pt-5"
                    >
                      <View className="flex-row items-center gap-2">
                        <Avatar
                          name={latestPost.profile?.display_name ?? 'Housemate'}
                          userId={latestPost.user_id}
                          avatarUrl={latestPost.profile?.avatar_url}
                          size={24}
                        />
                        <Text className="flex-1 font-ui-semibold text-xs text-ink-soft">
                          {latestPost.profile?.display_name ?? 'Housemate'}
                        </Text>
                        {latestPost.pinned ? (
                          <Ionicons name="pin" size={11} color={colors.deep.mustard} />
                        ) : null}
                        <Text className="font-mono text-[11px] text-ink-muted">
                          {formatTimeAgo(latestPost.created_at)}
                        </Text>
                      </View>
                      <Text className="mt-2 font-hand text-2xl leading-8 text-ink" numberOfLines={3}>
                        {latestPost.content}
                      </Text>
                    </NoteCard>
                  ) : (
                    <EmptyState
                      compact
                      icon="reader-outline"
                      title="Nothing on the board"
                      message="Post a quick update so everyone knows what's happening at home."
                      actionLabel="Open the board"
                      onAction={() => router.navigate('/(tabs)/announcements')}
                    />
                  )}
                </View>
              </>
            )}
          </>
        )}

        {/* Quick actions ----------------------------------------------- */}
        {/* Home has no FAB, so these are the two doors out of the dashboard —
            and they sit at the end of it. Everything above is the house
            reporting in; adding something is what you do once you've read it,
            so the summary gets the top of the screen and the actions close the
            page.

            Outside every branch above on purpose: they are the same two doors
            whether the house is brand new, still loading, or failed to load,
            and a dashboard you can't add anything from is the one state where
            they matter most. */}
        <View className="flex-row gap-3">
          <QuickAction
            icon="receipt-outline"
            label="Add a bill"
            onPress={() => router.push('/bills/new')}
          />
          <QuickAction
            icon="checkmark-done-outline"
            label="Add a chore"
            onPress={() => router.push('/chores/new')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * Who else lives here, as a row of overlapping faces.
 *
 * Overlapping rather than spaced: a shared household is six people, not six
 * list rows, and the pile-of-photos shape says "us" faster than any label. The
 * paper ring on each avatar is what keeps the pile legible.
 */
/**
 * The one-line notice a leave request gets on the dashboard.
 *
 * A row rather than a card: it has to be impossible to scroll past and not
 * worth reading twice, and the decision itself belongs on the screen that can
 * show the money behind it. Two tones, because the two states are opposite
 * kinds of news — something is being asked of you, or something is being
 * decided about you.
 */
function LeaveNotice({
  tone,
  icon,
  title,
  message,
  onPress,
}: {
  tone: 'ask' | 'waiting';
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  onPress: () => void;
}) {
  const asking = tone === 'ask';
  const tint = asking ? colors.deep.brick : colors.deep.mustard;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${message}`}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      className={`flex-row items-center gap-3 rounded-2xl border p-4 ${press} ${
        asking
          ? 'border-brick/40 bg-wash-brick active:bg-wash-brick/70'
          : 'border-mustard/50 bg-wash-mustard active:bg-wash-mustard/70'
      }`}
    >
      <Ionicons name={icon} size={20} color={tint} />
      <View className="flex-1">
        <Text className={`font-ui-bold text-sm ${asking ? 'text-deep-brick' : 'text-deep-mustard'}`}>
          {title}
        </Text>
        <Text
          className={`mt-0.5 font-ui text-xs leading-5 ${
            asking ? 'text-deep-brick' : 'text-deep-mustard'
          }`}
        >
          {message}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={tint} />
    </Pressable>
  );
}

function HousemateRow({
  members,
  userId,
  onPress,
}: {
  members: MemberWithProfile[];
  userId: string | null;
  onPress: () => void;
}) {
  if (members.length === 0) return null;

  const shown = members.slice(0, 6);
  const extra = members.length - shown.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${members.length} housemates. Opens household settings.`}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      className={`flex-row items-center gap-3 ${press} active:opacity-80`}
    >
      <View className="flex-row">
        {shown.map((member, index) => (
          <View key={member.id} style={index === 0 ? null : { marginLeft: -10 }}>
            <Avatar
              name={member.profile.display_name}
              userId={member.user_id}
              avatarUrl={member.profile.avatar_url}
              size={34}
            />
          </View>
        ))}
        {extra > 0 ? (
          <View
            className="h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-paper bg-page"
            style={{ marginLeft: -10 }}
          >
            <Text className="font-ui-bold text-[11px] text-ink-muted">+{extra}</Text>
          </View>
        ) : null}
      </View>
      <Text className="flex-1 font-ui text-xs text-ink-muted" numberOfLines={1}>
        {members.length === 1
          ? "Just you so far — invite your housemates"
          : `You and ${members.length - 1} ${members.length === 2 ? 'housemate' : 'housemates'}`}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.ink.faint} />
    </Pressable>
  );
}

function TodaysChoreCard({
  chore,
  assignment,
  userId,
  today,
  onPress,
}: {
  chore: ChoreWithAssignments;
  assignment: AssignmentWithProfile;
  userId: string | null;
  today: string;
  onPress: () => void;
}) {
  const isMine = assignment.user_id === userId;
  const overdue = assignment.due_date < today;
  const name = assignment.profile?.display_name ?? 'Housemate';

  return (
    <NoteCard
      onPress={onPress}
      tape={overdue ? colors.brick : isMine ? colors.mustard : colors.moss.light}
      rotate={-0.4}
      className={`pt-5 ${overdue ? 'bg-wash-brick' : ''}`}
    >
      <View className="flex-row items-center gap-3">
        <Avatar
          name={name}
          userId={assignment.user_id}
          avatarUrl={assignment.profile?.avatar_url}
          size={38}
        />
        <View className="flex-1">
          <Text className="font-ui-bold text-base text-ink" numberOfLines={1}>
            {chore.title}
          </Text>
          <Text className="mt-0.5 font-mono text-[11px] text-ink-muted" numberOfLines={1}>
            {isMine ? 'You' : name} · {formatRelativeDate(assignment.due_date)}
          </Text>
        </View>
        {overdue ? (
          <Pill label="Overdue" tone="alert" icon="alert-circle" />
        ) : isMine ? (
          <View
            className="rounded-md bg-mustard px-2.5 py-0.5"
            style={{ transform: [{ rotate: '-3deg' }] }}
          >
            <Text className="font-hand-bold text-base leading-5 text-ink">your turn</Text>
          </View>
        ) : null}
      </View>
    </NoteCard>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      className={`min-h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 ${press} active:bg-page`}
    >
      <Ionicons name={icon} size={18} color={colors.moss.DEFAULT} />
      <Text className="font-ui-bold text-sm text-ink">{label}</Text>
    </Pressable>
  );
}

/**
 * First-run panel. A brand-new household has nothing to summarise, so rather
 * than three empty sections it gets one card that says what the app is for and
 * points at the two things worth doing first.
 */
function GetStarted({
  onAddBill,
  onAddChore,
  onPost,
}: {
  onAddBill: () => void;
  onAddChore: () => void;
  onPost: () => void;
}) {
  const steps = [
    {
      icon: 'receipt-outline' as const,
      title: 'Log your first bill',
      body: 'Electricity, water, internet — Kasama splits it across the house.',
      onPress: onAddBill,
    },
    {
      icon: 'checkmark-done-outline' as const,
      title: 'Set up a chore',
      body: 'Assign it once and it rotates around the house.',
      onPress: onAddChore,
    },
    {
      icon: 'reader-outline' as const,
      title: 'Say hello',
      body: 'Write on the board so everyone sees it in one place.',
      onPress: onPost,
    },
  ];

  return (
    <View className="gap-3">
      <SectionTitle className="mb-0">Get started</SectionTitle>
      <NoteCard tape={colors.mustard} className="gap-2 p-2 pt-5">
        {steps.map((step, index) => (
          <Pressable
            key={step.title}
            accessibilityRole="button"
            accessibilityLabel={step.title}
            onPress={() => {
              haptics.tap();
              step.onPress();
            }}
            className={`min-h-[64px] flex-row items-center gap-3 rounded-lg p-3 ${press} active:bg-page ${
              index === 0 ? 'bg-wash-sage' : ''
            }`}
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-page">
              <Ionicons name={step.icon} size={20} color={colors.moss.DEFAULT} />
            </View>
            <View className="flex-1">
              <Text className="font-ui-bold text-sm text-ink">{step.title}</Text>
              <Text className="mt-0.5 font-ui text-xs leading-4 text-ink-muted">{step.body}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.ink.faint} />
          </Pressable>
        ))}
      </NoteCard>
      <Text className="px-1 font-ui text-xs text-ink-muted">
        Invite your housemates from Settings — they'll need the household code.
      </Text>
    </View>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
