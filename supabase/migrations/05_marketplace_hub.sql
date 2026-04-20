-- marketplace_hub.sql

CREATE TABLE IF NOT EXISTS public.vendors (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    category text,
    location text,
    website text,
    email text,
    phone text,
    logo_url text,
    is_verified boolean DEFAULT false,
    rating numeric DEFAULT 0,
    review_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    price numeric,
    currency text DEFAULT 'USD',
    category text,
    images text[],
    status text DEFAULT 'available',
    specifications jsonb,
    created_at timestamp with time zone DEFAULT now(),
    creator_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view vendors" ON public.vendors FOR SELECT USING (true);
CREATE POLICY "Anyone can view listings" ON public.marketplace_listings FOR SELECT USING (status = 'available');
CREATE POLICY "Vendors can manage own profile" ON public.vendors FOR ALL USING (auth.uid() = user_id);
