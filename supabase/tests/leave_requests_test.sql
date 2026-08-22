\set ON_ERROR_STOP on
\pset pager off

do $test$
declare
  ana  uuid := 'eeeeeeee-0000-0000-0000-000000000001';
  boy  uuid := 'eeeeeeee-0000-0000-0000-000000000002';
  cely uuid := 'eeeeeeee-0000-0000-0000-000000000003';
  dado uuid := 'eeeeeeee-0000-0000-0000-000000000004';
  house uuid;
  solo uuid;
  request public.leave_requests;
  bins uuid; boys_turn uuid; turn_owner uuid;
  failures int := 0;
begin
  perform set_config('test.uid', ana::text, true);

  insert into auth.users (id, email) values
    (ana, 'ana@l.com'), (boy, 'boy@l.com'), (cely, 'cely@l.com'), (dado, 'dado@l.com');

  house := (public.create_household('Maple Street')).id;
  insert into public.household_members (household_id, user_id, role) values
    (house, boy, 'member'), (house, cely, 'member');

  -- ---- 1. You cannot vote yourself out ------------------------------------
  perform set_config('test.uid', boy::text, true);
  request := public.request_household_leave(house, '  Moving to Cebu  ');

  if request.status <> 'pending' then
    raise warning 'FAIL 1a: a request opened as % rather than pending', request.status;
    failures := failures + 1;
  elsif request.reason <> 'Moving to Cebu' then
    raise warning 'FAIL 1b: reason stored as "%"', request.reason;
    failures := failures + 1;
  else
    raise notice 'PASS 1: leaving opens a pending request, reason trimmed';
  end if;

  begin
    perform public.vote_on_leave_request(request.id, 'accept');
    raise warning 'FAIL 2: Boy voted on his own departure'; failures := failures + 1;
  exception when others then
    raise notice 'PASS 2: voting on your own departure refused (%)', sqlerrm;
  end;

  -- ---- 3. Asking twice is the same ask ------------------------------------
  if (public.request_household_leave(house, 'again')).id <> request.id then
    raise warning 'FAIL 3: a second ask opened a second request'; failures := failures + 1;
  else
    raise notice 'PASS 3: asking twice returns the open request';
  end if;

  -- ---- 4. An outsider cannot vote -----------------------------------------
  perform set_config('test.uid', dado::text, true);
  begin
    perform public.vote_on_leave_request(request.id, 'accept');
    raise warning 'FAIL 4: a non-member voted'; failures := failures + 1;
  exception when others then
    raise notice 'PASS 4: non-member refused (%)', sqlerrm;
  end;

  -- ---- 5. One accept is not enough ----------------------------------------
  perform set_config('test.uid', ana::text, true);
  request := public.vote_on_leave_request(request.id, 'accept');

  if request.status <> 'pending' then
    raise warning 'FAIL 5a: one of two accepts resolved the request'; failures := failures + 1;
  elsif not exists (
    select 1 from public.household_members where household_id = house and user_id = boy
  ) then
    raise warning 'FAIL 5b: Boy left on a single accept'; failures := failures + 1;
  else
    raise notice 'PASS 5: a request waits for every remaining housemate';
  end if;

  -- ---- 6. A decline ends it, and says why ---------------------------------
  perform set_config('test.uid', cely::text, true);
  request := public.vote_on_leave_request(request.id, 'decline', 'You still owe me for July water');

  if request.status <> 'declined' then
    raise warning 'FAIL 6a: a decline left the request %', request.status; failures := failures + 1;
  elsif not exists (
    select 1 from public.leave_request_votes
    where request_id = request.id and voter_id = cely
      and decision = 'decline' and note = 'You still owe me for July water'
  ) then
    raise warning 'FAIL 6b: the decline note was not kept'; failures := failures + 1;
  elsif not exists (
    select 1 from public.household_members where household_id = house and user_id = boy
  ) then
    raise warning 'FAIL 6c: a declined request still removed him'; failures := failures + 1;
  else
    raise notice 'PASS 6: one decline ends the request, with its reason on the record';
  end if;

  -- ---- 7. A resolved request is closed to further votes -------------------
  perform set_config('test.uid', ana::text, true);
  begin
    perform public.vote_on_leave_request(request.id, 'accept');
    raise warning 'FAIL 7: voted on a request that had already resolved'; failures := failures + 1;
  exception when others then
    raise notice 'PASS 7: an answered request takes no more votes (%)', sqlerrm;
  end;

  -- ---- 8. Everyone accepting completes the leave --------------------------
  -- Boy is midway through a rotation when the house agrees he can go.
  insert into public.chores (household_id, title, recurrence)
    values (house, 'Mop the sala', 'weekly') returning id into bins;
  insert into public.chore_assignments (chore_id, user_id, due_date)
    values (bins, boy, current_date + 3) returning id into boys_turn;

  perform set_config('test.uid', boy::text, true);
  request := public.request_household_leave(house, null);

  perform set_config('test.uid', ana::text, true);
  perform public.vote_on_leave_request(request.id, 'accept');
  perform set_config('test.uid', cely::text, true);
  request := public.vote_on_leave_request(request.id, 'accept');

  if request.status <> 'completed' then
    raise warning 'FAIL 8a: a unanimous request ended as %', request.status; failures := failures + 1;
  elsif exists (
    select 1 from public.household_members where household_id = house and user_id = boy
  ) then
    raise warning 'FAIL 8b: the house agreed but Boy is still a member'; failures := failures + 1;
  else
    raise notice 'PASS 8: unanimous acceptance removes them from the household';
  end if;

  -- ---- 9. His open turn moved on ------------------------------------------
  select user_id into turn_owner from public.chore_assignments where id = boys_turn;
  if turn_owner = boy then
    raise warning 'FAIL 9: an open chore turn is still assigned to someone who left';
    failures := failures + 1;
  else
    raise notice 'PASS 9: his open chore turn moved to a housemate who is still here';
  end if;

  -- ---- 10. Withdrawing ----------------------------------------------------
  perform set_config('test.uid', cely::text, true);
  request := public.request_household_leave(house, null);
  request := public.cancel_leave_request(request.id);

  if request.status <> 'cancelled' then
    raise warning 'FAIL 10a: withdrawing left the request %', request.status; failures := failures + 1;
  elsif not exists (
    select 1 from public.household_members where household_id = house and user_id = cely
  ) then
    raise warning 'FAIL 10b: withdrawing removed her anyway'; failures := failures + 1;
  else
    raise notice 'PASS 10: the person leaving can take it back';
  end if;

  -- ---- 11. Only the leaver or an admin may withdraw -----------------------
  request := public.request_household_leave(house, null);
  perform set_config('test.uid', dado::text, true);
  begin
    perform public.cancel_leave_request(request.id);
    raise warning 'FAIL 11: an outsider withdrew someone else''s request';
    failures := failures + 1;
  exception when others then
    raise notice 'PASS 11: an outsider cannot withdraw it (%)', sqlerrm;
  end;

  -- Ana is the household's admin, so she can clear it.
  perform set_config('test.uid', ana::text, true);
  if (public.cancel_leave_request(request.id)).status <> 'cancelled' then
    raise warning 'FAIL 11b: an admin could not clear a pending request'; failures := failures + 1;
  else
    raise notice 'PASS 11b: an admin can clear a pending request';
  end if;

  -- ---- 12. The last person out is not asked to wait for a vote ------------
  perform set_config('test.uid', dado::text, true);
  solo := (public.create_household('Dorm 12')).id;
  request := public.request_household_leave(solo, null);

  if request.status <> 'completed' then
    raise warning 'FAIL 12a: the only member''s request opened as %', request.status;
    failures := failures + 1;
  elsif exists (
    select 1 from public.household_members where household_id = solo and user_id = dado
  ) then
    raise warning 'FAIL 12b: the only member is still in their own household';
    failures := failures + 1;
  else
    raise notice 'PASS 12: with nobody left to ask, leaving is immediate';
  end if;

  -- ---- 13. Nothing writes to these tables except the functions ------------
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('leave_requests', 'leave_request_votes')
      and cmd <> 'SELECT'
  ) then
    raise warning 'FAIL 13: a leave request table has a direct write policy';
    failures := failures + 1;
  else
    raise notice 'PASS 13: reads only — every write goes through the functions';
  end if;

  if failures = 0 then
    raise notice '=== ALL 13 LEAVE CHECKS PASSED ===';
  else
    raise exception '% LEAVE CHECK(S) FAILED', failures;
  end if;
end
$test$;
