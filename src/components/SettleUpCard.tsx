import { Text, View } from 'react-native';

import { settleUp, summariseBalance } from '../api/bills';
import { formatPeso } from '../lib/format';
import { colors } from '../lib/theme';
import type { BillWithSplits } from '../types';
import { Avatar } from './ui/Avatar';
import { NoteCard } from './ui/NoteCard';

/**
 * "Where do I stand" — the one number people open the Bills tab for.
 *
 * Every figure is set in mono. That is the design system's ledger rule, and it
 * also does real work here: proportional digits make ₱1,180.00 and ₱1,190.00
 * hard to tell apart down a column, and this card is nothing but columns.
 */
export function SettleUpCard({
  bills,
  userId,
  /** Drops the per-housemate breakdown — the dashboard only wants the headline. */
  compact = false,
}: {
  bills: BillWithSplits[];
  userId: string;
  compact?: boolean;
}) {
  const balance = summariseBalance(bills, userId);
  const people = compact ? [] : settleUp(bills, userId);

  const settled = balance.net === 0;
  const inCredit = balance.net > 0;
  const headline = settled
    ? 'All settled'
    : `${inCredit ? '+' : ''}${formatPeso(balance.net)}`;

  return (
    <NoteCard tape={colors.mustard} tapeAlign="center" className="px-5 pb-4 pt-6">
      <Text className="text-center font-ui-bold text-[11px] uppercase tracking-[1.4px] text-ink-muted">
        Settle up
      </Text>

      <Text
        className={`mt-1 text-center text-3xl ${
          settled ? 'font-hand-bold text-ink' : 'font-mono-bold'
        } ${settled ? '' : inCredit ? 'text-deep-sage' : 'text-deep-brick'}`}
      >
        {headline}
      </Text>

      <Text className="mt-1 text-center font-ui text-sm text-ink-muted">
        {settled
          ? 'Walang utang, walang paniningil.'
          : inCredit
            ? 'Net na dapat sa iyo ng bahay.'
            : 'Net na dapat mong bayaran.'}
      </Text>

      <View className="mt-4 flex-row gap-3">
        <Totals label="You owe" amount={balance.owed} tone="brick" />
        <Totals label="Owed to you" amount={balance.owing} tone="sage" />
      </View>

      {people.length > 0 ? (
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
      ) : null}
    </NoteCard>
  );
}

function Totals({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: 'brick' | 'sage';
}) {
  return (
    <View
      className={`flex-1 rounded-lg px-3 py-2.5 ${
        tone === 'brick' ? 'bg-wash-brick' : 'bg-wash-sage'
      }`}
    >
      <Text
        className={`font-ui-semibold text-[11px] ${
          tone === 'brick' ? 'text-deep-brick' : 'text-deep-sage'
        }`}
      >
        {label}
      </Text>
      <Text
        className={`mt-0.5 font-mono-bold text-base ${
          tone === 'brick' ? 'text-deep-brick' : 'text-deep-sage'
        }`}
      >
        {formatPeso(amount)}
      </Text>
    </View>
  );
}
