-- Supreme custom weights: authoritative store for user-approved insights
-- that adjust the "Optimized Supreme Weights". Without this table the client
-- upserts silently fail and every reload wipes the +/-5 adjustments.

CREATE TABLE IF NOT EXISTS public.supreme_custom_weights (
  category         TEXT NOT NULL,
  feature_name     TEXT NOT NULL,
  goal_accuracy    NUMERIC NOT NULL DEFAULT 10,
  overall_accuracy NUMERIC NOT NULL DEFAULT 50,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (category, feature_name)
);

CREATE INDEX IF NOT EXISTS supreme_custom_weights_updated_at_idx
  ON public.supreme_custom_weights (updated_at DESC);

-- Grants (Data API is not open by default on public schema).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supreme_custom_weights TO anon, authenticated;
GRANT ALL ON public.supreme_custom_weights TO service_role;

ALTER TABLE public.supreme_custom_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supreme_custom_weights read" ON public.supreme_custom_weights;
CREATE POLICY "supreme_custom_weights read"
  ON public.supreme_custom_weights FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "supreme_custom_weights insert" ON public.supreme_custom_weights;
CREATE POLICY "supreme_custom_weights insert"
  ON public.supreme_custom_weights FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "supreme_custom_weights update" ON public.supreme_custom_weights;
CREATE POLICY "supreme_custom_weights update"
  ON public.supreme_custom_weights FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "supreme_custom_weights delete" ON public.supreme_custom_weights;
CREATE POLICY "supreme_custom_weights delete"
  ON public.supreme_custom_weights FOR DELETE
  USING (true);
