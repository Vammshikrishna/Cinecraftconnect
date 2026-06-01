-- 20260528000004_wishlist_alerts.sql

-- 1. Create marketplace_wishlists table
CREATE TABLE IF NOT EXISTS public.marketplace_wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, listing_id)
);

-- 2. Create gear_alerts table
CREATE TABLE IF NOT EXISTS public.gear_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT,
    keyword TEXT,
    max_price NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add wishlist_share_token to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wishlist_share_token UUID DEFAULT gen_random_uuid();

-- 4. RLS Policies
ALTER TABLE public.marketplace_wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gear_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wishlists"
ON public.marketplace_wishlists FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own wishlists"
ON public.marketplace_wishlists FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wishlists"
ON public.marketplace_wishlists FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own gear alerts"
ON public.gear_alerts FOR ALL
USING (auth.uid() = user_id);

-- 5. RPC for Shared Wishlists
CREATE OR REPLACE FUNCTION get_shared_wishlist(p_token UUID)
RETURNS TABLE (
    id UUID,
    listing_id UUID,
    title TEXT,
    description TEXT,
    price_per_day NUMERIC,
    images TEXT[],
    user_id UUID,
    owner_profile_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 6. Trigger: Notify on Availability Update
CREATE OR REPLACE FUNCTION notify_wishlist_availability()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_marketplace_listing_availability_update ON public.marketplace_listings;
CREATE TRIGGER on_marketplace_listing_availability_update
AFTER UPDATE ON public.marketplace_listings
FOR EACH ROW
WHEN (NEW.availability_calendar IS DISTINCT FROM OLD.availability_calendar)
EXECUTE FUNCTION notify_wishlist_availability();

-- 7. Trigger: Notify on New Match
CREATE OR REPLACE FUNCTION notify_gear_alert_match()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_marketplace_listing_insert_alert ON public.marketplace_listings;
CREATE TRIGGER on_marketplace_listing_insert_alert
AFTER INSERT ON public.marketplace_listings
FOR EACH ROW
EXECUTE FUNCTION notify_gear_alert_match();

-- 8. Trigger: Remove from wishlist after booking
CREATE OR REPLACE FUNCTION remove_wishlist_on_booking()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM public.marketplace_wishlists
    WHERE listing_id = NEW.listing_id AND user_id = NEW.renter_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_marketplace_booking_insert_remove_wishlist ON public.marketplace_bookings;
CREATE TRIGGER on_marketplace_booking_insert_remove_wishlist
AFTER INSERT ON public.marketplace_bookings
FOR EACH ROW
EXECUTE FUNCTION remove_wishlist_on_booking();
