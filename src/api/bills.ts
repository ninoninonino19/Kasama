import { supabase } from '../lib/supabase';
import type { BillCategory, BillRecurrence } from '../lib/database.types';
import type { BalanceSummary, BillWithSplits } from '../types';

export async function fetchBills(householdId: string): Promise<BillWithSplits[]> {
  const { data, error } = await supabase
    .from('bills')
    .select('*, splits:bill_splits(*, profile:profiles(*))')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as BillWithSplits[];
}

export async function fetchBill(billId: string): Promise<BillWithSplits | null> {
  const { data, error } = await supabase
    .from('bills')
    .select('*, splits:bill_splits(*, profile:profiles(*))')
    .eq('id', billId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as unknown as BillWithSplits | null;
}

export type NewBillInput = {
  householdId: string;
  createdBy: string;
  title: string;
  amount: number;
  category: BillCategory;
  dueDate: string | null;
  recurrence: BillRecurrence;
  /** user_id → amount owed. The payer's own share is inserted as already paid. */
  splits: { userId: string; amount: number }[];
};

export async function createBill(input: NewBillInput): Promise<BillWithSplits> {
  const { data: bill, error } = await supabase
    .from('bills')
    .insert({
      household_id: input.householdId,
      created_by: input.createdBy,
      title: input.title.trim(),
      amount: input.amount,
      category: input.category,
      due_date: input.dueDate,
      recurrence: input.recurrence,
    })
    .select('*')
    .single();

  if (error) throw error;

  const rows = input.splits
    .filter((split) => split.amount > 0 || split.userId === input.createdBy)
    .map((split) => ({
      bill_id: bill.id,
      user_id: split.userId,
      amount_owed: split.amount,
      // Whoever logged the bill fronted the money, so their share starts settled.
      paid: split.userId === input.createdBy,
    }));

  if (rows.length > 0) {
    const { error: splitError } = await supabase.from('bill_splits').insert(rows);
    if (splitError) {
      // Don't leave a bill with no splits behind if the second write fails.
      await supabase.from('bills').delete().eq('id', bill.id);
      throw splitError;
    }
  }

  const created = await fetchBill(bill.id);
  if (!created) throw new Error('Bill was created but could not be loaded.');
  return created;
}

export async function setSplitPaid(splitId: string, paid: boolean): Promise<void> {
  const { error } = await supabase
    .from('bill_splits')
    .update({ paid, paid_at: paid ? new Date().toISOString() : null })
    .eq('id', splitId);

  if (error) throw error;
}

export async function settleWholeBill(billId: string): Promise<void> {
  const { error } = await supabase
    .from('bill_splits')
    .update({ paid: true, paid_at: new Date().toISOString() })
    .eq('bill_id', billId)
    .eq('paid', false);

  if (error) throw error;
}

export async function deleteBill(billId: string): Promise<void> {
  const { error } = await supabase.from('bills').delete().eq('id', billId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Derived values (kept here so the dashboard and bills tab agree)
// ---------------------------------------------------------------------------

export function isBillSettled(bill: BillWithSplits): boolean {
  return bill.splits.length > 0 && bill.splits.every((split) => split.paid);
}

export function billOutstanding(bill: BillWithSplits): number {
  return bill.splits
    .filter((split) => !split.paid)
    .reduce((total, split) => total + Number(split.amount_owed), 0);
}

export function summariseBalance(bills: BillWithSplits[], userId: string): BalanceSummary {
  let owed = 0;
  let owing = 0;

  for (const bill of bills) {
    for (const split of bill.splits) {
      if (split.paid) continue;
      const amount = Number(split.amount_owed);

      if (split.user_id === userId) {
        // I still owe this to whoever fronted the bill.
        owed += amount;
      } else if (bill.created_by === userId) {
        // I fronted this bill and this housemate hasn't paid me back.
        owing += amount;
      }
    }
  }

  return { owed, owing, net: owing - owed };
}
