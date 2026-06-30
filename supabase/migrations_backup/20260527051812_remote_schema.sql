-- create sequence "public"."project_space_join_requests_id_seq";

create sequence "public"."room_join_requests_id_seq";

drop trigger if exists "trigger_notify_new_direct_message" on "public"."direct_messages";

drop trigger if exists "notify_on_job_application" on "public"."job_applications";

drop trigger if exists "notify_on_post_comment" on "public"."post_comments";

drop trigger if exists "notify_on_post_like" on "public"."post_likes";

drop trigger if exists "update_profiles_updated_at" on "public"."profiles";

drop trigger if exists "notify_on_project_application" on "public"."project_applications";

drop trigger if exists "notify_on_project_join_request" on "public"."project_space_join_requests";

drop trigger if exists "trigger_notify_new_project_message" on "public"."project_space_messages";

drop trigger if exists "notify_on_room_join_request" on "public"."room_join_requests";

drop trigger if exists "on_room_member_change" on "public"."room_members";

drop trigger if exists "trigger_notify_new_room_message" on "public"."room_messages";

drop trigger if exists "notify_on_connection_event" on "public"."user_connections";

drop trigger if exists "update_user_film_ratings_updated_at" on "public"."user_film_ratings";

drop policy "Participants can view details" on "public"."call_participants";

drop policy "Room members can view calls" on "public"."calls";

drop policy "Users can view own conversations" on "public"."conversations";

drop policy "Admins can manage all discussion rooms" on "public"."discussion_rooms";

drop policy "Admins can manage all jobs" on "public"."jobs";

drop policy "Admins can manage all listings" on "public"."marketplace_listings";

drop policy "Admins can manage all messages" on "public"."messages";

drop policy "Users can manage own notifications" on "public"."notifications";

drop policy "Admins can manage all comments" on "public"."post_comments";

drop policy "Anyone can view comments" on "public"."post_comments";

drop policy "Anyone can view likes" on "public"."post_likes";

drop policy "Users can manage own likes" on "public"."post_likes";

drop policy "Admins can manage all posts" on "public"."posts";

drop policy "Authenticated users can post" on "public"."posts";

drop policy "Admins can manage all profiles" on "public"."profiles";

drop policy "Users can update own profile" on "public"."profiles";

drop policy "Admins can manage all project spaces" on "public"."project_spaces";

drop policy "Admins can manage all room messages" on "public"."room_messages";

drop policy "Users can view room messages" on "public"."room_messages";

drop policy "Members can view tasks" on "public"."tasks";

drop policy "Users can follow others" on "public"."user_connections";

drop policy "Users can remove connections" on "public"."user_connections";

drop policy "Users can manage own experience" on "public"."user_experience";

drop policy "Anyone can view film ratings" on "public"."user_film_ratings";

drop policy "Authenticated users can create ratings" on "public"."user_film_ratings";

drop policy "Users can delete their own ratings" on "public"."user_film_ratings";

drop policy "Users can update their own ratings" on "public"."user_film_ratings";

drop policy "Users can manage own settings" on "public"."user_settings";

drop policy "Users can manage own skills" on "public"."user_skills";

drop policy "Applicants can view own applications" on "public"."job_applications";

drop policy "Job posters can update status" on "public"."job_applications";

drop policy "Job posters can view applications" on "public"."job_applications";

drop policy "Users can create applications" on "public"."job_applications";

drop policy "Creator manage room requests" on "public"."room_join_requests";

drop policy "Users delete own room requests or creator" on "public"."room_join_requests";

drop policy "Users insert own room requests" on "public"."room_join_requests";

drop policy "Users view own room requests or if creator" on "public"."room_join_requests";

revoke delete on table "public"."job_alerts" from "anon";

revoke insert on table "public"."job_alerts" from "anon";

revoke references on table "public"."job_alerts" from "anon";

revoke select on table "public"."job_alerts" from "anon";

revoke trigger on table "public"."job_alerts" from "anon";

revoke truncate on table "public"."job_alerts" from "anon";

revoke update on table "public"."job_alerts" from "anon";

revoke delete on table "public"."job_alerts" from "authenticated";

revoke insert on table "public"."job_alerts" from "authenticated";

revoke references on table "public"."job_alerts" from "authenticated";

revoke select on table "public"."job_alerts" from "authenticated";

revoke trigger on table "public"."job_alerts" from "authenticated";

revoke truncate on table "public"."job_alerts" from "authenticated";

revoke update on table "public"."job_alerts" from "authenticated";

revoke delete on table "public"."job_alerts" from "service_role";

revoke insert on table "public"."job_alerts" from "service_role";

revoke references on table "public"."job_alerts" from "service_role";

revoke select on table "public"."job_alerts" from "service_role";

revoke trigger on table "public"."job_alerts" from "service_role";

revoke truncate on table "public"."job_alerts" from "service_role";

revoke update on table "public"."job_alerts" from "service_role";

alter table "public"."calls" drop constraint "calls_created_by_fkey";

alter table "public"."calls" drop constraint "calls_room_id_fkey";

alter table "public"."calls" drop constraint "calls_type_check";

alter table "public"."job_alerts" drop constraint "job_alerts_user_id_fkey";

alter table "public"."notifications" drop constraint "notifications_priority_check";

alter table "public"."post_comments" drop constraint "post_comments_user_id_fkey";

alter table "public"."profiles" drop constraint "profiles_account_type_check";

alter table "public"."project_spaces" drop constraint "project_spaces_project_id_key";

alter table "public"."room_join_requests" drop constraint "room_join_requests_room_id_user_id_key";

alter table "public"."user_connections" drop constraint "user_connections_follower_id_following_id_key";

alter table "public"."user_film_ratings" drop constraint "user_film_ratings_rating_check";

alter table "public"."user_film_ratings" drop constraint "user_film_ratings_user_id_fkey";

alter table "public"."user_settings" drop constraint "user_settings_profile_privacy_check";

alter table "public"."audit_logs" drop constraint "audit_logs_actor_id_fkey";

alter table "public"."call_participants" drop constraint "call_participants_user_id_fkey";

alter table "public"."conversations" drop constraint "conversations_user1_id_fkey";

alter table "public"."conversations" drop constraint "conversations_user2_id_fkey";

alter table "public"."discussion_rooms" drop constraint "discussion_rooms_creator_id_fkey";

alter table "public"."gov_approval_queue" drop constraint "gov_approval_queue_maker_id_fkey";

alter table "public"."messages" drop constraint "messages_sender_id_fkey";

alter table "public"."project_space_bookmarks" drop constraint "project_space_bookmarks_user_id_fkey";

alter table "public"."project_space_messages" drop constraint "project_space_messages_user_id_fkey";

alter table "public"."project_spaces" drop constraint "project_spaces_creator_id_fkey";

alter table "public"."room_join_requests" drop constraint "room_join_requests_user_id_fkey";

alter table "public"."room_members" drop constraint "room_members_user_id_fkey";

alter table "public"."tasks" drop constraint "tasks_assignee_id_fkey";

alter table "public"."user_analytics" drop constraint "user_analytics_user_id_fkey";

alter table "public"."user_connections" drop constraint "user_connections_follower_id_fkey";

alter table "public"."user_connections" drop constraint "user_connections_following_id_fkey";

drop function if exists "public"."create_notification_for_like"();

drop function if exists "public"."get_follower_count"(target_user_id uuid);

drop function if exists "public"."get_segmented_film_ratings"(tmdb_ids integer[]);

drop function if exists "public"."handle_new_notification"();

drop function if exists "public"."notify_new_project_message"();

drop function if exists "public"."update_discussion_room_member_count"();

alter table "public"."job_alerts" drop constraint "job_alerts_pkey";

alter table "public"."user_settings" drop constraint "user_settings_pkey";

drop index if exists "public"."idx_notifications_user_id_unread";

drop index if exists "public"."job_alerts_pkey";

drop index if exists "public"."project_spaces_project_id_key";

drop index if exists "public"."room_join_requests_room_id_user_id_key";

drop index if exists "public"."user_connections_follower_id_following_id_key";

drop index if exists "public"."idx_messages_conversation_id";

drop index if exists "public"."user_settings_pkey";

