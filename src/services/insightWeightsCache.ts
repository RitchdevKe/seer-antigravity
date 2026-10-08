import { supabase } from '../lib/supabase';

// -----------------------------------------------------------------------------
// Insight weights cache
//
// Replaces the automatedInsightWeights useMemo in SeerAnalysis.tsx. Weights
// are aggregated incrementally: each processed match contributes a delta to
// the running totals for its (history_type, category, insight_key) tuple.
//
// On page load the component reads the cache in a single query instead of
// iterating every match × 24 conditions. It then folds in the tail delta of
// any matches that arrived after the cache's last_match_id.
// -----------------------------------------------------------------------------

export type HistoryType = 'daily' | 'jackpot' | 'live';

export interface InsightTotals {
  total: number;
  hits: number;
  misses: number;
  wins: number;
  [key: string]: number;
}

export interface InsightWeightRow {
  history_type: HistoryType;
  category: string;
  insight_key: string;
  totals: InsightTotals;
  last_match_id: string | null;
  schema_version: number;
  updated_at: string;
}

const emptyTotals = (): InsightTotals => ({
  total: 0,
  hits: 0,
  misses: 0,
  wins: 0,
});

/**
 * Load every cached insight weight for a given history type in one round trip.
 * Returns a nested map: category -> insight_key -> totals.
 */
export async function loadInsightWeightsCache(
  historyType: HistoryType,
): Promise<Record<string, Record<string, InsightTotals>>> {
  const { data, error } = await supabase
    .from('seer_insight_weights_cache')
    .select('category, insight_key, totals, last_match_id')
    .eq('history_type', historyType);

  if (error) {
    console.warn('[insightWeightsCache] load failed', error);
    return {};
  }

  const out: Record<string, Record<string, InsightTotals>> = {};
  for (const row of data ?? []) {
    const cat = row.category as string;
    const key = row.insight_key as string;
    out[cat] = out[cat] ?? {};
    out[cat][key] = { ...emptyTotals(), ...(row.totals as InsightTotals) };
  }
  return out;
}

/**
 * Get the set of match IDs already folded into a given cache. Used by the
 * ingest path to skip re-applying deltas for matches we've seen before.
 */
export async function getProcessedMatchIds(cacheName: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('match_processing_state')
    .select('match_id')
    .eq('cache_name', cacheName);

  if (error) {
    console.warn('[insightWeightsCache] getProcessedMatchIds failed', error);
    return new Set();
  }
  return new Set((data ?? []).map((r: any) => r.match_id));
}

/**
 * A single per-match contribution to an insight cell. Callers compute these
 * deltas locally (deterministic function of the match); the cache just sums.
 */
export interface InsightDelta {
  historyType: HistoryType;
  category: string;
  insightKey: string;
  contribution: Partial<InsightTotals>;
}

/**
 * Fold a batch of deltas into the cache. Reads current totals, adds the
 * contributions, and writes back in a single upsert per (history, cat, key).
 * Also records the match IDs in match_processing_state so we don't double-count.
 */
export async function applyInsightDeltas(
  matchId: string,
  deltas: InsightDelta[],
): Promise<void> {
  if (deltas.length === 0) return;

  // Group deltas by (history, category, key) so each cell gets one write.
  const byCell = new Map<string, InsightDelta>();
  for (const d of deltas) {
    const cellKey = `${d.historyType}|${d.category}|${d.insightKey}`;
    const existing = byCell.get(cellKey);
    if (existing) {
      for (const [k, v] of Object.entries(d.contribution)) {
        (existing.contribution as any)[k] = ((existing.contribution as any)[k] ?? 0) + (v ?? 0);
      }
    } else {
      byCell.set(cellKey, { ...d, contribution: { ...d.contribution } });
    }
  }

  const cells = Array.from(byCell.values());

  // Read existing rows for those cells so we can add to their totals.
  const { data: existing, error: readErr } = await supabase
    .from('seer_insight_weights_cache')
    .select('history_type, category, insight_key, totals')
    .in('history_type', Array.from(new Set(cells.map(c => c.historyType))))
    .in('category', Array.from(new Set(cells.map(c => c.category))))
    .in('insight_key', Array.from(new Set(cells.map(c => c.insightKey))));

  if (readErr) {
    console.warn('[insightWeightsCache] read-before-upsert failed', readErr);
    return;
  }

  const existingMap = new Map<string, InsightTotals>();
  for (const row of existing ?? []) {
    existingMap.set(
      `${row.history_type}|${row.category}|${row.insight_key}`,
      { ...emptyTotals(), ...(row.totals as InsightTotals) },
    );
  }

  const upsertRows = cells.map(cell => {
    const cellKey = `${cell.historyType}|${cell.category}|${cell.insightKey}`;
    const current = existingMap.get(cellKey) ?? emptyTotals();
    const merged: InsightTotals = { ...current };
    for (const [k, v] of Object.entries(cell.contribution)) {
      merged[k] = (merged[k] ?? 0) + (v ?? 0);
    }
    return {
      history_type: cell.historyType,
      category: cell.category,
      insight_key: cell.insightKey,
      totals: merged,
      last_match_id: matchId,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: upsertErr } = await supabase
    .from('seer_insight_weights_cache')
    .upsert(upsertRows, { onConflict: 'history_type,category,insight_key' });

  if (upsertErr) {
    console.warn('[insightWeightsCache] upsert failed', upsertErr);
    return;
  }

  // Mark this match as folded in for each history type touched.
  const histories = Array.from(new Set(cells.map(c => c.historyType)));
  const stateRows = histories.map(h => ({
    cache_name: `insight_weights_${h}`,
    match_id: matchId,
  }));
  const { error: stateErr } = await supabase
    .from('match_processing_state')
    .upsert(stateRows, { onConflict: 'cache_name,match_id' });
  if (stateErr) {
    console.warn('[insightWeightsCache] state upsert failed', stateErr);
  }
}

/**
 * Convenience: fold many matches in one round trip. Each entry pairs a match
 * ID with the deltas it produced. Used by the ingest path (upload / scrape).
 */
export async function applyInsightDeltasBatch(
  entries: Array<{ matchId: string; deltas: InsightDelta[] }>,
): Promise<void> {
  // Simple sequential loop; each call does its own batched upsert. This runs
  // at ingest time only, so throughput matters less than correctness.
  for (const entry of entries) {
    await applyInsightDeltas(entry.matchId, entry.deltas);
  }
}
