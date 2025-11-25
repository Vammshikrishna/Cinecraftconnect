-- Migration: Create the 'portfolios' storage bucket
-- This inserts the bucket definition into the storage.buckets table

INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolios', 'portfolios', true)
ON CONFLICT (id) DO NOTHING;
