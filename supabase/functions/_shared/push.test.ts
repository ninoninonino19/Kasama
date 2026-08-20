import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMessages, chunk, selectRecipients, tokensToRetire } from './push.ts';

const prefs = (over = {}) => ({
  push_bills: true,
  push_chores: true,
  push_board: false,
  ...over,
});

const ana = { userId: 'ana', tokens: ['t-ana'], preferences: prefs() };
const boy = { userId: 'boy', tokens: ['t-boy-1', 't-boy-2'], preferences: prefs() };
const cel = { userId: 'cel', tokens: ['t-cel'], preferences: prefs({ push_bills: false }) };
const dee = { userId: 'dee', tokens: [], preferences: prefs() };

test('the person who caused the event is never notified about it', () => {
  const picked = selectRecipients([ana, boy], 'bills', 'ana');
  assert.deepEqual(picked.map((r) => r.userId), ['boy']);
});

test('a category someone switched off is respected', () => {
  const picked = selectRecipients([boy, cel], 'bills', 'ana');
  assert.deepEqual(picked.map((r) => r.userId), ['boy']);
});

test('board notes are opt-in, so nobody gets them by default', () => {
  assert.deepEqual(selectRecipients([ana, boy], 'board', 'someone-else'), []);
  const optedIn = { ...ana, preferences: prefs({ push_board: true }) };
  assert.deepEqual(
    selectRecipients([optedIn, boy], 'board', 'someone-else').map((r) => r.userId),
    ['ana']
  );
});

test('a housemate with no registered device is skipped', () => {
  assert.deepEqual(selectRecipients([dee], 'chores', 'ana'), []);
});

test('`only` narrows to the people a bill actually concerns', () => {
  const picked = selectRecipients([ana, boy, cel], 'bills', 'zzz', ['boy']);
  assert.deepEqual(picked.map((r) => r.userId), ['boy']);
});

test('an empty `only` list means everyone, not nobody', () => {
  // A bill split with nobody selected shouldn't silently mean "notify all",
  // but an *absent* filter must not be confused with an empty one.
  assert.equal(selectRecipients([ana, boy], 'bills', 'zzz', []).length, 2);
  assert.equal(selectRecipients([ana, boy], 'bills', 'zzz', null).length, 2);
});

test('one message per device, not per person', () => {
  const messages = buildMessages([boy], { title: 'T', body: 'B' }, 'bills');
  assert.deepEqual(messages.map((m) => m.to), ['t-boy-1', 't-boy-2']);
  assert.equal(messages[0].channelId, 'bills');
  assert.equal(messages[0].sound, 'default');
});

test('messages are chunked to Expo’s limit of 100', () => {
  const many = Array.from({ length: 250 }, (_, i) => i);
  const chunks = chunk(many);
  assert.deepEqual(chunks.map((c) => c.length), [100, 100, 50]);
  assert.deepEqual(chunks.flat(), many);
});

test('chunking an empty list produces no requests at all', () => {
  assert.deepEqual(chunk([]), []);
});

test('only DeviceNotRegistered retires a token', () => {
  const sent = buildMessages([ana, boy], { title: 'T', body: 'B' }, 'bills');
  const tickets = [
    { status: 'ok' as const },
    { status: 'error' as const, details: { error: 'DeviceNotRegistered' } },
    { status: 'error' as const, details: { error: 'MessageRateExceeded' } },
  ];
  // A rate-limited send is our problem, not a dead device — retiring on it
  // would quietly unsubscribe people because of a bug on our side.
  assert.deepEqual(tokensToRetire(sent, tickets), ['t-boy-1']);
});

test('a short ticket list never invents a token to delete', () => {
  const sent = buildMessages([ana], { title: 'T', body: 'B' }, 'bills');
  assert.deepEqual(tokensToRetire(sent, []), []);
});

// --- daily digest ----------------------------------------------------------

const reminder = (over: Partial<import('./push.ts').Reminder> = {}) => ({
  user_id: 'boy',
  household_id: 'h',
  category: 'bills' as const,
  title: 'Electricity',
  body: 'Due Aug 21 — ₱1,500.00 is your share.',
  ...over,
});

test('a lone reminder keeps the specific wording the query wrote', async () => {
  const { summariseReminders } = await import('./push.ts');
  const [notice] = summariseReminders([reminder()]);
  assert.equal(notice.title, 'Electricity');
  assert.match(notice.body, /₱1,500\.00/);
});

test('several in one category collapse into a single buzz', async () => {
  const { summariseReminders } = await import('./push.ts');
  const notices = summariseReminders([
    reminder({ title: 'Electricity' }),
    reminder({ title: 'Water' }),
    reminder({ title: 'Internet' }),
  ]);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].title, '3 bills due tomorrow');
  // Named, not counted — you can tell whether it's worth opening the app.
  assert.equal(notices[0].body, 'Electricity, Water and Internet');
});

test('bills and chores stay separate notifications', async () => {
  const { summariseReminders } = await import('./push.ts');
  const notices = summariseReminders([
    reminder({ category: 'bills' }),
    reminder({ category: 'chores', title: 'Wash the dishes' }),
  ]);
  assert.deepEqual(notices.map((n) => n.category).sort(), ['bills', 'chores']);
});

test('two people never get each other’s reminders', async () => {
  const { summariseReminders } = await import('./push.ts');
  const notices = summariseReminders([
    reminder({ user_id: 'ana', title: 'Rent' }),
    reminder({ user_id: 'boy', title: 'Electricity' }),
  ]);
  assert.equal(notices.length, 2);
  assert.deepEqual(
    notices.map((n) => `${n.userId}:${n.title}`).sort(),
    ['ana:Rent', 'boy:Electricity']
  );
});

test('listNames handles one, two and many', async () => {
  const { listNames } = await import('./push.ts');
  assert.equal(listNames([]), '');
  assert.equal(listNames(['Electricity']), 'Electricity');
  assert.equal(listNames(['Electricity', 'Water']), 'Electricity and Water');
  assert.equal(listNames(['A', 'B', 'C']), 'A, B and C');
});

test('a digest respects preferences and skips people with no device', async () => {
  const { deliverableNotices, summariseReminders } = await import('./push.ts');
  const notices = summariseReminders([
    reminder({ user_id: 'ana' }),
    reminder({ user_id: 'cel' }),
    reminder({ user_id: 'dee' }),
  ]);
  const candidates = new Map([
    ['ana', ana],
    ['cel', cel], // bills switched off
    ['dee', dee], // no registered device
  ]);
  const deliverable = deliverableNotices(notices, candidates);
  assert.deepEqual(deliverable.map((d) => d.notice.userId), ['ana']);
  assert.deepEqual(deliverable[0].tokens, ['t-ana']);
});

test('a reminder for someone no longer in the household is dropped', async () => {
  const { deliverableNotices, summariseReminders } = await import('./push.ts');
  const notices = summariseReminders([reminder({ user_id: 'ghost' })]);
  assert.deepEqual(deliverableNotices(notices, new Map()), []);
});
