import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Avatar } from '../../src/components/ui/Avatar';
import { NoteCard } from '../../src/components/ui/NoteCard';
import { FormScreen, SectionTitle } from '../../src/components/ui/Screen';
import { ListSkeleton } from '../../src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../src/components/ui/States';
import { useLedger } from '../../src/hooks/useHouseholdData';
import { useRefreshOnFocus } from '../../src/hooks/useRefreshOnFocus';
import { categoryMeta } from '../../src/lib/categories';
import { formatPeso, formatShortDate, formatTimeAgo } from '../../src/lib/format';
import { colors } from '../../src/lib/theme';
import { useCurrentUserId, useMembers } from '../../src/store/useSessionStore';
import type { LedgerEntry } from '../../src/types';

/**
 * Who paid whom, and when.
 *
 * `bill_splits.paid_at` has been stamped on every settlement since the first
 * migration and was only ever readable one bill at a time. Housemates argue
 * about the same thing every month — "I already paid you for that" — and this
 * is the screen that answers it without opening six bills.
 */
/** How many settled shares to pull at a time. */
const PAGE_SIZE = 40;

export default function LedgerScreen() {
  const router = useRouter();
  const userId = useCurrentUserId();
  const members = useMembers();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data, loading, refreshing, error, refresh } = useLedger(limit);

  useRefreshOnFocus(refresh);

  const entries = useMemo(() => data ?? [], [data]);
  // A full page back means there is probably another one.
  const mayHaveMore = entries.length >= limit;

  const loadMore = useCallback(() => {
    if (!mayHaveMore || loading || refreshing) return;
    setLimit((current) => current + PAGE_SIZE);
  }, [loading, mayHaveMore, refreshing]);

  const nameFor = useMemo(() => {
    const byId = new Map(members.map((member) => [member.user_id, member.profile]));
    return (id: string) => {
      if (id === userId) return 'You';
      // Someone removed from the household still appears in its history.
      return byId.get(id)?.display_name ?? 'A past housemate';
    };
  }, [members, userId]);

  const avatarFor = useMemo(() => {
    const byId = new Map(members.map((member) => [member.user_id, member.profile]));
    return (id: string) => byId.get(id)?.avatar_url ?? null;
  }, [members]);

  /** Month headings, so a long history reads as a statement rather than a list. */
  const sections = useMemo(() => groupByMonth(entries), [entries]);

  // Each entry counts once, even the ones where both sides are the same
  // person — otherwise paying your own share of a bill you logged would show
  // up as twice the money.
  const total = useMemo(
    () =>
      entries
        .filter((entry) => entry.payerId === userId || entry.payeeId === userId)
        .reduce((sum, entry) => sum + entry.amount, 0),
    [entries, userId]
  );

  return (
    <FormScreen title="Payment history">
      {loading ? (
        <ListSkeleton rows={5} />
      ) : error && entries.length === 0 ? (
        <View className="px-5 pt-5">
          <ErrorState message={error} onRetry={() => void refresh()} />
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(section) => section.key}
          contentContainerClassName="gap-5 px-5 pb-10 pt-3"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.moss.DEFAULT}
            />
          }
          ListHeaderComponent={
            entries.length > 0 ? (
              <NoteCard tape={colors.sage} tapeAlign="center" className="mb-1 px-5 pb-4 pt-6">
                <Text className="text-center font-ui-bold text-[11px] uppercase tracking-[1.4px] text-ink-muted">
                  Through your hands
                </Text>
                <Text className="mt-1 text-center font-mono-bold text-3xl text-ink">
                  {formatPeso(total)}
                </Text>
                <Text className="mt-1 text-center font-ui text-sm text-ink-muted">
                  Everything you've paid and been paid, all together.
                </Text>
              </NoteCard>
            ) : null
          }
          renderItem={({ item: section }) => (
            <View>
              <SectionTitle>{section.label}</SectionTitle>
              <View className="gap-2">
                {section.entries.map((entry) => (
                  <Row
                    key={entry.id}
                    entry={entry}
                    isMine={entry.payerId === userId}
                    payer={nameFor(entry.payerId)}
                    payee={nameFor(entry.payeeId)}
                    payerAvatar={avatarFor(entry.payerId)}
                    onPress={() => router.push(`/bills/${entry.billId}`)}
                  />
                ))}
              </View>
            </View>
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            mayHaveMore ? (
              <View className="items-center py-4">
                <ActivityIndicator color={colors.moss.DEFAULT} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No payments yet"
              message="When someone settles their share, this shows who paid whom, and when."
            />
          }
        />
      )}
    </FormScreen>
  );
}

function Row({
  entry,
  isMine,
  payer,
  payee,
  payerAvatar,
  onPress,
}: {
  entry: LedgerEntry;
  isMine: boolean;
  payer: string;
  payee: string;
  payerAvatar: string | null;
  onPress: () => void;
}) {
  const meta = categoryMeta(entry.category);
  // The person collecting for a bill pays their own share to the biller, not
  // to a housemate — `fetchLedger` marks that by handing back the same id on
  // both sides. "Ana → Ana" would read as an accounting error rather than as
  // someone paying the electricity company.
  const toThemselves = entry.payerId === entry.payeeId;

  return (
    <NoteCard onPress={onPress}>
      <View className="flex-row items-center gap-3">
        <Avatar name={payer} userId={entry.payerId} avatarUrl={payerAvatar} size={36} />
        <View className="flex-1">
          <Text className="font-ui-semibold text-sm text-ink" numberOfLines={1}>
            {toThemselves
              ? `${payer} — own share`
              : `${payer} → ${payee}`}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-1.5">
            <Ionicons name={meta.icon} size={11} color={colors.ink.muted} />
            <Text className="flex-1 font-ui text-xs text-ink-muted" numberOfLines={1}>
              {entry.billTitle}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text
            className={`font-mono-bold text-sm ${isMine ? 'text-deep-brick' : 'text-deep-sage'}`}
          >
            {formatPeso(entry.amount)}
          </Text>
          <Text className="font-mono text-[11px] text-ink-muted">
            {formatTimeAgo(entry.paidAt)}
          </Text>
        </View>
      </View>
    </NoteCard>
  );
}

type Section = { key: string; label: string; entries: LedgerEntry[] };

function groupByMonth(entries: LedgerEntry[]): Section[] {
  const sections: Section[] = [];

  for (const entry of entries) {
    const date = new Date(entry.paidAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const last = sections[sections.length - 1];

    if (last?.key === key) {
      last.entries.push(entry);
      continue;
    }

    sections.push({
      key,
      // "August" this year, "August 2025" once the year stops being obvious.
      label:
        date.getFullYear() === new Date().getFullYear()
          ? date.toLocaleDateString('en-PH', { month: 'long' })
          : formatShortDate(date).replace(/\s\d+,/, ''),
      entries: [entry],
    });
  }

  return sections;
}