drop table "public"."job_alerts";


  create table "public"."budget_items" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "category" text not null,
    "item_name" text not null,
    "estimated_cost" numeric(12,2),
    "actual_cost" numeric(12,2),
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."budget_items" enable row level security;


  create table "public"."call_reactions" (
    "id" uuid not null default gen_random_uuid(),
    "call_id" uuid not null,
    "user_id" uuid not null,
    "emoji" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."call_reactions" enable row level security;


  create table "public"."call_sheets" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "date" date not null,
    "call_time" time without time zone,
    "location" text,
    "director" text,
    "director_phone" text,
    "producer" text,
    "producer_phone" text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."call_sheets" enable row level security;


  create table "public"."files" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "name" text not null,
    "size" bigint not null,
    "url" text not null,
    "file_type" text,
    "uploaded_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."files" enable row level security;


  create table "public"."legal_docs" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "title" text not null,
    "description" text,
    "url" text,
    "document_type" text,
    "uploaded_by" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."legal_docs" enable row level security;


  create table "public"."mentions" (
    "id" uuid not null default gen_random_uuid(),
    "mentioner_id" uuid not null,
    "mentioned_id" uuid not null,
    "related_id" uuid not null,
    "related_type" text not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."mentions" enable row level security;


  create table "public"."message_reactions" (
    "id" uuid not null default gen_random_uuid(),
    "message_id" uuid not null,
    "user_id" uuid not null,
    "emoji" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."message_reactions" enable row level security;


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


  create table "public"."profile_views" (
    "id" uuid not null default gen_random_uuid(),
    "profile_id" uuid not null,
    "viewer_id" uuid,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."profile_views" enable row level security;


  create table "public"."project_invites" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "invite_code" text not null,
    "created_by" uuid,
    "expires_at" timestamp with time zone,
    "max_uses" integer,
    "used_count" integer default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."project_invites" enable row level security;


  create table "public"."project_members" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "user_id" uuid not null,
    "role" text not null default 'member'::text,
    "joined_at" timestamp with time zone not null default now()
      );


alter table "public"."project_members" enable row level security;


  create table "public"."project_message_read_status" (
    "project_space_id" uuid not null,
    "user_id" uuid not null,
    "last_read_at" timestamp with time zone default now()
      );


alter table "public"."project_message_read_status" enable row level security;


  create table "public"."project_space_message_read_status" (
    "id" uuid not null default gen_random_uuid(),
    "project_space_id" uuid not null,
    "user_id" uuid not null,
    "last_read_at" timestamp with time zone not null default now()
      );


alter table "public"."project_space_message_read_status" enable row level security;


  create table "public"."room_keys" (
    "id" uuid not null default gen_random_uuid(),
    "room_id" uuid not null,
    "user_id" uuid not null,
    "sender_id" uuid,
    "encrypted_key" text not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."room_keys" enable row level security;


  create table "public"."room_message_read_status" (
    "room_id" uuid not null,
    "user_id" uuid not null,
    "last_read_at" timestamp with time zone default now()
      );


alter table "public"."room_message_read_status" enable row level security;


  create table "public"."schedule_items" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "title" text not null,
    "description" text,
    "start_date" date not null,
    "end_date" date,
    "status" text default 'scheduled'::text,
    "assigned_to" uuid,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."schedule_items" enable row level security;


  create table "public"."shares" (
    "id" uuid not null default gen_random_uuid(),
    "post_id" uuid not null,
    "user_id" uuid not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."shares" enable row level security;


  create table "public"."shot_list" (
    "id" uuid not null default gen_random_uuid(),
    "project_id" uuid not null,
    "scene" integer not null,
    "shot" integer not null,
    "description" text not null,
    "status" text default 'pending'::text,
    "notes" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."shot_list" enable row level security;


  create table "public"."user_activities" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "activity_type" text not null,
    "activity_data" jsonb default '{}'::jsonb,
    "is_read" boolean default false,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."user_activities" enable row level security;

alter table "public"."call_participants" add column "status" text not null default 'joined'::text;

alter table "public"."call_participants" alter column "call_id" set not null;

alter table "public"."call_participants" alter column "joined_at" set not null;

alter table "public"."call_participants" alter column "user_id" set not null;

alter table "public"."calls" drop column "created_by";

alter table "public"."calls" drop column "type";

alter table "public"."calls" add column "daily_room_name" text not null;

alter table "public"."calls" add column "daily_room_url" text not null;

alter table "public"."calls" add column "room_type" text not null;

alter table "public"."calls" add column "started_at" timestamp with time zone not null default now();

alter table "public"."calls" add column "started_by" uuid;

alter table "public"."calls" alter column "created_at" set not null;

alter table "public"."calls" alter column "room_id" set not null;

alter table "public"."calls" alter column "room_id" set data type text using "room_id"::text;

alter table "public"."calls" alter column "status" set not null;

alter table "public"."direct_messages" alter column "content" set not null;

alter table "public"."direct_messages" alter column "created_at" set default timezone('utc'::text, now());

alter table "public"."direct_messages" alter column "created_at" set not null;

alter table "public"."direct_messages" alter column "receiver_id" set not null;

alter table "public"."direct_messages" alter column "sender_id" set not null;

alter table "public"."discussion_rooms" add column "name" text not null;

alter table "public"."discussion_rooms" alter column "tags" set default '{}'::text[];

alter table "public"."gov_approval_queue" alter column "action" set not null;

alter table "public"."gov_approval_queue" alter column "created_at" set not null;

alter table "public"."gov_approval_queue" alter column "target_id" set not null;

alter table "public"."gov_approval_queue" alter column "target_type" set not null;

alter table "public"."gov_audit_ledger" alter column "action" set not null;

alter table "public"."gov_audit_ledger" alter column "target_id" set not null;

alter table "public"."gov_audit_ledger" alter column "target_type" set not null;

alter table "public"."gov_audit_ledger" alter column "timestamp" set not null;

alter table "public"."gov_entity_relationships" alter column "timestamp" set not null;

alter table "public"."messages" drop column "read_at";

alter table "public"."messages" add column "deleted_for_users" uuid[] default '{}'::uuid[];

alter table "public"."messages" add column "is_deleted" boolean default false;

alter table "public"."messages" add column "reply_to_id" uuid;

alter table "public"."notification_logs" enable row level security;

alter table "public"."notifications" drop column "expires_at";

alter table "public"."notifications" drop column "is_actionable";

alter table "public"."notifications" drop column "metadata";

alter table "public"."notifications" drop column "priority";

alter table "public"."notifications" drop column "related_type";

alter table "public"."notifications" drop column "updated_at";

alter table "public"."notifications" add column "trigger_user_id" uuid;

alter table "public"."notifications" alter column "id" set default gen_random_uuid();

alter table "public"."platform_cinema" drop column "gallery";

alter table "public"."post_bookmarks" alter column "id" set default gen_random_uuid();

alter table "public"."post_comments" add column "parent_comment_id" uuid;

alter table "public"."post_comments" add column "updated_at" timestamp with time zone default now();

alter table "public"."posts" drop column "media_urls";

alter table "public"."posts" add column "media_items" jsonb default '[]'::jsonb;

alter table "public"."posts" add column "media_url" text;

alter table "public"."profiles" drop column "is_studio";

alter table "public"."profiles" add column "encrypted_private_key" text;

alter table "public"."profiles" add column "key_salt" text;

alter table "public"."profiles" add column "public_key" text;

alter table "public"."profiles" add column "social_links" jsonb default '{}'::jsonb;

alter table "public"."profiles" alter column "account_type" drop default;

alter table "public"."profiles" alter column "updated_at" drop default;

alter table "public"."project_messages" alter column "content" set not null;

alter table "public"."project_messages" alter column "created_at" set not null;

alter table "public"."project_messages" alter column "project_id" set not null;

alter table "public"."project_messages" alter column "updated_at" set not null;

alter table "public"."project_messages" alter column "user_id" set not null;

alter table "public"."project_space_bookmarks" enable row level security;

alter table "public"."project_space_categories" enable row level security;

alter table "public"."project_space_join_requests" enable row level security;

alter table "public"."project_space_members" alter column "role" set not null;

alter table "public"."project_space_messages" alter column "content" set not null;

alter table "public"."project_space_messages" alter column "created_at" set not null;

alter table "public"."project_space_messages" alter column "id" set default gen_random_uuid();

alter table "public"."project_space_messages" alter column "project_space_id" set not null;

alter table "public"."project_space_messages" alter column "user_id" set not null;

alter table "public"."projects" alter column "created_at" set not null;

alter table "public"."projects" alter column "creator_id" set not null;

alter table "public"."projects" alter column "id" set default gen_random_uuid();

alter table "public"."projects" alter column "status" set default 'planning'::text;

alter table "public"."projects" alter column "updated_at" set not null;

alter table "public"."room_categories" enable row level security;

alter table "public"."room_join_requests" drop column "message";

alter table "public"."room_join_requests" alter column "created_at" set not null;

alter table "public"."room_join_requests" alter column "id" drop default;

alter table "public"."room_join_requests" alter column "id" add generated by default as identity;

alter table "public"."room_join_requests" alter column "id" set data type bigint using "id"::bigint;

alter table "public"."room_join_requests" alter column "room_id" set not null;

alter table "public"."room_join_requests" alter column "status" set not null;

alter table "public"."room_join_requests" alter column "user_id" set not null;

alter table "public"."room_messages" add column "deleted_for_users" uuid[] default '{}'::uuid[];

alter table "public"."room_messages" add column "is_deleted" boolean default false;

alter table "public"."room_messages" add column "reply_to_id" uuid;

alter table "public"."room_messages" add column "visibility_role" text default 'everyone'::text;

alter table "public"."support_tickets" add column "attachment_url" text;

alter table "public"."user_analytics" drop column "metadata";

alter table "public"."user_analytics" add column "event_data" jsonb default '{}'::jsonb;

alter table "public"."user_analytics" add column "page_url" text;

alter table "public"."user_analytics" alter column "created_at" set not null;

alter table "public"."user_analytics" enable row level security;

alter table "public"."user_film_ratings" drop column "review";

alter table "public"."user_film_ratings" drop column "updated_at";

alter table "public"."user_settings" drop column "profile_privacy";

alter table "public"."user_settings" add column "allow_messages_from" character varying(20) default 'everyone'::character varying;

alter table "public"."user_settings" add column "comment_notifications" boolean default true;

alter table "public"."user_settings" add column "created_at" timestamp with time zone default now();

alter table "public"."user_settings" add column "font_size" character varying(20) default 'medium'::character varying;

alter table "public"."user_settings" add column "high_contrast" boolean default false;

alter table "public"."user_settings" add column "id" uuid not null default gen_random_uuid();

alter table "public"."user_settings" add column "job_alerts" boolean default true;

alter table "public"."user_settings" add column "language" character varying(10) default 'en'::character varying;

alter table "public"."user_settings" add column "message_notifications" boolean default true;

alter table "public"."user_settings" add column "notification_sounds" boolean default true;

alter table "public"."user_settings" add column "profile_visibility" character varying(20) default 'public'::character varying;

alter table "public"."user_settings" add column "project_notifications" boolean default true;

alter table "public"."user_settings" add column "reduce_motion" boolean default false;

alter table "public"."user_settings" add column "show_email" boolean default false;

alter table "public"."user_settings" add column "show_location" boolean default true;

alter table "public"."user_settings" add column "show_online_status" boolean default true;

alter table "public"."user_settings" add column "sound_effects" boolean default true;

alter table "public"."user_settings" alter column "push_notifications" set default false;

alter table "public"."user_settings" alter column "theme" set default 'system'::character varying;

alter table "public"."user_settings" alter column "theme" set data type character varying(20) using "theme"::character varying(20);

CREATE UNIQUE INDEX budget_items_pkey ON public.budget_items USING btree (id);

CREATE UNIQUE INDEX call_reactions_pkey ON public.call_reactions USING btree (id);

CREATE UNIQUE INDEX call_sheets_pkey ON public.call_sheets USING btree (id);

CREATE UNIQUE INDEX calls_daily_room_name_key ON public.calls USING btree (daily_room_name);

CREATE UNIQUE INDEX files_pkey ON public.files USING btree (id);

CREATE INDEX idx_announcements_author_id ON public.announcements USING btree (author_id);

CREATE INDEX idx_announcements_publisher_page_id ON public.announcements USING btree (publisher_page_id);

CREATE INDEX idx_approval_status ON public.gov_approval_queue USING btree (status);

CREATE INDEX idx_audit_target ON public.gov_audit_ledger USING btree (target_id);

CREATE INDEX idx_audit_timestamp ON public.gov_audit_ledger USING btree ("timestamp" DESC);

CREATE INDEX idx_budget_items_project_id ON public.budget_items USING btree (project_id);

CREATE INDEX idx_call_participants_call_id ON public.call_participants USING btree (call_id);

CREATE INDEX idx_call_participants_user_id ON public.call_participants USING btree (user_id);

CREATE INDEX idx_call_reactions_call_id ON public.call_reactions USING btree (call_id);

CREATE INDEX idx_call_reactions_user_id ON public.call_reactions USING btree (user_id);

CREATE INDEX idx_call_sheets_project_id ON public.call_sheets USING btree (project_id);

CREATE INDEX idx_calls_room ON public.calls USING btree (room_type, room_id);

CREATE INDEX idx_calls_started_by ON public.calls USING btree (started_by);

CREATE INDEX idx_calls_status ON public.calls USING btree (status);

CREATE INDEX idx_company_page_admins_page ON public.company_page_admins USING btree (page_id);

CREATE INDEX idx_company_page_followers_page ON public.company_page_followers USING btree (page_id);

CREATE INDEX idx_company_page_followers_user ON public.company_page_followers USING btree (user_id);

CREATE INDEX idx_company_page_members_page ON public.company_page_members USING btree (page_id);

CREATE INDEX idx_company_pages_owner ON public.company_pages USING btree (owner_id);

CREATE INDEX idx_company_pages_slug ON public.company_pages USING btree (slug);

CREATE INDEX idx_conversations_participants ON public.conversations USING btree (user1_id, user2_id);

CREATE INDEX idx_conversations_user2_id ON public.conversations USING btree (user2_id);

CREATE INDEX idx_direct_messages_channel_id ON public.direct_messages USING btree (channel_id);

CREATE INDEX idx_direct_messages_receiver_id ON public.direct_messages USING btree (receiver_id);

CREATE INDEX idx_direct_messages_sender_id ON public.direct_messages USING btree (sender_id);

CREATE INDEX idx_discussion_rooms_category_id ON public.discussion_rooms USING btree (category_id);

CREATE INDEX idx_discussion_rooms_creator_id ON public.discussion_rooms USING btree (creator_id);

CREATE INDEX idx_files_project_id ON public.files USING btree (project_id);

CREATE INDEX idx_files_uploaded_by ON public.files USING btree (uploaded_by);

CREATE INDEX idx_film_reviews_user_id ON public.film_reviews USING btree (user_id);

CREATE INDEX idx_job_applications_applicant_id ON public.job_applications USING btree (applicant_id);

CREATE INDEX idx_jobs_page_id ON public.jobs USING btree (page_id) WHERE (page_id IS NOT NULL);

CREATE INDEX idx_jobs_posted_by ON public.jobs USING btree (posted_by);

CREATE INDEX idx_jobs_search_trgm ON public.jobs USING gin ((((((title || ' '::text) || COALESCE(company, ''::text)) || ' '::text) || COALESCE(description, ''::text))) public.gin_trgm_ops);

CREATE INDEX idx_legal_docs_project_id ON public.legal_docs USING btree (project_id);

CREATE INDEX idx_legal_docs_uploaded_by ON public.legal_docs USING btree (uploaded_by);

CREATE INDEX idx_marketplace_search_trgm ON public.marketplace_listings USING gin ((((title || ' '::text) || COALESCE(description, ''::text))) public.gin_trgm_ops);

CREATE INDEX idx_mentions_mentioned ON public.mentions USING btree (mentioned_id);

CREATE INDEX idx_mentions_related ON public.mentions USING btree (related_id, related_type);

CREATE INDEX idx_message_reactions_message_id ON public.message_reactions USING btree (message_id);

CREATE INDEX idx_message_reactions_user_id ON public.message_reactions USING btree (user_id);

CREATE INDEX idx_portfolio_items_user_id ON public.portfolio_items USING btree (user_id);

CREATE INDEX idx_post_bookmarks_post ON public.post_bookmarks USING btree (post_id);

CREATE INDEX idx_post_bookmarks_user ON public.post_bookmarks USING btree (user_id);

CREATE INDEX idx_post_comments_parent_id ON public.post_comments USING btree (parent_id);

CREATE INDEX idx_post_comments_post_id ON public.post_comments USING btree (post_id);

CREATE INDEX idx_post_comments_user_id ON public.post_comments USING btree (user_id);

CREATE INDEX idx_post_likes_user_id ON public.post_likes USING btree (user_id);

CREATE INDEX idx_profile_views_created_at ON public.profile_views USING btree (created_at);

CREATE INDEX idx_profile_views_profile_id ON public.profile_views USING btree (profile_id);

CREATE INDEX idx_profiles_search_trgm ON public.profiles USING gin ((((((full_name || ' '::text) || username) || ' '::text) || COALESCE(craft, ''::text))) public.gin_trgm_ops);

CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);

CREATE INDEX idx_project_applications_user_id ON public.project_applications USING btree (user_id);

CREATE INDEX idx_project_invites_created_by ON public.project_invites USING btree (created_by);

CREATE INDEX idx_project_invites_project_id ON public.project_invites USING btree (project_id);

CREATE INDEX idx_project_members_project_id ON public.project_members USING btree (project_id);

CREATE INDEX idx_project_members_project_user_composite ON public.project_members USING btree (project_id, user_id);

CREATE INDEX idx_project_members_user_id ON public.project_members USING btree (user_id);

CREATE INDEX idx_project_messages_created_at ON public.project_messages USING btree (created_at);

CREATE INDEX idx_project_messages_project_id ON public.project_messages USING btree (project_id);

CREATE INDEX idx_project_messages_user_id ON public.project_messages USING btree (user_id);

CREATE INDEX idx_project_space_bookmarks_project_space_id ON public.project_space_bookmarks USING btree (project_space_id);

CREATE INDEX idx_project_space_bookmarks_user_id ON public.project_space_bookmarks USING btree (user_id);

CREATE INDEX idx_project_space_join_requests_user_id ON public.project_space_join_requests USING btree (user_id);

CREATE INDEX idx_project_space_members_ps_id ON public.project_space_members USING btree (project_space_id);

CREATE INDEX idx_project_space_members_ps_user_composite ON public.project_space_members USING btree (project_space_id, user_id);

CREATE INDEX idx_project_space_members_user_id ON public.project_space_members USING btree (user_id);

CREATE INDEX idx_project_space_message_read_status_user_id ON public.project_space_message_read_status USING btree (user_id);

CREATE INDEX idx_project_space_messages_project_space_id ON public.project_space_messages USING btree (project_space_id);

CREATE INDEX idx_project_space_messages_user_id ON public.project_space_messages USING btree (user_id);

CREATE INDEX idx_project_spaces_category_id ON public.project_spaces USING btree (category_id);

CREATE INDEX idx_project_spaces_creator_id ON public.project_spaces USING btree (creator_id);

CREATE INDEX idx_projects_creator_id ON public.projects USING btree (creator_id);

CREATE INDEX idx_rel_device ON public.gov_entity_relationships USING btree (device_id);

CREATE INDEX idx_rel_ip ON public.gov_entity_relationships USING btree (ip_address);

CREATE INDEX idx_review_helpful_marks_user_id ON public.review_helpful_marks USING btree (user_id);

CREATE INDEX idx_room_join_requests_room_id ON public.room_join_requests USING btree (room_id);

CREATE INDEX idx_room_join_requests_user_id ON public.room_join_requests USING btree (user_id);

CREATE INDEX idx_room_keys_sender_id ON public.room_keys USING btree (sender_id);

CREATE INDEX idx_room_keys_user_id ON public.room_keys USING btree (user_id);

CREATE INDEX idx_room_members_room_id ON public.room_members USING btree (room_id);

CREATE INDEX idx_room_members_room_user_composite ON public.room_members USING btree (room_id, user_id);

CREATE INDEX idx_room_members_user_id ON public.room_members USING btree (user_id);

CREATE INDEX idx_room_messages_room_id ON public.room_messages USING btree (room_id);

CREATE INDEX idx_room_messages_user_id ON public.room_messages USING btree (user_id);

CREATE INDEX idx_schedule_items_assigned_to ON public.schedule_items USING btree (assigned_to);

CREATE INDEX idx_schedule_items_project_id ON public.schedule_items USING btree (project_id);

CREATE INDEX idx_shares_user_id ON public.shares USING btree (user_id);

CREATE INDEX idx_shot_list_project_id ON public.shot_list USING btree (project_id);

CREATE INDEX idx_tasks_assignee_id ON public.tasks USING btree (assignee_id);

CREATE INDEX idx_tasks_project_space_id ON public.tasks USING btree (project_space_id);

CREATE INDEX idx_user_activities_user_id ON public.user_activities USING btree (user_id);

CREATE INDEX idx_user_analytics_user_id ON public.user_analytics USING btree (user_id);

CREATE INDEX idx_user_connections_follower_id ON public.user_connections USING btree (follower_id);

CREATE INDEX idx_user_connections_following_id ON public.user_connections USING btree (following_id);

CREATE INDEX idx_user_experience_user_id ON public.user_experience USING btree (user_id);

CREATE INDEX idx_user_settings_user_id ON public.user_settings USING btree (user_id);

CREATE INDEX idx_user_skills_user_id ON public.user_skills USING btree (user_id);

CREATE UNIQUE INDEX legal_docs_pkey ON public.legal_docs USING btree (id);

CREATE UNIQUE INDEX mentions_pkey ON public.mentions USING btree (id);

CREATE UNIQUE INDEX message_reactions_pkey ON public.message_reactions USING btree (id);

CREATE UNIQUE INDEX portfolio_items_pkey ON public.portfolio_items USING btree (id);

CREATE UNIQUE INDEX profile_views_pkey ON public.profile_views USING btree (id);

CREATE UNIQUE INDEX project_invites_invite_code_key ON public.project_invites USING btree (invite_code);

CREATE UNIQUE INDEX project_invites_pkey ON public.project_invites USING btree (id);

CREATE UNIQUE INDEX project_members_pkey ON public.project_members USING btree (id);

CREATE UNIQUE INDEX project_members_project_id_user_id_key ON public.project_members USING btree (project_id, user_id);

CREATE UNIQUE INDEX project_message_read_status_pkey ON public.project_message_read_status USING btree (project_space_id, user_id);

CREATE UNIQUE INDEX project_space_message_read_status_pkey ON public.project_space_message_read_status USING btree (id);

CREATE UNIQUE INDEX project_space_message_read_status_project_space_id_user_id_key ON public.project_space_message_read_status USING btree (project_space_id, user_id);

CREATE UNIQUE INDEX room_keys_pkey ON public.room_keys USING btree (id);

CREATE INDEX room_keys_room_user_idx ON public.room_keys USING btree (room_id, user_id);

CREATE UNIQUE INDEX room_message_read_status_pkey ON public.room_message_read_status USING btree (room_id, user_id);

CREATE UNIQUE INDEX schedule_items_pkey ON public.schedule_items USING btree (id);

CREATE UNIQUE INDEX shares_pkey ON public.shares USING btree (id);

CREATE UNIQUE INDEX shares_post_id_user_id_key ON public.shares USING btree (post_id, user_id);

CREATE UNIQUE INDEX shot_list_pkey ON public.shot_list USING btree (id);

CREATE UNIQUE INDEX unique_request_per_user ON public.project_space_join_requests USING btree (project_space_id, user_id);

CREATE UNIQUE INDEX unique_space_per_project ON public.project_spaces USING btree (project_id);

CREATE UNIQUE INDEX user_activities_pkey ON public.user_activities USING btree (id);

CREATE UNIQUE INDEX user_settings_user_id_key ON public.user_settings USING btree (user_id);

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);

CREATE UNIQUE INDEX user_settings_pkey ON public.user_settings USING btree (id);

alter table "public"."budget_items" add constraint "budget_items_pkey" PRIMARY KEY using index "budget_items_pkey";

alter table "public"."call_reactions" add constraint "call_reactions_pkey" PRIMARY KEY using index "call_reactions_pkey";

alter table "public"."call_sheets" add constraint "call_sheets_pkey" PRIMARY KEY using index "call_sheets_pkey";

alter table "public"."files" add constraint "files_pkey" PRIMARY KEY using index "files_pkey";

alter table "public"."legal_docs" add constraint "legal_docs_pkey" PRIMARY KEY using index "legal_docs_pkey";

alter table "public"."mentions" add constraint "mentions_pkey" PRIMARY KEY using index "mentions_pkey";

alter table "public"."message_reactions" add constraint "message_reactions_pkey" PRIMARY KEY using index "message_reactions_pkey";

alter table "public"."portfolio_items" add constraint "portfolio_items_pkey" PRIMARY KEY using index "portfolio_items_pkey";

alter table "public"."profile_views" add constraint "profile_views_pkey" PRIMARY KEY using index "profile_views_pkey";

alter table "public"."project_invites" add constraint "project_invites_pkey" PRIMARY KEY using index "project_invites_pkey";

alter table "public"."project_members" add constraint "project_members_pkey" PRIMARY KEY using index "project_members_pkey";

alter table "public"."project_message_read_status" add constraint "project_message_read_status_pkey" PRIMARY KEY using index "project_message_read_status_pkey";

alter table "public"."project_space_message_read_status" add constraint "project_space_message_read_status_pkey" PRIMARY KEY using index "project_space_message_read_status_pkey";

alter table "public"."room_keys" add constraint "room_keys_pkey" PRIMARY KEY using index "room_keys_pkey";

alter table "public"."room_message_read_status" add constraint "room_message_read_status_pkey" PRIMARY KEY using index "room_message_read_status_pkey";

alter table "public"."schedule_items" add constraint "schedule_items_pkey" PRIMARY KEY using index "schedule_items_pkey";

alter table "public"."shares" add constraint "shares_pkey" PRIMARY KEY using index "shares_pkey";

alter table "public"."shot_list" add constraint "shot_list_pkey" PRIMARY KEY using index "shot_list_pkey";

alter table "public"."user_activities" add constraint "user_activities_pkey" PRIMARY KEY using index "user_activities_pkey";

alter table "public"."user_settings" add constraint "user_settings_pkey" PRIMARY KEY using index "user_settings_pkey";

alter table "public"."budget_items" add constraint "budget_items_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.project_spaces(id) ON DELETE CASCADE not valid;

alter table "public"."budget_items" validate constraint "budget_items_project_id_fkey";

alter table "public"."call_participants" add constraint "call_participants_status_check" CHECK ((status = ANY (ARRAY['requesting'::text, 'joined'::text, 'left'::text]))) not valid;

alter table "public"."call_participants" validate constraint "call_participants_status_check";

alter table "public"."call_reactions" add constraint "call_reactions_call_id_fkey" FOREIGN KEY (call_id) REFERENCES public.calls(id) ON DELETE CASCADE not valid;

alter table "public"."call_reactions" validate constraint "call_reactions_call_id_fkey";

alter table "public"."call_reactions" add constraint "call_reactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."call_reactions" validate constraint "call_reactions_user_id_fkey";

alter table "public"."call_sheets" add constraint "call_sheets_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.project_spaces(id) ON DELETE CASCADE not valid;

alter table "public"."call_sheets" validate constraint "call_sheets_project_id_fkey";

alter table "public"."calls" add constraint "calls_daily_room_name_key" UNIQUE using index "calls_daily_room_name_key";

alter table "public"."calls" add constraint "calls_room_type_check" CHECK ((room_type = ANY (ARRAY['project'::text, 'discussion'::text, 'direct'::text]))) not valid;

alter table "public"."calls" validate constraint "calls_room_type_check";

alter table "public"."calls" add constraint "calls_started_by_fkey" FOREIGN KEY (started_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."calls" validate constraint "calls_started_by_fkey";

alter table "public"."files" add constraint "files_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.project_spaces(id) ON DELETE CASCADE not valid;

alter table "public"."files" validate constraint "files_project_id_fkey";

alter table "public"."files" add constraint "files_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."files" validate constraint "files_uploaded_by_fkey";

alter table "public"."gov_approval_queue" add constraint "gov_approval_queue_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."gov_approval_queue" validate constraint "gov_approval_queue_status_check";

alter table "public"."legal_docs" add constraint "legal_docs_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.project_spaces(id) ON DELETE CASCADE not valid;

alter table "public"."legal_docs" validate constraint "legal_docs_project_id_fkey";

alter table "public"."legal_docs" add constraint "legal_docs_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."legal_docs" validate constraint "legal_docs_uploaded_by_fkey";

alter table "public"."mentions" add constraint "mentions_mentioned_id_fkey" FOREIGN KEY (mentioned_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."mentions" validate constraint "mentions_mentioned_id_fkey";

alter table "public"."mentions" add constraint "mentions_mentioner_id_fkey" FOREIGN KEY (mentioner_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."mentions" validate constraint "mentions_mentioner_id_fkey";

alter table "public"."mentions" add constraint "mentions_related_type_check" CHECK ((related_type = ANY (ARRAY['post'::text, 'chat_message'::text]))) not valid;

alter table "public"."mentions" validate constraint "mentions_related_type_check";

alter table "public"."message_reactions" add constraint "message_reactions_message_id_fkey" FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE not valid;

alter table "public"."message_reactions" validate constraint "message_reactions_message_id_fkey";

alter table "public"."message_reactions" add constraint "message_reactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."message_reactions" validate constraint "message_reactions_user_id_fkey";

alter table "public"."messages" add constraint "messages_reply_to_id_fkey" FOREIGN KEY (reply_to_id) REFERENCES public.messages(id) ON DELETE SET NULL not valid;

alter table "public"."messages" validate constraint "messages_reply_to_id_fkey";

alter table "public"."notifications" add constraint "notifications_trigger_user_id_fkey" FOREIGN KEY (trigger_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."notifications" validate constraint "notifications_trigger_user_id_fkey";

alter table "public"."portfolio_items" add constraint "portfolio_items_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."portfolio_items" validate constraint "portfolio_items_user_id_fkey";

alter table "public"."post_comments" add constraint "comments_parent_comment_id_fkey" FOREIGN KEY (parent_comment_id) REFERENCES public.post_comments(id) ON DELETE CASCADE not valid;

alter table "public"."post_comments" validate constraint "comments_parent_comment_id_fkey";

alter table "public"."post_comments" add constraint "post_comments_user_id_fkey_profiles" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."post_comments" validate constraint "post_comments_user_id_fkey_profiles";

alter table "public"."posts" add constraint "posts_page_id_fkey" FOREIGN KEY (page_id) REFERENCES public.company_pages(id) ON DELETE SET NULL not valid;

alter table "public"."posts" validate constraint "posts_page_id_fkey";

alter table "public"."profile_views" add constraint "profile_views_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."profile_views" validate constraint "profile_views_profile_id_fkey";

alter table "public"."profile_views" add constraint "profile_views_viewer_id_fkey" FOREIGN KEY (viewer_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."profile_views" validate constraint "profile_views_viewer_id_fkey";

alter table "public"."profiles" add constraint "username_format" CHECK ((username ~ '^[a-z0-9_]{3,20}$'::text)) not valid;

alter table "public"."profiles" validate constraint "username_format";

alter table "public"."project_invites" add constraint "project_invites_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."project_invites" validate constraint "project_invites_created_by_fkey";

alter table "public"."project_invites" add constraint "project_invites_invite_code_key" UNIQUE using index "project_invites_invite_code_key";

alter table "public"."project_invites" add constraint "project_invites_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.project_spaces(id) ON DELETE CASCADE not valid;

alter table "public"."project_invites" validate constraint "project_invites_project_id_fkey";

alter table "public"."project_members" add constraint "project_members_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_members" validate constraint "project_members_project_id_fkey";

alter table "public"."project_members" add constraint "project_members_project_id_user_id_key" UNIQUE using index "project_members_project_id_user_id_key";

alter table "public"."project_members" add constraint "project_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."project_members" validate constraint "project_members_user_id_fkey";

alter table "public"."project_message_read_status" add constraint "project_message_read_status_project_space_id_fkey" FOREIGN KEY (project_space_id) REFERENCES public.project_spaces(id) ON DELETE CASCADE not valid;

alter table "public"."project_message_read_status" validate constraint "project_message_read_status_project_space_id_fkey";

alter table "public"."project_message_read_status" add constraint "project_message_read_status_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."project_message_read_status" validate constraint "project_message_read_status_user_id_fkey";

alter table "public"."project_space_join_requests" add constraint "unique_request_per_user" UNIQUE using index "unique_request_per_user";

alter table "public"."project_space_members" add constraint "project_space_members_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'moderator'::text, 'member'::text]))) not valid;

alter table "public"."project_space_members" validate constraint "project_space_members_role_check";

alter table "public"."project_space_message_read_status" add constraint "project_space_message_read_status_project_space_id_fkey" FOREIGN KEY (project_space_id) REFERENCES public.project_spaces(id) ON DELETE CASCADE not valid;

alter table "public"."project_space_message_read_status" validate constraint "project_space_message_read_status_project_space_id_fkey";

alter table "public"."project_space_message_read_status" add constraint "project_space_message_read_status_project_space_id_user_id_key" UNIQUE using index "project_space_message_read_status_project_space_id_user_id_key";

alter table "public"."project_space_message_read_status" add constraint "project_space_message_read_status_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."project_space_message_read_status" validate constraint "project_space_message_read_status_user_id_fkey";

alter table "public"."project_space_messages" add constraint "fk_psm_space_id" FOREIGN KEY (project_space_id) REFERENCES public.project_spaces(id) ON DELETE CASCADE not valid;

alter table "public"."project_space_messages" validate constraint "fk_psm_space_id";

alter table "public"."project_space_messages" add constraint "fk_psm_user_id" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."project_space_messages" validate constraint "fk_psm_user_id";

alter table "public"."project_spaces" add constraint "unique_space_per_project" UNIQUE using index "unique_space_per_project";

alter table "public"."room_keys" add constraint "room_keys_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."room_keys" validate constraint "room_keys_sender_id_fkey";

alter table "public"."room_keys" add constraint "room_keys_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."room_keys" validate constraint "room_keys_user_id_fkey";

alter table "public"."room_message_read_status" add constraint "room_message_read_status_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.discussion_rooms(id) ON DELETE CASCADE not valid;

alter table "public"."room_message_read_status" validate constraint "room_message_read_status_room_id_fkey";

alter table "public"."room_message_read_status" add constraint "room_message_read_status_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."room_message_read_status" validate constraint "room_message_read_status_user_id_fkey";

alter table "public"."room_messages" add constraint "room_messages_reply_to_id_fkey" FOREIGN KEY (reply_to_id) REFERENCES public.room_messages(id) ON DELETE SET NULL not valid;

alter table "public"."room_messages" validate constraint "room_messages_reply_to_id_fkey";

alter table "public"."schedule_items" add constraint "schedule_items_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."schedule_items" validate constraint "schedule_items_assigned_to_fkey";

alter table "public"."schedule_items" add constraint "schedule_items_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.project_spaces(id) ON DELETE CASCADE not valid;

alter table "public"."schedule_items" validate constraint "schedule_items_project_id_fkey";

alter table "public"."shares" add constraint "shares_post_id_fkey" FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE not valid;

alter table "public"."shares" validate constraint "shares_post_id_fkey";

alter table "public"."shares" add constraint "shares_post_id_user_id_key" UNIQUE using index "shares_post_id_user_id_key";

alter table "public"."shares" add constraint "shares_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."shares" validate constraint "shares_user_id_fkey";

alter table "public"."shot_list" add constraint "shot_list_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public.project_spaces(id) ON DELETE CASCADE not valid;

alter table "public"."shot_list" validate constraint "shot_list_project_id_fkey";

alter table "public"."user_activities" add constraint "user_activities_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."user_activities" validate constraint "user_activities_user_id_fkey";

alter table "public"."user_settings" add constraint "user_settings_allow_messages_from_check" CHECK (((allow_messages_from)::text = ANY ((ARRAY['everyone'::character varying, 'connections'::character varying, 'nobody'::character varying])::text[]))) not valid;

alter table "public"."user_settings" validate constraint "user_settings_allow_messages_from_check";

alter table "public"."user_settings" add constraint "user_settings_font_size_check" CHECK (((font_size)::text = ANY ((ARRAY['small'::character varying, 'medium'::character varying, 'large'::character varying])::text[]))) not valid;

alter table "public"."user_settings" validate constraint "user_settings_font_size_check";

alter table "public"."user_settings" add constraint "user_settings_profile_visibility_check" CHECK (((profile_visibility)::text = ANY ((ARRAY['public'::character varying, 'connections'::character varying, 'private'::character varying])::text[]))) not valid;

alter table "public"."user_settings" validate constraint "user_settings_profile_visibility_check";

alter table "public"."user_settings" add constraint "user_settings_theme_check" CHECK (((theme)::text = ANY ((ARRAY['light'::character varying, 'dark'::character varying, 'system'::character varying])::text[]))) not valid;

alter table "public"."user_settings" validate constraint "user_settings_theme_check";

alter table "public"."user_settings" add constraint "user_settings_user_id_key" UNIQUE using index "user_settings_user_id_key";

alter table "public"."audit_logs" add constraint "audit_logs_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."audit_logs" validate constraint "audit_logs_actor_id_fkey";

alter table "public"."call_participants" add constraint "call_participants_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."call_participants" validate constraint "call_participants_user_id_fkey";

alter table "public"."conversations" add constraint "conversations_user1_id_fkey" FOREIGN KEY (user1_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."conversations" validate constraint "conversations_user1_id_fkey";

alter table "public"."conversations" add constraint "conversations_user2_id_fkey" FOREIGN KEY (user2_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."conversations" validate constraint "conversations_user2_id_fkey";

alter table "public"."discussion_rooms" add constraint "discussion_rooms_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."discussion_rooms" validate constraint "discussion_rooms_creator_id_fkey";

alter table "public"."gov_approval_queue" add constraint "gov_approval_queue_maker_id_fkey" FOREIGN KEY (maker_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."gov_approval_queue" validate constraint "gov_approval_queue_maker_id_fkey";

alter table "public"."messages" add constraint "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."messages" validate constraint "messages_sender_id_fkey";

alter table "public"."project_space_bookmarks" add constraint "project_space_bookmarks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."project_space_bookmarks" validate constraint "project_space_bookmarks_user_id_fkey";

alter table "public"."project_space_messages" add constraint "project_space_messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."project_space_messages" validate constraint "project_space_messages_user_id_fkey";

alter table "public"."project_spaces" add constraint "project_spaces_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."project_spaces" validate constraint "project_spaces_creator_id_fkey";

alter table "public"."room_join_requests" add constraint "room_join_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."room_join_requests" validate constraint "room_join_requests_user_id_fkey";

alter table "public"."room_members" add constraint "room_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."room_members" validate constraint "room_members_user_id_fkey";

alter table "public"."tasks" add constraint "tasks_assignee_id_fkey" FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."tasks" validate constraint "tasks_assignee_id_fkey";

alter table "public"."user_analytics" add constraint "user_analytics_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."user_analytics" validate constraint "user_analytics_user_id_fkey";

alter table "public"."user_connections" add constraint "user_connections_follower_id_fkey" FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_connections" validate constraint "user_connections_follower_id_fkey";

alter table "public"."user_connections" add constraint "user_connections_following_id_fkey" FOREIGN KEY (following_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_connections" validate constraint "user_connections_following_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.approve_join_request(_request_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    _user_id UUID;
    _space_id UUID;
BEGIN
    -- Get Request Details
    SELECT user_id, project_space_id INTO _user_id, _space_id
    FROM public.project_space_join_requests
    WHERE id = _request_id;

    IF _user_id IS NULL THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    -- Verify Permissions (Caller must be Creator)
    IF NOT public.is_project_creator(_space_id) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- 1. Update Request Status
    UPDATE public.project_space_join_requests
    SET status = 'approved'
    WHERE id = _request_id;

    -- 2. Add to Members (Idempotent insert)
    INSERT INTO public.project_space_members (project_space_id, user_id, role)
    VALUES (_space_id, _user_id, 'member')
    ON CONFLICT (project_space_id, user_id) DO NOTHING;

    RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_default_user_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_discussion_room_with_creator(c_id uuid, cat_id uuid, room_title text, room_description text, type text, room_tags text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    new_room_id UUID;
BEGIN
    -- 1. Insert the new room
    -- Set 'name' AND 'title'
    INSERT INTO public.discussion_rooms (
        title,
        name, 
        description,
        category_id,
        room_type,
        creator_id
    ) VALUES (
        room_title,
        room_title, -- Populate name with title
        room_description,
        cat_id,
        type,
        c_id
    ) RETURNING id INTO new_room_id;

    -- 2. Add the creator as a member automatically
    -- The error claimed 'role' didn't exist, so we added it above.
    INSERT INTO public.room_members (
        room_id,
        user_id,
        role
    ) VALUES (
        new_room_id,
        c_id,
        'moderator'
    );

    RETURN new_room_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_aggregated_film_ratings(tmdb_ids integer[])
 RETURNS TABLE(tmdb_id integer, average_rating numeric, review_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        ufr.tmdb_id,
        AVG(ufr.rating)::numeric as average_rating,
        COUNT(*) as review_count
    FROM 
        public.user_film_ratings ufr
    WHERE 
        ufr.tmdb_id = ANY(tmdb_ids)
    GROUP BY 
        ufr.tmdb_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_home_feed_data(user_id_param uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'posts', (
            SELECT jsonb_agg(t) FROM (
                SELECT p.*, 
                    jsonb_build_object(
                        'id', pr.id,
                        'full_name', pr.full_name,
                        'username', pr.username,
                        'avatar_url', pr.avatar_url,
                        'craft', pr.craft
                    ) as profiles
                FROM public.posts p
                LEFT JOIN public.profiles pr ON p.author_id = pr.id
                ORDER BY p.created_at DESC
                LIMIT 20
            ) t
        ),
        'announcements', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT * FROM public.announcements
                ORDER BY posted_at DESC
                LIMIT 5
            ) t
        ),
        'projects', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT p.*, 
                    jsonb_build_object(
                        'full_name', pr.full_name,
                        'avatar_url', pr.avatar_url
                    ) as creator
                FROM public.projects p
                LEFT JOIN public.profiles pr ON p.creator_id = pr.id
                ORDER BY p.created_at DESC
                LIMIT 5
            ) t
        ),
        'discussions', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT * FROM public.discussion_rooms
                ORDER BY created_at DESC
                LIMIT 5
            ) t
        ),
        'marketplace', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT * FROM public.marketplace_listings
                ORDER BY created_at DESC
                LIMIT 5
            ) t
        ),
        'vendors', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT * FROM public.vendors
                ORDER BY created_at DESC
                LIMIT 5
            ) t
        ),
        'connections', (
            SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                SELECT id, full_name, username, avatar_url, craft, bio 
                FROM public.profiles
                WHERE id != user_id_param
                ORDER BY updated_at DESC
                LIMIT 6
            ) t
        ),
        'likedPostIds', (
            SELECT COALESCE(jsonb_agg(post_id), '[]'::jsonb) 
            FROM public.post_likes 
            WHERE user_id = user_id_param
        )
    ) INTO result;

    RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_marketplace_listings_optimized(search_query text DEFAULT NULL::text, filter_type text DEFAULT NULL::text, filter_category text DEFAULT NULL::text, filter_location text DEFAULT NULL::text, min_price numeric DEFAULT NULL::numeric, max_price numeric DEFAULT NULL::numeric)
 RETURNS TABLE(id uuid, title text, description text, price numeric, price_unit text, type text, category text, location text, images text[], specifications jsonb, availability_calendar jsonb, created_at timestamp with time zone, updated_at timestamp with time zone, user_id uuid, profile_data jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.title,
        m.description,
        m.price,
        m.price_unit,
        m.type,
        m.category,
        m.location,
        m.images,
        m.specifications,
        m.availability_calendar,
        m.created_at,
        m.updated_at,
        m.user_id,
        jsonb_build_object(
            'username', p.username,
            'full_name', p.full_name,
            'avatar_url', p.avatar_url
        ) AS profile_data
    FROM public.marketplace_listings m
    JOIN public.profiles p ON m.user_id = p.id
    WHERE 
        m.is_active = true
        AND (filter_type IS NULL OR m.type = filter_type)
        AND (filter_category IS NULL OR m.category = filter_category)
        AND (filter_location IS NULL OR m.location ILIKE '%' || filter_location || '%')
        AND (min_price IS NULL OR m.price >= min_price)
        AND (max_price IS NULL OR m.price <= max_price)
        AND (
            search_query IS NULL 
            OR m.title ILIKE '%' || search_query || '%'
            OR m.description ILIKE '%' || search_query || '%'
        )
    ORDER BY m.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_messages_for_channel(p_channel_id text)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, sender_id uuid, sender_profile jsonb, reply_to_id uuid, is_deleted boolean, deleted_for_users uuid[], is_read boolean, replied_to_message jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        dm.id, 
        dm.content, 
        dm.created_at, 
        dm.sender_id, 
        jsonb_build_object(
            'full_name', p.full_name, 
            'avatar_url', p.avatar_url
        ) AS sender_profile,
        dm.reply_to_id,
        dm.is_deleted,
        dm.deleted_for_users,
        dm.is_read,
        (
            SELECT jsonb_build_object(
                'id', rd.id,
                'content', rd.content,
                'is_deleted', rd.is_deleted,
                'sender_profile', jsonb_build_object(
                    'full_name', rp.full_name,
                    'avatar_url', rp.avatar_url
                )
            )
            FROM direct_messages rd
            JOIN profiles rp ON rd.sender_id = rp.id
            WHERE rd.id = dm.reply_to_id
        ) AS replied_to_message
    FROM direct_messages dm
    JOIN profiles p ON dm.sender_id = p.id
    WHERE dm.channel_id = p_channel_id
    ORDER BY dm.created_at ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_total_unread_count()
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_total bigint := 0;
BEGIN
    -- 1. Direct Messages
    SELECT count(*) INTO v_total
    FROM public.direct_messages
    WHERE receiver_id = auth.uid() AND (is_read = false OR is_read IS NULL);

    -- 2. Project Room Messages
    v_total := v_total + (
        SELECT count(*)
        FROM public.project_space_messages pm
        JOIN public.project_space_members psm ON pm.project_space_id = psm.project_space_id
        LEFT JOIN public.project_message_read_status rs ON pm.project_space_id = rs.project_space_id AND rs.user_id = auth.uid()
        WHERE psm.user_id = auth.uid() 
        AND pm.user_id != auth.uid()
        AND (rs.last_read_at IS NULL OR pm.created_at > rs.last_read_at)
        AND pm.created_at > (NOW() - INTERVAL '7 days')
    );

    -- 3. Discussion Room Messages
    v_total := v_total + (
        SELECT count(*)
        FROM public.room_messages rm
        JOIN public.room_members drm ON rm.room_id = drm.room_id
        LEFT JOIN public.room_message_read_status rs ON rm.room_id = rs.room_id AND rs.user_id = auth.uid()
        WHERE drm.user_id = auth.uid()
        AND rm.user_id != auth.uid()
        AND (rs.last_read_at IS NULL OR rm.created_at > rs.last_read_at)
        AND rm.created_at > (NOW() - INTERVAL '7 days')
    );

    RETURN v_total;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_unread_message_previews(limit_count integer DEFAULT 10)
 RETURNS TABLE(sender_id uuid, sender_name text, sender_avatar text, last_message text, unread_count bigint, last_timestamp timestamp with time zone, chat_type text, context_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
    BEGIN
        RETURN QUERY
        WITH all_unread AS (
            -- DMs
            SELECT 
                dm.sender_id AS s_id,
                COALESCE(p.full_name, p.username, 'User') AS s_name,
                p.avatar_url AS s_avatar,
                dm.content AS msg,
                dm.created_at AS ts,
                'dm' AS type,
                dm.sender_id AS c_id
            FROM public.direct_messages dm
            LEFT JOIN public.profiles p ON dm.sender_id = p.id
            WHERE dm.receiver_id = auth.uid() AND (dm.is_read = false OR dm.is_read IS NULL)

            UNION ALL

            -- Project Messages (Updated to project_space_id)
            SELECT 
                pr.id AS s_id,
                pr.title AS s_name,
                NULL::text AS s_avatar,
                pm.content AS msg,
                pm.created_at AS ts,
                'project' AS type,
                pr.id AS c_id
            FROM public.project_space_messages pm
            JOIN public.project_spaces ps ON pm.project_space_id = ps.id
            JOIN public.projects pr ON ps.project_id = pr.id
            JOIN public.project_space_members psm ON ps.id = psm.project_space_id
            LEFT JOIN public.project_message_read_status rs ON ps.id = rs.project_space_id AND rs.user_id = auth.uid()
            WHERE psm.user_id = auth.uid()
            AND pm.user_id != auth.uid()
            AND (rs.last_read_at IS NULL OR pm.created_at > rs.last_read_at)
            AND pm.created_at > (NOW() - INTERVAL '7 days')

            UNION ALL

            -- Discussion Room Messages
            SELECT 
                dr.id AS s_id,
                dr.title AS s_name,
                NULL::text AS s_avatar,
                rm.content AS msg,
                rm.created_at AS ts,
                'discussion' AS type,
                dr.id AS c_id
            FROM public.room_messages rm
            JOIN public.discussion_rooms dr ON rm.room_id = dr.id
            JOIN public.room_members drm ON dr.id = drm.room_id
            LEFT JOIN public.room_message_read_status rs ON dr.id = rs.room_id AND rs.user_id = auth.uid()
            WHERE drm.user_id = auth.uid()
            AND rm.user_id != auth.uid()
            AND (rs.last_read_at IS NULL OR rm.created_at > rs.last_read_at)
            AND rm.created_at > (NOW() - INTERVAL '7 days')
        )
        SELECT 
            u.s_id AS sender_id,
            u.s_name AS sender_name,
            u.s_avatar AS sender_avatar,
            (array_agg(u.msg ORDER BY u.ts DESC))[1] AS last_message,
            COUNT(*) AS unread_count,
            MAX(u.ts) AS last_timestamp,
            u.type AS chat_type,
            u.c_id AS context_id
        FROM all_unread u
        GROUP BY u.s_id, u.s_name, u.s_avatar, u.type, u.c_id
        ORDER BY last_timestamp DESC
        LIMIT limit_count;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.get_user_conversations_with_profiles(p_user_id uuid)
 RETURNS TABLE(other_user_id uuid, other_user_full_name text, other_user_avatar_url text, last_message_content text, last_message_created_at timestamp with time zone, unread_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    WITH latest_messages AS (
        SELECT DISTINCT ON (
            LEAST(sender_id, receiver_id),
            GREATEST(sender_id, receiver_id)
        )
            id, sender_id, receiver_id, content, created_at
        FROM direct_messages
        WHERE sender_id = p_user_id OR receiver_id = p_user_id
        ORDER BY
            LEAST(sender_id, receiver_id),
            GREATEST(sender_id, receiver_id),
            created_at DESC
    ),
    unread_counts AS (
        SELECT sender_id, COUNT(*) as count
        FROM direct_messages
        WHERE receiver_id = p_user_id AND is_read = false
        GROUP BY sender_id
    )
    SELECT
        CASE
            WHEN lm.sender_id = p_user_id THEN lm.receiver_id
            ELSE lm.sender_id
        END AS other_user_id,
        p.full_name AS other_user_full_name,
        p.avatar_url AS other_user_avatar_url,
        lm.content AS last_message_content,
        lm.created_at AS last_message_created_at,
        COALESCE(uc.count, 0) AS unread_count
    FROM latest_messages lm
    JOIN profiles p ON p.id = (
        CASE
            WHEN lm.sender_id = p_user_id THEN lm.receiver_id
            ELSE lm.sender_id
        END
    )
    LEFT JOIN unread_counts uc ON uc.sender_id = (
        CASE
            WHEN lm.sender_id = p_user_id THEN lm.receiver_id
            ELSE lm.sender_id
        END
    )
    ORDER BY lm.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_message_threads(p_user_id uuid)
 RETURNS TABLE(id uuid, last_message jsonb, participants jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    WITH ranked_messages AS (
        SELECT 
            DISTINCT ON (
                CASE WHEN sender_id = p_user_id THEN receiver_id ELSE sender_id END
            )
            m.id,
            m.sender_id,
            m.receiver_id,
            m.content,
            m.created_at,
            CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END as other_user_id
        FROM direct_messages m
        WHERE m.sender_id = p_user_id OR m.receiver_id = p_user_id
        ORDER BY 
            CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END,
            m.created_at DESC
    )
    SELECT 
        rm.other_user_id as id,
        jsonb_build_object(
            'content', rm.content,
            'created_at', rm.created_at
        ) as last_message,
        jsonb_build_array(
            jsonb_build_object(
                'profiles', jsonb_build_object(
                    'id', p.id,
                    'full_name', p.full_name,
                    'avatar_url', p.avatar_url
                )
            )
        ) as participants
    FROM ranked_messages rm
    JOIN profiles p ON p.id = rm.other_user_id
    ORDER BY rm.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_unread_messages()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    BEGIN
        -- 1. Direct Messages
        IF EXISTS (
            SELECT 1 FROM public.direct_messages
            WHERE receiver_id = auth.uid() AND (is_read = false OR is_read IS NULL)
        ) THEN
            RETURN true;
        END IF;

        -- 2. Project Room Messages (Updated to project_space_id)
        IF EXISTS (
            SELECT 1 FROM public.project_space_messages pm
            JOIN public.project_space_members psm ON pm.project_space_id = psm.project_space_id
            LEFT JOIN public.project_message_read_status rs ON pm.project_space_id = rs.project_space_id AND rs.user_id = auth.uid()
            WHERE psm.user_id = auth.uid() 
            AND pm.user_id != auth.uid()
            AND (rs.last_read_at IS NULL OR pm.created_at > rs.last_read_at)
            AND pm.created_at > (NOW() - INTERVAL '7 days')
        ) THEN
            RETURN true;
        END IF;

        -- 3. Discussion Room Messages
        IF EXISTS (
            SELECT 1 FROM public.room_messages rm
            JOIN public.room_members drm ON rm.room_id = drm.room_id
            LEFT JOIN public.room_message_read_status rs ON rm.room_id = rs.room_id AND rs.user_id = auth.uid()
            WHERE drm.user_id = auth.uid()
            AND rm.user_id != auth.uid()
            AND (rs.last_read_at IS NULL OR rm.created_at > rs.last_read_at)
            AND rm.created_at > (NOW() - INTERVAL '7 days')
        ) THEN
            RETURN true;
        END IF;

        RETURN FALSE;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.hide_message_for_user(p_table text, p_message_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Only allow hiding from known chat tables
    IF p_table NOT IN ('direct_messages', 'room_messages', 'project_messages', 'project_space_messages') THEN
        RAISE EXCEPTION 'Invalid table';
    END IF;

    -- Security Check: Ensure user is involved in the message
    -- For simplicity, we trust the table checks below or the user's role 
    -- But ideally we'd check if auth.uid() is sender or recipient here.
    
    EXECUTE format('
        UPDATE %I 
        SET deleted_for_users = array_append(COALESCE(deleted_for_users, ''{}''), auth.uid())
        WHERE id = $1 
        AND NOT (auth.uid() = ANY(COALESCE(deleted_for_users, ''{}'')))
    ', p_table) USING p_message_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_member_of_room(_room_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_members 
    WHERE room_id = _room_id AND user_id = (select auth.uid())
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_room_member(_room_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.room_members
    WHERE room_id = _room_id
    AND user_id = auth.uid()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_message_as_seen(p_message_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_channel_id text;
    v_created_at timestamptz;
BEGIN
    -- Get the details of the message being marked as seen
    SELECT channel_id, created_at INTO v_channel_id, v_created_at
    FROM direct_messages
    WHERE id = p_message_id;

    -- Update THIS message and ALL EARLIER messages in this thread
    -- Only if they belong to the current user (receiver)
    UPDATE direct_messages
    SET is_read = true
    WHERE channel_id = v_channel_id
    AND receiver_id = auth.uid()
    AND created_at <= v_created_at
    AND (is_read = false OR is_read IS NULL);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_project_message_as_seen(p_message_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    DECLARE
        v_space_id uuid;
        v_created_at timestamptz;
    BEGIN
        SELECT project_space_id, created_at INTO v_space_id, v_created_at
        FROM project_space_messages
        WHERE id = p_message_id;

        INSERT INTO public.project_message_read_status (project_space_id, user_id, last_read_at)
        VALUES (v_space_id, auth.uid(), v_created_at)
        ON CONFLICT (project_space_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
        WHERE EXCLUDED.last_read_at > project_message_read_status.last_read_at;
    END;
    $function$
;

CREATE OR REPLACE FUNCTION public.mark_room_message_as_seen(p_message_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_room_id uuid;
    v_created_at timestamptz;
BEGIN
    SELECT room_id, created_at INTO v_room_id, v_created_at
    FROM room_messages
    WHERE id = p_message_id;

    -- Update the overall group read status for this user
    INSERT INTO public.room_message_read_status (room_id, user_id, last_read_at)
    VALUES (v_room_id, auth.uid(), v_created_at)
    ON CONFLICT (room_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
    WHERE EXCLUDED.last_read_at > room_message_read_status.last_read_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_post_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    post_author uuid;
    trigger_name text;
BEGIN
    SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
    
    IF post_author = NEW.user_id THEN
        RETURN NEW;
    END IF;

    SELECT full_name INTO trigger_name FROM public.profiles WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (
        post_author, 
        NEW.user_id, 
        'social', 
        trigger_name || ' commented on your post', 
        NEW.content, 
        '/feed', 
        NEW.post_id
    );
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_post_like()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    post_author uuid;
    post_content text;
    trigger_name text;
BEGIN
    -- Get post author and content
    SELECT author_id, content INTO post_author, post_content FROM public.posts WHERE id = NEW.post_id;
    
    -- Don't notify if liking own post
    IF post_author = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Get trigger user name
    SELECT full_name INTO trigger_name FROM public.profiles WHERE id = NEW.user_id;

    -- Insert central notification
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (
        post_author, 
        NEW.user_id, 
        'social', 
        trigger_name || ' liked your post', 
        '"' || substring(post_content from 1 for 40) || '..."', 
        '/feed', 
        NEW.post_id
    );
    
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_join_request(_request_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    _space_id UUID;
BEGIN
    SELECT project_space_id INTO _space_id
    FROM public.project_space_join_requests
    WHERE id = _request_id;

    IF _space_id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;

    IF NOT public.is_project_creator(_space_id) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    UPDATE public.project_space_join_requests
    SET status = 'rejected'
    WHERE id = _request_id;

    RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.start_call(p_room_id text, p_created_by uuid, p_call_type text DEFAULT 'video'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    new_call_id UUID;
    result JSONB;
    r_type TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM public.project_spaces WHERE id::TEXT = p_room_id) THEN
        r_type := 'project';
    ELSIF EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id::TEXT = p_room_id) THEN
         r_type := 'discussion';
    ELSE
         r_type := 'direct';
    END IF;

    INSERT INTO public.calls (room_type, room_id, daily_room_name, daily_room_url, started_by, status)
    VALUES (r_type, p_room_id, 'native-' || p_room_id || '-' || extract(epoch from now()), 'native', p_created_by, 'active')
    RETURNING id INTO new_call_id;

    INSERT INTO public.call_participants (call_id, user_id, status)
    VALUES (new_call_id, p_created_by, 'joined');

    SELECT jsonb_build_object('id', c.id, 'room_id', c.room_id, 'status', c.status) INTO result
    FROM public.calls c WHERE c.id = new_call_id;
    RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.start_call(room_id uuid, created_by uuid, call_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    new_call_id UUID;
    result JSONB;
    room_type TEXT;
BEGIN
    -- Determine room type based on where the room_id exists
    IF EXISTS (SELECT 1 FROM public.project_spaces WHERE id = room_id) THEN
        room_type := 'project';
    ELSIF EXISTS (SELECT 1 FROM public.discussion_rooms WHERE id = room_id) THEN
         room_type := 'discussion';
    ELSE
         RAISE EXCEPTION 'Invalid room ID';
    END IF;

    -- Insert new call
    INSERT INTO public.calls (room_type, room_id, daily_room_name, daily_room_url, started_by, status)
    VALUES (
        room_type, 
        room_id, 
        'native-' || room_id || '-' || extract(epoch from now()), -- Dummy value for unused columns
        'native', -- Dummy value
        created_by, 
        'active'
    )
    RETURNING id INTO new_call_id;

    -- Add creator as participant
    INSERT INTO public.call_participants (call_id, user_id, status)
    VALUES (new_call_id, created_by, 'joined');

    -- Return the created call object
    SELECT jsonb_build_object(
        'id', c.id,
        'room_id', c.room_id,
        'room_type', c.room_type,
        'started_by', c.started_by,
        'status', c.status,
        'created_at', c.created_at
    ) INTO result
    FROM public.calls c
    WHERE c.id = new_call_id;

    RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trigger_push_delivery()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    PERFORM net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/push-delivery',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key')
        ),
        body := jsonb_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA,
            'record', row_to_json(NEW)
        )
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors to prevent blocking the transaction
    RETURN NEW;
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
        UPDATE public.discussion_rooms 
        SET member_count = (
            SELECT COUNT(*) FROM public.room_members WHERE room_id = NEW.room_id
        )
        WHERE id = NEW.room_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.discussion_rooms 
        SET member_count = (
            SELECT COUNT(*) FROM public.room_members WHERE room_id = OLD.room_id
        )
        WHERE id = OLD.room_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_token_last_seen()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.last_seen = NOW();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_user_settings_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_verification(_request_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT user_id INTO v_user_id FROM public.verification_requests WHERE id = _request_id;

  UPDATE public.verification_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _request_id;

  UPDATE public.profiles
  SET is_verified = true, trust_score = trust_score + 20
  WHERE id = v_user_id;

  PERFORM public.send_governance_notification(v_user_id, 'verify_approve');

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (auth.uid(), 'admin', 'approve_verification', 'verification_request', _request_id::text);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.assign_user_role(_user_id uuid, _role public.app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.has_role('super_admin'::public.app_role, auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can assign roles';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  PERFORM public.send_governance_notification(_user_id, 'role_assign', _role::text);

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin', 'assign_role', 'user', _user_id::text, jsonb_build_object('role', _role));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.audit_economics_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    NEW.updated_by, 
    'super_admin', 
    'update_economics', 
    'system', 
    'economics', 
    jsonb_build_object('old', OLD.value, 'new', NEW.value)
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.auto_add_page_owner_as_admin()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO company_page_admins (page_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'super_admin')
  ON CONFLICT (page_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ban_user(_target_user_id uuid, _reason text, _ban_type text DEFAULT 'permanent'::text, _expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Permission Check
  IF NOT (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  -- Record the ban
  INSERT INTO public.user_bans (user_id, banned_by, reason, ban_type, expires_at, is_active)
  VALUES (_target_user_id, auth.uid(), _reason, _ban_type, _expires_at, true);
  
  -- Flag the profile
  UPDATE public.profiles SET is_banned = true WHERE id = _target_user_id;
  
  -- Notify the user
  PERFORM public.send_governance_notification(_target_user_id, 'ban', _reason);
  
  -- Audit the action
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(), 
    CASE WHEN public.has_role('super_admin'::public.app_role, auth.uid()) THEN 'super_admin' ELSE 'admin' END,
    'ban_user', 'user', _target_user_id::text,
    jsonb_build_object('reason', _reason, 'ban_type', _ban_type)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_is_project_creator(_project_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = _project_id 
    AND creator_id = auth.uid()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_is_project_member(_project_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_space_members
    WHERE project_space_id = _project_id
    AND user_id = auth.uid()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_admin_access()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'super_admin'::public.app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin'::public.app_role;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.force_logout_user(_user_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles 
  SET sessions_revoked_at = now()
  WHERE id = _user_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'force_logout', 'user', _user_id::text, jsonb_build_object('reason', _reason));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.force_password_reset_user(_user_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles 
  SET force_password_reset = true
  WHERE id = _user_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'force_password_reset', 'user', _user_id::text, jsonb_build_object('reason', _reason));

  PERFORM public.send_governance_notification(_user_id, 'governance_update', 'A password reset has been required for your account security.');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.format_notification_message(content text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
  share_type TEXT;
BEGIN
  IF content IS NULL THEN
    RETURN 'Sent an attachment';
  END IF;

  -- Decode premium shared items (e.g. POST_SHARE::JSON)
  IF content LIKE '%_SHARE::%' THEN
    share_type := LOWER(SPLIT_PART(content, '_SHARE::', 1));
    CASE share_type
      WHEN 'post' THEN RETURN 'Shared a post';
      WHEN 'marketplace' THEN RETURN 'Shared a marketplace listing';
      WHEN 'announcement' THEN RETURN 'Shared an announcement';
      WHEN 'vendor' THEN RETURN 'Shared a vendor profile';
      WHEN 'project' THEN RETURN 'Shared a project';
      WHEN 'discussion' THEN RETURN 'Shared a discussion room';
      WHEN 'job' THEN RETURN 'Shared a job';
      WHEN 'craft' THEN RETURN 'Shared a craft';
      WHEN 'profile' THEN RETURN 'Shared a profile';
      ELSE RETURN 'Shared a ' || share_type;
    END CASE;
  END IF;

  -- Decode markdown photos
  IF content LIKE '![%' AND content LIKE '%]%' THEN
    RETURN 'Photo';
  END IF;

  -- Default message body
  RETURN content;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_active_sessions bigint;
  v_fraud_alerts bigint;
  v_pending_support bigint;
  v_revenue_mtd numeric;
BEGIN
  -- Check permissions
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Active Sessions (Estimated by profiles updated in last 1 hour)
  SELECT count(*) INTO v_active_sessions FROM public.profiles WHERE updated_at > now() - interval '1 hour';
  
  -- Fraud Alerts
  SELECT count(*) INTO v_fraud_alerts FROM public.content_reports WHERE reason = 'fraud' AND status = 'pending';
  
  -- Pending Support
  SELECT count(*) INTO v_pending_support FROM public.support_tickets WHERE status = 'open';
  
  -- Revenue (Stubbed for now, or sum from transactions if exists)
  v_revenue_mtd := 42800.50; -- Default placeholder until billing engine is connected

  RETURN jsonb_build_object(
    'active_sessions', v_active_sessions,
    'fraud_alerts', v_fraud_alerts,
    'pending_support', v_pending_support,
    'revenue_mtd', v_revenue_mtd
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_listing_with_rating(listing_uuid uuid)
 RETURNS TABLE(id uuid, user_id uuid, listing_type public.listing_type, title text, description text, category text, price_per_day numeric, price_per_week numeric, location text, images text[], specifications jsonb, availability_calendar jsonb, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, average_rating numeric, review_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ml.*,
    COALESCE(AVG(mr.rating), 0)::NUMERIC as average_rating,
    COUNT(mr.id) as review_count
  FROM marketplace_listings ml
  LEFT JOIN marketplace_reviews mr ON ml.id = mr.listing_id
  WHERE ml.id = listing_uuid
  GROUP BY ml.id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_messages_for_channel_paginated(p_channel_id text, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, sender_id uuid, sender_profile jsonb, reply_to_id uuid, is_deleted boolean, deleted_for_users uuid[], is_read boolean, replied_to_message jsonb, attachment_url text, attachment_type text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        dm.id, 
        dm.content, 
        dm.created_at, 
        dm.sender_id, 
        jsonb_build_object(
            'full_name', p.full_name, 
            'avatar_url', p.avatar_url
        ) AS sender_profile,
        dm.reply_to_id,
        dm.is_deleted,
        dm.deleted_for_users,
        dm.is_read,
        (
            SELECT jsonb_build_object(
                'id', rd.id,
                'content', rd.content,
                'is_deleted', rd.is_deleted,
                'sender_profile', jsonb_build_object(
                    'full_name', rp.full_name,
                    'avatar_url', rp.avatar_url
                )
            )
            FROM direct_messages rd
            JOIN profiles rp ON rd.sender_id = rp.id
            WHERE rd.id = dm.reply_to_id
        ) AS replied_to_message,
        dm.attachment_url,
        dm.attachment_type
    FROM direct_messages dm
    JOIN profiles p ON dm.sender_id = p.id
    WHERE dm.channel_id = p_channel_id
    ORDER BY dm.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_platform_economics()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_total_gmv numeric;
  v_commission_rate int;
  v_payout_status text;
  v_settings jsonb;
BEGIN
  -- Fetch settings
  SELECT value INTO v_settings FROM public.platform_settings WHERE key = 'economics';
  v_commission_rate := (v_settings->>'commission_rate')::int;
  v_payout_status := v_settings->>'payout_schedule';

  -- Calculate GMV (Sum of all active marketplace listing prices as a proxy for potential GMV, 
  -- or ideally from a transactions table if we had one. Let's use a dummy calculation for now 
  -- that scales with platform usage to make it look alive)
  SELECT COALESCE(SUM(price_per_day), 0) INTO v_total_gmv 
  FROM public.marketplace_listings 
  WHERE is_active = true;

  -- Return aggregated data
  RETURN jsonb_build_object(
    'total_gmv', v_total_gmv,
    'commission_rate', v_commission_rate,
    'payout_status', v_payout_status,
    'last_updated', now()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_vendor_with_rating(vendor_uuid uuid)
 RETURNS TABLE(id uuid, owner_id uuid, business_name text, description text, category text[], services_offered text[], location text, address text, phone text, email text, website text, logo_url text, images text[], is_verified boolean, verification_date timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, average_rating numeric, review_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    v.*,
    COALESCE(AVG(mr.rating), 0)::NUMERIC as average_rating,
    COUNT(mr.id) as review_count
  FROM vendors v
  LEFT JOIN marketplace_reviews mr ON v.id = mr.vendor_id
  WHERE v.id = vendor_uuid
  GROUP BY v.id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  raw_username TEXT;
  clean_username TEXT;
BEGIN
  -- 1. Extract provided username from metadata
  raw_username := COALESCE(
    new.raw_user_meta_data->>'username', 
    new.raw_user_meta_data->>'user_name'
  );

  -- 2. If a username was supplied, check if it matches the format
  IF raw_username IS NOT NULL AND raw_username ~ '^[a-z0-9_]{3,20}$' THEN
    clean_username := raw_username;
  ELSE
    -- If not supplied or invalid format, generate a clean fallback from the email or supplied username
    raw_username := COALESCE(raw_username, split_part(new.email, '@', 1));
    -- Convert to lowercase, strip all non-alphanumeric and non-underscore characters
    clean_username := lower(regexp_replace(raw_username, '[^a-zA-Z0-9_]', '', 'g'));
    
    -- Enforce minimum length of 3 by padding if necessary
    IF length(clean_username) < 3 THEN
      clean_username := clean_username || 'usr';
    END IF;
    
    -- Truncate to 15 characters to leave room for our unique random suffix
    IF length(clean_username) > 15 THEN
      clean_username := substring(clean_username from 1 for 15);
    END IF;
    
    -- Append a random number suffix to guarantee uniqueness
    clean_username := clean_username || '_' || floor(random() * 1000)::text;
    
    -- Enforce maximum length of 20 characters
    clean_username := substring(clean_username from 1 for 20);
  END IF;

  -- 3. Perform profile insert with the hardened username
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    new.id, 
    clean_username,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'display_name',
      'New User'
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;
  
  -- Create default user settings
  INSERT INTO public.user_settings (user_id) VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role, _user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_current_user_internal()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'moderator', 'super_admin')
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_member_of_project(_project_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_space_members 
    WHERE project_space_id = _project_id AND user_id = (select auth.uid())
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_project_creator(_project_space_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.project_spaces ps
    JOIN public.projects p ON ps.project_id = p.id
    WHERE ps.id = _project_space_id 
    AND p.creator_id = auth.uid()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_project_member(_project_space_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.project_space_members 
    WHERE project_space_id = _project_space_id 
    AND user_id = auth.uid()
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.lift_ban(_target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Permission Check
  IF NOT (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  -- Deactivate active bans
  UPDATE public.user_bans
  SET is_active = false, lifted_at = now(), lifted_by = auth.uid()
  WHERE user_id = _target_user_id AND is_active = true;
  
  -- Unflag the profile
  UPDATE public.profiles SET is_banned = false WHERE id = _target_user_id;
  
  -- Notify the user
  PERFORM public.send_governance_notification(_target_user_id, 'governance', 'Access Restored: Your account has been reinstated.');
  
  -- Audit the action
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (
    auth.uid(), 
    CASE WHEN public.has_role('super_admin'::public.app_role, auth.uid()) THEN 'super_admin' ELSE 'admin' END,
    'lift_ban', 'user', _target_user_id::text
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mute_user(_target_user_id uuid, _duration_hours integer, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT (public.has_role('moderator'::public.app_role, auth.uid()) OR public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles
  SET 
    last_muted_at = now(),
    mute_expires_at = now() + (_duration_hours * interval '1 hour'),
    restriction_flags = array_append(restriction_flags, 'messaging_restricted')
  WHERE id = _target_user_id;

  PERFORM public.send_governance_notification(_target_user_id, 'mute', _reason);

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'staff', 'mute_user', 'user', _target_user_id::text, jsonb_build_object('duration_hours', _duration_hours, 'reason', _reason));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_new_direct_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  sender_name TEXT;
  formatted_msg TEXT;
BEGIN
  -- Get sender's name
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  -- Format content
  formatted_msg := public.format_notification_message(NEW.content);

  -- Create notification for the receiver
  INSERT INTO public.notifications (
    user_id,
    trigger_user_id,
    type,
    title,
    message,
    action_url,
    related_id,
    related_type,
    priority,
    is_read
  ) VALUES (
    NEW.receiver_id,
    NEW.sender_id,
    'new_message',
    sender_name,  -- Clean Title: e.g. "sanoopu"
    formatted_msg,
    '/messages/' || NEW.sender_id,
    NEW.id,
    'direct_message',
    'high',
    false
  );

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_new_room_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  room_member RECORD;
  sender_name TEXT;
  room_title TEXT;
  formatted_msg TEXT;
BEGIN
  -- Get sender's name
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Get room title
  SELECT title INTO room_title
  FROM public.discussion_rooms
  WHERE id = NEW.room_id;

  -- Format content
  formatted_msg := public.format_notification_message(NEW.content);

  -- Create notifications for all room members except the sender
  FOR room_member IN 
    SELECT user_id 
    FROM public.room_members 
    WHERE room_id = NEW.room_id 
    AND user_id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (
      user_id,
      trigger_user_id,
      type,
      title,
      message,
      action_url,
      related_id,
      related_type,
      priority,
      is_read,
      created_at
    ) VALUES (
      room_member.user_id,
      NEW.user_id,
      'new_message',
      sender_name || ' in ' || COALESCE(room_title, 'Discussion'), -- Clean Title: e.g. "sanoopu in Movie Magic"
      formatted_msg,
      '/discussion-rooms/' || NEW.room_id,
      NEW.id,
      'room_message',
      'medium',
      false,
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_verification(_request_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT user_id INTO v_user_id FROM public.verification_requests WHERE id = _request_id;

  UPDATE public.verification_requests
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = _reason
  WHERE id = _request_id;

  PERFORM public.send_governance_notification(v_user_id, 'verify_reject', _reason);

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'reject_verification', 'verification_request', _request_id::text, jsonb_build_object('reason', _reason));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_report(_report_id uuid, _status text, _note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT (
    public.has_role('moderator'::public.app_role, auth.uid()) OR
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  UPDATE public.content_reports
  SET status = _status, reviewed_by = auth.uid(), reviewed_at = now(), resolution_note = _note
  WHERE id = _report_id;
  
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (
    auth.uid(), 'moderator', 'resolve_report', 'content_report', _report_id::text,
    jsonb_build_object('resolution', _status, 'note', _note)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restore_user_access(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Permission Check
  IF NOT (
    public.has_role('admin'::public.app_role, auth.uid()) OR
    public.has_role('super_admin'::public.app_role, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to restore access';
  END IF;
  
  -- 1. Deactivate all active bans for this user
  UPDATE public.user_bans
  SET 
    is_active = false, 
    lifted_at = now(), 
    lifted_by = auth.uid()
  WHERE user_id = target_user_id AND is_active = true;
  
  -- 2. Clear the ban flag on the profile
  UPDATE public.profiles 
  SET is_banned = false 
  WHERE id = target_user_id;
  
  -- 3. Send real-time notification
  PERFORM public.send_governance_notification(target_user_id, 'governance', 'Welcome back! Your account access has been fully restored.');
  
  -- 4. Audit Log
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (
    auth.uid(), 
    CASE WHEN public.has_role('super_admin'::public.app_role, auth.uid()) THEN 'super_admin' ELSE 'admin' END,
    'restore_access', 'user', target_user_id::text
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.revoke_user_role(_user_id uuid, _role public.app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT public.has_role('super_admin'::public.app_role, auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can revoke roles';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = _role;

  PERFORM public.send_governance_notification(_user_id, 'role_revoke', _role::text);

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'super_admin', 'revoke_role', 'user', _user_id::text, jsonb_build_object('role', _role));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_marketplace_listings(search_query text DEFAULT NULL::text, filter_type public.listing_type DEFAULT NULL::public.listing_type, filter_category text DEFAULT NULL::text, filter_location text DEFAULT NULL::text, min_price numeric DEFAULT NULL::numeric, max_price numeric DEFAULT NULL::numeric)
 RETURNS TABLE(id uuid, user_id uuid, listing_type public.listing_type, title text, description text, category text, price_per_day numeric, price_per_week numeric, location text, images text[], is_active boolean, created_at timestamp with time zone, average_rating numeric, review_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    ml.id,
    ml.user_id,
    ml.listing_type,
    ml.title,
    ml.description,
    ml.category,
    ml.price_per_day,
    ml.price_per_week,
    ml.location,
    ml.images,
    ml.is_active,
    ml.created_at,
    COALESCE(AVG(mr.rating), 0)::NUMERIC as average_rating,
    COUNT(mr.id) as review_count
  FROM marketplace_listings ml
  LEFT JOIN marketplace_reviews mr ON ml.id = mr.listing_id
  WHERE 
    ml.is_active = true
    AND (search_query IS NULL OR ml.title ILIKE '%' || search_query || '%' OR ml.description ILIKE '%' || search_query || '%')
    AND (filter_type IS NULL OR ml.listing_type = filter_type)
    AND (filter_category IS NULL OR ml.category = filter_category)
    AND (filter_location IS NULL OR ml.location ILIKE '%' || filter_location || '%')
    AND (min_price IS NULL OR ml.price_per_day >= min_price)
    AND (max_price IS NULL OR ml.price_per_day <= max_price)
  GROUP BY ml.id
  ORDER BY ml.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_vendors(search_query text DEFAULT NULL::text, filter_category text DEFAULT NULL::text, filter_location text DEFAULT NULL::text, verified_only boolean DEFAULT false)
 RETURNS TABLE(id uuid, owner_id uuid, business_name text, description text, category text[], services_offered text[], location text, phone text, email text, website text, logo_url text, images text[], is_verified boolean, created_at timestamp with time zone, average_rating numeric, review_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    v.id,
    v.owner_id,
    v.business_name,
    v.description,
    v.category,
    v.services_offered,
    v.location,
    v.phone,
    v.email,
    v.website,
    v.logo_url,
    v.images,
    v.is_verified,
    v.created_at,
    COALESCE(AVG(mr.rating), 0)::NUMERIC as average_rating,
    COUNT(mr.id) as review_count
  FROM vendors v
  LEFT JOIN marketplace_reviews mr ON v.id = mr.vendor_id
  WHERE 
    (NOT verified_only OR v.is_verified = true)
    AND (search_query IS NULL OR v.business_name ILIKE '%' || search_query || '%' OR v.description ILIKE '%' || search_query || '%')
    AND (filter_category IS NULL OR filter_category = ANY(v.category))
    AND (filter_location IS NULL OR v.location ILIKE '%' || filter_location || '%')
  GROUP BY v.id
  ORDER BY v.is_verified DESC, v.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.send_governance_notification(_target_user_id uuid, _action_type text, _reason text DEFAULT NULL::text, _notify_user boolean DEFAULT true, _disclosure_level text DEFAULT 'full'::text, _suppression_reason text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_title text;
  v_message text;
  v_priority text := 'high';
BEGIN
  -- 1. Audit the decision regardless of whether we notify
  INSERT INTO public.notification_logs (
    target_user_id, action_type, decision, disclosure_level, suppression_reason, metadata
  ) VALUES (
    _target_user_id, _action_type, 
    CASE WHEN _notify_user THEN 'notified' ELSE 'suppressed' END,
    _disclosure_level, _suppression_reason, _metadata
  );

  -- 2. Exit if suppressed or level is none
  IF NOT _notify_user OR _disclosure_level = 'none' THEN
    RETURN;
  END IF;

  -- Template Logic
  CASE _action_type
    WHEN 'warn' THEN
      v_title := 'Account Warning';
      v_message := 'Your account has received a warning for: ' || COALESCE(_reason, 'Community guidelines violation') || '. Please review our rules.';
    WHEN 'mute' THEN
      v_title := 'Account Restricted';
      v_message := 'Your account has been temporarily restricted for: ' || COALESCE(_reason, 'Rule violation') || '.';
    WHEN 'ban' THEN
      v_title := 'Account Banned';
      v_message := 'Your account has been permanently suspended for severe violations: ' || COALESCE(_reason, 'Policy breach') || '.';
    WHEN 'verify_approve' THEN
      v_title := 'Identity Verified';
      v_message := 'Congratulations! Your verification request has been approved.';
      v_priority := 'medium';
    WHEN 'verify_reject' THEN
      v_title := 'Verification Update';
      v_message := 'Your verification request was not approved. Reason: ' || COALESCE(_reason, 'Incomplete documentation');
    WHEN 'role_assign' THEN
      v_title := 'Privileges Granted';
      v_message := 'You have been granted ' || COALESCE(_reason, 'staff') || ' privileges. Please check the governance console.';
    WHEN 'role_revoke' THEN
      v_title := 'Privileges Updated';
      v_message := 'Your internal privileges (' || COALESCE(_reason, 'staff') || ') have been revoked.';
    WHEN 'content_removed' THEN
      v_title := 'Content Removed';
      v_message := 'A piece of content you posted was removed for violating policy: ' || COALESCE(_reason, 'Community guidelines');
    WHEN 'monetization_disabled' THEN
      v_title := 'Monetization Update';
      v_message := 'Platform monetization has been disabled for your account. Reason: ' || COALESCE(_reason, 'Policy review');
    WHEN 'governance' THEN
      v_title := 'Governance Update';
      v_message := COALESCE(_reason, 'An administrative action was taken on your account.');
    ELSE
      v_title := 'Governance Notification';
      v_message := COALESCE(_reason, 'Update regarding your account status.');
  END CASE;

  -- Limited disclosure override
  IF _disclosure_level = 'limited' THEN
    v_message := 'An administrative action has been taken on your account regarding ' || _action_type || '. Please contact support for more details.';
  END IF;

  -- 3. Insert into real notifications table
  INSERT INTO public.notifications (
    user_id, title, message, type, priority, metadata
  ) VALUES (
    _target_user_id, v_title, v_message, 'governance', v_priority, 
    _metadata || jsonb_build_object('action', _action_type, 'appealable', true)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_monetization_status(_user_id uuid, _disabled boolean, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _disabled THEN
    UPDATE public.profiles 
    SET restriction_flags = array_append(COALESCE(restriction_flags, ARRAY[]::text[]), 'monetization_disabled')
    WHERE id = _user_id AND NOT (restriction_flags @> ARRAY['monetization_disabled']);
  ELSE
    UPDATE public.profiles 
    SET restriction_flags = array_remove(restriction_flags, 'monetization_disabled')
    WHERE id = _user_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'set_monetization', 'user', _user_id::text, jsonb_build_object('disabled', _disabled, 'reason', _reason));

  PERFORM public.send_governance_notification(_user_id, 'governance_update', 'Your monetization status has been updated.');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.shadow_ban_user(_target_user_id uuid, _reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT (public.has_role('admin'::public.app_role, auth.uid()) OR public.has_role('super_admin'::public.app_role, auth.uid())) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles
  SET shadow_banned_at = now()
  WHERE id = _target_user_id;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (auth.uid(), 'admin', 'shadow_ban', 'user', _target_user_id::text, jsonb_build_object('reason', _reason));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_is_internal_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.role IN ('admin', 'moderator', 'super_admin') THEN
      UPDATE public.profiles SET is_internal = true WHERE id = NEW.user_id;
    ELSE
      UPDATE public.profiles SET is_internal = false WHERE id = NEW.user_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET is_internal = false WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_official_team_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.role IN ('moderator', 'admin', 'super_admin') THEN
    UPDATE public.profiles SET is_official_team = true WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles SET is_official_team = false WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_page_follower_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE company_pages SET follower_count = follower_count + 1 WHERE id = NEW.page_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE company_pages SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.page_id;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_pitch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_post_stats()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (TG_TABLE_NAME = 'post_likes') THEN
            UPDATE public.posts SET like_count = coalesce(like_count, 0) + 1 WHERE id = NEW.post_id;
        ELSIF (TG_TABLE_NAME = 'post_comments') THEN
            UPDATE public.posts SET comment_count = coalesce(comment_count, 0) + 1 WHERE id = NEW.post_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (TG_TABLE_NAME = 'post_likes') THEN
            UPDATE public.posts SET like_count = GREATEST(0, coalesce(like_count, 0) - 1) WHERE id = OLD.post_id;
        ELSIF (TG_TABLE_NAME = 'post_comments') THEN
            UPDATE public.posts SET comment_count = GREATEST(0, coalesce(comment_count, 0) - 1) WHERE id = OLD.post_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_review_helpful_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.film_reviews
        SET helpful_count = helpful_count + 1
        WHERE id = NEW.review_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.film_reviews
        SET helpful_count = helpful_count - 1
        WHERE id = OLD.review_id;
    END IF;
    RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."budget_items" to "anon";

grant insert on table "public"."budget_items" to "anon";

grant references on table "public"."budget_items" to "anon";

grant select on table "public"."budget_items" to "anon";

grant trigger on table "public"."budget_items" to "anon";

grant truncate on table "public"."budget_items" to "anon";

grant update on table "public"."budget_items" to "anon";

grant delete on table "public"."budget_items" to "authenticated";

grant insert on table "public"."budget_items" to "authenticated";

grant references on table "public"."budget_items" to "authenticated";

grant select on table "public"."budget_items" to "authenticated";

grant trigger on table "public"."budget_items" to "authenticated";

grant truncate on table "public"."budget_items" to "authenticated";

grant update on table "public"."budget_items" to "authenticated";

grant delete on table "public"."budget_items" to "service_role";

grant insert on table "public"."budget_items" to "service_role";

grant references on table "public"."budget_items" to "service_role";

grant select on table "public"."budget_items" to "service_role";

grant trigger on table "public"."budget_items" to "service_role";

grant truncate on table "public"."budget_items" to "service_role";

grant update on table "public"."budget_items" to "service_role";

grant delete on table "public"."call_reactions" to "anon";

grant insert on table "public"."call_reactions" to "anon";

grant references on table "public"."call_reactions" to "anon";

grant select on table "public"."call_reactions" to "anon";

grant trigger on table "public"."call_reactions" to "anon";

grant truncate on table "public"."call_reactions" to "anon";

grant update on table "public"."call_reactions" to "anon";

grant delete on table "public"."call_reactions" to "authenticated";

grant insert on table "public"."call_reactions" to "authenticated";

grant references on table "public"."call_reactions" to "authenticated";

grant select on table "public"."call_reactions" to "authenticated";

grant trigger on table "public"."call_reactions" to "authenticated";

grant truncate on table "public"."call_reactions" to "authenticated";

grant update on table "public"."call_reactions" to "authenticated";

grant delete on table "public"."call_reactions" to "service_role";

grant insert on table "public"."call_reactions" to "service_role";

grant references on table "public"."call_reactions" to "service_role";

grant select on table "public"."call_reactions" to "service_role";

grant trigger on table "public"."call_reactions" to "service_role";

grant truncate on table "public"."call_reactions" to "service_role";

grant update on table "public"."call_reactions" to "service_role";

grant delete on table "public"."call_sheets" to "anon";

grant insert on table "public"."call_sheets" to "anon";

grant references on table "public"."call_sheets" to "anon";

grant select on table "public"."call_sheets" to "anon";

grant trigger on table "public"."call_sheets" to "anon";

grant truncate on table "public"."call_sheets" to "anon";

grant update on table "public"."call_sheets" to "anon";

grant delete on table "public"."call_sheets" to "authenticated";

grant insert on table "public"."call_sheets" to "authenticated";

grant references on table "public"."call_sheets" to "authenticated";

grant select on table "public"."call_sheets" to "authenticated";

grant trigger on table "public"."call_sheets" to "authenticated";

grant truncate on table "public"."call_sheets" to "authenticated";

grant update on table "public"."call_sheets" to "authenticated";

grant delete on table "public"."call_sheets" to "service_role";

grant insert on table "public"."call_sheets" to "service_role";

grant references on table "public"."call_sheets" to "service_role";

grant select on table "public"."call_sheets" to "service_role";

grant trigger on table "public"."call_sheets" to "service_role";

grant truncate on table "public"."call_sheets" to "service_role";

grant update on table "public"."call_sheets" to "service_role";

grant delete on table "public"."files" to "anon";

grant insert on table "public"."files" to "anon";

grant references on table "public"."files" to "anon";

grant select on table "public"."files" to "anon";

grant trigger on table "public"."files" to "anon";

grant truncate on table "public"."files" to "anon";

grant update on table "public"."files" to "anon";

grant delete on table "public"."files" to "authenticated";

grant insert on table "public"."files" to "authenticated";

grant references on table "public"."files" to "authenticated";

grant select on table "public"."files" to "authenticated";

grant trigger on table "public"."files" to "authenticated";

grant truncate on table "public"."files" to "authenticated";

grant update on table "public"."files" to "authenticated";

grant delete on table "public"."files" to "service_role";

grant insert on table "public"."files" to "service_role";

grant references on table "public"."files" to "service_role";

grant select on table "public"."files" to "service_role";

grant trigger on table "public"."files" to "service_role";

grant truncate on table "public"."files" to "service_role";

grant update on table "public"."files" to "service_role";

grant delete on table "public"."legal_docs" to "anon";

grant insert on table "public"."legal_docs" to "anon";

grant references on table "public"."legal_docs" to "anon";

grant select on table "public"."legal_docs" to "anon";

grant trigger on table "public"."legal_docs" to "anon";

grant truncate on table "public"."legal_docs" to "anon";

grant update on table "public"."legal_docs" to "anon";

grant delete on table "public"."legal_docs" to "authenticated";

grant insert on table "public"."legal_docs" to "authenticated";

grant references on table "public"."legal_docs" to "authenticated";

grant select on table "public"."legal_docs" to "authenticated";

grant trigger on table "public"."legal_docs" to "authenticated";

grant truncate on table "public"."legal_docs" to "authenticated";

grant update on table "public"."legal_docs" to "authenticated";

grant delete on table "public"."legal_docs" to "service_role";

grant insert on table "public"."legal_docs" to "service_role";

grant references on table "public"."legal_docs" to "service_role";

grant select on table "public"."legal_docs" to "service_role";

grant trigger on table "public"."legal_docs" to "service_role";

grant truncate on table "public"."legal_docs" to "service_role";

grant update on table "public"."legal_docs" to "service_role";

grant delete on table "public"."mentions" to "anon";

grant insert on table "public"."mentions" to "anon";

grant references on table "public"."mentions" to "anon";

grant select on table "public"."mentions" to "anon";

grant trigger on table "public"."mentions" to "anon";

grant truncate on table "public"."mentions" to "anon";

grant update on table "public"."mentions" to "anon";

grant delete on table "public"."mentions" to "authenticated";

grant insert on table "public"."mentions" to "authenticated";

grant references on table "public"."mentions" to "authenticated";

grant select on table "public"."mentions" to "authenticated";

grant trigger on table "public"."mentions" to "authenticated";

grant truncate on table "public"."mentions" to "authenticated";

grant update on table "public"."mentions" to "authenticated";

grant delete on table "public"."mentions" to "service_role";

grant insert on table "public"."mentions" to "service_role";

grant references on table "public"."mentions" to "service_role";

grant select on table "public"."mentions" to "service_role";

grant trigger on table "public"."mentions" to "service_role";

grant truncate on table "public"."mentions" to "service_role";

grant update on table "public"."mentions" to "service_role";

grant delete on table "public"."message_reactions" to "anon";

grant insert on table "public"."message_reactions" to "anon";

grant references on table "public"."message_reactions" to "anon";

grant select on table "public"."message_reactions" to "anon";

grant trigger on table "public"."message_reactions" to "anon";

grant truncate on table "public"."message_reactions" to "anon";

grant update on table "public"."message_reactions" to "anon";

grant delete on table "public"."message_reactions" to "authenticated";

grant insert on table "public"."message_reactions" to "authenticated";

grant references on table "public"."message_reactions" to "authenticated";

grant select on table "public"."message_reactions" to "authenticated";

grant trigger on table "public"."message_reactions" to "authenticated";

grant truncate on table "public"."message_reactions" to "authenticated";

grant update on table "public"."message_reactions" to "authenticated";

grant delete on table "public"."message_reactions" to "service_role";

grant insert on table "public"."message_reactions" to "service_role";

grant references on table "public"."message_reactions" to "service_role";

grant select on table "public"."message_reactions" to "service_role";

grant trigger on table "public"."message_reactions" to "service_role";

grant truncate on table "public"."message_reactions" to "service_role";

grant update on table "public"."message_reactions" to "service_role";

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

grant delete on table "public"."profile_views" to "anon";

grant insert on table "public"."profile_views" to "anon";

grant references on table "public"."profile_views" to "anon";

grant select on table "public"."profile_views" to "anon";

grant trigger on table "public"."profile_views" to "anon";

grant truncate on table "public"."profile_views" to "anon";

grant update on table "public"."profile_views" to "anon";

grant delete on table "public"."profile_views" to "authenticated";

grant insert on table "public"."profile_views" to "authenticated";

grant references on table "public"."profile_views" to "authenticated";

grant select on table "public"."profile_views" to "authenticated";

grant trigger on table "public"."profile_views" to "authenticated";

grant truncate on table "public"."profile_views" to "authenticated";

grant update on table "public"."profile_views" to "authenticated";

grant delete on table "public"."profile_views" to "service_role";

grant insert on table "public"."profile_views" to "service_role";

grant references on table "public"."profile_views" to "service_role";

grant select on table "public"."profile_views" to "service_role";

grant trigger on table "public"."profile_views" to "service_role";

grant truncate on table "public"."profile_views" to "service_role";

grant update on table "public"."profile_views" to "service_role";

grant delete on table "public"."project_invites" to "anon";

grant insert on table "public"."project_invites" to "anon";

grant references on table "public"."project_invites" to "anon";

grant select on table "public"."project_invites" to "anon";

grant trigger on table "public"."project_invites" to "anon";

grant truncate on table "public"."project_invites" to "anon";

grant update on table "public"."project_invites" to "anon";

grant delete on table "public"."project_invites" to "authenticated";

grant insert on table "public"."project_invites" to "authenticated";

grant references on table "public"."project_invites" to "authenticated";

grant select on table "public"."project_invites" to "authenticated";

grant trigger on table "public"."project_invites" to "authenticated";

grant truncate on table "public"."project_invites" to "authenticated";

grant update on table "public"."project_invites" to "authenticated";

grant delete on table "public"."project_invites" to "service_role";

grant insert on table "public"."project_invites" to "service_role";

grant references on table "public"."project_invites" to "service_role";

grant select on table "public"."project_invites" to "service_role";

grant trigger on table "public"."project_invites" to "service_role";

grant truncate on table "public"."project_invites" to "service_role";

grant update on table "public"."project_invites" to "service_role";

grant delete on table "public"."project_members" to "anon";

grant insert on table "public"."project_members" to "anon";

grant references on table "public"."project_members" to "anon";

grant select on table "public"."project_members" to "anon";

grant trigger on table "public"."project_members" to "anon";

grant truncate on table "public"."project_members" to "anon";

grant update on table "public"."project_members" to "anon";

grant delete on table "public"."project_members" to "authenticated";

grant insert on table "public"."project_members" to "authenticated";

grant references on table "public"."project_members" to "authenticated";

grant select on table "public"."project_members" to "authenticated";

grant trigger on table "public"."project_members" to "authenticated";

grant truncate on table "public"."project_members" to "authenticated";

grant update on table "public"."project_members" to "authenticated";

grant delete on table "public"."project_members" to "service_role";

grant insert on table "public"."project_members" to "service_role";

grant references on table "public"."project_members" to "service_role";

grant select on table "public"."project_members" to "service_role";

grant trigger on table "public"."project_members" to "service_role";

grant truncate on table "public"."project_members" to "service_role";

grant update on table "public"."project_members" to "service_role";

grant delete on table "public"."project_message_read_status" to "anon";

grant insert on table "public"."project_message_read_status" to "anon";

grant references on table "public"."project_message_read_status" to "anon";

grant select on table "public"."project_message_read_status" to "anon";

grant trigger on table "public"."project_message_read_status" to "anon";

grant truncate on table "public"."project_message_read_status" to "anon";

grant update on table "public"."project_message_read_status" to "anon";

grant delete on table "public"."project_message_read_status" to "authenticated";

grant insert on table "public"."project_message_read_status" to "authenticated";

grant references on table "public"."project_message_read_status" to "authenticated";

grant select on table "public"."project_message_read_status" to "authenticated";

grant trigger on table "public"."project_message_read_status" to "authenticated";

grant truncate on table "public"."project_message_read_status" to "authenticated";

grant update on table "public"."project_message_read_status" to "authenticated";

grant delete on table "public"."project_message_read_status" to "service_role";

grant insert on table "public"."project_message_read_status" to "service_role";

grant references on table "public"."project_message_read_status" to "service_role";

grant select on table "public"."project_message_read_status" to "service_role";

grant trigger on table "public"."project_message_read_status" to "service_role";

grant truncate on table "public"."project_message_read_status" to "service_role";

grant update on table "public"."project_message_read_status" to "service_role";

grant delete on table "public"."project_space_message_read_status" to "anon";

grant insert on table "public"."project_space_message_read_status" to "anon";

grant references on table "public"."project_space_message_read_status" to "anon";

grant select on table "public"."project_space_message_read_status" to "anon";

grant trigger on table "public"."project_space_message_read_status" to "anon";

grant truncate on table "public"."project_space_message_read_status" to "anon";

grant update on table "public"."project_space_message_read_status" to "anon";

grant delete on table "public"."project_space_message_read_status" to "authenticated";

grant insert on table "public"."project_space_message_read_status" to "authenticated";

grant references on table "public"."project_space_message_read_status" to "authenticated";

grant select on table "public"."project_space_message_read_status" to "authenticated";

grant trigger on table "public"."project_space_message_read_status" to "authenticated";

grant truncate on table "public"."project_space_message_read_status" to "authenticated";

grant update on table "public"."project_space_message_read_status" to "authenticated";

grant delete on table "public"."project_space_message_read_status" to "service_role";

grant insert on table "public"."project_space_message_read_status" to "service_role";

grant references on table "public"."project_space_message_read_status" to "service_role";

grant select on table "public"."project_space_message_read_status" to "service_role";

grant trigger on table "public"."project_space_message_read_status" to "service_role";

grant truncate on table "public"."project_space_message_read_status" to "service_role";

grant update on table "public"."project_space_message_read_status" to "service_role";

grant delete on table "public"."room_keys" to "anon";

grant insert on table "public"."room_keys" to "anon";

grant references on table "public"."room_keys" to "anon";

grant select on table "public"."room_keys" to "anon";

grant trigger on table "public"."room_keys" to "anon";

grant truncate on table "public"."room_keys" to "anon";

grant update on table "public"."room_keys" to "anon";

grant delete on table "public"."room_keys" to "authenticated";

grant insert on table "public"."room_keys" to "authenticated";

grant references on table "public"."room_keys" to "authenticated";

grant select on table "public"."room_keys" to "authenticated";

grant trigger on table "public"."room_keys" to "authenticated";

grant truncate on table "public"."room_keys" to "authenticated";

grant update on table "public"."room_keys" to "authenticated";

grant delete on table "public"."room_keys" to "service_role";

grant insert on table "public"."room_keys" to "service_role";

grant references on table "public"."room_keys" to "service_role";

grant select on table "public"."room_keys" to "service_role";

grant trigger on table "public"."room_keys" to "service_role";

grant truncate on table "public"."room_keys" to "service_role";

grant update on table "public"."room_keys" to "service_role";

grant delete on table "public"."room_message_read_status" to "anon";

grant insert on table "public"."room_message_read_status" to "anon";

grant references on table "public"."room_message_read_status" to "anon";

grant select on table "public"."room_message_read_status" to "anon";

grant trigger on table "public"."room_message_read_status" to "anon";

grant truncate on table "public"."room_message_read_status" to "anon";

grant update on table "public"."room_message_read_status" to "anon";

grant delete on table "public"."room_message_read_status" to "authenticated";

grant insert on table "public"."room_message_read_status" to "authenticated";

grant references on table "public"."room_message_read_status" to "authenticated";

grant select on table "public"."room_message_read_status" to "authenticated";

grant trigger on table "public"."room_message_read_status" to "authenticated";

grant truncate on table "public"."room_message_read_status" to "authenticated";

grant update on table "public"."room_message_read_status" to "authenticated";

grant delete on table "public"."room_message_read_status" to "service_role";

grant insert on table "public"."room_message_read_status" to "service_role";

grant references on table "public"."room_message_read_status" to "service_role";

grant select on table "public"."room_message_read_status" to "service_role";

grant trigger on table "public"."room_message_read_status" to "service_role";

grant truncate on table "public"."room_message_read_status" to "service_role";

grant update on table "public"."room_message_read_status" to "service_role";

grant delete on table "public"."schedule_items" to "anon";

grant insert on table "public"."schedule_items" to "anon";

grant references on table "public"."schedule_items" to "anon";

grant select on table "public"."schedule_items" to "anon";

grant trigger on table "public"."schedule_items" to "anon";

grant truncate on table "public"."schedule_items" to "anon";

grant update on table "public"."schedule_items" to "anon";

grant delete on table "public"."schedule_items" to "authenticated";

grant insert on table "public"."schedule_items" to "authenticated";

grant references on table "public"."schedule_items" to "authenticated";

grant select on table "public"."schedule_items" to "authenticated";

grant trigger on table "public"."schedule_items" to "authenticated";

grant truncate on table "public"."schedule_items" to "authenticated";

grant update on table "public"."schedule_items" to "authenticated";

grant delete on table "public"."schedule_items" to "service_role";

grant insert on table "public"."schedule_items" to "service_role";

grant references on table "public"."schedule_items" to "service_role";

grant select on table "public"."schedule_items" to "service_role";

grant trigger on table "public"."schedule_items" to "service_role";

grant truncate on table "public"."schedule_items" to "service_role";

grant update on table "public"."schedule_items" to "service_role";

grant delete on table "public"."shares" to "anon";

grant insert on table "public"."shares" to "anon";

grant references on table "public"."shares" to "anon";

grant select on table "public"."shares" to "anon";

grant trigger on table "public"."shares" to "anon";

grant truncate on table "public"."shares" to "anon";

grant update on table "public"."shares" to "anon";

grant delete on table "public"."shares" to "authenticated";

grant insert on table "public"."shares" to "authenticated";

grant references on table "public"."shares" to "authenticated";

grant select on table "public"."shares" to "authenticated";

grant trigger on table "public"."shares" to "authenticated";

grant truncate on table "public"."shares" to "authenticated";

grant update on table "public"."shares" to "authenticated";

grant delete on table "public"."shares" to "service_role";

grant insert on table "public"."shares" to "service_role";

grant references on table "public"."shares" to "service_role";

grant select on table "public"."shares" to "service_role";

grant trigger on table "public"."shares" to "service_role";

grant truncate on table "public"."shares" to "service_role";

grant update on table "public"."shares" to "service_role";

grant delete on table "public"."shot_list" to "anon";

grant insert on table "public"."shot_list" to "anon";

grant references on table "public"."shot_list" to "anon";

grant select on table "public"."shot_list" to "anon";

grant trigger on table "public"."shot_list" to "anon";

grant truncate on table "public"."shot_list" to "anon";

grant update on table "public"."shot_list" to "anon";

grant delete on table "public"."shot_list" to "authenticated";

grant insert on table "public"."shot_list" to "authenticated";

grant references on table "public"."shot_list" to "authenticated";

grant select on table "public"."shot_list" to "authenticated";

grant trigger on table "public"."shot_list" to "authenticated";

grant truncate on table "public"."shot_list" to "authenticated";

grant update on table "public"."shot_list" to "authenticated";

grant delete on table "public"."shot_list" to "service_role";

grant insert on table "public"."shot_list" to "service_role";

grant references on table "public"."shot_list" to "service_role";

grant select on table "public"."shot_list" to "service_role";

grant trigger on table "public"."shot_list" to "service_role";

grant truncate on table "public"."shot_list" to "service_role";

grant update on table "public"."shot_list" to "service_role";

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


  create policy "Allow authenticated users to manage budget items"
  on "public"."budget_items"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Member Manage budget_items"
  on "public"."budget_items"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = budget_items.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = budget_items.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Member View budget_items"
  on "public"."budget_items"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = budget_items.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = budget_items.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Project members can manage budget"
  on "public"."budget_items"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = budget_items.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = budget_items.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Project members can view budget"
  on "public"."budget_items"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = budget_items.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = budget_items.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Authenticated users view participants"
  on "public"."call_participants"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Users can join calls"
  on "public"."call_participants"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "Users can update their own participation"
  on "public"."call_participants"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Authenticated users view reactions"
  on "public"."call_reactions"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Users can create reactions in calls they're in"
  on "public"."call_reactions"
  as permissive
  for insert
  to public
with check (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.call_participants
  WHERE ((call_participants.call_id = call_reactions.call_id) AND (call_participants.user_id = auth.uid()) AND (call_participants.status = 'joined'::text))))));



  create policy "Allow authenticated users to manage call sheets"
  on "public"."call_sheets"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Manage Call Sheets"
  on "public"."call_sheets"
  as permissive
  for all
  to public
using ((public.is_project_member(project_id) OR public.is_project_creator(project_id)));



  create policy "Manage call sheets safety"
  on "public"."call_sheets"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Member Manage call_sheets"
  on "public"."call_sheets"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = call_sheets.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = call_sheets.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Member View call_sheets"
  on "public"."call_sheets"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = call_sheets.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = call_sheets.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Project members can manage call sheets"
  on "public"."call_sheets"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = call_sheets.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = call_sheets.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Project members can view call sheets"
  on "public"."call_sheets"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = call_sheets.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = call_sheets.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "View Call Sheets"
  on "public"."call_sheets"
  as permissive
  for select
  to public
using ((public.is_project_member(project_id) OR public.is_project_creator(project_id)));



  create policy "Authenticated users can create calls"
  on "public"."calls"
  as permissive
  for insert
  to authenticated
with check ((started_by = auth.uid()));



  create policy "Authenticated users can view active calls"
  on "public"."calls"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Authenticated users view calls"
  on "public"."calls"
  as permissive
  for select
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Users can create calls"
  on "public"."calls"
  as permissive
  for insert
  to public
with check ((auth.role() = 'authenticated'::text));



  create policy "Users can update their calls"
  on "public"."calls"
  as permissive
  for update
  to authenticated
using ((started_by = auth.uid()))
with check ((started_by = auth.uid()));



  create policy "User manage conversations"
  on "public"."conversations"
  as permissive
  for all
  to public
using (((auth.uid() = user1_id) OR (auth.uid() = user2_id)));



  create policy "Users insert conversations"
  on "public"."conversations"
  as permissive
  for insert
  to public
with check (((( SELECT auth.uid() AS uid) = user1_id) OR (( SELECT auth.uid() AS uid) = user2_id)));



  create policy "Users view own conversations"
  on "public"."conversations"
  as permissive
  for select
  to public
using (((( SELECT auth.uid() AS uid) = user1_id) OR (( SELECT auth.uid() AS uid) = user2_id)));



  create policy "Anyone can view public rooms"
  on "public"."discussion_rooms"
  as permissive
  for select
  to public
using (((is_public = true) OR (auth.uid() IS NOT NULL)));



  create policy "Auth Create Rooms"
  on "public"."discussion_rooms"
  as permissive
  for insert
  to public
with check ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "Auth View Public Rooms"
  on "public"."discussion_rooms"
  as permissive
  for select
  to public
using (((( SELECT auth.role() AS role) = 'authenticated'::text) AND ((is_public = true) OR public.is_member_of_room(id) OR (creator_id = ( SELECT auth.uid() AS uid)))));



  create policy "Authenticated users can create rooms"
  on "public"."discussion_rooms"
  as permissive
  for insert
  to public
with check ((auth.uid() IS NOT NULL));



  create policy "Creator Manage Room"
  on "public"."discussion_rooms"
  as permissive
  for all
  to public
using ((( SELECT auth.uid() AS uid) = creator_id));



  create policy "Creators can update/delete rooms"
  on "public"."discussion_rooms"
  as permissive
  for all
  to public
using ((creator_id = auth.uid()));



  create policy "Allow authenticated users to manage files"
  on "public"."files"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "File uploaders can delete their files"
  on "public"."files"
  as permissive
  for delete
  to public
using (((uploaded_by = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = files.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Manage Files"
  on "public"."files"
  as permissive
  for all
  to public
using ((public.is_project_member(project_id) OR public.is_project_creator(project_id)));



  create policy "Manage files safety"
  on "public"."files"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Member Manage files"
  on "public"."files"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = files.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = files.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Member View files"
  on "public"."files"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = files.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = files.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Project members can upload files"
  on "public"."files"
  as permissive
  for insert
  to public
with check (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = files.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = files.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Project members can view files"
  on "public"."files"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = files.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = files.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "View Files"
  on "public"."files"
  as permissive
  for select
  to public
using ((public.is_project_member(project_id) OR public.is_project_creator(project_id)));



  create policy "Auth Create Jobs"
  on "public"."jobs"
  as permissive
  for insert
  to public
with check (((( SELECT auth.role() AS role) = 'authenticated'::text) AND (( SELECT auth.uid() AS uid) = posted_by)));



  create policy "Owner Manage Jobs"
  on "public"."jobs"
  as permissive
  for all
  to public
using ((( SELECT auth.uid() AS uid) = posted_by));



  create policy "Public View Active Jobs"
  on "public"."jobs"
  as permissive
  for select
  to public
using ((is_active = true));



  create policy "Allow authenticated users to manage legal docs"
  on "public"."legal_docs"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Manage Legal Docs"
  on "public"."legal_docs"
  as permissive
  for all
  to public
using ((public.is_project_member(project_id) OR public.is_project_creator(project_id)));



  create policy "Manage legal docs safety"
  on "public"."legal_docs"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Member Manage legal_docs"
  on "public"."legal_docs"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = legal_docs.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = legal_docs.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Member View legal_docs"
  on "public"."legal_docs"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = legal_docs.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = legal_docs.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Project members can manage legal docs"
  on "public"."legal_docs"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = legal_docs.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = legal_docs.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Project members can view legal docs"
  on "public"."legal_docs"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = legal_docs.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = legal_docs.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "View Legal Docs"
  on "public"."legal_docs"
  as permissive
  for select
  to public
using ((public.is_project_member(project_id) OR public.is_project_creator(project_id)));



  create policy "Auth Create Listings"
  on "public"."marketplace_listings"
  as permissive
  for insert
  to public
with check (((( SELECT auth.role() AS role) = 'authenticated'::text) AND (( SELECT auth.uid() AS uid) = user_id)));



  create policy "Auth View Listings"
  on "public"."marketplace_listings"
  as permissive
  for select
  to public
using (((( SELECT auth.role() AS role) = 'authenticated'::text) AND (is_active = true)));



  create policy "Owner Manage Listings"
  on "public"."marketplace_listings"
  as permissive
  for all
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Anyone can view mentions"
  on "public"."mentions"
  as permissive
  for select
  to public
using (true);



  create policy "Users can create mentions"
  on "public"."mentions"
  as permissive
  for insert
  to public
with check ((auth.uid() = mentioner_id));



  create policy "Users can delete their own mentions"
  on "public"."mentions"
  as permissive
  for delete
  to public
using ((auth.uid() = mentioner_id));



  create policy "Manage Own Reactions"
  on "public"."message_reactions"
  as permissive
  for all
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "View Reactions"
  on "public"."message_reactions"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversations c ON ((m.conversation_id = c.id)))
  WHERE ((m.id = message_reactions.message_id) AND ((c.user1_id = ( SELECT auth.uid() AS uid)) OR (c.user2_id = ( SELECT auth.uid() AS uid)))))));



  create policy "User manage messages"
  on "public"."messages"
  as permissive
  for all
  to public
using (((auth.uid() = sender_id) OR (conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE ((conversations.user1_id = auth.uid()) OR (conversations.user2_id = auth.uid()))))));



  create policy "Users Clear Own General Messages"
  on "public"."messages"
  as permissive
  for delete
  to public
using ((auth.uid() = sender_id));



  create policy "Users Update Own General Messages"
  on "public"."messages"
  as permissive
  for update
  to public
using ((auth.uid() = sender_id))
with check ((auth.uid() = sender_id));



  create policy "Users can delete own messages"
  on "public"."messages"
  as permissive
  for delete
  to public
using ((( SELECT auth.uid() AS uid) = sender_id));



  create policy "Users can update read status"
  on "public"."messages"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.user1_id = ( SELECT auth.uid() AS uid)) OR (c.user2_id = ( SELECT auth.uid() AS uid)))))));



  create policy "Users send their own messages"
  on "public"."messages"
  as permissive
  for insert
  to public
with check (((( SELECT auth.uid() AS uid) = sender_id) AND (EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.user1_id = ( SELECT auth.uid() AS uid)) OR (c.user2_id = ( SELECT auth.uid() AS uid))))))));



  create policy "Users view messages in their conversations"
  on "public"."messages"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.conversations c
  WHERE ((c.id = messages.conversation_id) AND ((c.user1_id = ( SELECT auth.uid() AS uid)) OR (c.user2_id = ( SELECT auth.uid() AS uid)))))));



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



  create policy "Public portfolio items are viewable by everyone"
  on "public"."portfolio_items"
  as permissive
  for select
  to public
using (true);



  create policy "Users can delete their own portfolio items"
  on "public"."portfolio_items"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert their own portfolio items"
  on "public"."portfolio_items"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update their own portfolio items"
  on "public"."portfolio_items"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Anyone can view post_comments"
  on "public"."post_comments"
  as permissive
  for select
  to public
using (true);



  create policy "Auth Create Comments"
  on "public"."post_comments"
  as permissive
  for insert
  to public
with check (((( SELECT auth.role() AS role) = 'authenticated'::text) AND (( SELECT auth.uid() AS uid) = user_id)));



  create policy "Auth View Comments"
  on "public"."post_comments"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "Owner Manage Comments"
  on "public"."post_comments"
  as permissive
  for all
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Public view post_comments"
  on "public"."post_comments"
  as permissive
  for select
  to public
using (true);



  create policy "Users can delete own post_comments"
  on "public"."post_comments"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can manage own post_comments"
  on "public"."post_comments"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "Users can update own post_comments"
  on "public"."post_comments"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Anyone can view post_likes"
  on "public"."post_likes"
  as permissive
  for select
  to public
using (true);



  create policy "Auth Toggle Post Likes"
  on "public"."post_likes"
  as permissive
  for all
  to public
using (((( SELECT auth.role() AS role) = 'authenticated'::text) AND (( SELECT auth.uid() AS uid) = user_id)));



  create policy "Auth View Post Likes"
  on "public"."post_likes"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "Users can manage own post_likes"
  on "public"."post_likes"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "manage_own_likes"
  on "public"."post_likes"
  as permissive
  for all
  to authenticated
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "view_all_likes"
  on "public"."post_likes"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Auth Create Posts"
  on "public"."posts"
  as permissive
  for insert
  to public
with check (((( SELECT auth.role() AS role) = 'authenticated'::text) AND (( SELECT auth.uid() AS uid) = author_id)));



  create policy "Auth View Posts"
  on "public"."posts"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "Authenticated users can create posts"
  on "public"."posts"
  as permissive
  for insert
  to public
with check ((auth.uid() = author_id));



  create policy "Authors can update/delete their posts"
  on "public"."posts"
  as permissive
  for all
  to public
using ((auth.uid() = author_id));



  create policy "Owner Manage Posts"
  on "public"."posts"
  as permissive
  for all
  to public
using ((( SELECT auth.uid() AS uid) = author_id));



  create policy "Anyone can record a profile view"
  on "public"."profile_views"
  as permissive
  for insert
  to public
with check (true);



  create policy "Profile owners can view their view analytics"
  on "public"."profile_views"
  as permissive
  for select
  to authenticated
using ((auth.uid() = profile_id));



  create policy "Auth Create Own Profile"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = id));



  create policy "Owner Update Profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) = id));



  create policy "Public View Profiles"
  on "public"."profiles"
  as permissive
  for select
  to public
using (true);



  create policy "Project creators can create invites"
  on "public"."project_invites"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = project_invites.project_id) AND (project_spaces.creator_id = auth.uid())))));



  create policy "Project creators can delete invites"
  on "public"."project_invites"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = project_invites.project_id) AND (project_spaces.creator_id = auth.uid())))));



  create policy "Project members can view invites"
  on "public"."project_invites"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = project_invites.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = project_invites.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "View project members"
  on "public"."project_members"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users can update their own read status in projects"
  on "public"."project_message_read_status"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "Users can view read status in their projects"
  on "public"."project_message_read_status"
  as permissive
  for select
  to public
using (true);



  create policy "Anyone can view bookmarks"
  on "public"."project_space_bookmarks"
  as permissive
  for select
  to public
using (true);



  create policy "Users can create their own bookmarks"
  on "public"."project_space_bookmarks"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can delete their own bookmarks"
  on "public"."project_space_bookmarks"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Auth View Project Categories"
  on "public"."project_space_categories"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "Creator View Requests"
  on "public"."project_space_join_requests"
  as permissive
  for select
  to public
using (public.is_project_creator(project_space_id));



  create policy "Creator manage project requests"
  on "public"."project_space_join_requests"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.project_spaces ps
  WHERE ((ps.id = project_space_join_requests.project_space_id) AND (ps.creator_id = ( SELECT auth.uid() AS uid))))));



  create policy "Creators can view requests"
  on "public"."project_space_join_requests"
  as permissive
  for select
  to public
using (public.check_is_project_creator(project_space_id));



  create policy "Manage Own Requests"
  on "public"."project_space_join_requests"
  as permissive
  for all
  to public
using ((user_id = auth.uid()));



  create policy "Users can view their own requests"
  on "public"."project_space_join_requests"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "Users delete own project requests or creator"
  on "public"."project_space_join_requests"
  as permissive
  for delete
  to public
using (((( SELECT auth.uid() AS uid) = user_id) OR (EXISTS ( SELECT 1
   FROM public.project_spaces ps
  WHERE ((ps.id = project_space_join_requests.project_space_id) AND (ps.creator_id = ( SELECT auth.uid() AS uid)))))));



  create policy "Users insert own project requests"
  on "public"."project_space_join_requests"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users view own project requests or if creator"
  on "public"."project_space_join_requests"
  as permissive
  for select
  to public
using (((( SELECT auth.uid() AS uid) = user_id) OR (EXISTS ( SELECT 1
   FROM public.project_spaces ps
  WHERE ((ps.id = project_space_join_requests.project_space_id) AND (ps.creator_id = ( SELECT auth.uid() AS uid)))))));



  create policy "Add Members"
  on "public"."project_space_members"
  as permissive
  for insert
  to public
with check (public.is_project_creator(project_space_id));



  create policy "Manage Space Members"
  on "public"."project_space_members"
  as permissive
  for all
  to public
using ((public.is_project_creator(project_space_id) OR (user_id = auth.uid())));



  create policy "View Members"
  on "public"."project_space_members"
  as permissive
  for select
  to public
using (((user_id = auth.uid()) OR public.check_is_project_member(project_space_id) OR public.check_is_project_creator(project_space_id)));



  create policy "View Space Members"
  on "public"."project_space_members"
  as permissive
  for select
  to public
using ((public.is_project_member(project_space_id) OR public.is_project_creator(project_space_id)));



  create policy "Member View Space Read Status"
  on "public"."project_space_message_read_status"
  as permissive
  for select
  to public
using (public.is_member_of_project(project_space_id));



  create policy "Update Own Space Read Status"
  on "public"."project_space_message_read_status"
  as permissive
  for all
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Public can view helpful marks"
  on "public"."review_helpful_marks"
  as permissive
  for select
  to public
using (true);



  create policy "Users can mark helpful"
  on "public"."review_helpful_marks"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can remove mark"
  on "public"."review_helpful_marks"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Auth View Room Categories"
  on "public"."room_categories"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "Room creators can manage join requests"
  on "public"."room_join_requests"
  as permissive
  for all
  to public
using ((EXISTS ( SELECT 1
   FROM public.discussion_rooms
  WHERE ((discussion_rooms.id = room_join_requests.room_id) AND (discussion_rooms.creator_id = auth.uid())))));



  create policy "Room creators can view join requests"
  on "public"."room_join_requests"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.discussion_rooms
  WHERE ((discussion_rooms.id = room_join_requests.room_id) AND (discussion_rooms.creator_id = auth.uid())))));



  create policy "Users can create join requests"
  on "public"."room_join_requests"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can insert room keys"
  on "public"."room_keys"
  as permissive
  for insert
  to public
with check (((auth.uid() = user_id) OR (auth.uid() IN ( SELECT auth.uid() AS uid))));



  create policy "Users can read their own room keys"
  on "public"."room_keys"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Join Room"
  on "public"."room_members"
  as permissive
  for insert
  to public
with check ((((( SELECT auth.uid() AS uid) = user_id) AND (EXISTS ( SELECT 1
   FROM public.discussion_rooms
  WHERE ((discussion_rooms.id = room_members.room_id) AND (discussion_rooms.is_public = true))))) OR (EXISTS ( SELECT 1
   FROM public.discussion_rooms
  WHERE ((discussion_rooms.id = room_members.room_id) AND (discussion_rooms.creator_id = ( SELECT auth.uid() AS uid)))))));



  create policy "Leave/Remove Member"
  on "public"."room_members"
  as permissive
  for delete
  to public
using (((( SELECT auth.uid() AS uid) = user_id) OR (EXISTS ( SELECT 1
   FROM public.discussion_rooms
  WHERE ((discussion_rooms.id = room_members.room_id) AND (discussion_rooms.creator_id = ( SELECT auth.uid() AS uid)))))));



  create policy "Users can join rooms"
  on "public"."room_members"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "Users can leave rooms"
  on "public"."room_members"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "Users can view members of rooms they belong to"
  on "public"."room_members"
  as permissive
  for select
  to public
using (public.is_room_member(room_id));



  create policy "View Room Members"
  on "public"."room_members"
  as permissive
  for select
  to public
using (((auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.discussion_rooms
  WHERE ((discussion_rooms.id = room_members.room_id) AND ((discussion_rooms.is_public = true) OR public.is_member_of_room(discussion_rooms.id)))))));



  create policy "Anyone can view read status in rooms"
  on "public"."room_message_read_status"
  as permissive
  for select
  to public
using (true);



  create policy "Users can update their own read status in rooms"
  on "public"."room_message_read_status"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "Anyone can view messages"
  on "public"."room_messages"
  as permissive
  for select
  to public
using (true);



  create policy "Room members insert messages"
  on "public"."room_messages"
  as permissive
  for insert
  to public
with check (((( SELECT auth.uid() AS uid) = user_id) AND ((EXISTS ( SELECT 1
   FROM public.room_members rm
  WHERE ((rm.room_id = room_messages.room_id) AND (rm.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM public.discussion_rooms dr
  WHERE ((dr.id = room_messages.room_id) AND (dr.creator_id = ( SELECT auth.uid() AS uid))))))));



  create policy "Room members view messages"
  on "public"."room_messages"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.discussion_rooms dr
  WHERE ((dr.id = room_messages.room_id) AND (dr.is_public = true)))) OR (EXISTS ( SELECT 1
   FROM public.room_members rm
  WHERE ((rm.room_id = room_messages.room_id) AND (rm.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM public.discussion_rooms dr
  WHERE ((dr.id = room_messages.room_id) AND (dr.creator_id = ( SELECT auth.uid() AS uid)))))));



  create policy "Send Room Messages"
  on "public"."room_messages"
  as permissive
  for insert
  to public
with check (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.discussion_rooms
  WHERE ((discussion_rooms.id = room_messages.room_id) AND ((discussion_rooms.is_public = true) OR public.is_member_of_room(discussion_rooms.id) OR (discussion_rooms.creator_id = auth.uid())))))));



  create policy "Users Clear Own Room Messages"
  on "public"."room_messages"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users Update Own Room Messages"
  on "public"."room_messages"
  as permissive
  for update
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Users delete own messages"
  on "public"."room_messages"
  as permissive
  for delete
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "View Room Messages"
  on "public"."room_messages"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.discussion_rooms
  WHERE ((discussion_rooms.id = room_messages.room_id) AND ((discussion_rooms.is_public = true) OR public.is_member_of_room(discussion_rooms.id) OR (discussion_rooms.creator_id = auth.uid()))))));



  create policy "Allow authenticated users to manage schedule items"
  on "public"."schedule_items"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Member Manage schedule_items"
  on "public"."schedule_items"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = schedule_items.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = schedule_items.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Member View schedule_items"
  on "public"."schedule_items"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = schedule_items.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = schedule_items.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Project members can manage schedule"
  on "public"."schedule_items"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = schedule_items.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = schedule_items.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Project members can view schedule"
  on "public"."schedule_items"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = schedule_items.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = schedule_items.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Anyone view shares"
  on "public"."shares"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "Public view shares"
  on "public"."shares"
  as permissive
  for select
  to public
using (true);



  create policy "User manage shares"
  on "public"."shares"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "Users delete own shares"
  on "public"."shares"
  as permissive
  for delete
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users insert own shares"
  on "public"."shares"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Manage Shot List"
  on "public"."shot_list"
  as permissive
  for all
  to public
using ((public.is_project_member(project_id) OR public.is_project_creator(project_id)));



  create policy "Member Manage shot_list"
  on "public"."shot_list"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = shot_list.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = shot_list.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Member View shot_list"
  on "public"."shot_list"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = shot_list.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = shot_list.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Project members can manage shot list"
  on "public"."shot_list"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = shot_list.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = shot_list.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Project members can view shot list"
  on "public"."shot_list"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = shot_list.project_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = shot_list.project_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "View Shot List"
  on "public"."shot_list"
  as permissive
  for select
  to public
using ((public.is_project_member(project_id) OR public.is_project_creator(project_id)));



  create policy "Allow authenticated users to manage tasks"
  on "public"."tasks"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Manage Tasks"
  on "public"."tasks"
  as permissive
  for all
  to public
using ((public.is_project_member(project_space_id) OR public.is_project_creator(project_space_id)));



  create policy "Manage task safety"
  on "public"."tasks"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Member Manage tasks"
  on "public"."tasks"
  as permissive
  for all
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = tasks.project_space_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = tasks.project_space_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "Member View tasks"
  on "public"."tasks"
  as permissive
  for select
  to public
using (((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE ((project_space_members.project_space_id = tasks.project_space_id) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE ((project_spaces.id = tasks.project_space_id) AND (project_spaces.creator_id = auth.uid()))))));



  create policy "View Tasks"
  on "public"."tasks"
  as permissive
  for select
  to public
using ((public.is_project_member(project_space_id) OR public.is_project_creator(project_space_id)));



  create policy "Users can insert activities (if needed by client)"
  on "public"."user_activities"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update their own activities (mark as read)"
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
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users can view their own analytics"
  on "public"."user_analytics"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "Auth View Connections"
  on "public"."user_connections"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "Authenticated can create connection request"
  on "public"."user_connections"
  as permissive
  for insert
  to authenticated
with check ((follower_id = auth.uid()));



  create policy "Authenticated can delete own connection"
  on "public"."user_connections"
  as permissive
  for delete
  to authenticated
using ((follower_id = auth.uid()));



  create policy "Authenticated can update own connection"
  on "public"."user_connections"
  as permissive
  for update
  to authenticated
using ((follower_id = auth.uid()))
with check ((follower_id = auth.uid()));



  create policy "Authenticated can view own connections"
  on "public"."user_connections"
  as permissive
  for select
  to authenticated
using (((follower_id = auth.uid()) OR (following_id = auth.uid())));



  create policy "Manage Connections"
  on "public"."user_connections"
  as permissive
  for all
  to public
using ((( SELECT auth.uid() AS uid) = follower_id));



  create policy "create_connection_request"
  on "public"."user_connections"
  as permissive
  for insert
  to authenticated
with check ((follower_id = auth.uid()));



  create policy "delete_connection"
  on "public"."user_connections"
  as permissive
  for delete
  to authenticated
using (((following_id = auth.uid()) OR (follower_id = auth.uid())));



  create policy "update_connection_request"
  on "public"."user_connections"
  as permissive
  for update
  to authenticated
using (((following_id = auth.uid()) OR (follower_id = auth.uid())))
with check (((following_id = auth.uid()) OR (follower_id = auth.uid())));



  create policy "view_connections"
  on "public"."user_connections"
  as permissive
  for select
  to authenticated
using (((follower_id = auth.uid()) OR (following_id = auth.uid())));



  create policy "Allow users to manage own ratings"
  on "public"."user_film_ratings"
  as permissive
  for all
  to public
using ((auth.uid() = user_id))
with check ((auth.uid() = user_id));



  create policy "Allow view all ratings"
  on "public"."user_film_ratings"
  as permissive
  for select
  to public
using (true);



  create policy "Users can insert own settings"
  on "public"."user_settings"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can update own settings"
  on "public"."user_settings"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can view own settings"
  on "public"."user_settings"
  as permissive
  for select
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Anyone view skills"
  on "public"."user_skills"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "Users manage own skills"
  on "public"."user_skills"
  as permissive
  for all
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Auth Create Vendors"
  on "public"."vendors"
  as permissive
  for insert
  to public
with check (((( SELECT auth.role() AS role) = 'authenticated'::text) AND (( SELECT auth.uid() AS uid) = owner_id)));



  create policy "Auth View Vendors"
  on "public"."vendors"
  as permissive
  for select
  to public
using ((( SELECT auth.role() AS role) = 'authenticated'::text));



  create policy "Owner Manage Vendors"
  on "public"."vendors"
  as permissive
  for all
  to public
using ((( SELECT auth.uid() AS uid) = owner_id));



  create policy "Applicants can view own applications"
  on "public"."job_applications"
  as permissive
  for select
  to authenticated
using ((auth.uid() = applicant_id));



  create policy "Job posters can update status"
  on "public"."job_applications"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.jobs
  WHERE ((jobs.id = job_applications.job_id) AND (jobs.posted_by = auth.uid())))));



  create policy "Job posters can view applications"
  on "public"."job_applications"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.jobs
  WHERE ((jobs.id = job_applications.job_id) AND (jobs.posted_by = auth.uid())))));



  create policy "Users can create applications"
  on "public"."job_applications"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = applicant_id));



  create policy "Creator manage room requests"
  on "public"."room_join_requests"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.discussion_rooms dr
  WHERE ((dr.id = room_join_requests.room_id) AND (dr.creator_id = ( SELECT auth.uid() AS uid))))));



  create policy "Users delete own room requests or creator"
  on "public"."room_join_requests"
  as permissive
  for delete
  to public
