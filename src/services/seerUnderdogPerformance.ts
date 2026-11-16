import { supabase } from "../lib/supabase";
import { Match } from "../types";
import { getActualResult, matchesPrediction, isMatchCorrectForCategory } from "../utils/matchProcessing";
import { cleanUndefined } from "../utils/dbUtils";
import LZString from "lz-string";
import axios from "axios";
import { generateSeerUnderdogSlips } from "../utils/seerUnderdogSlipSelection";
import { saveLockedSlip, SeerLockedSlip, getLockedSlip } from "./seerSlips";
import { DEFAULT_WEIGHTS, getMatchScore, predictWithSeer } from "../utils/seerLogic";
import { getMatchEvaluatorTags } from "../utils/matchEvaluator";
import { Pick } from "../components/ai/GeminiCards";

export interface DailySnapshot {
  date: string; // YYYY-MM-DD (Analysis Date)
  compressedMatches?: string;
  matches: Match[];
  updatedAt: string;
}

const DAILY_COLLECTION = "seer_performance_history";
const JACKPOT_COLLECTION = "seer_jackpot_history";

/**
 * Normalizes a date string to the "Analysis Day" based on 8 AM boundary.
 * Matches starting before 8 AM belong to the previous day's Analysis Session.
 */
export const getAnalysisDateString = (dateStr?: string | Date) => {
  // If it's a simple YYYY-MM-DD string without time, return it as is
  if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  const input = dateStr || new Date();

  if (typeof input === "string") {
    // Date string from scraper (e.g. "2026-05-30 02:00"). 
    // We assume the literal string values ARE the EAT time.
    // To extract them safely without timezone shift, parse with 'Z' and use UTC methods.
    const isoStr = input.includes(" ") ? input.replace(" ", "T") : input;
    const d = new Date(isoStr + 'Z');
    
    if (isNaN(d.getTime())) {
      // Fallback
      return getAnalysisDateString(new Date());
    }

    if (d.getUTCHours() < 9) {
      // The string contains EAT time but was parsed with 'Z', so getUTCHours() returns the EAT hour.
      // 9 means 9 AM EAT. Matches before 9 AM EAT belong to previous prediction day.
      d.setUTCDate(d.getUTCDate() - 1);
    }

    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } 
  
  // It is a Date object (e.g. new Date() or explicit timestamp).
  // These represent an absolute moment in time. We format that moment in EAT.
  const d = input as Date;
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    hourCycle: 'h23'
  });

  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  parts.forEach(p => { partMap[p.type] = p.value; });

  const eatYear = parseInt(partMap.year, 10);
  const eatMonth = parseInt(partMap.month, 10) - 1; // 0-based
  const eatDay = parseInt(partMap.day, 10);
  const eatHour = parseInt(partMap.hour, 10);

  // Re-create the EAT date purely using UTC to predictably subtract a day if needed.
  const logicalEatDate = new Date(Date.UTC(eatYear, eatMonth, eatDay, eatHour));
  
  if (eatHour < 9) {
    // Before 9 AM EAT belongs to the previous prediction day.
    logicalEatDate.setUTCDate(logicalEatDate.getUTCDate() - 1);
  }

  const resultYear = logicalEatDate.getUTCFullYear();
  const resultMonth = String(logicalEatDate.getUTCMonth() + 1).padStart(2, "0");
  const resultDay = String(logicalEatDate.getUTCDate()).padStart(2, "0");
  
  return `${resultYear}-${resultMonth}-${resultDay}`;
};

/**
 * Saves current matches into respective snapshots and locks SEER slips for the relevant dates.
 * This is the primary entry point for "deliberate checkpoints" in Seer Analysis.
 */
