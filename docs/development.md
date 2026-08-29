# Development

The long versions of the things the README keeps short: getting a phone connected,
resetting the data behind the app, and the test suites.

## Which client `expo start` targets

`expo-dev-client` is installed, so `expo start` targets a development build unless told
otherwise, and pressing `a` then fails with *"No development build (com.kasama.app) for
this project is installed"* on a phone that only has Expo Go. The `--go` in `npm run go`
pins Expo Go instead, which is worth having as its own command because the CLI remembers
the last target across runs — so the mode you get is otherwise a matter of what you did
yesterday. Press **s** at any time to switch between the two.

## Running over USB (`npm run go`, `npm run usb`)

When the phone and the computer can't reach each other over the network — a wired desktop
and a wireless phone, a router that isolates clients, a firewall — plug the phone in
instead. It sidesteps the network completely and is worth defaulting to:

1. Phone: **Settings → About phone →** tap *Build number* seven times, then
   **Developer options → USB debugging** on.
2. Install **Android SDK Platform Tools** — the standalone download is enough, Android
   Studio is not needed — and set `ANDROID_HOME` to the folder *containing* the
   `platform-tools` directory (not to `platform-tools` itself). *Open a new terminal
   afterwards*: environment changes don't reach terminals already running, and an editor's
   integrated terminal may have inherited the old environment when it started.

   `ANDROID_HOME` rather than `PATH` alone, because `PATH` is Expo's fallback rather than
   its lookup: it builds `<sdk root>/platform-tools/adb` and only spawns a bare `adb` when
   no SDK root resolves at all. Both ways of getting that wrong end in
   `Error: The system cannot find the path specified` from `cross-spawn` while `adb devices`
   keeps working in your shell — either Expo never saw your `PATH`, or it resolved a root
   with no `adb.exe` under it. On Windows the root it settles for by default is
   `%LOCALAPPDATA%\Android\Sdk`, accepted merely for existing, which is why a machine that
   once had Android Studio can fail this way while a machine that never did falls through to
   `PATH` and works.

   A wrong `ANDROID_HOME` is the safe kind of wrong: Expo warns and falls back to `PATH`.
3. Plug in, accept *Allow USB debugging?*, check `adb devices` lists the phone.
4. `npm run go`, then press `a`. (`npm run usb` is the same command without `--go`, for
   when the development build is what you want on the phone.)

`--host localhost` is the part that isn't obvious. `adb reverse` gets Expo Go's *first*
request through, so the connection looks fine — but Metro's reply carries a `bundleUrl`
built from whatever host it advertises. Left on the LAN address, the phone fetches the
manifest over USB and then tries to fetch the JavaScript from an IP it can't reach, failing
with **"Failed to download remote update"** while every check on the computer looks healthy.
`--host localhost` writes `127.0.0.1` into that reply instead, which the USB tunnel carries.

The mapping doesn't survive unplugging or a phone reboot. Both scripts re-add it every
time, so just run one again.

## Troubleshooting Expo Go on Android

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
`npm run go` (above) or:

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

## Starting over with fresh data

Two scripts, and most of the time you want the first:

| | What it does | When |
| --- | --- | --- |
| `supabase/reset_data.sql` | Deletes every household, bill, chore, note, leave request and account. Schema, policies and functions stay | "Give me a clean household to test with" |
| `supabase/reset.sql` | Drops every table, view, function and enum the app owns, so the migrations can be replayed from nothing | The schema itself is wrong |

```bash
psql "$DATABASE_URL" -f supabase/reset_data.sql     # data only
node supabase/reset_storage.mjs                     # the files behind it
```

Both scripts end in a check query — counts that should read zero, or a list of
objects that should be empty — because a reset that half-worked looks exactly like one that
worked.

Uploaded files are cleared separately, by `reset_storage.mjs`. Storage objects are rows
pointing at files, so Supabase blocks `delete from storage.objects` outright: the row would
go and the file would be stranded. That script walks both buckets through the Storage API
instead, and needs the **service role key** — the anon key can only delete your own folder.
Pass a bucket name (`node supabase/reset_storage.mjs receipts`) to clear just one.

After a data reset, log out on the device or reinstall: the stored session points at a user
that no longer exists, and the app will sit on a signed-in screen with nothing behind it.

## Testing the database

The SQL that can't be checked by `tsc` — the `SECURITY DEFINER` functions and the rules they
enforce — has its own suite. It applies every migration to a throwaway local Postgres and
exercises the results:

```bash
npm run test:db                  # needs a local postgres you can create databases on
npm run test:functions           # pure logic behind the notify Edge Function
```

`supabase/tests/00_supabase_stubs.sql` stands in for the pieces plain Postgres doesn't have
(`auth.users`, `auth.uid()`, the Supabase roles, the realtime publication) so the real
migrations run unmodified. Eight suites run today:

| File | Covers |
| --- | --- |
| `roll_recurring_bill_test.sql` | A partly paid bill doesn't roll; a settled one lands on the right date with the original collector and *nobody's* share prepaid; re-settling is a no-op; non-members are refused; one-offs never roll; an undated recurring bill counts from today; a housemate who has left is dropped from the next occurrence and their open chore turn moves on |
| `board_notes_test.sql` | `tape_color` rejects anything outside the palette tokens; a housemate can pin a note they didn't write but still can't edit it; pinned leads the feed and unpinning restores newest-first |
| `avatars_test.sql` | The bucket is public, capped at 2MB and images only; the upload path convention the storage policies depend on; writes are folder-scoped while reads aren't |
| `chore_streaks_test.sql` | Consecutive finished turns count; a turn due today doesn't break a run; a missed turn ends it and older wins don't carry over; an overdue turn reads as zero rather than as no row; the view is `security_invoker` |
| `push_tokens_test.sql` | A token registers to the signed-in user; handing a phone to a housemate moves the token rather than duplicating or silently failing; there is no insert/update policy, so registration is the only door; reads are owner-scoped; unknown platforms are refused; deleting a user takes their tokens |
| `pending_reminders_test.sql` | Only the person who still owes is reminded, with their own share quoted; settling stops it; a finished chore turn is skipped; an empty day produces nothing; housemates can't run it to enumerate each other's debts |
| `leave_requests_test.sql` | You can't vote on your own departure and outsiders can't vote at all; asking twice returns the open request; one accept isn't enough and one decline ends it, with its reason kept; unanimity removes them and moves their open chore turn; withdrawing is open to the leaver and to an admin; the last person in a household doesn't wait for a vote; removing the last undecided voter completes the request; the tables have no write policies |
| `board_receipts_test.sql` | The bucket is private, capped at 6MB and images only; `<household>/<user>/<file>` resolves to both halves and a malformed path denies rather than throws; reads are household-scoped; uploads must land in your own folder inside your own house; the note stores a path rather than a signed URL |

`npm run test:functions` covers the sending decisions — who gets skipped (the actor, anyone
who turned the category off, anyone with no device), Expo's 100-message batching, the rule
that only `DeviceNotRegistered` retires a token, and the digest's grouping (four bills due
tomorrow become one notification naming all four). The Edge Function's HTTP glue is
reviewed rather than executed: Deno isn't part of this toolchain, which is why the decisions
live in `logic.ts` where Node can test them.

## Regenerating types

`src/lib/database.types.ts` is written in the shape the Supabase generator emits, so it can
be replaced wholesale once your project is linked:

```bash
npx supabase gen types typescript --project-id <project-ref> > src/lib/database.types.ts
```
