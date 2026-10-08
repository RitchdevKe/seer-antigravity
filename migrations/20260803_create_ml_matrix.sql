-- Table to store real, live-updating ML Matrix Data
CREATE TABLE IF NOT EXISTS public.ml_matrix_data (
  matrix_type text not null, -- 'basePatterns', 'subPatterns', 'combos'
  item_key text not null,    -- e.g. 'Pat K', 'SIa', 'Pat K+SIa'
  total_matches int not null default 0,
  fav_wins int not null default 0,
  draws int not null default 0,
  und_wins int not null default 0,
  last_updated timestamptz not null default now(),
  PRIMARY KEY (matrix_type, item_key)
);

-- Indexes for fast querying on the frontend
CREATE INDEX IF NOT EXISTS idx_ml_matrix_type ON public.ml_matrix_data (matrix_type);

-- Permissions
GRANT SELECT, INSERT, UPDATE ON public.ml_matrix_data TO authenticated, anon;
GRANT ALL ON public.ml_matrix_data TO service_role;

-- Bookkeeping table to prevent double-counting when saving to the analysis board
CREATE TABLE IF NOT EXISTS public.ml_matrix_processed_matches (
  match_id text not null,
  processed_at timestamptz not null default now(),
  PRIMARY KEY (match_id)
);

GRANT SELECT, INSERT ON public.ml_matrix_processed_matches TO authenticated, anon;
GRANT ALL ON public.ml_matrix_processed_matches TO service_role;
