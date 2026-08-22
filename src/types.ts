import type { Tables } from './lib/database.types';

export type Profile = Tables<'profiles'>;
export type Household = Tables<'households'>;
export type HouseholdMember = Tables<'household_members'>;
export type Bill = Tables<'bills'>;
export type BillSplit = Tables<'bill_splits'>;
export type Chore = Tables<'chores'>;
export type ChoreAssignment = Tables<'chore_assignments'>;
export type Announcement = Tables<'announcements'>;
export type LeaveRequest = Tables<'leave_requests'>;
export type LeaveRequestVote = Tables<'leave_request_votes'>;

export type MemberWithProfile = HouseholdMember & {
  profile: Profile;
};

export type SplitWithProfile = BillSplit & {
  profile: Profile | null;
};

export type BillWithSplits = Bill & {
  splits: SplitWithProfile[];
};

export type AssignmentWithProfile = ChoreAssignment & {
  profile: Profile | null;
};

export type ChoreWithAssignments = Chore & {
  assignments: AssignmentWithProfile[];
};

export type AnnouncementWithAuthor = Announcement & {
  profile: Profile | null;
  /**
   * A viewable link to `image_path`, signed when the board was fetched.
   *
   * Not a column — the receipts bucket is private, so the row stores a storage
   * path and this is what an `<Image>` can actually load. It expires; see
   * `RECEIPT_URL_TTL_SECONDS`. Undefined on a note that was never signed,
   * null when the signing failed or the file has gone.
   */
  imageUrl?: string | null;
};

export type LeaveVoteWithVoter = LeaveRequestVote & {
  voter: Profile | null;
};

/**
 * A request to leave, with whoever has answered it so far.
 *
 * `votes` only ever holds answers that have been given — silence is not a row.
 * Who is still to answer is worked out against the current member list rather
 * than stored, so a housemate who joins while a request is open is asked too.
 */
export type LeaveRequestWithVotes = LeaveRequest & {
  /** The person leaving. */
  profile: Profile | null;
  votes: LeaveVoteWithVoter[];
};

/** How much the signed-in user owes vs. is owed across all unsettled bills. */
export type BalanceSummary = {
  /** What I still have to pay, on my own bills as much as anyone else's. */
  owed: number;
  /** What housemates still owe me on bills I paid for and have covered. */
  owing: number;
  /** owing - owed. Positive means the household owes me. */
  net: number;
};

/**
 * The signed-in user's month: what is left to pay, and what has been already.
 *
 * Covers every bill due on or before the end of the current month — carried-over
 * overdue ones included — plus bills with no due date. See `summariseMonth`.
 */
export type MonthBalance = {
  /** `YYYY-MM` the figures cover. */
  month: string;
  /** My unpaid shares in the window. The number the dashboard leads with. */
  remaining: number;
  /** My shares in the window I have already ticked off. */
  paid: number;
  /** paid + remaining — my whole share of the month. */
  total: number;
  /** Everything the house still owes in the same window, mine included. */
  householdRemaining: number;
  /** Bills in the window that still carry an unpaid share of mine. */
  openBills: number;
};

/** One settled share, for the "who paid whom" ledger. */
export type LedgerEntry = {
  id: string;
  amount: number;
  paidAt: string;
  billId: string;
  billTitle: string;
  category: Bill['category'];
  /** Who handed over the money. */
  payerId: string;
  /**
   * Who was paid back — whoever is collecting for the bill. Equal to `payerId`
   * when they were settling their own share, which goes to the biller rather
   * than to a housemate.
   */
  payeeId: string;
};
