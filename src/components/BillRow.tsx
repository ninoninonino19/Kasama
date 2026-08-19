import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { billOutstanding, billProgress, billStatus } from '../api/bills';
import { categoryMeta } from '../lib/categories';
import { formatPeso, formatRelativeDate } from '../lib/format';
import { BILL_STATUS } from '../lib/status';
import { colors } from '../lib/theme';
import type { BillWithSplits } from '../types';
import { NoteCard } from './ui/NoteCard';
import { Pill } from './ui/Pill';
import { ProgressBar } from './ui/ProgressBar';

/** Tape colour carries the same meaning as the pill, one glance earlier. */
const TAPE: Record<ReturnType<typeof billStatus>, string> = {
  settled: colors.sage,
  overdue: colors.brick,
  'due-soon': colors.mustard,
  open: colors.moss.light,
};

/**
 * A bill as a receipt pinned to the board.
 *
 * Two rows rather than one: on a phone the amount and the status pill used to
 * crowd the title down to a few characters. Giving the title its own line means
 * "Kuryente ng Agosto" reads in full at 390pt wide.
 */
export function BillRow({
  bill,
  onPress,
  /** Position in the list — only used to alternate the pin skew. */
  index = 0,
}: {
  bill: BillWithSplits;
  onPress: () => void;
  index?: number;
}) {
  const meta = categoryMeta(bill.category);
  const status = billStatus(bill);
  const badge = BILL_STATUS[status];
  const progress = billProgress(bill);
  const outstanding = billOutstanding(bill);

  const tone = status === 'overdue' ? 'brick' : status === 'due-soon' ? 'mustard' : 'moss';

  return (
    <NoteCard
      onPress={onPress}
      tape={TAPE[status]}
      rotate={index % 2 === 0 ? -0.35 : 0.35}
      className="pt-5"
    >
      <View className="min-h-[56px] flex-row items-center gap-3">
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
          {/* The icon already says which category this is, so the meta line
              spends its width on the due date — the part that changes. */}
          <Text className="mt-0.5 font-mono text-[11px] text-ink-muted" numberOfLines={1}>
            {bill.due_date ? `Due ${formatRelativeDate(bill.due_date)}` : meta.subtitle}
          </Text>
        </View>

        <Text className="font-mono-bold text-base text-ink">{formatPeso(Number(bill.amount))}</Text>
      </View>

      <View className="mt-3 gap-2 border-t border-line pt-2.5">
        <ProgressBar ratio={progress.ratio} tone={status === 'settled' ? 'moss' : tone} />
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 font-ui text-xs text-ink-muted" numberOfLines={1}>
            {progress.paid} of {progress.total} paid
            {status === 'settled' ? '' : ` · ${formatPeso(outstanding)} left`}
          </Text>
          <Pill label={badge.label} tone={badge.tone} icon={badge.icon} />
        </View>
      </View>
    </NoteCard>
  );
}
