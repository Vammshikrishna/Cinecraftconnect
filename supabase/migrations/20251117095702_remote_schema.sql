create extension if not exists "pgjwt" with schema "extensions";

drop extension if exists "pg_net";

create type "public"."app_role" as enum ('admin', 'moderator', 'user');

drop trigger if exists "on_new_message_update_room_activity" on "public"."room_messages";

drop policy "Users can create conversations" on "public"."conversations";

drop policy "Users can view their own conversations" on "public"."conversations";

drop policy "Creators can delete their own rooms" on "public"."discussion_rooms";

drop policy "Creators can update their own rooms" on "public"."discussion_rooms";

drop policy "Users can create rooms" on "public"."discussion_rooms";

drop policy "Users can view all public rooms" on "public"."discussion_rooms";

drop policy "Users can view private rooms they are members of" on "public"."discussion_rooms";

drop policy "Users can delete their own reactions" on "public"."message_reactions";

drop policy "Users can insert their own reactions" on "public"."message_reactions";

drop policy "Users can view all reactions" on "public"."message_reactions";

drop policy "Users can send messages in their conversations" on "public"."messages";

drop policy "Users can view messages in their conversations" on "public"."messages";

drop policy "Users can insert their own profile." on "public"."profiles";

drop policy "Users can update own profile." on "public"."profiles";

drop policy "Room creators can delete join requests" on "public"."room_join_requests";

drop policy "Room creators can update join requests" on "public"."room_join_requests";

drop policy "Room creators can view join requests" on "public"."room_join_requests";

drop policy "Users can create their own join requests" on "public"."room_join_requests";

drop policy "Room creators can add members" on "public"."room_members";

drop policy "Users can view members of rooms they are in" on "public"."room_members";

drop policy "Users can delete their own messages" on "public"."room_messages";

drop policy "Users can send messages in rooms they are part of" on "public"."room_messages";

drop policy "Users in a room can view messages" on "public"."room_messages";

drop policy "Enable delete for users based on user_id" on "public"."user_experience";

drop policy "Enable insert for authenticated users only" on "public"."user_experience";

drop policy "Enable read access for all users" on "public"."user_experience";

drop policy "Enable update for users based on user_id" on "public"."user_experience";

drop policy "Enable delete for users based on user_id" on "public"."user_skills";

drop policy "Enable insert for authenticated users only" on "public"."user_skills";

drop policy "Enable read access for all users" on "public"."user_skills";

drop policy "Enable update for users based on user_id" on "public"."user_skills";

drop policy "Public profiles are viewable by everyone." on "public"."profiles";

drop policy "Users can leave rooms" on "public"."room_members";

revoke delete on table "public"."user_experience" from "anon";

revoke insert on table "public"."user_experience" from "anon";

revoke references on table "public"."user_experience" from "anon";

revoke select on table "public"."user_experience" from "anon";

revoke trigger on table "public"."user_experience" from "anon";

revoke truncate on table "public"."user_experience" from "anon";

revoke update on table "public"."user_experience" from "anon";

revoke delete on table "public"."user_experience" from "authenticated";

revoke insert on table "public"."user_experience" from "authenticated";

revoke references on table "public"."user_experience" from "authenticated";

revoke select on table "public"."user_experience" from "authenticated";

revoke trigger on table "public"."user_experience" from "authenticated";

revoke truncate on table "public"."user_experience" from "authenticated";

revoke update on table "public"."user_experience" from "authenticated";

revoke delete on table "public"."user_experience" from "service_role";

revoke insert on table "public"."user_experience" from "service_role";

revoke references on table "public"."user_experience" from "service_role";

revoke select on table "public"."user_experience" from "service_role";

revoke trigger on table "public"."user_experience" from "service_role";

revoke truncate on table "public"."user_experience" from "service_role";

revoke update on table "public"."user_experience" from "service_role";

revoke delete on table "public"."user_skills" from "anon";

revoke insert on table "public"."user_skills" from "anon";

revoke references on table "public"."user_skills" from "anon";

revoke select on table "public"."user_skills" from "anon";

revoke trigger on table "public"."user_skills" from "anon";

revoke truncate on table "public"."user_skills" from "anon";

revoke update on table "public"."user_skills" from "anon";

revoke delete on table "public"."user_skills" from "authenticated";

revoke insert on table "public"."user_skills" from "authenticated";

revoke references on table "public"."user_skills" from "authenticated";

revoke select on table "public"."user_skills" from "authenticated";

revoke trigger on table "public"."user_skills" from "authenticated";

revoke truncate on table "public"."user_skills" from "authenticated";

revoke update on table "public"."user_skills" from "authenticated";

revoke delete on table "public"."user_skills" from "service_role";

revoke insert on table "public"."user_skills" from "service_role";

revoke references on table "public"."user_skills" from "service_role";

revoke select on table "public"."user_skills" from "service_role";

revoke trigger on table "public"."user_skills" from "service_role";

revoke truncate on table "public"."user_skills" from "service_role";

revoke update on table "public"."user_skills" from "service_role";

alter table "public"."comments" drop constraint "comments_parent_comment_id_fkey";

alter table "public"."conversations" drop constraint "conversations_user1_id_fkey";

alter table "public"."conversations" drop constraint "conversations_user1_id_user2_id_key";

alter table "public"."conversations" drop constraint "conversations_user2_id_fkey";

alter table "public"."message_reactions" drop constraint "message_reactions_user_id_fkey";

alter table "public"."message_reactions" drop constraint "unique_reaction";

alter table "public"."profiles" drop constraint "username_length";

alter table "public"."user_experience" drop constraint "user_experience_user_id_fkey";

alter table "public"."user_skills" drop constraint "user_skills_user_id_fkey";

alter table "public"."discussion_rooms" drop constraint "discussion_rooms_creator_id_fkey";

alter table "public"."room_messages" drop constraint "room_messages_user_id_fkey";

drop function if exists "public"."create_room_and_category"(p_name text, p_description text, p_category_name text, p_room_type public.room_type);

drop function if exists "public"."has_unread_messages"();

drop function if exists "public"."get_user_conversations"(p_user_id uuid);

alter table "public"."user_experience" drop constraint "user_experience_pkey";

alter table "public"."user_skills" drop constraint "user_skills_pkey";

alter table "public"."room_members" drop constraint "room_members_pkey";

drop index if exists "public"."conversations_user1_id_user2_id_key";

drop index if exists "public"."unique_reaction";

drop index if exists "public"."user_experience_pkey";

drop index if exists "public"."user_skills_pkey";

drop index if exists "public"."room_members_pkey";

drop table "public"."user_experience";

drop table "public"."user_skills";

alter type "public"."room_type" rename to "room_type__old_version_to_be_dropped";

