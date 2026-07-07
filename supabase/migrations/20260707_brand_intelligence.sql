-- Brand Intelligence Extraction: Add brand fields to leads table
-- Run this in Supabase SQL Editor before deploying

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS brand_colors jsonb,
  ADD COLUMN IF NOT EXISTS brand_logo_url text,
  ADD COLUMN IF NOT EXISTS brand_fonts jsonb,
  ADD COLUMN IF NOT EXISTS brand_tone_summary text,
  ADD COLUMN IF NOT EXISTS brand_source text DEFAULT 'none'
    CHECK (brand_source IN ('website', 'places_photos', 'none'));

-- Add comment for documentation
COMMENT ON COLUMN public.leads.brand_colors IS 'Top 3 brand colors extracted from website or Places photos, e.g. ["#1a3c6e", "#f4a300"]';
COMMENT ON COLUMN public.leads.brand_logo_url IS 'URL to brand logo (from apple-touch-icon, favicon, or img with logo class)';
COMMENT ON COLUMN public.leads.brand_fonts IS 'Up to 2 font names from Google Fonts link or font-family declarations';
COMMENT ON COLUMN public.leads.brand_tone_summary IS 'AI-generated one-sentence brand voice summary';
COMMENT ON COLUMN public.leads.brand_source IS 'Source of brand data: website (from crawl), places_photos (from Google Places), or none';
