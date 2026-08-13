import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { isBillSettled, summariseBalance } from '../../src/api/bills';
import { Chip } from '../../src/components/ui/Chip';
import { BillRow } from '../../src/components/BillRow';
import { Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { EmptyState, ErrorState } from '../../src/components/ui/States';
import { Fab } from '../../src/components/ui/Fab';
import { ListSkeleton } from '../../src/components/ui/Skeleton';
import { haptics } from '../../src/lib/haptics';
import { useBills } from '../../src/hooks/useHouseholdData';
import { useRefreshOnFocus } from '../../src/hooks/useRefreshOnFocus';
import { formatPeso } from '../../src/lib/format';
import { useCurrentUserId } from '../../src/store/useSessionStore';

type Filter = 'all' | 'unpaid' | 'paid';

export default function BillsScreen() {
  const router = useRouter();
  const userId = useCurrentUserId();
  const { data, loading, refreshing, error, refresh } = useBills();
  const [filter, setFilter] = useState<Filter>('unpaid');

  // Returning from the "new bill" modal should show it straight away.
  useRefreshOnFocus(refresh);

  const bills = useMemo(() => data ?? [], [data]);

  const visible = useMemo(() => {
    if (filter === 'all') return bills;
    const wantSettled = filter === 'paid';
    return bills.filter((bill) => isBillSettled(bill) === wantSettled);
  }, [bills, filter]);

  const balance = useMemo(
    () => (userId ? summariseBalance(bills, userId) : { owed: 0, owing: 0, net: 0 }),
    [bills, userId]
  );

  return (
    <Screen>
      <ScreenHeader
        title="Bills"
        subtitle={
          balance.owed > 0
            ? `You still owe ${formatPeso(balance.owed)}`
            : 'Wala kang utang — all clear!'
        }
      />

      <View className="flex-row gap-2 px-5 pb-3">
        {(['unpaid', 'paid', 'all'] as Filter[]).map((option) => (
          <Chip
            key={option}
            label={option === 'unpaid' ? 'Unpaid' : option === 'paid' ? 'Settled' : 'All'}
            selected={filter === option}
            onPress={() => {
              haptics.select();
              setFilter(option);
            }}
          />
        ))}
      </View>

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
              tintColor="#2FA396"
            />
          }
          renderItem={({ item }) => (
            <BillRow bill={item} onPress={() => router.push(`/bills/${item.id}`)} />
          )}
          ListEmptyComponent={
            bills.length === 0 ? (
              <EmptyState
                icon="receipt-outline"
                title="No bills yet — add your first one"
                message="Kuryente, tubig, WiFi, renta… log it once and Kasama splits it for everyone."
                actionLabel="Add a bill"
                onAction={() => router.push('/bills/new')}
              />
            ) : (
              <EmptyState
                icon="checkmark-circle-outline"
                title={filter === 'unpaid' ? 'Walang pending!' : 'Nothing settled yet'}
                message={
                  filter === 'unpaid'
                    ? 'Every bill in the house is settled. Nice one.'
                    : 'Once a bill is fully paid it will show up here.'
                }
              />
            )
          }
          ListFooterComponent={
            bills.length > 0 ? (
              <View className="mt-4 items-center">
                <Text className="text-xs text-ink-muted">
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
