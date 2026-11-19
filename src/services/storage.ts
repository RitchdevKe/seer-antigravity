
import { Match, AIAnalysisArchive } from '../types';
import { get, set as idbSet, del } from 'idb-keyval';
import LZString from 'lz-string';
import { debouncedSyncToSupabase, forceSyncToSupabase } from './supabaseStorage';
import { deduplicateMatches } from '../utils/storageUtils';
import { saveUploadedMatchesToSupabase, clearUploadedMatchesFromSupabase } from './supabaseUploadedMatches';
import { saveLiveMatchesToSupabase, clearLiveMatchesFromSupabase } from './supabaseLiveMatches';
import { getStableMatchId } from '../utils/matchId';

export { forceSyncToSupabase };

export const failedLocalStorageWrites: Record<string, string> = {};

export const getMemorySerialized = (key: string): string | null => {
    return failedLocalStorageWrites[key] || null;
};

export const registerFailedLocalStorageWrite = async (key: string, value: string) => {
    failedLocalStorageWrites[key] = value;
    try {
        await idbSet(key, value);
    } catch (e) {
        console.warn(`[IDB Backup] IndexedDB save failed in registerFailedLocalStorageWrite for ${key}:`, e);
    }
};

export const clearFailedLocalStorageWrite = (key: string) => {
    delete failedLocalStorageWrites[key];
    del(key).catch(() => {});
};

const KEYS = {
  LIVE_MATCHES: 'prm_live_matches',
  UPLOADED_MATCHES: 'prm_uploaded_matches',
  ARCHIVES: 'prm_match_archives',
  AI_HISTORY: 'prm_ai_history_v2',
  AI_CURRENT_SYSTEM: 'prm_ai_system_data',
  AI_CURRENT_LIVE: 'prm_ai_live_data',
  AI_CURRENT_JACKPOT: 'prm_ai_jackpot_data',
  AI_CURRENT_POST_MATCH_DAILY: 'prm_ai_postmatch_daily_data',
  AI_CURRENT_POST_MATCH_JACKPOT: 'prm_ai_postmatch_jackpot_data',
  AI_CURRENT_SELF_LEARN: 'prm_ai_self_learn_data',
  AI_CURRENT_SYSTEM_ARCHITECTURE: 'prm_ai_system_architecture_data',
  SEER_WEIGHTS: 'prm_seer_weights',
  NERDY_DAILY_MATCHES: 'prm_nerdy_daily_matches',
  NERDY_JACKPOT_MATCHES: 'prm_nerdy_jackpot_matches',
  DELETED_MATCH_IDS: 'prm_deleted_match_ids'
};

// --- HELPERS ---
const CHUNK_SIZE = 1000; // Increased to reduce number of keys

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

