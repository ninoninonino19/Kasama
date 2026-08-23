\set ON_ERROR_STOP on
\pset pager off

do $test$
declare
  ana  uuid := 'a5a5a5a5-0000-0000-0000-000000000001';
  boy  uuid := 'a5a5a5a5-0000-0000-0000-000000000002';
  cely uuid := 'a5a5a5a5-0000-0000-0000-000000000003';
  dado uuid := 'a5a5a5a5-0000-0000-0000-000000000004';
  house uuid;
  kuryente uuid; tubig uuid; internet uuid;
  bins uuid;
  owed numeric; splits int; departed int;
  ana_turns int; cely_turns int; boy_turns int;
  failures int := 0;
begin
  perform set_config('test.uid', ana::text, true);

  insert into auth.users (id, email) values
    (ana, 'ana@s.com'), (boy, 'boy@s.com'), (cely, 'cely@s.com'), (dado, 'dado@s.com');

  house := (public.create_household('Katipunan')).id;
  insert into public.household_members (household_id, user_id, role) values
    (house, boy, 'member'), (house, cely, 'member');

  -- ---- 1. An unpaid share is split among the housemates still here --------
  -- ₱900 three ways. Boy signs out owing his ₱300, which has to land on Ana
  -- and Cely as ₱150 each — and the bill must still total ₱900.
  insert into public.bills (household_id, title, amount, created_by)
    values (house, 'Kuryente', 900, ana) returning id into kuryente;
  insert into public.bill_splits (bill_id, user_id, amount_owed) values
    (kuryente, ana, 300), (kuryente, boy, 300), (kuryente, cely, 300);

  -- ₱100 three ways does not divide into centavos: Boy's ₱33.34 has to come
  -- out whole on the other side, not ₱33.32 with two centavos evaporated.
  insert into public.bills (household_id, title, amount, created_by)
    values (house, 'Tubig', 100, ana) returning id into tubig;
  insert into public.bill_splits (bill_id, user_id, amount_owed) values
    (tubig, ana, 33.33), (tubig, boy, 33.34), (tubig, cely, 33.33);

  -- A bill only Boy was on, everyone else having settled nothing because they
  -- were never asked to: it should fall to the housemates not on it.
  insert into public.bills (household_id, title, amount, created_by)
    values (house, 'Internet', 60, boy) returning id into internet;
  insert into public.bill_splits (bill_id, user_id, amount_owed) values
    (internet, boy, 60);

  -- Four open turns and one already done, so the deal has something to spread
  -- and the finished one has somewhere to stay.
  insert into public.chores (household_id, title, recurrence)
    values (house, 'Bins', 'weekly') returning id into bins;
  insert into public.chore_assignments (chore_id, user_id, due_date, completed) values
    (bins, boy, current_date + 1, false),
    (bins, boy, current_date + 2, false),
    (bins, boy, current_date + 3, false),
    (bins, boy, current_date + 4, false),
    (bins, boy, current_date - 1, true);

  perform set_config('test.uid', boy::text, true);
  departed := public.leave_all_households();

  if departed <> 1 then
    raise warning 'FAIL 1a: signing out reported % departures', departed;
    failures := failures + 1;
  elsif exists (select 1 from public.household_members m
                where m.household_id = house and m.user_id = boy) then
    raise warning 'FAIL 1b: Boy is still a member after signing out';
    failures := failures + 1;
  else
    raise notice 'PASS 1: signing out leaves the household, no vote needed';
  end if;

  -- ---- 2. The money -------------------------------------------------------
  select sum(s.amount_owed), count(*) into owed, splits
  from public.bill_splits s where s.bill_id = kuryente;

  if owed <> 900 or splits <> 2 then
    raise warning 'FAIL 2a: Kuryente is % across % splits, wanted 900 across 2', owed, splits;
    failures := failures + 1;
  elsif (select s.amount_owed from public.bill_splits s
         where s.bill_id = kuryente and s.user_id = ana) <> 450
     or (select s.amount_owed from public.bill_splits s
         where s.bill_id = kuryente and s.user_id = cely) <> 450 then
    raise warning 'FAIL 2b: Kuryente did not land as 450 each';
    failures := failures + 1;
  else
    raise notice 'PASS 2: an unpaid share is divided equally over the house';
  end if;

  select sum(s.amount_owed) into owed
  from public.bill_splits s where s.bill_id = tubig;

  if owed <> 100 then
    raise warning 'FAIL 3: Tubig totals % after the split, wanted 100', owed;
    failures := failures + 1;
  else
    raise notice 'PASS 3: an indivisible share keeps every centavo (Tubig = %)', owed;
  end if;

  select sum(s.amount_owed), count(*) into owed, splits
  from public.bill_splits s where s.bill_id = internet;

  if owed <> 60 or splits <> 2 then
    raise warning 'FAIL 4: Internet is % across % splits, wanted 60 across 2', owed, splits;
    failures := failures + 1;
  else
    raise notice 'PASS 4: a share nobody else was on falls to the rest of the house';
  end if;

  -- ---- 5. The chores ------------------------------------------------------
  select count(*) into boy_turns from public.chore_assignments a
  where a.user_id = boy and not a.completed;

  select count(*) into ana_turns from public.chore_assignments a
  where a.user_id = ana and not a.completed;

  select count(*) into cely_turns from public.chore_assignments a
  where a.user_id = cely and not a.completed;

  if boy_turns <> 0 then
    raise warning 'FAIL 5a: % open turns still belong to Boy', boy_turns;
    failures := failures + 1;
  elsif ana_turns <> 2 or cely_turns <> 2 then
    raise warning 'FAIL 5b: turns dealt % to Ana and % to Cely, wanted 2 and 2',
      ana_turns, cely_turns;
    failures := failures + 1;
  else
    raise notice 'PASS 5: open turns are dealt evenly, not dropped on one person';
  end if;

  if (select a.user_id from public.chore_assignments a
      where a.chore_id = bins and a.completed) <> boy then
    raise warning 'FAIL 6: a finished turn was reassigned away from Boy';
    failures := failures + 1;
  else
    raise notice 'PASS 6: a finished turn stays on the record as Boy''s';
  end if;

  -- ---- 7. A paid share is never enlarged ----------------------------------
  -- Cely has settled her part of this one, so Dado's share has to go to Ana
  -- alone rather than reopening a payment Cely already made.
  perform set_config('test.uid', ana::text, true);
  insert into public.household_members (household_id, user_id) values (house, dado);

  insert into public.bills (household_id, title, amount, created_by)
    values (house, 'Gas', 300, ana) returning id into internet;
  insert into public.bill_splits (bill_id, user_id, amount_owed, paid) values
    (internet, ana, 100, false), (internet, cely, 100, true), (internet, dado, 100, false);

  perform set_config('test.uid', dado::text, true);
  perform public.leave_all_households();

  if (select s.amount_owed from public.bill_splits s
      where s.bill_id = internet and s.user_id = cely) <> 100
     or (select s.paid from public.bill_splits s
         where s.bill_id = internet and s.user_id = cely) is not true then
    raise warning 'FAIL 7a: a settled share was reopened';
    failures := failures + 1;
  elsif (select s.amount_owed from public.bill_splits s
         where s.bill_id = internet and s.user_id = ana) <> 200 then
    raise warning 'FAIL 7b: Ana carries %, wanted 200',
      (select s.amount_owed from public.bill_splits s
       where s.bill_id = internet and s.user_id = ana);
    failures := failures + 1;
  else
    raise notice 'PASS 7: housemates who already paid are left alone';
  end if;

  -- ---- 8. Nothing to leave is not an error --------------------------------
  if public.leave_all_households() <> 0 then
    raise warning 'FAIL 8: leaving twice reported a second departure';
    failures := failures + 1;
  else
    raise notice 'PASS 8: signing out with no household is a no-op';
  end if;

  -- ---- 9. Being removed by an admin settles up the same way ---------------
  -- Same trigger, different door: the point is that only one of them had to be
  -- taught how the money works.
  perform set_config('test.uid', ana::text, true);
  insert into public.bills (household_id, title, amount, created_by)
    values (house, 'Rent', 400, ana) returning id into internet;
  insert into public.bill_splits (bill_id, user_id, amount_owed) values
    (internet, ana, 200), (internet, cely, 200);

  delete from public.household_members m
  where m.household_id = house and m.user_id = cely;

  if (select s.amount_owed from public.bill_splits s
      where s.bill_id = internet and s.user_id = ana) <> 400 then
    raise warning 'FAIL 9: an admin removal left the share behind';
    failures := failures + 1;
  else
    raise notice 'PASS 9: removal by an admin redistributes the same way';
  end if;

  if failures > 0 then
    raise exception '% SIGN-OUT CHECK(S) FAILED', failures;
  end if;
  raise notice '=== ALL 9 SIGN-OUT CHECKS PASSED ===';
end
$test$;
