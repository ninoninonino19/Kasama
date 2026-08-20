-- ============================================================================
-- Recurring bills never actually recurred.
--
-- `bills.recurrence` has been stored since the schema landed, and the detail
-- screen shows a "Monthly" badge for it, but nothing ever created the next
-- occurrence — the column was a label, not a behaviour. Chores rotate on
-- completion; bills silently didn't.
--
-- This has to be a SECURITY DEFINER function rather than a client insert. The
-- bills INSERT policy requires `created_by = auth.uid()`, so whoever happened
-- to tick the last split would become the payer of next month's rent, and
-- their share would start pre-paid. The next occurrence has to inherit the
-- *original* payer, which only a definer function can write.
--
-- It also puts the "does this already exist" check in the same transaction as
-- the insert, so two housemates settling the same bill at once can't both
-- create next month's copy.
-- ============================================================================

create or replace function public.roll_recurring_bill(source_bill_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  source public.bills;
  next_due date;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into source from public.bills where id = source_bill_id;
  if not found then
    raise exception 'Bill not found';
  end if;

  -- SECURITY DEFINER bypasses RLS, so membership is checked by hand.
  if not public.is_household_member(source.household_id) then
    raise exception 'Not a member of this household';
  end if;

  if source.recurrence = 'none' then
    return null;
  end if;

  -- Serialise per bill so concurrent settles can't both pass the check below.
  perform pg_advisory_xact_lock(hashtext(source.id::text));

  -- Only a fully settled bill rolls forward.
  if exists (
    select 1 from public.bill_splits s
    where s.bill_id = source.id and not s.paid
  ) then
    return null;
  end if;

  -- A recurring bill with no due date has nothing to count from, so the next
  -- one is dated from today — "monthly starting when you settled it".
  next_due := (
    coalesce(source.due_date, current_date)
    + case source.recurrence
        when 'weekly' then interval '7 days'
        else interval '1 month'
      end
  )::date;

  -- Idempotent: re-settling an already-rolled bill is a no-op.
  if exists (
    select 1 from public.bills b
    where b.household_id = source.household_id
      and b.title = source.title
      and b.recurrence = source.recurrence
      and b.due_date = next_due
  ) then
    return null;
  end if;

  insert into public.bills
    (household_id, title, amount, category, due_date, recurrence, created_by)
  values
    (source.household_id, source.title, source.amount, source.category,
     next_due, source.recurrence, source.created_by)
  returning id into new_id;

  -- Carry the same people and the same shares. The amount is a starting point,
  -- not a prediction — kuryente is never the same twice — which is why the
  -- next bill is editable the moment it appears.
  insert into public.bill_splits (bill_id, user_id, amount_owed, paid, paid_at)
  select
    new_id,
    s.user_id,
    s.amount_owed,
    s.user_id = source.created_by,
    case when s.user_id = source.created_by then now() else null end
  from public.bill_splits s
  where s.bill_id = source.id;

  return new_id;
end;
$$;

revoke all on function public.roll_recurring_bill(uuid) from public;
grant execute on function public.roll_recurring_bill(uuid) to authenticated;
