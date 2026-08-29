# Data model

| Table | Purpose |
| --- | --- |
| `profiles` | One per auth user; display name and avatar |
| `households` | Name + unique 6-character invite code |
| `household_members` | Who is in which household, and their role |
| `bills` | Title, amount, category, due date, recurrence |
| `bill_splits` | Per-person share of a bill and whether it's settled |
| `chores` | Title, notes, recurrence |
| `chore_assignments` | Whose turn it is, when it's due, whether it's done |
| `announcements` | Household feed posts, whether they're pinned, their tape colour, and the path of any receipt pinned to them |
| `leave_requests` | Somebody asking the house to let them go, and how it ended |
| `leave_request_votes` | One housemate's answer to a request, and the reason on a decline |

Two **Storage buckets**:

- `avatars`, from `20260820020000_avatars_bucket.sql`. Public — an avatar isn't a secret, and
  a public bucket lets `profiles.avatar_url` hold a plain durable URL rather than one that
  has to be signed on every render. Writes are locked to `<user-id>/…`, so "public" covers
  reading only.
- `receipts`, from `20260822010000_board_receipts.sql`. **Private**, unlike avatars: a
  statement of account carries an account number, an address and a payment history, and a
  public object URL can't be revoked without deleting the file. Objects live at
  `<household-id>/<user-id>/…` — the first segment decides which house may read it, the
  second which person may replace or remove it — and `announcements.image_path` stores that
  path rather than a URL, because the only URL that works is a signed one that expires.
  `fetchAnnouncements` signs a whole page in one call; thirty notes would otherwise open
  thirty requests before the board could draw.

**Row level security** is on for every table. Access is granted only to members of the
owning household, checked through `SECURITY DEFINER` helpers
(`is_household_member`, `is_household_admin`, `shares_household_with`) so the policy on
`household_members` doesn't recurse into itself.

Several flows deliberately run through database functions rather than direct writes:

- **Creating a household** — a trigger adds the creator as the first `admin`, which is also
  what lets `insert … returning` pass the select policy.
- **Joining a household** — `join_household_by_code(code)` resolves the invite code and
  inserts the membership. Users can't read (or add themselves to) a household they aren't
  in, so the code is the only way in.
- **Leaving a household** — see below. `leave_requests` and `leave_request_votes` have a
  select policy and nothing else; every write goes through
  `request_household_leave`, `vote_on_leave_request` or `cancel_leave_request`.
- **Signing out** — `leave_all_households()` drops the caller's memberships without a vote,
  because signing out has no way back. See below.

## Leaving is something the house answers

Leaving used to be one delete: tap, confirm, gone. That's the right shape for a group chat
and the wrong one for a house where money is outstanding — the person with ₱3,000 unsettled
is exactly the one most motivated to tap it, and the housemates left behind found out by
noticing a name had disappeared from the split list.

Now it's a request. Every remaining housemate accepts, or one declines and says why; the
app shows each of them what the leaver still owes, what the house owes the leaver, and what
sits between the two of them specifically, all read off bills already loaded. An accept
stays changeable until the request resolves, which is what makes "not until you pay me back"
a position rather than a veto.

What the database deliberately does *not* do is refuse a leave over an unpaid bill.
Housemates forgive debts, write them off, or settle in cash the app never sees, and a hard
block would strand someone in a household they've physically moved out of. The house
decides; the schema makes sure the house is asked. Two valves keep that from becoming a trap
the other way: an admin can cancel a request, and the last person in a household has nobody
to ask, so theirs completes immediately.

Three things about it are easy to get wrong and are handled:

- A request waits on every *current* member, so removing one can be what completes it —
  three housemates, one accepts, the third is removed by an admin, and nothing was going to
  notice. `settle_ready_leave_requests()` sweeps for that, guarded against the recursion of
  a completion that removes another member.
- The leaver stops being a member at the moment their request completes, so Realtime
  evaluates the `household_members` policy against a membership they no longer have and the
  one event they most need never arrives. `leave_requests` stays readable to the person it
  belongs to afterwards, and the session watches that row instead.
- Whichever way a membership ends — an approved leave, an admin removing someone, signing
  out — the `on_household_member_removed` trigger settles up behind them. See below.

## Signing out is moving out

There is no password, so a session *is* the identity: signing out doesn't end a session, it
ends a person. That makes the leave request the wrong instrument — there is nobody left for
a pending vote to resolve to — so `leave_all_households()` removes the membership outright
and lets the trigger do the rest. `request_household_leave` is still the door for someone
who is staying signed in and can be asked about.

The trigger is the one place that knows what a departure costs the house, because four
different doors lead into it (signing out, an accepted request, an admin removal, a deleted
household) and they should all end in the same state:

- **Unpaid shares** are divided equally among the housemates still here. Recipients are the
  ones whose own share of that bill is still unpaid; failing that, housemates not on the
  bill at all; failing both, the share is written off, because everybody left has already
  paid and there's no one to hand it to. Amounts are floored to the centavo and the
  remainder dealt out one centavo each from the longest-standing member, so the parts still
  add back up to what was owed. Kasama already allows an uneven split, so a redistribution
  landing on round numbers was never the point.
- **Open chore turns** are dealt round-robin across everyone left, starting at whoever is
  next in the rotation. A single turn goes where it always went; four turns don't all land
  on one person.
- **Paid splits, bills themselves and finished turns** stay exactly where they are. That's
  the record of what happened, and moving out doesn't un-pay what you paid or un-do what
  you did.
