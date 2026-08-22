-- ============================================================================
-- Reset Kasama back to a clean install.
--
--   DESTRUCTIVE. This deletes every household, bill, chore, note and account
--   in the database it is run against. There is no undo. Run it against a
--   development project, never a production one.
--
-- Schema, policies, functions, triggers and both storage buckets are all left
-- in place — this clears data only, so the app comes up exactly as it would
-- for a brand-new project rather than needing the migrations run again.
--
-- How to run it:
--   Supabase dashboard -> SQL Editor -> paste -> Run
--   or: psql "$DATABASE_URL" -f supabase/reset_data.sql
--
-- Uploaded files — avatars and board receipts — are NOT cleared here. Storage
-- objects are rows pointing at files, so Supabase blocks direct deletes
-- against `storage.objects`: the row would go and the file would be stranded.
-- Clearing them goes through the Storage API instead:
--
--   node supabase/reset_storage.mjs
--
-- Skipping it is harmless: the files are orphaned but nothing reads them once
-- the notes and profiles pointing at them are gone. They just keep taking up
-- space in the buckets — and receipts are photos of A4 statements, so that
-- adds up faster than avatars did.
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
-- Votes before the requests they hang off, and both before the households and
-- profiles they cascade from. Ordered by hand rather than left to the cascade
-- so this list is also a readable inventory of what a reset actually clears.
delete from public.leave_request_votes;
delete from public.leave_requests;
delete from public.announcements;
delete from public.chore_assignments;
delete from public.chores;
delete from public.bill_splits;
delete from public.bills;
delete from public.household_members;
delete from public.households;
delete from public.profiles;

commit;

-- ---------------------------------------------------------------------------
-- Check: every count below should be 0, except the two file counts — those
-- are cleared separately by supabase/reset_storage.mjs, and are only orphaned
-- files at this point.
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
union all select 'leave_requests',     count(*) from public.leave_requests
union all select 'leave_request_votes', count(*) from public.leave_request_votes
union all select 'device_tokens',      count(*) from public.device_tokens
union all select 'avatar files (see reset_storage.mjs)',
                                       count(*) from storage.objects
                                       where bucket_id = 'avatars'
union all select 'receipt files (see reset_storage.mjs)',
                                       count(*) from storage.objects
                                       where bucket_id = 'receipts';


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
-- -- Everything below a household cascades from it — bills, chores, notes and
-- -- any leave request that was open when you reset.
-- delete from public.households;
--
-- -- Leftovers that hang off profiles rather than households.
-- delete from public.device_tokens;
--
-- commit;
