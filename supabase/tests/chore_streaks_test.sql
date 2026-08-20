\set ON_ERROR_STOP on
\pset pager off

do $test$
declare
  ana uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  boy uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  cel uuid := 'bbbbbbbb-0000-0000-0000-000000000003';
  house uuid;
  chore uuid;
  got int;
  failures int := 0;

  invoker_missing boolean;
begin
  perform set_config('test.uid', ana::text, true);

  insert into auth.users (id, email) values
    (ana, 'ana3@x.com'), (boy, 'boy3@x.com'), (cel, 'cel3@x.com');

  house := (public.create_household('Streak House')).id;
  insert into public.household_members (household_id, user_id, role) values
    (house, boy, 'member'), (house, cel, 'member');

  insert into public.chores (household_id, title, recurrence)
    values (house, 'Hugas plato', 'daily') returning id into chore;

  -- Ana: three finished turns in a row, all in the past.
  insert into public.chore_assignments (chore_id, user_id, due_date, completed, completed_at) values
    (chore, ana, current_date - 3, true, now()),
    (chore, ana, current_date - 2, true, now()),
    (chore, ana, current_date - 1, true, now());

  select streak into got from public.chore_streaks where household_id = house and user_id = ana;
  if got = 3 then
    raise notice 'PASS 1: three finished turns count as three';
  else
    raise warning 'FAIL 1: expected 3, got %', coalesce(got::text, 'no row'); failures := failures + 1;
  end if;

  -- A turn due later today is open but not late — it must not break the run.
  insert into public.chore_assignments (chore_id, user_id, due_date, completed)
    values (chore, ana, current_date, false);
  select streak into got from public.chore_streaks where household_id = house and user_id = ana;
  if got = 3 then
    raise notice 'PASS 2: a turn due today does not break the streak';
  else
    raise warning 'FAIL 2: expected 3, got %', coalesce(got::text, 'no row'); failures := failures + 1;
  end if;

  -- Boy: missed the middle one, so only the most recent finished turn counts.
  insert into public.chore_assignments (chore_id, user_id, due_date, completed, completed_at) values
    (chore, boy, current_date - 4, true, now()),
    (chore, boy, current_date - 3, false, null),
    (chore, boy, current_date - 2, true, now());
  select streak into got from public.chore_streaks where household_id = house and user_id = boy;
  if got = 1 then
    raise notice 'PASS 3: a missed turn ends the run, older wins do not carry over';
  else
    raise warning 'FAIL 3: expected 1, got %', coalesce(got::text, 'no row'); failures := failures + 1;
  end if;

  -- Cely has only an overdue open turn: a streak of zero, not a missing row
  -- that reads as "never had one".
  insert into public.chore_assignments (chore_id, user_id, due_date, completed)
    values (chore, cel, current_date - 1, false);
  select streak into got from public.chore_streaks where household_id = house and user_id = cel;
  if got = 0 then
    raise notice 'PASS 4: an overdue turn gives a streak of zero';
  else
    raise warning 'FAIL 4: expected 0, got %', coalesce(got::text, 'no row'); failures := failures + 1;
  end if;

  -- ---- 5. The view respects the caller's RLS -----------------------------
  select not exists (
    select 1 from pg_views v
    join pg_class c on c.relname = v.viewname and c.relnamespace = 'public'::regnamespace
    where v.viewname = 'chore_streaks'
      and c.reloptions::text like '%security_invoker=true%'
  ) into invoker_missing;

  if invoker_missing then
    raise warning 'FAIL 5: chore_streaks is not security_invoker, so it leaks across households';
    failures := failures + 1;
  else
    raise notice 'PASS 5: the view runs under the callers own RLS';
  end if;

  if failures = 0 then
    raise notice '=== ALL 5 STREAK CHECKS PASSED ===';
  else
    raise exception '% STREAK CHECK(S) FAILED', failures;
  end if;
end
$test$;
