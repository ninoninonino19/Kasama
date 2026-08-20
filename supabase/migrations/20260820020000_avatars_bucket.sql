-- ============================================================================
-- Avatar uploads.
--
-- `profiles.avatar_url` has been read by every Avatar in the app since the
-- first migration, and nothing has ever written to it — every housemate has
-- always been their initials. This gives it somewhere to point.
--
-- The bucket is public. An avatar is not a secret, and a public bucket means
-- `avatar_url` can hold a plain durable URL that any <Image> can load without
-- minting a signed URL first — which would otherwise have to happen on every
-- render of every list.
--
-- Writes are locked to the uploader's own folder, so "public" applies to
-- reading only: nobody can replace someone else's face.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars are readable by anyone" on storage.objects;
drop policy if exists "avatars are written to own folder" on storage.objects;
drop policy if exists "avatars are replaced in own folder" on storage.objects;
drop policy if exists "avatars are removed from own folder" on storage.objects;

create policy "avatars are readable by anyone"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Every object lives under <user-id>/…, which is what ties a file to a person.
create policy "avatars are written to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars are replaced in own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars are removed from own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
