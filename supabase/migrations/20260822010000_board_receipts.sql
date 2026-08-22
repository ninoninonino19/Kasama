-- ============================================================================
-- Receipts on the board.
--
-- The gap this closes is a social one, not a technical one. Someone pays the
-- kuryente, types the total into Kasama, and everyone else has to take their
-- word for it — which is fine right up until the month the bill jumps and
-- nobody can remember why. Pinning the photo of the SOA next to the note means
-- the house can check the number *before* it becomes a split everybody owes
-- on, rather than arguing about it afterwards.
--
-- It rides on `announcements` rather than on `bills` on purpose. The board is
-- where the house already talks, a receipt is a thing you show people, and a
-- note that carries one is exactly the "does this look right to you?" post
-- people were already writing in words.
--
-- The column stores a storage *path*, not a URL. This bucket is private (see
-- below), so the only URL that works is a signed one that expires — storing
-- one would mean the board serving dead links to anything older than an hour.
-- ============================================================================

alter table public.announcements
  add column if not exists image_path text;

alter table public.announcements
  drop constraint if exists announcements_image_path_check;

alter table public.announcements
  add constraint announcements_image_path_check
  check (image_path is null or char_length(image_path) between 1 and 300);

-- ----------------------------------------------------------------------------
-- The bucket.
--
-- Private, unlike `avatars`. A face is not a secret; a statement of account
-- carries an account number, an address and a payment history, and a public
-- bucket hands all of that to anyone who ever sees the URL — for good, since
-- a public object URL cannot be revoked without deleting the file. Reads go
-- through short-lived signed URLs minted for people the RLS policy below
-- already lets in.
--
-- 6MB rather than the avatars' 2MB: a receipt is only useful if the small
-- print survives, and a phone photo of an A4 SOA at a readable resolution is
-- comfortably past two.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  6 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Every object lives at <household-id>/<user-id>/<file>. The first segment is
-- what scopes a receipt to a house, the second is what ties it to the person
-- who put it up — so both policies below can be written against the path
-- itself, with no lookup back into a row that may not exist yet.
--
-- `storage.foldername` returns text, and the first segment of an arbitrary
-- object name is not necessarily a uuid — a bad cast inside a policy is an
-- error rather than a denial, so it is caught here and turned into a null,
-- which `is_household_member` answers false for.
create or replace function public.receipt_household(object_name text)
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  parts text[] := storage.foldername(object_name);
begin
  if coalesce(array_length(parts, 1), 0) < 2 then
    return null;
  end if;
  return parts[1]::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.receipt_owner(object_name text)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(array_length(storage.foldername(object_name), 1), 0) < 2 then null
    else (storage.foldername(object_name))[2]
  end;
$$;

drop policy if exists "receipts readable by housemates" on storage.objects;
drop policy if exists "receipts written by housemates" on storage.objects;
drop policy if exists "receipts replaced by uploader" on storage.objects;
drop policy if exists "receipts removed by uploader" on storage.objects;

create policy "receipts readable by housemates"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and public.is_household_member(public.receipt_household(name))
  );

create policy "receipts written by housemates"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and public.is_household_member(public.receipt_household(name))
    and public.receipt_owner(name) = auth.uid()::text
  );

create policy "receipts replaced by uploader"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'receipts'
    and public.receipt_owner(name) = auth.uid()::text
  )
  with check (
    bucket_id = 'receipts'
    and public.is_household_member(public.receipt_household(name))
    and public.receipt_owner(name) = auth.uid()::text
  );

-- Taking a note down is open to its author and to admins, so clearing up the
-- file behind it has to be too — otherwise an admin removing someone's post
-- leaves the receipt sitting in the bucket with nothing pointing at it.
create policy "receipts removed by uploader"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and (
      public.receipt_owner(name) = auth.uid()::text
      or public.is_household_admin(public.receipt_household(name))
    )
  );
