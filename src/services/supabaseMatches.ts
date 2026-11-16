import { supabase } from '../lib/supabase';
import { Match } from '../types';
import { getStableMatchId } from '../utils/matchId';
import { getActualResult, matchesPrediction, getFavoriteAndUnderdog, calculatePAAPrediction } from '../utils/matchProcessing';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import LZString from 'lz-string';
import { filterTombstoned } from './matchTombstones';
import { safeSupabaseUpsert } from './supabaseHelper';


const CACHE_KEY = 'prm_supabase_matches_cache_v4';
const CACHE_TIME_KEY = 'prm_supabase_matches_cache_time_v4';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

let memoryPrecalculatedMatches: Match[] | null = null;

export const invalidateInMemoryCache = () => {
  memoryPrecalculatedMatches = null;
};

/**
 * Loads embedded matches from local JSON configuration.
 */
export const loadEmbeddedMatches = async (): Promise<Match[]> => {
  const matches: Match[] = [];
  try {
    const resp = await fetch('/embedded_matches.json?t=' + Date.now(), {
      cache: 'no-store'
    });
    if (resp.ok) {
      const embedded = await resp.json() as any[];
      const cleaned = embedded.map(row => {
        const m = row.data ? row.data : row;
        const stableId = getStableMatchId(m);
        return { ...m, id: stableId };
      });
      matches.push(...cleaned);
      console.log(`Loaded ${cleaned.length} embedded matches with stable IDs`);
    }
  } catch (err) {
    console.warn("Failed to load embedded matches:", err);
  }
  return filterTombstoned(matches);

};

/**
 * Saves processed matches to the Supabase precalculated_matches table, 
 * as well as specific group-based and pattern-based partitioned tables.
 * Uses high-performance bulk chunked upsert to easily support 18,000+ matches.
 */
