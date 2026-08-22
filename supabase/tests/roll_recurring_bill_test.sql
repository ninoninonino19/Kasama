\set ON_ERROR_STOP on
\pset pager off

do $test$
declare
  ana  uuid := '11111111-1111-1111-1111-111111111111';
  boy  uuid := '22222222-2222-2222-2222-222222222222';
  cely uuid := '33333333-3333-3333-3333-333333333333';
  house uuid;
  rent uuid; kuryente uuid; sofa uuid; tubig uuid; internet uuid;
  bins uuid; boys_turn uuid; turn_owner uuid;
  carried int;
  rolled uuid;
  r record;
  failures int := 0;

  procedure_note text;
begin
  perform set_config('test.uid', ana::text, true);

  insert into auth.users (id, email) values
    (ana, 'ana@x.com'), (boy, 'boy@x.com'), (cely, 'cely@x.com');

  house := (public.create_household('Unit 4B')).id;
  insert into public.household_members (household_id, user_id, role)
    values (house, boy, 'member');

  -- ---- 1. A partly paid bill must not roll -------------------------------
  insert into public.bills (household_id, title, amount, category, due_date, recurrence, created_by)
    values (house, 'Rent', 12000, 'rent', date '2026-08-01', 'monthly', ana)
    returning id into rent;
  insert into public.bill_splits (bill_id, user_id, amount_owed, paid, paid_at) values
    (rent, ana, 6000, true, now()),
    (rent, boy, 6000, false, null);

  if public.roll_recurring_bill(rent) is not null then
    raise warning 'FAIL 1: rolled a bill that is not fully paid'; failures := failures + 1;
  else
    raise notice 'PASS 1: partly paid bill does not roll';
  end if;

  -- ---- 2/3. Fully settled rolls, correctly -------------------------------
  update public.bill_splits set paid = true, paid_at = now() where bill_id = rent and not paid;
  rolled := public.roll_recurring_bill(rent);
  if rolled is null then
    raise warning 'FAIL 2: settled bill did not roll'; failures := failures + 1;
  else
    select b.title, b.due_date, b.amount, b.created_by,
           (select count(*) from public.bill_splits s where s.bill_id = b.id) as splits,
           (select count(*) from public.bill_splits s where s.bill_id = b.id and s.paid) as prepaid
      into r from public.bills b where b.id = rolled;

    if r.due_date <> date '2026-09-01' then
      raise warning 'FAIL 3a: due date is % not 2026-09-01', r.due_date; failures := failures + 1;
    elsif r.created_by <> ana then
      raise warning 'FAIL 3b: payer not preserved'; failures := failures + 1;
    elsif r.splits <> 2 or r.prepaid <> 0 then
      -- Nobody has paid next month's rent yet, the person who logged it
      -- included. See the splits_start_unpaid migration.
      raise warning 'FAIL 3c: splits=% prepaid=%', r.splits, r.prepaid; failures := failures + 1;
    elsif r.amount <> 12000 then
      raise warning 'FAIL 3d: amount not carried'; failures := failures + 1;
    else
      raise notice 'PASS 2-3: rolled to %, collector Ana, % splits, % prepaid, ₱%',
        r.due_date, r.splits, r.prepaid, r.amount;
    end if;
  end if;

  -- ---- 4. Idempotent ------------------------------------------------------
  if public.roll_recurring_bill(rent) is not null then
    raise warning 'FAIL 4: rolled the same bill twice'; failures := failures + 1;
  else
    raise notice 'PASS 4: re-settling is a no-op';
  end if;

  -- ---- 5. Whoever settles, the original payer is inherited ---------------
  perform set_config('test.uid', boy::text, true);
  insert into public.bills (household_id, title, amount, category, due_date, recurrence, created_by)
    values (house, 'Electricity', 3000, 'utilities', date '2026-08-05', 'monthly', ana)
    returning id into kuryente;
  insert into public.bill_splits (bill_id, user_id, amount_owed, paid, paid_at) values
    (kuryente, ana, 1500, true, now()), (kuryente, boy, 1500, true, now());

  rolled := public.roll_recurring_bill(kuryente);
  select created_by into r from public.bills where id = rolled;
  if r.created_by <> ana then
    raise warning 'FAIL 5: Boy settled and became the payer'; failures := failures + 1;
  else
    raise notice 'PASS 5: Boy settled, next payer is still Ana';
  end if;

  -- ---- 6. Outsiders refused ----------------------------------------------
  perform set_config('test.uid', cely::text, true);
  begin
    perform public.roll_recurring_bill(rent);
    raise warning 'FAIL 6: non-member was allowed'; failures := failures + 1;
  exception when others then
    raise notice 'PASS 6: non-member refused (%)', sqlerrm;
  end;
  perform set_config('test.uid', ana::text, true);

  -- ---- 7. One-off bills never roll ---------------------------------------
  insert into public.bills (household_id, title, amount, category, due_date, recurrence, created_by)
    values (house, 'Sofa', 5000, 'other', date '2026-08-02', 'none', ana)
    returning id into sofa;
  insert into public.bill_splits (bill_id, user_id, amount_owed, paid, paid_at)
    values (sofa, ana, 5000, true, now());
  if public.roll_recurring_bill(sofa) is not null then
    raise warning 'FAIL 7: a one-off bill rolled'; failures := failures + 1;
  else
    raise notice 'PASS 7: one-off bill does not roll';
  end if;

  -- ---- 8. No due date counts from today ----------------------------------
  insert into public.bills (household_id, title, amount, category, due_date, recurrence, created_by)
    values (house, 'Water', 800, 'utilities', null, 'weekly', ana)
    returning id into tubig;
  insert into public.bill_splits (bill_id, user_id, amount_owed, paid, paid_at)
    values (tubig, ana, 800, true, now());
  rolled := public.roll_recurring_bill(tubig);
  select due_date into r from public.bills where id = rolled;
  if r.due_date <> current_date + 7 then
    raise warning 'FAIL 8: undated weekly bill landed on %', r.due_date; failures := failures + 1;
  else
    raise notice 'PASS 8: undated weekly bill dated a week from today';
  end if;

  -- ---- 9. A housemate who left is not carried into next month ----------
  insert into public.bills (household_id, title, amount, category, due_date, recurrence, created_by)
    values (house, 'Internet', 2000, 'internet', date '2026-08-10', 'monthly', ana)
    returning id into internet;
  insert into public.bill_splits (bill_id, user_id, amount_owed, paid, paid_at) values
    (internet, ana, 1000, true, now()), (internet, boy, 1000, true, now());

  -- Boy is midway through a rotation when he goes.
  insert into public.chores (household_id, title, recurrence)
    values (house, 'Take the bins out', 'weekly') returning id into bins;
  insert into public.chore_assignments (chore_id, user_id, due_date)
    values (bins, boy, date '2026-08-14') returning id into boys_turn;
  insert into public.chore_assignments (chore_id, user_id, due_date, completed, completed_at)
    values (bins, boy, date '2026-08-07', true, now());

  delete from public.household_members where household_id = house and user_id = boy;

  rolled := public.roll_recurring_bill(internet);
  select count(*) into carried from public.bill_splits where bill_id = rolled;
  if carried <> 1 then
    raise warning 'FAIL 9: % splits carried, expected 1 (Boy has left)', carried;
    failures := failures + 1;
  elsif exists (select 1 from public.bill_splits where bill_id = rolled and user_id = boy) then
    raise warning 'FAIL 9: Boy left but still owes on next month''s internet';
    failures := failures + 1;
  else
    raise notice 'PASS 9: a departed housemate is left out of the next occurrence';
  end if;

  -- ---- 10. His unfinished turn moves on; his finished one stays his ----
  select user_id into turn_owner from public.chore_assignments where id = boys_turn;
  if turn_owner <> ana then
    raise warning 'FAIL 10a: open turn went to % rather than Ana', turn_owner;
    failures := failures + 1;
  elsif not exists (
    select 1 from public.chore_assignments a
    where a.chore_id = bins and a.user_id = boy and a.completed
  ) then
    raise warning 'FAIL 10b: a finished turn was rewritten out of the record';
    failures := failures + 1;
  else
    raise notice 'PASS 10: the open turn follows the house, the finished one stays Boy''s';
  end if;

  if failures = 0 then
    raise notice '=== ALL 10 CHECKS PASSED ===';
  else
    raise exception '% CHECK(S) FAILED', failures;
  end if;
end
$test$;
