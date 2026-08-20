-- ============================================================================
-- Let a profile exist without an email address.
--
-- Kasama no longer asks anyone to register. You give a display name, the app
-- opens an anonymous session, and you create or join a household with a code.
-- Anonymous users are still rows in `auth.users` — they just have no email —
-- so every RLS policy in the schema keeps working untouched: `auth.uid()`
-- means exactly what it meant before.
--
-- What does break is this trigger. Its fallback was `split_part(email, '@', 1)`,
-- and `split_part(null, ...)` is null, so an account with no email tried to
-- insert a null `display_name` into a NOT NULL column and the whole sign-in
-- failed. The column's DEFAULT doesn't save it: an explicit null overrides a
-- default rather than falling back to it.
-- ============================================================================

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
      -- What they typed on the welcome screen, passed as user metadata.
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      -- Kept for any account that does still carry an email.
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      -- Last resort, so a missing name can never fail the insert. The app
      -- requires a name before it opens a session, so this should not be
      -- reachable from the UI.
      'Housemate'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
