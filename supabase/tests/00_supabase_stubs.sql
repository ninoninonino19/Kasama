-- ============================================================================
-- Minimal stand-ins for the parts of Supabase that a plain Postgres doesn't
-- have, so the real migrations can be applied and exercised locally.
--
-- Not used in production — `supabase/tests/run.sh` loads this first, then the
-- migrations, then the test files.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create schema if not exists auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- auth.uid() reads a session GUC, so tests can "log in" as any user.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

-- The init migration adds tables to this publication.
create publication supabase_realtime;
