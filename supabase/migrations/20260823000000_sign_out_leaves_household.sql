-- ============================================================================
-- Signing out means moving out, and what you leave behind is shared.
--
-- Kasama has no password. A session is the whole identity, so signing out was
-- already the end of a person — the account screen says so in as many words —
-- but the *household* never heard about it: the membership row stayed, the
-- name stayed in every split list, and open chore turns kept coming round to
-- somebody who could not open the app to do them. The vote-based leave request
-- is the right shape for someone who is still here and can wait for an answer;
-- it is the wrong shape for someone whose identity has just stopped existing,
-- because there is nobody left to hold the vote about.
--
-- So a departure now settles itself, and it does it in one place — the
-- `household_members` delete trigger — because there are four doors into it
-- and they should all end in the same state:
--
--   * signing out (new: `leave_all_households` below)
--   * a leave request the house accepted
--   * an admin removing somebody
--   * a household being deleted out from under everyone
--
-- What the house inherits:
--
--   * Unpaid shares of bills, split equally among the housemates still here.
--     Kasama already lets a bill be split unevenly, so a redistribution that
--     lands on nice round numbers was never the goal — adding back up to what
--     was owed is.
--   * Open chore turns, dealt round-robin across everyone left rather than
--     dropped whole on the next person in the rotation. One housemate leaving
--     should not mean another housemate does all their chores.
--
-- What it deliberately does not touch, as before: bills themselves, *paid*
-- splits, and finished chore turns. Those are the record of what happened. A
-- housemate moving out does not un-pay what they paid or un-do what they did.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Handing on what somebody still owed
--
-- Per bill rather than per household, because who can absorb a share depends
-- on the bill: the housemates who have already settled their own part of it
-- are done, and enlarging a split marked paid would quietly turn a payment
-- somebody made into a payment somebody owes.
--
-- Three tiers, in order:
--   1. Housemates still here whose own share of this bill is unpaid.
--   2. Failing that, housemates still here who are not on the bill at all —
--      an unevenly split bill can leave somebody off it entirely, and they are
--      a better answer than nobody.
--   3. Failing both, the share is written off. Everyone still in the house has
--      already paid their part, so there is no one to hand it to, and leaving
--      it owed by a person who has gone would keep the bill unsettled forever.
--      `bills.amount` keeps its face value — that is what the bill was — so
--      such a bill ends up with splits totalling less than its amount, which
--      is exactly what "the house ate the difference" looks like.
-- ----------------------------------------------------------------------------
create or replace function public.redistribute_departing_shares(hid uuid, leaver uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  share record;
  recipients uuid[];
  headcount int;
  base numeric(12, 2);
  spare int;
  position int;
begin
  for share in
    select s.id, s.bill_id, s.amount_owed
    from public.bill_splits s
    join public.bills b on b.id = s.bill_id
    where b.household_id = hid
      and s.user_id = leaver
      and not s.paid
      and s.amount_owed > 0
    order by s.id
  loop
    select array_agg(m.user_id order by m.joined_at, m.user_id)
      into recipients
    from public.household_members m
    join public.bill_splits s
      on s.bill_id = share.bill_id and s.user_id = m.user_id
    where m.household_id = hid and not s.paid;

    if recipients is null then
      select array_agg(m.user_id order by m.joined_at, m.user_id)
        into recipients
      from public.household_members m
      where m.household_id = hid
        and not exists (
          select 1 from public.bill_splits s
          where s.bill_id = share.bill_id and s.user_id = m.user_id
        );
    end if;

    if recipients is null then
      delete from public.bill_splits s where s.id = share.id;
      continue;
    end if;

    headcount := array_length(recipients, 1);

    -- Floored to the centavo, then the centavos that floor threw away are
    -- handed out one each from the top. Dividing ₱100 three ways as ₱33.33
    -- apiece loses a centavo of somebody's money; this way the parts still add
    -- back up to the whole, and the person who has been here longest carries
    -- the odd centavo rather than the app inventing one.
    base := trunc(share.amount_owed / headcount, 2);
    spare := round((share.amount_owed - base * headcount) * 100)::int;

    for position in 1 .. headcount loop
      insert into public.bill_splits (bill_id, user_id, amount_owed)
      values (
        share.bill_id,
        recipients[position],
        base + case when position <= spare then 0.01 else 0 end
      )
      on conflict (bill_id, user_id) do update
        set amount_owed = public.bill_splits.amount_owed + excluded.amount_owed;
    end loop;

    delete from public.bill_splits s where s.id = share.id;
  end loop;
end;
$$;

revoke all on function public.redistribute_departing_shares(uuid, uuid) from public;

-- ----------------------------------------------------------------------------
-- Cleaning up behind someone who has gone
--
-- Replaces the version in `20260822020000_leave_requests.sql`. Two changes:
-- the money is now handed on, and the chore turns are dealt out instead of
-- being given to one successor.
--
-- The deal still *starts* at the successor — the first person who joined after
-- them, wrapping round — so the rotation reads the same as it does when a
-- chore is ticked off, and a single leftover turn goes where it always went.
-- It is only when there is more than one turn that the rest of the house is
-- brought in.
-- ----------------------------------------------------------------------------
create or replace function public.handle_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  successors uuid[];
  headcount int;
  turn record;
  dealt int := 0;
begin
  -- Their own request, if it is still open — they are out either way now.
  update public.leave_requests r
     set status = 'completed', resolved_at = now()
   where r.household_id = old.household_id
     and r.user_id = old.user_id
     and r.status = 'pending';

  -- Their unpaid shares, before the chores: a housemate reading the app a
  -- second later should not see the rota redrawn while the money still names
  -- somebody who has gone.
  perform public.redistribute_departing_shares(old.household_id, old.user_id);

  -- Everyone still here, in rotation order starting from whoever follows the
  -- person leaving. Same ordering `nextAssigneeId` uses in the app.
  select array_agg(m.user_id order by (m.joined_at > old.joined_at) desc, m.joined_at asc)
    into successors
  from public.household_members m
  where m.household_id = old.household_id;

  if successors is null then
    return old;
  end if;

  headcount := array_length(successors, 1);

  for turn in
    select a.id
    from public.chore_assignments a
    where a.user_id = old.user_id
      and not a.completed
      and public.household_of_chore(a.chore_id) = old.household_id
    order by a.due_date, a.id
  loop
    update public.chore_assignments a
       set user_id = successors[(dealt % headcount) + 1]
     where a.id = turn.id;
    dealt := dealt + 1;
  end loop;

  -- One fewer person to wait for may be what finishes somebody else's request.
  perform public.settle_ready_leave_requests(old.household_id);

  return old;
end;
$$;

drop trigger if exists on_household_member_removed on public.household_members;
create trigger on_household_member_removed
  after delete on public.household_members
  for each row execute function public.handle_member_removed();

-- ----------------------------------------------------------------------------
-- Signing out
--
-- Every membership, not just the one the app shows: the app keeps one active
-- household per person, but nothing in the schema promises that, and half a
-- departure is worse than none.
--
-- No vote, on purpose. `request_household_leave` asks the house because the
-- person asking is still in it and can wait for an answer; someone signing out
-- has thrown away the only way back into their account, so there is nobody for
-- a pending request to resolve to. Everything the vote was protecting still
-- happens — the trigger above hands their unpaid shares to the house rather
-- than letting them walk off with them.
--
-- Returns how many households they left, so the client can tell "there was
-- nothing to leave" from "the network ate it".
-- ----------------------------------------------------------------------------
create or replace function public.leave_all_households()
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  departed int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  delete from public.household_members m where m.user_id = auth.uid();
  get diagnostics departed = row_count;

  return departed;
end;
$$;

revoke all on function public.leave_all_households() from public;
grant execute on function public.leave_all_households() to authenticated;
