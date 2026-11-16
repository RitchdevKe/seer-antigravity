import { supabase } from '../lib/supabase';
import { Match } from '../types';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { getStableMatchId } from '../utils/matchId';
import { filterTombstoned } from './matchTombstones';
import { safeSupabaseUpsert } from './supabaseHelper';
import { updateMLMatrixFromMatches } from './mlMatrixUpdater';


/**
 * Saves live analysis matches to the Supabase live_matches table.
 * Uses robust upsert + safe stale deletion (garbage collection) to ensure that
 * no stale/duplicated matches remain in the database.
 */

const LIVE_CACHE_KEY = 'seer_live_matches_idb_cache_v5';
const LIVE_CACHE_TIME_KEY = 'seer_live_matches_idb_cache_time';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
let memoryLiveMatches: Match[] | null = null;

export const saveLiveMatchesToSupabase = async (matches: Match[]): Promise<boolean> => {
  try {
    if (!matches || matches.length === 0) {
      // Clear all items if empty array is passed
      const { error } = await supabase.from('live_matches').delete().neq('id', 'placeholder_never_match');
      if (error) {
        console.error("Failed to clear live_matches table", error);
        return false;
      }
      // CRITICAL FIX: Also clear the client-side cache so the deleted matches do not resurrect on reload
      try {
        await idbSet(LIVE_CACHE_KEY, []);
        localStorage.setItem(LIVE_CACHE_TIME_KEY, Date.now().toString());
        memoryLiveMatches = [];
      } catch (e) {
        console.warn("Failed to clear LIVE_CACHE_KEY in IDB:", e);
      }
      return true;
    }

    const CHUNK_SIZE = 100;
    
    // De-duplicate matches by stable ID to avoid upsert primary key conflicts, and strip any cached OPW scores
    const uniqueMatchesMap = new Map<string, Match>();
    matches.forEach(m => {
      if (m && m.id) {
        const cleaned = { ...m };
        delete cleaned.lockedOpwScores;
        delete cleaned.lockedOpwScore;
        uniqueMatchesMap.set(String(m.id), cleaned);
      }
    });
    const uniqueMatches = Array.from(uniqueMatchesMap.values());

    // 1. Bulk upsert matches in chunks
    let totalSucceeded = 0;
    let totalFailed = 0;
    for (let i = 0; i < uniqueMatches.length; i += CHUNK_SIZE) {
      const chunk = uniqueMatches.slice(i, i + CHUNK_SIZE);
      const records = chunk.map(match => ({
        id: String(match.id),
        teams: match.teams || 'Unknown',
        result: match.result || '-', // Store as dash if unknown/empty
        date: match.date || '',
        league: match.league || (match as any).data?.league || null,
        country: match.country || (match as any).data?.country || null,
        data: {
          ...match,
          league: match.league || (match as any).data?.league || null,
          country: match.country || (match as any).data?.country || null,
          result: match.result || '-' // Enforce result format in JSON representation as well
        },
        updated_at: new Date().toISOString()
      }));

      const res = await safeSupabaseUpsert('live_matches', records, 'id');
      totalSucceeded += res.succeededCount;
      totalFailed += res.failedCount;
    }

    // 2. Perform garbage collection
    try {
      const { data: existingRows, error: fetchErr } = await supabase
        .from('live_matches')
        .select('id');
      
      if (fetchErr) {
        console.warn('Failed to fetch existing live match IDs for stale cleanup:', fetchErr);
      } else if (existingRows) {
        const existingIds = existingRows.map(row => String(row.id));
        const keeperIdsSet = new Set(uniqueMatches.map(m => String(m.id)));
        const idsToDelete = existingIds.filter(id => !keeperIdsSet.has(id));
        
        if (idsToDelete.length > 0) {
          console.log(`Deleting ${idsToDelete.length} stale live matches from Supabase...`);
          for (let i = 0; i < idsToDelete.length; i += 100) {
            const chunk = idsToDelete.slice(i, i + 100);
            await supabase.from('live_matches').delete().in('id', chunk);
          }
        }
      }
    } catch (gcErr) {
      console.warn('Garbage collection of stale live matches failed:', gcErr);
    }

    // 2. Perform garbage collection
    try {
      if (true) {
        const { data: existingRows, error: fetchErr } = await supabase
          .from('live_matches')
          .select('id');
        
        if (fetchErr) {
          console.warn("Failed to fetch existing live match IDs for stale cleanup:", fetchErr);
        } else if (existingRows) {
          const existingIds = existingRows.map(row => String(row.id));
          const keeperIdsSet = new Set(uniqueMatches.map(m => String(m.id)));
          const idsToDelete = existingIds.filter(id => !keeperIdsSet.has(id));
          
          if (idsToDelete.length > 0) {
            console.log(`De-syncing / deleting ${idsToDelete.length} stale live matches from Supabase...`);
            for (let i = 0; i < idsToDelete.length; i += 100) {
              const chunk = idsToDelete.slice(i, i + 100);
              const { error: delErr } = await supabase
                .from('live_matches')
                .delete()
                .in('id', chunk);
              if (delErr) {
                console.warn("Chunk deletion failed for stale live matches:", delErr);
              }
            }
          }
        }
      }
    } catch (gcErr) {
      console.warn("Garbage collection of stale live matches failed:", gcErr);
    }

    console.log(`Successfully backed up and cleaned ${uniqueMatches.length} live matches in Supabase live_matches table.`);
    
    // CRITICAL FIX: Update the client-side cache so any garbage-collected/deleted matches do not resurrect on reload
    try {
      await idbSet(LIVE_CACHE_KEY, uniqueMatches);
      localStorage.setItem(LIVE_CACHE_TIME_KEY, Date.now().toString());
      memoryLiveMatches = uniqueMatches;
    } catch (e) {
      console.warn("Failed to update LIVE_CACHE_KEY in IDB after save:", e);
    }
    
    // UPDATE ML MATRIX WITH ANY NEW COMPLETED MATCHES
    updateMLMatrixFromMatches(uniqueMatches).catch(err => {
        console.error("Failed to update ML Matrix from live matches:", err);
    });

    return true;
  } catch (error) {
    console.error("Error backing up live matches to Supabase table:", error);
    return false;
  }
};

