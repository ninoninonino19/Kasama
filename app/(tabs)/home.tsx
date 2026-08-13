import { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { billOutstanding, isBillSettled, summariseBalance } from '../../src/api/bills';
import { openAssignment } from '../../src/api/chores';
import { Avatar } from '../../src/components/ui/Avatar';
import { Badge } from '../../src/components/ui/Chip';
import { Card } from '../../src/components/ui/Card';
import { Screen, SectionTitle } from '../../src/components/ui/Screen';
import { EmptyState, ErrorState } from '../../src/components/ui/States';
import { DashboardSkeleton } from '../../src/components/ui/Skeleton';
import { useAnnouncements, useBills, useChores } from '../../src/hooks/useHouseholdData';
import { useRefreshOnFocus } from '../../src/hooks/useRefreshOnFocus';
import { endOfWeek, formatPeso, formatRelativeDate, formatTimeAgo, toDateString, todayString } from '../../src/lib/format';
import { categoryMeta } from '../../src/lib/categories';
import { haptics } from '../../src/lib/haptics';
import { useCurrentUserId, useHousehold, useProfile } from '../../src/store/useSessionStore';
import type { AssignmentWithProfile, ChoreWithAssignments } from '../../src/types';

export default function HomeScreen() {
  const router = useRouter();
  const household = useHousehold();
  const profile = useProfile();
  const userId = useCurrentUserId();

  const bills = useBills();
  const chores = useChores();
  const announcements = useAnnouncements(3);

  const loading = bills.loading || chores.loading || announcements.loading;
  const refreshing = bills.refreshing || chores.refreshing || announcements.refreshing;
  const error = bills.error ?? chores.error ?? announcements.error;

  const balance = useMemo(
    () => (userId ? summariseBalance(bills.data ?? [], userId) : { owed: 0, owing: 0, net: 0 }),
    [bills.data, userId]
  );

  const unpaidBills = useMemo(
    () => (bills.data ?? []).filter((bill) => !isBillSettled(bill)).slice(0, 3),
    [bills.data]
  );

  const dueThisWeek = useMemo(() => {
    const today = todayString();
    const weekEnd = toDateString(endOfWeek());

    return (chores.data ?? [])
      .map((chore) => ({ chore, assignment: openAssignment(chore) }))
      .filter((entry): entry is { chore: ChoreWithAssignments; assignment: AssignmentWithProfile } =>
        Boolean(entry.assignment)
      )
      .filter(({ assignment }) => assignment.due_date <= weekEnd)
      .sort((a, b) => a.assignment.due_date.localeCompare(b.assignment.due_date))
      .map((entry) => ({ ...entry, overdue: entry.assignment.due_date < today }));
  }, [chores.data]);

  const myChores = dueThisWeek.filter(({ assignment }) => assignment.user_id === userId);

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
            tintColor="#2FA396"
          />
        }
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-sm text-ink-muted">{greeting()},</Text>
            <Text className="text-2xl font-bold text-ink" numberOfLines={1}>
              {firstName}!
            </Text>
            <Text className="mt-0.5 text-sm text-ink-soft" numberOfLines={1}>
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
            className="h-11 w-11 items-center justify-center rounded-2xl bg-white active:bg-sand-100"
          >
            <Ionicons name="settings-outline" size={20} color="#5A6A6F" />
          </Pressable>
        </View>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {error ? <ErrorState message={error} onRetry={() => void refreshAll()} /> : null}

            {/* Balance ------------------------------------------------- */}
            <View className="rounded-3xl bg-brand-600 p-5">
              <Text className="text-xs font-bold uppercase tracking-wider text-brand-100">
                Your balance
              </Text>
              <Text className="mt-1 text-3xl font-bold text-white">
                {balance.net === 0
                  ? 'All settled'
                  : balance.net > 0
                    ? `+${formatPeso(balance.net)}`
                    : formatPeso(balance.net)}
              </Text>
              <Text className="mt-1 text-sm text-brand-100">
                {balance.net === 0
                  ? 'Walang utang, walang paniningil.'
                  : balance.net > 0
                    ? 'Net na dapat sa iyo ng bahay.'
                    : 'Net na dapat mong bayaran.'}
              </Text>

              <View className="mt-4 flex-row gap-3">
                <View className="flex-1 rounded-2xl bg-white/15 p-3">
                  <Text className="text-xs text-brand-100">You owe</Text>
                  <Text className="mt-0.5 text-lg font-bold text-white">
                    {formatPeso(balance.owed)}
                  </Text>
                </View>
                <View className="flex-1 rounded-2xl bg-white/15 p-3">
                  <Text className="text-xs text-brand-100">Owed to you</Text>
                  <Text className="mt-0.5 text-lg font-bold text-white">
                    {formatPeso(balance.owing)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Unpaid bills -------------------------------------------- */}
            <View>
              <View className="mb-2 flex-row items-center justify-between">
                <SectionTitle className="mb-0">Unpaid bills</SectionTitle>
                <Pressable accessibilityRole="button" onPress={() => router.push('/bills')}>
                  <Text className="text-xs font-bold uppercase tracking-wider text-brand-600">
                    See all
                  </Text>
                </Pressable>
              </View>

              {unpaidBills.length === 0 ? (
                <EmptyState
                  icon="receipt-outline"
                  title="Walang pending na bill"
                  message="Add one when the next kuryente or WiFi bill arrives."
                  actionLabel="Add a bill"
                  onAction={() => router.push('/bills/new')}
                />
              ) : (
                <View className="gap-2">
                  {unpaidBills.map((bill) => {
                    const meta = categoryMeta(bill.category);
                    return (
                      <Card key={bill.id} onPress={() => router.push(`/bills/${bill.id}`)}>
                        <View className="flex-row items-center gap-3">
                          <View
                            className="h-10 w-10 items-center justify-center rounded-xl"
                            style={{ backgroundColor: meta.background }}
                          >
                            <Ionicons name={meta.icon} size={18} color={meta.tint} />
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-bold text-ink" numberOfLines={1}>
                              {bill.title}
                            </Text>
                            <Text className="text-xs text-ink-muted">
                              {bill.due_date
                                ? `Due ${formatRelativeDate(bill.due_date)}`
                                : meta.subtitle}
                            </Text>
                          </View>
                          <Text className="text-sm font-bold text-coral-600">
                            {formatPeso(billOutstanding(bill))}
                          </Text>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Chores this week ---------------------------------------- */}
            <View>
              <View className="mb-2 flex-row items-center justify-between">
                <SectionTitle className="mb-0">Chores this week</SectionTitle>
                <Pressable accessibilityRole="button" onPress={() => router.push('/chores')}>
                  <Text className="text-xs font-bold uppercase tracking-wider text-brand-600">
                    See all
                  </Text>
                </Pressable>
              </View>

              {dueThisWeek.length === 0 ? (
                <EmptyState
                  icon="checkmark-done-outline"
                  title="Walang chore ngayong linggo"
                  message="Set up a rotation so walang pikunan sa hugas at walis."
                  actionLabel="Add a chore"
                  onAction={() => router.push('/chores/new')}
                />
              ) : (
                <View className="gap-2">
                  {dueThisWeek.slice(0, 4).map(({ chore, assignment, overdue }) => (
                    <Card key={assignment.id}>
                      <View className="flex-row items-center gap-3">
                        <Avatar
                          name={assignment.profile?.display_name ?? 'Housemate'}
                          userId={assignment.user_id}
                          avatarUrl={assignment.profile?.avatar_url}
                          size={34}
                        />
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-ink">{chore.title}</Text>
                          <Text
                            className={`text-xs ${overdue ? 'text-coral-600' : 'text-ink-muted'}`}
                          >
                            {assignment.user_id === userId
                              ? 'You'
                              : (assignment.profile?.display_name ?? 'Housemate')}{' '}
                            · {formatRelativeDate(assignment.due_date)}
                          </Text>
                        </View>
                        {assignment.user_id === userId ? <Badge label="Ikaw" tone="brand" /> : null}
                      </View>
                    </Card>
                  ))}
                  {myChores.length > 0 ? (
                    <Text className="px-1 text-xs text-ink-muted">
                      {myChores.length} sa iyo ngayong linggo.
                    </Text>
                  ) : null}
                </View>
              )}
            </View>

            {/* Latest announcements ------------------------------------ */}
            <View>
              <View className="mb-2 flex-row items-center justify-between">
                <SectionTitle className="mb-0">Latest announcements</SectionTitle>
                <Pressable accessibilityRole="button" onPress={() => router.push('/announcements')}>
                  <Text className="text-xs font-bold uppercase tracking-wider text-brand-600">
                    See all
                  </Text>
                </Pressable>
              </View>

              {(announcements.data ?? []).length === 0 ? (
                <EmptyState
                  icon="megaphone-outline"
                  title="Wala pang balita"
                  message="Post a quick update so alam ng lahat ang nangyayari sa bahay."
                  actionLabel="Post one"
                  onAction={() => router.push('/announcements')}
                />
              ) : (
                <View className="gap-2">
                  {(announcements.data ?? []).slice(0, 3).map((item) => (
                    <Card key={item.id}>
                      <View className="flex-row items-center gap-2">
                        <Avatar
                          name={item.profile?.display_name ?? 'Housemate'}
                          userId={item.user_id}
                          avatarUrl={item.profile?.avatar_url}
                          size={24}
                        />
                        <Text className="flex-1 text-xs font-semibold text-ink-soft">
                          {item.profile?.display_name ?? 'Housemate'}
                        </Text>
                        <Text className="text-xs text-ink-muted">
                          {formatTimeAgo(item.created_at)}
                        </Text>
                      </View>
                      <Text className="mt-2 text-sm leading-5 text-ink" numberOfLines={3}>
                        {item.content}
                      </Text>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Magandang umaga';
  if (hour < 18) return 'Magandang hapon';
  return 'Magandang gabi';
}
