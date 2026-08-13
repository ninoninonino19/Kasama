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
| Backend | Supabase — Postgres, Auth (email/password), Realtime |
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
2. Run the migration in `supabase/migrations/20260813000000_init.sql` against it — either
   paste it into the SQL editor, or use the CLI:

   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

3. **Auth → Providers → Email**: enable email/password. For a smoother first run, turn
   *Confirm email* off (with it on, users must confirm before they can log in — the sign-up
   screen handles both cases).
4. **Database → Replication**: the migration already adds the app tables to the
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
npm run tunnel     # same, but routed over the internet — see below
npm run android
npm run ios
npm run web        # handy for quick UI checks
```

Useful checks:

```bash
npm run typecheck  # tsc --noEmit
```

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
forever and timing out. Route around it:

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
  index.tsx                 # entry redirect (auth → onboarding → tabs)
  auth/                     # sign-in, sign-up
  onboarding/               # create a household, or join with an invite code
  (tabs)/                   # Home, Bills, Chores, Feed
  bills/new.tsx, [id].tsx   # add a bill, per-person split detail
  chores/new.tsx            # add a chore
  settings.tsx              # household, members, invite code, leave / log out
src/
  api/                      # Supabase queries, grouped by feature
  components/ui/            # Button, Card, TextField, Avatar, states…
  hooks/                    # useAsyncData, useRealtime, useHouseholdData
  lib/                      # supabase client, formatting, categories, DB types
  providers/                # SessionProvider (auth + household bootstrap)
  store/                    # Zustand session store
supabase/migrations/        # schema + RLS + realtime setup
```

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
| `announcements` | Household feed posts |

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

9. **Before launch, harden auth.** Turn *Confirm email* back on in Supabase, add your app's
   redirect URLs, and consider rate limiting on the auth endpoints.

### Nice-to-haves not built yet

- Push notifications for due bills and chore turns (`expo-notifications`)
- Avatar uploads via Supabase Storage
- Automatic generation of the next recurring *bill* (chores already rotate on completion)
- Settlement history / "who paid whom" ledger
