# Shipping to the App Store / Play Store

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
   eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://… --environment production \
     --visibility plaintext --non-interactive
   eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value … --environment production \
     --visibility plaintext --non-interactive
   ```

   `env:set`, not `env:create` — that command was renamed, and the old name now falls
   through to an interactive wizard that asks for everything over again, flags or not.
   `--non-interactive` is what actually holds it to the flags you passed.

   They live in EAS rather than in `eas.json` on purpose. This repository is public, and
   while the anon key is safe by design — it ships inside the APK either way — a key sitting
   in a public file is a key that gets scraped and used against your project's rate limits,
   and rotating one that is committed means a code change rather than a command. Use
   `eas env:list` to check what a build will see.

3. **Icon and splash are already done.** `assets/icon.png`, `assets/splash-icon.png` and the
   Android adaptive icon layers are Kasama's own mark — see [The mark](design-system.md#the-mark) — not the Expo
   template art. `icon.png` is already opaque, full-bleed and 1024×1024, which is what store
   review requires. Re-run `python3 tools/generate-icons.py` only if the palette or the
   geometry changes.

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
   lost phone is a lost identity — see [Known limitations](limitations.md). Review the anonymous sign-in rate
   limit while you're there.
