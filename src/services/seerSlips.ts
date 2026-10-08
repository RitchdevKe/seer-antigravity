import { supabase } from "../lib/supabase";
import { Pick } from "../components/ai/GeminiCards";
import { cleanUndefined } from "../utils/dbUtils";
import LZString from "lz-string";
import axios from "axios";

export interface SeerLockedSlip {
  id: string; // {date}_{category}
  date: string;
  category: string;
  picks: Pick[];
  backups: Pick[];
  weightsAtTime: any;
  createdAt: string;
  type: "daily" | "jackpot";
}

const LOCKED_SLIPS_COLLECTION = "seer_locked_slips";
const AI_SLIPS_COLLECTION = "seer_ai_slips";

export const saveLockedSlip = async (
  slip: SeerLockedSlip,
  forceOverwrite: boolean = false,
) => {
  const collection = slip.category.startsWith("ai_") ? AI_SLIPS_COLLECTION : LOCKED_SLIPS_COLLECTION;
  const { createdAt, ...stableSlip } = slip;
  const slipHash = LZString.compressToUTF16(JSON.stringify(stableSlip));
  const cacheKey = `seer_locked_slip_hash_${slip.id}`;
  slipTombstones.delete(slip.id);

  // If not a force overwrite, check if a slip already exists — if so, do NOT overwrite
  if (!forceOverwrite) {
    try {
      if (typeof localStorage !== "undefined") {
        const existing = localStorage.getItem(`local_locked_slip_${slip.id}`);
        if (existing) {
          const parsed = JSON.parse(existing);
          if (parsed && parsed.picks && parsed.picks.length > 0) {
            return; // Slip already exists and has picks, preserve it
          }
        }
      }
    } catch (e) {}
  }

  // 1. Always save to localStorage immediately for instant client response
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(`local_locked_slip_${slip.id}`, JSON.stringify(slip));
    }
  } catch (e) {
    console.warn("Failed to save to localStorage:", e);
  }

  // 2. Always save to backend disk storage for persistent backend backup across reloads
  try {
    await axios.post("/api/storage/save", {
      key: `slip_${slip.id}`,
      data: slip,
    });
  } catch (e: any) {
    // If running in node test environment without relative URL, handle fallback
    try {
      if (typeof window === "undefined" || !window.location) {
        await axios.post("http://localhost:3000/api/storage/save", {
          key: `slip_${slip.id}`,
          data: slip,
        });
      }
    } catch (err) {}
  }

  if (typeof localStorage !== "undefined" && localStorage.getItem(cacheKey) === slipHash && !forceOverwrite) {
    return; // Skip save if identical to last sync
  }

  // 3. Attempt saving to primary Supabase collection
  const cleanedSlip = cleanUndefined({
    id: slip.id,
    date: slip.date,
    category: slip.category,
    type: slip.type,
    picks: slip.picks,
    backups: slip.backups || [],
    weights_at_time: slip.weightsAtTime || {},
    created_at: slip.createdAt || new Date().toISOString(),
  });

  try {
    const { error: upsertErr } = await supabase
      .from(collection)
      .upsert(cleanedSlip, { onConflict: "id" });

    if (upsertErr) {
      console.warn(`Upsert to Supabase ${collection} returned error:`, upsertErr);
    } else {
      console.log(`Saved locked slip to Supabase ${collection}: ${slip.id}`);
    }
  } catch (error: any) {
    console.warn(`Supabase saveLockedSlip primary collection (${collection}) failed.`, error);
  }

  // If primary collection was seer_ai_slips, also mirror save to seer_locked_slips as fallback
  if (collection === AI_SLIPS_COLLECTION) {
    try {
      await supabase
        .from(LOCKED_SLIPS_COLLECTION)
        .upsert(cleanedSlip, { onConflict: "id" });
    } catch (e) {
      console.warn(`Fallback save to ${LOCKED_SLIPS_COLLECTION} failed.`, e);
    }
  }

  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(cacheKey, slipHash);
  } catch (e) {}
};

