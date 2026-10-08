-- Fix: match tombstones must accept upserts, which require UPDATE grants.
-- The initial migration only granted SELECT + INSERT, so every re-tombstone
-- (or upsert onConflict=stable_id) failed silently and the row was never
-- persisted -> "deleted" matches came back on reload.

GRANT UPDATE ON public.deleted_match_tombstones TO anon, authenticated;

DROP POLICY IF EXISTS "tombstones update" ON public.deleted_match_tombstones;
CREATE POLICY "tombstones update"
  ON public.deleted_match_tombstones FOR UPDATE
  USING (true)
  WITH CHECK (true);
