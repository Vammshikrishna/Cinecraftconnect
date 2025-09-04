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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ai_recommendations: {
        Row: {
          ai_model: string | null
          created_at: string
          id: string
          interaction_data: Json | null
          is_clicked: boolean | null
          is_dismissed: boolean | null
          is_shown: boolean | null
          reason: string | null
          recommendation_type: string
          recommended_id: string
          recommended_type: string
          score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          created_at?: string
          id?: string
          interaction_data?: Json | null
          is_clicked?: boolean | null
          is_dismissed?: boolean | null
          is_shown?: boolean | null
          reason?: string | null
          recommendation_type: string
          recommended_id: string
          recommended_type: string
          score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model?: string | null
          created_at?: string
          id?: string
          interaction_data?: Json | null
          is_clicked?: boolean | null
          is_dismissed?: boolean | null
          is_shown?: boolean | null
          reason?: string | null
          recommendation_type?: string
          recommended_id?: string
          recommended_type?: string
          score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          author_id: string
          content: string
          event_date: string | null
          event_location: string | null
          id: string
          posted_at: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          event_date?: string | null
          event_location?: string | null
          id?: string
          posted_at?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          event_date?: string | null
          event_location?: string | null
          id?: string
          posted_at?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      collaborations: {
        Row: {
          craft: string
          description: string
          id: string
          location: string | null
          posted_date: string | null
          poster_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          craft: string
          description: string
          id?: string
          location?: string | null
          posted_date?: string | null
          poster_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          craft?: string
          description?: string
          id?: string
          location?: string | null
          posted_date?: string | null
          poster_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      content_moderation: {
        Row: {
          ai_confidence: number | null
          ai_flags: Json | null
          content_id: string
          content_text: string | null
          content_type: string
          created_at: string
          human_reviewed: boolean | null
          human_reviewer_id: string | null
          id: string
          moderated_at: string | null
          moderation_reason: string | null
          moderation_status: string | null
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_flags?: Json | null
          content_id: string
          content_text?: string | null
          content_type: string
          created_at?: string
          human_reviewed?: boolean | null
          human_reviewer_id?: string | null
          id?: string
          moderated_at?: string | null
          moderation_reason?: string | null
          moderation_status?: string | null
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_flags?: Json | null
          content_id?: string
          content_text?: string | null
          content_type?: string
          created_at?: string
          human_reviewed?: boolean | null
          human_reviewer_id?: string | null
          id?: string
          moderated_at?: string | null
          moderation_reason?: string | null
          moderation_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      discussion_rooms: {
        Row: {
          created_at: string
          creator_id: string
          description: string
          id: string
          is_active: boolean | null
          member_count: number | null
          room_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          description: string
          id?: string
          is_active?: boolean | null
          member_count?: number | null
          room_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string
          id?: string
          is_active?: boolean | null
          member_count?: number | null
          room_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      movie_ratings: {
        Row: {
          created_at: string
          id: string
          movie_title: string
          rating: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movie_title: string
          rating: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movie_title?: string
          rating?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_actionable: boolean | null
          is_read: boolean | null
          message: string
          metadata: Json | null
          priority: string | null
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_actionable?: boolean | null
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          priority?: string | null
          related_id?: string | null
          related_type?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_actionable?: boolean | null
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          priority?: string | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          completion_date: string | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean | null
          media_type: string | null
          media_url: string | null
          project_type: string | null
          role: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completion_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean | null
          media_type?: string | null
          media_url?: string | null
          project_type?: string | null
          role?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completion_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean | null
          media_type?: string | null
          media_url?: string | null
          project_type?: string | null
          role?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          comment_count: number | null
          content: string
          created_at: string
          has_ai_generated: boolean | null
          id: string
          like_count: number | null
          media_type: string | null
          media_url: string | null
          share_count: number | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          author_id: string
          comment_count?: number | null
          content: string
          created_at?: string
          has_ai_generated?: boolean | null
          id?: string
          like_count?: number | null
          media_type?: string | null
          media_url?: string | null
          share_count?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          comment_count?: number | null
          content?: string
          created_at?: string
          has_ai_generated?: boolean | null
          id?: string
          like_count?: number | null
          media_type?: string | null
          media_url?: string | null
          share_count?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          craft: string | null
          created_at: string | null
          full_name: string | null
          id: string
          location: string | null
          role: string | null
          updated_at: string | null
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          craft?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          location?: string | null
          role?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          craft?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          location?: string | null
          role?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      project_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          position: number | null
          priority: string | null
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number | null
          priority?: string | null
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          position?: number | null
          priority?: string | null
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          created_at: string
          creator_id: string
          current_team: Json | null
          description: string | null
          end_date: string | null
          genre: string[] | null
          id: string
          is_public: boolean | null
          location: string | null
          required_roles: string[] | null
          start_date: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          creator_id: string
          current_team?: Json | null
          description?: string | null
          end_date?: string | null
          genre?: string[] | null
          id?: string
          is_public?: boolean | null
          location?: string | null
          required_roles?: string[] | null
          start_date?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          creator_id?: string
          current_team?: Json | null
          description?: string | null
          end_date?: string | null
          genre?: string[] | null
          id?: string
          is_public?: boolean | null
          location?: string | null
          required_roles?: string[] | null
          start_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      room_members: {
        Row: {
          id: string
          joined_at: string
          role: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "discussion_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          message_type: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          message_type?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          message_type?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "discussion_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          id: string
          search_filters: Json | null
          search_name: string
          search_query: string
          search_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          search_filters?: Json | null
          search_name: string
          search_query: string
          search_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          search_filters?: Json | null
          search_name?: string
          search_query?: string
          search_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activities: {
        Row: {
          activity_data: Json | null
          activity_type: string
          created_at: string
          id: string
          is_read: boolean | null
          related_id: string | null
          related_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_data?: Json | null
          activity_type: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_data?: Json | null
          activity_type?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          related_id?: string | null
          related_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_analytics: {
        Row: {
          created_at: string
          device_info: Json | null
          duration_seconds: number | null
          event_data: Json | null
          event_type: string
          id: string
          page_url: string | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          duration_seconds?: number | null
          event_data?: Json | null
          event_type: string
          id?: string
          page_url?: string | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          duration_seconds?: number | null
          event_data?: Json | null
          event_type?: string
          id?: string
          page_url?: string | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_connections: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          status: string | null
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          status?: string | null
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          status?: string | null
        }
        Relationships: []
      }
      user_engagement_scores: {
        Row: {
          comments_made: number | null
          created_at: string
          date: string
          engagement_score: number | null
          id: string
          likes_given: number | null
          likes_received: number | null
          posts_created: number | null
          profile_views: number | null
          session_duration_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_made?: number | null
          created_at?: string
          date: string
          engagement_score?: number | null
          id?: string
          likes_given?: number | null
          likes_received?: number | null
          posts_created?: number | null
          profile_views?: number | null
          session_duration_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_made?: number | null
          created_at?: string
          date?: string
          engagement_score?: number | null
          id?: string
          likes_given?: number | null
          likes_received?: number | null
          posts_created?: number | null
          profile_views?: number | null
          session_duration_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_daily_engagement_score: {
        Args: { target_date?: string }
        Returns: undefined
      }
      create_notification: {
        Args: {
          action_url?: string
          notification_message: string
          notification_title: string
          notification_type: string
          priority?: string
          related_id?: string
          related_type?: string
          target_user_id: string
        }
        Returns: string
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
