\set ON_ERROR_STOP on
\pset pager off

do $test$
declare
  ana  uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  boy  uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  cely uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
  house uuid;
  note_ana uuid; note_boy uuid;
  first_title text;
  failures int := 0;
begin
  perform set_config('test.uid', ana::text, true);

  insert into auth.users (id, email) values
    (ana, 'ana2@x.com'), (boy, 'boy2@x.com'), (cely, 'cely2@x.com');

  house := (public.create_household('Board House')).id;
  insert into public.household_members (household_id, user_id, role)
    values (house, boy, 'member');

  insert into public.announcements (household_id, user_id, content, tape_color)
    values (house, ana, 'Electricity is due Friday', 'mustard')
    returning id into note_ana;

  perform pg_sleep(0.01);

  insert into public.announcements (household_id, user_id, content)
    values (house, boy, 'I have a visitor this weekend') returning id into note_boy;

  -- ---- 1. Tape colour is constrained to palette tokens -------------------
  begin
    insert into public.announcements (household_id, user_id, content, tape_color)
      values (house, ana, 'bad tape', '#E8B94A');
    raise warning 'FAIL 1: a raw hex was accepted as a tape colour'; failures := failures + 1;
  exception when check_violation then
    raise notice 'PASS 1: tape_color rejects anything outside the palette tokens';
  end;

  -- ---- 2. A housemate can pin someone else's note ------------------------
  perform set_config('test.uid', boy::text, true);
  perform public.set_announcement_pinned(note_ana, true);
  if (select pinned from public.announcements where id = note_ana) then
    raise notice 'PASS 2: a housemate can pin a note they did not write';
  else
    raise warning 'FAIL 2: pin did not take'; failures := failures + 1;
  end if;

  -- ---- 3. ...but still cannot rewrite it ---------------------------------
  -- RLS is not enforced for the table owner, so check the policy directly.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'announcements' and cmd = 'UPDATE'
      and qual like '%auth.uid()%' and qual not like '%is_household_admin%'
  ) then
    raise notice 'PASS 3: content edits are still author-only';
  else
    raise warning 'FAIL 3: the UPDATE policy was widened beyond the author'; failures := failures + 1;
  end if;

  -- ---- 4. Pinned notes sort ahead of newer ones --------------------------
  select content into first_title
  from public.announcements
  where household_id = house
  order by pinned desc, created_at desc
  limit 1;

  if first_title = 'Electricity is due Friday' then
    raise notice 'PASS 4: the pinned note leads the feed despite being older';
  else
    raise warning 'FAIL 4: feed led with "%"', first_title; failures := failures + 1;
  end if;

  -- ---- 5. Unpinning restores newest-first --------------------------------
  perform public.set_announcement_pinned(note_ana, false);
  select content into first_title
  from public.announcements
  where household_id = house
  order by pinned desc, created_at desc
  limit 1;

  if first_title = 'I have a visitor this weekend' then
    raise notice 'PASS 5: unpinning restores newest-first';
  else
    raise warning 'FAIL 5: after unpin the feed led with "%"', first_title; failures := failures + 1;
  end if;

  -- ---- 6. Outsiders cannot pin -------------------------------------------
  perform set_config('test.uid', cely::text, true);
  begin
    perform public.set_announcement_pinned(note_boy, true);
    raise warning 'FAIL 6: a non-member pinned a note'; failures := failures + 1;
  exception when others then
    raise notice 'PASS 6: non-member refused (%)', sqlerrm;
  end;

  if failures = 0 then
    raise notice '=== ALL 6 BOARD CHECKS PASSED ===';
  else
    raise exception '% BOARD CHECK(S) FAILED', failures;
  end if;
end
$test$;