const safeLS = {
    getItem: (key: string): string | null => {
        if (!isBrowser) return null;
        try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    setItem: (key: string, value: string): void => {
        if (!isBrowser) return;
        localStorage.setItem(key, value);
    },
    removeItem: (key: string): void => {
        if (!isBrowser) return;
        try { localStorage.removeItem(key); } catch (e) {}
    }
};

const clearChunks = async (key: string) => {
    let j = 0;
    // Check up to 100 chunks just in case
    while (j < 100) {
        const chunkKey = `${key}_part${j}`;
        if (safeLS.getItem(chunkKey)) {
            safeLS.removeItem(chunkKey);
            debouncedSyncToSupabase(chunkKey);
        } else {
            // If we don't find a part, it might be the end, but let's check one more to be safe
            if (!safeLS.getItem(`${key}_part${j+1}`)) break;
        }
        j++;
    }
    safeLS.removeItem(`${key}_manifest`);
    debouncedSyncToSupabase(`${key}_manifest`);
};

const minifyMatch = (m: any): any => {
    if (!m || typeof m !== 'object') return m;
    return {
        id: m.id,
        teams: m.teams,
        result: m.result,
        pred1x2: m.pred1x2,
        rating: m.rating,
        // Preserve the precalculated flag AND the pattern analysis result so
        // processMatch()'s fast path can skip recomputation on the next load.
        isPrecalculated: m.isPrecalculated ?? false,
        patternAnalysis: m.patternAnalysis,
        totalPoints: m.totalPoints,
        maxPoints: m.maxPoints,
        pointsRange: m.pointsRange,
        patterns: m.patterns,
        rawPrediction: m.rawPrediction,
        finalPrediction: m.finalPrediction,
        hedgeNote: m.hedgeNote,
        algoReport: m.algoReport,
        gs: m.gs,
        ga: m.ga,
        actualResult: m.actualResult,
        l10: m.l10,
        le: m.le,
        mo: m.mo,
        date: m.date,
        league: m.league,
        isJackpot: m.isJackpot,
        isDaily: m.isDaily,
        jackpotId: m.jackpotId,
        jackpotIds: m.jackpotIds,
        analysis: m.analysis,
        percentage: m.percentage,
        stars: m.stars,
        tip: m.tip,
        odds: m.odds,
        paaPrediction: m.paaPrediction,
        paaPrimaryPrediction: m.paaPrimaryPrediction,
        seerPrediction: m.seerPrediction,
        seerPrimaryPrediction: m.seerPrimaryPrediction,
        seerPercentages: m.seerPercentages,
        seerScores: m.seerScores,
        priority: m.priority,
        patternCode: m.patternCode,
        moPrediction: m.moPrediction,
        calculatedPrediction: m.calculatedPrediction,
        probabilityConfidence: m.probabilityConfidence,
        activeAiFilters: m.activeAiFilters,
        extractedAt: m.extractedAt,
        evaluatorTags: m.evaluatorTags,
        mandatory_hedge: m.mandatory_hedge,
        phaReliability: m.phaReliability,
        paaWin: m.paaWin,
        paaDraw: m.paaDraw,
        paaUpset: m.paaUpset,
        mlInfo: m.mlInfo,
        mlPrediction: m.mlPrediction,
        mlConfidence: m.mlConfidence,
        mlReasoning: m.mlReasoning,
        mlStats: m.mlStats,
        mlPercentages: m.mlPercentages || m.mlInfo?.mlPercentages
    };
};

const trySaveChunks = (key: string, data: any[]): boolean => {
    const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
    const successfullyWrittenKeys: string[] = [];
    try {
        for (let i = 0; i < totalChunks; i++) {
            const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            const chunkKey = `${key}_part${i}`;
            const compressed = LZString.compressToUTF16(JSON.stringify(chunk));
            safeLS.setItem(chunkKey, compressed);
            successfullyWrittenKeys.push(chunkKey);
            debouncedSyncToSupabase(chunkKey);
        }
        
        // 2. Save manifest
        const manifest = { totalChunks, count: data.length, updatedAt: new Date().toISOString() };
        const manifestKey = `${key}_manifest`;
        safeLS.setItem(manifestKey, JSON.stringify(manifest));
        debouncedSyncToSupabase(manifestKey);

        // 3. Clean up old chunks if the new set is smaller
        let j = totalChunks;
        while (j < 100) {
            const oldChunkKey = `${key}_part${j}`;
            if (safeLS.getItem(oldChunkKey)) {
                safeLS.removeItem(oldChunkKey);
                debouncedSyncToSupabase(oldChunkKey);
            } else {
                if (!safeLS.getItem(`${key}_part${j+1}`)) break;
            }
            j++;
        }
        return true;
    } catch (e) {
        // Rollback whatever was written to prevent stale keys/partial writes
        successfullyWrittenKeys.forEach(k => {
            safeLS.removeItem(k);
            debouncedSyncToSupabase(k);
        });
        throw e;
    }
};

const saveLargeArray = async (key: string, data: any[]) => {
    // 0. Ensure full version is backed up on Express server first in the background
    try {
        saveToServer(key, data).catch(err => {
            console.warn(`[Storage Backup] Direct server-side backup failed inside background thread:`, err);
        });
    } catch (err) {
        console.warn(`[Storage Backup] Direct server-side backup failed, but proceeding to save locally:`, err);
    }

    // 1. Remove legacy single key
    safeLS.removeItem(key);
    debouncedSyncToSupabase(key);

    try {
        // Attempt IDB save
        await idbSet(key, data);
        await clearChunks(key); // Cleanup legacy chunks if they exist
    } catch (e: any) {
        console.warn(`[IDB Backup] IndexedDB save failed, falling back to local storage chunks:`, e);
        try {
            // Attempt regular chunked save
            trySaveChunks(key, data);
        } catch (errLocal: any) {
            const isQuotaError = errLocal.name === 'QuotaExceededError' || errLocal.name === 'NS_ERROR_DOM_QUOTA_REACHED' || errLocal.code === 22 || errLocal.number === 0x8052000e;
            if (!isQuotaError) {
                console.error(`Failed to save large array for ${key} due to unexpected error:`, errLocal);
                throw errLocal;
            }

            console.warn(`[Storage Healing] Storage quota exceeded while trying to save "${key}". Executing Level 1 auto-healing...`);
            try {
                // Level 1 Healing: Delete re-fetchable or non-essential data
                safeLS.removeItem(KEYS.NERDY_DAILY_MATCHES);
                safeLS.removeItem(KEYS.NERDY_JACKPOT_MATCHES);
                safeLS.removeItem(KEYS.AI_HISTORY);
                debouncedSyncToSupabase(KEYS.AI_HISTORY);
                trimLocalArchives(1);
                
                // Retry save with original data
                trySaveChunks(key, data);
                console.log(`[Storage Healing] Level 1 auto-healing successful! Saved original data for "${key}".`);
                return;
            } catch (level1Err: any) {
                console.warn(`[Storage Healing] Level 1 healing failed. Executing Level 2 (Minification) for "${key}"...`);
            }

            try {
                // Level 2 Healing: Minify elements to strip giant recursive/nested JSON properties
                const minified = data.map(minifyMatch);
                trySaveChunks(key, minified);
                console.log(`[Storage Healing] Level 2 auto-healing successful! Saved minified data array for "${key}".`);
                return;
            } catch (level2Err: any) {
                console.warn(`[Storage Healing] Level 2 healing failed. Executing Level 3 (Truncation)...`);
            }

            try {
                // Level 3 Healing: Slice to most recent entries so it GUARANTEES saving
                const capped = data.map(minifyMatch).slice(0, 3000);
                trySaveChunks(key, capped);
                console.log(`[Storage Healing] Level 3 auto-healing successful! Truncated storage to 3000 records.`);
                return;
            } catch (level3Err: any) {
                console.error(`[Storage Healing] Level 3 auto-healing failed. Storage is severely full.`, level3Err);
                throw level3Err;
            }
        }
    }
};

const loadLargeArrayAsync = async (key: string): Promise<any[] | null> => {
    try {
        const idbData = await get(key);
        if (idbData && Array.isArray(idbData)) {
           return idbData;
        }
    } catch(e) {
        console.warn(`[IDB Load] Failed to load ${key} from IDB, falling back to localStorage...`);
    }
    return loadLargeArray(key);
};

const trimLocalArchives = (keepDays: number = 3) => {
    try {
        const manifest = loadCompressed('prm_archive_manifest') || [];
        if (manifest.length > keepDays) {
            const toDelete = manifest.slice(keepDays);
            
            toDelete.forEach((date: string) => {
                safeLS.removeItem(`prm_archive_data_${date}`);
            });
            // We don't update manifest to keep server references
        }
    } catch (e) {}
};

export const clearAllNonEssential = async () => {
    console.warn("CRITICAL STORAGE CLEANUP INITIATED");
    // Clear AI History
    safeLS.removeItem(KEYS.AI_HISTORY);
    // Clear Uploaded matches (they are often the biggest)
    safeLS.removeItem(KEYS.UPLOADED_MATCHES);
    await clearChunks(KEYS.UPLOADED_MATCHES);
    // Clear archives older than 1 day
    trimLocalArchives(1);
    // Clear nerdy cache
    safeLS.removeItem(KEYS.NERDY_DAILY_MATCHES);
    safeLS.removeItem(KEYS.NERDY_JACKPOT_MATCHES);
};

const loadLargeArray = (key: string): any[] | null => {
    try {
        const manifestStr = safeLS.getItem(`${key}_manifest`);
        if (!manifestStr) {
            // Fallback to legacy single key
            return loadCompressed(key);
        }
        
        const manifest = JSON.parse(manifestStr);
        let allData: any[] = [];
        for (let i = 0; i < manifest.totalChunks; i++) {
            const chunk = loadCompressed(`${key}_part${i}`);
            if (chunk) allData = [...allData, ...chunk];
        }
        return allData;
    } catch (e) {
        console.warn(`Failed to load large array for ${key}, falling back`, e);
        return loadCompressed(key);
    }
};

const saveToServer = async (key: string, data: any) => {
    try {
        if (typeof window === 'undefined') return;
        await fetch("/api/storage/save", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ key, data })
        });
    } catch (e) {
        console.warn(`Failed to save ${key} to server backup`, e);
    }
};

