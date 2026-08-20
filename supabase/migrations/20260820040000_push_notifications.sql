-- ============================================================================
-- Push notification plumbing: where device tokens live, and who may read them.
--
-- A push token is a capability, not an identifier: anyone holding it can send
-- that phone a notification. So the table is readable by nobody but its owner
-- — not even by housemates — and the Edge Function that actually sends reads
-- it with the service role instead.
--
-- Registration goes through a definer function rather than an insert policy.
-- Tokens are unique per device, and a device changes hands: someone logs out
-- and a housemate logs in on the same phone. The row then has to move to the
-- new owner, which a `user_id = auth.uid()` update policy can't express,
-- because the row it is checking still belongs to the previous user.
-- Presenting the token is proof of being on that device, which is what makes
-- the reassignment safe.
-- ============================================================================

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "device tokens are private to their owner" on public.device_tokens;
create policy "device tokens are private to their owner"
  on public.device_tokens for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "device tokens are removed by their owner" on public.device_tokens;
create policy "device tokens are removed by their owner"
  on public.device_tokens for delete
  to authenticated
  using (user_id = auth.uid());

-- Deliberately no INSERT or UPDATE policy: registration is the function below.

-- Parameters are prefixed because `token` and `platform` are also column
-- names, and ON CONFLICT's target list can't be qualified to tell them apart.
create or replace function public.register_device_token(
  device_token text,
  device_platform text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if device_platform not in ('ios', 'android', 'web') then
    raise exception 'Unknown platform %', device_platform;
  end if;

  insert into public.device_tokens (user_id, token, platform)
  values (auth.uid(), device_token, device_platform)
  on conflict (token) do update
    set user_id = auth.uid(),
        platform = excluded.platform,
        updated_at = now();
end;
$$;

revoke all on function public.register_device_token(text, text) from public;
grant execute on function public.register_device_token(text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- Per-category preferences.
--
-- Three switches rather than one, because the three things Kasama can nag
-- about are wanted by different people: the housemate who cares about rent
-- deadlines is not necessarily the one who wants a buzz every time somebody
-- pins a note. One global switch turns "too chatty" into "off forever".
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists push_bills boolean not null default true,
  add column if not exists push_chores boolean not null default true,
  add column if not exists push_board boolean not null default false;

comment on column public.profiles.push_board is
  'Off by default: board notes are the chattiest and the least time-critical.';
