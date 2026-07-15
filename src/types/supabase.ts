// Databasetyper for Heim.
//
// Disse kan (og bør) autogenereres mot din egen database med:
//   npm run gen-types
// Filen her er et korrekt utgangspunkt som matcher migrasjonene 0001–0005,
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
          household_role: "medlem" | "gjest";
        } & Timestamps;
        Insert: {
          id?: string; household_id: string; auth_user_id?: string | null;
          name: string; color?: string; role?: string; can_login?: boolean; created_at?: string;
          household_role?: "medlem" | "gjest";
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
          assignee_id: string | null; product: unknown; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; list_id: string; text: string; done?: boolean; product?: unknown;
          assignee_id?: string | null; created_at?: string; updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["list_items"]["Insert"]>;
        Relationships: [];
      };
      ip_rate_limits: {
        Row: { id: string; ip_address: string; endpoint: string; created_at: string };
        Insert: { id?: string; ip_address: string; endpoint: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["ip_rate_limits"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: { id: string; display_name: string | null; active_household_id: string | null } & Timestamps;
        Insert: { id: string; display_name?: string | null; active_household_id?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      recipes: {
        Row:    { id: string; household_id: string; title: string; body: string | null; url: string | null; image_url: string | null; servings: number | null; total_time_minutes: number | null; ingredients: unknown; times_used: number; created_by: string | null; created_at: string }
        Insert: { id?: string; household_id: string; title: string; body?: string | null; url?: string | null; image_url?: string | null; servings?: number | null; total_time_minutes?: number | null; ingredients?: unknown; times_used?: number; created_by?: string | null; created_at?: string }
        Update: { id?: string; household_id?: string; title?: string; body?: string | null; url?: string | null; image_url?: string | null; servings?: number | null; total_time_minutes?: number | null; ingredients?: unknown; times_used?: number; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      meals: {
        Row:    { id: string; household_id: string; date: string; recipe_id: string | null; title: string | null; cook_id: string | null; notes: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; household_id: string; date: string; recipe_id?: string | null; title?: string | null; cook_id?: string | null; notes?: string | null; created_by?: string | null; created_at?: string }
        Update: { id?: string; household_id?: string; date?: string; recipe_id?: string | null; title?: string | null; cook_id?: string | null; notes?: string | null; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      events: {
        Row:    { id: string; household_id: string; title: string; description: string | null; location: string | null; notes: string | null; start_at: string; end_at: string; all_day: boolean; color: string; recurrence: string; import_id: string | null; external_uid: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; household_id: string; title: string; description?: string | null; location?: string | null; notes?: string | null; start_at: string; end_at: string; all_day?: boolean; color?: string; recurrence?: string; import_id?: string | null; external_uid?: string | null; created_by?: string | null; created_at?: string }
        Update: { id?: string; household_id?: string; title?: string; description?: string | null; location?: string | null; notes?: string | null; start_at?: string; end_at?: string; all_day?: boolean; color?: string; recurrence?: string; import_id?: string | null; external_uid?: string | null; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      calendar_imports: {
        Row:    { id: string; household_id: string; label: string; source_url: string; color: string; last_synced_at: string | null; last_error: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; household_id: string; label: string; source_url: string; color?: string; last_synced_at?: string | null; last_error?: string | null; created_by?: string | null; created_at?: string }
        Update: { id?: string; household_id?: string; label?: string; source_url?: string; color?: string; last_synced_at?: string | null; last_error?: string | null; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      event_members: {
        Row:    { event_id: string; member_id: string }
        Insert: { event_id: string; member_id: string }
        Update: { event_id?: string; member_id?: string }
        Relationships: []
      }
      todo_lists: {
        Row:    { id: string; household_id: string; name: string; icon: string; color: string; created_by: string | null; created_at: string }
        Insert: { id?: string; household_id: string; name: string; icon?: string; color?: string; created_by?: string | null; created_at?: string }
        Update: { id?: string; household_id?: string; name?: string; icon?: string; color?: string; created_by?: string | null; created_at?: string }
        Relationships: []
      }
      todos: {
        Row:    { id: string; todo_list_id: string; household_id: string; title: string; notes: string | null; due_date: string | null; priority: 'low'|'normal'|'high'; assigned_to: string | null; completed: boolean; completed_at: string | null; created_by: string | null; created_at: string; rotation_id: string | null }
        Insert: { id?: string; todo_list_id: string; household_id: string; title: string; notes?: string | null; due_date?: string | null; priority?: 'low'|'normal'|'high'; assigned_to?: string | null; completed?: boolean; completed_at?: string | null; created_by?: string | null; created_at?: string; rotation_id?: string | null }
        Update: { id?: string; todo_list_id?: string; household_id?: string; title?: string; notes?: string | null; due_date?: string | null; priority?: 'low'|'normal'|'high'; assigned_to?: string | null; completed?: boolean; completed_at?: string | null; created_by?: string | null; created_at?: string; rotation_id?: string | null }
        Relationships: []
      }
      todo_rotations: {
        Row:    { id: string; household_id: string; todo_list_id: string; title: string; member_order: string[]; current_index: number; frequency: 'daily'|'weekly'; next_due: string; active: boolean; created_by: string | null; created_at: string }
        Insert: { id?: string; household_id: string; todo_list_id: string; title: string; member_order: string[]; current_index?: number; frequency?: 'daily'|'weekly'; next_due: string; active?: boolean; created_by?: string | null; created_at?: string }
        Update: { id?: string; household_id?: string; todo_list_id?: string; title?: string; member_order?: string[]; current_index?: number; frequency?: 'daily'|'weekly'; next_due?: string; active?: boolean; created_by?: string | null; created_at?: string }
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
          household_role: "medlem" | "gjest";
        };
        Insert: {
          id?: string; household_id: string; code: string; created_by?: string | null;
          expires_at?: string; used_at?: string | null; created_at?: string;
          household_role?: "medlem" | "gjest";
        };
        Update: Partial<Database["public"]["Tables"]["household_invites"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row:    { id: string; household_id: string; member_id: string; type: string; title: string; body: string | null; url: string | null; ref_id: string | null; read_at: string | null; created_at: string }
        Insert: { id?: string; household_id: string; member_id: string; type?: string; title: string; body?: string | null; url?: string | null; ref_id?: string | null; read_at?: string | null; created_at?: string }
        Update: { id?: string; household_id?: string; member_id?: string; type?: string; title?: string; body?: string | null; url?: string | null; ref_id?: string | null; read_at?: string | null; created_at?: string }
        Relationships: [];
      };
      push_subscriptions: {
        Row:    { id: string; auth_user_id: string; endpoint: string; p256dh: string; auth_key: string; created_at: string }
        Insert: { id?: string; auth_user_id?: string; endpoint: string; p256dh: string; auth_key: string; created_at?: string }
        Update: { id?: string; auth_user_id?: string; endpoint?: string; p256dh?: string; auth_key?: string; created_at?: string }
        Relationships: [];
      };
      exercises: {
        Row:    { id: string; name_no: string; name_en: string; muscle_groups: string[]; equipment: string | null; level: string | null; instructions_no: string[]; image_urls: string[] }
        Insert: { id: string; name_no: string; name_en: string; muscle_groups: string[]; equipment?: string | null; level?: string | null; instructions_no?: string[]; image_urls?: string[] }
        Update: { id?: string; name_no?: string; name_en?: string; muscle_groups?: string[]; equipment?: string | null; level?: string | null; instructions_no?: string[]; image_urls?: string[] }
        Relationships: [];
      };
      workout_templates: {
        Row:    { id: string; member_id: string; name: string; created_at: string }
        Insert: { id?: string; member_id: string; name: string; created_at?: string }
        Update: { id?: string; member_id?: string; name?: string; created_at?: string }
        Relationships: [];
      };
      workout_template_exercises: {
        Row:    { id: string; template_id: string; exercise_id: string; position: number; target_sets: number | null; target_reps: string | null; notes: string | null }
        Insert: { id?: string; template_id: string; exercise_id: string; position?: number; target_sets?: number | null; target_reps?: string | null; notes?: string | null }
        Update: { id?: string; template_id?: string; exercise_id?: string; position?: number; target_sets?: number | null; target_reps?: string | null; notes?: string | null }
        Relationships: [];
      };
      workout_sessions: {
        Row:    { id: string; member_id: string; template_id: string | null; started_at: string; finished_at: string | null; notes: string | null; calendar_event_id: string | null }
        Insert: { id?: string; member_id: string; template_id?: string | null; started_at?: string; finished_at?: string | null; notes?: string | null; calendar_event_id?: string | null }
        Update: { id?: string; member_id?: string; template_id?: string | null; started_at?: string; finished_at?: string | null; notes?: string | null; calendar_event_id?: string | null }
        Relationships: [];
      };
      workout_sets: {
        Row:    { id: string; session_id: string; exercise_id: string; set_number: number; reps: number | null; weight_kg: number | null; completed: boolean }
        Insert: { id?: string; session_id: string; exercise_id: string; set_number: number; reps?: number | null; weight_kg?: number | null; completed?: boolean }
        Update: { id?: string; session_id?: string; exercise_id?: string; set_number?: number; reps?: number | null; weight_kg?: number | null; completed?: boolean }
        Relationships: [];
      };
      matvarer: {
        Row:    { id: string; navn: string; gruppe: string | null; kcal: number; protein_g: number; karbo_g: number; fett_g: number; fiber_g: number }
        Insert: { id: string; navn: string; gruppe?: string | null; kcal: number; protein_g?: number; karbo_g?: number; fett_g?: number; fiber_g?: number }
        Update: { id?: string; navn?: string; gruppe?: string | null; kcal?: number; protein_g?: number; karbo_g?: number; fett_g?: number; fiber_g?: number }
        Relationships: [];
      };
      health_profiles: {
        Row:    { member_id: string; kcal_target: number | null; protein_target_g: number | null; updated_at: string }
        Insert: { member_id: string; kcal_target?: number | null; protein_target_g?: number | null; updated_at?: string }
        Update: { member_id?: string; kcal_target?: number | null; protein_target_g?: number | null; updated_at?: string }
        Relationships: [];
      };
      weight_entries: {
        Row:    { id: string; member_id: string; date: string; weight_kg: number }
        Insert: { id?: string; member_id: string; date: string; weight_kg: number }
        Update: { id?: string; member_id?: string; date?: string; weight_kg?: number }
        Relationships: [];
      };
      food_log_entries: {
        Row:    { id: string; member_id: string; date: string; slot: string; matvare_id: string | null; matvare_navn: string | null; product: unknown; custom_name: string | null; grams: number; kcal: number; protein_g: number; karbo_g: number; fett_g: number; created_at: string }
        Insert: { id?: string; member_id: string; date: string; slot?: string; matvare_id?: string | null; matvare_navn?: string | null; product?: unknown; custom_name?: string | null; grams?: number; kcal: number; protein_g?: number; karbo_g?: number; fett_g?: number; created_at?: string }
        Update: { id?: string; member_id?: string; date?: string; slot?: string; matvare_id?: string | null; matvare_navn?: string | null; product?: unknown; custom_name?: string | null; grams?: number; kcal?: number; protein_g?: number; karbo_g?: number; fett_g?: number; created_at?: string }
        Relationships: [];
      };
      ai_usage: {
        Row:    { id: string; member_id: string; kind: "chat" | "ukesprogram" | "gjennomgang" | "maltid"; input_tokens: number; output_tokens: number; cache_read_tokens: number; created_at: string }
        Insert: { id?: string; member_id: string; kind: "chat" | "ukesprogram" | "gjennomgang" | "maltid"; input_tokens: number; output_tokens: number; cache_read_tokens?: number; created_at?: string }
        Update: { id?: string; member_id?: string; kind?: "chat" | "ukesprogram" | "gjennomgang" | "maltid"; input_tokens?: number; output_tokens?: number; cache_read_tokens?: number; created_at?: string }
        Relationships: [];
      };
      ai_weekly_reviews: {
        Row:    { member_id: string; week_start: string; text: string; created_at: string }
        Insert: { member_id: string; week_start: string; text: string; created_at?: string }
        Update: { member_id?: string; week_start?: string; text?: string; created_at?: string }
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_invite: { Args: { p_ttl_hours?: number; p_role?: "medlem" | "gjest" }; Returns: string };
      join_household: { Args: { p_code: string }; Returns: string };
      set_active_household: { Args: { p_hid: string }; Returns: undefined };
      add_child: { Args: { p_name: string; p_color: string }; Returns: string };
      leave_household: { Args: { p_hid: string }; Returns: string | null };
      create_household: { Args: { p_name: string }; Returns: string };
      create_calendar_feed: { Args: { p_label?: string }; Returns: string };
      get_feed_events: { Args: { p_token: string }; Returns: { event_id: string; title: string; location: string | null; notes: string | null; start_at: string; end_at: string; all_day: boolean; recurrence: string }[] };
      generate_meal_shopping_list_heim: { Args: { p_week_start: string }; Returns: string };
      rename_member: { Args: { p_member_id: string; p_name: string }; Returns: undefined };
      check_rate_limit: { Args: { p_endpoint: string; p_max: number; p_window_minutes: number }; Returns: boolean };
      my_member_ids: { Args: Record<string, never>; Returns: string };
      ai_check_rate_limit: { Args: { p_member_id: string; p_daily_max?: number; p_monthly_max?: number }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
