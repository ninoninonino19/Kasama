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
  /** What I still have to pay on other people's bills. */
  owed: number;
  /** What housemates still owe me on bills I paid for. */
  owing: number;
  /** owing - owed. Positive means the household owes me. */
  net: number;
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
