import React, { useState, useMemo, useEffect, useRef } from "react";
import LZString from "lz-string";
import { Match } from "../types";
import { supabase } from "../lib/supabase";
import { deduplicateMatches } from "../utils/storageUtils";
import {
  PlayCircle,
  Award,
  Target,
  ListOrdered,
  Brain,
  Database,
   RefreshCw,
  Eye,
  CheckCircle2,
  XCircle,
  Settings2,
  BarChart2,
  Zap,
  ArrowRight,
  Search,
  Trash2,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Flame,
  Loader2,
  ShieldAlert,
  Shield,
  BookOpen,
  Lightbulb,
  Globe,
} from "lucide-react";
import { getMatchCountryAndLeague } from "../utils/opwCommon";
import {
  getMatchEvaluatorTags,
  MatchCategory,
  evaluateMatchCategory,
  getMatchStats,
} from "../utils/matchEvaluator";
import { getActualResult, matchesPrediction, getFavoriteAndUnderdog, isMatchCorrectForCategory, isMatchGoalAccurate, calculatePAAPrediction, getLogicalDate } from "../utils/matchProcessing";
import { useMatchStars, getMatchMaxStars } from "../utils/matchStars";
import {
  CategoryWeights,
  DEFAULT_WEIGHTS,
  getMatchScore,
  predictWithSeer,
} from "../utils/seerLogic";
import { predictWithHybridML } from "../utils/hybridMachineLearning";
import { useMLMatrix } from "../context/MLMatrixContext";
import { L10Display } from "../utils/l10Utils";

import { getSeerWeights, saveSeerWeights } from "../services/storage";
import { generateSeerSlips } from "../utils/seerSlipSelection";
import { getOptimalHedge } from "../utils/volatilityEngine";
import { isBannedFromSeerSlips } from "../utils/leagueFilters";
import { getMatchSupremeTierUnderdog } from "../utils/seerSupremeTier";
import {
  updateSeerSnapshots,
  syncSeerData,
  getDailySeerSnapshot,
  cleanupOldSeerSnapshots,
  getAnalysisDateString,
  deleteDailySeerSnapshot,
  DailySnapshot,
  getSeerPerformanceCache,
  saveSeerPerformanceCache,
} from "../services/seerPerformance";
import { OPTIMIZED_CATEGORY_SETTINGS, replaceAllOptimizedCategorySettings, getOptimizedScoreDetailed, getOptimizedScore, applyHedgingProtocol, getMatchDayOfWeek, clearOptimizedScoreCache, loadServerOpwRules } from "../utils/optimizedweights";

// At the top level inside SeerAnalysis, add this useEffect:
import {
  getLockedSlip,
  getLockedSlipsForDate,
  saveLockedSlip,
  saveLockedSlipsBulk,
  deleteLockedSlip,
  getCategoryAliases,
  SeerLockedSlip,
  SESSION_SLIP_CACHE,
} from "../services/seerSlips";
export { SESSION_SLIP_CACHE };
import { runAiOptimizer, OptimizationRecommendation } from "../utils/aiOptimizer";
import { selectSlipsWithAI, runSelfLearnReflectiveCycle, SelfLearnLesson } from "./ai/GeminiEngine";
import { generateSeerAiCognitiveSlips, ensureHedgedPrediction, hasCategoryTag } from "../utils/seerAiSlipSelection";
import { Pick as AiPick } from "./ai/GeminiCards";
import { Calendar } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import OptimizedWeightsSettingsModal from "./OptimizedWeightsSettingsModal";
import OptimizedWeightsModal from "./OptimizedWeightsModal";

interface Props {
  historicalMatches: Match[];
  liveMatches: Match[];
  phaStatsMap: Record<string, any>;
}

interface PerformancePoint {
  date: string;
  accuracy: number;
  goalAccuracy?: number;
  aiAccuracy?: number;
  aiGoalAccuracy?: number;
}

interface Recommendation {
  id: string;
  finding: string;
  deepInsights?: string[];
  action: string;
  baseWeights: CategoryWeights;
  proposedWeights: CategoryWeights;
  isTested: boolean;
  subsetAcc?: number;
  subsetGoalAcc?: number;
  testResult?: {
    prevAcc: number;
    newAcc: number;
    approved: boolean;
    prevGoalAcc?: number;
    newGoalAcc?: number;
  };
}


const _getPAAPrediction = (m: Match, phaMap: Record<string, any>): string => {
  let paaPrim = m.paaPrimaryPrediction;
  let paaFinal = m.paaPrediction;
  if (m.patternAnalysis?.subPattern && phaMap) {
    const sub = m.patternAnalysis.subPattern;
    if (phaMap[sub] && (phaMap[sub].paaTotal > 0 || phaMap[sub].total > 0)) {
      const paaPred = calculatePAAPrediction(m, phaMap[sub]);
      if (paaPred) {
        paaPrim = paaPred.paaPrimaryPrediction;
        paaFinal = paaPred.paaPrediction;
      }
    }
  }
  return paaFinal || paaPrim || "-";
};

const _getAlgoPrediction = (m: Match): string => {
  // Use algo final prediction, falling back to primary prediction, then sub-pattern prediction, then raw prediction
  const pred = m.algoReport?.prediction
    || m.algoReport?.primaryPrediction
    || m.patternAnalysis?.subPatternPrediction
    || m.rawPrediction
    || '-';
  return pred;
};

const EMPTY_MATCHES: Match[] = [];

const getCategoryShortLabel = (catId: string): string => {
  switch (catId) {
    case 'top_12_value':
    case 'top_10_value':
    case 'top12':
    case 'top10':
      return 'T12';
    case 'best_bet':
    case 'best':
      return 'BB';
    case 'bankers_dlive':
    case 'banker':
      return 'BD';
    case 'botb_best':
      return 'BOTB';
    case 'high_confidence':
    case 'top20':
      return 'T20';
    case 'bankers_jackpot':
    case 'bankers':
    case 'jackpot':
      return 'BJ';
    case 'banker_draws':
    case 'bankers_draws':
    case 'banker_draw':
      return 'BDRAW';
    case 'value_picks':
    case 'sandbox_value_picks':
      return 'VP';
    case 'value_bets':
    case 'value_bet':
      return 'VB';
    case 'upsets':
    case 'upset':
    case 'sandbox_upsets':
      return 'UPS';
    case 'ml_smart_override':
      return 'ML:SO';
    case 'ml_pivot':
      return 'ML:PV';
    case 'ml_ai_consensus':
      return 'ML:AI';
    case 'ml_chaos':
      return 'ML:CH';
    default:
      return catId.toUpperCase();
  }
};

const NON_UPSET_OPW_CATEGORIES: { tagPrefix: string; catId: string }[] = [
  { tagPrefix: 'top12:', catId: 'top_12_value' },
  { tagPrefix: 'top_12_value:', catId: 'top_12_value' },
  { tagPrefix: 'top10:', catId: 'top_12_value' },
  { tagPrefix: 'best_bet:', catId: 'best_bet' },
  { tagPrefix: 'bankers_dlive:', catId: 'bankers_dlive' },
  { tagPrefix: 'bankers_jackpot:', catId: 'bankers_jackpot' },
  { tagPrefix: 'value_picks:', catId: 'value_picks' },
  { tagPrefix: 'value_bets:', catId: 'value_bets' },
];

const resolveTop20SourceCat = (
  match: any,
  matchTags: string[],
  idx: number,
  baseCat: string
): string => {
  if (baseCat !== 'high_confidence' && baseCat !== 'top20') return baseCat;
  const srcCat = match?.sourceCategory;
  if (srcCat && srcCat !== 'high_confidence' && srcCat !== 'top20') {
    return srcCat === 'top_10_value' ? 'top_12_value' : srcCat;
  }
  const hasTop12 = matchTags.some((t: string) => t.startsWith('top12:') || t.startsWith('top10:') || t.startsWith('top_12_value:'));
  const hasBD = matchTags.some((t: string) => t.startsWith('bankers_dlive:'));
  const hasBJ = matchTags.some((t: string) => t.startsWith('bankers_jackpot:'));
  if (idx < 10 && hasTop12) return 'top_12_value';
  if (hasBD) return 'bankers_dlive';
  if (hasBJ) return 'bankers_jackpot';
  if (hasTop12) return 'top_12_value';
  return 'top_12_value';
};

const getHighestOtherOpwScore = (
  match: Match,
  matchTags: string[],
  phaStatsMap: Record<string, any> | undefined,
  matchDay?: string
) => {
  if (!phaStatsMap) return null;
  const seenCatIds = new Set<string>();
  let best: { catId: string; score: ReturnType<typeof getOptimizedScoreDetailed> } | null = null;
  for (const { tagPrefix, catId } of NON_UPSET_OPW_CATEGORIES) {
    if (seenCatIds.has(catId)) continue;
    if (!matchTags.some((t: string) => t.startsWith(tagPrefix))) continue;
    seenCatIds.add(catId);
    const score = getOptimizedScoreDetailed(match, catId, phaStatsMap, matchDay);
    if (score && (!best || score.totalScore > best.score.totalScore)) {
      best = { catId, score };
    }
  }
  return best;
};

