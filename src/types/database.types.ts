export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      match_participants: {
        Row: {
          id: string
          joined_at: string
          left_at: string | null
          match_id: string
          state: string
          team: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          left_at?: string | null
          match_id: string
          state?: string
          team: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          left_at?: string | null
          match_id?: string
          state?: string
          team?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'match_participants_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_participants_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      match_results: {
        Row: {
          created_at: string
          id: string
          match_id: string
          status: string
          submitted_at: string
          submitted_by_team: string
          submitted_by_user_id: string
          team_a_games: number
          team_b_games: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          status?: string
          submitted_at?: string
          submitted_by_team: string
          submitted_by_user_id: string
          team_a_games: number
          team_b_games: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          status?: string
          submitted_at?: string
          submitted_by_team?: string
          submitted_by_user_id?: string
          team_a_games?: number
          team_b_games?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'match_results_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_results_submitted_by_user_id_fkey'
            columns: ['submitted_by_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      match_state_transitions: {
        Row: {
          created_at: string
          from_status: string
          id: string
          match_id: string
          reason: string | null
          to_status: string
          triggered_by: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          from_status: string
          id?: string
          match_id: string
          reason?: string | null
          to_status: string
          triggered_by: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          from_status?: string
          id?: string
          match_id?: string
          reason?: string | null
          to_status?: string
          triggered_by?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'match_state_transitions_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_state_transitions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      matches: {
        Row: {
          city: string
          created_at: string
          creator_id: string
          description: string | null
          duration_target_games: number
          id: string
          location_privacy: string
          place_defined: boolean
          place_text: string | null
          start_at: string
          status: string
          team_a_name: string
          team_a_player_1: string | null
          team_a_player_2: string | null
          team_b_name: string
          team_b_player_1: string | null
          team_b_player_2: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          city: string
          created_at?: string
          creator_id: string
          description?: string | null
          duration_target_games: number
          id?: string
          location_privacy?: string
          place_defined?: boolean
          place_text?: string | null
          start_at: string
          status?: string
          team_a_name?: string
          team_a_player_1?: string | null
          team_a_player_2?: string | null
          team_b_name?: string
          team_b_player_1?: string | null
          team_b_player_2?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          city?: string
          created_at?: string
          creator_id?: string
          description?: string | null
          duration_target_games?: number
          id?: string
          location_privacy?: string
          place_defined?: boolean
          place_text?: string | null
          start_at?: string
          status?: string
          team_a_name?: string
          team_a_player_1?: string | null
          team_a_player_2?: string | null
          team_b_name?: string
          team_b_player_1?: string | null
          team_b_player_2?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: 'matches_creator_id_fkey'
            columns: ['creator_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      notification_queue: {
        Row: {
          attempts: number
          body: string
          created_at: string
          id: string
          max_attempts: number
          payload_json: Json | null
          scheduled_for: string
          sent_at: string | null
          status: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body: string
          created_at?: string
          id?: string
          max_attempts?: number
          payload_json?: Json | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          created_at?: string
          id?: string
          max_attempts?: number
          payload_json?: Json | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_queue_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          city: string | null
          created_at: string
          display_name: string
          id: string
          notify_email: boolean
          notify_push: boolean
          phone_e164: string
          photo_url: string | null
          push_token: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          display_name: string
          id: string
          notify_email?: boolean
          notify_push?: boolean
          phone_e164: string
          photo_url?: string | null
          push_token?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          display_name?: string
          id?: string
          notify_email?: boolean
          notify_push?: boolean
          phone_e164?: string
          photo_url?: string | null
          push_token?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          action_taken: string | null
          created_at: string
          id: string
          notes: string | null
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reports_reporter_id_fkey'
            columns: ['reporter_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reports_resolved_by_fkey'
            columns: ['resolved_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      result_confirmations: {
        Row: {
          comment: string | null
          created_at: string
          decision: string
          id: string
          match_result_id: string
          team: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          decision: string
          id?: string
          match_result_id: string
          team: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          decision?: string
          id?: string
          match_result_id?: string
          team?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'result_confirmations_match_result_id_fkey'
            columns: ['match_result_id']
            isOneToOne: false
            referencedRelation: 'match_results'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'result_confirmations_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_can_read_match: {
        Args: { p_match_id: string }
        Returns: boolean
      }
      auth_is_confirmed_in_match: {
        Args: { p_match_id: string }
        Returns: boolean
      }
      enqueue_notification: {
        Args: {
          p_body: string
          p_payload_json?: Json
          p_scheduled_for?: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      get_profile_with_phone: {
        Args: { p_match_id: string; p_profile_id: string }
        Returns: {
          city: string | null
          created_at: string
          display_name: string
          id: string
          notify_email: boolean
          notify_push: boolean
          phone_e164: string
          photo_url: string | null
          push_token: string | null
          role: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: '*'
          to: 'profiles'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_match_participant_display: {
        Args: { p_match_id: string }
        Returns: {
          participant_id: string
          match_id: string
          user_id: string
          team: string
          state: string
          joined_at: string
          left_at: string | null
          display_name: string
          photo_url: string | null
          city: string | null
        }[]
      }
      list_matches_awaiting_my_result_action: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          title: string
          start_at: string
          city: string
          status: string
          visibility: string
          creator_id: string
          match_result_id: string
        }[]
      }
      record_match_result_direct: {
        Args: {
          p_match_id: string
          p_team_a_games: number
          p_team_b_games: number
        }
        Returns: undefined
      }
      list_public_matches: {
        Args: {
          p_city?: string
          p_limit?: number
          p_min_free_slots?: number
          p_offset?: number
          p_search?: string
          p_start_after?: string
          p_start_before?: string
          p_status?: string
        }
        Returns: {
          city: string
          created_at: string
          creator_id: string
          description: string
          duration_target_games: number
          free_slots: number
          id: string
          location_privacy: string
          place_defined: boolean
          place_text: string
          slots_filled: number
          start_at: string
          status: string
          title: string
          total_count: number
          updated_at: string
          visibility: string
        }[]
      }
      process_match_state_transitions: { Args: never; Returns: undefined }
      profile_shares_confirmed_match_with_auth: {
        Args: { p_profile_id: string }
        Returns: boolean
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
