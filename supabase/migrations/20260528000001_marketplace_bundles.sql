-- 20260528000001_marketplace_bundles.sql
-- Adds Bundle Listings capability to the Marketplace

-- 1. Add is_bundle flag to listings
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN DEFAULT false;

-- 2. Create bundle items mapping table
CREATE TABLE IF NOT EXISTS public.marketplace_bundle_items (
    bundle_id UUID REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
    PRIMARY KEY (bundle_id, item_id)
);

-- Enable RLS for the bundle items
ALTER TABLE public.marketplace_bundle_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view bundle items" ON public.marketplace_bundle_items;
CREATE POLICY "Anyone can view bundle items" 
ON public.marketplace_bundle_items FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can insert bundle items for their own listings" ON public.marketplace_bundle_items;
CREATE POLICY "Users can insert bundle items for their own listings" 
ON public.marketplace_bundle_items FOR INSERT 
WITH CHECK (
    auth.uid() = (SELECT user_id FROM public.marketplace_listings WHERE id = bundle_id)
);

DROP POLICY IF EXISTS "Users can delete bundle items for their own listings" ON public.marketplace_bundle_items;
CREATE POLICY "Users can delete bundle items for their own listings" 
ON public.marketplace_bundle_items FOR DELETE 
USING (
    auth.uid() = (SELECT user_id FROM public.marketplace_listings WHERE id = bundle_id)
);

-- 3. Trigger for Bundle Booking Child Logic
-- When a bundle is booked, automatically book all child items for the same dates to prevent double-booking.
CREATE OR REPLACE FUNCTION block_bundle_children_on_booking()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_bundle_children ON public.marketplace_bookings;
CREATE TRIGGER trg_block_bundle_children
AFTER INSERT ON public.marketplace_bookings
FOR EACH ROW
EXECUTE FUNCTION block_bundle_children_on_booking();