const saveCompressed = async (key: string, data: any) => {
    // Delete from IndexedDB to avoid stale IndexedDB caches overriding localStorage reads in loadLargeArrayAsync
    try {
        await del(key);
    } catch (idbErr) {
        console.warn(`[IDB Cleanup] Failed to delete ${key} from IDB during compressed save:`, idbErr);
    }

    const compressed = LZString.compressToUTF16(JSON.stringify(data));
    try {
        safeLS.setItem(key, compressed);
        // If we succeeded, make sure to remove it from failedLocalStorageWrites if it was there
        delete failedLocalStorageWrites[key];
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.message?.includes('exceeded the quota')) {
            console.warn(`Storage quota exceeded for ${key}. Cleaning up...`);
            try {
                const manifest = loadCompressed('prm_archive_manifest') || [];
                if (manifest.length > 2) {
                    const toDelete = manifest.slice(2);
                    toDelete.forEach((date: string) => {
                        safeLS.removeItem(`prm_archive_data_${date}`);
                        delete failedLocalStorageWrites[`prm_archive_data_${date}`];
                    });
                }
                safeLS.removeItem('prm_ai_history');
                safeLS.removeItem(KEYS.AI_HISTORY);
            } catch(cleanE) {}
            
            try {
                safeLS.setItem(key, compressed);
                delete failedLocalStorageWrites[key];
            } catch (retryE) {
                console.warn(`Failed to save ${key} even after cleanup. Skipping local storage for this key.`, retryE);
                // Save to IndexedDB and memory instead!
                failedLocalStorageWrites[key] = compressed;
                try {
                    await idbSet(key, compressed);
                } catch (idbErr) {
                    console.warn("IndexedDB fallback write failed", idbErr);
                }
            }
        } else {
            throw e;
        }
    }
    
    try {
        debouncedSyncToSupabase(key);
        saveToServer(key, data);
    } catch (syncE) {
        console.warn(`Background sync tasks failed for ${key}`, syncE);
    }
};

