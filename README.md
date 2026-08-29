# Kasama

**Kasama** (Filipino for *companion / housemate*) is a shared-living app for boarding house,
dorm and apartment roommates. One household, one place to track the bills, the chores and
the announcements.

- **Bills** — split renta, kuryente, tubig, WiFi or grocery across the house and see who
  still owes what, with a running payment history
- **Chores** — set up a rotation and tick turns off as they come round
- **Board** — short announcements to the household feed, with a photo of the receipt so the
  house can check a total before it becomes a bill
- **Leaving** — moving out is something the household agrees to, with what you still owe on
  the table
- Everything syncs live across everyone's phone

There are no accounts and no passwords. You give a display name, the app opens an anonymous
session, and an invite code is the door into a household.

Built with Expo (React Native) + TypeScript, NativeWind and Supabase — one codebase for iOS
and Android.

| Concern | Choice |
| --- | --- |
| App framework | Expo SDK 54 + React Native 0.81, TypeScript |
| Navigation | Expo Router (file-based, typed routes) |
| Styling | NativeWind v4 (Tailwind CSS v3) |
| Backend | Supabase — Postgres, Auth (anonymous sessions), Realtime |
| Client state | Zustand |
| Builds | EAS Build (`eas.json`) |

---

## Running it

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

3. **Auth → Providers → Anonymous sign-ins**: turn this **on**. It is the only way into the
   app — leave it off and the welcome screen answers every name with *"anonymous sign-ins are
   disabled"*. Email/password can stay off. (Running locally with the CLI, the same switch is
   `enable_anonymous_sign_ins` in `supabase/config.toml`, already on there.)
4. **Database → Replication**: the migrations already add the app tables to the
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

Both are safe to ship in the client — row level security is what protects the data. Env
changes are baked in at bundle time, so restart with a cleared cache after editing:
`npx expo start --clear`.

`.env` is gitignored, so an EAS build never sees it. Register the two variables with EAS once
and every profile picks them up:

```bash
eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://<project-ref>.supabase.co \
  --environment development --environment preview --environment production \
  --visibility plaintext --non-interactive
eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon public key> \
  --environment development --environment preview --environment production \
  --visibility plaintext --non-interactive
```

### 4. Start it

```bash
npm start          # then scan the QR code
npm run go         # Expo Go over a USB cable — the everyday one
npm run usb        # same, but whichever target the CLI last used
npm run tunnel     # routed over the internet, works from any network
npm run android
npm run ios
npm run web        # handy for quick UI checks
```

`expo-dev-client` is installed, so `expo start` targets a development build unless told
otherwise. `npm run go` pins Expo Go instead; press **s** at any time to switch between the
two. Expo Go runs everything here except push notifications, which it cannot receive at all —
testing those needs `eas build --profile development --platform android`.

Checks:

```bash
npm run typecheck  # tsc --noEmit
npm run lint
```

### If the phone won't connect

Almost always one of three things:

- **Expo Go is a different SDK version.** This project is pinned to **SDK 54** to match what
  Expo Go currently ships. Don't bump the Expo packages without checking the phone first.
- **The phone can't reach your computer.** Metro serves over the local network, and many
  dorm, campus and café networks block devices from talking to each other. Route around it
  with `npm run go` (USB cable — needs USB debugging on and `ANDROID_HOME` pointing at the
  folder *containing* `platform-tools`) or `npm run tunnel`.
- **A firewall is blocking port 8081.** Allow Node through it, or use the tunnel.

`npx expo start --clear` clears a stale Metro cache. The error shown *on the phone* is the
useful one — it names which of the three you're hitting.

---

## Using it

### Getting the house in

1. **Pick a display name** on the welcome screen. That opens your session — no email, no
   password, nothing to remember.
2. **Create a household**, or **join one** with a 6-character invite code.
3. Creating one lands you straight on the invite screen with your code. Send it to your
   housemates — the code is the entire access model, and a household of one is a dead app.
   You can find it again any time under **Settings → Household**.

### Home

Where you stand at a glance: what you owe and are owed, what's next in the rota, the latest
note on the board, and a housemates row that nudges you to invite people while it's just you.
Quick actions for adding a bill or a chore sit on the same screen.

### Bills

Add a bill (name, amount, due date) and split it across the house — evenly or unevenly.
Opening a bill shows the per-person breakdown; tap a person to flip their share between paid
and unpaid, or **mark everyone as paid** in one go. **Payment history** keeps the ledger of
what's been settled, month by month, including the "I already paid you for that" corrections
between two people. Overdue bills raise a count on the Bills tab.

### Chores

Add a chore with a rotation and the app tracks whose turn it is, so nobody has to. The tab
shows what falls today, with the whole week a tap away, and turns tick off as they're done.

### Board

Short notes to the house — "water's out until 3pm", a photo of the grocery receipt before it
becomes a bill. The Board tab carries a plain dot (not a count — a house board isn't an
inbox) when a housemate has posted since this device last had it open.

### Notifications

Three kinds of push: a new bill you owe on, your turn on a chore, and — opt-in — new board
notes. There's also a daily "due tomorrow" digest. Tapping a notification opens the thing it
is about: the bill, the rota, the board. Switches live under **Settings → Account**, and are
disabled in Expo Go, which can't receive push at all.

### Moving out

**Leaving a household is a request, not a delete.** Every remaining housemate accepts, or one
declines and says why — and each of them sees what the leaver still owes, what the house owes
the leaver, and what sits between the two of them specifically. An accept stays changeable
until the request resolves, so "not until you pay me back" is a position rather than a veto.
An admin can cancel a request, and the last person in a household has nobody to ask, so
theirs completes immediately.

The app never blocks a leave over an unpaid bill — housemates forgive debts and settle in
cash the app never sees. It just makes sure the house is asked. When a membership ends,
unpaid shares are redistributed among the housemates still here, open chore turns are dealt
round-robin from whoever is next in the rotation, and everything already paid or done stays
exactly as it is.

**Signing out is moving out.** With no password, a session *is* the identity — there's no way
back into it, so signing out ends your memberships outright and hands what you owe to the
house.