create type "public"."room_type" as enum ('public', 'private');


  create table "public"."ai_recommendations" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "recommendation_type" text not null,
    "recommended_id" uuid not null,
    "recommended_type" text not null,
    "score" numeric(3,2) default 0.5,
    "reason" text,
    "ai_model" text default 'content-based'::text,
    "interaction_data" jsonb default '{}'::jsonb,
    "is_shown" boolean default false,
    "is_clicked" boolean default false,
    "is_dismissed" boolean default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_recommendations" enable row level security;


  create table "public"."announcements" (
    "id" uuid not null default gen_random_uuid(),
    "author_id" uuid not null,
    "title" text not null,
    "content" text not null,
    "event_date" date,
    "event_location" text,
    "posted_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."announcements" enable row level security;


  create table "public"."audit_logs" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "action" text not null,
    "table_name" text,
    "record_id" uuid,
    "old_data" jsonb,
    "new_data" jsonb,
    "ip_address" text,
    "user_agent" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."audit_logs" enable row level security;


  create table "public"."background_jobs" (
    "id" uuid not null default gen_random_uuid(),
    "job_type" text not null,
    "payload" jsonb default '{}'::jsonb,
    "status" text default 'pending'::text,
    "error_message" text,
    "attempts" integer default 0,
    "max_attempts" integer default 3,
    "scheduled_at" timestamp with time zone default now(),
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."background_jobs" enable row level security;


  create table "public"."call_participants" (
    "id" uuid not null default gen_random_uuid(),
    "call_id" uuid not null,
    "user_id" uuid not null,
    "joined_at" timestamp with time zone default now(),
    "left_at" timestamp with time zone,
    "is_audio_enabled" boolean default true,
    "is_video_enabled" boolean default true
      );


alter table "public"."call_participants" enable row level security;


  create table "public"."collaborations" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "description" text not null,
    "poster_id" uuid not null,
    "craft" text not null,
    "location" text,
    "posted_date" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."collaborations" enable row level security;


  create table "public"."content_moderation" (
    "id" uuid not null default gen_random_uuid(),
    "content_id" uuid not null,
    "content_type" text not null,
    "content_text" text,
    "moderation_status" text default 'pending'::text,
    "ai_confidence" numeric(3,2),
    "ai_flags" jsonb default '[]'::jsonb,
    "human_reviewed" boolean default false,
    "human_reviewer_id" uuid,
    "moderation_reason" text,
    "moderated_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."content_moderation" enable row level security;


  create table "public"."direct_messages" (
    "id" uuid not null default gen_random_uuid(),
    "sender_id" uuid not null,
    "recipient_id" uuid not null,
    "content" text not null,
    "is_read" boolean default false,
    "created_at" timestamp with time zone not null default now(),
    "channel_id" text not null
      );


alter table "public"."direct_messages" enable row level security;


  create table "public"."movie_ratings" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "movie_title" text not null,
    "rating" integer not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."movie_ratings" enable row level security;


  create table "public"."notifications" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "type" text not null,
    "title" text not null,
    "message" text not null,
    "action_url" text,
    "related_id" uuid,
    "related_type" text,
    "priority" text default 'normal'::text,
    "is_read" boolean default false,
    "is_actionable" boolean default false,
    "metadata" jsonb default '{}'::jsonb,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."notifications" enable row level security;


  create table "public"."portfolio_items" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "title" text not null,
    "description" text,
    "media_url" text,
    "media_type" text,
    "project_type" text,
    "role" text,
    "completion_date" date,
    "tags" text[],
    "is_featured" boolean default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."portfolio_items" enable row level security;


  create table "public"."post_comments" (
    "id" uuid not null default gen_random_uuid(),
    "post_id" uuid not null,
    "user_id" uuid not null,
    "content" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."post_comments" enable row level security;


  create table "public"."post_likes" (
    "id" uuid not null default gen_random_uuid(),
    "post_id" uuid not null,
    "user_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."post_likes" enable row level security;


  create table "public"."posts" (
    "id" uuid not null default gen_random_uuid(),
    "author_id" uuid not null,
    "content" text not null,
    "media_url" text,
    "media_type" text,
    "has_ai_generated" boolean default false,
    "tags" text[],
    "like_count" integer default 0,
    "comment_count" integer default 0,
    "share_count" integer default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."posts" enable row level security;


  create table "public"."project_comments" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "user_id" uuid not null,
    "content" text not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."project_comments" enable row level security;


  create table "public"."project_tasks" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "assigned_to" uuid,
    "title" text not null,
    "description" text,
    "status" text not null default 'todo'::text,
    "priority" text default 'medium'::text,
    "due_date" date,
    "position" integer default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."project_tasks" enable row level security;


  create table "public"."projects" (
    "id" uuid not null default gen_random_uuid(),
    "creator_id" uuid not null,
    "title" text not null,
    "description" text,
    "status" text default 'planning'::text,
    "budget_min" integer,
    "budget_max" integer,
    "start_date" date,
    "end_date" date,
    "location" text,
    "genre" text[],
    "required_roles" text[],
    "current_team" jsonb default '[]'::jsonb,
    "is_public" boolean default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."projects" enable row level security;


  create table "public"."rate_limits" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid,
    "action_type" text not null,
    "action_count" integer default 1,
    "window_start" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."rate_limits" enable row level security;


  create table "public"."room_calls" (
    "id" uuid not null default gen_random_uuid(),
    "room_id" uuid not null,
    "started_by" uuid not null,
    "call_type" text not null,
    "is_active" boolean default true,
    "participant_count" integer default 1,
    "started_at" timestamp with time zone default now(),
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."room_calls" enable row level security;


  create table "public"."saved_searches" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "search_name" text not null,
    "search_query" text not null,
    "search_filters" jsonb default '{}'::jsonb,
    "search_type" text not null default 'global'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."saved_searches" enable row level security;


  create table "public"."user_activities" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "activity_type" text not null,
    "activity_data" jsonb default '{}'::jsonb,
    "related_id" uuid,
    "related_type" text,
    "is_read" boolean default false,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."user_activities" enable row level security;


  create table "public"."user_analytics" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "session_id" uuid default gen_random_uuid(),
    "event_type" text not null,
    "event_data" jsonb default '{}'::jsonb,
    "page_url" text,
    "duration_seconds" integer,
    "device_info" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."user_analytics" enable row level security;


  create table "public"."user_connections" (
    "id" uuid not null default gen_random_uuid(),
    "follower_id" uuid not null,
    "following_id" uuid not null,
    "status" text default 'pending'::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."user_connections" enable row level security;


  create table "public"."user_engagement_scores" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "date" date not null,
    "posts_created" integer default 0,
    "comments_made" integer default 0,
    "likes_given" integer default 0,
    "likes_received" integer default 0,
    "profile_views" integer default 0,
    "session_duration_minutes" integer default 0,
    "engagement_score" numeric(5,2) default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."user_engagement_scores" enable row level security;


  create table "public"."user_roles" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "role" public.app_role not null default 'user'::public.app_role,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."user_roles" enable row level security;

drop type "public"."room_type__old_version_to_be_dropped";

alter table "public"."comments" drop column "parent_comment_id";

alter table "public"."comments" alter column "id" set default gen_random_uuid();

alter table "public"."comments" alter column "post_id" drop not null;

alter table "public"."comments" alter column "user_id" drop not null;

alter table "public"."comments" enable row level security;

alter table "public"."conversations" drop column "updated_at";

alter table "public"."conversations" drop column "user1_id";

alter table "public"."conversations" drop column "user2_id";

alter table "public"."conversations" add column "participant_a" uuid;

alter table "public"."conversations" add column "participant_b" uuid;

alter table "public"."conversations" alter column "id" set default gen_random_uuid();

alter table "public"."discussion_rooms" drop column "name";

alter table "public"."discussion_rooms" add column "is_active" boolean default true;

alter table "public"."discussion_rooms" add column "member_count" integer default 1;

alter table "public"."discussion_rooms" add column "project_id" uuid;

alter table "public"."discussion_rooms" add column "room_purpose" text default 'general'::text;

alter table "public"."discussion_rooms" add column "title" text not null;

alter table "public"."discussion_rooms" add column "updated_at" timestamp with time zone not null default now();

alter table "public"."discussion_rooms" alter column "creator_id" set not null;

alter table "public"."discussion_rooms" alter column "description" set not null;

alter table "public"."discussion_rooms" alter column "id" set default gen_random_uuid();

alter table "public"."discussion_rooms" alter column "room_type" set default 'public'::text;

alter table "public"."discussion_rooms" alter column "room_type" set data type text using "room_type"::text;

alter table "public"."discussion_rooms" alter column "tags" set default '{}'::text[];

alter table "public"."likes" alter column "id" set default gen_random_uuid();

alter table "public"."likes" alter column "post_id" drop not null;

alter table "public"."likes" alter column "user_id" drop not null;

alter table "public"."likes" enable row level security;

alter table "public"."messages" alter column "conversation_id" drop not null;

alter table "public"."messages" alter column "id" set default gen_random_uuid();

alter table "public"."messages" alter column "sender_id" drop not null;

alter table "public"."profiles" drop column "about_me";

alter table "public"."profiles" drop column "experience";

alter table "public"."profiles" drop column "instagram_url";

alter table "public"."profiles" drop column "youtube_url";

alter table "public"."profiles" add column "bio" text;

alter table "public"."profiles" add column "craft" text;

alter table "public"."profiles" add column "created_at" timestamp with time zone default now();

alter table "public"."profiles" add column "full_name" text;

alter table "public"."profiles" add column "location" text;

alter table "public"."profiles" add column "skills" text[];

alter table "public"."profiles" alter column "updated_at" set default now();

alter table "public"."room_categories" add column "created_at" timestamp with time zone not null default now();

alter table "public"."room_categories" add column "icon" text;

alter table "public"."room_categories" alter column "id" set default gen_random_uuid();

alter table "public"."room_categories" enable row level security;

alter table "public"."room_join_requests" enable row level security;

alter table "public"."room_members" drop column "created_at";

alter table "public"."room_members" add column "id" uuid not null default gen_random_uuid();

alter table "public"."room_members" add column "joined_at" timestamp with time zone not null default now();

alter table "public"."room_members" add column "role" text default 'member'::text;

alter table "public"."room_messages" drop column "is_read";

alter table "public"."room_messages" add column "media_type" text;

alter table "public"."room_messages" add column "media_url" text;

alter table "public"."room_messages" add column "message_type" text default 'text'::text;

alter table "public"."room_messages" add column "priority" text default 'normal'::text;

alter table "public"."room_messages" add column "visibility_role" text default 'all'::text;

alter table "public"."room_messages" alter column "id" set default gen_random_uuid();

alter table "public"."shares" alter column "id" set default gen_random_uuid();

alter table "public"."shares" alter column "post_id" drop not null;

alter table "public"."shares" alter column "user_id" drop not null;

alter table "public"."shares" enable row level security;

alter sequence "public"."room_join_requests_id_seq" owned by none;

CREATE UNIQUE INDEX ai_recommendations_pkey ON public.ai_recommendations USING btree (id);

CREATE UNIQUE INDEX announcements_pkey ON public.announcements USING btree (id);

CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);

CREATE UNIQUE INDEX background_jobs_pkey ON public.background_jobs USING btree (id);

CREATE UNIQUE INDEX call_participants_call_id_user_id_key ON public.call_participants USING btree (call_id, user_id);

CREATE UNIQUE INDEX call_participants_pkey ON public.call_participants USING btree (id);

CREATE UNIQUE INDEX collaborations_pkey ON public.collaborations USING btree (id);

CREATE UNIQUE INDEX content_moderation_pkey ON public.content_moderation USING btree (id);

CREATE UNIQUE INDEX direct_messages_pkey ON public.direct_messages USING btree (id);

CREATE INDEX idx_ai_recommendations_created_at ON public.ai_recommendations USING btree (created_at);

CREATE INDEX idx_ai_recommendations_score ON public.ai_recommendations USING btree (score);

CREATE INDEX idx_ai_recommendations_type ON public.ai_recommendations USING btree (recommendation_type);

CREATE INDEX idx_ai_recommendations_user_id ON public.ai_recommendations USING btree (user_id);

CREATE INDEX idx_ai_recommendations_user_shown ON public.ai_recommendations USING btree (user_id, is_shown, score DESC);

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action, created_at DESC);

CREATE INDEX idx_audit_logs_user_created ON public.audit_logs USING btree (user_id, created_at DESC);

CREATE INDEX idx_background_jobs_status ON public.background_jobs USING btree (status, scheduled_at);

CREATE INDEX idx_content_moderation_content_id ON public.content_moderation USING btree (content_id);

CREATE INDEX idx_content_moderation_created_at ON public.content_moderation USING btree (created_at);

CREATE INDEX idx_content_moderation_status ON public.content_moderation USING btree (moderation_status);

CREATE INDEX idx_direct_messages_channel_id ON public.direct_messages USING btree (channel_id);

CREATE INDEX idx_direct_messages_created_at ON public.direct_messages USING btree (created_at DESC);

CREATE INDEX idx_direct_messages_recipient_id ON public.direct_messages USING btree (recipient_id);

CREATE INDEX idx_direct_messages_sender_id ON public.direct_messages USING btree (sender_id);

CREATE INDEX idx_direct_messages_users ON public.direct_messages USING btree (sender_id, recipient_id, created_at DESC);

CREATE INDEX idx_discussion_rooms_project_id ON public.discussion_rooms USING btree (project_id);

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);

CREATE INDEX idx_notifications_priority ON public.notifications USING btree (priority);

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);

CREATE INDEX idx_notifications_user_read ON public.notifications USING btree (user_id, is_read, created_at DESC);

CREATE INDEX idx_portfolio_items_user_featured ON public.portfolio_items USING btree (user_id, is_featured);

CREATE INDEX idx_post_comments_post_created ON public.post_comments USING btree (post_id, created_at DESC);

CREATE INDEX idx_post_likes_post_user ON public.post_likes USING btree (post_id, user_id);

CREATE INDEX idx_posts_author_created ON public.posts USING btree (author_id, created_at DESC);

CREATE INDEX idx_posts_tags ON public.posts USING gin (tags);

CREATE INDEX idx_projects_creator_status ON public.projects USING btree (creator_id, status);

CREATE INDEX idx_rate_limits_user_action ON public.rate_limits USING btree (user_id, action_type, window_start);

CREATE INDEX idx_room_messages_priority ON public.room_messages USING btree (priority, created_at DESC);

CREATE INDEX idx_room_messages_room_created ON public.room_messages USING btree (room_id, created_at DESC);

CREATE INDEX idx_user_analytics_created_at ON public.user_analytics USING btree (created_at);

CREATE INDEX idx_user_analytics_event_type ON public.user_analytics USING btree (event_type);

CREATE INDEX idx_user_analytics_user_id ON public.user_analytics USING btree (user_id);

CREATE INDEX idx_user_connections_follower ON public.user_connections USING btree (follower_id, status);

CREATE INDEX idx_user_connections_following ON public.user_connections USING btree (following_id, status);

CREATE INDEX idx_user_engagement_scores_date ON public.user_engagement_scores USING btree (date);

CREATE INDEX idx_user_engagement_scores_score ON public.user_engagement_scores USING btree (engagement_score);

CREATE INDEX idx_user_engagement_scores_user_id ON public.user_engagement_scores USING btree (user_id);

CREATE UNIQUE INDEX message_reactions_message_id_user_id_emoji_key ON public.message_reactions USING btree (message_id, user_id, emoji);

CREATE UNIQUE INDEX movie_ratings_pkey ON public.movie_ratings USING btree (id);

CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);

CREATE UNIQUE INDEX portfolio_items_pkey ON public.portfolio_items USING btree (id);

CREATE UNIQUE INDEX post_comments_pkey ON public.post_comments USING btree (id);

CREATE UNIQUE INDEX post_likes_pkey ON public.post_likes USING btree (id);

CREATE UNIQUE INDEX post_likes_post_id_user_id_key ON public.post_likes USING btree (post_id, user_id);

CREATE UNIQUE INDEX posts_pkey ON public.posts USING btree (id);

CREATE UNIQUE INDEX project_comments_pkey ON public.project_comments USING btree (id);

CREATE UNIQUE INDEX project_tasks_pkey ON public.project_tasks USING btree (id);

CREATE UNIQUE INDEX projects_pkey ON public.projects USING btree (id);

CREATE UNIQUE INDEX rate_limits_pkey ON public.rate_limits USING btree (id);

CREATE UNIQUE INDEX room_calls_pkey ON public.room_calls USING btree (id);

CREATE UNIQUE INDEX room_members_room_id_user_id_key ON public.room_members USING btree (room_id, user_id);

CREATE UNIQUE INDEX saved_searches_pkey ON public.saved_searches USING btree (id);

CREATE UNIQUE INDEX unique_conversation ON public.conversations USING btree (participant_a, participant_b);

CREATE UNIQUE INDEX unique_project_room ON public.discussion_rooms USING btree (project_id);

CREATE UNIQUE INDEX unique_user_movie_rating ON public.movie_ratings USING btree (user_id, movie_title);

CREATE UNIQUE INDEX user_activities_pkey ON public.user_activities USING btree (id);

CREATE UNIQUE INDEX user_analytics_pkey ON public.user_analytics USING btree (id);

CREATE UNIQUE INDEX user_connections_follower_id_following_id_key ON public.user_connections USING btree (follower_id, following_id);

CREATE UNIQUE INDEX user_connections_pkey ON public.user_connections USING btree (id);

CREATE UNIQUE INDEX user_engagement_scores_pkey ON public.user_engagement_scores USING btree (id);

CREATE UNIQUE INDEX user_engagement_scores_user_id_date_key ON public.user_engagement_scores USING btree (user_id, date);

CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (id);

CREATE UNIQUE INDEX user_roles_user_id_role_key ON public.user_roles USING btree (user_id, role);

CREATE UNIQUE INDEX room_members_pkey ON public.room_members USING btree (id);

alter table "public"."ai_recommendations" add constraint "ai_recommendations_pkey" PRIMARY KEY using index "ai_recommendations_pkey";

alter table "public"."announcements" add constraint "announcements_pkey" PRIMARY KEY using index "announcements_pkey";

alter table "public"."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY using index "audit_logs_pkey";

alter table "public"."background_jobs" add constraint "background_jobs_pkey" PRIMARY KEY using index "background_jobs_pkey";

alter table "public"."call_participants" add constraint "call_participants_pkey" PRIMARY KEY using index "call_participants_pkey";

alter table "public"."collaborations" add constraint "collaborations_pkey" PRIMARY KEY using index "collaborations_pkey";

alter table "public"."content_moderation" add constraint "content_moderation_pkey" PRIMARY KEY using index "content_moderation_pkey";

alter table "public"."direct_messages" add constraint "direct_messages_pkey" PRIMARY KEY using index "direct_messages_pkey";

alter table "public"."movie_ratings" add constraint "movie_ratings_pkey" PRIMARY KEY using index "movie_ratings_pkey";

alter table "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY using index "notifications_pkey";

alter table "public"."portfolio_items" add constraint "portfolio_items_pkey" PRIMARY KEY using index "portfolio_items_pkey";

alter table "public"."post_comments" add constraint "post_comments_pkey" PRIMARY KEY using index "post_comments_pkey";

alter table "public"."post_likes" add constraint "post_likes_pkey" PRIMARY KEY using index "post_likes_pkey";

alter table "public"."posts" add constraint "posts_pkey" PRIMARY KEY using index "posts_pkey";

alter table "public"."project_comments" add constraint "project_comments_pkey" PRIMARY KEY using index "project_comments_pkey";

alter table "public"."project_tasks" add constraint "project_tasks_pkey" PRIMARY KEY using index "project_tasks_pkey";

alter table "public"."projects" add constraint "projects_pkey" PRIMARY KEY using index "projects_pkey";

alter table "public"."rate_limits" add constraint "rate_limits_pkey" PRIMARY KEY using index "rate_limits_pkey";

alter table "public"."room_calls" add constraint "room_calls_pkey" PRIMARY KEY using index "room_calls_pkey";

alter table "public"."saved_searches" add constraint "saved_searches_pkey" PRIMARY KEY using index "saved_searches_pkey";

alter table "public"."user_activities" add constraint "user_activities_pkey" PRIMARY KEY using index "user_activities_pkey";

alter table "public"."user_analytics" add constraint "user_analytics_pkey" PRIMARY KEY using index "user_analytics_pkey";

alter table "public"."user_connections" add constraint "user_connections_pkey" PRIMARY KEY using index "user_connections_pkey";

alter table "public"."user_engagement_scores" add constraint "user_engagement_scores_pkey" PRIMARY KEY using index "user_engagement_scores_pkey";

alter table "public"."user_roles" add constraint "user_roles_pkey" PRIMARY KEY using index "user_roles_pkey";

alter table "public"."room_members" add constraint "room_members_pkey" PRIMARY KEY using index "room_members_pkey";

alter table "public"."announcements" add constraint "announcements_author_id_fkey" FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."announcements" validate constraint "announcements_author_id_fkey";

alter table "public"."audit_logs" add constraint "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_user_id_fkey";

alter table "public"."background_jobs" add constraint "background_jobs_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text]))) not valid;

alter table "public"."background_jobs" validate constraint "background_jobs_status_check";

alter table "public"."call_participants" add constraint "call_participants_call_id_fkey" FOREIGN KEY (call_id) REFERENCES public.room_calls(id) ON DELETE CASCADE not valid;

alter table "public"."call_participants" validate constraint "call_participants_call_id_fkey";

alter table "public"."call_participants" add constraint "call_participants_call_id_user_id_key" UNIQUE using index "call_participants_call_id_user_id_key";

alter table "public"."call_participants" add constraint "call_participants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."call_participants" validate constraint "call_participants_user_id_fkey";

alter table "public"."collaborations" add constraint "collaborations_poster_id_fkey" FOREIGN KEY (poster_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."collaborations" validate constraint "collaborations_poster_id_fkey";

alter table "public"."comments" add constraint "comments_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_post_id_fkey";

alter table "public"."conversations" add constraint "conversations_participant_a_fkey" FOREIGN KEY (participant_a) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."conversations" validate constraint "conversations_participant_a_fkey";

alter table "public"."conversations" add constraint "conversations_participant_b_fkey" FOREIGN KEY (participant_b) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."conversations" validate constraint "conversations_participant_b_fkey";

alter table "public"."conversations" add constraint "unique_conversation" UNIQUE using index "unique_conversation";

alter table "public"."direct_messages" add constraint "direct_messages_recipient_id_fkey" FOREIGN KEY (recipient_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."direct_messages" validate constraint "direct_messages_recipient_id_fkey";

alter table "public"."direct_messages" add constraint "direct_messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."direct_messages" validate constraint "direct_messages_sender_id_fkey";

alter table "public"."discussion_rooms" add constraint "description_length_check" CHECK ((length(description) <= 2000)) not valid;

alter table "public"."discussion_rooms" validate constraint "description_length_check";

alter table "public"."discussion_rooms" add constraint "discussion_rooms_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."discussion_rooms" validate constraint "discussion_rooms_project_id_fkey";

alter table "public"."discussion_rooms" add constraint "discussion_rooms_room_type_check" CHECK ((room_type = ANY (ARRAY['public'::text, 'private'::text]))) not valid;

alter table "public"."discussion_rooms" validate constraint "discussion_rooms_room_type_check";

alter table "public"."discussion_rooms" add constraint "fk_discussion_rooms_category_id" FOREIGN KEY (category_id) REFERENCES public.room_categories(id) ON DELETE SET NULL not valid;

alter table "public"."discussion_rooms" validate constraint "fk_discussion_rooms_category_id";

alter table "public"."discussion_rooms" add constraint "room_tags_array_length_check" CHECK (((array_length(tags, 1) IS NULL) OR (array_length(tags, 1) <= 10))) not valid;

alter table "public"."discussion_rooms" validate constraint "room_tags_array_length_check";

alter table "public"."discussion_rooms" add constraint "title_length_check" CHECK ((length(title) <= 200)) not valid;

alter table "public"."discussion_rooms" validate constraint "title_length_check";

alter table "public"."discussion_rooms" add constraint "unique_project_room" UNIQUE using index "unique_project_room";

alter table "public"."likes" add constraint "likes_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE not valid;

alter table "public"."likes" validate constraint "likes_post_id_fkey";

alter table "public"."message_reactions" add constraint "message_reactions_message_id_user_id_emoji_key" UNIQUE using index "message_reactions_message_id_user_id_emoji_key";

alter table "public"."movie_ratings" add constraint "movie_ratings_rating_check" CHECK (((rating >= 1) AND (rating <= 5))) not valid;

alter table "public"."movie_ratings" validate constraint "movie_ratings_rating_check";

alter table "public"."movie_ratings" add constraint "unique_user_movie_rating" UNIQUE using index "unique_user_movie_rating";

alter table "public"."portfolio_items" add constraint "portfolio_items_media_type_check" CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text, 'audio'::text, 'document'::text]))) not valid;

alter table "public"."portfolio_items" validate constraint "portfolio_items_media_type_check";

alter table "public"."post_comments" add constraint "post_comments_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE not valid;

alter table "public"."post_comments" validate constraint "post_comments_post_id_fkey";

alter table "public"."post_comments" add constraint "post_comments_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."post_comments" validate constraint "post_comments_user_id_fkey";

alter table "public"."post_likes" add constraint "post_likes_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE not valid;

alter table "public"."post_likes" validate constraint "post_likes_post_id_fkey";

alter table "public"."post_likes" add constraint "post_likes_post_id_user_id_key" UNIQUE using index "post_likes_post_id_user_id_key";

alter table "public"."posts" add constraint "content_length_check" CHECK ((length(content) <= 5000)) not valid;

alter table "public"."posts" validate constraint "content_length_check";

alter table "public"."posts" add constraint "posts_author_id_fkey" FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."posts" validate constraint "posts_author_id_fkey";

alter table "public"."posts" add constraint "posts_media_type_check" CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text]))) not valid;

