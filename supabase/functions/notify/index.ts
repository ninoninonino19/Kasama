// Edge Function: send a push notification to a household.
//
// Sending has to happen here rather than from the app. A push token is a
// capability — anyone holding it can buzz that phone — so `device_tokens` is
// readable only by its owner, and the service role key that can read everyone
// else's must never ship inside the client. The app asks this function to send;
// the function decides whether it may.
//
// Everything worth arguing about lives in ../_shared/push.ts, covered by
// `npm run test:functions`. What's left here is request parsing, two
// authorisation checks and the call to Expo.
//
// Deploy:  supabase functions deploy notify
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  buildMessages,
  chunk,
  selectRecipients,
  tokensToRetire,
  type Candidate,
  type Category,
  type ExpoTicket,
} from '../_shared/push.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CATEGORIES: Category[] = ['bills', 'chores', 'board'];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

type Payload = {
  householdId?: string;
  category?: Category;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  /** Narrows delivery to specific housemates — the people a bill concerns. */
  only?: string[] | null;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Missing Authorization header' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Acting as the caller, so their own RLS decides what they can see.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: authError,
  } = await asCaller.auth.getUser();
  if (authError || !user) return json({ error: 'Not signed in' }, 401);

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  const { householdId, category, title, body } = payload;
  if (!householdId || !title || !body) {
    return json({ error: 'householdId, title and body are required' }, 400);
  }
  if (!category || !CATEGORIES.includes(category)) {
    return json({ error: `category must be one of ${CATEGORIES.join(', ')}` }, 400);
  }

  // Authorisation, not decoration: without this anyone with a valid login
  // could notify any household whose id they could guess.
  const { data: membership } = await asCaller
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return json({ error: 'Not a member of this household' }, 403);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: members, error: membersError } = await admin
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId);
  if (membersError) return json({ error: membersError.message }, 500);

  const memberIds = (members ?? []).map((member) => member.user_id);
  if (memberIds.length === 0) return json({ sent: 0, retired: 0 });

  const [{ data: profiles }, { data: tokens }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, push_bills, push_chores, push_board')
      .in('id', memberIds),
    admin.from('device_tokens').select('user_id, token').in('user_id', memberIds),
  ]);

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokens ?? []) {
    tokensByUser.set(row.user_id, [...(tokensByUser.get(row.user_id) ?? []), row.token]);
  }

  const candidates: Candidate[] = (profiles ?? []).map((profile) => ({
    userId: profile.id,
    tokens: tokensByUser.get(profile.id) ?? [],
    preferences: {
      push_bills: profile.push_bills,
      push_chores: profile.push_chores,
      push_board: profile.push_board,
    },
  }));

  const messages = buildMessages(
    selectRecipients(candidates, category, user.id, payload.only),
    { title, body, data: payload.data },
    category
  );

  if (messages.length === 0) return json({ sent: 0, retired: 0 });

  const dead: string[] = [];
  let sent = 0;

  for (const batch of chunk(messages)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      // One bad batch shouldn't cost the rest; report it and carry on.
      console.error('expo push failed', response.status, await response.text());
      continue;
    }

    const { data: tickets } = (await response.json()) as { data: ExpoTicket[] };
    sent += batch.length;
    dead.push(...tokensToRetire(batch, tickets ?? []));
  }

  // Tokens Expo says are gone, so we stop paying to retry them forever.
  if (dead.length > 0) {
    await admin.from('device_tokens').delete().in('token', dead);
  }

  return json({ sent, retired: dead.length });
});
