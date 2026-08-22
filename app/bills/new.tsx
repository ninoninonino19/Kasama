import { useRouter } from 'expo-router';

import { createBill } from '../../src/api/bills';
import { notifyHousehold } from '../../src/api/notify';
import { BillForm } from '../../src/components/BillForm';
import { formatPeso, toDateString } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { useHousehold, useProfile, useSessionStore } from '../../src/store/useSessionStore';

export default function NewBillScreen() {
  const router = useRouter();
  const household = useHousehold();
  const profile = useProfile();
  const userId = useSessionStore((state) => state.userId);

  return (
    <BillForm
      mode="create"
      title="New bill"
      submitLabel="Save bill"
      onSubmit={async (values) => {
        if (!household || !userId) return;
        await createBill({
          householdId: household.id,
          createdBy: userId,
          title: values.title,
          amount: values.amount,
          category: values.category,
          dueDate: values.dueDate ? toDateString(values.dueDate) : null,
          recurrence: values.recurrence,
          splits: values.splits,
        });
        haptics.success();

        // Only the people who now owe something — the rest of the house
        // doesn't need a buzz about a bill that isn't theirs.
        notifyHousehold({
          householdId: household.id,
          category: 'bills',
          title: `${profile?.display_name.split(' ')[0] ?? 'A housemate'} logged ${values.title}`,
          body: `${formatPeso(values.amount)} total — open it to see your share.`,
          data: { screen: 'bills' },
          only: values.splits
            .filter((split) => split.userId !== userId && split.amount > 0)
            .map((split) => split.userId),
        });

        router.back();
      }}
    />
  );
}
