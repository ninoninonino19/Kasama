import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  billShareOutstanding,
  billStatus,
  isSettledAmount,
  nextBillDue,
  settleUp,
  summariseMonth,
} from '../api/bills';
import { categoryMeta } from '../lib/categories';
import { formatMonthName, formatPeso, formatRelativeDate, fromDateString } from '../lib/format';
import { haptics } from '../lib/haptics';
import { pressSmall } from '../lib/motion';
import { BILL_STATUS } from '../lib/status';
import { colors } from '../lib/theme';
import type { BillWithSplits } from '../types';
import { Avatar } from './ui/Avatar';
import { NoteCard } from './ui/NoteCard';
import { Pill } from './ui/Pill';
import { ProgressBar } from './ui/ProgressBar';

/**
 * The one money card — what is left to pay this month, plus, on the dashboard,
 * what falls due next.
 *
 * It replaces the pair the dashboard used to stack: a "where you stand" balance
 * above a separate "next bill due" row. Two cards, one question. Worse, the
 * balance answered it wrongly: it netted what housemates owed you against what
 * you owed, so logging the ₱3,000 electricity bill put "+₱2,000 — what the
 * house owes you" on the screen of the person who had not paid a centavo yet.
 * Nobody owes anybody at that moment; there is only a bill, and a share of it
 * each. So the headline is now the plainest number in the house — what you
 * still have to pay this month — and the debts between housemates have moved
 * below the line, where they only appear once somebody has actually paid.
 *
 * Every figure is set in mono. That is the design system's ledger rule, and it
 * also does real work here: proportional digits make ₱1,180.00 and ₱1,190.00
 * hard to tell apart down a column.
 */
export function MonthBalanceCard({
  bills,
  userId,
  /** Drops the per-housemate settle-up list — the dashboard only wants the headline. */
  compact = false,
  onPressBill,
}: {
  bills: BillWithSplits[];
  userId: string;
  compact?: boolean;
  onPressBill?: (bill: BillWithSplits) => void;
}) {
  const month = summariseMonth(bills, userId);
  const nextBill = compact ? nextBillDue(bills) : null;
  const people = compact ? [] : settleUp(bills, userId);

  const monthName = formatMonthName(fromDateString(`${month.month}-01`));

  // `isSettledAmount` rather than `=== 0`: an even split of ₱1,000 three ways
  // leaves a fraction of a centavo behind, and comparing against zero draws a
  // red "₱0.00" over a month somebody has finished paying.
  const clear = isSettledAmount(month.remaining);
  const nothingDue = isSettledAmount(month.total);

  // A month with nothing in it is complete, not un-started — an empty track
  // reads as "you haven't paid anything" when there was nothing to pay.
  const ratio = nothingDue ? 1 : month.paid / month.total;

  // What the rest of the house still has on top of your own share. Only worth a
  // line when it is actually more than yours; otherwise it restates the
  // headline in different words.
  const othersRemaining = month.householdRemaining - month.remaining;
  const showHouse = !isSettledAmount(othersRemaining) && othersRemaining > 0;

  return (
    <NoteCard tape={colors.mustard} tapeAlign="center" className="px-5 pb-4 pt-6">
      <Text className="text-center font-ui-bold text-[11px] uppercase tracking-[1.4px] text-ink-muted">
        Remaining this month
      </Text>

      <Text
        accessibilityLabel={
          clear
            ? `All settled for ${monthName}`
            : `${formatPeso(month.remaining)} left to pay in ${monthName}`
        }
        className={`mt-1 text-center text-3xl ${
          clear ? 'font-hand-bold text-ink' : 'font-mono-bold text-deep-brick'
        }`}
      >
        {clear ? 'All settled' : formatPeso(month.remaining)}
      </Text>

      <Text className="mt-1 text-center font-ui text-sm text-ink-muted">
        {nothingDue
          ? `Nothing lands in ${monthName} yet.`
          : clear
            ? `Your whole share of ${monthName} is paid.`
            : `Your share of ${monthName}, across ${month.openBills} ${
                month.openBills === 1 ? 'bill' : 'bills'
              }.`}
      </Text>

      {/* The bar always sits next to the same count in words — on its own it is
          decoration, not information. */}
      <View className="mt-4 gap-2">
        <ProgressBar ratio={ratio} tone={clear ? 'sage' : 'moss'} />
        <View className="flex-row items-center justify-between gap-3">
          <Text className="font-mono text-[11px] text-ink-muted" numberOfLines={1}>
            {formatPeso(month.paid)} of {formatPeso(month.total)} paid
          </Text>
          {showHouse ? (
            <Text className="font-mono text-[11px] text-ink-muted" numberOfLines={1}>
              House: {formatPeso(othersRemaining)} left
            </Text>
          ) : null}
        </View>
      </View>

      {/* Next due ------------------------------------------------------ */}
      {/* Dashboard only. On the bills screen the soonest bill is the first row
          of the list directly underneath this card — the receipts are ordered
          by due date — so a "next bill due" panel there just prints the row
          below it twice, in a different shape. */}
      {compact ? (
        <View className="mt-4 border-t border-line pt-3">
          <Text className="font-ui-bold text-[11px] uppercase tracking-[1.4px] text-ink-muted">
            Next bill due
          </Text>
          {nextBill ? (
            <NextDueRow
              bill={nextBill}
              userId={userId}
              onPress={onPressBill ? () => onPressBill(nextBill) : undefined}
            />
          ) : (
            <Text className="mt-2 font-ui text-sm text-ink-muted">
              Nothing outstanding — every bill in the house is settled.
            </Text>
          )}
        </View>
      ) : null}

      {/* Settle up ----------------------------------------------------- */}
      {/* Rows only — no heading, and nothing at all when there is nothing
          between anybody. Each row already spells out its own direction
          ("owes you" / "you owe"), so the label above them was naming a
          section that explains itself, and the paragraph under it explained
          an emptiness better shown by the section not being there. */}
      {compact || people.length === 0 ? null : (
        <View className="mt-4 gap-2.5 border-t border-line pt-3">
          {people.map((person) => (
            <View key={person.userId} className="flex-row items-center gap-2.5">
              <Avatar
                name={person.name}
                userId={person.userId}
                avatarUrl={person.avatarUrl}
                size={28}
              />
              <Text className="flex-1 font-ui-semibold text-sm text-ink" numberOfLines={1}>
                {person.name}
              </Text>
              {/* The direction is spelled out, not left to the sign — "owes
                  you" and "you owe" are the whole question. */}
              <Text className="font-ui text-xs text-ink-muted">
                {person.net > 0 ? 'owes you' : 'you owe'}
              </Text>
              <Text
                className={`font-mono-bold text-sm ${
                  person.net > 0 ? 'text-deep-sage' : 'text-deep-brick'
                }`}
              >
                {formatPeso(Math.abs(person.net))}
              </Text>
            </View>
          ))}
        </View>
      )}
    </NoteCard>
  );
}

