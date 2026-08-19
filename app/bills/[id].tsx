import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { billOutstanding, billProgress, billStatus, deleteBill, fetchBill, isBillSettled, setSplitPaid, settleWholeBill } from '../../src/api/bills';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Chip';
import { Card } from '../../src/components/ui/Card';
import { ProgressBar } from '../../src/components/ui/ProgressBar';
import { SwipeRow } from '../../src/components/ui/SwipeRow';
import { SectionTitle } from '../../src/components/ui/Screen';
import { ErrorState, InlineError, LoadingState } from '../../src/components/ui/States';
import { messageFrom, useAsyncData } from '../../src/hooks/useAsyncData';
import { haptics } from '../../src/lib/haptics';
import { useRealtime } from '../../src/hooks/useRealtime';
import { categoryMeta } from '../../src/lib/categories';
import { formatPeso, formatRelativeDate, formatTimeAgo } from '../../src/lib/format';
import { BILL_STATUS } from '../../src/lib/status';
import { colors, ripple } from '../../src/lib/theme';
import { useCurrentUserId, useSessionStore } from '../../src/store/useSessionStore';

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const userId = useCurrentUserId();
  const role = useSessionStore((state) => state.role);

  const { data: bill, loading, refreshing, error, refresh, setData } = useAsyncData(
    id ? () => fetchBill(id) : null,
    [id]
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);

  const silentRefresh = useCallback(() => {
    void refresh({ silent: true });
  }, [refresh]);

  useRealtime(
    `bill:${id ?? 'none'}`,
    id ? [{ table: 'bill_splits' }, { table: 'bills' }] : [],
    silentRefresh
  );

  /**
   * Flips the row immediately and reconciles with the server afterwards. A
   * round trip on mobile data is long enough that waiting for it makes the
   * checkbox feel broken; on failure we surface the error and refetch, which
   * puts the row back the way the server sees it.
   */
  async function togglePaid(splitId: string, paid: boolean) {
    haptics.select();
    setActionError(null);

    setData((current) =>
      current
        ? {
            ...current,
            splits: current.splits.map((split) =>
              split.id === splitId
                ? { ...split, paid, paid_at: paid ? new Date().toISOString() : null }
                : split
            ),
          }
        : current
    );

    try {
      await setSplitPaid(splitId, paid);
      await refresh({ silent: true });
    } catch (caught) {
      haptics.error();
      setActionError(messageFrom(caught));
      await refresh({ silent: true });
    }
  }

  async function handleSettleAll() {
    if (!bill) return;
    setSettling(true);
    setActionError(null);

    const stamp = new Date().toISOString();
    setData((current) =>
      current
        ? { ...current, splits: current.splits.map((split) => ({ ...split, paid: true, paid_at: split.paid_at ?? stamp })) }
        : current
    );

    try {
      await settleWholeBill(bill.id);
      haptics.success();
      await refresh({ silent: true });
    } catch (caught) {
      haptics.error();
      setActionError(messageFrom(caught));
      await refresh({ silent: true });
    } finally {
      setSettling(false);
    }
  }

  function confirmDelete() {
    if (!bill) return;
    haptics.tap();
    Alert.alert('Delete this bill?', 'Mawawala rin ang lahat ng splits nito.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBill(bill.id);
            router.back();
          } catch (caught) {
            setActionError(messageFrom(caught));
          }
        },
      },
    ]);
  }

  if (loading) return <LoadingState label="Kinukuha ang bill…" />;

  if (error && !bill) {
    return (
      <View className="flex-1 justify-center bg-sand-50 p-5">
        <ErrorState message={error} onRetry={() => void refresh()} />
      </View>
    );
  }

  if (!bill) {
    return (
      <View className="flex-1 items-center justify-center bg-sand-50 p-5">
        <Text className="text-base text-ink-soft">Wala na ang bill na ito.</Text>
      </View>
    );
  }

  const meta = categoryMeta(bill.category);
  const settled = isBillSettled(bill);
  const outstanding = billOutstanding(bill);
  const progress = billProgress(bill);
  const status = billStatus(bill);
  const badge = BILL_STATUS[status];
  const canDelete = bill.created_by === userId || role === 'admin';

  return (
    <>
      <Stack.Screen options={{ title: bill.title }} />
      <ScrollView
        className="flex-1 bg-sand-50"
        contentContainerClassName="gap-5 p-5 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.brand[500]}
          />
        }
      >
        <Card className="items-center gap-2 py-6">
          <View
            className="h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundColor: meta.background }}
          >
            <Ionicons name={meta.icon} size={26} color={meta.tint} />
          </View>
          <Text className="text-3xl font-bold text-ink">{formatPeso(Number(bill.amount))}</Text>
          <Text className="text-sm text-ink-muted">
            {meta.label} · {meta.subtitle}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <Badge label={badge.label} tone={badge.tone} icon={badge.icon} />
            {bill.recurrence !== 'none' ? (
              <Badge
                label={bill.recurrence === 'weekly' ? 'Weekly' : 'Monthly'}
                icon="repeat"
              />
            ) : null}
          </View>
          {bill.due_date ? (
            <Text className="mt-1 text-sm text-ink-soft">
              Due {formatRelativeDate(bill.due_date)}
            </Text>
          ) : null}

          {/* Progress towards settled — the one number people come here for. */}
          <View className="mt-3 w-full gap-1.5">
            <ProgressBar
              ratio={progress.ratio}
              tone={
                status === 'settled'
                  ? 'sage'
                  : status === 'overdue'
                    ? 'brick'
                    : status === 'due-soon'
                      ? 'mustard'
                      : 'moss'
              }
              height={8}
            />
            <View className="flex-row justify-between">
              <Text className="text-xs font-semibold text-ink-soft">
                {progress.paid} of {progress.total} paid
              </Text>
              {settled ? null : (
                <Text className="text-xs font-semibold text-ink-soft">
                  {formatPeso(outstanding)} left
                </Text>
              )}
            </View>
          </View>
        </Card>

        <View>
          <SectionTitle>Who owes what</SectionTitle>
          <View className="gap-2">
            {bill.splits.length === 0 ? (
              <Card>
                <Text className="text-sm text-ink-muted">Walang split na naka-record.</Text>
              </Card>
            ) : (
              bill.splits
                .slice()
                .sort((a, b) => Number(a.paid) - Number(b.paid))
                .map((split) => {
                  const name = split.profile?.display_name ?? 'Housemate';
                  const isSelf = split.user_id === userId;

                  return (
                    <SwipeRow
                      key={split.id}
                      left={
                        split.paid
                          ? undefined
                          : {
                              label: 'Paid',
                              icon: 'checkmark-circle',
                              tone: 'moss',
                              onTrigger: () => void togglePaid(split.id, true),
                            }
                      }
                      right={
                        split.paid
                          ? {
                              label: 'Unpay',
                              icon: 'arrow-undo',
                              tone: 'muted',
                              onTrigger: () => void togglePaid(split.id, false),
                            }
                          : undefined
                      }
                    >
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: split.paid }}
                        accessibilityLabel={`${name} — ${formatPeso(Number(split.amount_owed))} ${
                          split.paid ? 'paid' : 'unpaid'
                        }`}
                        accessibilityHint="Double tap to switch between paid and unpaid"
                        android_ripple={{ color: ripple.brand }}
                        onPress={() => void togglePaid(split.id, !split.paid)}
                        className={`min-h-[64px] flex-row items-center gap-3 rounded-2xl border p-4 ${
                          split.paid
                            ? 'border-brand-200 bg-brand-50 active:bg-brand-100'
                            : 'border-sand-200 bg-white active:bg-sand-100'
                        }`}
                      >
                        <Avatar
                          name={name}
                          userId={split.user_id}
                          avatarUrl={split.profile?.avatar_url}
                          size={40}
                        />
                        <View className="flex-1">
                          <Text className="text-sm font-bold text-ink">
                            {name}
                            {isSelf ? ' (you)' : ''}
                          </Text>
                          <Text className="text-xs text-ink-muted">
                            {split.paid && split.paid_at
                              ? `Paid ${formatTimeAgo(split.paid_at)}`
                              : 'Not yet paid'}
                          </Text>
                        </View>
                        <Text
                          className={`text-base font-bold ${
                            split.paid ? 'text-brand-600' : 'text-ink'
                          }`}
                        >
                          {formatPeso(Number(split.amount_owed))}
                        </Text>
                        <Ionicons
                          name={split.paid ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={split.paid ? colors.brand[600] : colors.sand[400]}
                        />
                      </Pressable>
                    </SwipeRow>
                  );
                })
            )}
          </View>
          <Text className="mt-2 px-1 text-xs text-ink-muted">
            Tap a name to mark it paid or unpaid — or swipe the row across.
          </Text>
        </View>

        {actionError ? <InlineError message={actionError} /> : null}

        <View className="gap-3">
          {!settled ? (
            <Button
              label="Mark everyone as paid"
              icon="checkmark-done-outline"
              onPress={handleSettleAll}
              loading={settling}
            />
          ) : null}
          {canDelete ? (
            <Button label="Delete bill" variant="danger" icon="trash-outline" onPress={confirmDelete} />
          ) : null}
        </View>

        <Text className="text-center text-xs text-ink-muted">
          Added {formatTimeAgo(bill.created_at)}
        </Text>
      </ScrollView>
    </>
  );
}
