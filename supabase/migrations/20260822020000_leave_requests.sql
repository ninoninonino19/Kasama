-- ============================================================================
-- Leaving a household is now something the house agrees to.
--
-- It used to be one delete: tap Leave, confirm, gone. That is the right shape
-- for a group chat and the wrong one for a house where money is outstanding —
-- the person with ₱3,000 of unsettled shares is exactly the person most
-- motivated to tap it, and the housemates left behind found out by noticing a
-- name had disappeared from the split list.
--
-- So leaving becomes a request the other housemates answer. Every remaining
-- member accepts, or one of them declines and says why. The app shows each
-- voter what the leaver still owes and is still owed *before* they answer,
-- which is the whole point: the decision is "have we settled up?", and until
-- now nobody was being asked.
--
-- Deliberately not enforced down here: the database does not refuse to
-- complete a leave that has money outstanding. Housemates forgive debts, write
-- them off, or settle in cash the app never sees, and a hard block would
-- strand someone in a household they have physically moved out of with no way
-- out but a support request. The house decides; this schema makes sure the
-- house is asked.
--
-- Two safety valves keep that from becoming a trap in the other direction:
-- an admin can cancel a request, and a request left pending never blocks
-- anything else — the leaver stays a full member until it completes.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'leave_request_status') then
    create type public.leave_request_status as enum
      ('pending', 'declined', 'cancelled', 'completed');
  end if;
  if not exists (select 1 from pg_type where typname = 'leave_vote') then
    create type public.leave_vote as enum ('accept', 'decline');
  end if;
