# Architecture

How the app is put together: where the code lives, and two decisions that are easy to
undo by accident.

## Project layout

```
app/                        # Expo Router routes
  _layout.tsx               # providers + root stack
  index.tsx                 # entry redirect (welcome → onboarding → tabs)
  welcome.tsx               # pick a display name; opens the session
  onboarding/               # create a household, or join with an invite code
  invite.tsx                # straight after creating one: here is your code, send it
  (tabs)/                   # Home, Bills, Chores, Board
  bills/new.tsx, [id].tsx   # add a bill, per-person split detail
  chores/new.tsx            # add a chore
  settings/account.tsx      # your name, photo, notifications, sign out
  settings/household.tsx    # invite code, name, housemates, leaving
src/
  api/                      # Supabase queries, grouped by feature
  components/ui/            # NoteCard, Tape, Pill, Avatar, BoardTabBar, states…
  hooks/                    # useAsyncData, useRealtime, useHouseholdData
  lib/                      # theme + motion tokens, supabase client, formatting, DB types
  providers/                # SessionProvider (auth + household bootstrap)
  store/                    # Zustand session store + the board's "last seen" mark
supabase/migrations/        # schema + RLS + realtime setup
tools/generate-icons.py     # renders the icon set from one mark
```

## Getting a second person in

Creating a household lands on `app/invite.tsx` rather than the dashboard. The invite code is
the entire access model — there are no accounts, and the code is the door — so leaving it in
Settings → Household, behind the housemates row on Home, put the one thing the app cannot
work without three taps into a screen nobody had a reason to open yet. A household of one is
a dead app.

It sits at the root rather than under `onboarding/`, because that layout redirects to the
dashboard the moment a household exists, which is exactly when this screen has something to
say. The create screen navigates there with the code in hand and lets the invite screen
refresh the store, so filling the store in can't race the redirect. `InviteCode` is shared
with household settings, so the code and its share-sheet fallback only have to be right
once.

## What the tab bar knows

`useTabSignals` runs in the tabs layout — not in a screen — because a badge only does any
work on the tab you are *not* looking at. It reads two cheap queries of its own (`api/signals.ts`)
rather than borrowing the screens' data, and listens on the same realtime channels.

Bills carries a count of overdue bills; the Board carries a plain dot when a housemate has
posted since this device last had the board open. A count on the board would invite you to
clear it like an inbox, which is not what a house board is for. "Last open" lives in
AsyncStorage via `useBoardSeen`: reading is a property of the person looking, and with no
accounts there is nothing in the schema to hang it on. The board stamps itself seen on the
way in *and* the way out, so a note that lands while you are reading doesn't leave the dot
lit.

---

## Realtime

`src/hooks/useRealtime.ts` subscribes to Postgres changes and coalesces bursts into a single
silent refetch (adding a bill with four splits triggers one refresh, not five).

Parent tables are filtered server-side by `household_id`. Child tables (`bill_splits`,
`chore_assignments`) have no such column, so they're subscribed unfiltered — RLS already
limits the stream to the caller's household. The migration sets `replica identity full` on
those tables so Realtime can evaluate the policies against changed rows.
