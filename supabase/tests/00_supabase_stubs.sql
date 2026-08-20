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

-- Storage. Enough of it that the avatars migration can be applied and its
-- policies inspected; object bodies never come near a test.
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid
);
alter table storage.objects enable row level security;

-- Hosted Supabase refuses direct DML against the storage tables — objects are
-- rows pointing at files, and deleting the row strands the file. Stubbing the
-- guard means a script that would be rejected in production is rejected here
-- too, rather than passing locally and failing on the first real run.
create or replace function storage.protect_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
    using errcode = '42501',
          hint = 'This prevents accidental data loss from orphaned objects.';
end;
$$;

drop trigger if exists protect_delete on storage.objects;
create trigger protect_delete
  before delete on storage.objects
  for each row execute function storage.protect_delete();

-- Supabase's helper: splits an object path into its folder segments.
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)];
$$;
