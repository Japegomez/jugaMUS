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
          password_hash: string | null
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
          league_id: string | null
          league_is_second_leg: boolean
          league_pair_a_id: string | null
          league_pair_b_id: string | null
          league_round_number: number | null
          tournament_bracket_position: number | null
          tournament_id: string | null
          tournament_is_bye: boolean
          tournament_is_third_place: boolean
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
          league_id?: string | null
          league_is_second_leg?: boolean
          league_pair_a_id?: string | null
          league_pair_b_id?: string | null
          league_round_number?: number | null
          location_privacy?: string
          password_hash?: string | null
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
          tournament_is_third_place?: boolean
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
          league_id?: string | null
          league_is_second_leg?: boolean
          league_pair_a_id?: string | null
          league_pair_b_id?: string | null
          league_round_number?: number | null
          location_privacy?: string
          password_hash?: string | null
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
          tournament_is_third_place?: boolean
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
            foreignKeyName: 'matches_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_league_pair_a_id_fkey'
            columns: ['league_pair_a_id']
            isOneToOne: false
            referencedRelation: 'league_pairs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'matches_league_pair_b_id_fkey'
            columns: ['league_pair_b_id']
            isOneToOne: false
            referencedRelation: 'league_pairs'
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
      player_stats: {
        Row: {
          badges: Json
          best_win_streak: number
          current_streak: number
          elo_rating: number
          last_form: Json
          losses: number
          matches_played: number
          tournament_finals: number
          tournament_thirds: number
          tournaments_won: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          badges?: Json
          best_win_streak?: number
          current_streak?: number
          elo_rating?: number
          last_form?: Json
          losses?: number
          matches_played?: number
          tournament_finals?: number
          tournament_thirds?: number
          tournaments_won?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          badges?: Json
          best_win_streak?: number
          current_streak?: number
          elo_rating?: number
          last_form?: Json
          losses?: number
          matches_played?: number
          tournament_finals?: number
          tournament_thirds?: number
          tournaments_won?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: 'player_stats_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'player_stats_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles_public'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          badge_showcase: string[]
          city: string | null
          created_at: string
          display_name: string
          id: string
          notify_on_join: boolean
          notify_on_match_cancel: boolean
          notify_on_match_edit: boolean
          notify_on_match_start: boolean
          notify_on_reminder_24h: boolean
          notify_on_reminder_2h: boolean
          notify_on_reminder_in_progress: boolean
          notify_on_result: boolean
          notify_on_friend_request: boolean
          notify_on_match_invitation: boolean
          notify_push: boolean
          phone_e164: string
          photo_url: string | null
          push_token: string | null
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          badge_showcase?: string[]
          city?: string | null
          created_at?: string
          display_name: string
          id: string
          notify_on_join?: boolean
          notify_on_match_cancel?: boolean
          notify_on_match_edit?: boolean
          notify_on_match_start?: boolean
          notify_on_reminder_24h?: boolean
          notify_on_reminder_2h?: boolean
          notify_on_reminder_in_progress?: boolean
          notify_on_result?: boolean
          notify_on_friend_request?: boolean
          notify_on_match_invitation?: boolean
          notify_push?: boolean
          phone_e164: string
          photo_url?: string | null
          push_token?: string | null
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          badge_showcase?: string[]
          city?: string | null
          created_at?: string
          display_name?: string
          id?: string
          notify_on_join?: boolean
          notify_on_match_cancel?: boolean
          notify_on_match_edit?: boolean
          notify_on_match_start?: boolean
          notify_on_reminder_24h?: boolean
          notify_on_reminder_2h?: boolean
          notify_on_reminder_in_progress?: boolean
          notify_on_result?: boolean
          notify_on_friend_request?: boolean
          notify_on_match_invitation?: boolean
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
      user_feedback: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_feedback_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_feedback_user_id_fkey'
            columns: ['user_id']
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
      league_challenges: {
        Row: {
          challenged_pair_id: string
          challenger_pair_id: string
          created_at: string
          created_by_user_id: string
          id: string
          league_id: string
          match_id: string | null
          responded_at: string | null
          status: string
        }
        Insert: {
          challenged_pair_id: string
          challenger_pair_id: string
          created_at?: string
          created_by_user_id: string
          id?: string
          league_id: string
          match_id?: string | null
          responded_at?: string | null
          status?: string
        }
        Update: {
          challenged_pair_id?: string
          challenger_pair_id?: string
          created_at?: string
          created_by_user_id?: string
          id?: string
          league_id?: string
          match_id?: string | null
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'league_challenges_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
        ]
      }
      league_pairs: {
        Row: {
          created_at: string
          created_by_user_id: string
          current_elo: number
          id: string
          joined_at: string
          league_id: string
          name: string
          name_is_custom: boolean
          player_a_text: string | null
          player_a_user_id: string | null
          player_b_text: string | null
          player_b_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id: string
          current_elo?: number
          id?: string
          joined_at?: string
          league_id: string
          name: string
          name_is_custom?: boolean
          player_a_text?: string | null
          player_a_user_id?: string | null
          player_b_text?: string | null
          player_b_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          current_elo?: number
          id?: string
          joined_at?: string
          league_id?: string
          name?: string
          name_is_custom?: boolean
          player_a_text?: string | null
          player_a_user_id?: string | null
          player_b_text?: string | null
          player_b_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'league_pairs_created_by_user_id_fkey'
            columns: ['created_by_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_pairs_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_pairs_player_a_user_id_fkey'
            columns: ['player_a_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_pairs_player_b_user_id_fkey'
            columns: ['player_b_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      league_password_grants: {
        Row: {
          granted_at: string
          league_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          league_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          league_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'league_password_grants_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
        ]
      }
      league_rating_history: {
        Row: {
          created_at: string
          elo_after: number
          elo_before: number
          elo_delta: number
          id: string
          league_id: string
          match_id: string
          pair_id: string
        }
        Insert: {
          created_at?: string
          elo_after: number
          elo_before: number
          elo_delta: number
          id?: string
          league_id: string
          match_id: string
          pair_id: string
        }
        Update: {
          created_at?: string
          elo_after?: number
          elo_before?: number
          elo_delta?: number
          id?: string
          league_id?: string
          match_id?: string
          pair_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'league_rating_history_league_id_fkey'
            columns: ['league_id']
            isOneToOne: false
            referencedRelation: 'leagues'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'league_rating_history_pair_id_fkey'
            columns: ['pair_id']
            isOneToOne: false
            referencedRelation: 'league_pairs'
            referencedColumns: ['id']
          },
        ]
      }
      leagues: {
        Row: {
          city: string
          created_at: string
          creator_id: string
          description: string | null
          duration_target_games: number
          elo_initial: number
          elo_k_factor: number
          end_at: string | null
          fixtures_generated_at: string | null
          format: string
          id: string
          location_privacy: string
          notes: string | null
          password_hash: string | null
          place_defined: boolean
          place_text: string | null
          start_at: string
          status: string
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
          elo_initial?: number
          elo_k_factor?: number
          end_at?: string | null
          fixtures_generated_at?: string | null
          format: string
          id?: string
          location_privacy?: string
          notes?: string | null
          password_hash?: string | null
          place_defined?: boolean
          place_text?: string | null
          start_at: string
          status?: string
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
          elo_initial?: number
          elo_k_factor?: number
          end_at?: string | null
          fixtures_generated_at?: string | null
          format?: string
          id?: string
          location_privacy?: string
          notes?: string | null
          password_hash?: string | null
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
            foreignKeyName: 'leagues_creator_id_fkey'
            columns: ['creator_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      tournament_pairs: {
        Row: {
          created_at: string
          created_by_user_id: string
          entry_fee_paid: boolean
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
        Insert: {
          created_at?: string
          created_by_user_id: string
          entry_fee_paid?: boolean
          id?: string
          is_eliminated?: boolean
          name: string
          name_is_custom?: boolean
          player_a_text?: string | null
          player_a_user_id?: string | null
          player_b_text?: string | null
          player_b_user_id?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string
          entry_fee_paid?: boolean
          id?: string
          is_eliminated?: boolean
          name?: string
          name_is_custom?: boolean
          player_a_text?: string | null
          player_a_user_id?: string | null
          player_b_text?: string | null
          player_b_user_id?: string | null
          tournament_id?: string
          updated_at?: string
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
          entry_fee: number | null
          id: string
          include_third_place: boolean
          location_privacy: string
          notes: string | null
          password_hash: string | null
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
          entry_fee?: number | null
          id?: string
          include_third_place?: boolean
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
          entry_fee?: number | null
          id?: string
          include_third_place?: boolean
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
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          message: string | null
          requester_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          message?: string | null
          requester_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          message?: string | null
          requester_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'friendships_addressee_id_fkey'
            columns: ['addressee_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'friendships_requester_id_fkey'
            columns: ['requester_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      match_invitations: {
        Row: {
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          match_id: string
          responded_at: string | null
          status: string
          team: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          match_id: string
          responded_at?: string | null
          status?: string
          team: string
        }
        Update: {
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          match_id?: string
          responded_at?: string | null
          status?: string
          team?: string
        }
        Relationships: [
          {
            foreignKeyName: 'match_invitations_invitee_id_fkey'
            columns: ['invitee_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_invitations_inviter_id_fkey'
            columns: ['inviter_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'match_invitations_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
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
      accept_league_challenge: {
        Args: { p_challenge_id: string }
        Returns: {
          challenged_pair_id: string
          challenger_pair_id: string
          created_at: string
          created_by_user_id: string
          id: string
          league_id: string
          match_id: string | null
          responded_at: string | null
          status: string
        }
        SetofOptions: {
          from: '*'
          to: 'league_challenges'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_league_pair: {
        Args: {
          p_league_id: string
          p_name?: string
          p_player_a_text?: string
          p_player_a_user_id?: string
          p_player_b_text?: string
          p_player_b_user_id?: string
        }
        Returns: {
          created_at: string
          created_by_user_id: string
          current_elo: number
          id: string
          joined_at: string
          league_id: string
          name: string
          name_is_custom: boolean
          player_a_text: string | null
          player_a_user_id: string | null
          player_b_text: string | null
          player_b_user_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'league_pairs'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      add_tournament_pair: {
        Args: {
          p_entry_fee_paid?: boolean
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
          entry_fee_paid: boolean
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
      auth_can_read_league: { Args: { p_league_id: string }; Returns: boolean }
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
      cancel_league: {
        Args: { p_league_id: string }
        Returns: {
          city: string
          created_at: string
          creator_id: string
          description: string | null
          duration_target_games: number
          elo_initial: number
          elo_k_factor: number
          end_at: string | null
          fixtures_generated_at: string | null
          format: string
          id: string
          location_privacy: string
          notes: string | null
          password_hash: string | null
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
          to: 'leagues'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_tournament: {
        Args: { p_tournament_id: string }
        Returns: {
          bracket_generated_at: string | null
          city: string
          created_at: string
          creator_id: string
          creator_joins_as_player: boolean
          description: string | null
          duration_target_games: number
          entry_fee: number | null
          id: string
          include_third_place: boolean
          location_privacy: string
          notes: string | null
          password_hash: string | null
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
      create_league: {
        Args: {
          p_city: string
          p_description?: string
          p_duration_target_games: number
          p_elo_initial?: number
          p_elo_k_factor?: number
          p_end_at?: string
          p_format: string
          p_location_privacy?: string
          p_notes?: string
          p_place_defined?: boolean
          p_place_text?: string
          p_start_at: string
          p_title: string
          p_visibility?: string
        }
        Returns: {
          city: string
          created_at: string
          creator_id: string
          description: string | null
          duration_target_games: number
          elo_initial: number
          elo_k_factor: number
          end_at: string | null
          fixtures_generated_at: string | null
          format: string
          id: string
          location_privacy: string
          notes: string | null
          password_hash: string | null
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
          to: 'leagues'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_league_challenge: {
        Args: { p_challenged_pair_id: string; p_league_id: string }
        Returns: {
          challenged_pair_id: string
          challenger_pair_id: string
          created_at: string
          created_by_user_id: string
          id: string
          league_id: string
          match_id: string | null
          responded_at: string | null
          status: string
        }
        SetofOptions: {
          from: '*'
          to: 'league_challenges'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_league_fixtures: {
        Args: { p_league_id: string }
        Returns: undefined
      }
      grant_league_password_access: {
        Args: { p_league_id: string; p_password: string }
        Returns: undefined
      }
      join_league_pair: {
        Args: { p_as_text?: string; p_pair_id: string; p_slot: string }
        Returns: {
          created_at: string
          created_by_user_id: string
          current_elo: number
          id: string
          joined_at: string
          league_id: string
          name: string
          name_is_custom: boolean
          player_a_text: string | null
          player_a_user_id: string | null
          player_b_text: string | null
          player_b_user_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'league_pairs'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_league_matches: {
        Args: { p_league_id: string }
        Returns: {
          is_second_leg: boolean
          match_id: string
          pair_a_id: string | null
          pair_a_name: string | null
          pair_b_id: string | null
          pair_b_name: string | null
          round_number: number | null
          start_at: string
          status: string
          team_a_games: number | null
          team_b_games: number | null
          title: string
        }[]
      }
      list_league_standings: {
        Args: { p_league_id: string }
        Returns: {
          current_elo: number
          games_against: number
          games_diff: number
          games_for: number
          h2h_wins: number
          losses: number
          pair_id: string
          pair_name: string
          played: number
          rank: number
          wins: number
        }[]
      }
      process_league_lifecycle: { Args: never; Returns: undefined }
      record_league_match_result_as_referee: {
        Args: { p_match_id: string; p_team_a_games: number; p_team_b_games: number }
        Returns: undefined
      }
      reject_league_challenge: {
        Args: { p_challenge_id: string }
        Returns: {
          challenged_pair_id: string
          challenger_pair_id: string
          created_at: string
          created_by_user_id: string
          id: string
          league_id: string
          match_id: string | null
          responded_at: string | null
          status: string
        }
        SetofOptions: {
          from: '*'
          to: 'league_challenges'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      remove_league_pair: { Args: { p_pair_id: string }; Returns: undefined }
      set_league_password: {
        Args: { p_league_id: string; p_password: string }
        Returns: undefined
      }
      start_open_league: { Args: { p_league_id: string }; Returns: undefined }
      update_league_pair: {
        Args: {
          p_name?: string
          p_pair_id: string
          p_player_a_text?: string
          p_player_b_text?: string
        }
        Returns: {
          created_at: string
          created_by_user_id: string
          current_elo: number
          id: string
          joined_at: string
          league_id: string
          name: string
          name_is_custom: boolean
          player_a_text: string | null
          player_a_user_id: string | null
          player_b_text: string | null
          player_b_user_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'league_pairs'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      viewer_can_access_league: {
        Args: { p_league_id: string }
        Returns: boolean
      }
      create_tournament: {
        Args: {
          p_city: string
          p_creator_joins_as_player?: boolean
          p_description?: string
          p_duration_target_games: number
          p_entry_fee?: number | null
          p_include_third_place?: boolean
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
          entry_fee: number | null
          id: string
          include_third_place: boolean
          location_privacy: string
          notes: string | null
          password_hash: string | null
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
          badge_showcase: string[]
          city: string | null
          created_at: string
          display_name: string
          id: string
          notify_on_join: boolean
          notify_on_match_cancel: boolean
          notify_on_match_edit: boolean
          notify_on_match_start: boolean
          notify_on_reminder_24h: boolean
          notify_on_reminder_2h: boolean
          notify_on_reminder_in_progress: boolean
          notify_on_result: boolean
          notify_on_friend_request: boolean
          notify_on_match_invitation: boolean
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
          display_name: string
          id: string
          phone_e164: string
          photo_url: string | null
        }[]
      }
      get_leaderboard: {
        Args: { p_city?: string; p_limit?: number }
        Returns: Json
      }
      get_player_ranking: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_match_player_insights: {
        Args: { p_match_id: string; p_viewer_id?: string }
        Returns: Json
      }
      get_player_stats: {
        Args: { p_user_id: string }
        Returns: Json
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
          photo_url: string
          badge_showcase: string[]
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
      update_match_team: {
        Args: {
          p_match_id: string
          p_team_name: string
          p_text_updates?: Json
          p_team?: string
        }
        Returns: Database['public']['Tables']['matches']['Row']
      }
      set_match_password: {
        Args: { p_match_id: string; p_password: string }
        Returns: undefined
      }
      join_private_match: {
        Args: { p_match_id: string; p_team: string; p_password: string }
        Returns: Database['public']['Tables']['match_participants']['Row']
      }
      set_tournament_password: {
        Args: { p_tournament_id: string; p_password: string }
        Returns: undefined
      }
      grant_tournament_password_access: {
        Args: { p_tournament_id: string; p_password: string }
        Returns: undefined
      }
      grant_match_password_access: {
        Args: { p_match_id: string; p_password: string }
        Returns: undefined
      }
      viewer_can_access_match: {
        Args: { p_match_id: string }
        Returns: boolean
      }
      viewer_can_access_tournament: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
      update_tournament_pair: {
        Args: {
          p_entry_fee_paid?: boolean
          p_name: string
          p_pair_id: string
          p_player_a_text: string
          p_player_b_text: string
        }
        Returns: {
          created_at: string
          created_by_user_id: string
          entry_fee_paid: boolean
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
          p_visibility?: string
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
      cancel_friend_request: {
        Args: { p_friendship_id: string }
        Returns: undefined
      }
      remove_friend: {
        Args: { p_other_user_id: string }
        Returns: undefined
      }
      cancel_match_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      get_friendship_with_user: {
        Args: { p_other_user_id: string }
        Returns: {
          friendship_id: string
          status: string
          direction: string
        }[]
      }
      invite_friend_to_match: {
        Args: {
          p_match_id: string
          p_invitee_id: string
          p_team: string
        }
        Returns: string
      }
      inviter_team_capacity_available: {
        Args: { p_match_id: string; p_team: string }
        Returns: boolean
      }
      list_match_invitations: {
        Args: { p_match_id: string }
        Returns: {
          created_at: string
          invitation_id: string
          invitee_id: string
          invitee_name: string
          status: string
          team: string
        }[]
      }
      list_my_friend_requests: {
        Args: { p_direction: string }
        Returns: {
          city: string | null
          created_at: string
          display_name: string
          friendship_id: string
          message: string | null
          photo_url: string | null
          user_id: string
        }[]
      }
      list_my_friends: {
        Args: Record<never, never>
        Returns: {
          city: string | null
          display_name: string
          photo_url: string | null
          since: string
          user_id: string
        }[]
      }
      list_my_match_invitations: {
        Args: Record<never, never>
        Returns: {
          created_at: string
          invitation_id: string
          inviter_id: string
          inviter_name: string
          match_id: string
          match_status: string
          start_at: string
          team: string
          title: string
        }[]
      }
      match_pending_invitations_filled: {
        Args: { p_match_id: string }
        Returns: number
      }
      respond_friend_request: {
        Args: { p_friendship_id: string; p_accept: boolean }
        Returns: undefined
      }
      respond_match_invitation: {
        Args: { p_invitation_id: string; p_accept: boolean }
        Returns: undefined
      }
      search_users_by_display_name: {
        Args: { p_query: string; p_limit?: number }
        Returns: {
          user_id: string
          display_name: string
          city: string | null
          photo_url: string | null
          friendship_status: string | null
          friendship_direction: string | null
        }[]
      }
      send_friend_request: {
        Args: { p_addressee_id: string; p_message?: string }
        Returns: { friendship_id: string; status: string }[]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
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
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
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
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
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
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
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
