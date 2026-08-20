-- ============================================================================
-- Chore streaks, as a view rather than a client-side walk.
--
-- The redesign derives streaks in JS from the assignment history, which is
-- correct but only works where the whole history happens to be loaded — the
-- Chores tab, and nowhere else. A view makes the same number available to any
-- screen for the cost of one small query, and stops "how is a streak counted"
-- from being answered in a component.
--
-- The definition is unchanged, deliberately: walking a housemate's turns
-- newest-first, count the finished ones until you hit a turn they missed. A
-- turn that is still open but not yet late is skipped rather than counted as a
-- break — you haven't lost a streak at 9am on the morning something is due.
--
-- security_invoker means the caller's own RLS applies, so this view can't be
-- used to read another household's chores.
-- ============================================================================

create or replace view public.chore_streaks
with (security_invoker = true)
as
with relevant as (
  select
    c.household_id,
    a.user_id,
    a.completed,
    -- Rank within what's left *after* dropping not-yet-late open turns, so a
    -- chore due this afternoon doesn't sit in the middle of the count.
    row_number() over (
      partition by c.household_id, a.user_id
      order by a.due_date desc, a.id desc
    ) as position
  from public.chore_assignments a
  join public.chores c on c.id = a.chore_id
  where a.completed or a.due_date < current_date
)
select
  household_id,
  user_id,
  -- The first unfinished turn ends the streak; everything above it counts.
  -- With no unfinished turn at all, the streak is the whole history.
  (coalesce(min(position) filter (where not completed), max(position) + 1) - 1)::int as streak
from relevant
group by household_id, user_id;

comment on view public.chore_streaks is
  'Consecutive finished chore turns per housemate. Open turns that are not yet late are skipped rather than treated as a break.';

grant select on public.chore_streaks to authenticated;
