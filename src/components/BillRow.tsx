import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { billOutstanding, isBillSettled } from '../api/bills';
import { categoryMeta } from '../lib/categories';
import { formatPeso, formatRelativeDate } from '../lib/format';
import type { BillWithSplits } from '../types';
import { Badge } from './ui/Chip';
import { Card } from './ui/Card';

export function BillRow({ bill, onPress }: { bill: BillWithSplits; onPress: () => void }) {
  const meta = categoryMeta(bill.category);
  const settled = isBillSettled(bill);
  const outstanding = billOutstanding(bill);

  return (
    <Card onPress={onPress}>
      <View className="flex-row items-center gap-3">
        <View
          className="h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: meta.background }}
        >
          <Ionicons name={meta.icon} size={20} color={meta.tint} />
        </View>

        <View className="flex-1">
          <Text className="text-base font-bold text-ink" numberOfLines={1}>
            {bill.title}
          </Text>
          <Text className="mt-0.5 text-xs text-ink-muted">
            {meta.subtitle}
            {bill.due_date ? ` · Due ${formatRelativeDate(bill.due_date)}` : ''}
          </Text>
        </View>

        <View className="items-end gap-1">
          <Text className="text-base font-bold text-ink">{formatPeso(Number(bill.amount))}</Text>
          {settled ? (
            <Badge label="Settled" tone="success" />
          ) : (
            <Badge label={`${formatPeso(outstanding)} left`} tone="warning" />
          )}
        </View>
      </View>
    </Card>
  );
}
