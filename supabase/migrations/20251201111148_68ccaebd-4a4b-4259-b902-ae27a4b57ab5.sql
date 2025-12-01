-- ============================================
-- FIX: Remaining Function Search Path Issues
-- ============================================
-- Completes the security hardening of all database functions

-- Fix is_project_space_member
CREATE OR REPLACE FUNCTION public.is_project_space_member(p_project_space_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM project_space_members
        WHERE project_space_id = p_project_space_id AND user_id = p_user_id
    );
$function$;

-- Fix is_member_of_project
CREATE OR REPLACE FUNCTION public.is_member_of_project(_project_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_space_members 
    WHERE project_space_id = _project_id AND user_id = auth.uid()
  );
END;
$function$;

-- Fix is_member_of_room
CREATE OR REPLACE FUNCTION public.is_member_of_room(_room_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_members 
    WHERE room_id = _room_id AND user_id = auth.uid()
  );
END;
$function$;

-- Fix end_call
CREATE OR REPLACE FUNCTION public.end_call(p_call_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.calls
        WHERE id = p_call_id AND created_by = p_user_id
    ) THEN
        RAISE EXCEPTION 'Only the call creator can end the call';
    END IF;

    UPDATE public.calls
    SET status = 'ended', ended_at = now()
    WHERE id = p_call_id;

    UPDATE public.call_participants
    SET left_at = now()
    WHERE call_id = p_call_id AND left_at IS NULL;
END;
$function$;

-- Fix join_call
CREATE OR REPLACE FUNCTION public.join_call(p_call_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_project_space_id uuid;
BEGIN
    SELECT project_space_id INTO v_project_space_id
    FROM public.calls
    WHERE id = p_call_id;

    IF NOT is_project_space_member(v_project_space_id, p_user_id) THEN
        RAISE EXCEPTION 'User is not a member of the project_space';
    END IF;

    INSERT INTO public.call_participants (call_id, user_id)
    VALUES (p_call_id, p_user_id)
    ON CONFLICT (call_id, user_id) DO NOTHING;
END;
$function$;

-- Fix leave_call
CREATE OR REPLACE FUNCTION public.leave_call(p_call_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    UPDATE public.call_participants
    SET left_at = now()
    WHERE call_id = p_call_id AND user_id = p_user_id AND left_at IS NULL;
END;
$function$;

-- Fix has_unread_messages
CREATE OR REPLACE FUNCTION public.has_unread_messages()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.project_space_message_read_status
        WHERE user_id = auth.uid()
    );
END;
$function$;

-- Fix get_messages_for_channel
CREATE OR REPLACE FUNCTION public.get_messages_for_channel(p_channel_id text)
RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, sender_id uuid, sender_profile jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
        ) AS sender_profile
    FROM direct_messages dm
    JOIN profiles p ON dm.sender_id = p.id
    WHERE dm.channel_id = p_channel_id
    ORDER BY dm.created_at ASC;
END;
$function$;

-- Fix get_user_conversations_with_profiles
CREATE OR REPLACE FUNCTION public.get_user_conversations_with_profiles(p_user_id uuid)
RETURNS TABLE(other_user_id uuid, other_user_full_name text, other_user_avatar_url text, last_message_content text, last_message_created_at timestamp with time zone, unread_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    RETURN QUERY
    WITH latest_messages AS (
        SELECT DISTINCT ON (
            LEAST(sender_id, recipient_id),
            GREATEST(sender_id, recipient_id)
        )
            id, sender_id, recipient_id, content, created_at, read_at
        FROM direct_messages
        WHERE sender_id = p_user_id OR recipient_id = p_user_id
        ORDER BY
            LEAST(sender_id, recipient_id),
            GREATEST(sender_id, recipient_id),
            created_at DESC
    ),
    unread_counts AS (
        SELECT sender_id, COUNT(*) as count
        FROM direct_messages
        WHERE recipient_id = p_user_id AND read_at IS NULL
        GROUP BY sender_id
    )
    SELECT
        CASE
            WHEN lm.sender_id = p_user_id THEN lm.recipient_id
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
            WHEN lm.sender_id = p_user_id THEN lm.recipient_id
            ELSE lm.sender_id
        END
    )
    LEFT JOIN unread_counts uc ON uc.sender_id = (
        CASE
            WHEN lm.sender_id = p_user_id THEN lm.recipient_id
            ELSE lm.sender_id
        END
    )
    ORDER BY lm.created_at DESC;
END;
$function$;

-- Fix get_listing_with_rating
CREATE OR REPLACE FUNCTION public.get_listing_with_rating(listing_uuid uuid)
RETURNS TABLE(id uuid, user_id uuid, listing_type listing_type, title text, description text, category text, price_per_day numeric, price_per_week numeric, location text, images text[], specifications jsonb, availability_calendar jsonb, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone, average_rating numeric, review_count bigint)
LANGUAGE plpgsql
SET search_path = public
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
$function$;

