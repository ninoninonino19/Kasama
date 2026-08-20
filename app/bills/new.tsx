import { useRouter } from 'expo-router';

import { createBill } from '../../src/api/bills';
import { BillForm } from '../../src/components/BillForm';
import { toDateString } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { useHousehold, useSessionStore } from '../../src/store/useSessionStore';

export default function NewBillScreen() {
  const router = useRouter();
  const household = useHousehold();
  const userId = useSessionStore((state) => state.userId);

  return (
    <BillForm
      mode="create"
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
        router.back();
      }}
    />
  );
}
