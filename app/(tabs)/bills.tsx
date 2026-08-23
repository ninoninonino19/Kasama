import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { billStatus, isBillSettled } from '../../src/api/bills';
import { Chip } from '../../src/components/ui/Chip';
import { BillRow } from '../../src/components/BillRow';
import { MonthBalanceCard } from '../../src/components/MonthBalanceCard';
import { Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { EmptyState, ErrorState } from '../../src/components/ui/States';
import { Fab } from '../../src/components/ui/Fab';
import { ListSkeleton } from '../../src/components/ui/Skeleton';
import { haptics } from '../../src/lib/haptics';
import { pressSmall } from '../../src/lib/motion';
import { useBills } from '../../src/hooks/useHouseholdData';
import { useRefreshOnFocus } from '../../src/hooks/useRefreshOnFocus';
import { colors } from '../../src/lib/theme';
import { useCurrentUserId, useHousehold } from '../../src/store/useSessionStore';
import type { BillWithSplits } from '../../src/types';

type Filter = 'all' | 'unpaid' | 'paid';

export default function BillsScreen() {
  const router = useRouter();
  const userId = useCurrentUserId();
  const household = useHousehold();
  const { data, loading, refreshing, error, refresh } = useBills();
  const [filter, setFilter] = useState<Filter>('unpaid');

  // Returning from the "new bill" modal should show it straight away.
  useRefreshOnFocus(refresh);

  const bills = useMemo(() => data ?? [], [data]);

  // Every filter reads as a deadline list, not a log of when things were
  // typed in: the bill you have to deal with soonest is the first receipt on
  // the screen, and the card above it no longer has to name it separately.
  const visible = useMemo(() => {
    const matching =
      filter === 'all'
        ? bills
        : bills.filter((bill) => isBillSettled(bill) === (filter === 'paid'));

    return matching.slice().sort(byDueDate);
  }, [bills, filter]);

  const counts = useMemo(() => {
    const settled = bills.filter(isBillSettled).length;
    return { all: bills.length, paid: settled, unpaid: bills.length - settled };
  }, [bills]);

  const overdueCount = useMemo(
    () => bills.filter((bill) => billStatus(bill) === 'overdue').length,
    [bills]
  );

  return (
    <Screen>
      <ScreenHeader
        title="Bills"
        subtitle={household?.name ?? undefined}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Payment history"
            onPress={() => {
              haptics.tap();
              router.push('/bills/ledger');
            }}
            className={`h-11 w-11 items-center justify-center rounded-xl border border-line bg-paper ${pressSmall} active:bg-page`}
          >
            <Ionicons name="time-outline" size={20} color={colors.ink.soft} />
          </Pressable>
        }
      />

      {/* Counts on the filters save a tap to discover an empty tab. */}
      <View className="flex-row gap-2 px-5 pb-3 pt-1">
        {(['unpaid', 'paid', 'all'] as Filter[]).map((option) => (
          <Chip
            key={option}
            label={option === 'unpaid' ? 'Unpaid' : option === 'paid' ? 'Settled' : 'All'}
            count={counts[option]}
            selected={filter === option}
            onPress={() => {
              haptics.select();
              setFilter(option);
            }}
          />
        ))}
      </View>

      {overdueCount > 0 && filter !== 'paid' ? (
        <View className="mx-5 mb-3 flex-row items-center gap-2 rounded-xl border border-brick/30 bg-wash-brick px-4 py-3">
          <Ionicons name="alert-circle" size={18} color={colors.deep.brick} />
          <Text className="flex-1 font-ui-bold text-sm text-deep-brick">
            {overdueCount} {overdueCount === 1 ? 'bill is' : 'bills are'} past due
          </Text>
        </View>
      ) : null}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : error && bills.length === 0 ? (
        <View className="px-5">
          <ErrorState message={error} onRetry={() => void refresh()} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(bill) => bill.id}
          contentContainerClassName="gap-3 px-5 pb-28"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.moss.DEFAULT}
            />
          }
          // The balance card scrolls with the receipts rather than pinning
          // above them: once you're deep in the list you're reading bills, not
          // balances, and a sticky summary just costs a third of the screen.
          ListHeaderComponent={
            userId && bills.length > 0 ? (
              <View className="pb-1">
                {/* No `onPressBill`: the card's only tappable bill was the
                    next-due row, which the dashboard keeps and this screen
                    doesn't — the receipts below are the way into a bill here. */}
                <MonthBalanceCard bills={bills} userId={userId} />
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <BillRow
              bill={item}
              index={index}
              onPress={() => router.push(`/bills/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            bills.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                title="No bills yet — add your first one"
                message="Electricity, water, internet, rent — log it once and Kasama splits it across the house."
                actionLabel="Add a bill"
                onAction={() => router.push('/bills/new')}
              />
            ) : (
              <EmptyState
                icon="checkmark-circle-outline"
                title={filter === 'unpaid' ? 'Nothing outstanding' : 'Nothing settled yet'}
                message={
                  filter === 'unpaid'
                    ? 'Every bill in the house is settled.'
                    : 'Once a bill is fully paid it will show up here.'
                }
              />
            )
          }
          ListFooterComponent={
            bills.length > 0 ? (
              <View className="mt-4 items-center">
                <Text className="font-ui text-xs text-ink-muted">
                  {bills.length} bill{bills.length === 1 ? '' : 's'} in this household
                </Text>
              </View>
            ) : null
          }
        />
      )}

      <Fab accessibilityLabel="Add a bill" onPress={() => router.push('/bills/new')} />
    </Screen>
  );
}

/**
 * Nearest due date first.
 *
 * Undated bills go to the end rather than the front: no due date means nobody
 * said when, which is the opposite of due today — sorting them as an empty
 * string would put every one of them above tomorrow's electricity.
 */
function byDueDate(a: BillWithSplits, b: BillWithSplits): number {
  if (!a.due_date && !b.due_date) return 0;
  if (!a.due_date) return 1;
  if (!b.due_date) return -1;
  return a.due_date.localeCompare(b.due_date);
}
