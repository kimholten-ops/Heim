// Databasetyper for Heim.
//
// Disse kan (og bør) autogenereres mot din egen database med:
//   npm run gen-types
// Filen her er et korrekt utgangspunkt som matcher migrasjonene 0001–0003,
// slik at appen er typesikker før du har kjørt generatoren.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type Timestamps = { created_at: string };

export type Database = {
  public: {
    Tables: {
      households: {
        Row: { id: string; name: string; invite_code: string | null } & Timestamps;
        Insert: { id?: string; name: string; invite_code?: string | null; created_at?: string };
        Update: { id?: string; name?: string; invite_code?: string | null };
        Relationships: [];
      };
      members: {
        Row: {
          id: string; household_id: string; auth_user_id: string | null;
          name: string; color: string; role: string; can_login: boolean;
        } & Timestamps;
        Insert: {
          id?: string; household_id: string; auth_user_id?: string | null;
          name: string; color?: string; role?: string; can_login?: boolean; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["members"]["Insert"]>;
        Relationships: [];
      };
      lists: {
        Row: { id: string; household_id: string; name: string; type: string } & Timestamps;
        Insert: { id?: string; household_id: string; name: string; type?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["lists"]["Insert"]>;
        Relationships: [];
      };
      list_items: {
        Row: {
          id: string; list_id: string; text: string; done: boolean;
          assignee_id: string | null; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; list_id: string; text: string; done?: boolean;
          assignee_id?: string | null; created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["list_items"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: { id: string; display_name: string | null; active_household_id: string | null } & Timestamps;
        Insert: { id: string; display_name?: string | null; active_household_id?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      recipes: {
        Row:    { id: string; household_id: string; title: string; body: string | null; url: string | null; ingredients: unknown; times_used: number; created_by: string | null; created_at: string }
        Insert: { id?: string; household_id: string; title: string; body?: string | null; url?: string | null; ingredients?: unknown; times_used?: number; created_by?: string | null; created_at?: string }
        Update: { id?: string; household_id?: string; title?: string; body?: string | null; url?: string | null; ingredients?: unknown; times_used?: number; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      meals: {
        Row:    { id: string; household_id: string; date: string; recipe_id: string | null; title: string | null; cook_id: string | null; notes: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; household_id: string; date: string; recipe_id?: string | null; title?: string | null; cook_id?: string | null; notes?: string | null; created_by?: string | null; created_at?: string }
        Update: { id?: string; household_id?: string; date?: string; recipe_id?: string | null; title?: string | null; cook_id?: string | null; notes?: string | null; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      events: {
        Row:    { id: string; household_id: string; title: string; description: string | null; location: string | null; notes: string | null; start_at: string; end_at: string; all_day: boolean; color: string; recurrence: string; created_by: string | null; created_at: string }
        Insert: { id?: string; household_id: string; title: string; description?: string | null; location?: string | null; notes?: string | null; start_at: string; end_at: string; all_day?: boolean; color?: string; recurrence?: string; created_by?: string | null; created_at?: string }
        Update: { id?: string; household_id?: string; title?: string; description?: string | null; location?: string | null; notes?: string | null; start_at?: string; end_at?: string; all_day?: boolean; color?: string; recurrence?: string; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      event_members: {
        Row:    { event_id: string; user_id: string }
        Insert: { event_id: string; user_id: string }
        Update: { event_id?: string; user_id?: string }
        Relationships: []
      }
      event_children: {
        Row:    { event_id: string; child_id: string }
        Insert: { event_id: string; child_id: string }
        Update: { event_id?: string; child_id?: string }
        Relationships: []
      }
      todo_lists: {
        Row:    { id: string; household_id: string; name: string; icon: string; color: string; created_by: string | null; created_at: string }
        Insert: { id?: string; household_id: string; name: string; icon?: string; color?: string; created_by?: string | null; created_at?: string }
        Update: { id?: string; household_id?: string; name?: string; icon?: string; color?: string; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      todos: {
        Row:    { id: string; todo_list_id: string; household_id: string; title: string; notes: string | null; due_date: string | null; priority: 'low'|'normal'|'high'; assigned_to: string | null; assigned_to_child_id: string | null; completed: boolean; completed_at: string | null; reward_points: number; approval_status: string; created_by: string | null; created_at: string }
        Insert: { id?: string; todo_list_id: string; household_id: string; title: string; notes?: string | null; due_date?: string | null; priority?: 'low'|'normal'|'high'; assigned_to?: string | null; assigned_to_child_id?: string | null; completed?: boolean; completed_at?: string | null; reward_points?: number; approval_status?: string; created_by?: string | null; created_at?: string }
        Update: { id?: string; todo_list_id?: string; household_id?: string; title?: string; notes?: string | null; due_date?: string | null; priority?: 'low'|'normal'|'high'; assigned_to?: string | null; assigned_to_child_id?: string | null; completed?: boolean; completed_at?: string | null; reward_points?: number; approval_status?: string; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      calendar_feeds: {
        Row: { id: string; household_id: string; token: string; label: string; member_id: string | null; revoked_at: string | null; created_by: string | null; created_at: string };
        Insert: { id?: string; household_id: string; token?: string; label?: string; member_id?: string | null; revoked_at?: string | null; created_by?: string | null; created_at?: string };
        Update: { id?: string; household_id?: string; token?: string; label?: string; member_id?: string | null; revoked_at?: string | null; created_by?: string | null; created_at?: string };
        Relationships: [];
      };
      household_invites: {
        Row: {
          id: string; household_id: string; code: string; created_by: string | null;
          expires_at: string; used_at: string | null; created_at: string;
        };
        Insert: {
          id?: string; household_id: string; code: string; created_by?: string | null;
          expires_at?: string; used_at?: string | null; created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["household_invites"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_invite: { Args: { p_ttl_hours?: number }; Returns: string };
      join_household: { Args: { p_code: string }; Returns: string };
      set_active_household: { Args: { p_hid: string }; Returns: undefined };
      add_child: { Args: { p_name: string; p_color: string }; Returns: string };
      leave_household: { Args: { p_hid: string }; Returns: string | null };
      create_household: { Args: { p_name: string }; Returns: string };
      create_calendar_feed: { Args: { p_label?: string }; Returns: string };
      get_feed_events: { Args: { p_token: string }; Returns: { event_id: string; title: string; location: string | null; notes: string | null; start_at: string; end_at: string; all_day: boolean; recurrence: string }[] };
      generate_meal_shopping_list_heim: { Args: { p_week_start: string }; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
