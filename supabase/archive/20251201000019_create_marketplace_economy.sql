-- Create enums for marketplace (with IF NOT EXISTS check)
DO $$ BEGIN
  CREATE TYPE listing_type AS ENUM ('equipment', 'location');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create marketplace_listings table
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_type listing_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price_per_day NUMERIC(10, 2) NOT NULL,
  price_per_week NUMERIC(10, 2),
  location TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  specifications JSONB DEFAULT '{}',
  availability_calendar JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create marketplace_bookings table
CREATE TABLE IF NOT EXISTS marketplace_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  status booking_status DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT[] NOT NULL,
  services_offered TEXT[] DEFAULT '{}',
  location TEXT NOT NULL,
  address TEXT,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT,
  logo_url TEXT,
  images TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT false,
  verification_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create marketplace_reviews table
CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT review_target CHECK (
    (listing_id IS NOT NULL AND vendor_id IS NULL) OR
    (listing_id IS NULL AND vendor_id IS NOT NULL)
  )
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_user_id ON marketplace_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_type ON marketplace_listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_category ON marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_location ON marketplace_listings(location);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_active ON marketplace_listings(is_active);

CREATE INDEX IF NOT EXISTS idx_marketplace_bookings_listing_id ON marketplace_bookings(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_bookings_renter_id ON marketplace_bookings(renter_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_bookings_owner_id ON marketplace_bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_bookings_status ON marketplace_bookings(status);

CREATE INDEX IF NOT EXISTS idx_vendors_owner_id ON vendors(owner_id);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors USING GIN(category);
CREATE INDEX IF NOT EXISTS idx_vendors_location ON vendors(location);
CREATE INDEX IF NOT EXISTS idx_vendors_verified ON vendors(is_verified);

CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_listing_id ON marketplace_reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_vendor_id ON marketplace_reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_reviews_reviewer_id ON marketplace_reviews(reviewer_id);

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('marketplace-images', 'marketplace-images', true),
  ('vendor-images', 'vendor-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for marketplace-images bucket
DO $$ BEGIN
  CREATE POLICY "Anyone can view marketplace images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'marketplace-images');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload marketplace images"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'marketplace-images' AND
      auth.role() = 'authenticated'
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own marketplace images"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'marketplace-images' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own marketplace images"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'marketplace-images' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Storage policies for vendor-images bucket
DO $$ BEGIN
  CREATE POLICY "Anyone can view vendor images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'vendor-images');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload vendor images"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'vendor-images' AND
      auth.role() = 'authenticated'
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own vendor images"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'vendor-images' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own vendor images"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'vendor-images' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Enable RLS on all tables
ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketplace_listings
DO $$ BEGIN
  CREATE POLICY "Anyone can view active listings"
    ON marketplace_listings FOR SELECT
    USING (is_active = true OR user_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create their own listings"
    ON marketplace_listings FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own listings"
    ON marketplace_listings FOR UPDATE
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own listings"
    ON marketplace_listings FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for marketplace_bookings
DO $$ BEGIN
  CREATE POLICY "Users can view their own bookings"
    ON marketplace_bookings FOR SELECT
    USING (auth.uid() = renter_id OR auth.uid() = owner_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create bookings"
    ON marketplace_bookings FOR INSERT
    WITH CHECK (auth.uid() = renter_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Owners and renters can update bookings"
    ON marketplace_bookings FOR UPDATE
    USING (auth.uid() = renter_id OR auth.uid() = owner_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for vendors
DO $$ BEGIN
  CREATE POLICY "Anyone can view verified vendors"
    ON vendors FOR SELECT
    USING (is_verified = true OR owner_id = auth.uid());
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create vendor profiles"
    ON vendors FOR INSERT
    WITH CHECK (auth.uid() = owner_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can update their vendor profiles"
    ON vendors FOR UPDATE
    USING (auth.uid() = owner_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete their vendor profiles"
    ON vendors FOR DELETE
    USING (auth.uid() = owner_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- RLS Policies for marketplace_reviews
DO $$ BEGIN
  CREATE POLICY "Anyone can view reviews"
    ON marketplace_reviews FOR SELECT
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can create reviews"
    ON marketplace_reviews FOR INSERT
    WITH CHECK (auth.uid() = reviewer_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own reviews"
    ON marketplace_reviews FOR UPDATE
    USING (auth.uid() = reviewer_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own reviews"
    ON marketplace_reviews FOR DELETE
    USING (auth.uid() = reviewer_id);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_marketplace_listings_updated_at ON marketplace_listings;
CREATE TRIGGER update_marketplace_listings_updated_at
  BEFORE UPDATE ON marketplace_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_marketplace_bookings_updated_at ON marketplace_bookings;
CREATE TRIGGER update_marketplace_bookings_updated_at
  BEFORE UPDATE ON marketplace_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendors_updated_at ON vendors;
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to get listing with average rating
CREATE OR REPLACE FUNCTION get_listing_with_rating(listing_uuid UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  listing_type listing_type,
  title TEXT,
  description TEXT,
  category TEXT,
  price_per_day NUMERIC,
  price_per_week NUMERIC,
  location TEXT,
  images TEXT[],
  specifications JSONB,
  availability_calendar JSONB,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  average_rating NUMERIC,
  review_count BIGINT
) AS $$
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
$$ LANGUAGE plpgsql;

-- Create function to get vendor with average rating
CREATE OR REPLACE FUNCTION get_vendor_with_rating(vendor_uuid UUID)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  business_name TEXT,
  description TEXT,
  category TEXT[],
  services_offered TEXT[],
  location TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  images TEXT[],
  is_verified BOOLEAN,
  verification_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  average_rating NUMERIC,
  review_count BIGINT
) AS $$
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
$$ LANGUAGE plpgsql;

-- Create function to search marketplace listings
CREATE OR REPLACE FUNCTION search_marketplace_listings(
  search_query TEXT DEFAULT NULL,
  filter_type listing_type DEFAULT NULL,
  filter_category TEXT DEFAULT NULL,
  filter_location TEXT DEFAULT NULL,
  min_price NUMERIC DEFAULT NULL,
  max_price NUMERIC DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  listing_type listing_type,
  title TEXT,
  description TEXT,
  category TEXT,
  price_per_day NUMERIC,
  price_per_week NUMERIC,
  location TEXT,
  images TEXT[],
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  average_rating NUMERIC,
  review_count BIGINT
) AS $$
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
$$ LANGUAGE plpgsql;

-- Create function to search vendors
CREATE OR REPLACE FUNCTION search_vendors(
  search_query TEXT DEFAULT NULL,
  filter_category TEXT DEFAULT NULL,
  filter_location TEXT DEFAULT NULL,
  verified_only BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  business_name TEXT,
  description TEXT,
  category TEXT[],
  services_offered TEXT[],
  location TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  images TEXT[],
  is_verified BOOLEAN,
  created_at TIMESTAMPTZ,
  average_rating NUMERIC,
  review_count BIGINT
) AS $$
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
$$ LANGUAGE plpgsql;
