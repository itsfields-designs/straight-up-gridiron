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
      league_standings: {
        Row: {
          correct: number
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
          code: string
          created_at: string
          entry_fee: number
          id: string
          name: string
          owner_id: string
          rules: string
          season_pot: number
          weekly_pot: number
        }
        Insert: {
          code: string
          created_at?: string
          entry_fee?: number
          id?: string
          name: string
          owner_id: string
          rules?: string
          season_pot?: number
          weekly_pot?: number
        }
        Update: {
          code?: string
          created_at?: string
          entry_fee?: number
          id?: string
          name?: string
          owner_id?: string
          rules?: string
          season_pot?: number
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
          id: string
          league_id: string
          picks: Json
          tiebreaker: number | null
          updated_at: string
          user_id: string
          week_num: number
        }
        Insert: {
          id?: string
          league_id: string
          picks?: Json
          tiebreaker?: number | null
          updated_at?: string
          user_id: string
          week_num: number
        }
        Update: {
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
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          username?: string
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
      admin_create_league: {
        Args: { _name: string; _rules: string; _user_id: string }
        Returns: string
      }
      admin_join_league_by_code: {
        Args: { _code: string; _user_id: string }
        Returns: string
      }
      generate_league_code: { Args: never; Returns: string }
      recompute_all_league_standings: { Args: never; Returns: number }
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
