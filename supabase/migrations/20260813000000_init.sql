-- ============================================================================
-- Kasama — initial schema
--
-- Everything is scoped to a household. A user only ever sees rows belonging to
-- a household they are a member of, enforced by RLS on every table.
--
-- Membership checks go through SECURITY DEFINER helper functions so that the
-- policy on `household_members` does not have to read `household_members`
-- through RLS (which would recurse infinitely).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type public.member_role as enum ('admin', 'member');
create type public.bill_category as enum ('rent', 'utilities', 'internet', 'groceries', 'other');
create type public.bill_recurrence as enum ('none', 'weekly', 'monthly');
create type public.chore_recurrence as enum ('once', 'daily', 'weekly', 'monthly');

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Kasama',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  amount numeric(12, 2) not null check (amount > 0),
  category public.bill_category not null default 'other',
  due_date date,
  recurrence public.bill_recurrence not null default 'none',
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.bill_splits (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_owed numeric(12, 2) not null check (amount_owed >= 0),
  paid boolean not null default false,
  paid_at timestamptz,
  unique (bill_id, user_id)
);

create table public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  description text,
  recurrence public.chore_recurrence not null default 'weekly',
  created_at timestamptz not null default now()
);

create table public.chore_assignments (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.chores (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  due_date date not null,
  completed boolean not null default false,
  completed_at timestamptz
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index household_members_user_idx on public.household_members (user_id);
create index household_members_household_idx on public.household_members (household_id);
create index bills_household_idx on public.bills (household_id, created_at desc);
create index bill_splits_bill_idx on public.bill_splits (bill_id);
create index bill_splits_user_idx on public.bill_splits (user_id) where paid = false;
create index chores_household_idx on public.chores (household_id);
create index chore_assignments_chore_idx on public.chore_assignments (chore_id);
create index chore_assignments_due_idx on public.chore_assignments (due_date);
create index announcements_household_idx on public.announcements (household_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER — they intentionally bypass RLS)
-- ----------------------------------------------------------------------------
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = hid
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_admin(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = hid
      and m.user_id = auth.uid()
      and m.role = 'admin'
  );
$$;

-- Do I share at least one household with this user? Controls profile visibility.
create or replace function public.shares_household_with(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select uid = auth.uid() or exists (
    select 1
    from public.household_members me
    join public.household_members them
      on them.household_id = me.household_id
    where me.user_id = auth.uid()
      and them.user_id = uid
  );
$$;

create or replace function public.household_of_bill(bid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.household_id from public.bills b where b.id = bid;
$$;

create or replace function public.household_of_chore(cid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.household_id from public.chores c where c.id = cid;
$$;

-- Short, human-readable, unambiguous invite codes (no I/O/0/1).
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.households h where h.invite_code = code);
  end loop;
  return code;
end;
$$;

alter table public.households
  alter column invite_code set default public.generate_invite_code();

-- ----------------------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------------------

-- Every auth user gets a profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The creator of a household is automatically its first admin member.
--
-- Note this fires at the END of the insert statement, which is too late for a
-- `RETURNING` clause — the select policy is evaluated before it runs. That is
-- why creating a household goes through public.create_household() instead of a
-- direct insert; see the follow-up migration.
create or replace function public.handle_new_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.created_by, 'admin')
  on conflict (household_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_household_created
  after insert on public.households
  for each row execute function public.handle_new_household();

-- Keep paid_at / completed_at honest without trusting the client.
create or replace function public.sync_bill_split_paid_at()
returns trigger
language plpgsql
as $$
begin
  if new.paid and (tg_op = 'INSERT' or not old.paid) then
    new.paid_at := coalesce(new.paid_at, now());
  elsif not new.paid then
    new.paid_at := null;
  end if;
  return new;
end;
$$;

create trigger bill_splits_paid_at
  before insert or update on public.bill_splits
  for each row execute function public.sync_bill_split_paid_at();

create or replace function public.sync_chore_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.completed and (tg_op = 'INSERT' or not old.completed) then
    new.completed_at := coalesce(new.completed_at, now());
  elsif not new.completed then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger chore_assignments_completed_at
  before insert or update on public.chore_assignments
  for each row execute function public.sync_chore_completed_at();

-- ----------------------------------------------------------------------------
-- Joining a household
--
-- A user cannot read a household they are not in, so joining goes through a
-- SECURITY DEFINER function that resolves the invite code for them.
-- ----------------------------------------------------------------------------
create or replace function public.join_household_by_code(code text)
returns public.households
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  target public.households;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into target
  from public.households h
  where upper(h.invite_code) = upper(trim(code));

  if target.id is null then
    raise exception 'That invite code does not match any household.'
      using errcode = 'P0002';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (target.id, auth.uid(), 'member')
  on conflict (household_id, user_id) do nothing;

  return target;
end;
$$;

grant execute on function public.join_household_by_code(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.bills enable row level security;
alter table public.bill_splits enable row level security;
alter table public.chores enable row level security;
alter table public.chore_assignments enable row level security;
alter table public.announcements enable row level security;

-- profiles ------------------------------------------------------------------
create policy "profiles readable by housemates"
  on public.profiles for select
  to authenticated
  using (public.shares_household_with(id));

create policy "profiles insert own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- households ----------------------------------------------------------------
create policy "households readable by members"
  on public.households for select
  to authenticated
  using (public.is_household_member(id));

create policy "households created by self"
  on public.households for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "households updated by admins"
  on public.households for update
  to authenticated
  using (public.is_household_admin(id))
  with check (public.is_household_admin(id));

create policy "households deleted by admins"
  on public.households for delete
  to authenticated
  using (public.is_household_admin(id));

-- household_members ---------------------------------------------------------
create policy "members readable by housemates"
  on public.household_members for select
  to authenticated
  using (public.is_household_member(household_id));

-- Membership is only ever created two ways: the trigger that makes the creator
-- an admin, and join_household_by_code (both SECURITY DEFINER). This policy is
-- the narrow fallback for the creator's own row — without the `created_by`
-- check, anyone who learned a household's UUID could add themselves to it and
-- skip the invite code entirely.
create policy "members insert self into own household"
  on public.household_members for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.households h
      where h.id = household_id and h.created_by = auth.uid()
    )
  );

create policy "members role managed by admins"
  on public.household_members for update
  to authenticated
  using (public.is_household_admin(household_id))
  with check (public.is_household_admin(household_id));

create policy "members leave or be removed by admin"
  on public.household_members for delete
  to authenticated
  using (user_id = auth.uid() or public.is_household_admin(household_id));

-- bills ---------------------------------------------------------------------
create policy "bills readable by members"
  on public.bills for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "bills insert by members"
  on public.bills for insert
  to authenticated
  with check (public.is_household_member(household_id) and created_by = auth.uid());

create policy "bills update by members"
  on public.bills for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "bills delete by creator or admin"
  on public.bills for delete
  to authenticated
  using (
    public.is_household_member(household_id)
    and (created_by = auth.uid() or public.is_household_admin(household_id))
  );

-- bill_splits ---------------------------------------------------------------
create policy "splits readable by members"
  on public.bill_splits for select
  to authenticated
  using (public.is_household_member(public.household_of_bill(bill_id)));

create policy "splits insert by members"
  on public.bill_splits for insert
  to authenticated
  with check (public.is_household_member(public.household_of_bill(bill_id)));

-- Housemates settle up for each other in real life, so any member may flip a
-- split to paid.
create policy "splits update by members"
  on public.bill_splits for update
  to authenticated
  using (public.is_household_member(public.household_of_bill(bill_id)))
  with check (public.is_household_member(public.household_of_bill(bill_id)));

create policy "splits delete by members"
  on public.bill_splits for delete
  to authenticated
  using (public.is_household_member(public.household_of_bill(bill_id)));

-- chores --------------------------------------------------------------------
create policy "chores readable by members"
  on public.chores for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "chores insert by members"
  on public.chores for insert
  to authenticated
  with check (public.is_household_member(household_id));

create policy "chores update by members"
  on public.chores for update
  to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "chores delete by members"
  on public.chores for delete
  to authenticated
  using (public.is_household_member(household_id));

-- chore_assignments ---------------------------------------------------------
create policy "assignments readable by members"
  on public.chore_assignments for select
  to authenticated
  using (public.is_household_member(public.household_of_chore(chore_id)));

create policy "assignments insert by members"
  on public.chore_assignments for insert
  to authenticated
  with check (public.is_household_member(public.household_of_chore(chore_id)));

create policy "assignments update by members"
  on public.chore_assignments for update
  to authenticated
  using (public.is_household_member(public.household_of_chore(chore_id)))
  with check (public.is_household_member(public.household_of_chore(chore_id)));

create policy "assignments delete by members"
  on public.chore_assignments for delete
  to authenticated
  using (public.is_household_member(public.household_of_chore(chore_id)));

-- announcements -------------------------------------------------------------
create policy "announcements readable by members"
  on public.announcements for select
  to authenticated
  using (public.is_household_member(household_id));

create policy "announcements insert by members"
  on public.announcements for insert
  to authenticated
  with check (public.is_household_member(household_id) and user_id = auth.uid());

create policy "announcements update own"
  on public.announcements for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "announcements delete by author or admin"
  on public.announcements for delete
  to authenticated
  using (user_id = auth.uid() or public.is_household_admin(household_id));

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------
-- `full` replica identity ships the whole row on update/delete, which Realtime
-- needs in order to evaluate the RLS policies above against changed rows.
alter table public.bills replica identity full;
alter table public.bill_splits replica identity full;
alter table public.chores replica identity full;
alter table public.chore_assignments replica identity full;
alter table public.announcements replica identity full;
alter table public.household_members replica identity full;

alter publication supabase_realtime add table public.bills;
alter publication supabase_realtime add table public.bill_splits;
alter publication supabase_realtime add table public.chores;
alter publication supabase_realtime add table public.chore_assignments;
alter publication supabase_realtime add table public.announcements;
alter publication supabase_realtime add table public.household_members;
