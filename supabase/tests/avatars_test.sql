\set ON_ERROR_STOP on
\pset pager off

do $test$
declare
  uid text := 'aaaaaaaa-0000-0000-0000-00000000009f';
  b record;
  policy_count int;
  failures int := 0;
begin
  -- ---- 1. Bucket is configured the way the client assumes ----------------
  select public, file_size_limit, allowed_mime_types into b
  from storage.buckets where id = 'avatars';

  if b is null then
    raise warning 'FAIL 1: no avatars bucket'; failures := failures + 1;
  elsif not b.public then
    raise warning 'FAIL 1: bucket is private, so avatar_url cannot be a plain URL';
    failures := failures + 1;
  elsif b.file_size_limit <> 2 * 1024 * 1024 then
    raise warning 'FAIL 1: size limit is %', b.file_size_limit; failures := failures + 1;
  elsif not ('image/jpeg' = any(b.allowed_mime_types)) then
    raise warning 'FAIL 1: jpeg not allowed'; failures := failures + 1;
  else
    raise notice 'PASS 1: avatars bucket is public, 2MB, images only';
  end if;

  -- ---- 2. The path convention the policies rely on ------------------------
  -- storage.objects.name excludes the bucket, so the app uploads to
  -- "<user-id>/<file>" and the policy reads segment 1 back out. If that
  -- convention ever slips, every upload silently starts failing.
  if (storage.foldername(uid || '/1755000000.jpg'))[1] = uid then
    raise notice 'PASS 2: foldername() recovers the owner from the upload path';
  else
    raise warning 'FAIL 2: foldername() gave %', storage.foldername(uid || '/x.jpg');
    failures := failures + 1;
  end if;

  -- A bare filename has no folder, so it can never match a user id.
  if coalesce((storage.foldername('loose.jpg'))[1], '') = '' then
    raise notice 'PASS 3: a path with no folder matches nobody';
  else
    raise warning 'FAIL 3: a bare filename produced an owner'; failures := failures + 1;
  end if;

  -- ---- 4. Writes are folder-scoped, reads are not -------------------------
  select count(*) into policy_count
  from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname like 'avatars %'
    and cmd in ('INSERT', 'UPDATE', 'DELETE')
    and coalesce(qual, '') || coalesce(with_check, '') like '%foldername%';

  if policy_count = 3 then
    raise notice 'PASS 4: insert, update and delete are all folder-scoped';
  else
    raise warning 'FAIL 4: % of 3 write policies check the folder', policy_count;
    failures := failures + 1;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars are readable by anyone' and cmd = 'SELECT'
  ) then
    raise notice 'PASS 5: avatars stay publicly readable';
  else
    raise warning 'FAIL 5: no public read policy'; failures := failures + 1;
  end if;

  if failures = 0 then
    raise notice '=== ALL 5 AVATAR CHECKS PASSED ===';
  else
    raise exception '% AVATAR CHECK(S) FAILED', failures;
  end if;
end
$test$;
