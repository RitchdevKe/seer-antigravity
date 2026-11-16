import { supabase } from '../lib/supabase';
import { Match } from '../types';
import { getStableMatchId } from '../utils/matchId';
import { filterTombstoned } from './matchTombstones';
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { safeSupabaseUpsert } from './supabaseHelper';


/**
 * Saves processed/uploaded matches to the Supabase user_uploaded_matches table.
 * Uses rapid chunked bulk upsert (chunks of 250 matches) to easily handle thousands of records.
 */

const UPLOADED_CACHE_KEY = 'seer_uploaded_matches_idb_cache_v5';
const UPLOADED_CACHE_TIME_KEY = 'seer_uploaded_matches_idb_cache_time_v5';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
let memoryUploadedMatches: Match[] | null = null;

export const saveUploadedMatchesToSupabase = async (matches: Match[]): Promise<boolean> => {
  try {
    if (!matches || matches.length === 0) {
      // Clear all items if empty array is passed
      const { error } = await supabase.from('user_uploaded_matches').delete().neq('id', 'placeholder_never_match');
      if (error) {
        console.error("Failed to clear user_uploaded_matches table", error);
        return false;
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

    let totalSucceeded = 0;
    let totalFailed = 0;
    for (let i = 0; i < uniqueMatches.length; i += CHUNK_SIZE) {
      const chunk = uniqueMatches.slice(i, i + CHUNK_SIZE);
      const records = chunk.map(match => ({
        id: String(match.id),
        teams: match.teams || 'Unknown',
        result: match.result || '-',
        date: match.date || '',
        data: {
          ...match,
          result: match.result || '-'
        }, // Keep the full precalculated object with zero stripping/minification!
        updated_at: new Date().toISOString()
      }));

      const res = await safeSupabaseUpsert('user_uploaded_matches', records, 'id');
      totalSucceeded += res.succeededCount;
      totalFailed += res.failedCount;
    }

    // 2. Perform garbage collection
    try {
      if (true) {

      const { data: existingRows, error: fetchErr } = await supabase
        .from('user_uploaded_matches')
        .select('id');
      
      if (fetchErr) {
        console.warn("Failed to fetch existing uploaded match IDs for stale cleanup:", fetchErr);
      } else if (existingRows) {
        const existingIds = existingRows.map(row => String(row.id));
        const keeperIdsSet = new Set(uniqueMatches.map(m => String(m.id)));
        const idsToDelete = existingIds.filter(id => !keeperIdsSet.has(id));
        
        if (idsToDelete.length > 0) {
          console.log(`De-syncing / deleting ${idsToDelete.length} stale uploaded matches from Supabase...`);
          for (let i = 0; i < idsToDelete.length; i += 100) {
            const chunk = idsToDelete.slice(i, i + 100);
            const { error: delErr } = await supabase
              .from('user_uploaded_matches')
              .delete()
              .in('id', chunk);
            if (delErr) {
              console.warn("Chunk deletion failed for stale uploaded matches:", delErr);
            }
          }
        }
      }
    }
      } catch (gcErr) {
      console.warn("Garbage collection of stale uploaded matches failed:", gcErr);
    }

    // UPDATE ML MATRIX WITH ANY NEW COMPLETED MATCHES
    import('./mlMatrixUpdater').then(updater => {
        updater.updateMLMatrixFromMatches(uniqueMatches).catch(err => {
            console.error("Failed to update ML Matrix:", err);
        });
    });

    try {
      await idbSet(UPLOADED_CACHE_KEY, uniqueMatches);
      localStorage.setItem(UPLOADED_CACHE_TIME_KEY, Date.now().toString());
      memoryUploadedMatches = uniqueMatches;
    } catch(e) {}
    console.log(`Successfully backed up ${uniqueMatches.length} user-uploaded matches to Supabase user_uploaded_matches table.`);
    return true;
  } catch (error) {
    console.error("Error backing up uploaded matches to Supabase table:", error);
    return false;
  }
};

export const deleteUploadedMatchFromSupabase = async (id: string | number): Promise<boolean> => {
    try {
        const { error } = await supabase.from('user_uploaded_matches').delete().eq('id', String(id));
        if (error) {
            console.error("Failed to delete match from user_uploaded_matches:", error);
            return false;
        }
        if (memoryUploadedMatches) {
            memoryUploadedMatches = memoryUploadedMatches.filter(m => String(m.id) !== String(id));
        }
        try {
            const idbData = await idbGet(UPLOADED_CACHE_KEY);
            if (idbData && Array.isArray(idbData)) {
                const filteredData = idbData.filter(m => String(m.id) !== String(id));
                await idbSet(UPLOADED_CACHE_KEY, filteredData);
            }
        } catch(e) {}
        return true;
    } catch (error) {
        console.error("Error deleting match:", error);
        return false;
    }
};

export const deleteUploadedMatchesFromSupabaseBulk = async (ids: (string | number)[]): Promise<boolean> => {
    if (!ids || ids.length === 0) return true;
    try {
        const stringIds = ids.map(id => String(id));
        for (let i = 0; i < stringIds.length; i += 100) {
            const chunk = stringIds.slice(i, i + 100);
            const { error } = await supabase.from('user_uploaded_matches').delete().in('id', chunk);
            if (error) {
                console.error("Failed to bulk delete matches from user_uploaded_matches:", error);
            }
        }
        return true;
    } catch (error) {
        console.error("Error bulk deleting matches:", error);
        return false;
    }
};

/**
 * Loads all user-uploaded matches from the Supabase user_uploaded_matches table.
 * Paginated in intervals of 1000 to keep the response streaming stable and fast.
 */
export const loadUploadedMatchesFromSupabase = async (forceRefresh = false): Promise<Match[]> => {
  if (!forceRefresh && memoryUploadedMatches && memoryUploadedMatches.length > 0) {
    return filterTombstoned(memoryUploadedMatches);
  }
  const now = Date.now();
  const cachedTimeStr = localStorage.getItem(UPLOADED_CACHE_TIME_KEY);
  if (!forceRefresh && cachedTimeStr) {
    const cachedTime = parseInt(cachedTimeStr, 10);
    if (now - cachedTime < CACHE_EXPIRY_MS) {
      try {
        let idbData = await idbGet(UPLOADED_CACHE_KEY);
        if (idbData && Array.isArray(idbData) && idbData.length > 0) {
          idbData.forEach((m: any) => {
            if (m && typeof m === 'object') {
              delete m.lockedOpwScores;
              delete m.lockedOpwScore;
            }
          });
          memoryUploadedMatches = idbData;
          return filterTombstoned(idbData);
        }
      } catch (e) {}
    }
  }
  const matches: Match[] = [];
  try {
    let fetchedFromFastApi = false;
    try {
      const baseUrl = typeof window === 'undefined' ? 'http://localhost:3000' : '';
      const response = await fetch(`${baseUrl}/api/db/uploaded-matches`);
      if (response.ok) {
        const json = await response.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          matches.push(...json.data);
          fetchedFromFastApi = true;
          console.log(`Loaded ${matches.length} uploaded matches via fast server endpoint.`);
        }
      }
    } catch (apiErr) {
      console.warn("Fast /api/db/uploaded-matches fetch fallback to standard query:", apiErr);
    }

    if (!fetchedFromFastApi) {
      let from = 0;
      const step = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('user_uploaded_matches')
          .select('data')
          .order('date', { ascending: false })
          .range(from, from + step - 1);

        if (error) {
          console.warn("Supabase user_uploaded_matches query failed:", error);
          break;
        }

        if (data && data.length > 0) {
          data.forEach(row => {
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
    }

    if (matches.length > 0) {
      const dedupedMap = new Map<string, Match>();
      for (const m of matches) {
        if (m && typeof m === 'object') {
          delete m.lockedOpwScores;
          delete m.lockedOpwScore;
        }
        // Validate stats to filter out any corrupted "story" extracts
        const isValidStat = (val: string) => !val || val.length <= 15;
        if (!isValidStat(m.ga) || !isValidStat(m.gs) || !isValidStat(m.l10)) {
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
      matches.length = 0;
      matches.push(...dedupedMap.values());
    }

    console.log(`Loaded ${matches.length} uploaded matches from Supabase user_uploaded_matches.`);
    try {
      await idbSet(UPLOADED_CACHE_KEY, matches);
      await idbSet('prm_uploaded_matches', matches);
      localStorage.setItem(UPLOADED_CACHE_TIME_KEY, now.toString());
    } catch(e) {}
    memoryUploadedMatches = matches;
  } catch (error) {
    console.error("Error loading uploaded matches from Supabase table:", error);
  }
  return filterTombstoned(matches);
};

/**
 * Deletes all user-uploaded matches from public.user_uploaded_matches.
 */
export const clearUploadedMatchesFromSupabase = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_uploaded_matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything safely

    if (error) {
      console.error("Failed to delete user_uploaded_matches table content:", error);
      return false;
    }

    console.log("Cleared database table user_uploaded_matches.");
    localStorage.removeItem(UPLOADED_CACHE_KEY);
    localStorage.removeItem(UPLOADED_CACHE_TIME_KEY);
    memoryUploadedMatches = null;
    return true;
  } catch (error) {
    console.error("Error clearing user_uploaded_matches table:", error);
    return false;
  }
};
