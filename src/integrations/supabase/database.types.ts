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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      background_jobs: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          max_attempts: number | null
          payload: Json | null
          scheduled_at: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          max_attempts?: number | null
          payload?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          max_attempts?: number | null
          payload?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          call_id: string
          id: string
          is_audio_enabled: boolean | null
          is_video_enabled: boolean | null
          joined_at: string | null
          left_at: string | null
          user_id: string
        }
        Insert: {
          call_id: string
          id?: string
          is_audio_enabled?: boolean | null
          is_video_enabled?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          user_id: string
        }
        Update: {
          call_id?: string
          id?: string
          is_audio_enabled?: boolean | null
          is_video_enabled?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "room_calls"
            referencedColumns: ["id"]
          },
        ]
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
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
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
      conversations: {
        Row: {
          created_at: string
          id: string
          participant_a: string | null
          participant_b: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          participant_a?: string | null
          participant_b?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          participant_a?: string | null
          participant_b?: string | null
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
          channel_id: string | null
          reply_to_id: string | null
          attachment_url: string | null
          attachment_type: string | null
          is_deleted: boolean | null
          deleted_for_users: string[] | null
          read_at: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id?: string
          sender_id: string
          channel_id?: string | null
          reply_to_id?: string | null
          attachment_url?: string | null
          attachment_type?: string | null
          is_deleted?: boolean | null
          deleted_for_users?: string[] | null
          read_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          recipient_id?: string
          sender_id?: string
          channel_id?: string | null
          reply_to_id?: string | null
          attachment_url?: string | null
          attachment_type?: string | null
          is_deleted?: boolean | null
          deleted_for_users?: string[] | null
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      discussion_rooms: {
        Row: {
          category_id: string | null
          created_at: string
          creator_id: string
          description: string
          id: string
          is_active: boolean | null
          last_activity_at: string | null
          member_count: number | null
          project_id: string | null
          room_purpose: string | null
          room_type: string | null
          settings: Json | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          creator_id: string
          description: string
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          member_count?: number | null
          project_id?: string | null
          room_purpose?: string | null
          room_type?: string | null
          settings?: Json | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          creator_id?: string
          description?: string
          id?: string
          is_active?: boolean | null
          last_activity_at?: string | null
          member_count?: number | null
          project_id?: string | null
          room_purpose?: string | null
          room_type?: string | null
          settings?: Json | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_rooms_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "room_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_rooms_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "room_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          is_read: boolean | null
          sender_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: 'fan' | 'creator' | null
          avatar_url: string | null
          bio: string | null
          craft: string | null
          created_at: string | null
          full_name: string | null
          id: string
          location: string | null
          updated_at: string | null
          username: string | null
          website: string | null
          is_verified: boolean | null
          is_banned: boolean | null
          is_internal: boolean | null
          cover_image_url: string | null
        }
        Insert: {
          account_type?: 'fan' | 'creator' | null
          avatar_url?: string | null
          bio?: string | null
          craft?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          location?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
          is_verified?: boolean | null
          is_banned?: boolean | null
          is_internal?: boolean | null
          cover_image_url?: string | null
        }
        Update: {
          account_type?: 'fan' | 'creator' | null
          avatar_url?: string | null
          bio?: string | null
          craft?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          location?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
          is_verified?: boolean | null
          is_banned?: boolean | null
          is_internal?: boolean | null
          cover_image_url?: string | null
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
          image_url: string | null
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
          image_url?: string | null
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
          image_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action_count: number | null
          action_type: string
          created_at: string
          id: string
          user_id: string | null
          window_start: string
        }
        Insert: {
          action_count?: number | null
          action_type: string
          created_at?: string
          id?: string
          user_id?: string | null
          window_start?: string
        }
        Update: {
          action_count?: number | null
          action_type?: string
          created_at?: string
          id?: string
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      room_calls: {
        Row: {
          call_type: string
          created_at: string | null
          ended_at: string | null
          id: string
          is_active: boolean | null
          participant_count: number | null
          room_id: string
          started_at: string | null
          started_by: string
        }
        Insert: {
          call_type: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          participant_count?: number | null
          room_id: string
          started_at?: string | null
          started_by: string
        }
        Update: {
          call_type?: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          participant_count?: number | null
          room_id?: string
          started_at?: string | null
          started_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_calls_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "discussion_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
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
          {
            foreignKeyName: "room_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          message_type: string | null
          priority: string | null
          room_id: string
          user_id: string
          visibility_role: string | null
          reply_to_id: string | null
          is_deleted: boolean | null
          deleted_for_users: string[] | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_type?: string | null
          priority?: string | null
          room_id: string
          user_id: string
          visibility_role?: string | null
          reply_to_id?: string | null
          is_deleted?: boolean | null
          deleted_for_users?: string[] | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_type?: string | null
          priority?: string | null
          room_id?: string
          user_id?: string
          visibility_role?: string | null
          reply_to_id?: string | null
          is_deleted?: boolean | null
          deleted_for_users?: string[] | null
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
      shares: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      project_applications: {
        Row: {
          id: string
          project_id: string
          user_id: string
          message: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          message?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          message?: string | null
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      project_space_bookmarks: {
        Row: {
          id: string
          user_id: string
          project_space_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_space_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_space_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_space_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_space_bookmarks_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          }
        ]
      }
      project_space_categories: {
        Row: {
          id: string
          name: string
          description: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
        }
        Relationships: []
      }
      project_space_join_requests: {
        Row: {
          id: number
          created_at: string
          project_space_id: string
          user_id: string
          message: string | null
          status: string
        }
        Insert: {
          id?: number
          created_at?: string
          project_space_id: string
          user_id: string
          message?: string | null
          status?: string
        }
        Update: {
          id?: number
          created_at?: string
          project_space_id?: string
          user_id?: string
          message?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_space_join_requests_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_space_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      project_space_members: {
        Row: {
          id: string
          project_space_id: string
          user_id: string
          role: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_space_id: string
          user_id: string
          role?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_space_id?: string
          user_id?: string
          role?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_space_members_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_space_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      project_space_messages: {
        Row: {
          id: string
          content: string
          user_id: string
          project_space_id: string
          created_at: string
          is_deleted: boolean | null
          reply_to_id: string | null
          deleted_for_users: string[] | null
          attachment_url: string | null
          attachment_type: string | null
          is_read: boolean | null
        }
        Insert: {
          id?: string
          content: string
          user_id: string
          project_space_id: string
          created_at?: string
          is_deleted?: boolean | null
          reply_to_id?: string | null
          deleted_for_users?: string[] | null
          attachment_url?: string | null
          attachment_type?: string | null
          is_read?: boolean | null
        }
        Update: {
          id?: string
          content?: string
          user_id?: string
          project_space_id?: string
          created_at?: string
          is_deleted?: boolean | null
          reply_to_id?: string | null
          deleted_for_users?: string[] | null
          attachment_url?: string | null
          attachment_type?: string | null
          is_read?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "project_space_messages_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_space_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      project_space_message_read_status: {
        Row: {
          id: string
          project_space_id: string
          user_id: string
          last_read_at: string
        }
        Insert: {
          id?: string
          project_space_id: string
          user_id: string
          last_read_at?: string
        }
        Update: {
          id?: string
          project_space_id?: string
          user_id?: string
          last_read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_space_message_read_status_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_space_message_read_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      room_message_read_status: {
        Row: {
          id: string
          room_id: string
          user_id: string
          last_read_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          last_read_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          last_read_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_message_read_status_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "discussion_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_message_read_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      project_spaces: {
        Row: {
          id: string
          created_at: string
          name: string
          description: string | null
          creator_id: string | null
          category_id: string | null
          tags: string[] | null
          project_id: string | null
          last_activity_at: string | null
          project_space_type: Database["public"]["Enums"]["project_space_type"] | null
          status: string | null
          location: string | null
          genre: string[] | null
          required_roles: string[] | null
          budget_min: number | null
          budget_max: number | null
          start_date: string | null
          end_date: string | null
          cover_image: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          description?: string | null
          creator_id?: string | null
          category_id?: string | null
          tags?: string[] | null
          project_id?: string | null
          last_activity_at?: string | null
          project_space_type?: Database["public"]["Enums"]["project_space_type"] | null
          status?: string | null
          location?: string | null
          genre?: string[] | null
          required_roles?: string[] | null
          budget_min?: number | null
          budget_max?: number | null
          start_date?: string | null
          end_date?: string | null
          cover_image?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          description?: string | null
          creator_id?: string | null
          category_id?: string | null
          tags?: string[] | null
          project_id?: string | null
          last_activity_at?: string | null
          project_space_type?: Database["public"]["Enums"]["project_space_type"] | null
          status?: string | null
          location?: string | null
          genre?: string[] | null
          required_roles?: string[] | null
          budget_min?: number | null
          budget_max?: number | null
          start_date?: string | null
          end_date?: string | null
          cover_image?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_spaces_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_spaces_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "project_space_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      film_reviews: {
        Row: {
          id: string
          user_id: string
          tmdb_id: number | null
          platform_cinema_id: string | null
          review_text: string
          is_spoiler: boolean | null
          is_anonymous: boolean | null
          helpful_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tmdb_id?: number | null
          platform_cinema_id?: string | null
          review_text: string
          is_spoiler?: boolean | null
          is_anonymous?: boolean | null
          helpful_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tmdb_id?: number | null
          platform_cinema_id?: string | null
          review_text?: string
          is_spoiler?: boolean | null
          is_anonymous?: boolean | null
          helpful_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "film_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_reviews_platform_cinema_id_fkey"
            columns: ["platform_cinema_id"]
            isOneToOne: false
            referencedRelation: "platform_cinema"
            referencedColumns: ["id"]
          }
        ]
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      pitch_calls: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          creator_id: string
          title: string
          slug: string | null
          project_type: string
          genre: string[] | null
          subgenre: string | null
          language: string[] | null
          format: string | null
          target_audience: string | null
          budget_range: string | null
          compensation: string | null
          requirement_description: string
          tone: string | null
          ref_films: string | null
          deadline: string | null
          is_open_to_debut: boolean | null
          is_regional_welcome: boolean | null
          rights_expectation: string | null
          nda_required: boolean | null
          status: string | null
          is_published: boolean | null
          view_count: number | null
          attachments: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          creator_id: string
          title: string
          slug?: string | null
          project_type: string
          genre?: string[] | null
          subgenre?: string | null
          language?: string[] | null
          format?: string | null
          target_audience?: string | null
          budget_range?: string | null
          compensation?: string | null
          requirement_description: string
          tone?: string | null
          ref_films?: string | null
          deadline?: string | null
          is_open_to_debut?: boolean | null
          is_regional_welcome?: boolean | null
          rights_expectation?: string | null
          nda_required?: boolean | null
          status?: string | null
          is_published?: boolean | null
          view_count?: number | null
          attachments?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          creator_id?: string
          title?: string
          slug?: string | null
          project_type?: string
          genre?: string[] | null
          subgenre?: string | null
          language?: string[] | null
          format?: string | null
          target_audience?: string | null
          budget_range?: string | null
          compensation?: string | null
          requirement_description?: string
          tone?: string | null
          ref_films?: string | null
          deadline?: string | null
          is_open_to_debut?: boolean | null
          is_regional_welcome?: boolean | null
          rights_expectation?: string | null
          nda_required?: boolean | null
          status?: string | null
          is_published?: boolean | null
          view_count?: number | null
          attachments?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pitch_calls_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      pitch_submissions: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          submitted_at: string
          pitch_call_id: string
          submitter_id: string
          title: string
          logline: string
          short_synopsis: string
          full_synopsis: string | null
          genre: string | null
          format: string | null
          language: string | null
          tone: string | null
          why_fits: string | null
          rights_owned: boolean | null
          is_original_work: boolean | null
          treatment_url: string | null
          lookbook_url: string | null
          moodboard_url: string | null
          character_notes: string | null
          pilot_outline: string | null
          reference_links: string[] | null
          status: string | null
          nda_preferred: boolean | null
          seen_at: string | null
          reviewed_at: string | null
          shortlisted_at: string | null
          passed_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          submitted_at?: string
          pitch_call_id: string
          submitter_id: string
          title: string
          logline: string
          short_synopsis: string
          full_synopsis?: string | null
          genre?: string | null
          format?: string | null
          language?: string | null
          tone?: string | null
          why_fits?: string | null
          rights_owned?: boolean | null
          is_original_work?: boolean | null
          treatment_url?: string | null
          lookbook_url?: string | null
          moodboard_url?: string | null
          character_notes?: string | null
          pilot_outline?: string | null
          reference_links?: string[] | null
          status?: string | null
          nda_preferred?: boolean | null
          seen_at?: string | null
          reviewed_at?: string | null
          shortlisted_at?: string | null
          passed_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          submitted_at?: string
          pitch_call_id?: string
          submitter_id?: string
          title?: string
          logline?: string
          short_synopsis?: string
          full_synopsis?: string | null
          genre?: string | null
          format?: string | null
          language?: string | null
          tone?: string | null
          why_fits?: string | null
          rights_owned?: boolean | null
          is_original_work?: boolean | null
          treatment_url?: string | null
          lookbook_url?: string | null
          moodboard_url?: string | null
          character_notes?: string | null
          pilot_outline?: string | null
          reference_links?: string[] | null
          status?: string | null
          nda_preferred?: boolean | null
          seen_at?: string | null
          reviewed_at?: string | null
          shortlisted_at?: string | null
          passed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pitch_submissions_pitch_call_id_fkey"
            columns: ["pitch_call_id"]
            isOneToOne: false
            referencedRelation: "pitch_calls"
            referencedColumns: ["id"]
          }
        ]
      }
      saved_pitch_calls: {
        Row: {
          id: string
          created_at: string
          user_id: string
          pitch_call_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          pitch_call_id: string
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          pitch_call_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_pitch_calls_pitch_call_id_fkey"
            columns: ["pitch_call_id"]
            isOneToOne: false
            referencedRelation: "pitch_calls"
            referencedColumns: ["id"]
          }
        ]
      }
      pitch_access_logs: {
        Row: {
          id: string
          created_at: string
          pitch_submission_id: string | null
          accessed_by: string | null
          action: string
        }
        Insert: {
          id?: string
          created_at?: string
          pitch_submission_id?: string | null
          accessed_by?: string | null
          action: string
        }
        Update: {
          id?: string
          created_at?: string
          pitch_submission_id?: string | null
          accessed_by?: string | null
          action?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitch_access_logs_pitch_submission_id_fkey"
            columns: ["pitch_submission_id"]
            isOneToOne: false
            referencedRelation: "pitch_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_access_logs_accessed_by_fkey"
            columns: ["accessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      company_pages: {
        Row: {
          id: string
          owner_id: string
          name: string
          slug: string
          tagline: string | null
          description: string | null
          logo_url: string | null
          cover_image_url: string | null
          industry: string[] | null
          company_size: string | null
          founded_year: number | null
          headquarters: string | null
          website: string | null
          email: string | null
          phone: string | null
          specialties: string[] | null
          is_verified: boolean | null
          follower_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          slug: string
          tagline?: string | null
          description?: string | null
          logo_url?: string | null
          cover_image_url?: string | null
          industry?: string[] | null
          company_size?: string | null
          founded_year?: number | null
          headquarters?: string | null
          website?: string | null
          email?: string | null
          phone?: string | null
          specialties?: string[] | null
          is_verified?: boolean | null
          follower_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          slug?: string
          tagline?: string | null
          description?: string | null
          logo_url?: string | null
          cover_image_url?: string | null
          industry?: string[] | null
          company_size?: string | null
          founded_year?: number | null
          headquarters?: string | null
          website?: string | null
          email?: string | null
          phone?: string | null
          specialties?: string[] | null
          is_verified?: boolean | null
          follower_count?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_pages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      vendors: {
        Row: {
          id: string
          owner_id: string
          business_name: string
          description: string
          category: string[]
          services_offered: string[] | null
          location: string
          address: string | null
          phone: string
          email: string
          website: string | null
          logo_url: string | null
          images: string[] | null
          is_verified: boolean | null
          verification_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          business_name: string
          description: string
          category: string[]
          services_offered?: string[] | null
          location: string
          address?: string | null
          phone: string
          email: string
          website?: string | null
          logo_url?: string | null
          images?: string[] | null
          is_verified?: boolean | null
          verification_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          business_name?: string
          description?: string
          category?: string[]
          services_offered?: string[] | null
          location?: string
          address?: string | null
          phone?: string
          email?: string
          website?: string | null
          logo_url?: string | null
          images?: string[] | null
          is_verified?: boolean | null
          verification_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      company_page_admins: {
        Row: {
          id: string
          page_id: string
          user_id: string
          role: string | null
          created_at: string
        }
        Insert: {
          id?: string
          page_id: string
          user_id: string
          role?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          page_id?: string
          user_id?: string
          role?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_page_admins_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "company_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_page_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      company_page_followers: {
        Row: {
          id: string
          page_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          page_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          page_id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_page_followers_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "company_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_page_followers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      company_page_members: {
        Row: {
          id: string
          page_id: string
          user_id: string
          title: string | null
          department: string | null
          created_at: string
        }
        Insert: {
          id?: string
          page_id: string
          user_id: string
          title?: string | null
          department?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          page_id?: string
          user_id?: string
          title?: string | null
          department?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_page_members_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "company_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_page_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      marketplace_listings: {
        Row: {
          id: string
          user_id: string
          listing_type: Database["public"]["Enums"]["listing_type"]
          title: string
          description: string
          category: string
          price_per_day: number
          price_per_week: number | null
          location: string
          images: string[] | null
          specifications: Json | null
          availability_calendar: Json | null
          is_active: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          listing_type: Database["public"]["Enums"]["listing_type"]
          title: string
          description: string
          category: string
          price_per_day: number
          price_per_week?: number | null
          location: string
          images?: string[] | null
          specifications?: Json | null
          availability_calendar?: Json | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          listing_type?: Database["public"]["Enums"]["listing_type"]
          title?: string
          description?: string
          category?: string
          price_per_day?: number
          price_per_week?: number | null
          location?: string
          images?: string[] | null
          specifications?: Json | null
          availability_calendar?: Json | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      marketplace_bookings: {
        Row: {
          id: string
          listing_id: string
          renter_id: string
          owner_id: string
          start_date: string
          end_date: string
          total_price: number
          status: Database["public"]["Enums"]["booking_status"] | null
          message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          listing_id: string
          renter_id: string
          owner_id: string
          start_date: string
          end_date: string
          total_price: number
          status?: Database["public"]["Enums"]["booking_status"] | null
          message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          listing_id?: string
          renter_id?: string
          owner_id?: string
          start_date?: string
          end_date?: string
          total_price?: number
          status?: Database["public"]["Enums"]["booking_status"] | null
          message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_bookings_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_bookings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      marketplace_reviews: {
        Row: {
          id: string
          listing_id: string | null
          vendor_id: string | null
          reviewer_id: string
          rating: number
          review_text: string
          created_at: string
        }
        Insert: {
          id?: string
          listing_id?: string | null
          vendor_id?: string | null
          reviewer_id: string
          rating: number
          review_text: string
          created_at?: string
        }
        Update: {
          id?: string
          listing_id?: string | null
          vendor_id?: string | null
          reviewer_id?: string
          rating?: number
          review_text?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      jobs: {
        Row: {
          company: string
          created_at: string | null
          description: string
          experience_level: string | null
          id: string
          is_active: boolean | null
          location: string | null
          posted_by: string
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          title: string
          type: string | null
          updated_at: string | null
          page_id: string | null
        }
        Insert: {
          company: string
          created_at?: string | null
          description: string
          experience_level?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          posted_by: string
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          title: string
          type?: string | null
          updated_at?: string | null
          page_id?: string | null
        }
        Update: {
          company?: string
          created_at?: string | null
          description?: string
          experience_level?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          posted_by?: string
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          title?: string
          type?: string | null
          updated_at?: string | null
          page_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "company_pages"
            referencedColumns: ["id"]
          }
        ]
      }
      job_applications: {
        Row: {
          id: string
          job_id: string | null
          applicant_id: string | null
          resume_url: string | null
          portfolio_url: string | null
          cover_letter: string | null
          showreel_url: string | null
          status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id?: string | null
          applicant_id?: string | null
          resume_url?: string | null
          portfolio_url?: string | null
          cover_letter?: string | null
          showreel_url?: string | null
          status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: string | null
          applicant_id?: string | null
          resume_url?: string | null
          portfolio_url?: string | null
          cover_letter?: string | null
          showreel_url?: string | null
          status?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      job_alerts: {
        Row: {
          id: string
          user_id: string | null
          keywords: string[] | null
          categories: string[] | null
          location: string | null
          is_active: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          keywords?: string[] | null
          categories?: string[] | null
          location?: string | null
          is_active?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          keywords?: string[] | null
          categories?: string[] | null
          location?: string | null
          is_active?: boolean | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      platform_cinema: {
        Row: {
          id: string
          creator_id: string | null
          title: string
          type: string
          overview: string | null
          poster_url: string | null
          backdrop_url: string | null
          trailer_url: string | null
          release_date: string | null
          genre: string[] | null
          runtime: number | null
          credits: Json | null
          is_published: boolean | null
          view_count: number | null
          gallery: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          creator_id?: string | null
          title: string
          type: string
          overview?: string | null
          poster_url?: string | null
          backdrop_url?: string | null
          trailer_url?: string | null
          release_date?: string | null
          genre?: string[] | null
          runtime?: number | null
          credits?: Json | null
          is_published?: boolean | null
          view_count?: number | null
          gallery?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          creator_id?: string | null
          title?: string
          type?: string
          overview?: string | null
          poster_url?: string | null
          backdrop_url?: string | null
          trailer_url?: string | null
          release_date?: string | null
          genre?: string[] | null
          runtime?: number | null
          credits?: Json | null
          is_published?: boolean | null
          view_count?: number | null
          gallery?: string[] | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_cinema_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      review_helpful_marks: {
        Row: {
          id: string
          review_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          review_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          review_id?: string
          user_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_helpful_marks_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "film_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_helpful_marks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          project_space_id: string
          name: string
          description: string | null
          due_date: string | null
          assignee_id: string | null
          is_completed: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          project_space_id: string
          name: string
          description?: string | null
          due_date?: string | null
          assignee_id?: string | null
          is_completed?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          project_space_id?: string
          name?: string
          description?: string | null
          due_date?: string | null
          assignee_id?: string | null
          is_completed?: boolean | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      user_film_ratings: {
        Row: {
          id: string
          user_id: string
          tmdb_id: number | null
          platform_cinema_id: string | null
          rating: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tmdb_id?: number | null
          platform_cinema_id?: string | null
          rating: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tmdb_id?: number | null
          platform_cinema_id?: string | null
          rating?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_film_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_film_ratings_platform_cinema_id_fkey"
            columns: ["platform_cinema_id"]
            isOneToOne: false
            referencedRelation: "platform_cinema"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_messages_for_channel_paginated: {
        Args: {
          p_channel_id: string
          p_limit: number
          p_offset: number
        }
        Returns: {
          id: string
          content: string
          created_at: string
          sender_id: string
          is_deleted: boolean | null
          reply_to_id: string | null
          attachment_url: string | null
          attachment_type: string | null
          sender_profile: Json
          replied_to_message: Json | null
        }[]
      }
      get_messages_for_channel: {
        Args: {
          p_channel_id: string
        }
        Returns: {
          id: string
          content: string
          created_at: string
          sender_id: string
          is_deleted: boolean | null
          reply_to_id: string | null
          attachment_url: string | null
          attachment_type: string | null
          sender_profile: Json
          replied_to_message: Json | null
        }[]
      }
      hide_message_for_user: {
        Args: {
          p_message_id: string
          p_user_id: string
          p_table: string
        }
        Returns: undefined
      }
      get_unread_message_previews: {
        Args: Record<PropertyKey, never>
        Returns: {
          context_id: string
          c_id: string
          chat_type: string
          type: string
          unread_count: number
          last_message_content: string
          last_message_created_at: string
        }[]
      }
      calculate_daily_engagement_score: {
        Args: { target_date?: string }
        Returns: undefined
      }
      check_rate_limit: {
        Args: {
          _action_type: string
          _max_requests: number
          _user_id: string
          _window_minutes: number
        }
        Returns: boolean
      }
      create_discussion_room_with_creator:
      | {
        Args: {
          c_id: string
          cat_id: string
          room_description: string
          room_tags: string[]
          room_title: string
          type: string
        }
        Returns: string
      }
      | {
        Args: {
          c_id: string
          cat_id: string
          room_description: string
          room_tags: string[]
          room_title: string
          type: Database["public"]["Enums"]["room_type"]
        }
        Returns: string
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
      get_or_create_conversation: {
        Args: { p_user_id_1: string; p_user_id_2: string }
        Returns: string
      }
      get_user_conversations: {
        Args: { p_user_id: string }
        Returns: {
          last_message_content: string
          last_message_created_at: string
          other_user_avatar_url: string
          other_user_full_name: string
          other_user_id: string
          other_user_username: string
        }[]
      }
      get_user_conversations_with_profiles: {
        Args: { p_user_id: string }
        Returns: {
          conversation_id: string
          last_message_content: string
          last_message_created_at: string
          last_message_sender_id: string
          other_user_avatar_url: string
          other_user_craft: string
          other_user_full_name: string
          other_user_id: string
          other_user_username: string
          unread_count: number
        }[]
      }
      get_user_feed: {
        Args: { _limit?: number; _offset?: number; _user_id: string }
        Returns: {
          author_avatar_url: string
          author_full_name: string
          author_id: string
          comment_count: number
          content: string
          created_at: string
          id: string
          like_count: number
          media_type: string
          media_url: string
          tags: string[]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      search_marketplace_listings: {
        Args: {
          search_query?: string
          filter_type?: Database["public"]["Enums"]["listing_type"]
          filter_category?: string
          filter_location?: string
          min_price?: number
          max_price?: number
        }
        Returns: {
          id: string
          user_id: string
          listing_type: Database["public"]["Enums"]["listing_type"]
          title: string
          description: string
          category: string
          price_per_day: number
          price_per_week: number
          location: string
          images: string[]
          is_active: boolean
          created_at: string
          average_rating: number
          review_count: number
        }[]
      }
      search_vendors: {
        Args: {
          search_query?: string
          filter_category?: string
          filter_location?: string
          verified_only?: boolean
        }
        Returns: {
          id: string
          owner_id: string
          business_name: string
          description: string
          category: string[]
          services_offered: string[]
          location: string
          phone: string
          email: string
          website: string
          logo_url: string
          images: string[]
          is_verified: boolean
          created_at: string
          average_rating: number
          review_count: number
        }[]
      }
      get_segmented_film_ratings: {
        Args: { tmdb_ids: number[] }
        Returns: {
          tmdb_id: number
          overall_average: number
          overall_count: number
          pro_average: number
          pro_count: number
          fan_average: number
          fan_count: number
        }[]
      }
      get_vendor_with_rating: {
        Args: { vendor_uuid: string }
        Returns: {
          address: string
          average_rating: number
          business_name: string
          category: string[]
          created_at: string
          description: string
          email: string
          id: string
          images: string[]
          is_verified: boolean
          location: string
          logo_url: string
          owner_id: string
          phone: string
          review_count: number
          services_offered: string[]
          updated_at: string
          verification_date: string
          website: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "super_admin"
      room_type: "public" | "private" | "secret"
      listing_type: "equipment" | "location"
      booking_status: "pending" | "confirmed" | "cancelled" | "completed"
      job_type: "full-time" | "part-time" | "contract" | "freelance" | "internship" | "project-based"
      experience_level: "entry" | "junior" | "mid" | "senior" | "lead"
      job_application_status: "pending" | "reviewed" | "shortlisted" | "accepted" | "rejected"
      project_space_type: "public" | "private" | "secret"
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
    Enums: {
      app_role: ["admin", "moderator", "user", "super_admin"],
      room_type: ["public", "private", "secret"],
      listing_type: ["equipment", "location"],
      booking_status: ["pending", "confirmed", "cancelled", "completed"],
      job_type: ["full-time", "part-time", "contract", "freelance", "internship", "project-based"],
      experience_level: ["entry", "junior", "mid", "senior", "lead"],
      job_application_status: ["pending", "reviewed", "shortlisted", "accepted", "rejected"],
      project_space_type: ["public", "private", "secret"],
    },
  },
} as const

