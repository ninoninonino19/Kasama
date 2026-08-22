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

export async function fetchChore(choreId: string): Promise<ChoreWithAssignments | null> {
  const { data, error } = await supabase
    .from('chores')
    .select('*, assignments:chore_assignments(*, profile:profiles(*))')
    .eq('id', choreId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const chore = data as unknown as ChoreWithAssignments;
  return {
    ...chore,
    assignments: [...chore.assignments].sort((a, b) => a.due_date.localeCompare(b.due_date)),
  };
}

export type ChoreUpdateInput = {
  title: string;
  description: string | null;
  recurrence: ChoreRecurrence;
};

export async function updateChore(choreId: string, input: ChoreUpdateInput): Promise<void> {
  const { error } = await supabase
    .from('chores')
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      recurrence: input.recurrence,
    })
    .eq('id', choreId);

  if (error) throw error;
}

/**
 * Moves an open turn to someone else, or to another day.
 *
 * Only ever applied to the turn that is still open. Rewriting a finished one
 * would quietly rewrite history — including the streaks derived from it.
 */
export async function updateAssignment(
  assignmentId: string,
  input: { userId: string; dueDate: string }
): Promise<void> {
  const { error } = await supabase
    .from('chore_assignments')
    .update({ user_id: input.userId, due_date: input.dueDate })
    .eq('id', assignmentId);

  if (error) throw error;
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

/**
 * Members rotate in the order they joined the household.
 *
 * `members` is the *current* list, so someone who has moved out is not in it
 * and the rotation closes over the gap on its own. The `index === -1` arm is
 * the same case seen from the other side: the turn being finished belongs to
 * somebody who has since left, and the rotation starts again from the top
 * rather than handing the next turn to a person who isn't here.
 *
 * The database keeps the same rule for turns that are still open when someone
 * goes — see `handle_member_removed` in the leave_requests migration. Two
 * implementations of one rule, deliberately: this one runs when a chore is
 * ticked, that one when a household changes shape, and neither can reach the
 * other's moment.
 */
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
 * Consecutive finished turns per housemate, keyed by user id.
 *
 * The counting rule lives in the `chore_streaks` view (see its migration), not
 * here — deriving it in JS only worked on the one screen that happens to load
 * every assignment, and put "how is a streak counted" inside a component.
 */
export async function fetchChoreStreaks(householdId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('chore_streaks')
    .select('user_id, streak')
    .eq('household_id', householdId);

  if (error) throw error;

  return Object.fromEntries((data ?? []).map((row) => [row.user_id, row.streak]));
}
