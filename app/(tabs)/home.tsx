import { useCallback, useMemo } from 'react';
import type { ComponentProps } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { billOutstanding, billStatus, isBillSettled } from '../../src/api/bills';
import { openAssignment } from '../../src/api/chores';
import { SettleUpCard } from '../../src/components/SettleUpCard';
import { Avatar } from '../../src/components/ui/Avatar';
import { NoteCard } from '../../src/components/ui/NoteCard';
import { Pill } from '../../src/components/ui/Pill';
import { Screen, SectionTitle } from '../../src/components/ui/Screen';
import { EmptyState, ErrorState } from '../../src/components/ui/States';
import { DashboardSkeleton } from '../../src/components/ui/Skeleton';
import { useAnnouncements, useBills, useChores } from '../../src/hooks/useHouseholdData';
import { useRefreshOnFocus } from '../../src/hooks/useRefreshOnFocus';
import { formatPeso, formatRelativeDate, formatTimeAgo, todayString } from '../../src/lib/format';
import { categoryMeta } from '../../src/lib/categories';
import { haptics } from '../../src/lib/haptics';
import { BILL_STATUS } from '../../src/lib/status';
import { colors, tapeColorFor } from '../../src/lib/theme';
import { useCurrentUserId, useHousehold, useMembers, useProfile } from '../../src/store/useSessionStore';
import type {
  AssignmentWithProfile,
  BillWithSplits,
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

  /** Soonest unpaid bill; ones with no due date sit behind the dated ones. */
  const nextBill = useMemo(() => {
    const unpaid = (bills.data ?? []).filter((bill) => !isBillSettled(bill));
    return (
      unpaid
        .slice()
        .sort((a, b) => {
          if (a.due_date === b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        })[0] ?? null
    );
  }, [bills.data]);

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

  const firstName = profile?.display_name.split(' ')[0] ?? 'kasama';

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
              router.push('/settings');
            }}
            className="h-11 w-11 items-center justify-center rounded-xl border border-line bg-paper active:bg-page"
          >
            <Ionicons name="settings-outline" size={20} color={colors.ink.soft} />
          </Pressable>
        </View>

        <HousemateRow members={members} userId={userId} onPress={() => router.push('/settings')} />

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {error ? <ErrorState message={error} onRetry={() => void refreshAll()} /> : null}

            {isFreshHousehold ? (
              <GetStarted
                onAddBill={() => router.push('/bills/new')}
                onAddChore={() => router.push('/chores/new')}
                onPost={() => router.push('/announcements/new')}
              />
            ) : (
              <>
                {/* Today's chore ------------------------------------- */}
                <View>
                  <SectionTitle>Today on the board</SectionTitle>
                  {todaysChore ? (
                    <TodaysChoreCard
                      chore={todaysChore.chore}
                      assignment={todaysChore.assignment}
                      userId={userId}
                      today={today}
                      onPress={() => router.push('/chores')}
                    />
                  ) : (
                    <EmptyState
                      compact
                      icon="checkmark-done-outline"
                      title="Walang chore na naka-pila"
                      message="Set up a rotation so walang pikunan sa hugas at walis."
                      actionLabel="Add a chore"
                      onAction={() => router.push('/chores/new')}
                    />
                  )}
                </View>

                {/* Next bill ----------------------------------------- */}
                <View>
                  <View className="mb-2 flex-row items-center justify-between">
                    <SectionTitle className="mb-0">Next bill due</SectionTitle>
                    {unpaidCount > 1 ? (
                      <Pressable accessibilityRole="button" onPress={() => router.push('/bills')}>
                        <Text className="font-ui-bold text-[11px] uppercase tracking-wider text-moss">
                          {unpaidCount - 1} more
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {nextBill ? (
                    <NextBillCard
                      bill={nextBill}
                      onPress={() => router.push(`/bills/${nextBill.id}`)}
                    />
                  ) : (
                    <EmptyState
                      compact
                      icon="receipt-outline"
                      title="Walang pending na bill"
                      message="Add one when the next kuryente or WiFi bill arrives."
                      actionLabel="Add a bill"
                      onAction={() => router.push('/bills/new')}
                    />
                  )}
                </View>

                {/* Latest from the board ----------------------------- */}
                <View>
                  <View className="mb-2 flex-row items-center justify-between">
                    <SectionTitle className="mb-0">Latest note</SectionTitle>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push('/announcements')}
                    >
                      <Text className="font-ui-bold text-[11px] uppercase tracking-wider text-moss">
                        See all
                      </Text>
                    </Pressable>
                  </View>

                  {latestPost ? (
                    <NoteCard
                      onPress={() => router.push('/announcements')}
                      tape={tapeColorFor(latestPost.id)}
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
                      title="Wala pang balita"
                      message="Post a quick update so alam ng lahat ang nangyayari sa bahay."
                      actionLabel="Write one"
                      onAction={() => router.push('/announcements/new')}
                    />
                  )}
                </View>

                {/* Balance ------------------------------------------- */}
                {userId ? (
                  <View>
                    <SectionTitle>Where you stand</SectionTitle>
                    <SettleUpCard bills={bills.data ?? []} userId={userId} compact />
                  </View>
                ) : null}

                {/* Quick actions ------------------------------------- */}
                {/* Home has no FAB — these are the two things people open the
                    app to do, so they get a fixed home at the end of the scroll. */}
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
              </>
            )}
          </>
        )}
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
      className="flex-row items-center gap-3 active:opacity-80"
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
          ? 'Ikaw pa lang dito — invite your housemates'
          : `Ikaw at ${members.length - 1} pang kasama`}
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
            <Text className="font-hand-bold text-base leading-5 text-ink">ikaw ito!</Text>
          </View>
        ) : null}
      </View>
    </NoteCard>
  );
}

function NextBillCard({ bill, onPress }: { bill: BillWithSplits; onPress: () => void }) {
  const meta = categoryMeta(bill.category);
  const status = billStatus(bill);
  const badge = BILL_STATUS[status];

  return (
    <NoteCard
      onPress={onPress}
      tape={status === 'overdue' ? colors.brick : colors.mustard}
      rotate={0.4}
      className={`pt-5 ${status === 'overdue' ? 'bg-wash-brick' : ''}`}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="h-11 w-11 items-center justify-center rounded-xl"
          style={{ backgroundColor: meta.background }}
        >
          <Ionicons name={meta.icon} size={20} color={meta.tint} />
        </View>
        <View className="flex-1">
          <Text className="font-ui-bold text-base text-ink" numberOfLines={1}>
            {bill.title}
          </Text>
          <Text className="mt-0.5 font-mono text-[11px] text-ink-muted" numberOfLines={1}>
            {bill.due_date ? `Due ${formatRelativeDate(bill.due_date)}` : meta.subtitle}
          </Text>
        </View>
        {/* The amount stays neutral — the urgency lives in the pill, so an
            ordinary bill doesn't shout. */}
        <View className="items-end gap-1">
          <Text className="font-mono-bold text-base text-ink">
            {formatPeso(billOutstanding(bill))}
          </Text>
          <Pill label={badge.label} tone={badge.tone} icon={badge.icon} />
        </View>
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
      className="min-h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 active:bg-page"
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
      body: 'Kuryente, tubig, WiFi — Kasama splits it for everyone.',
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
      title: 'Say kumusta',
      body: 'Pin a note so everyone sees it in one place.',
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
            className={`min-h-[64px] flex-row items-center gap-3 rounded-lg p-3 active:bg-page ${
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
  if (hour < 12) return 'Magandang umaga';
  if (hour < 18) return 'Magandang hapon';
  return 'Magandang gabi';
}
