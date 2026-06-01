-- 20260528000003_vendor_services.sql
-- Adds vendor_services table for Service Provider listings

CREATE TABLE IF NOT EXISTS public.vendor_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    day_rate NUMERIC NOT NULL,
    coverage_area TEXT NOT NULL,
    min_booking_days INTEGER DEFAULT 1,
    production_types TEXT[] NOT NULL DEFAULT '{}',
    crew_capacity INTEGER,
    service_checklist JSONB DEFAULT '[]'::jsonb,
    images TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.vendor_services ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Anyone can view active vendor services"
    ON public.vendor_services FOR SELECT
    USING (is_active = true);

-- Vendors can view their own services regardless of active status
CREATE POLICY "Vendors can view their own services"
    ON public.vendor_services FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_services.vendor_id
            AND v.owner_id = auth.uid()
        )
    );

CREATE POLICY "Vendors can insert their own services"
    ON public.vendor_services FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_id
            AND v.owner_id = auth.uid()
        )
    );

CREATE POLICY "Vendors can update their own services"
    ON public.vendor_services FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_services.vendor_id
            AND v.owner_id = auth.uid()
        )
    );

CREATE POLICY "Vendors can delete their own services"
    ON public.vendor_services FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.vendors v
            WHERE v.id = vendor_services.vendor_id
            AND v.owner_id = auth.uid()
        )
    );

-- Create Triggers
CREATE TRIGGER update_vendor_services_updated_at
    BEFORE UPDATE ON public.vendor_services
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for search/filtering
CREATE INDEX idx_vendor_services_vendor_id ON public.vendor_services(vendor_id);
CREATE INDEX idx_vendor_services_production_types ON public.vendor_services USING GIN(production_types);
