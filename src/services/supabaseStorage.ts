import { supabase } from '../lib/supabase';
import { clearAllNonEssential, getMemorySerialized, registerFailedLocalStorageWrite, clearFailedLocalStorageWrite } from './storage';
import { del } from 'idb-keyval';
import { loadSupremeWeightsFromDb } from './supabaseSupremeWeights';

const SYNC_KEYS = [
  'prm_match_stars',
  'prm_deleted_match_ids',
  'local_supreme_weights_map',
  'local_supreme_custom_weights'
];

// Helper to identify heavy match dataset blobs that are already stored in relational tables
const isHeavyRedundantKey = (key: string): boolean => {
  if (!key) return false;
  return (
    key.startsWith('prm_uploaded_matches') ||
    key.startsWith('prm_live_matches') ||
    key.startsWith('prm_match_archives') ||
    key.startsWith('prm_performance_archives') ||
    key.startsWith('prm_ai_history') ||
    key.startsWith('prm_ai_') ||
    key.startsWith('prm_archive_data_') ||
    key.startsWith('prm_archive_manifest') ||
    key.startsWith('slip_')
  );
};

// In-memory cache of server synchronized states
const lastSyncedValues: Record<string, string> = {};
const DIRTY_KEYS_STORE_KEY = 'prm_pending_sync_keys';

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

const safeLS = {
  getItem: (key: string): string | null => {
    if (!isBrowser) return null;
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  setItem: (key: string, value: string): void => {
    if (!isBrowser) return;
    try { localStorage.setItem(key, value); } catch (e) { throw e; }
  },
  removeItem: (key: string): void => {
    if (!isBrowser) return;
    try { localStorage.removeItem(key); } catch (e) {}
  }
};

const loadDirtyKeys = (): Set<string> => {
  try {
    const stored = safeLS.getItem(DIRTY_KEYS_STORE_KEY);
    if (!stored) return new Set<string>();
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set<string>(parsed);
  } catch (e) {
    return new Set<string>();
  }
};

let lastSavedDirtyKeysJson = '';
let isSavingDirtyKeys = false;
const saveDirtyKeys = (keys: Set<string>) => {
  if (!isBrowser || isSavingDirtyKeys) return;
  isSavingDirtyKeys = true;
  const arr = Array.from(keys);
  try {
    const json = JSON.stringify(arr);
    if (json === lastSavedDirtyKeysJson) {
      isSavingDirtyKeys = false;
      return;
    }
    safeLS.setItem(DIRTY_KEYS_STORE_KEY, json);
    lastSavedDirtyKeysJson = json;
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
      console.warn("Storage quota exceeded while saving dirty keys. Trimming keys and saving essential keys...");
      clearAllNonEssential().catch(console.error);
      const essentialKeys = arr.filter(k => !k.includes('_part') && !k.includes('_manifest')).slice(0, 20);
      try {
        safeLS.setItem(DIRTY_KEYS_STORE_KEY, JSON.stringify(essentialKeys));
        lastSavedDirtyKeysJson = JSON.stringify(essentialKeys);
      } catch (e2) {}
    }
  } finally {
    isSavingDirtyKeys = false;
  }
};

const dirtyKeys = loadDirtyKeys();
const LAST_LOAD_TIME_KEY = 'prm_last_supabase_load_time';
const LOAD_THRESHOLD = 24 * 60 * 60 * 1000;
const SYNC_INTERVAL = 30 * 60 * 1000;

