-- ============================================================================
-- Logging a bill is not the same as having paid it.
--
-- Every split used to be created with `paid = (user_id = created_by)`: the
-- person who typed the bill in was assumed to have fronted the money, so their
-- own share opened settled. That is one household's habit, not a rule. In a
-- house where whoever notices the SOA is the one who posts it, the poster owes
-- their share like everyone else — and the app was quietly telling them they
-- didn't, marking the bill closer to settled than it was and hiding their
-- share from "you owe".
--
-- So `created_by` now means what it says: who logged it, and who the rest of
-- the house settles up with. Whether they have paid is a question the tick box
-- answers, the same as for everyone else.
--
-- Existing rows are deliberately left alone. A paid split that was auto-set
-- months ago is indistinguishable, from here, from one somebody ticked on
-- purpose, and re-opening real payments across every household to correct the
-- ones that were assumed would cost more than it fixes. This changes what
-- happens from now on.
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

  -- Nobody is left to split next month's rent between. Rolling it forward
  -- would create a bill that can never settle, and so never stop rolling.
  if not exists (
    select 1
    from public.bill_splits s
    join public.household_members m
      on m.user_id = s.user_id and m.household_id = source.household_id
    where s.bill_id = source.id
  ) then
    return null;
  end if;

  insert into public.bills
    (household_id, title, amount, category, due_date, recurrence, created_by)
  values
    (source.household_id, source.title, source.amount, source.category,
     next_due, source.recurrence, source.created_by)
  returning id into new_id;

  -- Carry the same people and the same shares — but only the people who are
  -- still here. A housemate who moved out in March is not part of April's
  -- electricity, and a share nobody can tick keeps the bill open forever.
  --
  -- Everyone starts unpaid, the payer included: next month's rent has not been
  -- paid by anybody yet. The amount is a starting point rather than a
  -- prediction — kuryente is never the same twice — which is why the new bill
  -- is editable the moment it appears.
  insert into public.bill_splits (bill_id, user_id, amount_owed, paid, paid_at)
  select new_id, s.user_id, s.amount_owed, false, null
  from public.bill_splits s
  where s.bill_id = source.id
    and exists (
      select 1 from public.household_members m
      where m.household_id = source.household_id and m.user_id = s.user_id
    );

  return new_id;
end;
$$;

revoke all on function public.roll_recurring_bill(uuid) from public;
grant execute on function public.roll_recurring_bill(uuid) to authenticated;