const fetchWithTimeout = async <T>(promiseLike: PromiseLike<T>, timeoutMs = 8000): Promise<T> => {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Supabase request timed out")), timeoutMs);
  });
  try {
    const result = await Promise.race([Promise.resolve(promiseLike), timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

const sanitizeUpsetSlip = (slip: SeerLockedSlip | null, category: string): SeerLockedSlip | null => {
  if (!slip || !slip.picks) return slip;
  if (category === 'upsets' || category === 'ai_upsets' || category === 'sandbox_upsets' || category === 'upset') {
    slip.picks = slip.picks.map(p => {
      let pred = p.prediction;
      if (pred === '1X') pred = '1';
      else if (pred === 'X2') pred = '2';
      return { ...p, prediction: pred, primaryPrediction: pred };
    });
  }
  return slip;
};

// Tombstones for slips invalidated by an OPW weights Apply. While a tombstone is active,
// getLockedSlip will NOT re-hydrate the slip from backend disk / Supabase (which could
// otherwise race the in-flight delete and re-save the stale slip). A new saveLockedSlip clears it.
const SLIP_TOMBSTONE_TTL_MS = 2 * 60 * 1000;
const slipTombstones: Map<string, number> = new Map();

const isSlipTombstoned = (slipId: string): boolean => {
  const ts = slipTombstones.get(slipId);
  if (!ts) return false;
  if (Date.now() - ts > SLIP_TOMBSTONE_TTL_MS) {
    slipTombstones.delete(slipId);
    return false;
  }
  return true;
};

export const getLockedSlip = async (
  date: string,
  category: string,
  forceRefresh = false,
  options?: { noRehydrate?: boolean }
): Promise<SeerLockedSlip | null> => {
  const collection = category.startsWith("ai_") ? AI_SLIPS_COLLECTION : LOCKED_SLIPS_COLLECTION;
  const slipId = `${date}_${category}`;
  const skipRemote = !!options?.noRehydrate || isSlipTombstoned(slipId);
  
  // 1. Try reading from localStorage first for instant response
  if (!forceRefresh) {
    try {
      if (typeof localStorage !== "undefined") {
        const localVal = localStorage.getItem(`local_locked_slip_${slipId}`);
        if (localVal) {
          const parsed = JSON.parse(localVal) as SeerLockedSlip;
          if (parsed && parsed.id && parsed.picks && parsed.picks.length > 0) {
            return sanitizeUpsetSlip(parsed, category);
          }
        }
      }
    } catch (e) {
      console.error("Failed to parse local locked slip", e);
    }
  }

  // 2. Try loading from Backend persistent disk storage API (skipped while tombstoned / noRehydrate)
  if (!skipRemote) try {
    let url = `/api/storage/load/slip_${slipId}`;
    if (typeof window === "undefined" || !window.location) {
      url = `http://localhost:3000/api/storage/load/slip_${slipId}`;
    }
    const res = await axios.get(url);
    if (res.data && res.data.id && res.data.picks && res.data.picks.length > 0) {
      const slip: SeerLockedSlip = sanitizeUpsetSlip(res.data, category)!;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(`local_locked_slip_${slipId}`, JSON.stringify(slip));
        }
      } catch (e) {}
      return slip;
    }
  } catch (e) {}
  
  // 3. Try reading from Supabase (skipped while tombstoned / noRehydrate)
  if (!skipRemote) try {
    let data = null;

    // Try primary collection first
    try {
      const dbRes = await fetchWithTimeout(
        supabase
          .from(collection)
          .select("*")
          .eq("id", slipId)
          .maybeSingle(),
        8000
      );

      if (!dbRes.error && dbRes.data) {
        data = dbRes.data;
      }
    } catch (e) {}


    if (data && data.picks && data.picks.length > 0) {
      const slip: SeerLockedSlip = sanitizeUpsetSlip({
        id: data.id,
        date: data.date,
        category: data.category,
        picks: data.picks || [],
        backups: data.backups || [],
        weightsAtTime: data.weights_at_time || {},
        type: data.type || "daily",
        createdAt: data.created_at || data.updated_at || new Date().toISOString(),
      }, category)!;

      // Keep localStorage in sync
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(`local_locked_slip_${slipId}`, JSON.stringify(slip));
        }
      } catch (e) {}

      // Keep backend storage in sync
      try {
        let url = `/api/storage/save`;
        if (typeof window === "undefined" || !window.location) {
          url = `http://localhost:3000/api/storage/save`;
        }
        await axios.post(url, { key: `slip_${slipId}`, data: slip });
      } catch (e) {}

      return slip;
    }
  } catch (error: any) {
    console.warn(`Supabase getLockedSlip failed for ${slipId}. Falling back to localStorage.`, error);
  }

  // 4. Fall back to localStorage as a last resort
  try {
    if (typeof localStorage !== "undefined") {
      const localVal = localStorage.getItem(`local_locked_slip_${slipId}`);
      if (localVal) {
        const parsed = JSON.parse(localVal) as SeerLockedSlip;
        if (parsed && parsed.id && parsed.picks && parsed.picks.length > 0) {
          return sanitizeUpsetSlip(parsed, category);
        }
      }
    }
  } catch (e) {}

  return null;
};

