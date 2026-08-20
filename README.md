# Kasama

**Kasama** (Filipino for *companion / housemate*) is a shared-living app for boarding house,
dorm and apartment roommates. One household, one place to track the bills, the chores and
the announcements.

- Split bills (renta, kuryente, tubig, WiFi, grocery) and see who still owes what
- Rotate recurring chores and tick them off
- Post short announcements to the household feed
- Everything syncs live across everyone's phone

Built with Expo (React Native) + TypeScript, NativeWind, and Supabase. One codebase for
iOS and Android.

---

## Stack

| Concern | Choice |
| --- | --- |
| App framework | Expo SDK 54 + React Native 0.81, TypeScript |
| Navigation | Expo Router (file-based, typed routes) |
| Styling | NativeWind v4 (Tailwind CSS v3) |
| Type | Manrope, Caveat and IBM Plex Mono via `expo-font` (see *Design system*) |
| Backend | Supabase — Postgres, Auth (anonymous sessions), Realtime |
| Client state | Zustand (`src/store/useSessionStore.ts`) |
| Session storage | `@supabase/supabase-js` + AsyncStorage |
| Builds | EAS Build (`eas.json`) |

---

## Getting started

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run every migration in `supabase/migrations/`, in filename order — either paste them into
   the SQL editor, or use the CLI:

   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

3. **Auth → Providers → Anonymous sign-ins**: turn this **on**. Kasama does not ask anyone
   to register — you give a display name and the app opens an anonymous session, which is a
   real `auth.users` row with no email and no password. That is what keeps `auth.uid()`
   meaningful, and with it every RLS policy in the schema. Email/password can be left off.
4. **Auth → Rate Limits**: anonymous sign-ins are rate-limited per IP (30/hour by default).
   A household is a handful of people, so the default is generous — but a shared Wi-Fi
   network counts as one IP, which is worth knowing if a whole house signs up at once.
5. **Database → Replication**: the migration already adds the app tables to the
   `supabase_realtime` publication, so live updates work out of the box.

### 3. Point the app at your project

```bash
cp .env.example .env
```

Fill in the values from **Project Settings → API**:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

Both are safe to ship in the client — row level security is what protects the data.
Env changes are baked in at bundle time, so restart with a cleared cache after editing:

```bash
npx expo start --clear
```

### 4. Run it

```bash
npm start          # then scan the QR code with Expo Go
npm run usb        # Android over a USB cable — the reliable one, see below
npm run tunnel     # routed over the internet — see below
npm run android
npm run ios
npm run web        # handy for quick UI checks
```

Useful checks:

```bash
npm run typecheck  # tsc --noEmit
```

### Running over USB (`npm run usb`)

When the phone and the computer can't reach each other over the network — a wired desktop
and a wireless phone, a router that isolates clients, a firewall — plug the phone in
instead. It sidesteps the network completely and is worth defaulting to:

1. Phone: **Settings → About phone →** tap *Build number* seven times, then
   **Developer options → USB debugging** on.
2. Install **Android SDK Platform Tools** and put it on `PATH`, so `adb version` works.
   *Open a new terminal afterwards* — PATH changes don't reach terminals already running,
   and Expo failing to find `adb` surfaces as
   `Error: The system cannot find the path specified` from `cross-spawn`.
3. Plug in, accept *Allow USB debugging?*, check `adb devices` lists the phone.
4. `npm run usb`, then press `a`.

`--host localhost` is the part that isn't obvious. `adb reverse` gets Expo Go's *first*
request through, so the connection looks fine — but Metro's reply carries a `bundleUrl`
built from whatever host it advertises. Left on the LAN address, the phone fetches the
manifest over USB and then tries to fetch the JavaScript from an IP it can't reach, failing
with **"Failed to download remote update"** while every check on the computer looks healthy.
`--host localhost` writes `127.0.0.1` into that reply instead, which the USB tunnel carries.

The mapping doesn't survive unplugging or a phone reboot. `npm run usb` re-adds it every
time, so just run it again.

### Troubleshooting Expo Go on Android

Every native module this app uses (gesture-handler, reanimated, worklets, screens,
safe-area-context, async-storage, datetimepicker and the `expo-*` packages) ships inside
Expo Go, so no custom dev build is needed. If the QR code won't load, it is almost always
one of these three:

