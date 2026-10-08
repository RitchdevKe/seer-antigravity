-- Precomputation cache for SEER.AI
-- Purpose: stop recomputing 10k+ matches on every page load.
-- Run this once in the Supabase SQL editor.

-- 1. Per-history-type cached insight weights.
--    Replaces the automatedInsightWeights useMemo in SeerAnalysis.tsx.
--    Aggregates are updated incrementally when new matches arrive.
create table if not exists public.seer_insight_weights_cache (
  history_type text not null,          -- 'daily' | 'jackpot' | 'live'
  category     text not null,          -- e.g. 'over_1_5', 'both_teams_to_score'
  insight_key  text not null,          -- one of the 24 insight condition keys
  totals       jsonb not null default '{}'::jsonb,
                                       -- { total, wins, hits, misses, ... }
  last_match_id text,                  -- last match folded into totals
  schema_version int not null default 1,
  updated_at   timestamptz not null default now(),
  primary key (history_type, category, insight_key)
);

grant select, insert, update on public.seer_insight_weights_cache to authenticated, anon;
grant all on public.seer_insight_weights_cache to service_role;

-- 2. Bookkeeping: which match IDs have been folded into which caches.
--    Lets the client compute the delta of "matches to still process".
create table if not exists public.match_processing_state (
  cache_name   text not null,          -- e.g. 'insight_weights_daily'
  match_id     text not null,
  processed_at timestamptz not null default now(),
  primary key (cache_name, match_id)
);

grant select, insert on public.match_processing_state to authenticated, anon;
grant all on public.match_processing_state to service_role;

-- 3. Indexes to speed up sync and dashboard queries.
create index if not exists idx_precalc_matches_date on public.precalculated_matches (date desc);
create index if not exists idx_precalc_matches_updated on public.precalculated_matches (updated_at desc);
create index if not exists idx_pattern_matches_group_sub on public.pattern_matches (group_id, sub_pattern);
create index if not exists idx_pattern_matches_date on public.pattern_matches (date desc);
create index if not exists idx_seer_slips_date on public.seer_locked_slips (date, category);
create index if not exists idx_match_processing_state_cache on public.match_processing_state (cache_name);