-- Fix get_vendor_with_rating
CREATE OR REPLACE FUNCTION public.get_vendor_with_rating(vendor_uuid uuid)
RETURNS TABLE(id uuid, owner_id uuid, business_name text, description text, category text[], services_offered text[], location text, address text, phone text, email text, website text, logo_url text, images text[], is_verified boolean, verification_date timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, average_rating numeric, review_count bigint)
LANGUAGE plpgsql
SET search_path = public
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
$function$;

-- Fix handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url, onboarding_completed)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'username', 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    username = COALESCE(EXCLUDED.username, profiles.username),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    onboarding_completed = true;
  RETURN new;
END;
$function$;

-- Fix create_discussion_room_with_creator
CREATE OR REPLACE FUNCTION public.create_discussion_room_with_creator(room_title text, room_description text, room_tags text[], cat_id uuid, type text, c_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    new_room_id UUID;
BEGIN
    INSERT INTO public.discussion_rooms (
        title, name, description, category_id, room_type, creator_id, is_public
    )
    VALUES (
        room_title, room_title, room_description, cat_id, type, auth.uid(), (type = 'public')
    )
    RETURNING id INTO new_room_id;
    
    INSERT INTO public.room_members (room_id, user_id)
    VALUES (new_room_id, auth.uid());
    
    RETURN new_room_id;
END;
$function$;

-- Fix start_call
CREATE OR REPLACE FUNCTION public.start_call(call_type text, created_by uuid, room_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    new_call_id UUID;
BEGIN
    INSERT INTO public.calls (call_type, created_by, room_id, status)
    VALUES (call_type, auth.uid(), room_id, 'active')
    RETURNING id INTO new_call_id;
    
    INSERT INTO public.call_participants (call_id, user_id)
    VALUES (new_call_id, auth.uid());
    
    RETURN new_call_id;
END;
$function$;

-- Fix search_marketplace_listings
CREATE OR REPLACE FUNCTION public.search_marketplace_listings(search_query text DEFAULT NULL::text, filter_type listing_type DEFAULT NULL::listing_type, filter_category text DEFAULT NULL::text, filter_location text DEFAULT NULL::text, min_price numeric DEFAULT NULL::numeric, max_price numeric DEFAULT NULL::numeric)
RETURNS TABLE(id uuid, user_id uuid, listing_type listing_type, title text, description text, category text, price_per_day numeric, price_per_week numeric, location text, images text[], is_active boolean, created_at timestamp with time zone)
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        ml.id, ml.user_id, ml.listing_type, ml.title, ml.description,
        ml.category, ml.price_per_day, ml.price_per_week, ml.location,
        ml.images, ml.is_active, ml.created_at
    FROM marketplace_listings ml
    WHERE 
        ml.is_active = true
        AND (search_query IS NULL OR ml.title ILIKE '%' || search_query || '%' OR ml.description ILIKE '%' || search_query || '%')
        AND (filter_type IS NULL OR ml.listing_type = filter_type)
        AND (filter_category IS NULL OR ml.category = filter_category)
        AND (filter_location IS NULL OR ml.location ILIKE '%' || filter_location || '%')
        AND (min_price IS NULL OR ml.price_per_day >= min_price)
        AND (max_price IS NULL OR ml.price_per_day <= max_price)
    ORDER BY ml.created_at DESC;
END;
$function$;

-- Fix search_vendors
CREATE OR REPLACE FUNCTION public.search_vendors(search_query text DEFAULT NULL::text, filter_category text DEFAULT NULL::text, filter_location text DEFAULT NULL::text, verified_only boolean DEFAULT false)
RETURNS TABLE(id uuid, owner_id uuid, business_name text, description text, category text[], services_offered text[], location text, phone text, email text, website text, logo_url text, images text[], is_verified boolean, created_at timestamp with time zone)
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        v.id, v.owner_id, v.business_name, v.description, v.category,
        v.services_offered, v.location, v.phone, v.email, v.website,
        v.logo_url, v.images, v.is_verified, v.created_at
    FROM vendors v
    WHERE 
        (NOT verified_only OR v.is_verified = true)
        AND (search_query IS NULL OR v.business_name ILIKE '%' || search_query || '%' OR v.description ILIKE '%' || search_query || '%')
        AND (filter_category IS NULL OR filter_category = ANY(v.category))
        AND (filter_location IS NULL OR v.location ILIKE '%' || filter_location || '%')
    ORDER BY v.is_verified DESC, v.created_at DESC;
END;
$function$;