end
$$;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.leave_request_status not null default 'pending',
  /** Why they're going. Optional — "moving out" is not owed to anyone. */
  reason text check (reason is null or char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- One open request per person per household. Asking twice is the same ask, and
-- two pending rows would split the vote tally between them.
create unique index if not exists leave_requests_one_open_idx
  on public.leave_requests (household_id, user_id)
  where status = 'pending';

create index if not exists leave_requests_household_idx
  on public.leave_requests (household_id, created_at desc);

create table if not exists public.leave_request_votes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.leave_requests (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  decision public.leave_vote not null,
  /** Attached to a decline: "you still owe me for July's water". */
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (request_id, voter_id)
);

create index if not exists leave_request_votes_request_idx
  on public.leave_request_votes (request_id);

-- ----------------------------------------------------------------------------
-- Row level security
--
-- Reads are open to the household — a vote everybody can see is the point.
-- There are no write policies at all: every change goes through one of the
-- definer functions below, which is what keeps "only the leaver can cancel"
-- and "you cannot vote on your own departure" in one place instead of three.
-- ----------------------------------------------------------------------------
alter table public.leave_requests enable row level security;
alter table public.leave_request_votes enable row level security;

drop policy if exists "leave requests readable by housemates" on public.leave_requests;
create policy "leave requests readable by housemates"
  on public.leave_requests for select
  to authenticated
  using (public.is_household_member(household_id) or user_id = auth.uid());

drop policy if exists "leave votes readable by housemates" on public.leave_request_votes;
create policy "leave votes readable by housemates"
  on public.leave_request_votes for select
  to authenticated
  using (
    exists (
      select 1 from public.leave_requests r
      where r.id = request_id
        and (public.is_household_member(r.household_id) or r.user_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- Asking to leave
-- ----------------------------------------------------------------------------
create or replace function public.request_household_leave(
  target_household uuid,
  reason text default null
)
returns public.leave_requests
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  request public.leave_requests;
  others int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if not exists (
    select 1 from public.household_members m
    where m.household_id = target_household and m.user_id = auth.uid()
  ) then
    raise exception 'You are not a member of this household';
  end if;

  -- Asking again is the same ask. Hand back the open one rather than failing
  -- on the unique index, so a double tap is not an error message.
  select * into request
  from public.leave_requests r
  where r.household_id = target_household
    and r.user_id = auth.uid()
    and r.status = 'pending';

  if found then
    return request;
  end if;

  select count(*) into others
  from public.household_members m
  where m.household_id = target_household and m.user_id <> auth.uid();

  if others = 0 then
    -- Nobody to ask. Waiting for a vote that can never be cast would lock the
    -- last person in the house into it.
    insert into public.leave_requests (household_id, user_id, reason, status, resolved_at)
    values (target_household, auth.uid(), nullif(trim(reason), ''), 'completed', now())
    returning * into request;

    delete from public.household_members m
    where m.household_id = target_household and m.user_id = auth.uid();

    return request;
  end if;

  insert into public.leave_requests (household_id, user_id, reason)
  values (target_household, auth.uid(), nullif(trim(reason), ''))
  returning * into request;

  return request;
end;
$$;

revoke all on function public.request_household_leave(uuid, text) from public;
grant execute on function public.request_household_leave(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Answering one
-- ----------------------------------------------------------------------------
create or replace function public.vote_on_leave_request(
  request uuid,
  decision public.leave_vote,
  note text default null
)
returns public.leave_requests
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  target public.leave_requests;
  outstanding int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into target from public.leave_requests r where r.id = request;
  if not found then
    raise exception 'That request no longer exists';
  end if;

  if target.status <> 'pending' then
    raise exception 'That request has already been answered';
  end if;

  if target.user_id = auth.uid() then
    raise exception 'You cannot vote on your own departure';
  end if;

  if not exists (
    select 1 from public.household_members m
    where m.household_id = target.household_id and m.user_id = auth.uid()
  ) then
    raise exception 'You are not a member of this household';
  end if;

  -- Changing your mind is allowed right up until the request resolves, which
  -- is what makes "decline until you pay me back" workable: they settle up,
  -- you switch to accept, and nobody has to start over.
  insert into public.leave_request_votes (request_id, voter_id, decision, note)
  values (request, auth.uid(), decision, nullif(trim(note), ''))
  on conflict (request_id, voter_id)
  do update set decision = excluded.decision, note = excluded.note, created_at = now();

  if decision = 'decline' then
    update public.leave_requests r
       set status = 'declined', resolved_at = now()
     where r.id = request
    returning * into target;
    return target;
  end if;

  -- Everyone still in the house has to have said yes. Counted against the
  -- current member list rather than against a tally taken when the request
  -- opened, so a housemate who joins midway is asked too.
  select count(*) into outstanding
  from public.household_members m
  where m.household_id = target.household_id
    and m.user_id <> target.user_id
    and not exists (
      select 1 from public.leave_request_votes v
      where v.request_id = request and v.voter_id = m.user_id and v.decision = 'accept'
    );

  if outstanding > 0 then
    return target;
  end if;

  -- Marked resolved before the membership goes, so the trigger below finds
  -- nothing left to close and this stays the one place that decides why a
  -- request ended.
  update public.leave_requests r
     set status = 'completed', resolved_at = now()
   where r.id = request
  returning * into target;

  delete from public.household_members m
  where m.household_id = target.household_id and m.user_id = target.user_id;

  return target;
end;
$$;

revoke all on function public.vote_on_leave_request(uuid, public.leave_vote, text) from public;
grant execute on function public.vote_on_leave_request(uuid, public.leave_vote, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Taking it back
--
-- Open to the leaver — plans change — and to an admin, who needs a way to
-- clear a request the house has talked about and settled offline. Neither can
-- force the leave through; cancelling only ever ends a request.
-- ----------------------------------------------------------------------------
create or replace function public.cancel_leave_request(request uuid)
returns public.leave_requests
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  target public.leave_requests;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into target from public.leave_requests r where r.id = request;
  if not found then
    raise exception 'That request no longer exists';
  end if;

  if target.status <> 'pending' then
    return target;
  end if;

  if target.user_id <> auth.uid()
     and not public.is_household_admin(target.household_id) then
    raise exception 'Only the person leaving, or an admin, can withdraw this';
  end if;

  update public.leave_requests r
     set status = 'cancelled', resolved_at = now()
   where r.id = request
  returning * into target;

  return target;
end;
$$;

revoke all on function public.cancel_leave_request(uuid) from public;
grant execute on function public.cancel_leave_request(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Cleaning up behind someone who has gone
--
-- Whichever way a membership ends — an approved leave, an admin removing
-- someone, a household being deleted out from under them — the same two things
-- have to be true afterwards: no open chore turn is assigned to a person who
-- cannot do it, and no request is left waiting on a vote from someone who is
-- no longer in the room.
--
-- A trigger rather than a step inside the functions above, because "removed by
-- an admin" and "left by agreement" are different doors into the same state,
-- and the version of this that lived in one function only ever covered one of
-- them.
--
-- What it deliberately does not touch: bills, splits and *finished* chore
-- turns. Those are the record of what actually happened, and a housemate
-- moving out does not un-owe what they owed or un-do what they did.
-- ----------------------------------------------------------------------------
create or replace function public.handle_member_removed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  successor uuid;
begin
  -- Their own request, if it is still open — they are out either way now.
  update public.leave_requests r
     set status = 'completed', resolved_at = now()
   where r.household_id = old.household_id
     and r.user_id = old.user_id
     and r.status = 'pending';

  -- Whoever is next in the rotation: the first person who joined after them,
  -- wrapping round to the earliest member if they were the most recent. Same
  -- order `nextAssigneeId` uses in the app, so the rotation reads the same
  -- whether it advanced by someone ticking a chore or by someone moving out.
  select m.user_id into successor
  from public.household_members m
  where m.household_id = old.household_id
  order by (m.joined_at > old.joined_at) desc, m.joined_at asc
  limit 1;

  if successor is null then
    return old;
  end if;

  update public.chore_assignments a
     set user_id = successor
   where a.user_id = old.user_id
     and not a.completed
     and public.household_of_chore(a.chore_id) = old.household_id;

  return old;
end;
$$;

drop trigger if exists on_household_member_removed on public.household_members;
create trigger on_household_member_removed
  after delete on public.household_members
  for each row execute function public.handle_member_removed();

-- ----------------------------------------------------------------------------
-- Realtime
--
-- A request that resolves has to reach two different screens: the housemates
-- watching the tally, and the leaver, who stops being a member at the moment
-- it completes and so stops receiving `household_members` changes for the
-- house they were in. `leave_requests` stays readable to them afterwards —
-- see the `user_id = auth.uid()` arm of its select policy — which is what lets
-- their own screen find out that they are out.
-- ----------------------------------------------------------------------------
alter table public.leave_requests replica identity full;
alter table public.leave_request_votes replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'leave_requests'
  ) then
    alter publication supabase_realtime add table public.leave_requests;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'leave_request_votes'
  ) then
    alter publication supabase_realtime add table public.leave_request_votes;
  end if;
end
$$;
