


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'user',
    'moderator',
    'admin',
    'super_admin'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."booking_status" AS ENUM (
    'pending',
    'confirmed',
    'cancelled',
    'completed'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."equipment_condition" AS ENUM (
    'Mint',
    'Excellent',
    'Good',
    'Fair'
);


ALTER TYPE "public"."equipment_condition" OWNER TO "postgres";


CREATE TYPE "public"."experience_level" AS ENUM (
    'entry',
    'junior',
    'mid',
    'senior',
    'lead'
);


ALTER TYPE "public"."experience_level" OWNER TO "postgres";


CREATE TYPE "public"."job_application_status" AS ENUM (
    'pending',
    'reviewing',
    'interviewing',
    'accepted',
    'rejected'
);


ALTER TYPE "public"."job_application_status" OWNER TO "postgres";


CREATE TYPE "public"."job_type" AS ENUM (
    'full-time',
    'part-time',
    'contract',
    'freelance',
    'internship',
    'project-based'
);


ALTER TYPE "public"."job_type" OWNER TO "postgres";


CREATE TYPE "public"."listing_type" AS ENUM (
    'equipment',
    'location'
);


ALTER TYPE "public"."listing_type" OWNER TO "postgres";


CREATE TYPE "public"."project_space_type" AS ENUM (
    'public',
    'private',
    'secret'
);


ALTER TYPE "public"."project_space_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_space_access"("p_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_request record;
  v_approver_role public.app_role;
  v_requester_role public.app_role;
BEGIN
  -- Fetch request details
  SELECT * INTO v_request FROM public.space_access_requests WHERE id = p_request_id;
  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Request not found.';
  END IF;
  
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request is already processed.';
  END IF;

  -- Maker-Checker enforcement (Cannot self-approve standard requests)
  IF v_request.requester_id = auth.uid() THEN
    RAISE EXCEPTION 'Dual-Control Violation: Requester cannot approve their own request.';
  END IF;

  -- Fetch roles
  SELECT role INTO v_approver_role FROM public.user_roles WHERE user_id = auth.uid();
  SELECT role INTO v_requester_role FROM public.user_roles WHERE user_id = v_request.requester_id;

  -- Validate Approver boundaries
  -- Moderator requests -> Approved by Admin/Super Admin
  IF v_requester_role = 'moderator'::public.app_role THEN
    IF v_approver_role NOT IN ('admin'::public.app_role, 'super_admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only Admins and Super Admins can approve Moderator requests.';
    END IF;
  END IF;

  -- Admin requests -> Approved by Super Admin (or another Admin)
  IF v_requester_role = 'admin'::public.app_role THEN
    IF v_approver_role NOT IN ('admin'::public.app_role, 'super_admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only Admins and Super Admins can approve Admin requests.';
    END IF;
  END IF;

  -- Super Admin requests -> Approved by another Super Admin (Peer Review)
  IF v_requester_role = 'super_admin'::public.app_role THEN
    IF v_approver_role != 'super_admin'::public.app_role THEN
      RAISE EXCEPTION 'Only another Super Admin can approve Super Admin requests.';
    END IF;
  END IF;

  -- Update request status
  UPDATE public.space_access_requests
  SET status = 'approved', approver_id = auth.uid()
  WHERE id = p_request_id;

  -- Create active grant
  INSERT INTO public.space_access_grants (
    request_id, user_id, target_type, target_id, expires_at
  ) VALUES (
    p_request_id, v_request.requester_id, v_request.target_type, v_request.target_id, v_request.expires_at
  );

  -- Log approval
  INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
  VALUES (
    'chat.approve_access', auth.uid(), v_request.target_id, v_request.target_type, 
    'Approved access request for user: ' || v_request.requester_id::text, 
    jsonb_build_object('request_id', p_request_id, 'reason_details', v_request.reason_details)
  );

END;
$$;


ALTER FUNCTION "public"."approve_space_access"("p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_verification"("_request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."approve_verification"("_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_user_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."assign_user_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_economics_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."audit_economics_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_add_page_owner_as_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO company_page_admins (page_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'super_admin')
  ON CONFLICT (page_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_add_page_owner_as_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_close_job_on_hire"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- If an applicant is accepted, and the job auto-closes
    IF NEW.status = 'accepted' AND (TG_OP = 'UPDATE' OR TG_OP = 'INSERT') THEN
        UPDATE public.jobs 
        SET is_active = false 
        WHERE id = NEW.job_id AND auto_close_on_hire = true AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_close_job_on_hire"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ban_user"("_target_user_id" "uuid", "_reason" "text", "_ban_type" "text" DEFAULT 'permanent'::"text", "_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."ban_user"("_target_user_id" "uuid", "_reason" "text", "_ban_type" "text", "_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."block_bundle_children_on_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    is_parent_bundle BOOLEAN;
    child_item_id UUID;
BEGIN
    -- Check if the listing being booked is a bundle
    SELECT is_bundle INTO is_parent_bundle 
    FROM public.marketplace_listings 
    WHERE id = NEW.listing_id;

    IF is_parent_bundle THEN
        -- Insert a mirrored 'blocked' booking for every item inside the bundle
        FOR child_item_id IN 
            SELECT item_id FROM public.marketplace_bundle_items WHERE bundle_id = NEW.listing_id
        LOOP
            INSERT INTO public.marketplace_bookings (
                listing_id, 
                renter_id, 
                owner_id, 
                start_date, 
                end_date, 
                total_price, 
                status, 
                message
            ) VALUES (
                child_item_id, 
                NEW.renter_id, 
                NEW.owner_id, 
                NEW.start_date, 
                NEW.end_date, 
                0, -- Price is bundled into the parent
                NEW.status, 
                'Child item auto-booked as part of bundle booking: ' || NEW.id
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."block_bundle_children_on_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_project_creator"("_project_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.projects 
    WHERE id = _project_id 
    AND creator_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."check_is_project_creator"("_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_project_member"("_project_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_space_members
    WHERE project_space_id = _project_id
    AND user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."check_is_project_member"("_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_admin_access"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'A Super Admin already exists. Access denied.';
  END IF;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'super_admin'::public.app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin'::public.app_role;

  -- Audit log for the first admin
  INSERT INTO public.audit_logs (actor_id, actor_role, action, target_type, target_id)
  VALUES (auth.uid(), 'super_admin', 'claim_initial_admin', 'user', auth.uid()::text);
END;
$$;


ALTER FUNCTION "public"."claim_admin_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_discussion_room_with_creator"("c_id" "uuid", "cat_id" "uuid", "room_title" "text", "room_description" "text", "type" "text", "room_tags" "text"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    new_room_id uuid;
BEGIN
    INSERT INTO public.discussion_rooms (
        creator_id,
        category_id,
        title,
        description,
        room_type,
        is_public,
        tags,
        member_count
    )
    VALUES (
        c_id,
        cat_id,
        room_title,
        room_description,
        type,
        type = 'public',
        room_tags,
        1
    )
    RETURNING id INTO new_room_id;

    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES (new_room_id, c_id, 'admin');

    RETURN new_room_id;
END;
$$;


ALTER FUNCTION "public"."create_discussion_room_with_creator"("c_id" "uuid", "cat_id" "uuid", "room_title" "text", "room_description" "text", "type" "text", "room_tags" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification_for_like"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type)
    SELECT author_id, 'like', 'New Like', 'Someone liked your post', NEW.post_id, 'post'
    FROM public.posts
    WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_notification_for_like"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."flag_listing_on_poor_condition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    poor_reviews_count INTEGER;
BEGIN
    IF NEW.listing_id IS NOT NULL AND NEW.condition_rating IS NOT NULL AND NEW.condition_rating <= 2 THEN
        SELECT COUNT(*)
        INTO poor_reviews_count
        FROM public.marketplace_reviews
        WHERE listing_id = NEW.listing_id AND condition_rating <= 2;
        
        IF poor_reviews_count >= 3 THEN
            UPDATE public.marketplace_listings
            SET admin_flagged = true
            WHERE id = NEW.listing_id AND admin_flagged = false;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."flag_listing_on_poor_condition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_logout_user"("_user_id" "uuid", "_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."force_logout_user"("_user_id" "uuid", "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_password_reset_user"("_user_id" "uuid", "_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."force_password_reset_user"("_user_id" "uuid", "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."format_notification_message"("content" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."format_notification_message"("content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_stats"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_admin_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_aggregated_film_ratings"("tmdb_ids" integer[]) RETURNS TABLE("tmdb_id" integer, "average_rating" numeric, "review_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ufr.tmdb_id,
        ROUND(AVG(ufr.rating)::numeric, 1) AS average_rating,
        COUNT(ufr.id) AS review_count
    FROM public.user_film_ratings ufr
    WHERE ufr.tmdb_id = ANY(tmdb_ids)
    GROUP BY ufr.tmdb_id;
END;
$$;


ALTER FUNCTION "public"."get_aggregated_film_ratings"("tmdb_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_follower_count"("target_user_id" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT count(*) FROM public.user_connections WHERE following_id = target_user_id AND status = 'accepted';
$$;


ALTER FUNCTION "public"."get_follower_count"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_listing_with_rating"("listing_uuid" "uuid") RETURNS TABLE("id" "uuid", "user_id" "uuid", "listing_type" "public"."listing_type", "title" "text", "description" "text", "category" "text", "price_per_day" numeric, "price_per_week" numeric, "location" "text", "images" "text"[], "specifications" "jsonb", "availability_calendar" "jsonb", "is_active" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "average_rating" numeric, "review_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_listing_with_rating"("listing_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_messages_for_channel_paginated"("p_channel_id" "text", "p_limit" integer DEFAULT 30, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "content" "text", "created_at" timestamp with time zone, "sender_id" "uuid", "sender_profile" "jsonb", "reply_to_id" "uuid", "is_deleted" boolean, "deleted_for_users" "uuid"[], "is_read" boolean, "replied_to_message" "jsonb", "attachment_url" "text", "attachment_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_messages_for_channel_paginated"("p_channel_id" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_platform_economics"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_platform_economics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_segmented_film_ratings"("tmdb_ids" integer[]) RETURNS TABLE("tmdb_id" integer, "overall_average" numeric, "overall_count" bigint, "pro_average" numeric, "pro_count" bigint, "fan_average" numeric, "fan_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ufr.tmdb_id,
        ROUND(AVG(ufr.rating)::numeric, 1) as overall_average,
        COUNT(*) as overall_count,
        ROUND(AVG(CASE WHEN p.account_type IN ('creator', 'studio') OR p.account_type IS NULL THEN ufr.rating ELSE NULL END)::numeric, 1) as pro_average,
        COUNT(CASE WHEN p.account_type IN ('creator', 'studio') OR p.account_type IS NULL THEN 1 ELSE NULL END) as pro_count,
        ROUND(AVG(CASE WHEN p.account_type = 'fan' THEN ufr.rating ELSE NULL END)::numeric, 1) as fan_average,
        COUNT(CASE WHEN p.account_type = 'fan' THEN 1 ELSE NULL END) as fan_count
    FROM 
        public.user_film_ratings ufr
    JOIN
        public.profiles p ON ufr.user_id = p.id
    WHERE 
        ufr.tmdb_id = ANY(tmdb_ids)
    GROUP BY 
        ufr.tmdb_id;
END;
$$;


ALTER FUNCTION "public"."get_segmented_film_ratings"("tmdb_ids" integer[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_shared_wishlist"("p_token" "uuid") RETURNS TABLE("id" "uuid", "listing_id" "uuid", "title" "text", "description" "text", "price_per_day" numeric, "images" "text"[], "user_id" "uuid", "owner_profile_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY 
    SELECT w.id, l.id as listing_id, l.title, l.description, l.price_per_day, l.images, w.user_id, l.user_id as owner_profile_id
    FROM public.marketplace_wishlists w
    JOIN public.profiles p ON p.id = w.user_id
    JOIN public.marketplace_listings l ON l.id = w.listing_id
    WHERE p.wishlist_share_token = p_token;
END;
$$;


ALTER FUNCTION "public"."get_shared_wishlist"("p_token" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_unread_count"() RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."get_total_unread_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_message_previews"("limit_count" integer DEFAULT 10) RETURNS TABLE("sender_id" "uuid", "sender_name" "text", "sender_avatar" "text", "last_message" "text", "unread_count" bigint, "last_timestamp" timestamp with time zone, "chat_type" "text", "context_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
    $$;


ALTER FUNCTION "public"."get_unread_message_previews"("limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_vendor_with_rating"("vendor_uuid" "uuid") RETURNS TABLE("id" "uuid", "owner_id" "uuid", "business_name" "text", "description" "text", "category" "text"[], "services_offered" "text"[], "location" "text", "address" "text", "phone" "text", "email" "text", "website" "text", "logo_url" "text", "images" "text"[], "is_verified" boolean, "verification_date" timestamp with time zone, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "average_rating" numeric, "review_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."get_vendor_with_rating"("vendor_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_follower_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    actor_name text;
BEGIN
    -- Get the name of the follower
    SELECT COALESCE(full_name, username, 'Someone') INTO actor_name 
    FROM public.profiles 
    WHERE id = NEW.follower_id;

    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    VALUES (
        NEW.following_id, 
        NEW.follower_id,
        'new_follower', 
        'New Connection', 
        actor_name || ' ' || (CASE WHEN NEW.status = 'pending' THEN 'wants to connect' ELSE 'is now connected' END), 
        '/network', 
        NEW.follower_id
    );
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_follower_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_mass_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    _target_user_id UUID;
    _actor_id UUID;
    _title TEXT;
    _message TEXT;
    _type TEXT;
    _action_url TEXT;
BEGIN
    _actor_id := auth.uid();

    -- A. HANDLE NEW JOBS (Job Alerts)
    IF TG_TABLE_NAME = 'jobs' AND TG_OP = 'INSERT' THEN
        -- Notify users whose craft or bio matches the job title/description
        FOR _target_user_id IN 
            SELECT id FROM public.profiles 
            WHERE (craft IS NOT NULL AND (NEW.title ILIKE '%' || craft || '%' OR NEW.description ILIKE '%' || craft || '%'))
            OR (bio IS NOT NULL AND (bio ILIKE '%' || NEW.title || '%'))
        LOOP
            -- Don't notify the person who posted the job
            IF _target_user_id != NEW.posted_by THEN
                INSERT INTO public.notifications (
                    user_id, trigger_user_id, type, title, message, related_id, action_url
                ) VALUES (
                    _target_user_id, 
                    NEW.posted_by, 
                    'job_alert', 
                    'New Job Match!', 
                    'A new job "' || NEW.title || '" matches your profile.', 
                    NEW.id, 
                    '/jobs/' || NEW.id
                );
            END IF;
        END LOOP;

    -- B. HANDLE ANNOUNCEMENTS (Global)
    ELSIF TG_TABLE_NAME = 'announcements' AND TG_OP = 'INSERT' THEN
        -- Notify EVERYONE
        FOR _target_user_id IN SELECT id FROM public.profiles LOOP
            INSERT INTO public.notifications (
                user_id, trigger_user_id, type, title, message, related_id, action_url
            ) VALUES (
                _target_user_id, 
                NEW.author_id, 
                'system_announcement', 
                'Platform Announcement', 
                NEW.title, 
                NEW.id, 
                '/announcements'
            );
        END LOOP;

    -- C. HANDLE NETWORK SUGGESTIONS (On Profile Update)
    ELSIF TG_TABLE_NAME = 'profiles' AND TG_OP = 'UPDATE' THEN
        -- Only trigger if onboarding was just completed
        IF OLD.onboarding_completed = false AND NEW.onboarding_completed = true THEN
            FOR _target_user_id IN 
                SELECT id FROM public.profiles 
                WHERE id != NEW.id 
                AND (craft = NEW.craft OR location = NEW.location)
                LIMIT 5 -- Suggest up to 5 relevant people
            LOOP
                SELECT COALESCE(full_name, username) INTO _title FROM public.profiles WHERE id = _target_user_id;
                
                INSERT INTO public.notifications (
                    user_id, trigger_user_id, type, title, message, related_id, action_url
                ) VALUES (
                    NEW.id, 
                    _target_user_id, 
                    'network_suggestion', 
                    'Suggested Connection', 
                    'You might know ' || COALESCE(_title, 'this user') || ' who is also a ' || COALESCE(NEW.craft, 'creator') || '.', 
                    _target_user_id, 
                    '/profile/' || _target_user_id
                );
            END LOOP;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."handle_mass_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_mention_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    _mentioner_name TEXT;
    _page_url TEXT;
BEGIN
    -- Get Mentioner Name
    SELECT full_name INTO _mentioner_name FROM public.profiles WHERE id = NEW.mentioner_id;
    
    -- Set page URL based on related_type
    IF NEW.related_type = 'post' THEN
        _page_url := '/feed';
    ELSIF NEW.related_type = 'chat_message' THEN
        _page_url := '/messages';
    END IF;

    -- Insert into notifications
    INSERT INTO public.notifications (
        user_id, 
        trigger_user_id, 
        type, 
        title, 
        message, 
        related_id, 
        action_url
    )
    VALUES (
        NEW.mentioned_id, 
        NEW.mentioner_id, 
        'mention', 
        'New Mention', 
        COALESCE(_mentioner_name, 'Someone') || ' mentioned you in a ' || REPLACE(NEW.related_type, '_', ' ') || '.', 
        NEW.related_id, 
        _page_url
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_mention_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    _recipient_id UUID;
    _actor_id UUID;
    _actor_name TEXT;
    _project_name TEXT;
    _parent_project_id UUID;
    _job_title TEXT;
    _title TEXT;
    _message TEXT;
    _type TEXT;
    _related_id UUID;
    _action_url TEXT;
BEGIN
    -- Initialize defaults
    _actor_id := auth.uid();

    -- A. HANDLE LIKES
    IF (TG_TABLE_NAME = 'likes' OR TG_TABLE_NAME = 'post_likes') AND TG_OP = 'INSERT' THEN
        _related_id := NEW.post_id;
        _type := 'like';
        
        SELECT author_id INTO _recipient_id FROM public.posts WHERE id = NEW.post_id;
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _actor_id := NEW.user_id;
        _title := 'New Like';
        _message := COALESCE(_actor_name, 'Someone') || ' liked your post';
        _action_url := '/post/' || NEW.post_id;

    -- B. HANDLE COMMENTS
    ELSIF TG_TABLE_NAME = 'post_comments' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.post_id;
        _type := 'comment';
        
        SELECT author_id INTO _recipient_id FROM public.posts WHERE id = NEW.post_id;
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _actor_id := NEW.user_id;
        _title := 'New Comment';
        _message := COALESCE(_actor_name, 'Someone') || ' commented on your post';
        _action_url := '/post/' || NEW.post_id;

    -- C. HANDLE NEW FOLLOWERS / CONNECTIONS
    ELSIF TG_TABLE_NAME = 'user_connections' AND TG_OP = 'INSERT' THEN
        IF NEW.status = 'pending' THEN
            _recipient_id := NEW.following_id;
            _actor_id := NEW.follower_id;
            _related_id := NEW.id;
            _type := 'new_follower';
            
            SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.follower_id;
            _title := 'New Connection Request';
            _message := COALESCE(_actor_name, 'Someone') || ' wants to connect with you';
            _action_url := '/profile/' || NEW.follower_id;
        ELSE
            RETURN NULL;
        END IF;

    -- D. HANDLE JOB APPLICATIONS
    ELSIF TG_TABLE_NAME = 'job_applications' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.job_id;
        _type := 'job_application';
        _actor_id := NEW.applicant_id;
        
        SELECT posted_by, title INTO _recipient_id, _job_title 
        FROM public.jobs 
        WHERE id = NEW.job_id;
        
        IF _recipient_id = NEW.applicant_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.applicant_id;
        _title := 'New Job Application';
        _message := COALESCE(_actor_name, 'Someone') || ' applied for ' || COALESCE(_job_title, 'your job');
        _action_url := '/jobs/manage';

    -- E. HANDLE PROJECT APPLICATIONS
    ELSIF TG_TABLE_NAME = 'project_applications' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.project_id;
        _type := 'project_application';
        _actor_id := NEW.user_id;
        
        SELECT creator_id, name, project_id INTO _recipient_id, _project_name, _parent_project_id 
        FROM public.project_spaces 
        WHERE id = NEW.project_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'Project Application';
        _message := COALESCE(_actor_name, 'Someone') || ' applied to join ' || COALESCE(_project_name, 'your project');
        _action_url := '/projects/' || _parent_project_id || '/space';

    -- F. HANDLE PROJECT SPACE JOIN REQUESTS
    ELSIF TG_TABLE_NAME = 'project_space_join_requests' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.project_space_id;
        _type := 'project_invite';
        _actor_id := NEW.user_id;
        
        SELECT creator_id, name, project_id INTO _recipient_id, _project_name, _parent_project_id 
        FROM public.project_spaces 
        WHERE id = NEW.project_space_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'Project Join Request';
        _message := COALESCE(_actor_name, 'Someone') || ' requested to join ' || COALESCE(_project_name, 'your project');
        _action_url := '/projects/' || _parent_project_id || '/space';

    -- G. HANDLE DISCUSSION ROOM JOIN REQUESTS
    ELSIF TG_TABLE_NAME = 'room_join_requests' AND TG_OP = 'INSERT' THEN
        _related_id := NEW.room_id;
        _type := 'project_invite';
        _actor_id := NEW.user_id;
        
        SELECT creator_id, title INTO _recipient_id, _project_name 
        FROM public.discussion_rooms 
        WHERE id = NEW.room_id;
        
        IF _recipient_id = NEW.user_id THEN RETURN NULL; END IF;
        
        SELECT COALESCE(full_name, username) INTO _actor_name FROM public.profiles WHERE id = NEW.user_id;
        _title := 'Room Join Request';
        _message := COALESCE(_actor_name, 'Someone') || ' wants to join ' || COALESCE(_project_name, 'the room');
        _action_url := '/discussion-rooms/' || NEW.room_id;
    END IF;

    -- Final Insert if we have a recipient
    IF _recipient_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            user_id,
            trigger_user_id,
            type,
            title,
            message,
            related_id,
            action_url
        ) VALUES (
            _recipient_id,
            COALESCE(_actor_id, auth.uid()),
            _type,
            _title,
            _message,
            _related_id,
            _action_url
        );
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_post_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    actor_name text;
BEGIN
    -- Get the name of the author
    SELECT COALESCE(full_name, username, 'Someone') INTO actor_name 
    FROM public.profiles 
    WHERE id = NEW.author_id;

    -- Insert notifications for all followers
    INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
    SELECT 
        uc.follower_id, 
        NEW.author_id,
        'new_post', 
        'New Post', 
        actor_name || ' shared a new post', 
        '/feed', 
        NEW.id
    FROM public.user_connections uc
    WHERE uc.following_id = NEW.author_id AND uc.status = 'accepted';
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_post_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
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
$_$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;


ALTER FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_unread_messages"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    $$;


ALTER FUNCTION "public"."has_unread_messages"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_internal"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'moderator', 'super_admin')
  );
END;
$$;


ALTER FUNCTION "public"."is_current_user_internal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_member_of_project"("_project_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_space_members 
    WHERE project_space_id = _project_id AND user_id = (select auth.uid())
  );
END;
$$;


ALTER FUNCTION "public"."is_member_of_project"("_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_project_creator"("_project_space_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.project_spaces ps
    JOIN public.projects p ON ps.project_id = p.id
    WHERE ps.id = _project_space_id 
    AND p.creator_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_project_creator"("_project_space_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_project_member"("_project_space_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.project_space_members 
    WHERE project_space_id = _project_space_id 
    AND user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_project_member"("_project_space_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_room_admin"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = p_user_id AND role = 'admin'
  );
END;
$$;


ALTER FUNCTION "public"."is_room_admin"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_room_creator"("p_room_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.discussion_rooms
    WHERE id = p_room_id AND creator_id = p_user_id
  );
END;
$$;


ALTER FUNCTION "public"."is_room_creator"("p_room_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_room_member"("p_room_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."is_room_member"("p_room_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lift_ban"("_target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."lift_ban"("_target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_message_as_seen"("p_message_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."mark_message_as_seen"("p_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_channel_id text;
    v_created_at timestamptz;
    v_user uuid;
BEGIN
    v_user := COALESCE(p_user_id, auth.uid());

    -- Get the details of the message being marked as seen
    SELECT channel_id, created_at INTO v_channel_id, v_created_at
    FROM direct_messages
    WHERE id = p_message_id;

    IF v_user IS NULL THEN
        RAISE EXCEPTION 'User ID cannot be null';
    END IF;

    -- Update THIS message and ALL EARLIER messages in this thread
    -- Only if they belong to the current user (receiver)
    UPDATE direct_messages
    SET is_read = true
    WHERE channel_id = v_channel_id
    AND receiver_id = v_user
    AND created_at <= v_created_at
    AND (is_read = false OR is_read IS NULL);
END;
$$;


ALTER FUNCTION "public"."mark_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_project_message_as_seen"("p_message_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    $$;


ALTER FUNCTION "public"."mark_project_message_as_seen"("p_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_project_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    DECLARE
        v_space_id uuid;
        v_created_at timestamptz;
        v_user uuid;
    BEGIN
        v_user := COALESCE(p_user_id, auth.uid());
        
        SELECT project_space_id, created_at INTO v_space_id, v_created_at
        FROM project_space_messages
        WHERE id = p_message_id;

        IF v_user IS NULL THEN
            RAISE EXCEPTION 'User ID cannot be null';
        END IF;

        INSERT INTO public.project_message_read_status (project_space_id, user_id, last_read_at)
        VALUES (v_space_id, v_user, v_created_at)
        ON CONFLICT (project_space_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
        WHERE EXCLUDED.last_read_at > project_message_read_status.last_read_at;
    END;
$$;


ALTER FUNCTION "public"."mark_project_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_room_message_as_seen"("p_message_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."mark_room_message_as_seen"("p_message_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_room_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_room_id uuid;
    v_created_at timestamptz;
    v_user uuid;
BEGIN
    v_user := COALESCE(p_user_id, auth.uid());

    SELECT room_id, created_at INTO v_room_id, v_created_at
    FROM room_messages
    WHERE id = p_message_id;

    IF v_user IS NULL THEN
        RAISE EXCEPTION 'User ID cannot be null';
    END IF;

    -- Update the overall group read status for this user
    INSERT INTO public.room_message_read_status (room_id, user_id, last_read_at)
    VALUES (v_room_id, v_user, v_created_at)
    ON CONFLICT (room_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
    WHERE EXCLUDED.last_read_at > room_message_read_status.last_read_at;
END;
$$;


ALTER FUNCTION "public"."mark_room_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mute_user"("_target_user_id" "uuid", "_duration_hours" integer, "_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."mute_user"("_target_user_id" "uuid", "_duration_hours" integer, "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_gear_alert_match"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        action_url,
        trigger_user_id,
        related_id
    )
    SELECT 
        a.user_id,
        'gear_alert',
        'New Gear Alert Match',
        'A listing matching your alert has been added: ' || NEW.title,
        '/marketplace/' || NEW.id,
        NEW.user_id,
        NEW.id
    FROM public.gear_alerts a
    WHERE (a.category IS NULL OR a.category = NEW.category)
      AND (a.keyword IS NULL OR NEW.title ILIKE '%' || a.keyword || '%')
      AND (a.max_price IS NULL OR NEW.price_per_day <= a.max_price);

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_gear_alert_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_direct_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."notify_new_direct_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_project_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  project_member RECORD;
  sender_name TEXT;
  project_name TEXT;
  parent_project_id UUID;
  formatted_msg TEXT;
BEGIN
  -- Get sender's name
  SELECT COALESCE(full_name, username, 'Someone') INTO sender_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Get project space name and parent project_id
  SELECT name, project_id INTO project_name, parent_project_id
  FROM public.project_spaces
  WHERE id = NEW.project_space_id;

  -- Format content
  formatted_msg := public.format_notification_message(NEW.content);

  -- Create notifications for all project members except the sender
  FOR project_member IN 
    SELECT user_id 
    FROM public.project_space_members 
    WHERE project_space_id = NEW.project_space_id 
    AND user_id != NEW.user_id
  LOOP
    INSERT INTO public.notifications (
      user_id,
      trigger_user_id,
      type,
      title,
      message,
      action_url,
      related_id
    ) VALUES (
      project_member.user_id,
      NEW.user_id,
      'new_message',
      sender_name || ' in ' || COALESCE(project_name, 'Project Space'),
      formatted_msg,
      '/projects/' || parent_project_id || '/space',
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_new_project_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_room_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."notify_new_room_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_project_credit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_project_title text;
    v_director_name text;
BEGIN
    -- Resolve project title
    SELECT title INTO v_project_title FROM public.projects WHERE id = NEW.project_id;
    IF v_project_title IS NULL THEN
        v_project_title := NEW.project_title;
    END IF;

    -- Resolve director (verifier) name
    SELECT full_name INTO v_director_name FROM public.profiles WHERE id = NEW.verifier_id;
    IF v_director_name IS NULL THEN
        v_director_name := 'A director';
    END IF;

    -- Create notification
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
        NEW.user_id,
        'verified_credit',
        'New Verified Credit Tagged!',
        v_director_name || ' tagged you as ' || NEW.role || ' on "' || v_project_title || '".',
        '/profile?tab=credits',
        NEW.id,
        'project_credit',
        'high'
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_project_credit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_room_join_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _actor_name TEXT;
  _room_title TEXT;
  _room_creator UUID;
BEGIN
  -- Get actor name (the user requesting access)
  SELECT COALESCE(full_name, username, 'Someone') INTO _actor_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Get room details and creator
  SELECT title, creator_id INTO _room_title, _room_creator
  FROM public.discussion_rooms
  WHERE id = NEW.room_id;

  -- Notify the creator of the room
  IF _room_creator IS NOT NULL AND _room_creator != NEW.user_id THEN
    INSERT INTO public.notifications (
      user_id,
      trigger_user_id,
      type,
      title,
      message,
      related_id,
      action_url
    ) VALUES (
      _room_creator,
      NEW.user_id,
      'project_invite',
      'Room Access Request',
      _actor_name || ' requested to join your private discussion room "' || COALESCE(_room_title, 'Room') || '"',
      NEW.room_id,
      '/discussion-rooms/' || NEW.room_id || '?openSettings=true&tab=requests'
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_room_join_request"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_room_member_invite"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  _actor_name TEXT;
  _room_title TEXT;
  _is_approval BOOLEAN;
  _msg TEXT;
BEGIN
  -- Get actor name (creator/member who is inviting/approving)
  SELECT COALESCE(full_name, username, 'Someone') INTO _actor_name
  FROM public.profiles
  WHERE id = auth.uid();

  -- Get room details
  SELECT title INTO _room_title
  FROM public.discussion_rooms
  WHERE id = NEW.room_id;

  -- Only notify if the user being added is NOT the one who is adding themselves
  IF NEW.user_id != auth.uid() THEN
    -- Check if it's a join request approval
    SELECT EXISTS (
      SELECT 1 FROM public.room_join_requests
      WHERE room_id = NEW.room_id AND user_id = NEW.user_id
    ) INTO _is_approval;

    IF _is_approval THEN
      _msg := _actor_name || ' approved your request to join the private discussion room "' || COALESCE(_room_title, 'Room') || '"';
    ELSE
      _msg := _actor_name || ' invited you to join the private discussion room "' || COALESCE(_room_title, 'Room') || '"';
    END IF;

    INSERT INTO public.notifications (
      user_id,
      trigger_user_id,
      type,
      title,
      message,
      related_id,
      action_url
    ) VALUES (
      NEW.user_id,
      auth.uid(),
      'project_invite',
      CASE WHEN _is_approval THEN 'Room Access Approved' ELSE 'Invited to Discussion Room' END,
      _msg,
      NEW.room_id,
      '/discussion-rooms/' || NEW.room_id
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_on_room_member_invite"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_page_follower"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    _page_owner_id UUID;
    _page_name TEXT;
    _follower_name TEXT;
BEGIN
    SELECT owner_id, name INTO _page_owner_id, _page_name 
    FROM public.company_pages WHERE id = NEW.page_id;
    
    SELECT COALESCE(full_name, username, 'Someone') INTO _follower_name 
    FROM public.profiles WHERE id = NEW.user_id;
    
    IF _page_owner_id IS NOT NULL AND _page_owner_id != NEW.user_id THEN
        INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
        VALUES (
            _page_owner_id,
            NEW.user_id,
            'page_follower',
            'New Page Follower',
            _follower_name || ' started following "' || _page_name || '".',
            '/pages/' || NEW.page_id,
            NEW.page_id
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_page_follower"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_pitch_submission"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    _pitch_owner_id UUID;
    _pitch_title TEXT;
    _submitter_name TEXT;
BEGIN
    SELECT creator_id, title INTO _pitch_owner_id, _pitch_title 
    FROM public.pitch_calls WHERE id = NEW.pitch_call_id;
    
    SELECT COALESCE(full_name, username, 'Someone') INTO _submitter_name 
    FROM public.profiles WHERE id = NEW.submitter_id;
    
    IF _pitch_owner_id IS NOT NULL AND _pitch_owner_id != NEW.submitter_id THEN
        INSERT INTO public.notifications (user_id, trigger_user_id, type, title, message, action_url, related_id)
        VALUES (
            _pitch_owner_id,
            NEW.submitter_id,
            'pitch_submission',
            'New Pitch Submission',
            _submitter_name || ' submitted a pitch for "' || _pitch_title || '".',
            '/pitches/' || NEW.pitch_call_id,
            NEW.pitch_call_id
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_pitch_submission"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_schedule_locked"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    member_record RECORD;
BEGIN
    IF NEW.is_locked = true AND OLD.is_locked = false THEN
        IF NEW.is_full_crew = true THEN
            -- Notify everyone in the project
            FOR member_record IN 
                SELECT user_id FROM public.project_space_members WHERE project_space_id = NEW.project_id
            LOOP
                INSERT INTO public.notifications (
                    user_id, type, title, message, related_id
                ) VALUES (
                    member_record.user_id, 'schedule_locked', 'Schedule Locked',
                    'A schedule phase ("' || NEW.title || '") has been locked for the entire crew.',
                    NEW.id
                );
            END LOOP;
        ELSE
            -- Notify specific assigned members
            FOR member_record IN 
                SELECT user_id FROM public.schedule_item_assignees WHERE schedule_item_id = NEW.id
            LOOP
                INSERT INTO public.notifications (
                    user_id, type, title, message, related_id
                ) VALUES (
                    member_record.user_id, 'schedule_locked', 'Schedule Locked',
                    'A schedule phase you are assigned to ("' || NEW.title || '") has been locked.',
                    NEW.id
                );
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_schedule_locked"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_wishlist_availability"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        action_url,
        trigger_user_id,
        related_id
    )
    SELECT 
        w.user_id,
        'gear_alert',
        'Wishlisted Item Updated',
        NEW.title || ' has new availability.',
        '/marketplace/' || NEW.id,
        NEW.user_id,
        NEW.id
    FROM public.marketplace_wishlists w
    WHERE w.listing_id = NEW.id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_wishlist_availability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_verification"("_request_id" "uuid", "_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."reject_verification"("_request_id" "uuid", "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_wishlist_on_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    DELETE FROM public.marketplace_wishlists
    WHERE listing_id = NEW.listing_id AND user_id = NEW.renter_id;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."remove_wishlist_on_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_space_access"("p_target_type" "text", "p_target_id" "text", "p_reason_category" "text", "p_reason_details" "text", "p_emergency" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_request_id uuid;
  v_role public.app_role;
  v_expires timestamp with time zone;
BEGIN
  -- Check requester role
  SELECT role INTO v_role FROM public.user_roles WHERE user_id = auth.uid();
  IF v_role IS NULL OR v_role = 'user'::public.app_role THEN
    RAISE EXCEPTION 'Only staff members can request space access.';
  END IF;

  -- Enforce scope boundaries
  -- Moderator: ONLY 'room' targets
  IF v_role = 'moderator'::public.app_role AND p_target_type != 'room' THEN
    RAISE EXCEPTION 'Moderators can only request access to Discussion Rooms.';
  END IF;

  -- Admin: 'room' or 'project_space' targets (NOT 'dm')
  IF v_role = 'admin'::public.app_role AND p_target_type = 'dm' THEN
    RAISE EXCEPTION 'Admins cannot request access to Direct Messages.';
  END IF;

  -- Set default expiration
  v_expires := now() + interval '2 hours';

  -- If emergency override, automatically approve and create grant
  IF p_emergency THEN
    IF v_role NOT IN ('admin'::public.app_role, 'super_admin'::public.app_role) THEN
      RAISE EXCEPTION 'Only Admins and Super Admins can use Emergency Override.';
    END IF;

    -- Create approved request
    INSERT INTO public.space_access_requests (
      requester_id, approver_id, target_type, target_id, 
      reason_category, reason_details, status, emergency_override, expires_at
    ) VALUES (
      auth.uid(), auth.uid(), p_target_type, p_target_id,
      p_reason_category, p_reason_details, 'approved', true, v_expires
    ) RETURNING id INTO v_request_id;

    -- Insert active grant
    INSERT INTO public.space_access_grants (
      request_id, user_id, target_type, target_id, expires_at
    ) VALUES (
      v_request_id, auth.uid(), p_target_type, p_target_id, v_expires
    );

    -- Log emergency override
    INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
    VALUES (
      'chat.emergency_access', auth.uid(), p_target_id, p_target_type, 
      'EMERGENCY OVERRIDE: ' || p_reason_details, 
      jsonb_build_object('reason_category', p_reason_category, 'request_id', v_request_id)
    );

  ELSE
    -- Standard request
    INSERT INTO public.space_access_requests (
      requester_id, target_type, target_id, 
      reason_category, reason_details, status, emergency_override, expires_at
    ) VALUES (
      auth.uid(), p_target_type, p_target_id,
      p_reason_category, p_reason_details, 'pending', false, v_expires
    ) RETURNING id INTO v_request_id;

    -- Log standard request creation
    INSERT INTO public.gov_audit_ledger (action, actor_id, target_id, target_type, reason, payload)
    VALUES (
      'chat.request_access', auth.uid(), p_target_id, p_target_type, 
      'Requested access: ' || p_reason_details, 
      jsonb_build_object('reason_category', p_reason_category, 'request_id', v_request_id)
    );
  END IF;

  RETURN v_request_id;
END;
$$;


ALTER FUNCTION "public"."request_space_access"("p_target_type" "text", "p_target_id" "text", "p_reason_category" "text", "p_reason_details" "text", "p_emergency" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_report"("_report_id" "uuid", "_status" "text", "_note" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."resolve_report"("_report_id" "uuid", "_status" "text", "_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_user_access"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."restore_user_access"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_user_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."revoke_user_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_marketplace_listings"("search_query" "text" DEFAULT NULL::"text", "filter_type" "public"."listing_type" DEFAULT NULL::"public"."listing_type", "filter_category" "text" DEFAULT NULL::"text", "filter_location" "text" DEFAULT NULL::"text", "min_price" numeric DEFAULT NULL::numeric, "max_price" numeric DEFAULT NULL::numeric) RETURNS TABLE("id" "uuid", "user_id" "uuid", "listing_type" "public"."listing_type", "title" "text", "description" "text", "category" "text", "price_per_day" numeric, "price_per_week" numeric, "location" "text", "images" "text"[], "is_active" boolean, "created_at" timestamp with time zone, "average_rating" numeric, "review_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."search_marketplace_listings"("search_query" "text", "filter_type" "public"."listing_type", "filter_category" "text", "filter_location" "text", "min_price" numeric, "max_price" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_vendors"("search_query" "text" DEFAULT NULL::"text", "filter_category" "text" DEFAULT NULL::"text", "filter_location" "text" DEFAULT NULL::"text", "verified_only" boolean DEFAULT false) RETURNS TABLE("id" "uuid", "owner_id" "uuid", "business_name" "text", "description" "text", "category" "text"[], "services_offered" "text"[], "location" "text", "phone" "text", "email" "text", "website" "text", "logo_url" "text", "images" "text"[], "is_verified" boolean, "created_at" timestamp with time zone, "average_rating" numeric, "review_count" bigint)
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."search_vendors"("search_query" "text", "filter_category" "text", "filter_location" "text", "verified_only" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_governance_notification"("_target_user_id" "uuid", "_action_type" "text", "_reason" "text" DEFAULT NULL::"text", "_notify_user" boolean DEFAULT true, "_disclosure_level" "text" DEFAULT 'full'::"text", "_suppression_reason" "text" DEFAULT NULL::"text", "_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."send_governance_notification"("_target_user_id" "uuid", "_action_type" "text", "_reason" "text", "_notify_user" boolean, "_disclosure_level" "text", "_suppression_reason" "text", "_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_monetization_status"("_user_id" "uuid", "_disabled" boolean, "_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."set_monetization_status"("_user_id" "uuid", "_disabled" boolean, "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."shadow_ban_user"("_target_user_id" "uuid", "_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."shadow_ban_user"("_target_user_id" "uuid", "_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_is_internal_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."sync_is_internal_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_official_team_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.role IN ('moderator', 'admin', 'super_admin') THEN
    UPDATE public.profiles SET is_official_team = true WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles SET is_official_team = false WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_official_team_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_discussion_room_member_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.discussion_rooms
        SET member_count = member_count + 1
        WHERE id = NEW.room_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.discussion_rooms
        SET member_count = GREATEST(0, member_count - 1)
        WHERE id = OLD.room_id;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_discussion_room_member_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_listing_condition_score"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.listing_id IS NOT NULL AND NEW.condition_rating IS NOT NULL THEN
        UPDATE public.marketplace_listings
        SET condition_score = (
            SELECT COALESCE(AVG(condition_rating), 0)::NUMERIC(3, 2)
            FROM public.marketplace_reviews
            WHERE listing_id = NEW.listing_id AND condition_rating IS NOT NULL
        )
        WHERE id = NEW.listing_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_listing_condition_score"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_page_follower_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE company_pages SET follower_count = follower_count + 1 WHERE id = NEW.page_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE company_pages SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.page_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_page_follower_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pitch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pitch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_post_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_review_helpful_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.film_reviews
        SET helpful_count = helpful_count + 1
        WHERE id = NEW.review_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.film_reviews
        SET helpful_count = helpful_count - 1
        WHERE id = OLD.review_id;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_review_helpful_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "posted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "author_id" "uuid",
    "publisher_page_id" "uuid"
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text" NOT NULL,
    "action" "text" NOT NULL,
    "target_type" "text",
    "target_id" "text",
    "metadata" "jsonb",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budget_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "item_name" "text" NOT NULL,
    "estimated_cost" numeric,
    "actual_cost" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."budget_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."call_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "call_id" "uuid",
    "user_id" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "left_at" timestamp with time zone
);


ALTER TABLE "public"."call_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."call_sheets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "call_time" "text",
    "location" "text",
    "director" "text",
    "director_phone" "text",
    "producer" "text",
    "producer_phone" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."call_sheets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "created_by" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "type" "text" DEFAULT 'audio'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "daily_room_name" "text",
    "daily_room_url" "text",
    "room_type" "text",
    "started_at" timestamp with time zone,
    "started_by" "uuid",
    CONSTRAINT "calls_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'ended'::"text"]))),
    CONSTRAINT "calls_type_check" CHECK (("type" = ANY (ARRAY['audio'::"text", 'video'::"text"])))
);

ALTER TABLE ONLY "public"."calls" REPLICA IDENTITY FULL;


ALTER TABLE "public"."calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_page_admins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'admin'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "company_page_admins_role_check" CHECK (("role" = ANY (ARRAY['super_admin'::"text", 'content_admin'::"text", 'analyst'::"text"])))
);


ALTER TABLE "public"."company_page_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_page_followers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_page_followers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_page_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "department" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_page_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "tagline" "text",
    "description" "text",
    "logo_url" "text",
    "cover_image_url" "text",
    "industry" "text"[] DEFAULT '{}'::"text"[],
    "company_size" "text",
    "founded_year" integer,
    "headquarters" "text",
    "website" "text",
    "email" "text",
    "phone" "text",
    "specialties" "text"[] DEFAULT '{}'::"text"[],
    "is_verified" boolean DEFAULT false,
    "follower_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "company_pages_company_size_check" CHECK (("company_size" = ANY (ARRAY['1-10'::"text", '11-50'::"text", '51-200'::"text", '201-500'::"text", '501-1000'::"text", '1001-5000'::"text", '5000+'::"text"])))
);


ALTER TABLE "public"."company_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reported_by" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "details" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "resolution_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "assigned_to" "uuid",
    "priority" "text" DEFAULT 'medium'::"text",
    "escalation_level" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "content_reports_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "content_reports_reason_check" CHECK (("reason" = ANY (ARRAY['spam'::"text", 'harassment'::"text", 'hate_speech'::"text", 'misinformation'::"text", 'explicit_content'::"text", 'impersonation'::"text", 'fraud'::"text", 'other'::"text"]))),
    CONSTRAINT "content_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewing'::"text", 'resolved'::"text", 'dismissed'::"text"]))),
    CONSTRAINT "content_reports_target_type_check" CHECK (("target_type" = ANY (ARRAY['post'::"text", 'comment'::"text", 'user'::"text", 'job'::"text", 'listing'::"text", 'room'::"text", 'message'::"text"])))
);


ALTER TABLE "public"."content_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user1_id" "uuid" NOT NULL,
    "user2_id" "uuid" NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."direct_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid",
    "receiver_id" "uuid",
    "content" "text",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "channel_id" "text",
    "reply_to_id" "uuid",
    "is_deleted" boolean DEFAULT false,
    "deleted_for_users" "uuid"[] DEFAULT '{}'::"uuid"[],
    "attachment_url" "text",
    "attachment_type" "text"
);

ALTER TABLE ONLY "public"."direct_messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."direct_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discussion_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_public" boolean DEFAULT true,
    "member_count" integer DEFAULT 0,
    "room_type" "text" DEFAULT 'public'::"text",
    "project_id" "uuid",
    "creator_id" "uuid",
    "category_id" "uuid",
    "tags" "text"[],
    "settings" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."discussion_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "size" numeric NOT NULL,
    "file_type" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."film_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tmdb_id" integer,
    "review_text" "text" NOT NULL,
    "is_spoiler" boolean DEFAULT false,
    "helpful_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_anonymous" boolean DEFAULT false,
    "platform_cinema_id" "uuid"
);


ALTER TABLE "public"."film_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flagged_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "channel_id" "uuid",
    "target_type" "text" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "decrypted_content" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    CONSTRAINT "flagged_messages_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'reviewed'::"text", 'resolved'::"text"]))),
    CONSTRAINT "flagged_messages_target_type_check" CHECK (("target_type" = ANY (ARRAY['dm'::"text", 'project_space'::"text", 'room'::"text"])))
);


ALTER TABLE "public"."flagged_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fraud_networks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "risk_level" "text" DEFAULT 'high'::"text",
    "associated_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "associated_ips" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "fraud_networks_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."fraud_networks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gear_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "category" "text",
    "keyword" "text",
    "max_price" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gear_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_space_members" (
    "project_space_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_space_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_item_assignees" (
    "schedule_item_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."schedule_item_assignees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_locked" boolean DEFAULT false NOT NULL,
    "is_full_crew" boolean DEFAULT false NOT NULL,
    "status" "text",
    "assigned_to" "text"
);


ALTER TABLE "public"."schedule_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "text" DEFAULT 'free'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_availability_status_check" CHECK (("status" = ANY (ARRAY['free'::"text", 'tentative'::"text", 'booked'::"text"])))
);


ALTER TABLE "public"."user_availability" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."global_user_availability_view" WITH ("security_invoker"='on') AS
 SELECT ("user_availability"."id")::"text" AS "id",
    "user_availability"."user_id",
    "user_availability"."start_date",
    "user_availability"."end_date",
    "user_availability"."status",
    "user_availability"."notes",
    'personal'::"text" AS "source_type",
    NULL::"uuid" AS "source_project_id"
   FROM "public"."user_availability"
UNION ALL
 SELECT ((("si"."id")::"text" || '-'::"text") || ("sia"."user_id")::"text") AS "id",
    "sia"."user_id",
    "si"."start_date",
    COALESCE("si"."end_date", "si"."start_date") AS "end_date",
    'booked'::"text" AS "status",
    ('Booked for project schedule: '::"text" || "si"."title") AS "notes",
    'schedule'::"text" AS "source_type",
    "si"."project_id" AS "source_project_id"
   FROM ("public"."schedule_item_assignees" "sia"
     JOIN "public"."schedule_items" "si" ON (("si"."id" = "sia"."schedule_item_id")))
  WHERE (("si"."is_locked" = true) AND ("si"."is_full_crew" = false))
UNION ALL
 SELECT ((("si"."id")::"text" || '-'::"text") || ("pm"."user_id")::"text") AS "id",
    "pm"."user_id",
    "si"."start_date",
    COALESCE("si"."end_date", "si"."start_date") AS "end_date",
    'booked'::"text" AS "status",
    ('Booked for full-crew project schedule: '::"text" || "si"."title") AS "notes",
    'schedule'::"text" AS "source_type",
    "si"."project_id" AS "source_project_id"
   FROM ("public"."schedule_items" "si"
     JOIN "public"."project_space_members" "pm" ON (("pm"."project_space_id" = "si"."project_id")))
  WHERE (("si"."is_full_crew" = true) AND ("si"."is_locked" = true));


ALTER VIEW "public"."global_user_availability_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gov_approval_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "maker_id" "uuid",
    "checker_id" "uuid",
    "action" "text",
    "target_id" "text",
    "target_type" "text",
    "reason" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text"
);


ALTER TABLE "public"."gov_approval_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gov_audit_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "action" "text",
    "actor_id" "uuid",
    "target_id" "text",
    "target_type" "text",
    "reason" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "prev_state" "jsonb" DEFAULT '{}'::"jsonb",
    "new_state" "jsonb" DEFAULT '{}'::"jsonb",
    "before_state" "jsonb" DEFAULT '{}'::"jsonb",
    "after_state" "jsonb" DEFAULT '{}'::"jsonb",
    "scope" "jsonb" DEFAULT '{"global": true}'::"jsonb"
);


ALTER TABLE "public"."gov_audit_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gov_entity_relationships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "ip_address" "text",
    "device_id" "text",
    "timestamp" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gov_entity_relationships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_keys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "encrypted_symmetric_key" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_keys_target_type_check" CHECK (("target_type" = ANY (ARRAY['room'::"text", 'project_space'::"text"])))
);


ALTER TABLE "public"."group_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "keywords" "text"[],
    "categories" "text"[],
    "location" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email_notifications" boolean DEFAULT true
);


ALTER TABLE "public"."job_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "applicant_id" "uuid" NOT NULL,
    "cover_letter" "text",
    "resume_url" "text",
    "status" "public"."job_application_status" DEFAULT 'pending'::"public"."job_application_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "showreel_url" "text",
    "is_shortlisted" boolean DEFAULT false
);


ALTER TABLE "public"."job_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_bookmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_bookmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_saved_searches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "name" "text",
    "filters" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."job_saved_searches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "company" "text" NOT NULL,
    "location" "text",
    "type" "public"."job_type" DEFAULT 'full-time'::"public"."job_type" NOT NULL,
    "salary_min" numeric,
    "salary_max" numeric,
    "experience_level" "public"."experience_level" DEFAULT 'mid'::"public"."experience_level" NOT NULL,
    "requirements" "text",
    "posted_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "page_id" "uuid",
    "auto_close_on_hire" boolean DEFAULT false
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."key_backups" (
    "user_id" "uuid" NOT NULL,
    "encrypted_private_key" "text" NOT NULL,
    "salt" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."key_backups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legal_docs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "document_type" "text",
    "url" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."legal_docs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legal_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "text" NOT NULL,
    "requester_name" "text" NOT NULL,
    "requester_entity" "text" NOT NULL,
    "request_type" "text" NOT NULL,
    "target_user_id" "uuid",
    "target_content_id" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "evidence_url" "text",
    "internal_notes" "text",
    "deadline_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "legal_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'under_review'::"text", 'fulfilled'::"text", 'rejected'::"text", 'legal_hold'::"text"])))
);


ALTER TABLE "public"."legal_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "renter_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "status" "public"."booking_status" DEFAULT 'pending'::"public"."booking_status",
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_date_range" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."marketplace_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_bundle_items" (
    "bundle_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL
);


ALTER TABLE "public"."marketplace_bundle_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "listing_type" "public"."listing_type" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "price_per_day" numeric(10,2) NOT NULL,
    "price_per_week" numeric(10,2),
    "location" "text" NOT NULL,
    "images" "text"[] DEFAULT '{}'::"text"[],
    "specifications" "jsonb" DEFAULT '{}'::"jsonb",
    "availability_calendar" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_bundle" boolean DEFAULT false,
    "condition_grade" "public"."equipment_condition",
    "condition_score" numeric(3,2) DEFAULT 0.0,
    "admin_flagged" boolean DEFAULT false
);


ALTER TABLE "public"."marketplace_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid",
    "vendor_id" "uuid",
    "reviewer_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "review_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "booking_id" "uuid",
    "condition_rating" integer,
    CONSTRAINT "marketplace_reviews_condition_rating_check" CHECK ((("condition_rating" >= 1) AND ("condition_rating" <= 5))),
    CONSTRAINT "marketplace_reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "review_target" CHECK (((("listing_id" IS NOT NULL) AND ("vendor_id" IS NULL)) OR (("listing_id" IS NULL) AND ("vendor_id" IS NOT NULL))))
);


ALTER TABLE "public"."marketplace_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_wishlists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."marketplace_wishlists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moderation_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "uploader_id" "uuid" NOT NULL,
    "evidence_url" "text" NOT NULL,
    "evidence_type" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."moderation_evidence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moderation_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_internal" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."moderation_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_user_id" "uuid",
    "action_type" "text" NOT NULL,
    "decision" "text" NOT NULL,
    "disclosure_level" "text",
    "suppression_reason" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "notification_logs_decision_check" CHECK (("decision" = ANY (ARRAY['notified'::"text", 'suppressed'::"text", 'delayed'::"text"]))),
    CONSTRAINT "notification_logs_disclosure_level_check" CHECK (("disclosure_level" = ANY (ARRAY['full'::"text", 'limited'::"text", 'none'::"text"])))
);


ALTER TABLE "public"."notification_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "action_url" "text",
    "related_id" "uuid",
    "is_read" boolean DEFAULT false,
    "metadata" "jsonb",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "trigger_user_id" "uuid"
);

ALTER TABLE ONLY "public"."notifications" REPLICA IDENTITY FULL;


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pitch_access_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "pitch_submission_id" "uuid",
    "accessed_by" "uuid",
    "action" "text" NOT NULL,
    CONSTRAINT "pitch_access_logs_action_check" CHECK (("action" = ANY (ARRAY['viewed'::"text", 'full_synopsis_viewed'::"text", 'attachment_downloaded'::"text"])))
);


ALTER TABLE "public"."pitch_access_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pitch_calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "creator_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text",
    "project_type" "text" NOT NULL,
    "genre" "text"[] DEFAULT '{}'::"text"[],
    "subgenre" "text",
    "language" "text"[] DEFAULT '{}'::"text"[],
    "format" "text",
    "target_audience" "text",
    "budget_range" "text",
    "compensation" "text",
    "requirement_description" "text" NOT NULL,
    "tone" "text",
    "ref_films" "text",
    "deadline" "date",
    "is_open_to_debut" boolean DEFAULT false,
    "is_regional_welcome" boolean DEFAULT false,
    "rights_expectation" "text",
    "nda_required" boolean DEFAULT false,
    "status" "text" DEFAULT 'open'::"text",
    "is_published" boolean DEFAULT true,
    "view_count" bigint DEFAULT 0,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "pitch_calls_budget_range_check" CHECK (("budget_range" = ANY (ARRAY['micro'::"text", 'low'::"text", 'mid'::"text", 'high'::"text", 'studio'::"text", 'undisclosed'::"text"]))),
    CONSTRAINT "pitch_calls_compensation_check" CHECK (("compensation" = ANY (ARRAY['paid'::"text", 'unpaid'::"text", 'development_deal'::"text", 'revenue_share'::"text", 'negotiable'::"text"]))),
    CONSTRAINT "pitch_calls_format_check" CHECK (("format" = ANY (ARRAY['film'::"text", 'series'::"text", 'short'::"text", 'documentary'::"text", 'youtube'::"text", 'animation'::"text", 'branded'::"text"]))),
    CONSTRAINT "pitch_calls_project_type_check" CHECK (("project_type" = ANY (ARRAY['film'::"text", 'series'::"text", 'short'::"text", 'documentary'::"text", 'youtube'::"text", 'animation'::"text", 'branded'::"text", 'other'::"text"]))),
    CONSTRAINT "pitch_calls_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'paused'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."pitch_calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pitch_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "pitch_call_id" "uuid" NOT NULL,
    "submitter_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "logline" "text" NOT NULL,
    "short_synopsis" "text" NOT NULL,
    "full_synopsis" "text",
    "genre" "text",
    "format" "text",
    "language" "text",
    "tone" "text",
    "why_fits" "text",
    "rights_owned" boolean DEFAULT true,
    "is_original_work" boolean DEFAULT true,
    "treatment_url" "text",
    "lookbook_url" "text",
    "moodboard_url" "text",
    "character_notes" "text",
    "pilot_outline" "text",
    "reference_links" "text"[],
    "status" "text" DEFAULT 'submitted'::"text",
    "nda_preferred" boolean DEFAULT false,
    "seen_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "shortlisted_at" timestamp with time zone,
    "passed_at" timestamp with time zone,
    CONSTRAINT "pitch_submissions_status_check" CHECK (("status" = ANY (ARRAY['submitted'::"text", 'seen'::"text", 'under_review'::"text", 'shortlisted'::"text", 'interested'::"text", 'request_full_deck'::"text", 'invite_to_discuss'::"text", 'passed'::"text", 'closed'::"text", 'collaborating'::"text"])))
);


ALTER TABLE "public"."pitch_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" DEFAULT 'info'::"text",
    "target_audience" "text" DEFAULT 'all'::"text",
    "is_active" boolean DEFAULT true,
    "expires_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "platform_announcements_target_audience_check" CHECK (("target_audience" = ANY (ARRAY['all'::"text", 'creators'::"text", 'fans'::"text", 'studios'::"text"]))),
    CONSTRAINT "platform_announcements_type_check" CHECK (("type" = ANY (ARRAY['info'::"text", 'warning'::"text", 'maintenance'::"text", 'update'::"text"])))
);


ALTER TABLE "public"."platform_announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_cinema" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "creator_id" "uuid",
    "title" "text" NOT NULL,
    "type" "text" NOT NULL,
    "overview" "text",
    "poster_url" "text",
    "backdrop_url" "text",
    "trailer_url" "text",
    "release_date" "date" DEFAULT CURRENT_DATE,
    "genre" "text"[],
    "runtime" integer,
    "credits" "jsonb" DEFAULT '[]'::"jsonb",
    "is_published" boolean DEFAULT true,
    "view_count" bigint DEFAULT 0,
    "gallery" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "platform_cinema_type_check" CHECK (("type" = ANY (ARRAY['movie'::"text", 'tv'::"text", 'short'::"text", 'ad'::"text"])))
);


ALTER TABLE "public"."platform_cinema" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" boolean DEFAULT true,
    "description" "text",
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."platform_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "category" "text" DEFAULT 'moderation'::"text",
    "description" "text",
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portfolio_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "media_url" "text",
    "media_type" "text",
    "role" "text",
    "project_type" "text",
    "completion_date" "date",
    "tags" "text"[],
    "is_featured" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."portfolio_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_bookmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "post_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_bookmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "media_urls" "text"[],
    "media_type" "text",
    "tags" "text"[],
    "like_count" integer DEFAULT 0,
    "comment_count" integer DEFAULT 0,
    "share_count" integer DEFAULT 0,
    "has_ai_generated" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "page_id" "uuid",
    "media_url" "text" GENERATED ALWAYS AS ("media_urls"[1]) STORED
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "viewer_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."profile_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "username" "text",
    "full_name" "text",
    "avatar_url" "text",
    "cover_image_url" "text",
    "website" "text",
    "bio" "text",
    "location" "text",
    "experience" "text",
    "craft" "text",
    "instagram_url" "text",
    "youtube_url" "text",
    "account_type" "text" DEFAULT 'talent'::"text",
    "social_links" "jsonb" DEFAULT '{}'::"jsonb",
    "is_studio" boolean DEFAULT false,
    "onboarding_completed" boolean DEFAULT false,
    "is_verified" boolean DEFAULT false,
    "is_banned" boolean DEFAULT false,
    "phone" "text",
    "trust_score" integer DEFAULT 100,
    "last_muted_at" timestamp with time zone,
    "mute_expires_at" timestamp with time zone,
    "shadow_banned_at" timestamp with time zone,
    "restriction_flags" "text"[] DEFAULT '{}'::"text"[],
    "is_official_team" boolean DEFAULT false,
    "sessions_revoked_at" timestamp with time zone,
    "force_password_reset" boolean DEFAULT false,
    "is_internal" boolean DEFAULT false,
    "is_shadowbanned" boolean DEFAULT false,
    "push_token" "text",
    "public_key" "text",
    "encrypted_private_key" "text",
    "availability_status" "text" DEFAULT 'available'::"text",
    "day_rate_min" numeric,
    "day_rate_max" numeric,
    "union_membership" "text"[] DEFAULT '{}'::"text"[],
    "wishlist_share_token" "uuid" DEFAULT "gen_random_uuid"(),
    CONSTRAINT "profiles_account_type_check" CHECK (("account_type" = ANY (ARRAY['talent'::"text", 'creator'::"text", 'studio'::"text", 'fan'::"text"]))),
    CONSTRAINT "profiles_availability_status_check" CHECK (("availability_status" = ANY (ARRAY['available'::"text", 'busy'::"text", 'unavailable'::"text"]))),
    CONSTRAINT "username_length" CHECK (("char_length"("username") >= 3))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "cover_letter" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."project_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_credits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "project_title" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "verifier_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_message_read_status" (
    "project_space_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."project_message_read_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid",
    "user_id" "uuid",
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reply_to_id" "uuid",
    "is_deleted" boolean DEFAULT false,
    "deleted_for_users" "uuid"[] DEFAULT '{}'::"uuid"[]
);


ALTER TABLE "public"."project_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_space_bookmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_space_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_space_bookmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_space_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."project_space_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_space_join_requests" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_space_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL
);


ALTER TABLE "public"."project_space_join_requests" OWNER TO "postgres";


ALTER TABLE "public"."project_space_join_requests" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."project_space_join_requests_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."project_space_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_space_id" "uuid",
    "user_id" "uuid",
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reply_to_id" "uuid",
    "is_deleted" boolean DEFAULT false,
    "deleted_for_users" "uuid"[] DEFAULT '{}'::"uuid"[],
    "attachment_url" "text",
    "attachment_type" "text"
);

ALTER TABLE ONLY "public"."project_space_messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."project_space_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_spaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "creator_id" "uuid",
    "category_id" "uuid",
    "tags" "text"[],
    "last_activity_at" timestamp with time zone DEFAULT "now"(),
    "project_space_type" "public"."project_space_type" DEFAULT 'public'::"public"."project_space_type",
    "status" "text",
    "location" "text",
    "genre" "text"[],
    "required_roles" "text"[],
    "budget_min" numeric,
    "budget_max" numeric,
    "start_date" "date",
    "end_date" "date",
    "project_id" "uuid"
);


ALTER TABLE "public"."project_spaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "creator_id" "uuid",
    "status" "text" DEFAULT 'draft'::"text",
    "start_date" "date",
    "end_date" "date",
    "location" "text",
    "budget_min" numeric,
    "budget_max" numeric,
    "is_public" boolean DEFAULT true,
    "genre" "text"[],
    "required_roles" "text"[],
    "current_team" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "image_url" "text"
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_helpful_marks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."review_helpful_marks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."room_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_join_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "message" "text"
);


ALTER TABLE "public"."room_join_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_members" (
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'member'::"text"
);


ALTER TABLE "public"."room_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_message_read_status" (
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."room_message_read_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text",
    "media_url" "text",
    "media_type" "text",
    "is_deleted" boolean DEFAULT false,
    "reply_to_id" "uuid",
    "deleted_for_users" "uuid"[] DEFAULT '{}'::"uuid"[]
);

ALTER TABLE ONLY "public"."room_messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."room_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_pitch_calls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid" NOT NULL,
    "pitch_call_id" "uuid" NOT NULL
);


ALTER TABLE "public"."saved_pitch_calls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "device_id" "text",
    "ip_address" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "severity" "text" DEFAULT 'info'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."security_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shot_list" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "scene" numeric NOT NULL,
    "shot" numeric NOT NULL,
    "description" "text" NOT NULL,
    "notes" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."shot_list" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."space_access_grants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."space_access_grants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."space_access_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "approver_id" "uuid",
    "target_type" "text" NOT NULL,
    "target_id" "text" NOT NULL,
    "reason_category" "text" NOT NULL,
    "reason_details" "text" NOT NULL,
    "ticket_reference" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "emergency_override" boolean DEFAULT false,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "space_access_requests_reason_category_check" CHECK (("reason_category" = ANY (ARRAY['harassment'::"text", 'fraud'::"text", 'data_leak'::"text", 'bug_troubleshooting'::"text", 'emergency'::"text"]))),
    CONSTRAINT "space_access_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'expired'::"text"]))),
    CONSTRAINT "space_access_requests_target_type_check" CHECK (("target_type" = ANY (ARRAY['room'::"text", 'project_space'::"text", 'dm'::"text"])))
);


ALTER TABLE "public"."space_access_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_ticket_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_internal" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."support_ticket_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "status" "text" DEFAULT 'open'::"text",
    "assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "support_tickets_category_check" CHECK (("category" = ANY (ARRAY['general'::"text", 'technical'::"text", 'billing'::"text", 'report_abuse'::"text", 'feature_request'::"text"]))),
    CONSTRAINT "support_tickets_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "support_tickets_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "action_url" "text",
    "image_url" "text",
    "send_push" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_by" "uuid"
);

ALTER TABLE ONLY "public"."system_announcements" REPLICA IDENTITY FULL;


ALTER TABLE "public"."system_announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "severity" "text" DEFAULT 'medium'::"text",
    "status" "text" DEFAULT 'investigating'::"text",
    "impact_description" "text",
    "maintenance_mode_required" boolean DEFAULT false,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    CONSTRAINT "system_incidents_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "system_incidents_status_check" CHECK (("status" = ANY (ARRAY['investigating'::"text", 'identified'::"text", 'monitoring'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."system_incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_space_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "due_date" "date",
    "assignee_id" "uuid",
    "is_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_announcement_dismissals" (
    "user_id" "uuid" NOT NULL,
    "announcement_id" "uuid" NOT NULL,
    "dismissed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_announcement_dismissals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_bans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "banned_by" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "ban_type" "text" DEFAULT 'temporary'::"text",
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "lifted_at" timestamp with time zone,
    "lifted_by" "uuid",
    CONSTRAINT "user_bans_ban_type_check" CHECK (("ban_type" = ANY (ARRAY['temporary'::"text", 'permanent'::"text"])))
);


ALTER TABLE "public"."user_bans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_connections_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text"])))
);


ALTER TABLE "public"."user_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_experience" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "company" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_experience" OWNER TO "postgres";


ALTER TABLE "public"."user_experience" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_experience_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_film_ratings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "tmdb_id" integer,
    "rating" numeric NOT NULL,
    "review" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "platform_cinema_id" "uuid",
    CONSTRAINT "user_film_ratings_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (5)::numeric)))
);


ALTER TABLE "public"."user_film_ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "device_id" "text",
    "platform" "text",
    "active" boolean DEFAULT true NOT NULL,
    "last_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_push_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_risk_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_hashes" "text"[] DEFAULT '{}'::"text"[],
    "known_ips" "text"[] DEFAULT '{}'::"text"[],
    "ip_risk_score" integer DEFAULT 0,
    "is_vpn_detected" boolean DEFAULT false,
    "is_proxy_detected" boolean DEFAULT false,
    "last_updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_risk_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" DEFAULT 'user'::"public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_id" "text" NOT NULL,
    "refresh_token_hash" "text" NOT NULL,
    "device_name" "text",
    "platform" "text",
    "app_version" "text",
    "ip_address" "text",
    "last_active_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "is_current" boolean DEFAULT false,
    "trusted" boolean DEFAULT false,
    "suspicious" boolean DEFAULT false
);


ALTER TABLE "public"."user_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "email_notifications" boolean DEFAULT true,
    "push_notifications" boolean DEFAULT true,
    "profile_privacy" "text" DEFAULT 'public'::"text",
    "theme" "text" DEFAULT 'dark'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_settings_profile_privacy_check" CHECK (("profile_privacy" = ANY (ARRAY['public'::"text", 'private'::"text"])))
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_skills" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "skill_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_skills" OWNER TO "postgres";


ALTER TABLE "public"."user_skills" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_skills_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."vendor_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendor_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "day_rate" numeric NOT NULL,
    "coverage_area" "text" NOT NULL,
    "min_booking_days" integer DEFAULT 1,
    "production_types" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "crew_capacity" integer,
    "service_checklist" "jsonb" DEFAULT '[]'::"jsonb",
    "images" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vendor_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "business_name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text"[] NOT NULL,
    "services_offered" "text"[] DEFAULT '{}'::"text"[],
    "location" "text" NOT NULL,
    "address" "text",
    "phone" "text" NOT NULL,
    "email" "text" NOT NULL,
    "website" "text",
    "logo_url" "text",
    "images" "text"[] DEFAULT '{}'::"text"[],
    "is_verified" boolean DEFAULT false,
    "verification_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."verification_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "request_type" "text" NOT NULL,
    "full_legal_name" "text" NOT NULL,
    "government_id_url" "text",
    "supporting_doc_url" "text",
    "social_links" "jsonb",
    "reason" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "rejection_reason" "text",
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "verification_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['creator'::"text", 'professional'::"text", 'public_figure'::"text", 'company'::"text"]))),
    CONSTRAINT "verification_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'under_review'::"text", 'approved'::"text", 'rejected'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."verification_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vip_invites" (
    "code" "text" NOT NULL,
    "created_by" "uuid",
    "is_used" boolean DEFAULT false,
    "used_by_id" "uuid",
    "role_granted" "text" DEFAULT 'creator_pro'::"text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vip_invites" OWNER TO "postgres";


ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budget_items"
    ADD CONSTRAINT "budget_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_participants"
    ADD CONSTRAINT "call_participants_call_id_user_id_key" UNIQUE ("call_id", "user_id");



ALTER TABLE ONLY "public"."call_participants"
    ADD CONSTRAINT "call_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."call_sheets"
    ADD CONSTRAINT "call_sheets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_page_admins"
    ADD CONSTRAINT "company_page_admins_page_id_user_id_key" UNIQUE ("page_id", "user_id");



ALTER TABLE ONLY "public"."company_page_admins"
    ADD CONSTRAINT "company_page_admins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_page_followers"
    ADD CONSTRAINT "company_page_followers_page_id_user_id_key" UNIQUE ("page_id", "user_id");



ALTER TABLE ONLY "public"."company_page_followers"
    ADD CONSTRAINT "company_page_followers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_page_members"
    ADD CONSTRAINT "company_page_members_page_id_user_id_key" UNIQUE ("page_id", "user_id");



ALTER TABLE ONLY "public"."company_page_members"
    ADD CONSTRAINT "company_page_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_pages"
    ADD CONSTRAINT "company_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_pages"
    ADD CONSTRAINT "company_pages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user1_id_user2_id_key" UNIQUE ("user1_id", "user2_id");



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discussion_rooms"
    ADD CONSTRAINT "discussion_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."film_reviews"
    ADD CONSTRAINT "film_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."film_reviews"
    ADD CONSTRAINT "film_reviews_user_cinema_unique" UNIQUE ("user_id", "platform_cinema_id");



ALTER TABLE ONLY "public"."film_reviews"
    ADD CONSTRAINT "film_reviews_user_id_tmdb_id_key" UNIQUE ("user_id", "tmdb_id");



ALTER TABLE ONLY "public"."film_reviews"
    ADD CONSTRAINT "film_reviews_user_tmdb_unique" UNIQUE ("user_id", "tmdb_id");



ALTER TABLE ONLY "public"."flagged_messages"
    ADD CONSTRAINT "flagged_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fraud_networks"
    ADD CONSTRAINT "fraud_networks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gear_alerts"
    ADD CONSTRAINT "gear_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gov_approval_queue"
    ADD CONSTRAINT "gov_approval_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gov_audit_ledger"
    ADD CONSTRAINT "gov_audit_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gov_entity_relationships"
    ADD CONSTRAINT "gov_entity_relationships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_keys"
    ADD CONSTRAINT "group_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_keys"
    ADD CONSTRAINT "group_keys_target_type_target_id_user_id_key" UNIQUE ("target_type", "target_id", "user_id");



ALTER TABLE ONLY "public"."job_alerts"
    ADD CONSTRAINT "job_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_job_id_applicant_id_key" UNIQUE ("job_id", "applicant_id");



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_bookmarks"
    ADD CONSTRAINT "job_bookmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_bookmarks"
    ADD CONSTRAINT "job_bookmarks_user_id_job_id_key" UNIQUE ("user_id", "job_id");



ALTER TABLE ONLY "public"."job_saved_searches"
    ADD CONSTRAINT "job_saved_searches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."key_backups"
    ADD CONSTRAINT "key_backups_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."legal_docs"
    ADD CONSTRAINT "legal_docs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_requests"
    ADD CONSTRAINT "legal_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_requests"
    ADD CONSTRAINT "legal_requests_request_id_key" UNIQUE ("request_id");



ALTER TABLE ONLY "public"."marketplace_bookings"
    ADD CONSTRAINT "marketplace_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_bundle_items"
    ADD CONSTRAINT "marketplace_bundle_items_pkey" PRIMARY KEY ("bundle_id", "item_id");



ALTER TABLE ONLY "public"."marketplace_listings"
    ADD CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_reviews"
    ADD CONSTRAINT "marketplace_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_wishlists"
    ADD CONSTRAINT "marketplace_wishlists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_wishlists"
    ADD CONSTRAINT "marketplace_wishlists_user_id_listing_id_key" UNIQUE ("user_id", "listing_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderation_evidence"
    ADD CONSTRAINT "moderation_evidence_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderation_notes"
    ADD CONSTRAINT "moderation_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pitch_access_logs"
    ADD CONSTRAINT "pitch_access_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pitch_calls"
    ADD CONSTRAINT "pitch_calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pitch_calls"
    ADD CONSTRAINT "pitch_calls_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."pitch_submissions"
    ADD CONSTRAINT "pitch_submissions_pitch_call_id_submitter_id_key" UNIQUE ("pitch_call_id", "submitter_id");



ALTER TABLE ONLY "public"."pitch_submissions"
    ADD CONSTRAINT "pitch_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_announcements"
    ADD CONSTRAINT "platform_announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_cinema"
    ADD CONSTRAINT "platform_cinema_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_flags"
    ADD CONSTRAINT "platform_flags_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."platform_flags"
    ADD CONSTRAINT "platform_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_policies"
    ADD CONSTRAINT "platform_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_policies"
    ADD CONSTRAINT "platform_policies_type_key" UNIQUE ("type");



ALTER TABLE ONLY "public"."platform_rules"
    ADD CONSTRAINT "platform_rules_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."platform_rules"
    ADD CONSTRAINT "platform_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."portfolio_items"
    ADD CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_bookmarks"
    ADD CONSTRAINT "post_bookmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_bookmarks"
    ADD CONSTRAINT "post_bookmarks_user_id_post_id_key" UNIQUE ("user_id", "post_id");



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_views"
    ADD CONSTRAINT "profile_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."project_applications"
    ADD CONSTRAINT "project_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_applications"
    ADD CONSTRAINT "project_applications_project_id_user_id_key" UNIQUE ("project_id", "user_id");



ALTER TABLE ONLY "public"."project_credits"
    ADD CONSTRAINT "project_credits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_credits"
    ADD CONSTRAINT "project_credits_uniq" UNIQUE ("project_id", "user_id", "role");



ALTER TABLE ONLY "public"."project_message_read_status"
    ADD CONSTRAINT "project_message_read_status_pkey" PRIMARY KEY ("project_space_id", "user_id");



ALTER TABLE ONLY "public"."project_messages"
    ADD CONSTRAINT "project_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_space_bookmarks"
    ADD CONSTRAINT "project_space_bookmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_space_bookmarks"
    ADD CONSTRAINT "project_space_bookmarks_user_id_project_space_id_key" UNIQUE ("user_id", "project_space_id");



ALTER TABLE ONLY "public"."project_space_categories"
    ADD CONSTRAINT "project_space_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."project_space_categories"
    ADD CONSTRAINT "project_space_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_space_join_requests"
    ADD CONSTRAINT "project_space_join_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_space_members"
    ADD CONSTRAINT "project_space_members_pkey" PRIMARY KEY ("project_space_id", "user_id");



ALTER TABLE ONLY "public"."project_space_messages"
    ADD CONSTRAINT "project_space_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_spaces"
    ADD CONSTRAINT "project_spaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_spaces"
    ADD CONSTRAINT "project_spaces_project_id_key" UNIQUE ("project_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_helpful_marks"
    ADD CONSTRAINT "review_helpful_marks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_helpful_marks"
    ADD CONSTRAINT "review_helpful_marks_review_id_user_id_key" UNIQUE ("review_id", "user_id");



ALTER TABLE ONLY "public"."room_categories"
    ADD CONSTRAINT "room_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."room_categories"
    ADD CONSTRAINT "room_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_join_requests"
    ADD CONSTRAINT "room_join_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_join_requests"
    ADD CONSTRAINT "room_join_requests_room_id_user_id_key" UNIQUE ("room_id", "user_id");



ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_pkey" PRIMARY KEY ("room_id", "user_id");



ALTER TABLE ONLY "public"."room_message_read_status"
    ADD CONSTRAINT "room_message_read_status_pkey" PRIMARY KEY ("room_id", "user_id");



ALTER TABLE ONLY "public"."room_messages"
    ADD CONSTRAINT "room_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_pitch_calls"
    ADD CONSTRAINT "saved_pitch_calls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_pitch_calls"
    ADD CONSTRAINT "saved_pitch_calls_user_id_pitch_call_id_key" UNIQUE ("user_id", "pitch_call_id");



ALTER TABLE ONLY "public"."schedule_item_assignees"
    ADD CONSTRAINT "schedule_item_assignees_pkey" PRIMARY KEY ("schedule_item_id", "user_id");



ALTER TABLE ONLY "public"."schedule_items"
    ADD CONSTRAINT "schedule_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shot_list"
    ADD CONSTRAINT "shot_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."space_access_grants"
    ADD CONSTRAINT "space_access_grants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."space_access_requests"
    ADD CONSTRAINT "space_access_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_announcements"
    ADD CONSTRAINT "system_announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_incidents"
    ADD CONSTRAINT "system_incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_analytics"
    ADD CONSTRAINT "user_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_announcement_dismissals"
    ADD CONSTRAINT "user_announcement_dismissals_pkey" PRIMARY KEY ("user_id", "announcement_id");



ALTER TABLE ONLY "public"."user_availability"
    ADD CONSTRAINT "user_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_bans"
    ADD CONSTRAINT "user_bans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_connections"
    ADD CONSTRAINT "user_connections_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."user_connections"
    ADD CONSTRAINT "user_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_experience"
    ADD CONSTRAINT "user_experience_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_film_ratings"
    ADD CONSTRAINT "user_film_ratings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_film_ratings"
    ADD CONSTRAINT "user_film_ratings_user_cinema_unique" UNIQUE ("user_id", "platform_cinema_id");



ALTER TABLE ONLY "public"."user_film_ratings"
    ADD CONSTRAINT "user_film_ratings_user_id_tmdb_id_key" UNIQUE ("user_id", "tmdb_id");



ALTER TABLE ONLY "public"."user_push_tokens"
    ADD CONSTRAINT "user_push_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_push_tokens"
    ADD CONSTRAINT "user_push_tokens_user_id_token_key" UNIQUE ("user_id", "token");



ALTER TABLE ONLY "public"."user_risk_profiles"
    ADD CONSTRAINT "user_risk_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_risk_profiles"
    ADD CONSTRAINT "user_risk_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_skills"
    ADD CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_services"
    ADD CONSTRAINT "vendor_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."verification_requests"
    ADD CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vip_invites"
    ADD CONSTRAINT "vip_invites_pkey" PRIMARY KEY ("code");



CREATE INDEX "idx_announcements_posted_at" ON "public"."announcements" USING "btree" ("posted_at" DESC);



CREATE INDEX "idx_discussion_rooms_created_at" ON "public"."discussion_rooms" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_discussion_rooms_project_id" ON "public"."discussion_rooms" USING "btree" ("project_id");



CREATE INDEX "idx_film_reviews_created_at" ON "public"."film_reviews" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_film_reviews_tmdb_id" ON "public"."film_reviews" USING "btree" ("tmdb_id");



CREATE INDEX "idx_job_bookmarks_job_id" ON "public"."job_bookmarks" USING "btree" ("job_id");



CREATE INDEX "idx_job_bookmarks_user_id" ON "public"."job_bookmarks" USING "btree" ("user_id");



CREATE INDEX "idx_jobs_created_at" ON "public"."jobs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_jobs_type" ON "public"."jobs" USING "btree" ("type");



CREATE INDEX "idx_marketplace_active" ON "public"."marketplace_listings" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_marketplace_bookings_listing_id" ON "public"."marketplace_bookings" USING "btree" ("listing_id");



CREATE INDEX "idx_marketplace_bookings_owner_id" ON "public"."marketplace_bookings" USING "btree" ("owner_id");



CREATE INDEX "idx_marketplace_bookings_renter_id" ON "public"."marketplace_bookings" USING "btree" ("renter_id");



CREATE INDEX "idx_marketplace_bookings_status" ON "public"."marketplace_bookings" USING "btree" ("status");



CREATE INDEX "idx_marketplace_category" ON "public"."marketplace_listings" USING "btree" ("category");



CREATE INDEX "idx_marketplace_created_at" ON "public"."marketplace_listings" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_marketplace_listings_active" ON "public"."marketplace_listings" USING "btree" ("is_active");



CREATE INDEX "idx_marketplace_listings_category" ON "public"."marketplace_listings" USING "btree" ("category");



CREATE INDEX "idx_marketplace_listings_location" ON "public"."marketplace_listings" USING "btree" ("location");



CREATE INDEX "idx_marketplace_listings_type" ON "public"."marketplace_listings" USING "btree" ("listing_type");



CREATE INDEX "idx_marketplace_listings_user_id" ON "public"."marketplace_listings" USING "btree" ("user_id");



CREATE INDEX "idx_marketplace_reviews_listing_id" ON "public"."marketplace_reviews" USING "btree" ("listing_id");



CREATE INDEX "idx_marketplace_reviews_rating" ON "public"."marketplace_reviews" USING "btree" ("rating" DESC);



CREATE INDEX "idx_marketplace_reviews_reviewer_id" ON "public"."marketplace_reviews" USING "btree" ("reviewer_id");



CREATE INDEX "idx_marketplace_reviews_vendor_id" ON "public"."marketplace_reviews" USING "btree" ("vendor_id");



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_notifications_user_id_unread" ON "public"."notifications" USING "btree" ("user_id") WHERE ("is_read" = false);



CREATE INDEX "idx_pitch_calls_creator" ON "public"."pitch_calls" USING "btree" ("creator_id");



CREATE INDEX "idx_pitch_calls_published" ON "public"."pitch_calls" USING "btree" ("is_published") WHERE ("is_published" = true);



CREATE INDEX "idx_pitch_calls_status" ON "public"."pitch_calls" USING "btree" ("status") WHERE ("status" = 'open'::"text");



CREATE INDEX "idx_pitch_submissions_call" ON "public"."pitch_submissions" USING "btree" ("pitch_call_id");



CREATE INDEX "idx_pitch_submissions_status" ON "public"."pitch_submissions" USING "btree" ("status");



CREATE INDEX "idx_pitch_submissions_submitter" ON "public"."pitch_submissions" USING "btree" ("submitter_id");



CREATE INDEX "idx_platform_cinema_creator" ON "public"."platform_cinema" USING "btree" ("creator_id");



CREATE INDEX "idx_platform_cinema_published" ON "public"."platform_cinema" USING "btree" ("is_published") WHERE ("is_published" = true);



CREATE INDEX "idx_platform_cinema_type" ON "public"."platform_cinema" USING "btree" ("type");



CREATE INDEX "idx_posts_author_id" ON "public"."posts" USING "btree" ("author_id");



CREATE INDEX "idx_posts_created_at_desc" ON "public"."posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_posts_like_count" ON "public"."posts" USING "btree" ("like_count" DESC);



CREATE INDEX "idx_posts_page_id" ON "public"."posts" USING "btree" ("page_id") WHERE ("page_id" IS NOT NULL);



CREATE INDEX "idx_profiles_craft" ON "public"."profiles" USING "btree" ("craft");



CREATE INDEX "idx_profiles_full_name_trgm" ON "public"."profiles" USING "gin" ("full_name" "public"."gin_trgm_ops");



CREATE INDEX "idx_project_credits_project" ON "public"."project_credits" USING "btree" ("project_id");



CREATE INDEX "idx_project_credits_user" ON "public"."project_credits" USING "btree" ("user_id");



CREATE INDEX "idx_projects_created_at" ON "public"."projects" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_security_events_created_at" ON "public"."security_events" USING "btree" ("created_at");



CREATE INDEX "idx_security_events_type" ON "public"."security_events" USING "btree" ("event_type");



CREATE INDEX "idx_security_events_user_id" ON "public"."security_events" USING "btree" ("user_id");



CREATE INDEX "idx_user_connections_status" ON "public"."user_connections" USING "btree" ("status");



CREATE INDEX "idx_user_push_tokens_token" ON "public"."user_push_tokens" USING "btree" ("token");



CREATE INDEX "idx_user_push_tokens_user" ON "public"."user_push_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_user_sessions_device_id" ON "public"."user_sessions" USING "btree" ("device_id");



CREATE INDEX "idx_user_sessions_token_hash" ON "public"."user_sessions" USING "btree" ("refresh_token_hash");



CREATE INDEX "idx_user_sessions_user_id" ON "public"."user_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_vendor_services_production_types" ON "public"."vendor_services" USING "gin" ("production_types");



CREATE INDEX "idx_vendor_services_vendor_id" ON "public"."vendor_services" USING "btree" ("vendor_id");



CREATE INDEX "idx_vendors_category" ON "public"."vendors" USING "gin" ("category");



CREATE INDEX "idx_vendors_location" ON "public"."vendors" USING "btree" ("location");



CREATE INDEX "idx_vendors_owner_id" ON "public"."vendors" USING "btree" ("owner_id");



CREATE INDEX "idx_vendors_verified" ON "public"."vendors" USING "btree" ("is_verified");



CREATE INDEX "portfolio_items_user_id_idx" ON "public"."portfolio_items" USING "btree" ("user_id");



CREATE INDEX "profile_views_profile_id_idx" ON "public"."profile_views" USING "btree" ("profile_id");



CREATE OR REPLACE TRIGGER "handle_updated_at" BEFORE UPDATE ON "public"."user_availability" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "notify_on_connection_event" AFTER INSERT ON "public"."user_connections" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_notification"();



CREATE OR REPLACE TRIGGER "notify_on_job_application" AFTER INSERT ON "public"."job_applications" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_notification"();



CREATE OR REPLACE TRIGGER "notify_on_post_comment" AFTER INSERT ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_notification"();



CREATE OR REPLACE TRIGGER "notify_on_post_like" AFTER INSERT ON "public"."post_likes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_notification"();



CREATE OR REPLACE TRIGGER "notify_on_project_application" AFTER INSERT ON "public"."project_applications" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_notification"();



CREATE OR REPLACE TRIGGER "notify_on_project_join_request" AFTER INSERT ON "public"."project_space_join_requests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_notification"();



CREATE OR REPLACE TRIGGER "notify_on_room_join_request" AFTER INSERT ON "public"."room_join_requests" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_room_join_request"();



CREATE OR REPLACE TRIGGER "notify_on_room_member_invite" AFTER INSERT ON "public"."room_members" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_room_member_invite"();



CREATE OR REPLACE TRIGGER "on_comment_change" AFTER INSERT OR DELETE ON "public"."post_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_stats"();



CREATE OR REPLACE TRIGGER "on_economics_update" AFTER UPDATE ON "public"."platform_settings" FOR EACH ROW WHEN (("old"."key" = 'economics'::"text")) EXECUTE FUNCTION "public"."audit_economics_change"();



CREATE OR REPLACE TRIGGER "on_follower_notification" AFTER INSERT ON "public"."user_connections" FOR EACH ROW EXECUTE FUNCTION "public"."handle_follower_notification"();



CREATE OR REPLACE TRIGGER "on_like_change" AFTER INSERT OR DELETE ON "public"."post_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_stats"();



CREATE OR REPLACE TRIGGER "on_marketplace_booking_insert_remove_wishlist" AFTER INSERT ON "public"."marketplace_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."remove_wishlist_on_booking"();



CREATE OR REPLACE TRIGGER "on_marketplace_listing_availability_update" AFTER UPDATE ON "public"."marketplace_listings" FOR EACH ROW WHEN (("new"."availability_calendar" IS DISTINCT FROM "old"."availability_calendar")) EXECUTE FUNCTION "public"."notify_wishlist_availability"();



CREATE OR REPLACE TRIGGER "on_marketplace_listing_insert_alert" AFTER INSERT ON "public"."marketplace_listings" FOR EACH ROW EXECUTE FUNCTION "public"."notify_gear_alert_match"();



CREATE OR REPLACE TRIGGER "on_page_follower" AFTER INSERT ON "public"."company_page_followers" FOR EACH ROW EXECUTE FUNCTION "public"."notify_page_follower"();



CREATE OR REPLACE TRIGGER "on_pitch_submission" AFTER INSERT ON "public"."pitch_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_pitch_submission"();



CREATE OR REPLACE TRIGGER "on_post_notification" AFTER INSERT ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_post_notification"();



CREATE OR REPLACE TRIGGER "on_role_change_sync_official" AFTER INSERT OR UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_official_team_status"();



CREATE OR REPLACE TRIGGER "on_room_member_change" AFTER INSERT OR DELETE ON "public"."room_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_discussion_room_member_count"();



CREATE OR REPLACE TRIGGER "on_schedule_locked" AFTER UPDATE ON "public"."schedule_items" FOR EACH ROW EXECUTE FUNCTION "public"."notify_schedule_locked"();



CREATE OR REPLACE TRIGGER "pitch_calls_updated_at" BEFORE UPDATE ON "public"."pitch_calls" FOR EACH ROW EXECUTE FUNCTION "public"."update_pitch_updated_at"();



CREATE OR REPLACE TRIGGER "pitch_submissions_updated_at" BEFORE UPDATE ON "public"."pitch_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_pitch_updated_at"();



CREATE OR REPLACE TRIGGER "tr_on_project_credit_created" AFTER INSERT ON "public"."project_credits" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_project_credit"();



CREATE OR REPLACE TRIGGER "trg_auto_close_job" AFTER INSERT OR UPDATE OF "status" ON "public"."job_applications" FOR EACH ROW EXECUTE FUNCTION "public"."auto_close_job_on_hire"();



CREATE OR REPLACE TRIGGER "trg_auto_page_admin" AFTER INSERT ON "public"."company_pages" FOR EACH ROW EXECUTE FUNCTION "public"."auto_add_page_owner_as_admin"();



CREATE OR REPLACE TRIGGER "trg_block_bundle_children" AFTER INSERT ON "public"."marketplace_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."block_bundle_children_on_booking"();



CREATE OR REPLACE TRIGGER "trg_flag_poor_condition" AFTER INSERT ON "public"."marketplace_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."flag_listing_on_poor_condition"();



CREATE OR REPLACE TRIGGER "trg_page_follower_count" AFTER INSERT OR DELETE ON "public"."company_page_followers" FOR EACH ROW EXECUTE FUNCTION "public"."update_page_follower_count"();



CREATE OR REPLACE TRIGGER "trg_update_condition_score" AFTER INSERT OR DELETE OR UPDATE ON "public"."marketplace_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_listing_condition_score"();



CREATE OR REPLACE TRIGGER "trigger_notify_new_direct_message" AFTER INSERT ON "public"."direct_messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_direct_message"();



CREATE OR REPLACE TRIGGER "trigger_notify_new_project_message" AFTER INSERT ON "public"."project_space_messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_project_message"();



CREATE OR REPLACE TRIGGER "trigger_notify_new_room_message" AFTER INSERT ON "public"."room_messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_room_message"();



CREATE OR REPLACE TRIGGER "update_helpful_count_trigger" AFTER INSERT OR DELETE ON "public"."review_helpful_marks" FOR EACH ROW EXECUTE FUNCTION "public"."update_review_helpful_count"();



CREATE OR REPLACE TRIGGER "update_jobs_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_marketplace_bookings_updated_at" BEFORE UPDATE ON "public"."marketplace_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_marketplace_listings_updated_at" BEFORE UPDATE ON "public"."marketplace_listings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_applications_updated_at" BEFORE UPDATE ON "public"."project_applications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_schedule_items_updated_at" BEFORE UPDATE ON "public"."schedule_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_film_ratings_updated_at" BEFORE UPDATE ON "public"."user_film_ratings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vendor_services_updated_at" BEFORE UPDATE ON "public"."vendor_services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_vendors_updated_at" BEFORE UPDATE ON "public"."vendors" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "user_roles_sync_is_internal" AFTER INSERT OR DELETE OR UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_is_internal_trigger"();



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_publisher_page_id_fkey" FOREIGN KEY ("publisher_page_id") REFERENCES "public"."company_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."budget_items"
    ADD CONSTRAINT "budget_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_participants"
    ADD CONSTRAINT "call_participants_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_participants"
    ADD CONSTRAINT "call_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_sheets"
    ADD CONSTRAINT "call_sheets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calls"
    ADD CONSTRAINT "calls_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."company_page_admins"
    ADD CONSTRAINT "company_page_admins_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."company_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_page_admins"
    ADD CONSTRAINT "company_page_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_page_followers"
    ADD CONSTRAINT "company_page_followers_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."company_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_page_followers"
    ADD CONSTRAINT "company_page_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_page_members"
    ADD CONSTRAINT "company_page_members_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."company_pages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_page_members"
    ADD CONSTRAINT "company_page_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_pages"
    ADD CONSTRAINT "company_pages_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."content_reports"
    ADD CONSTRAINT "content_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."direct_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."direct_messages"
    ADD CONSTRAINT "direct_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."discussion_rooms"
    ADD CONSTRAINT "discussion_rooms_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."room_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."discussion_rooms"
    ADD CONSTRAINT "discussion_rooms_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."discussion_rooms"
    ADD CONSTRAINT "discussion_rooms_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."film_reviews"
    ADD CONSTRAINT "film_reviews_platform_cinema_id_fkey" FOREIGN KEY ("platform_cinema_id") REFERENCES "public"."platform_cinema"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."film_reviews"
    ADD CONSTRAINT "film_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flagged_messages"
    ADD CONSTRAINT "flagged_messages_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flagged_messages"
    ADD CONSTRAINT "flagged_messages_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gear_alerts"
    ADD CONSTRAINT "gear_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gov_approval_queue"
    ADD CONSTRAINT "gov_approval_queue_checker_id_fkey" FOREIGN KEY ("checker_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gov_approval_queue"
    ADD CONSTRAINT "gov_approval_queue_maker_id_fkey" FOREIGN KEY ("maker_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gov_audit_ledger"
    ADD CONSTRAINT "gov_audit_ledger_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gov_entity_relationships"
    ADD CONSTRAINT "gov_entity_relationships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_keys"
    ADD CONSTRAINT "group_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_alerts"
    ADD CONSTRAINT "job_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_applications"
    ADD CONSTRAINT "job_applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_bookmarks"
    ADD CONSTRAINT "job_bookmarks_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_bookmarks"
    ADD CONSTRAINT "job_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_saved_searches"
    ADD CONSTRAINT "job_saved_searches_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_saved_searches"
    ADD CONSTRAINT "job_saved_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."company_pages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_posted_by_fkey" FOREIGN KEY ("posted_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."key_backups"
    ADD CONSTRAINT "key_backups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."legal_docs"
    ADD CONSTRAINT "legal_docs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."legal_docs"
    ADD CONSTRAINT "legal_docs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."legal_requests"
    ADD CONSTRAINT "legal_requests_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."marketplace_bookings"
    ADD CONSTRAINT "marketplace_bookings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_bookings"
    ADD CONSTRAINT "marketplace_bookings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_bookings"
    ADD CONSTRAINT "marketplace_bookings_renter_id_fkey" FOREIGN KEY ("renter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_bundle_items"
    ADD CONSTRAINT "marketplace_bundle_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_bundle_items"
    ADD CONSTRAINT "marketplace_bundle_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_listings"
    ADD CONSTRAINT "marketplace_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_reviews"
    ADD CONSTRAINT "marketplace_reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."marketplace_bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_reviews"
    ADD CONSTRAINT "marketplace_reviews_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_reviews"
    ADD CONSTRAINT "marketplace_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_reviews"
    ADD CONSTRAINT "marketplace_reviews_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_wishlists"
    ADD CONSTRAINT "marketplace_wishlists_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_wishlists"
    ADD CONSTRAINT "marketplace_wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moderation_evidence"
    ADD CONSTRAINT "moderation_evidence_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."content_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moderation_evidence"
    ADD CONSTRAINT "moderation_evidence_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."moderation_notes"
    ADD CONSTRAINT "moderation_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."moderation_notes"
    ADD CONSTRAINT "moderation_notes_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."content_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_logs"
    ADD CONSTRAINT "notification_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_trigger_user_id_fkey" FOREIGN KEY ("trigger_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pitch_access_logs"
    ADD CONSTRAINT "pitch_access_logs_accessed_by_fkey" FOREIGN KEY ("accessed_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pitch_access_logs"
    ADD CONSTRAINT "pitch_access_logs_pitch_submission_id_fkey" FOREIGN KEY ("pitch_submission_id") REFERENCES "public"."pitch_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pitch_calls"
    ADD CONSTRAINT "pitch_calls_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pitch_submissions"
    ADD CONSTRAINT "pitch_submissions_pitch_call_id_fkey" FOREIGN KEY ("pitch_call_id") REFERENCES "public"."pitch_calls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pitch_submissions"
    ADD CONSTRAINT "pitch_submissions_submitter_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_announcements"
    ADD CONSTRAINT "platform_announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."platform_cinema"
    ADD CONSTRAINT "platform_cinema_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_flags"
    ADD CONSTRAINT "platform_flags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_policies"
    ADD CONSTRAINT "platform_policies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."platform_rules"
    ADD CONSTRAINT "platform_rules_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."portfolio_items"
    ADD CONSTRAINT "portfolio_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_bookmarks"
    ADD CONSTRAINT "post_bookmarks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_bookmarks"
    ADD CONSTRAINT "post_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."post_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_comments"
    ADD CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."company_pages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_views"
    ADD CONSTRAINT "profile_views_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_views"
    ADD CONSTRAINT "profile_views_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_applications"
    ADD CONSTRAINT "project_applications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_applications"
    ADD CONSTRAINT "project_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_credits"
    ADD CONSTRAINT "project_credits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_credits"
    ADD CONSTRAINT "project_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_credits"
    ADD CONSTRAINT "project_credits_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_message_read_status"
    ADD CONSTRAINT "project_message_read_status_project_space_id_fkey" FOREIGN KEY ("project_space_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_message_read_status"
    ADD CONSTRAINT "project_message_read_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_messages"
    ADD CONSTRAINT "project_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_messages"
    ADD CONSTRAINT "project_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."project_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_messages"
    ADD CONSTRAINT "project_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_space_bookmarks"
    ADD CONSTRAINT "project_space_bookmarks_project_space_id_fkey" FOREIGN KEY ("project_space_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_space_bookmarks"
    ADD CONSTRAINT "project_space_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_space_join_requests"
    ADD CONSTRAINT "project_space_join_requests_project_space_id_fkey" FOREIGN KEY ("project_space_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_space_join_requests"
    ADD CONSTRAINT "project_space_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_space_members"
    ADD CONSTRAINT "project_space_members_project_space_id_fkey" FOREIGN KEY ("project_space_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_space_members"
    ADD CONSTRAINT "project_space_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_space_messages"
    ADD CONSTRAINT "project_space_messages_project_space_id_fkey" FOREIGN KEY ("project_space_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_space_messages"
    ADD CONSTRAINT "project_space_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."project_space_messages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_space_messages"
    ADD CONSTRAINT "project_space_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_spaces"
    ADD CONSTRAINT "project_spaces_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."project_space_categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_spaces"
    ADD CONSTRAINT "project_spaces_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_spaces"
    ADD CONSTRAINT "project_spaces_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_helpful_marks"
    ADD CONSTRAINT "review_helpful_marks_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."film_reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_helpful_marks"
    ADD CONSTRAINT "review_helpful_marks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_join_requests"
    ADD CONSTRAINT "room_join_requests_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_join_requests"
    ADD CONSTRAINT "room_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_members"
    ADD CONSTRAINT "room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_message_read_status"
    ADD CONSTRAINT "room_message_read_status_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_message_read_status"
    ADD CONSTRAINT "room_message_read_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_messages"
    ADD CONSTRAINT "room_messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."room_messages"("id");



ALTER TABLE ONLY "public"."room_messages"
    ADD CONSTRAINT "room_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_messages"
    ADD CONSTRAINT "room_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_pitch_calls"
    ADD CONSTRAINT "saved_pitch_calls_pitch_call_id_fkey" FOREIGN KEY ("pitch_call_id") REFERENCES "public"."pitch_calls"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_pitch_calls"
    ADD CONSTRAINT "saved_pitch_calls_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_item_assignees"
    ADD CONSTRAINT "schedule_item_assignees_schedule_item_id_fkey" FOREIGN KEY ("schedule_item_id") REFERENCES "public"."schedule_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_item_assignees"
    ADD CONSTRAINT "schedule_item_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_items"
    ADD CONSTRAINT "schedule_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."security_events"
    ADD CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shot_list"
    ADD CONSTRAINT "shot_list_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."space_access_grants"
    ADD CONSTRAINT "space_access_grants_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."space_access_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."space_access_grants"
    ADD CONSTRAINT "space_access_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."space_access_requests"
    ADD CONSTRAINT "space_access_requests_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."space_access_requests"
    ADD CONSTRAINT "space_access_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."support_ticket_messages"
    ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."system_announcements"
    ADD CONSTRAINT "system_announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_space_id_fkey" FOREIGN KEY ("project_space_id") REFERENCES "public"."project_spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_analytics"
    ADD CONSTRAINT "user_analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_announcement_dismissals"
    ADD CONSTRAINT "user_announcement_dismissals_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "public"."platform_announcements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_announcement_dismissals"
    ADD CONSTRAINT "user_announcement_dismissals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_availability"
    ADD CONSTRAINT "user_availability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_bans"
    ADD CONSTRAINT "user_bans_banned_by_fkey" FOREIGN KEY ("banned_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_bans"
    ADD CONSTRAINT "user_bans_lifted_by_fkey" FOREIGN KEY ("lifted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_bans"
    ADD CONSTRAINT "user_bans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_connections"
    ADD CONSTRAINT "user_connections_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_connections"
    ADD CONSTRAINT "user_connections_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_experience"
    ADD CONSTRAINT "user_experience_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_film_ratings"
    ADD CONSTRAINT "user_film_ratings_platform_cinema_id_fkey" FOREIGN KEY ("platform_cinema_id") REFERENCES "public"."platform_cinema"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_film_ratings"
    ADD CONSTRAINT "user_film_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_push_tokens"
    ADD CONSTRAINT "user_push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_risk_profiles"
    ADD CONSTRAINT "user_risk_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_skills"
    ADD CONSTRAINT "user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_services"
    ADD CONSTRAINT "vendor_services_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."verification_requests"
    ADD CONSTRAINT "verification_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."verification_requests"
    ADD CONSTRAINT "verification_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vip_invites"
    ADD CONSTRAINT "vip_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vip_invites"
    ADD CONSTRAINT "vip_invites_used_by_id_fkey" FOREIGN KEY ("used_by_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "Admins can add members" ON "public"."company_page_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_page_admins"
  WHERE (("company_page_admins"."page_id" = "company_page_members"."page_id") AND ("company_page_admins"."user_id" = "auth"."uid"())))));



CREATE POLICY "Admins can manage all announcements" ON "public"."system_announcements" USING (("public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Admins can manage all comments" ON "public"."post_comments" USING (("public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Admins can manage all jobs" ON "public"."jobs" USING (("public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Admins can manage all listings" ON "public"."marketplace_listings" USING (("public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Admins can manage all messages" ON "public"."messages" USING (("public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Admins can manage all posts" ON "public"."posts" USING (("public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Admins can manage all profiles" ON "public"."profiles" USING (("public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Admins can manage all room messages" ON "public"."room_messages" USING (("public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Admins can manage bans" ON "public"."user_bans" USING (("public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Admins can manage fraud networks" ON "public"."fraud_networks" USING (("public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Admins can manage risk profiles" ON "public"."user_risk_profiles" USING (("public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Admins can manage roles" ON "public"."user_roles" USING ("public"."is_current_user_internal"());



CREATE POLICY "Admins can remove members" ON "public"."company_page_members" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."company_page_admins"
  WHERE (("company_page_admins"."page_id" = "company_page_members"."page_id") AND ("company_page_admins"."user_id" = "auth"."uid"())))));



CREATE POLICY "Admins can update any profile" ON "public"."profiles" FOR UPDATE USING ("public"."is_current_user_internal"());



CREATE POLICY "Admins can update verification requests" ON "public"."verification_requests" FOR UPDATE USING (("public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Admins can view audit logs" ON "public"."audit_logs" FOR SELECT USING (("public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Anyone authenticated can view open pitch calls" ON "public"."pitch_calls" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND ("is_published" = true)));



CREATE POLICY "Anyone can insert profile views" ON "public"."profile_views" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read platform flags" ON "public"."platform_flags" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Anyone can read system announcements" ON "public"."system_announcements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view accepted connections" ON "public"."user_connections" FOR SELECT USING (("status" = 'accepted'::"text"));



CREATE POLICY "Anyone can view active announcements" ON "public"."platform_announcements" FOR SELECT USING ((("is_active" = true) OR "public"."is_current_user_internal"()));



CREATE POLICY "Anyone can view active listings" ON "public"."marketplace_listings" FOR SELECT USING ((("is_active" = true) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Anyone can view active vendor services" ON "public"."vendor_services" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view bundle items" ON "public"."marketplace_bundle_items" FOR SELECT USING (true);



CREATE POLICY "Anyone can view comments" ON "public"."post_comments" FOR SELECT USING (true);



CREATE POLICY "Anyone can view company pages" ON "public"."company_pages" FOR SELECT USING (true);



CREATE POLICY "Anyone can view film ratings" ON "public"."user_film_ratings" FOR SELECT USING (true);



CREATE POLICY "Anyone can view followers" ON "public"."company_page_followers" FOR SELECT USING (true);



CREATE POLICY "Anyone can view helpful marks" ON "public"."review_helpful_marks" FOR SELECT USING (true);



CREATE POLICY "Anyone can view internal roles" ON "public"."user_roles" FOR SELECT USING (true);



CREATE POLICY "Anyone can view likes" ON "public"."post_likes" FOR SELECT USING (true);



CREATE POLICY "Anyone can view members" ON "public"."company_page_members" FOR SELECT USING (true);



CREATE POLICY "Anyone can view page admins" ON "public"."company_page_admins" FOR SELECT USING (true);



CREATE POLICY "Anyone can view portfolio items" ON "public"."portfolio_items" FOR SELECT USING (true);



CREATE POLICY "Anyone can view posts" ON "public"."posts" FOR SELECT USING (true);



CREATE POLICY "Anyone can view project credits" ON "public"."project_credits" FOR SELECT USING (true);



CREATE POLICY "Anyone can view published cinema" ON "public"."platform_cinema" FOR SELECT USING (("is_published" = true));



CREATE POLICY "Anyone can view read status in rooms" ON "public"."room_message_read_status" FOR SELECT USING (true);



CREATE POLICY "Anyone can view reviews" ON "public"."film_reviews" FOR SELECT USING (true);



CREATE POLICY "Anyone can view reviews" ON "public"."marketplace_reviews" FOR SELECT USING (true);



CREATE POLICY "Anyone can view room members" ON "public"."room_members" FOR SELECT USING (true);



CREATE POLICY "Anyone can view user availability" ON "public"."user_availability" FOR SELECT USING (true);



CREATE POLICY "Anyone can view verified vendors" ON "public"."vendors" FOR SELECT USING ((("is_verified" = true) OR ("owner_id" = "auth"."uid"())));



CREATE POLICY "Anyone view experience" ON "public"."user_experience" FOR SELECT USING (true);



CREATE POLICY "Anyone view skills" ON "public"."user_skills" FOR SELECT USING (true);



CREATE POLICY "Applicant Create/View" ON "public"."job_applications" USING ((( SELECT "auth"."uid"() AS "uid") = "applicant_id"));



CREATE POLICY "Applicants can view own applications" ON "public"."job_applications" FOR SELECT USING (("auth"."uid"() = "applicant_id"));



CREATE POLICY "Auth Create Announcements" ON "public"."announcements" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Auth Create Projects" ON "public"."project_spaces" FOR INSERT WITH CHECK ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Auth View Announcements" ON "public"."announcements" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Auth View Projects" ON "public"."project_spaces" FOR SELECT USING (((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text") AND (("project_space_type" = 'public'::"public"."project_space_type") OR ("creator_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_member_of_project"("id"))));



CREATE POLICY "Authenticated users can create ratings" ON "public"."user_film_ratings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can post" ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "author_id"));



CREATE POLICY "Authenticated users can submit pitches" ON "public"."pitch_submissions" FOR INSERT WITH CHECK (("auth"."uid"() = "submitter_id"));



CREATE POLICY "Author Manage Announcements" ON "public"."announcements" USING ((( SELECT "auth"."uid"() AS "uid") = "author_id"));



CREATE POLICY "Create Project Spaces" ON "public"."project_spaces" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Create Projects" ON "public"."projects" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Creator Manage Projects" ON "public"."project_spaces" USING ((( SELECT "auth"."uid"() AS "uid") = "creator_id"));



CREATE POLICY "Creator View Applications" ON "public"."project_applications" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "project_applications"."project_id") AND ("projects"."creator_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."project_spaces" "ps"
     JOIN "public"."projects" "p" ON (("ps"."project_id" = "p"."id")))
  WHERE (("ps"."id" = "project_applications"."project_id") AND ("p"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Creator and admins can remove members" ON "public"."room_members" FOR DELETE USING (("public"."is_room_creator"("room_id", "auth"."uid"()) OR "public"."is_room_admin"("room_id", "auth"."uid"())));



CREATE POLICY "Creator and admins can update member roles" ON "public"."room_members" FOR UPDATE USING (("public"."is_room_creator"("room_id", "auth"."uid"()) OR "public"."is_room_admin"("room_id", "auth"."uid"()))) WITH CHECK (("public"."is_room_creator"("room_id", "auth"."uid"()) OR ("public"."is_room_admin"("room_id", "auth"."uid"()) AND (NOT "public"."is_room_creator"("room_id", "user_id")))));



CREATE POLICY "Creator can delete their discussion rooms" ON "public"."discussion_rooms" FOR DELETE USING (("creator_id" = "auth"."uid"()));



CREATE POLICY "Creator can update their discussion rooms" ON "public"."discussion_rooms" FOR UPDATE USING (("creator_id" = "auth"."uid"()));



CREATE POLICY "Creator can view their discussion rooms" ON "public"."discussion_rooms" FOR SELECT USING (("creator_id" = "auth"."uid"()));



CREATE POLICY "Creator manage room requests" ON "public"."room_join_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."discussion_rooms"
  WHERE (("discussion_rooms"."id" = "room_join_requests"."room_id") AND ("discussion_rooms"."creator_id" = "auth"."uid"())))));



CREATE POLICY "Creators can manage their own pitch calls" ON "public"."pitch_calls" USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "Employer View Applications" ON "public"."job_applications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "job_applications"."job_id") AND ("jobs"."posted_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Enable read access for all users" ON "public"."platform_flags" FOR SELECT USING (true);



CREATE POLICY "Enable read access for authenticated users" ON "public"."platform_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Enable read for all" ON "public"."platform_policies" FOR SELECT USING (true);



CREATE POLICY "Enable write for super_admin" ON "public"."platform_policies" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Everyone can view public discussion rooms" ON "public"."discussion_rooms" FOR SELECT USING ((("room_type" = 'public'::"text") OR ("is_public" = true)));



CREATE POLICY "Internals can manage announcements" ON "public"."platform_announcements" USING ("public"."is_current_user_internal"());



CREATE POLICY "Internals can manage invites" ON "public"."vip_invites" USING ("public"."is_current_user_internal"());



CREATE POLICY "Internals can update requests" ON "public"."verification_requests" FOR UPDATE USING ("public"."is_current_user_internal"());



CREATE POLICY "Job posters can update status" ON "public"."job_applications" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "job_applications"."job_id") AND ("jobs"."posted_by" = "auth"."uid"())))));



CREATE POLICY "Job posters can view applications" ON "public"."job_applications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."jobs"
  WHERE (("jobs"."id" = "job_applications"."job_id") AND ("jobs"."posted_by" = "auth"."uid"())))));



CREATE POLICY "Jobs are viewable by everyone" ON "public"."jobs" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Manage Applications" ON "public"."project_applications" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Manage Project Spaces" ON "public"."project_spaces" USING ("public"."check_is_project_creator"("project_id"));



CREATE POLICY "Manage Projects" ON "public"."projects" USING (("creator_id" = "auth"."uid"()));



CREATE POLICY "Member Clear Project Messages" ON "public"."project_messages" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Member Clear Project Space Messages" ON "public"."project_space_messages" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Member Send Project Messages" ON "public"."project_messages" FOR INSERT WITH CHECK (("public"."is_member_of_project"("project_id") AND (( SELECT "auth"."uid"() AS "uid") = "user_id")));



CREATE POLICY "Member Send Project Space Messages" ON "public"."project_space_messages" FOR INSERT WITH CHECK (("public"."is_member_of_project"("project_space_id") AND (( SELECT "auth"."uid"() AS "uid") = "user_id")));



CREATE POLICY "Member View Project Messages" ON "public"."project_messages" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "project_messages"."project_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "project_messages"."project_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Member View Project Space Messages" ON "public"."project_space_messages" FOR SELECT USING ("public"."is_member_of_project"("project_space_id"));



CREATE POLICY "Members can view private discussion rooms" ON "public"."discussion_rooms" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."room_members"
  WHERE (("room_members"."room_id" = "discussion_rooms"."id") AND ("room_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can view tasks" ON "public"."tasks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "tasks"."project_space_id") AND ("project_space_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Moderators can update reports" ON "public"."content_reports" FOR UPDATE USING (("public"."has_role"('moderator'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Moderators can view all reports" ON "public"."content_reports" FOR SELECT USING (("public"."has_role"('moderator'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "No one can update project credits" ON "public"."project_credits" FOR UPDATE USING (false);



CREATE POLICY "Only super_admin can modify flags" ON "public"."platform_flags" USING ("public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"()));



CREATE POLICY "Owner can create pages" ON "public"."company_pages" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owner can delete pages" ON "public"."company_pages" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owner can manage admins" ON "public"."company_page_admins" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_pages"
  WHERE (("company_pages"."id" = "company_page_admins"."page_id") AND ("company_pages"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owner can remove admins" ON "public"."company_page_admins" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."company_pages"
  WHERE (("company_pages"."id" = "company_page_admins"."page_id") AND ("company_pages"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Owner can update pages" ON "public"."company_pages" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners and renters can update bookings" ON "public"."marketplace_bookings" FOR UPDATE USING ((("auth"."uid"() = "renter_id") OR ("auth"."uid"() = "owner_id")));



CREATE POLICY "Owners can delete their vendor profiles" ON "public"."vendors" FOR DELETE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners can update their vendor profiles" ON "public"."vendors" FOR UPDATE USING (("auth"."uid"() = "owner_id"));



CREATE POLICY "Page admins can manage page announcements" ON "public"."announcements" USING (((("publisher_page_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."company_pages"
  WHERE (("company_pages"."id" = "announcements"."publisher_page_id") AND ("company_pages"."owner_id" = "auth"."uid"()))))) OR (("publisher_page_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."company_page_admins"
  WHERE (("company_page_admins"."page_id" = "announcements"."publisher_page_id") AND ("company_page_admins"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Page managers can delete page jobs" ON "public"."jobs" FOR DELETE USING (("page_id" IN ( SELECT "company_pages"."id"
   FROM "public"."company_pages"
  WHERE ("company_pages"."owner_id" = "auth"."uid"())
UNION
 SELECT "company_page_admins"."page_id"
   FROM "public"."company_page_admins"
  WHERE ("company_page_admins"."user_id" = "auth"."uid"())
UNION
 SELECT "company_page_members"."page_id"
   FROM "public"."company_page_members"
  WHERE ("company_page_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Page managers can update page jobs" ON "public"."jobs" FOR UPDATE USING (("page_id" IN ( SELECT "company_pages"."id"
   FROM "public"."company_pages"
  WHERE ("company_pages"."owner_id" = "auth"."uid"())
UNION
 SELECT "company_page_admins"."page_id"
   FROM "public"."company_page_admins"
  WHERE ("company_page_admins"."user_id" = "auth"."uid"())
UNION
 SELECT "company_page_members"."page_id"
   FROM "public"."company_page_members"
  WHERE ("company_page_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Page managers can view page jobs" ON "public"."jobs" FOR SELECT USING (("page_id" IN ( SELECT "company_pages"."id"
   FROM "public"."company_pages"
  WHERE ("company_pages"."owner_id" = "auth"."uid"())
UNION
 SELECT "company_page_admins"."page_id"
   FROM "public"."company_page_admins"
  WHERE ("company_page_admins"."user_id" = "auth"."uid"())
UNION
 SELECT "company_page_members"."page_id"
   FROM "public"."company_page_members"
  WHERE ("company_page_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Participants can view details" ON "public"."call_participants" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Pitch call owners can update submission status" ON "public"."pitch_submissions" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "pitch_calls"."creator_id"
   FROM "public"."pitch_calls"
  WHERE ("pitch_calls"."id" = "pitch_submissions"."pitch_call_id"))));



CREATE POLICY "Pitch call owners see their submissions" ON "public"."pitch_submissions" FOR SELECT USING (("auth"."uid"() IN ( SELECT "pitch_calls"."creator_id"
   FROM "public"."pitch_calls"
  WHERE ("pitch_calls"."id" = "pitch_submissions"."pitch_call_id"))));



CREATE POLICY "Project creators can delete project credits" ON "public"."project_credits" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "project_credits"."project_id") AND ("projects"."creator_id" = "auth"."uid"())))) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Project creators can insert project credits" ON "public"."project_credits" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."projects"
  WHERE (("projects"."id" = "project_credits"."project_id") AND ("projects"."creator_id" = "auth"."uid"())))));



CREATE POLICY "Project members can delete schedule assignees" ON "public"."schedule_item_assignees" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."schedule_items" "si"
     JOIN "public"."project_space_members" "pm" ON (("pm"."project_space_id" = "si"."project_id")))
  WHERE (("si"."id" = "schedule_item_assignees"."schedule_item_id") AND ("pm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Project members can insert schedule assignees" ON "public"."schedule_item_assignees" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."schedule_items" "si"
     JOIN "public"."project_space_members" "pm" ON (("pm"."project_space_id" = "si"."project_id")))
  WHERE (("si"."id" = "schedule_item_assignees"."schedule_item_id") AND ("pm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Project members can read schedule assignees" ON "public"."schedule_item_assignees" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."schedule_items" "si"
     JOIN "public"."project_space_members" "pm" ON (("pm"."project_space_id" = "si"."project_id")))
  WHERE (("si"."id" = "schedule_item_assignees"."schedule_item_id") AND ("pm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Public can use invite codes" ON "public"."vip_invites" FOR UPDATE USING (("is_used" = false)) WITH CHECK (("is_used" = true));



CREATE POLICY "Public can view reviews" ON "public"."film_reviews" FOR SELECT USING (true);



CREATE POLICY "Public can view unused invites to validate" ON "public"."vip_invites" FOR SELECT USING (("is_used" = false));



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("is_internal" = false) OR "public"."is_current_user_internal"()));



CREATE POLICY "Room creator can add members" ON "public"."room_members" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."discussion_rooms" "dr"
  WHERE (("dr"."id" = "room_members"."room_id") AND ("dr"."creator_id" = "auth"."uid"())))));



CREATE POLICY "Room members can invite members" ON "public"."room_members" FOR INSERT WITH CHECK ("public"."is_room_member"("room_id"));



CREATE POLICY "Room members can view calls" ON "public"."calls" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."room_members"
  WHERE (("room_members"."room_id" = "calls"."room_id") AND ("room_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Send Project Messages" ON "public"."project_messages" FOR INSERT WITH CHECK (("public"."is_project_member"("project_id") OR "public"."is_project_creator"("project_id")));



CREATE POLICY "Staff can create space access requests" ON "public"."space_access_requests" FOR INSERT WITH CHECK ((("auth"."uid"() = "requester_id") AND (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['moderator'::"public"."app_role", 'admin'::"public"."app_role", 'super_admin'::"public"."app_role"])))))));



CREATE POLICY "Staff can delete project space messages with active grant" ON "public"."project_space_messages" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."space_access_grants"
  WHERE (("space_access_grants"."user_id" = "auth"."uid"()) AND ("space_access_grants"."target_type" = 'project_space'::"text") AND ("space_access_grants"."target_id" = ("project_space_messages"."project_space_id")::"text") AND ("space_access_grants"."expires_at" > "now"())))));



CREATE POLICY "Staff can delete room messages with active grant" ON "public"."room_messages" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."space_access_grants"
  WHERE (("space_access_grants"."user_id" = "auth"."uid"()) AND ("space_access_grants"."target_type" = 'room'::"text") AND ("space_access_grants"."target_id" = ("room_messages"."room_id")::"text") AND ("space_access_grants"."expires_at" > "now"())))));



CREATE POLICY "Staff can insert audit logs" ON "public"."gov_audit_ledger" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['moderator'::"public"."app_role", 'admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "Staff can insert space access grants" ON "public"."space_access_grants" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "Staff can manage all ticket messages" ON "public"."support_ticket_messages" USING (("public"."has_role"('moderator'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Staff can manage all tickets" ON "public"."support_tickets" USING (("public"."has_role"('moderator'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Staff can manage approval queue" ON "public"."gov_approval_queue" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['moderator'::"public"."app_role", 'admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "Staff can manage moderation evidence" ON "public"."moderation_evidence" USING (("public"."has_role"('moderator'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Staff can manage moderation notes" ON "public"."moderation_notes" USING (("public"."has_role"('moderator'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Staff can update flags" ON "public"."flagged_messages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role", 'moderator'::"public"."app_role"]))))));



CREATE POLICY "Staff can update space access requests" ON "public"."space_access_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "Staff can view audit logs" ON "public"."gov_audit_ledger" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['moderator'::"public"."app_role", 'admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "Staff can view discussion rooms with active grant" ON "public"."discussion_rooms" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."space_access_grants"
  WHERE (("space_access_grants"."user_id" = "auth"."uid"()) AND ("space_access_grants"."target_type" = 'room'::"text") AND ("space_access_grants"."target_id" = ("space_access_grants"."id")::"text") AND ("space_access_grants"."expires_at" > "now"())))));



CREATE POLICY "Staff can view flags" ON "public"."flagged_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role", 'moderator'::"public"."app_role"]))))));



CREATE POLICY "Staff can view project members with active grant" ON "public"."project_space_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."space_access_grants"
  WHERE (("space_access_grants"."user_id" = "auth"."uid"()) AND ("space_access_grants"."target_type" = 'project_space'::"text") AND ("space_access_grants"."target_id" = ("project_space_members"."project_space_id")::"text") AND ("space_access_grants"."expires_at" > "now"())))));



CREATE POLICY "Staff can view project space messages with active grant" ON "public"."project_space_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."space_access_grants"
  WHERE (("space_access_grants"."user_id" = "auth"."uid"()) AND ("space_access_grants"."target_type" = 'project_space'::"text") AND ("space_access_grants"."target_id" = ("project_space_messages"."project_space_id")::"text") AND ("space_access_grants"."expires_at" > "now"())))));



CREATE POLICY "Staff can view project spaces with active grant" ON "public"."project_spaces" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."space_access_grants"
  WHERE (("space_access_grants"."user_id" = "auth"."uid"()) AND ("space_access_grants"."target_type" = 'project_space'::"text") AND ("space_access_grants"."target_id" = ("space_access_grants"."id")::"text") AND ("space_access_grants"."expires_at" > "now"())))));



CREATE POLICY "Staff can view relationship data" ON "public"."gov_entity_relationships" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "Staff can view room messages with active grant" ON "public"."room_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."space_access_grants"
  WHERE (("space_access_grants"."user_id" = "auth"."uid"()) AND ("space_access_grants"."target_type" = 'room'::"text") AND ("space_access_grants"."target_id" = ("room_messages"."room_id")::"text") AND ("space_access_grants"."expires_at" > "now"())))));



CREATE POLICY "Staff can view space access grants" ON "public"."space_access_grants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['moderator'::"public"."app_role", 'admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "Staff can view space access requests" ON "public"."space_access_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['moderator'::"public"."app_role", 'admin'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "Staff can view tasks with active grant" ON "public"."tasks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."space_access_grants"
  WHERE (("space_access_grants"."user_id" = "auth"."uid"()) AND ("space_access_grants"."target_type" = 'project_space'::"text") AND ("space_access_grants"."target_id" = ("tasks"."project_space_id")::"text") AND ("space_access_grants"."expires_at" > "now"())))));



