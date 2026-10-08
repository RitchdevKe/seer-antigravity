-- 1. Create ml_matrix_data table
CREATE TABLE IF NOT EXISTS public.ml_matrix_data (
    matrix_type text NOT NULL,
    item_key text NOT NULL,
    total_matches integer DEFAULT 0 NOT NULL,
    fav_wins integer DEFAULT 0 NOT NULL,
    draws integer DEFAULT 0 NOT NULL,
    und_wins integer DEFAULT 0 NOT NULL,
    last_updated timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (matrix_type, item_key)
);

-- Enable RLS
ALTER TABLE public.ml_matrix_data ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to all authenticated users on ml_matrix_data"
    ON public.ml_matrix_data
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow all access to authenticated users (or restrict based on your setup)
CREATE POLICY "Allow all access to authenticated users on ml_matrix_data"
    ON public.ml_matrix_data
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 2. Create ml_matrix_processed_matches table for deduplication
CREATE TABLE IF NOT EXISTS public.ml_matrix_processed_matches (
    match_id text NOT NULL PRIMARY KEY,
    processed_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.ml_matrix_processed_matches ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to all authenticated users on ml_matrix_processed_matches"
    ON public.ml_matrix_processed_matches
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow all access to authenticated users
CREATE POLICY "Allow all access to authenticated users on ml_matrix_processed_matches"
    ON public.ml_matrix_processed_matches
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