export const savePrecalculatedMatches = async (matches: Match[]) => {
  if (matches.length === 0) return;
  
  // Deduplicate matches using deterministic IDs to prevent duplicates and Postgres conflicts
  const uniqueMatchesMap = new Map<string, Match>();
  matches.forEach(m => {
    const stableId = getStableMatchId(m);
    uniqueMatchesMap.set(stableId, { ...m, id: stableId });
  });
  const uniqueMatches = Array.from(uniqueMatchesMap.values());
  
  try {
    const CHUNK_SIZE = 250;
        // 1. Fetch the existing PHA cache from Supabase
    let phaStatsMap: Record<string, any> = {};
    let lastFullRecalc: Date | null = null;
    try {
      const { data: cacheRow, error: cacheErr } = await supabase
        .from('pha_cache')
        .select('*')
        .eq('id', 'singleton')
        .maybeSingle();
      if (!cacheErr && cacheRow) {
        phaStatsMap = cacheRow.stats_data || {};
        lastFullRecalc = cacheRow.last_full_recalc ? new Date(cacheRow.last_full_recalc) : null;
      }
    } catch (e) {
      console.warn("Failed to fetch pha_cache, using empty map", e);
    }

    const now = new Date();
    const isMonday = now.getDay() === 1; // 0=Sun, 1=Mon
    const daysSinceRecalc = lastFullRecalc ? (now.getTime() - lastFullRecalc.getTime()) / (1000 * 3600 * 24) : 999;
    
    let needsFullRecalc = false;
    if (isMonday && daysSinceRecalc >= 6) {
      needsFullRecalc = true;
    }
    if (!lastFullRecalc) {
      needsFullRecalc = true;
    }

    if (needsFullRecalc) {
      console.log("Triggering FULL recalculation of PHA stats (Weekly Monday job)...");
      // Fetch ALL historical matches to rebuild PHA from scratch
      let allHistorical: Match[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase.from('precalculated_matches').select('data').range(from, from + step - 1);
        if (error || !data || data.length === 0) {
          hasMore = false;
        } else {
          data.forEach((d: any) => allHistorical.push(d.data));
          from += step;
        }
      }
      
      // Merge with incoming matches
      const combinedMap = new Map<string, Match>();
      allHistorical.forEach(m => combinedMap.set(getStableMatchId(m), m));
      uniqueMatches.forEach(m => combinedMap.set(getStableMatchId(m), m));
      const combinedMatches = Array.from(combinedMap.values());
      
      // Rebuild the unified up-to-date phaStatsMap
      phaStatsMap = {};
      combinedMatches.forEach(m => {
        const sub = m.patternAnalysis?.subPattern;
        if (sub) {
          if (!phaStatsMap[sub]) {
            phaStatsMap[sub] = { total: 0, paaTotal: 0, correct: 0, outcomes: { '1': 0, 'X': 0, '2': 0 }, favWin: 0, draw: 0, upsetWin: 0 };
          }
          const actual = getActualResult(m.result);
          if (actual !== 'pending') {
            phaStatsMap[sub].total++;
            const pred = m.finalPrediction || m.rawPrediction || '1';
            if (matchesPrediction(pred, actual)) phaStatsMap[sub].correct++;
            if (actual === '1' || actual === 'X' || actual === '2') phaStatsMap[sub].outcomes[actual]++;
            
            const favInfo = getFavoriteAndUnderdog(m);
            if (favInfo) {
              const { fav: moFav, underdog: moUnderdog } = favInfo;
              phaStatsMap[sub].paaTotal++;
              if (actual === moFav) phaStatsMap[sub].favWin++;
              else if (actual === 'X') phaStatsMap[sub].draw++;
              else if (actual === moUnderdog) phaStatsMap[sub].upsetWin++;
            }
          }
        }
      });
      
      // Save rebuilt cache to Supabase
      try {
        await supabase.from('pha_cache').upsert({
          id: 'singleton',
          stats_data: phaStatsMap,
          last_full_recalc: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.error("Failed to save full PHA cache", e);
      }
    } else {
      console.log("Using INCREMENTAL updates for PHA stats...");
      // For incremental updates, we only care about matches that transitioned from 'pending' to 'finished'.
      const incomingIds = uniqueMatches.map(m => String(m.id));
      const existingStates = new Map<string, any>();
      try {
        // Fetch in chunks to avoid URL limits if too many IDs
        for (let i = 0; i < incomingIds.length; i += 200) {
          const chunkIds = incomingIds.slice(i, i + 200);
          const { data } = await supabase.from('precalculated_matches').select('id, result').in('id', chunkIds);
          if (data) {
            data.forEach((d: any) => existingStates.set(d.id, d.result));
          }
        }
      } catch (e) {
        console.warn("Failed to fetch existing states for incremental PHA update", e);
      }

      let cacheWasUpdated = false;
      uniqueMatches.forEach(m => {
        const sub = m.patternAnalysis?.subPattern;
        if (sub) {
          if (!phaStatsMap[sub]) {
            phaStatsMap[sub] = { total: 0, paaTotal: 0, correct: 0, outcomes: { '1': 0, 'X': 0, '2': 0 }, favWin: 0, draw: 0, upsetWin: 0 };
            cacheWasUpdated = true;
          }
          const actual = getActualResult(m.result);
          const oldResultRaw = existingStates.get(String(m.id)) || 'pending';
          const oldActual = getActualResult(oldResultRaw);
          
          // Only increment if it's newly finished
          if (actual !== 'pending' && oldActual === 'pending') {
            cacheWasUpdated = true;
            phaStatsMap[sub].total++;
            const pred = m.finalPrediction || m.rawPrediction || '1';
            if (matchesPrediction(pred, actual)) phaStatsMap[sub].correct++;
            if (actual === '1' || actual === 'X' || actual === '2') phaStatsMap[sub].outcomes[actual]++;
            
            const favInfo = getFavoriteAndUnderdog(m);
            if (favInfo) {
              const { fav: moFav, underdog: moUnderdog } = favInfo;
              phaStatsMap[sub].paaTotal++;
              if (actual === moFav) phaStatsMap[sub].favWin++;
              else if (actual === 'X') phaStatsMap[sub].draw++;
              else if (actual === moUnderdog) phaStatsMap[sub].upsetWin++;
            }
          }
        }
      });

      if (cacheWasUpdated) {
        try {
          await supabase.from('pha_cache').upsert({
            id: 'singleton',
            stats_data: phaStatsMap,
            updated_at: new Date().toISOString()
          });
        } catch (e) {
          console.error("Failed to save incremental PHA cache", e);
        }
      }
    }

    // 3. Precalculate PAA prediction & percentages for the incoming matches only
    const finalMatchesToUpsert: Match[] = [];
    uniqueMatches.forEach(m => {
      let updatedMatch = { ...m };
      const sub = updatedMatch.patternAnalysis?.subPattern;
      if (sub && phaStatsMap[sub]) {
        const stats = phaStatsMap[sub];
        const denom = stats.paaTotal > 0 ? stats.paaTotal : stats.total;
        if (denom > 0) {
          updatedMatch.paaWin = (stats.favWin / denom) * 100;
          updatedMatch.paaDraw = (stats.draw / denom) * 100;
          updatedMatch.paaUpset = (stats.upsetWin / denom) * 100;
        } else {
          updatedMatch.paaWin = 0; updatedMatch.paaDraw = 0; updatedMatch.paaUpset = 0;
        }
        if (!updatedMatch.paaPrediction) {
          const paaPred = calculatePAAPrediction(updatedMatch, stats);
          if (paaPred) {
            updatedMatch.paaPrimaryPrediction = paaPred.paaPrimaryPrediction;
            updatedMatch.paaPrediction = paaPred.paaPrediction;
          }
        }
      } else {
        updatedMatch.paaWin = 0; updatedMatch.paaDraw = 0; updatedMatch.paaUpset = 0;
      }
      finalMatchesToUpsert.push(updatedMatch);
    });

    let successCount = 0;

    // Save copy to backend disk storage for instant reliable recovery
    try {
      let storageUrl = `/api/storage/save`;
      if (typeof window === "undefined" || !window.location) {
        storageUrl = `http://localhost:3000/api/storage/save`;
      }
      await fetch(storageUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "precalculated_matches",
          data: finalMatchesToUpsert
        })
      });
    } catch (e) {}

    // Write ONLY to the main precalculated_matches table (removed 4 redundant group/pattern table writes to save ~80% egress)
    for (let i = 0; i < finalMatchesToUpsert.length; i += CHUNK_SIZE) {
      const chunk = finalMatchesToUpsert.slice(i, i + CHUNK_SIZE);
      const records = chunk.map(match => ({
        id: String(match.id),
        teams: match.teams,
        result: match.result || 'Unknown',
        date: match.date || '',
        data: {
          ...match,
          isPrecalculated: true,
          updatedAt: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      }));

      const res = await safeSupabaseUpsert('precalculated_matches', records, 'id');
      if (res.failedCount > 0) {
        console.warn(`[Supabase Backup] ${res.failedCount} records failed during upsert on precalculated_matches.`);
      }
      
      successCount += res.succeededCount;
    }
    
    console.log(`Successfully saved ${successCount} fully baked matches to precalculated_matches.`);

    // Update in-memory and IDB caches in-place instead of invalidating (avoids re-downloading on next load)
    try {
      // Merge into in-memory cache
      if (memoryPrecalculatedMatches) {
        const memMap = new Map<string, Match>();
        memoryPrecalculatedMatches.forEach(m => memMap.set(getStableMatchId(m), m));
        finalMatchesToUpsert.forEach(m => memMap.set(getStableMatchId(m), m));
        memoryPrecalculatedMatches = Array.from(memMap.values());
      } else {
        memoryPrecalculatedMatches = finalMatchesToUpsert;
      }

      // Update IDB cache with merged data
      await idbSet(CACHE_KEY, memoryPrecalculatedMatches);
      localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      console.log(`Updated in-memory and IDB cache with ${finalMatchesToUpsert.length} matches (no cache invalidation needed).`);
    } catch (cacheErr) {
      console.warn("Could not update precalculated matches caches:", cacheErr);
    }

  } catch (error: any) {
    console.error("Error saving precalculated matches to Supabase:", error);
    throw error;
  }
};