CREATE POLICY "Submitters see their own submissions" ON "public"."pitch_submissions" FOR SELECT USING (("auth"."uid"() = "submitter_id"));



CREATE POLICY "Super admins can manage all roles" ON "public"."user_roles" USING ("public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"()));



CREATE POLICY "Super admins can manage legal requests" ON "public"."legal_requests" USING ("public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"()));



CREATE POLICY "Super admins can manage platform rules" ON "public"."platform_rules" USING ("public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"()));



CREATE POLICY "Super admins can manage system incidents" ON "public"."system_incidents" USING ("public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"()));



CREATE POLICY "System can insert audit logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users Clear Own Direct Messages" ON "public"."direct_messages" FOR DELETE USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



CREATE POLICY "Users Update Own Direct Messages" ON "public"."direct_messages" FOR UPDATE USING (("auth"."uid"() = "sender_id")) WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users Update Own Project Messages" ON "public"."project_messages" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users Update Own Project Space Messages" ON "public"."project_space_messages" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create applications" ON "public"."job_applications" FOR INSERT WITH CHECK (("auth"."uid"() = "applicant_id"));



CREATE POLICY "Users can create bookings" ON "public"."marketplace_bookings" FOR INSERT WITH CHECK (("auth"."uid"() = "renter_id"));