using (((( SELECT auth.uid() AS uid) = user_id) OR (EXISTS ( SELECT 1
   FROM public.discussion_rooms dr
  WHERE ((dr.id = room_join_requests.room_id) AND (dr.creator_id = ( SELECT auth.uid() AS uid)))))));



  create policy "Users insert own room requests"
  on "public"."room_join_requests"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users view own room requests or if creator"
  on "public"."room_join_requests"
  as permissive
  for select
  to public
using (((( SELECT auth.uid() AS uid) = user_id) OR (EXISTS ( SELECT 1
   FROM public.discussion_rooms dr
  WHERE ((dr.id = room_join_requests.room_id) AND (dr.creator_id = ( SELECT auth.uid() AS uid)))))));


CREATE TRIGGER notify_on_new_announcement AFTER INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.handle_mass_notifications();

CREATE TRIGGER update_budget_items_updated_at BEFORE UPDATE ON public.budget_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_call_sheets_updated_at BEFORE UPDATE ON public.call_sheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER "Push Delivery - DMs" AFTER INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('https://zugtdutimulibaxwnlbs.supabase.co/functions/v1/push-delivery', 'POST', '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1Z3RkdXRpbXVsaWJheHdubGJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjcwNDYyNCwiZXhwIjoyMDkyMDY0NjI0fQ.5S-0-idjENW7x8g3FvAVZWySBDdXxqa5XDTS3fENRW4"}', '{}', '1000');

