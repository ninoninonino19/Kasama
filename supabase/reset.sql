-- ============================================================================
-- Kasama — full schema reset
--
-- DESTRUCTIVE. Drops every table Kasama owns, along with all households, bills,
-- chores and announcements in them. Sign-in accounts are NOT touched: they live
-- in auth.users, which this script leaves alone.
--
-- Run order for a clean rebuild:
--   1. this file
--   2. migrations/20260813000000_init.sql
--   3. migrations/20260813010000_create_household_rpc.sql
--   4. backfill_profiles.sql   <- required if you kept your existing accounts
--
-- Only objects this app created are dropped; Supabase's own schemas are
-- untouched, so this is safe to run against a project you use for other things.
-- ============================================================================

-- The trigger lives on auth.users, so it has to go before the function it calls.
drop trigger if exists on_auth_user_created on auth.users;

-- Tables. `cascade` also removes their policies, triggers, indexes and their
-- membership of the supabase_realtime publication.
drop table if exists public.announcements cascade;
drop table if exists public.chore_assignments cascade;
drop table if exists public.chores cascade;
drop table if exists public.bill_splits cascade;
drop table if exists public.bills cascade;
drop table if exists public.household_members cascade;
drop table if exists public.households cascade;
drop table if exists public.profiles cascade;

-- Functions.
drop function if exists public.create_household(text);
drop function if exists public.join_household_by_code(text);
drop function if exists public.is_household_member(uuid);
drop function if exists public.is_household_admin(uuid);
drop function if exists public.shares_household_with(uuid);
drop function if exists public.household_of_bill(uuid);
drop function if exists public.household_of_chore(uuid);
drop function if exists public.generate_invite_code();
drop function if exists public.handle_new_user();
drop function if exists public.handle_new_household();
drop function if exists public.sync_bill_split_paid_at();
drop function if exists public.sync_chore_completed_at();

-- Enums last — the tables that used them are gone by now.
drop type if exists public.chore_recurrence;
drop type if exists public.bill_recurrence;
drop type if exists public.bill_category;
drop type if exists public.member_role;
