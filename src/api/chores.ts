import type { ChoreRecurrence } from '../lib/database.types';
import { addDays, fromDateString, toDateString, todayString } from '../lib/format';
import { supabase } from '../lib/supabase';
import type { AssignmentWithProfile, ChoreWithAssignments, MemberWithProfile } from '../types';

export async function fetchChores(householdId: string): Promise<ChoreWithAssignments[]> {
  const { data, error } = await supabase
    .from('chores')
    .select('*, assignments:chore_assignments(*, profile:profiles(*))')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const chores = (data ?? []) as unknown as ChoreWithAssignments[];
  return chores.map((chore) => ({
    ...chore,
    assignments: [...chore.assignments].sort((a, b) => a.due_date.localeCompare(b.due_date)),
  }));
}

export type NewChoreInput = {
  householdId: string;
  title: string;
  description: string | null;
  recurrence: ChoreRecurrence;
  assigneeId: string;
  dueDate: string;
};

export async function createChore(input: NewChoreInput): Promise<void> {
  const { data: chore, error } = await supabase
    .from('chores')
    .insert({
      household_id: input.householdId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      recurrence: input.recurrence,
    })
    .select('*')
    .single();

  if (error) throw error;

  const { error: assignmentError } = await supabase.from('chore_assignments').insert({
    chore_id: chore.id,
    user_id: input.assigneeId,
    due_date: input.dueDate,
  });

  if (assignmentError) {
    await supabase.from('chores').delete().eq('id', chore.id);
    throw assignmentError;
  }
}

export async function deleteChore(choreId: string): Promise<void> {
  const { error } = await supabase.from('chores').delete().eq('id', choreId);
  if (error) throw error;
}

/**
 * Marks an assignment done (or undone). When a recurring chore is completed the
 * next turn is created straight away for the next housemate in rotation, which
 * is what keeps the "who's up next" view honest.
 */
export async function setAssignmentCompleted(
  chore: ChoreWithAssignments,
  assignment: AssignmentWithProfile,
  completed: boolean,
  members: MemberWithProfile[]
): Promise<void> {
  const { error } = await supabase
    .from('chore_assignments')
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq('id', assignment.id);

  if (error) throw error;

  if (!completed || chore.recurrence === 'once' || members.length === 0) return;

  const nextDue = nextDueDate(assignment.due_date, chore.recurrence);

  // Don't queue a duplicate if someone already created the following turn.
  const alreadyQueued = chore.assignments.some(
    (existing) => !existing.completed && existing.id !== assignment.id
  );
  if (alreadyQueued) return;

  const { error: insertError } = await supabase.from('chore_assignments').insert({
    chore_id: chore.id,
    user_id: nextAssigneeId(assignment.user_id, members),
    due_date: nextDue,
  });

  if (insertError) throw insertError;
}

// ---------------------------------------------------------------------------
// Rotation helpers
// ---------------------------------------------------------------------------

/** Members rotate in the order they joined the household. */
export function nextAssigneeId(currentUserId: string, members: MemberWithProfile[]): string {
  if (members.length === 0) return currentUserId;
  const index = members.findIndex((member) => member.user_id === currentUserId);
  if (index === -1) return members[0].user_id;
  return members[(index + 1) % members.length].user_id;
}

export function nextDueDate(fromDate: string, recurrence: ChoreRecurrence): string {
  const base = fromDateString(fromDate);
  switch (recurrence) {
    case 'daily':
      return toDateString(addDays(base, 1));
    case 'weekly':
      return toDateString(addDays(base, 7));
    case 'monthly': {
      const next = new Date(base);
      next.setMonth(next.getMonth() + 1);
      return toDateString(next);
    }
    default:
      return fromDate;
  }
}

/** The assignment a housemate still has to do — the earliest unfinished one. */
export function openAssignment(chore: ChoreWithAssignments): AssignmentWithProfile | null {
  return chore.assignments.find((assignment) => !assignment.completed) ?? null;
}

/**
 * How many turns in a row a housemate has finished, per user id.
 *
 * NOTE — this is derived on the client, not stored. The schema records each
 * turn's `completed` flag and `due_date` but has no streak column, so a streak
 * here means "walking that person's past turns newest-first, how many are
 * ticked before the first one that isn't". A turn that is still open but not
 * yet late is skipped rather than counted as a break — you haven't lost a
 * streak at 9am on the morning something is due.
 *
 * Two consequences worth knowing before this ends up on a screen anyone
 * competes over:
 *
 *  - It only sees the assignments currently loaded. `fetchChores` pulls every
 *    assignment for the household, so today that is the full history; if that
 *    query ever gets a window, streaks silently cap at the window.
 *  - Un-ticking an old turn retroactively breaks the streak, which is correct
 *    but can surprise someone who tapped Undo on last month's dishes.
 *
 * If streaks become something the app promises rather than decorates, the
 * honest fix is a `chore_streaks` view (or a counter maintained by the same
 * trigger that queues the next turn) rather than growing this function — that
 * would be a schema change, which this design pass deliberately doesn't make.
 */
export function choreStreaks(
  chores: ChoreWithAssignments[],
  today = todayString()
): Record<string, number> {
  const byUser = new Map<string, AssignmentWithProfile[]>();

  for (const chore of chores) {
    for (const assignment of chore.assignments) {
      const bucket = byUser.get(assignment.user_id);
      if (bucket) bucket.push(assignment);
      else byUser.set(assignment.user_id, [assignment]);
    }
  }

  const streaks: Record<string, number> = {};

  for (const [userId, assignments] of byUser) {
    const history = [...assignments].sort((a, b) => b.due_date.localeCompare(a.due_date));

    let streak = 0;
    for (const assignment of history) {
      if (assignment.completed) {
        streak += 1;
        continue;
      }
      // Still open but not yet late — doesn't count either way.
      if (assignment.due_date >= today) continue;
      break;
    }

    streaks[userId] = streak;
  }

  return streaks;
}