CREATE TRIGGER direct_messages_push_delivery AFTER INSERT ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.trigger_push_delivery();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_applications_updated_at BEFORE UPDATE ON public.job_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER notify_on_new_job AFTER INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.handle_mass_notifications();

CREATE TRIGGER update_legal_docs_updated_at BEFORE UPDATE ON public.legal_docs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_mention_notification AFTER INSERT ON public.mentions FOR EACH ROW EXECUTE FUNCTION public.handle_new_mention_notification();

CREATE TRIGGER "Push Delivery - Notifications" AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('https://zugtdutimulibaxwnlbs.supabase.co/functions/v1/push-delivery', 'POST', '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1Z3RkdXRpbXVsaWJheHdubGJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjcwNDYyNCwiZXhwIjoyMDkyMDY0NjI0fQ.5S-0-idjENW7x8g3FvAVZWySBDdXxqa5XDTS3fENRW4"}', '{}', '1000');

CREATE TRIGGER update_portfolio_items_updated_at BEFORE UPDATE ON public.portfolio_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER post_comment_notification AFTER INSERT ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();

CREATE TRIGGER post_like_notification AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.notify_post_like();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER notify_on_onboarding_complete AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_mass_notifications();

CREATE TRIGGER on_profile_created_create_settings AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.create_default_user_settings();