/**
 * Wipes all precalculated and segmented match tables.
 * Useful for a clean re-import when data becomes inconsistent.
 */
export const deletePrecalculatedMatchFromSupabase = async (id: string | number): Promise<boolean> => {
    try {
        const strId = String(id);
        const { error } = await supabase.from('precalculated_matches').delete().eq('id', strId);

        if (error) {
            console.error("Supabase delete failed:", error);
            return false;
        }

        // Remove from memory
        if (memoryPrecalculatedMatches) {
            memoryPrecalculatedMatches = memoryPrecalculatedMatches.filter(m => String(m.id) !== strId);
        }

        // Update IDB without expiring the cache time so we don't trigger a 18K row fetch
        try {
            const idbData = await idbGet(CACHE_KEY);
            if (idbData && Array.isArray(idbData)) {
                const filteredData = idbData.filter(m => String(m.id) !== strId);
                await idbSet(CACHE_KEY, filteredData);
            }
        } catch(e) {
            console.warn("Failed to update IDB cache after deletion:", e);
        }

        return true;
    } catch (error) {
        console.error("Error deleting precalculated match from Supabase:", error);
        return false;
    }
};

export const deletePrecalculatedMatchesFromSupabaseBulk = async (ids: (string | number)[]): Promise<boolean> => {
    if (!ids || ids.length === 0) return true;
    try {
        const stringIds = ids.map(id => String(id));
        
        for (let i = 0; i < stringIds.length; i += 100) {
            const chunk = stringIds.slice(i, i + 100);
            await supabase.from('precalculated_matches').delete().in('id', chunk);
        }

        const idsSet = new Set(stringIds);

        // Remove from memory
        if (memoryPrecalculatedMatches) {
            memoryPrecalculatedMatches = memoryPrecalculatedMatches.filter(m => !idsSet.has(String(m.id)));
        }

        // Update IDB without expiring the cache time so we don't trigger a 18K row fetch
        try {
            const idbData = await idbGet(CACHE_KEY);
            if (idbData && Array.isArray(idbData)) {
                const filteredData = idbData.filter(m => !idsSet.has(String(m.id)));
                await idbSet(CACHE_KEY, filteredData);
            }
        } catch(e) {
            console.warn("Failed to update IDB cache after bulk deletion:", e);
        }

        return true;
    } catch (error) {
        console.error("Error bulk deleting precalculated matches from Supabase:", error);
        return false;
    }
};