/**
 * The soonest unpaid bill, as one line.
 *
 * The amount is the reader's own share of what is left, not the household's.
 * Everything else on this card is a figure they personally have to find, and a
 * ₱3,000 total split four ways sitting under "remaining this month" reads as
 * ₱3,000 they owe. The bill's own screen is where the house-wide number
 * belongs, next to who has paid which part of it.
 *
 * Their share can already be settled while the bill is not — the next one due
 * is the house's next, not theirs — so that case says so rather than printing
 * a ₱0.00 they would have to interpret.
 */
function NextDueRow({
  bill,
  userId,
  onPress,
}: {
  bill: BillWithSplits;
  userId: string;
  onPress?: () => void;
}) {
  const meta = categoryMeta(bill.category);
  const badge = BILL_STATUS[billStatus(bill)];

  const share = billShareOutstanding(bill, userId);
  const mineSettled = isSettledAmount(share);
  const amountLabel = mineSettled ? 'Yours is paid' : formatPeso(share);

  const body = (
    <View className="flex-row items-center gap-3">
      <View
        className="h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: meta.background }}
      >
        <Ionicons name={meta.icon} size={18} color={meta.tint} />
      </View>

      <View className="flex-1">
        <Text className="font-ui-bold text-sm text-ink" numberOfLines={1}>
          {bill.title}
        </Text>
        <Text className="mt-0.5 font-mono text-[11px] text-ink-muted" numberOfLines={1}>
          {bill.due_date ? `Due ${formatRelativeDate(bill.due_date)}` : meta.subtitle}
          {mineSettled ? '' : ' · your share'}
        </Text>
      </View>

      {/* The amount stays neutral — the urgency lives in the pill, so an
          ordinary bill doesn't shout. */}
      <View className="items-end gap-1">
        <Text
          className={
            mineSettled
              ? 'font-ui-semibold text-xs text-ink-muted'
              : 'font-mono-bold text-sm text-ink'
          }
        >
          {amountLabel}
        </Text>
        <Pill label={badge.label} tone={badge.tone} icon={badge.icon} />
      </View>
    </View>
  );

  if (!onPress) return <View className="mt-2.5">{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        mineSettled
          ? `${bill.title}. Your share is paid.`
          : `${bill.title}. ${formatPeso(share)} is your share.`
      }
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      className={`-mx-2 mt-1.5 rounded-lg px-2 py-1.5 ${pressSmall} active:bg-page`}
    >
      {body}
    </Pressable>
  );
}
