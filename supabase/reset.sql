-- ============================================================================
-- Kasama — full schema reset
--
-- DESTRUCTIVE. Drops every table Kasama owns, along with all households, bills,
-- chores, notes and leave requests in them. Sign-in accounts are NOT touched:
-- they live in auth.users, which this script leaves alone.
--
-- Most of the time this is not the file you want. Clearing the data and
-- keeping the schema is `reset_data.sql`, which is faster, doesn't need the
-- migrations run again, and is what "give me a fresh household to test with"
-- actually means. Reach for this one when the schema itself is wrong.
--
-- Run order for a clean rebuild — every migration, in filename order:
--
--   psql "$DATABASE_URL" -f supabase/reset.sql
--   for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
--   psql "$DATABASE_URL" -f supabase/backfill_profiles.sql   # if you kept accounts
--
-- Listing the migrations by hand is what left this file two releases behind
-- before: it named the first two and nothing since, so a "full reset" quietly
-- kept device_tokens, chore_streaks and every function added after them.
--
-- The storage buckets and the files in them are left alone. Their *policies*
-- are not, and can't be: the receipts policies call `is_household_member` and
-- `is_household_admin`, so Postgres refuses to drop those functions while the
-- policies still reference them. Both buckets' policies are dropped below for
-- symmetry, and every one of them is recreated by its own migration, which
-- drops-if-exists before creating.
--
-- The files themselves are cleared separately by
-- `node supabase/reset_storage.mjs` — storage objects are rows pointing at
-- files, and Supabase blocks deleting the row directly. See that script.
--
-- Only objects this app created are dropped; Supabase's own schemas are
-- untouched, so this is safe to run against a project you use for other things.
-- ============================================================================

-- The trigger lives on auth.users, so it has to go before the function it calls.
drop trigger if exists on_auth_user_created on auth.users;

-- Views before the tables they read.
drop view if exists public.chore_streaks;

-- Tables. `cascade` also removes their policies, triggers, indexes and their
-- membership of the supabase_realtime publication. Order is not load-bearing
-- with `cascade`, but it reads outermost-first so the list doubles as a map of
-- what depends on what.
drop table if exists public.leave_request_votes cascade;
drop table if exists public.leave_requests cascade;
drop table if exists public.announcements cascade;
drop table if exists public.chore_assignments cascade;
drop table if exists public.chores cascade;
drop table if exists public.bill_splits cascade;
drop table if exists public.bills cascade;
drop table if exists public.device_tokens cascade;
drop table if exists public.household_members cascade;
drop table if exists public.households cascade;
drop table if exists public.profiles cascade;

-- Storage policies, before the functions they call.
--
-- Table policies went with their tables above — `drop table … cascade` takes
-- them. These sit on `storage.objects`, which this script does not drop, so
-- nothing has taken them and they still hold a reference to the helpers below.
drop policy if exists "avatars are readable by anyone" on storage.objects;
drop policy if exists "avatars are written to own folder" on storage.objects;
drop policy if exists "avatars are replaced in own folder" on storage.objects;
drop policy if exists "avatars are removed from own folder" on storage.objects;
drop policy if exists "receipts readable by housemates" on storage.objects;
drop policy if exists "receipts written by housemates" on storage.objects;
drop policy if exists "receipts replaced by uploader" on storage.objects;
drop policy if exists "receipts removed by uploader" on storage.objects;

-- Functions. Signatures are spelled out because a bare name is ambiguous once
-- a function is overloaded, and `drop function` refuses rather than guessing.
drop function if exists public.cancel_leave_request(uuid);
drop function if exists public.create_household(text);
drop function if exists public.generate_invite_code();
drop function if exists public.handle_member_removed();
drop function if exists public.handle_new_household();
drop function if exists public.handle_new_user();
drop function if exists public.household_of_bill(uuid);
drop function if exists public.household_of_chore(uuid);
drop function if exists public.is_household_admin(uuid);
drop function if exists public.is_household_member(uuid);
drop function if exists public.join_household_by_code(text);
drop function if exists public.pending_reminders(date);
drop function if exists public.receipt_household(text);
drop function if exists public.receipt_owner(text);
drop function if exists public.register_device_token(text, text);
drop function if exists public.request_household_leave(uuid, text);
drop function if exists public.roll_recurring_bill(uuid);
drop function if exists public.set_announcement_pinned(uuid, boolean);
drop function if exists public.settle_ready_leave_requests(uuid);
drop function if exists public.shares_household_with(uuid);
drop function if exists public.sync_bill_split_paid_at();
drop function if exists public.sync_chore_completed_at();
-- Takes a leave_vote, so it has to go before the type does.
drop function if exists public.vote_on_leave_request(uuid, public.leave_vote, text);

-- Enums last — everything that used them is gone by now.
drop type if exists public.leave_vote;
drop type if exists public.leave_request_status;
drop type if exists public.chore_recurrence;
drop type if exists public.bill_recurrence;
drop type if exists public.bill_category;
drop type if exists public.member_role;

-- ---------------------------------------------------------------------------
-- Check: this should return no rows. Anything listed is something Kasama
-- created that this script has not learned about yet — which is exactly the
-- state this file was in before, so it is worth actually running.
--
-- Extension-owned objects are filtered out. `create extension pgcrypto` in the
-- init migration installs three dozen `pgp_*` functions into `public`, and
-- listing those would bury a real leftover in noise. `deptype = 'e'` is the
-- marker Postgres puts on anything an extension owns.
-- ---------------------------------------------------------------------------
with owned_by_extension as (
  select objid from pg_depend where deptype = 'e'
)
select 'table' as kind, c.relname as name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r', 'p')
   and c.oid not in (select objid from owned_by_extension)
union all
select 'view', c.relname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('v', 'm')
   and c.oid not in (select objid from owned_by_extension)
union all
select 'function', p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.oid not in (select objid from owned_by_extension)
union all
select 'type', t.typname
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
 where n.nspname = 'public' and t.typtype = 'e'
   and t.oid not in (select objid from owned_by_extension)
order by kind, name;
