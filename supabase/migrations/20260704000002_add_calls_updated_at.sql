-- Add updated_at column to calls table
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Set default values for existing rows
UPDATE public.calls SET updated_at = created_at WHERE updated_at IS NULL;

-- Make it NOT NULL with DEFAULT now()
ALTER TABLE public.calls ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.calls ALTER COLUMN updated_at SET NOT NULL;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
