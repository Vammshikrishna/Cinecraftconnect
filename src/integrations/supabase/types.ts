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
      announcements: {
        Row: {
          author_id: string | null
          content: string
          id: string
          posted_at: string
          title: string
        }
        Insert: {
          author_id?: string | null
          content: string
          id?: string
          posted_at?: string
          title: string
        }
        Update: {
          author_id?: string | null
          content?: string
          id?: string
          posted_at?: string
          title?: string
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          id: string
          project_id: string
          status: string | null
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          description: string
          id?: string
          project_id: string
          status?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          id?: string
          project_id?: string
          status?: string | null
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          call_id: string
          id: string
          joined_at: string
          left_at: string | null
          user_id: string
        }
        Insert: {
          call_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id: string
        }
        Update: {
          call_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sheets: {
        Row: {
          call_time: string
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          project_id: string
          shoot_date: string
          status: string | null
          title: string
        }
        Insert: {
          call_time: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          project_id: string
          shoot_date: string
          status?: string | null
          title: string
        }
        Update: {
          call_time?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          project_id?: string
          shoot_date?: string
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          call_type: string
          created_by: string
          ended_at: string | null
          id: string
          room_id: string
          room_type: string | null
          started_at: string
          status: string
        }
        Insert: {
          call_type: string
          created_by: string
          ended_at?: string | null
          id?: string
          room_id: string
          room_type?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          call_type?: string
          created_by?: string
          ended_at?: string | null
          id?: string
          room_id?: string
          room_type?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "discussion_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_rooms: {
        Row: {
          category_id: string | null
          created_at: string
          creator_id: string | null
          description: string | null
          id: string
          is_public: boolean | null
          member_count: number | null
          name: string
          project_id: string | null
          room_type: string | null
          title: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          member_count?: number | null
          name: string
          project_id?: string | null
          room_type?: string | null
          title: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          member_count?: number | null
          name?: string
          project_id?: string | null
          room_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_rooms_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "room_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          size: number | null
          type: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id: string
          size?: number | null
          type: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          size?: number | null
          type?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          applicant_id: string
          cover_letter: string | null
          created_at: string | null
          id: string
          job_id: string
          resume_url: string | null
          status: Database["public"]["Enums"]["job_application_status"]
          updated_at: string | null
        }
        Insert: {
          applicant_id: string
          cover_letter?: string | null
          created_at?: string | null
          id?: string
          job_id: string
          resume_url?: string | null
          status?: Database["public"]["Enums"]["job_application_status"]
          updated_at?: string | null
        }
        Update: {
          applicant_id?: string
          cover_letter?: string | null
          created_at?: string | null
          id?: string
          job_id?: string
          resume_url?: string | null
          status?: Database["public"]["Enums"]["job_application_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          company: string
          created_at: string | null
          description: string
          experience_level: Database["public"]["Enums"]["experience_level"]
          id: string
          is_active: boolean | null
          location: string | null
          posted_by: string
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          title: string
          type: Database["public"]["Enums"]["job_type"]
          updated_at: string | null
        }
        Insert: {
          company: string
          created_at?: string | null
          description: string
          experience_level?: Database["public"]["Enums"]["experience_level"]
          id?: string
          is_active?: boolean | null
          location?: string | null
          posted_by: string
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          title: string
          type?: Database["public"]["Enums"]["job_type"]
          updated_at?: string | null
        }
        Update: {
          company?: string
          created_at?: string | null
          description?: string
          experience_level?: Database["public"]["Enums"]["experience_level"]
          id?: string
          is_active?: boolean | null
          location?: string | null
          posted_by?: string
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          title?: string
          type?: Database["public"]["Enums"]["job_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_docs: {
        Row: {
          created_at: string
          id: string
          project_id: string
          status: string | null
          title: string
          type: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          status?: string | null
          title: string
          type: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          status?: string | null
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: []
      }
      likes: {
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
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_bookings: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          listing_id: string
          message: string | null
          owner_id: string
          renter_id: string
          start_date: string
          status: Database["public"]["Enums"]["booking_status"] | null
          total_price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          listing_id: string
          message?: string | null
          owner_id: string
          renter_id: string
          start_date: string
          status?: Database["public"]["Enums"]["booking_status"] | null
          total_price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          listing_id?: string
          message?: string | null
          owner_id?: string
          renter_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["booking_status"] | null
          total_price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      marketplace_listings: {
        Row: {
          availability_calendar: Json | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          images: string[] | null
          is_active: boolean | null
          listing_type: Database["public"]["Enums"]["listing_type"]
          location: string | null
          price_per_day: number | null
          price_per_week: number | null
          specifications: Json | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          availability_calendar?: Json | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          listing_type: Database["public"]["Enums"]["listing_type"]
          location?: string | null
          price_per_day?: number | null
          price_per_week?: number | null
          specifications?: Json | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          availability_calendar?: Json | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          listing_type?: Database["public"]["Enums"]["listing_type"]
          location?: string | null
          price_per_day?: number | null
          price_per_week?: number | null
          specifications?: Json | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      marketplace_reviews: {
        Row: {
          created_at: string | null
          id: string
          listing_id: string | null
          rating: number
          review_text: string
          reviewer_id: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          listing_id?: string | null
          rating: number
          review_text: string
          reviewer_id: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          listing_id?: string | null
          rating?: number
          review_text?: string
          reviewer_id?: string
          vendor_id?: string | null
        }
        Relationships: []
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
            referencedRelation: "project_space_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          sender_id?: string
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
          trigger_user_id: string | null
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
          trigger_user_id?: string | null
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
          trigger_user_id?: string | null
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
          parent_comment_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          avatar_url: string | null
          bio: string | null
          craft: string | null
          experience: string | null
          full_name: string | null
          id: string
          instagram_url: string | null
          location: string | null
          onboarding_completed: boolean | null
          phone: string | null
          social_links: Json | null
          updated_at: string | null
          username: string | null
          website: string | null
          youtube_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          craft?: string | null
          experience?: string | null
          full_name?: string | null
          id: string
          instagram_url?: string | null
          location?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          social_links?: Json | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
          youtube_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          craft?: string | null
          experience?: string | null
          full_name?: string | null
          id?: string
          instagram_url?: string | null
          location?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          social_links?: Json | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      project_applications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          project_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          project_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          project_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          id: string
          joined_at: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_message_read_status: {
        Row: {
          id: string
          last_read_at: string
          project_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          project_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          project_id?: string
          user_id?: string
        }
        Relationships: []
      }
      project_messages: {
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
        Relationships: [
          {
            foreignKeyName: "project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_space_bookmarks: {
        Row: {
          created_at: string
          id: string
          project_space_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_space_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_space_id?: string
          user_id?: string
        }
        Relationships: []
      }
      project_space_categories: {
        Row: {
          description: string | null
          id: string
          name: string
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      project_space_members: {
        Row: {
          created_at: string
          project_space_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          project_space_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          project_space_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_space_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_space_message_read_status: {
        Row: {
          id: string
          last_read_at: string | null
          project_space_id: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          last_read_at?: string | null
          project_space_id?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          last_read_at?: string | null
          project_space_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      project_space_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          project_space_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          project_space_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          project_space_id?: string
          user_id?: string
        }
        Relationships: []
      }
      project_spaces: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_spaces_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      room_categories: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      room_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
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
          room_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          room_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          room_id?: string
          updated_at?: string
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
          {
            foreignKeyName: "room_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_items: {
        Row: {
          created_at: string
          description: string | null
          end_time: string
          id: string
          location: string | null
          project_id: string
          start_time: string
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          location?: string | null
          project_id: string
          start_time: string
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          location?: string | null
          project_id?: string
          start_time?: string
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      shares: {
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
            foreignKeyName: "shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      shot_list: {
        Row: {
          camera_angle: string | null
          created_at: string
          description: string | null
          equipment: string | null
          id: string
          movement: string | null
          project_id: string
          scene: string
          shot: string
          status: string | null
        }
        Insert: {
          camera_angle?: string | null
          created_at?: string
          description?: string | null
          equipment?: string | null
          id?: string
          movement?: string | null
          project_id: string
          scene: string
          shot: string
          status?: string | null
        }
        Update: {
          camera_angle?: string | null
          created_at?: string
          description?: string | null
          equipment?: string | null
          id?: string
          movement?: string | null
          project_id?: string
          scene?: string
          shot?: string
          status?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          project_space_id: string
          status: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_space_id: string
          status?: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          project_space_id?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      user_analytics: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          page_url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          page_url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          page_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_connections: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
          id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
          id?: string
          status: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
          id?: string
          status?: string
        }
        Relationships: []
      }
      user_experience: {
        Row: {
          company: string
          created_at: string
          description: string | null
          end_date: string | null
          id: number
          start_date: string
          title: string
          user_id: string
        }
        Insert: {
          company: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: number
          start_date: string
          title: string
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: number
          start_date?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_skills: {
        Row: {
          created_at: string
          id: number
          skill_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          skill_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          skill_name?: string
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          business_name: string
          category: string[] | null
          created_at: string | null
          description: string | null
          email: string | null
          id: string
          images: string[] | null
          is_verified: boolean | null
          location: string | null
          logo_url: string | null
          owner_id: string
          phone: string | null
          services_offered: string[] | null
          updated_at: string | null
          verification_date: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          business_name: string
          category?: string[] | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          images?: string[] | null
          is_verified?: boolean | null
          location?: string | null
          logo_url?: string | null
          owner_id: string
          phone?: string | null
          services_offered?: string[] | null
          updated_at?: string | null
          verification_date?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          category?: string[] | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          images?: string[] | null
          is_verified?: boolean | null
          location?: string | null
          logo_url?: string | null
          owner_id?: string
          phone?: string | null
          services_offered?: string[] | null
          updated_at?: string | null
          verification_date?: string | null
          website?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_discussion_room_with_creator: {
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
      end_call: {
        Args: { p_call_id: string; p_user_id: string }
        Returns: undefined
      }
      get_listing_with_rating: {
        Args: { listing_uuid: string }
        Returns: {
          availability_calendar: Json
          average_rating: number
          category: string
          created_at: string
          description: string
          id: string
          images: string[]
          is_active: boolean
          listing_type: Database["public"]["Enums"]["listing_type"]
          location: string
          price_per_day: number
          price_per_week: number
          review_count: number
          specifications: Json
          title: string
          updated_at: string
          user_id: string
        }[]
      }
      get_messages_for_channel: {
        Args: { p_channel_id: string }
        Returns: {
          content: string
          created_at: string
          id: string
          sender_id: string
          sender_profile: Json
        }[]
      }
      get_user_conversations: {
        Args: { p_user_id: string }
        Returns: {
          conversation_id: string
          last_message_content: string
          last_message_created_at: string
          other_user_id: string
          other_user_username: string
        }[]
      }
      get_user_conversations_with_profiles: {
        Args: { p_user_id: string }
        Returns: {
          last_message_content: string
          last_message_created_at: string
          other_user_avatar_url: string
          other_user_full_name: string
          other_user_id: string
          unread_count: number
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
      has_unread_messages: { Args: never; Returns: boolean }
      is_member_of_project: { Args: { _project_id: string }; Returns: boolean }
      is_member_of_room: { Args: { _room_id: string }; Returns: boolean }
      is_project_space_member: {
        Args: { p_project_space_id: string; p_user_id: string }
        Returns: boolean
      }
      join_call: {
        Args: { p_call_id: string; p_user_id: string }
        Returns: undefined
      }
      leave_call: {
        Args: { p_call_id: string; p_user_id: string }
        Returns: undefined
      }
      search_marketplace_listings: {
        Args: {
          filter_category?: string
          filter_location?: string
          filter_type?: Database["public"]["Enums"]["listing_type"]
          max_price?: number
          min_price?: number
          search_query?: string
        }
        Returns: {
          category: string
          created_at: string
          description: string
          id: string
          images: string[]
          is_active: boolean
          listing_type: Database["public"]["Enums"]["listing_type"]
          location: string
          price_per_day: number
          price_per_week: number
          title: string
          user_id: string
        }[]
      }
      search_vendors: {
        Args: {
          filter_category?: string
          filter_location?: string
          search_query?: string
          verified_only?: boolean
        }
        Returns: {
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
          services_offered: string[]
          website: string
        }[]
      }
      start_call: {
        Args: { call_type: string; created_by: string; room_id: string }
        Returns: string
      }
    }
    Enums: {
      booking_status: "pending" | "confirmed" | "cancelled" | "completed"
      call_status: "active" | "ended"
      call_type: "audio" | "video"
      experience_level: "entry" | "junior" | "mid" | "senior" | "lead"
      job_application_status:
        | "pending"
        | "reviewing"
        | "interviewing"
        | "accepted"
        | "rejected"
      job_type:
        | "full-time"
        | "part-time"
        | "contract"
        | "freelance"
        | "internship"
        | "project-based"
      listing_type: "equipment" | "location"
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
      booking_status: ["pending", "confirmed", "cancelled", "completed"],
      call_status: ["active", "ended"],
      call_type: ["audio", "video"],
      experience_level: ["entry", "junior", "mid", "senior", "lead"],
      job_application_status: [
        "pending",
        "reviewing",
        "interviewing",
        "accepted",
        "rejected",
      ],
      job_type: [
        "full-time",
        "part-time",
        "contract",
        "freelance",
        "internship",
        "project-based",
      ],
      listing_type: ["equipment", "location"],
      project_space_type: ["public", "private", "secret"],
    },
  },
} as const
