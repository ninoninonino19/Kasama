import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { isBillSettled, summariseBalance } from '../../src/api/bills';
import { Chip } from '../../src/components/ui/Chip';
import { BillRow } from '../../src/components/BillRow';
import { Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/ui/States';
import { useBills } from '../../src/hooks/useHouseholdData';
import { formatPeso } from '../../src/lib/format';
import { useCurrentUserId } from '../../src/store/useSessionStore';

type Filter = 'all' | 'unpaid' | 'paid';

export default function BillsScreen() {
  const router = useRouter();
  const userId = useCurrentUserId();
  const { data, loading, refreshing, error, refresh } = useBills();
  const [filter, setFilter] = useState<Filter>('unpaid');

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
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a bill"
            onPress={() => router.push('/bills/new')}
            className="h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 active:bg-brand-600"
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        }
      />

      <View className="flex-row gap-2 px-5 pb-3">
        {(['unpaid', 'paid', 'all'] as Filter[]).map((option) => (
          <Chip
            key={option}
            label={option === 'unpaid' ? 'Unpaid' : option === 'paid' ? 'Settled' : 'All'}
            selected={filter === option}
            onPress={() => setFilter(option)}
          />
        ))}
      </View>

      {loading ? (
        <LoadingState label="Kinukuha ang bills…" />
      ) : error && bills.length === 0 ? (
        <View className="px-5">
          <ErrorState message={error} onRetry={() => void refresh()} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(bill) => bill.id}
          contentContainerClassName="gap-3 px-5 pb-8"
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
    </Screen>
  );
}
