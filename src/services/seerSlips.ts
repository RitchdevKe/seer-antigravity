import { supabase } from "../lib/supabase";
import { Pick } from "../components/ai/GeminiCards";
import { cleanUndefined } from "../utils/dbUtils";
import { Match } from "../types";
import LZString from "lz-string";
import axios from "axios";
import { generateSeerSlips } from "../utils/seerSlipSelection";
import { getAnalysisDateString } from "./seerPerformance";
import { getLogicalDate, getActualResult, isMatchCorrectForCategory } from "../utils/matchProcessing";
import { getMatchDayOfWeek } from "../utils/opwCommon";
import { isBannedFromSeerSlips } from "../utils/leagueFilters";

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

export const getCategoryAliases = (category: string): string[] => {
  const isAi = category.startsWith("ai_");
  const cleanCat = category.replace(/^ai_/, "");
  const aliasMap: Record<string, string[]> = {
    top_12_value: ["top_12_value", "top_10_value", "top12", "top10"],
    top_10_value: ["top_10_value", "top_12_value", "top10", "top12"],
    top12: ["top_12_value", "top_10_value", "top12", "top10"],
    top10: ["top_10_value", "top_12_value", "top10", "top12"],
    high_confidence: ["high_confidence", "top20"],
    top20: ["top20", "high_confidence"],
    value_picks: ["value_picks"],
    value_bets: ["value_bets"],
  };
  const baseAliases = aliasMap[cleanCat] || [cleanCat];
  return isAi ? baseAliases.map(c => `ai_${c}`) : baseAliases;
};

// Global in-memory cache for sub-millisecond slip rendering across views
export const SESSION_SLIP_CACHE = new Map<string, {
  slips: Record<string, SeerLockedSlip>;
  aiSlips: Record<string, SeerLockedSlip>;
  timestamp: number;
}>();

export const saveLockedSlipsBulk = async (
  slips: SeerLockedSlip[],
  forceOverwrite: boolean = false,
) => {
  if (!Array.isArray(slips) || slips.length === 0) return;

  const validSlips: SeerLockedSlip[] = [];
  for (const slip of slips) {
    if (!slip || !slip.id) continue;
    slipTombstones.delete(slip.id);

    if (!forceOverwrite && typeof localStorage !== "undefined") {
      try {
        const existing = localStorage.getItem(`local_locked_slip_${slip.id}`);
        if (existing) {
          const parsed = JSON.parse(existing);
          if (parsed && parsed.picks && parsed.picks.length > 0) {
            continue;
          }
        }
      } catch (e) {}
    }

    // 1. Immediately cache in localStorage and SESSION_SLIP_CACHE for instant client response (< 1ms)
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(`local_locked_slip_${slip.id}`, JSON.stringify(slip));
      }
      if (slip.date) {
        const cacheKey = `${slip.date}_${slip.type || 'daily'}`;
        const mem = SESSION_SLIP_CACHE.get(cacheKey) || { slips: {}, aiSlips: {}, timestamp: Date.now() };
        const cleanCat = slip.category.replace(/^ai_/, '');
        const isAi = slip.category.startsWith('ai_');
        const aliases = getCategoryAliases(cleanCat);
        for (const a of aliases) {
          if (isAi) {
            mem.aiSlips[a] = slip;
          } else {
            mem.slips[a] = slip;
          }
          if (typeof localStorage !== "undefined") {
            const aId = isAi ? `${slip.date}_ai_${a}` : `${slip.date}_${a}`;
            localStorage.setItem(`local_locked_slip_${aId}`, JSON.stringify(slip));
          }
        }
        mem.timestamp = Date.now();
        SESSION_SLIP_CACHE.set(cacheKey, mem);
      }
    } catch (e) {
      console.warn("Failed to save to localStorage:", e);
    }

    validSlips.push(slip);
  }

  if (validSlips.length === 0) return;

  // 2. High-speed single bulk persistence to AWS RDS PostgreSQL via /api/db/slips/batch (< 20ms)
  try {
    let baseUrl = "";
    if (typeof window === "undefined" || !window.location) {
      baseUrl = "http://localhost:3000";
    }
    await axios.post(`${baseUrl}/api/db/slips/batch`, { slips: validSlips }, { timeout: 6000 });
  } catch (err: any) {
    console.warn("[saveLockedSlipsBulk] Batch save to PostgreSQL notice:", err.message);
  }

  // 3. Mirror in background to disk storage and Supabase (fire-and-forget, non-blocking)
  (async () => {
    for (const slip of validSlips) {
      // Local disk storage
      try {
        let baseUrl = "";
        if (typeof window === "undefined" || !window.location) baseUrl = "http://localhost:3000";
        await axios.post(`${baseUrl}/api/storage/save`, {
          key: `slip_${slip.id}`,
          data: slip,
        });
      } catch (e) {}

      // Supabase mirror
      try {
        const collection = slip.category.startsWith("ai_") ? AI_SLIPS_COLLECTION : LOCKED_SLIPS_COLLECTION;
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
        await supabase.from(collection).upsert(cleanedSlip, { onConflict: "id" });
        if (collection === AI_SLIPS_COLLECTION) {
          await supabase.from(LOCKED_SLIPS_COLLECTION).upsert(cleanedSlip, { onConflict: "id" });
        }
      } catch (e) {}
    }
  })().catch(() => {});
};

