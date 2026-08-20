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

// ---------------------------------------------------------------------------
// Daily digest
// ---------------------------------------------------------------------------

/** One row from `public.pending_reminders(date)`. */
export type Reminder = {
  user_id: string;
  household_id: string;
  category: Category;
  title: string;
  body: string;
};

export type Notice = {
  userId: string;
  category: Category;
  title: string;
  body: string;
};

/**
 * Turns raw reminder rows into at most one notification per person per
 * category.
 *
 * Someone with four chores due tomorrow should get one buzz that says four,
 * not four buzzes. The single-item case keeps the specific wording the SQL
 * wrote, because "Electricity — ₱1,500.00 is your share" is more useful than
 * "1 bill".
 */
export function summariseReminders(reminders: Reminder[]): Notice[] {
  const groups = new Map<string, Reminder[]>();

  for (const reminder of reminders) {
    const key = `${reminder.user_id}::${reminder.category}`;
    groups.set(key, [...(groups.get(key) ?? []), reminder]);
  }

  return [...groups.values()].map((group) => {
    const [first] = group;

    if (group.length === 1) {
      return {
        userId: first.user_id,
        category: first.category,
        title: first.title,
        body: first.body,
      };
    }

    return {
      userId: first.user_id,
      category: first.category,
      title:
        first.category === 'bills'
          ? `${group.length} bills due tomorrow`
          : `${group.length} chores due tomorrow`,
      // Named rather than counted: "Electricity, Water and Internet" tells you
      // whether it's worth opening the app; "3 bills" doesn't.
      body: listNames(group.map((reminder) => reminder.title)),
    };
  });
}

/** "Electricity, Water and Internet" — a list with the last joined by "and". */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Drops notices for people with the category off or no device registered. */
export function deliverableNotices(
  notices: Notice[],
  candidates: Map<string, Candidate>
): { notice: Notice; tokens: string[] }[] {
  const preferenceOf: Record<Category, keyof Candidate['preferences']> = {
    bills: 'push_bills',
    chores: 'push_chores',
    board: 'push_board',
  };

  return notices.flatMap((notice) => {
    const candidate = candidates.get(notice.userId);
    if (!candidate) return [];
    if (!candidate.preferences[preferenceOf[notice.category]]) return [];
    if (candidate.tokens.length === 0) return [];
    return [{ notice, tokens: candidate.tokens }];
  });
}