const loadCompressed = (key: string) => {
    const failedWrite = failedLocalStorageWrites[key];
    const data = failedWrite !== undefined ? failedWrite : safeLS.getItem(key);
    if (!data) return null;
    try {
        const decompressed = LZString.decompressFromUTF16(data);
        if (decompressed) return JSON.parse(decompressed);
        return JSON.parse(data); // Fallback for old uncompressed data
    } catch (e) {
        try {
            return JSON.parse(data); // Fallback for old uncompressed data
        } catch (e2) {
            return null;
        }
    }
};

export const initStorageAndCacheCombined = async () => {
    // 1. Try loading KEYS from IDB
    for (const key of Object.values(KEYS)) {
        try {
            const val = await get(key);
            if (val && typeof val === 'string') {
                failedLocalStorageWrites[key] = val;
            }
        } catch (e) {}
    }
    // 2. Also, load any archives from IndexedDB
    try {
        const manifest = loadCompressed('prm_archive_manifest') || [];
        for (const date of manifest) {
            const archiveKey = `prm_archive_data_${date}`;
            const val = await get(archiveKey);
            if (val && typeof val === 'string') {
                failedLocalStorageWrites[archiveKey] = val;
            }
        }
    } catch (e) {}
};

// --- SERVER SYNC ---
export const syncFromServer = async () => {
    console.log("Syncing data from server...");
    for (const key of Object.values(KEYS)) {
        try {
            const response = await fetch(`/api/storage/load/${key}`);
            if (response.ok) {
                const data = await response.json();
                const compressed = LZString.compressToUTF16(JSON.stringify(data));
                localStorage.setItem(key, compressed);
                // Also clear potential chunks to avoid conflicts
                await clearChunks(key);
                console.log(`Synced ${key} from server`);
            }
        } catch (e) {
            console.warn(`Failed to sync ${key} from server`, e);
        }
    }
};

// --- MATCH DATA ---

let memoryLiveMatches: Match[] | null = null;

export const setLiveMatchesInMemory = (matches: Match[]) => {
  memoryLiveMatches = matches;
};

export const saveLiveMatches = async (matches: Match[], sync: boolean = true, force: boolean = false) => {
  try {
    // Regenerate and standardize IDs for all live matches to prevent duplicates/drift
    const idUpdatedMatches = matches.map(m => {
      const stableId = getStableMatchId(m);
      return m.id === stableId ? m : { ...m, id: stableId };
    });
    const uniqueMatches = deduplicateMatches(idUpdatedMatches);
    memoryLiveMatches = uniqueMatches;

    // Save to Supabase live_matches relational table in background ONLY when sync is true
    if (sync) {
      saveLiveMatchesToSupabase(uniqueMatches).catch(err => {
        console.error("Failed to sync live matches to relational DB table in background:", err);
      });
    }

    try {
        if (uniqueMatches.length > CHUNK_SIZE) {
            await saveLargeArray(KEYS.LIVE_MATCHES, uniqueMatches);
        } else {
            await saveCompressed(KEYS.LIVE_MATCHES, uniqueMatches);
            await clearChunks(KEYS.LIVE_MATCHES); // Ensure chunks are cleared when switching to single key
        }
        
        if (sync) {
            if (force) await forceSyncToSupabase();
            else debouncedSyncToSupabase(KEYS.LIVE_MATCHES);
        }
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            // Clear history aggressively
            saveCompressed(KEYS.AI_HISTORY, []);
            await saveCompressed(KEYS.LIVE_MATCHES, uniqueMatches);
            if (sync) debouncedSyncToSupabase(KEYS.LIVE_MATCHES);
        } else {
            throw e;
        }
    }
  } catch (e) {
    console.error("Failed to save live matches", e);
  }
};