export const syncSeerData = async (
  matches: Match[],
  phaStatsMap: Record<string, any>,
  matchStars: Record<string, number>,
) => {
  // 1. Snapshot the performance automatically (handles cache skip inside processSnapshots)
  await updateSeerSnapshots(matches);

  // 2. Automatically build and lock SEER Slips for each date group
  if (matches.length > 0) {
    try {
      // Group by Analysis Date to ensure slips are saved for the correct "Analysis Day"
      const grouped: Record<string, Match[]> = {};
      matches.forEach((m) => {
        const date = getAnalysisDateString(m.date);
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(m);
      });

      for (const [dateStr, dateMatches] of Object.entries(grouped)) {
        // Generate slips for THIS specific date group
        const slipsObj = generateSeerUnderdogSlips(
          dateMatches,
          phaStatsMap,
          matchStars,
          false,
        );

        // Core auto-lock categories
        const TARGET_CATS = [
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
          "sandbox_best_bet",
          "sandbox_top_10_value",
          "sandbox_bankers_dlive",
          "sandbox_bankers_jackpot",
          "sandbox_value_bets",
          "sandbox_value_picks",
          "sandbox_botb_best",
          "sandbox_high_confidence",
          "sandbox_banker_draws",
          "sandbox_upsets"
        ];

        for (const catId of TARGET_CATS) {
          // Update any existing locked slip for this category/date to keep results sticky
          try {
            const existingSlip = await getLockedSlip(dateStr, catId);
            if (existingSlip) {
              let slipChanged = false;
              const updatedPicks = existingSlip.picks.map((p) => {
                const pId = p.match_id?.toString() || "";
                const pTeam = (p.team || "").toLowerCase().trim();
                const matchingM = dateMatches.find(
                  (m) => {
                    const mId = m.id?.toString() || "";
                    const mTeam = (m.teams || "").toLowerCase().trim();
                    return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || (pTeam.length > 0 && mTeam === pTeam);
                  }
                );
                if (matchingM) {
                  if (matchingM.l10 && matchingM.l10 !== p.l10) { p.l10 = matchingM.l10; slipChanged = true; }
                  if (matchingM.gs && matchingM.gs !== p.gs) { p.gs = matchingM.gs; slipChanged = true; }
                  if (matchingM.ga && matchingM.ga !== p.ga) { p.ga = matchingM.ga; slipChanged = true; }
                  if (matchingM.le && matchingM.le !== p.le) { p.le = matchingM.le; slipChanged = true; }
                  if (matchingM.mo && matchingM.mo !== p.odds) { p.odds = matchingM.mo; slipChanged = true; }
                  if (matchingM.rating && matchingM.rating !== p.rating) { p.rating = matchingM.rating; slipChanged = true; }
                  const actual = getActualResult(matchingM.result);
                  if (actual && actual !== "pending") {
                    const outcome: "Pending" | "Correct" | "Incorrect" = isMatchCorrectForCategory(matchingM, p.prediction, actual, catId) ? "Correct" : "Incorrect";
                    if (p.actualResult !== actual || p.outcome !== outcome) {
                      slipChanged = true;
                      return {
                        ...p,
                        actualResult: actual,
                        outcome: outcome,
                      };
                    }
                  }
                }
                return p;
              });

              if (slipChanged) {
                const updatedSlip = {
                  ...existingSlip,
                  picks: updatedPicks,
                  createdAt: existingSlip.createdAt || new Date().toISOString(),
                };
                await saveLockedSlip(updatedSlip, true); // Force overwrite to true
                console.log(`Updated results inside existing locked slip: ${dateStr}_${catId}`);
              }
            }
          } catch (slipErr) {
            console.error(`Failed to update existing locked slip ${dateStr}_${catId}:`, slipErr);
          }

          // Check both live (Daily) and spec (Specialty/Jackpot) slips
          let picks = slipsObj.live[catId] || slipsObj.spec[catId];

          if (!picks || picks.length === 0) {
            if (["banker", "upset", "jackpot", "safety"].includes(catId)) {
              const catConf = {
                banker: { targetTags: ["bankers_jackpot", "bankers_dlive"], minSeer: 33 },
                upset: { targetTags: ["upsets", "value_bets"], minSeer: 25 },
                jackpot: { targetTags: ["bankers_jackpot", "top10"], minSeer: 30 },
                safety: { targetTags: ["best_bet"], minSeer: 35 }
              }[catId as "banker" | "upset" | "jackpot" | "safety"];

              if (catConf) {
                const getMatchDetails = (m: Match) => {
                  const tags = getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
                  const hardBans = tags.filter(
                    (t) => t.startsWith("BANNED:") && t !== "PHA_TIE",
                  );
                  const hasHardBan = hardBans.length > 0;
                  const hasPhaTie = tags.includes("PHA_TIE");

                  const p1 = getMatchScore(m, "1", DEFAULT_WEIGHTS, phaStatsMap, matchStars);
                  const p2 = getMatchScore(m, "2", DEFAULT_WEIGHTS, phaStatsMap, matchStars);
                  const isBanker = tags.some(
                    (t) => t.includes("bankers") || t.includes("jackpot"),
                  );
                  const isUpset = tags.some(
                    (t) => t.includes("upsets") || t.includes("value_bets"),
                  );

                  let conflictRes = "none";
                  if (isBanker && isUpset) {
                    conflictRes = p1 > p2 ? "banker_win" : "upset_win";
                  }

                  return {
                    tags,
                    hasHardBan,
                    hasPhaTie,
                    p1,
                    p2,
                    isBanker,
                    isUpset,
                    conflictRes,
                  };
                };

                const filtered = dateMatches.filter((m) => {
                  const details = getMatchDetails(m);
                  if (details.hasHardBan) return false;

                  const matchesCategory = catConf.targetTags.some((tt) =>
                    details.tags.some((t) => t.includes(tt)),
                  );
                  if (!matchesCategory) return false;

                  // Resolve Banker/Upset conflicts
                  if (catId === "banker" && details.conflictRes === "upset_win")
                    return false;
                  if (catId === "upset" && details.conflictRes === "banker_win")
                    return false;

                  const score = Math.max(
                    details.p1,
                    details.p2,
                    getMatchScore(m, "X", DEFAULT_WEIGHTS, phaStatsMap, matchStars),
                  );
                  return score >= catConf.minSeer;
                });

                // Sort recommended by Seer Score + PHA Tie penalty
                filtered.sort((a, b) => {
                  const detA = getMatchDetails(a);
                  const detB = getMatchDetails(b);
                  const scoreA =
                    Math.max(detA.p1, detA.p2) - (detA.hasPhaTie ? 100 : 0);
                  const scoreB =
                    Math.max(detB.p1, detB.p2) - (detB.hasPhaTie ? 100 : 0);
                  return scoreB - scoreA;
                });

                picks = filtered.map((m) => ({
                  match_id: m.id,
                  team: m.teams,
                  prediction: predictWithSeer(
                    m,
                    DEFAULT_WEIGHTS,
                    phaStatsMap,
                    matchStars,
                    catId,
                  ),
                  odds: m.mo?.split(",")[0] || "1.0",
                  reason: "Locked Selection",
                  confidence: "100%",
                  category: catId,
                }));
              }
            }
          }

          if (picks && picks.length > 0) {
            const slip: SeerLockedSlip = {
              id: `${dateStr}_${catId}`,
              date: dateStr,
              category: catId,
              picks: picks,
              backups: [],
              weightsAtTime: DEFAULT_WEIGHTS,
              createdAt: new Date().toISOString(),
              type: dateMatches.some((m) => m.isJackpot) ? "jackpot" : "daily",
            };
            // Auto-lock removed to allow manual selection and keep deleted slips unlocked
          }
        }
      }
    } catch (e) {
      console.error("Background Seer Slip locking failed:", e);
    }
  }
};

