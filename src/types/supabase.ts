Connecting to db 5432
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          content: string | null
          id: string
          posted_at: string
          title: string
        }
        Insert: {
          content?: string | null
          id?: string
          posted_at?: string
          title: string
        }
        Update: {
          content?: string | null
          id?: string
          posted_at?: string
          title?: string
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
      calls: {
        Row: {
          created_at: string
          created_by: string
          ended_at: string | null
          id: string
          project_space_id: string
          status: Database["public"]["Enums"]["call_status"]
          type: Database["public"]["Enums"]["call_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          ended_at?: string | null
          id?: string
          project_space_id: string
          status?: Database["public"]["Enums"]["call_status"]
          type: Database["public"]["Enums"]["call_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          ended_at?: string | null
          id?: string
          project_space_id?: string
          status?: Database["public"]["Enums"]["call_status"]
          type?: Database["public"]["Enums"]["call_type"]
        }
        Relationships: [
          {
            foreignKeyName: "calls_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
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
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_post_id"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
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
      discussion_rooms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          member_count: number | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          member_count?: number | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          member_count?: number | null
          name?: string
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
            foreignKeyName: "fk_post_id"
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
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          about_me: string | null
          avatar_url: string | null
          craft: string | null
          experience: string | null
          full_name: string | null
          id: string
          instagram_url: string | null
          updated_at: string | null
          username: string | null
          website: string | null
          youtube_url: string | null
        }
        Insert: {
          about_me?: string | null
          avatar_url?: string | null
          craft?: string | null
          experience?: string | null
          full_name?: string | null
          id: string
          instagram_url?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
          youtube_url?: string | null
        }
        Update: {
          about_me?: string | null
          avatar_url?: string | null
          craft?: string | null
          experience?: string | null
          full_name?: string | null
          id?: string
          instagram_url?: string | null
          updated_at?: string | null
          username?: string | null
          website?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      project_space_bookmarks: {
        Row: {
          created_at: string
          project_space_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          project_space_id: string
          user_id: string
        }
        Update: {
          created_at?: string
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
          project_space_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          project_space_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
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
          user_id: string
        }
        Insert: {
          created_at?: string
          project_space_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          project_space_id?: string
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
        Relationships: [
          {
            foreignKeyName: "project_space_messages_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_spaces: {
        Row: {
          category_id: string | null
          created_at: string
          creator_id: string | null
          description: string | null
          id: string
          is_public: boolean | null
          last_activity_at: string | null
          name: string
          project_space_type:
            | Database["public"]["Enums"]["project_space_type"]
            | null
          tags: string[] | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          last_activity_at?: string | null
          name: string
          project_space_type?:
            | Database["public"]["Enums"]["project_space_type"]
            | null
          tags?: string[] | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          last_activity_at?: string | null
          name?: string
          project_space_type?:
            | Database["public"]["Enums"]["project_space_type"]
            | null
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
        ]
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
            foreignKeyName: "fk_post_id"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      shot_list: {
        Row: {
          description: string | null
          id: number
          project_space_id: string | null
          scene: number | null
          shot: number | null
        }
        Insert: {
          description?: string | null
          id?: number
          project_space_id?: string | null
          scene?: number | null
          shot?: number | null
        }
        Update: {
          description?: string | null
          id?: number
          project_space_id?: string | null
          scene?: number | null
          shot?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shot_list_project_space_id_fkey"
            columns: ["project_space_id"]
            isOneToOne: false
            referencedRelation: "project_spaces"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_project_space_and_category: {
        Args: {
          p_category_name: string
          p_description: string
          p_name: string
          p_project_space_type: Database["public"]["Enums"]["project_space_type"]
        }
        Returns: string
      }
      end_call: {
        Args: { p_call_id: string; p_user_id: string }
        Returns: undefined
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
      has_unread_messages: { Args: never; Returns: boolean }
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
      start_call: {
        Args: {
          p_call_type: Database["public"]["Enums"]["call_type"]
          p_created_by: string
          p_project_space_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      call_status: "active" | "ended"
      call_type: "audio" | "video"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      call_status: ["active", "ended"],
      call_type: ["audio", "video"],
      project_space_type: ["public", "private", "secret"],
    },
  },
} as const

