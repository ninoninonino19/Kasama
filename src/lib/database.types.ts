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

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
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
      announcements: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      join_household_by_code: {
        Args: { code: string };
        Returns: Database['public']['Tables']['households']['Row'];
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
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