export const getLiveMatchesAsync = async (): Promise<Match[]> => {
  if (memoryLiveMatches && memoryLiveMatches.length > 0) {
    return memoryLiveMatches;
  }
  try {
    const data = await loadLargeArrayAsync(KEYS.LIVE_MATCHES);
    if (data && data.length > 0) {
      memoryLiveMatches = data;
      return data;
    }
    return [];
  } catch (e) {
    return [];
  }
};

export const getLiveMatches = (): Match[] => {
  if (memoryLiveMatches !== null) {
    return memoryLiveMatches;
  }
  try {
    const data = loadLargeArray(KEYS.LIVE_MATCHES);
    if (data && data.length > 0) {
      memoryLiveMatches = data;
      return data;
    }
    return [];
  } catch (e) {
    return [];
  }
};

export const clearLiveMatches = async () => {
  try {
    memoryLiveMatches = null;
    localStorage.removeItem(KEYS.LIVE_MATCHES);
    await clearChunks(KEYS.LIVE_MATCHES);
    await forceSyncToSupabase();
    await clearLiveMatchesFromSupabase();
  } catch (e) {
    console.error("Failed to clear live matches", e);
  }
};

let memoryUploadedMatches: Match[] | null = null;

export const setUploadedMatchesInMemory = (matches: Match[]) => {
  memoryUploadedMatches = matches;
};

export const saveUploadedMatches = async (matches: Match[], sync: boolean = true, force: boolean = false) => {
  try {
    // Regenerate and standardize IDs for all uploaded matches to prevent duplicates/drift
    const idUpdatedMatches = matches.map(m => {
      const stableId = getStableMatchId(m);
      return m.id === stableId ? m : { ...m, id: stableId };
    });
    const uniqueMatches = deduplicateMatches(idUpdatedMatches);
    memoryUploadedMatches = uniqueMatches;

    // 1. Backup to Supabase relational table in background ONLY when sync is true
    if (sync) {
      saveUploadedMatchesToSupabase(uniqueMatches).catch(err => {
        console.error("Failed to sync uploaded matches to relational DB table in background:", err);
      });
    }

    // 2. Always persist full array to IndexedDB (supports gigabytes without localStorage quota limits)
    try {
      const nowStr = Date.now().toString();
      await idbSet('seer_uploaded_matches_idb_cache_v2', uniqueMatches);
      await idbSet('seer_uploaded_matches_idb_cache_v5', uniqueMatches);
      await idbSet(KEYS.UPLOADED_MATCHES, uniqueMatches);
      localStorage.setItem('seer_uploaded_matches_idb_cache_time_v2', nowStr);
      localStorage.setItem('seer_uploaded_matches_idb_cache_time_v5', nowStr);
      if (sync) {
        localStorage.removeItem('seer_uploaded_matches_idb_cache_meta_v5');
      }
    } catch (idbErr) {
      console.warn("Failed to persist uploaded matches to IndexedDB:", idbErr);
    }

    // 3. For small datasets (<= 150 items), save compressed to localStorage for instant synchronous read
    if (uniqueMatches.length <= 150) {
      try {
        await saveCompressed(KEYS.UPLOADED_MATCHES, uniqueMatches);
        await clearChunks(KEYS.UPLOADED_MATCHES);
      } catch (e) {}
    } else {
      // Clear legacy localStorage chunks to prevent QuotaExceededError
      try {
        safeLS.removeItem(KEYS.UPLOADED_MATCHES);
        await clearChunks(KEYS.UPLOADED_MATCHES);
      } catch (e) {}
    }
  } catch (e) {
    console.error("Failed to save uploaded matches", e);
  }
};

export const getUploadedMatchesAsync = async (): Promise<Match[]> => {
  if (memoryUploadedMatches && memoryUploadedMatches.length > 0) {
    return memoryUploadedMatches;
  }
  try {
    let data = await get('seer_uploaded_matches_idb_cache_v5');
    if (!data || !Array.isArray(data) || data.length === 0) {
      data = await get('seer_uploaded_matches_idb_cache_v4');
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      data = await get('seer_uploaded_matches_idb_cache_v2');
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      data = await get(KEYS.UPLOADED_MATCHES);
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      data = await loadLargeArrayAsync(KEYS.UPLOADED_MATCHES);
    }
    if (data && Array.isArray(data) && data.length > 0) {
      memoryUploadedMatches = data;
      return data;
    }
    return [];
  } catch (e) {
    return [];
  }
};