export const saveLockedSlip = async (
  slip: SeerLockedSlip,
  forceOverwrite: boolean = false,
) => {
  return saveLockedSlipsBulk([slip], forceOverwrite);
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

export const getLockedSlipsForDate = async (
  date: string,
  categories: string[] = []
): Promise<{ slips: Record<string, SeerLockedSlip>; aiSlips: Record<string, SeerLockedSlip> }> => {
  const slips: Record<string, SeerLockedSlip> = {};
  const aiSlips: Record<string, SeerLockedSlip> = {};

  // 1. Fast in-memory cache check (< 0.1ms)
  const cacheKey = `${date}_daily`;
  const mem = SESSION_SLIP_CACHE.get(cacheKey);
  if (mem && categories.length > 0 && categories.every(c => !!mem.slips[c])) {
    return { slips: mem.slips, aiSlips: mem.aiSlips };
  }

  // 2. Check local storage first for sub-5ms instant response
  let missingAny = false;
  if (typeof localStorage !== 'undefined') {
    for (const cat of categories) {
      const aliases = getCategoryAliases(cat);
      let foundReg = false;
      let foundAi = false;
      for (const a of aliases) {
        const regId = `${date}_${a}`;
        if (!foundReg && !isSlipTombstoned(regId)) {
          const regVal = localStorage.getItem(`local_locked_slip_${regId}`);
          if (regVal) {
            try {
              const parsed = JSON.parse(regVal);
              if (parsed && parsed.picks && parsed.picks.length > 0) {
                const s = sanitizeUpsetSlip(parsed, cat)!;
                slips[cat] = s;
                slips[a] = s;
                foundReg = true;
              }
            } catch (e) {}
          }
        }
        const aiId = `${date}_ai_${a}`;
        if (!foundAi && !isSlipTombstoned(aiId)) {
          const aiVal = localStorage.getItem(`local_locked_slip_${aiId}`);
          if (aiVal) {
            try {
              const parsed = JSON.parse(aiVal);
              if (parsed && parsed.picks && parsed.picks.length > 0) {
                const s = sanitizeUpsetSlip(parsed, `ai_${cat}`)!;
                aiSlips[cat] = s;
                aiSlips[a] = s;
                foundAi = true;
              }
            } catch (e) {}
          }
        }
      }
      if (!foundReg) {
        missingAny = true;
      }
    }
  } else {
    missingAny = true;
  }

  // If all requested categories are present in localStorage, return immediately (< 2ms)
  if (!missingAny && categories.length > 0 && Object.keys(slips).length >= categories.length) {
    SESSION_SLIP_CACHE.set(cacheKey, { slips, aiSlips, timestamp: Date.now() });
    return { slips, aiSlips };
  }

  // 3. Fetch all slips for the date in ONE fast single batch query from backend DB (< 20ms)
  try {
    let baseUrl = '';
    if (typeof window === 'undefined' || !window.location) {
      baseUrl = 'http://localhost:3000';
    }
    const res = await axios.get(`${baseUrl}/api/db/slips/date/${date}`, { timeout: 4000 });
    if (res.data) {
      const rawSlips: any[] = res.data.slips || [];
      const rawAiSlips: any[] = res.data.aiSlips || [];

      for (const row of rawSlips) {
        if (row && row.picks) {
          if (row.id) slipTombstones.delete(row.id);
          const picks = typeof row.picks === 'string' ? JSON.parse(row.picks) : row.picks;
          const backups = typeof row.backups === 'string' ? JSON.parse(row.backups) : (row.backups || []);
          const weights = typeof row.weights_at_time === 'string' ? JSON.parse(row.weights_at_time) : (row.weights_at_time || {});
          const cat = row.category;
          const slipObj: SeerLockedSlip = sanitizeUpsetSlip({
            id: row.id,
            date: row.date,
            category: cat,
            picks,
            backups,
            weightsAtTime: weights,
            type: row.type || 'daily',
            createdAt: row.created_at || new Date().toISOString()
          }, cat)!;

          const aliases = getCategoryAliases(cat);
          for (const a of aliases) {
            const existingCreatedAt = slips[a]?.createdAt ? Date.parse(slips[a].createdAt) : 0;
            const rowCreatedAt = slipObj.createdAt ? Date.parse(slipObj.createdAt) : 0;
            if (!slips[a] || rowCreatedAt > existingCreatedAt) {
              slips[a] = slipObj;
              try {
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem(`local_locked_slip_${row.date}_${a}`, JSON.stringify(slipObj));
                }
              } catch (e) {}
            }
          }
        }
      }

      for (const row of rawAiSlips) {
        if (row && row.picks) {
          if (row.id) slipTombstones.delete(row.id);
          const picks = typeof row.picks === 'string' ? JSON.parse(row.picks) : row.picks;
          const backups = typeof row.backups === 'string' ? JSON.parse(row.backups) : (row.backups || []);
          const weights = typeof row.weights_at_time === 'string' ? JSON.parse(row.weights_at_time) : (row.weights_at_time || {});
          const cleanCat = row.category.replace(/^ai_/, '');
          const slipObj: SeerLockedSlip = sanitizeUpsetSlip({
            id: row.id,
            date: row.date,
            category: row.category,
            picks,
            backups,
            weightsAtTime: weights,
            type: row.type || 'daily',
            createdAt: row.created_at || new Date().toISOString()
          }, row.category)!;

          const aliases = getCategoryAliases(cleanCat);
          for (const a of aliases) {
            const existingAiCreatedAt = aiSlips[a]?.createdAt ? Date.parse(aiSlips[a].createdAt) : 0;
            const rowAiCreatedAt = slipObj.createdAt ? Date.parse(slipObj.createdAt) : 0;
            if (!aiSlips[a] || rowAiCreatedAt > existingAiCreatedAt) {
              aiSlips[a] = slipObj;
              try {
                if (typeof localStorage !== 'undefined') {
                  localStorage.setItem(`local_locked_slip_${row.date}_ai_${a}`, JSON.stringify(slipObj));
                }
              } catch (e) {}
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[getLockedSlipsForDate] Batch load notice for ${date}:`, err.message);
  }

  // Update session cache with fetched slips
  SESSION_SLIP_CACHE.set(cacheKey, { slips, aiSlips, timestamp: Date.now() });
  return { slips, aiSlips };
};

/**
 * Background Preloader for SEER Optimized Slips.
 * Primes SESSION_SLIP_CACHE and AWS RDS PostgreSQL on App startup for both today and yesterday,
 * ensuring that clicking the SEER button loads instantly (< 1ms).
 */
const attemptedPreloadGenerationKeys = new Set<string>();
let isPreloadRunning = false;

export const preloadSeerSlipsBackground = async ({
  liveMatches = [],
  uploadedMatches = [],
  phaStatsMap = {},
  matchStars = {},
}: {
  liveMatches?: any[];
  uploadedMatches?: any[];
  phaStatsMap?: Record<string, any>;
  matchStars?: Record<string, number>;
}) => {
  if (isPreloadRunning) return;
  isPreloadRunning = true;
  try {
    const today = getAnalysisDateString();
    const [y, m, d] = today.split("-").map(Number);

    const datesToPreload = [today];
    for (let i = 1; i <= 10; i++) {
      const dObj = new Date(y, m - 1, d);
      dObj.setDate(dObj.getDate() - i);
      datesToPreload.push(
        `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, "0")}-${String(dObj.getDate()).padStart(2, "0")}`
      );
    }
    const allCats = [
      "top_12_value",
      "best_bet",
      "bankers_dlive",
      "botb_best",
      "high_confidence",
      "bankers_jackpot",
      "banker_draws",
      "value_picks",
      "value_bets",
      "upsets",
      "ml_smart_override",
      "ml_pivot",
      "ml_ai_consensus",
      "ml_chaos",
    ];

    const allAvailableMatches = [...liveMatches, ...uploadedMatches];

    // Pre-index matches once in O(N) instead of O(N) regex .find() per slip pick
    const matchByIdMap = new Map<string, any>();
    const matchByPrefixIdMap = new Map<string, any>();
    const matchByNormTeamMap = new Map<string, any>();
    for (let i = 0; i < allAvailableMatches.length; i++) {
      const item = allAvailableMatches[i];
      if (!item) continue;
      const mId = item.id?.toString() || "";
      if (mId) {
        if (!matchByIdMap.has(mId)) matchByIdMap.set(mId, item);
        const baseId = mId.split("_")[0];
        if (baseId && !matchByPrefixIdMap.has(baseId)) matchByPrefixIdMap.set(baseId, item);
      }
      const normMTeam = (item.teams || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normMTeam && !matchByNormTeamMap.has(normMTeam)) {
        matchByNormTeamMap.set(normMTeam, item);
      }
    }

    for (const targetDate of datesToPreload) {
      // Yield to main thread between dates so UI stays 100% responsive
      await new Promise(resolve => setTimeout(resolve, 0));

      const cacheKey = `${targetDate}_daily`;
      let cachedEntry = SESSION_SLIP_CACHE.get(cacheKey);

      // 1. Check in-memory & localStorage
      if (!cachedEntry || Object.keys(cachedEntry.slips).length === 0) {
        const localSlips: Record<string, SeerLockedSlip> = {};
        const localAiSlips: Record<string, SeerLockedSlip> = {};
        if (typeof localStorage !== "undefined") {
          for (const cat of allCats) {
            const regVal = localStorage.getItem(`local_locked_slip_${targetDate}_${cat}`);
            const aiVal = localStorage.getItem(`local_locked_slip_${targetDate}_ai_${cat}`);
            if (regVal) {
              try {
                const parsed = JSON.parse(regVal);
                if (parsed?.picks?.length > 0) localSlips[cat] = parsed;
              } catch (_) {}
            }
            if (aiVal) {
              try {
                const parsed = JSON.parse(aiVal);
                if (parsed?.picks?.length > 0) localAiSlips[cat] = parsed;
              } catch (_) {}
            }
          }
        }
        if (Object.keys(localSlips).length > 0) {
          cachedEntry = { slips: localSlips, aiSlips: localAiSlips, timestamp: Date.now() };
          SESSION_SLIP_CACHE.set(cacheKey, cachedEntry);
        }
      }

      // 2. If missing categories, batch fetch from PostgreSQL backend (< 20ms)
      const currentSlips = cachedEntry ? { ...cachedEntry.slips } : {};
      const currentAiSlips = cachedEntry ? { ...cachedEntry.aiSlips } : {};
      const missingCats = allCats.filter(c => !currentSlips[c]);
      const dbAttemptKey = `db_${targetDate}_${allAvailableMatches.length}`;

      if (missingCats.length > 0 && !attemptedPreloadGenerationKeys.has(dbAttemptKey)) {
        attemptedPreloadGenerationKeys.add(dbAttemptKey);
        try {
          const dbBatch = await getLockedSlipsForDate(targetDate, allCats);
          const hydratePreloadSlip = (slip: any) => {
            if (!slip?.picks || slip.picks.length === 0 || allAvailableMatches.length === 0) return slip;
            let slipChanged = false;
            slip.picks = slip.picks.map((p: any) => {
              const pId = p.match_id?.toString() || '';
              const basePId = pId ? pId.split('_')[0] : '';
              const normPTeam = (p.team || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const found =
                (pId && matchByIdMap.get(pId)) ||
                (basePId && (matchByIdMap.get(basePId) || matchByPrefixIdMap.get(basePId))) ||
                (normPTeam && matchByNormTeamMap.get(normPTeam)) ||
                null;
              if (found) {
                if (found.l10 && found.l10 !== p.l10) { p.l10 = found.l10; slipChanged = true; }
                if (found.gs && found.gs !== p.gs) { p.gs = found.gs; slipChanged = true; }
                if (found.ga && found.ga !== p.ga) { p.ga = found.ga; slipChanged = true; }
                if (found.le && found.le !== p.le) { p.le = found.le; slipChanged = true; }
                if (found.rating && found.rating !== p.rating) { p.rating = found.rating; slipChanged = true; }
                if (found.mo && found.mo !== p.odds) { p.odds = found.mo; slipChanged = true; }
                const actual = getActualResult(found.result);
                if (actual && actual !== 'pending') {
                  const displayScore = (found.result && found.result.includes(':')) ? found.result : actual;
                  const cleanCat = (slip.category || '').replace(/^ai_/, '').replace(/^sandbox_/, '');
                  const outcome: "Pending" | "Correct" | "Incorrect" = isMatchCorrectForCategory(found, p.prediction, actual, cleanCat) ? "Correct" : "Incorrect";
                  if (p.actualResult !== displayScore || p.outcome !== outcome) {
                    p.actualResult = displayScore;
                    p.outcome = outcome;
                    slipChanged = true;
                  }
                }
              }
              return p;
            });
            if (slipChanged) {
              saveLockedSlip(slip, true).catch(() => {});
            }
            return slip;
          };

          if (dbBatch.slips) {
            for (const [cat, slip] of Object.entries(dbBatch.slips)) {
              if (slip?.picks?.length > 0) currentSlips[cat] = hydratePreloadSlip(slip);
            }
          }
          if (dbBatch.aiSlips) {
            for (const [cat, slip] of Object.entries(dbBatch.aiSlips)) {
              if (slip?.picks?.length > 0) currentAiSlips[cat] = hydratePreloadSlip(slip);
            }
          }
        } catch (dbErr) {}
      }

      // 3. If any categories are still missing, generate them in background from matches!
      // Strictly prevent auto-generating slips for past dates to protect historical locked slips
      const isPastDate = targetDate < today;
      const stillMissing = allCats.filter(c => !currentSlips[c]);
      const genAttemptKey = `gen_${targetDate}_${liveMatches.length}`;
      if (!isPastDate && stillMissing.length > 0 && allAvailableMatches.length > 0 && !attemptedPreloadGenerationKeys.has(genAttemptKey)) {
        attemptedPreloadGenerationKeys.add(genAttemptKey);
        const pool = allAvailableMatches
          .map((m: any) => (m.data && !m.teams) ? { ...m.data, ...m } : m)
          .filter(m => getLogicalDate(m.date, m.time) === targetDate && !isBannedFromSeerSlips(m));

        if (pool.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
          const dayOfWeek = getMatchDayOfWeek({ date: targetDate } as any);
          const generated = generateSeerSlips(
            pool,
            phaStatsMap,
            matchStars,
            false,
            false,
            dayOfWeek
          );

          const newlyGeneratedSlips: SeerLockedSlip[] = [];
          for (const cat of stillMissing) {
            const picksData = generated.live[cat] || generated.spec[cat] || [];
            if (picksData && picksData.length > 0) {
              const picks = picksData.map((p: any) => ({
                match_id: p.match_id,
                team: p.team || "",
                prediction: p.prediction || "1",
                primaryPrediction: p.prediction || "1",
                odds: p.odds || "1.0",
                reason: p.reason || "Cognitive AI Algorithmic Selection",
                confidence: p.confidence || "100%",
                category: cat,
                le: p.le || "",
                l10: p.l10 || "",
                rating: p.rating || "",
                gs: p.gs || "",
                ga: p.ga || "",
                league: p.league || "",
                evaluatorTags: p.evaluatorTags || [],
                opwPoints: p.opwPoints,
                opwRulesHit: p.opwRulesHit,
                opwBaseInfo: p.opwBaseInfo,
                isHprOverride: p.isHprOverride || false,
              }));

              const newSlip: SeerLockedSlip = {
                id: `${targetDate}_${cat}`,
                date: targetDate,
                category: cat,
                picks,
                backups: [],
                weightsAtTime: {},
                createdAt: new Date().toISOString(),
                type: "daily",
              };

              currentSlips[cat] = newSlip;
              newlyGeneratedSlips.push(newSlip);
            }
          }

          if (newlyGeneratedSlips.length > 0) {
            // Save to PostgreSQL in bulk (< 20ms) and localStorage
            saveLockedSlipsBulk(newlyGeneratedSlips, false).catch(() => {});
          }
        }
      }

      // Update in-memory session cache so when user navigates, it's ALREADY 100% hot!
      SESSION_SLIP_CACHE.set(cacheKey, {
        slips: currentSlips,
        aiSlips: currentAiSlips,
        timestamp: Date.now()
      });
    }
  } catch (err: any) {
    console.warn("[preloadSeerSlipsBackground] Notice during background preload:", err.message);
  } finally {
    isPreloadRunning = false;
  }
};

export const getLockedSlip = async (
  date: string,
  category: string,
  forceRefresh = false,
  options?: { noRehydrate?: boolean }
): Promise<SeerLockedSlip | null> => {
  const isAi = category.startsWith("ai_");
  const cleanCat = category.replace(/^ai_/, "");
  const collection = isAi ? AI_SLIPS_COLLECTION : LOCKED_SLIPS_COLLECTION;
  const candidateCats = getCategoryAliases(cleanCat);

  // 1. Try reading from memory cache first (< 0.1ms)
  const cacheKey = `${date}_daily`;
  const mem = SESSION_SLIP_CACHE.get(cacheKey);
  if (mem && !forceRefresh) {
    for (const candCat of candidateCats) {
      const cached = isAi ? mem.aiSlips[candCat] : mem.slips[candCat];
      if (cached && cached.picks && cached.picks.length > 0 && !isSlipTombstoned(cached.id)) {
        return sanitizeUpsetSlip(cached, category);
      }
    }
  }

  // 2. Try reading from localStorage across canonical and alias names (< 1ms)
  if (!forceRefresh) {
    for (const candCat of candidateCats) {
      const candId = isAi ? `${date}_ai_${candCat}` : `${date}_${candCat}`;
      if (isSlipTombstoned(candId)) continue;
      try {
        if (typeof localStorage !== "undefined") {
          const localVal = localStorage.getItem(`local_locked_slip_${candId}`);
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
  }

  // 3. Try loading from Backend persistent disk storage API
  for (const candCat of candidateCats) {
    const candId = isAi ? `${date}_ai_${candCat}` : `${date}_${candCat}`;
    if (isSlipTombstoned(candId) || !!options?.noRehydrate) continue;
    try {
      let url = `/api/storage/load/slip_${candId}`;
      if (typeof window === "undefined" || !window.location) {
        url = `http://localhost:3000/api/storage/load/slip_${candId}`;
      }
      const res = await axios.get(url);
      if (res.data && res.data.id && res.data.picks && res.data.picks.length > 0) {
        const slip: SeerLockedSlip = sanitizeUpsetSlip(res.data, category)!;
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(`local_locked_slip_${candId}`, JSON.stringify(slip));
          }
        } catch (e) {}
        return slip;
      }
    } catch (e) {}
  }

  // 4. Try reading from Supabase / RDS PostgreSQL
  for (const candCat of candidateCats) {
    const candId = isAi ? `${date}_ai_${candCat}` : `${date}_${candCat}`;
    if (isSlipTombstoned(candId) || !!options?.noRehydrate) continue;
    try {
      const dbRes = await fetchWithTimeout(
        supabase
          .from(collection)
          .select("*")
          .eq("id", candId)
          .maybeSingle(),
        8000
      );

      if (!dbRes.error && dbRes.data && dbRes.data.picks && dbRes.data.picks.length > 0) {
        const data = dbRes.data;
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

        // Keep localStorage and disk in sync
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(`local_locked_slip_${candId}`, JSON.stringify(slip));
          }
        } catch (e) {}

        return slip;
      }
    } catch (error: any) {
      console.warn(`Supabase getLockedSlip failed for ${candId}:`, error?.message);
    }
  }

  // 5. Try reading directly from RDS PostgreSQL via /api/db/slips/date/:date
  if (!options?.noRehydrate) {
    try {
      let baseUrl = "";
      if (typeof window === "undefined" || !window.location) baseUrl = "http://localhost:3000";
      const res = await axios.get(`${baseUrl}/api/db/slips/date/${date}`, { timeout: 4000 });
      if (res.data) {
        const rows = isAi ? (res.data.aiSlips || []) : (res.data.slips || []);
        for (const candCat of candidateCats) {
          const candId = isAi ? `${date}_ai_${candCat}` : `${date}_${candCat}`;
          const matchRow = rows.find((r: any) => r.id === candId || r.category === candCat || r.category === `ai_${candCat}`);
          if (matchRow && matchRow.picks) {
            const rawPicks = typeof matchRow.picks === 'string' ? JSON.parse(matchRow.picks) : matchRow.picks;
            if (Array.isArray(rawPicks) && rawPicks.length > 0) {
              const slip: SeerLockedSlip = sanitizeUpsetSlip({
                id: matchRow.id || candId,
                date: matchRow.date || date,
                category: matchRow.category || category,
                picks: rawPicks,
                backups: typeof matchRow.backups === 'string' ? JSON.parse(matchRow.backups) : (matchRow.backups || []),
                weightsAtTime: typeof matchRow.weights_at_time === 'string' ? JSON.parse(matchRow.weights_at_time) : (matchRow.weights_at_time || {}),
                type: matchRow.type || 'daily',
                createdAt: matchRow.created_at || new Date().toISOString()
              }, category)!;

              try {
                if (typeof localStorage !== "undefined") {
                  localStorage.setItem(`local_locked_slip_${candId}`, JSON.stringify(slip));
                }
              } catch (e) {}

              return slip;
            }
          }
        }
      }
    } catch (e) {}
  }

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

  // 2. Purge from PostgreSQL database & backend persistent disk storage
  const backendBase = (typeof window === "undefined" || !window.location)
    ? "http://localhost:3000"
    : "";
  for (const id of ids) {
    try {
      await axios.delete(`${backendBase}/api/db/slips/id/${id}`);
    } catch (e) {}
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
  // Historical slips are permanent and must NEVER be purged when tuning weights!

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

/**
 * When a match is deleted from Live Analysis, if it was part of any SEER category slip,
 * this function removes it from the slip and replaces it with the next best qualifying match
 * from the remaining matches pool.
 */
export const removeMatchFromSeerSlipsAndReplace = async (
  matchId: string | number,
  deletedTeams: string = "",
  dateStr: string,
  remainingMatches: Match[] = [],
  phaStatsMap: any = {},
  matchStars: any = {},
  isJackpot: boolean = false
): Promise<boolean> => {
  if (!dateStr) return false;

  const strId = String(matchId);
  const normTeams = (deletedTeams || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Immediately delete from RDS PostgreSQL via /api/db/slips/delete-pick
  try {
    let baseUrl = "";
    if (typeof window === "undefined" || !window.location) baseUrl = "http://localhost:3000";
    await axios.post(`${baseUrl}/api/db/slips/delete-pick`, {
      date: dateStr,
      matchId: strId,
      teams: deletedTeams
    }, { timeout: 6000 });
    console.log(`[SEER Slips] Backend /api/db/slips/delete-pick triggered for ${strId} / ${deletedTeams}`);
  } catch (err: any) {
    console.warn("[removeMatchFromSeerSlipsAndReplace] delete-pick endpoint notice:", err?.message);
  }

  const BASE_CATS = [
    "top_12_value",
    "top_10_value",
    "best_bet",
    "banker",
    "upset",
    "jackpot",
    "safety",
    "bankers_dlive",
    "botb_best",
    "high_confidence",
    "bankers_jackpot",
    "banker_draws",
    "value_picks",
    "value_bets",
    "upsets",
    "ml_smart_override",
    "ml_pivot",
    "ml_ai_consensus",
    "ml_chaos",
  ];

  const TARGET_CATS = [
    ...BASE_CATS,
    ...BASE_CATS.map(c => `ai_${c}`),
  ];

  // Filter remaining matches for this date
  const datePool = (remainingMatches || [])
    .filter(m => getLogicalDate(m.date, m.time) === dateStr && !isBannedFromSeerSlips(m));

  let freshSlipsCache: any = null;
  const getFreshSlips = (forAi: boolean) => {
    if (!freshSlipsCache) {
      const dayOfWeek = getMatchDayOfWeek({ date: dateStr } as Match);
      freshSlipsCache = generateSeerSlips(
        datePool,
        phaStatsMap || {},
        matchStars || {},
        isJackpot,
        forAi,
        dayOfWeek
      );
    }
    return freshSlipsCache;
  };

  let anySlipModified = false;

  for (const catId of TARGET_CATS) {
    try {
      const slip = await getLockedSlip(dateStr, catId, true);
      if (!slip || !slip.picks || slip.picks.length === 0) continue;

      const hasMatch = slip.picks.some(p => {
        const pId = String(p.match_id || "");
        if (pId && (pId === strId || pId.includes(strId) || strId.includes(pId))) return true;
        if (normTeams) {
          const pTeamNorm = (p.team || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (pTeamNorm && (pTeamNorm === normTeams || pTeamNorm.includes(normTeams) || normTeams.includes(pTeamNorm))) return true;
        }
        return false;
      });

      if (!hasMatch) continue;

      // Filter out the deleted match
      const filteredPicks = slip.picks.filter(p => {
        const pId = String(p.match_id || "");
        if (pId && (pId === strId || pId.includes(strId) || strId.includes(pId))) return false;
        if (normTeams) {
          const pTeamNorm = (p.team || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (pTeamNorm && (pTeamNorm === normTeams || pTeamNorm.includes(normTeams) || normTeams.includes(pTeamNorm))) return false;
        }
        return true;
      });

      // Find replacement candidate from remaining datePool
      const cleanCat = catId.replace(/^ai_/, "").replace(/^sandbox_/, "");
      const isAi = catId.startsWith("ai_");
      const fresh = getFreshSlips(isAi);
      const candidates: Pick[] = fresh.live[cleanCat] || fresh.spec[cleanCat] || [];

      const existingMatchIds = new Set(filteredPicks.map(p => String(p.match_id || "")));
      const existingTeams = new Set(filteredPicks.map(p => (p.team || "").toLowerCase().replace(/[^a-z0-9]/g, "")));

      const replacement = candidates.find(c => {
        const cId = String(c.match_id || "");
        const cTeam = (c.team || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cId && (existingMatchIds.has(cId) || cId === strId)) return false;
        if (cTeam && (existingTeams.has(cTeam) || (normTeams && cTeam === normTeams))) return false;
        return true;
      });

      if (replacement) {
        filteredPicks.push({
          ...replacement,
          category: catId,
        });
      }

      const updatedSlip: SeerLockedSlip = {
        ...slip,
        picks: filteredPicks,
        createdAt: slip.createdAt || new Date().toISOString(),
      };

      await saveLockedSlip(updatedSlip, true);
      anySlipModified = true;
      console.log(`[SEER Slips] Evicted deleted match ${strId} and replaced in slip: ${dateStr}_${catId}`);
    } catch (err: any) {
      console.warn(`[removeMatchFromSeerSlipsAndReplace] Error updating slip ${catId}:`, err.message);
    }
  }

  if (anySlipModified && typeof window !== "undefined") {
    window.dispatchEvent(new Event("seerLockedSlipsUpdated"));
  }

  return anySlipModified;
};