export const deleteLockedSlip = async (date: string, category: string) => {
  const baseCat = category.replace(/^ai_/, "");
  const ids = [
    `${date}_${baseCat}`,
    `${date}_ai_${baseCat}`,
  ];
  // Mark tombstones immediately so concurrent getLockedSlip calls don't resurrect the slip
  const tombstoneTs = Date.now();
  ids.forEach((id) => slipTombstones.set(id, tombstoneTs));

  // 1. Purge from localStorage and sessionStorage
  try {
    if (typeof localStorage !== "undefined") {
      ids.forEach((id) => {
        localStorage.removeItem(`local_locked_slip_${id}`);
        localStorage.removeItem(`local_locked_slip_hash_${id}`);
        localStorage.removeItem(`seer_locked_slip_hash_${id}`);
        sessionStorage.removeItem(`seer_locked_slip_hash_${id}`);
      });
    }
  } catch (e) {}

  // 2. Purge from Backend persistent disk storage
  const backendBase = (typeof window === "undefined" || !window.location)
    ? "http://localhost:3000"
    : "";
  for (const id of ids) {
    try {
      await axios.delete(`${backendBase}/api/storage/delete/slip_${id}`);
    } catch (e) {}
  }

  // 3. Purge performance caches so History doesn't show deleted slip results
  const collections = ["seer_performance_history", "seer_jackpot_history"];
  for (const coll of collections) {
    try {
      await axios.delete(`${backendBase}/api/storage/delete/perf_cache_${coll}_${baseCat}_${date}`);
    } catch (e) {}
    try {
      await axios.delete(`${backendBase}/api/storage/delete/perf_cache_${coll}_ai_${baseCat}_${date}`);
    } catch (e) {}
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(`local_seer_perf_cache_${coll}_${baseCat}_${date}`);
        localStorage.removeItem(`local_seer_perf_cache_${coll}_ai_${baseCat}_${date}`);
      }
    } catch (e) {}
  }

  // Direct Node.js filesystem deletion fallback for server-side / test environments
  if (typeof window === "undefined") {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const dataDir = path.resolve(process.cwd(), "data");
      for (const id of ids) {
        const filePath = path.join(dataDir, `slip_${id}.json`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      for (const coll of collections) {
        const p1 = path.join(dataDir, `perf_cache_${coll}_${baseCat}_${date}.json`);
        const p2 = path.join(dataDir, `perf_cache_${coll}_ai_${baseCat}_${date}.json`);
        if (fs.existsSync(p1)) fs.unlinkSync(p1);
        if (fs.existsSync(p2)) fs.unlinkSync(p2);
      }
    } catch (e) {}
  }

  // 4. Purge from Supabase tables
  try {
    for (const id of ids) {
      await supabase.from(LOCKED_SLIPS_COLLECTION).delete().eq("id", id);
      await supabase.from(AI_SLIPS_COLLECTION).delete().eq("id", id);
    }
    // Delete from Supabase performance cache
    for (const coll of collections) {
      await supabase
        .from("seer_performance_cache")
        .delete()
        .eq("collection", coll)
        .in("category", [baseCat, `ai_${baseCat}`])
        .eq("date", date);
    }
    console.log(`Permanently deleted locked slip & performance cache: ${date} (${baseCat})`);
  } catch (error: any) {
    console.warn(`Supabase deleteLockedSlip cleanup notice for ${date} ${baseCat}:`, error);
  }
};