export const getUploadedMatches = (): Match[] => {
  if (memoryUploadedMatches !== null) {
    return memoryUploadedMatches;
  }
  try {
    const data = loadLargeArray(KEYS.UPLOADED_MATCHES);
    if (data && data.length > 0) {
      memoryUploadedMatches = data;
      return data;
    }
    return [];
  } catch (e) {
    return [];
  }
};

export const clearUploadedMatches = async () => {
  try {
    memoryUploadedMatches = null;
    localStorage.removeItem(KEYS.UPLOADED_MATCHES);
    await clearChunks(KEYS.UPLOADED_MATCHES);
    
    // Perform remote DB clearing / syncing in background to keep UI instantly responsive
    forceSyncToSupabase().catch(err => {
      console.error("Failed to force sync in background during clear:", err);
    });
    clearUploadedMatchesFromSupabase().catch(err => {
      console.error("Failed to clear uploaded matches from Supabase in background:", err);
    });
  } catch (e) {
    console.error("Failed to clear uploaded matches", e);
  }
};

export const saveArchive = async (date: string, matches: Match[], sync: boolean = true) => {
  try {
    const uniqueMatches = deduplicateMatches(matches);
    // Granular Storage: Each date gets its own key
    const archiveKey = `prm_archive_data_${date}`;
    await saveCompressed(archiveKey, uniqueMatches);

    // Update manifest (list of dates)
    let manifest = loadCompressed('prm_archive_manifest') || [];
    if (!manifest.includes(date)) {
        manifest.push(date);
        // Important: keep sorted by date descending
        manifest.sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());
        await saveCompressed('prm_archive_manifest', manifest);
    }
    
    if (sync) debouncedSyncToSupabase(archiveKey);
  } catch (e) {
    console.error("Failed to save archive", e);
  }
};

export const getArchivesAsync = async (): Promise<{ date: string, matches: Match[] }[]> => {
  return getArchives();
};

export const getArchives = (): { date: string, matches: Match[] }[] => {
  try {
    const manifest = loadCompressed('prm_archive_manifest');
    
    if (!manifest) {
       // Legacy Fallback & Migration
       const legacyArchives = loadCompressed(KEYS.ARCHIVES);
       if (legacyArchives && Array.from(legacyArchives).length > 0) {
           console.log("Migrating legacy archives to granular storage...");
           const dates: string[] = [];
           legacyArchives.forEach((a: any) => {
               const key = `prm_archive_data_${a.date}`;
               const compressed = LZString.compressToUTF16(JSON.stringify(a.matches));
               try {
                   localStorage.setItem(key, compressed);
                   dates.push(a.date);
               } catch (e: any) {
                   console.warn(`Skipping legacy archive ${a.date} due to storage limits.`);
               }
           });
           try {
               localStorage.setItem('prm_archive_manifest', LZString.compressToUTF16(JSON.stringify(dates)));
           } catch(e) {}
           localStorage.removeItem(KEYS.ARCHIVES);
           return legacyArchives;
       }
       return [];
    }

    const archives = manifest.map((date: string) => {
        const matches = loadCompressed(`prm_archive_data_${date}`);
        return { date, matches: matches || [] };
    });
    
    return archives;
  } catch (e) {
    return [];
  }
};

export const deleteArchive = async (date: string) => {
  try {
    const manifest = loadCompressed('prm_archive_manifest') || [];
    const newManifest = manifest.filter((d: string) => d !== date);
    await saveCompressed('prm_archive_manifest', newManifest);
    localStorage.removeItem(`prm_archive_data_${date}`);
    debouncedSyncToSupabase(`prm_archive_data_${date}`);
    return getArchives();
  } catch (e) {
    console.error("Failed to delete archive", e);
    return getArchives();
  }
};

export const updateLatestPerformanceArchive = async (results: any) => {
  try {
    const archives = getPerformanceArchives();
    if (archives.length > 0) {
      archives[0].results = results;
      archives[0].date = new Date().toISOString();
      await saveCompressed('prm_performance_archives', archives);
      debouncedSyncToSupabase('prm_performance_archives');
    }
  } catch (e) {
    console.error("Failed to update latest performance archive", e);
  }
};

export const savePerformanceArchive = async (archive: any, sync: boolean = true) => {
  try {
    const archives = getPerformanceArchives();
    const newArchives = [archive, ...archives].slice(0, 100); // Increased from 10 to 100
    try {
        await saveCompressed('prm_performance_archives', newArchives);
        if (sync) debouncedSyncToSupabase('prm_performance_archives');
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            await saveCompressed('prm_performance_archives', [archive, ...archives].slice(0, 10));
            if (sync) debouncedSyncToSupabase('prm_performance_archives');
        } else {
            throw e;
        }
    }
  } catch (e) {
    console.error("Failed to save performance archive", e);
  }
};

