export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_admin_id_fkey'
            columns: ['admin_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'audit_logs_admin_id_fkey'
            columns: ['admin_id']
            isOneToOne: false
            referencedRelation: 'profiles_public'
            referencedColumns: ['id']
          },
        ]
      }
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
          {
            foreignKeyName: 'match_participants_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles_public'
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
          {
            foreignKeyName: 'match_results_submitted_by_user_id_fkey'
            columns: ['submitted_by_user_id']
            isOneToOne: false
            referencedRelation: 'profiles_public'
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
          {
            foreignKeyName: 'match_state_transitions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles_public'
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
          tournament_bracket_position: number | null
          tournament_id: string | null
          tournament_is_bye: boolean
          tournament_pair_a_id: string | null
          tournament_pair_b_id: string | null
          tournament_round_size: number | null
          tournament_winner_pair_id: string | null
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
          tournament_bracket_position?: number | null
          tournament_id?: string | null
          tournament_is_bye?: boolean
          tournament_pair_a_id?: string | null
          tournament_pair_b_id?: string | null
          tournament_round_size?: number | null
          tournament_winner_pair_id?: string | null
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
          tournament_bracket_position?: number | null
          tournament_id?: string | null
          tournament_is_bye?: boolean
          tournament_pair_a_id?: string | null
          tournament_pair_b_id?: string | null
          tournament_round_size?: number | null
          tournament_winner_pair_id?: string | null
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
          {
            foreignKeyName: 'matches_creator_id_fkey'
            columns: ['creator_id']
            isOneToOne: false
            referencedRelation: 'profiles_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_tournament_pair_a_id_fkey'
            columns: ['tournament_pair_a_id']
            isOneToOne: false
            referencedRelation: 'tournament_pairs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_tournament_pair_b_id_fkey'
            columns: ['tournament_pair_b_id']
            isOneToOne: false
            referencedRelation: 'tournament_pairs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_tournament_winner_pair_id_fkey'
            columns: ['tournament_winner_pair_id']
            isOneToOne: false
            referencedRelation: 'tournament_pairs'
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
          {
            foreignKeyName: 'notification_queue_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles_public'
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
          notify_on_join: boolean
          notify_on_match_change: boolean
          notify_on_reminder: boolean
          notify_on_result: boolean
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
          notify_on_join?: boolean
          notify_on_match_change?: boolean
          notify_on_reminder?: boolean
          notify_on_result?: boolean
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
          notify_on_join?: boolean
          notify_on_match_change?: boolean
          notify_on_reminder?: boolean
          notify_on_result?: boolean
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
            foreignKeyName: 'reports_reporter_id_fkey'
            columns: ['reporter_id']
            isOneToOne: false
            referencedRelation: 'profiles_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reports_resolved_by_fkey'
            columns: ['resolved_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'reports_resolved_by_fkey'
            columns: ['resolved_by']
            isOneToOne: false
            referencedRelation: 'profiles_public'
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
          {
            foreignKeyName: 'result_confirmations_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles_public'
            referencedColumns: ['id']
          },
        ]
      }
      tournament_pairs: {
        Row: {
          created_at: string
          created_by_user_id: string
          id: string
          is_eliminated: boolean
          name: string
          player_a_text: string | null
          player_a_user_id: string | null
          player_b_text: string | null
          player_b_user_id: string | null
          tournament_id: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          id?: string
          is_eliminated?: boolean
          name: string
          player_a_text?: string | null
          player_a_user_id?: string | null
          player_b_text?: string | null
          player_b_user_id?: string | null
          tournament_id: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          id?: string
          is_eliminated?: boolean
          name?: string
          player_a_text?: string | null
          player_a_user_id?: string | null
          player_b_text?: string | null
          player_b_user_id?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tournament_pairs_created_by_user_id_fkey'
            columns: ['created_by_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_pairs_created_by_user_id_fkey'
            columns: ['created_by_user_id']
            isOneToOne: false
            referencedRelation: 'profiles_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_pairs_player_a_user_id_fkey'
            columns: ['player_a_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_pairs_player_a_user_id_fkey'
            columns: ['player_a_user_id']
            isOneToOne: false
            referencedRelation: 'profiles_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_pairs_player_b_user_id_fkey'
            columns: ['player_b_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_pairs_player_b_user_id_fkey'
            columns: ['player_b_user_id']
            isOneToOne: false
            referencedRelation: 'profiles_public'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournament_pairs_tournament_id_fkey'
            columns: ['tournament_id']
            isOneToOne: false
            referencedRelation: 'tournaments'
            referencedColumns: ['id']
          },
        ]
      }
      tournaments: {
        Row: {
          bracket_generated_at: string | null
          city: string
          created_at: string
          creator_id: string
          creator_joins_as_player: boolean
          description: string | null
          duration_target_games: number
          id: string
          location_privacy: string
          notes: string | null
          place_defined: boolean
          place_text: string | null
          start_at: string
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          bracket_generated_at?: string | null
          city: string
          created_at?: string
          creator_id: string
          creator_joins_as_player?: boolean
          description?: string | null
          duration_target_games: number
          id?: string
          location_privacy?: string
          notes?: string | null
          place_defined?: boolean
          place_text?: string | null
          start_at: string
          status?: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          bracket_generated_at?: string | null
          city?: string
          created_at?: string
          creator_id?: string
          creator_joins_as_player?: boolean
          description?: string | null
          duration_target_games?: number
          id?: string
          location_privacy?: string
          notes?: string | null
          place_defined?: boolean
          place_text?: string | null
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tournaments_creator_id_fkey'
            columns: ['creator_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tournaments_creator_id_fkey'
            columns: ['creator_id']
            isOneToOne: false
            referencedRelation: 'profiles_public'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      profiles_public: {
        Row: {
          city: string | null
          display_name: string | null
          id: string | null
          photo_url: string | null
        }
        Insert: {
          city?: string | null
          display_name?: string | null
          id?: string | null
          photo_url?: string | null
        }
        Update: {
          city?: string | null
          display_name?: string | null
          id?: string | null
          photo_url?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_tournament_pair: {
        Args: {
          p_name: string
          p_player_a_text?: string
          p_player_a_user_id?: string
          p_player_b_text?: string
          p_player_b_user_id?: string
          p_tournament_id: string
        }
        Returns: {
          created_at: string
          created_by_user_id: string
          id: string
          is_eliminated: boolean
          name: string
          player_a_text: string | null
          player_a_user_id: string | null
          player_b_text: string | null
          player_b_user_id: string | null
          tournament_id: string
        }
        SetofOptions: {
          from: '*'
          to: 'tournament_pairs'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_assert_is_admin: { Args: never; Returns: undefined }
      admin_get_analytics: {
        Args: never
        Returns: {
          matches_this_week: number
          mau: number
          pct_confirmed: number
          pct_disputed: number
          total_matches: number
        }[]
      }
      admin_get_matches_by_city: {
        Args: { p_lim?: number }
        Returns: {
          city: string
          count: number
        }[]
      }
      admin_get_matches_by_week: {
        Args: { p_weeks?: number }
        Returns: {
          count: number
          week_start: string
        }[]
      }
      admin_get_user_ranking: {
        Args: { p_lim?: number }
        Returns: {
          display_name: string
          match_count: number
          user_id: string
        }[]
      }
      advance_tournament_round: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      auth_can_read_match: { Args: { p_match_id: string }; Returns: boolean }
      auth_can_read_tournament: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
      auth_is_admin: { Args: never; Returns: boolean }
      auth_is_confirmed_in_match: {
        Args: { p_match_id: string }
        Returns: boolean
      }
      create_tournament: {
        Args: {
          p_city: string
          p_creator_joins_as_player?: boolean
          p_description?: string
          p_duration_target_games: number
          p_location_privacy?: string
          p_notes?: string
          p_place_defined?: boolean
          p_place_text?: string
          p_start_at: string
          p_title: string
          p_visibility?: string
        }
        Returns: {
          bracket_generated_at: string | null
          city: string
          created_at: string
          creator_id: string
          creator_joins_as_player: boolean
          description: string | null
          duration_target_games: number
          id: string
          location_privacy: string
          notes: string | null
          place_defined: boolean
          place_text: string | null
          start_at: string
          status: string
          title: string
          updated_at: string
          visibility: string
        }
        SetofOptions: {
          from: '*'
          to: 'tournaments'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_user_account_data: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      deleted_user_id: { Args: never; Returns: string }
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
      finalize_tournament_if_final_match: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      generate_tournament_bracket: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      get_own_profile: {
        Args: never
        Returns: {
          city: string | null
          created_at: string
          display_name: string
          id: string
          notify_email: boolean
          notify_on_join: boolean
          notify_on_match_change: boolean
          notify_on_reminder: boolean
          notify_on_result: boolean
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
      get_profile_with_phone: {
        Args: { p_match_id: string; p_profile_id: string }
        Returns: {
          city: string | null
          created_at: string
          display_name: string
          id: string
          notify_email: boolean
          notify_on_join: boolean
          notify_on_match_change: boolean
          notify_on_reminder: boolean
          notify_on_result: boolean
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
      get_public_profile: {
        Args: { p_profile_id: string }
        Returns: {
          city: string
          display_name: string
          id: string
          photo_url: string
        }[]
      }
      get_viewable_user_profile: {
        Args: { p_user_id: string }
        Returns: {
          city: string
          display_name: string
          id: string
          phone_e164: string
        }[]
      }
      list_user_viewable_matches: {
        Args: { p_user_id: string }
        Returns: {
          city: string
          creator_id: string
          id: string
          place_defined: boolean
          place_text: string
          start_at: string
          status: string
          team_a_games: number
          team_b_games: number
          title: string
          user_team: string
          visibility: string
        }[]
      }
      join_tournament_pair: {
        Args: { p_as_text?: string; p_pair_id: string; p_slot: string }
        Returns: {
          created_at: string
          created_by_user_id: string
          id: string
          is_eliminated: boolean
          name: string
          player_a_text: string | null
          player_a_user_id: string | null
          player_b_text: string | null
          player_b_user_id: string | null
          tournament_id: string
        }
        SetofOptions: {
          from: '*'
          to: 'tournament_pairs'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_tournament_pair: {
        Args: { p_pair_id: string }
        Returns: undefined
      }
      update_tournament_pair: {
        Args: {
          p_name: string
          p_pair_id: string
          p_player_a_text: string
          p_player_b_text: string
        }
        Returns: {
          created_at: string
          created_by_user_id: string
          id: string
          is_eliminated: boolean
          name: string
          name_is_custom: boolean
          player_a_text: string | null
          player_a_user_id: string | null
          player_b_text: string | null
          player_b_user_id: string | null
          tournament_id: string
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'tournament_pairs'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_match_participant_display: {
        Args: { p_match_id: string }
        Returns: {
          city: string
          display_name: string
          joined_at: string
          left_at: string
          match_id: string
          participant_id: string
          photo_url: string
          state: string
          team: string
          user_id: string
        }[]
      }
      list_matches_awaiting_my_result_action: {
        Args: never
        Returns: {
          city: string
          creator_id: string
          id: string
          match_result_id: string
          place_defined: boolean
          place_text: string | null
          start_at: string
          status: string
          title: string
          visibility: string
        }[]
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
      list_tournament_bracket: {
        Args: { p_tournament_id: string }
        Returns: {
          bracket_position: number
          is_bye: boolean
          match_id: string
          match_status: string
          pair_a_id: string
          pair_a_name: string
          pair_b_id: string
          pair_b_name: string
          round_size: number
          start_at: string
          team_a_games: number
          team_b_games: number
          winner_pair_id: string
        }[]
      }
      match_effective_roster_filled: {
        Args: { p_match_id: string }
        Returns: number
      }
      match_registered_slots_filled: {
        Args: { p_match_id: string }
        Returns: number
      }
      match_text_slots_filled: {
        Args: { m: Database['public']['Tables']['matches']['Row'] }
        Returns: number
      }
      next_pow2: { Args: { n: number }; Returns: number }
      populate_match_roster_from_pair: {
        Args: { p_match_id: string; p_pair_id: string; p_team: string }
        Returns: undefined
      }
      process_match_state_transitions: { Args: never; Returns: undefined }
      profile_shares_confirmed_match_with_auth: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      propagate_tournament_winners: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      record_match_result_direct: {
        Args: {
          p_match_id: string
          p_team_a_games: number
          p_team_b_games: number
        }
        Returns: undefined
      }
      record_tournament_match_result_as_referee: {
        Args: {
          p_match_id: string
          p_team_a_games: number
          p_team_b_games: number
        }
        Returns: undefined
      }
      rival_team_has_registered_participant: {
        Args: { p_match_id: string; p_submitted_by_team: string }
        Returns: boolean
      }
      submit_match_result: {
        Args: {
          p_match_id: string
          p_team_a_games: number
          p_team_b_games: number
        }
        Returns: {
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
        SetofOptions: {
          from: '*'
          to: 'match_results'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      tournament_match_title: {
        Args: {
          p_is_bye?: boolean
          p_round_size: number
          p_tournament_title: string
        }
        Returns: string
      }
      tournament_round_name: { Args: { p_round_size: number }; Returns: string }
      user_is_in_tournament_pair: {
        Args: {
          p_exclude_pair_id?: string
          p_tournament_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      validate_match_scores: {
        Args: {
          p_duration_target_games: number
          p_team_a_games: number
          p_team_b_games: number
        }
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
