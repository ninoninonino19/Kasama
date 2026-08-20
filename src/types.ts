import type { Tables } from './lib/database.types';

export type Profile = Tables<'profiles'>;
export type Household = Tables<'households'>;
export type HouseholdMember = Tables<'household_members'>;
export type Bill = Tables<'bills'>;
export type BillSplit = Tables<'bill_splits'>;
export type Chore = Tables<'chores'>;
export type ChoreAssignment = Tables<'chore_assignments'>;
export type Announcement = Tables<'announcements'>;

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
  /** Who had fronted the bill and was paid back. */
  payeeId: string;
};
