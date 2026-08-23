/**
 * Types for the Kasama Postgres schema.
 *
 * Kept in the shape `supabase gen types typescript` produces, so it can be
 * regenerated straight over this file once the project is linked:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemberRole = 'admin' | 'member';
export type BillCategory = 'rent' | 'utilities' | 'internet' | 'groceries' | 'other';
export type BillRecurrence = 'none' | 'weekly' | 'monthly';
export type ChoreRecurrence = 'once' | 'daily' | 'weekly' | 'monthly';
/**
 * `announcements.tape_color`. A check constraint rather than a Postgres enum,
 * so adding a colour later is one ALTER instead of a type rewrite — but the
 * union is still worth spelling out on this side.
 */
export type TapeColor = 'mustard' | 'sage' | 'brick' | 'moss';
/**
 * Where a request to leave the household ended up. `completed` covers both
 * ways it can succeed — the house voting someone out the door, and the last
 * person in a household letting themselves out, who has nobody to ask.
 */
export type LeaveRequestStatus = 'pending' | 'declined' | 'cancelled' | 'completed';
export type LeaveVote = 'accept' | 'decline';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          push_bills: boolean;
          push_chores: boolean;
          push_board: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          avatar_url?: string | null;
          push_bills?: boolean;
          push_chores?: boolean;
          push_board?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          push_bills?: boolean;
          push_chores?: boolean;
          push_board?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      households: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code?: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          invite_code?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      household_members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: MemberRole;
          joined_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role?: MemberRole;
          joined_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          role?: MemberRole;
          joined_at?: string;
        };
        Relationships: [];
      };
      bills: {
        Row: {
          id: string;
          household_id: string;
          title: string;
          amount: number;
          category: BillCategory;
          due_date: string | null;
          recurrence: BillRecurrence;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          title: string;
          amount: number;
          category?: BillCategory;
          due_date?: string | null;
          recurrence?: BillRecurrence;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          title?: string;
          amount?: number;
          category?: BillCategory;
          due_date?: string | null;
          recurrence?: BillRecurrence;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      bill_splits: {
        Row: {
          id: string;
          bill_id: string;
          user_id: string;
          amount_owed: number;
          paid: boolean;
          paid_at: string | null;
        };
        Insert: {
          id?: string;
          bill_id: string;
          user_id: string;
          amount_owed: number;
          paid?: boolean;
          paid_at?: string | null;
        };
        Update: {
          id?: string;
          bill_id?: string;
          user_id?: string;
          amount_owed?: number;
          paid?: boolean;
          paid_at?: string | null;
        };
        Relationships: [];
      };
      chores: {
        Row: {
          id: string;
          household_id: string;
          title: string;
          description: string | null;
          recurrence: ChoreRecurrence;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          title: string;
          description?: string | null;
          recurrence?: ChoreRecurrence;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          title?: string;
          description?: string | null;
          recurrence?: ChoreRecurrence;
          created_at?: string;
        };
        Relationships: [];
      };
      chore_assignments: {
        Row: {
          id: string;
          chore_id: string;
          user_id: string;
          due_date: string;
          completed: boolean;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          chore_id: string;
          user_id: string;
          due_date: string;
          completed?: boolean;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          chore_id?: string;
          user_id?: string;
          due_date?: string;
          completed?: boolean;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      device_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android' | 'web';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android' | 'web';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          platform?: 'ios' | 'android' | 'web';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          content: string;
          pinned: boolean;
          /** A palette token — see TAPE_TOKENS. Null on notes predating it. */
          tape_color: TapeColor | null;
          /**
           * A receipt pinned to the note, as an object path inside the private
           * `receipts` bucket — never a URL. Reads go through a signed URL that
           * expires, so a stored one would be a dead link within the hour.
           */
          image_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          content: string;
          pinned?: boolean;
          tape_color?: TapeColor | null;
          image_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          content?: string;
          pinned?: boolean;
          tape_color?: TapeColor | null;
          image_path?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      leave_requests: {
        Row: {
          id: string;
          household_id: string;
          /** The person leaving. They never vote on their own request. */
          user_id: string;
          status: LeaveRequestStatus;
          reason: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      leave_request_votes: {
        Row: {
          id: string;
          request_id: string;
          voter_id: string;
          decision: LeaveVote;
          /** Attached to a decline: what still has to happen first. */
          note: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      chore_streaks: {
        Row: {
          household_id: string;
          user_id: string;
          /** Consecutive finished turns, newest-first. */
          streak: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_household: {
        Args: { household_name: string };
        Returns: Database['public']['Tables']['households']['Row'];
      };
      join_household_by_code: {
        Args: { code: string };
        Returns: Database['public']['Tables']['households']['Row'];
      };
      register_device_token: {
        Args: { device_token: string; device_platform: string };
        Returns: undefined;
      };
      set_announcement_pinned: {
        Args: { announcement_id: string; pinned: boolean };
        Returns: undefined;
      };
      roll_recurring_bill: {
        Args: { source_bill_id: string };
        /** The new bill's id, or null when there was nothing to roll. */
        Returns: string | null;
      };
      request_household_leave: {
        Args: { target_household: string; reason?: string | null };
        Returns: Database['public']['Tables']['leave_requests']['Row'];
      };
      vote_on_leave_request: {
        Args: { request: string; decision: LeaveVote; note?: string | null };
        Returns: Database['public']['Tables']['leave_requests']['Row'];
      };
      cancel_leave_request: {
        Args: { request: string };
        Returns: Database['public']['Tables']['leave_requests']['Row'];
      };
      leave_all_households: {
        Args: Record<string, never>;
        /** How many households the caller was in. */
        Returns: number;
      };
      is_household_member: {
        Args: { hid: string };
        Returns: boolean;
      };
      is_household_admin: {
        Args: { hid: string };
        Returns: boolean;
      };
    };
    Enums: {
      member_role: MemberRole;
      bill_category: BillCategory;
      bill_recurrence: BillRecurrence;
      chore_recurrence: ChoreRecurrence;
      leave_request_status: LeaveRequestStatus;
      leave_vote: LeaveVote;
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
