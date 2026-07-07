-- Add hero_style column to prompts table
ALTER TABLE public.prompts
  ADD COLUMN IF NOT EXISTS hero_style text DEFAULT 'static'
    CHECK (hero_style IN ('static', 'carousel'));

COMMENT ON COLUMN public.prompts.hero_style IS 'Hero style layout option: static (single layout) or carousel (slider with prev/next controls)';