export const loadFromSupabase = async (force: boolean = false) => {
  const now = Date.now();
  const lastLoad = parseInt(safeLS.getItem(LAST_LOAD_TIME_KEY) || '0');

  // Load authoritative supreme custom weights from relational table on every start
  try {
    const dbCustomWeights = await loadSupremeWeightsFromDb();
    if (dbCustomWeights && Object.keys(dbCustomWeights).length > 0) {
      console.log("Restoring authoritative supreme custom weights from database table:", dbCustomWeights);
      safeLS.setItem('local_supreme_custom_weights', JSON.stringify(dbCustomWeights));
      // Dispatch custom event to notify listening views to reload and recompute
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('supreme-weights-restored'));
      }
    }
  } catch (err) {
    console.warn("Failed to fetch supreme custom weights from relational DB:", err);
  }

  if (!force && (now - lastLoad < LOAD_THRESHOLD)) {
    console.log('Skipping Supabase load: Local storage is fresh (< 24 hours old)');
    if (Object.keys(lastSyncedValues).length === 0) {
      SYNC_KEYS.forEach(key => {
        const val = safeLS.getItem(key) || getMemorySerialized(key);
        if (val) lastSyncedValues[key] = val;
      });
      
      const manifests = ['prm_live_matches_manifest', 'prm_uploaded_matches_manifest', 'prm_archive_manifest'];
      manifests.forEach(manifestKey => {
        const manifestData = safeLS.getItem(manifestKey) || getMemorySerialized(manifestKey);
        if (manifestData) {
          try {
            const manifest = JSON.parse(manifestData);
            if (manifest.chunks) {
              manifest.chunks.forEach((chunkKey: string) => {
                const val = safeLS.getItem(chunkKey) || getMemorySerialized(chunkKey);
                if (val) lastSyncedValues[chunkKey] = val;
              });
            }
          } catch (e) {}
        }
      });
    }
    return;
  }

  try {
    const fetchPromise = supabase
      .from('user_storage')
      .select('key, value');

    let res: any = null;
    try {
      res = await Promise.race([
        fetchPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('user_storage fetch timeout')), 5000))
      ]);
    } catch (tErr) {
      console.warn("user_storage fetch timed out, skipping cloud restore:", tErr);
      return;
    }

    const { data, error } = res || {};

    if (error) {
      console.warn("Supabase storage values fetch failed (table might not exist yet):", error);
      return;
    }

    if (data) {
      data.forEach(row => {
        const key = row.key;
        const value = row.value;
        try {
          // Skip stale user_storage restoration for supreme weights, OPW calibrations, or heavy match blob keys
          if (
            key === 'local_supreme_custom_weights' || 
            key === 'local_supreme_weights_map' || 
            key === 'optimized_weights_settings' ||
            key.startsWith('daily_optimized_weights_') ||
            key.startsWith('seer_opw_') ||
            isHeavyRedundantKey(key)
          ) {
            return;
          }

          const localData = safeLS.getItem(key) || getMemorySerialized(key);
          const lastSynced = lastSyncedValues[key];

          if (!localData || localData === lastSynced || force) {
            if (value) {
              try {
                safeLS.setItem(key, value);
                lastSyncedValues[key] = value;
                clearFailedLocalStorageWrite(key);
              } catch (setItemErr: any) {
                if (setItemErr.name === 'QuotaExceededError' || setItemErr.name === 'NS_ERROR_DOM_QUOTA_REACHED' || setItemErr.message?.includes('exceeded the quota')) {
                  console.warn(`[Supabase Load] Quota exceeded for "${key}" on restore. Registering in-memory/IndexedDB fallback...`);
                  registerFailedLocalStorageWrite(key, value);
                  lastSyncedValues[key] = value; // Mark synchronized anyway!
                } else {
                  console.error(`Unexpected setItem error for ${key}:`, setItemErr);
                }
              }
              // Also delete from IndexedDB so loadLargeArrayAsync falls back to the newer localStorage item (only if localStorage write succeeded)
              if (safeLS.getItem(key) === value) {
                try {
                  del(key).catch((err) => console.warn(`Failed to delete IndexedDB key ${key} on loadFromSupabase:`, err));
                } catch (e) {}
              }
            } else {
              safeLS.removeItem(key);
              clearFailedLocalStorageWrite(key);
              lastSyncedValues[key] = '';
              try {
                del(key).catch((err) => console.warn(`Failed to remove IndexedDB key ${key} on loadFromSupabase:`, err));
              } catch (e) {}
            }
          }
        } catch (itemErr) {
          console.error(`Error loading key "${key}" from Supabase:`, itemErr);
        }
      });
      safeLS.setItem(LAST_LOAD_TIME_KEY, now.toString());
      console.log('Data loaded and verified from Supabase');
    }
  } catch (error) {
    console.error('Failed to load from Supabase:', error);
  }
};

let syncTimeout: NodeJS.Timeout | null = null;
let isSyncInProgress = false;

export const markKeyDirty = (key: string) => {
  if (isHeavyRedundantKey(key)) return;
  dirtyKeys.add(key);
  saveDirtyKeys(dirtyKeys);
};

export const debouncedSyncToSupabase = (key?: string) => {
  if (key && !isHeavyRedundantKey(key)) {
    dirtyKeys.add(key);
    saveDirtyKeys(dirtyKeys);
  }

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }

  syncTimeout = setTimeout(async () => {
    await forceSyncToSupabase();
  }, 15000); // Debounced 15s to conserve queries
};

export const forceSyncToSupabase = async () => {
  if (isSyncInProgress || dirtyKeys.size === 0) return;

  isSyncInProgress = true;
  try {
    const keysToProcess = Array.from(dirtyKeys).filter(k => !isHeavyRedundantKey(k));
    const records = [];

    for (const key of keysToProcess) {
      const localData = localStorage.getItem(key) || getMemorySerialized(key);
      if (localData === null) {
        // Deletion
        await supabase
          .from('user_storage')
          .delete()
          .eq('key', key);
        delete lastSyncedValues[key];
        dirtyKeys.delete(key);
      } else if (localData !== lastSyncedValues[key]) {
        records.push({
          key,
          value: localData,
          updated_at: new Date().toISOString()
        });
        lastSyncedValues[key] = localData;
      } else {
        dirtyKeys.delete(key);
      }
    }

    if (records.length > 0) {
      const { error } = await supabase
        .from('user_storage')
        .upsert(records, { onConflict: 'key' });

      if (error) {
        throw error;
      }

      records.forEach(r => dirtyKeys.delete(r.key));
      saveDirtyKeys(dirtyKeys);
      console.log(`Successfully synced ${records.length} keys to Supabase`);
    } else {
      // Keys were clean but processed, just do nothing
    }
  } catch (error) {
    console.error('Error syncing to Supabase:', error);
  } finally {
    isSyncInProgress = false;
  }
};