CREATE POLICY "Users can create jobs" ON "public"."jobs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "posted_by"));



CREATE POLICY "Users can create own reviews" ON "public"."film_reviews" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create own verification request" ON "public"."verification_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create reports" ON "public"."content_reports" FOR INSERT WITH CHECK (("auth"."uid"() = "reported_by"));



CREATE POLICY "Users can create reviews" ON "public"."marketplace_reviews" FOR INSERT WITH CHECK (("auth"."uid"() = "reviewer_id"));



CREATE POLICY "Users can create their own listings" ON "public"."marketplace_listings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own portfolio items" ON "public"."portfolio_items" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create their own reviews" ON "public"."film_reviews" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create vendor profiles" ON "public"."vendors" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Users can delete bundle items for their own listings" ON "public"."marketplace_bundle_items" FOR DELETE USING (("auth"."uid"() = ( SELECT "marketplace_listings"."user_id"
   FROM "public"."marketplace_listings"
  WHERE ("marketplace_listings"."id" = "marketplace_bundle_items"."bundle_id"))));



CREATE POLICY "Users can delete own jobs" ON "public"."jobs" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "posted_by"));



CREATE POLICY "Users can delete own reviews" ON "public"."film_reviews" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own room messages" ON "public"."room_messages" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own saved searches" ON "public"."job_saved_searches" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."post_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own group keys" ON "public"."group_keys" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own key backup" ON "public"."key_backups" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own listings" ON "public"."marketplace_listings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own portfolio items" ON "public"."portfolio_items" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete their own ratings" ON "public"."user_film_ratings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own reviews" ON "public"."film_reviews" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own reviews" ON "public"."marketplace_reviews" FOR DELETE USING (("auth"."uid"() = "reviewer_id"));



