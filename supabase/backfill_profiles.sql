-- ============================================================================
-- Give every existing auth user a profile row.
--
-- Profiles are normally created by the on_auth_user_created trigger, which only
-- fires for NEW sign-ups. After a reset, accounts that already existed are left
-- without a profile — and because household_members.user_id references
-- profiles(id), the next attempt to create or join a household fails with a
-- foreign key error rather than anything self-explanatory.
--
-- Run this after the migrations, whenever you reset the schema but keep your
-- accounts. Safe to run repeatedly.
-- ============================================================================

insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
    split_part(u.email, '@', 1),
    'Kasama'
  )
from auth.users u
on conflict (id) do nothing;

select count(*) || ' profile(s) now present' as result from public.profiles;