export const clearAllMatches = async () => {
  try {
    // Invalidate memory cache
    memoryPrecalculatedMatches = null;

    // We attempt to delete all records from all relevant tables
    const { error } = await supabase.from('precalculated_matches').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything
    if (error) {
      console.warn(`Failed to clear precalculated_matches:`, error.message);
    }
    
    // Clear local cache too
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIME_KEY);
    
    console.log("Successfully cleared all match tables and local cache.");
  } catch (err) {
    console.error("Error clearing matches:", err);
    throw err;
  }
};
/**
 * Loads all precalculated segments from either high-performance Local Storage cache
 * (fresh within 24 hours) or falls back to Supabase.
 */
export const loadPrecalculatedMatches = async (forceRefresh = false): Promise<Match[]> => {
  if (!forceRefresh && memoryPrecalculatedMatches && memoryPrecalculatedMatches.length > 0) {
    console.log(`Loaded ${memoryPrecalculatedMatches.length} matches from in-memory cache.`);
    return memoryPrecalculatedMatches;
  }

  const now = Date.now();
  const cachedTimeStr = localStorage.getItem(CACHE_TIME_KEY);
  
  if (!forceRefresh && cachedTimeStr) {
    const cachedTime = parseInt(cachedTimeStr, 10);
    if (now - cachedTime < CACHE_EXPIRY_MS) {
      try {
        const idbData = await idbGet(CACHE_KEY);
        if (idbData && Array.isArray(idbData)) {
          console.log(`Loaded ${idbData.length} matches from IDB Cache (fresh < 24h)`);
          memoryPrecalculatedMatches = idbData;
          return idbData;
        }
      } catch (e) {
        console.warn("Failed to parse cached precalculated matches from IDB, loading from server instead:", e);
      }
    }
  }

  const matches: Match[] = [];
  try {
    let from = 0;
    const step = 300;
    let hasMore = true;

    while (hasMore) {
      const pageQuery = supabase
        .from('precalculated_matches')
        .select('data')
        .order('date', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + step - 1);

      // Timeout individual page fetches to 6 seconds to prevent hanging if Supabase is slow
      let res: any = null;
      try {
        res = await Promise.race([
          pageQuery,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase page fetch timeout')), 6000))
        ]);
      } catch (timeoutErr) {
        console.warn(`Supabase precalculated matches page query timed out at offset ${from}:`, timeoutErr);
        break;
      }

      const { data, error } = res || {};

      if (error) {
        console.warn("Supabase query failed:", error);
        break;
      }

      if (data && data.length > 0) {
        data.forEach((row: any) => {
          if (row.data) {
            matches.push(row.data as Match);
          }
        });
        if (data.length < step) {
          hasMore = false;
        } else {
          from += step;
        }
      } else {
        hasMore = false;
      }
    }

    // Deduplicate matches to fix previous database duplication
    if (matches.length > 0) {
      const dedupedMap = new Map<string, Match>();
      for (const m of matches) {
        // Validate stats to filter out any corrupted "story" extracts
        const isValidStat = (val: string) => !val || val.length <= 15;
        if (!isValidStat(m.ga) || !isValidStat(m.gs) || !isValidStat(m.l10)) {
          console.warn(`Filtering out corrupted precalculated match: ${m.teams} with invalid GA/GS/L10.`);
          continue;
        }
        const stableId = getStableMatchId(m);
        const existing = dedupedMap.get(stableId);
        const mHasResult = m.result && m.result.toLowerCase() !== 'unknown' && m.result !== '-' && m.result !== 'pending' && m.result !== '?';

        if (existing) {
          const existingHasResult = existing.result && existing.result.toLowerCase() !== 'unknown' && existing.result !== '-' && existing.result !== 'pending' && existing.result !== '?';
          if (!existingHasResult && mHasResult) {
            dedupedMap.set(stableId, { ...m, id: stableId });
          }
        } else {
          dedupedMap.set(stableId, { ...m, id: stableId });
        }
      }
      matches.length = 0; // Clear the original array
      matches.push(...dedupedMap.values()); // Refill with deduplicated unique matches
    }

    if (matches.length > 0) {
      console.log(`Loaded ${matches.length} precalculated matches from Supabase Server (paginated).`);

      // Update the cache in IndexedDB to avoid browser quotas
      try {
        await idbSet(CACHE_KEY, matches);
        localStorage.setItem(CACHE_TIME_KEY, now.toString());
        console.log("Precalculated matches cached successfully in IndexedDB.");
      } catch (cacheErr) {
        console.warn("Failed to save matches into IndexedDB cache:", cacheErr);
      }
    }
  } catch (error) {
    console.error("Error loaded precalculated matches from Supabase:", error);
  }

  if (matches.length === 0) {
    try {
      let storageUrl = `/api/storage/load/precalculated_matches`;
      if (typeof window === "undefined" || !window.location) {
        storageUrl = `http://localhost:3000/api/storage/load/precalculated_matches`;
      }
      const res = await fetch(storageUrl);
      if (res.ok) {
        const diskMatches = await res.json() as Match[];
        if (Array.isArray(diskMatches) && diskMatches.length > 0) {
          matches.push(...diskMatches);
          console.log(`Loaded ${diskMatches.length} precalculated matches from backend persistent storage disk.`);
        }
      }
    } catch (e) {}
  }
  
  if (matches.length > 0) {
    memoryPrecalculatedMatches = matches;
  }
  return filterTombstoned(matches);
};