**1. Expo Go is a different SDK version.** The Play Store build of Expo Go supports one SDK
at a time. This project is pinned to **SDK 54** (`expo@54`, React Native 0.81) to match what
Expo Go on Android currently ships — that pin is deliberate, so don't bump the Expo packages
without checking the phone first. When Expo Go does move to a newer SDK:

```bash
npx expo install expo@^<new-sdk>   # then re-pin the rest
npx expo install --fix             # align packages with the installed SDK
npx expo-doctor                    # reports version mismatches
```

**2. The phone can't reach your computer.** By default Metro serves over the local network,
so both devices have to be on the same Wi-Fi — and many dorm, campus and café networks block
devices from talking to each other (client isolation), which looks like the QR scanning
forever and timing out. A computer on Ethernet with the phone on Wi-Fi often can't reach
either, especially if they land on different subnets: compare the computer's IPv4 from
`ipconfig` with the phone's under **Settings → Wi-Fi → (network) → IP address**, and if the
first three groups differ, nothing on the computer will fix it. To test reachability from
the phone without typing on it, `adb shell am start -a android.intent.action.VIEW -d
"http://<computer-ip>:8081/status"` opens its browser at Metro. Route around it with
`npm run usb` (above) or:

```bash
npm run tunnel                # expo start --tunnel
```

The first run installs `@expo/ngrok` and is slower to refresh, but it works from any network,
including mobile data.

**3. A firewall is blocking port 8081.** On Windows, allow Node through the Windows Defender
prompt (or `netsh advfirewall firewall add rule name="Metro" dir=in action=allow protocol=TCP
localport=8081`). On Linux with ufw: `sudo ufw allow 8081/tcp`. The tunnel above sidesteps
this too.

Still stuck? `npx expo start --clear` clears a stale Metro cache, and the error shown *on the
phone* is the useful one — it names which of the three you're hitting.

---

## Project layout

```
app/                        # Expo Router routes
  _layout.tsx               # providers + root stack
  index.tsx                 # entry redirect (welcome → onboarding → tabs)
  welcome.tsx               # pick a display name; opens the session
  onboarding/               # create a household, or join with an invite code
  (tabs)/                   # Home, Bills, Chores, Board
  bills/new.tsx, [id].tsx   # add a bill, per-person split detail
  chores/new.tsx            # add a chore
  settings/account.tsx      # your name, photo, notifications, sign out
  settings/household.tsx    # invite code, name, housemates, leaving
src/
  api/                      # Supabase queries, grouped by feature
  components/ui/            # NoteCard, Tape, Pill, Avatar, BoardTabBar, states…
  hooks/                    # useAsyncData, useRealtime, useHouseholdData
  lib/                      # theme tokens, supabase client, formatting, DB types
  providers/                # SessionProvider (auth + household bootstrap)
  store/                    # Zustand session store
supabase/migrations/        # schema + RLS + realtime setup
```

---

## Design system — "the shared fridge board"

Kasama's job is to digitise something people already have: the whiteboard or the pile of
sticky notes on a shared fridge. So cards read like pinned notes, the board reads like
handwriting, and anything with a ledger quality — pesos, due dates, timestamps — is set in
mono.

**Tokens** live in two places that must stay in step: `src/lib/theme.ts` for values that
have to be passed as props (icon tints, `RefreshControl`, placeholder text) and
`tailwind.config.js` for the class names. Same hexes, same names.

| Token | Use |
| --- | --- |
| `canvas` | The ground a screen sits on — the fridge door behind the notes |
| `paper` | Every card, lifted off the canvas. The one card surface in the system |
| `page` | Recessed: pressed states, progress tracks, inset counters. Deep enough that pressing a card is visible |
| `line` | Hairline borders and dividers |
| `ink` / `ink-soft` / `ink-muted` | Text, in descending emphasis. `ink-faint` is decorative only |
| `moss` / `moss-light` | Primary actions, active tab, "done" |
| `mustard` | Money, "due soon", the default washi tape |
| `brick` | Overdue, destructive, anything needing chasing |
| `sage` | Settled, calm accents, streaks |
| `slate` | Informational: hints, callouts, "here is something to know". Promoted out of the category tints, so it adds a voice without adding a hue |
| `wash-*` / `deep-*` | Derived pale fills and their readable foregrounds, for pills and banners |
| `bezel` | Warm near-black, used for shadows rather than pure black |

**Type.** React Native matches a custom face by family name alone, so every weight is
registered separately and reached by family, not by `font-bold`:

| Class | Face | Use |
| --- | --- | --- |
| `font-sans` `font-ui` `font-ui-semibold` `font-ui-bold` `font-ui-black` | Manrope | All UI text |
| `font-hand` `font-hand-bold` | Caveat | Greetings, board posts, "your turn" — never buttons or labels |
| `font-mono` `font-mono-bold` | IBM Plex Mono | Peso amounts, due dates, timestamps |

Caveat is a delight, not a voice: if it starts appearing on labels and buttons it stops
being special and starts being hard to read. The faces load through `expo-font` in
`app/_layout.tsx`, behind the native splash — a handwriting-led layout that reflows after
first paint reads as a rendering bug.

**Components.** `NoteCard` is the base surface (paper, hairline border, warm shadow,
optional `Tape` and a fraction of a degree of pin skew). `Tape` is the decorative strip at a
card's top-left, hidden from screen readers. `Pill` is the status badge. `Avatar` carries a
paper ring so faces can overlap. `BoardTabBar` replaces react-navigation's default bar.
Status never rides on colour alone — every pill pairs its tone with a word and a glyph.

### Where the design outran the schema

Three things the design asked for had no column behind them. They were flagged rather than
faked, and have since been built:

| Design element | Where it lives now |
| --- | --- |
| Chore streaks | `chore_streaks`, a `security_invoker` view. Walking a housemate's turns newest-first, count the finished ones until a missed turn; a turn that is open but not yet late is skipped rather than treated as a break |
| Tape colour per note | `announcements.tape_color`, a palette *token* rather than a hex, so re-tuning a colour isn't a data migration. Notes written before the column keep a colour hashed from their id |
| Pinned notes | `announcements.pinned`, plus `set_announcement_pinned()`. Pinning is open to the whole household while editing stays with the author — see the migration for why those can't share one policy |

### One palette, everywhere

The design brief originally covered only Home, Bills, Chores and the Board; onboarding,
settings, auth and the detail modals kept the teal/coral/sand scales the app shipped with,
so the app rendered in two visual languages at once. Those scales are gone. Every screen now
draws in the tokens above.

The same pass fixed a quieter bug on those screens: they styled text with Tailwind's
`font-bold` and `font-semibold`, which do nothing here — React Native matches a custom face
by family name, so a "bold" heading was rendering at regular weight. They now use the
`font-ui-*` families like the rest of the app.

There is no deprecated scale left in `src/lib/theme.ts`. If a screen needs a colour that
isn't in the table above, that's a design decision, not a local one.

### Language

The interface is written in English throughout — screens, alerts, form hints, push
notification copy, and the bodies `pending_reminders()` composes in SQL. "Kasama" stays as
the product name.

---

## Data model

| Table | Purpose |
| --- | --- |
| `profiles` | One per auth user; display name and avatar |
| `households` | Name + unique 6-character invite code |
| `household_members` | Who is in which household, and their role |
| `bills` | Title, amount, category, due date, recurrence |
| `bill_splits` | Per-person share of a bill and whether it's settled |
| `chores` | Title, notes, recurrence |
| `chore_assignments` | Whose turn it is, when it's due, whether it's done |
| `announcements` | Household feed posts, whether they're pinned, and their tape colour |

One **Storage bucket**, `avatars`, is created by
`20260820020000_avatars_bucket.sql`. It's public — an avatar isn't a secret, and a public
bucket lets `profiles.avatar_url` hold a plain durable URL rather than one that has to be
signed on every render. Writes are locked to `<user-id>/…`, so "public" covers reading only.

**Row level security** is on for every table. Access is granted only to members of the
owning household, checked through `SECURITY DEFINER` helpers
(`is_household_member`, `is_household_admin`, `shares_household_with`) so the policy on
`household_members` doesn't recurse into itself.

Two flows deliberately run through database functions rather than direct writes:

- **Creating a household** — a trigger adds the creator as the first `admin`, which is also
  what lets `insert … returning` pass the select policy.
- **Joining a household** — `join_household_by_code(code)` resolves the invite code and
  inserts the membership. Users can't read (or add themselves to) a household they aren't
  in, so the code is the only way in.

### Push notifications

Kasama sends three kinds of push — a new bill you owe on, your turn on a chore, and (opt-in)
new board notes. The pieces:

| Piece | Where |
| --- | --- |
| Token storage + preferences | `20260820040000_push_notifications.sql` |
| Registration from the app | `src/lib/push.ts` |
| Sending | `supabase/functions/notify/` (Deno Edge Function) |
| Daily "due tomorrow" digest | `supabase/functions/daily-digest/` + `pending_reminders()` |

**Expo Go cannot receive push notifications.** Expo removed remote push from Expo Go in
SDK 53, on both platforms. The app detects this and disables the switches rather than asking
for a permission it can't use — but it means testing push needs a development build:

```bash
eas build --profile development --platform android
```

To deploy the sender:

```bash
supabase functions deploy notify
```

It needs no extra secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` are injected by the platform. The service role key is what lets
it read other people's device tokens, which is exactly why sending can't happen in the app —
`device_tokens` is readable only by its owner, so a housemate can't harvest tokens and buzz
people directly.

The function checks two things before sending: that the caller is signed in, and that they
belong to the household they're notifying. Without the second, anyone with a login could
notify any household whose id they could guess.

#### The daily digest

`daily-digest` sends one "this is due tomorrow" round. It's called by a scheduler rather
than a person, so it authenticates with a shared secret instead of a JWT:

```bash
supabase secrets set DIGEST_SECRET="$(openssl rand -hex 32)"
supabase functions deploy daily-digest
```

Test it without waiting a day — it accepts an explicit date:

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/daily-digest" \
  -H "x-digest-secret: <the secret>" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-08-21"}'
```

To run it every morning, enable `pg_cron` and `pg_net` (Database → Extensions) and schedule
it. This isn't a migration because it needs your project ref and secret:

