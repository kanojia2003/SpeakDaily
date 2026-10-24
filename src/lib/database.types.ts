export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; created_at: string; updated_at: string }
        Insert: { id: string; display_name?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; display_name?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      speaking_topics: {
        Row: {
          id: string
          title: string
          description: string
          prompt: string
          difficulty: 'beginner' | 'intermediate' | 'advanced'
          category: string
          scenario: 'everyday' | 'interview' | 'workplace' | 'presentation' | 'social' | 'travel' | 'learning' | 'creative' | 'opinion'
          register: 'neutral' | 'formal' | 'informal'
          keywords: string[]
          is_active: boolean
          created_at: string
        }
        Insert: {
          id: string
          title: string
          description: string
          prompt: string
          difficulty: 'beginner' | 'intermediate' | 'advanced'
          category: string
          scenario: 'everyday' | 'interview' | 'workplace' | 'presentation' | 'social' | 'travel' | 'learning' | 'creative' | 'opinion'
          register: 'neutral' | 'formal' | 'informal'
          keywords: string[]
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          prompt?: string
          difficulty?: 'beginner' | 'intermediate' | 'advanced'
          category?: string
          scenario?: 'everyday' | 'interview' | 'workplace' | 'presentation' | 'social' | 'travel' | 'learning' | 'creative' | 'opinion'
          register?: 'neutral' | 'formal' | 'informal'
          keywords?: string[]
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      speaking_sessions: {
        Row: {
          id: string
          user_id: string
          topic_id: string | null
          topic_title: string | null
          status: 'pending' | 'processing' | 'completed' | 'failed'
          duration_seconds: number
          transcript: string | null
          feedback: Json | null
          error_message: string | null
          recording_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          topic_id?: string | null
          topic_title?: string | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          duration_seconds?: number
          transcript?: string | null
          feedback?: Json | null
          error_message?: string | null
          recording_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          topic_id?: string | null
          topic_title?: string | null
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          duration_seconds?: number
          transcript?: string | null
          feedback?: Json | null
          error_message?: string | null
          recording_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'speaking_sessions_topic_id_fkey'
            columns: ['topic_id']
            isOneToOne: false
            referencedRelation: 'speaking_topics'
            referencedColumns: ['id']
          },
        ]
      }
      user_topic_preferences: {
        Row: {
          user_id: string
          scenario: 'any' | 'everyday' | 'interview' | 'workplace' | 'presentation' | 'social' | 'travel' | 'learning' | 'creative' | 'opinion'
          register: 'any' | 'neutral' | 'formal' | 'informal'
          difficulty: 'any' | 'beginner' | 'intermediate' | 'advanced'
          interests: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          scenario?: 'any' | 'everyday' | 'interview' | 'workplace' | 'presentation' | 'social' | 'travel' | 'learning' | 'creative' | 'opinion'
          register?: 'any' | 'neutral' | 'formal' | 'informal'
          difficulty?: 'any' | 'beginner' | 'intermediate' | 'advanced'
          interests?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          scenario?: 'any' | 'everyday' | 'interview' | 'workplace' | 'presentation' | 'social' | 'travel' | 'learning' | 'creative' | 'opinion'
          register?: 'any' | 'neutral' | 'formal' | 'informal'
          difficulty?: 'any' | 'beginner' | 'intermediate' | 'advanced'
          interests?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      get_practice_topic_set: {
        Args: { p_visit_id: string }
        Returns: Database['public']['Tables']['speaking_topics']['Row'][]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
