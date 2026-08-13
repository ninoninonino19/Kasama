-- ============================================================================
-- Creating a household has to go through a function, not a direct insert.
--
-- The app inserts with `RETURNING` (it needs the generated invite code back).
-- Postgres applies the table's SELECT policy to RETURNING rows, and the
-- households SELECT policy requires membership — but the AFTER INSERT trigger
-- that makes the creator an admin only fires at the *end* of the statement,
-- after those rows have already been checked. So the insert was rejected with:
--
--   new row violates row-level security policy for table "households"
--
-- which reads like the INSERT policy failed, when in fact it passed. Dropping
-- RETURNING would fix it but leaves the client without the new row.
--
-- Instead this mirrors join_household_by_code: one SECURITY DEFINER function
-- that creates the household and the creator's membership atomically and hands
-- back the row. The direct-insert policies stay in place as a fallback.
-- ============================================================================

create or replace function public.create_household(household_name text)
returns public.households
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  created public.households;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if coalesce(trim(household_name), '') = '' then
    raise exception 'Please give the household a name.' using errcode = '22023';
  end if;

  insert into public.households (name, created_by)
  values (trim(household_name), auth.uid())
  returning * into created;

  -- on_household_created normally does this; repeated here so the function is
  -- correct on its own if that trigger is ever removed.
  insert into public.household_members (household_id, user_id, role)
  values (created.id, auth.uid(), 'admin')
  on conflict (household_id, user_id) do nothing;

  return created;
end;
$$;

grant execute on function public.create_household(text) to authenticated;
