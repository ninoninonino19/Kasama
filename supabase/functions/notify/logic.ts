/**
 * The decisions the `notify` function makes, kept apart from the HTTP and
 * database glue so they can be tested with a plain `node --test`.
 *
 * Deno isn't part of this repo's toolchain, so anything left in `index.ts` is
 * reviewed rather than executed. Keeping that surface down to "read the
 * request, run these functions, call Expo" is the point of this file.
 */

export type Category = 'bills' | 'chores' | 'board';

export type Candidate = {
  userId: string;
  tokens: string[];
  preferences: { push_bills: boolean; push_chores: boolean; push_board: boolean };
};

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound: 'default';
  channelId: string;
};

const PREFERENCE_OF: Record<Category, keyof Candidate['preferences']> = {
  bills: 'push_bills',
  chores: 'push_chores',
  board: 'push_board',
};

/**
 * Who actually gets buzzed.
 *
 * Three filters, in the order they matter: never the person who caused the
 * event, never someone who turned this category off, and never a user with no
 * registered device. `only` narrows further — a bill notifies the people who
 * owe on it, not the whole house.
 */
export function selectRecipients(
  candidates: Candidate[],
  category: Category,
  actorId: string,
  only?: string[] | null
): Candidate[] {
  const allowed = only && only.length > 0 ? new Set(only) : null;

  return candidates.filter((candidate) => {
    if (candidate.userId === actorId) return false;
    if (allowed && !allowed.has(candidate.userId)) return false;
    if (!candidate.preferences[PREFERENCE_OF[category]]) return false;
    return candidate.tokens.length > 0;
  });
}

/** One message per device, since a housemate may be signed in on two. */
export function buildMessages(
  recipients: Candidate[],
  content: { title: string; body: string; data?: Record<string, unknown> },
  category: Category
): PushMessage[] {
  return recipients.flatMap((recipient) =>
    recipient.tokens.map((token) => ({
      to: token,
      title: content.title,
      body: content.body,
      data: content.data,
      sound: 'default' as const,
      // Android needs a channel or the notification arrives silently; the
      // client creates one channel per category with matching ids.
      channelId: category,
    }))
  );
}

/** Expo's push API takes at most 100 messages per request. */
export function chunk<T>(items: T[], size = 100): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export type ExpoTicket = {
  status: 'ok' | 'error';
  details?: { error?: string };
};

/**
 * Tokens Expo says are dead, so they can be deleted rather than retried
 * forever. `DeviceNotRegistered` is the app being uninstalled or the token
 * being rotated; every other error is transient or our fault, and deleting on
 * those would silently unsubscribe people from a bug.
 */
export function tokensToRetire(sent: PushMessage[], tickets: ExpoTicket[]): string[] {
  const dead: string[] = [];

  tickets.forEach((ticket, index) => {
    if (ticket.status !== 'error') return;
    if (ticket.details?.error !== 'DeviceNotRegistered') return;
    const message = sent[index];
    if (message) dead.push(message.to);
  });

  return dead;
}
