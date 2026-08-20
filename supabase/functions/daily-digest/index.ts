// Edge Function: the once-a-day "this is due tomorrow" digest.
//
// Called by a scheduler, not by a person, so it authenticates with a shared
// secret rather than a user JWT. Everything it could possibly leak — who owes
// what — comes from `public.pending_reminders`, which is granted to the
// service role only.
//
// The rules about *who* gets nagged live in that SQL function, and the rules
// about *how many* buzzes that turns into live in ../_shared/push.ts. Both are
// tested. What's here is the wiring.
//
// Deploy:   supabase functions deploy daily-digest
// Schedule: see the README — pg_cron plus pg_net, or any external scheduler
//           that can POST with the x-digest-secret header.
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  chunk,
  deliverableNotices,
  summariseReminders,
  tokensToRetire,
  type Candidate,
  type ExpoTicket,
  type PushMessage,
  type Reminder,
} from '../_shared/push.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  const secret = Deno.env.get('DIGEST_SECRET');
  if (!secret) return json({ error: 'DIGEST_SECRET is not configured' }, 500);
  if (request.headers.get('x-digest-secret') !== secret) {
    return json({ error: 'Forbidden' }, 403);
  }

  // Defaults to tomorrow; an explicit date makes the thing testable by hand
  // without waiting a day to find out whether it works.
  let targetDate: string;
  try {
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    targetDate =
      (body as { date?: string }).date ??
      new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );

  const { data: reminders, error } = await admin.rpc('pending_reminders', {
    target_date: targetDate,
  });
  if (error) return json({ error: error.message }, 500);

  const rows = (reminders ?? []) as Reminder[];
  if (rows.length === 0) return json({ date: targetDate, sent: 0, retired: 0 });

  const userIds = [...new Set(rows.map((row) => row.user_id))];

  const [{ data: profiles }, { data: tokens }] = await Promise.all([
    admin.from('profiles').select('id, push_bills, push_chores, push_board').in('id', userIds),
    admin.from('device_tokens').select('user_id, token').in('user_id', userIds),
  ]);

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokens ?? []) {
    tokensByUser.set(row.user_id, [...(tokensByUser.get(row.user_id) ?? []), row.token]);
  }

  const candidates = new Map<string, Candidate>(
    (profiles ?? []).map((profile) => [
      profile.id,
      {
        userId: profile.id,
        tokens: tokensByUser.get(profile.id) ?? [],
        preferences: {
          push_bills: profile.push_bills,
          push_chores: profile.push_chores,
          push_board: profile.push_board,
        },
      },
    ])
  );

  const messages: PushMessage[] = deliverableNotices(
    summariseReminders(rows),
    candidates
  ).flatMap(({ notice, tokens: deviceTokens }) =>
    deviceTokens.map((token) => ({
      to: token,
      title: notice.title,
      body: notice.body,
      data: { screen: notice.category },
      sound: 'default' as const,
      channelId: notice.category,
    }))
  );

  if (messages.length === 0) return json({ date: targetDate, sent: 0, retired: 0 });

  const dead: string[] = [];
  let sent = 0;

  for (const batch of chunk(messages)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      console.error('expo push failed', response.status, await response.text());
      continue;
    }

    const { data: tickets } = (await response.json()) as { data: ExpoTicket[] };
    sent += batch.length;
    dead.push(...tokensToRetire(batch, tickets ?? []));
  }

  if (dead.length > 0) {
    await admin.from('device_tokens').delete().in('token', dead);
  }

  return json({ date: targetDate, sent, retired: dead.length });
});
