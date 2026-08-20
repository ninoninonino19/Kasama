/** Currency, date and label helpers shared across the app. */

/** ₱1,250.00 — always two decimals, grouped thousands. */
export function formatPeso(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const sign = safe < 0 ? '-' : '';
  const [whole, fraction] = Math.abs(safe).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}₱${grouped}.${fraction}`;
}

/** `2026-08-13` in the device's local timezone (Postgres `date` columns). */
export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses a `date` column as local midnight rather than UTC. */
export function fromDateString(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function todayString(): string {
  return toDateString(new Date());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Monday-based start of the week containing `date`. */
export function startOfWeek(date = new Date()): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (start.getDay() + 6) % 7; // Monday = 0
  return addDays(start, -weekday);
}

export function endOfWeek(date = new Date()): Date {
  return addDays(startOfWeek(date), 6);
}

/**
 * Monday-first weekday labels, matching `startOfWeek` and `weekdayIndex`.
 *
 * The calendar grid, the weekly-repeat picker and the chores week strip all
 * need these, and three private copies is three chances for one of them to
 * start on Sunday while the maths still says Monday.
 */
export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/**
 * The first day on or after `from` falling on Monday-based `index`.
 *
 * Used when someone picks "repeats weekly, on Wednesday": the due date moves
 * to the coming Wednesday rather than the schedule being stored separately.
 */
export function nextWeekday(index: number, from = new Date()): Date {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return addDays(start, (index - weekdayIndex(start) + 7) % 7);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Days in the month containing `date`. */
export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Month arithmetic that clamps rather than overflowing — a month on from
 * 31 January is 28 February, not 3 March.
 */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  target.setDate(Math.min(date.getDate(), daysInMonth(target)));
  return target;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "August 2026" — the calendar's own heading. */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
}

/** "Aug 13" / "Aug 13, 2027" once the year differs from today's. */
export function formatShortDate(value: string | Date): string {
  const date = typeof value === 'string' ? fromDateString(value.slice(0, 10)) : value;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "Today", "Tomorrow", "Yesterday" or a short date. */
export function formatRelativeDate(value: string | Date): string {
  const date = typeof value === 'string' ? fromDateString(value.slice(0, 10)) : value;
  const today = new Date();
  const diffDays = Math.round(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return date.toLocaleDateString('en-PH', { weekday: 'long' });
  }
  if (diffDays < -1 && diffDays > -7) return `${Math.abs(diffDays)} days ago`;
  return formatShortDate(date);
}

/** "just now", "5m ago", "3h ago", "2d ago", then a short date. */
export function formatTimeAgo(isoTimestamp: string): string {
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatShortDate(new Date(then));
}

/** "AJ" from "Ana Jose" — used for avatar fallbacks. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Deterministic soft colour per user id, so avatars stay stable across
 * screens and sessions. Muted earth tones so a row of six faces sits on the
 * paper without competing with the mustard and brick the status pills use;
 * every foreground clears 4.5:1 on its own background.
 */
const AVATAR_COLORS = [
  { bg: '#DCE7D4', fg: '#33502C' },
  { bg: '#F6E4C8', fg: '#7A5B12' },
  { bg: '#F0DAD3', fg: '#8E3D2C' },
  { bg: '#D9E2E4', fg: '#2F4B50' },
  { bg: '#E7DEEA', fg: '#5A3F63' },
  { bg: '#E3E6D6', fg: '#4A5334' },
];

export function avatarColors(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100_000;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/** Splits `total` across `count` people, giving the remainder centavo(s) to the first. */
export function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) return [];
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / count);
  const remainder = centavos - base * count;
  return Array.from({ length: count }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}
