import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  Filter,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
  Download,
  Copy,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Play,
  Pause,
  Square,
  RotateCcw,
  Zap,
  Cpu,
  Activity,
  Award,
  Check,
  Trash2,
  History,
  Shield,
  ShieldCheck,
  Eye,
  X
} from 'lucide-react';
import { Match } from './types';
import { DEFAULT_WEIGHTS } from './utils/seerLogic';
import { getActualResult, getLogicalDate } from './utils/matchProcessing';
import {
  DayOfWeek,
  getMatchDayOfWeek,
  getMarketFavorite,
  ALL_MASTER_CATALOG_TRIGGERS,
  OptimizedCategorySettings,
  extractMatchEvaluationStats,
  evaluateAllCatalogTriggers,
  getMatchCountryAndLeague
} from './utils/opwCommon';
import {
  populateCategoryWithMasterRules,
  getMasterTriggerDefaultPoints,
  getNewTriggerDefaultPoints,
  getTriggerSemanticPolarity,
  isLeagueTrigger,
  getLeagueTriggerMaxPenalty,
  getLeagueTriggerMaxBonus,
  isManuallyAdjustedProUnderdogLeague,
  isLeagueLockedProUnderdog,
  lockLeagueAsProUnderdog,
  unlockLeagueProUnderdog,
  markLeagueAsProUnderdog,
  markLeagueAsNeutral,
  DUAL_BONUS_TRIGGERS,
  sanitizeRulePolarity,
  MASTER_TOP_12_RULES,
  MASTER_BEST_BET_RULES,
  MASTER_BANKERS_DLIVE_RULES,
  MASTER_BANKERS_JACKPOT_RULES,
  MASTER_VALUE_PICKS_RULES,
  MASTER_VALUE_BETS_RULES,
  MASTER_UPSETS_RULES,
  MASTER_BOTB_RULES,
  UPSETS_EXPLICIT_PENALTIES,
  DYNAMIC_LEAGUE_TRIGGERS,
  registerDiscoveredLeagueTrigger
} from './utils/opwCatalog';
import {
  DAILY_OPTIMIZED_SETTINGS,
  DAILY_DEFAULT_CATEGORY_SETTINGS,
  OPTIMIZED_CATEGORY_SETTINGS,
  getOptimizedScoreDetailed,
  getOptimizedBaseWeight,
  updateOptimizedCategorySettings,
  updateDailyOptimizedCategorySettings,
  savePersistedDailySettings,
  resetToCodeDefaults,
  clearOptimizedScoreCache,
  loadServerOpwRules,
  invalidateServerRulesCache,
  setDailySettingsMeta
} from './utils/optimizedweights';
import { getMatchEvaluatorTags } from './utils/matchEvaluator';
import { deleteLockedSlip, getLockedSlip, invalidateLockedSlipsForWeights, saveLockedSlip, saveLockedSlipsBulk, SESSION_SLIP_CACHE, SeerLockedSlip } from './services/seerSlips';
import { generateSeerSlips } from './utils/seerSlipSelection';
import { isBannedFromSeerSlips } from './utils/leagueFilters';
import { getAnalysisDateString } from './services/seerPerformance';

export interface OPWAlgoProps {
  matches: Match[];
  allMatches?: Match[];
  phaStatsMap?: Record<string, any>;
  matchStars?: Record<string, number>;
  liveViewType?: 'daily' | 'jackpot';
  initialCategory?: string;
  initialDay?: DayOfWeek | 'all';
  titlePrefix?: string;
  onBack: () => void;
  onSelectDayAlgo?: (day: DayOfWeek | 'all') => void;
}

interface CategoryOption {
  id: string;
  label: string;
  tagPrefix: string;
  targetObjective: 'mfav_draw' | 'mfav_only' | 'underdog_only';
  targetCapacity: number;
  description: string;
}

const CATEGORIES: CategoryOption[] = [
  { id: 'top_12_value', label: 'Top 12 Value', tagPrefix: 'top12:', targetObjective: 'mfav_draw', targetCapacity: 12, description: 'Filters statistically sound Mfav and Draw matches to the top 12.' },
  { id: 'best_bet', label: 'Best Bets', tagPrefix: 'best_bet:', targetObjective: 'mfav_only', targetCapacity: 10, description: 'Highest conviction favorites (Mfav must win).' },
  { id: 'bankers_dlive', label: 'Bankers Dlive', tagPrefix: 'bankers_dlive:', targetObjective: 'mfav_only', targetCapacity: 10, description: 'Bankers D.live selections (Mfav must win).' },
  { id: 'bankers_jackpot', label: 'Bankers Jackpot', tagPrefix: 'bankers_jackpot:', targetObjective: 'mfav_only', targetCapacity: 5, description: 'Bankers Jackpot selections (Mfav must win).' },
  { id: 'value_picks', label: 'Value Picks', tagPrefix: 'value_picks:', targetObjective: 'mfav_only', targetCapacity: 5, description: 'Requires Mfav to win (odds 2.0-2.50) without draw or underdog traps.' },
  { id: 'value_bets', label: 'Value Bets', tagPrefix: 'value_bets:', targetObjective: 'mfav_draw', targetCapacity: 5, description: 'Value Bets (Mfav win or draw) with independent triggers calibrated per day.' },
  { id: 'upsets', label: 'Upsets', tagPrefix: 'upsets:', targetObjective: 'underdog_only', targetCapacity: 5, description: 'Underdog wins with high pattern conviction.' },
  { id: 'botb_best', label: 'BOTB', tagPrefix: 'botb_best:', targetObjective: 'mfav_only', targetCapacity: 10, description: 'Premium selections (Mfav must win).' }
];

export const MASTER_RULES_MAP: Record<string, { description: string; points: number }[]> = {
  top_12_value: MASTER_TOP_12_RULES,
  top_10_value: MASTER_TOP_12_RULES,
  best_bet: MASTER_BEST_BET_RULES,
  bankers_dlive: MASTER_BANKERS_DLIVE_RULES,
  bankers_jackpot: MASTER_BANKERS_JACKPOT_RULES,
  value_picks: MASTER_VALUE_PICKS_RULES,
  value_bets: MASTER_VALUE_BETS_RULES,
  value_bet: MASTER_VALUE_BETS_RULES,
  upsets: MASTER_UPSETS_RULES,
  upset: MASTER_UPSETS_RULES,
  botb_best: MASTER_BOTB_RULES,
};

export interface OptimizerPeakMemory {
  cleanTopMatches: number;
  firstTrapRank: number;
  quality: number;
  trapRanks?: number[];
  trapGaps?: number[];
  points: Record<string, number>;
  savedAt: string;
}

export const getOptimizerPeakStorageKey = (day: string, categoryId: string): string => {
  return `seer_opw_peak_memory_${day.toLowerCase()}_${categoryId.toLowerCase()}`;
};

export const saveOptimizerPeakMemory = (day: string, categoryId: string, peakData: {
  cleanTopMatches: number;
  firstTrapRank: number;
  quality: number;
  trapRanks?: number[];
  trapGaps?: number[];
  points: Map<string, number> | Record<string, number>;
}) => {
  try {
    const key = getOptimizerPeakStorageKey(day, categoryId);
    const pointsObj: Record<string, number> = {};
    const isUd = categoryId === 'upsets' || categoryId === 'upset' || categoryId === 'underdog_only';
    const sanitizePeakVal = (desc: string, val: number): number | null => {
      if (typeof val !== 'number' || isNaN(val)) return null;
      if (val === 0) return isUd ? 0 : null;
      const leagueMaxPenalty = isLeagueTrigger(desc) ? getLeagueTriggerMaxPenalty(desc) : -30;
      const leagueMaxBonus = isLeagueTrigger(desc) ? getLeagueTriggerMaxBonus(desc, isUd) : 40;
      return val > 0 ? Math.max(5, Math.min(leagueMaxBonus, val)) : Math.min(-5, Math.max(leagueMaxPenalty, val));
    };
    if (peakData.points instanceof Map) {
      peakData.points.forEach((v, k) => {
        const clean = sanitizePeakVal(k, v);
        if (clean !== null) pointsObj[k] = clean;
      });
    } else if (typeof peakData.points === 'object') {
      Object.entries(peakData.points).forEach(([k, v]) => {
        const clean = sanitizePeakVal(k, v as number);
        if (clean !== null) pointsObj[k] = clean;
      });
    }
    const payload: OptimizerPeakMemory = {
      cleanTopMatches: peakData.cleanTopMatches,
      firstTrapRank: peakData.firstTrapRank,
      quality: peakData.quality,
      trapRanks: peakData.trapRanks,
      trapGaps: peakData.trapGaps,
      points: pointsObj,
      savedAt: new Date().toISOString()
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (e) {
    console.warn('[OPW Peak Memory] Error saving peak memory:', e);
  }
};

export const loadOptimizerPeakMemory = (day: string, categoryId: string): OptimizerPeakMemory | null => {
  try {
    const key = getOptimizerPeakStorageKey(day, categoryId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.cleanTopMatches === 'number' && parsed.points) {
      const isUd = categoryId === 'upsets' || categoryId === 'upset' || categoryId === 'underdog_only';
      const cleanPoints: Record<string, number> = {};
      Object.entries(parsed.points).forEach(([k, val]) => {
        const v = val as number;
        if (typeof v === 'number' && !isNaN(v)) {
          if (v === 0) {
            if (isUd) cleanPoints[k] = 0;
          } else {
            const leagueMaxPenalty = isLeagueTrigger(k) ? getLeagueTriggerMaxPenalty(k) : -30;
            const leagueMaxBonus = isLeagueTrigger(k) ? getLeagueTriggerMaxBonus(k, isUd) : 40;
            cleanPoints[k] = v > 0 ? Math.max(5, Math.min(leagueMaxBonus, v)) : Math.min(-5, Math.max(leagueMaxPenalty, v));
          }
        }
      });
      parsed.points = cleanPoints;
      return parsed;
    }
  } catch (e) {
    console.warn('[OPW Peak Memory] Error loading peak memory:', e);
  }
  return null;
};

export const clearOptimizerPeakMemory = (day: string, categoryId: string) => {
  try {
    const key = getOptimizerPeakStorageKey(day, categoryId);
    window.localStorage.removeItem(key);
  } catch (e) {
    console.warn('[OPW Peak Memory] Error clearing peak memory:', e);
  }
};

export interface TriggerRecommendation {
  description: string;
  currentPoints: number;
  recommendedPoints: number;
  totalHits: number;
  mfavHits: number;
  drawHits: number;
  underdogHits: number;
  mfavPct: number;
  drawPct: number;
  underdogPct: number;
  safePct: number; // Mfav + Draw %
  netEdge: number;
  rationale: string;
  confidence: 'High' | 'Medium' | 'Low' | 'Insufficient Data';
  isVolatileSignal?: boolean;
  underdogLift?: number;
  historicalAnchor?: number;
  overallHits?: number;
  overallMfavHits?: number;
  overallDrawHits?: number;
  overallUnderdogHits?: number;
  overallSafePct?: number;
  overallMfavPct?: number;
  overallDrawPct?: number;
  overallUnderdogPct?: number;
  overallUnderdogLift?: number;
  dayHistHits?: number;
  dayHistSafePct?: number;
  dayHistMfavPct?: number;
  dayHistDrawPct?: number;
  dayHistUnderdogPct?: number;
  ratchetAction?: 'increased_bonus' | 'deepened_penalty' | 'preserved' | 'none';
  weekdayDistribution?: Record<string, { total: number; mfav: number; draw: number; underdog: number; safePct: number }>;
}

export interface HorizonBreakdown {
  horizon: number;
  traps: number;
  targets: number;
  total: number;
  winRate: number;
}

export interface MultiHorizonSummary {
  h500: HorizonBreakdown;
  h1000: HorizonBreakdown;
  h1500: HorizonBreakdown;
  h2000: HorizonBreakdown;
  h3000: HorizonBreakdown;
}

export interface TrapRankInfo {
  trapNumber: number;  // 1 to 5
  rank: number;
  score: number;
  gapToPrev: number;
}

export interface OptimizerPhaseState {
  currentPhase: number;        // 1 to 5
  phaseComps: number;          // computations executed in this phase
  phaseBudget: number;         // 500k for phase 1; 350k for phases 2-5
  establishedRanks: number[];  // [peakR1, peakR2, ...]
  establishedScores: number[]; // [peakS1, peakS2, ...]
}

export interface SeparationEvaluation {
  quality: number;
  purityPct: number;
  trapInTopN: number;
  targetInTopN: number;
  inversions: number;
  bufferMargin: number;
  topN: number;
  cleanTopMatches: number;
  targetCleanMatches: number;
  targetMet: boolean;
  firstTrapRank: number;
  totalCorrect: number;
  floorMet: boolean;
  ceilingMet: boolean;
  targetFloor: number;
  targetCeiling: number;
  regularizationCost: number;
  targetsInTop5000?: number;
  horizonMetrics?: MultiHorizonSummary;
  trapRanks?: number[];
  trapScores?: number[];
  trapGaps?: number[];
  trapDispersionHealth?: 'HEALTHY' | 'MODERATE' | 'CLUSTERED';
}

export const ALLOWED_POINT_VALUES = [-30, -25, -20, -15, -10, -5, 5, 10, 15, 20, 25, 30, 35, 40];

export function getFullActiveCatalogTriggers(): string[] {
  const set = new Set(ALL_MASTER_CATALOG_TRIGGERS);
  DYNAMIC_LEAGUE_TRIGGERS.forEach(t => set.add(t));
  return Array.from(set);
}

export interface TargetHorizon {
  floor: number;          // Minimum acceptable clean streak before early stopping is possible
  ceiling: number;        // Maximum aspirational clean streak (100% of all correct matches)
  categoryGoal: number;   // e.g. 12 or 5
  totalCorrect: number;   // Total available correct matches
  totalCompleted: number; // Total completed matches in category
  isSmallDataset: boolean;
}

/**
 * Calculates dual-horizon targets for self-aware optimization:
 * 1. Floor: Minimum required clean streak before frontier expansion begins:
 *    - Small dataset (N <= G): all available correct matches (C)
 *    - Double goal (N >= 2G): max(G + 3, ceil(0.5 * C)), capped at C
 *    - Moderate dataset (G < N < 2G): max(1, ceil(0.5 * C)), capped at C
 * 2. Ceiling: 100% of available correct matches (C).
 */
export function calculateTargetHorizons(
  totalCompleted: number,
  totalCorrect: number,
  categoryGoal: number,
  targetObjective?: 'mfav_draw' | 'mfav_only' | 'underdog_only'
): TargetHorizon {
  if (totalCorrect <= 0) {
    return {
      floor: 0,
      ceiling: 0,
      categoryGoal,
      totalCorrect: 0,
      totalCompleted,
      isSmallDataset: true
    };
  }

  const isSmall = totalCompleted <= categoryGoal;
  if (isSmall) {
    return {
      floor: totalCorrect,
      ceiling: totalCorrect,
      categoryGoal,
      totalCorrect,
      totalCompleted,
      isSmallDataset: true
    };
  }

  // Large historical universe scaling:
  // 1. High-volume Market Favorite categories (best_bet, bankers_jackpot, bankers_dlive)
  // User requirement: Over 1,000+ clean matches before the first trap rank!
  if (targetObjective === 'mfav_only' || targetObjective === 'mfav_draw') {
    if (totalCorrect >= 1000) {
      return {
        floor: 1000,
        ceiling: Math.min(totalCorrect, 2000),
        categoryGoal,
        totalCorrect,
        totalCompleted,
        isSmallDataset: false
      };
    }
  }

  // 2. Underdog Upsets (underdog_only) with 2,831 underdogs:
  // User requirement: 500 to 1,000 clean underdogs before the first trap rank.
  if (targetObjective === 'underdog_only' && totalCorrect >= 1000) {
    return {
      floor: 500,
      ceiling: Math.min(totalCorrect, 1000),
      categoryGoal,
      totalCorrect,
      totalCompleted,
      isSmallDataset: false
    };
  }

  // General large dataset fallback:
  if (totalCorrect >= 1000) {
    return {
      floor: 1000,
      ceiling: Math.min(totalCorrect, 2000),
      categoryGoal,
      totalCorrect,
      totalCompleted,
      isSmallDataset: false
    };
  }

  if (totalCorrect >= 500) {
    return {
      floor: Math.min(500, Math.ceil(0.5 * totalCorrect)),
      ceiling: Math.min(totalCorrect, 1000),
      categoryGoal,
      totalCorrect,
      totalCompleted,
      isSmallDataset: false
    };
  }

  const targetFloorCandidate = Math.min(totalCorrect, Math.max(categoryGoal, Math.ceil(0.75 * totalCorrect)));
  const hasMoreThanDouble = totalCompleted >= (2 * categoryGoal);
  let floor: number;

  if (hasMoreThanDouble) {
    const goalPlus3 = categoryGoal + 3;
    floor = Math.min(totalCorrect, Math.max(goalPlus3, targetFloorCandidate));
  } else {
    floor = Math.min(totalCorrect, Math.max(categoryGoal, targetFloorCandidate));
  }

  return {
    floor,
    ceiling: totalCorrect,
    categoryGoal,
    totalCorrect,
    totalCompleted,
    isSmallDataset: false
  };
}

export function calculateTargetTopCleanMatches(
  totalCompleted: number,
  totalCorrect: number,
  categoryGoal: number,
  targetObjective?: 'mfav_draw' | 'mfav_only' | 'underdog_only'
): number {
  return calculateTargetHorizons(totalCompleted, totalCorrect, categoryGoal, targetObjective).floor;
}

export interface TriggerAccuracyProfile {
  totalHits: number;
  targetHits: number;
  trapHits: number;
  targetAccuracy: number; // 0.0 to 1.0
  trapFrequency: number;  // 0.0 to 1.0
  underdogRate: number;   // 0.0 to 1.0
  mfavRate: number;       // 0.0 to 1.0
  drawRate: number;       // 0.0 to 1.0
  underdogLift: number;   // Ratio relative to 0.18 baseline
  mfavLift: number;       // Ratio relative to 0.58 baseline
  volatilityRatio: number;// (draw + underdog) / totalHits
  isVolatileSignal: boolean; // elevated upset/draw risk
  historicalAnchor: number;// Master catalog baseline points
  tier: 1 | 2 | 3 | 4 | 5;
  allowedBand: number[];
  maxStep: number;
  zeroEligible: boolean;
}

/**
 * In Upsets (underdog_only), 0 points is a last resort — never a general shortcut.
 * A trigger is eligible for 0 points ONLY if empirical live and/or overall history shows:
 *   1. Wrong side: PRO_UNDERDOG leans Pro-Mfav, or PRO_MFAV leans Pro-Underdog
 *   2. No statistical value / no contribution: 0 total hits, or flat/balanced near baseline (no discriminative lift)
 *   3. Stale overall: overall historical universe lacks discriminative edge on its assigned side
 */
export function isUpsetTriggerZeroEligible(
  desc: string,
  liveCounts: { mfav: number; draw: number; underdog: number } | undefined,
  histCounts?: { mfav: number; draw: number; underdog: number } | undefined,
  categoryId?: string,
  day?: string
): boolean {
  const isLeagueLockedUd = isLeagueTrigger(desc) && isLeagueLockedProUnderdog(desc, categoryId, day);
  const polarity = isLeagueTrigger(desc) ? 'NEUTRAL' : (isLeagueLockedUd ? 'PRO_UNDERDOG' : getTriggerSemanticPolarity(desc, categoryId || 'underdog_only'));

  const assess = (c?: { mfav: number; draw: number; underdog: number }) => {
    if (!c) return { total: 0, status: 'no_value' as const, udLift: 1.0, mfavLift: 1.0 };
    const total = c.mfav + c.draw + c.underdog;
    if (total === 0) return { total: 0, status: 'no_value' as const, udLift: 1.0, mfavLift: 1.0 };
    if (total < 5) return { total, status: 'insufficient' as const, udLift: (c.underdog / total) / 0.18, mfavLift: (c.mfav / total) / 0.58 };
    const udRate = c.underdog / total;
    const mfavRate = c.mfav / total;
    const drawRate = c.draw / total;
    const udLift = udRate / 0.18;
    const mfavLift = mfavRate / 0.58;

    // 1. Wrong Side check (PRO_UNDERDOG vs PRO_MFAV mismatch)
    if (polarity === 'PRO_UNDERDOG' && (udLift < 0.90 || mfavLift >= 1.10 || (mfavRate >= 0.62 && udRate < 0.18))) {
      return { total, status: 'wrong_side' as const, udLift, mfavLift };
    }
    if (polarity === 'PRO_MFAV' && (udLift >= 1.15 || udRate >= 0.22 || (mfavRate <= 0.45 && udRate >= 0.18))) {
      return { total, status: 'wrong_side' as const, udLift, mfavLift };
    }

    // 2. No statistical value / flat balanced signal around baseline
    const isThreeWay = Math.abs(mfavRate * 100 - 33.3) <= 8 && Math.abs(drawRate * 100 - 33.3) <= 8 && Math.abs(udRate * 100 - 33.3) <= 8;
    const isTwoWayTied = Math.abs(mfavRate - udRate) <= 0.06 && mfavRate <= 0.45;
    const flatLift = udLift >= 0.85 && udLift <= 1.15 && mfavLift >= 0.85 && mfavLift <= 1.15;
    if (isThreeWay || isTwoWayTied || flatLift) {
      return { total, status: 'no_value' as const, udLift, mfavLift };
    }

    return { total, status: 'valid' as const, udLift, mfavLift };
  };

  const liveEval = assess(liveCounts);
  const histEval = assess(histCounts);

  // If neither live nor overall history has any hits, trigger contributes nothing
  if (liveEval.total === 0 && histEval.total === 0) return true;

  // Wrong side on either sample (unless strongly contradicted by >= 8 valid hits in the other sample)
  if (liveEval.status === 'wrong_side' && !(histEval.status === 'valid' && histEval.total >= 12)) return true;
  if (histEval.status === 'wrong_side' && !(liveEval.status === 'valid' && liveEval.total >= 8)) return true;

  // No statistical value / flat baseline signal
  if (histEval.status === 'no_value' && !(liveEval.status === 'valid' && liveEval.total >= 8)) return true;
  if (liveEval.status === 'no_value' && histEval.status !== 'valid') return true;

  // Stale overall check: overall historical sample >= 10 shows no meaningful edge on its assigned side and live isn't strongly valid
  if (histEval.total >= 10) {
    const liveStrong = liveEval.status === 'valid' && liveEval.total >= 5;
    if (!liveStrong) {
      if (polarity === 'PRO_UNDERDOG' && histEval.udLift < 1.05) return true;
      if (polarity === 'PRO_MFAV' && histEval.mfavLift < 1.05 && histEval.udLift >= 0.95) return true;
      if (polarity === 'NEUTRAL' && histEval.udLift >= 0.85 && histEval.udLift <= 1.15 && histEval.mfavLift >= 0.85 && histEval.mfavLift <= 1.15) return true;
    }
  }

  return false;
}

/**
 * Evaluates a trigger's statistical performance using relative risk (Lift over baseline)
 * and Bayesian Historical Anchoring:
 * - Baseline Mfav ~58%, Baseline Underdog ~18%, Baseline Draw ~24%.
 * - Formal Volatility Tracking: Underdog Lift >= 1.30x OR Non-Favorite Volatility Ratio >= 55%
 *   flags volatility even if raw Mfav is slightly higher (e.g. Israeli leagues, Both GA >= 1.1).
 * - Small-Sample Guardrail: If totalHits < 8 (e.g. N=5), points stay anchored within ±5 of history.
 * - Bounded Daily Drift: Point mutations are strictly bounded within ±10 PTS of Historical Anchor.
 */
export function getTriggerAccuracyProfile(
  desc: string,
  counts: { mfav: number; draw: number; underdog: number } | undefined,
  objective: 'mfav_draw' | 'mfav_only' | 'underdog_only',
  customHistoricalAnchor?: number,
  isHistoryMode: boolean = false,
  categoryId?: string,
  day?: string,
  histCounts?: { mfav: number; draw: number; underdog: number }
): TriggerAccuracyProfile {
  const isBig5 = /^match belongs? to (?:english\s+|england\s*:\s*|england\s*-\s*)?premier\s+league$/i.test((desc || '').trim());
  const isUpsets = objective === 'underdog_only';
  const zeroEligible = isUpsets ? isUpsetTriggerZeroEligible(desc, counts, histCounts, categoryId, day) : false;
  const leagueMaxPen = isLeagueTrigger(desc) ? getLeagueTriggerMaxPenalty(desc) : -30;
  const leagueMaxBonus = isLeagueTrigger(desc) ? getLeagueTriggerMaxBonus(desc, isUpsets) : (isBig5 && !isUpsets ? 40 : 30);
  const minFull = Math.min(-30, leagueMaxPen);
  const maxFull = Math.max(30, leagueMaxBonus);
  const fullBand = [-40, -35, -30, -25, -20, -15, -10, -5, ...(zeroEligible ? [0] : []), 5, 10, 15, 20, 25, 30, 35, 40].filter(v => v >= minFull && v <= maxFull);

  const polarity = (isLeagueTrigger(desc) || DUAL_BONUS_TRIGGERS.has(desc))
    ? 'NEUTRAL'
    : getTriggerSemanticPolarity(desc, categoryId || objective);
  const isMfavDraw = objective === 'mfav_draw';

  // Allowed candidate bounds based strictly on user-approved domain polarity (0 is allowed ONLY in Upsets when zeroEligible):
  // 1. Neutral triggers (League triggers, DUAL_BONUS_TRIGGERS, NEUTRAL_TRIGGERS): [minPenalty, maxBonus] (can flip between bonus & penalty)
  // 2. Pro-underdog on Mfav/Draw: strictly penalties [-30, -5]
  // 3. Pro-Mfav on Mfav/Draw: strictly bonuses [+5, +30]
  // 4. Upsets: Pro-underdog [+5, +30] (0 allowed ONLY if zeroEligible), Pro-Mfav [-30, -5] (0 allowed ONLY if zeroEligible)
  let minPolarityBound: number;
  let maxPolarityBound: number;

  if (isLeagueTrigger(desc) || polarity === 'NEUTRAL') {
    minPolarityBound = isLeagueTrigger(desc) ? getLeagueTriggerMaxPenalty(desc) : -30;
    maxPolarityBound = isLeagueTrigger(desc) ? leagueMaxBonus : 30;
  } else if (isUpsets && UPSETS_EXPLICIT_PENALTIES[desc] !== undefined) {
    minPolarityBound = -30;
    maxPolarityBound = zeroEligible ? 0 : -5;
  } else if (isUpsets) {
    if (polarity === 'PRO_UNDERDOG') {
      minPolarityBound = zeroEligible ? 0 : 5;
      maxPolarityBound = 30;
    } else {
      minPolarityBound = -30;
      maxPolarityBound = zeroEligible ? 0 : -5;
    }
  } else {
    if (polarity === 'PRO_UNDERDOG') {
      minPolarityBound = -30;
      maxPolarityBound = -5;
    } else {
      minPolarityBound = 5;
      maxPolarityBound = isBig5 ? 40 : 30;
    }
  }

  const rawAnchor = (customHistoricalAnchor !== undefined && (zeroEligible || customHistoricalAnchor !== 0))
    ? customHistoricalAnchor
    : getMasterTriggerDefaultPoints(desc, objective, categoryId);
  let historicalAnchor = (zeroEligible && customHistoricalAnchor === 0)
    ? 0
    : (rawAnchor !== 0
      ? Math.max(minPolarityBound, Math.min(maxPolarityBound, rawAnchor))
      : (isUpsets ? (polarity === 'PRO_UNDERDOG' ? 15 : -15) : (polarity === 'PRO_UNDERDOG' ? -15 : 15)));
  if (!zeroEligible && historicalAnchor === 0) {
    historicalAnchor = isUpsets ? (polarity === 'PRO_UNDERDOG' ? 15 : -15) : (polarity === 'PRO_UNDERDOG' ? -15 : 15);
  }

  if (!counts || (counts.mfav + counts.draw + counts.underdog) === 0) {
    const allowedBand = fullBand.filter(v => (zeroEligible || v !== 0) && v >= minPolarityBound && v <= maxPolarityBound);
    return {
      totalHits: 0,
      targetHits: 0,
      trapHits: 0,
      targetAccuracy: 0.33,
      trapFrequency: 0.33,
      underdogRate: 0.18,
      mfavRate: 0.58,
      drawRate: 0.24,
      underdogLift: 1.0,
      mfavLift: 1.0,
      volatilityRatio: 0.42,
      isVolatileSignal: false,
      historicalAnchor,
      tier: 3,
      allowedBand: allowedBand.length > 0 ? allowedBand : [historicalAnchor],
      maxStep: 15,
      zeroEligible
    };
  }

  const totalHits = counts.mfav + counts.draw + counts.underdog;
  let targetHits = 0;
  let trapHits = 0;

  if (objective === 'underdog_only') {
    targetHits = counts.underdog;
    trapHits = counts.mfav + counts.draw;
  } else if (objective === 'mfav_only') {
    targetHits = counts.mfav;
    trapHits = counts.draw + counts.underdog;
  } else {
    // mfav_draw
    targetHits = counts.mfav + counts.draw;
    trapHits = counts.underdog;
  }

  const targetAccuracy = targetHits / totalHits;
  const trapFrequency = trapHits / totalHits;
  const mfavRate = counts.mfav / totalHits;
  const udRate = counts.underdog / totalHits;
  const drawRate = counts.draw / totalHits;

  // Relative Risk (Lift) vs Category Empirical Baselines (Baseline: Mfav ~58%, Underdog ~18%, Draw ~24%)
  const BASELINE_MFAV = 0.58;
  const BASELINE_UD = 0.18;
  const mfavLift = mfavRate / BASELINE_MFAV;
  const underdogLift = udRate / BASELINE_UD;
  const volatilityRatio = (counts.draw + counts.underdog) / totalHits;

  // A trigger is a VOLATILITY SIGNAL if:
  // 1. Underdog Lift >= 1.30x (underdog win rate >= 23.4%) OR
  // 2. Non-favorite volatility ratio >= 0.55 (draw + underdog >= 55%)
  // Even if mfavRate > udRate (e.g., 42% Mfav, 28% Draw, 30% UD), this is flagged as volatile!
  const isVolatileSignal = totalHits >= 3 && (underdogLift >= 1.30 || volatilityRatio >= 0.55);

  // Tier classification based on Lift & Relative Risk (descriptive, not restrictive)
  let tier: 1 | 2 | 3 | 4 | 5 = 3;
  if (objective === 'underdog_only') {
    if (underdogLift >= 1.50) tier = 1;
    else if (underdogLift >= 1.15) tier = 2;
    else if (mfavLift >= 1.20) tier = 5;
    else if (mfavLift >= 1.05) tier = 4;
  } else {
    if (underdogLift >= 1.40 || udRate >= 0.25 || (isVolatileSignal && objective === 'mfav_only')) {
      tier = 5; // Severe Underdog/Volatility Risk
    } else if (underdogLift >= 1.15 || udRate >= 0.21) {
      tier = 4; // Moderate Underdog Risk
    } else if (targetAccuracy >= 0.70 || mfavLift >= 1.15) {
      tier = 1; // High Conviction Mfav/Target Signal
    } else if (targetAccuracy >= 0.58 && underdogLift <= 0.90) {
      tier = 2; // Moderate Conviction Signal
    } else {
      tier = 3; // Neutral / Baseline
    }
  }

  // Daily algos are improved per day across valid domain semantic polarity bounds [minPolarityBound, maxPolarityBound].
  let allowedBand = fullBand.filter(v => (zeroEligible || v !== 0) && v >= minPolarityBound && v <= maxPolarityBound);
  if (allowedBand.length === 0) {
    allowedBand = [historicalAnchor !== 0 || zeroEligible ? historicalAnchor : (polarity === 'PRO_UNDERDOG' ? (isUpsets ? 15 : -15) : (isUpsets ? -15 : 15))];
  }

  return {
    totalHits,
    targetHits,
    trapHits,
    targetAccuracy,
    trapFrequency,
    underdogRate: udRate,
    mfavRate,
    drawRate,
    underdogLift,
    mfavLift,
    volatilityRatio,
    isVolatileSignal,
    historicalAnchor,
    tier,
    allowedBand,
    maxStep: 15,
    zeroEligible
  };
}

export function evaluateSeparation(
  profiles: { outcome: 'mfav' | 'draw' | 'underdog'; triggersHit: Set<string>; baseScore: number }[],
  pointsMap: Map<string, number>,
  objective: 'mfav_draw' | 'mfav_only' | 'underdog_only',
  targetCapacity: number = 12
): SeparationEvaluation {
  if (profiles.length === 0) {
    return {
      quality: 0,
      purityPct: 0,
      trapInTopN: 0,
      targetInTopN: 0,
      inversions: 0,
      bufferMargin: 0,
      topN: 0,
      cleanTopMatches: 0,
      targetCleanMatches: 0,
      targetMet: false,
      firstTrapRank: 1,
      totalCorrect: 0,
      floorMet: false,
      ceilingMet: false,
      targetFloor: 0,
      targetCeiling: 0,
      regularizationCost: 0
    };
  }
  const SCORE_OFFSET = 1500;
  const BUCKET_COUNT = 3001;
  const buckets: { outcome: 'mfav' | 'draw' | 'underdog'; score: number }[][] = Array.from({ length: BUCKET_COUNT }, () => []);

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    let score = p.baseScore;
    p.triggersHit.forEach(desc => {
      score += pointsMap.get(desc) ?? 0;
    });
    const clamped = Math.max(-1499, Math.min(1499, score));
    buckets[clamped + SCORE_OFFSET].push({ outcome: p.outcome, score });
  }

  let targetOutcomes: Set<string>;
  let trapOutcomes: Set<string>;

  if (objective === 'underdog_only') {
    targetOutcomes = new Set(['underdog']);
    trapOutcomes = new Set(['mfav', 'draw']);
  } else if (objective === 'mfav_only') {
    targetOutcomes = new Set(['mfav']);
    trapOutcomes = new Set(['draw', 'underdog']);
  } else {
    targetOutcomes = new Set(['mfav', 'draw']);
    trapOutcomes = new Set(['underdog']);
  }

  const scored: { outcome: 'mfav' | 'draw' | 'underdog'; score: number }[] = [];
  for (let b = BUCKET_COUNT - 1; b >= 0; b--) {
    const list = buckets[b];
    if (list.length > 1) {
      list.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aIsTarget = targetOutcomes.has(a.outcome) ? 1 : 0;
        const bIsTarget = targetOutcomes.has(b.outcome) ? 1 : 0;
        return bIsTarget - aIsTarget;
      });
    }
    for (let j = 0; j < list.length; j++) {
      scored.push(list[j]);
    }
  }

  const topN = Math.min(scored.length, targetCapacity);

  const totalCorrect = profiles.filter(p => targetOutcomes.has(p.outcome)).length;
  const horizons = calculateTargetHorizons(profiles.length, totalCorrect, targetCapacity, objective);

  // Find indices and ranks of top 5 trap outcomes
  let firstTrapIndex = scored.length;
  const trapIndices: number[] = [];
  const trapScoresList: number[] = [];
  for (let i = 0; i < scored.length; i++) {
    if (trapOutcomes.has(scored[i].outcome)) {
      if (trapIndices.length === 0) firstTrapIndex = i;
      if (trapIndices.length < 5) {
        trapIndices.push(i);
        trapScoresList.push(scored[i].score);
      }
    }
  }

  const cleanTopMatches = firstTrapIndex;
  const firstTrapRank = firstTrapIndex + 1;
  const trapRanks = trapIndices.map(idx => idx + 1);
  const trapGaps: number[] = [];
  for (let i = 0; i < trapRanks.length; i++) {
    if (i === 0) trapGaps.push(trapRanks[0] - 1);
    else trapGaps.push(trapRanks[i] - trapRanks[i - 1]);
  }
  let avgTrapGap = 0;
  if (trapGaps.length > 1) {
    const sumGaps = trapGaps.slice(1).reduce((acc, g) => acc + g, 0);
    avgTrapGap = sumGaps / (trapGaps.length - 1);
  } else if (trapGaps.length === 1) {
    avgTrapGap = trapGaps[0];
  }
  const trapDispersionHealth: 'HEALTHY' | 'MODERATE' | 'CLUSTERED' =
    avgTrapGap >= 10 ? 'HEALTHY' : avgTrapGap >= 5 ? 'MODERATE' : 'CLUSTERED';

  // Dual-horizon convergence criteria strictly requires positive OPW scores (> 0) on top target matches
  const floorSlice = scored.slice(0, Math.min(scored.length, horizons.floor));
  const topTargetsPositiveForFloor = floorSlice.length > 0 && floorSlice.every(m => targetOutcomes.has(m.outcome) && m.score > 0);
  const ceilingSlice = scored.slice(0, Math.min(scored.length, horizons.ceiling));
  const topTargetsPositiveForCeiling = ceilingSlice.length > 0 && ceilingSlice.every(m => targetOutcomes.has(m.outcome) && m.score > 0);

  const floorMet = totalCorrect === 0 || (horizons.floor > 0 && cleanTopMatches >= horizons.floor && topTargetsPositiveForFloor);
  const ceilingMet = totalCorrect === 0 || (horizons.ceiling > 0 && cleanTopMatches >= horizons.ceiling && topTargetsPositiveForCeiling);
  const targetMet = floorMet;

  let targetInTopN = 0;
  let trapInTopN = 0;
  for (let i = 0; i < topN; i++) {
    if (targetOutcomes.has(scored[i].outcome)) targetInTopN++;
    else if (trapOutcomes.has(scored[i].outcome)) trapInTopN++;
  }

  let inversions = 0;
  let pairwiseMarginSum = 0;
  const targetScores: number[] = [];
  const trapScores: number[] = [];

  for (let i = 0; i < scored.length; i++) {
    if (targetOutcomes.has(scored[i].outcome)) targetScores.push(scored[i].score);
    else if (trapOutcomes.has(scored[i].outcome)) trapScores.push(scored[i].score);
  }

  if (objective === 'mfav_draw') {
    const mfavScores: number[] = [];
    const drawScores: number[] = [];
    const udScores: number[] = [];

    for (let i = 0; i < scored.length; i++) {
      if (scored[i].outcome === 'mfav') mfavScores.push(scored[i].score);
      else if (scored[i].outcome === 'draw') drawScores.push(scored[i].score);
      else if (scored[i].outcome === 'underdog') udScores.push(scored[i].score);
    }

    // Sub-millisecond evaluation for large datasets: preserve top candidates and evenly sample remainder
    let evalMfav = mfavScores;
    let evalDraw = drawScores;
    let evalUd = udScores;
    if (mfavScores.length > 35) {
      evalMfav = [...mfavScores.slice(0, 20), ...mfavScores.slice(20).filter((_, i) => i % Math.ceil((mfavScores.length - 20) / 15) === 0)];
    }
    if (drawScores.length > 25) {
      evalDraw = [...drawScores.slice(0, 15), ...drawScores.slice(15).filter((_, i) => i % Math.ceil((drawScores.length - 15) / 10) === 0)];
    }
    if (udScores.length > 25) {
      evalUd = [...udScores.slice(0, 15), ...udScores.slice(15).filter((_, i) => i % Math.ceil((udScores.length - 15) / 10) === 0)];
    }

    // 1. Mfav vs Underdog pairs (Primary separation)
    for (const ms of evalMfav) {
      for (const us of evalUd) {
        if (us >= ms) {
          inversions++;
          pairwiseMarginSum -= (us - ms + 5);
        } else {
          pairwiseMarginSum += Math.min(25, ms - us);
        }
      }
    }

    // 2. Draw vs Underdog pairs (Filler separation above traps)
    for (const ds of evalDraw) {
      for (const us of evalUd) {
        if (us >= ds) {
          inversions++;
          pairwiseMarginSum -= (us - ds + 5);
        } else {
          pairwiseMarginSum += Math.min(20, ds - us);
        }
      }
    }

    // 3. Mfav vs Draw pairs (Natural AUC pairwise separation so Mfav matches naturally rise above Draws without forced artificial penalties)
    for (const ms of evalMfav) {
      for (const ds of evalDraw) {
        if (ms > ds) {
          pairwiseMarginSum += Math.min(20, ms - ds) * 1.5;
        } else if (ds > ms) {
          pairwiseMarginSum -= Math.min(20, ds - ms) * 1.5;
        }
      }
    }
  } else {
    let evalTargets = targetScores;
    let evalTraps = trapScores;
    if (targetScores.length > 35) {
      evalTargets = [...targetScores.slice(0, 20), ...targetScores.slice(20).filter((_, i) => i % Math.ceil((targetScores.length - 20) / 15) === 0)];
    }
    if (trapScores.length > 25) {
      evalTraps = [...trapScores.slice(0, 15), ...trapScores.slice(15).filter((_, i) => i % Math.ceil((trapScores.length - 15) / 10) === 0)];
    }
    for (const ts of evalTargets) {
      for (const us of evalTraps) {
        if (us >= ts) {
          inversions++;
          pairwiseMarginSum -= (us - ts + 5);
        } else {
          pairwiseMarginSum += Math.min(20, ts - us);
        }
      }
    }
  }

  const minTarget = targetScores.length > 0 ? Math.min(...targetScores) : 0;
  const maxTrap = trapScores.length > 0 ? Math.max(...trapScores) : 0;
  const bufferMargin = targetScores.length > 0 && trapScores.length > 0 ? (minTarget - maxTrap) : 0;

  const totalPairs = targetScores.length * trapScores.length;
  const normalizedPairwise = totalPairs > 0 ? (pairwiseMarginSum / (totalPairs * 20)) : 0;
  const purityRatio = topN > 0 ? targetInTopN / topN : 0;

  // Top N matches evaluated for strict positive scoring floor
  const topNMatches = scored.slice(0, topN);
  const nonPositiveTargetsInTopN = topNMatches.filter(m => targetOutcomes.has(m.outcome) && m.score <= 0);
  const nonPositiveTargetPenalty = (nonPositiveTargetsInTopN.length * 400) +
    nonPositiveTargetsInTopN.reduce((acc, m) => acc + Math.max(0, -m.score) * 10, 0);

  // Target Positive Conviction Reward: Reward target matches in top N having robust positive points (> 0)
  const positiveTargetsInTopN = topNMatches.filter(m => targetOutcomes.has(m.outcome) && m.score > 0);
  const positiveTargetReward = positiveTargetsInTopN.reduce((acc, m) => acc + Math.min(30, m.score) * 4, 0);

  // Trap Positive Suppression Penalty: Trap outcomes with score >= 0 must be heavily penalized
  const positiveTraps = scored.filter(m => trapOutcomes.has(m.outcome) && m.score >= 0);
  const trapPositivePenalty = positiveTraps.length * 300;

  // Boundary Soft-Margin Penalty: Penalize traps that sit near or above the target frontier score
  const frontierTargetGoal = Math.min(horizons.floor, Math.max(topN, 100));
  const frontierTargetScore = targetScores.length >= frontierTargetGoal ? targetScores[frontierTargetGoal - 1] : (targetScores[targetScores.length - 1] ?? 0);
  const trapThreshold = frontierTargetScore - 10;
  let elevatedTrapPenalty = 0;
  for (let i = 0; i < trapScores.length; i++) {
    if (trapScores[i] >= trapThreshold) {
      elevatedTrapPenalty += (trapScores[i] - trapThreshold + 1) * 15;
    }
  }

  let targetsInTop5000 = 0;
  const limit5k = Math.min(5000, scored.length);
  for (let i = 0; i < limit5k; i++) {
    if (targetOutcomes.has(scored[i].outcome)) {
      targetsInTop5000++;
    }
  }

  // Multi-horizon cumulative density tracking across discrete volume thresholds (500, 1000, 1500, 2000, 3000)
  const horizonsToCheck = [500, 1000, 1500, 2000, 3000];
  const hMetricsMap: { [key: number]: { traps: number; targets: number; total: number; winRate: number } } = {};
  
  horizonsToCheck.forEach(h => {
    const limit = Math.min(h, scored.length);
    let traps = 0;
    let targets = 0;
    for (let i = 0; i < limit; i++) {
      if (trapOutcomes.has(scored[i].outcome)) traps++;
      else if (targetOutcomes.has(scored[i].outcome)) targets++;
    }
    const winRate = limit > 0 ? (targets / limit) * 100 : 0;
    hMetricsMap[h] = { traps, targets, total: limit, winRate };
  });

  const horizonMetrics: MultiHorizonSummary = {
    h500: { horizon: 500, traps: hMetricsMap[500].traps, targets: hMetricsMap[500].targets, total: hMetricsMap[500].total, winRate: hMetricsMap[500].winRate },
    h1000: { horizon: 1000, traps: hMetricsMap[1000].traps, targets: hMetricsMap[1000].targets, total: hMetricsMap[1000].total, winRate: hMetricsMap[1000].winRate },
    h1500: { horizon: 1500, traps: hMetricsMap[1500].traps, targets: hMetricsMap[1500].targets, total: hMetricsMap[1500].total, winRate: hMetricsMap[1500].winRate },
    h2000: { horizon: 2000, traps: hMetricsMap[2000].traps, targets: hMetricsMap[2000].targets, total: hMetricsMap[2000].total, winRate: hMetricsMap[2000].winRate },
    h3000: { horizon: 3000, traps: hMetricsMap[3000].traps, targets: hMetricsMap[3000].targets, total: hMetricsMap[3000].total, winRate: hMetricsMap[3000].winRate }
  };

  const isMfavDraw = objective === 'mfav_draw';
  const maxTrapsAllowed500 = isMfavDraw ? 25 : 50;
  const maxTrapsAllowed1000 = isMfavDraw ? 60 : 100;
  const excessTraps500 = Math.max(0, horizonMetrics.h500.traps - maxTrapsAllowed500);
  const excessTraps1000 = Math.max(0, horizonMetrics.h1000.traps - maxTrapsAllowed1000);

  const horizonFitness = (scored.length > 50) ? (
    (horizonMetrics.h500.targets * 25 - horizonMetrics.h500.traps * 150 - excessTraps500 * 300) +
    (horizonMetrics.h1000.targets * 20 - horizonMetrics.h1000.traps * 100 - excessTraps1000 * 200) +
    (horizonMetrics.h1500.targets * 15 - horizonMetrics.h1500.traps * 50) +
    (horizonMetrics.h2000.targets * 10 - horizonMetrics.h2000.traps * 30) +
    (horizonMetrics.h3000.targets * 5  - horizonMetrics.h3000.traps * 15)
  ) : 0;

  // Weight Regularization: meaningful parsimony guard against arbitrary extreme weights
  const isUpsets = objective === 'underdog_only';
  let regSum = 0;
  pointsMap.forEach((pts, desc) => {
    const isBig5 = desc === "Match belongs to England: Premier League";
    const maxBonus = isBig5 ? (isUpsets ? 25 : 40) : 30;
    const normalized = pts < 0 ? Math.abs(pts) / 45 : pts / maxBonus;
    regSum += normalized * normalized;
  });
  const regularizationCost = regSum * 8.0;

  // Clean streak completion bonus
  const cleanStreakBonus = (cleanTopMatches >= Math.min(totalCorrect, topN) && totalCorrect > 0) ? 3000 : 0;

  // Pure mathematical quality across all categories:
  // Maximizes target density across volume horizons, suppresses traps across volume thresholds,
  // maintains clean target streak, and penalizes inversions without rewarding unbounded score inflation
  const quality = (cleanTopMatches * 500) +
    cleanStreakBonus +
    horizonFitness +
    (pairwiseMarginSum * 1.5) -
    (inversions * 5) -
    (trapInTopN * 500) -
    elevatedTrapPenalty +
    Math.min(50, bufferMargin) +
    positiveTargetReward -
    nonPositiveTargetPenalty -
    trapPositivePenalty -
    regularizationCost;

  return {
    quality,
    purityPct: purityRatio * 100,
    trapInTopN,
    targetInTopN,
    inversions,
    bufferMargin,
    topN,
    cleanTopMatches,
    targetCleanMatches: horizons.floor,
    targetMet: floorMet,
    firstTrapRank,
    totalCorrect,
    floorMet,
    ceilingMet,
    targetFloor: horizons.floor,
    targetCeiling: horizons.ceiling,
    regularizationCost,
    targetsInTop5000,
    horizonMetrics,
    trapRanks,
    trapScores: trapScoresList,
    trapGaps,
    trapDispersionHealth
  };
}

const MODULE_DAY_HIST_CACHE = new Map<string, Map<string, { mfav: number; draw: number; underdog: number }>>();
const MODULE_OVERALL_HIST_CACHE = new Map<string, Map<string, {
  mfav: number;
  draw: number;
  underdog: number;
  total: number;
  weekdays: Record<string, { mfav: number; draw: number; underdog: number; total: number }>;
}>>();
const EMPTY_HIST_COUNTS = { mfav: 0, draw: 0, underdog: 0 };
const EMPTY_OVERALL_HIST = {
  mfav: 0,
  draw: 0,
  underdog: 0,
  total: 0,
  weekdays: {
    monday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
    tuesday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
    wednesday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
    thursday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
    friday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
    saturday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
    sunday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
  }
};

export function computeCategoryRecommendations(
  cat: CategoryOption,
  rawDataset: Match[],
  phaStatsMap: Record<string, any> = {},
  matchStars: Record<string, number> = {},
  liveViewType: 'daily' | 'jackpot' = 'daily',
  selectedDay: DayOfWeek | 'all' = 'all',
  allMatches?: Match[]
): {
  recommendations: TriggerRecommendation[];
  baselineStats: {
    totalCompleted: number;
    totalMfav: number;
    totalDraw: number;
    totalUnderdog: number;
    baseMfavPct: number;
    baseDrawPct: number;
    baseUdPct: number;
    baseSafePct: number;
  };
  optimizerMeta: {
    totalComputations: number;
    compoundPenalties: number;
    activeTriggers: number;
    optimizationPasses: number;
  };
} {
  const prefix = cat.tagPrefix;
  const isTop12Cat = cat.id === 'top_12_value' || cat.id === 'top_10_value' || prefix === 'top12:' || prefix === 'top10:';
  const categoryMatches = !prefix ? rawDataset : rawDataset.filter(m => {
    let tags = m.evaluatorTags;
    if (!tags || tags.length === 0) {
      tags = getMatchEvaluatorTags(m, phaStatsMap, liveViewType === 'jackpot', true, matchStars);
      m.evaluatorTags = tags; // Cache onto match object for instant 0ms lookups
    }
    if (isTop12Cat) {
      return tags.some(t => t.startsWith('top12:') || t.startsWith('top10:'));
    }
    return tags.some(t => t.startsWith(prefix));
  });

  const completedMatches = categoryMatches.filter(m => {
    const actual = getActualResult(m.result || '');
    return actual === '1' || actual === 'X' || actual === '2';
  });

  // Persistent module-cached historical day hit stats across the full historical archive (0ms on repeated category/day renders)
  const dayCacheKey = `${cat.id}_${selectedDay}_${allMatches ? allMatches.length : 0}`;
  let dayHistStatsMap = MODULE_DAY_HIST_CACHE.get(dayCacheKey) || null;
  const getDayHistStats = (desc: string): { mfav: number; draw: number; underdog: number } => {
    if (!dayHistStatsMap) {
      dayHistStatsMap = new Map();
      const daySample: Match[] = [];
      if (allMatches && allMatches.length > 0) {
        for (let i = allMatches.length - 1; i >= 0; i--) {
          const m = allMatches[i];
          const actual = getActualResult(m.result || '');
          if (actual !== '1' && actual !== 'X' && actual !== '2') continue;
          if (selectedDay !== 'all' && getMatchDayOfWeek(m) !== selectedDay) continue;
          let tags = m.evaluatorTags;
          if (!tags || tags.length === 0) {
            tags = getMatchEvaluatorTags(m, phaStatsMap, liveViewType === 'jackpot', true, matchStars);
            m.evaluatorTags = tags;
          }
          const inCat = isTop12Cat
            ? tags.some(t => t.startsWith('top12:') || t.startsWith('top10:'))
            : (!prefix || tags.some(t => t.startsWith(prefix)));
          if (inCat) daySample.push(m);
        }
      }
      daySample.forEach(m => {
        const actual = getActualResult(m.result || '');
        if (actual !== '1' && actual !== 'X' && actual !== '2') return;
        const mFav = getMarketFavorite(m);
        const outcome: 'mfav' | 'draw' | 'underdog' = actual === mFav ? 'mfav' : actual === 'X' ? 'draw' : 'underdog';

        let allTriggers: Set<string> = (m as any)._opwCatalogTriggers;
        if (!allTriggers) {
          const stats = extractMatchEvaluationStats(m, phaStatsMap, cat.id);
          allTriggers = evaluateAllCatalogTriggers(stats, m);
          (m as any)._opwCatalogTriggers = allTriggers;
        }
        const combinedTriggers = new Set<string>(allTriggers);
        const lInfo = getMatchCountryAndLeague(m);
        if (lInfo?.display && lInfo.display !== 'Unknown') {
          const lTrig = `Match belongs to ${lInfo.display}`;
          registerDiscoveredLeagueTrigger(lTrig);
          combinedTriggers.add(lTrig);
        }
        combinedTriggers.forEach(t => {
          if (REMOVED_TRIGGER_DESCRIPTIONS.has(t)) return;
          let st = dayHistStatsMap!.get(t);
          if (!st) {
            st = { mfav: 0, draw: 0, underdog: 0 };
            dayHistStatsMap!.set(t, st);
          }
          if (outcome === 'mfav') st.mfav++;
          else if (outcome === 'draw') st.draw++;
          else st.underdog++;
        });
      });
      MODULE_DAY_HIST_CACHE.set(dayCacheKey, dayHistStatsMap);
    }
    return dayHistStatsMap.get(desc) || EMPTY_HIST_COUNTS;
  };

  // Persistent module-cached overall historical hit stats across the full historical archive (0ms on repeated renders)
  const overallCacheKey = `${cat.id}_${allMatches ? allMatches.length : 0}`;
  let overallHistStatsMap = MODULE_OVERALL_HIST_CACHE.get(overallCacheKey) || null;

  const getOverallHistStats = (desc: string) => {
    if (!overallHistStatsMap) {
      overallHistStatsMap = new Map();
      const overallSample: Match[] = [];
      if (allMatches && allMatches.length > 0) {
        for (let i = allMatches.length - 1; i >= 0; i--) {
          const m = allMatches[i];
          const actual = getActualResult(m.result || '');
          if (actual !== '1' && actual !== 'X' && actual !== '2') continue;
          let tags = m.evaluatorTags;
          if (!tags || tags.length === 0) {
            tags = getMatchEvaluatorTags(m, phaStatsMap, liveViewType === 'jackpot', true, matchStars);
            m.evaluatorTags = tags;
          }
          const inCat = isTop12Cat
            ? tags.some(t => t.startsWith('top12:') || t.startsWith('top10:'))
            : (!prefix || tags.some(t => t.startsWith(prefix)));
          if (inCat) overallSample.push(m);
        }
      }
      overallSample.forEach(m => {
        const actual = getActualResult(m.result || '');
        if (actual !== '1' && actual !== 'X' && actual !== '2') return;
        const mFav = getMarketFavorite(m);
        const outcome: 'mfav' | 'draw' | 'underdog' = actual === mFav ? 'mfav' : actual === 'X' ? 'draw' : 'underdog';
        const matchDay = getMatchDayOfWeek(m);

        let allTriggers: Set<string> = (m as any)._opwCatalogTriggers;
        if (!allTriggers) {
          const stats = extractMatchEvaluationStats(m, phaStatsMap, cat.id);
          allTriggers = evaluateAllCatalogTriggers(stats, m);
          (m as any)._opwCatalogTriggers = allTriggers;
        }
        const combinedTriggers = new Set<string>(allTriggers);
        const lInfo = getMatchCountryAndLeague(m);
        if (lInfo?.display && lInfo.display !== 'Unknown') {
          const lTrig = `Match belongs to ${lInfo.display}`;
          registerDiscoveredLeagueTrigger(lTrig);
          combinedTriggers.add(lTrig);
        }
        combinedTriggers.forEach(t => {
          if (REMOVED_TRIGGER_DESCRIPTIONS.has(t)) return;
          let st = overallHistStatsMap!.get(t);
          if (!st) {
            st = {
              mfav: 0,
              draw: 0,
              underdog: 0,
              total: 0,
              weekdays: {
                monday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
                tuesday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
                wednesday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
                thursday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
                friday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
                saturday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
                sunday: { mfav: 0, draw: 0, underdog: 0, total: 0 },
              }
            };
            overallHistStatsMap!.set(t, st);
          }
          st.total++;
          if (outcome === 'mfav') st.mfav++;
          else if (outcome === 'draw') st.draw++;
          else st.underdog++;

          const wd = st.weekdays[matchDay];
          if (wd) {
            wd.total++;
            if (outcome === 'mfav') wd.mfav++;
            else if (outcome === 'draw') wd.draw++;
            else wd.underdog++;
          }
        });
      });
      MODULE_OVERALL_HIST_CACHE.set(overallCacheKey, overallHistStatsMap);
    }
    return overallHistStatsMap.get(desc) || EMPTY_OVERALL_HIST;
  };

  let activeSettings: OptimizedCategorySettings | undefined;
  if (selectedDay !== 'all') {
    activeSettings = DAILY_OPTIMIZED_SETTINGS[selectedDay]?.[cat.id] ||
      DAILY_DEFAULT_CATEGORY_SETTINGS[selectedDay]?.[cat.id] ||
      OPTIMIZED_CATEGORY_SETTINGS[cat.id];
  } else {
    activeSettings = OPTIMIZED_CATEGORY_SETTINGS[cat.id];
  }

  const currentRulePointsMap = new Map<string, number>();
  (activeSettings?.rules || []).forEach(r => currentRulePointsMap.set(r.description, r.points));

  let totalMfav = 0;
  let totalDraw = 0;
  let totalUnderdog = 0;

  // PASS 1: Trigger Correlation Matrix — count {mfav, draw, underdog} per trigger
  const hitStats = new Map<string, { mfav: number; draw: number; underdog: number }>();
  getFullActiveCatalogTriggers().forEach(desc => {
    hitStats.set(desc, { mfav: 0, draw: 0, underdog: 0 });
  });

  // Pre-compute per-match: outcome + which triggers fired
  interface MatchTriggerProfile {
    match: Match;
    outcome: 'mfav' | 'draw' | 'underdog';
    triggersHit: Set<string>;
    baseScore: number;
  }
  const matchProfiles: MatchTriggerProfile[] = [];

  // Evaluate all completed matches in category to capture full historical sample (e.g. 10,211 matches)
  completedMatches.forEach(match => {
    const actual = getActualResult(match.result || '');
    if (actual !== '1' && actual !== 'X' && actual !== '2') return;

    const mFav = getMarketFavorite(match);
    let outcome: 'mfav' | 'draw' | 'underdog';
    if (actual === mFav) {
      outcome = 'mfav';
      totalMfav++;
    } else if (actual === 'X') {
      outcome = 'draw';
      totalDraw++;
    } else {
      outcome = 'underdog';
      totalUnderdog++;
    }

    const matchDay = selectedDay !== 'all' ? selectedDay : getMatchDayOfWeek(match);
    const baseInfo = getOptimizedBaseWeight(match, phaStatsMap, cat.id, matchDay);
    const baseScore = baseInfo?.points ?? 0;

    // Cache catalog triggers on match object for 0ms repeated lookups
    let allTriggers: Set<string> = (match as any)._opwCatalogTriggers;
    if (!allTriggers) {
      const stats = extractMatchEvaluationStats(match, phaStatsMap, cat.id);
      allTriggers = evaluateAllCatalogTriggers(stats, match);
      (match as any)._opwCatalogTriggers = allTriggers;
    }

    const triggersHit = new Set<string>();
    allTriggers.forEach(t => {
      if (REMOVED_TRIGGER_DESCRIPTIONS.has(t)) return;
      triggersHit.add(t);

      let stat = hitStats.get(t);
      if (!stat) {
        stat = { mfav: 0, draw: 0, underdog: 0 };
        hitStats.set(t, stat);
      }
      if (outcome === 'mfav') stat.mfav++;
      else if (outcome === 'draw') stat.draw++;
      else stat.underdog++;
    });

    matchProfiles.push({
      match,
      outcome,
      triggersHit,
      baseScore
    });
  });

  const totalCompleted = totalMfav + totalDraw + totalUnderdog;
  const baseMfavPct = totalCompleted > 0 ? (totalMfav / totalCompleted) * 100 : 0;
  const baseDrawPct = totalCompleted > 0 ? (totalDraw / totalCompleted) * 100 : 0;
  const baseUdPct = totalCompleted > 0 ? (totalUnderdog / totalCompleted) * 100 : 0;
  const baseSafePct = baseMfavPct + baseDrawPct;

  const objective = cat.targetObjective;

  // PASS 2: Objective-Aware Discriminative Power Score (DPS) per trigger
  const triggerDPS = new Map<string, number>();
  const baselineMfavRate = totalCompleted > 0 ? totalMfav / totalCompleted : 0;
  const baselineDrawRate = totalCompleted > 0 ? totalDraw / totalCompleted : 0;
  const baselineUdRate = totalCompleted > 0 ? totalUnderdog / totalCompleted : 0;
  const baselineSafeRate = totalCompleted > 0 ? (totalMfav + totalDraw) / totalCompleted : 0;

  Array.from(hitStats.entries()).forEach(([desc, counts]) => {
    const totalHits = counts.mfav + counts.draw + counts.underdog;
    if (totalHits < 2) {
      triggerDPS.set(desc, 0);
      return;
    }
    const mfavRate = totalHits > 0 ? counts.mfav / totalHits : 0;
    const drawRate = totalHits > 0 ? counts.draw / totalHits : 0;
    const udRate = totalHits > 0 ? counts.underdog / totalHits : 0;
    const safeRate = mfavRate + drawRate;

    let dps = 0;
    if (objective === 'underdog_only') {
      const trapRate = mfavRate + drawRate;
      dps = (baselineUdRate > 0 ? udRate / baselineUdRate : 0) -
            (baselineSafeRate > 0 ? trapRate / baselineSafeRate : 0);
    } else if (objective === 'mfav_only') {
      const nonMfavRate = drawRate + udRate;
      dps = (baselineMfavRate > 0 ? mfavRate / baselineMfavRate : 0) -
            ((baselineDrawRate + baselineUdRate) > 0 ? nonMfavRate / (baselineDrawRate + baselineUdRate) : 0);
    } else {
      // mfav_draw (Top 12, Best Bet, Bankers, BOTB): Mfav is primary target, Draw is safe filler, Underdog is trap
      const mfavEdge = baselineMfavRate > 0 ? mfavRate / baselineMfavRate : 0;
      const drawEdge = baselineDrawRate > 0 ? drawRate / baselineDrawRate : 0;
      const udEdge = baselineUdRate > 0 ? udRate / baselineUdRate : 0;
      dps = (1.5 * mfavEdge) + (0.5 * drawEdge) - (2.0 * udEdge);
    }
    triggerDPS.set(desc, dps);
  });

  // PASS 3: Iterative Point Optimization
  const scoreMatch = (profile: MatchTriggerProfile, pointsMap: Map<string, number>): number => {
    let score = profile.baseScore;
    profile.triggersHit.forEach(desc => {
      score += pointsMap.get(desc) ?? 0;
    });
    return score;
  };

  const measurePairwiseSeparation = (pointsMap: Map<string, number>): number => {
    if (matchProfiles.length === 0) return 0;
    const scored = matchProfiles.map(p => ({
      outcome: p.outcome,
      score: scoreMatch(p, pointsMap)
    }));
    scored.sort((a, b) => b.score - a.score);

    const topN = Math.min(scored.length, cat.targetCapacity);

    let targetOutcomes: Set<string>;
    let trapOutcomes: Set<string>;

    if (objective === 'underdog_only') {
      targetOutcomes = new Set(['underdog']);
      trapOutcomes = new Set(['mfav', 'draw']);
    } else if (objective === 'mfav_only') {
      targetOutcomes = new Set(['mfav']);
      trapOutcomes = new Set(['draw', 'underdog']);
    } else {
      targetOutcomes = new Set(['mfav', 'draw']);
      trapOutcomes = new Set(['underdog']);
    }

    // Find clean matches before first trap
    let firstTrapIndex = scored.length;
    for (let i = 0; i < scored.length; i++) {
      if (trapOutcomes.has(scored[i].outcome)) {
        firstTrapIndex = i;
        break;
      }
    }
    const cleanTopMatches = firstTrapIndex;

    let targetInTopN = 0;
    let trapInTopN = 0;
    for (let i = 0; i < topN; i++) {
      if (targetOutcomes.has(scored[i].outcome)) {
        targetInTopN++;
      } else if (trapOutcomes.has(scored[i].outcome)) {
        trapInTopN++;
      }
    }

    let inversions = 0;
    let pairwiseMarginSum = 0;

    if (objective === 'mfav_draw') {
      const mfavScores: number[] = [];
      const drawScores: number[] = [];
      const udScores: number[] = [];

      for (let i = 0; i < scored.length; i++) {
        if (scored[i].outcome === 'mfav') mfavScores.push(scored[i].score);
        else if (scored[i].outcome === 'draw') drawScores.push(scored[i].score);
        else if (scored[i].outcome === 'underdog') udScores.push(scored[i].score);
      }

      let evalMfav = mfavScores;
      let evalDraw = drawScores;
      let evalUd = udScores;
      if (mfavScores.length > 30) {
        evalMfav = [...mfavScores.slice(0, 15), ...mfavScores.slice(15).filter((_, i) => i % Math.ceil((mfavScores.length - 15) / 15) === 0)];
      }
      if (drawScores.length > 20) {
        evalDraw = [...drawScores.slice(0, 10), ...drawScores.slice(10).filter((_, i) => i % Math.ceil((drawScores.length - 10) / 10) === 0)];
      }
      if (udScores.length > 20) {
        evalUd = [...udScores.slice(0, 10), ...udScores.slice(10).filter((_, i) => i % Math.ceil((udScores.length - 10) / 10) === 0)];
      }

      // 1. Mfav vs Underdog pairs
      for (const ms of evalMfav) {
        for (const us of evalUd) {
          if (us >= ms) {
            inversions++;
            pairwiseMarginSum -= (us - ms + 5);
          } else {
            pairwiseMarginSum += Math.min(25, ms - us);
          }
        }
      }

      // 2. Draw vs Underdog pairs
      for (const ds of evalDraw) {
        for (const us of evalUd) {
          if (us >= ds) {
            inversions++;
            pairwiseMarginSum -= (us - ds + 5);
          } else {
            pairwiseMarginSum += Math.min(20, ds - us);
          }
        }
      }

      // 3. Mfav vs Draw pairs (Natural AUC pairwise separation so Mfav matches naturally rise above Draws without forced artificial penalties)
      for (const ms of evalMfav) {
        for (const ds of evalDraw) {
          if (ms > ds) {
            pairwiseMarginSum += Math.min(20, ms - ds) * 1.5;
          } else if (ds > ms) {
            pairwiseMarginSum -= Math.min(20, ds - ms) * 1.5;
          }
        }
      }
    } else {
      const targetScores: number[] = [];
      const trapScores: number[] = [];

      for (let i = 0; i < scored.length; i++) {
        if (targetOutcomes.has(scored[i].outcome)) {
          targetScores.push(scored[i].score);
        } else if (trapOutcomes.has(scored[i].outcome)) {
          trapScores.push(scored[i].score);
        }
      }

      let evalTargets = targetScores;
      let evalTraps = trapScores;
      if (targetScores.length > 30) {
        evalTargets = [...targetScores.slice(0, 15), ...targetScores.slice(15).filter((_, i) => i % Math.ceil((targetScores.length - 15) / 15) === 0)];
      }
      if (trapScores.length > 20) {
        evalTraps = [...trapScores.slice(0, 10), ...trapScores.slice(10).filter((_, i) => i % Math.ceil((trapScores.length - 10) / 10) === 0)];
      }

      for (const ts of evalTargets) {
        for (const us of evalTraps) {
          if (us >= ts) {
            inversions++;
            pairwiseMarginSum -= (us - ts + 5);
          } else {
            pairwiseMarginSum += Math.min(20, ts - us);
          }
        }
      }
    }

    // Top N matches evaluated for strict positive scoring floor
    const topNMatches = scored.slice(0, topN);
    const nonPositiveTargetsInTopN = topNMatches.filter(m => targetOutcomes.has(m.outcome) && m.score <= 0);
    const nonPositiveTargetPenalty = (nonPositiveTargetsInTopN.length * 400) +
      nonPositiveTargetsInTopN.reduce((acc, m) => acc + Math.max(0, -m.score) * 10, 0);

    // Target Positive Conviction Reward: Reward target matches in top N having robust positive points (> 0)
    const positiveTargetsInTopN = topNMatches.filter(m => targetOutcomes.has(m.outcome) && m.score > 0);
    const positiveTargetReward = positiveTargetsInTopN.reduce((acc, m) => acc + Math.min(30, m.score) * 4, 0);

    // Trap Positive Suppression Penalty: Trap outcomes with score >= 0 must be heavily penalized
    const positiveTraps = scored.filter(m => trapOutcomes.has(m.outcome) && m.score >= 0);
    const trapPositivePenalty = positiveTraps.length * 300;

    // Target high score elevation reward: Reward winning target matches having robust high scores (>= 100, 150, 200 pts)
    let target100Reward = 0;
    for (const m of scored) {
      if (targetOutcomes.has(m.outcome)) {
        if (m.score >= 200) target100Reward += 300;
        else if (m.score >= 150) target100Reward += 200;
        else if (m.score >= 100) target100Reward += 150;
        else if (m.score >= 50) target100Reward += 50;
      }
    }

    const totalCorrect = scored.filter(m => targetOutcomes.has(m.outcome)).length;
    const cleanStreakBonus = (cleanTopMatches >= Math.min(totalCorrect, topN) && totalCorrect > 0) ? 3000 : 0;

    // Pure mathematical quality with absolute positive score floor
    const quality = (cleanTopMatches * 500) +
      cleanStreakBonus +
      (pairwiseMarginSum * 1.5) -
      (inversions * 5) -
      (trapInTopN * 500) +
      positiveTargetReward +
      target100Reward -
      nonPositiveTargetPenalty -
      trapPositivePenalty;
    return quality;
  };

  const sortedTriggers = Array.from(triggerDPS.entries())
    .filter(([desc]) => {
      const counts = hitStats.get(desc);
      return counts && (counts.mfav + counts.draw + counts.underdog) >= 1;
    })
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([desc]) => desc);

  const POINT_VALUES = [-30, -25, -20, -15, -10, -5, 5, 10, 15, 20, 25, 30];
  const OPTIMIZATION_PASSES = 5;
  let totalComputations = 0;

  const isTriggerEmpiricallyBalanced = (counts?: { mfav: number; draw: number; underdog: number }): boolean => {
    if (!counts) return true;
    const total = counts.mfav + counts.draw + counts.underdog;
    if (total === 0) return true;
    const mfavPct = (counts.mfav / total) * 100;
    const drawPct = (counts.draw / total) * 100;
    const udPct = (counts.underdog / total) * 100;
    // Outcome is balanced across all 3 (~33% each within ±8%), or Mfav and Underdog are nearly equal (within ±6%)
    const isThreeWay = Math.abs(mfavPct - 33.3) <= 8 && Math.abs(drawPct - 33.3) <= 8 && Math.abs(udPct - 33.3) <= 8;
    const isTwoWayTied = Math.abs(mfavPct - udPct) <= 6 && mfavPct <= 45;
    return isThreeWay || isTwoWayTied;
  };

  const catalogTriggers = getFullActiveCatalogTriggers();
  const optimizedPoints = new Map<string, number>();
  const isUpsetsObj = objective === 'underdog_only';
  const recLockDay = selectedDay !== 'all' ? selectedDay : undefined;
  catalogTriggers.forEach(desc => {
    const counts = hitStats.get(desc);
    const overallCounts = getOverallHistStats(desc);
    const currentVal = currentRulePointsMap.get(desc);
    const profile = getTriggerAccuracyProfile(desc, counts, objective, currentVal, false, cat.id, recLockDay, overallCounts);
    let initialPts = (currentVal !== undefined && ((profile.zeroEligible && currentVal === 0) || (currentVal !== 0 && ALLOWED_POINT_VALUES.includes(currentVal))))
      ? currentVal
      : getNewTriggerDefaultPoints(desc);
    if (!profile.zeroEligible && initialPts === 0) {
      initialPts = getNewTriggerDefaultPoints(desc);
    }
    
    // Clamp to trigger's empirical allowed band
    if (!profile.allowedBand.includes(initialPts)) {
      initialPts = profile.allowedBand.reduce((prev, curr) => Math.abs(curr - initialPts) < Math.abs(prev - initialPts) ? curr : prev);
    }
    optimizedPoints.set(desc, initialPts);
  });

  // Instantaneous O(N) Empirical Lift & Relative-Risk Calibration (Live-Analysis-First)
  // Always execute fast empirical calibration on the render thread to ensure zero UI freeze (< 10ms).
  // Deep multi-permutation search is executed asynchronously in the background Deep Continuous Optimizer.
  const isHistUniv = matchProfiles.length > 60;
  catalogTriggers.forEach(desc => {
    const counts = hitStats.get(desc);
    const totalHits = counts ? counts.mfav + counts.draw + counts.underdog : 0;
    const currentVal = currentRulePointsMap.get(desc);
    const profile = getTriggerAccuracyProfile(desc, counts, objective, currentVal, isHistUniv, cat.id, recLockDay, getOverallHistStats(desc));

    if (totalHits === 0 || (totalHits >= 8 && isTriggerEmpiricallyBalanced(counts))) {
      optimizedPoints.set(desc, profile.historicalAnchor);
      return;
    }

    let pts = 0;
    if (objective === 'underdog_only') {
      // Upsets: Pro-underdog/volatile gets natural bonus, pro-Mfav gets natural penalty
      const udRate = profile.underdogRate;
      const mfavRate = profile.mfavRate;
      if (profile.isVolatileSignal || udRate >= 0.22 || udRate > mfavRate) {
        if (udRate >= 0.45) pts = 25;
        else if (udRate >= 0.38) pts = 20;
        else if (udRate >= 0.30 || profile.underdogLift >= 1.40) pts = 15;
        else if (udRate >= 0.24 || profile.underdogLift >= 1.25) pts = 10;
        else pts = 5;
      } else if (mfavRate >= 0.55 || udRate <= 0.12) {
        if (mfavRate >= 0.70) pts = -30;
        else if (mfavRate >= 0.65) pts = -25;
        else if (mfavRate >= 0.58) pts = -20;
        else pts = -10;
      } else {
        pts = profile.historicalAnchor !== 0 ? profile.historicalAnchor : 5;
      }
    } else if (objective === 'mfav_only') {
      // Best Bets / Bankers: Mfav must win. Pro-Mfav gets natural bonus, volatile/trap triggers get natural penalty
      const mfavRate = profile.mfavRate;
      const udRate = profile.underdogRate;
      const trapRate = profile.trapFrequency;
      if (profile.isVolatileSignal || udRate >= 0.25 || trapRate >= 0.52 || mfavRate < 0.48) {
        if (udRate >= 0.35 || mfavRate <= 0.30) pts = -30;
        else if (udRate >= 0.30 || mfavRate <= 0.38) pts = -25;
        else if (udRate >= 0.25 || mfavRate <= 0.45 || profile.isVolatileSignal) pts = -20;
        else pts = -10;
      } else if (mfavRate >= 0.52 && udRate <= 0.20) {
        if (mfavRate >= 0.80) pts = 25;
        else if (mfavRate >= 0.70) pts = 20;
        else if (mfavRate >= 0.60) pts = 15;
        else pts = 10;
      } else {
        pts = profile.historicalAnchor !== 0 ? profile.historicalAnchor : 10;
      }
    } else {
      // mfav_draw (e.g. Top 12 Value): 1X Hedged. Pro-Target gets natural bonus, pro-underdog gets natural penalty
      const targetAcc = profile.targetAccuracy;
      const udRate = profile.underdogRate;
      const netEdge = targetAcc - udRate;
      if (targetAcc > udRate && udRate <= 0.25) {
        if (targetAcc >= 0.85 || netEdge >= 0.70) pts = 25;
        else if (targetAcc >= 0.75 || netEdge >= 0.50) pts = 20;
        else if (targetAcc >= 0.68 || netEdge >= 0.35) pts = 15;
        else if (targetAcc >= 0.60 || netEdge >= 0.20) pts = 10;
        else pts = 5;
      } else if (udRate > 0.25 || udRate >= targetAcc) {
        if (udRate >= 0.50) pts = -30;
        else if (udRate >= 0.42) pts = -25;
        else if (udRate >= 0.35) pts = -20;
        else if (udRate >= 0.28) pts = -15;
        else pts = -10;
      } else {
        pts = profile.historicalAnchor !== 0 ? profile.historicalAnchor : 10;
      }
    }

    // Strictly enforce domain polarity:
    // Only NEUTRAL triggers (League triggers, DUAL_BONUS_TRIGGERS, NEUTRAL_TRIGGERS) can flip between bonus and penalty.
    // PRO_UNDERDOG remains penalties and PRO_MFAV remains bonuses.
    const trigPolarity = (isLeagueTrigger(desc) || DUAL_BONUS_TRIGGERS.has(desc)) ? 'NEUTRAL' : getTriggerSemanticPolarity(desc, objective);
    if (trigPolarity !== 'NEUTRAL') {
      if (objective === 'underdog_only') {
        if (trigPolarity === 'PRO_UNDERDOG' && pts < 5) pts = 5;
        else if (trigPolarity === 'PRO_MFAV' && pts > -5) pts = -5;
      } else {
        if (trigPolarity === 'PRO_UNDERDOG' && pts > -5) pts = -5;
        else if (trigPolarity === 'PRO_MFAV' && pts < 5) pts = 5;
      }
    }

    // Clamp to trigger's empirical allowed band
    if (!profile.allowedBand.includes(pts)) {
      pts = profile.allowedBand.reduce((prev, curr) => Math.abs(curr - pts) < Math.abs(prev - pts) ? curr : prev);
    }
    optimizedPoints.set(desc, pts);
    totalComputations++;
  });

  // Final Trigger Recommendation Generation (Live-Analysis-First Bayesian Blending)
  const recs: TriggerRecommendation[] = catalogTriggers.map(desc => {
    const rawCounts = hitStats.get(desc) || { mfav: 0, draw: 0, underdog: 0 };
    const liveTotalHits = rawCounts.mfav + rawCounts.draw + rawCounts.underdog;
    const rawCurrent = currentRulePointsMap.get(desc);
    let currentPoints = currentRulePointsMap.has(desc)
      ? (rawCurrent ?? 5)
      : 5;

    let effectiveCounts = rawCounts;
    let usedDayHistory = false;
    let usedOverallHistory = false;
    const dayCounts = getDayHistStats(desc);
    const dayTotalHits = dayCounts.mfav + dayCounts.draw + dayCounts.underdog;
    const overallStats = getOverallHistStats(desc);
    const overallTotalHits = overallStats.total;

    // LIVE-ANALYSIS-FIRST PRIORITY:
    // When a trigger has >= 1 hit in Live Analysis, Live Analysis dominates (4x live weight + 1x normalized historical stabilizer when live < 5).
    // Only when liveTotalHits === 0 does it fall back to Historical Archive / saved points.
    if (liveTotalHits === 0) {
      if (dayTotalHits >= 1) {
        effectiveCounts = dayCounts;
        usedDayHistory = true;
      } else if (overallTotalHits >= 1) {
        effectiveCounts = { mfav: overallStats.mfav, draw: overallStats.draw, underdog: overallStats.underdog };
        usedOverallHistory = true;
      }
    } else if (liveTotalHits < 5 && (dayTotalHits > 0 || overallTotalHits > 0)) {
      const histSrc = dayTotalHits >= 3 ? dayCounts : { mfav: overallStats.mfav, draw: overallStats.draw, underdog: overallStats.underdog };
      const histTot = Math.max(1, histSrc.mfav + histSrc.draw + histSrc.underdog);
      effectiveCounts = {
        mfav: rawCounts.mfav * 4 + (histSrc.mfav / histTot) * 2,
        draw: rawCounts.draw * 4 + (histSrc.draw / histTot) * 2,
        underdog: rawCounts.underdog * 4 + (histSrc.underdog / histTot) * 2,
      };
      usedDayHistory = dayTotalHits >= 3;
      usedOverallHistory = !usedDayHistory && overallTotalHits > 0;
    }

    const totalHits = effectiveCounts.mfav + effectiveCounts.draw + effectiveCounts.underdog;
    const mfavPct = totalHits > 0 ? (effectiveCounts.mfav / totalHits) * 100 : 0;
    const drawPct = totalHits > 0 ? (effectiveCounts.draw / totalHits) * 100 : 0;
    const underdogPct = totalHits > 0 ? (effectiveCounts.underdog / totalHits) * 100 : 0;
    const safePct = mfavPct + drawPct;

    const profile = getTriggerAccuracyProfile(desc, effectiveCounts, objective, currentPoints, false, cat.id, recLockDay, overallStats);
    let recommendedPoints: number;
    let ratchetAction: 'increased_bonus' | 'deepened_penalty' | 'preserved' | 'none' = 'none';
    const isUnderdogCat = objective === 'underdog_only';
    const basePoints = (isUnderdogCat || currentPoints !== 0) ? currentPoints : profile.historicalAnchor;
    const polarity = (isLeagueTrigger(desc) || DUAL_BONUS_TRIGGERS.has(desc)) ? 'NEUTRAL' : getTriggerSemanticPolarity(desc, cat.id || objective);

    if (liveTotalHits === 0) {
      // Unseen in today's Live Analysis: preserve calibrated historical points untouched
      recommendedPoints = basePoints;
      ratchetAction = 'preserved';
    } else {
      // Active in today's Live Analysis: allow points to move up OR down based on live performance
      // (while strictly keeping PRO_MFAV in bonus range and PRO_UNDERDOG in penalty range; only NEUTRAL flips sign)
      recommendedPoints = optimizedPoints.get(desc) ?? profile.historicalAnchor;
      if (recommendedPoints > basePoints && recommendedPoints > 0) ratchetAction = 'increased_bonus';
      else if (recommendedPoints < basePoints && recommendedPoints < 0) ratchetAction = 'deepened_penalty';
      else ratchetAction = 'none';
    }

    // Clamp recommendation strictly to trigger's empirical allowed band (which enforces PRO_MFAV bonus-only, PRO_UNDERDOG penalty-only, NEUTRAL bidirectional)
    if (profile.allowedBand.length > 0 && !profile.allowedBand.includes(recommendedPoints)) {
      recommendedPoints = profile.allowedBand.reduce((prev, curr) => Math.abs(curr - recommendedPoints) < Math.abs(prev - recommendedPoints) ? curr : prev);
    }

    const isBig5 = /^match belongs? to (?:english\s+|england\s*:\s*|england\s*-\s*)?premier\s+league$/i.test((desc || '').trim());
    const maxBonus = isLeagueTrigger(desc) ? getLeagueTriggerMaxBonus(desc, isUnderdogCat) : (isBig5 ? (isUnderdogCat ? 30 : 40) : 30);
    const maxPenalty = isLeagueTrigger(desc) ? getLeagueTriggerMaxPenalty(desc) : -30;
    if (recommendedPoints > 0) {
      recommendedPoints = Math.max(5, Math.min(maxBonus, recommendedPoints));
    } else if (recommendedPoints < 0) {
      recommendedPoints = Math.min(-5, Math.max(maxPenalty, recommendedPoints));
    } else if (!isUnderdogCat || !profile.zeroEligible) {
      recommendedPoints = isUnderdogCat
        ? (polarity === 'PRO_UNDERDOG' ? 5 : -5)
        : (polarity === 'PRO_MFAV' ? 5 : -5);
    }

    let confidence: TriggerRecommendation['confidence'] = 'Insufficient Data';
    if (liveTotalHits >= 10 || totalHits >= 15) confidence = 'High';
    else if (liveTotalHits >= 4 || totalHits >= 8) confidence = 'Medium';
    else if (liveTotalHits >= 1 || totalHits >= 2) confidence = 'Low';

    let rationale = '';
    if (liveTotalHits === 0) {
      rationale = `0 live hits today (${dayTotalHits} day hist, ${overallTotalHits} overall hist). Preserved calibrated ${basePoints > 0 ? '+' : ''}${basePoints} pts.`;
    } else {
      const volTag = profile.isVolatileSignal ? ' [Volatile]' : '';
      const dps = triggerDPS.get(desc) ?? 0;
      const liveMfavPct = (rawCounts.mfav / liveTotalHits) * 100;
      const liveDrawPct = (rawCounts.draw / liveTotalHits) * 100;
      const liveUdPct = (rawCounts.underdog / liveTotalHits) * 100;
      rationale = `Live (${liveTotalHits} hits): ${liveMfavPct.toFixed(0)}% Mfav, ${liveDrawPct.toFixed(0)}% Draw, ${liveUdPct.toFixed(0)}% UD (DPS ${dps > 0 ? '+' : ''}${dps.toFixed(2)})${volTag}.`;
    }

    const netEdge = objective === 'underdog_only'
      ? (underdogPct - mfavPct)
      : (mfavPct - (underdogPct * 1.5 + drawPct * 0.5));

    const finalCurrentPoints = currentRulePointsMap.has(desc)
      ? (currentRulePointsMap.get(desc) ?? currentPoints)
      : ((isUnderdogCat || currentPoints !== 0) ? currentPoints : 5);
    const finalRecommendedPoints = (isUnderdogCat || recommendedPoints !== 0)
      ? recommendedPoints
      : (currentRulePointsMap.has(desc) ? (currentRulePointsMap.get(desc) ?? 5) : 5);

    return {
      description: desc,
      currentPoints: finalCurrentPoints,
      recommendedPoints: finalRecommendedPoints,
      totalHits: liveTotalHits,
      mfavHits: liveTotalHits > 0 ? rawCounts.mfav : effectiveCounts.mfav,
      drawHits: liveTotalHits > 0 ? rawCounts.draw : effectiveCounts.draw,
      underdogHits: liveTotalHits > 0 ? rawCounts.underdog : effectiveCounts.underdog,
      mfavPct,
      drawPct,
      underdogPct,
      safePct,
      netEdge,
      rationale,
      confidence,
      isVolatileSignal: profile.isVolatileSignal,
      underdogLift: profile.underdogLift,
      historicalAnchor: profile.historicalAnchor,
      overallHits: overallTotalHits,
      overallMfavHits: overallStats.mfav,
      overallDrawHits: overallStats.draw,
      overallUnderdogHits: overallStats.underdog,
      overallSafePct: overallTotalHits > 0 ? ((overallStats.mfav + overallStats.draw) / overallTotalHits) * 100 : 0,
      overallMfavPct: overallTotalHits > 0 ? (overallStats.mfav / overallTotalHits) * 100 : 0,
      overallDrawPct: overallTotalHits > 0 ? (overallStats.draw / overallTotalHits) * 100 : 0,
      overallUnderdogPct: overallTotalHits > 0 ? (overallStats.underdog / overallTotalHits) * 100 : 0,
      overallUnderdogLift: overallTotalHits > 0 ? (overallStats.underdog / overallTotalHits) / 0.18 : 1.0,
      dayHistHits: dayTotalHits,
      dayHistSafePct: dayTotalHits > 0 ? ((dayCounts.mfav + dayCounts.draw) / dayTotalHits) * 100 : 0,
      dayHistMfavPct: dayTotalHits > 0 ? (dayCounts.mfav / dayTotalHits) * 100 : 0,
      dayHistDrawPct: dayTotalHits > 0 ? (dayCounts.draw / dayTotalHits) * 100 : 0,
      dayHistUnderdogPct: dayTotalHits > 0 ? (dayCounts.underdog / dayTotalHits) * 100 : 0,
      ratchetAction,
      weekdayDistribution: overallStats.weekdays
    };
  });

  return {
    recommendations: recs,
    baselineStats: {
      totalCompleted,
      totalMfav,
      totalDraw,
      totalUnderdog,
      baseMfavPct,
      baseDrawPct,
      baseUdPct,
      baseSafePct
    },
    optimizerMeta: {
      totalComputations,
      compoundPenalties: 0,
      activeTriggers: sortedTriggers.length,
      optimizationPasses: matchProfiles.length > 60 ? 1 : OPTIMIZATION_PASSES
    }
  };
}

interface MemoizedTriggerTableRowProps {
  row: TriggerRecommendation;
  isLeaguesView: boolean;
  isUpsetsCat: boolean;
  isLockedProUd: boolean;
  categoryLabel: string;
  onInspectHistory: (desc: string) => void;
  onSetTriggerPoints: (desc: string, pts: number) => void;
  onToggleLeaguePolarity: (desc: string) => void;
}

const MemoizedTriggerTableRow = React.memo<MemoizedTriggerTableRowProps>(({
  row,
  isLeaguesView,
  isUpsetsCat,
  isLockedProUd,
  categoryLabel,
  onInspectHistory,
  onSetTriggerPoints,
  onToggleLeaguePolarity
}) => {
  const isBonus = row.recommendedPoints > 0;
  const isPenalty = row.recommendedPoints < 0;
  const isDiff = row.recommendedPoints !== row.currentPoints;

  return (
    <tr
      className="hover:bg-slate-800/40 transition"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 44px' }}
    >
      <td className="py-2.5 px-3.5 font-medium text-slate-200">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isBonus ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            ) : isPenalty ? (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
            )}
            <span className="truncate max-w-xs sm:max-w-sm">{row.description}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onInspectHistory(row.description)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800/90 hover:bg-indigo-950/90 text-slate-300 hover:text-indigo-300 border border-slate-700/60 hover:border-indigo-500/50 transition shrink-0"
              title="Inspect trigger across overall historical data (all days)"
            >
              <History size={11} className="text-indigo-400" />
              <span>Hist: {row.overallHits || 0}</span>
              <span className="text-slate-500">({(row.overallSafePct || 0).toFixed(0)}%)</span>
            </button>
          </div>
        </div>
      </td>

      {/* Current Points */}
      <td className="py-2.5 px-2 text-center font-mono font-semibold">
        <span className={`px-2 py-0.5 rounded text-[11px] ${
          row.currentPoints > 0
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : row.currentPoints < 0
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              : 'bg-slate-800 text-slate-400'
        }`}>
          {row.currentPoints > 0 ? `+${row.currentPoints}` : row.currentPoints}
        </span>
      </td>

      {/* Recommended Points */}
      <td className="py-2.5 px-2 text-center font-mono font-bold">
        <span className={`px-2.5 py-0.5 rounded text-[11px] shadow-sm ${
          isBonus
            ? 'bg-emerald-500 text-white font-black'
            : isPenalty
              ? 'bg-rose-500 text-white font-black'
              : 'bg-slate-800 text-slate-400 border border-slate-700'
        } ${isDiff ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900' : ''}`}>
          {row.recommendedPoints > 0 ? `+${row.recommendedPoints}` : row.recommendedPoints}
        </span>
      </td>

      {/* Polarity & Quick Shift (Leagues View Only) */}
      {isLeaguesView && (
        <td className="py-2.5 px-2 text-center font-mono">
          <div className="inline-flex items-center gap-1 bg-slate-950/80 p-0.5 rounded border border-slate-800">
            <button
              type="button"
              onClick={() => onToggleLeaguePolarity(row.description)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                isLockedProUd
                  ? 'bg-purple-600 text-white hover:bg-purple-500 shadow-sm ring-1 ring-purple-300'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
              title={
                isLockedProUd
                  ? `Currently locked as PRO-UNDERDOG in ${categoryLabel} (Strict penalty in Mfav, bonus in Upsets). Click to restore to NEUTRAL.`
                  : "Currently NEUTRAL league trigger (can move between bonus & penalty). Click to lock as PRO-UNDERDOG trigger."
              }
            >
              {isLockedProUd ? 'PRO-UD' : 'NEUTRAL'}
            </button>

            {isUpsetsCat && (
              <button
                type="button"
                onClick={() => onSetTriggerPoints(row.description, 0)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                  row.recommendedPoints === 0
                    ? 'bg-slate-600 text-white shadow-sm ring-1 ring-slate-400'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                title="Set to 0 Points (Allowed for Upsets only)"
              >
                0
              </button>
            )}
            <button
              type="button"
              onClick={() => onSetTriggerPoints(row.description, 5)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                row.recommendedPoints === 5
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'bg-slate-800/80 text-emerald-400 hover:bg-emerald-950 hover:text-emerald-300'
              }`}
              title="Set to +5 Bonus"
            >
              +5
            </button>
            <button
              type="button"
              onClick={() => onSetTriggerPoints(row.description, 20)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                row.recommendedPoints === 20
                  ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                  : 'bg-slate-800/80 text-emerald-300 hover:bg-emerald-950 hover:text-emerald-200'
              }`}
              title="Set to +20 Bonus (Standard bonus cap)"
            >
              +20
            </button>
            <button
              type="button"
              onClick={() => onSetTriggerPoints(row.description, -15)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                row.recommendedPoints === -15
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'bg-slate-800/80 text-rose-400 hover:bg-rose-950 hover:text-rose-300'
              }`}
              title="Set to -15 Penalty (Volatile league)"
            >
              -15
            </button>
            <button
              type="button"
              onClick={() => onSetTriggerPoints(row.description, -30)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                row.recommendedPoints === -30
                  ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-400'
                  : 'bg-slate-800/80 text-rose-300 hover:bg-rose-950 hover:text-rose-200'
              }`}
              title="Set to -30 Penalty (Extreme trap / volatile league)"
            >
              -30
            </button>
          </div>
        </td>
      )}

      {/* Hits */}
      <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-300">
        {row.totalHits}
      </td>

      {/* Mfav Hits */}
      <td className="py-2.5 px-2 text-center font-mono">
        <span className="text-emerald-400 font-bold">{row.mfavHits}</span>
        <span className="text-[10px] text-slate-500 ml-1">({row.mfavPct.toFixed(0)}%)</span>
      </td>

      {/* Draw Hits */}
      <td className="py-2.5 px-2 text-center font-mono">
        <span className="text-amber-400 font-bold">{row.drawHits}</span>
        <span className="text-[10px] text-slate-500 ml-1">({row.drawPct.toFixed(0)}%)</span>
      </td>

      {/* Underdog Hits */}
      <td className="py-2.5 px-2 text-center font-mono">
        <span className="text-rose-400 font-bold">{row.underdogHits}</span>
        <span className="text-[10px] text-slate-500 ml-1">({row.underdogPct.toFixed(0)}%)</span>
      </td>

      {/* Safe Conviction */}
      <td className="py-2.5 px-2 text-center font-mono font-bold">
        <span className={`px-2 py-0.5 rounded text-[11px] ${
          row.safePct >= 75
            ? 'bg-emerald-500/20 text-emerald-300'
            : row.safePct >= 60
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-rose-500/20 text-rose-300'
        }`}>
          {row.totalHits > 0 ? `${row.safePct.toFixed(0)}%` : '0%'}
        </span>
      </td>

      {/* Rationale */}
      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
        {row.rationale}
      </td>
    </tr>
  );
}, (prev, next) => (
  prev.row.description === next.row.description &&
  prev.row.currentPoints === next.row.currentPoints &&
  prev.row.recommendedPoints === next.row.recommendedPoints &&
  prev.row.totalHits === next.row.totalHits &&
  prev.row.mfavHits === next.row.mfavHits &&
  prev.row.drawHits === next.row.drawHits &&
  prev.row.underdogHits === next.row.underdogHits &&
  prev.row.safePct === next.row.safePct &&
  prev.row.overallHits === next.row.overallHits &&
  prev.row.rationale === next.row.rationale &&
  prev.isLeaguesView === next.isLeaguesView &&
  prev.isUpsetsCat === next.isUpsetsCat &&
  prev.isLockedProUd === next.isLockedProUd &&
  prev.categoryLabel === next.categoryLabel
));

const OPWAlgoComponent: React.FC<OPWAlgoProps> = ({
  matches = [],
  allMatches = [],
  phaStatsMap = {},
  matchStars = {},
  liveViewType = 'daily',
  initialCategory = 'top_12_value',
  initialDay = 'all',
  titlePrefix,
  onBack,
  onSelectDayAlgo
}) => {
  const [activeCategory, setActiveCategory] = useState<string>(() => {
    if (CATEGORIES.some(c => c.id === initialCategory)) return initialCategory;
    if (initialCategory === 'top12' || initialCategory === 'top10' || initialCategory === 'top_10_value' || initialCategory === 'all') return 'top_12_value';
    return 'top_12_value';
  });

  const liveMatchDay = useMemo<DayOfWeek>(() => {
    const counts: Partial<Record<DayOfWeek, number>> = {};
    if (matches && matches.length > 0) {
      matches.forEach(m => {
        if (m.date) {
          const d = getMatchDayOfWeek(m);
          counts[d] = (counts[d] || 0) + 1;
        }
      });
      const best = (Object.entries(counts) as [DayOfWeek, number][]).sort((a, b) => b[1] - a[1])[0];
      if (best) return best[0];
    }
    const map: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return map[new Date().getDay()];
  }, [matches]);

  const userPickedDayRef = useRef(false);

  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>(() => {
    if (initialDay && initialDay !== 'all') return initialDay;
    return liveMatchDay;
  });
  const [datasetScope, setDatasetScope] = useState<'live' | 'history' | 'all'>('live');

  const datasetDay = useMemo<DayOfWeek>(() => {
    if (selectedDay !== 'all') return selectedDay;
    const targetDataset = datasetScope === 'history' ? (allMatches && allMatches.length > 0 ? allMatches : matches) : matches;
    if (targetDataset && targetDataset.length > 0) {
      const counts: Partial<Record<DayOfWeek, number>> = {};
      targetDataset.forEach(m => {
        if (m.date) {
          const d = getMatchDayOfWeek(m);
          counts[d] = (counts[d] || 0) + 1;
        }
      });
      const best = (Object.entries(counts) as [DayOfWeek, number][]).sort((a, b) => b[1] - a[1])[0];
      if (best) return best[0];
    }
    return liveMatchDay || 'sunday';
  }, [selectedDay, datasetScope, allMatches, matches, liveMatchDay]);

  useEffect(() => {
    if (datasetScope === 'live' && !userPickedDayRef.current) {
      const targetDay = (matches && matches.length > 0 && liveMatchDay) ? liveMatchDay : (initialDay && initialDay !== 'all' ? initialDay : liveMatchDay);
      if (targetDay) {
        setSelectedDay(targetDay);
        setSelectedAdoptDays(new Set([targetDay]));
      }
    }
  }, [datasetScope, liveMatchDay, initialDay, matches]);
  const [searchQuery, setSearchQuery] = useState('');
  const [triggersViewTab, setTriggersViewTab] = useState<'core' | 'leagues'>('core');
  const [recommendationFilter, setRecommendationFilter] = useState<'all' | 'bonus' | 'penalty' | 'zero' | 'mismatch'>('all');
  const [sortField, setSortField] = useState<'recommended' | 'hits' | 'safePct' | 'description'>('hits');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCopyCodeModal, setShowCopyCodeModal] = useState(false);
  const [codeModalTab, setCodeModalTab] = useState<'all' | 'category' | 'catalog'>('all');
  const [showAdoptModal, setShowAdoptModal] = useState(false);
  const [selectedAdoptDays, setSelectedAdoptDays] = useState<Set<DayOfWeek>>(() => {
    if (initialDay && initialDay !== 'all') return new Set([initialDay as DayOfWeek]);
    return new Set(['saturday']);
  });
  const [adoptToMainAlgo, setAdoptToMainAlgo] = useState(true);
  const [historyInspectTrigger, setHistoryInspectTrigger] = useState<string | null>(null);

  // Deep Continuous Optimizer State
  const [isDeepOptimizing, setIsDeepOptimizing] = useState(false);
  const [deepStatus, setDeepStatus] = useState<'idle' | 'running' | 'paused' | 'converged'>('idle');
  const [deepConvergenceMode, setDeepConvergenceMode] = useState<'none' | 'floor' | 'sweet_spot' | 'perfect_100'>('none');
  const [deepComputations, setDeepComputations] = useState(0);
  const [deepElapsedMs, setDeepElapsedMs] = useState(0);
  const [deepEvalRate, setDeepEvalRate] = useState(0);
  const [deepPurityPct, setDeepPurityPct] = useState(0);
  const [deepInversions, setDeepInversions] = useState(0);
  const [deepBufferMargin, setDeepBufferMargin] = useState(0);
  const [deepQuality, setDeepQuality] = useState(0);
  const [deepCleanMatches, setDeepCleanMatches] = useState(0);
  const [deepTargetClean, setDeepTargetClean] = useState(0);
  const [deepTargetCeiling, setDeepTargetCeiling] = useState(0);
  const [deepFirstTrapRank, setDeepFirstTrapRank] = useState(1);
  const [deepTiedAtBoundary, setDeepTiedAtBoundary] = useState(0);
  const [deepTargetsInTop5000, setDeepTargetsInTop5000] = useState(0);
  const [deepTrapRanks, setDeepTrapRanks] = useState<number[]>([1]);
  const [deepTrapScores, setDeepTrapScores] = useState<number[]>([]);
  const [deepTrapGaps, setDeepTrapGaps] = useState<number[]>([]);
  const [deepTrapDispersionHealth, setDeepTrapDispersionHealth] = useState<'HEALTHY' | 'MODERATE' | 'CLUSTERED'>('CLUSTERED');
  const [deepOptimizerPhase, setDeepOptimizerPhase] = useState<OptimizerPhaseState>({
    currentPhase: 1,
    phaseComps: 0,
    phaseBudget: 500000,
    establishedRanks: [],
    establishedScores: []
  });
  const [deepHorizonMetrics, setDeepHorizonMetrics] = useState<MultiHorizonSummary>({
    h500: { horizon: 500, traps: 0, targets: 0, total: 0, winRate: 0 },
    h1000: { horizon: 1000, traps: 0, targets: 0, total: 0, winRate: 0 },
    h1500: { horizon: 1500, traps: 0, targets: 0, total: 0, winRate: 0 },
    h2000: { horizon: 2000, traps: 0, targets: 0, total: 0, winRate: 0 },
    h3000: { horizon: 3000, traps: 0, targets: 0, total: 0, winRate: 0 }
  });
  const [deepPointsMap, setDeepPointsMap] = useState<Map<string, number> | null>(null);
  const [deepCategoryPointsMap, setDeepCategoryPointsMap] = useState<Record<string, Map<string, number>>>({});
  const [deepDiagnostics, setDeepDiagnostics] = useState<{
    seen: number;
    expected: number;
    targetsSeen: number;
    droppedNoOdds: number;
    goalN: number;
    infeasible: { teams: string; separable: number; triggers: string[] }[];
  } | null>(null);
  const [isSavingCode, setIsSavingCode] = useState(false);
  const [deepBatchProgress, setDeepBatchProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const stopDeepRef = useRef<boolean>(false);
  const isBatchOptimizingRef = useRef<boolean>(false);

  const [weightsVersion, setWeightsVersion] = useState<number>(0);

  // Clean Matches Breakdown Modal State
  const [isCleanMatchesModalOpen, setIsCleanMatchesModalOpen] = useState<boolean>(false);
  const [expandedCleanMatchIds, setExpandedCleanMatchIds] = useState<Set<string | number>>(new Set());
  const [showAllRankedInCleanModal, setShowAllRankedInCleanModal] = useState<boolean>(false);

  // Persistent Optimizer Peak Memory (High-Water Mark)
  const [savedPeakMemory, setSavedPeakMemory] = useState<OptimizerPeakMemory | null>(() =>
    loadOptimizerPeakMemory(selectedDay !== 'all' ? selectedDay : datasetDay, activeCategory)
  );

  useEffect(() => {
    const targetDay = selectedDay !== 'all' ? selectedDay : datasetDay;
    setSavedPeakMemory(loadOptimizerPeakMemory(targetDay, activeCategory));
  }, [selectedDay, datasetDay, activeCategory, weightsVersion]);

  const handleClearPeakMemory = () => {
    const targetDay = selectedDay !== 'all' ? selectedDay : datasetDay;
    clearOptimizerPeakMemory(targetDay, activeCategory);
    setSavedPeakMemory(null);
    showToast(`Peak memory cleared for ${activeCategoryConfig.label}. Optimizer will start from baseline.`);
  };

  useEffect(() => {
    const handleWeightsUpdate = () => {
      setWeightsVersion(v => v + 1);
    };
    window.addEventListener('optimizedWeightsUpdated', handleWeightsUpdate);

    // Hydrate server-persisted OPW rules on mount so reloads always reflect saved codebase rules.
    // Incrementing weightsVersion triggers the reactive sync effect with the live selectedDay/datasetDay/activeCategory (avoiding stale mount closures).
    loadServerOpwRules(true).then(appliedDays => {
      if (appliedDays && appliedDays.length > 0) {
        setWeightsVersion(v => v + 1);
      }
    });

    return () => {
      window.removeEventListener('optimizedWeightsUpdated', handleWeightsUpdate);
    };
  }, []);

  const activeCategoryConfig = useMemo(() => {
    return CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0];
  }, [activeCategory]);

  const hasInitializedDeepRef = useRef(false);
  const prevActiveCategoryRef = useRef(activeCategory);
  const prevDatasetDayRef = useRef(datasetDay);
  const prevSelectedDayRef = useRef(selectedDay);
  const deepPointsCategoryRef = useRef<string>(activeCategory);
  const deepCategoryPointsMapRef = useRef(deepCategoryPointsMap);
  const allTimeBestPeakRef = useRef<{
    category?: string;
    cleanTopMatches: number;
    firstTrapRank: number;
    quality: number;
    points: Map<string, number>;
    trapRanks: number[];
    trapGaps: number[];
  } | null>(null);
  const prevWeightsVersionRef = useRef(weightsVersion);
  useEffect(() => {
    deepCategoryPointsMapRef.current = deepCategoryPointsMap;
  }, [deepCategoryPointsMap]);

  // Synchronize Deep Optimizer on initial mount and whenever activeCategory / day changes
  useEffect(() => {
    const isInitialMount = !hasInitializedDeepRef.current;
    const catChanged = prevActiveCategoryRef.current !== activeCategory;
    const dayChanged = prevDatasetDayRef.current !== datasetDay;
    const selDayChanged = prevSelectedDayRef.current !== selectedDay;

    hasInitializedDeepRef.current = true;
    prevActiveCategoryRef.current = activeCategory;
    prevDatasetDayRef.current = datasetDay;
    prevSelectedDayRef.current = selectedDay;

    if (!isInitialMount && !catChanged && !dayChanged && !selDayChanged) return;

    if (isBatchOptimizingRef.current) {
      // During batch optimization, category switching is contextual HUD progression, do not abort!
      return;
    }
    stopDeepRef.current = true;
    allTimeBestPeakRef.current = null;
    setIsDeepOptimizing(false);
    setDeepStatus('idle');
    setDeepConvergenceMode('none');
    setDeepComputations(0);
    setDeepPurityPct(0);
    setDeepInversions(0);
    setDeepBufferMargin(0);
    setDeepQuality(0);
    setDeepCleanMatches(0);
    setDeepTargetClean(0);
    setDeepTargetCeiling(0);
    setDeepFirstTrapRank(1);
    setDeepTargetsInTop5000(0);
    setDeepDiagnostics(null);
    setDeepHorizonMetrics({
      h500: { horizon: 500, traps: 0, targets: 0, total: 0, winRate: 0 },
      h1000: { horizon: 1000, traps: 0, targets: 0, total: 0, winRate: 0 },
      h1500: { horizon: 1500, traps: 0, targets: 0, total: 0, winRate: 0 },
      h2000: { horizon: 2000, traps: 0, targets: 0, total: 0, winRate: 0 },
      h3000: { horizon: 3000, traps: 0, targets: 0, total: 0, winRate: 0 }
    });

    const targetDay = selectedDay !== 'all' ? selectedDay : datasetDay;
    const dayCatKey = `${targetDay}_${activeCategory}`;
    const aliasCatId = activeCategory === 'top_12_value' ? 'top_10_value' 
      : (activeCategory === 'upsets' ? 'upset' 
      : (activeCategory === 'upset' ? 'upsets' 
      : (activeCategory === 'bankers_dlive' ? 'banker' 
      : (activeCategory === 'banker' ? 'bankers_dlive' : undefined))));

    const peakMem = loadOptimizerPeakMemory(targetDay, activeCategory)
      || (aliasCatId ? loadOptimizerPeakMemory(targetDay, aliasCatId) : null)
      || (datasetDay !== targetDay ? loadOptimizerPeakMemory(datasetDay, activeCategory) : null);

    if (peakMem && typeof peakMem.cleanTopMatches === 'number' && peakMem.cleanTopMatches > 0) {
      setDeepCleanMatches(peakMem.cleanTopMatches);
      if (peakMem.firstTrapRank) setDeepFirstTrapRank(peakMem.firstTrapRank);
      if (peakMem.quality) setDeepQuality(peakMem.quality);
      if (peakMem.trapRanks) setDeepTrapRanks(peakMem.trapRanks);
      if (peakMem.trapGaps) setDeepTrapGaps(peakMem.trapGaps);
    }

    const existingPoints = deepCategoryPointsMapRef.current[dayCatKey];
    if (existingPoints && existingPoints.size > 0) {
      deepPointsCategoryRef.current = activeCategory;
      setDeepPointsMap(new Map(existingPoints));
      setDeepStatus('converged');
      return;
    }

    const persistedRules = DAILY_OPTIMIZED_SETTINGS[targetDay]?.[activeCategory]?.rules
      || (aliasCatId ? DAILY_OPTIMIZED_SETTINGS[targetDay]?.[aliasCatId]?.rules : undefined);
    if (persistedRules && persistedRules.length > 0) {
      const isUpsetsCat = activeCategory === 'upsets' || activeCategory === 'upset' || activeCategoryConfig.targetObjective === 'underdog_only';
      const sanitizedPersisted = sanitizeRulePolarity(persistedRules, activeCategory, { preserveExact: true, day: targetDay });
      const restoredMap = new Map<string, number>();
      sanitizedPersisted.forEach(r => {
        if (r.description && typeof r.points === 'number' && (isUpsetsCat || r.points !== 0)) {
          restoredMap.set(r.description, r.points);
        }
      });
      if (restoredMap.size > 0) {
        deepPointsCategoryRef.current = activeCategory;
        setDeepPointsMap(restoredMap);
        setDeepCategoryPointsMap(prev => ({ ...prev, [dayCatKey]: restoredMap }));
        deepCategoryPointsMapRef.current[dayCatKey] = restoredMap;
        setDeepStatus('converged');
        return;
      }
    }

    if (peakMem?.points && Object.keys(peakMem.points).length > 0) {
      const sanitizedPeak = sanitizeRulePolarity(peakMem.points, activeCategory, { preserveExact: true, day: targetDay });
      const restoredMap = new Map(Object.entries(sanitizedPeak));
      deepPointsCategoryRef.current = activeCategory;
      setDeepPointsMap(restoredMap);
      setDeepCategoryPointsMap(prev => ({ ...prev, [dayCatKey]: restoredMap }));
      deepCategoryPointsMapRef.current[dayCatKey] = restoredMap;
      setDeepStatus('converged');
      return;
    }

    setDeepPointsMap(null);
  }, [activeCategory, datasetDay, selectedDay]);

  // Re-sync restored points ONLY when external server rules or runtime weights version actually increments
  useEffect(() => {
    if (prevWeightsVersionRef.current === weightsVersion) return;
    prevWeightsVersionRef.current = weightsVersion;
    if (isDeepOptimizing || isBatchOptimizingRef.current) return;
    const targetDay = selectedDay !== 'all' ? selectedDay : datasetDay;
    const dayCatKey = `${targetDay}_${activeCategory}`;
    const aliasCatId = activeCategory === 'top_12_value' ? 'top_10_value' 
      : (activeCategory === 'upsets' ? 'upset' 
      : (activeCategory === 'upset' ? 'upsets' 
      : (activeCategory === 'bankers_dlive' ? 'banker' 
      : (activeCategory === 'banker' ? 'bankers_dlive' : undefined))));
    const persistedRules = DAILY_OPTIMIZED_SETTINGS[targetDay]?.[activeCategory]?.rules
      || (aliasCatId ? DAILY_OPTIMIZED_SETTINGS[targetDay]?.[aliasCatId]?.rules : undefined);
    if (persistedRules && persistedRules.length > 0) {
      const isUpsetsCat = activeCategory === 'upsets' || activeCategory === 'upset' || activeCategoryConfig.targetObjective === 'underdog_only';
      const sanitizedPersisted = sanitizeRulePolarity(persistedRules, activeCategory, { preserveExact: true, day: targetDay });
      const restoredMap = new Map<string, number>();
      sanitizedPersisted.forEach(r => {
        if (r.description && typeof r.points === 'number' && (isUpsetsCat || r.points !== 0)) {
          restoredMap.set(r.description, r.points);
        }
      });
      if (restoredMap.size > 0) {
        deepPointsCategoryRef.current = activeCategory;
        deepCategoryPointsMapRef.current[dayCatKey] = restoredMap;
        setDeepPointsMap(restoredMap);
        setDeepCategoryPointsMap(prev => ({ ...prev, [dayCatKey]: restoredMap }));
        setDeepStatus('converged');
        return;
      }
    }
    const peakMem = loadOptimizerPeakMemory(targetDay, activeCategory)
      || (aliasCatId ? loadOptimizerPeakMemory(targetDay, aliasCatId) : null)
      || (datasetDay !== targetDay ? loadOptimizerPeakMemory(datasetDay, activeCategory) : null);
    if (peakMem?.points && Object.keys(peakMem.points).length > 0) {
      const sanitizedPeak = sanitizeRulePolarity(peakMem.points, activeCategory, { preserveExact: true, day: targetDay });
      const restoredMap = new Map(Object.entries(sanitizedPeak));
      deepPointsCategoryRef.current = activeCategory;
      deepCategoryPointsMapRef.current[dayCatKey] = restoredMap;
      setDeepPointsMap(restoredMap);
      setDeepCategoryPointsMap(prev => ({ ...prev, [dayCatKey]: restoredMap }));
      setDeepStatus('converged');
    }
  }, [weightsVersion, selectedDay, datasetDay, activeCategory, isDeepOptimizing]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Base raw dataset
  const rawDataset = useMemo(() => {
    let base: Match[] = [];
    if (datasetScope === 'live') {
      base = matches;
    } else if (datasetScope === 'history') {
      base = allMatches.length > 0 ? allMatches : matches;
    } else {
      const combined = new Map<string | number, Match>();
      matches.forEach(m => combined.set(m.id, m));
      allMatches.forEach(m => {
        if (!combined.has(m.id)) combined.set(m.id, m);
      });
      base = Array.from(combined.values());
    }

    if (datasetScope === 'live' && !userPickedDayRef.current) {
      return base;
    }

    if (selectedDay !== 'all') {
      return base.filter(m => getMatchDayOfWeek(m) === selectedDay);
    }
    return base;
  }, [datasetScope, matches, allMatches, selectedDay]);

  // Filter category matches
  const categoryMatches = useMemo(() => {
    const prefix = activeCategoryConfig.tagPrefix;
    if (!prefix) return rawDataset;
    const isTop12Cat = activeCategoryConfig.id === 'top_12_value' || activeCategoryConfig.id === 'top_10_value' || prefix === 'top12:' || prefix === 'top10:';
    return rawDataset.filter(m => {
      let tags = m.evaluatorTags;
      if (!tags || tags.length === 0) {
        tags = getMatchEvaluatorTags(m, phaStatsMap, liveViewType === 'jackpot', true, matchStars);
        m.evaluatorTags = tags; // Cache onto match object for instant 0ms lookups
      }
      if (isTop12Cat) {
        return tags.some(t => t.startsWith('top12:') || t.startsWith('top10:'));
      }
      return tags.some(t => t.startsWith(prefix));
    });
  }, [rawDataset, activeCategoryConfig, phaStatsMap, liveViewType, matchStars]);

  // Completed matches in category
  const completedMatches = useMemo(() => {
    return categoryMatches.filter(m => {
      const actual = getActualResult(m.result || '');
      return actual === '1' || actual === 'X' || actual === '2';
    });
  }, [categoryMatches]);

  // Precomputed match profiles for the active category/day (eliminates 3x duplicate odds/trigger evaluation)
  const evaluatedCategoryProfiles = useMemo(() => {
    const objective = activeCategoryConfig.targetObjective;
    const evalCat = activeCategory === 'safety' ? 'best_bet' : activeCategory;
    const out: {
      match: Match;
      teams: string;
      date: string;
      league: string;
      odds: string;
      result: string;
      actual: '1' | 'X' | '2';
      mFav: '1' | '2';
      outcome: 'mfav' | 'draw' | 'underdog';
      isTarget: boolean;
      baseScore: number;
      triggersHit: Set<string>;
      triggersList: string[];
    }[] = [];

    for (let i = 0; i < completedMatches.length; i++) {
      const m = completedMatches[i];
      const actual = getActualResult(m.result || '');
      if (actual !== '1' && actual !== 'X' && actual !== '2') continue;

      const moStr = m.mo || (m as any).odds || (m as any).data?.mo || (m as any).data?.odds || '';
      const moParts = String(moStr).split(/[- ,]+/).map(s => parseFloat(s.replace(/[^0-9.]/g, '').trim())).filter(p => !isNaN(p));
      const homeOdds = moParts[0] || (m.homeOdds ? parseFloat(String(m.homeOdds).replace(/[^0-9.]/g, '')) : 0) || 0;
      const awayOdds = moParts.length >= 3 ? (moParts[2] || 0) : (moParts.length === 2 ? (moParts[1] || 0) : ((m.awayOdds ? parseFloat(String(m.awayOdds).replace(/[^0-9.]/g, '')) : 0)));
      if (homeOdds <= 0 || awayOdds <= 0) continue;

      const mFav = getMarketFavorite(m);
      const outcome: 'mfav' | 'draw' | 'underdog' = actual === mFav ? 'mfav' : actual === 'X' ? 'draw' : 'underdog';
      const isTarget = objective === 'underdog_only'
        ? outcome === 'underdog'
        : objective === 'mfav_only'
        ? outcome === 'mfav'
        : (outcome === 'mfav' || outcome === 'draw');

      const matchDay = selectedDay !== 'all' ? selectedDay : getMatchDayOfWeek(m);
      const baseInfo = getOptimizedBaseWeight(m, phaStatsMap, evalCat, matchDay);
      const baseScore = baseInfo?.points ?? 0;

      let allTriggers: Set<string> = (m as any)._opwCatalogTriggers;
      if (!allTriggers) {
        const stats = extractMatchEvaluationStats(m, phaStatsMap, activeCategory);
        allTriggers = evaluateAllCatalogTriggers(stats, m);
        (m as any)._opwCatalogTriggers = allTriggers;
      }
      const triggersHit = new Set<string>();
      allTriggers.forEach(t => {
        if (!REMOVED_TRIGGER_DESCRIPTIONS.has(t)) {
          triggersHit.add(t);
        }
      });
      const lInfo = getMatchCountryAndLeague(m);
      if (lInfo?.display && lInfo.display !== 'Unknown') {
        const lTrig = `Match belongs to ${lInfo.display}`;
        if (!REMOVED_TRIGGER_DESCRIPTIONS.has(lTrig)) {
          registerDiscoveredLeagueTrigger(lTrig);
          triggersHit.add(lTrig);
        }
      }

      out.push({
        match: m,
        teams: m.teams || 'Unknown',
        date: m.date || '',
        league: (m as any).league || (m as any).country || '',
        odds: String(moStr),
        result: m.result || '',
        actual,
        mFav,
        outcome,
        isTarget,
        baseScore,
        triggersHit,
        triggersList: Array.from(triggersHit)
      });
    }
    return out;
  }, [completedMatches, activeCategory, activeCategoryConfig.targetObjective, selectedDay, phaStatsMap]);

  const allMatchesRef = useRef(allMatches);
  allMatchesRef.current = allMatches;

  // Active category settings for points comparison
  const activeSettings = useMemo(() => {
    const targetDay = selectedDay !== 'all' ? selectedDay : datasetDay;
    return DAILY_OPTIMIZED_SETTINGS[targetDay]?.[activeCategory] ||
      DAILY_DEFAULT_CATEGORY_SETTINGS[targetDay]?.[activeCategory] ||
      OPTIMIZED_CATEGORY_SETTINGS[activeCategory];
  }, [activeCategory, selectedDay, datasetDay, weightsVersion]);

  // Current rule points map
  const currentRulePointsMap = useMemo(() => {
    const map = new Map<string, number>();
    const targetDay = selectedDay !== 'all' ? selectedDay : datasetDay;
    const sanitized = sanitizeRulePolarity(activeSettings?.rules || [], activeCategory, { preserveExact: true, day: targetDay });
    sanitized.forEach(r => map.set(r.description, r.points));
    return map;
  }, [activeSettings, activeCategory, selectedDay, datasetDay]);

    // Auto-discover and register all leagues present in the loaded dataset
  useEffect(() => {
    if (Array.isArray(rawDataset) && rawDataset.length > 0) {
      let registeredCount = 0;
      rawDataset.forEach(m => {
        const info = getMatchCountryAndLeague(m);
        if (info?.display && info.display !== 'Unknown') {
          const trig = `Match belongs to ${info.display}`;
          if (registerDiscoveredLeagueTrigger(trig)) {
            registeredCount++;
          }
        }
      });
      if (registeredCount > 0 && !isDeepOptimizing) {
        setWeightsVersion(v => v + 1);
      }
    }
  }, [rawDataset, isDeepOptimizing]);

  const handleSetTriggerPoints = useCallback((triggerDescription: string, newPoints: number) => {
    const targetDay = selectedDay !== 'all' ? selectedDay : datasetDay;
    const dayCatKey = `${targetDay}_${activeCategory}`;
    const datasetDayCatKey = `${datasetDay}_${activeCategory}`;
    const isUpsetsCat = activeCategory === 'upsets' || activeCategory === 'upset' || activeCategoryConfig.targetObjective === 'underdog_only';

    const nextMap = new Map(currentRulePointsMap);
    const activeBase = (allTimeBestPeakRef.current?.category === activeCategory && allTimeBestPeakRef.current.points.size > 0)
      ? allTimeBestPeakRef.current.points
      : (deepPointsMap || deepCategoryPointsMap[dayCatKey]);
    if (activeBase) {
      activeBase.forEach((pts, desc) => {
        if (desc && typeof pts === 'number' && (isUpsetsCat || pts !== 0)) {
          nextMap.set(desc, pts);
        }
      });
    }
    nextMap.set(triggerDescription, newPoints);
    if (allTimeBestPeakRef.current?.category === activeCategory) {
      allTimeBestPeakRef.current.points.set(triggerDescription, newPoints);
    }

    setDeepPointsMap(nextMap);
    setDeepCategoryPointsMap(prev => ({
      ...prev,
      [dayCatKey]: nextMap,
      [datasetDayCatKey]: nextMap,
      [activeCategory]: nextMap,
    }));

    // Keep DAILY_OPTIMIZED_SETTINGS, PeakMemory & Server Storage synchronized with manual edits so they are never overwritten
    const existingSettings = DAILY_OPTIMIZED_SETTINGS[targetDay]?.[activeCategory]
      || DAILY_DEFAULT_CATEGORY_SETTINGS[targetDay]?.[activeCategory]
      || OPTIMIZED_CATEGORY_SETTINGS[activeCategory];
    if (existingSettings) {
      const updatedRules = populateCategoryWithMasterRules(
        Array.from(nextMap.entries()).map(([description, points]) => ({ description, points })),
        activeCategoryConfig.targetObjective,
        activeCategory,
        targetDay,
        { preserveExact: true }
      );
      updateDailyOptimizedCategorySettings(
        targetDay,
        activeCategory,
        { ...existingSettings, rules: updatedRules },
        true,
        { silent: true, source: 'codebase' }
      );
      saveOptimizerPeakMemory(targetDay, activeCategory, {
        cleanTopMatches: deepCleanMatches || 0,
        firstTrapRank: deepFirstTrapRank || 0,
        quality: deepQuality || 0,
        trapRanks: [],
        trapGaps: [],
        points: Object.fromEntries(updatedRules.map(r => [r.description, r.points]))
      });
      if (typeof fetch !== 'undefined') {
        const completeRulesPayload = updatedRules.map(r => ({
          description: r.description,
          points: r.points,
          note: `Calibrated Rules (${activeCategoryConfig.label}): ${r.points > 0 ? '+' : ''}${r.points} pts`
        }));
        const categoriesPayload: Record<string, { rules: typeof completeRulesPayload; targetObjective: string }> = {
          [activeCategory]: { rules: completeRulesPayload, targetObjective: activeCategoryConfig.targetObjective }
        };
        const aliasKey = activeCategory === 'top_12_value' ? 'top_10_value'
          : (activeCategory === 'top_10_value' ? 'top_12_value'
          : (activeCategory === 'upsets' ? 'upset'
          : (activeCategory === 'upset' ? 'upsets'
          : (activeCategory === 'bankers_dlive' ? 'banker' : undefined))));
        if (aliasKey) {
          categoriesPayload[aliasKey] = { rules: completeRulesPayload, targetObjective: activeCategoryConfig.targetObjective };
        }
        fetch('/api/opw/save-to-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day: targetDay,
            days: [targetDay],
            categories: categoriesPayload,
            customTriggers: []
          })
        }).catch(() => {});
      }
    }

    setWeightsVersion(v => {
      prevWeightsVersionRef.current = v + 1;
      return v + 1;
    });
    showToast(`Updated "${triggerDescription}" to ${newPoints > 0 ? '+' : ''}${newPoints} pts.`);
  }, [activeCategory, activeCategoryConfig.label, activeCategoryConfig.targetObjective, selectedDay, datasetDay, deepPointsMap, deepCategoryPointsMap, currentRulePointsMap, deepCleanMatches, deepFirstTrapRank, deepQuality]);

  const handleToggleLeaguePolarity = useCallback((triggerDescription: string) => {
    if (!isLeagueTrigger(triggerDescription)) return;
    const targetDay = selectedDay !== 'all' ? selectedDay : datasetDay;
    const dayCatKey = `${targetDay}_${activeCategory}`;
    const datasetDayCatKey = `${datasetDay}_${activeCategory}`;
    const currentlyProUnderdog = isLeagueLockedProUnderdog(triggerDescription, activeCategory, targetDay);
    if (currentlyProUnderdog) {
      unlockLeagueProUnderdog(triggerDescription, activeCategory, targetDay);
      markLeagueAsNeutral(triggerDescription);
      showToast(`League trigger "${triggerDescription}" restored to NEUTRAL for ${activeCategoryConfig.label}.`);
    } else {
      lockLeagueAsProUnderdog(triggerDescription, activeCategory, targetDay);
      const isUpsets = activeCategoryConfig.targetObjective === 'underdog_only';
      const baseMap = deepPointsMap || deepCategoryPointsMap[dayCatKey] || currentRulePointsMap;
      const curPts = baseMap.get(triggerDescription) ?? 0;
      let newPts = curPts;
      if (!isUpsets && curPts > 0) {
        newPts = -15;
      } else if (isUpsets && curPts < 0) {
        newPts = 15;
      }
      if (newPts !== curPts) {
        const nextMap = new Map(baseMap);
        nextMap.set(triggerDescription, newPts);
        setDeepPointsMap(nextMap);
        setDeepCategoryPointsMap(prev => ({
          ...prev,
          [dayCatKey]: nextMap,
          [datasetDayCatKey]: nextMap,
          [activeCategory]: nextMap,
        }));
      }
      showToast(`League trigger "${triggerDescription}" locked as PRO-UNDERDOG for ${activeCategoryConfig.label}.`);
    }
    setWeightsVersion(v => {
      prevWeightsVersionRef.current = v + 1;
      return v + 1;
    });
  }, [activeCategory, activeCategoryConfig.label, activeCategoryConfig.targetObjective, selectedDay, datasetDay, deepPointsMap, deepCategoryPointsMap, currentRulePointsMap]);

  // Compute trigger statistics & recommendations via multi-pass statistical optimizer
  const { recommendations, baselineStats, optimizerMeta } = useMemo(() => {
    return computeCategoryRecommendations(
      activeCategoryConfig,
      rawDataset,
      phaStatsMap,
      matchStars,
      liveViewType,
      selectedDay,
      allMatchesRef.current
    );
  }, [activeCategoryConfig, rawDataset, phaStatsMap, matchStars, liveViewType, selectedDay]);

  // Derived contextual horizons for active category and dataset scope
  const categoryHorizons = useMemo(() => {
    let totalCorrect = 0;
    if (activeCategoryConfig.targetObjective === 'underdog_only') {
      totalCorrect = baselineStats.totalUnderdog;
    } else if (activeCategoryConfig.targetObjective === 'mfav_only') {
      totalCorrect = baselineStats.totalMfav;
    } else {
      totalCorrect = baselineStats.totalMfav + baselineStats.totalDraw;
    }
    return calculateTargetHorizons(
      baselineStats.totalCompleted,
      totalCorrect,
      activeCategoryConfig.targetCapacity,
      activeCategoryConfig.targetObjective
    );
  }, [baselineStats, activeCategoryConfig]);

  // Seamlessly merge recommendations with deep continuous optimizer state (if active or converged)
  const effectiveRecommendations = useMemo(() => {
    const isUpsetsCat = activeCategoryConfig.targetObjective === 'underdog_only';
    if (!deepPointsMap) {
      return recommendations.map(r => {
        const curPts = currentRulePointsMap.has(r.description)
          ? (currentRulePointsMap.get(r.description) ?? r.currentPoints)
          : ((isUpsetsCat || r.currentPoints !== 0) ? r.currentPoints : 5);
        return {
          ...r,
          currentPoints: curPts,
          recommendedPoints: curPts
        };
      });
    }
    return recommendations.map(r => {
      const deepPts = deepPointsMap.get(r.description);
      const hasSavedCur = currentRulePointsMap.has(r.description);
      const curPts = hasSavedCur
        ? (currentRulePointsMap.get(r.description) ?? r.currentPoints)
        : ((isUpsetsCat || r.currentPoints !== 0) ? r.currentPoints : 5);
      if (deepPts !== undefined) {
        return {
          ...r,
          currentPoints: curPts,
          recommendedPoints: deepPts,
          rationale: deepPts !== r.recommendedPoints
            ? `Deep Optimizer: ${deepPts > 0 ? '+' : ''}${deepPts} pts.`
            : r.rationale
        };
      }
      if (hasSavedCur) {
        return {
          ...r,
          currentPoints: curPts,
          recommendedPoints: curPts
        };
      }
      return {
        ...r,
        currentPoints: curPts,
        recommendedPoints: (isUpsetsCat || r.recommendedPoints !== 0) ? r.recommendedPoints : (hasSavedCur ? curPts : 5)
      };
    });
  }, [recommendations, deepPointsMap, activeCategoryConfig, selectedDay, currentRulePointsMap]);

  const sanitizePointMap = useCallback((ptsMap: Map<string, number>): Map<string, number> => {
    const clean = new Map<string, number>();
    const isUpsets = activeCategoryConfig.targetObjective === 'underdog_only';
    ptsMap.forEach((v, k) => {
      const minFloor = isLeagueTrigger(k) ? getLeagueTriggerMaxPenalty(k) : -30;
      const maxBonus = isLeagueTrigger(k) ? getLeagueTriggerMaxBonus(k, isUpsets) : 40;
      clean.set(k, Math.max(minFloor, Math.min(maxBonus, v)));
    });
    return clean;
  }, [activeCategoryConfig.targetObjective]);

  // Factual Clean Matches & First Trap Breakdown (100% transparent, non-simulated verification)
  const cleanMatchesBreakdown = useMemo(() => {
    const effectiveTargetDay = selectedDay !== 'all' ? selectedDay : datasetDay;
    const dayCatKey = `${effectiveTargetDay}_${activeCategory}`;
    const aliasCatId = activeCategory === 'top_12_value' ? 'top_10_value' 
      : (activeCategory === 'upsets' ? 'upset' 
      : (activeCategory === 'upset' ? 'upsets' 
      : (activeCategory === 'bankers_dlive' ? 'banker' 
      : (activeCategory === 'banker' ? 'bankers_dlive' : undefined))));

    // Category Isolation Guard: strictly verify deepPointsMap belongs to activeCategory to prevent cross-category bleed & flicker
    const isDeepForCurrentCat = deepPointsCategoryRef.current === activeCategory;
    let deepMap = (isDeepForCurrentCat && deepPointsMap && deepPointsMap.size > 0)
      ? deepPointsMap
      : (deepCategoryPointsMap[dayCatKey] || deepCategoryPointsMapRef.current[dayCatKey] || (aliasCatId ? (deepCategoryPointsMap[`${effectiveTargetDay}_${aliasCatId}`] || deepCategoryPointsMapRef.current[`${effectiveTargetDay}_${aliasCatId}`]) : undefined));
    if (!deepMap || deepMap.size === 0) {
      const persisted = DAILY_OPTIMIZED_SETTINGS[effectiveTargetDay]?.[activeCategory]?.rules
        || (aliasCatId ? DAILY_OPTIMIZED_SETTINGS[effectiveTargetDay]?.[aliasCatId]?.rules : undefined);
      if (persisted && persisted.length > 0) {
        deepMap = new Map(persisted.map(r => [r.description, r.points]));
      }
    }
    if (!deepMap || deepMap.size === 0) {
      const peakMem = loadOptimizerPeakMemory(effectiveTargetDay, activeCategory)
        || (aliasCatId ? loadOptimizerPeakMemory(effectiveTargetDay, aliasCatId) : null)
        || (datasetDay !== effectiveTargetDay ? loadOptimizerPeakMemory(datasetDay, activeCategory) : null);
      if (peakMem?.points) {
        deepMap = new Map(Object.entries(peakMem.points));
      }
    }

    const peakMemPoints = (allTimeBestPeakRef.current && allTimeBestPeakRef.current.category === activeCategory)
      ? allTimeBestPeakRef.current.points
      : undefined;
    const activeCalibratedMap = (peakMemPoints && peakMemPoints.size > 0)
      ? peakMemPoints
      : ((isDeepForCurrentCat && deepPointsMap && deepPointsMap.size > 0) ? deepPointsMap : deepMap);

    const isCalibratedDeep = Boolean(activeCalibratedMap && activeCalibratedMap.size > 0);
    const pointsLookup = new Map<string, number>();
    const isUpsetsCat = activeCategory === 'upsets' || activeCategory === 'upset' || activeCategoryConfig.targetObjective === 'underdog_only';

    // 1. Seed with existing saved points so untuned triggers retain their exact trigger points (never muted or zeroed except Upsets where 0 is allowed)
    currentRulePointsMap.forEach((pts, description) => {
      if (description && typeof pts === 'number' && (isUpsetsCat || pts !== 0)) {
        const minP = isLeagueTrigger(description) ? getLeagueTriggerMaxPenalty(description) : -30;
        const maxP = isLeagueTrigger(description) ? getLeagueTriggerMaxBonus(description, isUpsetsCat) : 40;
        pointsLookup.set(description, Math.max(minP, Math.min(maxP, Number(pts))));
      }
    });

    if (isCalibratedDeep) {
      // 2. Overlay calibrated points from the optimizer (tuned triggers replace old trigger points)
      activeCalibratedMap!.forEach((pts, description) => {
        if (description && typeof pts === 'number' && (isUpsetsCat || pts !== 0)) {
          const minP = isLeagueTrigger(description) ? getLeagueTriggerMaxPenalty(description) : -30;
          const maxP = isLeagueTrigger(description) ? getLeagueTriggerMaxBonus(description, isUpsetsCat) : 40;
          pointsLookup.set(description, Math.max(minP, Math.min(maxP, Number(pts))));
        }
      });
    } else if (effectiveRecommendations.length > 0) {
      effectiveRecommendations.forEach(r => {
        if (r.description && typeof r.recommendedPoints === 'number' && (isUpsetsCat || r.recommendedPoints !== 0) && !pointsLookup.has(r.description)) {
          const minP = isLeagueTrigger(r.description) ? getLeagueTriggerMaxPenalty(r.description) : -30;
          const maxP = isLeagueTrigger(r.description) ? getLeagueTriggerMaxBonus(r.description, isUpsetsCat) : 40;
          pointsLookup.set(r.description, Math.max(minP, Math.min(maxP, r.recommendedPoints)));
        }
      });
    }

    // 3. Any catalog or league trigger with no existing valid saved points is awarded its new default points
    getFullActiveCatalogTriggers().forEach(desc => {
      if (desc && !pointsLookup.has(desc)) {
        pointsLookup.set(desc, getNewTriggerDefaultPoints(desc, isUpsetsCat));
      }
    });

    interface BreakdownRow {
      rank: number;
      match: Match;
      teams: string;
      date: string;
      league: string;
      odds: string;
      result: string;
      actual: string;
      mFav: '1' | '2';
      outcome: 'mfav' | 'draw' | 'underdog';
      isTarget: boolean;
      baseScore: number;
      triggerScore: number;
      totalScore: number;
      rulesHit: { description: string; points: number }[];
    }

    const rows: BreakdownRow[] = new Array(evaluatedCategoryProfiles.length);

    for (let i = 0; i < evaluatedCategoryProfiles.length; i++) {
      const p = evaluatedCategoryProfiles[i];
      const tList = p.triggersList;
      let triggerScore = 0;
      const rulesHit: { description: string; points: number }[] = [];

      if (isCleanMatchesModalOpen) {
        for (let k = 0; k < tList.length; k++) {
          const desc = tList[k];
          if (!desc || REMOVED_TRIGGER_DESCRIPTIONS.has(desc)) continue;
          const pts = pointsLookup.get(desc) ?? getNewTriggerDefaultPoints(desc, isUpsetsCat);
          if (pts !== 0) {
            rulesHit.push({ description: desc, points: pts });
            triggerScore += pts;
          }
        }
        rulesHit.sort((a, b) => b.points - a.points);
      } else {
        for (let k = 0; k < tList.length; k++) {
          const desc = tList[k];
          if (!desc || REMOVED_TRIGGER_DESCRIPTIONS.has(desc)) continue;
          const pts = pointsLookup.get(desc) ?? getNewTriggerDefaultPoints(desc, isUpsetsCat);
          triggerScore += pts;
        }
      }

      rows[i] = {
        rank: 0,
        match: p.match,
        teams: p.teams,
        date: p.date,
        league: p.league,
        odds: p.odds,
        result: p.result,
        actual: p.actual,
        mFav: p.mFav,
        outcome: p.outcome,
        isTarget: p.isTarget,
        baseScore: p.baseScore,
        triggerScore,
        totalScore: p.baseScore + triggerScore,
        rulesHit
      };
    }

    // Sort descending by totalScore; on exact score ties, traps sort before targets so cleanMatches strictly equals score > maxTrapScore
    rows.sort((a, b) => (b.totalScore - a.totalScore) || ((a.isTarget ? 1 : 0) - (b.isTarget ? 1 : 0)));
    for (let idx = 0; idx < rows.length; idx++) {
      rows[idx].rank = idx + 1;
    }

    const firstTrapIdx = rows.findIndex(r => !r.isTarget);
    const cleanMatches = firstTrapIdx === -1 ? rows : rows.slice(0, firstTrapIdx);
    const firstTrap = firstTrapIdx === -1 ? null : rows[firstTrapIdx];
    const firstTrapRank = firstTrap ? firstTrap.rank : (rows.length + 1);
    let totalTargets = 0;
    let tiedAtBoundary = 0;
    const firstTrapScore = firstTrap ? firstTrap.totalScore : -999999;
    for (let idx = 0; idx < rows.length; idx++) {
      if (rows[idx].isTarget) {
        totalTargets++;
        if (firstTrap && rows[idx].totalScore === firstTrapScore) {
          tiedAtBoundary++;
        }
      }
    }
    const marginToFirstTrap = (cleanMatches.length > 0 && firstTrap)
      ? (cleanMatches[cleanMatches.length - 1].totalScore - firstTrap.totalScore)
      : 0;

    return {
      allRows: rows,
      cleanMatches,
      cleanCount: cleanMatches.length,
      firstTrap,
      firstTrapRank,
      totalTargets,
      tiedAtBoundary,
      marginToFirstTrap
    };
  }, [evaluatedCategoryProfiles, isCleanMatchesModalOpen, currentRulePointsMap, deepPointsMap, deepCategoryPointsMap, datasetDay, effectiveRecommendations, activeCategoryConfig, selectedDay, activeCategory]);

  // Stage candidate rules in OPW P RECOM component state when optimization pauses or converges.
  // IMPORTANT: Never write to /api/opw/save-to-code, localStorage, or DAILY_OPTIMIZED_SETTINGS here;
  // permanent persistence happens ONLY when the user explicitly clicks "Save to Codebase".
  const adoptCalibratedRulesPermanently = useCallback(async (
    pointsMap: Map<string, number>,
    peakClean: number,
    peakTrapRank: number,
    peakQuality: number,
    trapRanks?: number[],
    trapGaps?: number[]
  ) => {
    if (!pointsMap || pointsMap.size === 0) return;
    const effectiveTargetDay = selectedDay !== 'all' ? selectedDay : datasetDay;

    const tunedRules = Array.from(pointsMap.entries()).map(([description, points]) => ({
      description,
      points: Math.max(isLeagueTrigger(description) ? getLeagueTriggerMaxPenalty(description) : -30, Math.min(40, points))
    }));

    const aliasCatId = activeCategory === 'top_12_value' ? 'top_10_value' 
      : (activeCategory === 'upsets' ? 'upset' 
      : (activeCategory === 'upset' ? 'upsets' 
      : (activeCategory === 'bankers_dlive' ? 'banker' 
      : (activeCategory === 'banker' ? 'bankers_dlive' : undefined))));
    const categoriesToUpdate = [activeCategory];
    if (aliasCatId) categoriesToUpdate.push(aliasCatId);

    const finalPointsMap = new Map(tunedRules.map(r => [r.description, r.points]));
    deepPointsCategoryRef.current = activeCategory;
    setDeepPointsMap(finalPointsMap);
    setDeepCleanMatches(peakClean);
    if (peakTrapRank) setDeepFirstTrapRank(peakTrapRank);
    if (peakQuality) setDeepQuality(peakQuality);
    if (trapRanks && trapRanks.length > 0) setDeepTrapRanks(trapRanks);
    if (trapGaps && trapGaps.length > 0) setDeepTrapGaps(trapGaps);

    const matchDaysInPool = new Set<DayOfWeek>();
    if (selectedDay === 'all') {
      (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as DayOfWeek[]).forEach(d => matchDaysInPool.add(d));
    } else {
      matchDaysInPool.add(effectiveTargetDay);
    }
    const updatedCategoryMap = { ...deepCategoryPointsMapRef.current };
    matchDaysInPool.forEach(d => {
      for (const cat of categoriesToUpdate) {
        updatedCategoryMap[`${d}_${cat}`] = finalPointsMap;
      }
    });
    deepCategoryPointsMapRef.current = updatedCategoryMap;
    setDeepCategoryPointsMap(updatedCategoryMap);
  }, [selectedDay, datasetDay, activeCategoryConfig, activeCategory, matches]);

  // Start Continuous Deep Optimization for active category
  const startDeepOptimization = useCallback(() => {
    try {
      if (completedMatches.length === 0) {
        showToast('No completed matches available in this category/timeframe to optimize.');
        return;
      }

      setIsDeepOptimizing(true);
      setDeepStatus('running');
      stopDeepRef.current = false;
      const isHistoryMode = datasetScope === 'history';

      const profiles = evaluatedCategoryProfiles;

      if (profiles.length === 0) {
        setIsDeepOptimizing(false);
        setDeepStatus('idle');
        showToast('Could not evaluate match profiles.');
        return;
      }

      // Active triggers that fired in at least one completed match
      const activeTriggersSet = new Set<string>();
      profiles.forEach(p => p.triggersHit.forEach(t => {
        if (!REMOVED_TRIGGER_DESCRIPTIONS.has(t)) activeTriggersSet.add(t);
      }));
      const activeTriggers = Array.from(activeTriggersSet);

      // Compute empirical trigger statistics across all completed match profiles
      const catalogTriggers = getFullActiveCatalogTriggers();
      const hitStatsMap = new Map<string, { mfav: number; draw: number; underdog: number }>();
      catalogTriggers.forEach(desc => {
        hitStatsMap.set(desc, { mfav: 0, draw: 0, underdog: 0 });
      });
      profiles.forEach(p => {
        p.triggersHit.forEach(t => {
          if (REMOVED_TRIGGER_DESCRIPTIONS.has(t)) return;
          let stat = hitStatsMap.get(t);
          if (!stat) {
            stat = { mfav: 0, draw: 0, underdog: 0 };
            hitStatsMap.set(t, stat);
          }
          if (p.outcome === 'mfav') stat.mfav++;
          else if (p.outcome === 'draw') stat.draw++;
          else stat.underdog++;
        });
      });

      // Populate full Historical Archive memory (700+ matches) for the active category and day
      const histHitsMap = new Map<string, { mfav: number; draw: number; underdog: number; total: number }>();
      const effectiveHistDay = selectedDay !== 'all' ? selectedDay : datasetDay;
      recommendations.forEach(r => {
        const dayDist = r.weekdayDistribution?.[effectiveHistDay];
        if (dayDist && dayDist.total >= 3) {
          histHitsMap.set(r.description, { mfav: dayDist.mfav, draw: dayDist.draw, underdog: dayDist.underdog, total: dayDist.total });
        } else if (r.overallHits && r.overallHits > 0) {
          histHitsMap.set(r.description, {
            mfav: r.overallMfavHits || 0,
            draw: r.overallDrawHits || 0,
            underdog: r.overallUnderdogHits || 0,
            total: r.overallHits
          });
        }
      });

      const launchCoreOptimizer = () => {
    const isUpsetsCat = activeCategoryConfig.targetObjective === 'underdog_only';
    const allCatalogTriggers = [...catalogTriggers];
    const triggerIdByName = new Map<string, number>();
    allCatalogTriggers.forEach((desc, idx) => triggerIdByName.set(desc, idx));
    activeTriggers.forEach(desc => {
      if (!triggerIdByName.has(desc)) {
        triggerIdByName.set(desc, allCatalogTriggers.length);
        allCatalogTriggers.push(desc);
      }
    });
    const numTriggers = allCatalogTriggers.length;
    const bestPointsArr = new Int16Array(numTriggers);

    for (let tId = 0; tId < numTriggers; tId++) {
      const desc = allCatalogTriggers[tId];
      const existingSaved = (deepPointsCategoryRef.current === activeCategory ? deepPointsMap?.get(desc) : undefined)
        ?? currentRulePointsMap.get(desc);
      const minP = isLeagueTrigger(desc) ? getLeagueTriggerMaxPenalty(desc) : -30;
      const maxP = isLeagueTrigger(desc) ? getLeagueTriggerMaxBonus(desc, isUpsetsCat) : 40;

      if (existingSaved !== undefined && ((isUpsetsCat && existingSaved === 0) || (existingSaved !== 0 && (existingSaved >= 5 || existingSaved <= -5)))) {
        bestPointsArr[tId] = Math.max(minP, Math.min(maxP, existingSaved));
      } else {
        bestPointsArr[tId] = Math.max(minP, Math.min(maxP, getNewTriggerDefaultPoints(desc, isUpsetsCat)));
      }
    }

    // Preserve a read-only snapshot of pre-compute saved points for Cross-Week Driver Preservation & Free-Rider Pruning
    const savedInitialPointsArr = new Int16Array(bestPointsArr);
    const histTargetAccArr = new Float32Array(numTriggers);
    const histBaselineTargetRate = activeCategoryConfig.targetObjective === 'underdog_only'
      ? 0.25
      : activeCategoryConfig.targetObjective === 'mfav_only'
      ? 0.62
      : 0.78;

    const buildPointsMapFromArr = (arr: Int16Array): Map<string, number> => {
      const m = new Map<string, number>();
      for (let tId = 0; tId < numTriggers; tId++) {
        m.set(allCatalogTriggers[tId], arr[tId]);
      }
      return m;
    };

    const numMatches = profiles.length;
    // Flat typed arrays for maximum cache locality and zero GC overhead
    const isTarget = new Uint8Array(numMatches);
    const matchScores = new Int16Array(numMatches);
    const matchBaseScores = new Int16Array(numMatches);
    const matchTriggerIds: Int32Array[] = new Array(numMatches);
    let totalCorrectMatches = 0;

    // Inverted index builders
    const triggerIndicesLists: number[][] = Array.from({ length: numTriggers }, () => []);
    const triggerTargetCountsArr = new Int32Array(numTriggers);
    const triggerTrapCountsArr = new Int32Array(numTriggers);
    const histTotalCountsArr = new Int32Array(numTriggers);
    for (let tId = 0; tId < numTriggers; tId++) {
      const hStat = histHitsMap.get(allCatalogTriggers[tId]);
      const hTot = hStat?.total || 0;
      histTotalCountsArr[tId] = hTot;
      if (hStat && hTot >= 3) {
        const hTargets = activeCategoryConfig.targetObjective === 'underdog_only'
          ? hStat.underdog
          : activeCategoryConfig.targetObjective === 'mfav_only'
          ? hStat.mfav
          : (hStat.mfav + hStat.draw);
        histTargetAccArr[tId] = hTargets / hTot;
      } else {
        histTargetAccArr[tId] = -1;
      }
    }

    for (let i = 0; i < numMatches; i++) {
      const p = profiles[i];
      let isT = false;
      if (activeCategoryConfig.targetObjective === 'underdog_only') {
        isT = p.outcome === 'underdog';
      } else if (activeCategoryConfig.targetObjective === 'mfav_only') {
        isT = p.outcome === 'mfav';
      } else {
        isT = p.outcome === 'mfav' || p.outcome === 'draw';
      }
      isTarget[i] = isT ? 1 : 0;
      if (isT) totalCorrectMatches++;

      let s = p.baseScore;
      let baseS = p.baseScore;
      const mTrigIds: number[] = [];
      p.triggersHit.forEach(t => {
        if (REMOVED_TRIGGER_DESCRIPTIONS.has(t)) return;
        const tId = triggerIdByName.get(t);
        if (tId !== undefined) {
          s += bestPointsArr[tId];
          mTrigIds.push(tId);
          triggerIndicesLists[tId].push(i);
          if (isT) triggerTargetCountsArr[tId]++;
          else triggerTrapCountsArr[tId]++;
        } else {
          const defPts = getNewTriggerDefaultPoints(t, isUpsetsCat);
          s += defPts;
          baseS += defPts;
        }
      });
      matchBaseScores[i] = baseS;
      matchTriggerIds[i] = new Int32Array(mTrigIds);
      matchScores[i] = Math.max(-1499, Math.min(1499, s));
    }

    const triggerIndicesArr: Int32Array[] = new Array(numTriggers);
    for (let tId = 0; tId < numTriggers; tId++) {
      triggerIndicesArr[tId] = new Int32Array(triggerIndicesLists[tId]);
    }

    // In live mode, triggers that hit at least 1 match in the active match profiles participate in mutations.
    const eligibleTriggerIds: number[] = [];
    const broadDriverTriggerIds: number[] = [];
    const activeTriggerIds: number[] = [];
    const allTriggerIds: number[] = [];

    for (let tId = 0; tId < numTriggers; tId++) {
      allTriggerIds.push(tId);
      const liveHits = triggerIndicesArr[tId].length;
      const histHits = histTotalCountsArr[tId];
      if (liveHits > 0) activeTriggerIds.push(tId);
      if (isHistoryMode || liveHits >= 1 || histHits >= 20) {
        eligibleTriggerIds.push(tId);
        if (isHistoryMode ? histHits >= 20 : (liveHits >= 2 || (liveHits >= 1 && histHits >= 20))) {
          broadDriverTriggerIds.push(tId);
        }
      }
    }

    const horizons = calculateTargetHorizons(profiles.length, totalCorrectMatches, activeCategoryConfig.targetCapacity, activeCategoryConfig.targetObjective);

    // 3001 Buckets for scores from -1499 to +1499 (offset = 1500) so match scores never clamp-drift
    const SCORE_OFFSET = 1500;
    const BUCKET_COUNT = 3001;
    const targetBuckets = new Int32Array(BUCKET_COUNT);
    const trapBuckets = new Int32Array(BUCKET_COUNT);
    let maxActiveBucket = 0;
    let minActiveBucket = BUCKET_COUNT - 1;

    for (let i = 0; i < numMatches; i++) {
      const b = matchScores[i] + SCORE_OFFSET;
      if (b > maxActiveBucket) maxActiveBucket = b;
      if (b < minActiveBucket) minActiveBucket = b;
      if (isTarget[i] === 1) targetBuckets[b]++;
      else trapBuckets[b]++;
    }
    if (minActiveBucket > maxActiveBucket) minActiveBucket = 0;

    // Preallocated static buffers for zero-allocation fastEvaluateBuckets
    const horizonLimitsBuf = new Int32Array([500, 1000, 1500, 2000, 3000]);
    const hTrapsBuf = new Int32Array(5);
    const hTargetsBuf = new Int32Array(5);
    const trapRanksBuf = new Int32Array(5);
    const trapScoresBuf = new Int32Array(5);
    const trapGapsBuf = new Int32Array(5);
    let trapRanksCount = 0;
    let lastRunMatches = 0;

    interface FastEvalSnapshot {
      quality: number;
      cleanTopMatches: number;
      firstTrapRank: number;
      tiedAtBoundary: number;
      trapInTopN: number;
      targetInTopN: number;
      purityPct: number;
      bufferMargin: number;
      targetsInTop5000: number;
      targetOverTrapPairs: number;
      positiveTargets: number;
      positiveTraps: number;
      floorMet: boolean;
      ceilingMet: boolean;
      horizonMetrics?: MultiHorizonSummary;
      trapRanks: number[];
      trapScores: number[];
      trapGaps: number[];
      trapDispersionHealth: 'HEALTHY' | 'MODERATE' | 'CLUSTERED';
    }

    const trialEval: FastEvalSnapshot = {
      quality: 0,
      cleanTopMatches: 0,
      firstTrapRank: 1,
      tiedAtBoundary: 0,
      trapInTopN: 0,
      targetInTopN: 0,
      purityPct: 0,
      bufferMargin: 0,
      targetsInTop5000: 0,
      targetOverTrapPairs: 0,
      positiveTargets: 0,
      positiveTraps: 0,
      floorMet: false,
      ceilingMet: false,
      trapRanks: [],
      trapScores: [],
      trapGaps: [],
      trapDispersionHealth: 'CLUSTERED'
    };

    const cloneEvalSnapshot = (src: FastEvalSnapshot): FastEvalSnapshot => {
      const ranks: number[] = new Array(trapRanksCount);
      const scores: number[] = new Array(trapRanksCount);
      const gaps: number[] = new Array(trapRanksCount);
      for (let i = 0; i < trapRanksCount; i++) {
        ranks[i] = trapRanksBuf[i];
        scores[i] = trapScoresBuf[i];
        gaps[i] = trapGapsBuf[i];
      }
      const horizonMetrics: MultiHorizonSummary = {
        h500: { horizon: 500, traps: hTrapsBuf[0], targets: hTargetsBuf[0], total: Math.min(500, lastRunMatches), winRate: (hTargetsBuf[0] + hTrapsBuf[0]) > 0 ? (hTargetsBuf[0] / (hTargetsBuf[0] + hTrapsBuf[0])) * 100 : 0 },
        h1000: { horizon: 1000, traps: hTrapsBuf[1], targets: hTargetsBuf[1], total: Math.min(1000, lastRunMatches), winRate: (hTargetsBuf[1] + hTrapsBuf[1]) > 0 ? (hTargetsBuf[1] / (hTargetsBuf[1] + hTrapsBuf[1])) * 100 : 0 },
        h1500: { horizon: 1500, traps: hTrapsBuf[2], targets: hTargetsBuf[2], total: Math.min(1500, lastRunMatches), winRate: (hTargetsBuf[2] + hTrapsBuf[2]) > 0 ? (hTargetsBuf[2] / (hTargetsBuf[2] + hTrapsBuf[2])) * 100 : 0 },
        h2000: { horizon: 2000, traps: hTrapsBuf[3], targets: hTargetsBuf[3], total: Math.min(2000, lastRunMatches), winRate: (hTargetsBuf[3] + hTrapsBuf[3]) > 0 ? (hTargetsBuf[3] / (hTargetsBuf[3] + hTrapsBuf[3])) * 100 : 0 },
        h3000: { horizon: 3000, traps: hTrapsBuf[4], targets: hTargetsBuf[4], total: Math.min(3000, lastRunMatches), winRate: (hTargetsBuf[4] + hTrapsBuf[4]) > 0 ? (hTargetsBuf[4] / (hTargetsBuf[4] + hTrapsBuf[4])) * 100 : 0 },
      };
      return {
        quality: src.quality,
        cleanTopMatches: src.cleanTopMatches,
        firstTrapRank: src.firstTrapRank,
        tiedAtBoundary: src.tiedAtBoundary,
        trapInTopN: src.trapInTopN,
        targetInTopN: src.targetInTopN,
        purityPct: src.purityPct,
        bufferMargin: src.bufferMargin,
        targetsInTop5000: src.targetsInTop5000,
        targetOverTrapPairs: src.targetOverTrapPairs,
        positiveTargets: src.positiveTargets,
        positiveTraps: src.positiveTraps,
        floorMet: src.floorMet,
        ceilingMet: src.ceilingMet,
        horizonMetrics,
        trapRanks: ranks,
        trapScores: scores,
        trapGaps: gaps,
        trapDispersionHealth: src.trapDispersionHealth
      };
    };

    const topNCapacity = activeCategoryConfig.targetCapacity;
    const boundaryTargetGoal = Math.min(horizons.floor, Math.max(topNCapacity, 100));
    const liveGoalN = Math.min(totalCorrectMatches, Math.max(topNCapacity, horizons.floor));
    const isMfavDraw = activeCategoryConfig.targetObjective === 'mfav_draw';
    const maxTrapsAllowed500 = isMfavDraw ? 25 : 50;
    const maxTrapsAllowed1000 = isMfavDraw ? 60 : 100;
    const isUnderdog = activeCategoryConfig.targetObjective === 'underdog_only';
    const elevatedMultiplier = isUnderdog ? 3 : (isHistoryMode ? 4 : 5);
    const targetWeight = isUnderdog ? 35 : 40;
    const trapWeight = 15;
    const liftWeight = 0.25;
    const pairMultiplier = isHistoryMode ? 5 : 120;
    const topTrapAdvMult = isHistoryMode ? 8 : 6;

    const LAYER_1_INCREMENTAL_COMPS = 1_000_000;
    let totalComps = deepComputations;
    let layer2Announced = deepComputations >= LAYER_1_INCREMENTAL_COMPS;

    const fastEvaluateBuckets = (
      tBuckets: Int32Array,
      trBuckets: Int32Array,
      regSum: number
    ): FastEvalSnapshot => {
      let maxTrapB = -1;
      let cleanTop = 0;
      let targetInTopN = 0;
      let trapInTopN = 0;
      let counted = 0;

      let hIdx = 0;
      let runMatches = 0;
      let runT = 0;
      let runTr = 0;

      let tCounted = 0;
      let boundaryB = 0;

      let targetOverTrapPairs = 0;
      let runningTargetsSeen = 0;
      let positiveTargets = 0;
      let upperTargetLift = 0;
      let positiveTraps = 0;

      let nthTargetB = -1;
      let topTargetB = -1;
      let tc = 0;

      trapRanksCount = 0;

      let targetsInTop5000 = 0;
      let counted5k = 0;

      let minTargetB = -1;
      let matchesSeen = 0;

      const startB = Math.min(BUCKET_COUNT - 1, maxActiveBucket);
      const endB = Math.max(0, minActiveBucket);

      // SINGLE UNIFIED ZERO-ALLOCATION DOWNWARD PASS WITH EARLY EXIT
      for (let b = startB; b >= endB; b--) {
        const tCount = tBuckets[b];
        const trCount = trBuckets[b];
        const inB = tCount + trCount;
        if (inB === 0) continue;

        matchesSeen += inB;

        // 1 & 2. Trap detection & clean top
        if (trCount > 0 && maxTrapB === -1) {
          maxTrapB = b;
          cleanTop = runningTargetsSeen;
        }

        // 3. Top N purity
        if (counted < topNCapacity) {
          const rem = topNCapacity - counted;
          if (inB <= rem) {
            targetInTopN += tCount;
            trapInTopN += trCount;
            counted += inB;
          } else {
            const takeT = tCount < rem ? tCount : rem;
            targetInTopN += takeT;
            trapInTopN += (rem - takeT);
            counted = topNCapacity;
          }
        }

        // 3b. Multi-horizon
        if (numMatches > 50 && hIdx < 5) {
          while (hIdx < 5 && runMatches + inB >= horizonLimitsBuf[hIdx]) {
            const rem = horizonLimitsBuf[hIdx] - runMatches;
            const addT = tCount < rem ? tCount : rem;
            const addTr = rem - addT;
            hTargetsBuf[hIdx] = runT + addT;
            hTrapsBuf[hIdx] = runTr + addTr;
            hIdx++;
          }
          runMatches += inB;
          runT += tCount;
          runTr += trCount;
        }

        // 4. Boundary target
        if (tCount > 0 && tCounted < boundaryTargetGoal) {
          tCounted += tCount;
          if (tCounted >= boundaryTargetGoal) {
            boundaryB = b;
          }
        }

        // 5. Concordance
        if (trCount > 0) {
          targetOverTrapPairs += trCount * runningTargetsSeen;
        }
        runningTargetsSeen += tCount;

        // 5b. Bounded lift & positive scores (cap sVal tightly so already-winning scores cannot inflate endlessly)
        const sVal = b - SCORE_OFFSET;
        const clampedLiftS = sVal < -15 ? -15 : (sVal > 15 ? 15 : sVal);
        if (sVal > 0) {
          if (tCount > 0) {
            positiveTargets += tCount;
            upperTargetLift += tCount * clampedLiftS;
          }
          if (trCount > 0) {
            positiveTraps += trCount;
          }
        } else if (tCount > 0) {
          upperTargetLift += tCount * clampedLiftS;
        }

        // Live separation target tracking
        if (tCount > 0) {
          if (topTargetB === -1) topTargetB = b;
          if (tc < liveGoalN) {
            tc += tCount;
            if (tc >= liveGoalN && nthTargetB === -1) nthTargetB = b;
          }
          minTargetB = b;
        }

        // Top 5 trap ranks and scores
        if (trCount > 0 && trapRanksCount < 5) {
          for (let k = 0; k < trCount && trapRanksCount < 5; k++) {
            const r = runningTargetsSeen + trapRanksCount + 1;
            trapRanksBuf[trapRanksCount] = r;
            trapScoresBuf[trapRanksCount] = sVal;
            trapGapsBuf[trapRanksCount] = trapRanksCount === 0 ? (r - 1) : (r - trapRanksBuf[trapRanksCount - 1]);
            trapRanksCount++;
          }
        }

        // Top 5000
        if (counted5k < 5000) {
          const rem = 5000 - counted5k;
          if (inB <= rem) {
            targetsInTop5000 += tCount;
            counted5k += inB;
          } else {
            targetsInTop5000 += tCount < rem ? tCount : rem;
            counted5k = 5000;
          }
        }

        // EARLY EXIT: when all matches in dataset have been processed
        if (matchesSeen >= numMatches) break;
      }

      if (maxTrapB === -1) {
        cleanTop = totalCorrectMatches;
      }

      while (hIdx < 5) {
        hTargetsBuf[hIdx] = runT;
        hTrapsBuf[hIdx] = runTr;
        hIdx++;
      }
      lastRunMatches = runMatches;

      let horizonFitness = 0;
      if (numMatches > 50) {
        const excessTraps500 = hTrapsBuf[0] > maxTrapsAllowed500 ? hTrapsBuf[0] - maxTrapsAllowed500 : 0;
        const excessTraps1000 = hTrapsBuf[1] > maxTrapsAllowed1000 ? hTrapsBuf[1] - maxTrapsAllowed1000 : 0;
        horizonFitness =
          (hTargetsBuf[0] * 25 - hTrapsBuf[0] * 150 - excessTraps500 * 300) +
          (hTargetsBuf[1] * 20 - hTrapsBuf[1] * 100 - excessTraps1000 * 200) +
          (hTargetsBuf[2] * 15 - hTrapsBuf[2] * 50) +
          (hTargetsBuf[3] * 10 - hTrapsBuf[3] * 30) +
          (hTargetsBuf[4] * 5  - hTrapsBuf[4] * 15);
      }

      let elevatedTrapPenalty = 0;
      const trapThresholdB = isUnderdog ? Math.max(0, boundaryB - 5) : Math.max(0, boundaryB - 10);
      if (maxTrapB >= trapThresholdB) {
        for (let b = maxTrapB; b >= trapThresholdB; b--) {
          const trC = trBuckets[b];
          if (trC > 0) {
            elevatedTrapPenalty += trC * (b - trapThresholdB + 1) * elevatedMultiplier;
          }
        }
      }

      // Bound trap advantage tightly so lowering traps below -10 does not reward extreme penalty slapping
      const TRAP_ADV_FLOOR_B = SCORE_OFFSET - 10;
      const effectiveMaxTrapB = maxTrapB < TRAP_ADV_FLOOR_B ? TRAP_ADV_FLOOR_B : maxTrapB;
      const topTrapAdvantage = maxTrapB >= 0
        ? (BUCKET_COUNT - 1 - effectiveMaxTrapB) * topTrapAdvMult
        : 500;

      const cleanStreakBonus = (cleanTop >= liveGoalN && totalCorrectMatches > 0) ? 3000 : 0;

      let liveSeparationTerm = 0;
      if (maxTrapB >= 0) {
        const tiedTopTrapPenalty = trBuckets[maxTrapB] * 300;
        const margin = nthTargetB >= 0 ? (nthTargetB - maxTrapB) : 0;
        const clampedMargin = margin < -30 ? -30 : (margin > 10 ? 10 : margin);
        let breakoutLead = 0;
        if (topTargetB >= 0 && cleanTop === 0) {
          const diff = topTargetB - maxTrapB;
          const clampedDiff = diff < -30 ? -30 : (diff > 10 ? 10 : diff);
          breakoutLead = clampedDiff * 60;
        }
        liveSeparationTerm = clampedMargin * 25 - tiedTopTrapPenalty + breakoutLead;
      }

      let avgTrapGap = 0;
      let trapDispersionScore = 0;
      if (trapRanksCount > 1) {
        let sumGaps = 0;
        let totalTrapDepth = 0;
        for (let k = 1; k < trapRanksCount; k++) {
          const gap = trapGapsBuf[k];
          sumGaps += gap;
          totalTrapDepth += trapRanksBuf[k];
          if (gap >= 15) trapDispersionScore += 450;
          else if (gap >= 10) trapDispersionScore += 300;
          else if (gap >= 5) trapDispersionScore += 180;
          else if (gap >= 3) trapDispersionScore += 90;
          else if (gap >= 2) trapDispersionScore += 30;
          else if (gap <= 1) trapDispersionScore -= 120;
        }
        avgTrapGap = sumGaps / (trapRanksCount - 1);
        const depthBonus = totalTrapDepth * 3;
        trapDispersionScore += depthBonus < 800 ? depthBonus : 800;
      } else if (trapRanksCount === 1) {
        avgTrapGap = trapGapsBuf[0];
      }

      const trapDispersionHealth: 'HEALTHY' | 'MODERATE' | 'CLUSTERED' =
        avgTrapGap >= 10 ? 'HEALTHY' : avgTrapGap >= 5 ? 'MODERATE' : 'CLUSTERED';

      const activeRegMult = totalComps >= LAYER_1_INCREMENTAL_COMPS ? 1.5 : 6.0;
      const quality = (cleanTop * 500) +
        cleanStreakBonus +
        (targetOverTrapPairs * pairMultiplier) +
        horizonFitness -
        (trapInTopN * 500) -
        elevatedTrapPenalty +
        (positiveTargets * targetWeight) -
        (positiveTraps * trapWeight) +
        (upperTargetLift * liftWeight) +
        topTrapAdvantage +
        liveSeparationTerm +
        trapDispersionScore -
        (regSum * activeRegMult);

      trialEval.quality = quality;
      trialEval.cleanTopMatches = cleanTop;
      trialEval.firstTrapRank = trapRanksCount > 0 ? trapRanksBuf[0] : (cleanTop + 1);
      trialEval.tiedAtBoundary = maxTrapB >= 0 ? tBuckets[maxTrapB] : 0;
      trialEval.trapInTopN = trapInTopN;
      trialEval.targetInTopN = targetInTopN;
      trialEval.purityPct = topNCapacity > 0 ? (targetInTopN / topNCapacity) * 100 : 0;
      trialEval.bufferMargin = (minTargetB >= 0 && maxTrapB >= 0) ? (minTargetB - maxTrapB) : 0;
      trialEval.targetsInTop5000 = targetsInTop5000;
      trialEval.targetOverTrapPairs = targetOverTrapPairs;
      trialEval.positiveTargets = positiveTargets;
      trialEval.positiveTraps = positiveTraps;
      trialEval.floorMet = horizons.floor > 0 && cleanTop >= horizons.floor;
      trialEval.ceilingMet = horizons.ceiling > 0 && cleanTop >= horizons.ceiling;
      trialEval.trapDispersionHealth = trapDispersionHealth;

      return trialEval;
    };

    const PTS_OFFSET = 40;
    const PTS_SPAN = 81; // -40 .. +40
    const normRegTable = new Float64Array(PTS_SPAN);
    for (let p = -40; p <= 40; p++) {
      if (p === 0) {
        normRegTable[p + PTS_OFFSET] = 0;
      } else {
        const steps = Math.abs(p) / 5;
        normRegTable[p + PTS_OFFSET] = steps * steps;
      }
    }
    const getNormReg = (pts: number) => {
      if (pts >= -40 && pts <= 40) return normRegTable[pts + PTS_OFFSET];
      const steps = Math.abs(pts) / 5;
      return steps * steps;
    };

    let runningRegSum = 0;
    for (let tId = 0; tId < numTriggers; tId++) {
      runningRegSum += getNormReg(bestPointsArr[tId]);
    }
    let bestFastEval = cloneEvalSnapshot(fastEvaluateBuckets(targetBuckets, trapBuckets, runningRegSum));
    let compsSinceMilestone = 0;
    let bestCleanStreak = bestFastEval.cleanTopMatches;
    const initiallyCeilingMet = bestFastEval.ceilingMet;

    // Adaptive Discovery Memory Bank / Breakthrough Advisor (integer-indexed):
    interface BreakthroughRecord {
      triggerIds: Int32Array;
      deltaClean: number;
      deltaQuality: number;
    }
    const recentBreakthroughs: BreakthroughRecord[] = [];
    const triggerImpactMomentum = new Float32Array(numTriggers);

    const recordBreakthroughMemoryIds = (mutIds: Int32Array, count: number, deltaClean: number, deltaQuality: number) => {
      const saved = new Int32Array(count);
      const weight = deltaClean > 0 ? (deltaClean * 10) : (deltaQuality > 0 ? 2 : 1);
      for (let i = 0; i < count; i++) {
        const tId = mutIds[i];
        saved[i] = tId;
        const cur = triggerImpactMomentum[tId];
        triggerImpactMomentum[tId] = cur + weight > 100 ? 100 : cur + weight;
      }
      recentBreakthroughs.push({
        triggerIds: saved,
        deltaClean,
        deltaQuality
      });
      if (recentBreakthroughs.length > 30) recentBreakthroughs.shift();
    };

    const initialPointsMap = buildPointsMapFromArr(bestPointsArr);
    setDeepPurityPct(bestFastEval.purityPct);
    setDeepInversions(Math.max(0, (numMatches - totalCorrectMatches) - bestFastEval.cleanTopMatches));
    setDeepBufferMargin(bestFastEval.bufferMargin);
    setDeepQuality(bestFastEval.quality);
    setDeepCleanMatches(bestFastEval.cleanTopMatches);
    setDeepTargetClean(horizons.floor);
    setDeepTargetCeiling(horizons.ceiling);
    setDeepFirstTrapRank(bestFastEval.firstTrapRank);
    setDeepTargetsInTop5000(bestFastEval.targetsInTop5000);
    if (bestFastEval.horizonMetrics) setDeepHorizonMetrics(bestFastEval.horizonMetrics);
    setDeepConvergenceMode(bestFastEval.ceilingMet ? 'perfect_100' : bestFastEval.floorMet ? 'sweet_spot' : 'none');
    setDeepPointsMap(new Map(initialPointsMap));
    setDeepCategoryPointsMap(prev => ({ ...prev, [`${datasetDay}_${activeCategory}`]: new Map(initialPointsMap) }));

    // --- Systematic Trigger Grouping & Round-Robin Rotation (Integer IDs) ---
    // Focus strictly on triggers that actually fired in the evaluated match set so zero-hit triggers never waste budget
    const GROUP_SIZE = 8;
    const firedWorkingSeed = activeTriggerIds.length > 0 ? activeTriggerIds : (eligibleTriggerIds.length > 0 ? eligibleTriggerIds : allTriggerIds);
    const allWorkingTriggerIds = [...firedWorkingSeed];
    let triggerGroupsIds: Int32Array[] = [];
    const rebuildGroups = () => {
      triggerGroupsIds = [];
      for (let g = 0; g < allWorkingTriggerIds.length; g += GROUP_SIZE) {
        triggerGroupsIds.push(new Int32Array(allWorkingTriggerIds.slice(g, g + GROUP_SIZE)));
      }
      if (triggerGroupsIds.length === 0) triggerGroupsIds.push(new Int32Array(allWorkingTriggerIds.slice(0, 10)));
    };
    rebuildGroups();

    // --- Exact undo log with dynamic growth (prevents silent TypedArray overflow and score drift) ---
    let undoIdx = new Int32Array(Math.max(4096, numMatches * 16));
    let undoOld = new Int16Array(Math.max(4096, numMatches * 16));
    let undoLen = 0;
    const applyDelta = (indices: Int32Array | undefined, d: number) => {
      if (!indices || d === 0) return;
      const needed = undoLen + indices.length;
      if (needed >= undoIdx.length) {
        const nextCap = Math.max(needed * 2, undoIdx.length * 2);
        const nextIdx = new Int32Array(nextCap);
        const nextOld = new Int16Array(nextCap);
        nextIdx.set(undoIdx);
        nextOld.set(undoOld);
        undoIdx = nextIdx;
        undoOld = nextOld;
      }
      for (let j = 0, len = indices.length; j < len; j++) {
        const idx = indices[j];
        const oldS = matchScores[idx];
        const rawS = oldS + d;
        const newS = rawS < -1499 ? -1499 : (rawS > 1499 ? 1499 : rawS);
        if (newS === oldS) continue;
        undoIdx[undoLen] = idx;
        undoOld[undoLen] = oldS;
        undoLen++;
        matchScores[idx] = newS;
        const oldB = oldS + SCORE_OFFSET;
        const newB = newS + SCORE_OFFSET;
        if (newB > maxActiveBucket) maxActiveBucket = newB;
        if (newB < minActiveBucket) minActiveBucket = newB;
        if (isTarget[idx] === 1) {
          targetBuckets[oldB]--;
          targetBuckets[newB]++;
        } else {
          trapBuckets[oldB]--;
          trapBuckets[newB]++;
        }
      }
    };
    const rollbackTo = (mark: number) => {
      for (let u = undoLen - 1; u >= mark; u--) {
        const idx = undoIdx[u];
        const origS = undoOld[u];
        const curS = matchScores[idx];
        matchScores[idx] = origS;
        const curB = curS + SCORE_OFFSET;
        const origB = origS + SCORE_OFFSET;
        if (isTarget[idx] === 1) {
          targetBuckets[curB]--;
          targetBuckets[origB]++;
        } else {
          trapBuckets[curB]--;
          trapBuckets[origB]++;
        }
      }
      undoLen = mark;
    };
    const recomputeScoresAndBucketsFrom = (ptsArr: Int16Array) => {
      undoLen = 0;
      targetBuckets.fill(0);
      trapBuckets.fill(0);
      maxActiveBucket = 0;
      minActiveBucket = BUCKET_COUNT - 1;
      for (let i = 0; i < numMatches; i++) {
        let s = matchBaseScores[i];
        const mTrigs = matchTriggerIds[i];
        for (let k = 0, len = mTrigs.length; k < len; k++) {
          s += ptsArr[mTrigs[k]];
        }
        const clampedS = s < -1499 ? -1499 : (s > 1499 ? 1499 : s);
        matchScores[i] = clampedS;
        const b = clampedS + SCORE_OFFSET;
        if (b > maxActiveBucket) maxActiveBucket = b;
        if (b < minActiveBucket) minActiveBucket = b;
        if (isTarget[i] === 1) targetBuckets[b]++;
        else trapBuckets[b]++;
      }
      if (minActiveBucket > maxActiveBucket) minActiveBucket = 0;
      runningRegSum = 0;
      for (let tId = 0; tId < numTriggers; tId++) {
        runningRegSum += getNormReg(ptsArr[tId]);
      }
    };

    // Dominant triggers (live slice: >=4 hits and >=80% targets/traps; or historical universe: >=30 hits with strong polarity)
    // 0 = none, 1 = up, -1 = down
    const dominantDirArr = new Int8Array(numTriggers);
    for (let tId = 0; tId < numTriggers; tId++) {
      const desc = allCatalogTriggers[tId];
      const tH = triggerTargetCountsArr[tId];
      const trH = triggerTrapCountsArr[tId];
      const tot = tH + trH;
      if (tot >= 4) {
        if (tH / tot >= 0.80) dominantDirArr[tId] = 1;
        else if (trH / tot >= 0.80) dominantDirArr[tId] = -1;
      } else {
        const hCounts = histHitsMap.get(desc);
        if (hCounts && hCounts.total >= 30) {
          const polarity = getTriggerSemanticPolarity(desc);
          const isUnderdogCat = activeCategoryConfig.targetObjective === 'underdog_only';
          if (isUnderdogCat) {
            if (polarity === 'PRO_UNDERDOG' && hCounts.underdog / hCounts.total >= 0.35) dominantDirArr[tId] = 1;
            else if (polarity === 'PRO_MFAV' && (hCounts.mfav + hCounts.draw) / hCounts.total >= 0.75) dominantDirArr[tId] = -1;
          } else if (activeCategoryConfig.targetObjective === 'mfav_only') {
            if (polarity === 'PRO_MFAV' && hCounts.mfav / hCounts.total >= 0.65) dominantDirArr[tId] = 1;
            else if (polarity === 'PRO_UNDERDOG' && (hCounts.underdog + hCounts.draw) / hCounts.total >= 0.50) dominantDirArr[tId] = -1;
          } else {
            if (polarity === 'PRO_MFAV' && (hCounts.mfav + hCounts.draw) / hCounts.total >= 0.75) dominantDirArr[tId] = 1;
            else if (polarity === 'PRO_UNDERDOG' && hCounts.underdog / hCounts.total >= 0.30) dominantDirArr[tId] = -1;
          }
        }
      }
    }

    // Precompute per-trigger accuracy profiles, strict polarity band min/max, and O(1) candidate lookup tables
    // Indexed by: tId * PTS_SPAN + (currentVal + PTS_OFFSET)
    const profilesByTrigId: ReturnType<typeof getTriggerAccuracyProfile>[] = new Array(numTriggers);
    const bandMaxArr = new Int16Array(numTriggers);
    const bandMinArr = new Int16Array(numTriggers);
    const totalTableSlots = numTriggers * PTS_SPAN;
    const stepUpTable: Int16Array[] = new Array(totalTableSlots);
    const stepDownTable: Int16Array[] = new Array(totalTableSlots);
    const stepAnyTable: Int16Array[] = new Array(totalTableSlots);
    const stretchUpTable: Int16Array[] = new Array(totalTableSlots);
    const stretchDownTable: Int16Array[] = new Array(totalTableSlots);
    const stretchAnyTable: Int16Array[] = new Array(totalTableSlots);
    const escalateUpTable: Int16Array[] = new Array(totalTableSlots);
    const escalateDownTable: Int16Array[] = new Array(totalTableSlots);
    const escalateAnyTable: Int16Array[] = new Array(totalTableSlots);
    const emptyInt16 = new Int16Array(0);

    const buildEscalationCandidatesFor = (
      band: number[],
      currentVal: number,
      dir: 'up' | 'down' | 'any',
      minFloor: number,
      maxBonus: number,
      isUniversalBonus: boolean,
      zeroEligible: boolean
    ): Int16Array => {
      if (band.length === 0) return emptyInt16;
      const canUseZeroNow = isUpsetsCat && zeroEligible;
      const valid = band
        .filter(v => {
          if (v === currentVal) return false;
          if (dir === 'up' && v <= currentVal) return false;
          if (dir === 'down' && v >= currentVal) return false;
          if (v === 0 && !canUseZeroNow) return false;
          if (v !== 0 && v > -5 && v < 5) return false;
          if (v < minFloor || v > maxBonus) return false;
          if (isUniversalBonus && v < (canUseZeroNow ? 0 : 5)) return false;
          return true;
        })
        .sort((a, b) => Math.abs(a - currentVal) - Math.abs(b - currentVal));
      return valid.length > 0 ? new Int16Array(valid) : emptyInt16;
    };

    const buildCandidatesFor = (
      tId: number,
      trigger: string,
      currentVal: number,
      band: number[],
      dir: 'up' | 'down' | 'any',
      allowStretch: boolean,
      isNeutralLeague: boolean,
      minFloor: number,
      maxBonus: number,
      isUniversalBonus: boolean,
      zeroEligible: boolean
    ): Int16Array => {
      if (band.length === 0) return emptyInt16;
      const canUseZeroNow = isUpsetsCat && allowStretch && zeroEligible;
      if (!band.includes(currentVal)) {
        const filtered = band
          .filter(v => {
            if (v === currentVal) return false;
            if (v === 0 && !canUseZeroNow) return false;
            return v === 0 || v >= 5 || v <= -5;
          })
          .sort((a, b) => Math.abs(a - currentVal) - Math.abs(b - currentVal));
        const nearest = allowStretch ? filtered.slice(0, 3) : filtered.slice(0, 2);
        return nearest.length > 0 ? new Int16Array(nearest) : emptyInt16;
      }
      // Strictly incremental candidate generation:
      // - step*Table: single ±5 step only (or -5 <-> +5 for neutral league triggers)
      // - stretch*Table: nearest-first ±5, then ±10 (never full-band jumps straight to ±30/±35/±40)
      const out: number[] = [];
      const pushIfBand = (v: number) => {
        if (band.includes(v) && !out.includes(v)) out.push(v);
      };

      if (dir !== 'down') {
        pushIfBand(currentVal + 5);
        if (isNeutralLeague && currentVal === -5) pushIfBand(5);
        if (allowStretch) {
          pushIfBand(currentVal + 10);
          if (isNeutralLeague && currentVal === -10) pushIfBand(5);
        }
      }
      if (dir !== 'up') {
        pushIfBand(currentVal - 5);
        if (isNeutralLeague && currentVal === 5) pushIfBand(-5);
        if (allowStretch) {
          pushIfBand(currentVal - 10);
          if (isNeutralLeague && currentVal === 10) pushIfBand(-5);
        }
      }
      if (canUseZeroNow && currentVal !== 0 && Math.abs(currentVal) <= 10) {
        pushIfBand(0);
      }

      const valid = out
        .filter(v => {
          if (v === 0 && !canUseZeroNow) return false;
          if (v !== 0 && v > -5 && v < 5) return false;
          if (v < minFloor) return false;
          if (v > maxBonus) return false;
          if (isUniversalBonus && v < (canUseZeroNow ? 0 : 5)) return false;
          return band.includes(v);
        })
        .sort((a, b) => Math.abs(a - currentVal) - Math.abs(b - currentVal));
      return valid.length > 0 ? new Int16Array(valid) : emptyInt16;
    };

    for (let tId = 0; tId < numTriggers; tId++) {
      const desc = allCatalogTriggers[tId];
      const prof = getTriggerAccuracyProfile(
        desc,
        hitStatsMap.get(desc),
        activeCategoryConfig.targetObjective,
        currentRulePointsMap.get(desc),
        isHistoryMode,
        activeCategory,
        undefined,
        histHitsMap.get(desc)
      );
      profilesByTrigId[tId] = prof;
      const band = prof.allowedBand;
      if (band.length > 0) {
        bandMaxArr[tId] = Math.max(...band);
        bandMinArr[tId] = Math.min(...band);
      } else {
        bandMaxArr[tId] = 30;
        bandMinArr[tId] = -30;
      }
      const isLeague = isLeagueTrigger(desc);
      const isNeutralTrig = isLeague || DUAL_BONUS_TRIGGERS.has(desc) || getTriggerSemanticPolarity(desc, activeCategory) === 'NEUTRAL';
      const minFloor = isLeague ? getLeagueTriggerMaxPenalty(desc) : -30;
      const maxBonus = isLeague ? getLeagueTriggerMaxBonus(desc, isUpsetsCat) : 40;
      const isUniversalBonus = false;
      const baseSlot = tId * PTS_SPAN;
      for (let val = -40; val <= 40; val++) {
        const slot = baseSlot + (val + PTS_OFFSET);
        stepUpTable[slot] = buildCandidatesFor(tId, desc, val, band, 'up', false, isNeutralTrig, minFloor, maxBonus, isUniversalBonus, prof.zeroEligible);
        stepDownTable[slot] = buildCandidatesFor(tId, desc, val, band, 'down', false, isNeutralTrig, minFloor, maxBonus, isUniversalBonus, prof.zeroEligible);
        stepAnyTable[slot] = buildCandidatesFor(tId, desc, val, band, 'any', false, isNeutralTrig, minFloor, maxBonus, isUniversalBonus, prof.zeroEligible);
        stretchUpTable[slot] = buildCandidatesFor(tId, desc, val, band, 'up', true, isNeutralTrig, minFloor, maxBonus, isUniversalBonus, prof.zeroEligible);
        stretchDownTable[slot] = buildCandidatesFor(tId, desc, val, band, 'down', true, isNeutralTrig, minFloor, maxBonus, isUniversalBonus, prof.zeroEligible);
        stretchAnyTable[slot] = buildCandidatesFor(tId, desc, val, band, 'any', true, isNeutralTrig, minFloor, maxBonus, isUniversalBonus, prof.zeroEligible);
        escalateUpTable[slot] = buildEscalationCandidatesFor(band, val, 'up', minFloor, maxBonus, isUniversalBonus, prof.zeroEligible);
        escalateDownTable[slot] = buildEscalationCandidatesFor(band, val, 'down', minFloor, maxBonus, isUniversalBonus, prof.zeroEligible);
        escalateAnyTable[slot] = buildEscalationCandidatesFor(band, val, 'any', minFloor, maxBonus, isUniversalBonus, prof.zeroEligible);
      }
    }

    // Winner-Promotion & Trap-Targeted Commonality Analysis (recomputed lazily after accepted changes)
    let targetingDirty = true;
    let targetDownIds = new Int32Array(0);
    let targetUpIds = new Int32Array(0);
    let sharedTrapBundleIds = new Int32Array(0);
    let sharedWinnerBundleIds = new Int32Array(0);
    const trapCommonalityScore = new Float32Array(numTriggers);
    const winnerCommonalityScore = new Float32Array(numTriggers);
    const targetDownFlags = new Uint8Array(numTriggers);
    const targetUpFlags = new Uint8Array(numTriggers);
    let cachedBoundaryCandidateIds = new Int32Array(0);
    const freqBuf = new Int32Array(numTriggers);
    const cleanWinFreqBuf = new Int32Array(numTriggers);
    const allBelowFreqBuf = new Int32Array(numTriggers);
    const topTrapFreqBuf = new Int32Array(numTriggers);
    const prevTrapFlagsBuf = new Uint8Array(numTriggers);
    const focusTrapFlagsBuf = new Uint8Array(numTriggers);

    const recomputeTargeting = (targetTrapIdx: number = 0) => {
      targetingDirty = false;
      const trapList: { idx: number; score: number }[] = [];
      const targetList: { idx: number; score: number }[] = [];
      for (let i = 0; i < numMatches; i++) {
        if (isTarget[i] === 0) {
          trapList.push({ idx: i, score: matchScores[i] });
        } else {
          targetList.push({ idx: i, score: matchScores[i] });
        }
      }
      if (trapList.length === 0) {
        targetDownIds = emptyInt16 as unknown as Int32Array;
        targetUpIds = emptyInt16 as unknown as Int32Array;
        sharedTrapBundleIds = emptyInt16 as unknown as Int32Array;
        sharedWinnerBundleIds = emptyInt16 as unknown as Int32Array;
        return;
      }
      trapList.sort((a, b) => b.score - a.score);
      targetList.sort((a, b) => b.score - a.score);

      const focusIdx = Math.min(trapList.length - 1, Math.max(0, targetTrapIdx));
      const focusTrap = trapList[focusIdx];
      const focusScore = focusTrap.score;

      // Identify Intrusive Traps: traps scoring at or above the topNCapacity target cutoff (or top 5 traps)
      const capacityTargetScore = targetList.length > 0
        ? targetList[Math.min(targetList.length - 1, Math.max(0, topNCapacity - 1))].score
        : focusScore;
      let intrusiveTraps = trapList.filter(tr => tr.score >= capacityTargetScore - 5);
      if (intrusiveTraps.length < 2) {
        intrusiveTraps = trapList.slice(0, Math.min(5, trapList.length));
      } else if (intrusiveTraps.length > 8) {
        intrusiveTraps = intrusiveTraps.slice(0, 8);
      }
      const topTraps = intrusiveTraps;
      const numIntrusiveTraps = Math.max(1, topTraps.length);

      const cleanWinners: number[] = [];
      const below: number[] = [];
      for (let i = 0; i < numMatches; i++) {
        if (isTarget[i] === 1) {
          if (matchScores[i] > focusScore) cleanWinners.push(i);
          else below.push(i);
        }
      }
      if (cleanWinners.length === 0 && targetList.length > 0) {
        for (let i = 0; i < Math.min(topNCapacity, targetList.length); i++) {
          cleanWinners.push(targetList[i].idx);
        }
      }
      if (below.length === 0) {
        for (let i = 0; i < numMatches; i++) {
          if (isTarget[i] === 1) below.push(i);
        }
      }
      if (below.length === 0) return;

      below.sort((a, b) => matchScores[b] - matchScores[a]);
      let boundary = below.filter(i => matchScores[i] >= focusScore - 30);
      if (boundary.length < 12) boundary = below.slice(0, Math.min(20, below.length));
      const bLen = Math.max(1, boundary.length);
      const cleanLen = Math.max(1, cleanWinners.length);
      const belowLen = Math.max(1, below.length);
      const trapIdx = focusTrap.idx;

      freqBuf.fill(0);
      cleanWinFreqBuf.fill(0);
      allBelowFreqBuf.fill(0);
      topTrapFreqBuf.fill(0);
      prevTrapFlagsBuf.fill(0);
      focusTrapFlagsBuf.fill(0);
      trapCommonalityScore.fill(0);
      winnerCommonalityScore.fill(0);

      const focusTrigs = matchTriggerIds[trapIdx];
      for (let i = 0; i < focusTrigs.length; i++) focusTrapFlagsBuf[focusTrigs[i]] = 1;

      for (let i = 0; i < boundary.length; i++) {
        const mTrigs = matchTriggerIds[boundary[i]];
        for (let j = 0; j < mTrigs.length; j++) freqBuf[mTrigs[j]]++;
      }

      for (let i = 0; i < cleanWinners.length; i++) {
        const mTrigs = matchTriggerIds[cleanWinners[i]];
        for (let j = 0; j < mTrigs.length; j++) cleanWinFreqBuf[mTrigs[j]]++;
      }

      for (let i = 0; i < below.length; i++) {
        const mTrigs = matchTriggerIds[below[i]];
        for (let j = 0; j < mTrigs.length; j++) allBelowFreqBuf[mTrigs[j]]++;
      }

      for (let i = 0; i < topTraps.length; i++) {
        const mTrigs = matchTriggerIds[topTraps[i].idx];
        for (let j = 0; j < mTrigs.length; j++) topTrapFreqBuf[mTrigs[j]]++;
      }

      if (focusIdx > 0) {
        for (let p = 0; p < focusIdx; p++) {
          const mTrigs = matchTriggerIds[trapList[p].idx];
          for (let j = 0; j < mTrigs.length; j++) prevTrapFlagsBuf[mTrigs[j]] = 1;
        }
      }

      const upScored: { tId: number; gain: number }[] = [];
      const downScored: { tId: number; gain: number }[] = [];
      const sharedTrapCand: { tId: number; score: number }[] = [];
      const sharedWinCand: { tId: number; score: number }[] = [];
      const totalTrapsCount = Math.max(1, numMatches - totalCorrectMatches);
      const totalTargetsCount = Math.max(1, totalCorrectMatches);

      for (let tId = 0; tId < numTriggers; tId++) {
        const liveHits = triggerIndicesArr[tId].length;
        const histHits = histTotalCountsArr[tId];
        if (!isHistoryMode && liveHits < 1 && histHits < 20) continue;

        const curVal = bestPointsArr[tId];
        const maxAllowed = bandMaxArr[tId];
        const minAllowed = bandMinArr[tId];
        const canStepUp = curVal < maxAllowed;
        const canStepDown = curVal > minAllowed;

        const bHits = freqBuf[tId];
        const cleanHits = cleanWinFreqBuf[tId];
        const allBelowHits = allBelowFreqBuf[tId];
        const inFocusTrap = focusTrapFlagsBuf[tId] === 1;
        const topTrapHits = topTrapFreqBuf[tId];
        const tHits = triggerTargetCountsArr[tId];
        const trHits = triggerTrapCountsArr[tId];

        const intrusiveTrapRate = topTrapHits / numIntrusiveTraps;
        const boundaryWinRate = bHits / bLen;
        const cleanWinRate = cleanHits / cleanLen;
        const belowWinRate = allBelowHits / belowLen;
        const overallTargetRate = tHits / totalTargetsCount;
        const overallTrapRate = trHits / totalTrapsCount;

        // 1. Failure Commonality Score: prioritizes triggers shared across >= 2 intrusive/lost traps
        if (topTrapHits > 0 || inFocusTrap) {
          const sharedTrapMultiplier = topTrapHits >= 2 ? (2.8 + topTrapHits * 0.9) : (inFocusTrap ? 1.4 : 1.0);
          const rateEdge = Math.max(0, intrusiveTrapRate - cleanWinRate * 0.65) + Math.max(0, overallTrapRate - overallTargetRate * 0.55);
          let tComm = ((topTrapHits * 14) + (inFocusTrap ? 10 : 0) + (rateEdge * 45) - (boundaryWinRate * 18)) * sharedTrapMultiplier;
          // Suspect False-Bonus Audit: if a trigger carries a positive bonus (> 0) but hits traps more than clean winners
          // (or had weak historical accuracy < baseline - 5%), boost its down-revision priority
          if (curVal > 0 && (intrusiveTrapRate > cleanWinRate || (histHits >= 5 && histTargetAccArr[tId] >= 0 && histTargetAccArr[tId] < histBaselineTargetRate - 0.05))) {
            tComm += 35 + curVal;
          }
          if (tComm > 0) trapCommonalityScore[tId] = tComm;
        }

        // 2. Success Commonality Score: prioritizes triggers shared across >= 2 stranded/clean winners
        if (bHits > 0 || allBelowHits >= 2) {
          const sharedWinMultiplier = bHits >= 2 ? (2.4 + Math.min(6, bHits) * 0.45) : 1.0;
          const rateEdge = Math.max(0, boundaryWinRate - intrusiveTrapRate * 0.85) + Math.max(0, overallTargetRate - overallTrapRate * 0.55);
          let wComm = ((bHits * 12) + (allBelowHits * 2) + (rateEdge * 40) - (topTrapHits * 10)) * sharedWinMultiplier;
          // Suspect False-Penalty Audit: if a trigger carries a negative penalty (< 0) but hits stranded winners
          // and has strong multi-week historical accuracy (>= baseline + 5%), boost its up-revision priority
          if (curVal < 0 && boundaryWinRate > intrusiveTrapRate && histHits >= 5 && histTargetAccArr[tId] >= histBaselineTargetRate + 0.05) {
            wComm += 35 + Math.abs(curVal);
          }
          if (wComm > 0) winnerCommonalityScore[tId] = wComm;
        }

        if (canStepUp) {
          const upGain = winnerCommonalityScore[tId] + (bHits * 4) + (allBelowHits * 1.5) - (inFocusTrap ? 16 : 0) - (topTrapHits * 6);
          if ((bHits > 0 || allBelowHits >= 2) && (!inFocusTrap || (boundaryWinRate >= 0.35 && overallTargetRate > overallTrapRate)) && upGain > 0) {
            upScored.push({ tId, gain: upGain });
            if (bHits >= 2 && topTrapHits === 0) {
              sharedWinCand.push({ tId, score: upGain });
            }
          }
        }

        // Rate-based down-targeting: includes triggers shared across any intrusive trap (not just focusTrap #1)
        // and compares rates instead of raw counts so shared Top-12 failure triggers are never blocked!
        if (canStepDown && (inFocusTrap || topTrapHits >= 2) && !(focusIdx > 0 && prevTrapFlagsBuf[tId] === 1)) {
          const cleanCollateral = cleanWinRate > intrusiveTrapRate * 1.35 && boundaryWinRate > intrusiveTrapRate && topTrapHits < 2;
          const downGain = trapCommonalityScore[tId] + 12 + (topTrapHits * 10) - (bHits * 3) - (belowWinRate * 15) + ((overallTrapRate - overallTargetRate) * 25);
          if (boundaryWinRate <= 0.45 && !cleanCollateral && downGain > 0) {
            downScored.push({ tId, gain: downGain });
            if (topTrapHits >= 2 || (inFocusTrap && boundaryWinRate <= 0.20)) {
              sharedTrapCand.push({ tId, score: downGain });
            }
          }
        }
      }

      upScored.sort((a, b) => b.gain - a.gain);
      downScored.sort((a, b) => b.gain - a.gain);
      sharedTrapCand.sort((a, b) => b.score - a.score);
      sharedWinCand.sort((a, b) => b.score - a.score);
      const upArr = upScored.map(x => x.tId);
      const downArr = downScored.map(x => x.tId);
      sharedTrapBundleIds = new Int32Array(sharedTrapCand.slice(0, 12).map(x => x.tId));
      sharedWinnerBundleIds = new Int32Array(sharedWinCand.slice(0, 12).map(x => x.tId));

      if (downArr.length === 0) {
        for (let i = 0; i < focusTrigs.length; i++) {
          const tId = focusTrigs[i];
          if (bestPointsArr[tId] <= bandMinArr[tId]) continue;
          const liveHits = triggerIndicesArr[tId].length;
          const histHits = histTotalCountsArr[tId];
          if (!isHistoryMode && liveHits < 1 && histHits < 20) continue;
          if (freqBuf[tId] < bLen) downArr.push(tId);
        }
      }
      if (upArr.length === 0) {
        for (let tId = 0; tId < numTriggers; tId++) {
          if (allBelowFreqBuf[tId] <= 0) continue;
          if (bestPointsArr[tId] >= bandMaxArr[tId]) continue;
          const liveHits = triggerIndicesArr[tId].length;
          const histHits = histTotalCountsArr[tId];
          if (!isHistoryMode && liveHits < 1 && histHits < 20) continue;
          if (focusTrapFlagsBuf[tId] === 0) upArr.push(tId);
        }
      }

      targetUpIds = new Int32Array(upArr);
      targetDownIds = new Int32Array(downArr);
      targetUpFlags.fill(0);
      targetDownFlags.fill(0);
      for (let i = 0; i < targetUpIds.length; i++) targetUpFlags[targetUpIds[i]] = 1;
      for (let i = 0; i < targetDownIds.length; i++) targetDownFlags[targetDownIds[i]] = 1;

      const bCand: number[] = [];
      for (let i = 0; i < allWorkingTriggerIds.length; i++) {
        const tId = allWorkingTriggerIds[i];
        const val = bestPointsArr[tId];
        if (val === 5 || val === -5 || (val > -15 && val < 15 && val !== 0)) {
          bCand.push(tId);
        }
      }
      cachedBoundaryCandidateIds = new Int32Array(bCand);
    };

    // Plateau escape & elite (best-ever) state with restart
    const LIVE_PLATEAU_EPS = 25;
    const LIVE_RESTART_AFTER = 4000;
    let liveStallCount = 0;
    let eliteEval = bestFastEval;
    const elitePointsArr = new Int16Array(bestPointsArr);
    const eliteScores = new Int16Array(matchScores);
    const snapshotElite = () => {
      eliteEval = bestFastEval;
      elitePointsArr.set(bestPointsArr);
      eliteScores.set(matchScores);
    };
    const restoreElite = () => {
      matchScores.set(eliteScores);
      targetBuckets.fill(0);
      trapBuckets.fill(0);
      maxActiveBucket = 0;
      minActiveBucket = BUCKET_COUNT - 1;
      for (let i = 0; i < numMatches; i++) {
        const b = matchScores[i] + SCORE_OFFSET;
        if (b > maxActiveBucket) maxActiveBucket = b;
        if (b < minActiveBucket) minActiveBucket = b;
        if (isTarget[i] === 1) targetBuckets[b]++;
        else trapBuckets[b]++;
      }
      if (minActiveBucket > maxActiveBucket) minActiveBucket = 0;
      bestPointsArr.set(elitePointsArr);
      runningRegSum = 0;
      for (let tId = 0; tId < numTriggers; tId++) {
        runningRegSum += getNormReg(bestPointsArr[tId]);
      }
      bestFastEval = eliteEval;
      targetingDirty = true;
    };

    // Diagnostics: coverage + simple pairwise infeasibility check within reachable bands
    const goalN = Math.max(1, Math.min(activeCategoryConfig.targetCapacity, totalCorrectMatches));
    const targetIdxs: number[] = [];
    const trapIdxs: number[] = [];
    for (let i = 0; i < numMatches; i++) (isTarget[i] === 1 ? targetIdxs : trapIdxs).push(i);
    const droppedNoOdds = Math.max(0, completedMatches.length - profiles.length);

    setDeepDiagnostics({
      seen: profiles.length,
      expected: completedMatches.length,
      targetsSeen: totalCorrectMatches,
      droppedNoOdds,
      goalN,
      infeasible: []
    });

    if (totalCorrectMatches > 0 && trapIdxs.length * targetIdxs.length <= 60000) {
      setTimeout(() => {
        try {
          const deferredInfeasible: { teams: string; separable: number; triggers: string[] }[] = [];
          for (const tr of trapIdxs) {
            const trSet = profiles[tr].triggersHit;
            let separable = 0;
            for (const tg of targetIdxs) {
              const tgSet = profiles[tg].triggersHit;
              let maxDiff = profiles[tg].baseScore - profiles[tr].baseScore;
              tgSet.forEach(t => {
                const tId = triggerIdByName.get(t);
                if (!trSet.has(t) && tId !== undefined) maxDiff += bandMaxArr[tId];
              });
              trSet.forEach(t => {
                const tId = triggerIdByName.get(t);
                if (!tgSet.has(t) && tId !== undefined) maxDiff -= bandMinArr[tId];
              });
              if (maxDiff > 0) separable++;
            }
            if (separable < goalN) {
              const distinguishing = Array.from(trSet)
                .filter(t => triggerIdByName.has(t))
                .map(t => {
                  const tId = triggerIdByName.get(t)!;
                  return { t, f: targetIdxs.length > 0 ? triggerTargetCountsArr[tId] / targetIdxs.length : 0 };
                })
                .sort((a, b) => a.f - b.f)
                .slice(0, 4)
                .map(x => `${x.t} (${Math.round(x.f * 100)}% of targets)`);
              deferredInfeasible.push({ teams: profiles[tr].teams, separable, triggers: distinguishing });
            }
          }
          deferredInfeasible.sort((a, b) => a.separable - b.separable);
          setDeepDiagnostics(prev => prev ? { ...prev, infeasible: deferredInfeasible } : null);
        } catch (e) {}
      }, 100);
    }

    let currentGroupIndex = 0;
    let compsInCurrentGroup = 0;
    const COMPS_PER_GROUP = 3000;

    // Multi-Phase Sequential Trap Dispersion Optimizer State
    let currentPhase: 1 | 2 | 3 | 4 | 5 = 1;
    let phaseComps = 0;
    const PHASE_1_STALEMATE_BUDGET = 250000;
    const SUBSEQUENT_PHASE_BUDGET = 300000;
    const GAP_PHASE_PATIENCE = 100000;
    let staleCleanComps = 0;
    let compsSinceCleanClimb = 0;
    let compsSinceGapImprovement = 0;
    let bestGapInPhase = 0;
    let bestTrapRankInPhase = 0;
    let inIlsKick = false;
    let ilsKickComps = 0;
    let lastSweepComp = 0;
    let lastTargetingComp = 0;
    let cleanStreakClimbedSinceLastMapUpdate = false;
    const establishedRanks: number[] = [];
    const establishedScores: number[] = [];
    let bestTrapRanks: number[] = bestFastEval.trapRanks ? [...bestFastEval.trapRanks] : [bestFastEval.cleanTopMatches + 1];
    let bestTrapGaps: number[] = bestFastEval.trapGaps ? [...bestFastEval.trapGaps] : [bestFastEval.cleanTopMatches];
    let compsInPhaseMilestone = 0;
    let lastDetailUpdate = 0;

    // Strict All-Time Best Peak Ratchet: First trap rank must NEVER regress from peak
    const peakPointsArr = new Int16Array(bestPointsArr);
    let allTimeBestPeak = {
      cleanTopMatches: bestFastEval.cleanTopMatches,
      firstTrapRank: bestFastEval.firstTrapRank ?? (bestFastEval.cleanTopMatches + 1),
      quality: bestFastEval.quality,
      scores: new Int16Array(matchScores),
      trapRanks: bestFastEval.trapRanks ? [...bestFastEval.trapRanks] : [bestFastEval.cleanTopMatches + 1],
      trapScores: bestFastEval.trapScores ? [...bestFastEval.trapScores] : [],
      trapGaps: bestFastEval.trapGaps ? [...bestFastEval.trapGaps] : [bestFastEval.cleanTopMatches],
      fastEval: bestFastEval,
      establishedRanks: [...establishedRanks]
    };
    allTimeBestPeakRef.current = {
      category: activeCategory,
      cleanTopMatches: allTimeBestPeak.cleanTopMatches,
      firstTrapRank: allTimeBestPeak.firstTrapRank,
      quality: allTimeBestPeak.quality,
      points: buildPointsMapFromArr(peakPointsArr),
      trapRanks: [...allTimeBestPeak.trapRanks],
      trapGaps: [...allTimeBestPeak.trapGaps]
    };

    const snapshotAllTimeBest = (_evalResult: FastEvalSnapshot) => {
      recomputeScoresAndBucketsFrom(bestPointsArr);
      const verifiedEval = cloneEvalSnapshot(fastEvaluateBuckets(targetBuckets, trapBuckets, runningRegSum));
      bestFastEval = verifiedEval;
      const vR1 = verifiedEval.firstTrapRank ?? (verifiedEval.cleanTopMatches + 1);
      if (verifiedEval.cleanTopMatches < allTimeBestPeak.cleanTopMatches ||
          (verifiedEval.cleanTopMatches === allTimeBestPeak.cleanTopMatches && vR1 < allTimeBestPeak.firstTrapRank)) {
        return;
      }
      peakPointsArr.set(bestPointsArr);
      allTimeBestPeak.cleanTopMatches = verifiedEval.cleanTopMatches;
      allTimeBestPeak.firstTrapRank = vR1;
      allTimeBestPeak.quality = verifiedEval.quality;
      allTimeBestPeak.scores.set(matchScores);
      allTimeBestPeak.trapRanks = verifiedEval.trapRanks ? [...verifiedEval.trapRanks] : [verifiedEval.cleanTopMatches + 1];
      allTimeBestPeak.trapScores = verifiedEval.trapScores ? [...verifiedEval.trapScores] : [];
      allTimeBestPeak.trapGaps = verifiedEval.trapGaps ? [...verifiedEval.trapGaps] : [verifiedEval.cleanTopMatches];
      allTimeBestPeak.fastEval = verifiedEval;
      allTimeBestPeak.establishedRanks = [...establishedRanks];
    };

    const syncPeakRefPoints = () => {
      const ptsMap = buildPointsMapFromArr(peakPointsArr);
      allTimeBestPeakRef.current = {
        category: activeCategory,
        cleanTopMatches: allTimeBestPeak.cleanTopMatches,
        firstTrapRank: allTimeBestPeak.firstTrapRank,
        quality: allTimeBestPeak.quality,
        points: ptsMap,
        trapRanks: [...allTimeBestPeak.trapRanks],
        trapGaps: [...allTimeBestPeak.trapGaps]
      };
      return ptsMap;
    };

    const restoreAllTimeBest = () => {
      bestPointsArr.set(peakPointsArr);
      recomputeScoresAndBucketsFrom(bestPointsArr);
      bestFastEval = cloneEvalSnapshot(fastEvaluateBuckets(targetBuckets, trapBuckets, runningRegSum));
      allTimeBestPeak.scores.set(matchScores);
      allTimeBestPeak.fastEval = bestFastEval;
      bestCleanStreak = allTimeBestPeak.cleanTopMatches;
      if (allTimeBestPeak.trapRanks) bestTrapRanks = [...allTimeBestPeak.trapRanks];
      if (allTimeBestPeak.trapGaps) bestTrapGaps = [...allTimeBestPeak.trapGaps];
      if (allTimeBestPeak.establishedRanks && allTimeBestPeak.establishedRanks.length > 0) {
        for (let i = 0; i < allTimeBestPeak.establishedRanks.length; i++) {
          establishedRanks[i] = allTimeBestPeak.establishedRanks[i];
        }
      }
      targetingDirty = true;
    };

    const optStartTime = Date.now();
    let lastUiUpdate = Date.now();
    const updateUiState = (force: boolean = false) => {
      const now = Date.now();
      if (!force && now - lastUiUpdate < 250) return;
      lastUiUpdate = now;

      const elapsed = Math.max(1, now - optStartTime);
      const rate = Math.round((totalComps / elapsed) * 1000);
      setDeepElapsedMs(elapsed);
      setDeepEvalRate(rate);

      setDeepComputations(totalComps);
      setDeepPurityPct(bestFastEval.purityPct);
      setDeepInversions(Math.max(0, (numMatches - totalCorrectMatches) - bestFastEval.cleanTopMatches));
      setDeepBufferMargin(bestFastEval.bufferMargin);
      setDeepQuality(bestFastEval.quality);
      setDeepCleanMatches(bestFastEval.cleanTopMatches);
      setDeepTargetClean(horizons.floor);
      setDeepTargetCeiling(horizons.ceiling);
      setDeepFirstTrapRank(bestFastEval.firstTrapRank);
      setDeepTiedAtBoundary(bestFastEval.tiedAtBoundary ?? 0);
      setDeepTargetsInTop5000(bestFastEval.targetsInTop5000);
      if (bestFastEval.horizonMetrics) setDeepHorizonMetrics(bestFastEval.horizonMetrics);
      setDeepConvergenceMode(bestFastEval.ceilingMet ? 'perfect_100' : bestFastEval.floorMet ? 'sweet_spot' : 'none');

      // Keep allTimeBestPeakRef synchronized on 250ms UI ticks so Pause/Apply always has the latest peak Map
      const ptsCopy = syncPeakRefPoints();

      let shouldUpdateMaps = force;
      if (!shouldUpdateMaps && cleanStreakClimbedSinceLastMapUpdate && (now - lastDetailUpdate > 500)) {
        shouldUpdateMaps = true;
      }
      if (shouldUpdateMaps) {
        lastDetailUpdate = now;
        cleanStreakClimbedSinceLastMapUpdate = false;
        const effectiveDay = selectedDay !== 'all' ? selectedDay : datasetDay;
        deepPointsCategoryRef.current = activeCategory;
        setDeepPointsMap(ptsCopy);
        deepCategoryPointsMapRef.current[`${effectiveDay}_${activeCategory}`] = ptsCopy;
        deepCategoryPointsMapRef.current[`${datasetDay}_${activeCategory}`] = ptsCopy;
        setDeepCategoryPointsMap(prev => ({
          ...prev,
          [`${effectiveDay}_${activeCategory}`]: ptsCopy,
          [`${datasetDay}_${activeCategory}`]: ptsCopy
        }));
      }

      if (bestFastEval.trapRanks && bestFastEval.trapRanks.length > 0) {
        setDeepTrapRanks(bestFastEval.trapRanks);
        setDeepTrapScores(bestFastEval.trapScores || []);
        setDeepTrapGaps(bestFastEval.trapGaps || []);
        if (bestFastEval.trapDispersionHealth) {
          setDeepTrapDispersionHealth(bestFastEval.trapDispersionHealth);
        }
      }

      setDeepOptimizerPhase({
        currentPhase,
        phaseComps,
        phaseBudget: currentPhase === 1 ? PHASE_1_STALEMATE_BUDGET : SUBSEQUENT_PHASE_BUDGET,
        establishedRanks: [...establishedRanks],
        establishedScores: [...establishedScores]
      });
    };

    const finalizeLive = () => {
      const peakCleanBeforeAudit = allTimeBestPeak.cleanTopMatches;
      const peakTrapRankBeforeAudit = allTimeBestPeak.firstTrapRank;
      const savedPeakArrBeforeAudit = new Int16Array(peakPointsArr);
      restoreAllTimeBest();
      try {
        undoLen = 0;
        const activeAuditIds = allWorkingTriggerIds.filter(tId => triggerIndicesArr[tId].length > 0);
        runContributionAudit(activeAuditIds, performance.now() - MAX_FRAME_MS + 12);
      } catch (e) {}
      // Hard guarantee: never allow audit to reduce peak clean match count or first trap rank
      recomputeScoresAndBucketsFrom(peakPointsArr);
      const postAuditEval = fastEvaluateBuckets(targetBuckets, trapBuckets, runningRegSum);
      if (postAuditEval.cleanTopMatches < peakCleanBeforeAudit || postAuditEval.firstTrapRank < peakTrapRankBeforeAudit) {
        peakPointsArr.set(savedPeakArrBeforeAudit);
      }
      restoreAllTimeBest();
      updateUiState(true);

      try {
        const peakPts = syncPeakRefPoints();

        adoptCalibratedRulesPermanently(
          peakPts,
          allTimeBestPeak.cleanTopMatches,
          allTimeBestPeak.firstTrapRank,
          allTimeBestPeak.quality,
          allTimeBestPeak.trapRanks,
          allTimeBestPeak.trapGaps
        );
      } catch (e) {
        console.warn('[finalizeLive] Auto-adopt error:', e);
      }
    };

    const MAX_FRAME_MS = 8; // 8ms slice per frame guarantees >8ms browser headroom for 60fps scrolling

    // Deterministic Incremental Breakthrough Sweep (nearest-first ±5 / ±10 across all boundary winners & triggers)
    const sweepFlagsBuf = new Uint8Array(numTriggers);
    const wFlagsBuf = new Uint8Array(numTriggers);
    const runBreakthroughSweep = (topTrapMatchIdx: number, frameStart: number) => {
      if (topTrapMatchIdx < 0 || performance.now() - frameStart >= MAX_FRAME_MS) return;
      const trapScore = matchScores[topTrapMatchIdx];
      const strandedWinners: { idx: number; score: number }[] = [];
      for (let i = 0; i < numMatches; i++) {
        if (isTarget[i] === 1 && matchScores[i] <= trapScore) {
          strandedWinners.push({ idx: i, score: matchScores[i] });
        }
      }
      if (strandedWinners.length === 0) return;
      strandedWinners.sort((a, b) => b.score - a.score);
      const topWinners = strandedWinners.slice(0, Math.min(12, strandedWinners.length));

      focusTrapFlagsBuf.fill(0);
      sweepFlagsBuf.fill(0);
      const trapTrigs = matchTriggerIds[topTrapMatchIdx];
      for (let i = 0; i < trapTrigs.length; i++) focusTrapFlagsBuf[trapTrigs[i]] = 1;

      const sweepTriggerIds: number[] = [];
      for (let wIdx = 0; wIdx < topWinners.length; wIdx++) {
        const wTrigs = matchTriggerIds[topWinners[wIdx].idx];
        wFlagsBuf.fill(0);
        for (let i = 0; i < wTrigs.length; i++) {
          const tId = wTrigs[i];
          wFlagsBuf[tId] = 1;
          if (focusTrapFlagsBuf[tId] === 0 && sweepFlagsBuf[tId] === 0) {
            sweepFlagsBuf[tId] = 1;
            sweepTriggerIds.push(tId);
          }
        }
        for (let i = 0; i < trapTrigs.length; i++) {
          const tId = trapTrigs[i];
          if (wFlagsBuf[tId] === 0 && sweepFlagsBuf[tId] === 0) {
            sweepFlagsBuf[tId] = 1;
            sweepTriggerIds.push(tId);
          }
        }
      }

      // Order sweepTriggerIds by Failure + Success Commonality Score (with slight jitter) so root-cause triggers are swept first
      sweepTriggerIds.sort((a, b) => {
        const sA = trapCommonalityScore[a] + winnerCommonalityScore[a] + triggerImpactMomentum[a] * 0.5 + Math.random() * 4;
        const sB = trapCommonalityScore[b] + winnerCommonalityScore[b] + triggerImpactMomentum[b] * 0.5 + Math.random() * 4;
        return sB - sA;
      });

      const sweepLimit = sweepTriggerIds.length;
      for (let sIdx = 0; sIdx < sweepLimit; sIdx++) {
        if (performance.now() - frameStart >= MAX_FRAME_MS) break;
        const tId = sweepTriggerIds[sIdx];
        const indices = triggerIndicesArr[tId];
        if (!indices || indices.length === 0) continue;
        const currentVal = bestPointsArr[tId];
        const slot = tId * PTS_SPAN + Math.max(0, Math.min(80, currentVal + PTS_OFFSET));
        const isLayer2Sweep = totalComps >= LAYER_1_INCREMENTAL_COMPS;
        const bandValues = isLayer2Sweep
          ? (escalateAnyTable[slot].length > 0 ? escalateAnyTable[slot] : stretchAnyTable[slot])
          : ((staleCleanComps >= 15000 || inIlsKick) ? stretchAnyTable[slot] : stepAnyTable[slot]);

        let bestStepVal = currentVal;
        let bestStepClimbed = false;
        let bestStepQuality = bestFastEval.quality;
        let bestStepSnap: FastEvalSnapshot | null = null;
        let bestStepRegSum = runningRegSum;

        for (let bIdx = 0; bIdx < bandValues.length; bIdx++) {
          if (performance.now() - frameStart >= MAX_FRAME_MS) break;
          const testVal = bandValues[bIdx];
          const delta = testVal - currentVal;
          bestPointsArr[tId] = testVal;
          const testRegSum = runningRegSum + (getNormReg(testVal) - getNormReg(currentVal));
          const sweepMark = undoLen;
          applyDelta(indices, delta);
          totalComps++;
          phaseComps++;

          const evalRes = fastEvaluateBuckets(targetBuckets, trapBuckets, testRegSum);
          let violated = false;
          const r1 = evalRes.firstTrapRank;
          if (r1 < allTimeBestPeak.firstTrapRank || evalRes.cleanTopMatches < allTimeBestPeak.cleanTopMatches) {
            violated = true;
          } else if (currentPhase >= 2 && establishedRanks.length > 0) {
            for (let k = 0; k < establishedRanks.length; k++) {
              const curR = k < trapRanksCount ? trapRanksBuf[k] : (evalRes.cleanTopMatches + 1);
              if (curR < establishedRanks[k]) {
                violated = true;
                break;
              }
            }
          }

          const climbed = !violated && evalRes.cleanTopMatches > bestCleanStreak;
          const maintainedAndBetter = !violated && evalRes.cleanTopMatches >= bestCleanStreak && evalRes.quality > bestStepQuality;

          if ((climbed && (!bestStepClimbed || evalRes.quality > bestStepQuality)) || (!bestStepClimbed && maintainedAndBetter)) {
            bestStepVal = testVal;
            bestStepClimbed = climbed;
            bestStepQuality = evalRes.quality;
            bestStepSnap = cloneEvalSnapshot(evalRes);
            bestStepRegSum = testRegSum;
          }
          bestPointsArr[tId] = currentVal;
          rollbackTo(sweepMark);
        }

        if (bestStepSnap && bestStepVal !== currentVal) {
          const delta = bestStepVal - currentVal;
          bestPointsArr[tId] = bestStepVal;
          applyDelta(indices, delta);
          undoLen = 0;
          runningRegSum = bestStepRegSum;
          targetingDirty = true;
          frontierDirty = true;
          bestFastEval = bestStepSnap;
          bestTrapRanks = [...bestStepSnap.trapRanks];
          bestTrapGaps = [...bestStepSnap.trapGaps];
          if (bestStepClimbed) {
            bestCleanStreak = bestStepSnap.cleanTopMatches;
            compsSinceCleanClimb = 0;
            staleCleanComps = 0;
            cleanStreakClimbedSinceLastMapUpdate = true;
            if (currentPhase > 1) {
              currentPhase = 1;
              phaseComps = 0;
              establishedRanks.length = 0;
              establishedScores.length = 0;
              showToast(`Breakthrough! Clean matches increased to ${bestStepSnap.cleanTopMatches}! Returning to Clean Maximization.`);
            }
          }
          const r1 = bestStepSnap.firstTrapRank;
          if (bestStepSnap.cleanTopMatches > allTimeBestPeak.cleanTopMatches ||
              (bestStepSnap.cleanTopMatches === allTimeBestPeak.cleanTopMatches && r1 > allTimeBestPeak.firstTrapRank) ||
              (bestStepSnap.cleanTopMatches === allTimeBestPeak.cleanTopMatches && r1 === allTimeBestPeak.firstTrapRank && bestStepSnap.quality > allTimeBestPeak.quality)) {
            snapshotAllTimeBest(bestStepSnap);
          }
        }
      }
    };

    // Per-Trigger Marginal Contribution & Free-Rider Pruning Pass:
    // 1. Preserves pre-compute saved weights (savedInitialPointsArr) so proven cross-week drivers are never eroded.
    // 2. For newly inflated weights during the current run, steps 5 points back toward savedInitialPointsArr;
    //    only keeps the step-back if cleanTopMatches, firstTrapRank, trapInTopN, and tiedAtBoundary are 100% preserved.
    const runContributionAudit = (triggerList: number[], frameStart: number) => {
      if (inIlsKick || triggerList.length === 0) return;
      for (let i = 0; i < triggerList.length; i++) {
        if (performance.now() - frameStart >= MAX_FRAME_MS) break;
        const tId = triggerList[i];
        const indices = triggerIndicesArr[tId];
        if (!indices || indices.length === 0) continue;
        const curVal = bestPointsArr[tId];
        const savedVal = savedInitialPointsArr[tId];
        if (curVal === savedVal || (curVal >= -5 && curVal <= 5)) continue;

        let stepBackVal = curVal > savedVal ? curVal - 5 : curVal + 5;
        if (stepBackVal === 0 && !(isUpsetsCat && profilesByTrigId[tId]?.zeroEligible)) {
          stepBackVal = curVal > savedVal ? -5 : 5;
        }
        const band = profilesByTrigId[tId]?.allowedBand;
        if (!band || !band.includes(stepBackVal)) continue;

        const delta = stepBackVal - curVal;
        bestPointsArr[tId] = stepBackVal;
        const testRegSum = runningRegSum + (getNormReg(stepBackVal) - getNormReg(curVal));
        const auditMark = undoLen;
        applyDelta(indices, delta);
        totalComps++;

        const evalRes = fastEvaluateBuckets(targetBuckets, trapBuckets, testRegSum);
        let violated = false;
        const r1 = evalRes.firstTrapRank;
        if (r1 < allTimeBestPeak.firstTrapRank || evalRes.cleanTopMatches < allTimeBestPeak.cleanTopMatches) {
          violated = true;
        } else if (currentPhase >= 2 && establishedRanks.length > 0) {
          for (let k = 0; k < establishedRanks.length; k++) {
            const curR = k < trapRanksCount ? trapRanksBuf[k] : (evalRes.cleanTopMatches + 1);
            if (curR < establishedRanks[k]) {
              violated = true;
              break;
            }
          }
        }

        const isFalseRiderInflation =
          (curVal > savedVal && curVal > 0 && triggerTrapCountsArr[tId] >= triggerTargetCountsArr[tId]) ||
          (curVal < savedVal && curVal < 0 && triggerTargetCountsArr[tId] > triggerTrapCountsArr[tId] * 2);

        const separationPreserved = !violated &&
          evalRes.cleanTopMatches >= bestFastEval.cleanTopMatches &&
          evalRes.firstTrapRank >= bestFastEval.firstTrapRank &&
          evalRes.trapInTopN <= bestFastEval.trapInTopN &&
          (evalRes.tiedAtBoundary ?? 0) <= (bestFastEval.tiedAtBoundary ?? 0) &&
          evalRes.positiveTraps <= bestFastEval.positiveTraps &&
          (isFalseRiderInflation || (
            evalRes.targetOverTrapPairs >= bestFastEval.targetOverTrapPairs &&
            evalRes.positiveTargets >= bestFastEval.positiveTargets
          ));

        if (separationPreserved) {
          undoLen = 0;
          const snap = cloneEvalSnapshot(evalRes);
          runningRegSum = testRegSum;
          bestFastEval = snap;
          bestTrapRanks = [...snap.trapRanks];
          bestTrapGaps = [...snap.trapGaps];
          targetingDirty = true;
          frontierDirty = true;
          if (snap.cleanTopMatches >= allTimeBestPeak.cleanTopMatches && r1 >= allTimeBestPeak.firstTrapRank) {
            snapshotAllTimeBest(snap);
            snapshotElite();
          }
        } else {
          bestPointsArr[tId] = curVal;
          rollbackTo(auditMark);
        }
      }
    };

    // Cached frontier state across inner iterations (integer-indexed)
    let cachedTopTrapIndices: number[] = [];
    let cachedFrameWinOnlyIds = new Int32Array(0);
    let cachedFrameTrapOnlyIds = new Int32Array(0);
    let cachedActiveTrapMatchIdx = -1;
    let cachedFrontierPhase = -1;
    let frontierDirty = true;

    const refreshFrontierIfNeeded = () => {
      if (!frontierDirty && !targetingDirty && cachedFrontierPhase === currentPhase) return;
      frontierDirty = false;
      cachedFrontierPhase = currentPhase;
      cachedTopTrapIndices = [];
      for (let i = 0; i < numMatches; i++) {
        if (isTarget[i] === 0) {
          if (cachedTopTrapIndices.length < 5) {
            cachedTopTrapIndices.push(i);
            cachedTopTrapIndices.sort((a, b) => matchScores[b] - matchScores[a]);
          } else if (matchScores[i] > matchScores[cachedTopTrapIndices[4]]) {
            cachedTopTrapIndices[4] = i;
            cachedTopTrapIndices.sort((a, b) => matchScores[b] - matchScores[a]);
          }
        }
      }
      const frameMaxTrapIdx = cachedTopTrapIndices.length > 0 ? cachedTopTrapIndices[0] : -1;
      const targetTrapIdxInPhase = currentPhase === 1 ? 0 : Math.min(currentPhase - 1, cachedTopTrapIndices.length - 1);
      cachedActiveTrapMatchIdx = cachedTopTrapIndices.length > 0 ? cachedTopTrapIndices[targetTrapIdxInPhase] : frameMaxTrapIdx;

      const winOnlyList: number[] = [];
      const trapOnlyList: number[] = [];
      if (cachedActiveTrapMatchIdx >= 0) {
        const activeTrapScore = matchScores[cachedActiveTrapMatchIdx];
        const frontierWinners: number[] = [];
        for (let i = 0; i < numMatches; i++) {
          if (isTarget[i] === 1 && matchScores[i] <= activeTrapScore) {
            frontierWinners.push(i);
          }
        }
        frontierWinners.sort((a, b) => matchScores[b] - matchScores[a]);
        const selectedWinners = frontierWinners.slice(0, Math.min(10, frontierWinners.length));
        const selectedTraps = cachedTopTrapIndices.slice(0, Math.min(3, cachedTopTrapIndices.length));

        if (selectedWinners.length > 0) {
          wFlagsBuf.fill(0);
          focusTrapFlagsBuf.fill(0);
          for (let w = 0; w < selectedWinners.length; w++) {
            const winTrigs = matchTriggerIds[selectedWinners[w]];
            for (let i = 0; i < winTrigs.length; i++) wFlagsBuf[winTrigs[i]]++;
          }
          for (let tr = 0; tr < selectedTraps.length; tr++) {
            const trapTrigs = matchTriggerIds[selectedTraps[tr]];
            for (let i = 0; i < trapTrigs.length; i++) focusTrapFlagsBuf[trapTrigs[i]]++;
          }

          for (let i = 0; i < allWorkingTriggerIds.length; i++) {
            const tId = allWorkingTriggerIds[i];
            const wCount = wFlagsBuf[tId];
            const trCount = focusTrapFlagsBuf[tId];
            if (wCount > 0 && wCount > trCount && bestPointsArr[tId] < bandMaxArr[tId]) {
              winOnlyList.push(tId);
            }
            if (trCount > 0 && trCount >= wCount && bestPointsArr[tId] > bandMinArr[tId]) {
              trapOnlyList.push(tId);
            }
          }
          winOnlyList.sort((a, b) => (winnerCommonalityScore[b] + wFlagsBuf[b] * 8) - (winnerCommonalityScore[a] + wFlagsBuf[a] * 8));
          trapOnlyList.sort((a, b) => (trapCommonalityScore[b] + focusTrapFlagsBuf[b] * 10) - (trapCommonalityScore[a] + focusTrapFlagsBuf[a] * 10));
        }
      }
      cachedFrameWinOnlyIds = new Int32Array(winOnlyList);
      cachedFrameTrapOnlyIds = new Int32Array(trapOnlyList);
    };

    // Preallocated mutation buffers for zero-allocation inner loop
    const mutTrigIds = new Int32Array(4);
    const mutOldVals = new Int16Array(4);
    const mutNewVals = new Int16Array(4);
    const mutDeltas = new Int16Array(4);
    const rebTrigIds = new Int32Array(4);
    const rebOldVals = new Int16Array(4);
    const rebNewVals = new Int16Array(4);
    const rebDeltas = new Int16Array(4);
    const defaultPoolIds = new Int32Array(
      eligibleTriggerIds.length > 0
        ? eligibleTriggerIds
        : (isHistoryMode ? allTriggerIds : activeTriggerIds)
    );
    const broadPoolIds = new Int32Array(broadDriverTriggerIds);
    const allWorkingPoolIds = new Int32Array(allWorkingTriggerIds);

    // Rank-weighted picker: favors top-ranked commonality triggers 4x-6x over tail triggers
    const pickRankWeighted = (pool: Int32Array): number => {
      if (pool.length <= 1) return pool[0] ?? -1;
      const r = Math.random();
      const idx = (r * r * pool.length) | 0;
      return pool[idx < pool.length ? idx : pool.length - 1];
    };

    // Systematic Priority-Ordered Epoch State (every active trigger participates, root-cause commonalities go first)
    const epochTriggerIds: number[] = allWorkingTriggerIds.filter(tId => triggerIndicesArr[tId].length > 0);
    if (epochTriggerIds.length === 0) epochTriggerIds.push(...allWorkingTriggerIds);
    const shuffleEpochTriggers = () => {
      epochTriggerIds.sort((a, b) => {
        const prioA = (trapCommonalityScore[a] + winnerCommonalityScore[a] + triggerImpactMomentum[a] + 5) * (0.80 + Math.random() * 0.40);
        const prioB = (trapCommonalityScore[b] + winnerCommonalityScore[b] + triggerImpactMomentum[b] + 5) * (0.80 + Math.random() * 0.40);
        return prioB - prioA;
      });
    };
    recomputeTargeting(0);
    shuffleEpochTriggers();
    let epochCursor = 0;
    let auditPending = false;

    // Run in high-throughput sliced asynchronous chunks with adaptive time-budgeting (~8ms/frame)
    const runChunk = () => {
      try {
        if (stopDeepRef.current) {
          finalizeLive();
          setIsDeepOptimizing(false);
          setDeepStatus('paused');
          return;
        }

        const frameStart = performance.now();
        const BATCH_INNER = 512;

        frameLoop: while (performance.now() - frameStart < MAX_FRAME_MS) {
          refreshFrontierIfNeeded();
          const frameWinOnly = cachedFrameWinOnlyIds;
          const frameTrapOnly = cachedFrameTrapOnlyIds;
          const activeTrapMatchIdx = cachedActiveTrapMatchIdx;

          // Marginal Step-Back Proof Pass at the end of each full trigger epoch
          if (auditPending) {
            auditPending = false;
            undoLen = 0;
            runContributionAudit(epochTriggerIds, frameStart);
            refreshFrontierIfNeeded();
          }

          // Deterministic Breakthrough Sweep (runs periodically or when stalled to unlock stranded winners)
          if (activeTrapMatchIdx >= 0 && (totalComps - lastSweepComp >= 2000 || (staleCleanComps > 0 && staleCleanComps % 1500 === 0))) {
            undoLen = 0;
            runBreakthroughSweep(activeTrapMatchIdx, frameStart);
            lastSweepComp = totalComps;
            refreshFrontierIfNeeded();
          }

          // Iterated Local Search (ILS) Kick when stalled in Phase 1 (strictly incremental ±5 perturbations across diverse triggers)
          if (currentPhase === 1 && !inIlsKick && staleCleanComps >= 20000 && staleCleanComps % 20000 === 0) {
            inIlsKick = true;
            ilsKickComps = 0;
            const uniqueCand: number[] = [];
            sweepFlagsBuf.fill(0);
            for (let i = 0; i < frameWinOnly.length; i++) {
              const tId = frameWinOnly[i];
              if (sweepFlagsBuf[tId] === 0) { sweepFlagsBuf[tId] = 1; uniqueCand.push(tId); }
            }
            for (let i = 0; i < frameTrapOnly.length; i++) {
              const tId = frameTrapOnly[i];
              if (sweepFlagsBuf[tId] === 0) { sweepFlagsBuf[tId] = 1; uniqueCand.push(tId); }
            }
            for (let i = 0; i < Math.min(6, epochTriggerIds.length); i++) {
              const tId = epochTriggerIds[(epochCursor + i) % epochTriggerIds.length];
              if (sweepFlagsBuf[tId] === 0) { sweepFlagsBuf[tId] = 1; uniqueCand.push(tId); }
            }
            if (uniqueCand.length >= 2) {
              const numToPerturb = Math.min(uniqueCand.length, ((Math.random() * 3) | 0) + 2);
              for (let p = 0; p < numToPerturb; p++) {
                const tId = uniqueCand[(Math.random() * uniqueCand.length) | 0];
                const curVal = bestPointsArr[tId];
                const slot = tId * PTS_SPAN + Math.max(0, Math.min(80, curVal + PTS_OFFSET));
                const validSteps = stepAnyTable[slot];
                if (validSteps.length > 0) {
                  const newVal = validSteps[(Math.random() * validSteps.length) | 0];
                  const delta = newVal - curVal;
                  const ind = triggerIndicesArr[tId];
                  bestPointsArr[tId] = newVal;
                  runningRegSum += getNormReg(newVal) - getNormReg(curVal);
                  if (ind.length > 0) applyDelta(ind, delta);
                }
              }
              undoLen = 0;
              bestFastEval = cloneEvalSnapshot(fastEvaluateBuckets(targetBuckets, trapBuckets, runningRegSum));
              targetingDirty = true;
              frontierDirty = true;
            }
          }

          for (let sub = 0; sub < BATCH_INNER; sub++) {
            // Check frame budget every 32 iterations for zero-overhead 60fps slicing
            if ((sub & 31) === 0 && performance.now() - frameStart >= MAX_FRAME_MS) {
              break frameLoop;
            }

            // Group Rotation
            compsInCurrentGroup++;
            if (compsInCurrentGroup >= COMPS_PER_GROUP) {
              compsInCurrentGroup = 0;
              currentGroupIndex = (currentGroupIndex + 1) % triggerGroupsIds.length;
              if (currentGroupIndex === 0) {
                for (let i = allWorkingTriggerIds.length - 1; i > 0; i--) {
                  const j = (Math.random() * (i + 1)) | 0;
                  const tmp = allWorkingTriggerIds[i];
                  allWorkingTriggerIds[i] = allWorkingTriggerIds[j];
                  allWorkingTriggerIds[j] = tmp;
                }
                rebuildGroups();
              }
            }

            const chosenTrapIdx = currentPhase === 1 ? 0 : Math.min(currentPhase - 1, 4);
            if ((targetingDirty && totalComps - lastTargetingComp >= 250) || totalComps - lastTargetingComp >= 1500) {
              recomputeTargeting(chosenTrapIdx);
              lastTargetingComp = totalComps;
            }

            const activeGroup = triggerGroupsIds[currentGroupIndex] || allWorkingPoolIds;
            // Intelligent Two-Track Schedule:
            // - 52% Priority-Ordered Single-Trigger Epoch (every fired trigger evaluated, root-cause commonalities first)
            // - 48% Commonality Bundles, Rank-Weighted Frontier / Pairwise / Up / Down / Breakthrough Probes
            const isRoundRobinTrack = Math.random() < 0.52 && epochTriggerIds.length > 0;
            let clusterSize = isRoundRobinTrack ? 1 : (Math.random() < 0.45 ? 1 : (Math.random() < 0.78 ? 2 : 3));
            let mutCount = 0;

            let targetedMode: 'commonality_trap_bundle' | 'commonality_win_bundle' | 'pairwise' | 'up' | 'down' | 'boundary' | 'breakthrough' | 'group' = 'group';
            if (!isRoundRobinTrack) {
              const r = Math.random();
              if (r < 0.20 && sharedTrapBundleIds.length >= 2) {
                targetedMode = 'commonality_trap_bundle';
                clusterSize = Math.min(3, sharedTrapBundleIds.length, Math.random() < 0.65 ? 2 : 3);
              } else if (r < 0.34 && sharedWinnerBundleIds.length >= 2) {
                targetedMode = 'commonality_win_bundle';
                clusterSize = Math.min(3, sharedWinnerBundleIds.length, Math.random() < 0.65 ? 2 : 3);
              } else if (r < 0.58 && ((frameWinOnly.length > 0 || frameTrapOnly.length > 0) || (targetUpIds.length > 0 && targetDownIds.length > 0))) {
                targetedMode = 'pairwise';
              } else if (r < 0.72 && targetDownIds.length > 0) {
                targetedMode = 'down';
              } else if (r < 0.84 && targetUpIds.length > 0) {
                targetedMode = 'up';
              } else if (r < 0.92 && cachedBoundaryCandidateIds.length > 0) {
                targetedMode = 'boundary';
              } else if (recentBreakthroughs.length > 0) {
                targetedMode = 'breakthrough';
              } else {
                targetedMode = 'group';
              }
            }

            const totalTargetsDenom = Math.max(1, totalCorrectMatches);
            const totalTrapsDenom = Math.max(1, numMatches - totalCorrectMatches);

            for (let k = 0; k < clusterSize; k++) {
              let tId = -1;
              let targetedDir: 'up' | 'down' | 'any' | null = null;

              if (isRoundRobinTrack) {
                tId = epochTriggerIds[epochCursor++];
                if (epochCursor >= epochTriggerIds.length) {
                  epochCursor = 0;
                  recomputeTargeting(0);
    shuffleEpochTriggers();
                  auditPending = true;
                }
                targetedDir = 'any';
              } else if (targetedMode === 'commonality_trap_bundle' && sharedTrapBundleIds.length > 0) {
                tId = pickRankWeighted(sharedTrapBundleIds);
                targetedDir = 'down';
              } else if (targetedMode === 'commonality_win_bundle' && sharedWinnerBundleIds.length > 0) {
                tId = pickRankWeighted(sharedWinnerBundleIds);
                targetedDir = 'up';
              } else if (targetedMode === 'pairwise') {
                if (k % 2 === 0) {
                  const useTargetUp = targetUpIds.length > 0 && (frameWinOnly.length === 0 || Math.random() < 0.50);
                  const pool = useTargetUp ? targetUpIds : frameWinOnly;
                  if (pool.length > 0) {
                    tId = pickRankWeighted(pool);
                    targetedDir = 'up';
                  }
                } else {
                  const useTargetDown = targetDownIds.length > 0 && (frameTrapOnly.length === 0 || Math.random() < 0.50);
                  const pool = useTargetDown ? targetDownIds : frameTrapOnly;
                  if (pool.length > 0) {
                    tId = pickRankWeighted(pool);
                    targetedDir = 'down';
                  }
                }
                if (tId < 0) continue;
              } else if (targetedMode === 'up' && targetUpIds.length > 0) {
                tId = pickRankWeighted(targetUpIds);
                targetedDir = 'up';
              } else if (targetedMode === 'down' && targetDownIds.length > 0) {
                tId = pickRankWeighted(targetDownIds);
                targetedDir = 'down';
              } else if (targetedMode === 'boundary' && cachedBoundaryCandidateIds.length > 0) {
                tId = cachedBoundaryCandidateIds[(Math.random() * cachedBoundaryCandidateIds.length) | 0];
                targetedDir = 'any';
              } else if (targetedMode === 'breakthrough' && recentBreakthroughs.length > 0) {
                const recentRecord = recentBreakthroughs[(Math.random() * recentBreakthroughs.length) | 0];
                tId = recentRecord.triggerIds[(Math.random() * recentRecord.triggerIds.length) | 0];
                targetedDir = 'any';
              } else {
                const useGroup = activeGroup.length > 0 && Math.random() < 0.55;
                const useBroad = !useGroup && broadPoolIds.length > 0 && Math.random() < 0.50;
                const pool = useGroup ? activeGroup : (useBroad ? broadPoolIds : defaultPoolIds);
                if (pool.length === 0) continue;
                tId = pool[(Math.random() * pool.length) | 0];
                targetedDir = 'any';
              }

              if (tId < 0) continue;
              let duplicate = false;
              for (let m = 0; m < mutCount; m++) {
                if (mutTrigIds[m] === tId) { duplicate = true; break; }
              }
              if (duplicate) continue;

              const liveH = triggerIndicesArr[tId].length;
              if (liveH < 1) continue; // Only adjust triggers that actually fire in the evaluated match set

              const tHits = triggerTargetCountsArr[tId];
              const trHits = triggerTrapCountsArr[tId];
              const currentVal = bestPointsArr[tId];
              const isLayer2 = totalComps >= LAYER_1_INCREMENTAL_COMPS;
              // Layer 1 (< 1M): strictly incremental (±5 primary, ±10 secondary).
              // Layer 2 (>= 1M): unlocks escalation up to max bonus/penalty when needed to break plateaus.
              const allowSecondaryStep = isLayer2 || staleCleanComps >= 25000 || inIlsKick;

              let dir: 'up' | 'down' | 'any';
              if (targetedDir) {
                dir = targetedDir;
              } else {
                // Intelligent rate & commonality direction (replaces raw tHits > trHits bias)
                const trapComm = trapCommonalityScore[tId];
                const winComm = winnerCommonalityScore[tId];
                const tRate = tHits / totalTargetsDenom;
                const trRate = trHits / totalTrapsDenom;
                if (trapComm > winComm * 1.15 || trRate > tRate * 1.15) {
                  dir = Math.random() < 0.80 ? 'down' : 'any';
                } else if (winComm > trapComm * 1.15 || tRate > trRate * 1.15) {
                  dir = Math.random() < 0.80 ? 'up' : 'any';
                } else {
                  dir = 'any';
                }
              }

              const slot = tId * PTS_SPAN + Math.max(0, Math.min(80, currentVal + PTS_OFFSET));
              const primaryValues = dir === 'up' ? stepUpTable[slot] : dir === 'down' ? stepDownTable[slot] : stepAnyTable[slot];
              const stretchValues = dir === 'up' ? stretchUpTable[slot] : dir === 'down' ? stretchDownTable[slot] : stretchAnyTable[slot];
              const escalateValues = dir === 'up' ? escalateUpTable[slot] : dir === 'down' ? escalateDownTable[slot] : escalateAnyTable[slot];

              let candidateValues: Int16Array;
              if (isLayer2 && escalateValues.length > 0 && (primaryValues.length === 0 || Math.random() < 0.45)) {
                candidateValues = escalateValues;
              } else if ((allowSecondaryStep && primaryValues.length === 0) || (allowSecondaryStep && Math.random() < 0.25)) {
                candidateValues = stretchValues;
              } else {
                candidateValues = primaryValues;
              }

              if (candidateValues.length === 0 && !targetedDir && dir !== 'any') {
                candidateValues = isLayer2 && escalateAnyTable[slot].length > 0
                  ? escalateAnyTable[slot]
                  : (allowSecondaryStep ? stretchAnyTable[slot] : stepAnyTable[slot]);
              }
              if (candidateValues.length === 0) continue;

              const testVal = candidateValues[(Math.random() * candidateValues.length) | 0];
              const delta = testVal - currentVal;
              if (delta === 0) continue;

              mutTrigIds[mutCount] = tId;
              mutOldVals[mutCount] = currentVal;
              mutNewVals[mutCount] = testVal;
              mutDeltas[mutCount] = delta;
              mutCount++;
            }

            if (mutCount === 0) continue;

            // Calculate incremental regularization delta & apply mutations
            let batchRegDelta = 0;
            undoLen = 0;
            for (let m = 0; m < mutCount; m++) {
              const tId = mutTrigIds[m];
              const oldV = mutOldVals[m];
              const newV = mutNewVals[m];
              batchRegDelta += getNormReg(newV) - getNormReg(oldV);
              bestPointsArr[tId] = newV;
              const indices = triggerIndicesArr[tId];
              if (indices.length > 0) {
                applyDelta(indices, mutDeltas[m]);
              }
            }
            const trialRegSum = runningRegSum + batchRegDelta;

            totalComps++;
            phaseComps++;
            compsInPhaseMilestone++;
            if (!layer2Announced && totalComps >= LAYER_1_INCREMENTAL_COMPS) {
              layer2Announced = true;
              showToast(`Layer 1 (1M incremental ±5/±10) complete at ${allTimeBestPeak.cleanTopMatches} clean matches. Entering Layer 2: Trigger Escalation to unlock higher clean matches!`);
            }

            const testFastEval = fastEvaluateBuckets(targetBuckets, trapBuckets, trialRegSum);

            // First Trap Rank & Peak Protection Guardrail
            let slackViolated = false;
            const curFirstTrapRank = testFastEval.firstTrapRank;
            if (inIlsKick) {
              if (testFastEval.cleanTopMatches < allTimeBestPeak.cleanTopMatches - 2) {
                slackViolated = true;
              }
            } else {
              if (curFirstTrapRank < allTimeBestPeak.firstTrapRank || testFastEval.cleanTopMatches < allTimeBestPeak.cleanTopMatches) {
                slackViolated = true;
              } else if (currentPhase >= 2 && establishedRanks.length > 0) {
                for (let k = 0; k < establishedRanks.length; k++) {
                  const curTrapR = k < trapRanksCount ? trapRanksBuf[k] : (testFastEval.cleanTopMatches + 1);
                  if (curTrapR < establishedRanks[k]) {
                    slackViolated = true;
                    break;
                  }
                }
              }
            }

            let acceptMutation = false;
            let cleanStreakClimbed = false;

            if (!slackViolated) {
              cleanStreakClimbed = testFastEval.cleanTopMatches > allTimeBestPeak.cleanTopMatches;
              const cleanStreakMaintained = testFastEval.cleanTopMatches >= allTimeBestPeak.cleanTopMatches;
              const qualityImproved = testFastEval.quality > bestFastEval.quality;

              if (cleanStreakClimbed) {
                acceptMutation = true;
              } else if (currentPhase >= 2) {
                const targetTrapIdx = currentPhase - 1;
                const curTargetGap = targetTrapIdx < trapRanksCount ? trapGapsBuf[targetTrapIdx] : 0;
                const curTargetRank = targetTrapIdx < trapRanksCount ? trapRanksBuf[targetTrapIdx] : 0;
                const gapImproved = curTargetGap > bestGapInPhase || curTargetRank > bestTrapRankInPhase;

                if (gapImproved && cleanStreakMaintained) {
                  acceptMutation = true;
                  bestGapInPhase = Math.max(bestGapInPhase, curTargetGap);
                  bestTrapRankInPhase = Math.max(bestTrapRankInPhase, curTargetRank);
                  compsSinceGapImprovement = 0;
                } else if (cleanStreakMaintained && qualityImproved) {
                  acceptMutation = true;
                } else if (cleanStreakMaintained && testFastEval.quality >= bestFastEval.quality - LIVE_PLATEAU_EPS && Math.random() < 0.08) {
                  acceptMutation = true;
                }
              } else {
                if (cleanStreakMaintained && qualityImproved) {
                  acceptMutation = true;
                } else if (cleanStreakMaintained && testFastEval.quality >= bestFastEval.quality - LIVE_PLATEAU_EPS && Math.random() < 0.08) {
                  acceptMutation = true;
                }
              }
            }

            if (acceptMutation) {
              undoLen = 0;
              const acceptedSnap = cloneEvalSnapshot(testFastEval);
              runningRegSum = trialRegSum;
              targetingDirty = true;
              frontierDirty = true;
              const deltaClean = acceptedSnap.cleanTopMatches - bestFastEval.cleanTopMatches;
              const deltaQuality = acceptedSnap.quality - bestFastEval.quality;
              if (deltaClean > 0 || deltaQuality > 0) {
                recordBreakthroughMemoryIds(mutTrigIds, mutCount, deltaClean, deltaQuality);
                compsSinceMilestone = 0;
                compsInPhaseMilestone = 0;
              }
              if (acceptedSnap.cleanTopMatches > bestCleanStreak) {
                bestCleanStreak = acceptedSnap.cleanTopMatches;
                compsSinceCleanClimb = 0;
                staleCleanComps = 0;
                cleanStreakClimbedSinceLastMapUpdate = true;
                if (inIlsKick) {
                  inIlsKick = false;
                  ilsKickComps = 0;
                }
                if (currentPhase > 1) {
                  currentPhase = 1;
                  phaseComps = 0;
                  compsSinceGapImprovement = 0;
                  establishedRanks.length = 0;
                  establishedScores.length = 0;
                  showToast(`Breakthrough! Clean matches increased to ${acceptedSnap.cleanTopMatches}! Returning to Clean Maximization.`);
                }
              }
              bestTrapRanks = [...acceptedSnap.trapRanks];
              bestTrapGaps = [...acceptedSnap.trapGaps];
              bestFastEval = acceptedSnap;

              const curPeakTrapR = acceptedSnap.firstTrapRank;
              if (acceptedSnap.cleanTopMatches > allTimeBestPeak.cleanTopMatches ||
                  (acceptedSnap.cleanTopMatches === allTimeBestPeak.cleanTopMatches && curPeakTrapR > allTimeBestPeak.firstTrapRank) ||
                  (acceptedSnap.cleanTopMatches === allTimeBestPeak.cleanTopMatches && curPeakTrapR === allTimeBestPeak.firstTrapRank && acceptedSnap.quality > allTimeBestPeak.quality)) {
                snapshotAllTimeBest(acceptedSnap);
              }

              if (cleanStreakClimbed) {
                updateUiState(false);
              }

              // --- Post-Breakthrough Contribution Rebalancing (strictly trims over-stepped triggers back toward ±5) ---
              if (cleanStreakClimbed && mutCount >= 2) {
                let rebCount = 0;
                for (let bIdx = 0; bIdx < mutCount; bIdx++) {
                  const tId = mutTrigIds[bIdx];
                  const indices = triggerIndicesArr[tId];
                  if (!indices || indices.length === 0) continue;
                  if (!isHistoryMode && indices.length < 3) continue;

                  let tHits = 0;
                  let trHits = 0;
                  for (let k = 0; k < indices.length; k++) {
                    const mIdx = indices[k];
                    if (matchScores[mIdx] >= 0) {
                      if (isTarget[mIdx] === 1) tHits++;
                      else trHits++;
                    }
                  }

                  const totalActiveHits = tHits + trHits;
                  if (totalActiveHits === 0) continue;
                  const targetRatio = tHits / totalActiveHits;

                  const profile = profilesByTrigId[tId];
                  const curPoints = bestPointsArr[tId];
                  let rebalancedVal: number = curPoints;

                  if (targetRatio <= 0.40 && curPoints > 5) {
                    if (profile.allowedBand.includes(curPoints - 5)) {
                      rebalancedVal = Math.max(5, curPoints - 5);
                    }
                  } else if (targetRatio >= 0.65 && curPoints < -5) {
                    if (profile.allowedBand.includes(curPoints + 5)) {
                      rebalancedVal = Math.min(-5, curPoints + 5);
                    }
                  }

                  if ((!isUpsetsCat && rebalancedVal === 0) || (rebalancedVal !== 0 && rebalancedVal > -5 && rebalancedVal < 5)) {
                    rebalancedVal = curPoints;
                  }

                  if (rebalancedVal !== curPoints) {
                    rebTrigIds[rebCount] = tId;
                    rebOldVals[rebCount] = curPoints;
                    rebNewVals[rebCount] = rebalancedVal;
                    rebDeltas[rebCount] = rebalancedVal - curPoints;
                    rebCount++;
                  }
                }

                if (rebCount > 0) {
                  const rebalanceMark = undoLen;
                  let rebDelta = 0;
                  for (let m = 0; m < rebCount; m++) {
                    const tId = rebTrigIds[m];
                    const oldV = rebOldVals[m];
                    const newV = rebNewVals[m];
                    bestPointsArr[tId] = newV;
                    rebDelta += getNormReg(newV) - getNormReg(oldV);
                    applyDelta(triggerIndicesArr[tId], rebDeltas[m]);
                  }

                  totalComps++;
                  const trialRebRegSum = runningRegSum + rebDelta;
                  const rebalanceEval = fastEvaluateBuckets(targetBuckets, trapBuckets, trialRebRegSum);

                  let rebSlackViolated = false;
                  const curRebFirstTrapR = rebalanceEval.firstTrapRank;
                  if (curRebFirstTrapR < allTimeBestPeak.firstTrapRank || rebalanceEval.cleanTopMatches < allTimeBestPeak.cleanTopMatches) {
                    rebSlackViolated = true;
                  } else if (currentPhase >= 2 && establishedRanks.length > 0) {
                    for (let k = 0; k < establishedRanks.length; k++) {
                      const allowedSlack = k === 0 ? 0 : 2;
                      const curR = k < trapRanksCount ? trapRanksBuf[k] : (rebalanceEval.cleanTopMatches + 1);
                      if (curR < establishedRanks[k] - allowedSlack) {
                        rebSlackViolated = true;
                        break;
                      }
                    }
                  }

                  const rebalanceMaintained = !rebSlackViolated && rebalanceEval.cleanTopMatches >= bestCleanStreak;
                  const rebalanceClimbed = !rebSlackViolated && rebalanceEval.cleanTopMatches > bestCleanStreak;
                  const rebalanceQualityImproved = !rebSlackViolated && rebalanceEval.quality > bestFastEval.quality;

                  if (rebalanceClimbed || (rebalanceMaintained && rebalanceQualityImproved)) {
                    undoLen = 0;
                    const rebSnap = cloneEvalSnapshot(rebalanceEval);
                    runningRegSum = trialRebRegSum;
                    if (rebalanceClimbed) {
                      bestCleanStreak = rebSnap.cleanTopMatches;
                      compsSinceMilestone = 0;
                      compsInPhaseMilestone = 0;
                      updateUiState(false);
                    }
                    recordBreakthroughMemoryIds(rebTrigIds, rebCount, rebSnap.cleanTopMatches - bestFastEval.cleanTopMatches, rebSnap.quality - bestFastEval.quality);
                    bestTrapRanks = [...rebSnap.trapRanks];
                    bestTrapGaps = [...rebSnap.trapGaps];
                    bestFastEval = rebSnap;

                    if (rebSnap.cleanTopMatches > allTimeBestPeak.cleanTopMatches ||
                        (rebSnap.cleanTopMatches === allTimeBestPeak.cleanTopMatches && curRebFirstTrapR > allTimeBestPeak.firstTrapRank) ||
                        (rebSnap.cleanTopMatches === allTimeBestPeak.cleanTopMatches && curRebFirstTrapR === allTimeBestPeak.firstTrapRank && rebSnap.quality > allTimeBestPeak.quality)) {
                      snapshotAllTimeBest(rebSnap);
                    }
                  } else {
                    for (let m = rebCount - 1; m >= 0; m--) {
                      bestPointsArr[rebTrigIds[m]] = rebOldVals[m];
                    }
                    rollbackTo(rebalanceMark);
                  }
                }
              }
            } else {
              // Instant Batch Rollback: revert all mutations in the batch
              for (let m = mutCount - 1; m >= 0; m--) {
                bestPointsArr[mutTrigIds[m]] = mutOldVals[m];
              }
              rollbackTo(0);
            }

            // Stalemate / clean progress counter
            if (cleanStreakClimbed) {
              staleCleanComps = 0;
              compsSinceCleanClimb = 0;
            } else {
              staleCleanComps++;
              compsSinceCleanClimb++;
            }

            // ILS Kick counter
            if (inIlsKick) {
              ilsKickComps++;
              if (ilsKickComps >= 15000) {
                restoreAllTimeBest();
                inIlsKick = false;
                ilsKickComps = 0;
              }
            }

            // Track best-ever (elite) state; restart from it after a long non-improving stretch
            if (bestFastEval.cleanTopMatches > eliteEval.cleanTopMatches ||
              (bestFastEval.cleanTopMatches === eliteEval.cleanTopMatches && bestFastEval.quality > eliteEval.quality)) {
              snapshotElite();
              liveStallCount = 0;
            } else {
              liveStallCount++;
              if (!inIlsKick && liveStallCount >= LIVE_RESTART_AFTER) {
                restoreElite();
                liveStallCount = 0;
              }
            }

            // Multi-Phase Sequential Trap Dispersion & Stalemate Transition
            if (currentPhase === 1) {
              if (staleCleanComps >= PHASE_1_STALEMATE_BUDGET) {
                restoreAllTimeBest();
                establishedRanks[0] = allTimeBestPeak.firstTrapRank;
                establishedScores[0] = allTimeBestPeak.trapScores ? (allTimeBestPeak.trapScores[0] ?? 0) : 0;
                currentPhase = 2;
                phaseComps = 0;
                compsSinceGapImprovement = 0;
                bestGapInPhase = allTimeBestPeak.trapGaps ? (allTimeBestPeak.trapGaps[1] ?? 0) : 0;
                bestTrapRankInPhase = allTimeBestPeak.trapRanks ? (allTimeBestPeak.trapRanks[1] ?? 0) : 0;
                showToast(`Stalemate reached at ${allTimeBestPeak.cleanTopMatches} clean matches. Advancing to Phase 2: Widening Trap #2 gap!`);
                updateUiState(true);
              }
            } else if (currentPhase >= 2 && currentPhase <= 4) {
              compsSinceGapImprovement++;
              if ((compsSinceGapImprovement >= GAP_PHASE_PATIENCE && phaseComps >= 100000) || phaseComps >= SUBSEQUENT_PHASE_BUDGET) {
                restoreAllTimeBest();
                const trapIdx = currentPhase - 1;
                establishedRanks[trapIdx] = allTimeBestPeak.trapRanks ? (allTimeBestPeak.trapRanks[trapIdx] ?? allTimeBestPeak.cleanTopMatches + trapIdx + 1) : (allTimeBestPeak.cleanTopMatches + trapIdx + 1);
                establishedScores[trapIdx] = allTimeBestPeak.trapScores ? (allTimeBestPeak.trapScores[trapIdx] ?? 0) : 0;
                currentPhase = (currentPhase + 1) as (1 | 2 | 3 | 4 | 5);
                phaseComps = 0;
                compsSinceGapImprovement = 0;
                const nextTrapIdx = currentPhase - 1;
                bestGapInPhase = allTimeBestPeak.trapGaps ? (allTimeBestPeak.trapGaps[nextTrapIdx] ?? 0) : 0;
                bestTrapRankInPhase = allTimeBestPeak.trapRanks ? (allTimeBestPeak.trapRanks[nextTrapIdx] ?? 0) : 0;
                showToast(`Trap #${trapIdx + 1} locked at rank #${establishedRanks[trapIdx]}. Advancing to Phase ${currentPhase}: Widening Trap #${currentPhase} gap!`);
                updateUiState(true);
              }
            } else if (currentPhase === 5) {
              compsSinceGapImprovement++;
              if ((compsSinceGapImprovement >= GAP_PHASE_PATIENCE && phaseComps >= 100000) || phaseComps >= SUBSEQUENT_PHASE_BUDGET) {
                finalizeLive();
                setDeepStatus('converged');
                setDeepConvergenceMode('sweet_spot');
                setIsDeepOptimizing(false);
                const t1 = allTimeBestPeak.trapRanks[0] ?? 1;
                const t2 = allTimeBestPeak.trapRanks[1] ?? '?';
                const t3 = allTimeBestPeak.trapRanks[2] ?? '?';
                const t4 = allTimeBestPeak.trapRanks[3] ?? '?';
                const t5 = allTimeBestPeak.trapRanks[4] ?? '?';
                showToast(`Optimal Trap Dispersion Converged! Promoted ${allTimeBestPeak.cleanTopMatches} clean winners with widened Trap gaps (T1: #${t1}, T2: #${t2}, T3: #${t3}, T4: #${t4}, T5: #${t5}) over ${totalComps.toLocaleString()} computations!`);
                return;
              }
            }

            // Safety stop at 5,000,000 total computations
            if (totalComps >= 5000000) {
              finalizeLive();
              setDeepStatus('converged');
              setIsDeepOptimizing(false);
              showToast(`Optimization complete: Reached 5,000,000 computations with ${allTimeBestPeak.cleanTopMatches} clean winners!`);
              return;
            }

            // 100% Ceiling achieved
            if (!initiallyCeilingMet && bestFastEval.ceilingMet) {
              finalizeLive();
              setDeepStatus('converged');
              setDeepConvergenceMode('perfect_100');
              setIsDeepOptimizing(false);
              showToast(`100% Perfect Separation! All ${bestFastEval.cleanTopMatches} winners are clean at the top!`);
              return;
            }
          }
        }

        // Update UI after frame (throttled to 250ms)
        updateUiState(false);

        setTimeout(runChunk, 4);
      } catch (err: any) {
        console.error('Deep optimizer execution error:', err);
        finalizeLive();
        setIsDeepOptimizing(false);
        setDeepStatus('paused');
        showToast(`Optimizer stopped: ${err?.message || 'Calculation error'}`);
      }
    };

      setTimeout(runChunk, 4);
    };

    if (isHistoryMode || !allMatches || allMatches.length === 0 || datasetScope === 'live') {
      if (isHistoryMode) {
        hitStatsMap.forEach((stat, t) => {
          histHitsMap.set(t, { mfav: stat.mfav, draw: stat.draw, underdog: stat.underdog, total: stat.mfav + stat.draw + stat.underdog });
        });
      }
      launchCoreOptimizer();
    } else {
      // Sliced non-blocking processing of 3,000+ historical matches (guarantees zero UI freeze)
      let histIdx = 0;
      const sampleLimit = Math.min(allMatches.length, 3000);
      const processHistBatch = () => {
        if (stopDeepRef.current) return;
        const sliceStart = performance.now();
        while (histIdx < sampleLimit && performance.now() - sliceStart < 15) {
          const m = allMatches[histIdx++];
          const actual = getActualResult(m.result || '');
          if (actual !== '1' && actual !== 'X' && actual !== '2') continue;
          const moStr = m.mo || (m as any).odds || (m as any).data?.mo || (m as any).data?.odds || '';
          const moParts = String(moStr).split(/[- ,]+/).map(s => parseFloat(s.replace(/[^0-9.]/g, '').trim())).filter(p => !isNaN(p));
          const homeOdds = moParts[0] || (m.homeOdds ? parseFloat(String(m.homeOdds).replace(/[^0-9.]/g, '')) : 0) || 0;
          const awayOdds = moParts.length >= 3 ? (moParts[2] || 0) : (moParts.length === 2 ? (moParts[1] || 0) : ((m.awayOdds ? parseFloat(String(m.awayOdds).replace(/[^0-9.]/g, '')) : 0)));
          if (homeOdds <= 0 || awayOdds <= 0) continue;
          const mFav = getMarketFavorite(m);
          const out: 'mfav' | 'draw' | 'underdog' = actual === mFav ? 'mfav' : actual === 'X' ? 'draw' : 'underdog';
          let trigs: Set<string> = (m as any)._opwCatalogTriggers;
          if (!trigs) {
            try {
              const stats = extractMatchEvaluationStats(m, phaStatsMap, activeCategory);
              trigs = evaluateAllCatalogTriggers(stats, m);
              (m as any)._opwCatalogTriggers = trigs;
            } catch (e) {
              continue;
            }
          }
          trigs.forEach(t => {
            let h = histHitsMap.get(t);
            if (!h) {
              h = { mfav: 0, draw: 0, underdog: 0, total: 0 };
              histHitsMap.set(t, h);
            }
            if (out === 'mfav') h.mfav++;
            else if (out === 'draw') h.draw++;
            else h.underdog++;
            h.total++;
          });
        }
        if (histIdx < sampleLimit) {
          setTimeout(processHistBatch, 0);
        } else {
          launchCoreOptimizer();
        }
      };
      processHistBatch();
    }
    } catch (err: any) {
      console.error('Failed to start deep optimization:', err);
      setIsDeepOptimizing(false);
      setDeepStatus('idle');
      showToast(`Could not start Self-Learn: ${err?.message || 'Initialization error'}`);
    }
  }, [completedMatches, evaluatedCategoryProfiles, selectedDay, activeCategory, phaStatsMap, activeCategoryConfig, deepPointsMap, currentRulePointsMap, deepComputations, datasetScope]);

  const pauseDeepOptimization = useCallback(() => {
    stopDeepRef.current = true;
    setIsDeepOptimizing(false);
    setDeepStatus('paused');
    try {
      const peakSnapshot = allTimeBestPeakRef.current;
      const ptsToAdopt = (peakSnapshot && peakSnapshot.points && peakSnapshot.points.size > 0)
        ? peakSnapshot.points
        : deepPointsMap;
      if (ptsToAdopt && ptsToAdopt.size > 0) {
        adoptCalibratedRulesPermanently(
          ptsToAdopt,
          peakSnapshot ? peakSnapshot.cleanTopMatches : deepCleanMatches,
          peakSnapshot ? peakSnapshot.firstTrapRank : (deepFirstTrapRank ?? 1),
          peakSnapshot ? peakSnapshot.quality : deepQuality,
          peakSnapshot ? peakSnapshot.trapRanks : deepTrapRanks,
          peakSnapshot ? peakSnapshot.trapGaps : deepTrapGaps
        );
      }
    } catch (e) {}
    showToast(`Optimization paused at ${deepComputations.toLocaleString()} computations.`);
  }, [deepComputations, activeCategory, deepPointsMap, deepCleanMatches, deepFirstTrapRank, deepQuality, deepTrapRanks, deepTrapGaps, adoptCalibratedRulesPermanently, showToast]);

  const resetDeepOptimization = useCallback(() => {
    stopDeepRef.current = true;
    allTimeBestPeakRef.current = null;
    setIsDeepOptimizing(false);
    setDeepStatus('idle');
    setDeepConvergenceMode('none');
    setDeepComputations(0);
    setDeepElapsedMs(0);
    setDeepEvalRate(0);
    setDeepPurityPct(0);
    setDeepInversions(0);
    setDeepBufferMargin(0);
    setDeepQuality(0);
    setDeepCleanMatches(0);
    setDeepTargetClean(0);
    setDeepTargetCeiling(0);
    setDeepFirstTrapRank(1);
    setDeepTargetsInTop5000(0);
    setDeepTrapRanks([1]);
    setDeepTrapScores([]);
    setDeepTrapGaps([]);
    setDeepTrapDispersionHealth('CLUSTERED');
    setDeepOptimizerPhase({
      currentPhase: 1,
      phaseComps: 0,
      phaseBudget: 500000,
      establishedRanks: [],
      establishedScores: []
    });
    setDeepHorizonMetrics({
      h500: { horizon: 500, traps: 0, targets: 0, total: 0, winRate: 0 },
      h1000: { horizon: 1000, traps: 0, targets: 0, total: 0, winRate: 0 },
      h1500: { horizon: 1500, traps: 0, targets: 0, total: 0, winRate: 0 },
      h2000: { horizon: 2000, traps: 0, targets: 0, total: 0, winRate: 0 },
      h3000: { horizon: 3000, traps: 0, targets: 0, total: 0, winRate: 0 }
    });
    setDeepPointsMap(null);
    setDeepDiagnostics(null);
    showToast('Reset deep optimizer.');
  }, []);

  // Batch Optimize All Categories
  const startBatchOptimizeAll = useCallback(async () => {
    setIsDeepOptimizing(true);
    setDeepStatus('running');
    stopDeepRef.current = false;
    isBatchOptimizingRef.current = true;
    setDeepComputations(0);

    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    let totalBatchComps = 0;

    try {
      for (let cIdx = 0; cIdx < CATEGORIES.length; cIdx++) {
        if (stopDeepRef.current) break;
        const cat = CATEGORIES[cIdx];
        setDeepBatchProgress({ current: cIdx + 1, total: CATEGORIES.length, label: cat.label });
        setActiveCategory(cat.id);
        let categoryComps = 0;

        const prefix = cat.tagPrefix;
        const isTop12Cat = cat.id === 'top_12_value' || cat.id === 'top_10_value' || prefix === 'top12:' || prefix === 'top10:';
        const catMatches = rawDataset.filter(m => {
          const tags = m.evaluatorTags && m.evaluatorTags.length > 0
            ? m.evaluatorTags
            : getMatchEvaluatorTags(m, phaStatsMap, liveViewType === 'jackpot', true, matchStars);
          if (isTop12Cat) {
            return tags.some(t => t.startsWith('top12:') || t.startsWith('top10:'));
          }
          return tags.some(t => t.startsWith(prefix));
        });

        const catCompleted = catMatches.filter(m => {
          const actual = getActualResult(m.result || '');
          return actual === '1' || actual === 'X' || actual === '2';
        });

        if (catCompleted.length === 0) continue;

        const profiles: { outcome: 'mfav' | 'draw' | 'underdog'; triggersHit: Set<string>; baseScore: number }[] = [];
        catCompleted.forEach(m => {
          const actual = getActualResult(m.result || '');
          const mFav = getMarketFavorite(m);
          const outcome: 'mfav' | 'draw' | 'underdog' = actual === mFav ? 'mfav' : actual === 'X' ? 'draw' : 'underdog';
          
          let allTriggers: Set<string> = (m as any)._opwCatalogTriggers;
          if (!allTriggers) {
            const stats = extractMatchEvaluationStats(m, phaStatsMap, cat.id);
            allTriggers = evaluateAllCatalogTriggers(stats, m);
            (m as any)._opwCatalogTriggers = allTriggers;
          }
          const triggersHit = new Set<string>();
          allTriggers.forEach(t => {
            triggersHit.add(t);
          });
          const matchDay = selectedDay !== 'all' ? selectedDay : getMatchDayOfWeek(m);
          const evalCat = cat.id === 'safety' ? 'best_bet' : cat.id;
          const baseInfo = getOptimizedBaseWeight(m, phaStatsMap, evalCat, matchDay);
          profiles.push({ outcome, triggersHit, baseScore: baseInfo?.points ?? 0 });
        });

        if (profiles.length === 0) continue;

        const activeTriggersSet = new Set<string>();
        profiles.forEach(p => p.triggersHit.forEach(t => activeTriggersSet.add(t)));
        const activeTriggers = Array.from(activeTriggersSet);

        const batchHitStats = new Map<string, { mfav: number; draw: number; underdog: number }>();
        profiles.forEach(p => {
          p.triggersHit.forEach(t => {
            let st = batchHitStats.get(t);
            if (!st) {
              st = { mfav: 0, draw: 0, underdog: 0 };
              batchHitStats.set(t, st);
            }
            if (p.outcome === 'mfav') st.mfav++;
            else if (p.outcome === 'draw') st.draw++;
            else st.underdog++;
          });
        });

        const batchHistStats = new Map<string, { mfav: number; draw: number; underdog: number }>();
        if (allMatches && allMatches.length > 0) {
          allMatches.forEach(m => {
            const trigs: Set<string> | undefined = (m as any)._opwCatalogTriggers;
            if (!trigs) return;
            const actual = getActualResult(m.result || '');
            if (actual !== '1' && actual !== 'X' && actual !== '2') return;
            const mFav = getMarketFavorite(m);
            const outcome = actual === mFav ? 'mfav' : actual === 'X' ? 'draw' : 'underdog';
            trigs.forEach(t => {
              let st = batchHistStats.get(t);
              if (!st) {
                st = { mfav: 0, draw: 0, underdog: 0 };
                batchHistStats.set(t, st);
              }
              st[outcome]++;
            });
          });
        }

        const catalogTriggers = getFullActiveCatalogTriggers();
        const catPoints = new Map<string, number>();
        const targetDay = selectedDay !== 'all' ? selectedDay : (liveMatchDay || 'sunday');
        const existingCatRules = DAILY_OPTIMIZED_SETTINGS[targetDay]?.[cat.id]?.rules || [];
        const existingCatMap = new Map<string, number>();
        existingCatRules.forEach((r: any) => existingCatMap.set(r.description, r.points));

        const isUpsetsCat = cat.targetObjective === 'underdog_only';
        const batchProfileMap = new Map<string, TriggerAccuracyProfile>();
        catalogTriggers.forEach(desc => {
          const liveSt = batchHitStats.get(desc);
          const histSt = batchHistStats.get(desc);
          const existingVal = existingCatMap.get(desc);
          const trigProf = getTriggerAccuracyProfile(desc, liveSt, cat.targetObjective, existingVal, false, cat.id, targetDay, histSt);
          batchProfileMap.set(desc, trigProf);
          const liveHits = liveSt ? liveSt.mfav + liveSt.draw + liveSt.underdog : 0;
          const histHits = histSt ? histSt.mfav + histSt.draw + histSt.underdog : 0;
          const totalHits = liveHits + histHits;
          let dflt: number;

          if (totalHits > 0) {
            if (existingVal !== undefined && ((trigProf.zeroEligible && existingVal === 0) || (existingVal !== 0 && (existingVal >= 5 || existingVal <= -5)))) {
              dflt = existingVal;
            } else {
              const polarity = getTriggerSemanticPolarity(desc);
              dflt = (isUpsetsCat ? polarity === 'PRO_UNDERDOG' : polarity === 'PRO_MFAV') ? 5 : -5;
            }
          } else {
            dflt = (existingVal !== undefined && ((trigProf.zeroEligible && existingVal === 0) || (existingVal !== 0 && (existingVal >= 5 || existingVal <= -5))))
              ? existingVal
              : 5;
          }
          if ((!trigProf.zeroEligible && dflt === 0) || (dflt !== 0 && dflt > -5 && dflt < 5)) {
            const polarity = getTriggerSemanticPolarity(desc);
            dflt = (isUpsetsCat ? polarity === 'PRO_UNDERDOG' : polarity === 'PRO_MFAV') ? 5 : -5;
          }
          catPoints.set(desc, dflt);
        });

        let bestPoints = new Map(catPoints);
        let bestEval = evaluateSeparation(profiles, bestPoints, cat.targetObjective, cat.targetCapacity);
        let bestCleanStreak = bestEval.cleanTopMatches;
        let compsSinceMilestone = 0;
        const BATCH_PATIENCE_BUDGET = 10000; // Self-aware batch plateau budget per category

        // Initialize HUD metrics contextually for this category (starts from 0 computations)
        setDeepComputations(0);
        setDeepCleanMatches(bestEval.cleanTopMatches);
        setDeepTargetClean(bestEval.targetFloor);
        setDeepTargetCeiling(bestEval.targetCeiling);
        setDeepFirstTrapRank(bestEval.firstTrapRank);
        setDeepPurityPct(bestEval.purityPct);
        setDeepInversions(bestEval.inversions);
        setDeepBufferMargin(bestEval.bufferMargin);
        setDeepQuality(bestEval.quality);
        setDeepConvergenceMode(bestEval.ceilingMet ? 'perfect_100' : bestEval.floorMet ? 'sweet_spot' : 'none');
        if (bestEval.horizonMetrics) setDeepHorizonMetrics(bestEval.horizonMetrics);
        setDeepPointsMap(new Map(bestPoints));

        // Self-aware incremental batch convergence: round-robin ±5 coordinate steps across all active triggers
        let iter = 0;
        let batchCursor = 0;
        const batchPool = activeTriggers.length > 0 ? activeTriggers : catalogTriggers;
        while (!bestEval.ceilingMet && !stopDeepRef.current) {
          const topNPure = bestEval.trapInTopN === 0 || 
            bestEval.cleanTopMatches >= cat.targetCapacity ||
            (bestEval.horizonMetrics && bestEval.horizonMetrics.h1000.traps <= 50 && bestEval.horizonMetrics.h500.traps <= 25);
          if ((bestEval.floorMet || bestEval.ceilingMet) && topNPure && compsSinceMilestone >= BATCH_PATIENCE_BUDGET) {
            // Plateau reached at optimal sweet spot without overfitting
            break;
          }

          for (let sub = 0; sub < 100 && !bestEval.ceilingMet && !stopDeepRef.current; sub++) {
            iter++;
            categoryComps++;
            totalBatchComps++;
            const targetTrigger = (batchPool.length > 0 && Math.random() < 0.75)
              ? batchPool[(batchCursor++) % batchPool.length]
              : batchPool[Math.floor(Math.random() * batchPool.length)];
            if (!targetTrigger) continue;

            const currentVal = bestPoints.get(targetTrigger) ?? 0;
            const trigProf = batchProfileMap.get(targetTrigger) || getTriggerAccuracyProfile(targetTrigger, batchHitStats.get(targetTrigger), cat.targetObjective, currentVal, false, cat.id, targetDay, batchHistStats.get(targetTrigger));
            const trigBand = trigProf.allowedBand;
            const allowBatchZero = isUpsetsCat && compsSinceMilestone >= 2500 && trigProf.zeroEligible && Math.abs(currentVal) <= 10;
            const step5Values = trigBand.filter(v =>
              (v === currentVal + 5 || v === currentVal - 5 || (allowBatchZero && v === 0)) &&
              v !== currentVal &&
              (allowBatchZero ? (v === 0 || v >= 5 || v <= -5) : (v !== 0 && (v >= 5 || v <= -5)))
            );
            const step10Values = trigBand.filter(v =>
              (v === currentVal + 10 || v === currentVal - 10 || v === currentVal + 5 || v === currentVal - 5 || (allowBatchZero && v === 0)) &&
              v !== currentVal &&
              (allowBatchZero ? (v === 0 || v >= 5 || v <= -5) : (v !== 0 && (v >= 5 || v <= -5)))
            );
            const fallbackNearest = trigBand
              .filter(v => v !== currentVal && (allowBatchZero ? (v === 0 || v >= 5 || v <= -5) : (v !== 0 && (v >= 5 || v <= -5))))
              .sort((a, b) => Math.abs(a - currentVal) - Math.abs(b - currentVal))
              .slice(0, 2);
            const candPool = step5Values.length > 0 && compsSinceMilestone < 2500
              ? step5Values
              : (step10Values.length > 0 ? step10Values : fallbackNearest);
            if (candPool.length === 0) continue;
            const testVal = candPool[Math.floor(Math.random() * candPool.length)];

            bestPoints.set(targetTrigger, testVal);
            const testEval = evaluateSeparation(profiles, bestPoints, cat.targetObjective, cat.targetCapacity);

            if (testEval.quality > bestEval.quality) {
              if (testEval.cleanTopMatches > bestCleanStreak) {
                bestCleanStreak = testEval.cleanTopMatches;
                compsSinceMilestone = 0; // Progress reset!
              }
              bestEval = testEval;
            } else {
              bestPoints.set(targetTrigger, currentVal);
            }

            if (bestEval.floorMet && topNPure) {
              compsSinceMilestone++;
            }
          }

        // Live telemetry updates during batch optimization - contextual to CURRENT category
        setDeepComputations(categoryComps);
        setDeepCleanMatches(bestEval.cleanTopMatches);
        setDeepTargetClean(bestEval.targetFloor);
        setDeepTargetCeiling(bestEval.targetCeiling);
        setDeepFirstTrapRank(bestEval.firstTrapRank);
        setDeepPurityPct(bestEval.purityPct);
        setDeepInversions(bestEval.inversions);
        setDeepBufferMargin(bestEval.bufferMargin);
        setDeepQuality(bestEval.quality);
        setDeepConvergenceMode(bestEval.ceilingMet ? 'perfect_100' : bestEval.floorMet ? 'sweet_spot' : 'none');
        if (bestEval.horizonMetrics) setDeepHorizonMetrics(bestEval.horizonMetrics);
        setDeepPointsMap(new Map(bestPoints));
        await new Promise(r => setTimeout(r, 0));
      }

      // Commit to runtime
      const tunedRules = Array.from(bestPoints.entries()).map(([description, points]) => ({
        description,
        points
      }));
      const finalRules = populateCategoryWithMasterRules(tunedRules, cat.targetObjective, cat.id, targetDay, { preserveExact: true });
      const defaultSettings = DAILY_DEFAULT_CATEGORY_SETTINGS[targetDay]?.[cat.id] || OPTIMIZED_CATEGORY_SETTINGS[cat.id] || {
        name: cat.label,
        description: cat.description,
        baseLogic: "Points based on Primary Pattern PHA %.",
        baseWeightIntervals: [
          { id: '1', min: 60, max: 100, points: 45, metric: 'pha_market_fav' },
          { id: '2', min: 50, max: 59.99, points: 40, metric: 'pha_market_fav' },
          { id: '3', min: 45, max: 49.99, points: 35, metric: 'pha_market_fav' },
          { id: '4', min: 40, max: 44.99, points: 25, metric: 'pha_market_fav' },
          { id: '5', min: 34, max: 39.99, points: 10, metric: 'pha_market_fav' },
          { id: '6', min: 0, max: 33.99, points: 5, metric: 'pha_market_fav' }
        ],
        rules: []
      };
      const updated = { ...defaultSettings, rules: finalRules };
      updateDailyOptimizedCategorySettings(targetDay, cat.id, updated, false);
      if (selectedDay === 'all') {
        updateOptimizedCategorySettings(cat.id, updated);
      }

      // Save bestPoints into deepCategoryPointsMap for this day and category
      setDeepCategoryPointsMap(prev => ({ ...prev, [`${targetDay}_${cat.id}`]: new Map(bestPoints) }));
      setDeepPointsMap(new Map(bestPoints));
      setDeepPurityPct(bestEval.purityPct);
      setDeepInversions(bestEval.inversions);
      setDeepBufferMargin(bestEval.bufferMargin);
      setDeepQuality(bestEval.quality);
      setDeepCleanMatches(bestEval.cleanTopMatches);
      setDeepTargetClean(bestEval.targetFloor);
      setDeepTargetCeiling(bestEval.targetCeiling);
      setDeepFirstTrapRank(bestEval.firstTrapRank);
      if (bestEval.horizonMetrics) setDeepHorizonMetrics(bestEval.horizonMetrics);
      setDeepConvergenceMode(bestEval.ceilingMet ? 'perfect_100' : bestEval.floorMet ? 'sweet_spot' : 'none');

      await new Promise(r => setTimeout(r, 40));
    }

      setDeepComputations(totalBatchComps);
      setIsDeepOptimizing(false);
      setDeepStatus('converged');
      setDeepBatchProgress(null);
      showToast(`Batch Deep Optimization completed (${totalBatchComps.toLocaleString()} computations) and saved to runtime for ${selectedDay !== 'all' ? selectedDay.toUpperCase() : 'Main Algo'} & Main Algo (other days unaffected)!`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', { detail: { category: 'all', day: selectedDay } }));
        window.dispatchEvent(new Event('seerLockedSlipsUpdated'));
      }
    } finally {
      isBatchOptimizingRef.current = false;
      setIsDeepOptimizing(false);
    }
  }, [rawDataset, phaStatsMap, liveViewType, matchStars, activeCategory, selectedDay]);

  const coreRecommendationsCount = useMemo(() => {
    return effectiveRecommendations.filter(r => !isLeagueTrigger(r.description)).length;
  }, [effectiveRecommendations]);

  const leagueRecommendationsCount = useMemo(() => {
    return effectiveRecommendations.filter(r => isLeagueTrigger(r.description)).length;
  }, [effectiveRecommendations]);

  const leagueBonusCount = useMemo(() => {
    return effectiveRecommendations.filter(r => isLeagueTrigger(r.description) && r.recommendedPoints > 0).length;
  }, [effectiveRecommendations]);

  const leaguePenaltyCount = useMemo(() => {
    return effectiveRecommendations.filter(r => isLeagueTrigger(r.description) && r.recommendedPoints < 0).length;
  }, [effectiveRecommendations]);

  // Filter & sort recommendations table
  const filteredRecommendations = useMemo(() => {
    let list = effectiveRecommendations;

    // Partition by triggersViewTab ('core' vs 'leagues')
    if (triggersViewTab === 'core') {
      list = list.filter(r => !isLeagueTrigger(r.description));
    } else {
      list = list.filter(r => isLeagueTrigger(r.description));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => r.description.toLowerCase().includes(q));
    }

    if (recommendationFilter === 'bonus') {
      list = list.filter(r => r.recommendedPoints > 0);
    } else if (recommendationFilter === 'penalty') {
      list = list.filter(r => r.recommendedPoints < 0);
    } else if (recommendationFilter === 'zero') {
      list = list.filter(r => r.recommendedPoints === 0);
    } else if (recommendationFilter === 'mismatch') {
      list = list.filter(r => r.recommendedPoints !== r.currentPoints);
    }

    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'recommended') {
        valA = a.recommendedPoints;
        valB = b.recommendedPoints;
      } else if (sortField === 'hits') {
        valA = a.totalHits;
        valB = b.totalHits;
      }

      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [effectiveRecommendations, searchQuery, recommendationFilter, sortField, sortDir, triggersViewTab, isLeagueTrigger]);

  // Pagination & Stable Row Handlers for 60fps Zero-Lag Scrolling
  const [tablePageSize, setTablePageSize] = useState<number>(60);
  const [tablePage, setTablePage] = useState<number>(0);

  useEffect(() => {
    setTablePage(0);
  }, [activeCategory, selectedDay, triggersViewTab, recommendationFilter, searchQuery, sortField, sortDir, tablePageSize]);

  const totalTablePages = tablePageSize > 0
    ? Math.max(1, Math.ceil(filteredRecommendations.length / tablePageSize))
    : 1;
  const clampedTablePage = Math.min(tablePage, totalTablePages - 1);

  const paginatedRecommendations = useMemo(() => {
    if (tablePageSize <= 0) return filteredRecommendations;
    const start = clampedTablePage * tablePageSize;
    return filteredRecommendations.slice(start, start + tablePageSize);
  }, [filteredRecommendations, clampedTablePage, tablePageSize]);

  const rowHandlersRef = useRef({
    handleSetTriggerPoints,
    handleToggleLeaguePolarity,
    setHistoryInspectTrigger
  });
  rowHandlersRef.current.handleSetTriggerPoints = handleSetTriggerPoints;
  rowHandlersRef.current.handleToggleLeaguePolarity = handleToggleLeaguePolarity;
  rowHandlersRef.current.setHistoryInspectTrigger = setHistoryInspectTrigger;

  const stableInspectHistory = useCallback((desc: string) => {
    rowHandlersRef.current.setHistoryInspectTrigger(desc);
  }, []);

  const stableSetTriggerPoints = useCallback((desc: string, pts: number) => {
    rowHandlersRef.current.handleSetTriggerPoints(desc, pts);
  }, []);

  const stableToggleLeaguePolarity = useCallback((desc: string) => {
    rowHandlersRef.current.handleToggleLeaguePolarity(desc);
  }, []);

  // Apply Recommendations to Runtime Category Settings
  const handleApplyRecommendations = useCallback(async (persistToCodebase?: any) => {
    const isCodebaseSave = persistToCodebase === true;
    const effectiveTargetDay = selectedDay !== 'all' ? selectedDay : datasetDay;
    const dayCatKey = `${effectiveTargetDay}_${activeCategory}`;
    let deepMap = (allTimeBestPeakRef.current?.category === activeCategory && allTimeBestPeakRef.current.points.size > 0)
      ? allTimeBestPeakRef.current.points
      : ((deepPointsCategoryRef.current === activeCategory && deepPointsMap && deepPointsMap.size > 0)
        ? deepPointsMap
        : deepCategoryPointsMap[dayCatKey]);
    if (!deepMap || deepMap.size === 0) {
      const peakMem = loadOptimizerPeakMemory(effectiveTargetDay, activeCategory);
      if (peakMem?.points) {
        deepMap = new Map(Object.entries(peakMem.points));
      }
    }

    // Build complete calibrated trigger map:
    // 1. Seed with currentRulePointsMap so untuned triggers retain their exact existing points for this day & category.
    // 2. Overlay deepMap so tuned triggers strictly override old points.
    // 3. Pass to populateCategoryWithMasterRules so any unconfigured trigger gets +5 points and no trigger is ever 0 (except Upsets where 0 is allowed) or omitted.
    const isUpsetsCat = activeCategory === 'upsets' || activeCategory === 'upset' || activeCategoryConfig.targetObjective === 'underdog_only';
    const mergedPoints = new Map<string, number>();
    currentRulePointsMap.forEach((pts, desc) => {
      if (desc && typeof pts === 'number' && (isUpsetsCat || pts !== 0)) {
        mergedPoints.set(desc, pts);
      }
    });
    if (deepMap && deepMap.size > 0) {
      deepMap.forEach((pts, desc) => {
        if (desc && typeof pts === 'number' && (isUpsetsCat || pts !== 0)) {
          mergedPoints.set(desc, pts);
        }
      });
    } else {
      effectiveRecommendations.forEach(r => {
        if (r.description && typeof r.recommendedPoints === 'number' && (isUpsetsCat || r.recommendedPoints !== 0)) {
          mergedPoints.set(r.description, r.recommendedPoints);
        }
      });
    }

    const tunedRules: { description: string; points: number }[] = Array.from(mergedPoints.entries()).map(([description, points]) => ({
      description,
      points: Math.max(isLeagueTrigger(description) ? getLeagueTriggerMaxPenalty(description) : -30, Math.min(40, points))
    }));

    const finalRules = populateCategoryWithMasterRules(
      tunedRules,
      activeCategoryConfig.targetObjective,
      activeCategoryConfig.id,
      effectiveTargetDay,
      { preserveExact: true }
    );

    const existingSettings = activeSettings || {
      name: activeCategoryConfig.label,
      description: activeCategoryConfig.description,
      baseLogic: "Points based on Primary Pattern PHA %.",
      baseWeightIntervals: [
        { id: '1', min: 60, max: 100, points: 45, metric: 'pha_market_fav' },
          { id: '2', min: 50, max: 59.99, points: 40, metric: 'pha_market_fav' },
          { id: '3', min: 45, max: 49.99, points: 35, metric: 'pha_market_fav' },
          { id: '4', min: 40, max: 44.99, points: 25, metric: 'pha_market_fav' },
          { id: '5', min: 34, max: 39.99, points: 10, metric: 'pha_market_fav' },
          { id: '6', min: 0, max: 33.99, points: 5, metric: 'pha_market_fav' }
      ],
      rules: []
    };

    const updated = {
      ...existingSettings,
      rules: finalRules
    };

    // Strict Day Isolation: Only target the active day unless 'all' days is explicitly selected
    const targetDaysArray: DayOfWeek[] = selectedDay === 'all'
      ? (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as DayOfWeek[])
      : [effectiveTargetDay];

    const aliasKeyForPeak = activeCategory === 'top_12_value' ? 'top_10_value'
      : (activeCategory === 'top_10_value' ? 'top_12_value'
      : (activeCategory === 'upsets' ? 'upset'
      : (activeCategory === 'upset' ? 'upsets'
      : (activeCategory === 'bankers_dlive' ? 'banker' : undefined))));

    targetDaysArray.forEach(d => {
      updateDailyOptimizedCategorySettings(d, activeCategory, updated, true, { silent: true, source: 'codebase' });
      const verifiedClean = cleanMatchesBreakdown.totalTargets > 0 ? cleanMatchesBreakdown.cleanCount : (deepCleanMatches || 0);
      const verifiedTrapRank = cleanMatchesBreakdown.totalTargets > 0 ? cleanMatchesBreakdown.firstTrapRank : (deepFirstTrapRank || 0);
      const peakPayload = {
        cleanTopMatches: verifiedClean,
        firstTrapRank: verifiedTrapRank,
        quality: deepQuality || 0,
        trapRanks: [],
        trapGaps: [],
        points: Object.fromEntries(finalRules.map(r => [r.description, r.points]))
      };
      saveOptimizerPeakMemory(d, activeCategory, peakPayload);
      if (aliasKeyForPeak) {
        saveOptimizerPeakMemory(d, aliasKeyForPeak, peakPayload);
      }
    });

    const finalPointsMap = new Map(finalRules.map(r => [r.description, r.points]));
    if (allTimeBestPeakRef.current && allTimeBestPeakRef.current.category === activeCategory) {
      allTimeBestPeakRef.current = {
        ...allTimeBestPeakRef.current,
        points: finalPointsMap
      };
    }
    deepPointsCategoryRef.current = activeCategory;
    setDeepPointsMap(finalPointsMap);
    deepCategoryPointsMapRef.current[dayCatKey] = finalPointsMap;
    deepCategoryPointsMapRef.current[activeCategory] = finalPointsMap;
    targetDaysArray.forEach(d => {
      deepCategoryPointsMapRef.current[`${d}_${activeCategory}`] = finalPointsMap;
      if (aliasKeyForPeak) {
        deepCategoryPointsMapRef.current[`${d}_${aliasKeyForPeak}`] = finalPointsMap;
      }
    });

    // Keep in-memory deep maps synchronized across all target days
    setDeepCategoryPointsMap(prev => {
      const next = { ...prev, [dayCatKey]: finalPointsMap, [activeCategory]: finalPointsMap };
      targetDaysArray.forEach(d => {
        next[`${d}_${activeCategory}`] = finalPointsMap;
        if (aliasKeyForPeak) {
          next[`${d}_${aliasKeyForPeak}`] = finalPointsMap;
        }
      });
      return next;
    });

    // If Apply to Runtime was clicked directly, also persist to /api/opw/save-to-code so old rules are permanently deleted on disk & RDS
    if (!isCodebaseSave && typeof fetch !== 'undefined') {
      try {
        const completeRulesPayload = finalRules.map(r => ({
          description: r.description,
          points: r.points,
          note: `Calibrated Rules (${activeCategoryConfig.label}): ${r.points > 0 ? '+' : ''}${r.points} pts`
        }));
        const categoriesPayload: Record<string, { rules: typeof completeRulesPayload; targetObjective: string }> = {
          [activeCategory]: { rules: completeRulesPayload, targetObjective: activeCategoryConfig.targetObjective }
        };
        if (aliasKeyForPeak) {
          categoriesPayload[aliasKeyForPeak] = { rules: completeRulesPayload, targetObjective: activeCategoryConfig.targetObjective };
        }
        await fetch('/api/opw/save-to-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day: effectiveTargetDay,
            days: targetDaysArray,
            categories: categoriesPayload,
            customTriggers: []
          })
        });
      } catch (persistErr) {
        console.warn('[OPW Apply] Server persistence notice:', persistErr);
      }
    }

    setDailySettingsMeta(targetDaysArray, Date.now() + 1000);
    invalidateServerRulesCache();
    savePersistedDailySettings();

    // Clear any cached lockedOpwScores on match objects so Live Analysis & Seer Optimized Slips recompute with new points
    (matches || []).forEach(m => { delete (m as any).lockedOpwScores; });
    (allMatches || []).forEach(m => { delete (m as any).lockedOpwScores; });
    (rawDataset || []).forEach(m => { delete (m as any).lockedOpwScores; });

    showToast(`Applied ${finalRules.length} calibrated rules (${tunedRules.length} sample-tuned) to ${activeCategoryConfig.label} (${effectiveTargetDay.toUpperCase()})!`);

    clearOptimizedScoreCache();

    // Clean up locked slips on client localStorage, backend disk, and Supabase
    const targetCats = (activeCategory === 'top_12_value' || activeCategory === 'top_10_value')
      ? ['top_12_value', 'top_10_value', 'botb_best', 'high_confidence']
      : (activeCategory === 'bankers_dlive' || activeCategory === 'bankers_jackpot')
      ? [activeCategory, 'botb_best', 'high_confidence']
      : (activeCategory === 'upsets' || activeCategory === 'upset')
      ? ['upsets', 'upset']
      : [activeCategory];

    if (typeof window !== 'undefined') {
      const mergedMatchesMap = new Map<string, Match>();
      (matches || []).forEach(m => {
        const key = String(m.id || `${m.team1}_${m.team2}_${m.date}`);
        mergedMatchesMap.set(key, m);
      });
      (rawDataset || []).forEach(m => {
        const key = String(m.id || `${m.team1}_${m.team2}_${m.date}`);
        if (!mergedMatchesMap.has(key)) mergedMatchesMap.set(key, m);
      });
      const allAvailableMatches = Array.from(mergedMatchesMap.values());

      const distinctDates = new Set<string>();
      allAvailableMatches.forEach(m => {
        const d = getLogicalDate(m.date, m.time);
        if (d) distinctDates.add(d);
      });
      distinctDates.add(getAnalysisDateString());

      try {
        SESSION_SLIP_CACHE.clear();
        const toDelete: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith(`local_locked_slip_`) || key.startsWith(`seer_locked_slip_hash_`))) {
            const matchesDate = Array.from(distinctDates).some(d => key.includes(d));
            if (matchesDate && (activeCategory === 'all' || targetCats.some(c => key.endsWith(`_${c}`) || key.endsWith(`_ai_${c}`)))) {
              toDelete.push(key);
            }
          }
        }
        toDelete.forEach(k => window.localStorage.removeItem(k));
      } catch (e) {}

      // Delete from backend disk storage, PostgreSQL database, and Supabase and await completion
      try {
        await invalidateLockedSlipsForWeights(targetCats, distinctDates, [...CATEGORIES.map(c => c.id), 'botb_best', 'high_confidence']);
        for (const d of distinctDates) {
          for (const c of targetCats) {
            await deleteLockedSlip(d, c).catch(() => {});
          }
        }
      } catch (delErr) {
        console.warn('[OPW Slip Invalidation] Notice:', delErr);
      }

      // Immediately generate and permanently save the NEW locked slip using newly calibrated OPW points for every active logical date
      const primaryDate = Array.from(distinctDates)[0] || getAnalysisDateString();
      if (allAvailableMatches.length > 0) {
        try {
          clearOptimizedScoreCache();
          const newSlipsToSave: SeerLockedSlip[] = [];
          for (const slipDate of distinctDates) {
            const pool = allAvailableMatches.filter(m => {
              const mDate = getLogicalDate(m.date, m.time);
              return (mDate === slipDate || !mDate) && !isBannedFromSeerSlips(m);
            });
            if (pool.length > 0) {
              const dayOfWeek = getMatchDayOfWeek({ date: slipDate } as Match) || effectiveTargetDay;
              const generated = generateSeerSlips(
                pool,
                phaStatsMap || {},
                matchStars,
                liveViewType === 'jackpot',
                false,
                dayOfWeek
              );
              for (const catKey of targetCats) {
                const picksData = generated.live[catKey] || generated.spec[catKey] || generated.live[activeCategory] || generated.spec[activeCategory] || [];
                if (picksData && picksData.length > 0) {
                  const picks = picksData.map((p: any) => ({
                    match_id: p.match_id,
                    team: p.team || "",
                    prediction: p.prediction || "1",
                    primaryPrediction: p.prediction || "1",
                    odds: p.odds || "1.0",
                    reason: p.reason || "Automated Calibrated OPW Selection",
                    confidence: p.confidence || "100%",
                    category: catKey,
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
                    id: `${slipDate}_${catKey}`,
                    date: slipDate,
                    category: catKey,
                    picks: picks,
                    backups: [],
                    weightsAtTime: DEFAULT_WEIGHTS,
                    createdAt: new Date().toISOString(),
                    type: liveViewType === 'jackpot' ? 'jackpot' : 'daily',
                  };
                  const newAiSlip: SeerLockedSlip = {
                    id: `${slipDate}_ai_${catKey}`,
                    date: slipDate,
                    category: `ai_${catKey}`,
                    picks: picks,
                    backups: [],
                    weightsAtTime: DEFAULT_WEIGHTS,
                    createdAt: new Date().toISOString(),
                    type: liveViewType === 'jackpot' ? 'jackpot' : 'daily',
                  };

                  newSlipsToSave.push(newSlip, newAiSlip);
                  console.log(`[OPW Apply] Prepared newly calibrated sticky slip: ${newSlip.id} (${picks.length} picks)`);
                }
              }
            }
          }
          if (newSlipsToSave.length > 0) {
            await saveLockedSlipsBulk(newSlipsToSave, true);
          }
        } catch (genErr) {
          console.warn('[OPW Apply] Notice generating new slip:', genErr);
        }
      }

      // Verify runtime score parity against optimizer
      try {
        const effectiveDay = effectiveTargetDay;
        const completed = allAvailableMatches.filter(m => {
          const act = getActualResult(m.result || '');
          return act === '1' || act === 'X' || act === '2';
        });
        if (completed.length > 0) {
          const isTargetFn = (m: Match) => {
            const act = getActualResult(m.result || '');
            const mFav = getMarketFavorite(m);
            if (activeCategory === 'upsets' || activeCategory === 'underdog_only') {
              const underdog = mFav === '1' ? '2' : '1';
              return act === underdog;
            }
            return act === mFav;
          };
          const scored = completed.map(m => ({
            match: m,
            isTarget: isTargetFn(m),
            score: getOptimizedScoreDetailed(m, activeCategory, phaStatsMap || {}, effectiveDay).totalScore
          })).sort((a, b) => b.score - a.score);
          const firstTrapIdx = scored.findIndex(s => !s.isTarget);
          const runtimeTrapRank = firstTrapIdx >= 0 ? firstTrapIdx + 1 : scored.length;
          console.log(`[OPW Parity Check] ${activeCategoryConfig.label} applied at runtime on ${effectiveDay}. Runtime first trap rank: #${runtimeTrapRank}`);
        }
      } catch (err) {}

      window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', { detail: { category: activeCategory, day: effectiveTargetDay, purge: false, wipeSlips: false, refreshLocked: true, syncMainAlgo: true, date: primaryDate, targetDate: primaryDate, allDates: Array.from(distinctDates) } }));
      window.dispatchEvent(new CustomEvent('seerLockedSlipsUpdated', { detail: { category: activeCategory, day: effectiveTargetDay, purge: false, wipeSlips: false, refreshLocked: true, date: primaryDate, targetDate: primaryDate, allDates: Array.from(distinctDates) } }));
      window.dispatchEvent(new CustomEvent('opw-weights-updated', { detail: { category: activeCategory, day: effectiveTargetDay, purge: false, wipeSlips: false, refreshLocked: true, date: primaryDate, targetDate: primaryDate, allDates: Array.from(distinctDates) } }));
    }
  }, [effectiveRecommendations, activeSettings, activeCategoryConfig, selectedDay, liveMatchDay, datasetDay, activeCategory, isDeepOptimizing, deepStatus, deepPointsMap, deepCategoryPointsMap, deepCleanMatches, deepFirstTrapRank, deepQuality, matches, rawDataset, phaStatsMap, matchStars, liveViewType, showToast]);

  // Apply Recommendations across ALL Categories for the Selected Day and Main Algo
  const handleApplyRuntimeToAllCategories = useCallback(async () => {
    const mergedMatchesMap = new Map<string, Match>();
    (matches || []).forEach(m => {
      const key = String(m.id || `${m.team1}_${m.team2}_${m.date}`);
      mergedMatchesMap.set(key, m);
    });
    (rawDataset || []).forEach(m => {
      const key = String(m.id || `${m.team1}_${m.team2}_${m.date}`);
      if (!mergedMatchesMap.has(key)) mergedMatchesMap.set(key, m);
    });
    const allAvailableMatches = Array.from(mergedMatchesMap.values());

    const matchDaysInPool = new Set<DayOfWeek>();
    allAvailableMatches.forEach(m => {
      const d = getMatchDayOfWeek(m);
      if (d) matchDaysInPool.add(d);
    });

    CATEGORIES.forEach(cat => {
      let rulesToApply: { description: string; points: number }[];

      const targetDay = datasetDay;
      const dayCatKey = `${targetDay}_${cat.id}`;
      let deepMap = (cat.id === activeCategory && deepPointsMap && deepPointsMap.size > 0)
        ? deepPointsMap
        : deepCategoryPointsMap[dayCatKey];
      if (!deepMap || deepMap.size === 0) {
        const peakMem = loadOptimizerPeakMemory(targetDay, cat.id);
        if (peakMem?.points) {
          deepMap = new Map(Object.entries(peakMem.points));
        }
      }

      if (deepMap && deepMap.size > 0) {
        rulesToApply = Array.from(deepMap.entries())
          .map(([description, points]) => ({
            description,
            points: Math.max(isLeagueTrigger(description) ? getLeagueTriggerMaxPenalty(description) : -30, Math.min(40, points))
          }));
      } else if (cat.id === activeCategory && effectiveRecommendations.length > 0) {
        rulesToApply = effectiveRecommendations
          .map(r => ({
            description: r.description,
            points: Math.max(isLeagueTrigger(r.description) ? getLeagueTriggerMaxPenalty(r.description) : -30, Math.min(40, r.recommendedPoints))
          }));
      } else {
        const aliasKey = cat.id === 'upsets' ? 'upset' : (cat.id === 'upset' ? 'upsets' : (cat.id === 'top_12_value' ? 'top_10_value' : (cat.id === 'top_10_value' ? 'top_12_value' : (cat.id === 'value_bets' ? 'value_bet' : (cat.id === 'value_bet' ? 'value_bets' : cat.id)))));
        const existingRules = DAILY_OPTIMIZED_SETTINGS[targetDay]?.[cat.id]?.rules
          || DAILY_OPTIMIZED_SETTINGS[targetDay]?.[aliasKey]?.rules
          || OPTIMIZED_CATEGORY_SETTINGS[cat.id]?.rules
          || OPTIMIZED_CATEGORY_SETTINGS[aliasKey]?.rules;
        if (existingRules && existingRules.length > 0) {
          rulesToApply = existingRules.map(r => ({ description: r.description, points: r.points }));
        } else {
          const masterFallback = MASTER_RULES_MAP[cat.id] || MASTER_RULES_MAP[aliasKey];
          if (masterFallback && masterFallback.length > 0) {
            rulesToApply = masterFallback.map(r => ({ description: r.description, points: r.points }));
          } else {
            rulesToApply = [];
          }
        }
      }

      const finalRules = populateCategoryWithMasterRules(rulesToApply, cat.targetObjective, cat.id, selectedDay !== 'all' ? selectedDay : targetDay, { preserveExact: true });
      const existingSettings = (selectedDay !== 'all' ? DAILY_OPTIMIZED_SETTINGS[selectedDay]?.[cat.id] : undefined) ||
        (selectedDay !== 'all' ? DAILY_DEFAULT_CATEGORY_SETTINGS[selectedDay]?.[cat.id] : undefined) ||
        OPTIMIZED_CATEGORY_SETTINGS[cat.id] || {
        name: cat.label,
        description: cat.description,
        baseLogic: "Points based on Primary Pattern PHA %.",
        baseWeightIntervals: [
          { id: '1', min: 60, max: 100, points: 45, metric: 'pha_market_fav' },
          { id: '2', min: 50, max: 59.99, points: 40, metric: 'pha_market_fav' },
          { id: '3', min: 45, max: 49.99, points: 35, metric: 'pha_market_fav' },
          { id: '4', min: 40, max: 44.99, points: 25, metric: 'pha_market_fav' },
          { id: '5', min: 34, max: 39.99, points: 10, metric: 'pha_market_fav' },
          { id: '6', min: 0, max: 33.99, points: 5, metric: 'pha_market_fav' }
        ],
        rules: []
      };

      const updated = { ...existingSettings, rules: finalRules };
      const isActCat = cat.id === activeCategory;
      const activeCleanMetric = cleanMatchesBreakdown.totalTargets > 0 ? cleanMatchesBreakdown.cleanCount : (deepCleanMatches || 0);
      const activeTrapRankMetric = cleanMatchesBreakdown.totalTargets > 0 ? cleanMatchesBreakdown.firstTrapRank : (deepFirstTrapRank || 0);
      if (selectedDay !== 'all') {
        const targetDays = new Set<DayOfWeek>([selectedDay]);
        if (datasetDay) targetDays.add(datasetDay);
        if (liveMatchDay) targetDays.add(liveMatchDay);
        matchDaysInPool.forEach(d => targetDays.add(d));
        targetDays.forEach(d => {
          updateDailyOptimizedCategorySettings(d, cat.id, updated, true, { silent: true, source: 'codebase' });
          const existingPeak = !isActCat ? loadOptimizerPeakMemory(d, cat.id) : null;
          saveOptimizerPeakMemory(d, cat.id, {
            cleanTopMatches: isActCat ? activeCleanMetric : (existingPeak?.cleanTopMatches ?? 0),
            firstTrapRank: isActCat ? activeTrapRankMetric : (existingPeak?.firstTrapRank ?? 0),
            quality: isActCat ? (deepQuality || 0) : (existingPeak?.quality ?? 0),
            trapRanks: existingPeak?.trapRanks ?? [],
            trapGaps: existingPeak?.trapGaps ?? [],
            points: Object.fromEntries(finalRules.map(r => [r.description, r.points]))
          });
        });
      } else {
        updateOptimizedCategorySettings(cat.id, updated, undefined, { silent: true, source: 'codebase' });
        const allDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        allDays.forEach(d => {
          updateDailyOptimizedCategorySettings(d, cat.id, updated, true, { silent: true, source: 'codebase' });
          const existingPeak = !isActCat ? loadOptimizerPeakMemory(d, cat.id) : null;
          saveOptimizerPeakMemory(d, cat.id, {
            cleanTopMatches: isActCat ? activeCleanMetric : (existingPeak?.cleanTopMatches ?? 0),
            firstTrapRank: isActCat ? activeTrapRankMetric : (existingPeak?.firstTrapRank ?? 0),
            quality: isActCat ? (deepQuality || 0) : (existingPeak?.quality ?? 0),
            trapRanks: existingPeak?.trapRanks ?? [],
            trapGaps: existingPeak?.trapGaps ?? [],
            points: Object.fromEntries(finalRules.map(r => [r.description, r.points]))
          });
        });
      }
    });

    (matches || []).forEach(m => { delete (m as any).lockedOpwScores; });
    (allMatches || []).forEach(m => { delete (m as any).lockedOpwScores; });
    (rawDataset || []).forEach(m => { delete (m as any).lockedOpwScores; });
    savePersistedDailySettings();
    clearOptimizedScoreCache();

    if (typeof window !== 'undefined') {
      const distinctDates = new Set<string>();
      allAvailableMatches.forEach(m => {
        const d = getLogicalDate(m.date, m.time);
        if (d) distinctDates.add(d);
      });
      distinctDates.add(getAnalysisDateString());

      try {
        SESSION_SLIP_CACHE.clear();
        const toDelete: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith(`local_locked_slip_`) || key.startsWith(`seer_locked_slip_hash_`))) {
            const matchesDate = Array.from(distinctDates).some(d => key.includes(d));
            if (matchesDate) {
              toDelete.push(key);
            }
          }
        }
        toDelete.forEach(k => window.localStorage.removeItem(k));
      } catch (e) {}

      // Delete from backend disk storage and Supabase
      const allSlipCatIds = Array.from(new Set([...CATEGORIES.map(c => c.id), 'top_10_value', 'upset', 'botb_best', 'high_confidence']));
      await invalidateLockedSlipsForWeights('all', distinctDates, allSlipCatIds)
        .catch(err => console.warn('[OPW Slip Invalidation] Background error:', err));

      // Immediately generate and save locked slips for ALL categories across active logical dates
      if (allAvailableMatches.length > 0) {
        try {
          clearOptimizedScoreCache();
          const newSlipsToSave: SeerLockedSlip[] = [];
          const effDay = selectedDay !== 'all' ? selectedDay : (liveMatchDay || datasetDay);
          for (const slipDate of distinctDates) {
            const pool = allAvailableMatches.filter(m => {
              const mDate = getLogicalDate(m.date, m.time);
              return (mDate === slipDate || !mDate) && !isBannedFromSeerSlips(m);
            });
            if (pool.length > 0) {
              const dayOfWeek = getMatchDayOfWeek({ date: slipDate } as Match) || effDay;
              const generated = generateSeerSlips(
                pool,
                phaStatsMap || {},
                matchStars,
                liveViewType === 'jackpot',
                false,
                dayOfWeek
              );
              for (const catId of allSlipCatIds) {
                const picksData = generated.live[catId] || generated.spec[catId] || [];
                if (picksData && picksData.length > 0) {
                  const picks = picksData.map((p: any) => ({
                    match_id: p.match_id,
                    team: p.team || "",
                    prediction: p.prediction || "1",
                    primaryPrediction: p.prediction || "1",
                    odds: p.odds || "1.0",
                    reason: p.reason || "Automated Calibrated OPW Selection",
                    confidence: p.confidence || "100%",
                    category: catId,
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
                    id: `${slipDate}_${catId}`,
                    date: slipDate,
                    category: catId,
                    picks: picks,
                    backups: [],
                    weightsAtTime: DEFAULT_WEIGHTS,
                    createdAt: new Date().toISOString(),
                    type: liveViewType === 'jackpot' ? 'jackpot' : 'daily',
                  };
                  const newAiSlip: SeerLockedSlip = {
                    id: `${slipDate}_ai_${catId}`,
                    date: slipDate,
                    category: `ai_${catId}`,
                    picks: picks,
                    backups: [],
                    weightsAtTime: DEFAULT_WEIGHTS,
                    createdAt: new Date().toISOString(),
                    type: liveViewType === 'jackpot' ? 'jackpot' : 'daily',
                  };
                  newSlipsToSave.push(newSlip, newAiSlip);
                }
              }
            }
          }
          if (newSlipsToSave.length > 0) {
            await saveLockedSlipsBulk(newSlipsToSave, true);
          }
        } catch (genErr) {
          console.warn('[OPW Apply All] Notice generating new slips:', genErr);
        }
      }

      const effDay = selectedDay !== 'all' ? selectedDay : (liveMatchDay || 'sunday');
      const primaryDate = Array.from(distinctDates)[0] || getAnalysisDateString();
      window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', { detail: { category: 'all', day: effDay, purge: false, wipeSlips: false, refreshLocked: true, syncMainAlgo: true, date: primaryDate, targetDate: primaryDate, allDates: Array.from(distinctDates) } }));
      window.dispatchEvent(new CustomEvent('seerLockedSlipsUpdated', { detail: { category: 'all', day: effDay, purge: false, wipeSlips: false, refreshLocked: true, date: primaryDate, targetDate: primaryDate, allDates: Array.from(distinctDates) } }));
      window.dispatchEvent(new CustomEvent('opw-weights-updated', { detail: { category: 'all', day: effDay, purge: false, wipeSlips: false, refreshLocked: true, date: primaryDate, targetDate: primaryDate, allDates: Array.from(distinctDates) } }));
    }
    const dayLabel = selectedDay !== 'all' ? selectedDay.toUpperCase() : 'Main Algo';
    showToast(`Applied calibrated runtime weights across ALL 7 categories to ${dayLabel}!`);
  }, [activeCategory, effectiveRecommendations, rawDataset, datasetDay, phaStatsMap, matchStars, liveViewType, selectedDay, liveMatchDay, isDeepOptimizing, deepStatus, deepPointsMap, deepCategoryPointsMap, matches, showToast]);

  const handleResetToCodeDefaults = () => {
    resetToCodeDefaults(selectedDay !== 'all' ? selectedDay : undefined);
    setDeepPointsMap(null);
    setDeepCategoryPointsMap({});
    showToast(`Reset all categories to 100% calibrated codebase defaults!`);
  };

  const ALL_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  const toggleAdoptDay = (day: DayOfWeek) => {
    setSelectedAdoptDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const selectAllAdoptDays = () => {
    setSelectedAdoptDays(new Set(ALL_DAYS));
  };

  const clearAllAdoptDays = () => {
    setSelectedAdoptDays(new Set());
  };

  const handleConfirmAdopt = useCallback(async () => {
    if (selectedAdoptDays.size === 0) {
      showToast('Please select at least one day to adopt trigger points.');
      return;
    }

    const dayCatKey = `${selectedDay !== 'all' ? selectedDay : datasetDay}_${activeCategory}`;
    const isDeepCalibrated = isDeepOptimizing || deepStatus === 'converged' || !!(deepCategoryPointsMap[dayCatKey] && deepCategoryPointsMap[dayCatKey].size > 0);
    const deepMap = deepCategoryPointsMap[dayCatKey];

    const isUpsetsAdopt = activeCategory === 'upsets' || activeCategory === 'upset' || activeCategoryConfig.targetObjective === 'underdog_only';
    let tunedRules: { description: string; points: number }[];
    if (deepMap && deepMap.size > 0) {
      tunedRules = Array.from(deepMap.entries()).map(([description, points]) => {
        const minP = isLeagueTrigger(description) ? getLeagueTriggerMaxPenalty(description) : -30;
        const maxP = isLeagueTrigger(description) ? getLeagueTriggerMaxBonus(description, isUpsetsAdopt) : 40;
        return {
          description,
          points: Math.max(minP, Math.min(maxP, points))
        };
      });
    } else {
      tunedRules = effectiveRecommendations
        .filter(r => isDeepCalibrated ? true : (r.totalHits >= 1))
        .map(r => {
          const minP = isLeagueTrigger(r.description) ? getLeagueTriggerMaxPenalty(r.description) : -30;
          const maxP = isLeagueTrigger(r.description) ? getLeagueTriggerMaxBonus(r.description, isUpsetsAdopt) : 40;
          return {
            description: r.description,
            points: isDeepCalibrated
              ? Math.max(minP, Math.min(maxP, r.recommendedPoints))
              : (r.recommendedPoints !== 0 ? Math.max(minP, Math.min(maxP, r.recommendedPoints)) : 5)
          };
        });
    }

    const finalRules = populateCategoryWithMasterRules(
      tunedRules,
      activeCategoryConfig.targetObjective,
      activeCategoryConfig.id,
      selectedDay !== 'all' ? selectedDay : undefined,
      { preserveExact: !!isDeepCalibrated || !!(deepMap && deepMap.size > 0) }
    );

    const existingSettings = activeSettings || {
      name: activeCategoryConfig.label,
      description: activeCategoryConfig.description,
      baseLogic: "Points based on Primary Pattern PHA %.",
      baseWeightIntervals: [
        { id: '1', min: 60, max: 100, points: 45, metric: 'pha_market_fav' },
          { id: '2', min: 50, max: 59.99, points: 40, metric: 'pha_market_fav' },
          { id: '3', min: 45, max: 49.99, points: 35, metric: 'pha_market_fav' },
          { id: '4', min: 40, max: 44.99, points: 25, metric: 'pha_market_fav' },
          { id: '5', min: 34, max: 39.99, points: 10, metric: 'pha_market_fav' },
          { id: '6', min: 0, max: 33.99, points: 5, metric: 'pha_market_fav' }
      ],
      rules: []
    };

    const updated = {
      ...existingSettings,
      rules: finalRules
    };

    const adoptedDaysList = Array.from(selectedAdoptDays);
    adoptedDaysList.forEach(day => {
      updateDailyOptimizedCategorySettings(day, activeCategory, updated, adoptToMainAlgo);
    });

    if (adoptToMainAlgo) {
      updateOptimizedCategorySettings(activeCategory, updated);
    }

    clearOptimizedScoreCache();

    // Clean up locked slips on client localStorage and backend disk
    const targetCats = (activeCategory === 'top_12_value' || activeCategory === 'top_10_value')
      ? ['top_12_value', 'top_10_value', 'botb_best', 'high_confidence']
      : (activeCategory === 'bankers_dlive' || activeCategory === 'bankers_jackpot')
      ? [activeCategory, 'botb_best', 'high_confidence']
      : (activeCategory === 'upsets' || activeCategory === 'upset')
      ? ['upsets', 'upset']
      : [activeCategory];

    if (typeof window !== 'undefined') {
      const mergedMatchesMap = new Map<string, Match>();
      (matches || []).forEach(m => {
        const key = String(m.id || `${m.team1}_${m.team2}_${m.date}`);
        mergedMatchesMap.set(key, m);
      });
      (rawDataset || []).forEach(m => {
        const key = String(m.id || `${m.team1}_${m.team2}_${m.date}`);
        if (!mergedMatchesMap.has(key)) mergedMatchesMap.set(key, m);
      });
      const allAvailableMatches = Array.from(mergedMatchesMap.values());

      const distinctDates = new Set<string>();
      distinctDates.add(getAnalysisDateString());
      allAvailableMatches.forEach(m => {
        if (m.date) {
          distinctDates.add(getAnalysisDateString(m.date));
          distinctDates.add(getLogicalDate(m.date, m.time));
        }
      });

      try {
        SESSION_SLIP_CACHE.clear();
        const toDelete: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith('local_locked_slip_') || key.startsWith('seer_locked_slip_hash_'))) {
            if (activeCategory === 'all' || targetCats.some(c => key.endsWith(`_${c}`) || key.endsWith(`_ai_${c}`))) {
              toDelete.push(key);
            }
          }
        }
        toDelete.forEach(k => window.localStorage.removeItem(k));
      } catch (e) {}

      await invalidateLockedSlipsForWeights(targetCats, distinctDates, [...CATEGORIES.map(c => c.id), 'botb_best', 'high_confidence']);

      // Regenerate and re-lock slips for active dates
      if (allAvailableMatches.length > 0) {
        try {
          clearOptimizedScoreCache();
          const newSlipsToSave: SeerLockedSlip[] = [];
          for (const slipDate of distinctDates) {
            const pool = allAvailableMatches.filter(m => {
              const mDate = getLogicalDate(m.date, m.time);
              return (mDate === slipDate || !mDate) && !isBannedFromSeerSlips(m);
            });
            if (pool.length > 0) {
              const dayOfWeek = getMatchDayOfWeek({ date: slipDate } as Match) || adoptedDaysList[0];
              const generated = generateSeerSlips(
                pool,
                phaStatsMap || {},
                matchStars,
                liveViewType === 'jackpot',
                false,
                dayOfWeek
              );
              for (const catKey of targetCats) {
                const picksData = generated.live[catKey] || generated.spec[catKey] || generated.live[activeCategory] || generated.spec[activeCategory] || [];
                if (picksData && picksData.length > 0) {
                  const picks = picksData.map((p: any) => ({
                    match_id: p.match_id,
                    team: p.team || "",
                    prediction: p.prediction || "1",
                    primaryPrediction: p.prediction || "1",
                    odds: p.odds || "1.0",
                    reason: p.reason || "Automated Calibrated OPW Selection",
                    confidence: p.confidence || "100%",
                    category: catKey,
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
                  newSlipsToSave.push({
                    id: `${slipDate}_${catKey}`,
                    date: slipDate,
                    category: catKey,
                    picks,
                    backups: [],
                    weightsAtTime: DEFAULT_WEIGHTS,
                    createdAt: new Date().toISOString(),
                    type: liveViewType === 'jackpot' ? 'jackpot' : 'daily',
                  });
                }
              }
            }
          }
          if (newSlipsToSave.length > 0) {
            await saveLockedSlipsBulk(newSlipsToSave, true);
          }
        } catch (err) {
          console.warn('[OPW Adopt] Notice regenerating slips:', err);
        }
      }

      const primaryDate = Array.from(distinctDates)[0] || getAnalysisDateString();
      window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', { detail: { category: activeCategory, days: adoptedDaysList, purge: false, wipeSlips: false, refreshLocked: true, date: primaryDate, targetDate: primaryDate, allDates: Array.from(distinctDates) } }));
      window.dispatchEvent(new CustomEvent('seerLockedSlipsUpdated', { detail: { category: activeCategory, days: adoptedDaysList, purge: false, wipeSlips: false, refreshLocked: true, date: primaryDate, targetDate: primaryDate, allDates: Array.from(distinctDates) } }));
      window.dispatchEvent(new CustomEvent('opw-weights-updated', { detail: { category: activeCategory, days: adoptedDaysList, purge: false, wipeSlips: false, refreshLocked: true, date: primaryDate, targetDate: primaryDate, allDates: Array.from(distinctDates) } }));
    }

    setShowAdoptModal(false);
    const targetDaysLabel = adoptedDaysList.length === 1
      ? adoptedDaysList[0].toUpperCase()
      : adoptedDaysList.length === 7
      ? 'ALL 7 DAYS'
      : adoptedDaysList.map(d => d.slice(0, 3).toUpperCase()).join(', ');
    showToast(`Adopted ${finalRules.length} calibrated rules for ${activeCategoryConfig.label} to ${targetDaysLabel}${adoptToMainAlgo ? ' & Main Algo' : ''}!`);
  }, [selectedAdoptDays, adoptToMainAlgo, activeCategory, activeCategoryConfig, activeSettings, effectiveRecommendations, isDeepOptimizing, deepStatus, deepPointsMap, deepCategoryPointsMap, matches, rawDataset, phaStatsMap, matchStars, liveViewType, selectedDay, datasetDay, showToast]);

  const handleExportJSON = () => {
    const data = {
      category: activeCategory,
      day: selectedDay,
      generatedAt: new Date().toISOString(),
      baselineStats,
      rules: effectiveRecommendations.map(r => ({
        description: r.description,
        currentPoints: r.currentPoints,
        recommendedPoints: r.recommendedPoints,
        totalHits: r.totalHits,
        mfavHits: r.mfavHits,
        drawHits: r.drawHits,
        underdogHits: r.underdogHits,
        safePct: r.safePct,
        rationale: r.rationale
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opw_recommendations_${activeCategory}_${selectedDay}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported recommendations JSON successfully.');
  };

  const getDailyOpwFilename = useCallback((day: DayOfWeek | 'all'): string => {
    if (day === 'all') return 'src/opwalgo.tsx';
    if (day === 'monday') return 'src/mondayopw.tsx';
    return `src/opw${day}.tsx`;
  }, []);

  const generateCodeUpdateSnippet = useCallback(() => {
    const activeDayKey = selectedDay !== 'all' ? selectedDay : datasetDay;
    const targetFile = getDailyOpwFilename(activeDayKey);
    const deepMap = deepCategoryPointsMap[`${activeDayKey}_${activeCategory}`];
    
    const isUpsetsCat = activeCategory === 'upsets' || activeCategory === 'upset' || activeCategoryConfig.targetObjective === 'underdog_only';
    let nonZeroRules: { description: string; points: number; note: string }[];
    if (deepMap && deepMap.size > 0) {
      nonZeroRules = Array.from(deepMap.entries()).map(([description, points]) => {
        const finalPts = (points !== 0 || isUpsetsCat) ? points : 5;
        return {
          description,
          points: finalPts,
          note: `Deep Continuous Permutation Optimizer: ${finalPts > 0 ? '+' : ''}${finalPts} pts`
        };
      });
    } else {
      nonZeroRules = effectiveRecommendations.map(r => {
        const finalPts = (r.recommendedPoints !== 0 || isUpsetsCat) ? r.recommendedPoints : 5;
        return {
          description: r.description,
          points: finalPts,
          note: `${finalPts > 0 ? '+' : ''}${finalPts} pts (${r.mfavPct.toFixed(0)}% Mfav, ${r.drawPct.toFixed(0)}% Draw, ${r.underdogPct.toFixed(0)}% UD | ${r.totalHits} hits)`
        };
      });
    }
    
    const rulesCode = nonZeroRules.map(r => 
      `                { description: ${JSON.stringify(r.description)}, points: ${r.points} }, // ${r.note}`
    ).join('\n');

    return `// ============================================================================
// OPW ALGO CODE UPDATE: ${activeDayKey.toUpperCase()}
// Target File: ${targetFile}
// Category: ${activeCategoryConfig.label} ("${activeCategory}")
// Objective: ${activeCategoryConfig.targetObjective}
// Generated: ${new Date().toLocaleString()}
// Isolation Policy: Only ${activeDayKey.toUpperCase()} is adjusted. Other days are unaffected.
// ============================================================================

rules: populateCategoryWithMasterRules([
${rulesCode}
], '${activeCategoryConfig.targetObjective}', '${activeCategoryConfig.id}', '${activeDayKey}')`;
  }, [effectiveRecommendations, selectedDay, activeCategory, activeCategoryConfig, getDailyOpwFilename, deepCategoryPointsMap]);

  const generateAllCodeUpdatesSnippet = useCallback(() => {
    const activeDayKey = selectedDay !== 'all' ? selectedDay : datasetDay;
    const targetFile = getDailyOpwFilename(activeDayKey);
    const dayLabel = activeDayKey.toUpperCase();

    const sections: string[] = [
      `// ============================================================================`,
      `// SEER OPW ALGO CODE UPDATE: ${dayLabel}`,
      `// Generated: ${new Date().toLocaleString()}`,
      `// Target File: ${targetFile}`,
      `// Isolation Policy: Only ${dayLabel} is adjusted. Other daily files are unaffected.`,
      `// ============================================================================\n`
    ];

    CATEGORIES.forEach(cat => {
      sections.push(`// ----------------------------------------------------------------------------`);
      sections.push(`// Category: ${cat.label} ("${cat.id}") | Target Objective: '${cat.targetObjective}'`);
      sections.push(`// ----------------------------------------------------------------------------`);
      
      let rules: { description: string; points: number; note: string }[];
      const deepMap = deepCategoryPointsMap[`${activeDayKey}_${cat.id}`];
      const isCatUd = cat.id === 'upsets' || cat.id === 'upset' || cat.targetObjective === 'underdog_only';

      if (deepMap && deepMap.size > 0) {
        rules = Array.from(deepMap.entries()).map(([description, points]) => {
          const finalPts = (points !== 0 || isCatUd) ? points : 5;
          return {
            description,
            points: finalPts,
            note: `Deep Continuous Permutation Optimizer: ${finalPts > 0 ? '+' : ''}${finalPts} pts`
          };
        });
      } else if (cat.id === activeCategory && effectiveRecommendations.length > 0) {
        rules = effectiveRecommendations.map(r => {
          const finalPts = (r.recommendedPoints !== 0 || isCatUd) ? r.recommendedPoints : 5;
          return {
            description: r.description,
            points: finalPts,
            note: `${finalPts > 0 ? '+' : ''}${finalPts} pts (${r.mfavPct.toFixed(0)}% Mfav, ${r.drawPct.toFixed(0)}% Draw, ${r.underdogPct.toFixed(0)}% UD | ${r.totalHits} hits)`
          };
        });
      } else {
        const targetDay = selectedDay !== 'all' ? selectedDay : 'saturday';
        const aliasKey = cat.id === 'upsets' ? 'upset' : (cat.id === 'upset' ? 'upsets' : (cat.id === 'top_12_value' ? 'top_10_value' : (cat.id === 'top_10_value' ? 'top_12_value' : (cat.id === 'value_bets' ? 'value_bet' : (cat.id === 'value_bet' ? 'value_bets' : cat.id)))));
        const existingRules = DAILY_OPTIMIZED_SETTINGS[targetDay]?.[cat.id]?.rules
          || DAILY_OPTIMIZED_SETTINGS[targetDay]?.[aliasKey]?.rules
          || OPTIMIZED_CATEGORY_SETTINGS[cat.id]?.rules
          || OPTIMIZED_CATEGORY_SETTINGS[aliasKey]?.rules;
        if (existingRules && existingRules.length > 0) {
          rules = existingRules.map(r => {
            const finalPts = (r.points !== 0 || isCatUd) ? r.points : 5;
            return {
              description: r.description,
              points: finalPts,
              note: `Calibrated Runtime: ${finalPts > 0 ? '+' : ''}${finalPts} pts`
            };
          });
        } else {
          const masterFallback = MASTER_RULES_MAP[cat.id] || MASTER_RULES_MAP[aliasKey] || [];
          rules = masterFallback.map(r => {
            const finalPts = (r.points !== 0 || isCatUd) ? r.points : 5;
            return {
              description: r.description,
              points: finalPts,
              note: `Master Rules: ${finalPts > 0 ? '+' : ''}${finalPts} pts`
            };
          });
        }
      }

      const rulesCode = rules.map(r => 
        `                { description: ${JSON.stringify(r.description)}, points: ${r.points} }, // ${r.note}`
      ).join('\n');

      sections.push(`rules: populateCategoryWithMasterRules([\n${rulesCode}\n], '${cat.targetObjective}', '${cat.id}', '${activeDayKey}')\n`);
    });

    sections.push(`// ============================================================================`);
    sections.push(`// INTEGRATION FOR ${targetFile}:`);
    sections.push(`// Copy to ${targetFile} (get${activeDayKey.charAt(0).toUpperCase() + activeDayKey.slice(1)}CategorySettings).`);
    sections.push(`// ============================================================================`);

    return sections.join('\n');
  }, [effectiveRecommendations, activeCategory, rawDataset, phaStatsMap, matchStars, liveViewType, selectedDay, getDailyOpwFilename, deepCategoryPointsMap]);

  // Permanently save calibrated rules to codebase via /api/opw/save-to-code
  const handleSaveCalibratedRulesToCode = useCallback(async () => {
    let safetyTimer: any;
    try {
      setIsSavingCode(true);
      safetyTimer = setTimeout(() => {
        setIsSavingCode(false);
      }, 8000);
      await new Promise(r => setTimeout(r, 0));

      const targetDay = datasetDay;
      const dayForBackend = selectedDay === 'all' ? targetDay : selectedDay;
      
      // Strict Day Isolation: Only target the active day unless 'all' days is explicitly selected
      const daysArray: DayOfWeek[] = selectedDay === 'all'
        ? (['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as DayOfWeek[])
        : [dayForBackend];

      const categoriesPayload: Record<string, { rules: { description: string; points: number; note?: string }[]; targetObjective: string }> = {};

      // Day & Category Isolation: Only process the active category unless in Historical Universe mode with multi-category scope
      const categoriesToProcess = (datasetScope === 'history') 
        ? CATEGORIES 
        : [CATEGORIES.find(c => c.id === activeCategory)!].filter(Boolean);

      categoriesToProcess.forEach(cat => {
        const dayCatKey = `${dayForBackend}_${cat.id}`;
        let deepMap = (cat.id === activeCategory && allTimeBestPeakRef.current?.category === activeCategory && allTimeBestPeakRef.current.points.size > 0)
          ? allTimeBestPeakRef.current.points
          : ((cat.id === activeCategory && deepPointsCategoryRef.current === activeCategory && deepPointsMap && deepPointsMap.size > 0)
            ? deepPointsMap
            : deepCategoryPointsMap[dayCatKey]);
        if (!deepMap || deepMap.size === 0) {
          const peakMem = loadOptimizerPeakMemory(dayForBackend, cat.id);
          if (peakMem?.points) {
            deepMap = new Map(Object.entries(peakMem.points));
          }
        }

        const aliasKey = cat.id === 'upsets' ? 'upset' : (cat.id === 'upset' ? 'upsets' : (cat.id === 'top_12_value' ? 'top_10_value' : (cat.id === 'top_10_value' ? 'top_12_value' : (cat.id === 'value_bets' ? 'value_bet' : (cat.id === 'value_bet' ? 'value_bets' : cat.id)))));
        const existingRules = DAILY_OPTIMIZED_SETTINGS[dayForBackend]?.[cat.id]?.rules
          || DAILY_OPTIMIZED_SETTINGS[dayForBackend]?.[aliasKey]?.rules
          || OPTIMIZED_CATEGORY_SETTINGS[cat.id]?.rules
          || OPTIMIZED_CATEGORY_SETTINGS[aliasKey]?.rules
          || MASTER_RULES_MAP[cat.id]
          || MASTER_RULES_MAP[aliasKey]
          || [];

        // 1. Seed with existing saved rules for this day & category so untuned triggers retain their exact points.
        // 2. Overlay deepMap so tuned triggers strictly replace old points.
        const isCatUpsets = cat.id === 'upsets' || cat.id === 'upset' || cat.targetObjective === 'underdog_only';
        const mergedMap = new Map<string, number>();
        existingRules.forEach(r => {
          if (r.description && typeof r.points === 'number' && (isCatUpsets || r.points !== 0)) {
            mergedMap.set(r.description, r.points);
          }
        });

        if (deepMap && deepMap.size > 0) {
          deepMap.forEach((pts, desc) => {
            if (desc && typeof pts === 'number' && (isCatUpsets || pts !== 0)) {
              mergedMap.set(desc, pts);
            }
          });
        } else if (cat.id === activeCategory && effectiveRecommendations.length > 0) {
          effectiveRecommendations.forEach(r => {
            if (r.description && typeof r.recommendedPoints === 'number' && (isCatUpsets || r.recommendedPoints !== 0)) {
              mergedMap.set(r.description, r.recommendedPoints);
            }
          });
        }

        const rules = Array.from(mergedMap.entries()).map(([description, points]) => ({
          description,
          points,
          note: `Calibrated Rules (${cat.label}): ${points > 0 ? '+' : ''}${points} pts`
        }));

        const completeRules = populateCategoryWithMasterRules(rules, cat.targetObjective, cat.id, dayForBackend, { preserveExact: true }).map(r => ({
          description: r.description,
          points: r.points,
          note: `Calibrated Rules (${cat.label}): ${r.points > 0 ? '+' : ''}${r.points} pts`
        }));

        categoriesPayload[cat.id] = {
          rules: completeRules,
          targetObjective: cat.targetObjective
        };

        const payloadAliasKey = cat.id === 'top_12_value' ? 'top_10_value'
          : (cat.id === 'top_10_value' ? 'top_12_value'
          : (cat.id === 'upsets' ? 'upset'
          : (cat.id === 'upset' ? 'upsets'
          : (cat.id === 'bankers_dlive' ? 'banker'
          : (cat.id === 'value_bets' ? 'value_bet'
          : (cat.id === 'value_bet' ? 'value_bets' : undefined))))));
        if (payloadAliasKey) {
          categoriesPayload[payloadAliasKey] = {
            rules: completeRules,
            targetObjective: cat.targetObjective
          };
        }
      });

      const approvedList: any[] = [];

      const res = await fetch('/api/opw/save-to-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: dayForBackend,
          days: daysArray,
          categories: categoriesPayload,
          customTriggers: approvedList
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to save to code');
      }

      // Automatically sync runtime weights & localStorage for this specific day and category
      try {
        await handleApplyRecommendations(true);
        setDailySettingsMeta(daysArray, Date.now() + 1000);
        invalidateServerRulesCache();
        savePersistedDailySettings();
      } catch (applyErr) {
        console.warn('[OPW Save] Runtime sync warning:', applyErr);
      }

      showToast(`Permanently saved calibrated rules to codebase (${dayForBackend.toUpperCase()} - ${activeCategoryConfig.label}) and applied to runtime!`);
    } catch (err: any) {
      console.error("Failed to save to code:", err);
      showToast(`Error saving to code: ${err.message}`);
    } finally {
      if (safetyTimer) clearTimeout(safetyTimer);
      setIsSavingCode(false);
    }
  }, [selectedDay, liveMatchDay, datasetDay, deepPointsMap, deepCategoryPointsMap, activeCategory, effectiveRecommendations, rawDataset, phaStatsMap, matchStars, liveViewType, handleApplyRecommendations, showToast]);

  const handleCopyReport = () => {
    const lines = [
      `# OPW Point Recommendations: ${activeCategoryConfig.label} (${selectedDay.toUpperCase()})`,
      `Completed Matches: ${baselineStats.totalCompleted} (Mfav: ${baselineStats.totalMfav}, Draw: ${baselineStats.totalDraw}, Underdog: ${baselineStats.totalUnderdog})`,
      `Baseline Safe (M+D): ${baselineStats.baseSafePct.toFixed(1)}% | Base UD: ${baselineStats.baseUdPct.toFixed(1)}%`,
      '',
      '| Trigger | Rec Pts | Curr Pts | Hits | Mfav% | Draw% | UD% | Safe% | Rationale |',
      '|---|---|---|---|---|---|---|---|---|'
    ];
    effectiveRecommendations.filter(r => r.recommendedPoints !== 0).forEach(r => {
      lines.push(`| ${r.description} | **${r.recommendedPoints > 0 ? '+' : ''}${r.recommendedPoints}** | ${r.currentPoints} | ${r.totalHits} | ${r.mfavPct.toFixed(0)}% | ${r.drawPct.toFixed(0)}% | ${r.underdogPct.toFixed(0)}% | ${r.safePct.toFixed(0)}% | ${r.rationale} |`);
    });
    navigator.clipboard.writeText(lines.join('\n'));
    showToast('Markdown summary copied to clipboard.');
  };

  const activeTabRecommendations = useMemo(() => {
    return triggersViewTab === 'core'
      ? effectiveRecommendations.filter(r => !isLeagueTrigger(r.description))
      : effectiveRecommendations.filter(r => isLeagueTrigger(r.description));
  }, [effectiveRecommendations, triggersViewTab, isLeagueTrigger]);

  const bonusCount = activeTabRecommendations.filter(r => r.recommendedPoints > 0).length;
  const penaltyCount = activeTabRecommendations.filter(r => r.recommendedPoints < 0).length;
  const mismatchCount = activeTabRecommendations.filter(r => r.recommendedPoints !== r.currentPoints).length;

  return (
    <div className="space-y-6 pb-12 text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-lg shadow-xl font-medium flex items-center gap-3 animate-fade-in border border-emerald-400">
          <CheckCircle2 size={18} />
          {toastMessage}
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
            title="Return to Match Analysis"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                <Sparkles size={20} />
              </div>
              <h1 className="text-xl font-bold text-white tracking-wide">
                {titlePrefix ? `${titlePrefix} ` : ''}OPW Point Recommendations & Algorithm Tuning
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono font-semibold">
                {selectedDay !== 'all' ? `${selectedDay.toUpperCase()} MATCH DAY` : 'ALL DAYS'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Active Scope: <span className="text-indigo-300 font-mono font-semibold">{getDailyOpwFilename(selectedDay)}</span> & <span className="text-emerald-300 font-mono font-semibold">Main OPW Algo</span> (other daily files isolated).
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full sm:w-auto">
          <button
            onClick={handleCopyReport}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition"
            title="Copy Markdown summary report"
          >
            <Copy size={14} /> Copy Report
          </button>
          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition"
            title="Export recommendations as JSON"
          >
            <Download size={14} /> Export JSON
          </button>
          <button
            onClick={() => { setCodeModalTab('category'); setShowCopyCodeModal(true); }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/30 flex items-center gap-1.5 transition"
            title="Generate permanent TypeScript code to update current daily OPW file"
          >
            <Sparkles size={14} /> Copy Code Update
          </button>
          <button
            onClick={() => { setCodeModalTab('all'); setShowCopyCodeModal(true); }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/30 flex items-center gap-1.5 transition"
            title="Generate permanent code updates for ALL categories, ALL days and master catalog"
          >
            <Sparkles size={14} /> Copy All Code Updates
          </button>
          <button
            onClick={handleSaveCalibratedRulesToCode}
            disabled={isSavingCode}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg transition ${
              isSavingCode
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30 border border-emerald-400'
            }`}
            title="Directly write calibrated rules to codebase files on disk"
          >
            {isSavingCode ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {isSavingCode ? 'Saving to Code...' : 'Save to Codebase'}
          </button>
          {datasetScope === 'history' && (
            <button
              onClick={() => setShowAdoptModal(true)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30 flex items-center gap-1.5 transition"
              title="Adopt calibrated trigger points to selected daily algos (Monday - Sunday)"
            >
              <Layers size={14} /> Adopt to Daily Algos (Mon–Sun)
            </button>
          )}
          <button
            onClick={handleApplyRecommendations}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 transition"
            title="Commit recommended points for current category to live runtime settings"
          >
            <Play size={14} className="fill-white" /> Apply to Runtime
          </button>
          <button
            onClick={handleApplyRuntimeToAllCategories}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white shadow-lg shadow-teal-900/30 flex items-center gap-1.5 transition"
            title="Commit tuned weights across ALL categories and ALL days to live runtime settings"
          >
            <Play size={14} className="fill-white" /> Apply Runtime to All Categories
          </button>
          <button
            onClick={handleResetToCodeDefaults}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition"
            title="Reset active weights to the compiled codebase rules (clears any stale browser cache)"
          >
            <RotateCcw size={14} /> Reset to Code Rules
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-2 px-2 pb-1 scroll-smooth">
        {CATEGORIES.map(c => {
          const isActive = activeCategory === c.id;
          return (
            <button
              key={c.id}
              onClick={() => {
                if (c.id === activeCategory) return;
                setActiveCategory(c.id);
                deepPointsCategoryRef.current = c.id;
                const targetDay = selectedDay !== 'all' ? selectedDay : datasetDay;
                const dayCatKey = `${targetDay}_${c.id}`;
                const aliasCatId = c.id === 'top_12_value' ? 'top_10_value' 
                  : (c.id === 'upsets' ? 'upset' 
                  : (c.id === 'upset' ? 'upsets' 
                  : (c.id === 'bankers_dlive' ? 'banker' 
                  : (c.id === 'banker' ? 'bankers_dlive' : undefined))));
                const existing = deepCategoryPointsMapRef.current[dayCatKey] || (aliasCatId ? deepCategoryPointsMapRef.current[`${targetDay}_${aliasCatId}`] : undefined);
                if (existing && existing.size > 0) {
                  setDeepPointsMap(new Map(existing));
                } else {
                  const persistedRules = DAILY_OPTIMIZED_SETTINGS[targetDay]?.[c.id]?.rules
                    || (aliasCatId ? DAILY_OPTIMIZED_SETTINGS[targetDay]?.[aliasCatId]?.rules : undefined);
                  const isCatUd = c.id === 'upsets' || c.id === 'upset' || c.targetObjective === 'underdog_only';
                  if (persistedRules && persistedRules.length > 0) {
                    const sanitized = sanitizeRulePolarity(persistedRules, c.id, { preserveExact: true, day: targetDay });
                    const restoredMap = new Map(sanitized.filter(r => isCatUd || r.points !== 0).map(r => [r.description, r.points]));
                    deepCategoryPointsMapRef.current[dayCatKey] = restoredMap;
                    setDeepPointsMap(restoredMap);
                  } else {
                    const peakMem = loadOptimizerPeakMemory(targetDay, c.id) || (aliasCatId ? loadOptimizerPeakMemory(targetDay, aliasCatId) : null);
                    if (peakMem?.points && Object.keys(peakMem.points).length > 0) {
                      const sanitized = sanitizeRulePolarity(peakMem.points, c.id, { preserveExact: true, day: targetDay });
                      const restoredMap = new Map(Object.entries(sanitized));
                      deepCategoryPointsMapRef.current[dayCatKey] = restoredMap;
                      setDeepPointsMap(restoredMap);
                    } else {
                      setDeepPointsMap(null);
                    }
                  }
                }
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap border ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-900/40'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border-slate-800 hover:bg-slate-800/80'
              }`}
            >
              <Layers size={13} />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Control Filter Bar: Timeframe & Dataset Scope */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        {/* Day Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Timeframe:</span>
          {(['all', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(d => {
            const isSel = selectedDay === d;
            return (
              <button
                key={d}
                onClick={() => { userPickedDayRef.current = true; setSelectedDay(d); }}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition border ${
                  isSel
                    ? 'bg-purple-600 text-white border-purple-500 font-bold'
                    : 'bg-slate-950/60 text-slate-400 hover:text-white border-slate-800'
                }`}
              >
                {d === 'all' ? 'Overall (All Days)' : d}
              </button>
            );
          })}
        </div>

        {/* Dataset Scope */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dataset Scope:</span>
          {(['live', 'history', 'all'] as const).map(scope => {
            const isSel = datasetScope === scope;
            return (
              <button
                key={scope}
                onClick={() => {
                  setDatasetScope(scope);
                  userPickedDayRef.current = false;
                  if (scope === 'history') {
                    setSelectedDay('all');
                  } else if (scope === 'live') {
                    setSelectedDay(initialDay && initialDay !== 'all' ? initialDay : liveMatchDay);
                  }
                }}
                className={`px-3 py-1 rounded-md text-xs font-medium uppercase transition border ${
                  isSel
                    ? 'bg-cyan-600 text-white border-cyan-500 font-bold'
                    : 'bg-slate-950/60 text-slate-400 hover:text-white border-slate-800'
                }`}
              >
                {scope === 'live' ? 'Live Matches' : scope === 'history' ? 'History' : 'Combined'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase font-semibold">Completed Matches</p>
          <p className="text-2xl font-bold font-mono text-white mt-1">{baselineStats.totalCompleted}</p>
          <p className="text-[11px] text-slate-500 mt-1">in {activeCategoryConfig.label}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-emerald-400 uppercase font-semibold">Market Fav Wins</p>
          <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">{baselineStats.totalMfav}</p>
          <p className="text-[11px] text-emerald-500/80 mt-1">{baselineStats.baseMfavPct.toFixed(1)}% base rate</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-amber-400 uppercase font-semibold">Draw Outcomes</p>
          <p className="text-2xl font-bold font-mono text-amber-400 mt-1">{baselineStats.totalDraw}</p>
          <p className="text-[11px] text-amber-500/80 mt-1">{baselineStats.baseDrawPct.toFixed(1)}% base rate</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-rose-400 uppercase font-semibold">Underdog Wins</p>
          <p className="text-2xl font-bold font-mono text-rose-400 mt-1">{baselineStats.totalUnderdog}</p>
          <p className="text-[11px] text-rose-500/80 mt-1">{baselineStats.baseUdPct.toFixed(1)}% trap rate</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-indigo-400 uppercase font-semibold">Bonus Triggers</p>
          <p className="text-2xl font-bold font-mono text-indigo-400 mt-1">+{bonusCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Recommended bonuses</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-purple-400 uppercase font-semibold">Penalty Triggers</p>
          <p className="text-2xl font-bold font-mono text-purple-400 mt-1">-{penaltyCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Trap suppressors</p>
        </div>
      </div>

      {/* Deep Continuous Multi-Iteration Optimizer HUD Panel */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/70 border border-indigo-500/40 rounded-xl p-5 shadow-2xl relative overflow-hidden">
        {/* Ambient glow when running */}
        {isDeepOptimizing && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 animate-pulse" />
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-500/20 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border ${
              isDeepOptimizing
                ? 'bg-indigo-600/30 border-indigo-400 text-indigo-300 shadow-lg shadow-indigo-500/20'
                : deepStatus === 'converged'
                ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              <Cpu size={22} className={isDeepOptimizing ? 'animate-pulse text-indigo-300' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                  <span>
                    {datasetScope === 'history'
                      ? '🧠 OPW Self-Learn Engine (Historical Universe)'
                      : 'Live Continuous Permutation Optimizer'}
                  </span>
                </h3>
                <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider border ${
                  deepStatus === 'running'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    : deepStatus === 'converged'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : deepStatus === 'paused'
                    ? 'bg-slate-700/50 text-slate-300 border-slate-600'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700'
                }`}>
                  {deepStatus}
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider bg-indigo-900/60 text-indigo-300 border border-indigo-500/40">
                  {datasetScope === 'history'
                    ? `Historical Universe (${completedMatches.length.toLocaleString()} matches)`
                    : datasetScope === 'live'
                    ? `Live Session (${completedMatches.length.toLocaleString()} matches)`
                    : `Combined (${completedMatches.length.toLocaleString()} matches)`}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {datasetScope === 'history'
                  ? 'Executes high-compute permutation learning across thousands of historical matches to discover durable trigger points for daily algo adoption.'
                  : 'Executes continuous permutation search on active live session matches to raise winning matches and distill underdog traps to the bottom.'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {datasetScope === 'history' ? (
              /* HISTORY MODE: Self-Learn & Adopt to Daily Algos ONLY */
              <>
                {isDeepOptimizing ? (
                  <button
                    onClick={pauseDeepOptimization}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/30 flex items-center gap-1.5 transition"
                  >
                    <Pause size={14} /> Pause Self-Learn
                  </button>
                ) : (
                  <button
                    onClick={startDeepOptimization}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white shadow-lg shadow-indigo-900/40 flex items-center gap-1.5 transition"
                  >
                    <Zap size={14} className="fill-white" />
                    {deepComputations > 0
                      ? 'Resume Self-Learn Engine'
                      : '🧠 Start Self-Learn on Historical Universe'}
                  </button>
                )}

                <button
                  onClick={() => setShowAdoptModal(true)}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/40 flex items-center gap-1.5 transition"
                  title="Adopt calibrated trigger points to selected daily algos (e.g. Saturday only, or all days)"
                >
                  <Layers size={14} /> Adopt to Daily Algos (Mon–Sun)
                </button>


                {deepComputations > 0 && !isDeepOptimizing && (
                  <>
                    <button
                      onClick={handleApplyRecommendations}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/40 flex items-center gap-1.5 transition"
                      title="Permanently save calibrated weights to runtime and browser storage"
                    >
                      <CheckCircle2 size={14} /> Save Calibrations
                    </button>
                    <button
                      onClick={resetDeepOptimization}
                      className="p-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
                      title="Reset Self-Learn Optimizer"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </>
                )}

                <button
                  onClick={startBatchOptimizeAll}
                  disabled={isDeepOptimizing}
                  className={`px-4 py-2 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                    isDeepOptimizing
                      ? 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed'
                      : 'bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border-purple-500/40 shadow-lg shadow-purple-950/50'
                  }`}
                  title="Iteratively run deep optimization across all 7 categories and all days"
                >
                  <Sparkles size={14} />
                  Batch Optimize All Categories
                </button>
              </>
            ) : (
              /* LIVE MODE: Continuous Optimizer & Batch Optimize All Categories ONLY */
              <>
                {isDeepOptimizing ? (
                  <button
                    onClick={pauseDeepOptimization}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/30 flex items-center gap-1.5 transition"
                  >
                    <Pause size={14} /> Pause Optimizer
                  </button>
                ) : (
                  <button
                    onClick={startDeepOptimization}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-900/40 flex items-center gap-1.5 transition"
                  >
                    <Zap size={14} className="fill-white" />
                    {deepComputations > 0 ? 'Resume Deep Optimizer' : 'Run Deep Continuous Optimizer'}
                    {` (${selectedDay === 'all' ? 'OVERALL' : selectedDay.toUpperCase()})`}
                  </button>
                )}

                {savedPeakMemory && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/90 border border-indigo-500/30 rounded-lg text-xs font-mono text-indigo-300 shadow">
                    <span className="text-[10px] text-slate-400">⚡ Peak Memory:</span>
                    <span className="font-bold text-emerald-400">{savedPeakMemory.cleanTopMatches} Clean</span>
                    <span className="text-[10px] text-slate-400">(T1: #{savedPeakMemory.firstTrapRank ?? '—'})</span>
                    <button
                      onClick={handleClearPeakMemory}
                      className="ml-1 text-[10px] text-rose-400 hover:text-rose-300 underline font-sans cursor-pointer"
                      title="Clear saved peak memory to start afresh from default rules"
                    >
                      Reset
                    </button>
                  </div>
                )}

                {deepComputations > 0 && !isDeepOptimizing && (
                  <>
                    <button
                      onClick={handleApplyRecommendations}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/40 flex items-center gap-1.5 transition"
                      title="Permanently save calibrated weights to runtime and browser storage"
                    >
                      <CheckCircle2 size={14} /> Save Calibrations
                    </button>
                    <button
                      onClick={resetDeepOptimization}
                      className="p-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
                      title="Reset Deep Optimizer"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </>
                )}

                <button
                  onClick={startBatchOptimizeAll}
                  disabled={isDeepOptimizing}
                  className={`px-4 py-2 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 ${
                    isDeepOptimizing
                      ? 'bg-slate-800/50 text-slate-500 border-slate-800 cursor-not-allowed'
                      : 'bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border-purple-500/40 shadow-lg shadow-purple-950/50'
                  }`}
                  title="Iteratively run deep optimization across all 7 categories and all days"
                >
                  <Sparkles size={14} />
                  Batch Optimize All Categories
                </button>
              </>
            )}
          </div>
        </div>

        {/* Batch Progress Banner if batch running */}
        {deepBatchProgress && (
          <div className="mb-4 p-3 rounded-lg bg-purple-950/50 border border-purple-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin text-purple-400" />
              <span className="text-purple-200">
                Batch Progress: Optimizing <strong>{deepBatchProgress.label}</strong> ({deepBatchProgress.current} of {deepBatchProgress.total} categories)...
              </span>
            </div>
            <div className="w-32 bg-slate-800 rounded-full h-2 overflow-hidden border border-purple-500/30">
              <div
                className="bg-purple-500 h-full transition-all duration-300"
                style={{ width: `${(deepBatchProgress.current / deepBatchProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Computations</span>
              <Activity size={13} className={isDeepOptimizing ? 'text-indigo-400 animate-pulse' : 'text-slate-500'} />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <p className="text-xl font-bold font-mono text-white">
                {deepComputations.toLocaleString()}
              </p>
              {isDeepOptimizing && deepEvalRate > 0 && (
                <span className="text-[11px] font-mono text-cyan-400 font-semibold">
                  ~{(deepEvalRate / 1000).toFixed(1)}k/s
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center justify-between font-mono">
              <span className={deepComputations >= 1000000 ? 'text-amber-400 font-semibold' : 'text-emerald-400/90'}>
                {deepComputations >= 1000000 ? 'L2 • Escalation (Max Unlock)' : 'L1 • Incremental (±5 / ±10)'}
              </span>
              {deepElapsedMs > 0 && (
                <span className="text-slate-400">
                  {(deepElapsedMs / 1000).toFixed(2)}s
                </span>
              )}
            </div>
          </div>

          {(() => {
            const displayCleanMatches = isDeepOptimizing
              ? deepCleanMatches
              : (cleanMatchesBreakdown.totalTargets > 0 ? cleanMatchesBreakdown.cleanCount : deepCleanMatches);
            const displayFirstTrapRank = isDeepOptimizing
              ? deepFirstTrapRank
              : (cleanMatchesBreakdown.totalTargets > 0 ? cleanMatchesBreakdown.firstTrapRank : deepFirstTrapRank);
            const displayTiedAtBoundary = isDeepOptimizing ? deepTiedAtBoundary : cleanMatchesBreakdown.tiedAtBoundary;
            const effectiveTargetFloor = deepTargetClean > 0 ? deepTargetClean : categoryHorizons.floor;
            const effectiveTargetCeiling = cleanMatchesBreakdown.totalTargets > 0
              ? cleanMatchesBreakdown.totalTargets
              : (deepTargetCeiling > 0 ? deepTargetCeiling : categoryHorizons.ceiling);
            return (
              <>
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold">Clean Target</span>
                      <button
                        type="button"
                        onClick={() => setIsCleanMatchesModalOpen(true)}
                        className="p-1 rounded bg-slate-900/90 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-200 border border-slate-700/80 hover:border-indigo-500/50 transition cursor-pointer"
                        title="View all Clean Matches, First Trap & exact OPW Trigger Points breakdown"
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                      deepConvergenceMode === 'perfect_100' || (effectiveTargetCeiling > 0 && displayCleanMatches >= effectiveTargetCeiling)
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : deepConvergenceMode === 'sweet_spot'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                        : displayCleanMatches >= effectiveTargetFloor && effectiveTargetFloor > 0
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-indigo-500/20 text-indigo-300'
                    }`}>
                      {deepConvergenceMode === 'perfect_100' || (effectiveTargetCeiling > 0 && displayCleanMatches >= effectiveTargetCeiling)
                        ? '100% PERFECT'
                        : deepConvergenceMode === 'sweet_spot'
                        ? 'SWEET SPOT'
                        : displayCleanMatches >= effectiveTargetFloor && effectiveTargetFloor > 0
                        ? `FRONTIER: +${displayCleanMatches - effectiveTargetFloor}`
                        : `GOAL: ${effectiveTargetFloor}`}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <p className={`text-xl font-bold font-mono ${
                      deepConvergenceMode === 'perfect_100' || deepConvergenceMode === 'sweet_spot' || (displayCleanMatches >= effectiveTargetFloor && effectiveTargetFloor > 0)
                        ? 'text-emerald-400'
                        : 'text-indigo-400'
                    }`}>
                      {effectiveTargetCeiling > 0 ? `${displayCleanMatches.toLocaleString()} / ${effectiveTargetCeiling.toLocaleString()}` : effectiveTargetFloor > 0 ? `${displayCleanMatches.toLocaleString()} / ${effectiveTargetFloor.toLocaleString()}` : '—'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCleanMatchesModalOpen(true)}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
                    >
                      Inspect ({displayCleanMatches})
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {displayCleanMatches > 0 && displayTiedAtBoundary > 0 && displayFirstTrapRank > displayCleanMatches + 1 ? (
                      <span className="text-slate-400">
                        {displayCleanMatches} clean • <span className="text-amber-300 font-mono font-semibold">{displayTiedAtBoundary} tied (#{(displayCleanMatches + 1)}–#{(displayCleanMatches + displayTiedAtBoundary)})</span> • Trap #1 at <span className="text-rose-400 font-mono font-semibold">#{displayFirstTrapRank}</span>
                      </span>
                    ) : displayFirstTrapRank > 0 && cleanMatchesBreakdown.firstTrap ? (
                      <span className="text-slate-400">
                        {displayCleanMatches} clean • Trap #1 at <span className="text-rose-400 font-mono font-semibold">#{displayFirstTrapRank}</span> ({cleanMatchesBreakdown.firstTrap.totalScore} pts)
                      </span>
                    ) : deepConvergenceMode === 'perfect_100'
                      ? 'All winners clean at the top'
                      : deepConvergenceMode === 'sweet_spot'
                      ? `Optimal sweet spot (floor ${effectiveTargetFloor} met)`
                      : displayCleanMatches >= effectiveTargetFloor && effectiveTargetFloor > 0
                      ? `Floor (${effectiveTargetFloor}) met • Climbing frontier`
                      : deepTargetsInTop5000 > 0
                      ? `${deepTargetsInTop5000.toLocaleString()} in top 5k • Target: 2,000`
                      : 'Clean picks before trap'}
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">Top 5 Trap Dispersion</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                      deepTrapDispersionHealth === 'HEALTHY'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : deepTrapDispersionHealth === 'MODERATE'
                        ? 'bg-teal-500/20 text-teal-300'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {deepTrapDispersionHealth === 'HEALTHY' ? 'HEALTHY SPREAD' : deepTrapDispersionHealth === 'MODERATE' ? 'MODERATE' : 'CLUSTERED'}
                    </span>
                  </div>

                  {deepComputations > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {/* Top 5 Trap Ladder Chips */}
                      <div className="grid grid-cols-5 gap-1 text-center font-mono">
                        <div className="bg-slate-900/90 border border-slate-800 rounded p-1">
                          <div className="text-[9px] text-amber-400 font-bold">T1</div>
                          <div className="text-xs font-bold text-white">#{deepTrapRanks[0] ?? deepFirstTrapRank}</div>
                        </div>
                        <div className="bg-slate-900/90 border border-slate-800 rounded p-1">
                          <div className="text-[9px] text-slate-400 font-bold">T2</div>
                          <div className="text-xs font-bold text-slate-200">#{deepTrapRanks[1] ?? '—'}</div>
                          {deepTrapGaps[1] !== undefined && <div className={`text-[8px] font-bold ${deepTrapGaps[1] >= 10 ? 'text-emerald-400' : 'text-slate-400'}`}>+{deepTrapGaps[1]}</div>}
                        </div>
                        <div className="bg-slate-900/90 border border-slate-800 rounded p-1">
                          <div className="text-[9px] text-slate-400 font-bold">T3</div>
                          <div className="text-xs font-bold text-slate-200">#{deepTrapRanks[2] ?? '—'}</div>
                          {deepTrapGaps[2] !== undefined && <div className={`text-[8px] font-bold ${deepTrapGaps[2] >= 10 ? 'text-emerald-400' : 'text-slate-400'}`}>+{deepTrapGaps[2]}</div>}
                        </div>
                        <div className="bg-slate-900/90 border border-slate-800 rounded p-1">
                          <div className="text-[9px] text-slate-400 font-bold">T4</div>
                          <div className="text-xs font-bold text-slate-200">#{deepTrapRanks[3] ?? '—'}</div>
                          {deepTrapGaps[3] !== undefined && <div className={`text-[8px] font-bold ${deepTrapGaps[3] >= 10 ? 'text-emerald-400' : 'text-slate-400'}`}>+{deepTrapGaps[3]}</div>}
                        </div>
                        <div className="bg-slate-900/90 border border-slate-800 rounded p-1">
                          <div className="text-[9px] text-slate-400 font-bold">T5</div>
                          <div className="text-xs font-bold text-slate-200">#{deepTrapRanks[4] ?? '—'}</div>
                          {deepTrapGaps[4] !== undefined && <div className={`text-[8px] font-bold ${deepTrapGaps[4] >= 10 ? 'text-emerald-400' : 'text-slate-400'}`}>+{deepTrapGaps[4]}</div>}
                        </div>
                      </div>

                      {/* Phase Status & Slack Guardrail */}
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="font-semibold text-indigo-300">
                          Phase {deepOptimizerPhase.currentPhase}/5: {deepOptimizerPhase.currentPhase === 1 ? 'Clean Max' : `Gap T${deepOptimizerPhase.currentPhase}`}
                        </span>
                        {deepOptimizerPhase.currentPhase >= 2 && deepOptimizerPhase.establishedRanks.length > 0 ? (
                          <span className="text-[9px] font-mono text-emerald-400">
                            Locked: R1 ≥ #{deepOptimizerPhase.establishedRanks[0] ?? deepCleanMatches + 1}
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono text-slate-500">
                            {deepCleanMatches} clean winners before T1
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xl font-bold font-mono mt-1 text-slate-500">
                        —
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Awaiting continuous optimization
                      </p>
                    </>
                  )}

                  {deepComputations > 0 && deepHorizonMetrics && (
                    <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
                      <span>Traps:</span>
                      <span className={deepHorizonMetrics.h500.traps <= 25 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-semibold'}>
                        {deepHorizonMetrics.h500.traps}/500
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className={deepHorizonMetrics.h1000.traps <= 50 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-semibold'}>
                        {deepHorizonMetrics.h1000.traps}/1k
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className={deepHorizonMetrics.h2000.traps <= 100 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-semibold'}>
                        {deepHorizonMetrics.h2000.traps}/2k
                      </span>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">
                {activeCategoryConfig.label} Purity
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                deepPurityPct >= 100 ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-slate-400'
              }`}>
                {deepPurityPct >= 100 ? '100%' : 'Purity'}
              </span>
            </div>
            <p className={`text-xl font-bold font-mono mt-1 ${
              deepPurityPct >= 100 ? 'text-emerald-400' : deepPurityPct >= 80 ? 'text-indigo-400' : 'text-amber-400'
            }`}>
              {deepPurityPct > 0 ? `${deepPurityPct.toFixed(1)}%` : '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Top {activeCategoryConfig.targetCapacity} purity rate
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Separation Buffer</span>
              <span className="text-[10px] text-slate-500 font-mono">MinTarget - MaxTrap</span>
            </div>
            <p className={`text-xl font-bold font-mono mt-1 ${
              deepComputations === 0 ? 'text-slate-400' : deepBufferMargin > 0 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {deepComputations > 0 ? `${deepBufferMargin >= 0 ? '+' : ''}${deepBufferMargin.toFixed(1)} pts` : '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {deepInversions === 0 ? '0 inversions' : `${deepInversions} inversions`}
            </p>
          </div>
        </div>

        {/* Multi-Horizon Trap & Target Density Grid */}
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-300">
                Multi-Horizon Trap & Target Density
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Volume Progression
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              Cumulative traps & target win rate across top volume horizons
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
            {[
              { label: 'Top 500', data: deepHorizonMetrics.h500, maxAcceptableTraps: 25 },
              { label: 'Top 1,000', data: deepHorizonMetrics.h1000, maxAcceptableTraps: 50 },
              { label: 'Top 1,500', data: deepHorizonMetrics.h1500, maxAcceptableTraps: 80 },
              { label: 'Top 2,000', data: deepHorizonMetrics.h2000, maxAcceptableTraps: 120 },
              { label: 'Top 3,000', data: deepHorizonMetrics.h3000, maxAcceptableTraps: 200 }
            ].map((h, idx) => {
              const trapPct = h.data.total > 0 ? (h.data.traps / h.data.total) * 100 : 0;
              const isOptimal = h.data.traps <= h.maxAcceptableTraps && h.data.total > 0;
              return (
                <div key={idx} className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400 font-semibold">{h.label}</span>
                    <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold ${
                      isOptimal ? 'bg-emerald-500/20 text-emerald-400' : trapPct <= 10 ? 'bg-indigo-500/20 text-indigo-300' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {h.data.total > 0 ? `${h.data.winRate.toFixed(1)}% WIN` : '—'}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className={`text-base font-bold font-mono ${
                      isOptimal ? 'text-emerald-400' : trapPct <= 10 ? 'text-indigo-400' : 'text-amber-400'
                    }`}>
                      {deepComputations > 0 ? h.data.traps.toLocaleString() : '—'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      / {h.data.horizon.toLocaleString()} traps
                    </span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1 font-mono">
                    {deepComputations > 0 ? `${h.data.targets.toLocaleString()} targets (${trapPct.toFixed(1)}% traps)` : 'Awaiting computation'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>




      {/* Trigger Recommendations Table Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        {/* Primary View Switcher: Core Triggers vs League Triggers */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setTriggersViewTab('core'); setRecommendationFilter('all'); }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition border ${
                triggersViewTab === 'core'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>🎯 Core Triggers</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900/80 font-mono font-semibold">
                {coreRecommendationsCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setTriggersViewTab('leagues'); setRecommendationFilter('all'); }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition border ${
                triggersViewTab === 'leagues'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800 hover:border-slate-700'
              }`}
            >
              <span>🌍 League Triggers</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900/80 font-mono font-semibold">
                {leagueRecommendationsCount}
              </span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            {triggersViewTab === 'core' ? (
              <span>Showing <strong>{coreRecommendationsCount}</strong> core triggers (stats, odds, PHA, combos)</span>
            ) : (
              <span>All leagues default to <strong>+5 bonus</strong> (shift volatile leagues below)</span>
            )}
          </div>
        </div>

        {/* Dedicated League Triggers Management Banner */}
        {triggersViewTab === 'leagues' && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-400" />
                  🌍 All-Leagues +5 Bonus Engine & Volatility Controls
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold">
                  Default: +5 pts Bonus
                </span>
              </div>
              <p className="text-slate-400 text-[11px]">
                Every league dynamically gets a +5 bonus. Penalized leagues remain locked as negative. Shift volatile leagues below.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded bg-slate-900 text-slate-300 border border-slate-800">
                Total: <strong className="text-white">{leagueRecommendationsCount}</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-800/40">
                Bonuses: <strong className="text-emerald-300">{leagueBonusCount}</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-rose-950/50 text-rose-400 border border-rose-800/40">
                Penalties: <strong className="text-rose-300">{leaguePenaltyCount}</strong>
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={triggersViewTab === 'core'
                ? `Search ${coreRecommendationsCount} core master & custom triggers...`
                : `Search ${leagueRecommendationsCount} league & country triggers...`
              }
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            {(['all', 'bonus', 'penalty', 'mismatch', 'zero'] as const).map(f => {
              const isSel = recommendationFilter === f;
              const label = f === 'mismatch'
                ? `Mismatch (${mismatchCount})`
                : f;
              return (
                <button
                  key={f}
                  onClick={() => setRecommendationFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition border ${
                    isSel
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 select-none">
              <tr>
                <th
                  onClick={() => {
                    if (sortField === 'description') setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                    else { setSortField('description'); setSortDir('asc'); }
                  }}
                  className="py-3 px-3.5 cursor-pointer hover:text-white"
                >
                  Trigger Description {sortField === 'description' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-2 text-center">Current</th>
                <th
                  onClick={() => {
                    if (sortField === 'recommended') setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                    else { setSortField('recommended'); setSortDir('desc'); }
                  }}
                  className="py-3 px-2 text-center cursor-pointer hover:text-white"
                >
                  Recommended {sortField === 'recommended' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                {triggersViewTab === 'leagues' && (
                  <th className="py-3 px-2 text-center text-indigo-300 font-bold">
                    Polarity & Shift
                  </th>
                )}
                <th
                  onClick={() => {
                    if (sortField === 'hits') setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                    else { setSortField('hits'); setSortDir('desc'); }
                  }}
                  className="py-3 px-2 text-center cursor-pointer hover:text-white"
                >
                  Hits {sortField === 'hits' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-2 text-center">Mfav Wins</th>
                <th className="py-3 px-2 text-center">Draws</th>
                <th className="py-3 px-2 text-center">Underdogs</th>
                <th
                  onClick={() => {
                    if (sortField === 'safePct') setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                    else { setSortField('safePct'); setSortDir('desc'); }
                  }}
                  className="py-3 px-2 text-center cursor-pointer hover:text-white"
                >
                  Safe Conviction {sortField === 'safePct' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th className="py-3 px-3">Algorithmic Rationale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
              {paginatedRecommendations.length === 0 ? (
                <tr>
                  <td colSpan={triggersViewTab === 'leagues' ? 10 : 9} className="py-8 text-center text-slate-500">
                    No triggers match the selected criteria.
                  </td>
                </tr>
              ) : (
                paginatedRecommendations.map(row => (
                  <MemoizedTriggerTableRow
                    key={row.description}
                    row={row}
                    isLeaguesView={triggersViewTab === 'leagues'}
                    isUpsetsCat={activeCategory === 'upsets' || activeCategory === 'upset' || activeCategoryConfig.targetObjective === 'underdog_only'}
                    isLockedProUd={triggersViewTab === 'leagues' ? isLeagueLockedProUnderdog(row.description, activeCategory, selectedDay !== 'all' ? selectedDay : datasetDay) : false}
                    categoryLabel={activeCategoryConfig.label}
                    onInspectHistory={stableInspectHistory}
                    onSetTriggerPoints={stableSetTriggerPoints}
                    onToggleLeaguePolarity={stableToggleLeaguePolarity}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredRecommendations.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 px-1 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-white">{tablePageSize > 0 ? (clampedTablePage * tablePageSize + 1) : 1}</strong>–<strong className="text-white">{tablePageSize > 0 ? Math.min(filteredRecommendations.length, (clampedTablePage + 1) * tablePageSize) : filteredRecommendations.length}</strong> of <strong className="text-white">{filteredRecommendations.length}</strong> triggers
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Rows per page:</span>
              {([60, 120, 0] as const).map(sz => {
                const isSel = tablePageSize === sz;
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setTablePageSize(sz)}
                    className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold transition border ${
                      isSel
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
                    }`}
                  >
                    {sz === 0 ? 'All' : sz}
                  </button>
                );
              })}
            </div>

            {tablePageSize > 0 && totalTablePages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={clampedTablePage <= 0}
                  onClick={() => setTablePage(p => Math.max(0, p - 1))}
                  className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-200 border border-slate-800 font-semibold transition"
                >
                  ← Prev
                </button>
                <span className="font-mono text-[11px] text-slate-300">
                  Page <strong>{clampedTablePage + 1}</strong> of <strong>{totalTablePages}</strong>
                </span>
                <button
                  type="button"
                  disabled={clampedTablePage >= totalTablePages - 1}
                  onClick={() => setTablePage(p => Math.min(totalTablePages - 1, p + 1))}
                  className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none text-slate-200 border border-slate-800 font-semibold transition"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Copy Code Modal */}
      {showCopyCodeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-4xl w-full p-6 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-400" />
                  {codeModalTab === 'all' 
                    ? 'Permanent Code Updates: All Categories, Days & OPW Algos' 
                    : codeModalTab === 'category'
                    ? `Permanent Code Update: ${activeCategoryConfig.label} (${selectedDay !== 'all' ? selectedDay.toUpperCase() : 'ALL DAYS'})`
                    : 'Master Catalog Defaults (opwCatalog.ts)'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {codeModalTab === 'all'
                    ? 'Copy complete TypeScript blocks to update all daily files (mondayopw.tsx through opwsunday.tsx) and master catalog defaults in one go.'
                    : codeModalTab === 'category'
                    ? `Copy this snippet and paste it directly into src/opw${selectedDay !== 'all' ? selectedDay : 'saturday'}.tsx under "${activeCategory}".`
                    : 'Copy calibrated master catalog point weights for src/utils/opwCatalog.ts.'}
                </p>
              </div>
              <button
                onClick={() => setShowCopyCodeModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                onClick={() => setCodeModalTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  codeModalTab === 'all'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <Layers size={13} /> All Categories & Days (Master)
              </button>
              <button
                onClick={() => setCodeModalTab('category')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  codeModalTab === 'category'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles size={13} /> Current Category ({activeCategoryConfig.label})
              </button>
              <button
                onClick={() => setCodeModalTab('catalog')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  codeModalTab === 'catalog'
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal size={13} /> Master Catalog Defaults
              </button>
            </div>

            <div className="relative">
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-[11px] text-emerald-400 overflow-y-auto max-h-[380px] select-all leading-relaxed whitespace-pre">
                {codeModalTab === 'all'
                  ? generateAllCodeUpdatesSnippet()
                  : codeModalTab === 'category'
                  ? generateCodeUpdateSnippet()
                  : `// Master Catalog Defaults (src/utils/opwCatalog.ts)\n// 125 triggers active and calibrated across 'mfav_draw', 'mfav_only', and 'underdog_only'`}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <span className="text-xs text-slate-400 font-medium">
                {codeModalTab === 'all'
                  ? 'Ready to update all 7 daily files and all categories in one go.'
                  : `${recommendations.filter(r => r.recommendedPoints !== 0).length} non-zero tuned trigger rules generated.`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCopyCodeModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Close
                </button>
                <button
                  onClick={handleSaveCalibratedRulesToCode}
                  disabled={isSavingCode}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg transition ${
                    isSavingCode
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 border border-emerald-400'
                  }`}
                  title="Directly write calibrated rules to codebase on disk"
                >
                  {isSavingCode ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {isSavingCode ? 'Saving to Code...' : 'Save to Codebase (Permanent)'}
                </button>
                <button
                  onClick={() => {
                    const snippet = codeModalTab === 'all' 
                      ? generateAllCodeUpdatesSnippet() 
                      : generateCodeUpdateSnippet();
                    navigator.clipboard.writeText(snippet);
                    showToast('Code snippet copied to clipboard! Paste it into your daily OPW file or chat.');
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-lg shadow-indigo-900/40 transition"
                >
                  <Copy size={14} /> Copy to Clipboard
                </button>
                {codeModalTab !== 'all' && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generateAllCodeUpdatesSnippet());
                      showToast('Copied ALL categories and days code to clipboard!');
                    }}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 shadow-lg shadow-purple-900/40 transition"
                  >
                    <Copy size={14} /> Copy All Code (All Algos & Days)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adopt Trigger Points Modal */}
      {showAdoptModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-fade-in text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-900/40">
                  <Layers size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">
                    Adopt Trigger Points to Daily Algos
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Push weights learned from {datasetScope === 'history' ? 'Historical Universe' : datasetScope === 'all' ? 'All Matches' : 'Live Matches'} to selected prediction days.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAdoptModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Target Category & Stats Summary */}
            <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-700/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Source Category:</span>
                <span className="font-bold text-indigo-300">{activeCategoryConfig.label}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Dataset Scope:</span>
                <span className="font-mono text-purple-300 font-bold uppercase">{datasetScope === 'history' ? 'Historical Universe' : datasetScope}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/40">
                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Calibrated Rules:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {effectiveRecommendations.filter(r => r.recommendedPoints !== 0).length} non-zero triggers
                </span>
              </div>
            </div>

            {/* Day Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Target Daily Prediction Algos ({selectedAdoptDays.size}/7 selected):
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllAdoptDays}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-600">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedAdoptDays(new Set(['saturday']))}
                    className="text-purple-400 hover:text-purple-300 font-semibold underline"
                  >
                    Sat Only
                  </button>
                  <span className="text-slate-600">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedAdoptDays(new Set(['sunday']))}
                    className="text-purple-400 hover:text-purple-300 font-semibold underline"
                  >
                    Sun Only
                  </button>
                  <span className="text-slate-600">·</span>
                  <button
                    type="button"
                    onClick={clearAllAdoptDays}
                    className="text-slate-400 hover:text-slate-300 font-semibold underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ALL_DAYS.map(day => {
                  const isSelected = selectedAdoptDays.has(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleAdoptDay(day)}
                      className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition border flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-xs'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <span>{day.slice(0, 3)}</span>
                      <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] ${
                        isSelected ? 'bg-indigo-500 text-white font-black' : 'border border-slate-600'
                      }`}>
                        {isSelected ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Also Adopt to Main Algo */}
            <label className="flex items-center gap-2.5 text-xs text-slate-300 font-medium cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={adoptToMainAlgo}
                onChange={e => setAdoptToMainAlgo(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
              />
              <span>Also update Main Algo defaults for this category</span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowAdoptModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAdopt}
                disabled={selectedAdoptDays.size === 0}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg transition ${
                  selectedAdoptDays.size === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-900/30'
                }`}
              >
                <CheckCircle2 size={14} />
                Adopt for {selectedAdoptDays.size} Selected Day{selectedAdoptDays.size === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overall Historical Trigger Inspector Modal */}
      {historyInspectTrigger && (() => {
        const row = effectiveRecommendations.find(r => r.description === historyInspectTrigger);
        if (!row) return null;
        const polarity = getTriggerSemanticPolarity(row.description);

        const dayNames: { key: string; label: string }[] = [
          { key: 'monday', label: 'Mon' },
          { key: 'tuesday', label: 'Tue' },
          { key: 'wednesday', label: 'Wed' },
          { key: 'thursday', label: 'Thu' },
          { key: 'friday', label: 'Fri' },
          { key: 'saturday', label: 'Sat' },
          { key: 'sunday', label: 'Sun' }
        ];

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full p-6 space-y-5 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg">
                      <History size={18} />
                    </span>
                    <h2 className="text-base font-bold text-white">
                      Overall Historical Trigger Inspector
                    </h2>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      polarity === 'PRO_MFAV'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : polarity === 'PRO_UNDERDOG'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {polarity === 'PRO_MFAV' ? '⭐ Pro-Favorite / Target' : polarity === 'PRO_UNDERDOG' ? '⚠️ Pro-Underdog / Trap' : '⚖️ Neutral Signal'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-900/60 text-indigo-300 border border-indigo-500/30">
                      {activeCategoryConfig.label}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-200 pt-1">
                    {row.description}
                  </p>
                </div>
                <button
                  onClick={() => setHistoryInspectTrigger(null)}
                  className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  ✕
                </button>
              </div>

              {/* 3 Comparative Data Cards: Live Slice vs Weekday History vs Overall Universe */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Live Slice */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase">
                    <span>Active Live Slice</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      row.totalHits >= 5 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {row.totalHits >= 5 ? 'Tier 1 Live' : 'Live < 5'}
                    </span>
                  </div>
                  <p className="text-xl font-mono font-bold text-white">
                    {row.totalHits} <span className="text-xs text-slate-500 font-sans">matches</span>
                  </p>
                  <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
                    <div>Mfav: <strong className="text-emerald-400">{row.mfavHits}</strong> ({row.mfavPct.toFixed(0)}%)</div>
                    <div>Draw: <strong className="text-amber-400">{row.drawHits}</strong> ({row.drawPct.toFixed(0)}%)</div>
                    <div>Underdog: <strong className="text-rose-400">{row.underdogHits}</strong> ({row.underdogPct.toFixed(0)}%)</div>
                    <div className="pt-1 text-slate-300 font-sans font-semibold">
                      Safe Conviction: <strong className={row.safePct >= 70 ? 'text-emerald-400' : 'text-amber-400'}>{row.totalHits > 0 ? `${row.safePct.toFixed(0)}%` : '—'}</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Weekday History */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase">
                    <span>Weekday History</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                      (row.dayHistHits || 0) >= 5 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {selectedDay !== 'all' ? selectedDay.slice(0, 3).toUpperCase() : 'ALL'}
                    </span>
                  </div>
                  <p className="text-xl font-mono font-bold text-white">
                    {row.dayHistHits || 0} <span className="text-xs text-slate-500 font-sans">matches</span>
                  </p>
                  <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
                    <div>Mfav: <strong className="text-emerald-400">{(row.dayHistMfavPct || 0).toFixed(0)}%</strong></div>
                    <div>Draw: <strong className="text-amber-400">{(row.dayHistDrawPct || 0).toFixed(0)}%</strong></div>
                    <div>Underdog: <strong className="text-rose-400">{(row.dayHistUnderdogPct || 0).toFixed(0)}%</strong></div>
                    <div className="pt-1 text-slate-300 font-sans font-semibold">
                      Safe Conviction: <strong className={(row.dayHistSafePct || 0) >= 70 ? 'text-emerald-400' : 'text-amber-400'}>{(row.dayHistHits || 0) > 0 ? `${(row.dayHistSafePct || 0).toFixed(0)}%` : '—'}</strong>
                    </div>
                  </div>
                </div>

                {/* 3. Overall Historical Universe */}
                <div className="bg-slate-950/80 border border-indigo-500/40 rounded-lg p-3 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-300 uppercase">
                    <span>Overall History</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Tier 3 All Days
                    </span>
                  </div>
                  <p className="text-xl font-mono font-bold text-indigo-200">
                    {row.overallHits || 0} <span className="text-xs text-slate-500 font-sans">matches</span>
                  </p>
                  <div className="text-[11px] text-slate-400 space-y-0.5 font-mono">
                    <div>Mfav: <strong className="text-emerald-400">{row.overallMfavHits || 0}</strong> ({(row.overallMfavPct || 0).toFixed(0)}%)</div>
                    <div>Draw: <strong className="text-amber-400">{row.overallDrawHits || 0}</strong> ({(row.overallDrawPct || 0).toFixed(0)}%)</div>
                    <div>Underdog: <strong className="text-rose-400">{row.overallUnderdogHits || 0}</strong> ({(row.overallUnderdogPct || 0).toFixed(0)}%)</div>
                    <div className="pt-1 text-indigo-300 font-sans font-semibold">
                      Safe Conviction: <strong className="text-emerald-400">{(row.overallHits || 0) > 0 ? `${(row.overallSafePct || 0).toFixed(0)}%` : '—'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekday Distribution Breakdown (Mon-Sun) */}
              {row.weekdayDistribution && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="uppercase tracking-wider">Weekly Firing Distribution across All Days</span>
                    <span className="text-[11px] font-mono text-slate-400 font-normal">
                      Total historical volume: <strong className="text-white">{row.overallHits || 0}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 text-center font-mono">
                    {dayNames.map(({ key, label }) => {
                      const dayData = row.weekdayDistribution?.[key];
                      const dayTotal = dayData?.total || 0;
                      const daySafePct = dayTotal > 0 ? ((dayData!.mfav + dayData!.draw) / dayTotal) * 100 : 0;
                      return (
                        <div key={key} className={`p-2 rounded border text-xs ${
                          selectedDay === key ? 'bg-indigo-950/60 border-indigo-500/50' : 'bg-slate-900/60 border-slate-800'
                        }`}>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">{label}</span>
                          <strong className="text-white text-sm block mt-0.5">{dayTotal}</strong>
                          <span className={`text-[10px] block mt-0.5 ${
                            dayTotal === 0 ? 'text-slate-600' : daySafePct >= 70 ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            {dayTotal > 0 ? `${daySafePct.toFixed(0)}%` : '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Asymmetric Ratchet Verdict Card */}
              <div className={`p-4 rounded-lg border space-y-2 ${
                row.ratchetAction === 'increased_bonus'
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  : row.ratchetAction === 'deepened_penalty'
                  ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                  : 'bg-indigo-950/30 border-indigo-500/40 text-indigo-200'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {row.ratchetAction === 'increased_bonus' ? (
                      <TrendingUp size={18} className="text-emerald-400" />
                    ) : row.ratchetAction === 'deepened_penalty' ? (
                      <TrendingDown size={18} className="text-rose-400" />
                    ) : (
                      <CheckCircle2 size={18} className="text-indigo-400" />
                    )}
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {row.ratchetAction === 'increased_bonus'
                        ? 'Asymmetric Ratchet: Bonus Increased via History'
                        : row.ratchetAction === 'deepened_penalty'
                        ? 'Asymmetric Ratchet: Penalty Deepened via History'
                        : 'Asymmetric Ratchet: Points Preserved (No Point Reduction Allowed)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono font-bold">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      Base: {row.currentPoints > 0 ? `+${row.currentPoints}` : row.currentPoints} PTS
                    </span>
                    <span>→</span>
                    <span className={`px-2 py-0.5 rounded border ${
                      row.recommendedPoints > 0
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : row.recommendedPoints < 0
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      Rec: {row.recommendedPoints > 0 ? `+${row.recommendedPoints}` : row.recommendedPoints} PTS
                    </span>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-300">
                  {row.rationale}
                </p>

                <div className="pt-1 text-[11px] text-slate-400 font-sans border-t border-slate-800/60">
                  🛡️ <strong>Asymmetric Ratchet Guarantee:</strong> When the live match sample has fewer than 5 matches, the algorithm evaluates historical data across weekdays and all days. If historical evidence justifies a stronger conviction bonus or deeper trap penalty, it grants leeway to scale it up (max +25 bonus, max -30 penalty). Existing calibrated points are <strong>never reduced or weakened</strong> on small sample sizes.
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setHistoryInspectTrigger(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Clean Target Matches & Trigger Points Verification Modal */}
      {isCleanMatchesModalOpen && (() => {
        const activeDayLabel = (selectedDay !== 'all' ? selectedDay : datasetDay).toUpperCase();
        const rowsToShow = showAllRankedInCleanModal
          ? cleanMatchesBreakdown.allRows
          : (cleanMatchesBreakdown.firstTrap
              ? [...cleanMatchesBreakdown.cleanMatches, cleanMatchesBreakdown.firstTrap]
              : cleanMatchesBreakdown.cleanMatches);

        const allExpanded = rowsToShow.length > 0 && rowsToShow.every(r => expandedCleanMatchIds.has(r.match.id || r.rank));

        const toggleRowExpand = (id: string | number) => {
          setExpandedCleanMatchIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        };

        const toggleExpandAll = () => {
          if (allExpanded) {
            setExpandedCleanMatchIds(new Set());
          } else {
            setExpandedCleanMatchIds(new Set(rowsToShow.map(r => r.match.id || r.rank)));
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Eye size={18} className="text-indigo-400" />
                    <h2 className="text-base font-bold text-white">
                      Clean Target Matches & OPW Trigger Points Verification
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      {activeCategoryConfig.label}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {activeDayLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Exact factual ranking computed directly from each match&apos;s Base PHA Weight + Active OPW Trigger Points (zero simulation).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCleanMatchesModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Summary Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-3 bg-slate-950/50 border-b border-slate-800">
                <div className="bg-slate-900/90 border border-emerald-500/30 rounded-lg p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Clean Targets Before Trap</span>
                  <span className="text-lg font-mono font-bold text-emerald-400">
                    {Math.max(deepCleanMatches, cleanMatchesBreakdown.cleanCount)} / {cleanMatchesBreakdown.totalTargets}
                  </span>
                </div>
                <div className="bg-slate-900/90 border border-rose-500/30 rounded-lg p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">First Trap Rank</span>
                  <span className="text-lg font-mono font-bold text-rose-400">
                    {cleanMatchesBreakdown.firstTrap ? `#${Math.max(deepFirstTrapRank, cleanMatchesBreakdown.firstTrapRank)}` : 'NONE (100%)'}
                  </span>
                  {cleanMatchesBreakdown.firstTrap && (
                    <span className="text-[10px] text-rose-300 truncate block">
                      {cleanMatchesBreakdown.firstTrap.teams}
                    </span>
                  )}
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">First Trap Total Score</span>
                  <span className="text-lg font-mono font-bold text-amber-300">
                    {cleanMatchesBreakdown.firstTrap ? `${cleanMatchesBreakdown.firstTrap.totalScore} PTS` : '—'}
                  </span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Clean Boundary Margin</span>
                  <span className="text-lg font-mono font-bold text-cyan-400">
                    {cleanMatchesBreakdown.cleanCount > 0 && cleanMatchesBreakdown.firstTrap
                      ? `+${cleanMatchesBreakdown.marginToFirstTrap} PTS`
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Action Controls Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 px-5 py-2.5 bg-slate-900 border-b border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAllRankedInCleanModal(false)}
                    className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                      !showAllRankedInCleanModal
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Clean Matches + 1st Trap ({cleanMatchesBreakdown.cleanCount + (cleanMatchesBreakdown.firstTrap ? 1 : 0)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAllRankedInCleanModal(true)}
                    className={`px-3 py-1 rounded-md font-semibold transition cursor-pointer ${
                      showAllRankedInCleanModal
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    All Ranked Matches ({cleanMatchesBreakdown.allRows.length})
                  </button>
                </div>
                <button
                  type="button"
                  onClick={toggleExpandAll}
                  className="px-3 py-1 rounded-md font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                >
                  {allExpanded ? 'Collapse All Triggers' : 'Expand All Triggers'}
                </button>
              </div>

              {/* Matches List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {rowsToShow.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    No completed matches found in this category.
                  </div>
                ) : (
                  rowsToShow.map(row => {
                    const rowKey = row.match.id || row.rank;
                    const isExpanded = expandedCleanMatchIds.has(rowKey);
                    const isFirstTrap = cleanMatchesBreakdown.firstTrap && row.rank === cleanMatchesBreakdown.firstTrap.rank;

                    return (
                      <div
                        key={rowKey}
                        className={`rounded-lg border transition ${
                          isFirstTrap
                            ? 'bg-rose-950/35 border-rose-500/60 shadow-lg shadow-rose-950/30'
                            : row.isTarget
                            ? 'bg-slate-950/80 border-emerald-500/30 hover:border-emerald-500/50'
                            : 'bg-rose-950/20 border-rose-500/30'
                        }`}
                      >
                        <div
                          onClick={() => toggleRowExpand(rowKey)}
                          className="flex items-center justify-between flex-wrap gap-3 p-3 cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`px-2 py-1 rounded font-mono text-xs font-bold ${
                              isFirstTrap
                                ? 'bg-rose-600 text-white'
                                : row.isTarget
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}>
                              #{row.rank}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-white truncate">
                                  {row.teams}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  isFirstTrap
                                    ? 'bg-rose-500/30 text-rose-200 border border-rose-400/50'
                                    : row.isTarget
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}>
                                  {isFirstTrap
                                    ? `⛔ FIRST TRAP (${row.outcome.toUpperCase()})`
                                    : row.isTarget
                                    ? `✅ CLEAN TARGET (${row.outcome.toUpperCase()})`
                                    : `⚠️ TRAP (${row.outcome.toUpperCase()})`}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5 flex-wrap">
                                {row.date && <span>📅 {row.date}</span>}
                                {row.league && <span>🏆 {row.league}</span>}
                                <span>FT: <strong className="text-white">{row.result}</strong> ({row.actual})</span>
                                <span>M.Fav: <strong className="text-indigo-300">{row.mFav}</strong></span>
                                {row.odds && <span>Odds: {row.odds}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right font-mono">
                              <div className="text-xs text-slate-400">
                                Base <span className="text-slate-200 font-semibold">+{row.baseScore}</span>
                                {' • '}
                                Triggers ({row.rulesHit.length}):{' '}
                                <span className={row.triggerScore >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                                  {row.triggerScore >= 0 ? `+${row.triggerScore}` : row.triggerScore}
                                </span>
                              </div>
                              <div className={`text-base font-bold ${
                                isFirstTrap ? 'text-rose-300' : row.isTarget ? 'text-emerald-400' : 'text-amber-300'
                              }`}>
                                Total: {row.totalScore} PTS
                              </div>
                            </div>
                            <div className="text-slate-400">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </div>
                        </div>

                        {/* Expandable Trigger Points Breakdown */}
                        {isExpanded && (
                          <div className="px-4 pb-3 pt-2 border-t border-slate-800/80 bg-slate-950/60">
                            <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center justify-between">
                              <span>Active OPW Triggers Fired ({row.rulesHit.length}):</span>
                              <span className="font-mono text-slate-400">
                                {row.baseScore} (Base) + ({row.triggerScore}) (Triggers) = <strong className="text-white">{row.totalScore} PTS</strong>
                              </span>
                            </div>
                            {row.rulesHit.length === 0 ? (
                              <p className="text-xs text-slate-500 italic">No active catalog triggers fired on this match.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                {row.rulesHit.map((rule, rIdx) => (
                                  <div
                                    key={`${rule.description}_${rIdx}`}
                                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-slate-900/90 border border-slate-800 text-xs"
                                  >
                                    <span className="text-slate-200 truncate" title={rule.description}>
                                      {rule.description}
                                    </span>
                                    <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] shrink-0 ${
                                      rule.points > 0
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    }`}>
                                      {rule.points > 0 ? `+${rule.points}` : rule.points} PTS
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/80">
                <span className="text-xs text-slate-400">
                  Click any match card above to inspect its individual OPW triggers and points.
                </span>
                <button
                  type="button"
                  onClick={() => setIsCleanMatchesModalOpen(false)}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export const OPWAlgo = React.memo(OPWAlgoComponent);
export default OPWAlgo;
