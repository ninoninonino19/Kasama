import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { billOutstanding, billProgress, billStatus, deleteBill, fetchBill, isBillSettled, rollRecurringBill, setSplitPaid, settleWholeBill } from '../../src/api/bills';
import { notifyHousehold } from '../../src/api/notify';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { Pill } from '../../src/components/ui/Pill';
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
import {
  useCurrentUserId,
  useHousehold,
  useProfile,
  useSessionStore,
} from '../../src/store/useSessionStore';

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
  // Who has already been nudged on this visit. Not persisted — the point is
  // to stop a double-tap turning into two notifications, not to ration
  // reminders across days.
  const [nudged, setNudged] = useState<string[]>([]);

  const household = useHousehold();
  const profile = useProfile();
  const profileName = profile?.display_name.split(' ')[0] ?? 'a housemate';

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
      if (paid) await rollForward();
      await refresh({ silent: true });
    } catch (caught) {
      haptics.error();
      setActionError(messageFrom(caught));
      await refresh({ silent: true });
    }
  }

  /**
   * Queues next month's copy once the last split lands. Kept out of the
   * payment's own try/catch: the payment has already been written by this
   * point, and failing to roll a recurring bill forward is not a reason to
   * tell someone their payment didn't go through.
   */
  async function rollForward() {
    if (!bill || bill.recurrence === 'none') return;
    try {
      await rollRecurringBill(bill.id);
    } catch (caught) {
      setActionError(
        `Your payment went through, but the next ${bill.title} couldn't be created: ${messageFrom(caught)}`
      );
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
      await rollForward();
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

  /**
   * A private "any chance you could settle up?" to one housemate.
   *
   * Only the person who fronted the money can send it. Anyone being able to
   * nudge anyone turns a shared-house app into a way to needle your
   * housemates, and the person actually out of pocket is the only one with
   * standing to ask.
   */
  function nudge(splitUserId: string, splitName: string, amount: number) {
    if (!bill || !household) return;
    haptics.tap();
    setNudged((current) => [...current, splitUserId]);

    notifyHousehold({
      householdId: household.id,
      category: 'bills',
      title: `Reminder from ${profileName}`,
      body: `${formatPeso(amount)} of your share of ${bill.title} is still outstanding.`,
      data: { screen: 'bills', billId: bill.id },
      only: [splitUserId],
    });

    setActionError(null);
    Alert.alert('Reminder sent', `${splitName} has been nudged about their share.`);
  }

  function confirmDelete() {
    if (!bill) return;
    haptics.tap();
    Alert.alert('Delete this bill?', 'All of its splits go with it.', [
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

  if (loading) return <LoadingState label="Loading bill…" />;

  if (error && !bill) {
    return (
      <View className="flex-1 justify-center bg-canvas p-5">
        <ErrorState message={error} onRetry={() => void refresh()} />
      </View>
    );
  }

  if (!bill) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas p-5">
        <Text className="font-ui text-base text-ink-soft">This bill no longer exists.</Text>
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
        className="flex-1 bg-canvas"
        contentContainerClassName="gap-5 p-5 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.moss.DEFAULT}
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
          <Text className="font-mono-bold text-3xl text-ink">{formatPeso(Number(bill.amount))}</Text>
          <Text className="font-ui text-sm text-ink-muted">
            {meta.label} · {meta.subtitle}
          </Text>
          <View className="mt-1 flex-row items-center gap-2">
            <Pill label={badge.label} tone={badge.tone} icon={badge.icon} />
            {bill.recurrence !== 'none' ? (
              <Pill
                label={bill.recurrence === 'weekly' ? 'Weekly' : 'Monthly'}
                icon="repeat"
              />
            ) : null}
          </View>
          {bill.due_date ? (
            <Text className="mt-1 font-mono text-sm text-ink-soft">
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
              <Text className="font-ui-semibold text-xs text-ink-soft">
                {progress.paid} of {progress.total} paid
              </Text>
              {settled ? null : (
                <Text className="font-mono text-xs text-ink-soft">
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
                <Text className="font-ui text-sm text-ink-muted">No splits recorded for this bill.</Text>
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
                        android_ripple={{ color: ripple.card }}
                        onPress={() => void togglePaid(split.id, !split.paid)}
                        className={`min-h-[64px] flex-row items-center gap-3 rounded-2xl border p-4 ${
                          split.paid
                            ? 'border-sage bg-wash-sage active:bg-wash-sage/70'
                            : 'border-line bg-paper active:bg-page'
                        }`}
                      >
                        <Avatar
                          name={name}
                          userId={split.user_id}
                          avatarUrl={split.profile?.avatar_url}
                          size={40}
                        />
                        <View className="flex-1">
                          <Text className="font-ui-bold text-sm text-ink">
                            {name}
                            {isSelf ? ' (you)' : ''}
                          </Text>
                          <Text className="font-mono text-[11px] text-ink-muted">
                            {split.paid && split.paid_at
                              ? `Paid ${formatTimeAgo(split.paid_at)}`
                              : 'Not yet paid'}
                          </Text>
                        </View>
                        {/* Only the payer, only on unpaid shares, never on
                            your own. */}
                        {!split.paid && bill.created_by === userId && !isSelf ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Remind ${name} about their share`}
                            hitSlop={10}
                            disabled={nudged.includes(split.user_id)}
                            onPress={() =>
                              nudge(split.user_id, name, Number(split.amount_owed))
                            }
                            className={`h-10 w-10 items-center justify-center rounded-full ${
                              nudged.includes(split.user_id) ? 'opacity-40' : 'active:bg-page'
                            }`}
                          >
                            <Ionicons
                              name={
                                nudged.includes(split.user_id)
                                  ? 'checkmark-done-outline'
                                  : 'notifications-outline'
                              }
                              size={18}
                              color={colors.ink.muted}
                            />
                          </Pressable>
                        ) : null}
                        <Text
                          className={`font-mono-bold text-base ${
                            split.paid ? 'text-deep-sage' : 'text-ink'
                          }`}
                        >
                          {formatPeso(Number(split.amount_owed))}
                        </Text>
                        <Ionicons
                          name={split.paid ? 'checkmark-circle' : 'ellipse-outline'}
                          size={22}
                          color={split.paid ? colors.deep.sage : colors.ink.faint}
                        />
                      </Pressable>
                    </SwipeRow>
                  );
                })
            )}
          </View>
          <Text className="mt-2 px-1 font-ui text-xs text-ink-muted">
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
          {/* Anyone in the household can fix a wrong name or due date; the
              edit screen itself refuses to touch money once someone has
              paid, so this doesn't need the delete permission. */}
          <Button
            label="Edit bill"
            variant="secondary"
            icon="create-outline"
            onPress={() => router.push({ pathname: '/bills/edit', params: { id: bill.id } })}
          />
          {canDelete ? (
            <Button label="Delete bill" variant="danger" icon="trash-outline" onPress={confirmDelete} />
          ) : null}
        </View>

        <Text className="text-center font-ui text-xs text-ink-muted">
          Added {formatTimeAgo(bill.created_at)}
        </Text>
      </ScrollView>
    </>
  );
}