CREATE POLICY "Users can delete their own wishlists" ON "public"."marketplace_wishlists" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can follow" ON "public"."company_page_followers" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can follow others" ON "public"."user_connections" FOR INSERT WITH CHECK (("follower_id" = "auth"."uid"()));



CREATE POLICY "Users can insert bundle items for their own listings" ON "public"."marketplace_bundle_items" FOR INSERT WITH CHECK (("auth"."uid"() = ( SELECT "marketplace_listings"."user_id"
   FROM "public"."marketplace_listings"
  WHERE ("marketplace_listings"."id" = "marketplace_bundle_items"."bundle_id"))));



CREATE POLICY "Users can insert flags" ON "public"."flagged_messages" FOR INSERT TO "authenticated" WITH CHECK (("reporter_id" = "auth"."uid"()));



CREATE POLICY "Users can insert group keys for others if they are members" ON "public"."group_keys" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "group_keys"."target_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."project_spaces"
     LEFT JOIN "public"."projects" ON (("project_spaces"."project_id" = "projects"."id")))
  WHERE (("project_spaces"."id" = "group_keys"."target_id") AND (("project_spaces"."creator_id" = "auth"."uid"()) OR ("projects"."creator_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."room_members"
  WHERE (("room_members"."room_id" = "group_keys"."target_id") AND ("room_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."discussion_rooms"
  WHERE (("discussion_rooms"."id" = "group_keys"."target_id") AND ("discussion_rooms"."creator_id" = "auth"."uid"())))) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Users can insert own saved searches" ON "public"."job_saved_searches" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert room messages" ON "public"."room_messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."room_members"
  WHERE (("room_members"."room_id" = "room_messages"."room_id") AND ("room_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert their own access logs" ON "public"."pitch_access_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "accessed_by"));



CREATE POLICY "Users can insert their own comments" ON "public"."post_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own key backup" ON "public"."key_backups" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own requests" ON "public"."verification_requests" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own security events" ON "public"."security_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own sessions" ON "public"."user_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own wishlists" ON "public"."marketplace_wishlists" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert themselves into project members" ON "public"."project_space_members" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can join public rooms" ON "public"."room_members" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."discussion_rooms" "dr"
  WHERE (("dr"."id" = "room_members"."room_id") AND (("dr"."room_type" = 'public'::"text") OR ("dr"."is_public" = true)))))));



CREATE POLICY "Users can leave rooms" ON "public"."room_members" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage budget items of their project spaces" ON "public"."budget_items" USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "budget_items"."project_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "budget_items"."project_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage call sheets of their project spaces" ON "public"."call_sheets" USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "call_sheets"."project_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "call_sheets"."project_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage files of their project spaces" ON "public"."files" USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "files"."project_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "files"."project_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage legal docs of their project spaces" ON "public"."legal_docs" USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "legal_docs"."project_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "legal_docs"."project_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage own likes" ON "public"."post_likes" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own notifications" ON "public"."notifications" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own settings" ON "public"."user_settings" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own tickets" ON "public"."support_tickets" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage schedule items of their project spaces" ON "public"."schedule_items" USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "schedule_items"."project_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "schedule_items"."project_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage shot list of their project spaces" ON "public"."shot_list" USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "shot_list"."project_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "shot_list"."project_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage tasks in their project spaces" ON "public"."tasks" USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "tasks"."project_space_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "tasks"."project_space_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage their dismissals" ON "public"."user_announcement_dismissals" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can manage their own availability" ON "public"."user_availability" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own bookmarks" ON "public"."post_bookmarks" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own cinema entries" ON "public"."platform_cinema" USING (("auth"."uid"() = "creator_id"));



CREATE POLICY "Users can manage their own gear alerts" ON "public"."gear_alerts" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own job bookmarks" ON "public"."job_bookmarks" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own push tokens" ON "public"."user_push_tokens" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can mark reviews as helpful" ON "public"."review_helpful_marks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read group keys of spaces/rooms they belong to" ON "public"."group_keys" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "group_keys"."target_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM ("public"."project_spaces"
     LEFT JOIN "public"."projects" ON (("project_spaces"."project_id" = "projects"."id")))
  WHERE (("project_spaces"."id" = "group_keys"."target_id") AND (("project_spaces"."creator_id" = "auth"."uid"()) OR ("projects"."creator_id" = "auth"."uid"()))))) OR (EXISTS ( SELECT 1
   FROM "public"."room_members"
  WHERE (("room_members"."room_id" = "group_keys"."target_id") AND ("room_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."discussion_rooms"
  WHERE (("discussion_rooms"."id" = "group_keys"."target_id") AND ("discussion_rooms"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can remove connections" ON "public"."user_connections" FOR DELETE USING ((("follower_id" = "auth"."uid"()) OR ("following_id" = "auth"."uid"())));



CREATE POLICY "Users can remove their helpful marks" ON "public"."review_helpful_marks" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can reply to own tickets" ON "public"."support_ticket_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."support_tickets" "t"
  WHERE (("t"."id" = "support_ticket_messages"."ticket_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can see own ticket messages" ON "public"."support_ticket_messages" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."support_tickets" "t"
  WHERE (("t"."id" = "support_ticket_messages"."ticket_id") AND ("t"."user_id" = "auth"."uid"())))) AND ("is_internal" = false)));



CREATE POLICY "Users can send messages" ON "public"."direct_messages" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can unfollow" ON "public"."company_page_followers" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own jobs" ON "public"."jobs" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "posted_by"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own reviews" ON "public"."film_reviews" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own room messages" ON "public"."room_messages" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own comments" ON "public"."post_comments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own key backup" ON "public"."key_backups" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own listings" ON "public"."marketplace_listings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own portfolio items" ON "public"."portfolio_items" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own ratings" ON "public"."user_film_ratings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own read status in projects" ON "public"."project_message_read_status" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own read status in rooms" ON "public"."room_message_read_status" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own received messages (mark as read)" ON "public"."direct_messages" FOR UPDATE USING (("auth"."uid"() = "receiver_id"));



CREATE POLICY "Users can update their own reviews" ON "public"."film_reviews" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own reviews" ON "public"."marketplace_reviews" FOR UPDATE USING (("auth"."uid"() = "reviewer_id"));



CREATE POLICY "Users can update their own sessions" ON "public"."user_sessions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view budget items of their project spaces" ON "public"."budget_items" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "budget_items"."project_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "budget_items"."project_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view call sheets of their project spaces" ON "public"."call_sheets" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "call_sheets"."project_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "call_sheets"."project_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view files of their project spaces" ON "public"."files" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "files"."project_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "files"."project_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view legal docs of their project spaces" ON "public"."legal_docs" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "legal_docs"."project_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "legal_docs"."project_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view own ban status" ON "public"."user_bans" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own conversations" ON "public"."conversations" FOR SELECT USING ((("auth"."uid"() = "user1_id") OR ("auth"."uid"() = "user2_id")));



CREATE POLICY "Users can view own jobs" ON "public"."jobs" FOR SELECT USING (("posted_by" = "auth"."uid"()));



CREATE POLICY "Users can view own pending connections" ON "public"."user_connections" FOR SELECT USING ((("follower_id" = "auth"."uid"()) OR ("following_id" = "auth"."uid"())));



CREATE POLICY "Users can view own role" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own saved searches" ON "public"."job_saved_searches" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own verification requests" ON "public"."verification_requests" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."has_role"('admin'::"public"."app_role", "auth"."uid"()) OR "public"."has_role"('super_admin'::"public"."app_role", "auth"."uid"())));



CREATE POLICY "Users can view project members" ON "public"."project_space_members" FOR SELECT USING (true);



CREATE POLICY "Users can view read status in their projects" ON "public"."project_message_read_status" FOR SELECT USING (true);



CREATE POLICY "Users can view room messages" ON "public"."room_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."room_members"
  WHERE (("room_members"."room_id" = "room_messages"."room_id") AND ("room_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view schedule items of their project spaces" ON "public"."schedule_items" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "schedule_items"."project_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "schedule_items"."project_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view shot list of their project spaces" ON "public"."shot_list" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE (("project_space_members"."project_space_id" = "shot_list"."project_id") AND ("project_space_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."project_spaces"
  WHERE (("project_spaces"."id" = "shot_list"."project_id") AND ("project_spaces"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own bookings" ON "public"."marketplace_bookings" FOR SELECT USING ((("auth"."uid"() = "renter_id") OR ("auth"."uid"() = "owner_id")));



CREATE POLICY "Users can view their own key backup" ON "public"."key_backups" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own messages (sent or received)" ON "public"."direct_messages" FOR SELECT USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



CREATE POLICY "Users can view their own profile views" ON "public"."profile_views" FOR SELECT USING (("profile_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own requests" ON "public"."verification_requests" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_current_user_internal"()));



CREATE POLICY "Users can view their own security events" ON "public"."security_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own sessions" ON "public"."user_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own wishlists" ON "public"."marketplace_wishlists" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own room requests or creator" ON "public"."room_join_requests" FOR DELETE USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."discussion_rooms"
  WHERE (("discussion_rooms"."id" = "room_join_requests"."room_id") AND ("discussion_rooms"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Users insert own room requests" ON "public"."room_join_requests" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own experience" ON "public"."user_experience" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own skills" ON "public"."user_skills" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage their own saved pitch calls" ON "public"."saved_pitch_calls" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users see logs for their submissions" ON "public"."pitch_access_logs" FOR SELECT USING (("auth"."uid"() IN ( SELECT "pitch_submissions"."submitter_id"
   FROM "public"."pitch_submissions"
  WHERE ("pitch_submissions"."id" = "pitch_access_logs"."pitch_submission_id"))));



CREATE POLICY "Users view own room requests or if creator" ON "public"."room_join_requests" FOR SELECT USING ((("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."discussion_rooms"
  WHERE (("discussion_rooms"."id" = "room_join_requests"."room_id") AND ("discussion_rooms"."creator_id" = "auth"."uid"()))))));



CREATE POLICY "Vendors can delete their own services" ON "public"."vendor_services" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."vendors" "v"
  WHERE (("v"."id" = "vendor_services"."vendor_id") AND ("v"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Vendors can insert their own services" ON "public"."vendor_services" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."vendors" "v"
  WHERE (("v"."id" = "vendor_services"."vendor_id") AND ("v"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Vendors can update their own services" ON "public"."vendor_services" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."vendors" "v"
  WHERE (("v"."id" = "vendor_services"."vendor_id") AND ("v"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Vendors can view their own services" ON "public"."vendor_services" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."vendors" "v"
  WHERE (("v"."id" = "vendor_services"."vendor_id") AND ("v"."owner_id" = "auth"."uid"())))));



CREATE POLICY "View Messages" ON "public"."project_space_messages" FOR SELECT USING (("public"."is_project_member"("project_space_id") OR "public"."is_project_creator"("project_space_id")));



CREATE POLICY "View Own Applications" ON "public"."project_applications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "View Project Messages" ON "public"."project_messages" FOR SELECT USING (("public"."is_project_member"("project_id") OR "public"."is_project_creator"("project_id")));



CREATE POLICY "View Project Spaces" ON "public"."project_spaces" FOR SELECT USING ((((("project_space_type")::"text" = ANY (ARRAY['public'::"text", 'private'::"text"])) AND ("auth"."role"() = 'authenticated'::"text")) OR ((("project_space_type")::"text" = 'secret'::"text") AND ("public"."is_project_member"("id") OR "public"."check_is_project_creator"("project_id"))) OR "public"."is_project_member"("id") OR "public"."check_is_project_creator"("project_id")));



CREATE POLICY "View Projects" ON "public"."projects" FOR SELECT USING ((("is_public" = true) OR ("creator_id" = "auth"."uid"()) OR "public"."check_is_project_member"("id")));



ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budget_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_sheets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_page_admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_page_followers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_page_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."content_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."direct_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."discussion_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."film_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flagged_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fraud_networks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gear_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gov_approval_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gov_audit_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gov_entity_relationships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."group_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_bookmarks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_saved_searches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."key_backups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_docs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_bundle_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_wishlists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moderation_evidence" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moderation_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pitch_access_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pitch_calls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pitch_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_cinema" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_flags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_policies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portfolio_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_bookmarks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_credits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_message_read_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_space_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_space_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_spaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_helpful_marks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_join_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_message_read_status" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_pitch_calls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_item_assignees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."schedule_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shot_list" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "simple_insert_pm" ON "public"."project_messages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "simple_select_pm" ON "public"."project_messages" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."space_access_grants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."space_access_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "space_members_send_messages_v2" ON "public"."project_space_messages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "space_members_view_messages_v2" ON "public"."project_space_messages" FOR SELECT USING (true);



ALTER TABLE "public"."support_ticket_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_incidents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_announcement_dismissals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_bans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_experience" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_film_ratings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_push_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_risk_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_skills" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendor_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."verification_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vip_invites" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."audit_logs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."calls";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."content_reports";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."direct_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."platform_flags";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."platform_policies";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."platform_settings";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."post_comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."post_likes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."posts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."project_space_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."room_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."system_announcements";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_roles";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_sessions";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



















































SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;















































































































GRANT ALL ON FUNCTION "public"."approve_space_access"("p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_space_access"("p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_space_access"("p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_verification"("_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_verification"("_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_verification"("_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_user_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_user_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_user_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_economics_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_economics_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_economics_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_add_page_owner_as_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_add_page_owner_as_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_add_page_owner_as_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_close_job_on_hire"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_close_job_on_hire"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_close_job_on_hire"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ban_user"("_target_user_id" "uuid", "_reason" "text", "_ban_type" "text", "_expires_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ban_user"("_target_user_id" "uuid", "_reason" "text", "_ban_type" "text", "_expires_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ban_user"("_target_user_id" "uuid", "_reason" "text", "_ban_type" "text", "_expires_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."block_bundle_children_on_booking"() TO "anon";
GRANT ALL ON FUNCTION "public"."block_bundle_children_on_booking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."block_bundle_children_on_booking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_project_creator"("_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_project_creator"("_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_project_creator"("_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_project_member"("_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_project_member"("_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_project_member"("_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_admin_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."claim_admin_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_admin_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_discussion_room_with_creator"("c_id" "uuid", "cat_id" "uuid", "room_title" "text", "room_description" "text", "type" "text", "room_tags" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_discussion_room_with_creator"("c_id" "uuid", "cat_id" "uuid", "room_title" "text", "room_description" "text", "type" "text", "room_tags" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_discussion_room_with_creator"("c_id" "uuid", "cat_id" "uuid", "room_title" "text", "room_description" "text", "type" "text", "room_tags" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification_for_like"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification_for_like"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification_for_like"() TO "service_role";



GRANT ALL ON FUNCTION "public"."flag_listing_on_poor_condition"() TO "anon";
GRANT ALL ON FUNCTION "public"."flag_listing_on_poor_condition"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."flag_listing_on_poor_condition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."force_logout_user"("_user_id" "uuid", "_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."force_logout_user"("_user_id" "uuid", "_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_logout_user"("_user_id" "uuid", "_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."force_password_reset_user"("_user_id" "uuid", "_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."force_password_reset_user"("_user_id" "uuid", "_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_password_reset_user"("_user_id" "uuid", "_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."format_notification_message"("content" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."format_notification_message"("content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."format_notification_message"("content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_admin_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_admin_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_aggregated_film_ratings"("tmdb_ids" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_aggregated_film_ratings"("tmdb_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_aggregated_film_ratings"("tmdb_ids" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_follower_count"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_follower_count"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_follower_count"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_listing_with_rating"("listing_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_listing_with_rating"("listing_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_listing_with_rating"("listing_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_messages_for_channel_paginated"("p_channel_id" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_messages_for_channel_paginated"("p_channel_id" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_messages_for_channel_paginated"("p_channel_id" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_platform_economics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_platform_economics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_platform_economics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_segmented_film_ratings"("tmdb_ids" integer[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_segmented_film_ratings"("tmdb_ids" integer[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_segmented_film_ratings"("tmdb_ids" integer[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_shared_wishlist"("p_token" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_shared_wishlist"("p_token" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_shared_wishlist"("p_token" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_unread_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_unread_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_unread_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_message_previews"("limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_message_previews"("limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_message_previews"("limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_vendor_with_rating"("vendor_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_vendor_with_rating"("vendor_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_vendor_with_rating"("vendor_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_follower_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_follower_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_follower_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_mass_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_mass_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_mass_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_mention_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_mention_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_mention_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_post_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_post_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_post_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_role" "public"."app_role", "_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_unread_messages"() TO "anon";
GRANT ALL ON FUNCTION "public"."has_unread_messages"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_unread_messages"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_internal"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_internal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_internal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of_project"("_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of_project"("_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of_project"("_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_project_creator"("_project_space_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_project_creator"("_project_space_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_project_creator"("_project_space_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_project_member"("_project_space_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_project_member"("_project_space_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_project_member"("_project_space_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_room_admin"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_room_admin"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_room_admin"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_room_creator"("p_room_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_room_creator"("p_room_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_room_creator"("p_room_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_room_member"("p_room_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_room_member"("p_room_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_room_member"("p_room_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."lift_ban"("_target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."lift_ban"("_target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lift_ban"("_target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_message_as_seen"("p_message_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_message_as_seen"("p_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_message_as_seen"("p_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_project_message_as_seen"("p_message_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_project_message_as_seen"("p_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_project_message_as_seen"("p_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_project_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_project_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_project_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_room_message_as_seen"("p_message_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_room_message_as_seen"("p_message_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_room_message_as_seen"("p_message_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_room_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_room_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_room_message_as_seen"("p_message_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mute_user"("_target_user_id" "uuid", "_duration_hours" integer, "_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mute_user"("_target_user_id" "uuid", "_duration_hours" integer, "_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mute_user"("_target_user_id" "uuid", "_duration_hours" integer, "_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_gear_alert_match"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_gear_alert_match"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_gear_alert_match"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_direct_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_direct_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_direct_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_project_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_project_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_project_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_room_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_room_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_room_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_project_credit"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_project_credit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_project_credit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_room_join_request"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_room_join_request"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_room_join_request"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_room_member_invite"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_room_member_invite"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_room_member_invite"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_page_follower"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_page_follower"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_page_follower"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_pitch_submission"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_pitch_submission"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_pitch_submission"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_schedule_locked"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_schedule_locked"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_schedule_locked"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_wishlist_availability"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_wishlist_availability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_wishlist_availability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_verification"("_request_id" "uuid", "_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_verification"("_request_id" "uuid", "_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_verification"("_request_id" "uuid", "_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_wishlist_on_booking"() TO "anon";
GRANT ALL ON FUNCTION "public"."remove_wishlist_on_booking"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_wishlist_on_booking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."request_space_access"("p_target_type" "text", "p_target_id" "text", "p_reason_category" "text", "p_reason_details" "text", "p_emergency" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."request_space_access"("p_target_type" "text", "p_target_id" "text", "p_reason_category" "text", "p_reason_details" "text", "p_emergency" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_space_access"("p_target_type" "text", "p_target_id" "text", "p_reason_category" "text", "p_reason_details" "text", "p_emergency" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_report"("_report_id" "uuid", "_status" "text", "_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_report"("_report_id" "uuid", "_status" "text", "_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_report"("_report_id" "uuid", "_status" "text", "_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."restore_user_access"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."restore_user_access"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."restore_user_access"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_user_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_user_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_user_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_marketplace_listings"("search_query" "text", "filter_type" "public"."listing_type", "filter_category" "text", "filter_location" "text", "min_price" numeric, "max_price" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."search_marketplace_listings"("search_query" "text", "filter_type" "public"."listing_type", "filter_category" "text", "filter_location" "text", "min_price" numeric, "max_price" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_marketplace_listings"("search_query" "text", "filter_type" "public"."listing_type", "filter_category" "text", "filter_location" "text", "min_price" numeric, "max_price" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_vendors"("search_query" "text", "filter_category" "text", "filter_location" "text", "verified_only" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."search_vendors"("search_query" "text", "filter_category" "text", "filter_location" "text", "verified_only" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_vendors"("search_query" "text", "filter_category" "text", "filter_location" "text", "verified_only" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."send_governance_notification"("_target_user_id" "uuid", "_action_type" "text", "_reason" "text", "_notify_user" boolean, "_disclosure_level" "text", "_suppression_reason" "text", "_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."send_governance_notification"("_target_user_id" "uuid", "_action_type" "text", "_reason" "text", "_notify_user" boolean, "_disclosure_level" "text", "_suppression_reason" "text", "_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_governance_notification"("_target_user_id" "uuid", "_action_type" "text", "_reason" "text", "_notify_user" boolean, "_disclosure_level" "text", "_suppression_reason" "text", "_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_monetization_status"("_user_id" "uuid", "_disabled" boolean, "_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_monetization_status"("_user_id" "uuid", "_disabled" boolean, "_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_monetization_status"("_user_id" "uuid", "_disabled" boolean, "_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."shadow_ban_user"("_target_user_id" "uuid", "_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."shadow_ban_user"("_target_user_id" "uuid", "_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."shadow_ban_user"("_target_user_id" "uuid", "_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_is_internal_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_is_internal_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_is_internal_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_official_team_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_official_team_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_official_team_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_discussion_room_member_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_discussion_room_member_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_discussion_room_member_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_listing_condition_score"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_listing_condition_score"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_listing_condition_score"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_page_follower_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_page_follower_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_page_follower_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pitch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pitch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pitch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_post_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_post_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_post_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_review_helpful_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_review_helpful_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_review_helpful_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."budget_items" TO "anon";
GRANT ALL ON TABLE "public"."budget_items" TO "authenticated";
GRANT ALL ON TABLE "public"."budget_items" TO "service_role";



GRANT ALL ON TABLE "public"."call_participants" TO "anon";
GRANT ALL ON TABLE "public"."call_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."call_participants" TO "service_role";



GRANT ALL ON TABLE "public"."call_sheets" TO "anon";
GRANT ALL ON TABLE "public"."call_sheets" TO "authenticated";
GRANT ALL ON TABLE "public"."call_sheets" TO "service_role";



GRANT ALL ON TABLE "public"."calls" TO "anon";
GRANT ALL ON TABLE "public"."calls" TO "authenticated";
GRANT ALL ON TABLE "public"."calls" TO "service_role";



GRANT ALL ON TABLE "public"."company_page_admins" TO "anon";
GRANT ALL ON TABLE "public"."company_page_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."company_page_admins" TO "service_role";



GRANT ALL ON TABLE "public"."company_page_followers" TO "anon";
GRANT ALL ON TABLE "public"."company_page_followers" TO "authenticated";
GRANT ALL ON TABLE "public"."company_page_followers" TO "service_role";



GRANT ALL ON TABLE "public"."company_page_members" TO "anon";
GRANT ALL ON TABLE "public"."company_page_members" TO "authenticated";
GRANT ALL ON TABLE "public"."company_page_members" TO "service_role";



GRANT ALL ON TABLE "public"."company_pages" TO "anon";
GRANT ALL ON TABLE "public"."company_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."company_pages" TO "service_role";



GRANT ALL ON TABLE "public"."content_reports" TO "anon";
GRANT ALL ON TABLE "public"."content_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."content_reports" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."direct_messages" TO "anon";
GRANT ALL ON TABLE "public"."direct_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_messages" TO "service_role";



GRANT ALL ON TABLE "public"."discussion_rooms" TO "anon";
GRANT ALL ON TABLE "public"."discussion_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."discussion_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."files" TO "anon";
GRANT ALL ON TABLE "public"."files" TO "authenticated";
GRANT ALL ON TABLE "public"."files" TO "service_role";



GRANT ALL ON TABLE "public"."film_reviews" TO "anon";
GRANT ALL ON TABLE "public"."film_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."film_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."flagged_messages" TO "anon";
GRANT ALL ON TABLE "public"."flagged_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."flagged_messages" TO "service_role";



GRANT ALL ON TABLE "public"."fraud_networks" TO "anon";
GRANT ALL ON TABLE "public"."fraud_networks" TO "authenticated";
GRANT ALL ON TABLE "public"."fraud_networks" TO "service_role";



GRANT ALL ON TABLE "public"."gear_alerts" TO "anon";
GRANT ALL ON TABLE "public"."gear_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."gear_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."project_space_members" TO "anon";
GRANT ALL ON TABLE "public"."project_space_members" TO "authenticated";
GRANT ALL ON TABLE "public"."project_space_members" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_item_assignees" TO "anon";
GRANT ALL ON TABLE "public"."schedule_item_assignees" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_item_assignees" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_items" TO "anon";
GRANT ALL ON TABLE "public"."schedule_items" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_items" TO "service_role";



GRANT ALL ON TABLE "public"."user_availability" TO "anon";
GRANT ALL ON TABLE "public"."user_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."user_availability" TO "service_role";



GRANT ALL ON TABLE "public"."global_user_availability_view" TO "anon";
GRANT ALL ON TABLE "public"."global_user_availability_view" TO "authenticated";
GRANT ALL ON TABLE "public"."global_user_availability_view" TO "service_role";



GRANT ALL ON TABLE "public"."gov_approval_queue" TO "anon";
GRANT ALL ON TABLE "public"."gov_approval_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."gov_approval_queue" TO "service_role";



GRANT ALL ON TABLE "public"."gov_audit_ledger" TO "anon";
GRANT ALL ON TABLE "public"."gov_audit_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."gov_audit_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."gov_entity_relationships" TO "anon";
GRANT ALL ON TABLE "public"."gov_entity_relationships" TO "authenticated";
GRANT ALL ON TABLE "public"."gov_entity_relationships" TO "service_role";



GRANT ALL ON TABLE "public"."group_keys" TO "anon";
GRANT ALL ON TABLE "public"."group_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."group_keys" TO "service_role";



GRANT ALL ON TABLE "public"."job_alerts" TO "anon";
GRANT ALL ON TABLE "public"."job_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."job_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."job_applications" TO "anon";
GRANT ALL ON TABLE "public"."job_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."job_applications" TO "service_role";



GRANT ALL ON TABLE "public"."job_bookmarks" TO "anon";
GRANT ALL ON TABLE "public"."job_bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."job_bookmarks" TO "service_role";



GRANT ALL ON TABLE "public"."job_saved_searches" TO "anon";
GRANT ALL ON TABLE "public"."job_saved_searches" TO "authenticated";
GRANT ALL ON TABLE "public"."job_saved_searches" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."key_backups" TO "anon";
GRANT ALL ON TABLE "public"."key_backups" TO "authenticated";
GRANT ALL ON TABLE "public"."key_backups" TO "service_role";



GRANT ALL ON TABLE "public"."legal_docs" TO "anon";
GRANT ALL ON TABLE "public"."legal_docs" TO "authenticated";
GRANT ALL ON TABLE "public"."legal_docs" TO "service_role";



GRANT ALL ON TABLE "public"."legal_requests" TO "anon";
GRANT ALL ON TABLE "public"."legal_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."legal_requests" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_bookings" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_bundle_items" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_bundle_items" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_bundle_items" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_listings" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_listings" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_listings" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_reviews" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_wishlists" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_wishlists" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_wishlists" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."moderation_evidence" TO "anon";
GRANT ALL ON TABLE "public"."moderation_evidence" TO "authenticated";
GRANT ALL ON TABLE "public"."moderation_evidence" TO "service_role";



GRANT ALL ON TABLE "public"."moderation_notes" TO "anon";
GRANT ALL ON TABLE "public"."moderation_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."moderation_notes" TO "service_role";



GRANT ALL ON TABLE "public"."notification_logs" TO "anon";
GRANT ALL ON TABLE "public"."notification_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_logs" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."pitch_access_logs" TO "anon";
GRANT ALL ON TABLE "public"."pitch_access_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."pitch_access_logs" TO "service_role";



GRANT ALL ON TABLE "public"."pitch_calls" TO "anon";
GRANT ALL ON TABLE "public"."pitch_calls" TO "authenticated";
GRANT ALL ON TABLE "public"."pitch_calls" TO "service_role";



GRANT ALL ON TABLE "public"."pitch_submissions" TO "anon";
GRANT ALL ON TABLE "public"."pitch_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."pitch_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."platform_announcements" TO "anon";
GRANT ALL ON TABLE "public"."platform_announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_announcements" TO "service_role";



GRANT ALL ON TABLE "public"."platform_cinema" TO "anon";
GRANT ALL ON TABLE "public"."platform_cinema" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_cinema" TO "service_role";



GRANT ALL ON TABLE "public"."platform_flags" TO "anon";
GRANT ALL ON TABLE "public"."platform_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_flags" TO "service_role";



GRANT ALL ON TABLE "public"."platform_policies" TO "anon";
GRANT ALL ON TABLE "public"."platform_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_policies" TO "service_role";



GRANT ALL ON TABLE "public"."platform_rules" TO "anon";
GRANT ALL ON TABLE "public"."platform_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_rules" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."portfolio_items" TO "anon";
GRANT ALL ON TABLE "public"."portfolio_items" TO "authenticated";
GRANT ALL ON TABLE "public"."portfolio_items" TO "service_role";



GRANT ALL ON TABLE "public"."post_bookmarks" TO "anon";
GRANT ALL ON TABLE "public"."post_bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."post_bookmarks" TO "service_role";



GRANT ALL ON TABLE "public"."post_comments" TO "anon";
GRANT ALL ON TABLE "public"."post_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."post_comments" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profile_views" TO "anon";
GRANT ALL ON TABLE "public"."profile_views" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_views" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT ON TABLE "public"."profiles" TO PUBLIC;



GRANT SELECT("id") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("id") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("id") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("updated_at") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("updated_at") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("updated_at") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("username") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("username") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("username") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("full_name") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("full_name") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("full_name") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("avatar_url") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("avatar_url") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("avatar_url") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("cover_image_url") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("cover_image_url") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("cover_image_url") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("website") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("website") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("website") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("bio") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("bio") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("bio") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("location") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("location") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("location") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("experience") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("experience") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("experience") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("craft") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("craft") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("craft") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("instagram_url") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("instagram_url") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("instagram_url") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("youtube_url") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("youtube_url") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("youtube_url") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("account_type") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("account_type") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("account_type") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("social_links") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("social_links") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("social_links") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("onboarding_completed") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("onboarding_completed") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("onboarding_completed") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("is_verified") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("is_verified") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("is_verified") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("is_banned") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("is_banned") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("is_banned") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("phone") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("phone") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("phone") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("trust_score") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("trust_score") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("trust_score") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("shadow_banned_at") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("shadow_banned_at") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("shadow_banned_at") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("restriction_flags") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("restriction_flags") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("restriction_flags") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("is_official_team") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("is_official_team") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("is_official_team") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("force_password_reset") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("force_password_reset") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("force_password_reset") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("is_internal") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("is_internal") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("is_internal") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("is_shadowbanned") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("is_shadowbanned") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("is_shadowbanned") ON TABLE "public"."profiles" TO "anon";



GRANT SELECT("push_token") ON TABLE "public"."profiles" TO PUBLIC;
GRANT SELECT("push_token") ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT("push_token") ON TABLE "public"."profiles" TO "anon";



GRANT ALL ON TABLE "public"."project_applications" TO "anon";
GRANT ALL ON TABLE "public"."project_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."project_applications" TO "service_role";



GRANT ALL ON TABLE "public"."project_credits" TO "anon";
GRANT ALL ON TABLE "public"."project_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."project_credits" TO "service_role";



GRANT ALL ON TABLE "public"."project_message_read_status" TO "anon";
GRANT ALL ON TABLE "public"."project_message_read_status" TO "authenticated";
GRANT ALL ON TABLE "public"."project_message_read_status" TO "service_role";



GRANT ALL ON TABLE "public"."project_messages" TO "anon";
GRANT ALL ON TABLE "public"."project_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."project_messages" TO "service_role";



GRANT ALL ON TABLE "public"."project_space_bookmarks" TO "anon";
GRANT ALL ON TABLE "public"."project_space_bookmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."project_space_bookmarks" TO "service_role";



GRANT ALL ON TABLE "public"."project_space_categories" TO "anon";
GRANT ALL ON TABLE "public"."project_space_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."project_space_categories" TO "service_role";



GRANT ALL ON TABLE "public"."project_space_join_requests" TO "anon";
GRANT ALL ON TABLE "public"."project_space_join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."project_space_join_requests" TO "service_role";



GRANT ALL ON SEQUENCE "public"."project_space_join_requests_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."project_space_join_requests_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."project_space_join_requests_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."project_space_messages" TO "anon";
GRANT ALL ON TABLE "public"."project_space_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."project_space_messages" TO "service_role";



GRANT ALL ON TABLE "public"."project_spaces" TO "anon";
GRANT ALL ON TABLE "public"."project_spaces" TO "authenticated";
GRANT ALL ON TABLE "public"."project_spaces" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."review_helpful_marks" TO "anon";
GRANT ALL ON TABLE "public"."review_helpful_marks" TO "authenticated";
GRANT ALL ON TABLE "public"."review_helpful_marks" TO "service_role";



GRANT ALL ON TABLE "public"."room_categories" TO "anon";
GRANT ALL ON TABLE "public"."room_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."room_categories" TO "service_role";



GRANT ALL ON TABLE "public"."room_join_requests" TO "anon";
GRANT ALL ON TABLE "public"."room_join_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."room_join_requests" TO "service_role";



GRANT ALL ON TABLE "public"."room_members" TO "anon";
GRANT ALL ON TABLE "public"."room_members" TO "authenticated";
GRANT ALL ON TABLE "public"."room_members" TO "service_role";



GRANT ALL ON TABLE "public"."room_message_read_status" TO "anon";
GRANT ALL ON TABLE "public"."room_message_read_status" TO "authenticated";
GRANT ALL ON TABLE "public"."room_message_read_status" TO "service_role";



GRANT ALL ON TABLE "public"."room_messages" TO "anon";
GRANT ALL ON TABLE "public"."room_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."room_messages" TO "service_role";



GRANT ALL ON TABLE "public"."saved_pitch_calls" TO "anon";
GRANT ALL ON TABLE "public"."saved_pitch_calls" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_pitch_calls" TO "service_role";



GRANT ALL ON TABLE "public"."security_events" TO "anon";
GRANT ALL ON TABLE "public"."security_events" TO "authenticated";
GRANT ALL ON TABLE "public"."security_events" TO "service_role";



GRANT ALL ON TABLE "public"."shot_list" TO "anon";
GRANT ALL ON TABLE "public"."shot_list" TO "authenticated";
GRANT ALL ON TABLE "public"."shot_list" TO "service_role";



GRANT ALL ON TABLE "public"."space_access_grants" TO "anon";
GRANT ALL ON TABLE "public"."space_access_grants" TO "authenticated";
GRANT ALL ON TABLE "public"."space_access_grants" TO "service_role";



GRANT ALL ON TABLE "public"."space_access_requests" TO "anon";
GRANT ALL ON TABLE "public"."space_access_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."space_access_requests" TO "service_role";



GRANT ALL ON TABLE "public"."support_ticket_messages" TO "anon";
GRANT ALL ON TABLE "public"."support_ticket_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_ticket_messages" TO "service_role";



GRANT ALL ON TABLE "public"."support_tickets" TO "anon";
GRANT ALL ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."system_announcements" TO "anon";
GRANT ALL ON TABLE "public"."system_announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."system_announcements" TO "service_role";



GRANT ALL ON TABLE "public"."system_incidents" TO "anon";
GRANT ALL ON TABLE "public"."system_incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."system_incidents" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."user_analytics" TO "anon";
GRANT ALL ON TABLE "public"."user_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."user_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."user_announcement_dismissals" TO "anon";
GRANT ALL ON TABLE "public"."user_announcement_dismissals" TO "authenticated";
GRANT ALL ON TABLE "public"."user_announcement_dismissals" TO "service_role";



GRANT ALL ON TABLE "public"."user_bans" TO "anon";
GRANT ALL ON TABLE "public"."user_bans" TO "authenticated";
GRANT ALL ON TABLE "public"."user_bans" TO "service_role";



GRANT ALL ON TABLE "public"."user_connections" TO "anon";
GRANT ALL ON TABLE "public"."user_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."user_connections" TO "service_role";



GRANT ALL ON TABLE "public"."user_experience" TO "anon";
GRANT ALL ON TABLE "public"."user_experience" TO "authenticated";
GRANT ALL ON TABLE "public"."user_experience" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_experience_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_experience_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_experience_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_film_ratings" TO "anon";
GRANT ALL ON TABLE "public"."user_film_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_film_ratings" TO "service_role";



GRANT ALL ON TABLE "public"."user_push_tokens" TO "anon";
GRANT ALL ON TABLE "public"."user_push_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."user_push_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."user_risk_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_risk_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_risk_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_skills" TO "anon";
GRANT ALL ON TABLE "public"."user_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."user_skills" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_skills_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_skills_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_skills_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_services" TO "anon";
GRANT ALL ON TABLE "public"."vendor_services" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_services" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";



GRANT ALL ON TABLE "public"."verification_requests" TO "anon";
GRANT ALL ON TABLE "public"."verification_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."verification_requests" TO "service_role";



GRANT ALL ON TABLE "public"."vip_invites" TO "anon";
GRANT ALL ON TABLE "public"."vip_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."vip_invites" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--

CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



CREATE POLICY "Anyone can view marketplace images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'marketplace-images'::"text"));



CREATE POLICY "Anyone can view vendor images" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'vendor-images'::"text"));



CREATE POLICY "Auth upload avatars" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'avatars'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Auth upload call-sheets" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'call-sheets'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Auth upload company_assets" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'company_assets'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Auth upload legal-docs" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'legal-docs'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Auth upload post-media" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'post-media'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Auth upload project-assets" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'project-assets'::"text") AND ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "Auth upload resumes" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'resumes'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Auth upload support" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'support'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Auth view call-sheets" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'call-sheets'::"text"));



CREATE POLICY "Auth view legal-docs" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'legal-docs'::"text"));



CREATE POLICY "Auth view resumes" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'resumes'::"text"));



CREATE POLICY "Auth view support" ON "storage"."objects" FOR SELECT TO "authenticated" USING (("bucket_id" = 'support'::"text"));



CREATE POLICY "Authenticated can list buckets" ON "storage"."buckets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can upload marketplace images" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'marketplace-images'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Authenticated users can upload vendor images" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'vendor-images'::"text") AND ("auth"."role"() = 'authenticated'::"text")));



CREATE POLICY "Owner delete call-sheets" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'call-sheets'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner delete company_assets" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'company_assets'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner delete legal-docs" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'legal-docs'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner delete project files" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'project-files'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner delete project-assets" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'project-assets'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner delete resumes" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'resumes'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner delete support" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'support'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner manage portfolios" ON "storage"."objects" USING ((("bucket_id" = 'portfolios'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner manage post-media" ON "storage"."objects" USING ((("bucket_id" = 'post-media'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner update call-sheets" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'call-sheets'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner update company_assets" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'company_assets'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner update legal-docs" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'legal-docs'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner update project files" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'project-files'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner update project-assets" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'project-assets'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner update resumes" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'resumes'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Owner update support" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'support'::"text") AND ("owner" = "auth"."uid"())));



CREATE POLICY "Project members upload files" ON "storage"."objects" FOR INSERT WITH CHECK ((("bucket_id" = 'project-files'::"text") AND ("auth"."role"() = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE ((("project_space_members"."project_space_id")::"text" = ANY ("storage"."foldername"("objects"."name"))) AND ("project_space_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Project members view files" ON "storage"."objects" FOR SELECT USING ((("bucket_id" = 'project-files'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."project_space_members"
  WHERE ((("project_space_members"."project_space_id")::"text" = ANY ("storage"."foldername"("objects"."name"))) AND ("project_space_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Public view avatars" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "Public view company_assets" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'company_assets'::"text"));



CREATE POLICY "Public view portfolios" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'portfolios'::"text"));



CREATE POLICY "Public view post-media" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'post-media'::"text"));



CREATE POLICY "Public view project-assets" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'project-assets'::"text"));



CREATE POLICY "Users can delete their own marketplace images" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'marketplace-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Users can delete their own vendor images" ON "storage"."objects" FOR DELETE USING ((("bucket_id" = 'vendor-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Users can update their own marketplace images" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'marketplace-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));



CREATE POLICY "Users can update their own vendor images" ON "storage"."objects" FOR UPDATE USING ((("bucket_id" = 'vendor-images'::"text") AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[1])));


