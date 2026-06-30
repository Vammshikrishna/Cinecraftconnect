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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string | null
          content: string
          id: string
          posted_at: string
          publisher_page_id: string | null
          title: string
        }
        Insert: {
          author_id?: string | null
          content: string
          id?: string
          posted_at?: string
          publisher_page_id?: string | null
          title: string
        }
        Update: {
          author_id?: string | null
          content?: string
          id?: string
          posted_at?: string
          publisher_page_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_publisher_page_id_fkey"
            columns: ["publisher_page_id"]
            isOneToOne: false
            referencedRelation: "company_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          actual_cost: number | null
          category: string
          created_at: string
          estimated_cost: number | null
          id: string
          item_name: string
          notes: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          actual_cost?: number | null
          category: string
          created_at?: string
          estimated_cost?: number | null
          id?: string
          item_name: string
          notes?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          actual_cost?: number | null
          category?: string
          created_at?: string
          estimated_cost?: number | null
          id?: string
          item_name?: string
          notes?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      call_participants: {
        Row: {
          call_id: string
          id: string
          joined_at: string
          left_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          call_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          call_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          status?: string
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
      call_reactions: {
        Row: {
          call_id: string
          created_at: string
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_reactions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sheets: {
        Row: {
          call_time: string | null
          created_at: string
          date: string
          director: string | null
          director_phone: string | null
          id: string
          location: string | null
          notes: string | null
          producer: string | null
          producer_phone: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          call_time?: string | null
          created_at?: string
          date: string
          director?: string | null
          director_phone?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          producer?: string | null
          producer_phone?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          call_time?: string | null
          created_at?: string
          date?: string
          director?: string | null
          director_phone?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          producer?: string | null
          producer_phone?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_sheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          created_at: string
          daily_room_name: string
          daily_room_url: string
          ended_at: string | null
          id: string
          room_id: string
          room_type: string
          started_at: string
          started_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          daily_room_name: string
          daily_room_url: string
          ended_at?: string | null
          id?: string
          room_id: string
          room_type: string
          started_at?: string
          started_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          daily_room_name?: string
          daily_room_url?: string
          ended_at?: string | null
          id?: string
          room_id?: string
          room_type?: string
          started_at?: string
          started_by?: string | null
          status?: string
        }
        Relationships: []
      }
      company_page_admins: {
        Row: {
          created_at: string | null
          id: string
          page_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          page_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          page_id?: string
          role?: string | null
          user_id?: string
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
          },
        ]
      }
      company_page_followers: {
        Row: {
          created_at: string | null
          id: string
          page_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          page_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          page_id?: string
          user_id?: string
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
          },
        ]
      }
      company_page_members: {
        Row: {
          created_at: string | null
          department: string | null
          id: string
          page_id: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          id?: string
          page_id: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          department?: string | null
          id?: string
          page_id?: string
          title?: string | null
          user_id?: string
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
          },
        ]
      }
      company_pages: {
        Row: {
          company_size: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          email: string | null
          follower_count: number | null
          founded_year: number | null
          headquarters: string | null
          id: string
          industry: string[] | null
          is_verified: boolean | null
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          slug: string
          specialties: string[] | null
          tagline: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          company_size?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          follower_count?: number | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          industry?: string[] | null
          is_verified?: boolean | null
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          slug: string
          specialties?: string[] | null
          tagline?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          company_size?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          follower_count?: number | null
          founded_year?: number | null
          headquarters?: string | null
          id?: string
          industry?: string[] | null
          is_verified?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          slug?: string
          specialties?: string[] | null
          tagline?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_pages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          details: string | null
          escalation_level: number | null
          id: string
          metadata: Json | null
          priority: string | null
          reason: string
          reported_by: string
          resolution_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          details?: string | null
          escalation_level?: number | null
          id?: string
          metadata?: Json | null
          priority?: string | null
          reason: string
          reported_by: string
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          details?: string | null
          escalation_level?: number | null
          id?: string
          metadata?: Json | null
          priority?: string | null
          reason?: string
          reported_by?: string
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          attachment_type: string | null
          attachment_url: string | null
          channel_id: string | null
          content: string
          created_at: string
          deleted_for_users: string[] | null
          id: string
          is_deleted: boolean | null
          is_read: boolean | null
          receiver_id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id?: string | null
          content: string
          created_at?: string
          deleted_for_users?: string[] | null
          id?: string
          is_deleted?: boolean | null
          is_read?: boolean | null
          receiver_id: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id?: string | null
          content?: string
          created_at?: string
          deleted_for_users?: string[] | null
          id?: string
          is_deleted?: boolean | null
          is_read?: boolean | null
          receiver_id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
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
          settings: Json | null
          tags: string[] | null
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
          settings?: Json | null
          tags?: string[] | null
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
          settings?: Json | null
          tags?: string[] | null
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
          {
            foreignKeyName: "discussion_rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string
          file_type: string | null
          id: string
          name: string
          project_id: string
          size: number
          updated_at: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          file_type?: string | null
          id?: string
          name: string
          project_id: string
          size: number
          updated_at?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          file_type?: string | null
          id?: string
          name?: string
          project_id?: string
          size?: number
          updated_at?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      film_reviews: {
        Row: {
          created_at: string | null
          helpful_count: number | null
          id: string
          is_anonymous: boolean | null
          is_spoiler: boolean | null
          platform_cinema_id: string | null
          review_text: string
          tmdb_id: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          is_anonymous?: boolean | null
          is_spoiler?: boolean | null
          platform_cinema_id?: string | null
          review_text: string
          tmdb_id?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          is_anonymous?: boolean | null
          is_spoiler?: boolean | null
          platform_cinema_id?: string | null
          review_text?: string
          tmdb_id?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "film_reviews_platform_cinema_id_fkey"
            columns: ["platform_cinema_id"]
            isOneToOne: false
            referencedRelation: "platform_cinema"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "film_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_networks: {
        Row: {
          associated_ips: string[] | null
          associated_user_ids: string[] | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          risk_level: string | null
          updated_at: string | null
        }
        Insert: {
          associated_ips?: string[] | null
          associated_user_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          risk_level?: string | null
          updated_at?: string | null
        }
        Update: {
          associated_ips?: string[] | null
          associated_user_ids?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          risk_level?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gov_approval_queue: {
        Row: {
          action: string
          checker_id: string | null
          created_at: string
          id: string
          maker_id: string | null
          payload: Json | null
          reason: string | null
          status: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          checker_id?: string | null
          created_at?: string
          id?: string
          maker_id?: string | null
          payload?: Json | null
          reason?: string | null
          status?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          checker_id?: string | null
          created_at?: string
          id?: string
          maker_id?: string | null
          payload?: Json | null
          reason?: string | null
          status?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "gov_approval_queue_checker_id_fkey"
            columns: ["checker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gov_approval_queue_maker_id_fkey"
            columns: ["maker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gov_audit_ledger: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          id: string
          new_state: Json | null
          payload: Json | null
          prev_state: Json | null
          reason: string | null
          scope: Json | null
          target_id: string
          target_type: string
          timestamp: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          id?: string
          new_state?: Json | null
          payload?: Json | null
          prev_state?: Json | null
          reason?: string | null
          scope?: Json | null
          target_id: string
          target_type: string
          timestamp?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          id?: string
          new_state?: Json | null
          payload?: Json | null
          prev_state?: Json | null
          reason?: string | null
          scope?: Json | null
          target_id?: string
          target_type?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "gov_audit_ledger_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gov_entity_relationships: {
        Row: {
          device_id: string | null
          id: string
          ip_address: string | null
          timestamp: string
          user_id: string | null
        }
        Insert: {
          device_id?: string | null
          id?: string
          ip_address?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Update: {
          device_id?: string | null
          id?: string
          ip_address?: string | null
          timestamp?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gov_entity_relationships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          applicant_id: string
          cover_letter: string | null
          created_at: string | null
          id: string
          job_id: string
          resume_url: string | null
          showreel_url: string | null
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
          showreel_url?: string | null
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
          showreel_url?: string | null
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
          page_id: string | null
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
          page_id?: string | null
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
          page_id?: string | null
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
            foreignKeyName: "jobs_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "company_pages"
            referencedColumns: ["id"]
          },
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
          description: string | null
          document_type: string | null
          id: string
          project_id: string
          title: string
          updated_at: string
          uploaded_by: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          document_type?: string | null
          id?: string
          project_id: string
          title: string
          updated_at?: string
          uploaded_by?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          document_type?: string | null
          id?: string
          project_id?: string
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_docs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_requests: {
        Row: {
          created_at: string | null
          deadline_at: string | null
          evidence_url: string | null
          id: string
          internal_notes: string | null
          request_id: string
          request_type: string
          requester_entity: string
          requester_name: string
          status: string | null
          target_content_id: string | null
          target_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          deadline_at?: string | null
          evidence_url?: string | null
          id?: string
          internal_notes?: string | null
          request_id: string
          request_type: string
          requester_entity: string
          requester_name: string
          status?: string | null
          target_content_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          deadline_at?: string | null
          evidence_url?: string | null
          id?: string
          internal_notes?: string | null
          request_id?: string
          request_type?: string
          requester_entity?: string
          requester_name?: string
          status?: string | null
          target_content_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_requests_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        Relationships: [
          {
            foreignKeyName: "marketplace_bookings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_bookings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_bookings_renter_id_fkey"
            columns: ["renter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          availability_calendar: Json | null
          category: string
          created_at: string | null
          description: string
          id: string
          images: string[] | null
          is_active: boolean | null
          listing_type: Database["public"]["Enums"]["listing_type"]
          location: string
          price_per_day: number
          price_per_week: number | null
          specifications: Json | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          availability_calendar?: Json | null
          category: string
          created_at?: string | null
          description: string
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          listing_type: Database["public"]["Enums"]["listing_type"]
          location: string
          price_per_day: number
          price_per_week?: number | null
          specifications?: Json | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          availability_calendar?: Json | null
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          listing_type?: Database["public"]["Enums"]["listing_type"]
          location?: string
          price_per_day?: number
          price_per_week?: number | null
          specifications?: Json | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "marketplace_reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_reviews_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      mentions: {
        Row: {
          created_at: string | null
          id: string
          mentioned_id: string
          mentioner_id: string
          related_id: string
          related_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mentioned_id: string
          mentioner_id: string
          related_id: string
          related_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mentioned_id?: string
          mentioner_id?: string
          related_id?: string
          related_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentions_mentioned_id_fkey"
            columns: ["mentioned_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_mentioner_id_fkey"
            columns: ["mentioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_message_reactions: {
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
            foreignKeyName: "direct_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
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
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          deleted_for_users: string[] | null
          id: string
          is_deleted: boolean | null
          is_read: boolean | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          deleted_for_users?: string[] | null
          id?: string
          is_deleted?: boolean | null
          is_read?: boolean | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_for_users?: string[] | null
          id?: string
          is_deleted?: boolean | null
          is_read?: boolean | null
          reply_to_id?: string | null
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
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_evidence: {
        Row: {
          created_at: string | null
          description: string | null
          evidence_type: string
          evidence_url: string
          id: string
          report_id: string
          uploader_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          evidence_type: string
          evidence_url: string
          id?: string
          report_id: string
          uploader_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          evidence_type?: string
          evidence_url?: string
          id?: string
          report_id?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_evidence_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_evidence_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          report_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          report_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_notes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          action_type: string
          created_at: string | null
          decision: string
          disclosure_level: string | null
          id: string
          metadata: Json | null
          suppression_reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          decision: string
          disclosure_level?: string | null
          id?: string
          metadata?: Json | null
          suppression_reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          decision?: string
          disclosure_level?: string | null
          id?: string
          metadata?: Json | null
          suppression_reason?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          related_id: string | null
          title: string
          trigger_user_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          related_id?: string | null
          title: string
          trigger_user_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          related_id?: string | null
          title?: string
          trigger_user_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_trigger_user_id_fkey"
            columns: ["trigger_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_access_logs: {
        Row: {
          accessed_by: string | null
          action: string
          created_at: string | null
          id: string
          pitch_submission_id: string | null
        }
        Insert: {
          accessed_by?: string | null
          action: string
          created_at?: string | null
          id?: string
          pitch_submission_id?: string | null
        }
        Update: {
          accessed_by?: string | null
          action?: string
          created_at?: string | null
          id?: string
          pitch_submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pitch_access_logs_accessed_by_fkey"
            columns: ["accessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_access_logs_pitch_submission_id_fkey"
            columns: ["pitch_submission_id"]
            isOneToOne: false
            referencedRelation: "pitch_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_calls: {
        Row: {
          attachments: Json | null
          budget_range: string | null
          compensation: string | null
          created_at: string | null
          creator_id: string
          deadline: string | null
          format: string | null
          genre: string[] | null
          id: string
          is_open_to_debut: boolean | null
          is_published: boolean | null
          is_regional_welcome: boolean | null
          language: string[] | null
          nda_required: boolean | null
          project_type: string
          ref_films: string | null
          requirement_description: string
          rights_expectation: string | null
          slug: string | null
          status: string | null
          subgenre: string | null
          target_audience: string | null
          title: string
          tone: string | null
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          attachments?: Json | null
          budget_range?: string | null
          compensation?: string | null
          created_at?: string | null
          creator_id: string
          deadline?: string | null
          format?: string | null
          genre?: string[] | null
          id?: string
          is_open_to_debut?: boolean | null
          is_published?: boolean | null
          is_regional_welcome?: boolean | null
          language?: string[] | null
          nda_required?: boolean | null
          project_type: string
          ref_films?: string | null
          requirement_description: string
          rights_expectation?: string | null
          slug?: string | null
          status?: string | null
          subgenre?: string | null
          target_audience?: string | null
          title: string
          tone?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          attachments?: Json | null
          budget_range?: string | null
          compensation?: string | null
          created_at?: string | null
          creator_id?: string
          deadline?: string | null
          format?: string | null
          genre?: string[] | null
          id?: string
          is_open_to_debut?: boolean | null
          is_published?: boolean | null
          is_regional_welcome?: boolean | null
          language?: string[] | null
          nda_required?: boolean | null
          project_type?: string
          ref_films?: string | null
          requirement_description?: string
          rights_expectation?: string | null
          slug?: string | null
          status?: string | null
          subgenre?: string | null
          target_audience?: string | null
          title?: string
          tone?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pitch_calls_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_submissions: {
        Row: {
          character_notes: string | null
          created_at: string | null
          format: string | null
          full_synopsis: string | null
          genre: string | null
          id: string
          is_original_work: boolean | null
          language: string | null
          logline: string
          lookbook_url: string | null
          moodboard_url: string | null
          nda_preferred: boolean | null
          passed_at: string | null
          pilot_outline: string | null
          pitch_call_id: string
          reference_links: string[] | null
          reviewed_at: string | null
          rights_owned: boolean | null
          seen_at: string | null
          short_synopsis: string
          shortlisted_at: string | null
          status: string | null
          submitted_at: string | null
          submitter_id: string
          title: string
          tone: string | null
          treatment_url: string | null
          updated_at: string | null
          why_fits: string | null
        }
        Insert: {
          character_notes?: string | null
          created_at?: string | null
          format?: string | null
          full_synopsis?: string | null
          genre?: string | null
          id?: string
          is_original_work?: boolean | null
          language?: string | null
          logline: string
          lookbook_url?: string | null
          moodboard_url?: string | null
          nda_preferred?: boolean | null
          passed_at?: string | null
          pilot_outline?: string | null
          pitch_call_id: string
          reference_links?: string[] | null
          reviewed_at?: string | null
          rights_owned?: boolean | null
          seen_at?: string | null
          short_synopsis: string
          shortlisted_at?: string | null
          status?: string | null
          submitted_at?: string | null
          submitter_id: string
          title: string
          tone?: string | null
          treatment_url?: string | null
          updated_at?: string | null
          why_fits?: string | null
        }
        Update: {
          character_notes?: string | null
          created_at?: string | null
          format?: string | null
          full_synopsis?: string | null
          genre?: string | null
          id?: string
          is_original_work?: boolean | null
          language?: string | null
          logline?: string
          lookbook_url?: string | null
          moodboard_url?: string | null
          nda_preferred?: boolean | null
          passed_at?: string | null
          pilot_outline?: string | null
          pitch_call_id?: string
          reference_links?: string[] | null
          reviewed_at?: string | null
          rights_owned?: boolean | null
          seen_at?: string | null
          short_synopsis?: string
          shortlisted_at?: string | null
          status?: string | null
          submitted_at?: string | null
          submitter_id?: string
          title?: string
          tone?: string | null
          treatment_url?: string | null
          updated_at?: string | null
          why_fits?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pitch_submissions_pitch_call_id_fkey"
            columns: ["pitch_call_id"]
            isOneToOne: false
            referencedRelation: "pitch_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pitch_submissions_submitter_id_fkey"
            columns: ["submitter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_announcements: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          message: string
          target_audience: string | null
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message: string
          target_audience?: string | null
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          message?: string
          target_audience?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_cinema: {
        Row: {
          backdrop_url: string | null
          created_at: string | null
          creator_id: string | null
          credits: Json | null
          genre: string[] | null
          id: string
          is_published: boolean | null
          overview: string | null
          poster_url: string | null
          release_date: string | null
          runtime: number | null
          title: string
          trailer_url: string | null
          type: string
          view_count: number | null
        }
        Insert: {
          backdrop_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          credits?: Json | null
          genre?: string[] | null
          id?: string
          is_published?: boolean | null
          overview?: string | null
          poster_url?: string | null
          release_date?: string | null
          runtime?: number | null
          title: string
          trailer_url?: string | null
          type: string
          view_count?: number | null
        }
        Update: {
          backdrop_url?: string | null
          created_at?: string | null
          creator_id?: string | null
          credits?: Json | null
          genre?: string[] | null
          id?: string
          is_published?: boolean | null
          overview?: string | null
          poster_url?: string | null
          release_date?: string | null
          runtime?: number | null
          title?: string
          trailer_url?: string | null
          type?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_cinema_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_flags: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: boolean | null
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: boolean | null
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_policies: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_rules: {
        Row: {
          category: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          category?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      post_bookmarks: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_comment_id: string | null
          parent_id: string | null
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          parent_id?: string | null
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_comment_id?: string | null
          parent_id?: string | null
          post_id?: string
          updated_at?: string | null
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
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
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
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          media_items: Json | null
          media_type: string | null
          media_url: string | null
          page_id: string | null
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
          media_items?: Json | null
          media_type?: string | null
          media_url?: string | null
          page_id?: string | null
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
          media_items?: Json | null
          media_type?: string | null
          media_url?: string | null
          page_id?: string | null
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
          {
            foreignKeyName: "posts_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "company_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_views: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          bio: string | null
          cover_image_url: string | null
          craft: string | null
          encrypted_private_key: string | null
          experience: string | null
          force_password_reset: boolean | null
          full_name: string | null
          id: string
          instagram_url: string | null
          is_banned: boolean | null
          is_internal: boolean | null
          is_official_team: boolean | null
          is_shadowbanned: boolean | null
          is_verified: boolean | null
          key_salt: string | null
          last_muted_at: string | null
          location: string | null
          mute_expires_at: string | null
          onboarding_completed: boolean | null
          phone: string | null
          public_key: string | null
          push_token: string | null
          restriction_flags: string[] | null
          sessions_revoked_at: string | null
          shadow_banned_at: string | null
          social_links: Json | null
          trust_score: number | null
          updated_at: string | null
          username: string | null
          website: string | null
          youtube_url: string | null
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_image_url?: string | null
          craft?: string | null
          encrypted_private_key?: string | null
          experience?: string | null
          force_password_reset?: boolean | null
          full_name?: string | null
          id: string
          instagram_url?: string | null
          is_banned?: boolean | null
          is_internal?: boolean | null
          is_official_team?: boolean | null
          is_shadowbanned?: boolean | null
          is_verified?: boolean | null
          key_salt?: string | null
          last_muted_at?: string | null
          location?: string | null
          mute_expires_at?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          public_key?: string | null
          push_token?: string | null
          restriction_flags?: string[] | null
          sessions_revoked_at?: string | null
          shadow_banned_at?: string | null
          social_links?: Json | null
          trust_score?: number | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
          youtube_url?: string | null
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          bio?: string | null
          cover_image_url?: string | null
          craft?: string | null
          encrypted_private_key?: string | null
          experience?: string | null
          force_password_reset?: boolean | null
          full_name?: string | null
          id?: string
          instagram_url?: string | null
          is_banned?: boolean | null
          is_internal?: boolean | null
          is_official_team?: boolean | null
          is_shadowbanned?: boolean | null
          is_verified?: boolean | null
          key_salt?: string | null
          last_muted_at?: string | null
          location?: string | null
          mute_expires_at?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          public_key?: string | null
          push_token?: string | null
          restriction_flags?: string[] | null
          sessions_revoked_at?: string | null
          shadow_banned_at?: string | null
          social_links?: Json | null
          trust_score?: number | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      project_applications: {
        Row: {
          cover_letter: string | null
          created_at: string
          id: string
          project_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string
          id?: string
          project_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_letter?: string | null
          created_at?: string
          id?: string
          project_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_applications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_credits: {
        Row: {
          created_at: string
          id: string
          project_id: string | null
          project_title: string
          role: string
          user_id: string
          verifier_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          project_id?: string | null
          project_title: string
          role: string
          user_id: string
          verifier_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string | null
          project_title?: string
          role?: string
          user_id?: string
          verifier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_credits_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_credits_verifier_id_fkey"
            columns: ["verifier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invites: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          invite_code: string
          max_uses: number | null
          project_id: string
          updated_at: string
          used_count: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          invite_code: string
          max_uses?: number | null
          project_id: string
          updated_at?: string
          used_count?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          invite_code?: string
          max_uses?: number | null
          project_id?: string
          updated_at?: string
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_invites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
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
          last_read_at: string | null
          project_space_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string | null
          project_space_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string | null
          project_space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_message_read_status_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_message_read_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_messages: {
        Row: {
          content: string
          created_at: string
          deleted_for_users: string[] | null
          id: string
          is_deleted: boolean | null
          project_id: string
          reply_to_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_for_users?: string[] | null
          id?: string
          is_deleted?: boolean | null
          project_id: string
          reply_to_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_for_users?: string[] | null
          id?: string
          is_deleted?: boolean | null
          project_id?: string
          reply_to_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "project_messages"
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
        Relationships: [
          {
            foreignKeyName: "project_space_bookmarks_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
        ]
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
      project_space_join_requests: {
        Row: {
          created_at: string
          id: number
          message: string | null
          project_space_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          message?: string | null
          project_space_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          message?: string | null
          project_space_id?: string
          status?: string
          user_id?: string
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
          },
        ]
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
          },
        ]
      }
      project_space_message_read_status: {
        Row: {
          id: string
          last_read_at: string
          project_space_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          project_space_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          project_space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_space_message_read_status_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_space_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          content: string
          created_at: string
          deleted_for_users: string[] | null
          id: string
          is_deleted: boolean | null
          project_space_id: string
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          content: string
          created_at?: string
          deleted_for_users?: string[] | null
          id?: string
          is_deleted?: boolean | null
          project_space_id: string
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          content?: string
          created_at?: string
          deleted_for_users?: string[] | null
          id?: string
          is_deleted?: boolean | null
          project_space_id?: string
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_psm_space_id"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_psm_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_space_messages_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_space_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "project_space_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      project_space_message_reactions: {
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
            foreignKeyName: "project_space_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "project_space_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_space_message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_spaces: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          category_id: string | null
          created_at: string
          creator_id: string | null
          description: string | null
          end_date: string | null
          genre: string[] | null
          id: string
          last_activity_at: string | null
          location: string | null
          name: string
          project_id: string | null
          project_space_type:
            | Database["public"]["Enums"]["project_space_type"]
            | null
          required_roles: string[] | null
          start_date: string | null
          status: string | null
          tags: string[] | null
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          category_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          end_date?: string | null
          genre?: string[] | null
          id?: string
          last_activity_at?: string | null
          location?: string | null
          name: string
          project_id?: string | null
          project_space_type?:
            | Database["public"]["Enums"]["project_space_type"]
            | null
          required_roles?: string[] | null
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          category_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          end_date?: string | null
          genre?: string[] | null
          id?: string
          last_activity_at?: string | null
          location?: string | null
          name?: string
          project_id?: string | null
          project_space_type?:
            | Database["public"]["Enums"]["project_space_type"]
            | null
          required_roles?: string[] | null
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "project_spaces_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "project_space_categories"
            referencedColumns: ["id"]
          },
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
          image_url: string | null
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
          image_url?: string | null
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
          image_url?: string | null
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
      review_helpful_marks: {
        Row: {
          created_at: string | null
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          review_id?: string
          user_id?: string
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
      room_join_requests: {
        Row: {
          created_at: string
          id: number
          room_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          room_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          room_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_join_requests_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "discussion_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_keys: {
        Row: {
          created_at: string | null
          encrypted_key: string
          id: string
          room_id: string
          sender_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted_key: string
          id?: string
          room_id: string
          sender_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted_key?: string
          id?: string
          room_id?: string
          sender_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      room_members: {
        Row: {
          joined_at: string
          role: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: string | null
          room_id: string
          user_id: string
        }
        Update: {
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
      room_message_read_status: {
        Row: {
          last_read_at: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string | null
          room_id?: string
          user_id?: string
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
          },
        ]
      }
      room_messages: {
        Row: {
          content: string
          created_at: string
          deleted_for_users: string[] | null
          id: string
          is_deleted: boolean | null
          media_type: string | null
          media_url: string | null
          priority: string | null
          reply_to_id: string | null
          room_id: string
          user_id: string
          visibility_role: string | null
        }
        Insert: {
          content: string
          created_at?: string
          deleted_for_users?: string[] | null
          id?: string
          is_deleted?: boolean | null
          media_type?: string | null
          media_url?: string | null
          priority?: string | null
          reply_to_id?: string | null
          room_id: string
          user_id: string
          visibility_role?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          deleted_for_users?: string[] | null
          id?: string
          is_deleted?: boolean | null
          media_type?: string | null
          media_url?: string | null
          priority?: string | null
          reply_to_id?: string | null
          room_id?: string
          user_id?: string
          visibility_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "room_messages"
            referencedColumns: ["id"]
          },
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
      room_message_reactions: {
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
            foreignKeyName: "room_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "room_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_pitch_calls: {
        Row: {
          created_at: string | null
          id: string
          pitch_call_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          pitch_call_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          pitch_call_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_pitch_calls_pitch_call_id_fkey"
            columns: ["pitch_call_id"]
            isOneToOne: false
            referencedRelation: "pitch_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_pitch_calls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_items: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          project_id: string
          start_date: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          project_id: string
          start_date: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          project_id?: string
          start_date?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          device_id: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          severity: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          severity?: string | null
          user_id?: string | null
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
          created_at: string
          description: string
          id: string
          notes: string | null
          project_id: string
          scene: number
          shot: number
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          notes?: string | null
          project_id: string
          scene: number
          shot: number
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          notes?: string | null
          project_id?: string
          scene?: number
          shot?: number
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shot_list_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          sender_id: string
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          sender_id: string
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          sender_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          attachment_url: string | null
          category: string | null
          created_at: string | null
          id: string
          message: string
          priority: string | null
          status: string | null
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          attachment_url?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          message: string
          priority?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          attachment_url?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          message?: string
          priority?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_announcements: {
        Row: {
          action_url: string | null
          body: string
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          send_push: boolean | null
          title: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          send_push?: boolean | null
          title: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          send_push?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_incidents: {
        Row: {
          id: string
          impact_description: string | null
          maintenance_mode_required: boolean | null
          resolved_at: string | null
          severity: string | null
          started_at: string | null
          status: string | null
          title: string
        }
        Insert: {
          id?: string
          impact_description?: string | null
          maintenance_mode_required?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          started_at?: string | null
          status?: string | null
          title: string
        }
        Update: {
          id?: string
          impact_description?: string | null
          maintenance_mode_required?: boolean | null
          resolved_at?: string | null
          severity?: string | null
          started_at?: string | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean | null
          name: string
          project_space_id: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          name: string
          project_space_id: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          name?: string
          project_space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activities: {
        Row: {
          activity_data: Json | null
          activity_type: string
          created_at: string
          id: string
          is_read: boolean | null
          user_id: string
        }
        Insert: {
          activity_data?: Json | null
          activity_type: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          user_id: string
        }
        Update: {
          activity_data?: Json | null
          activity_type?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      user_announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string | null
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string | null
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "platform_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_announcement_dismissals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bans: {
        Row: {
          ban_type: string | null
          banned_by: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          lifted_at: string | null
          lifted_by: string | null
          reason: string
          user_id: string
        }
        Insert: {
          ban_type?: string | null
          banned_by: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          lifted_at?: string | null
          lifted_by?: string | null
          reason: string
          user_id: string
        }
        Update: {
          ban_type?: string | null
          banned_by?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          lifted_at?: string | null
          lifted_by?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bans_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bans_lifted_by_fkey"
            columns: ["lifted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "user_experience_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_film_ratings: {
        Row: {
          created_at: string
          id: string
          platform_cinema_id: string | null
          rating: number
          tmdb_id: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform_cinema_id?: string | null
          rating: number
          tmdb_id?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform_cinema_id?: string | null
          rating?: number
          tmdb_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_film_ratings_platform_cinema_id_fkey"
            columns: ["platform_cinema_id"]
            isOneToOne: false
            referencedRelation: "platform_cinema"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_follower_user"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_following_user"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      user_push_tokens: {
        Row: {
          active: boolean
          created_at: string
          device_id: string | null
          id: string
          last_seen: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          device_id?: string | null
          id?: string
          last_seen?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          device_id?: string | null
          id?: string
          last_seen?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_risk_profiles: {
        Row: {
          device_hashes: string[] | null
          id: string
          ip_risk_score: number | null
          is_proxy_detected: boolean | null
          is_vpn_detected: boolean | null
          known_ips: string[] | null
          last_updated_at: string | null
          user_id: string
        }
        Insert: {
          device_hashes?: string[] | null
          id?: string
          ip_risk_score?: number | null
          is_proxy_detected?: boolean | null
          is_vpn_detected?: boolean | null
          known_ips?: string[] | null
          last_updated_at?: string | null
          user_id: string
        }
        Update: {
          device_hashes?: string[] | null
          id?: string
          ip_risk_score?: number | null
          is_proxy_detected?: boolean | null
          is_vpn_detected?: boolean | null
          known_ips?: string[] | null
          last_updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_risk_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          app_version: string | null
          created_at: string
          device_id: string
          device_name: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          last_active_at: string
          platform: string | null
          refresh_token_hash: string
          revoked_at: string | null
          suspicious: boolean | null
          trusted: boolean | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_id: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string
          platform?: string | null
          refresh_token_hash: string
          revoked_at?: string | null
          suspicious?: boolean | null
          trusted?: boolean | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_id?: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          last_active_at?: string
          platform?: string | null
          refresh_token_hash?: string
          revoked_at?: string | null
          suspicious?: boolean | null
          trusted?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          allow_messages_from: string | null
          comment_notifications: boolean | null
          created_at: string | null
          email_notifications: boolean | null
          font_size: string | null
          high_contrast: boolean | null
          id: string
          job_alerts: boolean | null
          language: string | null
          message_notifications: boolean | null
          notification_sounds: boolean | null
          profile_visibility: string | null
          project_notifications: boolean | null
          push_notifications: boolean | null
          reduce_motion: boolean | null
          show_email: boolean | null
          show_location: boolean | null
          show_online_status: boolean | null
          sound_effects: boolean | null
          theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allow_messages_from?: string | null
          comment_notifications?: boolean | null
          created_at?: string | null
          email_notifications?: boolean | null
          font_size?: string | null
          high_contrast?: boolean | null
          id?: string
          job_alerts?: boolean | null
          language?: string | null
          message_notifications?: boolean | null
          notification_sounds?: boolean | null
          profile_visibility?: string | null
          project_notifications?: boolean | null
          push_notifications?: boolean | null
          reduce_motion?: boolean | null
          show_email?: boolean | null
          show_location?: boolean | null
          show_online_status?: boolean | null
          sound_effects?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allow_messages_from?: string | null
          comment_notifications?: boolean | null
          created_at?: string | null
          email_notifications?: boolean | null
          font_size?: string | null
          high_contrast?: boolean | null
          id?: string
          job_alerts?: boolean | null
          language?: string | null
          message_notifications?: boolean | null
          notification_sounds?: boolean | null
          profile_visibility?: string | null
          project_notifications?: boolean | null
          push_notifications?: boolean | null
          reduce_motion?: boolean | null
          show_email?: boolean | null
          show_location?: boolean | null
          show_online_status?: boolean | null
          sound_effects?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "user_skills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          business_name: string
          category: string[]
          created_at: string | null
          description: string
          email: string
          id: string
          images: string[] | null
          is_verified: boolean | null
          location: string
          logo_url: string | null
          owner_id: string
          phone: string
          services_offered: string[] | null
          updated_at: string | null
          verification_date: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          business_name: string
          category: string[]
          created_at?: string | null
          description: string
          email: string
          id?: string
          images?: string[] | null
          is_verified?: boolean | null
          location: string
          logo_url?: string | null
          owner_id: string
          phone: string
          services_offered?: string[] | null
          updated_at?: string | null
          verification_date?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          category?: string[]
          created_at?: string | null
          description?: string
          email?: string
          id?: string
          images?: string[] | null
          is_verified?: boolean | null
          location?: string
          logo_url?: string | null
          owner_id?: string
          phone?: string
          services_offered?: string[] | null
          updated_at?: string | null
          verification_date?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          created_at: string | null
          full_legal_name: string
          government_id_url: string | null
          id: string
          reason: string
          rejection_reason: string | null
          request_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          social_links: Json | null
          status: string | null
          supporting_doc_url: string | null
          updated_at: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_legal_name: string
          government_id_url?: string | null
          id?: string
          reason: string
          rejection_reason?: string | null
          request_type: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json | null
          status?: string | null
          supporting_doc_url?: string | null
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_legal_name?: string
          government_id_url?: string | null
          id?: string
          reason?: string
          rejection_reason?: string | null
          request_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json | null
          status?: string | null
          supporting_doc_url?: string | null
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vip_invites: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          is_used: boolean | null
          role_granted: string | null
          used_by_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          is_used?: boolean | null
          role_granted?: string | null
          used_by_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          is_used?: boolean | null
          role_granted?: string | null
          used_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vip_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vip_invites_used_by_id_fkey"
            columns: ["used_by_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_join_request: { Args: { _request_id: number }; Returns: boolean }
      approve_verification: {
        Args: { _request_id: string }
        Returns: undefined
      }
      assign_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      ban_user: {
        Args: {
          _ban_type?: string
          _expires_at?: string
          _reason: string
          _target_user_id: string
        }
        Returns: undefined
      }
      check_is_project_creator: {
        Args: { _project_id: string }
        Returns: boolean
      }
      check_is_project_member: {
        Args: { _project_id: string }
        Returns: boolean
      }
      claim_admin_access: { Args: never; Returns: undefined }
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
      force_logout_user: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      force_password_reset_user: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      format_notification_message: {
        Args: { content: string }
        Returns: string
      }
      get_admin_stats: { Args: never; Returns: Json }
      get_aggregated_film_ratings: {
        Args: { tmdb_ids: number[] }
        Returns: {
          average_rating: number
          review_count: number
          tmdb_id: number
        }[]
      }
      get_home_feed_data: { Args: { user_id_param: string }; Returns: Json }
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
      get_marketplace_listings_optimized: {
        Args: {
          filter_category?: string
          filter_location?: string
          filter_type?: string
          max_price?: number
          min_price?: number
          search_query?: string
        }
        Returns: {
          availability_calendar: Json
          category: string
          created_at: string
          description: string
          id: string
          images: string[]
          location: string
          price: number
          price_unit: string
          profile_data: Json
          specifications: Json
          title: string
          type: string
          updated_at: string
          user_id: string
        }[]
      }
      get_messages_for_channel: {
        Args: { p_channel_id: string }
        Returns: {
          content: string
          created_at: string
          deleted_for_users: string[]
          id: string
          is_deleted: boolean
          is_read: boolean
          replied_to_message: Json
          reply_to_id: string
          sender_id: string
          sender_profile: Json
        }[]
      }
      get_messages_for_channel_paginated: {
        Args: { p_channel_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          attachment_type: string
          attachment_url: string
          content: string
          created_at: string
          deleted_for_users: string[]
          id: string
          is_deleted: boolean
          is_read: boolean
          replied_to_message: Json
          reply_to_id: string
          sender_id: string
          sender_profile: Json
        }[]
      }
      get_platform_economics: { Args: never; Returns: Json }
      get_total_unread_count: { Args: never; Returns: number }
      get_unread_message_previews: {
        Args: { limit_count?: number }
        Returns: {
          chat_type: string
          context_id: string
          last_message: string
          last_timestamp: string
          sender_avatar: string
          sender_id: string
          sender_name: string
          unread_count: number
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
      get_user_message_threads: {
        Args: { p_user_id: string }
        Returns: {
          id: string
          last_message: Json
          participants: Json
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_unread_messages: { Args: never; Returns: boolean }
      hide_message_for_user: {
        Args: { p_message_id: string; p_table: string }
        Returns: undefined
      }
      is_current_user_internal: { Args: never; Returns: boolean }
      is_member_of_project: { Args: { _project_id: string }; Returns: boolean }
      is_member_of_room: { Args: { _room_id: string }; Returns: boolean }
      is_project_creator: {
        Args: { _project_space_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_space_id: string }
        Returns: boolean
      }
      is_room_member: { Args: { _room_id: string }; Returns: boolean }
      lift_ban: { Args: { _target_user_id: string }; Returns: undefined }
      mark_message_as_seen: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      mark_project_message_as_seen: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      mark_room_message_as_seen: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      mute_user: {
        Args: {
          _duration_hours: number
          _reason: string
          _target_user_id: string
        }
        Returns: undefined
      }
      reject_join_request: { Args: { _request_id: number }; Returns: boolean }
      reject_verification: {
        Args: { _reason: string; _request_id: string }
        Returns: undefined
      }
      resolve_report: {
        Args: { _note?: string; _report_id: string; _status: string }
        Returns: undefined
      }
      restore_user_access: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      revoke_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
          website: string
        }[]
      }
      send_governance_notification: {
        Args: {
          _action_type: string
          _disclosure_level?: string
          _metadata?: Json
          _notify_user?: boolean
          _reason?: string
          _suppression_reason?: string
          _target_user_id: string
        }
        Returns: undefined
      }
      set_monetization_status: {
        Args: { _disabled: boolean; _reason: string; _user_id: string }
        Returns: undefined
      }
      shadow_ban_user: {
        Args: { _reason: string; _target_user_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_call:
        | {
            Args: {
              p_call_type?: string
              p_created_by: string
              p_room_id: string
            }
            Returns: Json
          }
        | {
            Args: { call_type: string; created_by: string; room_id: string }
            Returns: Json
          }
    }
    Enums: {
      app_role: "user" | "moderator" | "admin" | "super_admin"
      booking_status: "pending" | "confirmed" | "cancelled" | "completed"
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
      app_role: ["user", "moderator", "admin", "super_admin"],
      booking_status: ["pending", "confirmed", "cancelled", "completed"],
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