alter table "public"."posts" validate constraint "posts_media_type_check";

alter table "public"."posts" add constraint "tags_array_length_check" CHECK (((array_length(tags, 1) IS NULL) OR (array_length(tags, 1) <= 10))) not valid;

alter table "public"."posts" validate constraint "tags_array_length_check";

alter table "public"."projects" add constraint "projects_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."projects" validate constraint "projects_creator_id_fkey";

alter table "public"."projects" add constraint "projects_status_check" CHECK ((status = ANY (ARRAY['planning'::text, 'development'::text, 'production'::text, 'post_production'::text, 'completed'::text, 'cancelled'::text]))) not valid;

alter table "public"."projects" validate constraint "projects_status_check";

alter table "public"."rate_limits" add constraint "rate_limits_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."rate_limits" validate constraint "rate_limits_user_id_fkey";

alter table "public"."room_calls" add constraint "room_calls_call_type_check" CHECK ((call_type = ANY (ARRAY['audio'::text, 'video'::text]))) not valid;

alter table "public"."room_calls" validate constraint "room_calls_call_type_check";

alter table "public"."room_calls" add constraint "room_calls_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.discussion_rooms(id) ON DELETE CASCADE not valid;

alter table "public"."room_calls" validate constraint "room_calls_room_id_fkey";

alter table "public"."room_calls" add constraint "room_calls_started_by_fkey" FOREIGN KEY (started_by) REFERENCES auth.users(id) not valid;

alter table "public"."room_calls" validate constraint "room_calls_started_by_fkey";

alter table "public"."room_members" add constraint "room_members_role_check" CHECK ((role = ANY (ARRAY['creator'::text, 'admin'::text, 'moderator'::text, 'member'::text]))) not valid;

alter table "public"."room_members" validate constraint "room_members_role_check";

