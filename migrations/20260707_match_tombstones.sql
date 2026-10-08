-- Tombstone table: stable IDs of matches the user has permanently deleted.
-- Any loader (embedded/precalculated/uploaded/live) filters these out on read
-- so deleted matches never come back, even after a full page reload or resync.

CREATE TABLE IF NOT EXISTS public.deleted_match_tombstones (
  stable_id  TEXT PRIMARY KEY,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deleted_match_tombstones_deleted_at_idx
  ON public.deleted_match_tombstones (deleted_at DESC);

-- Data API access. Anon read/insert kept since this app's other tables are
-- also anon-writable and reads must work before Supabase auth mounts.
GRANT SELECT, INSERT ON public.deleted_match_tombstones TO anon, authenticated;
GRANT ALL ON public.deleted_match_tombstones TO service_role;

ALTER TABLE public.deleted_match_tombstones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tombstones read" ON public.deleted_match_tombstones;
CREATE POLICY "tombstones read"
  ON public.deleted_match_tombstones FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "tombstones insert" ON public.deleted_match_tombstones;
CREATE POLICY "tombstones insert"
  ON public.deleted_match_tombstones FOR INSERT
  WITH CHECK (true);
