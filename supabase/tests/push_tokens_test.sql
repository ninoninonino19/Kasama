\set ON_ERROR_STOP on
\pset pager off

do $test$
declare
  ana uuid := 'cccccccc-0000-0000-0000-000000000001';
  boy uuid := 'cccccccc-0000-0000-0000-000000000002';
  shared_token text := 'ExponentPushToken[shared-phone]';
  owner uuid;
  policy_names text[];
  failures int := 0;
begin
  insert into auth.users (id, email) values (ana, 'ana4@x.com'), (boy, 'boy4@x.com');

  -- ---- 1. Registration stores the caller's token -------------------------
  perform set_config('test.uid', ana::text, true);
  perform public.register_device_token(shared_token, 'android');

  select user_id into owner from public.device_tokens where token = shared_token;
  if owner = ana then
    raise notice 'PASS 1: a token registers to the signed-in user';
  else
    raise warning 'FAIL 1: token belongs to %', coalesce(owner::text, 'nobody'); failures := failures + 1;
  end if;

  -- ---- 2. The same device changing hands moves the token -----------------
  -- Shared phones are normal in a boarding house. Without this the second
  -- person's registration silently fails and they never get a notification.
  perform set_config('test.uid', boy::text, true);
  perform public.register_device_token(shared_token, 'android');

  select user_id into owner from public.device_tokens where token = shared_token;
  if owner = boy then
    raise notice 'PASS 2: re-registering moves the device to its new owner';
  else
    raise warning 'FAIL 2: token still belongs to %', owner; failures := failures + 1;
  end if;

  if (select count(*) from public.device_tokens where token = shared_token) = 1 then
    raise notice 'PASS 3: handing a device over does not duplicate the token';
  else
    raise warning 'FAIL 3: token duplicated'; failures := failures + 1;
  end if;

  -- ---- 4. Nobody can write tokens directly -------------------------------
  select array_agg(cmd::text order by cmd::text) into policy_names
  from pg_policies where schemaname = 'public' and tablename = 'device_tokens';

  if policy_names @> array['SELECT'] and not (policy_names @> array['INSERT'])
     and not (policy_names @> array['UPDATE']) then
    raise notice 'PASS 4: no insert or update policy — registration is the only door';
  else
    raise warning 'FAIL 4: policies are %', policy_names; failures := failures + 1;
  end if;

  -- ---- 5. A token is only visible to its owner ---------------------------
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'device_tokens' and cmd = 'SELECT'
      and qual like '%auth.uid()%'
  ) then
    raise notice 'PASS 5: reads are scoped to the owner, so housemates cannot harvest tokens';
  else
    raise warning 'FAIL 5: select policy is not owner-scoped'; failures := failures + 1;
  end if;

  -- ---- 6. An unknown platform is refused ---------------------------------
  begin
    perform public.register_device_token('ExponentPushToken[weird]', 'blackberry');
    raise warning 'FAIL 6: an unknown platform was accepted'; failures := failures + 1;
  exception when others then
    raise notice 'PASS 6: unknown platform refused (%)', sqlerrm;
  end;

  -- ---- 7. Board notes are opt-in, the other two opt-out ------------------
  if (select push_bills and push_chores and not push_board from public.profiles where id = ana) then
    raise notice 'PASS 7: bills and chores default on, board notes default off';
  else
    raise warning 'FAIL 7: notification defaults are wrong'; failures := failures + 1;
  end if;

  -- ---- 8. Losing the account takes the tokens with it --------------------
  delete from auth.users where id = boy;
  if not exists (select 1 from public.device_tokens where user_id = boy) then
    raise notice 'PASS 8: deleting a user cascades their device tokens away';
  else
    raise warning 'FAIL 8: tokens outlived their user'; failures := failures + 1;
  end if;

  if failures = 0 then
    raise notice '=== ALL 8 PUSH CHECKS PASSED ===';
  else
    raise exception '% PUSH CHECK(S) FAILED', failures;
  end if;
end
$test$;