CREATE TRIGGER update_project_invites_updated_at BEFORE UPDATE ON public.project_invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER "Push Delivery - Projects" AFTER INSERT ON public.project_space_messages FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('https://zugtdutimulibaxwnlbs.supabase.co/functions/v1/push-delivery', 'POST', '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1Z3RkdXRpbXVsaWJheHdubGJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjcwNDYyNCwiZXhwIjoyMDkyMDY0NjI0fQ.5S-0-idjENW7x8g3FvAVZWySBDdXxqa5XDTS3fENRW4"}', '{}', '1000');

CREATE TRIGGER project_space_messages_push_delivery AFTER INSERT ON public.project_space_messages FOR EACH ROW EXECUTE FUNCTION public.trigger_push_delivery();

CREATE TRIGGER update_helpful_count AFTER INSERT OR DELETE ON public.review_helpful_marks FOR EACH ROW EXECUTE FUNCTION public.update_review_helpful_count();

CREATE TRIGGER update_member_count_on_join AFTER INSERT ON public.room_members FOR EACH ROW EXECUTE FUNCTION public.update_room_member_count();

CREATE TRIGGER update_member_count_on_leave AFTER DELETE ON public.room_members FOR EACH ROW EXECUTE FUNCTION public.update_room_member_count();