/**
 * Saves current matches into respective snapshots based on whether they are Daily or Jackpot.
 */
export const updateSeerSnapshots = async (matches: Match[]) => {
  if (matches.length === 0) return;

  const dailyMatches = matches.filter(
    (m) => m.isDaily || (!m.isJackpot && !m.isDaily),
  ); // Default to daily if no flag
  const jackpotMatches = matches.filter((m) => m.isJackpot);

  if (dailyMatches.length > 0) {
    await processSnapshots(dailyMatches, DAILY_COLLECTION);
  }

  if (jackpotMatches.length > 0) {
    await processSnapshots(jackpotMatches, JACKPOT_COLLECTION);
  }
};

const processSnapshots = async (matches: Match[], collectionName: string) => {
  // Group matches by their respective analysis dates
  const groupedByDate: Record<string, Match[]> = {};
  matches.forEach((m) => {
    const analysisDate = m.date
      ? getAnalysisDateString(m.date)
      : getAnalysisDateString();
    if (!groupedByDate[analysisDate]) groupedByDate[analysisDate] = [];
    groupedByDate[analysisDate].push(m);
  });

  // Calculate the exact last 11 days (today + last 10 days) using the timezone-safe formula
  const todayAnalysis = getAnalysisDateString();
  const year = parseInt(todayAnalysis.split("-")[0]);
  const month = parseInt(todayAnalysis.split("-")[1]) - 1;
  const day = parseInt(todayAnalysis.split("-")[2]);

  const baseDate = new Date(year, month, day);
  const last11Days: string[] = [];
  for (let i = 0; i < 11; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - i);
    last11Days.push(
      d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0"),
    );
  }

  for (const [dateStr, dailyMatches] of Object.entries(groupedByDate)) {
    // Only track if it's within our 11-day window
    if (!last11Days.includes(dateStr)) continue;

    const cacheKey = `seer_hash_${collectionName}_${dateStr}`;
    const localCompressed = LZString.compressToUTF16(
      JSON.stringify(dailyMatches),
    );

    // Save to localStorage as a reliable fallback first, so we always have it locally
    const snapshotDataL = cleanUndefined({
      date: dateStr,
      compressedMatches: localCompressed,
      updatedAt: new Date().toISOString(),
    });
    try {
      localStorage.setItem(`local_seer_snapshot_${collectionName}_${dateStr}`, JSON.stringify(snapshotDataL));
    } catch (e) {
      console.warn("localStorage snapshot write failed", e);
    }

    // If local matches haven't changed since last time we checked, skip completely (Save READs & WRITEs)
    if (sessionStorage.getItem(cacheKey) === localCompressed) {
      continue;
    }

    try {
      const existing = await getDailySeerSnapshot(dateStr, collectionName);

      let mergedMatches = dailyMatches;
      if (existing) {
        const dailyIds = new Set(dailyMatches.map((m) => m.id.toString()));
        mergedMatches = [
          ...dailyMatches,
          ...existing.matches.filter((m) => !dailyIds.has(m.id.toString())),
        ];
      }

      const finalCompressed = LZString.compressToUTF16(
        JSON.stringify(mergedMatches),
      );

      // Store merged in localStorage too
      const mergedSnapshotData = cleanUndefined({
        date: dateStr,
        compressedMatches: finalCompressed,
        updatedAt: new Date().toISOString(),
      });
      try {
        localStorage.setItem(`local_seer_snapshot_${collectionName}_${dateStr}`, JSON.stringify(mergedSnapshotData));
      } catch (e) {}

      try {
        let storageUrl = `/api/storage/save`;
        if (typeof window === "undefined" || !window.location) {
          storageUrl = `http://localhost:3000/api/storage/save`;
        }
        await axios.post(storageUrl, {
          key: `snapshot_${collectionName}_${dateStr}`,
          data: mergedSnapshotData,
        });
      } catch (e) {}

      // If the data in DB is exactly what we are about to save, skip write (Save WRITEs)
      if (existing && existing.compressedMatches === finalCompressed) {
        sessionStorage.setItem(cacheKey, localCompressed);
        continue;
      }

      const snapshotData = {
        date: dateStr,
        compressed_matches: finalCompressed,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from(collectionName)
        .upsert(snapshotData, { onConflict: "date" });

      if (error) {
        throw error;
      }

      // Invalidate the performance cache so that the trend calculations are re-run on next load with updated matches
      await invalidatePerformanceCache(dateStr, collectionName);

      sessionStorage.setItem(cacheKey, localCompressed);
    } catch (err: any) {
      console.warn(`Supabase snapshot processing failed for date ${dateStr}. Matches still preserved in localStorage fallback.`, err);
    }
  }
};

