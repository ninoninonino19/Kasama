import { useRouter } from 'expo-router';

import { createChore } from '../../src/api/chores';
import { notifyHousehold } from '../../src/api/notify';
import { ChoreForm } from '../../src/components/ChoreForm';
import { toDateString } from '../../src/lib/format';
import { haptics } from '../../src/lib/haptics';
import { formatRelativeDate } from '../../src/lib/format';
import { useHousehold, useProfile } from '../../src/store/useSessionStore';

export default function NewChoreScreen() {
  const router = useRouter();
  const household = useHousehold();
  const profile = useProfile();

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

        // Just the person whose turn it is. `notify` drops it anyway if that's
        // the same person who created the chore.
        notifyHousehold({
          householdId: household.id,
          category: 'chores',
          title: `Ikaw ang una sa ${values.title}`,
          body: `${profile?.display_name.split(' ')[0] ?? 'Isang kasama'} set it up — due ${formatRelativeDate(values.dueDate)}.`,
          data: { screen: 'chores' },
          only: [values.assigneeId],
        });

        router.back();
      }}
    />
  );
}
