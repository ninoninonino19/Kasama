import { useRouter } from 'expo-router';

import { createChore } from '../../src/api/chores';
import { ChoreForm } from '../../src/components/ChoreForm';
import { toDateString } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { useHousehold } from '../../src/store/useSessionStore';

export default function NewChoreScreen() {
  const router = useRouter();
  const household = useHousehold();

  return (
    <ChoreForm
      mode="create"
      submitLabel="Save chore"
      onSubmit={async (values) => {
        if (!household) return;
        await createChore({
          householdId: household.id,
          title: values.title,
          description: values.description || null,
          recurrence: values.recurrence,
          assigneeId: values.assigneeId,
          dueDate: toDateString(values.dueDate),
        });
        haptics.success();
        router.back();
      }}
    />
  );
}