export const deleteLiveMatchFromSupabase = async (id: string | number): Promise<boolean> => {
    try {
        const strId = String(id);
        const { error } = await supabase.from('live_matches').delete().eq('id', strId);
        if (error) {
            console.error("Failed to delete match from live_matches:", error);
            return false;
        }
        if (memoryLiveMatches) {
            memoryLiveMatches = memoryLiveMatches.filter(m => String(m.id) !== strId);
        }
        try {
            const idbData = await idbGet(LIVE_CACHE_KEY);
            if (idbData && Array.isArray(idbData)) {
                const filteredData = idbData.filter(m => String(m.id) !== strId);
                await idbSet(LIVE_CACHE_KEY, filteredData);
            }
        } catch(e) {}
        return true;
    } catch (error) {
        console.error("Error deleting match:", error);
        return false;
    }
};

export const deleteLiveMatchesFromSupabaseBulk = async (ids: (string | number)[]): Promise<boolean> => {
    if (!ids || ids.length === 0) return true;
    try {
        const stringIds = new Set(ids.map(id => String(id)));
        const stringIdsArr = Array.from(stringIds);
        for (let i = 0; i < stringIdsArr.length; i += 100) {
            const chunk = stringIdsArr.slice(i, i + 100);
            const { error } = await supabase.from('live_matches').delete().in('id', chunk);
            if (error) {
                console.error("Failed to bulk delete matches from live_matches:", error);
            }
        }
        if (memoryLiveMatches) {
            memoryLiveMatches = memoryLiveMatches.filter(m => !stringIds.has(String(m.id)));
        }
        try {
            const idbData = await idbGet(LIVE_CACHE_KEY);
            if (idbData && Array.isArray(idbData)) {
                const filteredData = idbData.filter(m => !stringIds.has(String(m.id)));
                await idbSet(LIVE_CACHE_KEY, filteredData);
            }
        } catch(e) {}
        return true;
    } catch (error) {
        console.error("Error bulk deleting matches:", error);
        return false;
    }
};

/**
 * Loads all live matches from the Supabase live_matches table.
 */
export const loadLiveMatchesFromSupabase = async (forceRefresh = false): Promise<Match[]> => {
  if (!forceRefresh && memoryLiveMatches && memoryLiveMatches.length > 0) {
    return filterTombstoned(memoryLiveMatches);
  }
  const now = Date.now();
  const cachedTimeStr = localStorage.getItem(LIVE_CACHE_TIME_KEY);
  if (!forceRefresh && cachedTimeStr) {
    const cachedTime = parseInt(cachedTimeStr, 10);
    if (now - cachedTime < CACHE_EXPIRY_MS) {
      try {
        const idbData = await idbGet(LIVE_CACHE_KEY);
        if (idbData && Array.isArray(idbData)) {
          idbData.forEach((m: any) => {
            if (m && typeof m === 'object') {
              delete m.lockedOpwScores;
              delete m.lockedOpwScore;
            }
          });
          memoryLiveMatches = idbData;
          return filterTombstoned(idbData);
        }
      } catch (e) {}
    }
  }
  const matches: Match[] = [];
  try {
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('live_matches')
        .select('*')
        .order('date', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + step - 1);

      if (error) {
        console.warn("Supabase live_matches query failed:", error);
        break;
      }

      if (data && data.length > 0) {
        data.forEach(row => {
          if (row.data) {
            const m = row.data as Match;
            delete m.lockedOpwScores;
            delete m.lockedOpwScore;
            if (row.country && !m.country) m.country = row.country;
            if (row.league && !m.league) m.league = row.league;
            matches.push(m);
          } else if (row.teams) {
            const m = row as unknown as Match;
            delete m.lockedOpwScores;
            delete m.lockedOpwScore;
            matches.push(m);
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

    if (matches.length > 0) {
      const dedupedMap = new Map<string, Match>();
      for (const m of matches) {
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
      matches.length = 0;
      matches.push(...dedupedMap.values());
    }

    console.log(`Loaded ${matches.length} live matches from Supabase live_matches.`);
    try {
      await idbSet(LIVE_CACHE_KEY, matches);
      localStorage.setItem(LIVE_CACHE_TIME_KEY, now.toString());
    } catch(e) {}
    memoryLiveMatches = matches;
  } catch (error) {
    console.error("Error loading live matches from Supabase table:", error);
  }
  return filterTombstoned(matches);
};

/**
 * Deletes all live matches from public.live_matches.
 */
export const clearLiveMatchesFromSupabase = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('live_matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything safely

    if (error) {
      console.error("Failed to delete live_matches table content:", error);
      return false;
    }

    console.log("Cleared database table live_matches.");
    localStorage.removeItem(LIVE_CACHE_KEY);
    localStorage.removeItem(LIVE_CACHE_TIME_KEY);
    memoryLiveMatches = null;
    return true;
  } catch (error) {
    console.error("Error clearing live_matches table:", error);
    return false;
  }
};
