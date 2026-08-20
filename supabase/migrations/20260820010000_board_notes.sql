-- ============================================================================
-- The board's two missing columns.
--
-- The redesign draws each note with a strip of washi tape and treats the feed
-- as a board rather than a log, but the schema had nowhere to put either idea:
-- tape colour was hashed from the note's id, and "pinned" didn't exist at all.
-- Both were written up as follow-ups rather than faked, and this is the
-- follow-up.
--
-- `tape_color` stores a palette *token*, not a hex. The design system has
-- already been re-tuned once; storing '#E8B94A' would mean a data migration
-- every time a colour moves, and a note whose tape no longer matches any card
-- on screen. A check constraint rather than an enum so adding a colour later
-- is one ALTER, not a type rewrite.
-- ============================================================================

alter table public.announcements
  add column if not exists pinned boolean not null default false,
  add column if not exists tape_color text;

alter table public.announcements
  drop constraint if exists announcements_tape_color_check;

alter table public.announcements
  add constraint announcements_tape_color_check
  check (tape_color is null or tape_color in ('mustard', 'sage', 'brick', 'moss'));

-- Pinned notes are read first and the feed is always ordered this way.
create index if not exists announcements_board_order_idx
  on public.announcements (household_id, pinned desc, created_at desc);

-- ----------------------------------------------------------------------------
-- Pinning is a household act, not an authorship one.
--
-- On a real fridge anyone can move a note to the top. But the announcements
-- UPDATE policy is `user_id = auth.uid()` — deliberately, because editing
-- someone else's words while their name stays on the note is worse than
-- deleting it. Widening that policy to let housemates pin would also let them
-- rewrite each other's posts.
--
-- So pinning gets its own narrow door instead: a definer function that can
-- change exactly one boolean, for any member of the household.
-- ----------------------------------------------------------------------------
create or replace function public.set_announcement_pinned(
  announcement_id uuid,
  pinned boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  target public.announcements;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into target from public.announcements a where a.id = announcement_id;
  if not found then
    raise exception 'Note not found';
  end if;

  -- SECURITY DEFINER bypasses RLS, so membership is checked by hand.
  if not public.is_household_member(target.household_id) then
    raise exception 'Not a member of this household';
  end if;

  update public.announcements a
     set pinned = set_announcement_pinned.pinned
   where a.id = announcement_id;
end;
$$;

revoke all on function public.set_announcement_pinned(uuid, boolean) from public;
grant execute on function public.set_announcement_pinned(uuid, boolean) to authenticated;