CREATE TRIGGER "Push Delivery - Rooms" AFTER INSERT ON public.room_messages FOR EACH ROW EXECUTE FUNCTION supabase_functions.http_request('https://zugtdutimulibaxwnlbs.supabase.co/functions/v1/push-delivery', 'POST', '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp1Z3RkdXRpbXVsaWJheHdubGJzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjcwNDYyNCwiZXhwIjoyMDkyMDY0NjI0fQ.5S-0-idjENW7x8g3FvAVZWySBDdXxqa5XDTS3fENRW4"}', '{}', '1000');

CREATE TRIGGER room_messages_push_delivery AFTER INSERT ON public.room_messages FOR EACH ROW EXECUTE FUNCTION public.trigger_push_delivery();

CREATE TRIGGER update_schedule_items_updated_at BEFORE UPDATE ON public.schedule_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shot_list_updated_at BEFORE UPDATE ON public.shot_list FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_timestamp BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_user_settings_timestamp();

drop policy "Auth upload avatars" on "storage"."objects";

drop policy "Owner manage portfolios" on "storage"."objects";

drop policy "Project members view files" on "storage"."objects";

drop policy "Public view avatars" on "storage"."objects";

drop policy "Public view portfolios" on "storage"."objects";


  create policy "Public can list public buckets"
  on "storage"."buckets"
  as permissive
  for select
  to public
