-- 20260528000002_equipment_condition.sql
-- Adds condition grading and review system

-- 1. Create equipment_condition ENUM
DO $$ BEGIN
  CREATE TYPE equipment_condition AS ENUM ('Mint', 'Excellent', 'Good', 'Fair');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Modify marketplace_listings
ALTER TABLE public.marketplace_listings 
ADD COLUMN IF NOT EXISTS condition_grade equipment_condition,
ADD COLUMN IF NOT EXISTS condition_score NUMERIC(3, 2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS admin_flagged BOOLEAN DEFAULT false;

-- 3. Modify marketplace_reviews
ALTER TABLE public.marketplace_reviews 
ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.marketplace_bookings(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS condition_rating INTEGER CHECK (condition_rating >= 1 AND condition_rating <= 5);

-- 4. Trigger to update condition_score on listing
CREATE OR REPLACE FUNCTION update_listing_condition_score()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_condition_score ON public.marketplace_reviews;
CREATE TRIGGER trg_update_condition_score
AFTER INSERT OR UPDATE OR DELETE ON public.marketplace_reviews
FOR EACH ROW
EXECUTE FUNCTION update_listing_condition_score();

-- 5. Trigger to flag listing if 3 poor condition reviews exist
CREATE OR REPLACE FUNCTION flag_listing_on_poor_condition()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_flag_poor_condition ON public.marketplace_reviews;
CREATE TRIGGER trg_flag_poor_condition
AFTER INSERT ON public.marketplace_reviews
FOR EACH ROW
EXECUTE FUNCTION flag_listing_on_poor_condition();
