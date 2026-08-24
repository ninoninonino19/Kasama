# Google Play Store listing — draft copy

Paste these into Play Console → your app → Grow → Store presence → Main store listing.
Edit freely; these are a starting draft, not final copy.

## App name
Kasama

## Short description (max 80 characters)
Split bills, rotate chores, and share announcements with your housemates.

(75 characters)

## Full description (max 4000 characters)

Kasama (Filipino for "companion / housemate") is a shared-living app for boarding house,
dorm and apartment roommates. One household, one place to track the bills, the chores and
the announcements — synced live across everyone's phone.

SPLIT BILLS
Add rent, electricity, water, WiFi or grocery bills and split them across your housemates.
See who still owes what, and settle up as it's paid.

ROTATE CHORES
Set up recurring chores and rotate who's on the hook each turn. Tick them off as they're
done.

SHARE ANNOUNCEMENTS
Post short updates to your household's feed — attach a photo of a receipt so everyone can
check the total before it becomes a bill.

BUILT FOR HOUSEHOLDS, NOT INDIVIDUALS
Join a household with an invite code. Leaving is something the household agrees to, with
what you owe on the table.

PRIVATE TO YOUR HOUSEHOLD
No public feed, no ads, no tracking. Everything you post is visible only to the people in
your household.

No account, email or password needed — just a display name to get started.

## Category
Lifestyle (or House & Home, if available in your region)

## Tags / keywords
roommates, housemates, shared living, dorm, bill splitting, chores, apartment, boarding
house

## Content rating (Play Console questionnaire)
Expect "Everyone" / PEGI 3 — no violence, no user-to-user public chat (household-only,
invite-gated), no gambling, no user-generated public content visible outside the
household.

## Data Safety form
Matches `docs/privacy-policy.html`:
- Collected: a display name you choose, a profile photo (optional), content you post
  (bills, chores, announcements, receipt photos), a push-notification token.
- Not collected: email, phone number, precise/approximate location, financial account
  numbers (bill *amounts* you type in are user content, not linked payment data),
  advertising ID.
- Purpose: app functionality only. Nothing shared with third parties, nothing sold, no
  analytics/advertising SDKs.
- Data is encrypted in transit (HTTPS to Supabase). Users can request deletion — see the
  privacy policy contact.

## Screenshots
Play Console requires at least 2 phone screenshots (16:9 or 9:16, JPEG/PNG, 320–3840px on
the short side). Not yet produced — capture from a `preview` build:

```bash
eas build --profile preview --platform android
```

Good candidates: the home board, a bill's split view, the chores tab, and the invite
screen.

## Feature graphic
1024×500 PNG/JPEG, required for the store listing header. Not yet produced.

## Privacy policy URL
Host `docs/privacy-policy.html` somewhere public (e.g. GitHub Pages — see the README's
*Shipping to Google Play* section) and paste that URL into Play Console → App content →
Privacy policy.
