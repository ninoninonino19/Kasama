\set ON_ERROR_STOP on
\pset pager off

do $test$
declare
  ana uuid := 'dddddddd-0000-0000-0000-000000000001';
  boy uuid := 'dddddddd-0000-0000-0000-000000000002';
  house uuid;
  bill uuid; chore uuid;
  tomorrow date := current_date + 1;
  got int;
  row_body text;
  failures int := 0;
begin
  perform set_config('test.uid', ana::text, true);
  insert into auth.users (id, email) values (ana, 'ana5@x.com'), (boy, 'boy5@x.com');

  house := (public.create_household('Reminder House')).id;
  insert into public.household_members (household_id, user_id, role) values (house, boy, 'member');

  -- Ana fronted a bill due tomorrow; Boy still owes his half.
  insert into public.bills (household_id, title, amount, category, due_date, recurrence, created_by)
    values (house, 'Kuryente', 3000, 'utilities', tomorrow, 'monthly', ana) returning id into bill;
  insert into public.bill_splits (bill_id, user_id, amount_owed, paid, paid_at) values
    (bill, ana, 1500, true, now()),
    (bill, boy, 1500, false, null);

  -- ---- 1. Only the person who still owes is reminded ---------------------
  select count(*) into got from public.pending_reminders(tomorrow) where category = 'bills';
  if got = 1 then
    raise notice 'PASS 1: one bill reminder, not one per housemate';
  else
    raise warning 'FAIL 1: % bill reminders', got; failures := failures + 1;
  end if;

  select r.user_id into ana from public.pending_reminders(tomorrow) r where r.category = 'bills';
  if ana = boy then
    raise notice 'PASS 2: the reminder goes to whoever still owes';
  else
    raise warning 'FAIL 2: reminder addressed to %', ana; failures := failures + 1;
  end if;
  ana := 'dddddddd-0000-0000-0000-000000000001';

  -- ---- 3. The amount is the reader's own share, formatted -----------------
  select r.body into row_body from public.pending_reminders(tomorrow) r where r.category = 'bills';
  if row_body like '%₱1,500.00 ang share mo.' then
    raise notice 'PASS 3: the body quotes that person''s share, grouped and to two decimals';
  else
    raise warning 'FAIL 3: body was "%"', row_body; failures := failures + 1;
  end if;

  -- ---- 4. Settling stops the nagging -------------------------------------
  update public.bill_splits set paid = true, paid_at = now() where bill_id = bill and user_id = boy;
  select count(*) into got from public.pending_reminders(tomorrow) where category = 'bills';
  if got = 0 then
    raise notice 'PASS 4: a settled share is not reminded about';
  else
    raise warning 'FAIL 4: still % reminders after paying', got; failures := failures + 1;
  end if;

  -- ---- 5. Chores due tomorrow, but only open ones -------------------------
  insert into public.chores (household_id, title, recurrence)
    values (house, 'Hugas plato', 'weekly') returning id into chore;
  insert into public.chore_assignments (chore_id, user_id, due_date, completed)
    values (chore, boy, tomorrow, false);
  insert into public.chore_assignments (chore_id, user_id, due_date, completed, completed_at)
    values (chore, ana, tomorrow, true, now());

  select count(*) into got from public.pending_reminders(tomorrow) where category = 'chores';
  if got = 1 then
    raise notice 'PASS 5: a finished turn is not reminded about';
  else
    raise warning 'FAIL 5: % chore reminders', got; failures := failures + 1;
  end if;

  -- ---- 6. Other days are left alone --------------------------------------
  select count(*) into got from public.pending_reminders(tomorrow + 30);
  if got = 0 then
    raise notice 'PASS 6: a day with nothing due produces nothing';
  else
    raise warning 'FAIL 6: % reminders on an empty day', got; failures := failures + 1;
  end if;

  -- ---- 7. Housemates cannot enumerate each other's debts ------------------
  if has_function_privilege('authenticated', 'public.pending_reminders(date)', 'execute') then
    raise warning 'FAIL 7: authenticated can list what everyone owes'; failures := failures + 1;
  else
    raise notice 'PASS 7: only the service role may run it';
  end if;

  if failures = 0 then
    raise notice '=== ALL 7 REMINDER CHECKS PASSED ===';
  else
    raise exception '% REMINDER CHECK(S) FAILED', failures;
  end if;
end
$test$;