alter table "public"."room_members" add constraint "room_members_room_id_user_id_key" UNIQUE using index "room_members_room_id_user_id_key";

alter table "public"."room_messages" add constraint "message_content_length" CHECK (((length(content) > 0) AND (length(content) <= 2000))) not valid;

alter table "public"."room_messages" validate constraint "message_content_length";

alter table "public"."room_messages" add constraint "room_messages_media_type_check" CHECK (((media_type IS NULL) OR (media_type = ANY (ARRAY['image'::text, 'video'::text, 'file'::text, 'audio'::text])))) not valid;

alter table "public"."room_messages" validate constraint "room_messages_media_type_check";

alter table "public"."room_messages" add constraint "room_messages_message_type_check" CHECK ((message_type = ANY (ARRAY['text'::text, 'file'::text, 'image'::text, 'system'::text]))) not valid;

alter table "public"."room_messages" validate constraint "room_messages_message_type_check";

alter table "public"."room_messages" add constraint "room_messages_priority_check" CHECK ((priority = ANY (ARRAY['normal'::text, 'high'::text, 'critical'::text]))) not valid;

alter table "public"."room_messages" validate constraint "room_messages_priority_check";

alter table "public"."room_messages" add constraint "room_messages_visibility_role_check" CHECK ((visibility_role = ANY (ARRAY['all'::text, 'admin'::text, 'moderator'::text, 'creator'::text]))) not valid;

alter table "public"."room_messages" validate constraint "room_messages_visibility_role_check";

alter table "public"."shares" add constraint "shares_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE not valid;

alter table "public"."shares" validate constraint "shares_post_id_fkey";

alter table "public"."user_connections" add constraint "user_connections_follower_id_following_id_key" UNIQUE using index "user_connections_follower_id_following_id_key";

alter table "public"."user_connections" add constraint "user_connections_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'blocked'::text]))) not valid;

alter table "public"."user_connections" validate constraint "user_connections_status_check";

alter table "public"."user_engagement_scores" add constraint "user_engagement_scores_user_id_date_key" UNIQUE using index "user_engagement_scores_user_id_date_key";

alter table "public"."user_roles" add constraint "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_roles" validate constraint "user_roles_user_id_fkey";

alter table "public"."user_roles" add constraint "user_roles_user_id_role_key" UNIQUE using index "user_roles_user_id_role_key";

alter table "public"."discussion_rooms" add constraint "discussion_rooms_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES public.profiles(id) not valid;

alter table "public"."discussion_rooms" validate constraint "discussion_rooms_creator_id_fkey";