using ((public = true));



  create policy "Authenticated Read Project Files"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'project-files'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated Read legal documents 1q2r3j8_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'legal-documents'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated Upload Portfolios"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'portfolios'::text));



  create policy "Authenticated Upload Project Files"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'project-files'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated can upload avatars"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((auth.role() = 'authenticated'::text) AND (bucket_id = 'avatars'::text)));



  create policy "Company Assets Authenticated Upload"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'company_assets'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Company Assets Owner Delete"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'company_assets'::text) AND (auth.uid() = owner)));



  create policy "Company Assets Owner Manage"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'company_assets'::text) AND (auth.uid() = owner)));



  create policy "Company Assets Public Access"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'company_assets'::text));



  create policy "Creator Delete Project Files"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'project-files'::text) AND (owner = auth.uid())));



  create policy "Document uploaders can delete legal documents"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'legal-documents'::text) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.legal_docs
     JOIN public.project_spaces ON ((legal_docs.project_id = project_spaces.id)))
  WHERE ((legal_docs.url ~~ (('%'::text || objects.name) || '%'::text)) AND (project_spaces.creator_id = auth.uid())))))));



  create policy "File owners can delete project files"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'project-files'::text) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE (((project_spaces.id)::text = split_part(project_spaces.name, '/'::text, 1)) AND (project_spaces.creator_id = auth.uid())))))));



  create policy "Owner Delete Portfolios"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'portfolios'::text) AND ((auth.uid() = owner) OR (owner IS NULL))));



  create policy "Owner Update Portfolios"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'portfolios'::text) AND ((auth.uid() = owner) OR (owner IS NULL))));



  create policy "Owners can delete avatars"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((auth.role() = 'authenticated'::text) AND (bucket_id = 'avatars'::text) AND (owner = auth.uid())));



  create policy "Owners can update avatars"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((auth.role() = 'authenticated'::text) AND (bucket_id = 'avatars'::text) AND (owner = auth.uid())));



  create policy "Project members can update call sheets"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'call-sheets'::text) AND (auth.uid() IS NOT NULL)));



  create policy "Project members can update legal documents"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'legal-documents'::text) AND ((EXISTS ( SELECT 1
   FROM (public.legal_docs
     JOIN public.project_space_members ON ((legal_docs.project_id = project_space_members.project_space_id)))
  WHERE ((legal_docs.url ~~ (('%'::text || objects.name) || '%'::text)) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (public.legal_docs
     JOIN public.project_spaces ON ((legal_docs.project_id = project_spaces.id)))
  WHERE ((legal_docs.url ~~ (('%'::text || objects.name) || '%'::text)) AND (project_spaces.creator_id = auth.uid())))))));



  create policy "Project members can update project files"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'project-files'::text) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE (((project_spaces.id)::text = split_part(project_spaces.name, '/'::text, 1)) AND (project_spaces.creator_id = auth.uid())))))));



  create policy "Project members can upload call sheets"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'call-sheets'::text) AND (auth.uid() IS NOT NULL)));



  create policy "Project members can upload legal documents"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'legal-documents'::text) AND (auth.uid() IS NOT NULL)));



  create policy "Project members can upload project files"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'project-files'::text) AND ((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE (((project_space_members.project_space_id)::text = split_part(objects.name, '/'::text, 1)) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE (((project_spaces.id)::text = split_part(project_spaces.name, '/'::text, 1)) AND (project_spaces.creator_id = auth.uid())))))));



  create policy "Project members can view call sheets"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'call-sheets'::text) AND ((EXISTS ( SELECT 1
   FROM (public.call_sheets
     JOIN public.project_space_members ON ((call_sheets.project_id = project_space_members.project_space_id)))
  WHERE ((call_sheets.notes ~~ (('%'::text || objects.name) || '%'::text)) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (public.call_sheets
     JOIN public.project_spaces ON ((call_sheets.project_id = project_spaces.id)))
  WHERE ((call_sheets.notes ~~ (('%'::text || objects.name) || '%'::text)) AND (project_spaces.creator_id = auth.uid())))))));



  create policy "Project members can view legal documents"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'legal-documents'::text) AND ((EXISTS ( SELECT 1
   FROM (public.legal_docs
     JOIN public.project_space_members ON ((legal_docs.project_id = project_space_members.project_space_id)))
  WHERE ((legal_docs.url ~~ (('%'::text || objects.name) || '%'::text)) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (public.legal_docs
     JOIN public.project_spaces ON ((legal_docs.project_id = project_spaces.id)))
  WHERE ((legal_docs.url ~~ (('%'::text || objects.name) || '%'::text)) AND (project_spaces.creator_id = auth.uid())))))));



  create policy "Project members can view project files"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'project-files'::text) AND ((EXISTS ( SELECT 1
   FROM public.project_space_members
  WHERE (((project_space_members.project_space_id)::text = split_part(objects.name, '/'::text, 1)) AND (project_space_members.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_spaces
  WHERE (((project_spaces.id)::text = split_part(project_spaces.name, '/'::text, 1)) AND (project_spaces.creator_id = auth.uid())))))));



  create policy "Public Access"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'support'::text));



  create policy "Public Read Portfolios"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'portfolios'::text));



  create policy "Public can view avatars"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'avatars'::text));



  create policy "Resume Access"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'resumes'::text));



  create policy "Resume Upload"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'resumes'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));



  create policy "Uploaders can delete call sheets"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'call-sheets'::text) AND ((owner = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.call_sheets
     JOIN public.project_spaces ON ((call_sheets.project_id = project_spaces.id)))
  WHERE ((call_sheets.notes ~~ (('%'::text || objects.name) || '%'::text)) AND (project_spaces.creator_id = auth.uid())))))));



  create policy "Users can upload support assets"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'support'::text));



