# Push notifications

Kasama sends three kinds of push — a new bill you owe on, your turn on a chore, and (opt-in)
new board notes. The pieces:

| Piece | Where |
| --- | --- |
| Token storage + preferences | `20260820040000_push_notifications.sql` |
| Registration from the app | `src/lib/push.ts` |
| Sending | `supabase/functions/notify/` (Deno Edge Function) |
| Daily "due tomorrow" digest | `supabase/functions/daily-digest/` + `pending_reminders()` |
| Where a tap lands | `routeForNotification()` in `src/lib/push.ts`, applied by `useNotificationRouting()` |

Every notification carries a `data` payload naming what it is about, and tapping one opens
that: the bill, the rota, the board. A tap that launched the app cold waits for the
household to load before it navigates, so it lands on the bill rather than over the welcome
screen. Notifications arriving while the app is open are shown as a banner — without a
handler expo-notifications drops those silently, and there is no second delivery.

**Expo Go cannot receive push notifications.** Expo removed remote push from Expo Go in
SDK 53, on both platforms. The app detects this and disables the switches rather than asking
for a permission it can't use — but it means testing push, including what a tapped
notification opens, needs a development build:

```bash
eas build --profile development --platform android
```

Install the APK it produces, then `npm start` and open it from there. The build reads the
Supabase values from EAS, not from `.env`, so run the `eas env:set` commands in the
[README](../README.md#3-point-the-app-at-your-project) first, or it will come up on the
setup notice.

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

## The daily digest

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
