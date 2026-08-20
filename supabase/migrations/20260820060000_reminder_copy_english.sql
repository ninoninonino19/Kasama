-- ============================================================================
-- Rewrites the daily digest's copy in English.
--
-- `pending_reminders` composes the body of every push notification the digest
-- sends, so the app's language change only reaches people's lock screens once
-- this function is replaced too. Nothing about who gets reminded changes here
-- — same two queries, same rules, same grants — only the wording.
--
-- Replaces the definition from 20260820050000_pending_reminders.sql rather
-- than editing it, so an already-migrated database picks the change up.
-- ============================================================================

create or replace function public.pending_reminders(target_date date)
returns table (
  user_id uuid,
  household_id uuid,
  category text,
  title text,
  body text
)
language sql
stable
security definer
set search_path = public
as $$
  -- Bills: everyone with an unsettled share falling due on the day.
  select
    s.user_id,
    b.household_id,
    'bills'::text as category,
    b.title,
    'Due ' || to_char(b.due_date, 'FMMon FMDD') || ' — ₱'
      || to_char(s.amount_owed, 'FM999,999,990.00') || ' is your share.' as body
  from public.bill_splits s
  join public.bills b on b.id = s.bill_id
  where b.due_date = target_date
    and not s.paid
    -- The payer's own share is created already paid, but guard anyway: nobody
    -- should be reminded to pay themselves back.
    and s.user_id <> b.created_by

  union all

  -- Chores: whoever's turn lands on the day and hasn't ticked it off.
  select
    a.user_id,
    c.household_id,
    'chores'::text as category,
    c.title,
    'Your turn on ' || to_char(a.due_date, 'FMMon FMDD') || '.' as body
  from public.chore_assignments a
  join public.chores c on c.id = a.chore_id
  where a.due_date = target_date
    and not a.completed;
$$;

revoke all on function public.pending_reminders(date) from public;
revoke all on function public.pending_reminders(date) from authenticated;
grant execute on function public.pending_reminders(date) to service_role;