alter table "public"."room_messages" add constraint "room_messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."room_messages" validate constraint "room_messages_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.assign_default_discussion_category()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  general_category_id UUID;
BEGIN
  -- Check if a category is already assigned
  IF NEW.category_id IS NULL THEN
    -- Find the ID of the 'General Discussion' category
    SELECT id INTO general_category_id
    FROM public.room_categories
    WHERE name = 'General Discussion'
    LIMIT 1;

    -- If the category is found, assign it to the new room
    IF general_category_id IS NOT NULL THEN
      NEW.category_id := general_category_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.audit_log_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, new_data)
    VALUES (auth.uid(), 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_data)
    VALUES (auth.uid(), 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_daily_engagement_score(target_date date DEFAULT CURRENT_DATE)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_engagement_scores (
    user_id,
    date,
    posts_created,
    comments_made,
    likes_given,
    likes_received,
    engagement_score
  )
  SELECT 
    u.user_id,
    target_date,
    COALESCE(posts.count, 0) as posts_created,
    COALESCE(comments.count, 0) as comments_made,
    COALESCE(likes_given.count, 0) as likes_given,
    COALESCE(likes_received.count, 0) as likes_received,
    (
      COALESCE(posts.count, 0) * 10 +
      COALESCE(comments.count, 0) * 5 +
      COALESCE(likes_given.count, 0) * 2 +
      COALESCE(likes_received.count, 0) * 3
    )::DECIMAL(5,2) as engagement_score
  FROM (
    SELECT DISTINCT author_id as user_id FROM posts
    UNION
    SELECT DISTINCT user_id FROM post_comments
    UNION
    SELECT DISTINCT user_id FROM post_likes
  ) u
  LEFT JOIN (
    SELECT author_id as user_id, COUNT(*) as count
    FROM posts
    WHERE DATE(created_at) = target_date
    GROUP BY author_id
  ) posts ON u.user_id = posts.user_id
  LEFT JOIN (
    SELECT user_id, COUNT(*) as count
    FROM post_comments
    WHERE DATE(created_at) = target_date
    GROUP BY user_id
  ) comments ON u.user_id = comments.user_id
  LEFT JOIN (
    SELECT user_id, COUNT(*) as count
    FROM post_likes
    WHERE DATE(created_at) = target_date
    GROUP BY user_id
  ) likes_given ON u.user_id = likes_given.user_id
  LEFT JOIN (
    SELECT p.author_id as user_id, COUNT(*) as count
    FROM post_likes pl
    JOIN posts p ON pl.post_id = p.id
    WHERE DATE(pl.created_at) = target_date
    GROUP BY p.author_id
  ) likes_received ON u.user_id = likes_received.user_id
  ON CONFLICT (user_id, date) 
  DO UPDATE SET
    posts_created = EXCLUDED.posts_created,
    comments_made = EXCLUDED.comments_made,
    likes_given = EXCLUDED.likes_given,
    likes_received = EXCLUDED.likes_received,
    engagement_score = EXCLUDED.engagement_score,
    updated_at = now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_rate_limit(_user_id uuid, _action_type text, _max_requests integer, _window_minutes integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  request_count INTEGER;
BEGIN
  -- Clean up old entries
  DELETE FROM public.rate_limits
  WHERE window_start < now() - (_window_minutes || ' minutes')::INTERVAL;
  
  -- Count requests in current window
  SELECT COUNT(*) INTO request_count
  FROM public.rate_limits
  WHERE user_id = _user_id
    AND action_type = _action_type
    AND window_start > now() - (_window_minutes || ' minutes')::INTERVAL;
  
  -- If under limit, log this request
  IF request_count < _max_requests THEN
    INSERT INTO public.rate_limits (user_id, action_type)
    VALUES (_user_id, _action_type);
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_discussion_room_with_creator(room_title text, room_description text, type public.room_type, cat_id uuid, room_tags text[], c_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  new_room_id uuid;
BEGIN
  -- Insert into discussion_rooms
  INSERT INTO public.discussion_rooms (title, description, room_type, category_id, tags, creator_id, is_active, last_activity_at)
  VALUES (room_title, room_description, type, cat_id, room_tags, c_id, true, now())
  RETURNING id INTO new_room_id;

  -- Insert the creator as a member
  IF new_room_id IS NOT NULL THEN
    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES (new_room_id, c_id, 'creator');
  END IF;

  RETURN new_room_id; -- Added return value
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_notification(target_user_id uuid, notification_type text, notification_title text, notification_message text, action_url text DEFAULT NULL::text, related_id uuid DEFAULT NULL::uuid, related_type text DEFAULT NULL::text, priority text DEFAULT 'normal'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    action_url,
    related_id,
    related_type,
    priority
  ) VALUES (
    target_user_id,
    notification_type,
    notification_title,
    notification_message,
    action_url,
    related_id,
    related_type,
    priority
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_project_discussion_room()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_room_id UUID;
BEGIN
  -- Create the discussion room
  INSERT INTO public.discussion_rooms (
    title,
    description,
    creator_id,
    project_id,
    room_purpose,
    room_type
  ) VALUES (
    NEW.title || ' - Discussion Room',
    'Collaboration space for ' || NEW.title,
    NEW.creator_id,
    NEW.id,
    'project',
    'private'
  ) RETURNING id INTO new_room_id;

  -- Add creator as admin member
  INSERT INTO public.room_members (
    room_id,
    user_id,
    role
  ) VALUES (
    new_room_id,
    NEW.creator_id,
    'creator'
  );

  -- Create a welcome message
  INSERT INTO public.room_messages (
    room_id,
    user_id,
    content,
    message_type,
    priority
  ) VALUES (
    new_room_id,
    NEW.creator_id,
    'Welcome to the discussion room for ' || NEW.title || '! Use this space to collaborate with your team.',
    'system',
    'normal'
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_messages_for_channel(p_channel_id text)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, sender_id uuid, sender_profile json)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        dm.id,
        dm.content,
        dm.created_at,
        dm.sender_id,
        json_build_object(
            'full_name', p.full_name,
            'avatar_url', p.avatar_url
        ) AS sender_profile
    FROM
        public.direct_messages AS dm
    LEFT JOIN
        public.profiles AS p ON dm.sender_id = p.id
    WHERE
        dm.channel_id = p_channel_id
    ORDER BY
        dm.created_at ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_user_id_1 uuid, p_user_id_2 uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_conversation_id UUID;
BEGIN
    -- Try to find an existing conversation
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE (participant_a = p_user_id_1 AND participant_b = p_user_id_2)
       OR (participant_a = p_user_id_2 AND participant_b = p_user_id_1)
    LIMIT 1;

    -- If not found, create a new one
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (participant_a, participant_b)
        VALUES (p_user_id_1, p_user_id_2)
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_conversations_with_profiles(p_user_id uuid)
 RETURNS TABLE(other_user_id uuid, other_user_full_name text, other_user_avatar_url text, last_message_content text, last_message_created_at timestamp with time zone, unread_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH ranked_messages AS (
        SELECT
            dm.id,
            dm.channel_id,
            dm.content,
            dm.created_at,
            dm.sender_id,
            dm.recipient_id,
            ROW_NUMBER() OVER(PARTITION BY dm.channel_id ORDER BY dm.created_at DESC) as rn
        FROM
            public.direct_messages dm
        WHERE
            dm.channel_id LIKE '%' || p_user_id::text || '%'
    ),
    latest_messages AS (
        SELECT *
        FROM ranked_messages
        WHERE rn = 1
    )
    SELECT
        CASE
            WHEN lm.sender_id = p_user_id THEN lm.recipient_id
            ELSE lm.sender_id
        END AS other_user_id,
        p.full_name AS other_user_full_name, -- Correctly select the 'full_name' column
        p.avatar_url AS other_user_avatar_url,
        lm.content AS last_message_content,
        lm.created_at AS last_message_created_at,
        0::bigint AS unread_count
    FROM
        latest_messages lm
    JOIN
        public.profiles p ON p.id = (CASE
            WHEN lm.sender_id = p_user_id THEN lm.recipient_id
            ELSE lm.sender_id
        END)
    ORDER BY
        lm.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_feed(_user_id uuid, _limit integer DEFAULT 20, _offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, author_id uuid, content text, media_url text, media_type text, tags text[], like_count integer, comment_count integer, created_at timestamp with time zone, author_full_name text, author_avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.id,
    p.author_id,
    p.content,
    p.media_url,
    p.media_type,
    p.tags,
    p.like_count,
    p.comment_count,
    p.created_at,
    prof.full_name,
    prof.avatar_url
  FROM public.posts p
  LEFT JOIN public.profiles prof ON p.author_id = prof.id
  WHERE p.author_id IN (
    SELECT following_id 
    FROM public.user_connections 
    WHERE follower_id = _user_id AND status = 'accepted'
    UNION
    SELECT _user_id
  )
  ORDER BY p.created_at DESC
  LIMIT _limit
  OFFSET _offset;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_comment_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  post_author_id UUID;
  commenter_name TEXT;
BEGIN
  -- Get post author
  SELECT author_id INTO post_author_id
  FROM posts
  WHERE id = NEW.post_id;
  
  -- Don't notify if user comments on their own post
  IF post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get commenter's name (simplified)
  commenter_name := 'Someone';
  
  -- Create notification
  PERFORM public.create_notification(
    post_author_id,
    'comment',
    'New Comment',
    commenter_name || ' commented on your post',
    '/feed',
    NEW.post_id,
    'post',
    'normal'
  );
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_post_like_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  post_author_id UUID;
  liker_name TEXT;
BEGIN
  -- Get post author
  SELECT author_id INTO post_author_id
  FROM posts
  WHERE id = NEW.post_id;
  
  -- Don't notify if user likes their own post
  IF post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get liker's name (simplified - in real app would get from profiles)
  liker_name := 'Someone';
  
  -- Create notification
  PERFORM public.create_notification(
    post_author_id,
    'like',
    'New Like',
    liker_name || ' liked your post',
    '/feed',
    NEW.post_id,
    'post',
    'normal'
  );
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_post_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'post_likes' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE public.posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_room_member_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.discussion_rooms SET member_count = member_count + 1 WHERE id = NEW.room_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.discussion_rooms SET member_count = member_count - 1 WHERE id = OLD.room_id;
    RETURN OLD;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id uuid)
 RETURNS TABLE(other_user_id uuid, other_user_full_name text, other_user_username text, other_user_avatar_url text, last_message_content text, last_message_created_at timestamp with time zone)
 LANGUAGE sql
AS $function$
    with conversations as (
        select
            distinct on (
                case
                    when sender_id = p_user_id then recipient_id
                    else sender_id
                end
            )
            case
                when sender_id = p_user_id then recipient_id
                else sender_id
            end as other_user,
            content,
            created_at
        from direct_messages
        where sender_id = p_user_id or recipient_id = p_user_id
        order by
            other_user,
            created_at desc
    )
    select
        p.id,
        p.full_name,
        p.username,
        p.avatar_url,
        c.content,
        c.created_at
    from conversations c
    join profiles p on c.other_user = p.id;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_room_last_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.discussion_rooms 
  SET last_activity_at = now() 
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."ai_recommendations" to "anon";

grant insert on table "public"."ai_recommendations" to "anon";

grant references on table "public"."ai_recommendations" to "anon";

grant select on table "public"."ai_recommendations" to "anon";

grant trigger on table "public"."ai_recommendations" to "anon";

grant truncate on table "public"."ai_recommendations" to "anon";

grant update on table "public"."ai_recommendations" to "anon";

grant delete on table "public"."ai_recommendations" to "authenticated";

grant insert on table "public"."ai_recommendations" to "authenticated";

grant references on table "public"."ai_recommendations" to "authenticated";

grant select on table "public"."ai_recommendations" to "authenticated";

grant trigger on table "public"."ai_recommendations" to "authenticated";

grant truncate on table "public"."ai_recommendations" to "authenticated";

grant update on table "public"."ai_recommendations" to "authenticated";

grant delete on table "public"."ai_recommendations" to "service_role";

grant insert on table "public"."ai_recommendations" to "service_role";

grant references on table "public"."ai_recommendations" to "service_role";

grant select on table "public"."ai_recommendations" to "service_role";

grant trigger on table "public"."ai_recommendations" to "service_role";

grant truncate on table "public"."ai_recommendations" to "service_role";

grant update on table "public"."ai_recommendations" to "service_role";

grant delete on table "public"."announcements" to "anon";

grant insert on table "public"."announcements" to "anon";

grant references on table "public"."announcements" to "anon";

grant select on table "public"."announcements" to "anon";

grant trigger on table "public"."announcements" to "anon";

grant truncate on table "public"."announcements" to "anon";

grant update on table "public"."announcements" to "anon";

grant delete on table "public"."announcements" to "authenticated";

grant insert on table "public"."announcements" to "authenticated";

grant references on table "public"."announcements" to "authenticated";

grant select on table "public"."announcements" to "authenticated";

grant trigger on table "public"."announcements" to "authenticated";

grant truncate on table "public"."announcements" to "authenticated";

grant update on table "public"."announcements" to "authenticated";

grant delete on table "public"."announcements" to "service_role";

grant insert on table "public"."announcements" to "service_role";

grant references on table "public"."announcements" to "service_role";

grant select on table "public"."announcements" to "service_role";

grant trigger on table "public"."announcements" to "service_role";

grant truncate on table "public"."announcements" to "service_role";

grant update on table "public"."announcements" to "service_role";

grant delete on table "public"."audit_logs" to "anon";

grant insert on table "public"."audit_logs" to "anon";

grant references on table "public"."audit_logs" to "anon";

grant select on table "public"."audit_logs" to "anon";

grant trigger on table "public"."audit_logs" to "anon";

grant truncate on table "public"."audit_logs" to "anon";

grant update on table "public"."audit_logs" to "anon";

grant delete on table "public"."audit_logs" to "authenticated";

grant insert on table "public"."audit_logs" to "authenticated";

grant references on table "public"."audit_logs" to "authenticated";

grant select on table "public"."audit_logs" to "authenticated";

grant trigger on table "public"."audit_logs" to "authenticated";

grant truncate on table "public"."audit_logs" to "authenticated";

grant update on table "public"."audit_logs" to "authenticated";

grant delete on table "public"."audit_logs" to "service_role";

grant insert on table "public"."audit_logs" to "service_role";

grant references on table "public"."audit_logs" to "service_role";

grant select on table "public"."audit_logs" to "service_role";

grant trigger on table "public"."audit_logs" to "service_role";

grant truncate on table "public"."audit_logs" to "service_role";

grant update on table "public"."audit_logs" to "service_role";

grant delete on table "public"."background_jobs" to "anon";

grant insert on table "public"."background_jobs" to "anon";

grant references on table "public"."background_jobs" to "anon";

grant select on table "public"."background_jobs" to "anon";

grant trigger on table "public"."background_jobs" to "anon";

grant truncate on table "public"."background_jobs" to "anon";

grant update on table "public"."background_jobs" to "anon";

grant delete on table "public"."background_jobs" to "authenticated";

grant insert on table "public"."background_jobs" to "authenticated";

grant references on table "public"."background_jobs" to "authenticated";

grant select on table "public"."background_jobs" to "authenticated";

grant trigger on table "public"."background_jobs" to "authenticated";

grant truncate on table "public"."background_jobs" to "authenticated";

grant update on table "public"."background_jobs" to "authenticated";

grant delete on table "public"."background_jobs" to "service_role";

grant insert on table "public"."background_jobs" to "service_role";

grant references on table "public"."background_jobs" to "service_role";

grant select on table "public"."background_jobs" to "service_role";

grant trigger on table "public"."background_jobs" to "service_role";

grant truncate on table "public"."background_jobs" to "service_role";

grant update on table "public"."background_jobs" to "service_role";

grant delete on table "public"."call_participants" to "anon";

grant insert on table "public"."call_participants" to "anon";

grant references on table "public"."call_participants" to "anon";

grant select on table "public"."call_participants" to "anon";

grant trigger on table "public"."call_participants" to "anon";

grant truncate on table "public"."call_participants" to "anon";

grant update on table "public"."call_participants" to "anon";

grant delete on table "public"."call_participants" to "authenticated";

grant insert on table "public"."call_participants" to "authenticated";

grant references on table "public"."call_participants" to "authenticated";

grant select on table "public"."call_participants" to "authenticated";

grant trigger on table "public"."call_participants" to "authenticated";

grant truncate on table "public"."call_participants" to "authenticated";

grant update on table "public"."call_participants" to "authenticated";

grant delete on table "public"."call_participants" to "service_role";

grant insert on table "public"."call_participants" to "service_role";

grant references on table "public"."call_participants" to "service_role";

grant select on table "public"."call_participants" to "service_role";

grant trigger on table "public"."call_participants" to "service_role";

grant truncate on table "public"."call_participants" to "service_role";

grant update on table "public"."call_participants" to "service_role";

grant delete on table "public"."collaborations" to "anon";

grant insert on table "public"."collaborations" to "anon";

grant references on table "public"."collaborations" to "anon";

grant select on table "public"."collaborations" to "anon";

grant trigger on table "public"."collaborations" to "anon";

grant truncate on table "public"."collaborations" to "anon";

grant update on table "public"."collaborations" to "anon";

grant delete on table "public"."collaborations" to "authenticated";

grant insert on table "public"."collaborations" to "authenticated";

grant references on table "public"."collaborations" to "authenticated";

grant select on table "public"."collaborations" to "authenticated";

grant trigger on table "public"."collaborations" to "authenticated";

grant truncate on table "public"."collaborations" to "authenticated";

grant update on table "public"."collaborations" to "authenticated";

grant delete on table "public"."collaborations" to "service_role";

grant insert on table "public"."collaborations" to "service_role";

grant references on table "public"."collaborations" to "service_role";

grant select on table "public"."collaborations" to "service_role";

grant trigger on table "public"."collaborations" to "service_role";

grant truncate on table "public"."collaborations" to "service_role";

grant update on table "public"."collaborations" to "service_role";

grant delete on table "public"."content_moderation" to "anon";

grant insert on table "public"."content_moderation" to "anon";

grant references on table "public"."content_moderation" to "anon";

grant select on table "public"."content_moderation" to "anon";

grant trigger on table "public"."content_moderation" to "anon";

grant truncate on table "public"."content_moderation" to "anon";

grant update on table "public"."content_moderation" to "anon";

grant delete on table "public"."content_moderation" to "authenticated";

grant insert on table "public"."content_moderation" to "authenticated";

grant references on table "public"."content_moderation" to "authenticated";

grant select on table "public"."content_moderation" to "authenticated";

grant trigger on table "public"."content_moderation" to "authenticated";

grant truncate on table "public"."content_moderation" to "authenticated";

grant update on table "public"."content_moderation" to "authenticated";

grant delete on table "public"."content_moderation" to "service_role";

grant insert on table "public"."content_moderation" to "service_role";

grant references on table "public"."content_moderation" to "service_role";

grant select on table "public"."content_moderation" to "service_role";

grant trigger on table "public"."content_moderation" to "service_role";

grant truncate on table "public"."content_moderation" to "service_role";

grant update on table "public"."content_moderation" to "service_role";

grant delete on table "public"."direct_messages" to "anon";

grant insert on table "public"."direct_messages" to "anon";

grant references on table "public"."direct_messages" to "anon";

grant select on table "public"."direct_messages" to "anon";

grant trigger on table "public"."direct_messages" to "anon";

grant truncate on table "public"."direct_messages" to "anon";

grant update on table "public"."direct_messages" to "anon";

grant delete on table "public"."direct_messages" to "authenticated";

grant insert on table "public"."direct_messages" to "authenticated";

grant references on table "public"."direct_messages" to "authenticated";

grant select on table "public"."direct_messages" to "authenticated";

grant trigger on table "public"."direct_messages" to "authenticated";

grant truncate on table "public"."direct_messages" to "authenticated";

grant update on table "public"."direct_messages" to "authenticated";

grant delete on table "public"."direct_messages" to "service_role";

grant insert on table "public"."direct_messages" to "service_role";

grant references on table "public"."direct_messages" to "service_role";

grant select on table "public"."direct_messages" to "service_role";

grant trigger on table "public"."direct_messages" to "service_role";

grant truncate on table "public"."direct_messages" to "service_role";

grant update on table "public"."direct_messages" to "service_role";

grant delete on table "public"."movie_ratings" to "anon";

grant insert on table "public"."movie_ratings" to "anon";

grant references on table "public"."movie_ratings" to "anon";

grant select on table "public"."movie_ratings" to "anon";

grant trigger on table "public"."movie_ratings" to "anon";

grant truncate on table "public"."movie_ratings" to "anon";

grant update on table "public"."movie_ratings" to "anon";

grant delete on table "public"."movie_ratings" to "authenticated";

grant insert on table "public"."movie_ratings" to "authenticated";

grant references on table "public"."movie_ratings" to "authenticated";

grant select on table "public"."movie_ratings" to "authenticated";

grant trigger on table "public"."movie_ratings" to "authenticated";

grant truncate on table "public"."movie_ratings" to "authenticated";

grant update on table "public"."movie_ratings" to "authenticated";

grant delete on table "public"."movie_ratings" to "service_role";

grant insert on table "public"."movie_ratings" to "service_role";

grant references on table "public"."movie_ratings" to "service_role";

grant select on table "public"."movie_ratings" to "service_role";

grant trigger on table "public"."movie_ratings" to "service_role";

grant truncate on table "public"."movie_ratings" to "service_role";

grant update on table "public"."movie_ratings" to "service_role";

grant delete on table "public"."notifications" to "anon";

grant insert on table "public"."notifications" to "anon";

grant references on table "public"."notifications" to "anon";

grant select on table "public"."notifications" to "anon";

grant trigger on table "public"."notifications" to "anon";

grant truncate on table "public"."notifications" to "anon";

grant update on table "public"."notifications" to "anon";

grant delete on table "public"."notifications" to "authenticated";

grant insert on table "public"."notifications" to "authenticated";

grant references on table "public"."notifications" to "authenticated";

grant select on table "public"."notifications" to "authenticated";

grant trigger on table "public"."notifications" to "authenticated";

grant truncate on table "public"."notifications" to "authenticated";

grant update on table "public"."notifications" to "authenticated";

grant delete on table "public"."notifications" to "service_role";

grant insert on table "public"."notifications" to "service_role";

grant references on table "public"."notifications" to "service_role";

grant select on table "public"."notifications" to "service_role";

grant trigger on table "public"."notifications" to "service_role";

grant truncate on table "public"."notifications" to "service_role";

grant update on table "public"."notifications" to "service_role";

grant delete on table "public"."portfolio_items" to "anon";

grant insert on table "public"."portfolio_items" to "anon";

grant references on table "public"."portfolio_items" to "anon";

grant select on table "public"."portfolio_items" to "anon";

grant trigger on table "public"."portfolio_items" to "anon";

grant truncate on table "public"."portfolio_items" to "anon";

grant update on table "public"."portfolio_items" to "anon";

grant delete on table "public"."portfolio_items" to "authenticated";

grant insert on table "public"."portfolio_items" to "authenticated";

grant references on table "public"."portfolio_items" to "authenticated";

grant select on table "public"."portfolio_items" to "authenticated";

grant trigger on table "public"."portfolio_items" to "authenticated";

grant truncate on table "public"."portfolio_items" to "authenticated";

grant update on table "public"."portfolio_items" to "authenticated";

grant delete on table "public"."portfolio_items" to "service_role";

grant insert on table "public"."portfolio_items" to "service_role";

grant references on table "public"."portfolio_items" to "service_role";

grant select on table "public"."portfolio_items" to "service_role";

grant trigger on table "public"."portfolio_items" to "service_role";

grant truncate on table "public"."portfolio_items" to "service_role";

grant update on table "public"."portfolio_items" to "service_role";

grant delete on table "public"."post_comments" to "anon";

grant insert on table "public"."post_comments" to "anon";

grant references on table "public"."post_comments" to "anon";

grant select on table "public"."post_comments" to "anon";

grant trigger on table "public"."post_comments" to "anon";

grant truncate on table "public"."post_comments" to "anon";

grant update on table "public"."post_comments" to "anon";

grant delete on table "public"."post_comments" to "authenticated";

grant insert on table "public"."post_comments" to "authenticated";

grant references on table "public"."post_comments" to "authenticated";

grant select on table "public"."post_comments" to "authenticated";

grant trigger on table "public"."post_comments" to "authenticated";

grant truncate on table "public"."post_comments" to "authenticated";

grant update on table "public"."post_comments" to "authenticated";

grant delete on table "public"."post_comments" to "service_role";

grant insert on table "public"."post_comments" to "service_role";

grant references on table "public"."post_comments" to "service_role";

grant select on table "public"."post_comments" to "service_role";

grant trigger on table "public"."post_comments" to "service_role";

grant truncate on table "public"."post_comments" to "service_role";

grant update on table "public"."post_comments" to "service_role";

grant delete on table "public"."post_likes" to "anon";

grant insert on table "public"."post_likes" to "anon";

grant references on table "public"."post_likes" to "anon";

grant select on table "public"."post_likes" to "anon";

grant trigger on table "public"."post_likes" to "anon";

grant truncate on table "public"."post_likes" to "anon";

grant update on table "public"."post_likes" to "anon";

grant delete on table "public"."post_likes" to "authenticated";

grant insert on table "public"."post_likes" to "authenticated";

grant references on table "public"."post_likes" to "authenticated";

grant select on table "public"."post_likes" to "authenticated";

grant trigger on table "public"."post_likes" to "authenticated";

grant truncate on table "public"."post_likes" to "authenticated";

grant update on table "public"."post_likes" to "authenticated";

grant delete on table "public"."post_likes" to "service_role";

grant insert on table "public"."post_likes" to "service_role";

grant references on table "public"."post_likes" to "service_role";

grant select on table "public"."post_likes" to "service_role";

grant trigger on table "public"."post_likes" to "service_role";

grant truncate on table "public"."post_likes" to "service_role";

grant update on table "public"."post_likes" to "service_role";

grant delete on table "public"."posts" to "anon";

grant insert on table "public"."posts" to "anon";

grant references on table "public"."posts" to "anon";

grant select on table "public"."posts" to "anon";

grant trigger on table "public"."posts" to "anon";

grant truncate on table "public"."posts" to "anon";

grant update on table "public"."posts" to "anon";

grant delete on table "public"."posts" to "authenticated";

grant insert on table "public"."posts" to "authenticated";

grant references on table "public"."posts" to "authenticated";

grant select on table "public"."posts" to "authenticated";

grant trigger on table "public"."posts" to "authenticated";

grant truncate on table "public"."posts" to "authenticated";

grant update on table "public"."posts" to "authenticated";

grant delete on table "public"."posts" to "service_role";

grant insert on table "public"."posts" to "service_role";

grant references on table "public"."posts" to "service_role";

grant select on table "public"."posts" to "service_role";

grant trigger on table "public"."posts" to "service_role";

grant truncate on table "public"."posts" to "service_role";

grant update on table "public"."posts" to "service_role";

grant delete on table "public"."project_comments" to "anon";

grant insert on table "public"."project_comments" to "anon";

grant references on table "public"."project_comments" to "anon";

grant select on table "public"."project_comments" to "anon";

grant trigger on table "public"."project_comments" to "anon";

grant truncate on table "public"."project_comments" to "anon";

grant update on table "public"."project_comments" to "anon";

grant delete on table "public"."project_comments" to "authenticated";

grant insert on table "public"."project_comments" to "authenticated";

grant references on table "public"."project_comments" to "authenticated";

grant select on table "public"."project_comments" to "authenticated";

grant trigger on table "public"."project_comments" to "authenticated";

grant truncate on table "public"."project_comments" to "authenticated";

grant update on table "public"."project_comments" to "authenticated";

grant delete on table "public"."project_comments" to "service_role";

grant insert on table "public"."project_comments" to "service_role";

grant references on table "public"."project_comments" to "service_role";

grant select on table "public"."project_comments" to "service_role";

grant trigger on table "public"."project_comments" to "service_role";

grant truncate on table "public"."project_comments" to "service_role";

grant update on table "public"."project_comments" to "service_role";

grant delete on table "public"."project_tasks" to "anon";

grant insert on table "public"."project_tasks" to "anon";

grant references on table "public"."project_tasks" to "anon";

grant select on table "public"."project_tasks" to "anon";

grant trigger on table "public"."project_tasks" to "anon";

grant truncate on table "public"."project_tasks" to "anon";

grant update on table "public"."project_tasks" to "anon";

grant delete on table "public"."project_tasks" to "authenticated";

grant insert on table "public"."project_tasks" to "authenticated";

grant references on table "public"."project_tasks" to "authenticated";

grant select on table "public"."project_tasks" to "authenticated";

grant trigger on table "public"."project_tasks" to "authenticated";

grant truncate on table "public"."project_tasks" to "authenticated";

grant update on table "public"."project_tasks" to "authenticated";

grant delete on table "public"."project_tasks" to "service_role";

grant insert on table "public"."project_tasks" to "service_role";

grant references on table "public"."project_tasks" to "service_role";

grant select on table "public"."project_tasks" to "service_role";

grant trigger on table "public"."project_tasks" to "service_role";

grant truncate on table "public"."project_tasks" to "service_role";

grant update on table "public"."project_tasks" to "service_role";

grant delete on table "public"."projects" to "anon";

grant insert on table "public"."projects" to "anon";

grant references on table "public"."projects" to "anon";

grant select on table "public"."projects" to "anon";

grant trigger on table "public"."projects" to "anon";

grant truncate on table "public"."projects" to "anon";

grant update on table "public"."projects" to "anon";

grant delete on table "public"."projects" to "authenticated";

grant insert on table "public"."projects" to "authenticated";

grant references on table "public"."projects" to "authenticated";

grant select on table "public"."projects" to "authenticated";

grant trigger on table "public"."projects" to "authenticated";

grant truncate on table "public"."projects" to "authenticated";

grant update on table "public"."projects" to "authenticated";

grant delete on table "public"."projects" to "service_role";

grant insert on table "public"."projects" to "service_role";

grant references on table "public"."projects" to "service_role";

grant select on table "public"."projects" to "service_role";

grant trigger on table "public"."projects" to "service_role";

grant truncate on table "public"."projects" to "service_role";

grant update on table "public"."projects" to "service_role";

grant delete on table "public"."rate_limits" to "anon";

grant insert on table "public"."rate_limits" to "anon";

grant references on table "public"."rate_limits" to "anon";

grant select on table "public"."rate_limits" to "anon";

grant trigger on table "public"."rate_limits" to "anon";

grant truncate on table "public"."rate_limits" to "anon";

grant update on table "public"."rate_limits" to "anon";

grant delete on table "public"."rate_limits" to "authenticated";

grant insert on table "public"."rate_limits" to "authenticated";

grant references on table "public"."rate_limits" to "authenticated";

grant select on table "public"."rate_limits" to "authenticated";

grant trigger on table "public"."rate_limits" to "authenticated";

grant truncate on table "public"."rate_limits" to "authenticated";

grant update on table "public"."rate_limits" to "authenticated";

grant delete on table "public"."rate_limits" to "service_role";

grant insert on table "public"."rate_limits" to "service_role";

grant references on table "public"."rate_limits" to "service_role";

grant select on table "public"."rate_limits" to "service_role";

grant trigger on table "public"."rate_limits" to "service_role";

grant truncate on table "public"."rate_limits" to "service_role";

grant update on table "public"."rate_limits" to "service_role";

grant delete on table "public"."room_calls" to "anon";

grant insert on table "public"."room_calls" to "anon";

grant references on table "public"."room_calls" to "anon";

grant select on table "public"."room_calls" to "anon";

grant trigger on table "public"."room_calls" to "anon";

grant truncate on table "public"."room_calls" to "anon";

grant update on table "public"."room_calls" to "anon";

grant delete on table "public"."room_calls" to "authenticated";

grant insert on table "public"."room_calls" to "authenticated";

grant references on table "public"."room_calls" to "authenticated";

grant select on table "public"."room_calls" to "authenticated";

grant trigger on table "public"."room_calls" to "authenticated";

grant truncate on table "public"."room_calls" to "authenticated";

grant update on table "public"."room_calls" to "authenticated";

grant delete on table "public"."room_calls" to "service_role";

grant insert on table "public"."room_calls" to "service_role";

grant references on table "public"."room_calls" to "service_role";

grant select on table "public"."room_calls" to "service_role";

grant trigger on table "public"."room_calls" to "service_role";

grant truncate on table "public"."room_calls" to "service_role";

grant update on table "public"."room_calls" to "service_role";

grant delete on table "public"."saved_searches" to "anon";

grant insert on table "public"."saved_searches" to "anon";

grant references on table "public"."saved_searches" to "anon";

grant select on table "public"."saved_searches" to "anon";

grant trigger on table "public"."saved_searches" to "anon";

grant truncate on table "public"."saved_searches" to "anon";

grant update on table "public"."saved_searches" to "anon";

grant delete on table "public"."saved_searches" to "authenticated";

grant insert on table "public"."saved_searches" to "authenticated";

grant references on table "public"."saved_searches" to "authenticated";

grant select on table "public"."saved_searches" to "authenticated";

grant trigger on table "public"."saved_searches" to "authenticated";

grant truncate on table "public"."saved_searches" to "authenticated";

grant update on table "public"."saved_searches" to "authenticated";

grant delete on table "public"."saved_searches" to "service_role";

grant insert on table "public"."saved_searches" to "service_role";

grant references on table "public"."saved_searches" to "service_role";

grant select on table "public"."saved_searches" to "service_role";

grant trigger on table "public"."saved_searches" to "service_role";

grant truncate on table "public"."saved_searches" to "service_role";

grant update on table "public"."saved_searches" to "service_role";

grant delete on table "public"."user_activities" to "anon";

grant insert on table "public"."user_activities" to "anon";

grant references on table "public"."user_activities" to "anon";

grant select on table "public"."user_activities" to "anon";

grant trigger on table "public"."user_activities" to "anon";

grant truncate on table "public"."user_activities" to "anon";

grant update on table "public"."user_activities" to "anon";

grant delete on table "public"."user_activities" to "authenticated";

grant insert on table "public"."user_activities" to "authenticated";

grant references on table "public"."user_activities" to "authenticated";

grant select on table "public"."user_activities" to "authenticated";

grant trigger on table "public"."user_activities" to "authenticated";

grant truncate on table "public"."user_activities" to "authenticated";

grant update on table "public"."user_activities" to "authenticated";

grant delete on table "public"."user_activities" to "service_role";

grant insert on table "public"."user_activities" to "service_role";

grant references on table "public"."user_activities" to "service_role";

grant select on table "public"."user_activities" to "service_role";

grant trigger on table "public"."user_activities" to "service_role";

grant truncate on table "public"."user_activities" to "service_role";

grant update on table "public"."user_activities" to "service_role";

grant delete on table "public"."user_analytics" to "anon";

grant insert on table "public"."user_analytics" to "anon";

grant references on table "public"."user_analytics" to "anon";

grant select on table "public"."user_analytics" to "anon";

grant trigger on table "public"."user_analytics" to "anon";

grant truncate on table "public"."user_analytics" to "anon";

grant update on table "public"."user_analytics" to "anon";

grant delete on table "public"."user_analytics" to "authenticated";

grant insert on table "public"."user_analytics" to "authenticated";

grant references on table "public"."user_analytics" to "authenticated";

grant select on table "public"."user_analytics" to "authenticated";

grant trigger on table "public"."user_analytics" to "authenticated";

grant truncate on table "public"."user_analytics" to "authenticated";

grant update on table "public"."user_analytics" to "authenticated";

grant delete on table "public"."user_analytics" to "service_role";

grant insert on table "public"."user_analytics" to "service_role";

grant references on table "public"."user_analytics" to "service_role";

grant select on table "public"."user_analytics" to "service_role";

grant trigger on table "public"."user_analytics" to "service_role";

grant truncate on table "public"."user_analytics" to "service_role";

grant update on table "public"."user_analytics" to "service_role";

grant delete on table "public"."user_connections" to "anon";

grant insert on table "public"."user_connections" to "anon";

grant references on table "public"."user_connections" to "anon";

grant select on table "public"."user_connections" to "anon";

grant trigger on table "public"."user_connections" to "anon";

grant truncate on table "public"."user_connections" to "anon";

grant update on table "public"."user_connections" to "anon";

grant delete on table "public"."user_connections" to "authenticated";

grant insert on table "public"."user_connections" to "authenticated";

grant references on table "public"."user_connections" to "authenticated";

grant select on table "public"."user_connections" to "authenticated";

grant trigger on table "public"."user_connections" to "authenticated";

grant truncate on table "public"."user_connections" to "authenticated";

grant update on table "public"."user_connections" to "authenticated";

grant delete on table "public"."user_connections" to "service_role";

grant insert on table "public"."user_connections" to "service_role";

grant references on table "public"."user_connections" to "service_role";

grant select on table "public"."user_connections" to "service_role";

grant trigger on table "public"."user_connections" to "service_role";

grant truncate on table "public"."user_connections" to "service_role";

grant update on table "public"."user_connections" to "service_role";

grant delete on table "public"."user_engagement_scores" to "anon";

grant insert on table "public"."user_engagement_scores" to "anon";

grant references on table "public"."user_engagement_scores" to "anon";

grant select on table "public"."user_engagement_scores" to "anon";

grant trigger on table "public"."user_engagement_scores" to "anon";

grant truncate on table "public"."user_engagement_scores" to "anon";

grant update on table "public"."user_engagement_scores" to "anon";

grant delete on table "public"."user_engagement_scores" to "authenticated";

grant insert on table "public"."user_engagement_scores" to "authenticated";

grant references on table "public"."user_engagement_scores" to "authenticated";

grant select on table "public"."user_engagement_scores" to "authenticated";

grant trigger on table "public"."user_engagement_scores" to "authenticated";

grant truncate on table "public"."user_engagement_scores" to "authenticated";

grant update on table "public"."user_engagement_scores" to "authenticated";

grant delete on table "public"."user_engagement_scores" to "service_role";

grant insert on table "public"."user_engagement_scores" to "service_role";

grant references on table "public"."user_engagement_scores" to "service_role";

grant select on table "public"."user_engagement_scores" to "service_role";

grant trigger on table "public"."user_engagement_scores" to "service_role";

grant truncate on table "public"."user_engagement_scores" to "service_role";

grant update on table "public"."user_engagement_scores" to "service_role";

grant delete on table "public"."user_roles" to "anon";

grant insert on table "public"."user_roles" to "anon";

grant references on table "public"."user_roles" to "anon";

grant select on table "public"."user_roles" to "anon";

grant trigger on table "public"."user_roles" to "anon";

grant truncate on table "public"."user_roles" to "anon";

grant update on table "public"."user_roles" to "anon";

grant delete on table "public"."user_roles" to "authenticated";

grant insert on table "public"."user_roles" to "authenticated";

grant references on table "public"."user_roles" to "authenticated";

grant select on table "public"."user_roles" to "authenticated";

grant trigger on table "public"."user_roles" to "authenticated";

grant truncate on table "public"."user_roles" to "authenticated";

grant update on table "public"."user_roles" to "authenticated";

grant delete on table "public"."user_roles" to "service_role";

grant insert on table "public"."user_roles" to "service_role";

grant references on table "public"."user_roles" to "service_role";

grant select on table "public"."user_roles" to "service_role";

grant trigger on table "public"."user_roles" to "service_role";

grant truncate on table "public"."user_roles" to "service_role";

grant update on table "public"."user_roles" to "service_role";


  create policy "System can create recommendations"
  on "public"."ai_recommendations"
  as permissive
  for insert
  to public
with check (true);



  create policy "Users can update their own recommendations"
  on "public"."ai_recommendations"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view their own recommendations"
  on "public"."ai_recommendations"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Anyone can view announcements"
  on "public"."announcements"
  as permissive
  for select
  to public
using (true);



  create policy "Users can create their own announcements"
  on "public"."announcements"
  as permissive
  for insert
  to public
with check ((auth.uid() = author_id));



  create policy "Users can delete their own announcements"
  on "public"."announcements"
  as permissive
  for delete
  to public
using ((auth.uid() = author_id));



  create policy "Users can update their own announcements"
  on "public"."announcements"
  as permissive
  for update
  to public
using ((auth.uid() = author_id));



  create policy "Admins can view audit logs"
  on "public"."audit_logs"
  as permissive
  for select
  to public
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Admins can manage background jobs"
  on "public"."background_jobs"
  as permissive
  for all
  to public
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Participants can view call participants"
  on "public"."call_participants"
  as permissive
  for select
  to public
using ((call_id IN ( SELECT room_calls.id
   FROM public.room_calls
  WHERE (room_calls.room_id IN ( SELECT room_members.room_id
           FROM public.room_members
          WHERE (room_members.user_id = auth.uid()))))));



  create policy "Users can join calls"
  on "public"."call_participants"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update their participation"
  on "public"."call_participants"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Anyone can view collaborations"
  on "public"."collaborations"
  as permissive
  for select
  to public
using (true);



  create policy "Users can create their own collaborations"
  on "public"."collaborations"
  as permissive
  for insert
  to public
with check ((auth.uid() = poster_id));



  create policy "Users can delete their own collaborations"
  on "public"."collaborations"
  as permissive
  for delete
  to public
using ((auth.uid() = poster_id));



  create policy "Users can update their own collaborations"
  on "public"."collaborations"
  as permissive
  for update
  to public
using ((auth.uid() = poster_id));



  create policy "Users can create comments"
  on "public"."comments"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete their own comments"
  on "public"."comments"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can view comments"
  on "public"."comments"
  as permissive
  for select
  to public
using (true);



  create policy "Content creators can view moderation of their content"
  on "public"."content_moderation"
  as permissive
  for select
  to public
using ((content_id IN ( SELECT posts.id
   FROM public.posts
  WHERE (posts.author_id = auth.uid())
UNION
 SELECT post_comments.id
   FROM public.post_comments
  WHERE (post_comments.user_id = auth.uid())
UNION
 SELECT room_messages.id
   FROM public.room_messages
  WHERE (room_messages.user_id = auth.uid()))));



  create policy "Participants can create conversations"
  on "public"."conversations"
  as permissive
  for insert
  to public
with check (((auth.uid() = participant_a) OR (auth.uid() = participant_b)));



  create policy "Participants can view conversations"
  on "public"."conversations"
  as permissive
  for select
  to public
using (((auth.uid() = participant_a) OR (auth.uid() = participant_b)));



  create policy "Allow messaging only between connected users"
  on "public"."direct_messages"
  as permissive
  for insert
  to authenticated
with check (((auth.uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM public.user_connections
  WHERE ((user_connections.status = 'accepted'::text) AND (((user_connections.follower_id = auth.uid()) AND (user_connections.following_id = direct_messages.recipient_id)) OR ((user_connections.follower_id = direct_messages.recipient_id) AND (user_connections.following_id = auth.uid()))))))));



  create policy "Enable INSERT for authenticated users"
  on "public"."direct_messages"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = sender_id));



  create policy "Enable SELECT for users involved in the conversation"
  on "public"."direct_messages"
  as permissive
  for select
  to authenticated
using (((auth.uid() = sender_id) OR (auth.uid() = recipient_id)));



  create policy "Enable read access for users involved in the conversation"
  on "public"."direct_messages"
  as permissive
  for select
  to authenticated
using (((sender_id = auth.uid()) OR (recipient_id = auth.uid())));



  create policy "Users can delete their own messages"
  on "public"."direct_messages"
  as permissive
  for delete
  to public
using (((sender_id = auth.uid()) OR (recipient_id = auth.uid())));



  create policy "Users can send messages in their channels"
  on "public"."direct_messages"
  as permissive
  for insert
  to public
with check (((auth.uid() = sender_id) AND (array_position(string_to_array(channel_id, '-'::text), (auth.uid())::text) IS NOT NULL)));



  create policy "Users can send messages"
  on "public"."direct_messages"
  as permissive
  for insert
  to public
with check ((auth.uid() = sender_id));



  create policy "Users can update their sent messages"
  on "public"."direct_messages"
  as permissive
  for update
  to public
using ((sender_id = auth.uid()));



  create policy "Users can view messages in their channels"
  on "public"."direct_messages"
  as permissive
  for select
  to public
using ((array_position(string_to_array(channel_id, '-'::text), (auth.uid())::text) IS NOT NULL));



  create policy "Users can view their messages"
  on "public"."direct_messages"
  as permissive
  for select
  to public
using (((sender_id = auth.uid()) OR (recipient_id = auth.uid())));



  create policy "Authenticated users can view rooms"
  on "public"."discussion_rooms"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users can create likes"
  on "public"."likes"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete their own likes"
  on "public"."likes"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can view likes"
  on "public"."likes"
  as permissive
  for select
  to public
using (true);



  create policy "Room members can view reactions"
  on "public"."message_reactions"
  as permissive
  for select
  to authenticated
using ((message_id IN ( SELECT room_messages.id
   FROM public.room_messages
  WHERE (room_messages.room_id IN ( SELECT room_members.room_id
           FROM public.room_members
          WHERE (room_members.user_id = auth.uid()))))));



  create policy "Users can add reactions"
  on "public"."message_reactions"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users can remove their reactions"
  on "public"."message_reactions"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "Participants can send messages"
  on "public"."messages"
  as permissive
  for insert
  to public
with check (((sender_id = auth.uid()) AND (conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE ((auth.uid() = conversations.participant_a) OR (auth.uid() = conversations.participant_b))))));



  create policy "Participants can view messages"
  on "public"."messages"
  as permissive
  for select
  to public
using ((conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE ((auth.uid() = conversations.participant_a) OR (auth.uid() = conversations.participant_b)))));



  create policy "Users can create their own ratings"
  on "public"."movie_ratings"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete their own ratings"
  on "public"."movie_ratings"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can read their own ratings"
  on "public"."movie_ratings"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can update their own ratings"
  on "public"."movie_ratings"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Authenticated users can view their notifications"
  on "public"."notifications"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "System can create notifications"
  on "public"."notifications"
  as permissive
  for insert
  to public
