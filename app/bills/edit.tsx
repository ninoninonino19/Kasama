import { useCallback } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { billSplitsLocked, fetchBill, updateBill } from '../../src/api/bills';
import { BillForm } from '../../src/components/BillForm';
import { FormScreen } from '../../src/components/ui/Screen';
import { ErrorState, LoadingState } from '../../src/components/ui/States';
import { useAsyncData } from '../../src/hooks/useAsyncData';
import { fromDateString, toDateString } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';

export default function EditBillScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const load = useCallback(() => (id ? fetchBill(id) : Promise.resolve(null)), [id]);
  const { data: bill, loading, error, refresh } = useAsyncData(load, [id]);

  // These two never reach `BillForm`, which is what carries the header on the
  // way through — so they have to bring their own, or a bill that failed to
  // load is a screen with no way out of it.
  if (loading) {
    return (
      <FormScreen title="Edit bill">
        <LoadingState label="Loading bill…" />
      </FormScreen>
    );
  }

  if (error || !bill) {
    return (
      <FormScreen title="Edit bill">
        <View className="flex-1 justify-center p-5">
          <ErrorState
            message={error ?? 'This bill no longer exists.'}
            onRetry={() => void refresh()}
          />
        </View>
      </FormScreen>
    );
  }

  const locked = billSplitsLocked(bill);

  // An even split is the common case, so only seed the custom fields when the
  // shares genuinely differ — otherwise reopening a bill would flip it into
  // custom mode for no reason.
  const amounts = bill.splits.map((split) => Number(split.amount_owed));
  const uneven = amounts.some((value) => Math.abs(value - amounts[0]) >= 0.01);

  return (
    <BillForm
      mode="edit"
      title="Edit bill"
      splitsLocked={locked}
      submitLabel="Save changes"
      initial={{
        title: bill.title,
        amount: Number(bill.amount),
        category: bill.category,
        dueDate: bill.due_date ? fromDateString(bill.due_date) : null,
        recurrence: bill.recurrence,
        participants: bill.splits.map((split) => split.user_id),
        customAmounts: uneven
          ? Object.fromEntries(
              bill.splits.map((split) => [split.user_id, Number(split.amount_owed)])
            )
          : undefined,
      }}
      onSubmit={async (values) => {
        await updateBill(bill, {
          title: values.title,
          category: values.category,
          dueDate: values.dueDate ? toDateString(values.dueDate) : null,
          recurrence: values.recurrence,
          ...(locked ? null : { amount: values.amount, splits: values.splits }),
        });
        haptics.success();
        router.back();
      }}
    />
  );
}
