export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cash_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          league_id: string
          note: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          league_id: string
          note?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          league_id?: string
          note?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_transactions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      cfb_games: {
        Row: {
          away: string
          away_logo: string | null
          away_rank: number | null
          away_score: number | null
          home: string
          home_logo: string | null
          home_rank: number | null
          home_score: number | null
          id: string
          kickoff: string | null
          slot: string
          sort_order: number
          state: string
          week_num: number
        }
        Insert: {
          away: string
          away_logo?: string | null
          away_rank?: number | null
          away_score?: number | null
          home: string
          home_logo?: string | null
          home_rank?: number | null
          home_score?: number | null
          id: string
          kickoff?: string | null
          slot?: string
          sort_order?: number
          state?: string
          week_num: number
        }
        Update: {
          away?: string
          away_logo?: string | null
          away_rank?: number | null
          away_score?: number | null
          home?: string
          home_logo?: string | null
          home_rank?: number | null
          home_score?: number | null
          id?: string
          kickoff?: string | null
          slot?: string
          sort_order?: number
          state?: string
          week_num?: number
        }
        Relationships: []
      }
      cfb_pick_entries: {
        Row: {
          id: string
          picks: Json
          tiebreaker: number | null
          updated_at: string
          user_id: string
          week_num: number
        }
        Insert: {
          id?: string
          picks?: Json
          tiebreaker?: number | null
          updated_at?: string
          user_id: string
          week_num: number
        }
        Update: {
          id?: string
          picks?: Json
          tiebreaker?: number | null
          updated_at?: string
          user_id?: string
          week_num?: number
        }
        Relationships: []
      }
      cfb_rankings: {
        Row: {
          first_place_votes: number
          logo: string | null
          points: number
          previous: number | null
          rank: number
          record: string
          short_name: string
          team: string
          trend: string
          updated_at: string
        }
        Insert: {
          first_place_votes?: number
          logo?: string | null
          points?: number
          previous?: number | null
          rank: number
          record?: string
          short_name?: string
          team: string
          trend?: string
          updated_at?: string
        }
        Update: {
          first_place_votes?: number
          logo?: string | null
          points?: number
          previous?: number | null
          rank?: number
          record?: string
          short_name?: string
          team?: string
          trend?: string
          updated_at?: string
        }
        Relationships: []
      }
      cfb_standings: {
        Row: {
          correct: number
          id: string
          missed: number
          rank: number
          tb_diff: number | null
          updated_at: string
          user_id: string
          username: string
          week_num: number
        }
        Insert: {
          correct?: number
          id?: string
          missed?: number
          rank?: number
          tb_diff?: number | null
          updated_at?: string
          user_id: string
          username?: string
          week_num: number
        }
        Update: {
          correct?: number
          id?: string
          missed?: number
          rank?: number
          tb_diff?: number | null
          updated_at?: string
          user_id?: string
          username?: string
          week_num?: number
        }
        Relationships: []
      }
      cfb_weeks: {
        Row: {
          label: string
          locked: boolean
          tiebreaker_game_id: string | null
          week_num: number
        }
        Insert: {
          label: string
          locked?: boolean
          tiebreaker_game_id?: string | null
          week_num: number
        }
        Update: {
          label?: string
          locked?: boolean
          tiebreaker_game_id?: string | null
          week_num?: number
        }
        Relationships: []
      }
      duel_picks: {
        Row: {
          created_at: string
          duel_id: string
          id: string
          picks: Json
          reasoning: Json
          tiebreaker: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duel_id: string
          id?: string
          picks?: Json
          reasoning?: Json
          tiebreaker?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duel_id?: string
          id?: string
          picks?: Json
          reasoning?: Json
          tiebreaker?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duel_picks_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_records: {
        Row: {
          best_streak: number
          created_at: string
          gods_wins: number
          losses: number
          streak: number
          ties: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          best_streak?: number
          created_at?: string
          gods_wins?: number
          losses?: number
          streak?: number
          ties?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          best_streak?: number
          created_at?: string
          gods_wins?: number
          losses?: number
          streak?: number
          ties?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      duels: {
        Row: {
          challenger_correct: number
          challenger_id: string
          created_at: string
          gods_won: boolean
          id: string
          opponent_correct: number
          opponent_id: string | null
          settled_at: string | null
          sport: string
          status: string
          updated_at: string
          vs_gods: boolean
          week_num: number
          winner_id: string | null
        }
        Insert: {
          challenger_correct?: number
          challenger_id: string
          created_at?: string
          gods_won?: boolean
          id?: string
          opponent_correct?: number
          opponent_id?: string | null
          settled_at?: string | null
          sport?: string
          status?: string
          updated_at?: string
          vs_gods?: boolean
          week_num: number
          winner_id?: string | null
        }
        Update: {
          challenger_correct?: number
          challenger_id?: string
          created_at?: string
          gods_won?: boolean
          id?: string
          opponent_correct?: number
          opponent_id?: string | null
          settled_at?: string | null
          sport?: string
          status?: string
          updated_at?: string
          vs_gods?: boolean
          week_num?: number
          winner_id?: string | null
        }
        Relationships: []
      }
      entry_payments: {
        Row: {
          amount: number
          created_at: string
          entry_no: number
          id: string
          league_id: string
          marked_by: string
          updated_at: string
          user_id: string
          week_num: number
        }
        Insert: {
          amount?: number
          created_at?: string
          entry_no?: number
          id?: string
          league_id: string
          marked_by: string
          updated_at?: string
          user_id: string
          week_num: number
        }
        Update: {
          amount?: number
          created_at?: string
          entry_no?: number
          id?: string
          league_id?: string
          marked_by?: string
          updated_at?: string
          user_id?: string
          week_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "entry_payments_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          away: string
          away_score: number | null
          home: string
          home_score: number | null
          id: string
          kickoff: string | null
          slot: string
          sort_order: number
          state: string
          week_num: number
        }
        Insert: {
          away: string
          away_score?: number | null
          home: string
          home_score?: number | null
          id: string
          kickoff?: string | null
          slot?: string
          sort_order?: number
          state?: string
          week_num: number
        }
        Update: {
          away?: string
          away_score?: number | null
          home?: string
          home_score?: number | null
          id?: string
          kickoff?: string | null
          slot?: string
          sort_order?: number
          state?: string
          week_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "games_week_num_fkey"
            columns: ["week_num"]
            isOneToOne: false
            referencedRelation: "weeks"
            referencedColumns: ["week_num"]
          },
        ]
      }
      league_bank_deposits: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          league_id: string
          note: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          league_id: string
          note?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          league_id?: string
          note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_bank_deposits_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          id: string
          joined_at: string
          league_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          league_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          league_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          league_id: string
          pinned: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          league_id: string
          pinned?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          league_id?: string
          pinned?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_messages_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      league_standings: {
        Row: {
          correct: number
          entry_no: number
          id: string
          league_id: string
          missed: number
          rank: number
          submitted: boolean
          tb_diff: number | null
          updated_at: string
          user_id: string
          week_num: number
        }
        Insert: {
          correct?: number
          entry_no?: number
          id?: string
          league_id: string
          missed?: number
          rank?: number
          submitted?: boolean
          tb_diff?: number | null
          updated_at?: string
          user_id: string
          week_num: number
        }
        Update: {
          correct?: number
          entry_no?: number
          id?: string
          league_id?: string
          missed?: number
          rank?: number
          submitted?: boolean
          tb_diff?: number | null
          updated_at?: string
          user_id?: string
          week_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "league_standings_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          cashapp_handle: string
          chat_locked: boolean
          code: string
          commissioner_cut_enabled: boolean
          commissioner_cut_pct: number
          created_at: string
          entry_fee: number
          id: string
          name: string
          owner_id: string
          pots_auto: boolean
          rules: string
          season_entry_fee: number
          season_pot: number
          season_pot_auto: boolean
          season_pot_pct: number
          sport: string
          sunday_only: boolean
          sunday_only_from_week: number
          weekly_pot: number
        }
        Insert: {
          cashapp_handle?: string
          chat_locked?: boolean
          code: string
          commissioner_cut_enabled?: boolean
          commissioner_cut_pct?: number
          created_at?: string
          entry_fee?: number
          id?: string
          name: string
          owner_id: string
          pots_auto?: boolean
          rules?: string
          season_entry_fee?: number
          season_pot?: number
          season_pot_auto?: boolean
          season_pot_pct?: number
          sport?: string
          sunday_only?: boolean
          sunday_only_from_week?: number
          weekly_pot?: number
        }
        Update: {
          cashapp_handle?: string
          chat_locked?: boolean
          code?: string
          commissioner_cut_enabled?: boolean
          commissioner_cut_pct?: number
          created_at?: string
          entry_fee?: number
          id?: string
          name?: string
          owner_id?: string
          pots_auto?: boolean
          rules?: string
          season_entry_fee?: number
          season_pot?: number
          season_pot_auto?: boolean
          season_pot_pct?: number
          sport?: string
          sunday_only?: boolean
          sunday_only_from_week?: number
          weekly_pot?: number
        }
        Relationships: []
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          league_id: string
          note: string
          pot_type: string
          updated_at: string
          user_id: string
          week_num: number | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          league_id: string
          note?: string
          pot_type: string
          updated_at?: string
          user_id: string
          week_num?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          league_id?: string
          note?: string
          pot_type?: string
          updated_at?: string
          user_id?: string
          week_num?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_entries: {
        Row: {
          entry_no: number
          id: string
          league_id: string
          picks: Json
          tiebreaker: number | null
          updated_at: string
          user_id: string
          week_num: number
        }
        Insert: {
          entry_no?: number
          id?: string
          league_id: string
          picks?: Json
          tiebreaker?: number | null
          updated_at?: string
          user_id: string
          week_num: number
        }
        Update: {
          entry_no?: number
          id?: string
          league_id?: string
          picks?: Json
          tiebreaker?: number | null
          updated_at?: string
          user_id?: string
          week_num?: number
        }
        Relationships: [
          {
            foreignKeyName: "pick_entries_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          membership_exempt: boolean
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          membership_exempt?: boolean
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          membership_exempt?: boolean
          username?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          league_id: string | null
          league_invite_code: string
          referred_credit_amount: number
          referred_user_id: string
          referrer_credit_amount: number
          referrer_user_id: string
          rewarded_at: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_event_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          league_id?: string | null
          league_invite_code?: string
          referred_credit_amount?: number
          referred_user_id: string
          referrer_credit_amount?: number
          referrer_user_id: string
          rewarded_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_event_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          league_id?: string | null
          league_invite_code?: string
          referred_credit_amount?: number
          referred_user_id?: string
          referrer_credit_amount?: number
          referrer_user_id?: string
          rewarded_at?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_event_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      season_entry_payments: {
        Row: {
          amount: number
          created_at: string
          entry_no: number
          id: string
          league_id: string
          marked_by: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          entry_no?: number
          id?: string
          league_id: string
          marked_by: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          entry_no?: number
          id?: string
          league_id?: string
          marked_by?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_entry_payments_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          id: string
          processed_at: string
          type: string
        }
        Insert: {
          id: string
          processed_at?: string
          type: string
        }
        Update: {
          id?: string
          processed_at?: string
          type?: string
        }
        Relationships: []
      }
      szn_credit_ledger: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      szn_memberships: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          ended_at: string | null
          last_payment_at: string | null
          last_payment_failed_at: string | null
          price_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          ended_at?: string | null
          last_payment_at?: string | null
          last_payment_failed_at?: string | null
          price_id?: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          ended_at?: string | null
          last_payment_at?: string | null
          last_payment_failed_at?: string | null
          price_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weeks: {
        Row: {
          label: string
          locked: boolean
          tiebreaker_game_id: string | null
          week_num: number
        }
        Insert: {
          label: string
          locked?: boolean
          tiebreaker_game_id?: string | null
          week_num: number
        }
        Update: {
          label?: string
          locked?: boolean
          tiebreaker_game_id?: string | null
          week_num?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_league:
        | {
            Args: { _name: string; _rules: string; _user_id: string }
            Returns: string
          }
        | {
            Args: {
              _name: string
              _rules: string
              _sport?: string
              _user_id: string
            }
            Returns: string
          }
      admin_join_league_by_code: {
        Args: { _code: string; _user_id: string }
        Returns: string
      }
      generate_league_code: { Args: never; Returns: string }
      recompute_all_league_standings: { Args: never; Returns: number }
      recompute_cfb_standings: { Args: never; Returns: undefined }
      recompute_league_standings: {
        Args: { _league_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