with check (true);



  create policy "Users can update their own notifications"
  on "public"."notifications"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view their own notifications"
  on "public"."notifications"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Anyone can view portfolio items"
  on "public"."portfolio_items"
  as permissive
  for select
  to public
using (true);



  create policy "Users can create their own portfolio items"
  on "public"."portfolio_items"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete their own portfolio items"
  on "public"."portfolio_items"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update their own portfolio items"
  on "public"."portfolio_items"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Authenticated users can view comments"
  on "public"."post_comments"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users can create comments"
  on "public"."post_comments"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users can delete their own comments"
  on "public"."post_comments"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "Users can update their own comments"
  on "public"."post_comments"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id));



  create policy "Authenticated users can view likes"
  on "public"."post_likes"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users can like posts"
  on "public"."post_likes"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users can unlike posts"
  on "public"."post_likes"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "Authenticated users can view posts"
  on "public"."posts"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users can create their own posts"
  on "public"."posts"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = author_id));



  create policy "Users can delete their own posts"
  on "public"."posts"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = author_id));



  create policy "Users can update their own posts"
  on "public"."posts"
  as permissive
  for update
  to authenticated
using ((auth.uid() = author_id));



  create policy "Allow authenticated users to read all profiles"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((auth.role() = 'authenticated'::text));



  create policy "Users can update their own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Users can create comments on accessible projects"
  on "public"."project_comments"
  as permissive
  for insert
  to public