export const getPerformanceArchives = (): any[] => {
  try {
    const data = loadCompressed('prm_performance_archives');
    return data || [];
  } catch (e) {
    return [];
  }
};

export const deletePerformanceArchive = async (id: string) => {
  try {
    const archives = getPerformanceArchives();
    const newArchives = archives.filter(a => a.id !== id);
    await saveCompressed('prm_performance_archives', newArchives);
    debouncedSyncToSupabase('prm_performance_archives');
    return newArchives;
  } catch (e) {
    console.error("Failed to delete performance archive", e);
    return [];
  }
};

// --- AI DATA ---

export const saveAIHistory = async (entry: AIAnalysisArchive, sync: boolean = true) => {
  try {
    const history = getAIHistory();
    // Reduced from 50 to 20 to save localStorage space
    const newHistory = [entry, ...history].slice(0, 20); 
    try {
        await saveCompressed(KEYS.AI_HISTORY, newHistory);
        if (sync) debouncedSyncToSupabase(KEYS.AI_HISTORY);
    } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            // Trim to 3 entries if quota is exceeded
            await saveCompressed(KEYS.AI_HISTORY, [entry, ...history].slice(0, 3));
            if (sync) debouncedSyncToSupabase(KEYS.AI_HISTORY);
        } else {
            throw e;
        }
    }
  } catch (e) {
    console.error("Failed to save AI history", e);
  }
};

export const getAIHistory = (): AIAnalysisArchive[] => {
  try {
    const data = loadCompressed(KEYS.AI_HISTORY);
    return data || [];
  } catch (e) {
    return [];
  }
};

export const deleteAIHistory = async (id: string) => {
  try {
    const history = getAIHistory();
    const newHistory = history.filter(h => h.id !== id);
    await saveCompressed(KEYS.AI_HISTORY, newHistory);
    debouncedSyncToSupabase(KEYS.AI_HISTORY);
    return newHistory;
  } catch (e) {
    console.error("Failed to delete AI history", e);
    return [];
  }
};

export const saveCurrentAnalysis = async (key: 'system' | 'live' | 'jackpot' | 'post_match_daily' | 'post_match_jackpot' | 'self_learn' | 'system_architecture', data: any, sync: boolean = true) => {
    let storageKey = KEYS.AI_CURRENT_SYSTEM;
    if (key === 'live') storageKey = KEYS.AI_CURRENT_LIVE;
    if (key === 'jackpot') storageKey = KEYS.AI_CURRENT_JACKPOT;
    if (key === 'post_match_daily') storageKey = KEYS.AI_CURRENT_POST_MATCH_DAILY;
    if (key === 'post_match_jackpot') storageKey = KEYS.AI_CURRENT_POST_MATCH_JACKPOT;
    if (key === 'self_learn') storageKey = KEYS.AI_CURRENT_SELF_LEARN;
    if (key === 'system_architecture') storageKey = KEYS.AI_CURRENT_SYSTEM_ARCHITECTURE;
    
    try {
        await saveCompressed(storageKey, data);
        if (sync) debouncedSyncToSupabase(storageKey);
    } catch (e: any) {
        console.warn("Storage quota exceeded, attempting to clear history and retry...", e);
        try {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                // Trim history aggressively to make room
                const history = getAIHistory();
                if (history.length > 2) {
                    await saveCompressed(KEYS.AI_HISTORY, history.slice(0, 2));
                }
                await saveCompressed(storageKey, data);
            } else {
                throw e;
            }
        } catch (retryError) {
            console.warn("Failed to save even after clearing history", retryError);
            // We don't throw here to avoid crashing the UI with an unhandled promise rejection
            // The analysis succeeded, we just couldn't cache it.
        }
    }
};

export const getCurrentAnalysis = (key: 'system' | 'live' | 'jackpot' | 'post_match_daily' | 'post_match_jackpot' | 'self_learn' | 'system_architecture') => {
    try {
        let storageKey = KEYS.AI_CURRENT_SYSTEM;
        if (key === 'live') storageKey = KEYS.AI_CURRENT_LIVE;
        if (key === 'jackpot') storageKey = KEYS.AI_CURRENT_JACKPOT;
        if (key === 'post_match_daily') storageKey = KEYS.AI_CURRENT_POST_MATCH_DAILY;
        if (key === 'post_match_jackpot') storageKey = KEYS.AI_CURRENT_POST_MATCH_JACKPOT;
        if (key === 'self_learn') storageKey = KEYS.AI_CURRENT_SELF_LEARN;
        if (key === 'system_architecture') storageKey = KEYS.AI_CURRENT_SYSTEM_ARCHITECTURE;
        
        return loadCompressed(storageKey);
    } catch { return null; }
};