/**
 * Invalidates the cached performance trend entries for a specific day and type
 * to ensure that subsequent loads recalculate the values from the updated matches.
 */
export const invalidatePerformanceCache = async (date: string, collection: string) => {
  try {
    // 1. Delete from Supabase cache table
    const { error } = await supabase
      .from("seer_performance_cache")
      .delete()
      .eq("collection", collection)
      .eq("date", date);

    if (error) {
      throw error;
    }
  } catch (e) {
    console.warn(`Failed to delete performance cache from Supabase for date ${date}:`, e);
  }

  try {
    // 2. Clear from localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`local_seer_perf_cache_${collection}_`) && key.endsWith(`_${date}`)) {
        localStorage.removeItem(key);
        // decrement index as length decreases on deletion
        i--;
      }
    }
  } catch (e) {
    console.warn(`Failed to delete local performance cache for date ${date}:`, e);
  }
};

/**
 * Retrieves a snapshot for a specific day and type.
 */
export const getDailySeerSnapshot = async (
  date: string,
  collectionName: string = DAILY_COLLECTION,
  forceRefresh = false
): Promise<DailySnapshot | null> => {
  if (!forceRefresh) {
    try {
      const localVal = localStorage.getItem(`local_seer_snapshot_${collectionName}_${date}`);
      if (localVal) {
        const data = JSON.parse(localVal);
        if (data.compressedMatches) {
          try {
            const decompressed = LZString.decompressFromUTF16(data.compressedMatches);
            data.matches = decompressed ? JSON.parse(decompressed) : [];
            return data;
          } catch (e) {}
        } else if (Array.isArray(data.matches)) {
          return data;
        }
      }
    } catch (e) {}
  }

  // 1. Try reading from Backend persistent storage API
  try {
    let url = `/api/storage/load/snapshot_${collectionName}_${date}`;
    if (typeof window === "undefined" || !window.location) {
      url = `http://localhost:3000/api/storage/load/snapshot_${collectionName}_${date}`;
    }
    const res = await axios.get(url);
    if (res.data && (res.data.compressedMatches || res.data.matches)) {
      const data: DailySnapshot = res.data;
      if (data.compressedMatches) {
        try {
          const decompressed = LZString.decompressFromUTF16(data.compressedMatches);
          data.matches = decompressed ? JSON.parse(decompressed) : [];
        } catch (e) {
          data.matches = [];
        }
      } else {
        data.matches = Array.isArray(data.matches) ? data.matches : [];
      }
      try {
        localStorage.setItem(`local_seer_snapshot_${collectionName}_${date}`, JSON.stringify(data));
      } catch (e) {}
      return data;
    }
  } catch (e) {}

  // 1.5. Try reading from Supabase first
  try {
    const { data: dbData, error } = await supabase
      .from(collectionName)
      .select("*")
      .eq("date", date)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (dbData) {
      const data: DailySnapshot = {
        date: dbData.date,
        compressedMatches: dbData.compressed_matches,
        matches: [],
        updatedAt: dbData.updated_at || new Date().toISOString(),
      };

      // Sync with localStorage
      try {
        localStorage.setItem(`local_seer_snapshot_${collectionName}_${date}`, JSON.stringify(data));
      } catch (e) {}

      if (data.compressedMatches) {
        try {
          data.matches = JSON.parse(
            LZString.decompressFromUTF16(data.compressedMatches) || "[]",
          );
        } catch (e) {
          console.error("Failed to parse compressed matches", e);
          data.matches = [];
        }
      }
      return data;
    }
  } catch (error: any) {
    console.warn(`Supabase getDailySeerSnapshot failed for ${date} in ${collectionName}. Falling back to localStorage.`, error);
  }

  // 2. Check localStorage fallback if Supabase query failed or returned no data
  try {
    const localVal = localStorage.getItem(`local_seer_snapshot_${collectionName}_${date}`);
    if (localVal) {
      const data = JSON.parse(localVal) as DailySnapshot;
      if (data.compressedMatches) {
        try {
          data.matches = JSON.parse(
            LZString.decompressFromUTF16(data.compressedMatches) || "[]",
          );
        } catch (e) {
          console.error("Failed to parse compressed matches from localStorage", e);
          data.matches = [];
        }
      } else if (!data.matches) {
        data.matches = [];
      }
      return data;
    }
  } catch (e) {
    console.error("Failed to read snapshot from localStorage", e);
  }
  return null;
};

