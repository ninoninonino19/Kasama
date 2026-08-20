-- ============================================================================
-- Reset Kasama back to a clean install.
--
--   DESTRUCTIVE. This deletes every household, bill, chore, note and account
--   in the database it is run against. There is no undo. Run it against a
--   development project, never a production one.
--
-- Schema, policies, functions, triggers and the avatars bucket are all left in
-- place — this clears data only, so the app comes up exactly as it would for a
-- brand-new project rather than needing the migrations run again.
--
-- How to run it:
--   Supabase dashboard -> SQL Editor -> paste -> Run
--   or: psql "$DATABASE_URL" -f supabase/reset_data.sql
--
-- On the device, after running this:
--   - Log out, or delete and reinstall the app. The old session points at a
--     user that no longer exists, and the app will sit on a signed-in screen
--     with nothing behind it until the session is cleared.
--   - Reinstalling also clears the "notifications already offered" flag in
--     AsyncStorage, so the first-launch prompt appears again. Logging out
--     alone does not — that flag is per device, on purpose.
-- ============================================================================

begin;

-- Deleting the users is enough for almost everything: profiles hang off
-- auth.users, and households, members, bills, splits, chores, assignments,
-- announcements and device tokens all cascade from there. The explicit
-- deletes below are belt and braces for rows that outlived their owner —
-- a household whose creator was removed by hand, say.
delete from auth.users;

delete from public.device_tokens;
delete from public.announcements;
delete from public.chore_assignments;
delete from public.chores;
delete from public.bill_splits;
delete from public.bills;
delete from public.household_members;
delete from public.households;
delete from public.profiles;

-- Uploaded avatars are files, not rows, so nothing cascades them. Without
-- this the bucket keeps every photo from every wiped account.
delete from storage.objects where bucket_id = 'avatars';

commit;

-- ---------------------------------------------------------------------------
-- Check: every count below should be 0.
-- ---------------------------------------------------------------------------
select 'auth.users'        as table_name, count(*) from auth.users
union all select 'profiles',           count(*) from public.profiles
union all select 'households',         count(*) from public.households
union all select 'household_members',  count(*) from public.household_members
union all select 'bills',              count(*) from public.bills
union all select 'bill_splits',        count(*) from public.bill_splits
union all select 'chores',             count(*) from public.chores
union all select 'chore_assignments',  count(*) from public.chore_assignments
union all select 'announcements',      count(*) from public.announcements
union all select 'device_tokens',      count(*) from public.device_tokens
union all select 'avatar files',       count(*) from storage.objects where bucket_id = 'avatars';


-- ============================================================================
-- Variant: keep the accounts, clear the households
--
-- Use this instead of the block above when you want to test onboarding —
-- creating and joining a household — without signing up again. Everyone keeps
-- their login, name and photo, and lands back on the onboarding screen.
--
-- Run it INSTEAD OF the transaction above, not as well as.
-- ============================================================================
--
-- begin;
--
-- -- Everything below a household cascades from it.
-- delete from public.households;
--
-- -- Leftovers that hang off profiles rather than households.
-- delete from public.device_tokens;
--
-- commit;