/**
 * Invalidates (deletes) locked slips after OPW weights change, and AWAITS completion
 * (localStorage, backend disk, Supabase) before resolving, so listeners refetching
 * afterwards cannot re-hydrate stale slips.
 *
 * @param categories Category ids to invalidate, or 'all' (uses `allCategoryIds` + any found in localStorage)
 * @param dates Explicit dates (YYYY-MM-DD) to invalidate; dates found in local_locked_slip_* keys are added
 * @returns The list of dates that were invalidated
 */
export const invalidateLockedSlipsForWeights = async (
  categories: string[] | 'all',
  dates: Iterable<string>,
  allCategoryIds: string[] = [],
  timeoutMs = 20000
): Promise<string[]> => {
  const expand = (c: string): string[] => {
    const base = c.replace(/^ai_/, '');
    return (base === 'top_12_value' || base === 'top_10_value') ? ['top_12_value', 'top_10_value'] : [base];
  };
  const targetCats = new Set<string>();
  if (categories === 'all') {
    allCategoryIds.forEach(c => expand(c).forEach(x => targetCats.add(x)));
  } else {
    categories.forEach(c => expand(c).forEach(x => targetCats.add(x)));
  }

  const dateSet = new Set<string>();
  for (const d of dates) if (d) dateSet.add(d);

  // Discover additional dates (and, for 'all', categories) from localStorage slip keys
  try {
    if (typeof localStorage !== "undefined") {
      const re = /^local_locked_slip_(\d{4}-\d{2}-\d{2})_(.+)$/;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const m = key ? re.exec(key) : null;
        if (!m) continue;
        const cat = m[2].replace(/^ai_/, '');
        if (categories === 'all') {
          targetCats.add(cat);
          dateSet.add(m[1]);
        } else if (targetCats.has(cat)) {
          dateSet.add(m[1]);
        }
      }
    }
  } catch (e) {}

  const jobs: Array<[string, string]> = [];
  dateSet.forEach(d => targetCats.forEach(c => jobs.push([d, c])));

  // Tombstone all affected ids up-front (queued jobs may not start before listeners refetch)
  const nowTs = Date.now();
  jobs.forEach(([d, c]) => {
    slipTombstones.set(`${d}_${c}`, nowTs);
    slipTombstones.set(`${d}_ai_${c}`, nowTs);
  });

  // Bounded concurrency so large historical date sets don't flood the network
  const CONCURRENCY = 8;
  let cursor = 0;
  const worker = async () => {
    while (cursor < jobs.length) {
      const [d, c] = jobs[cursor++];
      try { await deleteLockedSlip(d, c); } catch (e) {}
    }
  };
  const run = Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker));
  let timeoutId: any;
  const timeout = new Promise<void>(resolve => { timeoutId = setTimeout(resolve, timeoutMs); });
  await Promise.race([run, timeout]);
  clearTimeout(timeoutId);

  return Array.from(dateSet);
};

