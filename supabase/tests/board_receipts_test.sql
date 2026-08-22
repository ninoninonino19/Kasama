\set ON_ERROR_STOP on
\pset pager off

do $test$
declare
  ana  uuid := 'ffffffff-0000-0000-0000-000000000001';
  boy  uuid := 'ffffffff-0000-0000-0000-000000000002';
  cely uuid := 'ffffffff-0000-0000-0000-000000000003';
  house uuid;
  b record;
  note uuid;
  failures int := 0;
begin
  perform set_config('test.uid', ana::text, true);

  insert into auth.users (id, email) values
    (ana, 'ana@r.com'), (boy, 'boy@r.com'), (cely, 'cely@r.com');

  house := (public.create_household('Unit 9C')).id;
  insert into public.household_members (household_id, user_id, role) values (house, boy, 'member');

  -- ---- 1. The bucket is private, and big enough for a photo of an SOA -----
  select public, file_size_limit, allowed_mime_types into b
  from storage.buckets where id = 'receipts';

  if b is null then
    raise warning 'FAIL 1a: no receipts bucket'; failures := failures + 1;
  elsif b.public then
    raise warning 'FAIL 1b: receipts are publicly readable — an SOA is not an avatar';
    failures := failures + 1;
  elsif b.file_size_limit <> 6 * 1024 * 1024 then
    raise warning 'FAIL 1c: size limit is %', b.file_size_limit; failures := failures + 1;
  elsif not ('image/jpeg' = any(b.allowed_mime_types)) then
    raise warning 'FAIL 1d: jpeg not allowed'; failures := failures + 1;
  else
    raise notice 'PASS 1: receipts bucket is private, 6MB, images only';
  end if;

  -- ---- 2. The path convention both policies read ---------------------------
  if public.receipt_household(house::text || '/' || ana::text || '/1755.jpg') = house
     and public.receipt_owner(house::text || '/' || ana::text || '/1755.jpg') = ana::text then
    raise notice 'PASS 2: <household>/<user>/<file> resolves to both halves';
  else
    raise warning 'FAIL 2: path did not resolve (% / %)',
      public.receipt_household(house::text || '/' || ana::text || '/1755.jpg'),
      public.receipt_owner(house::text || '/' || ana::text || '/1755.jpg');
    failures := failures + 1;
  end if;

  -- A malformed path is a denial, not an error. Casting junk to uuid inside a
  -- policy would abort the statement rather than refuse the row.
  if public.receipt_household('loose.jpg') is null
     and public.receipt_household('not-a-uuid/' || ana::text || '/x.jpg') is null
     and public.receipt_owner('loose.jpg') is null then
    raise notice 'PASS 3: a malformed path resolves to nobody rather than throwing';
  else
    raise warning 'FAIL 3: a malformed path was accepted'; failures := failures + 1;
  end if;

  -- ---- 4. is_household_member answers false for the null that produces ----
  if not public.is_household_member(public.receipt_household('loose.jpg')) then
    raise notice 'PASS 4: a path with no household matches no member';
  else
    raise warning 'FAIL 4: a folderless path passed the membership check';
    failures := failures + 1;
  end if;

  -- ---- 5. Reads are household-scoped, not public --------------------------
  perform set_config('test.uid', cely::text, true);
  if public.is_household_member(house) then
    raise warning 'FAIL 5: an outsider counts as a member'; failures := failures + 1;
  else
    raise notice 'PASS 5: someone outside the house cannot read its receipts';
  end if;
  perform set_config('test.uid', boy::text, true);
  if not public.is_household_member(house) then
    raise warning 'FAIL 5b: a housemate cannot read the house''s receipts';
    failures := failures + 1;
  else
    raise notice 'PASS 5b: every housemate can read them, which is the point';
  end if;
  perform set_config('test.uid', ana::text, true);

  -- ---- 6. Every write policy checks both halves of the path ---------------
  if (
    select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'receipts %'
      and cmd = 'INSERT'
      and coalesce(with_check, '') like '%receipt_owner%'
      and coalesce(with_check, '') like '%receipt_household%'
  ) = 1 then
    raise notice 'PASS 6: uploads must land in your own folder, inside your own house';
  else
    raise warning 'FAIL 6: the insert policy does not check both path segments';
    failures := failures + 1;
  end if;

  -- ---- 7. The note keeps a path, never a URL ------------------------------
  insert into public.announcements (household_id, user_id, content, image_path)
    values (house, ana, 'Kuryente for August — check the total', house::text || '/' || ana::text || '/1.jpg')
    returning id into note;

  if (select image_path from public.announcements where id = note) like 'http%' then
    raise warning 'FAIL 7: a signed URL was stored where a path belongs';
    failures := failures + 1;
  else
    raise notice 'PASS 7: the note stores a storage path, so its link can be re-signed';
  end if;

  -- ---- 8. A note without a receipt is still a note ------------------------
  insert into public.announcements (household_id, user_id, content)
    values (house, ana, 'Bin day moved to Thursday');
  raise notice 'PASS 8: image_path is optional';

  begin
    insert into public.announcements (household_id, user_id, content, image_path)
      values (house, ana, 'Too long', repeat('x', 301));
    raise warning 'FAIL 9: an over-long path was accepted'; failures := failures + 1;
  exception when check_violation then
    raise notice 'PASS 9: the path length is bounded';
  end;

  if failures = 0 then
    raise notice '=== ALL 9 RECEIPT CHECKS PASSED ===';
  else
    raise exception '% RECEIPT CHECK(S) FAILED', failures;
  end if;
end
$test$;