with check (((auth.uid() = user_id) AND (project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE ((projects.is_public = true) OR (projects.creator_id = auth.uid()))))));



  create policy "Users can delete their own comments"
  on "public"."project_comments"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can update their own comments"
  on "public"."project_comments"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view comments for public projects"
  on "public"."project_comments"
  as permissive
  for select
  to public
using ((project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE ((projects.is_public = true) OR (projects.creator_id = auth.uid())))));



  create policy "Project creators can manage tasks"
  on "public"."project_tasks"
  as permissive
  for all
  to public
using ((project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE (projects.creator_id = auth.uid()))))
with check ((project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE (projects.creator_id = auth.uid()))));



  create policy "Users can view tasks for projects they have access to"
  on "public"."project_tasks"
  as permissive
  for select
  to public
using ((project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE ((projects.creator_id = auth.uid()) OR (projects.is_public = true)))));



  create policy "Anyone can view public projects"
  on "public"."projects"
  as permissive
  for select
  to public
using ((is_public = true));



  create policy "Users can create their own projects"
  on "public"."projects"
  as permissive
  for insert
  to public
with check ((auth.uid() = creator_id));



  create policy "Users can delete their own projects"
  on "public"."projects"
  as permissive
  for delete
  to public
using ((auth.uid() = creator_id));



  create policy "Users can update their own projects"
  on "public"."projects"
  as permissive
  for update
  to public