/**
 * Deletes a snapshot for a specific day and type.
 */
export const deleteDailySeerSnapshot = async (
  date: string,
  collectionName: string = DAILY_COLLECTION,
) => {
  try {
    localStorage.removeItem(`local_seer_snapshot_${collectionName}_${date}`);
  } catch (e) {}

  try {
    const { error } = await supabase
      .from(collectionName)
      .delete()
      .eq("date", date);

    if (error) {
      throw error;
    }

    console.log(`Deleted Seer snapshot for ${date} in ${collectionName}`);
  } catch (error: any) {
    console.warn(`Supabase deleteDailySeerSnapshot failed.`, error);
  }
};

/**
 * Removes a specific match from a snapshot.
 */
export const removeMatchFromSeerSnapshot = async (
  matchId: number | string,
  dateStr: string,
  collectionName: string = DAILY_COLLECTION,
) => {
  try {
    const existing = await getDailySeerSnapshot(dateStr, collectionName);
    if (existing && existing.matches) {
      const updatedMatches = existing.matches.filter(
        (m) => m.id.toString() !== matchId.toString(),
      );
      
      const compressed = LZString.compressToUTF16(
        JSON.stringify(updatedMatches),
      );

      // Local write
      try {
        localStorage.setItem(
          `local_seer_snapshot_${collectionName}_${dateStr}`,
          JSON.stringify({
            date: dateStr,
            compressedMatches: compressed,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch (e) {}

      // Supabase write
      const { error } = await supabase
        .from(collectionName)
        .upsert({
          date: existing.date,
          compressed_matches: compressed,
          updated_at: new Date().toISOString(),
         }, { onConflict: "date" });

      if (error) {
        throw error;
      }
    }
  } catch (error: any) {
    console.warn(`Supabase removeMatchFromSeerSnapshot failed. Saved locally.`, error);
  }
};

/**
 * Cleanup function to remove snapshots older than 10 days.
 */
export const getSeerPerformanceCache = async (
  date: string,
  category: string,
  collection: string,
): Promise<{ accuracy: number; goalAccuracy?: number; aiAccuracy?: number; aiGoalAccuracy?: number } | null> => {
  const cacheKey = `local_seer_perf_cache_${collection}_${category}_${date}`;

  // 1. Try local storage first for speed
  try {
    const localCached = localStorage.getItem(cacheKey);
    if (localCached) {
      return JSON.parse(localCached);
    }
  } catch (e) {}

  // 2. Try loading from Backend persistent storage API
  try {
    let url = `/api/storage/load/perf_cache_${collection}_${category}_${date}`;
    if (typeof window === "undefined" || !window.location) {
      url = `http://localhost:3000/api/storage/load/perf_cache_${collection}_${category}_${date}`;
    }
    const res = await axios.get(url);
    if (res.data && typeof res.data.accuracy === "number") {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(res.data));
      } catch (e) {}
      return res.data;
    }
  } catch (e) {}

  // 3. Try reading from Supabase cache
  try {
    const id = `${collection}_${category}_${date}`;
    const { data, error } = await supabase
      .from("seer_performance_cache")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      const result = { accuracy: Number(data.accuracy), goalAccuracy: Number(data.goal_accuracy) };
      try {
        localStorage.setItem(cacheKey, JSON.stringify(result));
      } catch (e) {}
      return result;
    }
  } catch (e) {
    console.warn("Supabase getSeerPerformanceCache failed, falling back to local:", e);
  }

  return null;
};

export const saveSeerPerformanceCache = async (
  date: string,
  category: string,
  collection: string,
  accuracy: number,
  goalAccuracy?: number,
  aiAccuracy?: number,
  aiGoalAccuracy?: number,
) => {
  const cacheKey = `local_seer_perf_cache_${collection}_${category}_${date}`;
  const result = { 
    accuracy, 
    goalAccuracy: goalAccuracy ?? accuracy,
    aiAccuracy,
    aiGoalAccuracy
  };
  try {
    localStorage.setItem(cacheKey, JSON.stringify(result));
  } catch (e) {}

  try {
    let storageUrl = `/api/storage/save`;
    if (typeof window === "undefined" || !window.location) {
      storageUrl = `http://localhost:3000/api/storage/save`;
    }
    await axios.post(storageUrl, {
      key: `perf_cache_${collection}_${category}_${date}`,
      data: result,
    });
  } catch (e) {}

  try {
    const id = `${collection}_${category}_${date}`;
    const { error } = await supabase
      .from("seer_performance_cache")
      .upsert({ 
        id,
        collection,
        category,
        date,
        accuracy, 
        goal_accuracy: goalAccuracy ?? accuracy, 
        saved_at: new Date().toISOString() 
      }, { onConflict: "id" });

    if (error) {
      throw error;
    }
  } catch (e) {
    console.error("Failed to save performance cache", e);
  }
};

export const cleanupOldSeerSnapshots = async () => {
  await cleanupCollection(DAILY_COLLECTION);
  await cleanupCollection(JACKPOT_COLLECTION);
};

const cleanupCollection = async (collectionName: string) => {
  try {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const tenDaysAgoStr = tenDaysAgo.toISOString().split("T")[0];

    // Supabase standard delete using comparison operator (lt)
    const { error, count } = await supabase
      .from(collectionName)
      .delete()
      .lt("date", tenDaysAgoStr);

    if (error) {
      throw error;
    }

    if (count) {
      console.log(`Cleaned up ${count} old Seer snapshots from ${collectionName}.`);
    }
  } catch (error: any) {
    console.warn(`Supabase cleanupCollection failed for ${collectionName}:`, error.message || error);
  }
};