export const saveSeerWeights = async (weightsMap: Record<string, any>) => {
    try {
        // Enforce clamping on each individual weight for all categories
        const clampedWeightsMap: Record<string, any> = {};
        for (const [key, weights] of Object.entries(weightsMap)) {
            if (typeof weights === 'object' && weights !== null) {
                const clamped: any = { ...weights };
                for (const prop of Object.keys(clamped)) {
                    if (typeof clamped[prop] === 'number') {
                        const maxVal = prop.startsWith('synergyCond') || prop === 'synergyGapBoost' ? 1000 : 100;
                        clamped[prop] = Math.min(maxVal, Math.max(0, clamped[prop]));
                    }
                }
                clampedWeightsMap[key] = clamped;
            } else {
                clampedWeightsMap[key] = weights;
            }
        }
        await saveCompressed(KEYS.SEER_WEIGHTS, clampedWeightsMap);
        debouncedSyncToSupabase(KEYS.SEER_WEIGHTS);
    } catch (e) {
        console.error("Failed to save Seer weights", e);
    }
};

import seerWeightsData from '../utils/seerWeights.json';

export const getSeerWeights = (): Record<string, any> => {
    try {
        const finalData = { ...seerWeightsData };
        
        // One-time Reset/Force-Sync with the latest highly optimized weights
        const forceResetKey = 'prm_seer_weights_force_reset_v10';
        if (!localStorage.getItem(forceResetKey)) {
            // Overwrite stored weights to discard older stale weight overrides
            saveCompressed(KEYS.SEER_WEIGHTS, finalData).catch(console.error);
            localStorage.setItem(forceResetKey, 'true');
            return finalData;
        }

        const data = loadCompressed(KEYS.SEER_WEIGHTS);
        if (data && Object.keys(data).length > 0) {
            return data;
        }
        return finalData || {};
    } catch {
        return seerWeightsData || {};
    }
};

// --- NERDY TIPS CACHE ---

const nerdyCacheTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const memoryNerdyCache: Record<string, Match[]> = {};

export const saveNerdyMatchesCache = async (type: 'daily' | 'jackpot', matches: Match[]) => {
    const key = type === 'daily' ? KEYS.NERDY_DAILY_MATCHES : KEYS.NERDY_JACKPOT_MATCHES;
    memoryNerdyCache[key] = matches;
    if (nerdyCacheTimers[key]) clearTimeout(nerdyCacheTimers[key]);
    nerdyCacheTimers[key] = setTimeout(() => {
        delete nerdyCacheTimers[key];
        saveCompressed(key, matches).catch(e => {
            console.error(`Failed to cache ${type} nerdy matches`, e);
        });
    }, 150);
};

export const getNerdyMatchesCache = (type: 'daily' | 'jackpot'): Match[] => {
    const key = type === 'daily' ? KEYS.NERDY_DAILY_MATCHES : KEYS.NERDY_JACKPOT_MATCHES;
    if (memoryNerdyCache[key]) return memoryNerdyCache[key];
    try {
        const loaded = loadCompressed(key) || [];
        memoryNerdyCache[key] = loaded;
        return loaded;
    } catch {
        return [];
    }
};

export const cleanupStoredDuplicates = async () => {
    console.log("Starting storage deduplication cleanup...");
    const live = getLiveMatches();
    const uploaded = getUploadedMatches();
    
    const uniqueLive = deduplicateMatches(live);
    const uniqueUploaded = deduplicateMatches(uploaded);
    
    if (uniqueLive.length !== live.length) {
        console.log(`Deduplicated Live: ${live.length} -> ${uniqueLive.length}`);
        await saveLiveMatches(uniqueLive, true, true);
    }
    
    if (uniqueUploaded.length !== uploaded.length) {
        console.log(`Deduplicated Uploaded: ${uploaded.length} -> ${uniqueUploaded.length}`);
        await saveUploadedMatches(uniqueUploaded, true, true);
    }
    
    // Also cleanup archives manifest for good measure
    const archives = getArchives();
    for (const archive of archives) {
        const uniqueArchive = deduplicateMatches(archive.matches);
        if (uniqueArchive.length !== archive.matches.length) {
            console.log(`Deduplicated Archive ${archive.date}: ${archive.matches.length} -> ${uniqueArchive.length}`);
            await saveArchive(archive.date, uniqueArchive, true);
        }
    }
    
    console.log("Storage deduplication cleanup complete.");
};
