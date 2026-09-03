# Running on iOS, locally

The [releasing doc](releasing.md) covers the App Store. This is the other thing — getting
Kasama onto an iPhone or a simulator for your own use, without a store listing and, on the
first route, without paying Apple anything.

Kasama has no `ios/` folder. It is a managed Expo project with continuous native generation:
the Xcode project is generated on demand and `/ios` is gitignored, so nothing below leaves a
trace in the repository.

| Route | Needs | Install lasts | Push works |
| --- | --- | --- | --- |
| [Expo Go](#1-expo-go-on-your-iphone) | An iPhone | While Metro is running | No |
| [Simulator](#2-the-ios-simulator) | A Mac with Xcode | — | No |
| [Free-team sideload](#3-a-build-installed-on-the-phone) | A Mac, any Apple ID | 7 days | No |
| [EAS ad hoc](#3-a-build-installed-on-the-phone) | $99/yr Apple Developer | 1 year | Yes |

Push is the line down the middle of that table, and it isn't Kasama's doing: Expo Go dropped
remote push in SDK 53, and a free Apple team cannot hold the `aps-environment` entitlement at
all. Everything else in the app — bills, chores, the board, the image picker, haptics —
runs on every route.

## 1. Expo Go on your iPhone

The everyday route, and the reason the Expo packages are pinned to SDK 54: Expo Go supports
one SDK at a time, so the pin is what keeps the phone able to open this project. No Mac, no
Apple Developer account, nothing to install but the app.

```bash
npm install
cp .env.example .env      # fill in the two EXPO_PUBLIC_SUPABASE_* values
npx expo start --go
```

Install **Expo Go** from the App Store, then scan the QR code with the **Camera app**. Expo
Go on iOS has no scanner of its own any more — scanning from inside it is the step people
look for and don't find.

`--go` is the part that matters. `expo-dev-client` is installed, so a bare `expo start`
targets a development build and offers you a phone that hasn't got one; press **s** to
switch targets at any time.

Two things that are Android-only, despite reading like general commands:

- **`npm run go` and `npm run usb` will not work here.** Both begin with `adb reverse`, which
  fails on the spot without the Android platform tools. There is no USB equivalent for iOS
  in the Expo CLI — the phone and the computer talk over the network or not at all.
- The `ANDROID_HOME` advice in [Development](development.md#running-over-usb-npm-run-go-npm-run-usb)
  is about that same cable and doesn't apply.

So the phone and the computer have to be on the same Wi-Fi, and dorm and café networks often
isolate clients from each other, which looks like the QR code scanning forever. When that
happens:

```bash
npm run tunnel        # expo start --tunnel — routed over the internet, works anywhere
```

Add `--go` to that too if the CLI last targeted a development build.

## 2. The iOS Simulator

A Mac with Xcode installed, and:

```bash
npm run ios           # or press i in the Metro terminal
```

The fastest loop for UI work, and the only route where the whole thing lives on one machine.
Simulators can't receive push — there's no APNs token to mint — so `registerForPush()`
returns `unsupported` there as well.

If you'd rather not have Xcode build it locally, EAS can produce a simulator build with no
Apple account at all. Add a profile to `eas.json`:

```json
"simulator": {
  "developmentClient": true,
  "distribution": "internal",
  "environment": "development",
  "ios": { "simulator": true }
}
```

`eas build --profile simulator --platform ios` then hands back a `.app` to drag onto a
running simulator.

## 3. A build installed on the phone

Both of these give you an icon on the home screen that opens without Metro attached. They
differ in what Apple charges and how long the install survives.

### Free Apple ID, 7 days

Needs a Mac.

```bash
npx expo prebuild -p ios
npx expo run:ios --device
```

Open `ios/Kasama.xcworkspace` once and set **Signing & Capabilities → Team** to your personal
team. Then: the app stops launching after **7 days** (re-run the command to reinstall), you
get three sideloaded apps at a time, and push is unavailable — a personal team has no APNs
entitlement to grant. `prebuild` writes the gitignored `ios/` folder; delete it to go back to
a clean managed project.

### Apple Developer Program, a year, with push

No Mac needed — EAS builds on its own macOS workers, so this route works from Linux or
Windows.

```bash
npm install -g eas-cli
eas login
eas init                      # writes extra.eas.projectId into app.json
eas device:create             # registers your iPhone's UDID in the ad hoc profile
```

Give the build the Supabase values. `.env` is gitignored and an EAS build never sees it, so
they have to be registered once:

```bash
eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://<project-ref>.supabase.co \
  --environment development --environment preview \
  --visibility plaintext --non-interactive
eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon public key> \
  --environment development --environment preview \
  --visibility plaintext --non-interactive
```

Then build one of the two profiles already in `eas.json`:

```bash
eas build --profile development --platform ios   # dev client — code reloads from Metro
eas build --profile preview     --platform ios   # standalone — runs with nothing attached
```

EAS prints a link and a QR code; opening it on the registered iPhone installs the app over
the air. With the development build, `npx expo start --dev-client` connects to it. (The
`buildType: apk` under `preview` is Android-only and ignored here.)

`eas init` is worth doing even if you never build: `registerForPush()` reads
`extra.eas.projectId` to mint a push token, so push stays dead in any build without it. The
APNs key itself EAS will generate and upload for you during the first iOS build, if you let
it manage credentials.

## When it doesn't work

- **"No development build (com.kasama.app) for this project is installed"** — the CLI is
  targeting a dev build and the phone only has Expo Go. Press **s**, or start with `--go`.
- **The QR code scans forever.** The network, nine times out of ten. `npm run tunnel`.
- **Expo Go opens and immediately errors about the SDK version.** Expo Go has moved past
  SDK 54; see [Development](development.md#troubleshooting-expo-go-on-android) for what
  upgrading the project involves.
- **The app comes up on the setup notice.** It has no Supabase values: `.env` for local runs
  (restart with `npx expo start --clear`, since env is baked in at bundle time), `eas env:set`
  for builds.
- **The notification switches are greyed out.** Expected on every route but the last one.