export default function SeerAnalysis({
  historicalMatches,
  liveMatches,
  phaStatsMap,
}: Props) {
  const { mlData } = useMLMatrix();
  const [activeTab, setActiveTab] = useState<
    "learn" | "test" | "slips" | "stats" | "optimized"
  >("learn");

  const [selectedCategory, setSelectedCategory] =
    useState<string>("top_12_value");
  const [owSettingsCategory, setOwSettingsCategory] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [learningProgress, setLearningProgress] = useState(0);
  const [learningStatus, setLearningStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpwFilterActive, setIsOpwFilterActive] = useState(false);
  const [categoryWeightsMap, setCategoryWeightsMap] = useState<
    Record<string, CategoryWeights>
  >(() => getSeerWeights());
  const [isSlipsLoading, setIsSlipsLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<PerformancePoint[]>([]);
  const [dowStats, setDowStats] = useState<any[]>([]);
  const [isFetchingStats, setIsFetchingStats] = useState(false);
  const [latestSnapshotMatches, setLatestSnapshotMatches] = useState<Match[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [todayStr, setTodayStr] = useState<string>(() => getAnalysisDateString());
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const defaultDate = getAnalysisDateString();
    if (liveMatches && liveMatches.length > 0) {
      const hasDefaultDate = liveMatches.some(m => getLogicalDate(m.date, m.time) === defaultDate);
      if (!hasDefaultDate) {
        const validDates = Array.from(new Set(liveMatches.map(m => getLogicalDate(m.date, m.time)).filter(Boolean))).sort().reverse();
        if (validDates.length > 0) return validDates[0];
      }
    }
    return defaultDate;
  });
  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  // If selectedDate is todayStr (no matches uploaded for today yet) while liveMatches are loaded for a recent date (e.g. yesterday's slate after 9:00 AM rollover), automatically align selectedDate to the active liveMatches date
  useEffect(() => {
    if (liveMatches && liveMatches.length > 0 && selectedDate === todayStr) {
      const hasMatchesForSelected = liveMatches.some(m => getLogicalDate(m.date, m.time) === selectedDate);
      if (!hasMatchesForSelected) {
        const validDates = Array.from(new Set(liveMatches.map(m => getLogicalDate(m.date, m.time)).filter(Boolean))).sort().reverse();
        if (validDates.length > 0 && validDates[0] !== selectedDate) {
          setSelectedDate(validDates[0]);
        }
      }
    }
  }, [liveMatches, todayStr]);

  const currentDayOfWeek = useMemo(() => getMatchDayOfWeek({ date: selectedDate } as Match), [selectedDate]);
  const [historyType, setHistoryType] = useState<"daily" | "jackpot">("daily");

  const categoriesList: { id: string; label: string; maxPicks: number }[] = [
    { id: "all", label: "All Categories", maxPicks: 10 },
    { id: "top_12_value", label: "Top 12", maxPicks: 12 },
    { id: "best_bet", label: "Best Bet", maxPicks: 10 },
    { id: "bankers_dlive", label: "Bankers Dlive", maxPicks: 10 },
    { id: "botb_best", label: "BOTB", maxPicks: 10 },
    { id: "high_confidence", label: "Top 20", maxPicks: 20 },
    { id: "bankers_jackpot", label: "Bankers Jackpot", maxPicks: 5 },
    { id: "banker_draws", label: "Banker Draws", maxPicks: 5 },
    { id: "value_picks", label: "Value Picks", maxPicks: 5 },
    { id: "value_bets", label: "Value Bets", maxPicks: 5 },
    { id: "upsets", label: "Upsets", maxPicks: 5 },
    { id: "ml_smart_override", label: "ML: Smart Override", maxPicks: 20 },
    { id: "ml_pivot", label: "ML: Pivot Engine", maxPicks: 20 },
    { id: "ml_ai_consensus", label: "ML: AI Consensus Lock", maxPicks: 20 },
    { id: "ml_chaos", label: "ML: Chaos Theory Engine", maxPicks: 20 },
  ];

  const [lockedSlips, setLockedSlips] = useState<Record<string, SeerLockedSlip>>({});
  const [lockedAiSlips, setLockedAiSlips] = useState<Record<string, SeerLockedSlip>>({});
  const [isLocking, setIsLocking] = useState<Record<string, boolean>>({});
  const autoLockOnPropagateRef = useRef<Record<string, boolean>>({});
  const activeLockedSlips = activeTab === "slips" ? lockedAiSlips : lockedSlips;
  const setActiveLockedSlips = activeTab === "slips" ? setLockedAiSlips : setLockedSlips;
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [owModalMatch, setOwModalMatch] = useState<{ match: Match; catId: string; lockedScore?: any } | null>(null);
  const [testMatchesPage, setTestMatchesPage] = useState(1);
  const TEST_PAGE_SIZE = 30;

  useEffect(() => {
    setTestMatchesPage(1);
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    let updateTimer: any = null;
    const handleUpdate = (e?: any) => {
      clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        fallbackGeneratedSlipsRef.current = null;
        const savedWeights = getSeerWeights();
        if (Object.keys(savedWeights).length > 0) {
          setCategoryWeightsMap(savedWeights);
        }

        // Only purge/delete slips if explicitly requested via wipeSlips or purge flag
        const isPurgeRequested = e?.detail?.wipeSlips === true || e?.detail?.purge === true;
        (matches || []).forEach(m => { delete (m as any).lockedOpwScores; });
        if (!isPurgeRequested) {
          SESSION_SLIP_CACHE.clear();
          clearOptimizedScoreCache();
          if (e?.detail?.refreshLocked) {
            const updatedCat = e?.detail?.category;
            const catsToRefresh = (updatedCat && updatedCat !== 'all')
              ? ((updatedCat === 'top_12_value' || updatedCat === 'top_10_value')
                  ? ['top_12_value', 'top_10_value', 'botb_best', 'high_confidence']
                  : (updatedCat === 'best_bet' || updatedCat === 'bankers_dlive' || updatedCat === 'bankers_jackpot')
                  ? [updatedCat, 'botb_best', 'high_confidence']
                  : (updatedCat === 'upsets' || updatedCat === 'upset')
                  ? ['upsets', 'upset']
                  : (updatedCat === 'value_bets' || updatedCat === 'value_bet')
                  ? ['value_bets', 'value_bet']
                  : [updatedCat])
              : null;
            if (catsToRefresh && catsToRefresh.length > 0) {
              setLockedSlips((prev) => {
                const next = { ...prev };
                catsToRefresh.forEach(c => delete next[c]);
                return next;
              });
              setLockedAiSlips((prev) => {
                const next = { ...prev };
                catsToRefresh.forEach(c => delete next[c]);
                return next;
              });
            }
          }
          setReloadTrigger((p) => p + 1);
          return;
        }

        const updatedCat = e?.detail?.category;
        const allCategoryIds = categoriesList.map(c => c.id).filter(c => c !== "all");
        const catsToPurge = (updatedCat && updatedCat !== 'all')
          ? ((updatedCat === 'top_12_value' || updatedCat === 'top_10_value')
              ? ['top_12_value', 'top_10_value']
              : (updatedCat === 'upsets' || updatedCat === 'upset')
              ? ['upsets', 'upset']
              : [updatedCat])
          : allCategoryIds;

        const targetDatesToPurge = new Set<string>();
        if (e?.detail?.allDates && Array.isArray(e.detail.allDates)) {
          e.detail.allDates.forEach((d: string) => targetDatesToPurge.add(d));
        }
        if (e?.detail?.targetDate) targetDatesToPurge.add(e.detail.targetDate);
        if (e?.detail?.date) targetDatesToPurge.add(e.detail.date);
        if (selectedDateRef.current) targetDatesToPurge.add(selectedDateRef.current);
        if (todayStr) targetDatesToPurge.add(todayStr);

        targetDatesToPurge.forEach(d => {
          catsToPurge.forEach(c => {
            deleteLockedSlip(d, c).catch(err => console.warn(`Error deleting locked slip for ${d} ${c}:`, err));
          });
          SESSION_SLIP_CACHE.delete(`${d}_daily`);
          SESSION_SLIP_CACHE.delete(`${d}_jackpot`);
        });

        setLockedSlips((prev) => {
          const next = { ...prev };
          catsToPurge.forEach(c => delete next[c]);
          return next;
        });
        setLockedAiSlips((prev) => {
          const next = { ...prev };
          catsToPurge.forEach(c => delete next[c]);
          return next;
        });
        clearOptimizedScoreCache();
        setReloadTrigger((p) => p + 1);
      }, 100);
    };
    window.addEventListener("seerLockedSlipsUpdated", handleUpdate);
    window.addEventListener("optimizedWeightsUpdated", handleUpdate);
    window.addEventListener("opwProtectedGuardsUpdated", handleUpdate);
    window.addEventListener("opw-weights-updated", handleUpdate);
    loadServerOpwRules(false).then(days => {
      if (days && days.length > 0) {
        clearOptimizedScoreCache();
        setReloadTrigger((p) => p + 1);
      }
    });
    return () => {
      clearTimeout(updateTimer);
      window.removeEventListener("seerLockedSlipsUpdated", handleUpdate);
      window.removeEventListener("optimizedWeightsUpdated", handleUpdate);
      window.removeEventListener("opwProtectedGuardsUpdated", handleUpdate);
      window.removeEventListener("opw-weights-updated", handleUpdate);
    };
  }, []);

  const [historicalSnapshot, setHistoricalSnapshot] = useState<Match[] | null>(
    null,
  );
  const matchesToProcess = historicalSnapshot || EMPTY_MATCHES;
  const matchStars = useMatchStars();

  const liveMatchesRef = useRef(liveMatches);
  const historicalMatchesRef = useRef(historicalMatches);
  const fallbackGeneratedSlipsRef = useRef<{ date: string; poolLength: number; slips: any } | null>(null);
  useEffect(() => {
    liveMatchesRef.current = liveMatches;
    historicalMatchesRef.current = historicalMatches;
  }, [liveMatches, historicalMatches]);

  const liveResultsKey = useMemo(
    () => (liveMatches || []).map((m) => `${m.id}:${m.result}`).join("|"),
    [liveMatches],
  );

  const snapshotResultsKey = useMemo(
    () => (matchesToProcess || []).map((m) => `${m.id}:${m.result}`).join("|"),
    [matchesToProcess],
  );

  useEffect(() => {
    let active = true;
    const fetchSlips = async () => {
      const cacheKey = `${selectedDate}_${historyType}`;
      const memCached = SESSION_SLIP_CACHE.get(cacheKey);

      if (memCached && Object.keys(memCached.slips).length > 0) {
        // Fast synchronous cache hit (< 1ms) - render instantly with zero flicker
        setLockedSlips(memCached.slips);
        setLockedAiSlips(memCached.aiSlips);
        setIsSlipsLoading(false);
      } else {
        // Synchronously check localStorage before showing any loading state
        const allCats = categoriesList.map((c) => c.id).filter((c) => c !== "all");
        const quickSlips: Record<string, SeerLockedSlip> = {};
        const quickAiSlips: Record<string, SeerLockedSlip> = {};
        if (typeof localStorage !== 'undefined') {
          for (const cat of allCats) {
            const regVal = localStorage.getItem(`local_locked_slip_${selectedDate}_${cat}`);
            const aiVal = localStorage.getItem(`local_locked_slip_${selectedDate}_ai_${cat}`);
            if (regVal) {
              try {
                const parsed = JSON.parse(regVal);
                if (parsed && parsed.picks?.length > 0) quickSlips[cat] = parsed;
              } catch (_) {}
            }
            if (aiVal) {
              try {
                const parsed = JSON.parse(aiVal);
                if (parsed && parsed.picks?.length > 0) quickAiSlips[cat] = parsed;
              } catch (_) {}
            }
          }
        }

        if (Object.keys(quickSlips).length > 0 || Object.keys(quickAiSlips).length > 0) {
          setLockedSlips(quickSlips);
          setLockedAiSlips(quickAiSlips);
          SESSION_SLIP_CACHE.set(cacheKey, { slips: quickSlips, aiSlips: quickAiSlips, timestamp: Date.now() });
          const cleanSelCat = selectedCategory.replace(/^ai_/, '').replace(/^sandbox_/, '');
          const hasCurrentCat = selectedCategory === 'all' || !!(quickSlips[selectedCategory] || quickSlips[cleanSelCat] || quickAiSlips[selectedCategory] || quickAiSlips[cleanSelCat]);
          if (hasCurrentCat) {
            setIsSlipsLoading(false);
          } else {
            setIsSlipsLoading(true);
          }
        } else {
          setLockedSlips({});
          setLockedAiSlips({});
          setIsSlipsLoading(true);
        }
      }
      
      const allCats = categoriesList
        .map((c) => c.id)
        .filter((c) => c !== "all");

      try {
        const newLocked: Record<string, SeerLockedSlip> = {};
        const newLockedAi: Record<string, SeerLockedSlip> = {};

        // Fast single batch fetch for all categories (< 20ms)
        const batchResults = await getLockedSlipsForDate(selectedDate, allCats);

        // Restrict matches for result hydration STRICTLY to matches belonging to selectedDate
        const livePool = [
          ...(liveMatchesRef.current || []),
          ...(liveMatches || []),
          ...(matchesToProcess || [])
        ].map((m: any) => (m.data && !m.teams) ? { ...m.data, ...m } : m)
         .filter(m => getLogicalDate(m.date, m.time) === selectedDate);

        // Index the live pool for rapid O(1) pick matching
        const byIdFinalized = new Map<string, any>();
        const byTeamFinalized = new Map<string, any>();
        const byIdAny = new Map<string, any>();
        const byTeamAny = new Map<string, any>();

        for (const m of livePool) {
          const mId = m.id?.toString() || "";
          const normMTeam = (m.teams || "").toLowerCase().replace(/[^a-z0-9]/g, '');
          const hasResult = getActualResult(m.result) !== 'pending';

          if (hasResult) {
            if (mId && !byIdFinalized.has(mId)) byIdFinalized.set(mId, m);
            if (normMTeam && !byTeamFinalized.has(normMTeam)) byTeamFinalized.set(normMTeam, m);
          }
          if (mId && !byIdAny.has(mId)) byIdAny.set(mId, m);
          if (normMTeam && !byTeamAny.has(normMTeam)) byTeamAny.set(normMTeam, m);
        }

        const hydrateSlip = (slipObj: SeerLockedSlip, catName: string): SeerLockedSlip => {
          let slipChanged = false;
          const cleanCat = catName.replace(/^ai_/, '').replace(/^sandbox_/, '');
          const updatedPicks = slipObj.picks.map(p => {
            const pId = p.match_id?.toString() || "";
            const normPTeam = (p.team || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            
            // 1. Prioritize match with finalized result on the same logical date
            let matchingM = byIdFinalized.get(pId) || (normPTeam ? byTeamFinalized.get(normPTeam) : undefined);
            if (!matchingM) {
              matchingM = byIdAny.get(pId) || (normPTeam ? byTeamAny.get(normPTeam) : undefined);
            }
            if (!matchingM) {
              matchingM = livePool.find(m => {
                const mId = m.id?.toString() || "";
                return mId && pId && (pId.startsWith(mId + "_") || mId.startsWith(pId + "_"));
              });
            }

            if (matchingM) {
              const actual = getActualResult(matchingM.result);
              if (actual && actual !== "pending") {
                const outcome: "Pending" | "Correct" | "Incorrect" = isMatchCorrectForCategory(matchingM, p.prediction, actual, cleanCat) ? "Correct" : "Incorrect";
                const displayScore = (matchingM.result && matchingM.result.includes(':')) ? matchingM.result : actual;
                if (p.actualResult !== displayScore || p.outcome !== outcome) {
                  slipChanged = true;
                  return { ...p, actualResult: displayScore, outcome };
                }
              }
            }
            return p;
          });

          if (slipChanged) {
            const updated = { ...slipObj, picks: updatedPicks };
            saveLockedSlip(updated, true).catch(e => console.error("Error auto-saving hydrated slip:", e));
            return updated;
          }
          return slipObj;
        };

        for (const cat of allCats) {
          let slip = batchResults.slips[cat];
          let aiSlip = batchResults.aiSlips[cat];

          // Check aliases if direct key was not present
          if (!slip) {
            const aliases = getCategoryAliases(cat);
            for (const a of aliases) {
              if (batchResults.slips[a]) {
                slip = batchResults.slips[a];
                break;
              }
            }
          }
          if (!aiSlip) {
            const aliases = getCategoryAliases(cat);
            for (const a of aliases) {
              if (batchResults.aiSlips[a]) {
                aiSlip = batchResults.aiSlips[a];
                break;
              }
            }
          }

          if (slip && (slip.type === historyType || (!slip.type && historyType === "daily"))) {
            const hydrated = hydrateSlip(slip, cat);
            newLocked[cat] = { ...hydrated, category: cat };
          }

          if (aiSlip && (aiSlip.type === historyType || (!aiSlip.type && historyType === "daily"))) {
            const hydratedAi = hydrateSlip(aiSlip, `ai_${cat}`);
            newLockedAi[cat] = { ...hydratedAi, category: cat };
          }
        }

        // Strictly prevent regenerating or force-overwriting slips for past dates or completed slates!
        // Historical slips are 100% immutable and must never have picks demoted, promoted, or altered.
        const todayStr = getAnalysisDateString();
        const isPastDate = selectedDate < todayStr;
        const hasCompletedResults = livePool.some((m) => {
          const res = getActualResult(m.result);
          return res && res !== "pending";
        });

        // If any categories do not have a locked slip, generate them ONCE and lock them immediately for the active slate
        const missingCats = allCats.filter((cat) => !newLocked[cat]);
        if (!isPastDate && !hasCompletedResults && missingCats.length > 0 && livePool.length > 0) {
          const cleanPool = livePool.filter((m) => !isBannedFromSeerSlips(m));
          const dayOfWeek = getMatchDayOfWeek({ date: selectedDate } as Match);
          const generatedSlips = generateSeerSlips(
            cleanPool,
            phaStatsMap,
            matchStars,
            historyType === "jackpot",
            false,
            dayOfWeek
          );

          const slipsToPersist: SeerLockedSlip[] = [];
          for (const cat of missingCats) {
            const picksData = generatedSlips.live[cat] || generatedSlips.spec[cat] || [];
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
                id: `${selectedDate}_${cat}`,
                date: selectedDate,
                category: cat,
                picks: picks,
                backups: [],
                weightsAtTime: categoryWeightsMap[cat] || DEFAULT_WEIGHTS,
                createdAt: new Date().toISOString(),
                type: historyType,
              };

              const hydrated = hydrateSlip(newSlip, cat);
              newLocked[cat] = { ...hydrated, category: cat };
              slipsToPersist.push(hydrated);
            }
          }

          if (slipsToPersist.length > 0) {
            // High-speed non-blocking background persistence to PostgreSQL & localStorage
            saveLockedSlipsBulk(slipsToPersist, false).catch((e) =>
              console.warn("Failed to auto-lock slips in bulk:", e)
            );
          }
        }

        if (!active) return;
        setLockedSlips((prev) => {
          const merged: Record<string, SeerLockedSlip> = {};
          for (const [c, s] of Object.entries(prev)) {
            if (s && s.date === selectedDate && s.picks && s.picks.length > 0) {
              merged[c] = s;
            }
          }
          for (const [c, s] of Object.entries(newLocked || {})) {
            if (s && s.picks && s.picks.length > 0) {
              merged[c] = s;
            }
          }
          return merged;
        });
        setLockedAiSlips((prev) => {
          const merged: Record<string, SeerLockedSlip> = {};
          for (const [c, s] of Object.entries(prev)) {
            if (s && s.date === selectedDate && s.picks && s.picks.length > 0) {
              merged[c] = s;
            }
          }
          for (const [c, s] of Object.entries(newLockedAi || {})) {
            if (s && s.picks && s.picks.length > 0) {
              merged[c] = s;
            }
          }
          return merged;
        });

        const cachedCurrent = SESSION_SLIP_CACHE.get(cacheKey) || { slips: {}, aiSlips: {} };
        const mergedCacheSlips = { ...cachedCurrent.slips };
        for (const [c, s] of Object.entries(newLocked)) {
          if (s && s.picks && s.picks.length > 0) mergedCacheSlips[c] = s;
        }
        const mergedCacheAiSlips = { ...cachedCurrent.aiSlips };
        for (const [c, s] of Object.entries(newLockedAi)) {
          if (s && s.picks && s.picks.length > 0) mergedCacheAiSlips[c] = s;
        }
        if (Object.keys(mergedCacheSlips).length > 0 || Object.keys(mergedCacheAiSlips).length > 0) {
          SESSION_SLIP_CACHE.set(cacheKey, { slips: mergedCacheSlips, aiSlips: mergedCacheAiSlips, timestamp: Date.now() });
        }
      } catch (err) {
        console.error("Error loading locked slips:", err);
      } finally {
        if (active) {
          setIsSlipsLoading(false);
        }
      }
    };

    fetchSlips();

    return () => {
      active = false;
    };
  }, [selectedDate, historyType, reloadTrigger, liveResultsKey, snapshotResultsKey]);

  const handleGlobalLockSlip = async (catId: string, matches: Match[]) => {
    const isAiTab = activeTab === "slips";
    const targetCat = isAiTab ? `ai_${catId}` : catId;

    const setRelevantLockedSlips = isAiTab ? setLockedAiSlips : setLockedSlips;

    setIsLocking((prev) => ({ ...prev, [catId]: true }));
    const cleanCat = catId.replace(/^ai_/, '').replace(/^sandbox_/, '');

    const picks = matches.map((m) => {
      let isHprOverride = false;
      const matchDay = getMatchDayOfWeek(m) || currentDayOfWeek;
      const optDetail = phaStatsMap ? getOptimizedScoreDetailed(m, catId, phaStatsMap, matchDay) : null;
      let pred = (m as any).targetPrediction || m.seerPrediction || predictWithSeer(
        m,
        categoryWeightsMap[catId] || DEFAULT_WEIGHTS,
        phaStatsMap,
        matchStars,
        catId,
      );

      if (cleanCat === 'upsets' || cleanCat === 'upset') {
        const stats = getMatchStats(m, phaStatsMap);
        pred = stats.moUnderdog === '1' ? '1X' : stats.moUnderdog === '2' ? 'X2' : '1X';
      } else if (cleanCat === 'value_picks' || cleanCat === 'bankers_jackpot') {
        const stats = getMatchStats(m, phaStatsMap);
        pred = stats.moFav === '1' ? '1X' : stats.moFav === '2' ? 'X2' : '1X';
      } else if (cleanCat === 'banker_draws') {
        const stats = getMatchStats(m, phaStatsMap);
        pred = stats.moFav === '1' ? '1X' : 'X2';
      }

      if (optDetail?.activeHedgingProtocol) {
        pred = optDetail.optimizedPrediction;
        isHprOverride = true;
      } else {
        let hedgedBase = ['1X', 'X2', '12'].includes(pred)
          ? pred
          : (phaStatsMap ? getOptimalHedge(m, phaStatsMap) : ensureHedgedPrediction(pred, m, phaStatsMap));
        const hprPred = applyHedgingProtocol(m, hedgedBase, catId, phaStatsMap, matchDay);
        if (hprPred && hprPred !== hedgedBase) {
          pred = hprPred;
          isHprOverride = true;
        } else {
          pred = hedgedBase;
        }
      }

      // Seer predictions on the slip must strictly remain hedged (1X, X2, or 12)
      pred = ensureHedgedPrediction(pred, m, phaStatsMap);

      // Preserve actual result and outcome if match is already completed or has known score
      const actual = getActualResult(m.result);
      const isFinished = actual && actual !== "pending";
      const displayScore = (m.result && m.result.includes(':')) ? m.result : actual;
      const outcome: "Pending" | "Correct" | "Incorrect" = isFinished
        ? (isMatchCorrectForCategory(m, pred, actual, cleanCat, phaStatsMap) ? "Correct" : "Incorrect")
        : "Pending";

      return {
        match_id: m.id,
        team: m.teams,
        prediction: pred,
        actualResult: isFinished ? displayScore : undefined,
        outcome,
        odds: m.mo?.split(",")[0] || "1.0",
        reason: isHprOverride ? `HPR: Hedging Protocol Override (${pred})` : "Locked Category Selection",
        confidence: "100%",
        category: targetCat,
        le: m.le || '',
        l10: m.l10 || '',
        rating: m.rating || '',
        isHprOverride,
        opwPoints: optDetail?.totalScore,
        opwRulesHit: optDetail?.rulesHit,
        opwBaseInfo: optDetail?.baseInfo,
        gs: m.gs || '',
        ga: m.ga || '',
        league: m.league || '',
        evaluatorTags: m.evaluatorTags || [],
      };
    });

    const slip: SeerLockedSlip = {
      id: `${selectedDate}_${targetCat}`,
      date: selectedDate,
      category: targetCat,
      picks: picks,
      backups: [],
      weightsAtTime: categoryWeightsMap[catId] || DEFAULT_WEIGHTS,
      createdAt: new Date().toISOString(),
      type: historyType,
    };

    try {
      await saveLockedSlip(slip, true);
    } catch (error) {
      console.warn("Supabase save failed for locked slip, updating local state only.", error);
    } finally {
      setRelevantLockedSlips((prev) => {
        const next = { ...prev, [catId]: slip };
        const cacheKey = `${selectedDate}_${historyType}`;
        const mem = SESSION_SLIP_CACHE.get(cacheKey) || { slips: {}, aiSlips: {}, timestamp: Date.now() };
        if (isAiTab) {
          mem.aiSlips[catId] = slip;
        } else {
          mem.slips[catId] = slip;
        }
        SESSION_SLIP_CACHE.set(cacheKey, mem);
        return next;
      });
      setIsLocking((prev) => ({ ...prev, [catId]: false }));
    }
  };

  const handleGlobalUnlockSlip = async (catId: string) => {
    const isAiTab = activeTab === "slips";
    const targetCat = isAiTab ? `ai_${catId}` : catId;

    if (!confirm("Delete locked slip for this category? A fresh slip will be generated and locked immediately.")) return;
    setIsLocking((prev) => ({ ...prev, [catId]: true }));
    autoLockOnPropagateRef.current[catId] = false;
    try {
      await deleteLockedSlip(selectedDate, targetCat);
      await deleteLockedSlip(selectedDate, catId);
      await deleteLockedSlip(selectedDate, `ai_${catId}`);
    } catch (error) {
      console.warn("Failed to delete from Supabase, deleting locally.", error);
    }
    const cacheKey = `${selectedDate}_${historyType}`;
    const mem = SESSION_SLIP_CACHE.get(cacheKey);
    if (mem) {
      delete mem.slips[catId];
      delete mem.aiSlips[catId];
    }
    setLockedSlips((prev) => {
      const next = { ...prev };
      delete next[catId];
      return next;
    });
    setLockedAiSlips((prev) => {
      const next = { ...prev };
      delete next[catId];
      return next;
    });

    setIsLocking((prev) => ({ ...prev, [catId]: false }));
    setReloadTrigger((p) => p + 1);
    window.dispatchEvent(new Event("resetSeerAutomation"));
    window.dispatchEvent(new Event("seerLockedSlipsUpdated"));
    fetchPerformanceStats();
  };

  useEffect(() => {
    const savedWeights = getSeerWeights();
    if (Object.keys(savedWeights).length > 0) {
      setCategoryWeightsMap(savedWeights);
    }

    // Optimized weights and daily calibrations are handled and persisted via loadPersistedDailySettings and loadServerOpwRules.
    // We avoid clobbering daily settings with main algo settings here.
  }, []);

  const [recommendationsMap, setRecommendationsMap] = useState<
    Record<string, Recommendation[]>
  >({});
  const [isTestingRecs, setIsTestingRecs] = useState<Record<string, boolean>>(
    {},
  );
  
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  // Periodically refresh todayStr every 30 seconds so crossing 9:00 AM automatically rolls over
  useEffect(() => {
    const timer = setInterval(() => {
      const freshToday = getAnalysisDateString();
      setTodayStr((prev) => (prev !== freshToday ? freshToday : prev));
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const availableDates = useMemo(() => {
    const dates = [];
    const todayAnalysis = todayStr;

    // Parse the date to ensure we handle roll-over correctly
    const year = parseInt(todayAnalysis.split("-")[0]);
    const month = parseInt(todayAnalysis.split("-")[1]) - 1;
    const day = parseInt(todayAnalysis.split("-")[2]);

    const baseDate = new Date(year, month, day);

    for (let i = 0; i < 57; i++) {
      // Window of historical days + today
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      dates.push(
        d.getFullYear() +
          "-" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(d.getDate()).padStart(2, "0"),
      );
    }
    return dates;
  }, [todayStr]);

  useEffect(() => {
    let active = true;

    // Immediate synchronous load from live uploaded matches strictly belonging to selectedDate
    const allAvailableMatches = liveMatchesRef.current || [];
    const filteredLive = allAvailableMatches.filter((m) => {
      const matchesType = historyType === "jackpot"
        ? m.isJackpot
        : m.isDaily;
      return matchesType && getLogicalDate(m.date, m.time) === selectedDate;
    });

    const collectionName =
      historyType === "daily"
        ? "seer_performance_history"
        : "seer_jackpot_history";

    let localMatches: Match[] = [];
    try {
      const localVal = localStorage.getItem(`local_seer_snapshot_${collectionName}_${selectedDate}`);
      if (localVal) {
        const parsed = JSON.parse(localVal);
        if (parsed.compressedMatches) {
          const decompressed = LZString.decompressFromUTF16(parsed.compressedMatches);
          localMatches = decompressed ? JSON.parse(decompressed) : [];
        } else if (Array.isArray(parsed.matches)) {
          localMatches = parsed.matches;
        }
      }
    } catch (e) {}

    const liveIds = new Set(filteredLive.map((m) => m.id.toString()));
    const isToday = selectedDate === todayStr;
    const filteredLiveForDate = filteredLive.filter(m => getLogicalDate(m.date, m.time) === selectedDate);
    
    // For TODAY: if no matches for today have been uploaded yet (filteredLive is empty),
    // strictly render empty array [] so stale matches from yesterday never appear under Today.
    const initialMatches = isToday ? deduplicateMatches([...filteredLive]) : deduplicateMatches([
      ...filteredLiveForDate,
      ...localMatches.filter(
        (m) =>
          !liveIds.has(m.id.toString()) &&
          getLogicalDate(m.date, m.time) === selectedDate,
      ),
    ]);

    setHistoricalSnapshot(initialMatches);

    // If we already have matches, do not block UI with a full-screen loading spinner
    if (initialMatches.length === 0) {
      setIsLoadingHistory(true);
    } else {
      setIsLoadingHistory(false);
    }

    getDailySeerSnapshot(selectedDate, collectionName)
      .then((snap) => {
        if (!active) return;
        let snapMatches = snap ? snap.matches : [];
        const liveIds = new Set(filteredLive.map((m) => m.id.toString()));
        const filteredLiveForDateDb = filteredLive.filter(m => getLogicalDate(m.date, m.time) === selectedDate);
        
        // For TODAY: only use filteredLive. Never pull yesterday's matches from snap into Today.
        let matches = isToday ? deduplicateMatches([...filteredLive]) : deduplicateMatches([
          ...filteredLiveForDateDb,
          ...snapMatches.filter(
            (m) =>
              !liveIds.has(m.id.toString()) &&
              getLogicalDate(m.date, m.time) === selectedDate,
          ),
        ]);

        // Result hydration: strictly check live matches belonging to selectedDate
        const liveForDate = (liveMatches || []).filter(k => getLogicalDate(k.date, k.time) === selectedDate);
        matches = matches.map(m => {
          const act = getActualResult(m.result);
          if (!act || act === 'pending') {
            const mId = m.id?.toString() || "";
            const normMTeam = (m.teams || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            const found = liveForDate.find(k => {
              const kId = k.id?.toString() || "";
              const normKTeam = (k.teams || "").toLowerCase().replace(/[^a-z0-9]/g, '');
              const isIdMatch = kId === mId || mId.startsWith(kId + "_") || kId.startsWith(mId + "_");
              const isTeamMatch = normMTeam.length > 0 && normKTeam.length > 0 && normMTeam === normKTeam;
              return (isIdMatch || isTeamMatch) && getActualResult(k.result) !== 'pending';
            });
            if (found) {
              return { ...m, result: found.result };
            }
          }
          return m;
        });

        setHistoricalSnapshot(matches);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Error loading historical snapshot:", err);
      })
      .finally(() => {
        if (active) {
          setIsLoadingHistory(false);
        }
      });

    cleanupOldSeerSnapshots();

    return () => {
      active = false;
    };
  }, [selectedDate, historyType, liveMatches]);

  const fetchPerformanceStats = async () => {
    setIsFetchingStats(true);
    const stats: PerformancePoint[] = [];
    const coll =
      historyType === "daily"
        ? "seer_performance_history"
        : "seer_jackpot_history";

    try {
      // 1. Fetch all cached performance stats for this category in a single bulk query
      const { data: cachedRows } = await supabase
        .from("seer_performance_cache")
        .select("*")
        .eq("collection", coll)
        .eq("category", selectedCategory);

      const cacheByDate = new Map<string, { accuracy: number; goalAccuracy: number; aiAccuracy?: number; aiGoalAccuracy?: number }>();
      if (cachedRows && Array.isArray(cachedRows)) {
        for (const row of cachedRows) {
          if (row.date) {
            cacheByDate.set(row.date, {
              accuracy: Number(row.accuracy),
              goalAccuracy: row.goal_accuracy !== null && row.goal_accuracy !== undefined ? Number(row.goal_accuracy) : Number(row.accuracy),
              aiAccuracy: row.ai_accuracy !== null && row.ai_accuracy !== undefined ? Number(row.ai_accuracy) : undefined,
              aiGoalAccuracy: row.ai_goal_accuracy !== null && row.ai_goal_accuracy !== undefined ? Number(row.ai_goal_accuracy) : undefined,
            });
          }
        }
      }

      // 2. Dates setup: last 10 days for chart, up to 56 days for Day of Week
      const recentDates = availableDates.slice(0, 11).filter((d) => d !== todayStr).reverse();
      const datesForDOW = availableDates.slice(0, 57).filter((d) => d !== todayStr);

      const dowAggregator: Record<number, { sum: number; count: number; goalSum: number; goalCount: number; aiSum: number; aiCount: number }> = {
        1: { sum: 0, count: 0, goalSum: 0, goalCount: 0, aiSum: 0, aiCount: 0 },
        2: { sum: 0, count: 0, goalSum: 0, goalCount: 0, aiSum: 0, aiCount: 0 },
        3: { sum: 0, count: 0, goalSum: 0, goalCount: 0, aiSum: 0, aiCount: 0 },
        4: { sum: 0, count: 0, goalSum: 0, goalCount: 0, aiSum: 0, aiCount: 0 },
        5: { sum: 0, count: 0, goalSum: 0, goalCount: 0, aiSum: 0, aiCount: 0 },
        6: { sum: 0, count: 0, goalSum: 0, goalCount: 0, aiSum: 0, aiCount: 0 },
        0: { sum: 0, count: 0, goalSum: 0, goalCount: 0, aiSum: 0, aiCount: 0 },
      };
      const dowAggregatedDates = new Set<string>();

      const addDateToDow = (date: string, acc: number, goalAcc: number, aiAcc?: number) => {
        if (dowAggregatedDates.has(date)) return;
        const [y, m, d] = date.split("-").map(Number);
        const dow = new Date(y, m - 1, d).getDay();
        dowAggregator[dow].sum += acc;
        dowAggregator[dow].count += 1;
        dowAggregator[dow].goalSum += goalAcc;
        dowAggregator[dow].goalCount += 1;
        if (aiAcc !== undefined) {
          dowAggregator[dow].aiSum += aiAcc;
          dowAggregator[dow].aiCount += 1;
        }
        dowAggregatedDates.add(date);
      };

      // 3. Seed Day of Week aggregator from all cached dates in Supabase rows
      for (const [date, cachedPerf] of cacheByDate.entries()) {
        addDateToDow(date, cachedPerf.accuracy, cachedPerf.goalAccuracy, cachedPerf.aiAccuracy);
      }

      let mostRecentMatches: Match[] = [];

      // 4. For recentDates (last 10 finalized days), use cache or evaluate if missing
      for (const date of recentDates) {
        let perf = cacheByDate.get(date);

        if (!perf) {
          // Check if local cache or backend storage has it
          perf = (await getSeerPerformanceCache(date, selectedCategory, coll)) as any;
        }

        if (perf) {
          stats.push({
            date: date.split("-").slice(1).join("/"),
            accuracy: perf.accuracy,
            goalAccuracy: perf.goalAccuracy ?? perf.accuracy,
            aiAccuracy: perf.aiAccuracy,
            aiGoalAccuracy: perf.aiGoalAccuracy,
          });
          addDateToDow(date, perf.accuracy, perf.goalAccuracy ?? perf.accuracy, perf.aiAccuracy);
          continue;
        }

        // Only if missing from cache for a recent finalized day, evaluate snapshot or available matches
        let snapMatches: Match[] = [];
        const snap = await getDailySeerSnapshot(date, coll);
        if (snap && snap.matches && snap.matches.length > 0) {
          snapMatches = snap.matches;
        } else {
          // Fallback to in-memory liveMatches and historicalMatches
          const allAvail = [...liveMatchesRef.current, ...historicalMatchesRef.current];
          const forDate = allAvail.filter((m) => {
            const matchesType = historyType === "jackpot" ? m.isJackpot : m.isDaily;
            return matchesType && getLogicalDate(m.date, m.time) === date;
          });
          if (forDate.length > 0) {
            snapMatches = deduplicateMatches(forDate);
          }
        }

        if (snapMatches.length > 0) {
          let acc = 0;
          let goalAcc = 0;
          let aiAcc = 0;
          let aiGoalAcc = 0;
          let evaluated = 0;
          let aiEvaluated = 0;

          // --- 1. Evaluate SEER AI ANALYSIS (Slip) ---
          const aiSlip = await getLockedSlip(date, `ai_${selectedCategory}`);
          if (aiSlip && aiSlip.picks && aiSlip.picks.length > 0) {
            const aiMatches = snapMatches.filter((m) => {
              const mId = m.id.toString();
              const mTeam = (m.teams || "").toLowerCase().trim();
              return aiSlip.picks.some((p) => {
                const pId = p.match_id?.toString() || "";
                const pTeam = (p.team || "").toLowerCase().trim();
                return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || (pTeam.length > 0 && mTeam === pTeam);
              });
            });

            let correct = 0;
            let goalCorrect = 0;
            aiMatches.forEach((m) => {
              const actual = getActualResult(m.result);
              if (actual && actual !== "pending") {
                aiEvaluated++;
                const pick = aiSlip.picks.find((p) => {
                  const pId = p.match_id?.toString() || "";
                  const mId = m.id.toString();
                  const pTeam = (p.team || "").toLowerCase().trim();
                  const mTeam = (m.teams || "").toLowerCase().trim();
                  return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || (pTeam.length > 0 && mTeam === pTeam);
                });
                if (pick) {
                  if (isMatchCorrectForCategory(m, pick.prediction, actual, selectedCategory, phaStatsMap)) correct++;
                  if (isMatchGoalAccurate(m, pick.prediction, actual, selectedCategory, phaStatsMap)) goalCorrect++;
                }
              }
            });
            aiAcc = aiEvaluated > 0 ? (correct / aiEvaluated) * 100 : 0;
            aiGoalAcc = aiEvaluated > 0 ? (goalCorrect / aiEvaluated) * 100 : 0;
          }

          // --- 2. Evaluate SEER OPTIMIZED WEIGHTS / LOCKED SLIP ---
          const stdSlip = await getLockedSlip(date, selectedCategory);
          let correct = 0;
          let goalCorrect = 0;

          if (stdSlip && stdSlip.picks && stdSlip.picks.length > 0) {
            // Evaluate user-locked replacement slip
            const slipMatches = snapMatches.filter((m) => {
              const mId = m.id.toString();
              const mTeam = (m.teams || "").toLowerCase().trim();
              return stdSlip.picks.some((p) => {
                const pId = p.match_id?.toString() || "";
                const pTeam = (p.team || "").toLowerCase().trim();
                return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || (pTeam.length > 0 && mTeam === pTeam);
              });
            });

            slipMatches.forEach((m) => {
              const actual = getActualResult(m.result);
              if (actual && actual !== "pending") {
                evaluated++;
                const pick = stdSlip.picks.find((p) => {
                  const pId = p.match_id?.toString() || "";
                  const mId = m.id.toString();
                  const pTeam = (p.team || "").toLowerCase().trim();
                  const mTeam = (m.teams || "").toLowerCase().trim();
                  return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || (pTeam.length > 0 && mTeam === pTeam);
                });
                if (pick) {
                  if (isMatchCorrectForCategory(m, pick.prediction, actual, selectedCategory, phaStatsMap)) correct++;
                  if (isMatchGoalAccurate(m, pick.prediction, actual, selectedCategory, phaStatsMap)) goalCorrect++;
                }
              }
            });
          } else {
            // Unlocked: evaluate algorithmic candidate selections with active weights
            const dayOfWeek = getMatchDayOfWeek({ date: selectedDate } as Match);
            const slips = generateSeerSlips(
              snapMatches,
              phaStatsMap,
              matchStars,
              false,
              false,
              dayOfWeek
            );
            const targetSlip =
              slips.live[selectedCategory] ||
              slips.spec[selectedCategory] ||
              [];
            const slipPickMap = new Map<string, any>();
            targetSlip.forEach((p: any) => {
              slipPickMap.set(p.match_id.toString(), p);
            });
            const categoryMatches = snapMatches.filter((m) =>
              slipPickMap.has(m.id.toString()),
            );

            categoryMatches.forEach((m) => {
              const actual = getActualResult(m.result);
              if (actual && actual !== "pending") {
                evaluated++;
                const pick = slipPickMap.get(m.id.toString());
                const optScore = getOptimizedScoreDetailed(m, selectedCategory, phaStatsMap, dayOfWeek);
                const pred = pick?.prediction || optScore.optimizedPrediction || _predictWithSeer(
                  m,
                  categoryWeightsMap[selectedCategory] || DEFAULT_WEIGHTS,
                );
                if (isMatchCorrectForCategory(m, pred, actual, selectedCategory, phaStatsMap)) correct++;
                if (isMatchGoalAccurate(m, pred, actual, selectedCategory, phaStatsMap)) goalCorrect++;
              }
            });
          }

          acc = evaluated > 0 ? (correct / evaluated) * 100 : 0;
          goalAcc = evaluated > 0 ? (goalCorrect / evaluated) * 100 : 0;

          if (acc > 0 || evaluated > 0 || aiAcc > 0 || aiEvaluated > 0) {
            const finalAcc = Math.round(acc);
            const finalGoalAcc = Math.round(goalAcc);
            const finalAiAcc = Math.round(aiAcc);
            const finalAiGoalAcc = Math.round(aiGoalAcc);
            stats.push({
              date: date.split("-").slice(1).join("/"),
              accuracy: finalAcc,
              goalAccuracy: finalGoalAcc,
              aiAccuracy: aiEvaluated > 0 ? finalAiAcc : undefined,
              aiGoalAccuracy: aiEvaluated > 0 ? finalAiGoalAcc : undefined,
            });

            addDateToDow(date, finalAcc, finalGoalAcc, aiEvaluated > 0 ? finalAiAcc : undefined);

            if ((evaluated > 0 || aiEvaluated > 0) && date !== todayStr) {
              await saveSeerPerformanceCache(
                date,
                selectedCategory,
                coll,
                finalAcc,
                finalGoalAcc,
                aiEvaluated > 0 ? finalAiAcc : undefined,
                aiEvaluated > 0 ? finalAiGoalAcc : undefined,
              );
            }
            if (snapMatches.some((m) => {
              const act = getActualResult(m.result);
              return act && act !== "pending";
            })) {
              mostRecentMatches = snapMatches;
            }
          }
        }
      }

      // 5. Populate remaining dates in datesForDOW
      for (const date of datesForDOW) {
        if (dowAggregatedDates.has(date)) continue;
        let cachedPerf = cacheByDate.get(date);
        if (!cachedPerf) {
          cachedPerf = (await getSeerPerformanceCache(date, selectedCategory, coll)) as any;
        }
        if (cachedPerf) {
          addDateToDow(date, cachedPerf.accuracy, cachedPerf.goalAccuracy ?? cachedPerf.accuracy, cachedPerf.aiAccuracy);
        }
      }

      // Ensure mostRecentMatches is populated from the latest snapshot or available matches if empty
      if (mostRecentMatches.length === 0 && recentDates.length > 0) {
        const allAvail = [...liveMatchesRef.current, ...historicalMatchesRef.current];
        for (const rDate of [...recentDates].reverse()) {
          let matches = (await getDailySeerSnapshot(rDate, coll))?.matches || [];
          if (matches.length === 0) {
            matches = allAvail.filter(m => (historyType === "jackpot" ? m.isJackpot : m.isDaily) && getLogicalDate(m.date, m.time) === rDate);
          }
          if (matches.some((m) => {
            const act = getActualResult(m.result);
            return act && act !== "pending";
          })) {
            mostRecentMatches = deduplicateMatches(matches);
            break;
          }
        }
      }

      const dowArray = [1, 2, 3, 4, 5, 6, 0].map((day) => {
        const agg = dowAggregator[day];
        return {
          day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day],
          accuracy: agg.count > 0 ? Math.round(agg.sum / agg.count) : 0,
          goalAccuracy: agg.goalCount > 0 ? Math.round(agg.goalSum / agg.goalCount) : (agg.count > 0 ? Math.round(agg.sum / agg.count) : 0),
          aiAccuracy: agg.aiCount > 0 ? Math.round(agg.aiSum / agg.aiCount) : undefined,
          samples: agg.count,
        };
      });
      setDowStats(dowArray);

      // Sort stats by date so chart goes left to right
      stats.sort((a, b) => a.date.localeCompare(b.date));
      setPerformanceData(stats);
      if (mostRecentMatches.length > 0) {
        setLatestSnapshotMatches(mostRecentMatches);
      }
    } catch (err) {
      console.error("Error fetching performance stats:", err);
    } finally {
      setIsFetchingStats(false);
    }
  };

  useEffect(() => {
    if (activeTab === "stats") {
      fetchPerformanceStats();
    }
  }, [selectedCategory, activeTab, historyType, reloadTrigger]);

  const getMatchesForCategory = (matches: Match[], catId: string, forSlips: boolean = false): Match[] => {
    if (forSlips) {
      matches = matches.filter((m) => !isBannedFromSeerSlips(m));
    }
    if (catId === "all") return matches;

    // ML Engine Filters
    if (catId.startsWith("ml_")) {
      return matches.filter(m => {
        const source = m.mlInfo?.mlPredictionSource;
        if (catId === "ml_tricore" && source === "Tri-Core Hybrid") return true;
        if (catId === "ml_smart_override" && source === "Smart Override Engine") return true;
        if (catId === "ml_pivot" && source === "Pivot Engine") return true;
        if (catId === "ml_ai_consensus" && source === "AI Consensus Lock") return true;
        if (catId === "ml_chaos" && source === "Chaos Theory Engine") return true;
        return false;
      });
    }

    // For upsets, study matches where the underdog actually won when not generating slips
    if (catId === "upsets" && !forSlips) {
      return matches.filter((m) => {
        const actual = getActualResult(m.result);
        if (actual === "pending") {
          // Predict using Supreme Tier underdog / underdog rules
          const supreme = getMatchSupremeTierUnderdog(m, phaStatsMap);
          return supreme.insightsHit > 0;
        }
        const favInfo = getFavoriteAndUnderdog(m);
        return favInfo ? actual === favInfo.underdog : false;
      });
    }

    if (forSlips) {
      // If we have a locked slip for this category, resolve via direct key or alias
      const resolvedLockedSlip = activeLockedSlips[catId] || (() => {
        const aliases = getCategoryAliases(catId);
        for (const a of aliases) {
          if (activeLockedSlips[a]) return activeLockedSlips[a];
        }
        return null;
      })();

      if (resolvedLockedSlip) {
        const pool = [
          ...(liveMatchesRef.current || []),
          ...(liveMatches || []),
          ...(historicalMatches || []),
          ...(matches || [])
        ].filter((m: any) => getLogicalDate(m.date, m.time) === selectedDate);

        const allFallbackMatches = [
          ...(liveMatchesRef.current || []),
          ...(liveMatches || []),
          ...(historicalMatches || []),
          ...(matches || [])
        ];

        // Ensure we preserve exact picks from the locked slip in order, resolving scores against pool
        return resolvedLockedSlip.picks
          .map((p: any) => {
            const pId = p.match_id?.toString() || "";
            const normPTeam = (p.team || "").toLowerCase().replace(/[^a-z0-9]/g, '');

            const matchFilter = (m: any) => {
              const mId = m.id?.toString() || "";
              const normMTeam = (m.teams || "").toLowerCase().replace(/[^a-z0-9]/g, '');
              const idMatch = mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_");
              const teamMatch = normPTeam.length > 0 && normMTeam.length > 0 && (
                normMTeam === normPTeam ||
                normMTeam.includes(normPTeam) ||
                normPTeam.includes(normMTeam)
              );
              return idMatch || teamMatch;
            };

            const found = pool.find((m: any) => matchFilter(m) && getActualResult(m.result) !== 'pending') ||
                          pool.find(matchFilter) ||
                          allFallbackMatches.find((m: any) => matchFilter(m) && getActualResult(m.result) !== 'pending') ||
                          allFallbackMatches.find(matchFilter);

            const resolvedRes = (p.actualResult && getActualResult(p.actualResult) !== 'pending')
              ? p.actualResult
              : (found && getActualResult(found.result) !== 'pending')
                ? found.result
                : (p.actualResult && p.actualResult !== '-' ? p.actualResult : (found?.result || 'pending'));

            if (found) {
              return {
                ...found,
                result: resolvedRes,
                actualResult: resolvedRes,
                seerPrediction: p.prediction,
                targetPrediction: p.prediction,
                isHprOverride: p.isHprOverride ?? found.isHprOverride,
                lockedOpwScore: p.opwPoints !== undefined ? {
                  totalScore: p.opwPoints,
                  rulesHit: p.opwRulesHit || [],
                  baseInfo: p.opwBaseInfo || { points: 0, mFav: '1', phaPercentage: 0, isUnderdogBase: false },
                  optimizedPrediction: p.prediction,
                  activeHedgingProtocol: null
                } : (found.lockedOpwScore || undefined)
              };
            }

            // Fallback match with full metadata from pick
            return {
              id: p.match_id,
              teams: p.team,
              date: resolvedLockedSlip.date,
              time: '',
              result: resolvedRes,
              actualResult: resolvedRes,
              seerPrediction: p.prediction,
              finalPrediction: p.prediction,
              rawPrediction: p.prediction,
              mo: p.odds || '1.0',
              le: p.le || '-',
              l10: p.l10 || '-',
              rating: p.rating || '-',
              gs: p.gs || '',
              ga: p.ga || '',
              league: p.league || '',
              evaluatorTags: p.evaluatorTags || [],
              isHprOverride: p.isHprOverride || false,
              isDaily: resolvedLockedSlip.type === 'daily',
              isJackpot: resolvedLockedSlip.type === 'jackpot',
              status: (resolvedRes && getActualResult(resolvedRes) !== 'pending') ? 'finished' : 'pending',
              lockedOpwScore: p.opwPoints !== undefined ? {
                totalScore: p.opwPoints,
                rulesHit: p.opwRulesHit || [],
                baseInfo: p.opwBaseInfo || { points: 0, mFav: '1', phaPercentage: 0, isUnderdogBase: false },
                optimizedPrediction: p.prediction,
                activeHedgingProtocol: null
              } : undefined
            } as any as Match;
          });
      }

      // If no locked slip exists in state yet, check if this is a past date or completed match slate
      const todayStr = getAnalysisDateString();
      const isPastDate = selectedDate < todayStr;
      const hasCompleted = (matches || []).some((m) => {
        const res = getActualResult(m.result);
        return res && res !== "pending";
      });

      // Historical slips or completed slates must never have synthetic new picks generated
      if (isPastDate || hasCompleted) {
        return [];
      }

      // If live and pending, synchronously generate from live pool so the UI never flickers empty while locking completes
      const fallbackPool = [
        ...(liveMatchesRef.current || []),
        ...(liveMatches || []),
        ...(matches || [])
      ].filter((m: any) => getLogicalDate(m.date, m.time) === selectedDate && !isBannedFromSeerSlips(m));

      if (fallbackPool.length > 0) {
        let generated: any;
        if (
          fallbackGeneratedSlipsRef.current &&
          fallbackGeneratedSlipsRef.current.date === selectedDate &&
          fallbackGeneratedSlipsRef.current.poolLength === fallbackPool.length
        ) {
          generated = fallbackGeneratedSlipsRef.current.slips;
        } else {
          const dayOfWeek = getMatchDayOfWeek({ date: selectedDate } as Match);
          generated = generateSeerSlips(
            fallbackPool,
            phaStatsMap || {},
            matchStars,
            historyType === "jackpot",
            false,
            dayOfWeek
          );
          fallbackGeneratedSlipsRef.current = {
            date: selectedDate,
            poolLength: fallbackPool.length,
            slips: generated
          };
        }
        const picksData = generated.live[catId] || generated.spec[catId] || [];
        if (picksData && picksData.length > 0) {
          return picksData.map((p: any) => {
            const pId = p.match_id?.toString() || "";
            const normPTeam = (p.team || "").toLowerCase().replace(/[^a-z0-9]/g, '');
            const found = fallbackPool.find((m: any) => {
              const mId = m.id?.toString() || "";
              const normMTeam = (m.teams || "").toLowerCase().replace(/[^a-z0-9]/g, '');
              return mId === pId || (normPTeam.length > 0 && normMTeam === normPTeam);
            });
            if (found) {
              return {
                ...found,
                seerPrediction: p.prediction,
                targetPrediction: p.prediction,
                isHprOverride: p.isHprOverride ?? found.isHprOverride,
                lockedOpwScore: p.opwPoints !== undefined ? {
                  totalScore: p.opwPoints,
                  rulesHit: p.opwRulesHit || [],
                  baseInfo: p.opwBaseInfo || { points: 0, mFav: '1', phaPercentage: 0, isUnderdogBase: false },
                  optimizedPrediction: p.prediction,
                  activeHedgingProtocol: null
                } : undefined
              };
            }
            return {
              id: p.match_id,
              teams: p.team,
              date: selectedDate,
              time: '',
              result: p.actualResult || 'pending',
              seerPrediction: p.prediction,
              finalPrediction: p.prediction,
              rawPrediction: p.prediction,
              mo: p.odds || '1.0',
              le: p.le || '-',
              l10: p.l10 || '-',
              rating: p.rating || '-',
              gs: p.gs || '',
              ga: p.ga || '',
              league: p.league || '',
              evaluatorTags: p.evaluatorTags || [],
              isHprOverride: p.isHprOverride || false,
              isDaily: historyType === 'daily',
              isJackpot: historyType === 'jackpot',
              status: 'pending',
              lockedOpwScore: p.opwPoints !== undefined ? {
                totalScore: p.opwPoints,
                rulesHit: p.opwRulesHit || [],
                baseInfo: p.opwBaseInfo || { points: 0, mFav: '1', phaPercentage: 0, isUnderdogBase: false },
                optimizedPrediction: p.prediction,
                activeHedgingProtocol: null
              } : undefined
            } as any as Match;
          });
        }
      }

      return [];
    }

    // Default: for deep learn & performance audits, we must run the evaluation engine on ALL matches matching that category tag
    const mappedCat = getMappedMatchCategory(catId);
    return matches.filter((m) =>
      hasCategoryTag(m, catId, phaStatsMap, historyType === "jackpot", matchStars) ||
      evaluateMatchCategory(
        m,
        mappedCat,
        "all",
        phaStatsMap,
        historyType === "jackpot",
        true,
      )
    );
  };

  const _getMatchScore = (
    m: Match,
    outcome: "1" | "X" | "2",
    weights: CategoryWeights,
  ): number => {
    return getMatchScore(m, outcome, weights, phaStatsMap, matchStars);
  };

  const _predictWithSeer = (m: Match, weights: any) => {
    try {
      const mlPrediction = m.mlInfo?.mlPrediction || m.finalPrediction || m.rawPrediction || "-";
      return mlPrediction;
    } catch (e) {
      return "-";
    }
  };

  const clampWeights = (w: CategoryWeights): CategoryWeights => {
    const clamped = { ...w };
    (Object.keys(clamped) as Array<keyof CategoryWeights>).forEach((key) => {
      if (typeof clamped[key] === "number") {
        // Allow synergy condition weights up to 1000
        const maxVal =
          key.startsWith("synergyCond") || key === "synergyGapBoost"
            ? 1000
            : 100;
        clamped[key] = Math.min(maxVal, Math.max(0, clamped[key] as number));
      }
    });
    return clamped;
  };

  const getMappedMatchCategory = (catId: string) => {
    switch (catId) {
      case "top_12_value":
      case "top_10_value":
        return "top12";
      case "high_confidence":
        return "top20";
      default:
        return catId as any;
    }
  };

  const handleResetWeights = () => {
    const categoryName = categoriesList.find((c) => c.id === selectedCategory)?.label || selectedCategory;
    if (!confirm(`Are you sure you want to reset the weights for ${categoryName} to default weights?`)) {
      return;
    }
    const modePrefix = historyType === "jackpot" ? "jackpot_" : "daily_";
    const effectiveCategoryKey = `${modePrefix}${selectedCategory}`;
    setCategoryWeightsMap((prev) => {
      const next = { ...prev };
      delete next[effectiveCategoryKey];
      delete next[selectedCategory];
      
      const mappedKey = getMappedMatchCategory(selectedCategory);
      delete next[`${modePrefix}${mappedKey}`];
      delete next[mappedKey];
      
      saveSeerWeights(next);
      return next;
    });
  };




  const getAccuracy = (mList: Match[], weights: CategoryWeights, categoryId?: string) => {
    const cat = categoryId || selectedCategory;
    let correct = 0;
    let evaluated = 0;
    for (const m of mList) {
      const actual = getActualResult(m.result);
      if (actual && actual !== "pending") {
        evaluated++;
        const pred = _predictWithSeer(m, weights);
        if (isMatchCorrectForCategory(m, pred, actual, cat, phaStatsMap)) correct++;
      }
    }
    return evaluated > 0 ? (correct / evaluated) * 100 : 0;
  };

  const getGoalAccuracy = (mList: Match[], weights: CategoryWeights, categoryId?: string) => {
    const cat = categoryId || selectedCategory;
    let goalCorrect = 0;
    let evaluated = 0;
    for (const m of mList) {
      const actual = getActualResult(m.result);
      if (actual && actual !== "pending") {
        evaluated++;
        const pred = _predictWithSeer(m, weights);
        if (isMatchGoalAccurate(m, pred, actual, cat, phaStatsMap)) goalCorrect++;
      }
    }
    return evaluated > 0 ? (goalCorrect / evaluated) * 100 : 0;
  };


  const modePrefix = historyType === "jackpot" ? "jackpot_" : "daily_";
  const effectiveCategoryKey = `${modePrefix}${selectedCategory}`;

  const currentWeights =
    categoryWeightsMap[effectiveCategoryKey] ||
    categoryWeightsMap[selectedCategory] ||
    DEFAULT_WEIGHTS;

  const handleAiOptimizer = async () => {
    setIsOptimizing(true);
    setLearningProgress(0);
    setLearningStatus("Initializing AI Optimizer...");
    
    try {
      // Use exact live matches loaded for analysis strictly matching selectedDate
      const targetMatches = (matchesToProcess && matchesToProcess.length > 0)
        ? matchesToProcess.filter((m: any) => getLogicalDate(m.date, m.time) === selectedDate)
        : (liveMatches && liveMatches.length > 0 ? liveMatches.filter((m: any) => getLogicalDate(m.date, m.time) === selectedDate) : []);

      const categoryName = categoriesList.find((c) => c.id === selectedCategory)?.label || selectedCategory;

      const results = await runAiOptimizer(
        targetMatches,
        selectedCategory,
        categoryName,
        currentWeights,
        phaStatsMap,
        matchStars,
        (status, percent) => {
          setLearningStatus(status);
          setLearningProgress(percent);
        }
      );
      
      setRecommendationsMap(prev => ({
        ...prev,
        [selectedCategory]: results
      }));

      // Apply the first approved recommendation if any
      const bestApproved = results.find(r => r.testResult?.approved);
      if (bestApproved) {
        setCategoryWeightsMap(prev => {
          const newMap = {
            ...prev,
            [effectiveCategoryKey]: bestApproved.proposedWeights
          };
          saveSeerWeights(newMap);
          return newMap;
        });
      }
    } catch (err: any) {
      console.error("AI Optimizer failed:", err);
      setError(err.message || "Failed to run AI Optimizer");
    } finally {
      setIsOptimizing(false);
      setLearningStatus("");
    }
  };

  const handleTestRecommendation = (rec: Recommendation) => {
    setIsTestingRecs((prev) => ({ ...prev, [rec.id]: true }));

    setTimeout(() => {
      const validMatches =
        selectedCategory === "all"
          ? matchesToProcess
          : matchesToProcess.filter((m) =>
              evaluateMatchCategory(
                m,
                getMappedMatchCategory(selectedCategory),
                "all",
                phaStatsMap,
                historyType === "jackpot",
                true,
              ),
            );
      const matchesWithResults = validMatches.filter(
        (m) => getActualResult(m.result) !== "pending",
      );

      const oldAcc = getAccuracy(matchesWithResults, currentWeights);
      const newAcc = getAccuracy(matchesWithResults, rec.proposedWeights);
      const oldGoalAcc = getGoalAccuracy(matchesWithResults, currentWeights);
      const newGoalAcc = getGoalAccuracy(matchesWithResults, rec.proposedWeights);

      let approved = false;
      if (rec.subsetGoalAcc !== undefined) {
        approved = rec.subsetGoalAcc >= oldGoalAcc;
      } else {
        approved = (newAcc > oldAcc && newGoalAcc >= oldGoalAcc) ||
                   (newGoalAcc > oldGoalAcc && newAcc >= oldAcc) ||
                   (newAcc === oldAcc && newGoalAcc === oldGoalAcc && newAcc > 0 && selectedCategory !== 'all');
      }

      if (approved) {
        setCategoryWeightsMap((prev) => {
          const latestCurrent =
            prev[effectiveCategoryKey] ||
            prev[selectedCategory] ||
            DEFAULT_WEIGHTS;

          const synergyKeys: (keyof CategoryWeights)[] = [
            "synergyCondA",
            "synergyCondB",
            "synergyCondC",
            "synergyCondD",
            "synergyCondE",
            "synergyGapBoost",
            "synergyAgreementBoost",
          ];

          // Delta-based merge to prevent stale recommendations from reverting synergy weights
          const weightsToApply = { ...rec.proposedWeights };

          synergyKeys.forEach((k) => {
            const wasChangedByRec =
              rec.proposedWeights[k] !== rec.baseWeights[k];
            if (!wasChangedByRec) {
              // Recommendation didn't intend to touch this synergy key,
              // so use the absolute latest value from the state
              if (latestCurrent[k] !== undefined) {
                (weightsToApply as any)[k] = latestCurrent[k];
              }
            }
          });

          const newMap = { ...prev, [effectiveCategoryKey]: weightsToApply };
          saveSeerWeights(newMap);
          return newMap;
        });
      }

      setRecommendationsMap((prev) => {
        const currentRecs = prev[selectedCategory] || [];
        return {
          ...prev,
          [selectedCategory]: currentRecs.map((r) =>
            r.id === rec.id
              ? {
                  ...r,
                  isTested: true,
                  testResult: { prevAcc: oldAcc, newAcc, approved, prevGoalAcc: oldGoalAcc, newGoalAcc },
                }
              : r,
          ),
        };
      });

      setIsTestingRecs((prev) => ({ ...prev, [rec.id]: false }));
    }, 600);
  };

  const currentRecommendations = recommendationsMap[selectedCategory] || [];

  // Test Live Matches
  const liveTestMatches = useMemo(() => {
    let validMatches = getMatchesForCategory(
      matchesToProcess,
      selectedCategory,
      true
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      validMatches = validMatches.filter(
        (m) =>
          m.teams.toLowerCase().includes(q) ||
          String(m.id).toLowerCase().includes(q) ||
          m.le.toLowerCase().includes(q) ||
          m.mo.toLowerCase().includes(q),
      );
    }

    return validMatches;
  }, [matchesToProcess, selectedCategory, phaStatsMap, searchQuery, isOpwFilterActive, activeLockedSlips, reloadTrigger, liveResultsKey]);

  const liveStats = useMemo(() => {
    const withResults = liveTestMatches.filter(
      (m) => getActualResult(m.result) !== "pending",
    );
    if (withResults.length === 0) return { count: 0, acc: 0, goalAcc: 0 };

    const cleanCat = selectedCategory.replace(/^ai_/, '').replace(/^sandbox_/, '');
    const isHedged = !['upsets', 'upset', 'value_picks', 'bankers_jackpot'].includes(cleanCat);

    let correct = 0;
    let goalCorrect = 0;
    withResults.forEach((m) => {
      const lockedPick = activeLockedSlips[selectedCategory]?.picks?.find((p: any) => {
        const pId = p.match_id?.toString() || "";
        const mId = m.id.toString();
        const pTeam = (p.team || "").toLowerCase().trim();
        const mTeam = (m.teams || "").toLowerCase().trim();
        return mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_") || (pTeam.length > 0 && mTeam === pTeam);
      });
      const matchDay = getMatchDayOfWeek(m) || currentDayOfWeek;
      const optScore = getOptimizedScoreDetailed(m, selectedCategory, phaStatsMap, matchDay);
      let pred = lockedPick?.prediction || (m as any).targetPrediction || m.seerPrediction || optScore.optimizedPrediction || m.finalPrediction || '1';

      if (!lockedPick) {
        if (cleanCat === 'upsets' || cleanCat === 'upset') {
          const stats = getMatchStats(m, phaStatsMap);
          pred = stats.moUnderdog === '1' ? '1X' : stats.moUnderdog === '2' ? 'X2' : '1X';
        } else if (cleanCat === 'value_picks' || cleanCat === 'bankers_jackpot') {
          const stats = getMatchStats(m, phaStatsMap);
          pred = stats.moFav === '1' ? '1X' : stats.moFav === '2' ? 'X2' : '1X';
        } else if (cleanCat === 'banker_draws') {
          const stats = getMatchStats(m, phaStatsMap);
          pred = stats.moFav === '1' ? '1X' : 'X2';
        } else if (optScore?.activeHedgingProtocol) {
          pred = optScore.optimizedPrediction;
        } else {
          let hedgedBase = ['1X', 'X2', '12'].includes(pred)
            ? pred
            : (phaStatsMap ? getOptimalHedge(m, phaStatsMap) : ensureHedgedPrediction(pred, m, phaStatsMap));
          const hprPred = applyHedgingProtocol(m, hedgedBase, selectedCategory, phaStatsMap, matchDay);
          pred = (hprPred && hprPred !== hedgedBase) ? hprPred : hedgedBase;
        }
      }
      pred = ensureHedgedPrediction(pred, m, phaStatsMap);

      const actual = getActualResult(m.result);
      if (actual && actual !== "pending") {
        if (isMatchCorrectForCategory(m, pred, actual, selectedCategory, phaStatsMap)) correct++;
        if (isMatchGoalAccurate(m, pred, actual, selectedCategory, phaStatsMap)) goalCorrect++;
      }
    });

    return {
      count: withResults.length,
      acc: (correct / withResults.length) * 100,
      goalAcc: (goalCorrect / withResults.length) * 100,
    };
  }, [liveTestMatches, currentWeights, selectedCategory, phaStatsMap, activeLockedSlips]);

  const livePoolRef = liveMatchesRef.current || [];
  const liveMatchesById = useMemo(() => {
    const map = new Map<string, any>();
    for (const lm of (livePoolRef || [])) {
      if (lm.id) map.set(lm.id.toString(), lm);
    }
    return map;
  }, [livePoolRef]);

  const liveMatchesByTeam = useMemo(() => {
    const map = new Map<string, any>();
    for (const lm of (livePoolRef || [])) {
      const norm = (lm.teams || "").toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm) map.set(norm, lm);
    }
    return map;
  }, [livePoolRef]);

  const activePicks = activeLockedSlips[selectedCategory]?.picks || [];
  const activePicksById = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of activePicks) {
      if (p.match_id) map.set(p.match_id.toString(), p);
    }
    return map;
  }, [activePicks]);

  const activePicksByTeam = useMemo(() => {
    const map = new Map<string, any>();
    for (const p of activePicks) {
      const norm = (p.team || "").toLowerCase().trim();
      if (norm) map.set(norm, p);
    }
    return map;
  }, [activePicks]);

  const totalTestMatches = liveTestMatches.length;
  const totalTestPages = Math.max(1, Math.ceil(totalTestMatches / TEST_PAGE_SIZE));
  const paginatedTestMatches = useMemo(() => {
    const start = (testMatchesPage - 1) * TEST_PAGE_SIZE;
    return liveTestMatches.slice(start, start + TEST_PAGE_SIZE);
  }, [liveTestMatches, testMatchesPage]);

  // Auto-lock on propagate removed to keep locking strictly manual

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="bg-gradient-to-r from-slate-900 to-indigo-900 border-b border-indigo-800 p-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Eye className="text-teal-400" />
              SEER Prediction Algorithm
            </h2>
            <p className="text-indigo-200 text-sm mt-1">
              Self-learning analysis engine replacing AI defaults for higher
              precision.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-black/30 p-1 rounded-lg border border-white/10 flex">
                <button
                  onClick={() => {
                    setHistoryType("daily");
                    setSelectedDate(todayStr); // Reset to today when switching
                  }}
                  className={`px-3 py-1 rounded text-[10px] font-black transition-all ${historyType === "daily" ? "bg-indigo-500 text-white shadow-lg" : "bg-transparent text-white/40 hover:text-white/70"}`}
                >
                  DAILY LIVE
                </button>
                <button
                  onClick={() => {
                    setHistoryType("jackpot");
                    setSelectedDate(todayStr);
                  }}
                  className={`px-3 py-1 rounded text-[10px] font-black transition-all ${historyType === "jackpot" ? "bg-amber-500 text-white shadow-lg" : "bg-transparent text-white/40 hover:text-white/70"}`}
                >
                  JACKPOT
                </button>
              </div>

              {(activeTab === "test" || activeTab === "slips") && (
                <div className="flex gap-2 ml-2">
                  <button
                    onClick={() => {
                      setIsLoadingHistory(true);
                      const todayStr = getLogicalDate(new Date().toISOString().split('T')[0]);
                      const filteredHistorical = historicalMatches.filter(m => getLogicalDate(m.date || '', m.time) !== todayStr);
                      syncSeerData([...liveMatches, ...filteredHistorical], phaStatsMap, matchStars).then(
                        () => {
                          setTimeout(() => setIsLoadingHistory(false), 500);
                        },
                      );
                    }}
                    className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-200 rounded border border-indigo-500/30 flex items-center gap-1 text-[10px] font-black transition-all"
                    title="Sync Results"
                  >
                    <RefreshCw size={12} /> SYNC
                  </button>
                  {selectedDate === todayStr && (
                    <button
                      onClick={() => setShowClearModal(true)}
                      className="px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded border border-red-500/30 flex items-center gap-1 text-[10px] font-black transition-all"
                      title="Clear Today"
                    >
                      <Trash2 size={12} /> CLEAR
                    </button>
                  )}
                  {selectedDate !== todayStr && (
                    <button
                      onClick={async () => {
                        if (
                          !confirm(
                            `Are you sure you want to delete ALL locked slips for ${selectedDate}?`
                          )
                        )
                          return;
                        setIsLoadingHistory(true);
                        try {
                          const allCats = categoriesList
                            .map((c) => c.id)
                            .concat([
                              "banker", 
                              "upset", 
                              "jackpot", 
                              "safety",
                              "top_10_value",
                              "sandbox_best_bet",
                              "sandbox_top_12_value",
                              "sandbox_top_10_value",
                              "sandbox_bankers_dlive",
                              "sandbox_bankers_jackpot",
                              "sandbox_value_bets",
                              "sandbox_value_picks",
                              "sandbox_high_confidence",
                              "sandbox_banker_draws",
                              "sandbox_botb_best",
                              "sandbox_upsets"
                            ])
                            .filter((c) => c !== "all");
                          for (const cat of allCats) {
                            await deleteLockedSlip(selectedDate, cat);
                          }
                          setLockedSlips({});
                          setLockedAiSlips({});

                          // Auto-propagate and lock fresh slips for all categories on this date
                          try {
                            const filteredLiveForDate = (liveMatchesRef.current && liveMatchesRef.current.length > 0)
                              ? liveMatchesRef.current.filter((m: any) => {
                                  const matchesType = historyType === "jackpot" ? m.isJackpot : m.isDaily;
                                  return matchesType && getLogicalDate(m.date, m.time) === selectedDate;
                                })
                              : [];
                            const basePool = (matchesToProcess && matchesToProcess.length > 0)
                              ? matchesToProcess.filter((m: any) => getLogicalDate(m.date, m.time) === selectedDate)
                              : filteredLiveForDate;
                            const cleanPool = basePool.filter((m) => !isBannedFromSeerSlips(m));
                            const dayOfWeek = getMatchDayOfWeek({ date: selectedDate } as Match);
                            const slips = generateSeerSlips(cleanPool, phaStatsMap, matchStars, historyType === "jackpot", false, dayOfWeek);

                            for (const cat of allCats) {
                              const targetSlip = slips.live[cat] || slips.spec[cat] || [];
                              if (targetSlip && targetSlip.length > 0) {
                                const pickMap = new Map<string, any>();
                                targetSlip.forEach((p: any) => pickMap.set(p.match_id?.toString() || "", p));
                                const filtered = cleanPool
                                  .filter((m) => pickMap.has(m.id.toString()))
                                  .map((m) => {
                                    const p = pickMap.get(m.id.toString());
                                    return {
                                      ...m,
                                      seerPrediction: p?.prediction || m.seerPrediction,
                                      targetPrediction: p?.prediction || (m as any).targetPrediction,
                                      isHprOverride: p?.isHprOverride ?? (m as any).isHprOverride,
                                    };
                                  });
                                const sortedFreshMatches = filtered.sort((a, b) => {
                                  const idxA = targetSlip.findIndex((p: any) => p.match_id?.toString() === a.id.toString());
                                  const idxB = targetSlip.findIndex((p: any) => p.match_id?.toString() === b.id.toString());
                                  return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
                                });
                                if (sortedFreshMatches.length > 0) {
                                  await handleGlobalLockSlip(cat, sortedFreshMatches);
                                }
                              }
                            }
                          } catch (bulkErr) {
                            console.error("Error bulk auto-locking refreshed slips:", bulkErr);
                          }

                          fetchPerformanceStats();
                          alert(`Locked slips for ${selectedDate} refreshed, locked, and saved to backend successfully.`);
                        } catch (err) {
                          alert("Failed to delete older slips.");
                        } finally {
                          setIsLoadingHistory(false);
                        }
                      }}
                      className="px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-100 hover:text-red-200 rounded border border-red-500/30 flex items-center gap-1 text-[10px] font-black transition-all cursor-pointer"
                      title="Delete all locked slips for this date"
                    >
                      <Trash2 size={12} /> DELETE SLIPS
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 bg-black/30 p-1 rounded-lg border border-white/10">
              <Calendar size={16} className="text-teal-400 ml-2" />
              <span className="text-[10px] font-black text-white uppercase tracking-wider mr-2">
                History:
              </span>
              <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-[400px]">
                {availableDates.map((date) => {
                  const isToday = date === todayStr;
                  const isSelected = selectedDate === date;
                  const label = isToday
                    ? "TODAY"
                    : date.split("-").slice(1).join("/");

                  return (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`px-2 py-1 rounded text-[10px] font-black transition-all ${isSelected ? "bg-teal-500 text-white shadow-lg scale-110" : "bg-white/10 text-white/60 hover:bg-white/20"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedDate !== todayStr && (
              <div className="text-[10px] font-bold text-amber-400 animate-pulse bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                Viewing Historical Data for {selectedDate}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 flex p-2 gap-2 overflow-x-auto no-scrollbar">
        {categoriesList.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-md text-sm font-bold whitespace-nowrap transition-all ${selectedCategory === cat.id ? "bg-teal-600 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm animate-in fade-in slide-in-from-top-2">
          <AlertTriangle size={18} />
          <span className="font-bold">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto hover:bg-red-100 p-1 rounded"
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      <div className="flex px-2 md:px-3 py-2 gap-4 bg-slate-100 border-b border-gray-200 justify-between items-center">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("learn")}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${activeTab === "learn" ? "bg-amber-500 text-white shadow" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            <Brain size={16} /> Self Learn
          </button>
          <button
            onClick={() => setActiveTab("test")}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${activeTab === "test" ? "bg-indigo-600 text-white shadow" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            <PlayCircle size={16} /> SEER OPTIMIZED SLIPS
          </button>
          <button
            onClick={() => setActiveTab("slips")}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${activeTab === "slips" ? "bg-teal-600 text-white shadow" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            <ListOrdered size={16} /> SEER AI SLIPS
          </button>
          <button
            onClick={() => setActiveTab("stats")}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${activeTab === "stats" ? "bg-purple-600 text-white shadow" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            <BarChart2 size={16} /> Stats
          </button>
          <button
            onClick={() => setActiveTab("optimized")}
            className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 ${activeTab === "optimized" ? "bg-pink-600 text-white shadow" : "bg-white text-gray-600 hover:bg-gray-50"}`}
          >
            <Zap size={16} /> Optimized Weights
          </button>
        </div>
        {/* Actions moved to header */}
      </div>

      <div className="flex-1 overflow-y-auto px-1 py-2 sm:px-2 sm:py-3 relative">
        {showClearModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border-l-8 border-amber-500 animate-in fade-in zoom-in duration-300">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4 text-left">
                  <div className="shrink-0 mt-1">
                    <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center border border-amber-100">
                      <AlertTriangle className="text-amber-500" size={20} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 leading-tight">
                      Unsaved Changes
                    </h3>
                    <p className="text-slate-500 text-sm font-medium mt-1 leading-relaxed">
                      You have results updates for today. If you clear now, they
                      will be lost. We recommend saving first.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => {
                      setIsLoadingHistory(true);
                      setShowClearModal(false);
                      try {
                        const filteredLive = liveMatches.filter((m) =>
                          historyType === "jackpot"
                            ? m.isJackpot
                            : m.isDaily,
                        );
                        setHistoricalSnapshot(filteredLive);
                        
                        // Perform operations in the background
                        (async () => {
                          try {
                            await syncSeerData(
                              liveMatches,
                              phaStatsMap,
                              matchStars,
                            );
                            const coll =
                              historyType === "jackpot"
                                ? "seer_jackpot_history"
                                : "seer_performance_history";
                            await deleteDailySeerSnapshot(todayStr, coll);
                          } catch (err) {
                            console.error("Background Seer Save & Clear error:", err);
                          }
                        })();
                      } finally {
                        setIsLoadingHistory(false);
                      }
                    }}
                    className="w-full bg-[#059669] hover:bg-[#047857] text-white font-black py-3.5 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 group text-sm"
                  >
                    <Database size={18} />
                    Save & Clear
                  </button>

                  <button
                    onClick={() => {
                      setIsLoadingHistory(true);
                      setShowClearModal(false);
                      try {
                        const filteredLive = liveMatches.filter((m) =>
                          historyType === "jackpot"
                            ? m.isJackpot
                            : m.isDaily,
                        );
                        setHistoricalSnapshot(filteredLive);

                        // Clear backup in background
                        const coll =
                          historyType === "jackpot"
                            ? "seer_jackpot_history"
                            : "seer_performance_history";
                        deleteDailySeerSnapshot(todayStr, coll).catch(err => {
                          console.error("Background Seer Snapshot direct clear failed:", err);
                        });
                      } finally {
                        setIsLoadingHistory(false);
                      }
                    }}
                    className="w-full bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#334155] font-black py-3.5 rounded-lg transition-all text-sm"
                  >
                    Clear Without Saving
                  </button>

                  <button
                    onClick={() => setShowClearModal(false)}
                    className="w-full py-2 text-slate-400 font-bold hover:text-slate-600 transition-colors text-xs underline underline-offset-4"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {isLoadingHistory && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="animate-spin text-indigo-600" size={32} />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Loading Records...
              </span>
            </div>
          </div>
        )}
        {activeTab === "learn" ? (
          <div className="flex flex-col md:flex-row gap-4 h-full">
            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col justify-start min-h-[300px]">
              <div className="flex items-center gap-3 mb-4">
                <Brain size={32} className="text-amber-500" />
                <h3 className="text-lg font-bold text-gray-800">
                  SEER Recommendations:{" "}
                  {categoriesList.find((c) => c.id === selectedCategory)?.label}
                </h3>
              </div>
              <p className="text-gray-500 text-sm mb-6">
                SEER analyzes recent live matches that have results to find
                imbalances in prediction variables. It proposes and tests
                recommendations to tune weightings.
              </p>

              <div className="flex flex-wrap gap-4 mb-6">
                <button
                  disabled={isOptimizing || isOptimizing}
                  className={`px-6 py-3 rounded-lg font-bold text-white shadow-md flex items-center justify-center w-full max-w-xs gap-2 transition-all ${isOptimizing ? "bg-gray-400 cursor-not-allowed transform scale-95" : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-lg"}`}
                  onClick={handleAiOptimizer}
                >
                  {isOptimizing ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : (
                    <Zap size={18} />
                  )}
                  {isOptimizing ? "Optimizing..." : "Run AI Optimizer"}
                </button>
              </div>

              {(isOptimizing || isOptimizing) && (
                <div className="w-full max-w-md bg-gray-100 rounded-full h-8 mb-6 overflow-hidden relative border border-gray-200">
                  <div
                    className="bg-amber-500 h-full transition-all duration-300 flex items-center justify-center"
                    style={{ width: `${learningProgress}%` }}
                  >
                    <span className="text-[10px] font-black text-white drop-shadow-md">
                      {learningProgress.toFixed(0)}%
                    </span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-gray-800 uppercase mix-blend-difference">
                      {learningStatus}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {currentRecommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="border border-gray-200 rounded-lg p-4 bg-slate-50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                        <Search size={16} className="text-indigo-500" />{" "}
                        Finding:
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 mb-3 ml-6">
                      {rec.finding}
                    </p>

                    {rec.deepInsights && rec.deepInsights.length > 0 && (
                      <div className="mb-3 ml-6 bg-white p-3 border border-indigo-100 rounded-md">
                        <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Sparkles size={12} /> Deep Insights
                        </div>
                        <ul className="space-y-1.5">
                          {rec.deepInsights.map((insight, idx) => (
                            <li key={idx} className="text-xs text-gray-600 pl-2 border-l border-indigo-300">
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 text-sm font-bold text-teal-700">
                        <ArrowRight size={16} className="text-teal-500" />{" "}
                        Action proposed:
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4 ml-6">
                      {rec.action}
                    </p>

                    {rec.isTested ? (
                      <div
                        className={`p-3 rounded-md flex items-center justify-between text-sm shadow-sm ${rec.testResult?.approved ? "bg-green-100 border border-green-300 text-green-800" : "bg-red-100 border border-red-300 text-red-800"}`}
                      >
                        <div className="flex items-center gap-2 font-bold">
                          {rec.testResult?.approved ? (
                            <CheckCircle2 size={18} />
                          ) : (
                            <XCircle size={18} />
                          )}
                          {rec.testResult?.approved
                            ? "Recommendation Approved & Applied"
                            : "Recommendation Rejected"}
                        </div>
                        {rec.testResult && (
                          <div className="flex flex-col items-end text-right font-mono text-xs gap-1 font-bold">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-gray-400 font-extrabold tracking-wide uppercase">Overall:</span>
                              <span className="text-gray-500 line-through opacity-70 border px-1 rounded">
                                {rec.testResult.prevAcc.toFixed(1)}%
                              </span>
                              <ArrowRight size={10} className="text-gray-400" />
                              <span className={rec.testResult.approved ? "text-green-700 font-extrabold" : "text-red-700"}>
                                {rec.testResult.newAcc.toFixed(1)}%
                              </span>
                            </div>
                            {rec.testResult.prevGoalAcc !== undefined && rec.testResult.newGoalAcc !== undefined && selectedCategory !== 'all' && (
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] text-indigo-400 font-extrabold tracking-wide uppercase">Goal:</span>
                                <span className="text-gray-500 line-through opacity-70 border px-1 rounded">
                                  {rec.testResult.prevGoalAcc.toFixed(1)}%
                                </span>
                                <ArrowRight size={10} className="text-gray-400" />
                                <span className={rec.testResult.approved ? "text-indigo-700 font-extrabold" : "text-red-700"}>
                                  {rec.testResult.newGoalAcc.toFixed(1)}%
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleTestRecommendation(rec)}
                        disabled={isTestingRecs[rec.id]}
                        className="ml-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-bold flex items-center gap-2 transition-colors disabled:bg-gray-400"
                      >
                        {isTestingRecs[rec.id] ? (
                          <RefreshCw className="animate-spin" size={14} />
                        ) : (
                          <PlayCircle size={14} />
                        )}
                        {isTestingRecs[rec.id]
                          ? "Testing against live data..."
                          : "Test Recommendation against Live Data"}
                      </button>
                    )}
                  </div>
                ))}
                {currentRecommendations.length === 0 && !isOptimizing && (
                  <div className="text-center p-8 border-2 border-dashed border-gray-200 rounded-lg text-gray-400">
                    No insights generated yet. Click "Generate Insights" to
                    begin.
                  </div>
                )}
              </div>
            </div>

            <div className="w-full md:w-80 bg-white rounded-lg shadow-sm border border-gray-200 p-4 self-start sticky top-4 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h3 className="text-md font-bold text-gray-800 flex items-center gap-2">
                  <BarChart2 size={16} className="text-indigo-500" /> Current
                  Optimized Weightings
                </h3>
                {selectedCategory !== "all" && (
                  <button
                    onClick={handleResetWeights}
                    className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                    title="Reset category weights to default weights"
                  >
                    <RefreshCw size={10} />
                    RESET WEIGHT
                  </button>
                )}
              </div>

              <div className="space-y-3 mt-4">
                <WeightBar
                  label="PAA Prediction"
                  val={currentWeights.paaPredWeight}
                  desc="(Base)"
                  color="bg-teal-500"
                />
                <WeightBar
                  label="Algo Prediction"
                  val={currentWeights.algoWeight}
                  desc="(Audit)"
                  color="bg-blue-500"
                />
                <WeightBar
                  label="Sub Pattern Pred"
                  val={currentWeights.subPatternWeight}
                  desc="(Synergy)"
                  color="bg-indigo-500"
                />
                <WeightBar
                  label="Prob Confidence"
                  val={currentWeights.probConfWeight}
                  desc="(Prob)"
                  color="bg-emerald-500"
                />
                <WeightBar
                  label="PHA Outcomes"
                  val={currentWeights.phaWeight}
                  desc="(1X2 Dist)"
                  color="bg-purple-500"
                />
                <WeightBar
                  label="PAA Performance"
                  val={currentWeights.paaPercentWeight}
                  desc="(Market %)"
                  color="bg-pink-500"
                />
                <WeightBar
                  label="Live PERF Data"
                  val={currentWeights.perfStarsWeight}
                  desc="(Stars)"
                  color="bg-amber-500"
                />
                <WeightBar
                  label="1X2 Prediction"
                  val={currentWeights.pred1x2Weight}
                  desc="(1X2)"
                  color="bg-rose-500"
                />
                <WeightBar
                  label="1X2 Rating Boost"
                  val={currentWeights.pred1x2RatingBoost}
                  desc="(&ge;3/10)"
                  color="bg-orange-500"
                />
                <WeightBar
                  label="Draw Strategy Boost"
                  val={currentWeights.drawDisagreementBoost}
                  desc="(1X vs X2)"
                  color="bg-cyan-500"
                />
                <WeightBar
                  label="Synergy Gap"
                  val={(currentWeights.synergyGapBoost ?? 250) / 10}
                  desc="(Boost/10)"
                  color="bg-indigo-400"
                />
                <WeightBar
                  label="Synergy Boost A"
                  val={(currentWeights.synergyCondA ?? 300) / 10}
                  desc="(Boost/10)"
                  color="bg-fuchsia-400"
                />
                <WeightBar
                  label="Synergy Boost B"
                  val={(currentWeights.synergyCondB ?? 200) / 10}
                  desc="(Boost/10)"
                  color="bg-fuchsia-500"
                />
                <WeightBar
                  label="Synergy Boost C"
                  val={(currentWeights.synergyCondC ?? 150) / 10}
                  desc="(Boost/10)"
                  color="bg-fuchsia-600"
                />
                <WeightBar
                  label="Synergy Boost D"
                  val={(currentWeights.synergyCondD ?? 100) / 10}
                  desc="(Boost/10)"
                  color="bg-fuchsia-700"
                />
                <WeightBar
                  label="Synergy Boost E"
                  val={(currentWeights.synergyCondE ?? 100) / 10}
                  desc="(Boost/10)"
                  color="bg-fuchsia-800"
                />
              </div>
            </div>
          </div>
        ) : activeTab === "test" ? (
          <div className="space-y-4">
            
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col min-h-[400px]">
            <div className="px-3 py-2.5 sm:px-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-50 rounded-t-lg">
              <div className="flex items-center gap-2">
                <PlayCircle size={16} className="text-red-500" />
                <h3 className="text-md font-bold text-gray-800">
                  Live SEER Optimized Slip for{" "}
                  {categoriesList.find((c) => c.id === selectedCategory)?.label}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded shadow-sm border border-gray-100">
                    {liveTestMatches.length} Picks
                  </span>
                  {liveStats.count > 0 && (
                    <>
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded shadow-sm border ${liveStats.acc >= 70 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200"} flex items-center gap-1`}
                        title="Checks if actual result matches any of the double-chance hedges"
                      >
                        <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase">Overall:</span>
                        {liveStats.acc.toFixed(1)}% ({liveStats.count} Evaluated)
                      </span>
                      {selectedCategory !== "all" && (
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded shadow-sm border ${liveStats.goalAcc >= 70 ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-amber-50 text-amber-700 border-amber-200"} flex items-center gap-1`}
                          title={`Goal-specific target accuracy for ${categoriesList.find((c) => c.id === selectedCategory)?.label}`}
                        >
                          <span className="text-[10px] text-indigo-400 font-extrabold tracking-wider uppercase">Goal:</span>
                          {liveStats.goalAcc.toFixed(1)}% Accuracy
                        </span>
                      )}
                    </>
                  )}
                  {selectedCategory !== "all" && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          activeLockedSlips[selectedCategory]
                            ? handleGlobalUnlockSlip(selectedCategory)
                            : handleGlobalLockSlip(
                                selectedCategory,
                                liveTestMatches,
                              )
                        }
                        className={`px-3 py-1 rounded text-[10px] font-black flex items-center gap-1 transition-all shadow-sm ${activeLockedSlips[selectedCategory] ? "bg-amber-100 text-amber-700 border border-amber-300" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                      >
                        {isLocking[selectedCategory] ? (
                          <RefreshCw className="animate-spin" size={12} />
                        ) : activeLockedSlips[selectedCategory] ? (
                          <ShieldCheck size={12} />
                        ) : (
                          <Target size={12} />
                        )}
                        {activeLockedSlips[selectedCategory]
                          ? "LOCKED / STICKY"
                          : "MAKE SELECTION STICKY"}
                      </button>
                      {activeLockedSlips[selectedCategory] && (
                        <button
                          onClick={() => handleGlobalUnlockSlip(selectedCategory)}
                          className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-[10px] font-black flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                          title="Delete older or current locked slip"
                        >
                          <Trash2 size={12} />
                          DELETE LOCKED SLIP
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="relative w-full md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={14} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search matches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-xs"
                />
              </div>
            </div>

            <div className="p-2 sm:p-2.5 flex-1">
              {isSlipsLoading ? (
                <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                  <RefreshCw size={28} className="mb-2 animate-spin text-indigo-500" />
                  <p className="text-sm font-semibold text-gray-600">Loading SEER Optimized Slip...</p>
                  <span className="text-xs text-gray-400 mt-1">Retrieving authoritative picks and results</span>
                </div>
              ) : liveTestMatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-gray-400">
                  <Target size={32} className="mb-2 opacity-50" />
                  <p>
                    {searchQuery
                      ? "No matches found matching your search."
                      : "No live matches currently in this category."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
                        {paginatedTestMatches.map((m, idx) => {
                          const mId = m.id.toString();
                          const mTeam = (m.teams || "").toLowerCase().trim();
                          const lockedPick = activePicksById.get(mId) || activePicksByTeam.get(mTeam) || null;

                          const normMTeam = (m.teams || "").toLowerCase().replace(/[^a-z0-9]/g, '');
                          const freshM = liveMatchesById.get(mId) || (normMTeam ? liveMatchesByTeam.get(normMTeam) : null) || m;
                          const cleanCat = selectedCategory.replace(/^ai_/, '').replace(/^sandbox_/, '');

                          const targetMatchForEval = freshM || m;
                          const matchTags = (targetMatchForEval.evaluatorTags && targetMatchForEval.evaluatorTags.length > 0)
                            ? targetMatchForEval.evaluatorTags
                            : getMatchEvaluatorTags(targetMatchForEval, phaStatsMap || {}, targetMatchForEval.isJackpot || false, true, matchStars);
                          const displayCat = resolveTop20SourceCat(m, matchTags, idx, cleanCat);

                          const matchDay = getMatchDayOfWeek(freshM || m);
                          const liveOptScore = phaStatsMap ? getOptimizedScoreDetailed(freshM || m, displayCat, phaStatsMap, matchDay) : null;
                          const optScore = liveOptScore || (lockedPick?.opwPoints !== undefined
                            ? {
                                totalScore: lockedPick.opwPoints,
                                rulesHit: lockedPick.opwRulesHit || [],
                                baseInfo: lockedPick.opwBaseInfo || { points: 0, mFav: '1', phaPercentage: 0, isUnderdogBase: false },
                                optimizedPrediction: lockedPick.prediction,
                                activeHedgingProtocol: null
                              }
                            : (m as any).lockedOpwScore);

                          const hasUpsetsTag = matchTags.some(t => t.startsWith('upsets:'));
                          const isUpsetsCat = cleanCat === 'upsets' || cleanCat === 'upset' || cleanCat === 'sandbox_upsets';
                          const upsetOptScore = (!isUpsetsCat && hasUpsetsTag && phaStatsMap)
                            ? getOptimizedScoreDetailed(targetMatchForEval, 'upsets', phaStatsMap, matchDay)
                            : null;
                          const highestOtherOpw = (isUpsetsCat && phaStatsMap)
                            ? getHighestOtherOpwScore(targetMatchForEval, matchTags, phaStatsMap, matchDay)
                            : null;

                          let pred = lockedPick?.prediction || (m as any).targetPrediction || m.seerPrediction || optScore?.optimizedPrediction || _predictWithSeer(m, currentWeights);
                          let isHpr = lockedPick?.isHprOverride ?? (m as any).isHprOverride ?? false;

                          if (!lockedPick) {
                            if (cleanCat === 'upsets' || cleanCat === 'upset') {
                              const stats = getMatchStats(m, phaStatsMap);
                              pred = stats.moUnderdog === '1' ? '1X' : stats.moUnderdog === '2' ? 'X2' : '1X';
                            } else if (cleanCat === 'value_picks' || cleanCat === 'bankers_jackpot') {
                              const stats = getMatchStats(m, phaStatsMap);
                              pred = stats.moFav === '1' ? '1X' : stats.moFav === '2' ? 'X2' : '1X';
                            } else if (cleanCat === 'banker_draws') {
                              const stats = getMatchStats(m, phaStatsMap);
                              pred = stats.moFav === '1' ? '1X' : 'X2';
                            } else if (optScore?.activeHedgingProtocol) {
                              pred = optScore.optimizedPrediction;
                              isHpr = true;
                            } else {
                              let hedgedBase = ['1X', 'X2', '12'].includes(pred)
                                ? pred
                                : (phaStatsMap ? getOptimalHedge(m, phaStatsMap) : ensureHedgedPrediction(pred, m, phaStatsMap));
                              const hprPred = applyHedgingProtocol(m, hedgedBase, selectedCategory, phaStatsMap, matchDay);
                              if (hprPred && hprPred !== hedgedBase) {
                                pred = hprPred;
                                isHpr = true;
                              } else {
                                pred = hedgedBase;
                              }
                            }
                          }

                          // Seer predictions on the slip must strictly remain hedged (1X, X2, or 12)
                          pred = ensureHedgedPrediction(pred, m, phaStatsMap);
                          const resolvedRes = (m.result && getActualResult(m.result) !== 'pending')
                            ? m.result
                            : (lockedPick?.actualResult && getActualResult(lockedPick.actualResult) !== 'pending')
                              ? lockedPick.actualResult
                              : (freshM && getActualResult(freshM.result) !== 'pending')
                                ? freshM.result
                                : (m.result || lockedPick?.actualResult || "-");
                          const actualResult = getActualResult(resolvedRes);
                          const isCorrect =
                            actualResult && isMatchCorrectForCategory(freshM || m, pred, actualResult, selectedCategory, phaStatsMap);
                          const cardIdx = (testMatchesPage - 1) * TEST_PAGE_SIZE + idx + 1;

                          return (
                            <div
                              key={`${m.id}_${idx}`}
                              className="border border-gray-200 rounded p-2.5 sm:p-3 flex flex-col gap-2 hover:shadow-sm transition-shadow bg-white"
                            >
                              <div className="text-xs text-gray-500 flex items-center justify-between gap-1.5 font-mono flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-blue-50 px-1.5 py-0.5 rounded text-blue-700 font-bold border border-blue-100 italic text-[10px] shrink-0">
                                    MO: {m.mo || "-"}
                                  </span>
                                  <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-gray-600 text-[10px] shrink-0">
                                    LE: {m.le || "NA"}
                                  </span>
                                  <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-gray-600 text-[10px] shrink-0 inline-flex items-baseline" title="Last 10 Matches (LDW:WDL)">
                                    <L10Display l10={m.l10} showPrefix={true} />
                                  </span>
                                </div>
                                <span className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 text-amber-800 font-bold text-[10px] shrink-0" title="1X2 Rating">
                                  R: {(m.rating && m.rating !== "Unknown") ? m.rating : "-"}
                                </span>
                              </div>
                              <div className="text-xs font-mono flex items-center justify-between gap-1.5 pb-0.5">
                                <span className="bg-white border border-gray-300 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm" title="1X2 Prediction">
                                  1X2: {m.pred1x2 || "-"}
                                </span>
                                {resolvedRes &&
                                resolvedRes !== "pending" &&
                                resolvedRes !== "?-?" &&
                                resolvedRes !== "-" &&
                                resolvedRes !== "Unknown" &&
                                resolvedRes.toLowerCase() !== "unknown" &&
                                actualResult !== "pending" && (
                                  <span
                                    className={`font-bold px-1.5 py-0.5 rounded shadow-sm text-[10px] shrink-0 ${isCorrect ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`}
                                  >
                                    FT: {resolvedRes}
                                  </span>
                                )}
                              </div>
                              <div className="font-bold text-sm text-gray-800 flex items-center flex-wrap gap-2">
                                {selectedCategory !== "all" && (
                                  <span className="text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded shadow-sm opacity-90 truncate">
                                    #{cardIdx}
                                  </span>
                                )}
                                <span className="truncate">{m.teams}</span>
                                {selectedCategory !== "all" && (optScore || upsetOptScore || highestOtherOpw) && (
                                  <div className="ml-auto flex items-center gap-1 shrink-0">
                                    {optScore && (
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setOwModalMatch({ 
                                            match: freshM || m, 
                                            catId: displayCat,
                                            lockedScore: liveOptScore || undefined
                                          }); 
                                        }}
                                        className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm font-black whitespace-nowrap cursor-pointer" 
                                        title={`${optScore.rulesHit?.length || 0} rules applied. Click to view breakdown.`}>
                                        <Zap size={10} />
                                        {getCategoryShortLabel(displayCat)} {optScore.totalScore > 0 ? `+${optScore.totalScore}` : optScore.totalScore} PTS
                                      </button>
                                    )}
                                    {upsetOptScore && (
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setOwModalMatch({ 
                                            match: freshM || m, 
                                            catId: 'upsets',
                                            lockedScore: upsetOptScore
                                          }); 
                                        }}
                                        className="text-[10px] bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200 transition-colors px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm font-black whitespace-nowrap cursor-pointer" 
                                        title={`Underdog (UPS): ${upsetOptScore.rulesHit?.length || 0} rules applied. Click to view breakdown.`}>
                                        <Zap size={10} />
                                        UPS {upsetOptScore.totalScore > 0 ? `+${upsetOptScore.totalScore}` : upsetOptScore.totalScore} PTS
                                      </button>
                                    )}
                                    {highestOtherOpw && (
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setOwModalMatch({ 
                                            match: freshM || m, 
                                            catId: highestOtherOpw.catId,
                                            lockedScore: highestOtherOpw.score
                                          }); 
                                        }}
                                        className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm font-black whitespace-nowrap cursor-pointer" 
                                        title={`Highest other (${getCategoryShortLabel(highestOtherOpw.catId)}): ${highestOtherOpw.score.rulesHit?.length || 0} rules applied. Click to view breakdown.`}>
                                        <Zap size={10} />
                                        {getCategoryShortLabel(highestOtherOpw.catId)} {highestOtherOpw.score.totalScore > 0 ? `+${highestOtherOpw.score.totalScore}` : highestOtherOpw.score.totalScore} PTS
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                              {optScore?.activeHedgingProtocol && (
                                <div className="mt-2 text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded font-bold uppercase tracking-wider flex items-center gap-1">
                                  <Zap size={10} />
                                  {optScore.activeHedgingProtocol}
                                </div>
                              )}
                              <div className="flex justify-between items-center mt-2 border-t pt-2">
                                <div className="flex flex-col items-start gap-0.5">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                                      Legacy AI (Algo)
                                    </span>
                                    <span className="font-bold text-gray-600 px-2 py-0.5 bg-gray-100 rounded text-xs" title={m.algoReport?.prediction ? `Algo Prediction: ${m.algoReport.prediction}` : ""}>
                                      {_getAlgoPrediction(m)}
                                    </span>
                                  </div>
                                  {(() => {
                                    const cInfo = getMatchCountryAndLeague(m);
                                    if (!cInfo.display) return null;
                                    return (
                                      <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1" title={cInfo.display}>
                                        <Globe size={10} className="text-indigo-500 shrink-0" />
                                        <span>{cInfo.display}</span>
                                      </span>
                                    );
                                  })()}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className={`text-[10px] font-black uppercase tracking-tighter ${isHpr ? "text-purple-600" : "text-teal-600"}`}>
                                    {isHpr ? "HPR PREDICTS" : "SEER PREDICTS"}
                                  </span>
                                  <span
                                    className={`font-black text-white px-2 py-0.5 rounded text-xs shadow-sm ${isHpr ? "bg-purple-600" : "bg-gradient-to-r from-teal-500 to-indigo-600"} ${m.result ? (isCorrect ? "opacity-100" : "opacity-70") : ""}`}
                                  >
                                    {pred}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {totalTestPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-gray-200 bg-white px-4 py-3 rounded-lg mt-2 gap-3 shadow-xs">
                          <div className="text-xs text-gray-700 font-medium">
                            Showing <span className="font-bold">{(testMatchesPage - 1) * TEST_PAGE_SIZE + 1}</span> to <span className="font-bold">{Math.min(testMatchesPage * TEST_PAGE_SIZE, totalTestMatches)}</span> of <span className="font-bold">{totalTestMatches}</span> matches
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setTestMatchesPage((p) => Math.max(1, p - 1))}
                              disabled={testMatchesPage <= 1}
                              className="px-3 py-1.5 text-xs font-bold rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              Previous
                            </button>
                            <span className="text-xs text-gray-600 font-bold px-2">
                              Page {testMatchesPage} of {totalTestPages}
                            </span>
                            <button
                              onClick={() => setTestMatchesPage((p) => Math.min(totalTestPages, p + 1))}
                              disabled={testMatchesPage >= totalTestPages}
                              className="px-3 py-1.5 text-xs font-bold rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
              )}
            </div>
          </div>
        </div>
        ) : activeTab === "slips" ? (
          <SeerSlipSuggester
            liveMatches={liveMatches}
            historicalMatches={historicalMatches}
            matchesToProcess={matchesToProcess}
            phaStatsMap={phaStatsMap}
            currentWeights={currentWeights}
            predictWithSeer={_predictWithSeer}
            getMatchScore={_getMatchScore}
            matchStars={matchStars}
            selectedDate={selectedDate}
            historyType={historyType}
            lockedSlips={activeLockedSlips}
            setLockedSlips={setLockedSlips}
            setLockedAiSlips={setLockedAiSlips}
            categoryWeightsMap={categoryWeightsMap}
            isSlipsLoading={isSlipsLoading}
            getMatchesForCategory={getMatchesForCategory}
            categoriesList={categoriesList}
            todayStr={todayStr}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        ) : activeTab === "optimized" ? (
          <div className="flex-1 overflow-auto bg-slate-50 p-4">
            <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-pink-100 text-pink-600 rounded-lg">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">Optimized Weights System</h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Configure advanced category-specific weighting for slip selections.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.keys(OPTIMIZED_CATEGORY_SETTINGS).map(catId => (
                    <button
                      key={catId}
                      className="text-left p-4 rounded-xl border-2 border-slate-200 hover:border-pink-400 hover:bg-pink-50 transition-all group"
                      onClick={() => setOwSettingsCategory(catId)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-700 group-hover:text-pink-700">
                          {OPTIMIZED_CATEGORY_SETTINGS[catId].name}
                        </span>
                        <Settings2 size={16} className="text-slate-400 group-hover:text-pink-500" />
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {OPTIMIZED_CATEGORY_SETTINGS[catId].description}
                      </p>
                    </button>
                  ))}
                </div>
                
                <div className="mt-8 p-4 bg-slate-100 rounded-lg border border-slate-200">
                  <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Database size={16} /> Base Points Logic (Global)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-slate-600">
                    <div className="flex justify-between p-2 bg-white rounded shadow-sm">
                      <span className="font-mono">&ge; 60% PHA</span>
                      <span className="font-bold text-pink-600">35 pts</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded shadow-sm">
                      <span className="font-mono">&ge; 50% PHA</span>
                      <span className="font-bold text-pink-600">30 pts</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded shadow-sm">
                      <span className="font-mono">&ge; 45% PHA</span>
                      <span className="font-bold text-pink-600">25 pts</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded shadow-sm">
                      <span className="font-mono">&ge; 40% PHA</span>
                      <span className="font-bold text-pink-600">20 pts</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded shadow-sm">
                      <span className="font-mono">34% - 39% PHA</span>
                      <span className="font-bold text-pink-600">15 pts</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded shadow-sm">
                      <span className="font-mono">&lt; 34% PHA</span>
                      <span className="font-bold text-pink-600">10 pts</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-3 italic">
                    * The PHA percentage is determined by evaluating the Market Favorite (team with lowest odds). 
                    If Market Favorite is 2, it checks Away Team PHA win %.
                  </p>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <TrendingUp className="text-indigo-600" size={20} />
                    </div>
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                      Current Period Accuracy
                    </span>
                  </div>
                  <div className="text-4xl font-black text-slate-900">
                    {performanceData.length > 0
                      ? performanceData[performanceData.length - 1].accuracy
                      : 0}
                    %
                  </div>
                </div>
                <div className="mt-4 text-xs font-medium text-slate-400">
                  Based on last {performanceData.length} active sessions
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-teal-50 rounded-lg">
                      <Award className="text-teal-600" size={20} />
                    </div>
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                      Top Performing Category
                    </span>
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {
                      categoriesList.find((c) => c.id === selectedCategory)
                        ?.label
                    }
                  </div>
                </div>
                <div className="mt-4 text-xs font-medium text-slate-400">
                  Switch categories to view specific stats
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <Brain className="text-purple-600" size={20} />
                    </div>
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                      SEER Confidence
                    </span>
                  </div>
                  <div className="text-4xl font-black text-slate-900">
                    {Math.min(
                      100,
                      Math.round(
                        (currentWeights.probConfWeight +
                          currentWeights.phaWeight +
                          currentWeights.perfStarsWeight) /
                          1.5,
                      ),
                    )}
                    %
                  </div>
                </div>
                <div className="mt-4 text-xs font-medium text-slate-400">
                  Calculated from weighted variable distribution
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                <BarChart2 className="text-purple-600" size={20} />
                Historical Accuracy Trend:{" "}
                {categoriesList.find((c) => c.id === selectedCategory)?.label}
              </h3>

              <div className="h-[300px] w-full">
                {isFetchingStats ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <RefreshCw
                      className="animate-spin text-purple-600"
                      size={32}
                    />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Compiling Historical Data...
                    </span>
                  </div>
                ) : performanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fill: "#64748b",
                          fontWeight: 700,
                        }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{
                          fontSize: 10,
                          fill: "#64748b",
                          fontWeight: 700,
                        }}
                        tickFormatter={(val) => `${val}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "8px",
                          border: "none",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        }}
                        itemStyle={{ fontWeight: 800, fontSize: "12px" }}
                        labelStyle={{
                          fontWeight: 800,
                          color: "#64748b",
                          marginBottom: "4px",
                        }}
                      />
                      <Legend 
                        wrapperStyle={{
                          fontSize: "11px",
                          fontWeight: 700,
                          paddingTop: "10px"
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="accuracy"
                        name="Weights Overall Acc"
                        stroke="#8b5cf6"
                        strokeDasharray="5 5"
                        strokeWidth={3}
                        dot={{
                          r: 4,
                          fill: "#8b5cf6",
                          strokeWidth: 2,
                          stroke: "#fff",
                        }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="goalAccuracy"
                        name="Weights Goal Acc"
                        stroke="#06b6d4"
                        strokeDasharray="5 5"
                        strokeWidth={3}
                        dot={{
                          r: 4,
                          fill: "#06b6d4",
                          strokeWidth: 2,
                          stroke: "#fff",
                        }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                      {performanceData.some((p) => p.aiAccuracy !== undefined && p.aiAccuracy !== null) && (
                        <>
                          <Line
                            type="monotone"
                            dataKey="aiAccuracy"
                            name="AI Analysis Overall Acc"
                            stroke="#f59e0b"
                            strokeWidth={4}
                            dot={{
                              r: 6,
                              fill: "#f59e0b",
                              strokeWidth: 2,
                              stroke: "#fff",
                            }}
                            activeDot={{ r: 8, strokeWidth: 0 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="aiGoalAccuracy"
                            name="AI Analysis Goal Acc"
                            stroke="#ef4444"
                            strokeWidth={4}
                            dot={{
                              r: 6,
                              fill: "#ef4444",
                              strokeWidth: 2,
                              stroke: "#fff",
                            }}
                            activeDot={{ r: 8, strokeWidth: 0 }}
                          />
                        </>
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <AlertTriangle className="text-slate-300" size={32} />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      No historical data points found in this range.
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mt-6">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                <Calendar className="text-indigo-600" size={20} />
                Day of Week Performance (Last 8 Weeks)
              </h3>
              
              {isFetchingStats ? (
                  <div className="w-full h-[150px] flex flex-col items-center justify-center gap-2 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <RefreshCw className="animate-spin text-purple-600" size={32} />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      Compiling 8-Week Averages...
                    </span>
                  </div>
              ) : dowStats && dowStats.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {dowStats.map((d: any) => (
                    <div key={d.day} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center flex flex-col items-center justify-between">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">{d.day}</span>
                      <div className="flex flex-col gap-1 items-center w-full">
                        <div className="flex flex-col items-center">
                          <span className="text-[9px] font-black text-cyan-600 uppercase tracking-wider">Goal Acc</span>
                          <span className={`text-base font-black ${d.goalAccuracy >= 70 ? 'text-cyan-600' : d.goalAccuracy >= 50 ? 'text-amber-500' : 'text-slate-600'}`}>
                            {d.samples > 0 ? `${d.goalAccuracy}%` : '-'}
                          </span>
                        </div>
                        <div className="flex flex-col items-center pt-1 border-t border-slate-200/70 w-full">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Overall Acc</span>
                          <span className={`text-xs font-black ${d.accuracy >= 70 ? 'text-emerald-600' : d.accuracy >= 50 ? 'text-amber-500' : 'text-slate-500'}`}>
                            {d.samples > 0 ? `${d.accuracy}%` : '-'}
                          </span>
                        </div>
                        {d.samples > 0 && (
                          <span className="text-[9px] font-bold text-slate-400 mt-0.5">({d.samples} {d.samples === 1 ? 'slip' : 'slips'})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>


            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-black text-slate-800 flex items-center gap-2">
                  <ListOrdered className="text-indigo-600" size={20} />
                  Latest Finalized Performance (Last 10 Days)
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Active Weights Applied
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">
                        Snapshot Vol.
                      </th>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">
                        Last Acc. (Overall)
                      </th>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">
                        Goal Accuracy
                      </th>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">
                        Trend
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categoriesList
                      .filter((c) => c.id !== "all")
                      .map((cat) => {
                        const statsMatches =
                          latestSnapshotMatches.length > 0
                            ? latestSnapshotMatches
                            : matchesToProcess;
                        const catMatches = getMatchesForCategory(
                          statsMatches,
                          cat.id,
                        );
                        const acc = getAccuracy(
                          catMatches,
                          categoryWeightsMap[cat.id] || DEFAULT_WEIGHTS,
                          cat.id,
                        );
                        const goalAcc = getGoalAccuracy(
                          catMatches,
                          categoryWeightsMap[cat.id] || DEFAULT_WEIGHTS,
                          cat.id,
                        );
                        const isSelected = selectedCategory === cat.id;

                        return (
                          <tr
                            key={cat.id}
                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? "bg-indigo-50/30" : ""}`}
                            onClick={() => setSelectedCategory(cat.id)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-2 h-2 rounded-full ${isSelected ? "bg-indigo-500 animate-pulse" : "bg-slate-300"}`}
                                ></div>
                                <span
                                  className={`text-sm font-bold ${isSelected ? "text-indigo-700" : "text-slate-700"}`}
                                >
                                  {cat.label}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                {catMatches.length}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span
                                className={`text-sm font-black ${acc >= 75 ? "text-emerald-600" : acc >= 50 ? "text-amber-600" : "text-slate-400"}`}
                              >
                                {acc > 0 ||
                                (catMatches.length > 0 &&
                                  catMatches.some(
                                    (m) => getActualResult(m.result) !== "pending",
                                  ))
                                  ? `${Math.round(acc)}%`
                                  : "-"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span
                                className={`text-sm font-black ${goalAcc >= 75 ? "text-cyan-600" : goalAcc >= 50 ? "text-amber-600" : "text-slate-400"}`}
                              >
                                {goalAcc > 0 ||
                                (catMatches.length > 0 &&
                                  catMatches.some(
                                    (m) => getActualResult(m.result) !== "pending",
                                  ))
                                  ? `${Math.round(goalAcc)}%`
                                  : "-"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="flex justify-end">
                                {acc >= 70 ? (
                                  <TrendingUp
                                    size={14}
                                    className="text-emerald-500"
                                  />
                                ) : (
                                  <div className="w-3.5 h-3.5 border-b-2 border-slate-200"></div>
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-xl text-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-10 transition-transform group-hover:scale-110 duration-500">
                <Zap size={120} />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="max-w-md">
                  <h4 className="text-2xl font-black mb-2 flex items-center gap-2">
                    <Target className="text-teal-400" />
                    Performance Integrity Audit
                  </h4>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    The SEER engine cross-references legacy AI predictions
                    against real-world outcomes to calculate variable weight
                    shifts. Historical accuracy points are calculated using your
                    local EAT boundary (8 AM EAT) to ensure session consistency.
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-white/10 text-center min-w-[120px]">
                    <div className="text-[10px] font-black text-teal-400 uppercase mb-1">
                      Live Window
                    </div>
                    <div className="text-2xl font-black">10 DAYS</div>
                  </div>
                  <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm border border-white/10 text-center min-w-[120px]">
                    <div className="text-[10px] font-black text-amber-400 uppercase mb-1">
                      Sync Points
                    </div>
                    <div className="text-2xl font-black">ACTIVE</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <OptimizedWeightsSettingsModal 
        isOpen={owSettingsCategory !== null}
        onClose={() => setOwSettingsCategory(null)}
        categoryId={owSettingsCategory}
      />
      {owModalMatch && (
        <OptimizedWeightsModal
          isOpen={true}
          onClose={() => setOwModalMatch(null)}
          match={owModalMatch.match}
          phaStatsMap={phaStatsMap}
          categoryId={owModalMatch.catId}
          lockedScore={owModalMatch.lockedScore}
          dayOverride={getMatchDayOfWeek(owModalMatch.match)}
        />
      )}
    </div>
  );
}

const WeightBar = ({
  label,
  val,
  desc,
  color,
}: {
  label: string;
  val: number;
  desc: string;
  color: string;
}) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="font-bold text-gray-700">
          {label} <span className="text-gray-400 font-normal">{desc}</span>
        </span>
        <span className="font-bold text-indigo-900">{val}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`${color} h-full rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, val * 3)}%` }}
        ></div>
      </div>
    </div>
  );
};

function SeerSlipSuggester({
  liveMatches,
  historicalMatches = [],
  matchesToProcess,
  phaStatsMap,
  currentWeights,
  predictWithSeer,
  getMatchScore,
  matchStars,
  selectedDate,
  historyType,
  lockedSlips,
  setLockedSlips,
  setLockedAiSlips,
  categoryWeightsMap,
  isSlipsLoading,
  getMatchesForCategory,
  categoriesList,
  todayStr,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
}: any) {
  const isToday = selectedDate === todayStr;
  const currentDayOfWeek = useMemo(() => getMatchDayOfWeek({ date: selectedDate } as Match), [selectedDate]);

  const matchMapIndex = useMemo(() => {
    const byIdFinalized = new Map<string, any>();
    const byTeamFinalized = new Map<string, any>();
    const byIdAny = new Map<string, any>();
    const byTeamAny = new Map<string, any>();

    const allSources = [
      ...(matchesToProcess || []),
      ...(liveMatches || [])
    ].filter((m: any) => getLogicalDate(m.date, m.time) === selectedDate);

    for (const m of allSources) {
      const mId = m.id?.toString() || "";
      const normMTeam = (m.teams || "").toLowerCase().replace(/[^a-z0-9]/g, '');
      const hasResult = getActualResult(m.result) !== 'pending';

      if (hasResult) {
        if (mId && !byIdFinalized.has(mId)) byIdFinalized.set(mId, m);
        if (normMTeam && !byTeamFinalized.has(normMTeam)) byTeamFinalized.set(normMTeam, m);
      }
      if (mId && !byIdAny.has(mId)) byIdAny.set(mId, m);
      if (normMTeam && !byTeamAny.has(normMTeam)) byTeamAny.set(normMTeam, m);
    }

    return { byIdFinalized, byTeamFinalized, byIdAny, byTeamAny, allSources };
  }, [matchesToProcess, liveMatches, selectedDate]);

  const findMatchWithResult = (pId: string, pTeam: string, fallbackActual?: string) => {
    const normPTeam = (pTeam || "").toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Prioritize match with finalized result via Map lookup
    let match = matchMapIndex.byIdFinalized.get(pId) || 
      (normPTeam ? matchMapIndex.byTeamFinalized.get(normPTeam) : undefined);

    // 2. Fallback to any matching match via Map lookup
    if (!match) {
      match = matchMapIndex.byIdAny.get(pId) || 
        (normPTeam ? matchMapIndex.byTeamAny.get(normPTeam) : undefined);
    }

    // 3. Fallback for prefix composite IDs if any
    if (!match) {
      match = matchMapIndex.allSources.find((m: any) => {
        const mId = m.id?.toString() || "";
        return mId && pId && (pId.startsWith(mId + "_") || mId.startsWith(pId + "_"));
      });
    }

    if (match) {
      const act = getActualResult(match.result);
      if ((!act || act === 'pending') && fallbackActual && fallbackActual !== 'pending') {
        return { ...match, result: fallbackActual };
      }
      return match;
    }
    return null;
  };

  const [isLoading, setIsLoading] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  
  // AI specific states
  const [selectedAiModel, setSelectedAiModel] = useState<string>("gemini-3.8-flash");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiGenProgress, setAiGenProgress] = useState<{
    currentCategoryIndex: number;
    currentCategoryName: string;
    status: string;
  } | null>(null);

  const [isSelfLearning, setIsSelfLearning] = useState(false);
  const [lessonsList, setLessonsList] = useState<SelfLearnLesson[]>([]);
  const [showLessonsPanel, setShowLessonsPanel] = useState(false);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [owModalMatch, setOwModalMatch] = useState<{ match: Match; catId: string; lockedScore?: any } | null>(null);

  const unlockedCategoriesRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    unlockedCategoriesRef.current = {};
    loadLessons();
  }, [selectedDate, historyType]);

  const loadLessons = () => {
    try {
      const existingStr = localStorage.getItem("seer_ai_self_learn_lessons") || "[]";
      let lessons = JSON.parse(existingStr) as SelfLearnLesson[];
      
      // Reverse any approved self learn recommendations that interfered with slip selection/size constraints
      let modified = false;
      lessons = lessons.map(l => {
        if (l.status === 'approved') {
          modified = true;
          return { ...l, status: 'rejected' as const };
        }
        return l;
      });
      
      if (modified) {
        localStorage.setItem("seer_ai_self_learn_lessons", JSON.stringify(lessons));
      }
      
      setLessonsList(lessons);
    } catch (e) {
      console.error("Failed to parse or reverse lessons", e);
    }
  };

  const handleReverseAllApprovedLessons = () => {
    try {
      const existingStr = localStorage.getItem("seer_ai_self_learn_lessons") || "[]";
      let lessons = JSON.parse(existingStr) as SelfLearnLesson[];
      lessons = lessons.map(l => ({ ...l, status: 'rejected' as const }));
      localStorage.setItem("seer_ai_self_learn_lessons", JSON.stringify(lessons));
      setLessonsList(lessons);
      alert("All approved self-learn recommendations have been reversed and marked as rejected.");
    } catch (e) {
      console.error("Failed to reverse approved lessons", e);
    }
  };

  const handleToggleLessonStatus = (lessonId: string) => {
    try {
      const existingStr = localStorage.getItem("seer_ai_self_learn_lessons") || "[]";
      let lessons = JSON.parse(existingStr) as SelfLearnLesson[];
      lessons = lessons.map(l => {
        if (l.id === lessonId) {
          const nextStatus = l.status === 'approved' ? 'rejected' : 'approved';
          return { ...l, status: nextStatus };
        }
        return l;
      });
      localStorage.setItem("seer_ai_self_learn_lessons", JSON.stringify(lessons));
      setLessonsList(lessons);
    } catch (e) {
      console.error("Failed to toggle lesson status", e);
    }
  };

  const handleWipeAndSync = async () => {
    if (!confirm("Are you sure you want to wipe ALL SEER AI slips for this date?")) return;
    setIsWiping(true);
    try {
      const allCats = categoriesList.map((c: any) => c.id).filter((c: any) => c !== "all");
      for (const catId of allCats) {
        try {
          await deleteLockedSlip(selectedDate, `ai_${catId}`);
        } catch (e) {
          console.error("Failed to delete", catId, e);
        }
      }
      setLockedSlips({});
      setLockedAiSlips({});
      unlockedCategoriesRef.current = {};
      window.dispatchEvent(new Event("seerLockedSlipsUpdated"));
    } finally {
      setIsWiping(false);
    }
  };

  const handleGenerateSlipsWithAI = async () => {
    if (matchesToProcess.length === 0) {
      alert("No matches available to process for the selected date.");
      return;
    }
    setIsGeneratingAi(true);
    setAiGenProgress({
      currentCategoryIndex: 0,
      currentCategoryName: "",
      status: "Initializing SEER AI Slip Master..."
    });

    try {
      let activeCats = categoriesList.filter((c: any) => c.id !== "all");
      if (selectedCategory && selectedCategory !== "all") {
        activeCats = categoriesList.filter((c: any) => c.id === selectedCategory);
      }

      for (let i = 0; i < activeCats.length; i++) {
        const cat = activeCats[i];
        setAiGenProgress({
          currentCategoryIndex: i,
          currentCategoryName: cat.label,
          status: `Analyzing database & compiling cognitive parameters for ${cat.label}...`
        });

        // Small yield to allow React rendering
        await new Promise((resolve) => setTimeout(resolve, 300));

        let selections: any[] = [];
        try {
          // Call Gemini AI using ALL available candidate matches (not pre-selected optimized slips)
          selections = await selectSlipsWithAI(
            cat,
            matchesToProcess,
            phaStatsMap,
            matchStars,
            historyType === "jackpot",
            selectedAiModel
          );
        } catch (err) {
          console.warn(`Gemini AI slip generation failed for ${cat.id}, using AI Cognitive Selection engine`, err);
        }

        // Fallback to independent AI Cognitive Selection engine if Gemini AI returned empty
        if (!selections || selections.length === 0) {
          const cogSlips = generateSeerAiCognitiveSlips(
            matchesToProcess,
            phaStatsMap,
            matchStars,
            historyType === "jackpot"
          );
          const rawCogPicks = (historyType === "jackpot" ? cogSlips.spec[cat.id] : (cogSlips.live[cat.id] || cogSlips.spec[cat.id])) || [];
          selections = rawCogPicks.map((p: any) => ({
            match_id: p.match_id,
            team: p.team,
            prediction: p.prediction,
            odds: p.odds,
            reason: p.reason,
            confidence: p.confidence
          }));
        }

        let picks: AiPick[] = (selections || []).map((p: any) => {
          const matchingMatch = matchesToProcess.find((m: any) => m.id?.toString() === p.match_id?.toString());
          const matchDay = matchingMatch ? (getMatchDayOfWeek(matchingMatch) || currentDayOfWeek) : currentDayOfWeek;
          const optScore = (matchingMatch && phaStatsMap) ? getOptimizedScoreDetailed(matchingMatch, cat.id, phaStatsMap, matchDay) : null;
          const hedgedPred = ensureHedgedPrediction(p.prediction, matchingMatch, phaStatsMap);
          const actual = matchingMatch ? getActualResult(matchingMatch.result) : undefined;
          const isFinished = actual && actual !== "pending";
          const displayScore = (matchingMatch?.result && matchingMatch.result.includes(':')) ? matchingMatch.result : actual;
          const outcome: "Pending" | "Correct" | "Incorrect" = (isFinished && matchingMatch)
            ? (isMatchCorrectForCategory(matchingMatch, hedgedPred, actual, cat.id, phaStatsMap) ? "Correct" : "Incorrect")
            : "Pending";

          return {
            match_id: p.match_id,
            team: p.team,
            prediction: hedgedPred,
            actualResult: isFinished ? displayScore : undefined,
            outcome,
            odds: p.odds || "1.0",
            reason: p.reason || "AI Cognitive selected matching parameters",
            confidence: p.confidence || "100%",
            category: cat.id,
            le: matchingMatch?.le || p.le || '',
            l10: matchingMatch?.l10 || p.l10 || '',
            rating: matchingMatch?.rating || p.rating || '',
            gs: matchingMatch?.gs || p.gs || '',
            ga: matchingMatch?.ga || p.ga || '',
            league: matchingMatch?.league || p.league || '',
            evaluatorTags: matchingMatch?.evaluatorTags || p.evaluatorTags || [],
            opwPoints: optScore?.totalScore,
            opwRulesHit: optScore?.rulesHit,
            opwBaseInfo: optScore?.baseInfo,
          };
        });

        if (picks.length > 0) {
          const targetCatId = `ai_${cat.id}`;
          const slip: SeerLockedSlip = {
            id: `${selectedDate}_${targetCatId}`,
            date: selectedDate,
            category: targetCatId,
            picks: picks,
            backups: [],
            weightsAtTime: DEFAULT_WEIGHTS,
            createdAt: new Date().toISOString(),
            type: historyType,
          };

          await saveLockedSlip(slip, true);
          
          // Save locally to display immediately in both AI Slips tab and Standard Slips tab
          setLockedAiSlips((prev: any) => ({
            ...prev,
            [cat.id]: { ...slip, category: cat.id }
          }));
          setLockedSlips((prev: any) => ({
            ...prev,
            [cat.id]: { ...slip, category: cat.id }
          }));
          try {
            window.dispatchEvent(new Event("seerLockedSlipsUpdated"));
          } catch (e) {}
        } else {
          console.warn(`No AI selections generated for ${cat.label} via Gemini AI.`);
        }
      }

      setAiGenProgress(null);
      alert("Successfully finalized all SEER AI Slips sequentially!");
    } catch (e: any) {
      console.error("AI Slip generation failed:", e);
      alert(`AI Generation failed: ${e.message || e}`);
      setAiGenProgress(null);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSelfLearn = async () => {
    if (!selectedCategory || selectedCategory === "all") {
      alert("Please select a specific category for self learning.");
      return;
    }
    const catObj = categoriesList.find((c: any) => c.id === selectedCategory);
    if (!catObj) return;

    setIsSelfLearning(true);
    try {
      const activeCats = [catObj];

      // Compile live analysis candidate matches & their predictions for each category
      const liveCategoryMatches: Record<string, { match: any; prediction: string }[]> = {};
      const catMatches = getMatchesForCategory(matchesToProcess, catObj.id, false);
      const catWeights = categoryWeightsMap[catObj.id] || DEFAULT_WEIGHTS;
      
      liveCategoryMatches[catObj.id] = catMatches.map((m: any) => {
        const pred = m.mlInfo?.mlPrediction || m.finalPrediction || m.rawPrediction || "1";
        return {
          match: m,
          prediction: pred
        };
      });

      const lessonResult = await runSelfLearnReflectiveCycle(
        selectedDate,
        activeCats,
        lockedSlips,
        matchesToProcess,
        phaStatsMap,
        matchStars,
        liveCategoryMatches,
        selectedAiModel
      );

      loadLessons();
      setExpandedLessonId(lessonResult.id);
      setShowLessonsPanel(true);
      
      const liveMsg = lessonResult.totalLiveCandidatesEvaluated && lessonResult.totalLiveCandidatesEvaluated > 0
        ? `\nLive Candidates Evaluated: ${lessonResult.totalLiveCandidatesEvaluated} (Accuracy: ${lessonResult.liveCandidatesAccuracy}%)`
        : "";
      alert(`Post-Match Self-Learning completed!\nOverall Accuracy: ${lessonResult.overallAccuracy}%\nGoal Accuracy: ${lessonResult.goalAccuracy}%${liveMsg}`);
    } catch (e: any) {
      console.error("Self learning error:", e);
      alert(`Self learning failed: ${e.message || e}`);
    } finally {
      setIsSelfLearning(false);
    }
  };

  const handleLockSlip = async (catId: string, picks: any[]) => {
    const baseId = catId;
    const catWeights = getWeightsForCategory(baseId);

    const targetCatId = `ai_${catId}`;
    const cleanCat = catId.replace(/^ai_/, '').replace(/^sandbox_/, '');

    // Ensure picks in handleLockSlip retain any known results from matchesToProcess
    const hydratedPicks = (picks || []).map((p: any) => {
      if (p.actualResult && p.actualResult !== 'pending') return p;
      const pId = p.match_id?.toString() || "";
      const normPTeam = (p.team || "").toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = matchesToProcess?.find((m: any) => {
        const mId = m.id?.toString() || "";
        const normMTeam = (m.teams || "").toLowerCase().replace(/[^a-z0-9]/g, '');
        const idMatch = mId === pId || pId.startsWith(mId + "_") || mId.startsWith(pId + "_");
        const teamMatch = normPTeam.length > 0 && normMTeam.length > 0 && (
          normMTeam === normPTeam || normMTeam.includes(normPTeam) || normPTeam.includes(normMTeam)
        );
        return (idMatch || teamMatch) && getActualResult(m.result) !== 'pending';
      });
      if (found) {
        const actual = getActualResult(found.result);
        if (actual && actual !== 'pending') {
          const displayScore = (found.result && found.result.includes(':')) ? found.result : actual;
          const outcome: "Pending" | "Correct" | "Incorrect" = isMatchCorrectForCategory(found, p.prediction, actual, cleanCat, phaStatsMap) ? "Correct" : "Incorrect";
          return { ...p, actualResult: displayScore, outcome };
        }
      }
      return p;
    });

    const slip: SeerLockedSlip = {
      id: `${selectedDate}_${targetCatId}`,
      date: selectedDate,
      category: targetCatId,
      picks: hydratedPicks,
      backups: [],
      weightsAtTime: catWeights,
      createdAt: new Date().toISOString(),
      type: historyType,
    };

    try {
      await saveLockedSlip(slip, true);
    } catch (error) {
      console.warn("Supabase save failed for locked slip, updating local state only.", error);
    }
    setLockedAiSlips((prev: any) => ({ ...prev, [catId]: { ...slip, category: catId } }));
    setLockedSlips((prev: any) => ({ ...prev, [catId]: { ...slip, category: catId } }));
  };

  const handleUnlockSlip = async (catId: string) => {
    if (
      !confirm(
        "Delete locked slip for this category? A fresh slip will be generated and locked immediately.",
      )
    )
      return;

    try {
      await deleteLockedSlip(selectedDate, catId);
      await deleteLockedSlip(selectedDate, `ai_${catId}`);
    } catch (error) {
      console.warn("Failed to delete from Supabase, deleting locally.", error);
    }
    unlockedCategoriesRef.current[catId] = true;
    setLockedAiSlips((prev: any) => {
      const next = { ...prev };
      delete next[catId];
      return next;
    });
    setLockedSlips((prev: any) => {
      const next = { ...prev };
      delete next[catId];
      return next;
    });

    window.dispatchEvent(new Event("resetSeerAutomation"));
    window.dispatchEvent(new Event("seerLockedSlipsUpdated"));
  };

  const getWeightsForCategory = (catId: string) => {
    let mappedKey = catId;
    if (catId === "safety") {
      mappedKey = "best_bet";
    } else if (catId === "banker") {
      mappedKey = "bankers_dlive";
    } else if (catId === "upset") {
      mappedKey = "upsets";
    } else if (catId === "jackpot") {
      mappedKey = "top_12_value";
    }

    const modePrefix = historyType === "jackpot" ? "jackpot_" : "daily_";
    const effectiveKey = `${modePrefix}${mappedKey}`;

    return (
      categoryWeightsMap[effectiveKey] ||
      categoryWeightsMap[mappedKey] ||
      categoryWeightsMap[`${modePrefix}${catId}`] ||
      categoryWeightsMap[catId] ||
      DEFAULT_WEIGHTS
    );
  };

  const matchDetailsCacheRef = useRef<Record<string, any>>({});
  
  useEffect(() => {
    matchDetailsCacheRef.current = {};
  }, [matchesToProcess, phaStatsMap, categoryWeightsMap, currentWeights]);

  const getMatchDetails = (m: any, catId?: string) => {
    const cacheKey = `${m.id}-${catId || 'default'}`;
    if (matchDetailsCacheRef.current[cacheKey]) {
      return matchDetailsCacheRef.current[cacheKey];
    }

    const tags = getMatchEvaluatorTags(m, phaStatsMap, false, true);
    const hardBans = tags.filter(
      (t) => t.startsWith("BANNED:") && t !== "PHA_TIE",
    );
    const hasHardBan = hardBans.length > 0;
    const hasPhaTie = tags.includes("PHA_TIE");

    const weights = catId ? getWeightsForCategory(catId) : currentWeights;

    const p1 = getMatchScore(m, "1", weights);
    const p2 = getMatchScore(m, "2", weights);
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

    const result = {
      tags,
      hasHardBan,
      hasPhaTie,
      p1,
      p2,
      isBanker,
      isUpset,
      conflictRes,
    };
    matchDetailsCacheRef.current[cacheKey] = result;
    return result;
  };

  const renderSlipCard = (cat: any) => {
    const isLocked = !!lockedSlips[cat.id];
    const lockedData = lockedSlips[cat.id];
    const baseCatId = cat.id;
    const catWeights = getWeightsForCategory(baseCatId);

    if (isSlipsLoading || !isLocked) {
      return (
        <div
          key={cat.id}
          className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col opacity-75"
        >
          <div className="bg-slate-800 p-3 flex justify-between items-center text-white">
            <h3 className="font-bold flex items-center gap-2 text-sm text-gray-300">
               <Award className="text-gray-500 shrink-0" size={16} />
               {cat.label}
            </h3>
          </div>
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mb-3" />
            <span className="text-xs font-bold text-slate-700">Loading slip...</span>
          </div>
        </div>
      );
    }

    const matchesToShow = (lockedData?.picks || []).map((p: any) => {
      const pId = p.match_id?.toString() || "";
      const pTeam = p.team || "";
      const matchingMatch = findMatchWithResult(pId, pTeam, p.actualResult);
      const lockedOpwScore = p.opwPoints !== undefined ? {
        totalScore: p.opwPoints,
        rulesHit: p.opwRulesHit || [],
        baseInfo: p.opwBaseInfo || { points: 0, mFav: '', phaPercentage: 0, isUnderdogBase: false }
      } : (matchingMatch?.lockedOpwScore || undefined);
      
      if (matchingMatch) {
        const act = getActualResult(matchingMatch.result);
        const finalResult = (act && act !== 'pending') ? matchingMatch.result : (p.actualResult || matchingMatch.result || "-");
        return {
          ...matchingMatch,
          result: finalResult,
          targetPrediction: p.prediction,
          aiReason: p.reason,
          aiConfidence: p.confidence,
          le: matchingMatch.le || p.le || '',
          l10: matchingMatch.l10 || p.l10 || '',
          rating: matchingMatch.rating || p.rating || '',
          isHprOverride: p.isHprOverride || false,
          gs: matchingMatch.gs || p.gs || '',
          ga: matchingMatch.ga || p.ga || '',
          league: matchingMatch.league || p.league || '',
          evaluatorTags: matchingMatch.evaluatorTags || p.evaluatorTags || [],
          lockedOpwScore,
        };
      }
      return {
        id: p.match_id,
        teams: p.team,
        mo: p.odds,
        result: p.actualResult || "-",
        targetPrediction: p.prediction,
        aiReason: p.reason,
        aiConfidence: p.confidence,
        le: p.le || "-",
        l10: p.l10 || "-",
        rating: p.rating || "-",
        isHprOverride: p.isHprOverride || false,
        isStub: true,
        gs: p.gs || '',
        ga: p.ga || '',
        league: p.league || '',
        evaluatorTags: p.evaluatorTags || [],
        lockedOpwScore,
      };
    });

    return (
      <div
        key={cat.id}
        className={`bg-white rounded-xl shadow-sm border ${isLocked ? "border-teal-500 ring-1 ring-teal-200" : "border-slate-200"} overflow-hidden flex flex-col`}
      >
        <div
          className={`${isLocked ? "bg-gradient-to-r from-teal-600 to-indigo-700" : "bg-slate-900"} p-3 flex justify-between items-center text-white`}
        >
          <h3 className="font-bold flex items-center gap-2 text-sm">
            {isLocked ? (
              <ShieldCheck className="text-teal-300 shrink-0" size={16} />
            ) : (
              <Award className="text-gray-400 shrink-0" size={16} />
            )}
            <span className="truncate">{cat.label}</span>
            {isLocked && (
              <span className="text-[9px] font-black bg-white/20 px-1.5 py-0.5 rounded uppercase tracking-widest ml-1 shrink-0 text-white">
                AI SELECTED
              </span>
            )}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {(() => {
              let completedCount = 0;
              let correctCount = 0;
              let goalCorrectCount = 0;
              matchesToShow.slice(0, cat.maxPicks || 10).forEach((m: any) => {
                const actual = getActualResult(m.result || "");
                if (actual && actual !== "pending") {
                  completedCount++;
                  const rawPred = m.targetPrediction || m.mlInfo?.mlPrediction || m.finalPrediction || m.rawPrediction || "1";
                  let pred = ensureHedgedPrediction(rawPred, m, phaStatsMap);
                  const matchDay = getMatchDayOfWeek(m);
                  const liveOptScore = phaStatsMap ? getOptimizedScoreDetailed(m, baseCatId, phaStatsMap, matchDay) : null;
                  const optScore = liveOptScore || (m as any).lockedOpwScore;
                  if (optScore?.activeHedgingProtocol) {
                    pred = optScore.optimizedPrediction;
                  } else {
                    const hprPred = applyHedgingProtocol(m, pred, baseCatId, phaStatsMap, matchDay);
                    if (hprPred && hprPred !== pred) {
                      pred = hprPred;
                    }
                  }
                  pred = ensureHedgedPrediction(pred, m, phaStatsMap);
                  if (isMatchCorrectForCategory(m, pred, actual, baseCatId, phaStatsMap)) {
                    correctCount++;
                  }
                  if (isMatchGoalAccurate(m, pred, actual, baseCatId, phaStatsMap)) {
                    goalCorrectCount++;
                  }
                }
              });

              if (completedCount > 0) {
                const overallPct = Math.round((correctCount / completedCount) * 100);
                const goalPct = Math.round((goalCorrectCount / completedCount) * 100);
                return (
                  <div className="flex gap-1">
                    <span className="text-[9px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full border border-white/10" title="Overall accuracy matching exact double chance hedge">
                      OVERALL: {overallPct}% ({correctCount}/{completedCount})
                    </span>
                    <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30" title="Specific category target accuracy rules">
                      GOAL: {goalPct}%
                    </span>
                  </div>
                );
              }
              return null;
            })()}
            <span
              className={`text-[9px] ${isLocked ? "bg-white/20 text-white" : "bg-slate-800 text-slate-300"} px-2 py-0.5 rounded-full font-bold tracking-wider uppercase`}
            >
              {matchesToShow.slice(0, cat.maxPicks || 10).length} Picks
            </span>
          </div>
        </div>

        {isLocked ? (
          <div className="bg-teal-50 border-b border-teal-200 px-3 py-1.5 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-teal-800 uppercase tracking-wide flex items-center gap-1">
                <Sparkles size={11} className="text-teal-600" /> Cognitive AI Locked
              </span>
              <span className="text-[8px] text-teal-600/70 font-bold">
                Generated: {new Date(lockedData.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <button
              onClick={() => handleUnlockSlip(cat.id)}
              className="text-[9px] font-bold text-red-700 hover:text-white hover:bg-red-600 bg-red-100/50 hover:border-red-600 px-2.5 py-1 rounded border border-red-200 transition-all flex items-center gap-1 cursor-pointer font-black uppercase"
            >
              <Trash2 size={11} /> RELEASE SLIP
            </button>
          </div>
        ) : (
          <div className="bg-amber-50/70 border-b border-amber-100 p-3 text-center">
            <span className="text-[10px] font-black text-amber-800 uppercase flex items-center justify-center gap-1">
              <Sparkles size={12} className="animate-pulse text-amber-600" /> AI SELECTION PENDING
            </span>
            <p className="text-[9px] text-amber-700/80 font-medium mt-0.5">
              Click 'Generate slips via AI' above to run the cognitive evaluation.
            </p>
          </div>
        )}

        <div className="p-3 grid grid-cols-1 gap-2.5 flex-1 overflow-y-auto max-h-[520px] min-h-[140px]">
          {isLoading ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 gap-2">
              <RefreshCw
                className="animate-spin text-slate-300"
                size={24}
              />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Loading...
              </span>
            </div>
          ) : matchesToShow.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <Sparkles className="w-7 h-7 text-amber-500/70 mb-2 animate-pulse" />
              <p className="text-xs font-bold text-slate-700">No AI Slips Generated Yet</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                Click 'Generate slips via AI' above to run the independent Gemini AI engine and lock selections.
              </p>
            </div>
          ) : (
            matchesToShow.slice(0, cat.maxPicks || 10).map((m: any, idx: number) => {
              const actual = getActualResult(m.result || "");
              const isCompleted = actual && actual !== "pending" && !!m.result && m.result !== "Unknown" && m.result.toLowerCase() !== "unknown";
              const rawPred = m.targetPrediction || m.mlInfo?.mlPrediction || m.finalPrediction || m.rawPrediction || "1";
              let pred = ensureHedgedPrediction(rawPred, m, phaStatsMap);
              let isHpr = m.isHprOverride || false;
              const matchDay = getMatchDayOfWeek(m);
              const matchTags = (m.evaluatorTags && m.evaluatorTags.length > 0)
                ? m.evaluatorTags
                : getMatchEvaluatorTags(m, phaStatsMap || {}, m.isJackpot || false, true, matchStars);
              const displayCat = resolveTop20SourceCat(m, matchTags, idx, baseCatId);
              const liveOptScore = phaStatsMap ? getOptimizedScoreDetailed(m, displayCat, phaStatsMap, matchDay) : null;
              const optScore = liveOptScore || (m as any).lockedOpwScore;
              const hasUpsetsTag = matchTags.some((t: string) => t.startsWith('upsets:'));
              const isUpsetsCat = baseCatId === 'upsets' || baseCatId === 'upset' || baseCatId === 'sandbox_upsets';
              const upsetOptScore = (!isUpsetsCat && hasUpsetsTag && phaStatsMap)
                ? getOptimizedScoreDetailed(m, 'upsets', phaStatsMap, matchDay)
                : null;
              const highestOtherOpw = (isUpsetsCat && phaStatsMap)
                ? getHighestOtherOpwScore(m, matchTags, phaStatsMap, matchDay)
                : null;
              if (optScore?.activeHedgingProtocol) {
                pred = optScore.optimizedPrediction;
                isHpr = true;
              } else {
                const hprPred = applyHedgingProtocol(m, pred, baseCatId, phaStatsMap, matchDay);
                if (hprPred && hprPred !== pred) {
                  pred = hprPred;
                  isHpr = true;
                }
              }
              pred = ensureHedgedPrediction(pred, m, phaStatsMap);
              const isCorrect = isCompleted && isMatchCorrectForCategory(m, pred, actual, baseCatId, phaStatsMap);

              return (
                <div
                  key={`${m.id}_${idx}`}
                  className={`border border-gray-200 rounded p-2.5 sm:p-3 flex flex-col gap-2 hover:shadow-sm transition-shadow ${
                    isCompleted
                      ? isCorrect
                        ? "bg-emerald-50/40 border-emerald-200"
                        : "bg-red-50/40 border-red-200"
                      : isLocked 
                        ? "bg-teal-50/10 border-teal-100 hover:border-teal-300" 
                        : "bg-slate-50 border-slate-100 hover:border-indigo-200"
                  }`}
                >
                  <div className="text-xs text-gray-500 flex items-center justify-between gap-1.5 font-mono flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="bg-blue-50 px-1.5 py-0.5 rounded text-blue-700 font-bold border border-blue-100 italic text-[10px] shrink-0">
                        MO: {m.mo || "-"}
                      </span>
                      <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-gray-600 text-[10px] shrink-0">
                        LE: {m.le || "-"}
                      </span>
                      <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-gray-600 text-[10px] shrink-0 inline-flex items-baseline" title="Last 10 Matches (LDW:WDL)">
                        <L10Display l10={m.l10} showPrefix={true} />
                      </span>
                    </div>
                    <span className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 text-amber-800 font-bold text-[10px] shrink-0" title="1X2 Rating">
                      R: {(m.rating && m.rating !== "Unknown") ? m.rating : "-"}
                    </span>
                  </div>
                  <div className="text-xs font-mono flex items-center justify-between gap-1.5 pb-0.5">
                    <span className="bg-white border border-gray-300 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm" title="1X2 Prediction">
                      1X2: {m.pred1x2 || "-"}
                    </span>
                    {isCompleted && (
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded shadow-sm text-[10px] shrink-0 ${
                          isCorrect
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : "bg-red-100 text-red-700 border border-red-200"
                        }`}
                      >
                        FT: {m.result}
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-sm text-gray-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded shadow-sm opacity-90 shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="truncate">{m.teams}</span>
                    </div>
                    {(optScore || upsetOptScore || highestOtherOpw) && (
                      <div className="ml-auto flex items-center gap-1 shrink-0">
                        {optScore && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOwModalMatch({ match: m, catId: displayCat, lockedScore: liveOptScore || (m as any).lockedOpwScore }); }}
                            className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm font-black whitespace-nowrap cursor-pointer shrink-0" 
                            title={`${optScore.rulesHit?.length || 0} rules applied. Click to view breakdown.`}>
                            <Zap size={10} />
                            {getCategoryShortLabel(displayCat)} {optScore.totalScore > 0 ? `+${optScore.totalScore}` : optScore.totalScore} PTS
                          </button>
                        )}
                        {upsetOptScore && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOwModalMatch({ match: m, catId: 'upsets', lockedScore: upsetOptScore }); }}
                            className="text-[10px] bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200 transition-colors px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm font-black whitespace-nowrap cursor-pointer shrink-0" 
                            title={`Underdog (UPS): ${upsetOptScore.rulesHit?.length || 0} rules applied. Click to view breakdown.`}>
                            <Zap size={10} />
                            UPS {upsetOptScore.totalScore > 0 ? `+${upsetOptScore.totalScore}` : upsetOptScore.totalScore} PTS
                          </button>
                        )}
                        {highestOtherOpw && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOwModalMatch({ match: m, catId: highestOtherOpw.catId, lockedScore: highestOtherOpw.score }); }}
                            className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm font-black whitespace-nowrap cursor-pointer shrink-0" 
                            title={`Highest other (${getCategoryShortLabel(highestOtherOpw.catId)}): ${highestOtherOpw.score.rulesHit?.length || 0} rules applied. Click to view breakdown.`}>
                            <Zap size={10} />
                            {getCategoryShortLabel(highestOtherOpw.catId)} {highestOtherOpw.score.totalScore > 0 ? `+${highestOtherOpw.score.totalScore}` : highestOtherOpw.score.totalScore} PTS
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Render Gemini AI Confidence & Reason if locked */}
                  {isLocked && m.aiReason && (
                    <div className="mt-1 bg-slate-50 border border-slate-100 rounded p-2 text-[10px]">
                      <div className="flex justify-between font-black text-slate-500 mb-0.5">
                        <span className="uppercase text-[8px]">AI REASONING</span>
                        <span className="text-indigo-600">CONFIDENCE: {m.aiConfidence || "100%"}</span>
                      </div>
                      <p className="text-slate-600 italic font-medium leading-normal">"{m.aiReason}"</p>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-2 border-t pt-2 flex-wrap gap-2">
                    <div className="flex flex-col items-start gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                          Legacy AI (Algo)
                        </span>
                        <span className="font-bold text-gray-600 px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {_getAlgoPrediction(m)}
                        </span>
                      </div>
                      {(() => {
                        const cInfo = getMatchCountryAndLeague(m);
                        if (!cInfo.display) return null;
                        return (
                          <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1" title={cInfo.display}>
                            <Globe size={10} className="text-indigo-500 shrink-0" />
                            <span className="truncate max-w-[180px] sm:max-w-none">{cInfo.display}</span>
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-black uppercase tracking-tighter ${isHpr ? "text-purple-600" : "text-teal-600"}`}>
                        {isHpr ? "HPR PREDICTS" : isLocked ? "AI PREDICTED" : "SEER PREDICTS"}
                      </span>
                      <span
                        className={`font-black text-white px-2 py-0.5 rounded text-xs shadow-sm ${
                          isHpr
                            ? "bg-purple-600"
                            : isLocked
                            ? "bg-gradient-to-r from-teal-500 to-indigo-600"
                            : "bg-gradient-to-r from-slate-600 to-slate-800"
                        } ${
                          isCompleted ? (isCorrect ? "opacity-100" : "opacity-70") : ""
                        }`}
                      >
                        {pred}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderSingleSlipPage = () => {
    const activeCat = categoriesList.find((c: any) => c.id === selectedCategory);
    if (!activeCat) return null;

    const isLocked = !!lockedSlips[activeCat.id];
    const lockedData = lockedSlips[activeCat.id];
    const baseCatId = activeCat.id;
    const catWeights = getWeightsForCategory(baseCatId);

    if (isSlipsLoading || !isLocked) {
      return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col p-8 items-center justify-center text-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
          <span className="text-sm font-bold text-slate-700">Loading slip data...</span>
        </div>
      );
    }

    let matchesToShow = (lockedData?.picks || []).map((p: any) => {
      const pId = p.match_id?.toString() || "";
      const pTeam = p.team || "";
      const matchingMatch = findMatchWithResult(pId, pTeam, p.actualResult);
      const lockedOpwScore = p.opwPoints !== undefined ? {
        totalScore: p.opwPoints,
        rulesHit: p.opwRulesHit || [],
        baseInfo: p.opwBaseInfo || { points: 0, mFav: '', phaPercentage: 0, isUnderdogBase: false }
      } : (matchingMatch?.lockedOpwScore || undefined);
      
      if (matchingMatch) {
        const act = getActualResult(matchingMatch.result);
        const finalResult = (act && act !== 'pending') ? matchingMatch.result : (p.actualResult || matchingMatch.result || "-");
        return {
          ...matchingMatch,
          result: finalResult,
          targetPrediction: p.prediction,
          aiReason: p.reason,
          aiConfidence: p.confidence,
          le: matchingMatch.le || p.le || '',
          l10: matchingMatch.l10 || p.l10 || '',
          rating: matchingMatch.rating || p.rating || '',
          isHprOverride: p.isHprOverride || false,
          gs: matchingMatch.gs || p.gs || '',
          ga: matchingMatch.ga || p.ga || '',
          league: matchingMatch.league || p.league || '',
          evaluatorTags: matchingMatch.evaluatorTags || p.evaluatorTags || [],
          lockedOpwScore,
        };
      }
      return {
        id: p.match_id,
        teams: p.team,
        mo: p.odds,
        result: p.actualResult || "-",
        targetPrediction: p.prediction,
        aiReason: p.reason,
        aiConfidence: p.confidence,
        le: p.le || "-",
        l10: p.l10 || "-",
        rating: p.rating || "-",
        isHprOverride: p.isHprOverride || false,
        isStub: true,
        gs: p.gs || '',
        ga: p.ga || '',
        league: p.league || '',
        evaluatorTags: p.evaluatorTags || [],
        lockedOpwScore,
      };
    });

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      matchesToShow = matchesToShow.filter((m: any) => 
        (m.teams || "").toLowerCase().includes(q) ||
        (m.le || "").toLowerCase().includes(q) ||
        (m.mo || "").toLowerCase().includes(q)
      );
    }

    let completedCount = 0;
    let correctCount = 0;
    let goalCorrectCount = 0;
    matchesToShow.slice(0, activeCat.maxPicks || 10).forEach((m: any) => {
      const actual = getActualResult(m.result || "");
      if (actual && actual !== "pending") {
        completedCount++;
        const rawPred = m.targetPrediction || m.mlInfo?.mlPrediction || m.finalPrediction || m.rawPrediction || "1";
        let pred = ensureHedgedPrediction(rawPred, m, phaStatsMap);
        const matchDay = getMatchDayOfWeek(m) || currentDayOfWeek;
        const optScore = phaStatsMap ? getOptimizedScoreDetailed(m, baseCatId, phaStatsMap, matchDay) : null;
        if (optScore?.activeHedgingProtocol) {
          pred = optScore.optimizedPrediction;
        } else {
          const hprPred = applyHedgingProtocol(m, pred, baseCatId, phaStatsMap, matchDay);
          if (hprPred && hprPred !== pred) {
            pred = hprPred;
          }
        }
        pred = ensureHedgedPrediction(pred, m, phaStatsMap);
        if (isMatchCorrectForCategory(m, pred, actual, baseCatId, phaStatsMap)) {
          correctCount++;
        }
        if (isMatchGoalAccurate(m, pred, actual, baseCatId, phaStatsMap)) {
          goalCorrectCount++;
        }
      }
    });

    const overallPct = completedCount > 0 ? Math.round((correctCount / completedCount) * 100) : 0;
    const goalPct = completedCount > 0 ? Math.round((goalCorrectCount / completedCount) * 100) : 0;

    return (
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col p-6 animate-in fade-in duration-300">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <PlayCircle className="text-rose-500 fill-rose-500/10 shrink-0" size={26} />
            <h2 className="text-lg font-black text-slate-800 tracking-tight">
              Live SEER AI Slip for {activeCat.label}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="border border-slate-200 bg-white rounded px-2.5 py-1 text-xs font-bold text-slate-700 flex flex-col items-center justify-center min-w-[55px] shadow-sm">
              <span className="text-sm font-black text-slate-900 leading-none">{matchesToShow.length}</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Picks</span>
            </div>

            {completedCount > 0 && (
              <div className="border border-green-200 bg-green-50 text-green-700 rounded-md px-3 py-1.5 text-xs font-black uppercase tracking-tight flex items-center gap-1">
                OVERALL: {overallPct}% ({correctCount}/{completedCount} Evaluated)
              </div>
            )}

            {completedCount > 0 && (
              <div className="border border-indigo-250 bg-indigo-50 text-indigo-700 rounded-md px-3 py-1.5 text-xs font-black uppercase tracking-tight flex items-center gap-1">
                GOAL: {goalPct}% Accuracy
              </div>
            )}

            {isLocked ? (
              <div className="border border-amber-200 bg-amber-50 text-amber-700 rounded-md px-3 py-1.5 text-xs font-black uppercase tracking-tight flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" /> LOCKED / STICKY
              </div>
            ) : (
              <button
                onClick={() => handleLockSlip(activeCat.id, matchesToShow.map(m => {
                  const matchDay = getMatchDayOfWeek(m) || currentDayOfWeek;
                  const optScore = phaStatsMap ? getOptimizedScoreDetailed(m, baseCatId, phaStatsMap, matchDay) : null;
                  return {
                    match_id: m.id,
                    team: m.teams,
                    prediction: ensureHedgedPrediction(m.targetPrediction, m, phaStatsMap),
                    odds: m.mo?.split(",")[0] || "1.0",
                    reason: m.isHprOverride ? `HPR: Hedging Protocol Override (${m.targetPrediction})` : "Cognitive selected",
                    confidence: "100%",
                    category: activeCat.id,
                    le: m.le || '',
                    l10: m.l10 || '',
                    rating: m.rating || '',
                    gs: m.gs || '',
                    ga: m.ga || '',
                    league: m.league || '',
                    evaluatorTags: m.evaluatorTags || [],
                    opwPoints: optScore?.totalScore,
                    opwRulesHit: optScore?.rulesHit,
                    opwBaseInfo: optScore?.baseInfo,
                    isHprOverride: m.isHprOverride || false
                  };
                }))}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all shadow-sm cursor-pointer hover:scale-[1.02]"
              >
                <Target size={13} /> MAKE SELECTION STICKY
              </button>
            )}

            {isLocked && (
              <button
                onClick={() => handleUnlockSlip(activeCat.id)}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-xs font-black flex items-center gap-1 transition-all shadow-sm cursor-pointer"
              >
                <Trash2 size={13} /> DELETE LOCKED SLIP
              </button>
            )}

            <div className="relative w-full md:w-56 shrink-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={13} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search matches..."
                value={searchQuery || ""}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-8.5 pr-3 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 text-xs font-semibold shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {isLoading ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="animate-spin text-slate-400" size={28} />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                Loading candidates...
              </span>
            </div>
          ) : matchesToShow.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center text-slate-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              <Target size={32} className="mb-2 opacity-40 mx-auto text-slate-400" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {isToday ? "No matches uploaded for today yet" : "No matches found"}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                {isToday 
                  ? "Today's prediction day runs from 9:00 AM to 8:59 AM tomorrow. Upload or fetch today's matches to generate slips." 
                  : `There are no candidate matches in this category for ${selectedDate}.`}
              </p>
            </div>
          ) : (
            matchesToShow.slice(0, activeCat.maxPicks || 10).map((m: any, idx: number) => {
              const actual = getActualResult(m.result || "");
              const isCompleted = actual && actual !== "pending" && !!m.result && m.result !== "Unknown" && m.result.toLowerCase() !== "unknown";
              const rawPred = m.targetPrediction || m.mlInfo?.mlPrediction || m.finalPrediction || m.rawPrediction || "1";
              let pred = ensureHedgedPrediction(rawPred, m, phaStatsMap);
              const matchDay = getMatchDayOfWeek(m);
              const matchTags = (m.evaluatorTags && m.evaluatorTags.length > 0)
                ? m.evaluatorTags
                : getMatchEvaluatorTags(m, phaStatsMap || {}, m.isJackpot || false, true, matchStars);
              const displayCat = resolveTop20SourceCat(m, matchTags, idx, baseCatId);
              const liveOptScore = phaStatsMap ? getOptimizedScoreDetailed(m, displayCat, phaStatsMap, matchDay) : null;
              const optScore = liveOptScore || (m as any).lockedOpwScore;
              const hasUpsetsTag = matchTags.some((t: string) => t.startsWith('upsets:'));
              const isUpsetsCat = baseCatId === 'upsets' || baseCatId === 'upset' || baseCatId === 'sandbox_upsets';
              const upsetOptScore = (!isUpsetsCat && hasUpsetsTag && phaStatsMap)
                ? getOptimizedScoreDetailed(m, 'upsets', phaStatsMap, matchDay)
                : null;
              const highestOtherOpw = (isUpsetsCat && phaStatsMap)
                ? getHighestOtherOpwScore(m, matchTags, phaStatsMap, matchDay)
                : null;
              let isHpr = m.isHprOverride || false;
              if (optScore?.activeHedgingProtocol) {
                pred = optScore.optimizedPrediction;
                isHpr = true;
              } else {
                const hprPred = applyHedgingProtocol(m, pred, baseCatId, phaStatsMap, matchDay);
                if (hprPred && hprPred !== pred) {
                  pred = hprPred;
                  isHpr = true;
                }
              }
              pred = ensureHedgedPrediction(pred, m, phaStatsMap);
              const isCorrect = isCompleted && isMatchCorrectForCategory(m, pred, actual, baseCatId, phaStatsMap);

              return (
                <div
                  key={`${m.id}_${idx}`}
                  className={`border border-gray-200 rounded p-2.5 sm:p-3 flex flex-col gap-2 hover:shadow-sm transition-shadow ${
                    isCompleted
                      ? isCorrect
                        ? "bg-emerald-50/40 border-emerald-200"
                        : "bg-red-50/40 border-red-200"
                      : isLocked 
                        ? "bg-teal-50/10 border-teal-100 hover:border-teal-300" 
                        : "bg-slate-50 border-slate-100 hover:border-indigo-200"
                  }`}
                >
                  <div className="text-xs text-gray-500 flex items-center justify-between gap-1.5 font-mono flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="bg-blue-50 px-1.5 py-0.5 rounded text-blue-700 font-bold border border-blue-100 italic text-[10px] shrink-0">
                        MO: {m.mo || "-"}
                      </span>
                      <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-gray-600 text-[10px] shrink-0">
                        LE: {m.le || "-"}
                      </span>
                      <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 text-gray-600 text-[10px] shrink-0 inline-flex items-baseline" title="Last 10 Matches (LDW:WDL)">
                        <L10Display l10={m.l10} showPrefix={true} />
                      </span>
                    </div>
                    <span className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 text-amber-800 font-bold text-[10px] shrink-0" title="1X2 Rating">
                      R: {(m.rating && m.rating !== "Unknown") ? m.rating : "-"}
                    </span>
                  </div>
                  <div className="text-xs font-mono flex items-center justify-between gap-1.5 pb-0.5">
                    <span className="bg-white border border-gray-300 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm" title="1X2 Prediction">
                      1X2: {m.pred1x2 || "-"}
                    </span>
                    {isCompleted && (
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded shadow-sm text-[10px] shrink-0 ${
                          isCorrect
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : "bg-red-100 text-red-700 border border-red-200"
                        }`}
                      >
                        FT: {m.result}
                      </span>
                    )}
                  </div>

                  <div className="font-bold text-sm text-gray-800 flex items-center flex-wrap gap-2">
                    <span className="text-xs bg-gray-900 text-white px-1.5 py-0.5 rounded shadow-sm opacity-90 truncate">
                      #{idx + 1}
                    </span>
                    <span className="truncate">{m.teams}</span>
                    {(optScore || upsetOptScore || highestOtherOpw) && (
                      <div className="ml-auto flex items-center gap-1 shrink-0">
                        {optScore && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOwModalMatch({ match: m, catId: displayCat, lockedScore: liveOptScore || (m as any).lockedOpwScore }); }}
                            className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm font-black whitespace-nowrap cursor-pointer" 
                            title={`${optScore.rulesHit?.length || 0} rules applied. Click to view breakdown.`}>
                            <Zap size={10} />
                            {getCategoryShortLabel(displayCat)} {optScore.totalScore > 0 ? `+${optScore.totalScore}` : optScore.totalScore} PTS
                          </button>
                        )}
                        {upsetOptScore && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOwModalMatch({ match: m, catId: 'upsets', lockedScore: upsetOptScore }); }}
                            className="text-[10px] bg-purple-100 text-purple-800 border border-purple-300 hover:bg-purple-200 transition-colors px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm font-black whitespace-nowrap cursor-pointer" 
                            title={`Underdog (UPS): ${upsetOptScore.rulesHit?.length || 0} rules applied. Click to view breakdown.`}>
                            <Zap size={10} />
                            UPS {upsetOptScore.totalScore > 0 ? `+${upsetOptScore.totalScore}` : upsetOptScore.totalScore} PTS
                          </button>
                        )}
                        {highestOtherOpw && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOwModalMatch({ match: m, catId: highestOtherOpw.catId, lockedScore: highestOtherOpw.score }); }}
                            className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm font-black whitespace-nowrap cursor-pointer" 
                            title={`Highest other (${getCategoryShortLabel(highestOtherOpw.catId)}): ${highestOtherOpw.score.rulesHit?.length || 0} rules applied. Click to view breakdown.`}>
                            <Zap size={10} />
                            {getCategoryShortLabel(highestOtherOpw.catId)} {highestOtherOpw.score.totalScore > 0 ? `+${highestOtherOpw.score.totalScore}` : highestOtherOpw.score.totalScore} PTS
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {isLocked && m.aiReason && (
                    <div className="mt-1 bg-slate-50 border border-slate-100 rounded p-2 text-[10px]">
                      <div className="flex justify-between font-black text-slate-500 mb-0.5">
                        <span className="uppercase text-[8px]">AI REASONING</span>
                        <span className="text-indigo-600">CONFIDENCE: {m.aiConfidence || "100%"}</span>
                      </div>
                      <p className="text-slate-600 italic font-medium leading-normal">"{m.aiReason}"</p>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-2 border-t pt-2 flex-wrap gap-2">
                    <div className="flex flex-col items-start gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">
                          Legacy AI (Algo)
                        </span>
                        <span className="font-bold text-gray-600 px-2 py-0.5 bg-gray-100 rounded text-xs">
                          {_getAlgoPrediction(m)}
                        </span>
                      </div>
                      {(() => {
                        const cInfo = getMatchCountryAndLeague(m);
                        if (!cInfo.display) return null;
                        return (
                          <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1" title={cInfo.display}>
                            <Globe size={10} className="text-indigo-500 shrink-0" />
                            <span className="truncate max-w-[180px] sm:max-w-none">{cInfo.display}</span>
                          </span>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-black uppercase tracking-tighter ${isHpr ? "text-purple-600" : "text-teal-600"}`}>
                        {isHpr ? "HPR PREDICTS" : isLocked ? "AI PREDICTED" : "SEER PREDICTS"}
                      </span>
                      <span
                        className={`font-black text-white px-2 py-0.5 rounded text-xs shadow-sm ${
                          isHpr
                            ? "bg-purple-600"
                            : isLocked
                            ? "bg-gradient-to-r from-teal-500 to-indigo-600"
                            : "bg-gradient-to-r from-slate-600 to-slate-800"
                        } ${
                          isCompleted ? (isCorrect ? "opacity-100" : "opacity-70") : ""
                        }`}
                      >
                        {pred}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* SEER AI Control Board */}
      <div className="bg-slate-900 text-white rounded-lg shadow border border-slate-800 px-4 py-3 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Brain size={80} />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 z-10 relative">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="bg-gradient-to-r from-teal-400 to-indigo-400 text-transparent bg-clip-text font-black text-sm tracking-wider uppercase">
                SEER AI COGNITIVE SLIPS
              </span>
              <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                {selectedAiModel === "gemini-3.8-flash" ? "GEMINI 3.8 FLASH HIGH AGENTIC" : "GEMINI 3.1 PRO"}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 max-w-2xl leading-snug hidden sm:block">
              Synthesize and finalize premium slips. The AI consumes match stats, algorithms, PAA indicators, and sub-patterns to produce high-conviction outcomes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-800/80 rounded border border-slate-700 px-2 py-1 flex-1 sm:flex-none">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider hidden sm:inline">AI ENGINE:</span>
              <select
                value={selectedAiModel}
                onChange={(e) => setSelectedAiModel(e.target.value)}
                disabled={isGeneratingAi || isSelfLearning}
                className="bg-transparent text-[10px] font-bold text-teal-400 focus:outline-none cursor-pointer border-none p-0 pr-1 select-none w-full sm:w-auto"
              >
                <option value="gemini-3.8-flash" className="bg-slate-900 text-white">Gemini 3.8 Flash High</option>
                <option value="gemini-3.1-pro-preview" className="bg-slate-900 text-white">Gemini 3.1 PRO</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap">
              <button
                onClick={handleGenerateSlipsWithAI}
                disabled={isGeneratingAi || isSelfLearning}
                className={`flex-1 sm:flex-none px-3 py-1.5 min-h-[32px] rounded text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow transition-all ${
                  isGeneratingAi
                    ? "bg-teal-700/50 text-teal-300 cursor-not-allowed"
                    : "bg-teal-500 hover:bg-teal-600 text-slate-950 hover:scale-105 cursor-pointer"
                }`}
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> GEN...
                  </>
                ) : (
                  <>
                    <Sparkles size={12} /> Gen Slips
                  </>
                )}
              </button>

              <button
                onClick={handleSelfLearn}
                disabled={isGeneratingAi || isSelfLearning}
                title="Performs post-match reflective audits, comparing accuracy and compiling lessons learned."
                className={`flex-1 sm:flex-none px-3 py-1.5 min-h-[32px] rounded text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border transition-all ${
                  isSelfLearning
                    ? "bg-indigo-950/50 text-indigo-300 border-indigo-800 cursor-not-allowed"
                    : "border-indigo-500 bg-indigo-950/40 hover:bg-indigo-900 text-indigo-300 hover:scale-105 cursor-pointer"
                }`}
              >
                {isSelfLearning ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> REF...
                  </>
                ) : (
                  <>
                    <Brain size={12} /> Learn
                  </>
                )}
              </button>

              <button
                onClick={() => setShowLessonsPanel(!showLessonsPanel)}
                className="flex-1 sm:flex-none px-2.5 py-1.5 min-h-[32px] bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <BookOpen size={12} />
                Logs ({lessonsList.length})
              </button>

              <button
                onClick={handleWipeAndSync}
                disabled={isGeneratingAi || isWiping}
                className="flex-1 sm:flex-none px-2.5 py-1.5 min-h-[32px] bg-red-950/40 hover:bg-red-900 text-red-400 hover:text-red-300 border border-red-900/30 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Trash2 size={12} /> Wipe AI
              </button>
            </div>
          </div>
        </div>

        {/* Real-time Step progress tracker */}
        {isGeneratingAi && aiGenProgress && (
          <div className="mt-4 pt-4 border-t border-slate-850 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex justify-between text-[11px] font-bold text-teal-400 mb-1">
              <span className="uppercase tracking-wider">
                STAGE {aiGenProgress.currentCategoryIndex + 1} OF 10: {aiGenProgress.currentCategoryName}
              </span>
              <span>{Math.round(((aiGenProgress.currentCategoryIndex) / 10) * 100)}% COMPLETED</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-teal-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${((aiGenProgress.currentCategoryIndex) / 10) * 100}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-slate-400 italic mt-1.5 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin text-teal-400" /> {aiGenProgress.status}
            </p>
          </div>
        )}
      </div>

      {/* Collapsible Self-Learning logs */}
      {showLessonsPanel && (
        <div className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-lg p-5 animate-in fade-in duration-300">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
            <h3 className="font-black text-sm tracking-wider uppercase text-indigo-400 flex items-center gap-2">
              <Brain size={18} className="text-indigo-400" /> AI SELF-LEARNING INSIGHT LOGS
            </h3>
            <button
              onClick={() => setShowLessonsPanel(false)}
              className="text-xs font-black text-slate-400 hover:text-white uppercase tracking-wider"
            >
              CLOSE
            </button>
          </div>

          {lessonsList.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="text-xs italic">No reflective learning lessons compiled yet. Perform "Self Learn" after match results have been synchronized.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {lessonsList.map((lesson) => {
                const isExpanded = expandedLessonId === lesson.id;
                return (
                  <div key={lesson.id} className="border border-slate-800 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedLessonId(isExpanded ? null : lesson.id)}
                      className="w-full bg-slate-950/60 p-3 flex justify-between items-center text-left hover:bg-slate-950 transition-colors"
                    >
                      <div>
                        <div className="font-bold text-xs uppercase text-slate-200">
                          Reflective Audit for Date: {lesson.date}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                          Compiled: {new Date(lesson.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {lesson.totalLiveCandidatesEvaluated !== undefined && lesson.totalLiveCandidatesEvaluated > 0 && (
                            <span className="text-[9px] font-black bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded" title="All Category-Tagged Live Matches Evaluation">
                              LIVE CANDIDATES ({lesson.totalLiveCandidatesEvaluated}): {lesson.liveCandidatesAccuracy}%
                            </span>
                          )}
                          <span className="text-[9px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded">
                            SLIPS OVERALL: {lesson.overallAccuracy}%
                          </span>
                          <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                            GOAL: {lesson.goalAccuracy}%
                          </span>
                        </div>
                        <span className="text-slate-400 font-bold text-xs">
                          {isExpanded ? "▲" : "▼"}
                        </span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div>
                          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                            <Sparkles size={10} /> KEY REFLECTIVE FINDINGS
                          </h4>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {lesson.findings.map((f, fIdx) => (
                              <li key={fIdx} className="pl-3 border-l border-indigo-500 leading-normal">
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {lesson.insights && lesson.insights.length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                              <Lightbulb size={10} className="text-rose-400" /> SEER AI CORE INSIGHTS
                            </h4>
                            <ul className="space-y-1.5 text-xs text-slate-300">
                              {lesson.insights.map((ins, insIdx) => (
                                <li key={insIdx} className="pl-3 border-l border-rose-500 leading-normal text-rose-100">
                                  {ins}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-[10px] font-black text-teal-400 uppercase tracking-wider flex items-center gap-1">
                              <Zap size={10} /> STRATEGIC ACTIONABLE RULES (SELF-ADJUSTED)
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleLessonStatus(lesson.id);
                              }}
                              className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border transition-colors ${
                                lesson.status === 'approved'
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/30'
                                  : lesson.status === 'rejected'
                                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 hover:bg-rose-500/30'
                                  : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                              }`}
                            >
                              {lesson.status === 'approved' ? '✓ APPROVED (ACTIVE)' : lesson.status === 'rejected' ? '✕ REJECTED' : '? PENDING APPROVAL'}
                            </button>
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-300">
                            {lesson.actionableRules.map((r, rIdx) => (
                              <li key={rIdx} className={`pl-3 border-l font-mono text-[10px] leading-relaxed ${lesson.status === 'approved' ? 'border-teal-500 text-teal-100' : 'border-slate-600 text-slate-400'}`}>
                                <span className={`text-[8px] font-black px-1 py-0.5 rounded mr-1 ${lesson.status === 'approved' ? 'bg-teal-500/10 text-teal-300' : 'bg-slate-700 text-slate-400'}`}>ADJUSTMENT</span>
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Grid of Slips */}
      {selectedCategory === "all" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {categoriesList.filter((c: any) => c.id !== "all").map((cat: any) => renderSlipCard(cat))}
        </div>
      ) : (
        renderSingleSlipPage()
      )}

      {owModalMatch && (
        <OptimizedWeightsModal
          isOpen={true}
          onClose={() => setOwModalMatch(null)}
          match={owModalMatch.match}
          phaStatsMap={phaStatsMap}
          categoryId={owModalMatch.catId}
          lockedScore={owModalMatch.lockedScore}
          dayOverride={getMatchDayOfWeek(owModalMatch.match)}
        />
      )}
    </div>
  );
}