```sql
select cron.schedule(
  'kasama-daily-digest',
  '0 22 * * *',                      -- 06:00 Manila, since cron runs in UTC
  $$
  select net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-digest-secret', '<the secret>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

Who gets a reminder is decided by `pending_reminders(date)` in SQL, where it can be tested;
how many notifications that becomes is decided in `_shared/push.ts`, likewise. Someone with
four bills due tomorrow gets one buzz naming all four, not four buzzes.

### Testing the database

The SQL that can't be checked by `tsc` — the `SECURITY DEFINER` functions and the rules they
enforce — has its own suite. It applies every migration to a throwaway local Postgres and
exercises the results:

```bash
npm run test:db                  # needs a local postgres you can create databases on
npm run test:functions           # pure logic behind the notify Edge Function
```

`supabase/tests/00_supabase_stubs.sql` stands in for the pieces plain Postgres doesn't have
(`auth.users`, `auth.uid()`, the Supabase roles, the realtime publication) so the real
migrations run unmodified. Three suites run today:

| File | Covers |
| --- | --- |
| `roll_recurring_bill_test.sql` | A partly paid bill doesn't roll; a settled one lands on the right date with the original payer and their share prepaid; re-settling is a no-op; non-members are refused; one-offs never roll; an undated recurring bill counts from today |
| `board_notes_test.sql` | `tape_color` rejects anything outside the palette tokens; a housemate can pin a note they didn't write but still can't edit it; pinned leads the feed and unpinning restores newest-first |
| `avatars_test.sql` | The bucket is public, capped at 2MB and images only; the upload path convention the storage policies depend on; writes are folder-scoped while reads aren't |
| `chore_streaks_test.sql` | Consecutive finished turns count; a turn due today doesn't break a run; a missed turn ends it and older wins don't carry over; an overdue turn reads as zero rather than as no row; the view is `security_invoker` |
| `push_tokens_test.sql` | A token registers to the signed-in user; handing a phone to a housemate moves the token rather than duplicating or silently failing; there is no insert/update policy, so registration is the only door; reads are owner-scoped; unknown platforms are refused; deleting a user takes their tokens |
| `pending_reminders_test.sql` | Only the person who still owes is reminded, with their own share quoted; settling stops it; a finished chore turn is skipped; an empty day produces nothing; housemates can't run it to enumerate each other's debts |

`npm run test:functions` covers the sending decisions — who gets skipped (the actor, anyone
who turned the category off, anyone with no device), Expo's 100-message batching, the rule
that only `DeviceNotRegistered` retires a token, and the digest's grouping (four bills due
tomorrow become one notification naming all four). The Edge Function's HTTP glue is
reviewed rather than executed: Deno isn't part of this toolchain, which is why the decisions
live in `logic.ts` where Node can test them.

### Regenerating types

`src/lib/database.types.ts` is written in the shape the Supabase generator emits, so it can
be replaced wholesale once your project is linked:

```bash
npx supabase gen types typescript --project-id <project-ref> > src/lib/database.types.ts
```

---

## Realtime

`src/hooks/useRealtime.ts` subscribes to Postgres changes and coalesces bursts into a single
silent refetch (adding a bill with four splits triggers one refresh, not five).

Parent tables are filtered server-side by `household_id`. Child tables (`bill_splits`,
`chore_assignments`) have no such column, so they're subscribed unfiltered — RLS already
limits the stream to the caller's household. The migration sets `replica identity full` on
those tables so Realtime can evaluate the policies against changed rows.

---

## Shipping to the App Store / Play Store

The app is EAS-ready (`eas.json` has `development`, `preview` and `production` profiles).
Remaining steps, none of which can be done from this repo alone:

1. **Set up EAS.**

   ```bash
   npm install -g eas-cli
   eas login
   eas init          # writes extra.eas.projectId into app.json
   ```

2. **Supply the Supabase env vars to builds.** Either fill in the empty `env` blocks in
   `eas.json`, or (preferred) create them as EAS environment variables:

   ```bash
   eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://… --environment production
   eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value … --environment production
   ```

3. **Replace the placeholder assets.** `assets/icon.png`, `assets/splash-icon.png` and the
   Android adaptive icon layers are still the Expo template art. Store review requires a
   1024×1024 icon with no transparency and no alpha channel.

4. **Confirm the bundle identifiers.** They're currently `com.kasama.app` for both
   platforms (`app.json`); change them before the first build, since they can't be changed
   after a store listing exists.

5. **Build.**

   ```bash
   eas build --profile preview  --platform android   # installable APK for testing
   eas build --profile production --platform all     # AAB + IPA for the stores
   ```

6. **iOS specifics.** An Apple Developer Program membership ($99/yr) is required. EAS can
   manage signing credentials for you. Fill in App Store Connect: app name, subtitle,
   privacy policy URL, screenshots (6.7" and 5.5" iPhone at minimum), and the App Privacy
   questionnaire — Kasama collects email, display name, and user-generated content, none of
   it used for tracking.

7. **Android specifics.** A one-time $25 Play Console registration. Provide a privacy
   policy URL, complete the Data Safety form (same disclosures as above), set the content
   rating, and upload the AAB to a testing track before promoting to production.

8. **Submit.**

   ```bash
   eas submit --platform ios
   eas submit --platform android
   ```

9. **Before launch, think about identity.** An anonymous session lives on one device, so a
   lost phone is a lost identity — see the note below. Review the anonymous sign-in rate
   limit while you're there.

### Known limitation: an identity lives on one device

There are no accounts. You give a display name, and the app opens an anonymous Supabase
session — a real `auth.users` row with no email and no password, which is what keeps
`auth.uid()` and every RLS policy working without anyone registering.

The cost is that the session is the identity. Reinstall the app, clear its storage, or move
to a new phone, and there is no password to sign back in with: you rejoin with a new invite
code, as a new person. Your old profile stays in the household with its share of the bills
attached to a name nobody can log in as.

That is a fair trade for a house of flatmates splitting the electricity, and a bad one for
money you would go to court over. The upgrade path, if it stops being fair, is
`supabase.auth.updateUser({ email })` on the existing anonymous user — it keeps the same
`auth.uid()`, so nothing in the schema moves, and the account gains a way back in.

### Known limitation: a share is all-or-nothing

`bill_splits.paid` is a boolean, so a housemate's share is either settled or it isn't.
"I'll give you half now and the rest on payday" has nowhere to go — the usual workaround is
marking it paid early, which quietly makes the ledger a record of promises rather than
payments.

Fixing it properly is a schema change with a wide blast radius: either an `amount_paid`
column alongside `amount_owed` with `paid` derived from it, or a `bill_payments` table with
one row per payment. Either way every money calculation moves —
`isBillSettled`, `billOutstanding`, `billProgress`, `summariseBalance`, `settleUp`,
`fetchLedger` and `pending_reminders` — plus the tick-box on the bill detail screen becomes
an amount entry. It hasn't been done because it is a product decision, not an oversight:
plenty of split apps keep shares atomic on purpose.

### Nice-to-haves not built yet

- A design pass over onboarding, settings and the auth screens (see *Not yet designed*)
- Partial payments (see above)
- Comments or reactions on board notes — the board is post-and-read today