using ((auth.uid() = creator_id));



  create policy "Users can view their own rate limits"
  on "public"."rate_limits"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Call creators can update calls"
  on "public"."room_calls"
  as permissive
  for update
  to public
using ((auth.uid() = started_by));



  create policy "Room members can start calls"
  on "public"."room_calls"
  as permissive
  for insert
  to public
with check (((auth.uid() = started_by) AND (room_id IN ( SELECT room_members.room_id
   FROM public.room_members
  WHERE (room_members.user_id = auth.uid())))));



  create policy "Room members can view calls"
  on "public"."room_calls"
  as permissive
  for select
  to public
using ((room_id IN ( SELECT room_members.room_id
   FROM public.room_members
  WHERE (room_members.user_id = auth.uid()))));



  create policy "Admins can manage categories"
  on "public"."room_categories"
  as permissive
  for all
  to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Allow authenticated users to read room categories"
  on "public"."room_categories"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Anyone can view room categories"
  on "public"."room_categories"
  as permissive
  for select
  to public
using (true);



  create policy "Authenticated users can view room members"
  on "public"."room_members"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Enable read access for all users"
  on "public"."room_members"
  as permissive
  for select
  to public
using (true);



  create policy "Users can join rooms"
  on "public"."room_members"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Authenticated users can view messages"
  on "public"."room_messages"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Room members can send messages"
  on "public"."room_messages"
  as permissive
  for insert
  to public
with check (((auth.uid() = user_id) AND (room_id IN ( SELECT room_members.room_id
   FROM public.room_members
  WHERE (room_members.user_id = auth.uid())))));



  create policy "Users can manage their own saved searches"
  on "public"."saved_searches"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Authenticated users can view shares"
  on "public"."shares"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users can remove their own share"
  on "public"."shares"
  as permissive
  for delete
  to authenticated
using ((auth.uid() = user_id));



  create policy "Users can share a post once"
  on "public"."shares"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "System can create user activities"
  on "public"."user_activities"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update their own activities"
  on "public"."user_activities"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view their own activities"
  on "public"."user_activities"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert their own analytics"
  on "public"."user_analytics"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can view their own analytics"
  on "public"."user_analytics"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can create connections"
  on "public"."user_connections"
  as permissive
  for insert
  to public
with check ((auth.uid() = follower_id));



  create policy "Users can delete their connections"
  on "public"."user_connections"
  as permissive
  for delete
  to public
using (((auth.uid() = follower_id) OR (auth.uid() = following_id)));



  create policy "Users can update their connections"
  on "public"."user_connections"
  as permissive
  for update
  to public
using (((auth.uid() = follower_id) OR (auth.uid() = following_id)));



  create policy "Users can view connections"
  on "public"."user_connections"
  as permissive
  for select
  to public
using (((follower_id = auth.uid()) OR (following_id = auth.uid())));



  create policy "System can manage engagement scores"
  on "public"."user_engagement_scores"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "Users can view their own engagement scores"
  on "public"."user_engagement_scores"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Admins can manage all roles"
  on "public"."user_roles"
  as permissive
  for all
  to public
using (public.has_role(auth.uid(), 'admin'::public.app_role));



  create policy "Users can view their own roles"
  on "public"."user_roles"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Public profiles are viewable by everyone."
  on "public"."profiles"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Users can leave rooms"
  on "public"."room_members"
  as permissive
  for delete
  to public
using (((user_id = auth.uid()) OR (room_id IN ( SELECT discussion_rooms.id
   FROM public.discussion_rooms
  WHERE (discussion_rooms.creator_id = auth.uid())))));


CREATE TRIGGER update_ai_recommendations_updated_at BEFORE UPDATE ON public.ai_recommendations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_content_moderation_updated_at BEFORE UPDATE ON public.content_moderation FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_default_category_trigger BEFORE INSERT ON public.discussion_rooms FOR EACH ROW EXECUTE FUNCTION public.assign_default_discussion_category();

CREATE TRIGGER update_discussion_rooms_updated_at BEFORE UPDATE ON public.discussion_rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_portfolio_items_updated_at BEFORE UPDATE ON public.portfolio_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_comment_notification AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.trigger_comment_notification();

CREATE TRIGGER update_post_comment_count AFTER INSERT OR DELETE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.update_post_stats();

CREATE TRIGGER update_post_comments_updated_at BEFORE UPDATE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_post_like_notification AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.trigger_post_like_notification();

CREATE TRIGGER update_post_like_count AFTER INSERT OR DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.update_post_stats();

CREATE TRIGGER audit_posts_changes AFTER INSERT OR DELETE OR UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_comments_updated_at BEFORE UPDATE ON public.project_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER project_create_room_trigger AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.create_project_discussion_room();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_room_member_count_trigger AFTER INSERT OR DELETE ON public.room_members FOR EACH ROW EXECUTE FUNCTION public.update_room_member_count();

CREATE TRIGGER room_message_activity_trigger AFTER INSERT ON public.room_messages FOR EACH ROW EXECUTE FUNCTION public.update_room_last_activity();

CREATE TRIGGER update_saved_searches_updated_at BEFORE UPDATE ON public.saved_searches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_activities_updated_at BEFORE UPDATE ON public.user_activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_engagement_scores_updated_at BEFORE UPDATE ON public.user_engagement_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER audit_user_roles_changes AFTER INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();


  create policy "Anyone can view portfolio files"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'portfolios'::text));



  create policy "Anyone can view portfolios files"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'portfolios'::text));



  create policy "Users can delete their own files"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'portfolios'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));



  create policy "Users can delete their own portfolio files"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'portfolios'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can update their own files"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'portfolios'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));



  create policy "Users can update their own portfolio files"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'portfolios'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can upload their own portfolio files"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'portfolios'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Users can upload to their own folder"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'portfolios'::text) AND ((storage.foldername(name))[1] = 'posts'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));



