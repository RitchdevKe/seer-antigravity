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
  ShieldCheck
} from 'lucide-react';
import { Match } from './types';
import { getActualResult } from './utils/matchProcessing';
import {
  DayOfWeek,
  getMatchDayOfWeek,
  getMarketFavorite,
  ALL_MASTER_CATALOG_TRIGGERS,
  OptimizedCategorySettings,
  extractMatchEvaluationStats,
  evaluateAllCatalogTriggers,
  CandidateComboTrigger,
  ApprovedCustomTrigger,
  loadApprovedCustomTriggers,
  saveApprovedCustomTrigger,
  removeApprovedCustomTrigger,
  toggleApprovedCustomTrigger,
  mineSynergisticCombos,
  mineParameterContinuations,
  MatchStatSummary,
  hydrateCustomTriggersFromServer
} from './utils/opwCommon';
import {
  populateCategoryWithMasterRules,
  getMasterTriggerDefaultPoints,
  getTriggerSemanticPolarity,
  sanitizeRulePolarity,
  borrowTriggerPoints
} from './utils/opwCatalog';
import {
  ProtectedPenaltyGuard,
  SlipUpsetPostMortem,
  loadProtectedPenaltyGuards,
  saveProtectedPenaltyGuard,
  removeProtectedPenaltyGuard,
  analyzeSlipUpsets,
  isProtectedPenalty,
  getProtectedFloor
} from './utils/opwPenaltyProtection';
import {
  SATURDAY_TOP_12_RULES,
  SATURDAY_BEST_BET_RULES,
  SATURDAY_BANKERS_DLIVE_RULES,
  SATURDAY_BANKERS_JACKPOT_RULES,
  SATURDAY_VALUE_PICKS_RULES,
  SATURDAY_UPSETS_RULES,
  SATURDAY_BOTB_RULES
} from './utils/opwSaturdayRules';
import {
  DAILY_OPTIMIZED_SETTINGS,
  DAILY_DEFAULT_CATEGORY_SETTINGS,
  OPTIMIZED_CATEGORY_SETTINGS,
  getOptimizedScoreDetailed,
  getOptimizedBaseWeight,
  updateOptimizedCategorySettings,
  updateDailyOptimizedCategorySettings,
  savePersistedDailySettings,
  resetToCodeDefaults
} from './utils/optimizedweights';
import { getMatchEvaluatorTags } from './utils/matchEvaluator';
import { deleteLockedSlip, getLockedSlip } from './services/seerSlips';
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
  { id: 'upsets', label: 'Upsets', tagPrefix: 'upsets:', targetObjective: 'underdog_only', targetCapacity: 5, description: 'Underdog wins with high pattern conviction.' },
  { id: 'botb_best', label: 'BOTB', tagPrefix: 'botb_best:', targetObjective: 'mfav_only', targetCapacity: 10, description: 'Premium selections (Mfav must win).' }
];

export const MASTER_RULES_MAP: Record<string, { description: string; points: number }[]> = {
  top_12_value: SATURDAY_TOP_12_RULES,
  top_10_value: SATURDAY_TOP_12_RULES,
  best_bet: SATURDAY_BEST_BET_RULES,
  bankers_dlive: SATURDAY_BANKERS_DLIVE_RULES,
  bankers_jackpot: SATURDAY_BANKERS_JACKPOT_RULES,
  value_picks: SATURDAY_VALUE_PICKS_RULES,
  upsets: SATURDAY_UPSETS_RULES,
  botb_best: SATURDAY_BOTB_RULES,
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
}

export const ALLOWED_POINT_VALUES = [-40, -35, -30, -25, -20, -15, -10, -5, 5, 10, 15, 20, 25];

export function getFullActiveCatalogTriggers(): string[] {
  try {
    const approved = loadApprovedCustomTriggers().filter(t => t.isActive).map(t => t.description);
    if (approved.length === 0) return ALL_MASTER_CATALOG_TRIGGERS;
    const set = new Set([...ALL_MASTER_CATALOG_TRIGGERS, ...approved]);
    return Array.from(set);
  } catch (e) {
    return ALL_MASTER_CATALOG_TRIGGERS;
  }
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
  isHistoryMode: boolean = false
): TriggerAccuracyProfile {
  const fullBand = [-40, -35, -30, -25, -20, -15, -10, -5, 5, 10, 15, 20, 25];

  const polarity = getTriggerSemanticPolarity(desc);
  const isUpsets = objective === 'underdog_only';
  const isMfavDraw = objective === 'mfav_draw';

  // Allowed candidate bounds based strictly on user-approved domain polarity:
  // 1. Pro-underdog: strictly [0, -40] (for Mfav/Top 12) -> max bonus is 0!
  // 2. Pro-Mfav: strictly [0, +25] (for Mfav/Top 12) -> worst penalty is 0!
  // 3. Neutral: [-15, +15] (neutral triggers can swing between +15 to minus 15)
  // 4. Upsets (underdog_only): Underdog triggers [0, +25], Mfav triggers [-40, 0], Neutral [-15, +15].
  let minPolarityBound: number;
  let maxPolarityBound: number;

  if (isUpsets) {
    if (polarity === 'PRO_UNDERDOG') {
      minPolarityBound = 5;
      maxPolarityBound = 25;
    } else if (polarity === 'PRO_MFAV') {
      minPolarityBound = -40;
      maxPolarityBound = -5;
    } else {
      minPolarityBound = -15;
      maxPolarityBound = 15;
    }
  } else {
    if (polarity === 'PRO_UNDERDOG') {
      minPolarityBound = -40;
      maxPolarityBound = -5;
    } else if (polarity === 'PRO_MFAV') {
      minPolarityBound = 5;
      maxPolarityBound = 25;
    } else {
      minPolarityBound = -15;
      maxPolarityBound = 15;
    }
  }

  const rawAnchor = (customHistoricalAnchor !== undefined && customHistoricalAnchor !== 0)
    ? customHistoricalAnchor
    : getMasterTriggerDefaultPoints(desc, objective);
  let historicalAnchor = Math.max(minPolarityBound, Math.min(maxPolarityBound, rawAnchor));
  if (historicalAnchor === 0) {
    historicalAnchor = isUpsets ? (polarity === 'PRO_UNDERDOG' ? 15 : -15) : (polarity === 'PRO_UNDERDOG' ? -15 : 15);
  }

  if (!counts || (counts.mfav + counts.draw + counts.underdog) === 0) {
    const allowedBand = fullBand.filter(v => v !== 0 && v >= minPolarityBound && v <= maxPolarityBound);
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
      maxStep: 15
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

  // User directive: paused historical anchor restriction tying live/daily computations to trigger history.
  // Daily algos are improved per day across valid domain semantic polarity bounds [minPolarityBound, maxPolarityBound].
  let allowedBand = fullBand.filter(v => v !== 0 && v >= minPolarityBound && v <= maxPolarityBound);
  if (allowedBand.length === 0) {
    allowedBand = [historicalAnchor];
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
    maxStep: 15
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
  const SCORE_OFFSET = 300;
  const BUCKET_COUNT = 601;
  const buckets: { outcome: 'mfav' | 'draw' | 'underdog'; score: number }[][] = Array.from({ length: BUCKET_COUNT }, () => []);

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];
    let score = p.baseScore;
    p.triggersHit.forEach(desc => {
      score += pointsMap.get(desc) ?? 0;
    });
    const clamped = Math.max(-299, Math.min(299, score));
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

  // Find index of first trap outcome
  let firstTrapIndex = scored.length;
  for (let i = 0; i < scored.length; i++) {
    if (trapOutcomes.has(scored[i].outcome)) {
      firstTrapIndex = i;
      break;
    }
  }

  const cleanTopMatches = firstTrapIndex;
  const firstTrapRank = firstTrapIndex + 1;

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

  // Weight Regularization: Minimal tie-breaker on extreme weights (max penalty 40, max bonus 25)
  let regSum = 0;
  pointsMap.forEach(pts => {
    const normalized = pts < 0 ? Math.abs(pts) / 40 : pts / 25;
    regSum += normalized * normalized;
  });
  const regularizationCost = regSum * 1.0;

  // Target 100+ points reward: Reward winning target matches having robust high scores (>= 100 pts)
  let target100Reward = 0;
  for (const s of targetScores) {
    if (s >= 100) target100Reward += 150;
    else if (s >= 50) target100Reward += 50;
  }

  // Clean streak completion bonus
  const cleanStreakBonus = (cleanTopMatches >= Math.min(totalCorrect, topN) && totalCorrect > 0) ? 3000 : 0;

  // Pure mathematical quality across all categories:
  // Maximizes target density across volume horizons, suppresses traps across volume thresholds,
  // maintains clean target streak, and penalizes inversions
  const quality = (cleanTopMatches * 500) +
    cleanStreakBonus +
    horizonFitness +
    (pairwiseMarginSum * 1.5) -
    (inversions * 5) -
    (trapInTopN * 500) -
    elevatedTrapPenalty +
    Math.min(50, bufferMargin) +
    positiveTargetReward +
    target100Reward -
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
    horizonMetrics
  };
}

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

  // Extract combined historical matches for the selected day of week for < 5 match sample fallbacks
  const dayHistoricalMatches = (allMatches && allMatches.length > 0)
    ? (selectedDay !== 'all' ? allMatches.filter(m => getMatchDayOfWeek(m) === selectedDay) : allMatches)
    : [];

  const dayHistoricalCategoryMatches = dayHistoricalMatches.filter(m => {
    let tags = m.evaluatorTags;
    if (!tags || tags.length === 0) {
      tags = getMatchEvaluatorTags(m, phaStatsMap, liveViewType === 'jackpot', true, matchStars);
      m.evaluatorTags = tags;
    }
    if (isTop12Cat) {
      return tags.some(t => t.startsWith('top12:') || t.startsWith('top10:'));
    }
    return !prefix || tags.some(t => t.startsWith(prefix));
  });

  const dayHistoricalCompletedMatches = dayHistoricalCategoryMatches.filter(m => {
    const actual = getActualResult(m.result || '');
    return actual === '1' || actual === 'X' || actual === '2';
  });

  // Lazy cache of historical day hit stats for triggers with < 5 live matches
  let dayHistStatsMap: Map<string, { mfav: number; draw: number; underdog: number }> | null = null;
  const getDayHistStats = (desc: string): { mfav: number; draw: number; underdog: number } => {
    if (!dayHistStatsMap) {
      dayHistStatsMap = new Map();
      getFullActiveCatalogTriggers().forEach(d => dayHistStatsMap!.set(d, { mfav: 0, draw: 0, underdog: 0 }));
      dayHistoricalCompletedMatches.forEach(m => {
        const actual = getActualResult(m.result || '');
        if (actual !== '1' && actual !== 'X' && actual !== '2') return;
        const mFav = getMarketFavorite(m);
        let outcome: 'mfav' | 'draw' | 'underdog';
        if (actual === mFav) outcome = 'mfav';
        else if (actual === 'X') outcome = 'draw';
        else outcome = 'underdog';

        let allTriggers: Set<string> = (m as any)._opwCatalogTriggers;
        if (!allTriggers) {
          const stats = extractMatchEvaluationStats(m, phaStatsMap, cat.id);
          allTriggers = evaluateAllCatalogTriggers(stats, m);
          (m as any)._opwCatalogTriggers = allTriggers;
        }
        allTriggers.forEach(t => {
          const st = dayHistStatsMap!.get(t);
          if (st) {
            if (outcome === 'mfav') st.mfav++;
            else if (outcome === 'draw') st.draw++;
            else st.underdog++;
          }
        });
      });
    }
    return dayHistStatsMap.get(desc) || { mfav: 0, draw: 0, underdog: 0 };
  };

  // Extract overall historical completed matches for this category across ALL days of the week
  const overallHistoricalCategoryMatches = (allMatches && allMatches.length > 0)
    ? allMatches.filter(m => {
        let tags = m.evaluatorTags;
        if (!tags || tags.length === 0) {
          tags = getMatchEvaluatorTags(m, phaStatsMap, liveViewType === 'jackpot', true, matchStars);
          m.evaluatorTags = tags;
        }
        if (isTop12Cat) {
          return tags.some(t => t.startsWith('top12:') || t.startsWith('top10:'));
        }
        return !prefix || tags.some(t => t.startsWith(prefix));
      })
    : [];

  const overallHistoricalCompletedMatches = overallHistoricalCategoryMatches.filter(m => {
    const actual = getActualResult(m.result || '');
    return actual === '1' || actual === 'X' || actual === '2';
  });

  // Lazy cache of overall historical hit stats (all days combined + weekday breakdown)
  let overallHistStatsMap: Map<string, {
    mfav: number;
    draw: number;
    underdog: number;
    total: number;
    weekdays: Record<string, { mfav: number; draw: number; underdog: number; total: number }>;
  }> | null = null;

  const getOverallHistStats = (desc: string) => {
    if (!overallHistStatsMap) {
      overallHistStatsMap = new Map();
      getFullActiveCatalogTriggers().forEach(d => {
        overallHistStatsMap!.set(d, {
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
        });
      });

      overallHistoricalCompletedMatches.forEach(m => {
        const actual = getActualResult(m.result || '');
        if (actual !== '1' && actual !== 'X' && actual !== '2') return;
        const mFav = getMarketFavorite(m);
        let outcome: 'mfav' | 'draw' | 'underdog';
        if (actual === mFav) outcome = 'mfav';
        else if (actual === 'X') outcome = 'draw';
        else outcome = 'underdog';
        const matchDay = getMatchDayOfWeek(m);

        let allTriggers: Set<string> = (m as any)._opwCatalogTriggers;
        if (!allTriggers) {
          const stats = extractMatchEvaluationStats(m, phaStatsMap, cat.id);
          allTriggers = evaluateAllCatalogTriggers(stats, m);
          (m as any)._opwCatalogTriggers = allTriggers;
        }
        allTriggers.forEach(t => {
          const st = overallHistStatsMap!.get(t);
          if (st) {
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
          }
        });
      });
    }
    return overallHistStatsMap.get(desc) || {
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
  };

  let activeSettings: OptimizedCategorySettings | undefined;
  if (selectedDay !== 'all') {
    activeSettings = DAILY_OPTIMIZED_SETTINGS[selectedDay]?.[cat.id] ||
      DAILY_DEFAULT_CATEGORY_SETTINGS[selectedDay]?.[cat.id] ||
      OPTIMIZED_CATEGORY_SETTINGS[cat.id];
  } else {
    activeSettings = OPTIMIZED_CATEGORY_SETTINGS[cat.id] ||
      DAILY_DEFAULT_CATEGORY_SETTINGS.saturday?.[cat.id];
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
      if (t === "Odds for underdog >= 3.0" && cat.targetObjective !== 'underdog_only') return;
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

  const POINT_VALUES = [-40, -35, -30, -25, -20, -15, -10, -5, 5, 10, 15, 20, 25];
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
  catalogTriggers.forEach(desc => {
    const counts = hitStats.get(desc);
    const currentVal = currentRulePointsMap.get(desc);
    const profile = getTriggerAccuracyProfile(desc, counts, objective, currentVal);
    let initialPts = (currentVal !== undefined && currentVal !== 0 && ALLOWED_POINT_VALUES.includes(currentVal))
      ? currentVal
      : borrowTriggerPoints(desc, cat.id, selectedDay);
    if (initialPts === 0) {
      initialPts = borrowTriggerPoints(desc, cat.id, selectedDay);
    }
    
    // Clamp to trigger's empirical allowed band
    if (!profile.allowedBand.includes(initialPts)) {
      initialPts = profile.allowedBand.reduce((prev, curr) => Math.abs(curr - initialPts) < Math.abs(prev - initialPts) ? curr : prev);
    }
    optimizedPoints.set(desc, initialPts);
  });

  if (matchProfiles.length > 60) {
    // Instantaneous O(N) Empirical Lift & Relative-Risk Calibration
    // For large universes (e.g. Historical Universe), skip synchronous render-thread permutations to prevent browser hang!
    // Deep multi-permutation search is executed asynchronously in the Self-Learn Engine.
    const isHistUniv = matchProfiles.length > 60;
    catalogTriggers.forEach(desc => {
      const counts = hitStats.get(desc);
      const totalHits = counts ? counts.mfav + counts.draw + counts.underdog : 0;
      const currentVal = currentRulePointsMap.get(desc);
      const profile = getTriggerAccuracyProfile(desc, counts, objective, currentVal, isHistUniv);

      if (totalHits < 5 || (totalHits >= 8 && isTriggerEmpiricallyBalanced(counts))) {
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
          if (mfavRate >= 0.85) pts = -40;
          else if (mfavRate >= 0.78) pts = -35;
          else if (mfavRate >= 0.70) pts = -30;
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
          if (udRate >= 0.45 || mfavRate <= 0.25) pts = -40;
          else if (udRate >= 0.40 || mfavRate <= 0.30) pts = -35;
          else if (udRate >= 0.35 || mfavRate <= 0.34) pts = -30;
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
          if (udRate >= 0.60) pts = -40;
          else if (udRate >= 0.55) pts = -35;
          else if (udRate >= 0.50) pts = -30;
          else if (udRate >= 0.42) pts = -25;
          else if (udRate >= 0.35) pts = -20;
          else if (udRate >= 0.28) pts = -15;
          else pts = -10;
        } else {
          pts = profile.historicalAnchor !== 0 ? profile.historicalAnchor : 10;
        }
      }

      // Enforce domain semantic polarity
      const trigPolarity = getTriggerSemanticPolarity(desc);
      if (objective === 'underdog_only') {
        if (trigPolarity === 'PRO_UNDERDOG' && pts < 10) pts = 15;
        else if (trigPolarity === 'PRO_MFAV' && pts > -10) pts = -15;
      } else {
        if (trigPolarity === 'PRO_UNDERDOG' && pts > -10) pts = -15;
        else if (trigPolarity === 'PRO_MFAV' && pts < 10) pts = 15;
      }

      // Small sample guardrail (totalHits < 8): anchor to historical defaults
      if (totalHits < 8) {
        pts = profile.historicalAnchor;
      }

      // Clamp to trigger's empirical allowed band
      if (!profile.allowedBand.includes(pts)) {
        pts = profile.allowedBand.reduce((prev, curr) => Math.abs(curr - pts) < Math.abs(prev - pts) ? curr : prev);
      }
      optimizedPoints.set(desc, pts);
      totalComputations++;
    });
  } else {
    for (let pass = 0; pass < OPTIMIZATION_PASSES; pass++) {
      for (const triggerDesc of sortedTriggers) {
        const counts = hitStats.get(triggerDesc);
        const totalHits = counts ? counts.mfav + counts.draw + counts.underdog : 0;
        const currentVal = currentRulePointsMap.get(triggerDesc);
        const profile = getTriggerAccuracyProfile(triggerDesc, counts, objective, currentVal);

        // Less than 5 hits: keep at calibrated anchor
        if (totalHits < 5) {
          optimizedPoints.set(triggerDesc, profile.historicalAnchor);
          continue;
        }

        // Balanced triggers remain at historical anchor; non-balanced triggers explore their empirical point band
        if (totalHits >= 8 && isTriggerEmpiricallyBalanced(counts)) {
          optimizedPoints.set(triggerDesc, profile.historicalAnchor);
          continue;
        }

        // Search values restricted strictly to trigger's bounded empirical accuracy band (Delta_max = ±10)
        const searchValues = profile.allowedBand;
        let bestPoints = optimizedPoints.get(triggerDesc) ?? 0;
        if (!searchValues.includes(bestPoints)) {
          bestPoints = searchValues.reduce((prev, curr) => Math.abs(curr - bestPoints) < Math.abs(prev - bestPoints) ? curr : prev);
          optimizedPoints.set(triggerDesc, bestPoints);
        }
        let bestQuality = measurePairwiseSeparation(optimizedPoints);

        for (const testPts of searchValues) {
          optimizedPoints.set(triggerDesc, testPts);
          const quality = measurePairwiseSeparation(optimizedPoints);
          totalComputations++;

          if (quality > bestQuality + 0.0001) {
            bestQuality = quality;
            bestPoints = testPts;
          }
        }
        optimizedPoints.set(triggerDesc, bestPoints);
      }
    }
  }

  // Pure Algorithmic Optimization: Points derived from empirical outcomes without hardcoded driver labels.

  // Final Trigger Recommendation Generation
  const recs: TriggerRecommendation[] = catalogTriggers.map(desc => {
    const rawCounts = hitStats.get(desc) || { mfav: 0, draw: 0, underdog: 0 };
    const liveTotalHits = rawCounts.mfav + rawCounts.draw + rawCounts.underdog;
    const rawCurrent = currentRulePointsMap.get(desc);
    let currentPoints = (rawCurrent !== undefined && rawCurrent !== 0)
      ? rawCurrent
      : borrowTriggerPoints(desc, cat.id, selectedDay !== 'all' ? selectedDay : undefined);
    if (currentPoints === 0) {
      currentPoints = borrowTriggerPoints(desc, cat.id, selectedDay !== 'all' ? selectedDay : undefined);
    }

    let effectiveCounts = rawCounts;
    let usedDayHistory = false;
    let usedOverallHistory = false;
    const dayCounts = dayHistoricalCompletedMatches.length > 0 ? getDayHistStats(desc) : { mfav: 0, draw: 0, underdog: 0 };
    const dayTotalHits = dayCounts.mfav + dayCounts.draw + dayCounts.underdog;
    const overallStats = getOverallHistStats(desc);
    const overallTotalHits = overallStats.total;

    // 3-TIERED EVALUATION HIERARCHY FOR SMALL SAMPLES (< 5 live matches):
    // Tier 1: Current Live Slice (if >= 5 hits)
    // Tier 2: Weekday History for selected day (if live < 5 and day history >= 5)
    // Tier 3: Overall Historical Universe across ALL days (if live < 5 and day history < 5 and overall >= 5)
    if (liveTotalHits < 5) {
      if (dayTotalHits >= 5) {
        effectiveCounts = dayCounts;
        usedDayHistory = true;
      } else if (overallTotalHits >= 5) {
        effectiveCounts = { mfav: overallStats.mfav, draw: overallStats.draw, underdog: overallStats.underdog };
        usedOverallHistory = true;
      }
    }

    const totalHits = effectiveCounts.mfav + effectiveCounts.draw + effectiveCounts.underdog;
    const mfavPct = totalHits > 0 ? (effectiveCounts.mfav / totalHits) * 100 : 0;
    const drawPct = totalHits > 0 ? (effectiveCounts.draw / totalHits) * 100 : 0;
    const underdogPct = totalHits > 0 ? (effectiveCounts.underdog / totalHits) * 100 : 0;
    const safePct = mfavPct + drawPct;

    const profile = getTriggerAccuracyProfile(desc, effectiveCounts, objective, currentPoints);
    let recommendedPoints: number;
    let ratchetAction: 'increased_bonus' | 'deepened_penalty' | 'preserved' | 'none' = 'none';
    const basePoints = currentPoints !== 0 ? currentPoints : profile.historicalAnchor;
    const polarity = getTriggerSemanticPolarity(desc);
    const isUnderdogCat = objective === 'underdog_only';

    if (liveTotalHits < 5 && (usedDayHistory || usedOverallHistory)) {
      // Historical suggestion based on empirical accuracy & risk lift:
      let histSuggested = profile.historicalAnchor;
      if (objective === 'underdog_only') {
        const udRate = profile.underdogRate;
        const mfavRate = profile.mfavRate;
        if (profile.isVolatileSignal || udRate >= 0.22 || udRate > mfavRate) {
          if (udRate >= 0.45) histSuggested = 25;
          else if (udRate >= 0.38) histSuggested = 20;
          else if (udRate >= 0.30 || profile.underdogLift >= 1.40) histSuggested = 15;
          else if (udRate >= 0.24 || profile.underdogLift >= 1.25) histSuggested = 10;
          else histSuggested = 5;
        } else if (mfavRate >= 0.55 || udRate <= 0.12) {
          if (mfavRate >= 0.85) histSuggested = -40;
          else if (mfavRate >= 0.78) histSuggested = -35;
          else if (mfavRate >= 0.70) histSuggested = -30;
          else if (mfavRate >= 0.65) histSuggested = -25;
          else if (mfavRate >= 0.58) histSuggested = -20;
          else histSuggested = -10;
        } else {
          histSuggested = profile.historicalAnchor;
        }
      } else if (objective === 'mfav_only') {
        const mfavRate = profile.mfavRate;
        const udRate = profile.underdogRate;
        const trapRate = profile.trapFrequency;
        if (profile.isVolatileSignal || udRate >= 0.25 || trapRate >= 0.52 || mfavRate < 0.48) {
          if (udRate >= 0.45 || mfavRate <= 0.25) histSuggested = -40;
          else if (udRate >= 0.40 || mfavRate <= 0.30) histSuggested = -35;
          else if (udRate >= 0.35 || mfavRate <= 0.34) histSuggested = -30;
          else if (udRate >= 0.30 || mfavRate <= 0.38) histSuggested = -25;
          else if (udRate >= 0.25 || mfavRate <= 0.45 || profile.isVolatileSignal) histSuggested = -20;
          else histSuggested = -10;
        } else if (mfavRate >= 0.52 && udRate <= 0.20) {
          if (mfavRate >= 0.80) histSuggested = 25;
          else if (mfavRate >= 0.70) histSuggested = 20;
          else if (mfavRate >= 0.60) histSuggested = 15;
          else histSuggested = 10;
        } else {
          histSuggested = profile.historicalAnchor;
        }
      } else {
        const targetAcc = profile.targetAccuracy;
        const udRate = profile.underdogRate;
        const netEdge = targetAcc - udRate;
        if (targetAcc > udRate && udRate <= 0.25) {
          if (targetAcc >= 0.85 || netEdge >= 0.70) histSuggested = 25;
          else if (targetAcc >= 0.75 || netEdge >= 0.50) histSuggested = 20;
          else if (targetAcc >= 0.68 || netEdge >= 0.35) histSuggested = 15;
          else if (targetAcc >= 0.60 || netEdge >= 0.20) histSuggested = 10;
          else histSuggested = 5;
        } else if (udRate > 0.25 || udRate >= targetAcc) {
          if (udRate >= 0.60) histSuggested = -40;
          else if (udRate >= 0.55) histSuggested = -35;
          else if (udRate >= 0.50) histSuggested = -30;
          else if (udRate >= 0.42) histSuggested = -25;
          else if (udRate >= 0.35) histSuggested = -20;
          else if (udRate >= 0.28) histSuggested = -15;
          else histSuggested = -10;
        } else {
          histSuggested = profile.historicalAnchor;
        }
      }

      // ASYMMETRIC LEEWAY RATCHET:
      // We check historical accuracy, but allow leeway to INCREASE bonus or penalties, NEVER reduce them!
      if (isUnderdogCat) {
        if (polarity === 'PRO_UNDERDOG') {
          // Target in Upsets: Leeway to INCREASE bonus, NEVER reduce
          if (histSuggested > basePoints) {
            recommendedPoints = histSuggested;
            ratchetAction = 'increased_bonus';
          } else {
            recommendedPoints = basePoints;
            ratchetAction = 'preserved';
          }
        } else if (polarity === 'PRO_MFAV') {
          // Trap in Upsets: Leeway to DEEPEN penalty, NEVER reduce
          if (histSuggested < basePoints) {
            recommendedPoints = histSuggested;
            ratchetAction = 'deepened_penalty';
          } else {
            recommendedPoints = basePoints;
            ratchetAction = 'preserved';
          }
        } else {
          recommendedPoints = basePoints;
          ratchetAction = 'preserved';
        }
      } else {
        if (polarity === 'PRO_MFAV') {
          // Target in Mfav/Draw categories: Leeway to INCREASE bonus, NEVER reduce
          if (histSuggested > basePoints) {
            recommendedPoints = histSuggested;
            ratchetAction = 'increased_bonus';
          } else {
            recommendedPoints = basePoints;
            ratchetAction = 'preserved';
          }
        } else if (polarity === 'PRO_UNDERDOG') {
          // Trap in Mfav/Draw categories: Leeway to DEEPEN penalty, NEVER reduce
          if (histSuggested < basePoints) {
            recommendedPoints = histSuggested;
            ratchetAction = 'deepened_penalty';
          } else {
            recommendedPoints = basePoints;
            ratchetAction = 'preserved';
          }
        } else {
          recommendedPoints = basePoints;
          ratchetAction = 'preserved';
        }
      }
    } else if (liveTotalHits < 5) {
      // Both live slice and historical data have sparse hits (< 5):
      // Retain calibrated points to build upon previous accuracy
      recommendedPoints = basePoints;
      ratchetAction = 'preserved';
    } else {
      // Standard calibration from active slice (>= 5 hits):
      recommendedPoints = optimizedPoints.get(desc) ?? profile.historicalAnchor;
      ratchetAction = 'none';
    }

    // Clamp recommendation strictly to trigger's empirical allowed band (which already bounds drift & volatility)
    if (profile.allowedBand.length > 0 && !profile.allowedBand.includes(recommendedPoints)) {
      recommendedPoints = profile.allowedBand.reduce((prev, curr) => Math.abs(curr - recommendedPoints) < Math.abs(prev - recommendedPoints) ? curr : prev);
    }

    // Universal clamp: max bonus +25, max penalty -40 across all categories
    recommendedPoints = Math.max(-40, Math.min(25, recommendedPoints));
    if (recommendedPoints === 0) {
      recommendedPoints = borrowTriggerPoints(desc, cat.id, selectedDay);
    }

    let confidence: TriggerRecommendation['confidence'] = 'Insufficient Data';
    if (totalHits >= 10) confidence = 'High';
    else if (totalHits >= 5) confidence = 'Medium';
    else if (totalHits >= 2) confidence = 'Low';

    let rationale = '';
    if (liveTotalHits < 5) {
      const sourceName = usedDayHistory
        ? `${dayTotalHits} weekday historical matches (${selectedDay === 'all' ? '' : selectedDay})`
        : usedOverallHistory
          ? `${overallTotalHits} overall historical matches (all days combined)`
          : `sparse historical data (${dayTotalHits} day, ${overallTotalHits} overall)`;

      if (usedDayHistory || usedOverallHistory) {
        if (ratchetAction === 'increased_bonus') {
          rationale = `Live sample < 5 (${liveTotalHits} hits). Evaluated on ${sourceName} (${effectiveCounts.mfav} Mfav, ${effectiveCounts.draw} Draw, ${effectiveCounts.underdog} UD — ${safePct.toFixed(0)}% safe). Conviction bonus increased from ${basePoints > 0 ? '+' : ''}${basePoints} to +${recommendedPoints} pts (protected from reduction).`;
        } else if (ratchetAction === 'deepened_penalty') {
          rationale = `Live sample < 5 (${liveTotalHits} hits). Evaluated on ${sourceName} (${effectiveCounts.underdog} UD, ${effectiveCounts.draw} Draw — ${underdogPct.toFixed(0)}% trap). Penalty deepened from ${basePoints} to ${recommendedPoints} pts (protected from reduction).`;
        } else {
          rationale = `Live sample < 5 (${liveTotalHits} hits). Evaluated on ${sourceName}. Preserved calibrated ${basePoints > 0 ? '+' : ''}${basePoints} pts (ratchet leeway protects against point reduction).`;
        }
      } else {
        rationale = `Sample < 5 (${liveTotalHits} live, ${dayTotalHits} day, ${overallTotalHits} overall). Preserved calibrated ${currentPoints > 0 ? '+' : ''}${currentPoints} pts to build upon previous accuracy.`;
      }
    } else if (totalHits < 8) {
      rationale = `${mfavPct.toFixed(0)}% Mfav, ${drawPct.toFixed(0)}% Draw, ${underdogPct.toFixed(0)}% UD (${totalHits} hits, Anchored to Hist ${profile.historicalAnchor > 0 ? '+' : ''}${profile.historicalAnchor} pts).`;
    } else {
      const volTag = profile.isVolatileSignal ? ' [Volatile]' : '';
      const dps = triggerDPS.get(desc) ?? 0;
      rationale = `${mfavPct.toFixed(0)}% Mfav, ${drawPct.toFixed(0)}% Draw, ${underdogPct.toFixed(0)}% UD (DPS ${dps > 0 ? '+' : ''}${dps.toFixed(2)})${volTag}.`;
    }

    const netEdge = objective === 'underdog_only'
      ? (underdogPct - mfavPct)
      : (mfavPct - (underdogPct * 1.5 + drawPct * 0.5));

    const finalCurrentPoints = currentPoints !== 0
      ? currentPoints
      : borrowTriggerPoints(desc, cat.id, selectedDay !== 'all' ? selectedDay : undefined);
    const finalRecommendedPoints = recommendedPoints !== 0
      ? recommendedPoints
      : borrowTriggerPoints(desc, cat.id, selectedDay !== 'all' ? selectedDay : undefined);

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

export const OPWAlgo: React.FC<OPWAlgoProps> = ({
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

  useEffect(() => {
    if (datasetScope === 'live' && (!initialDay || initialDay === 'all') && !userPickedDayRef.current) {
      setSelectedDay(liveMatchDay);
      setSelectedAdoptDays(new Set([liveMatchDay]));
    }
  }, [datasetScope, liveMatchDay, initialDay]);
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendationFilter, setRecommendationFilter] = useState<'all' | 'bonus' | 'penalty' | 'protected' | 'zero' | 'mismatch'>('all');
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
  const [deepTargetsInTop5000, setDeepTargetsInTop5000] = useState(0);
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

  // Protected Penalty Guards & Slip Upset Post-Mortem State
  const [protectedGuardsList, setProtectedGuardsList] = useState<ProtectedPenaltyGuard[]>(() => loadProtectedPenaltyGuards());
  const [slipPostMortems, setSlipPostMortems] = useState<SlipUpsetPostMortem[]>([]);
  const [showPostMortemPanel, setShowPostMortemPanel] = useState<boolean>(true);

  // AI Trigger Discovery & Synergistic Combos State
  const [discoveredCandidates, setDiscoveredCandidates] = useState<CandidateComboTrigger[]>([]);
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [showDiscoveryPanel, setShowDiscoveryPanel] = useState<boolean>(false);
  const [discoveryFilter, setDiscoveryFilter] = useState<'all' | 'combos' | 'continuations' | 'approved'>('all');
  const [customTriggersVersion, setCustomTriggersVersion] = useState<number>(0);
  const [weightsVersion, setWeightsVersion] = useState<number>(0);
  const [approvedCustomTriggersList, setApprovedCustomTriggersList] = useState<ApprovedCustomTrigger[]>(() => loadApprovedCustomTriggers());

  useEffect(() => {
    const handleCustomUpdate = () => {
      setApprovedCustomTriggersList(loadApprovedCustomTriggers());
      setCustomTriggersVersion(v => v + 1);
    };
    const handleWeightsUpdate = () => {
      setWeightsVersion(v => v + 1);
    };
    const handleGuardsUpdate = () => {
      setProtectedGuardsList(loadProtectedPenaltyGuards());
    };
    window.addEventListener('seerCustomTriggersUpdated', handleCustomUpdate);
    window.addEventListener('optimizedWeightsUpdated', handleWeightsUpdate);
    window.addEventListener('opwProtectedGuardsUpdated', handleGuardsUpdate);

    // Hydrate approved combos from server storage for persistent cross-browser consistency
    hydrateCustomTriggersFromServer().then(list => {
      if (list && list.length > 0) {
        setApprovedCustomTriggersList(list);
        setCustomTriggersVersion(v => v + 1);
      }
    });

    return () => {
      window.removeEventListener('seerCustomTriggersUpdated', handleCustomUpdate);
      window.removeEventListener('optimizedWeightsUpdated', handleWeightsUpdate);
      window.removeEventListener('opwProtectedGuardsUpdated', handleGuardsUpdate);
    };
  }, []);

  // Fetch slip post-mortems whenever matches, active category, or protected guards change
  useEffect(() => {
    let isMounted = true;
    const fetchSlipUpsets = async () => {
      const activeDate = matches && matches.length > 0 && matches[0].date
        ? getAnalysisDateString(matches[0].date)
        : getAnalysisDateString();
      try {
        const slip = await getLockedSlip(activeDate, activeCategoryConfig.id);
        if (slip && isMounted) {
          const pms = analyzeSlipUpsets(slip, completedMatches);
          setSlipPostMortems(pms);
        } else if (isMounted) {
          setSlipPostMortems([]);
        }
      } catch (e) {
        console.warn('Error analyzing slip upsets:', e);
      }
    };
    fetchSlipUpsets();
    return () => { isMounted = false; };
  }, [matches, activeCategoryConfig?.id, completedMatches, protectedGuardsList]);

  const activeCategoryConfig = useMemo(() => {
    return CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0];
  }, [activeCategory]);

  // Synchronize Deep Optimizer whenever activeCategory changes so all metrics are strictly contextual
  useEffect(() => {
    if (isBatchOptimizingRef.current) {
      // During batch optimization, category switching is contextual HUD progression, do not abort!
      return;
    }
    stopDeepRef.current = true;
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
    
    // Retain and restore calibrated deep continuous optimizer points if already computed for this category!
    const existingPoints = deepCategoryPointsMap[activeCategory];
    if (existingPoints && existingPoints.size > 0) {
      setDeepPointsMap(new Map(existingPoints));
      setDeepStatus('converged');
    } else {
      setDeepPointsMap(null);
    }
  }, [activeCategory]);

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

  // Active category settings for points comparison
  const activeSettings = useMemo(() => {
    if (selectedDay !== 'all') {
      return DAILY_OPTIMIZED_SETTINGS[selectedDay]?.[activeCategory] ||
        DAILY_DEFAULT_CATEGORY_SETTINGS[selectedDay]?.[activeCategory] ||
        OPTIMIZED_CATEGORY_SETTINGS[activeCategory];
    }
    return OPTIMIZED_CATEGORY_SETTINGS[activeCategory] ||
      DAILY_DEFAULT_CATEGORY_SETTINGS.saturday?.[activeCategory];
  }, [activeCategory, selectedDay, weightsVersion]);

  // Current rule points map
  const currentRulePointsMap = useMemo(() => {
    const map = new Map<string, number>();
    (activeSettings?.rules || []).forEach(r => map.set(r.description, r.points));
    return map;
  }, [activeSettings]);

  // Compute trigger statistics & recommendations via multi-pass statistical optimizer
  const { recommendations, baselineStats, optimizerMeta } = useMemo(() => {
    return computeCategoryRecommendations(
      activeCategoryConfig,
      rawDataset,
      phaStatsMap,
      matchStars,
      liveViewType,
      selectedDay,
      allMatches
    );
  }, [activeCategoryConfig, rawDataset, phaStatsMap, matchStars, liveViewType, selectedDay, allMatches, customTriggersVersion, weightsVersion]);

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
    if (!deepPointsMap) {
      return recommendations.map(r => ({
        ...r,
        currentPoints: r.currentPoints !== 0 ? r.currentPoints : borrowTriggerPoints(r.description, activeCategoryConfig.id, selectedDay !== 'all' ? selectedDay : undefined),
        recommendedPoints: r.recommendedPoints !== 0 ? r.recommendedPoints : borrowTriggerPoints(r.description, activeCategoryConfig.id, selectedDay !== 'all' ? selectedDay : undefined)
      }));
    }
    return recommendations.map(r => {
      const deepPts = deepPointsMap.get(r.description);
      const curPts = r.currentPoints !== 0 ? r.currentPoints : borrowTriggerPoints(r.description, activeCategoryConfig.id, selectedDay !== 'all' ? selectedDay : undefined);
      if (deepPts !== undefined) {
        const finalDeepPts = deepPts !== 0 ? deepPts : borrowTriggerPoints(r.description, activeCategoryConfig.id, selectedDay !== 'all' ? selectedDay : undefined);
        return {
          ...r,
          currentPoints: curPts,
          recommendedPoints: finalDeepPts,
          rationale: deepPts !== r.recommendedPoints
            ? `Deep Optimizer: ${finalDeepPts > 0 ? '+' : ''}${finalDeepPts} pts (${deepComputations.toLocaleString()} iterations, ${deepPurityPct.toFixed(0)}% purity, ${deepInversions} inversions).`
            : r.rationale
        };
      }
      return {
        ...r,
        currentPoints: curPts,
        recommendedPoints: r.recommendedPoints !== 0 ? r.recommendedPoints : borrowTriggerPoints(r.description, activeCategoryConfig.id, selectedDay !== 'all' ? selectedDay : undefined)
      };
    });
  }, [recommendations, deepPointsMap, deepComputations, deepPurityPct, deepInversions, activeCategoryConfig, selectedDay]);

  // Live Verification: Ranking verification with real database outcome metrics
  const liveSelectionImpact = useMemo(() => {
    if (completedMatches.length === 0) return null;

    const recommendedMap = new Map<string, number>();
    effectiveRecommendations.forEach(r => recommendedMap.set(r.description, r.recommendedPoints));

    const scoredCurrent: { match: Match; score: number; outcome: 'mfav' | 'draw' | 'underdog'; teams: string }[] = [];
    const scoredRecommended: { match: Match; score: number; outcome: 'mfav' | 'draw' | 'underdog'; teams: string }[] = [];

    const sampleMatches = completedMatches.length > 200 ? completedMatches.slice(-200) : completedMatches;

    sampleMatches.forEach(m => {
      const actual = getActualResult(m.result || '');
      const mFav = getMarketFavorite(m);
      const outcome: 'mfav' | 'draw' | 'underdog' = actual === mFav ? 'mfav' : actual === 'X' ? 'draw' : 'underdog';

      const matchDay = selectedDay !== 'all' ? selectedDay : getMatchDayOfWeek(m);
      const baseInfo = getOptimizedBaseWeight(m, phaStatsMap, activeCategory, matchDay);
      const baseScore = baseInfo?.points ?? 0;

      const stats = extractMatchEvaluationStats(m, phaStatsMap, activeCategory);
      const allTriggers = evaluateAllCatalogTriggers(stats, m);

      // Current score using active rule points
      let currentScore = baseScore;
      allTriggers.forEach(t => {
        if (t === "Odds for underdog >= 3.0" && activeCategoryConfig.targetObjective !== 'underdog_only') return;
        currentScore += currentRulePointsMap.get(t) ?? 0;
      });
      scoredCurrent.push({ match: m, score: currentScore, outcome, teams: m.teams });

      // Recalculate score using recommended points across all triggered catalog rules
      let recScore = baseScore;
      allTriggers.forEach(t => {
        if (t === "Odds for underdog >= 3.0" && activeCategoryConfig.targetObjective !== 'underdog_only') return;
        const recPts = recommendedMap.get(t) ?? 0;
        recScore += recPts;
      });
      scoredRecommended.push({ match: m, score: recScore, outcome, teams: m.teams });
    });

    scoredCurrent.sort((a, b) => b.score - a.score);
    scoredRecommended.sort((a, b) => b.score - a.score);

    const objective = activeCategoryConfig.targetObjective;
    const defaultCategoryCap = activeCategoryConfig.targetCapacity;
    const topN = Math.min(defaultCategoryCap, scoredCurrent.length);

    // Current weights analysis
    const topCurrent = scoredCurrent.slice(0, topN);
    const currentMfav = topCurrent.filter(x => x.outcome === 'mfav').length;
    const currentDraw = topCurrent.filter(x => x.outcome === 'draw').length;
    const currentUd = topCurrent.filter(x => x.outcome === 'underdog').length;

    // Recommended weights analysis
    const topRec = scoredRecommended.slice(0, topN);
    const recMfav = topRec.filter(x => x.outcome === 'mfav').length;
    const recDraw = topRec.filter(x => x.outcome === 'draw').length;
    const recUd = topRec.filter(x => x.outcome === 'underdog').length;

    // Objective-aware target success count
    let currentSafe = currentMfav + currentDraw;
    let recSafe = recMfav + recDraw;
    let metricLabel = 'Safe Rate';

    if (objective === 'underdog_only') {
      currentSafe = currentUd;
      recSafe = recUd;
      metricLabel = 'Underdog Win Rate';
    } else if (objective === 'mfav_only') {
      currentSafe = currentMfav;
      recSafe = recMfav;
      metricLabel = 'Mfav Win Rate';
    }

    const isTarget = (outcome: 'mfav' | 'draw' | 'underdog') => {
      if (objective === 'underdog_only') return outcome === 'underdog';
      if (objective === 'mfav_only') return outcome === 'mfav';
      return outcome !== 'underdog';
    };

    // Purity at cut-offs
    const purityAtN = (scored: typeof scoredCurrent, n: number) => {
      const top = scored.slice(0, Math.min(n, scored.length));
      const targetCount = top.filter(x => isTarget(x.outcome)).length;
      return top.length > 0 ? (targetCount / top.length) * 100 : 0;
    };

    // Find worst target rank and best trap rank
    let lastMfavRank = -1;
    let firstNonMfavRank = -1;
    for (let i = 0; i < scoredRecommended.length; i++) {
      if (isTarget(scoredRecommended[i].outcome)) lastMfavRank = i + 1;
      if (firstNonMfavRank < 0 && !isTarget(scoredRecommended[i].outcome)) firstNonMfavRank = i + 1;
    }

    // Top 20 ranking breakdown for recommended
    const top20Rec = scoredRecommended.slice(0, Math.min(20, scoredRecommended.length)).map((x, i) => ({
      rank: i + 1,
      teams: x.teams,
      score: x.score,
      outcome: x.outcome
    }));

    // Calculate Pairwise Inversions in O(N) linear time over sorted arrays
    let currentInversions = 0;
    let currentTrapsSeen = 0;
    for (const m of scoredCurrent) {
      if (isTarget(m.outcome)) {
        currentInversions += currentTrapsSeen;
      } else {
        currentTrapsSeen++;
      }
    }

    let recInversions = 0;
    let recTrapsSeen = 0;
    for (const m of scoredRecommended) {
      if (isTarget(m.outcome)) {
        recInversions += recTrapsSeen;
      } else {
        recTrapsSeen++;
      }
    }

    return {
      topN,
      metricLabel,
      current: { mfav: currentMfav, draw: currentDraw, ud: currentUd, safe: currentSafe, safePct: topN > 0 ? (currentSafe / topN) * 100 : 0, inversions: currentInversions },
      recommended: { mfav: recMfav, draw: recDraw, ud: recUd, safe: recSafe, safePct: topN > 0 ? (recSafe / topN) * 100 : 0, inversions: recInversions },
      improvement: topN > 0 ? ((recSafe - currentSafe) / topN) * 100 : 0,
      mfavImprovement: topN > 0 ? ((recMfav - currentMfav) / topN) * 100 : 0,
      purity: {
        currentTop5: purityAtN(scoredCurrent, 5),
        currentTop10: purityAtN(scoredCurrent, 10),
        currentTop12: purityAtN(scoredCurrent, 12),
        currentTop20: purityAtN(scoredCurrent, 20),
        recTop5: purityAtN(scoredRecommended, 5),
        recTop10: purityAtN(scoredRecommended, 10),
        recTop12: purityAtN(scoredRecommended, 12),
        recTop20: purityAtN(scoredRecommended, 20)
      },
      lastMfavRank,
      firstNonMfavRank,
      top20Ranking: top20Rec
    };
  }, [completedMatches, effectiveRecommendations, selectedDay, activeCategory, phaStatsMap, activeCategoryConfig]);

  // Start Continuous Deep Optimization for active category
  const startDeepOptimization = useCallback(() => {
    if (completedMatches.length === 0) {
      showToast('No completed matches available in this category/timeframe to optimize.');
      return;
    }

    setIsDeepOptimizing(true);
    setDeepStatus('running');
    stopDeepRef.current = false;
    const isHistoryMode = datasetScope === 'history';

    // Build match profiles for fast non-blocking evaluation
    interface MatchProfile {
      teams: string;
      outcome: 'mfav' | 'draw' | 'underdog';
      triggersHit: Set<string>;
      baseScore: number;
    }
    const profiles: MatchProfile[] = [];

    completedMatches.forEach(m => {
      const actual = getActualResult(m.result || '');
      if (actual !== '1' && actual !== 'X' && actual !== '2') return;

      // Data integrity: Ensure valid market odds exist to prevent hallucinated market favorites
      const moParts = (m.mo || '').split(/[- ,]+/).map(s => parseFloat(s.trim())).filter(p => !isNaN(p));
      const homeOdds = moParts[0] || 0;
      const awayOdds = moParts[2] || 0;
      if (homeOdds <= 0 || awayOdds <= 0) return;

      const mFav = getMarketFavorite(m);
      const outcome: 'mfav' | 'draw' | 'underdog' = actual === mFav ? 'mfav' : actual === 'X' ? 'draw' : 'underdog';

      let allTriggers: Set<string> = (m as any)._opwCatalogTriggers;
      if (!allTriggers) {
        const stats = extractMatchEvaluationStats(m, phaStatsMap, activeCategory);
        allTriggers = evaluateAllCatalogTriggers(stats, m);
        (m as any)._opwCatalogTriggers = allTriggers;
      }
      const triggersHit = new Set<string>();
      allTriggers.forEach(t => {
        if (t === "Odds for underdog >= 3.0" && activeCategoryConfig.targetObjective !== 'underdog_only') return;
        triggersHit.add(t);
      });
      const matchDay = selectedDay !== 'all' ? selectedDay : getMatchDayOfWeek(m);
      const evalCat = activeCategory === 'safety' ? 'best_bet' : activeCategory;
      const baseInfo = getOptimizedBaseWeight(m, phaStatsMap, evalCat, matchDay);
      profiles.push({
        teams: m.teams || 'Unknown',
        outcome,
        triggersHit,
        baseScore: baseInfo?.points ?? 0
      });
    });

    if (profiles.length === 0) {
      setIsDeepOptimizing(false);
      setDeepStatus('idle');
      showToast('Could not evaluate match profiles.');
      return;
    }

    // Active triggers that fired in at least one completed match
    const activeTriggersSet = new Set<string>();
    profiles.forEach(p => p.triggersHit.forEach(t => activeTriggersSet.add(t)));
    const activeTriggers = Array.from(activeTriggersSet);

    // Compute empirical trigger statistics across all completed match profiles
    const catalogTriggers = getFullActiveCatalogTriggers();
    const hitStatsMap = new Map<string, { mfav: number; draw: number; underdog: number }>();
    catalogTriggers.forEach(desc => {
      hitStatsMap.set(desc, { mfav: 0, draw: 0, underdog: 0 });
    });
    profiles.forEach(p => {
      p.triggersHit.forEach(t => {
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

    // Historical universe hits map across allMatches (for triggers with matches in history)
    const histHitsMap = new Map<string, { mfav: number; draw: number; underdog: number; total: number }>();
    if (allMatches && allMatches.length > 0) {
      allMatches.forEach(m => {
        const actual = getActualResult(m.result || '');
        if (actual !== '1' && actual !== 'X' && actual !== '2') return;
        const moParts = (m.mo || '').split(/[- ,]+/).map(s => parseFloat(s.trim())).filter(p => !isNaN(p));
        if ((moParts[0] || 0) <= 0 || (moParts[2] || 0) <= 0) return;
        const mFav = getMarketFavorite(m);
        const out: 'mfav' | 'draw' | 'underdog' = actual === mFav ? 'mfav' : actual === 'X' ? 'draw' : 'underdog';
        let trigs: Set<string> = (m as any)._opwCatalogTriggers;
        if (!trigs) {
          const stats = extractMatchEvaluationStats(m, phaStatsMap, activeCategory);
          trigs = evaluateAllCatalogTriggers(stats, m);
          (m as any)._opwCatalogTriggers = trigs;
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
      });
    }

    // Initial points map: resume from deepPointsMap or initialize from current calibrated rules
    // FIRST GOAL: For all triggers that have historical/live matches (totalHits > 0) whose OPW points are zero (or undefined),
    // seed them immediately to +5 or -5 based on category objective, empirical win rate, and semantic polarity!
    // Triggers with zero matches (totalHits === 0) are strictly kept as they are (preserving existing points like +20, etc.).
    const protectedGuards = loadProtectedPenaltyGuards();
    const protectedGuardsMap = new Map<string, number>(protectedGuards.map(g => [g.trigger, g.floorPoints]));

    const currentPoints = new Map<string, number>();
    catalogTriggers.forEach(desc => {
      const counts = hitStatsMap.get(desc);
      const sliceHits = counts ? (counts.mfav + counts.draw + counts.underdog) : 0;
      const histCounts = histHitsMap.get(desc);
      const histHits = histCounts ? histCounts.total : 0;
      const totalHits = sliceHits + histHits;
      const existing = deepPointsMap?.get(desc) ?? currentRulePointsMap.get(desc);
      const profile = getTriggerAccuracyProfile(desc, counts, activeCategoryConfig.targetObjective, existing, isHistoryMode);
      const guardFloor = protectedGuardsMap.get(desc);

      let initVal: number;

      if (totalHits > 0) {
        // Trigger fired on real matches in the dataset (live slice or historical universe):
        if (existing !== undefined && existing !== 0 && ALLOWED_POINT_VALUES.includes(existing)) {
          // Already had calibrated non-zero points: strictly keep as is
          initVal = existing;
        } else {
          // OPW points are zero (or undefined): FIRST GOAL -> Seed to +5 or -5
          const polarity = getTriggerSemanticPolarity(desc);
          const isUnderdogCat = activeCategoryConfig.targetObjective === 'underdog_only';
          const isMfavOnly = activeCategoryConfig.targetObjective === 'mfav_only';

          if (isUnderdogCat) {
            if (polarity === 'PRO_UNDERDOG') initVal = 5;
            else if (polarity === 'PRO_MFAV') initVal = -5;
            else {
              const udRate = counts && sliceHits > 0 ? (counts.underdog / sliceHits) : (histCounts && histHits > 0 ? (histCounts.underdog / histHits) : 0);
              initVal = udRate >= 0.25 ? 5 : -5;
            }
          } else if (isMfavOnly) {
            if (polarity === 'PRO_MFAV') initVal = 5;
            else if (polarity === 'PRO_UNDERDOG') initVal = -5;
            else {
              const mfavRate = counts && sliceHits > 0 ? (counts.mfav / sliceHits) : (histCounts && histHits > 0 ? (histCounts.mfav / histHits) : 0);
              initVal = mfavRate >= 0.50 ? 5 : -5;
            }
          } else {
            // mfav_draw (Top 12, Bankers, Value Picks, etc.)
            if (polarity === 'PRO_MFAV') initVal = 5;
            else if (polarity === 'PRO_UNDERDOG') initVal = -5;
            else {
              const safeRate = counts && sliceHits > 0 ? ((counts.mfav + counts.draw) / sliceHits) : (histCounts && histHits > 0 ? ((histCounts.mfav + histCounts.draw) / histHits) : 0);
              initVal = safeRate >= 0.60 ? 5 : -5;
            }
          }
        }
      } else {
        // Triggers with ZERO matches: keep them as they are!
        // If they had +20, -15, etc., stay as such, not being pushed to zero.
        // If uncalibrated/0, borrow default points so they are never 0.
        initVal = (existing !== undefined && existing !== 0)
          ? existing
          : borrowTriggerPoints(desc, activeCategoryConfig.id, selectedDay !== 'all' ? selectedDay : undefined);
      }

      if (initVal === 0) {
        initVal = borrowTriggerPoints(desc, activeCategoryConfig.id, selectedDay !== 'all' ? selectedDay : undefined);
      }

      if (guardFloor !== undefined && guardFloor <= -5) {
        if (initVal > guardFloor) initVal = guardFloor;
      }

      if (initVal !== 0 && profile.allowedBand.length > 0 && !profile.allowedBand.includes(initVal)) {
        initVal = profile.allowedBand.reduce((prev, curr) => Math.abs(curr - initVal) < Math.abs(prev - initVal) ? curr : prev);
      }

      if (guardFloor !== undefined && guardFloor <= -5 && initVal > guardFloor) {
        initVal = guardFloor;
      }

      currentPoints.set(desc, initVal);
    });

    const numMatches = profiles.length;
    // Flat typed arrays for maximum cache locality and zero GC overhead
    const isTarget = new Uint8Array(numMatches);
    const matchScores = new Int16Array(numMatches);
    let totalCorrectMatches = 0;

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
      p.triggersHit.forEach(t => {
        s += currentPoints.get(t) ?? 0;
      });
      matchScores[i] = Math.max(-299, Math.min(299, s));
    }

    // Inverted index: single-pass mapping of triggers to Int32Array of match indices (instant < 5ms)
    const triggerIndicesMap = new Map<string, number[]>();
    const triggerTargetCounts = new Map<string, number>();
    const triggerTrapCounts = new Map<string, number>();

    catalogTriggers.forEach(desc => {
      triggerIndicesMap.set(desc, []);
      triggerTargetCounts.set(desc, 0);
      triggerTrapCounts.set(desc, 0);
    });

    for (let i = 0; i < numMatches; i++) {
      const isTg = isTarget[i] === 1;
      profiles[i].triggersHit.forEach(desc => {
        const list = triggerIndicesMap.get(desc);
        if (list) {
          list.push(i);
          if (isTg) {
            triggerTargetCounts.set(desc, (triggerTargetCounts.get(desc) || 0) + 1);
          } else {
            triggerTrapCounts.set(desc, (triggerTrapCounts.get(desc) || 0) + 1);
          }
        }
      });
    }

    const triggerToIndices = new Map<string, Int32Array>();
    catalogTriggers.forEach(desc => {
      triggerToIndices.set(desc, new Int32Array(triggerIndicesMap.get(desc) || []));
    });

    // In live mode, triggers with >= 2 hits in the active match profiles (or >= 1 live hit and >= 20 historical hits) participate in mutations.
    // Triggers with insufficient hits strictly retain their calibrated points to build upon previous accuracy.
    const eligibleTriggers = isHistoryMode
      ? catalogTriggers
      : activeTriggers.filter(t => {
          const liveHits = triggerToIndices.get(t)?.length || 0;
          const histHits = histHitsMap.get(t)?.total || 0;
          return liveHits >= 2 || (liveHits >= 1 && histHits >= 20);
        });

    // Broad high-volume drivers (triggers with >= 20 hits in history or >= 4 hits in live, or >= 2 live + >= 20 history)
    // Ensures macro indicators (odds thresholds, predictor consensus, PAA, TS, rating, etc.)
    // actively participate in mutations and are never starved of compute cycles.
    const broadDriverTriggers = eligibleTriggers.filter(t => {
      const liveHits = triggerToIndices.get(t)?.length || 0;
      const histHits = histHitsMap.get(t)?.total || 0;
      return isHistoryMode ? histHits >= 20 : (liveHits >= 4 || (liveHits >= 2 && histHits >= 20));
    });

    const horizons = calculateTargetHorizons(profiles.length, totalCorrectMatches, activeCategoryConfig.targetCapacity, activeCategoryConfig.targetObjective);

    // 601 Buckets for scores from -300 to +300 (offset = 300)
    const SCORE_OFFSET = 300;
    const BUCKET_COUNT = 601;
    const targetBuckets = new Int32Array(BUCKET_COUNT);
    const trapBuckets = new Int32Array(BUCKET_COUNT);

    for (let i = 0; i < numMatches; i++) {
      const b = matchScores[i] + SCORE_OFFSET;
      if (isTarget[i] === 1) targetBuckets[b]++;
      else trapBuckets[b]++;
    }

    const fastEvaluateBuckets = (
      tBuckets: Int32Array,
      trBuckets: Int32Array,
      points: Map<string, number>
    ) => {
      // 1. Find highest trap bucket
      let maxTrapB = -1;
      for (let b = BUCKET_COUNT - 1; b >= 0; b--) {
        if (trBuckets[b] > 0) {
          maxTrapB = b;
          break;
        }
      }

      // 2. Clean streak: count of targets strictly higher than highest trap
      let cleanTop = 0;
      if (maxTrapB >= 0) {
        for (let b = BUCKET_COUNT - 1; b > maxTrapB; b--) {
          cleanTop += tBuckets[b];
        }
      } else {
        cleanTop = totalCorrectMatches;
      }

      // 3. Top N purity
      let targetInTopN = 0;
      let trapInTopN = 0;
      let counted = 0;
      const topNCapacity = activeCategoryConfig.targetCapacity;
      for (let b = BUCKET_COUNT - 1; b >= 0 && counted < topNCapacity; b--) {
        const inB = tBuckets[b] + trBuckets[b];
        if (inB === 0) continue;
        const rem = topNCapacity - counted;
        if (inB <= rem) {
          targetInTopN += tBuckets[b];
          trapInTopN += trBuckets[b];
          counted += inB;
        } else {
          const takeT = Math.min(tBuckets[b], rem);
          targetInTopN += takeT;
          trapInTopN += (rem - takeT);
          counted = topNCapacity;
        }
      }

      // 3b. Multi-Horizon Cumulative Trap & Target Density calculation (500, 1000, 1500, 2000, 3000)
      const horizonLimits = [500, 1000, 1500, 2000, 3000];
      const hTraps = [0, 0, 0, 0, 0];
      const hTargets = [0, 0, 0, 0, 0];
      let hIdx = 0;
      let runMatches = 0;
      let runT = 0;
      let runTr = 0;

      for (let b = BUCKET_COUNT - 1; b >= 0 && hIdx < horizonLimits.length; b--) {
        const inB = tBuckets[b] + trBuckets[b];
        if (inB === 0) continue;

        while (hIdx < horizonLimits.length && runMatches + inB >= horizonLimits[hIdx]) {
          const rem = horizonLimits[hIdx] - runMatches;
          const addT = Math.min(tBuckets[b], rem);
          const addTr = rem - addT;
          hTargets[hIdx] = runT + addT;
          hTraps[hIdx] = runTr + addTr;
          hIdx++;
        }

        runMatches += inB;
        runT += tBuckets[b];
        runTr += trBuckets[b];
      }
      while (hIdx < horizonLimits.length) {
        hTargets[hIdx] = runT;
        hTraps[hIdx] = runTr;
        hIdx++;
      }

      const horizonMetrics: MultiHorizonSummary = {
        h500: { horizon: 500, traps: hTraps[0], targets: hTargets[0], total: Math.min(500, runMatches), winRate: (hTargets[0] + hTraps[0]) > 0 ? (hTargets[0] / (hTargets[0] + hTraps[0])) * 100 : 0 },
        h1000: { horizon: 1000, traps: hTraps[1], targets: hTargets[1], total: Math.min(1000, runMatches), winRate: (hTargets[1] + hTraps[1]) > 0 ? (hTargets[1] / (hTargets[1] + hTraps[1])) * 100 : 0 },
        h1500: { horizon: 1500, traps: hTraps[2], targets: hTargets[2], total: Math.min(1500, runMatches), winRate: (hTargets[2] + hTraps[2]) > 0 ? (hTargets[2] / (hTargets[2] + hTraps[2])) * 100 : 0 },
        h2000: { horizon: 2000, traps: hTraps[3], targets: hTargets[3], total: Math.min(2000, runMatches), winRate: (hTargets[3] + hTraps[3]) > 0 ? (hTargets[3] / (hTargets[3] + hTraps[3])) * 100 : 0 },
        h3000: { horizon: 3000, traps: hTraps[4], targets: hTargets[4], total: Math.min(3000, runMatches), winRate: (hTargets[4] + hTraps[4]) > 0 ? (hTargets[4] / (hTargets[4] + hTraps[4])) * 100 : 0 },
      };

      const isMfavDraw = activeCategoryConfig.targetObjective === 'mfav_draw';
      const maxTrapsAllowed500 = isMfavDraw ? 25 : 50;
      const maxTrapsAllowed1000 = isMfavDraw ? 60 : 100;
      const excessTraps500 = Math.max(0, hTraps[0] - maxTrapsAllowed500);
      const excessTraps1000 = Math.max(0, hTraps[1] - maxTrapsAllowed1000);

      const horizonFitness = (numMatches > 50) ? (
        (hTargets[0] * 25 - hTraps[0] * 150 - excessTraps500 * 300) +
        (hTargets[1] * 20 - hTraps[1] * 100 - excessTraps1000 * 200) +
        (hTargets[2] * 15 - hTraps[2] * 50) +
        (hTargets[3] * 10 - hTraps[3] * 30) +
        (hTargets[4] * 5  - hTraps[4] * 15)
      ) : 0;

      // 4. Soft-margin boundary penalty on elevated traps
      // Find the score bucket of the frontier target (e.g. 100th to 500th target)
      let tCounted = 0;
      let boundaryB = 0;
      const boundaryTargetGoal = Math.min(horizons.floor, Math.max(topNCapacity, 100));
      for (let b = BUCKET_COUNT - 1; b >= 0; b--) {
        tCounted += tBuckets[b];
        if (tCounted >= boundaryTargetGoal) {
          boundaryB = b;
          break;
        }
      }

      const isUnderdog = activeCategoryConfig.targetObjective === 'underdog_only';

      let elevatedTrapPenalty = 0;
      // In underdog mode or history mode, soften the trap multiplier so good macro triggers with high win rate aren't penalized out of existence by outlier traps
      const trapThresholdB = isUnderdog ? Math.max(0, boundaryB - 5) : Math.max(0, boundaryB - 10);
      const elevatedMultiplier = isUnderdog ? 3 : (isHistoryMode ? 4 : 5);
      for (let b = BUCKET_COUNT - 1; b >= trapThresholdB; b--) {
        if (trBuckets[b] > 0) {
          elevatedTrapPenalty += trBuckets[b] * (b - trapThresholdB + 1) * elevatedMultiplier;
        }
      }

      // 5. Positive Targets Reward & Trap Positive Penalty & Upper Lift
      let positiveTargets = 0;
      let upperTargetLift = 0;
      let targetsOver100 = 0;
      let targetsOver150 = 0;
      let targetsOver200 = 0;
      for (let b = SCORE_OFFSET + 1; b < BUCKET_COUNT; b++) {
        positiveTargets += tBuckets[b];
        const sVal = b - SCORE_OFFSET;
        upperTargetLift += tBuckets[b] * sVal;
        if (sVal >= 100) targetsOver100 += tBuckets[b];
        if (sVal >= 150) targetsOver150 += tBuckets[b];
        if (sVal >= 200) targetsOver200 += tBuckets[b];
      }
      let positiveTraps = 0;
      for (let b = SCORE_OFFSET; b < BUCKET_COUNT; b++) {
        positiveTraps += trBuckets[b];
      }

      // Top Trap sinking bonus: reward sinking highest trap lower down
      // Balanced weight (15 in live, 25 in history) so target lift can balance against minor trap drift
      const topTrapAdvantage = maxTrapB >= 0
        ? (BUCKET_COUNT - 1 - maxTrapB) * (isHistoryMode ? 25 : 15)
        : 500;

      // 6. Regularization (normalized by 40 for penalties, 25 for bonuses)
      // Scaled by 0.05 so regularization acts as a gentle tie-breaker rather than stripping target points
      let regSum = 0;
      points.forEach(pts => {
        const norm = pts < 0 ? Math.abs(pts) / 40 : pts / 25;
        regSum += norm * norm;
      });

      const targetWeight = isUnderdog ? 30 : 15;
      const trapWeight = isUnderdog ? 20 : (isHistoryMode ? 20 : 35);
      const liftWeight = 0.8;

      const liveGoalN = Math.min(totalCorrectMatches, Math.max(topNCapacity, horizons.floor));
      const cleanStreakBonus = (cleanTop >= liveGoalN && totalCorrectMatches > 0) ? 3000 : 0;

      // Separation terms:
      // - strong penalty per trap tied in the top trap bucket (rewards sinking one of several tied traps)
      // - margin between the Nth-best target (N = goal) and the top trap
      // - breakout gradient when cleanTop === 0: reward closing distance between top target and top trap
      let liveSeparationTerm = 0;
      if (maxTrapB >= 0) {
        const tiedTopTrapPenalty = trBuckets[maxTrapB] * 300;
        const goalN = liveGoalN;
        let nthTargetB = -1;
        let topTargetB = -1;
        let tc = 0;
        for (let b = BUCKET_COUNT - 1; b >= 0 && goalN > 0; b--) {
          if (tBuckets[b] > 0 && topTargetB === -1) {
            topTargetB = b;
          }
          tc += tBuckets[b];
          if (tc >= goalN && nthTargetB === -1) { nthTargetB = b; break; }
        }
        const margin = nthTargetB >= 0 ? (nthTargetB - maxTrapB) : 0;
        const breakoutLead = (topTargetB >= 0 && cleanTop === 0) ? Math.max(-100, Math.min(20, topTargetB - maxTrapB)) * 50 : 0;
        liveSeparationTerm = Math.max(-60, Math.min(60, margin)) * 40 - tiedTopTrapPenalty + breakoutLead;
      }
      const inflationBonus = 0;

      const quality = (cleanTop * 500) +
        cleanStreakBonus +
        horizonFitness -
        (trapInTopN * 500) -
        elevatedTrapPenalty +
        (positiveTargets * targetWeight) +
        inflationBonus -
        (positiveTraps * trapWeight) +
        (upperTargetLift * liftWeight) +
        topTrapAdvantage +
        liveSeparationTerm -
        (regSum * 0.05);

      // Count targets in top 5,000 for secondary historical horizon
      let targetsInTop5000 = 0;
      let counted5k = 0;
      for (let b = BUCKET_COUNT - 1; b >= 0 && counted5k < 5000; b--) {
        const inB = tBuckets[b] + trBuckets[b];
        if (inB === 0) continue;
        const rem = 5000 - counted5k;
        if (inB <= rem) {
          targetsInTop5000 += tBuckets[b];
          counted5k += inB;
        } else {
          const takeT = Math.min(tBuckets[b], rem);
          targetsInTop5000 += takeT;
          counted5k = 5000;
        }
      }

      const maxTrapScore = maxTrapB >= 0 ? maxTrapB - SCORE_OFFSET : -SCORE_OFFSET;
      let lowestCleanTargetScore = maxTrapScore;
      for (let b = maxTrapB + 1; b < BUCKET_COUNT; b++) {
        if (tBuckets[b] > 0) {
          lowestCleanTargetScore = b - SCORE_OFFSET;
          break;
        }
      }
      const bufferMargin = maxTrapB >= 0 ? (lowestCleanTargetScore - maxTrapScore) : 25;

      return {
        quality,
        cleanTopMatches: cleanTop,
        firstTrapRank: cleanTop + 1,
        trapInTopN,
        targetInTopN,
        purityPct: topNCapacity > 0 ? (targetInTopN / topNCapacity) * 100 : 0,
        bufferMargin,
        targetsInTop5000,
        floorMet: horizons.floor > 0 && cleanTop >= horizons.floor,
        ceilingMet: horizons.ceiling > 0 && cleanTop >= horizons.ceiling,
        horizonMetrics
      };
    };

    let bestPoints = new Map(currentPoints);
    let bestFastEval = fastEvaluateBuckets(targetBuckets, trapBuckets, bestPoints);
    let totalComps = deepComputations;
    let compsSinceMilestone = 0;
    let bestCleanStreak = bestFastEval.cleanTopMatches;
    const initiallyCeilingMet = bestFastEval.ceilingMet;

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
    setDeepPointsMap(new Map(bestPoints));
    setDeepCategoryPointsMap(prev => ({ ...prev, [activeCategory]: new Map(bestPoints) }));

    // --- Systematic Trigger Grouping & Round-Robin Rotation ---
    // Partitions the trigger universe into cohesive cohorts of 8-10 triggers.
    // Exhaustively tests each group, ratchets findings, then systematically rotates to the next group.
    const GROUP_SIZE = 8;
    let allWorkingTriggers = isHistoryMode
      ? [...catalogTriggers]
      : (eligibleTriggers.length > 0 ? [...eligibleTriggers] : [...catalogTriggers]);
    let triggerGroups: string[][] = [];
    const rebuildGroups = () => {
      triggerGroups = [];
      for (let g = 0; g < allWorkingTriggers.length; g += GROUP_SIZE) {
        triggerGroups.push(allWorkingTriggers.slice(g, g + GROUP_SIZE));
      }
      if (triggerGroups.length === 0) triggerGroups.push(allWorkingTriggers.slice(0, 10));
    };
    rebuildGroups();

    // --- Exact undo log (fixes clamp drift: rollback restores stored pre-mutation scores, not curS - d) ---
    const undoIdx: number[] = [];
    const undoOld: number[] = [];
    const applyDelta = (indices: Int32Array | undefined, d: number) => {
      if (!indices) return;
      for (let j = 0; j < indices.length; j++) {
        const idx = indices[j];
        const oldS = matchScores[idx];
        const newS = Math.max(-299, Math.min(299, oldS + d));
        if (newS === oldS) continue;
        undoIdx.push(idx);
        undoOld.push(oldS);
        matchScores[idx] = newS;
        const oldB = oldS + SCORE_OFFSET;
        const newB = newS + SCORE_OFFSET;
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
      for (let u = undoIdx.length - 1; u >= mark; u--) {
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
      undoIdx.length = mark;
      undoOld.length = mark;
    };

    // Dominant triggers (live slice: >=4 hits and >=80% targets/traps; or historical universe: >=30 hits with strong polarity)
    const dominantTriggers = new Map<string, 'up' | 'down'>();
    catalogTriggers.forEach(desc => {
      const tH = triggerTargetCounts.get(desc) || 0;
      const trH = triggerTrapCounts.get(desc) || 0;
      const tot = tH + trH;
      if (tot >= 4) {
        if (tH / tot >= 0.80) dominantTriggers.set(desc, 'up');
        else if (trH / tot >= 0.80) dominantTriggers.set(desc, 'down');
      } else {
        const hCounts = histHitsMap.get(desc);
        if (hCounts && hCounts.total >= 30) {
          const polarity = getTriggerSemanticPolarity(desc);
          const isUnderdogCat = activeCategoryConfig.targetObjective === 'underdog_only';
          if (isUnderdogCat) {
            if (polarity === 'PRO_UNDERDOG' && hCounts.underdog / hCounts.total >= 0.35) dominantTriggers.set(desc, 'up');
            else if (polarity === 'PRO_MFAV' && (hCounts.mfav + hCounts.draw) / hCounts.total >= 0.75) dominantTriggers.set(desc, 'down');
          } else if (activeCategoryConfig.targetObjective === 'mfav_only') {
            if (polarity === 'PRO_MFAV' && hCounts.mfav / hCounts.total >= 0.65) dominantTriggers.set(desc, 'up');
            else if (polarity === 'PRO_UNDERDOG' && (hCounts.underdog + hCounts.draw) / hCounts.total >= 0.50) dominantTriggers.set(desc, 'down');
          } else {
            if (polarity === 'PRO_MFAV' && (hCounts.mfav + hCounts.draw) / hCounts.total >= 0.75) dominantTriggers.set(desc, 'up');
            else if (polarity === 'PRO_UNDERDOG' && hCounts.underdog / hCounts.total >= 0.30) dominantTriggers.set(desc, 'down');
          }
        }
      }
    });

    // Cached per-trigger accuracy profile for the optimizer loop (counts & anchors are constant during a run)
    const liveProfileCache = new Map<string, ReturnType<typeof getTriggerAccuracyProfile>>();
    const getLiveProfile = (t: string) => {
      let p = liveProfileCache.get(t);
      if (!p) {
        p = getTriggerAccuracyProfile(t, hitStatsMap.get(t), activeCategoryConfig.targetObjective, currentRulePointsMap.get(t), isHistoryMode);
        const guardFloor = protectedGuardsMap.get(t);
        if (guardFloor !== undefined && guardFloor <= -5) {
          const restrictedBand = p.allowedBand.filter(v => v <= guardFloor);
          p.allowedBand = restrictedBand.length > 0 ? restrictedBand : [guardFloor];
        }
        liveProfileCache.set(t, p);
      }
      return p;
    };

    // Step rules: normal triggers move a single 5-pt step; dominant triggers may jump within their band.
    const liveStepCandidates = (trigger: string, currentVal: number, band: number[], dir: 'up' | 'down' | 'any'): number[] => {
      const guardFloor = protectedGuardsMap.get(trigger);
      const effectiveBand = (guardFloor !== undefined && guardFloor <= -5)
        ? band.filter(v => v <= guardFloor)
        : band;
      const nonZeroBand = effectiveBand.filter(v => v !== 0);
      if (nonZeroBand.length === 0) return [];
      if (!nonZeroBand.includes(currentVal)) {
        // Off-band value: only allowed move is back to the nearest in-band value (respecting direction)
        const nearest = nonZeroBand.reduce((prev, curr) => Math.abs(curr - currentVal) < Math.abs(prev - currentVal) ? curr : prev);
        if (dir === 'up' && nearest <= currentVal) return [];
        if (dir === 'down' && nearest >= currentVal) return [];
        return nearest !== currentVal && nearest !== 0 ? [nearest] : [];
      }
      const dom = dominantTriggers.get(trigger);
      const out: number[] = [];
      if (dir !== 'down') {
        if (guardFloor !== undefined && guardFloor <= -5 && currentVal >= guardFloor) {
          // Protected penalty: NEVER allow stepping upward towards 0!
        } else if (dom === 'up') {
          for (const v of nonZeroBand) if (v > currentVal) out.push(v);
        } else if (currentVal === -5 && nonZeroBand.includes(5)) {
          out.push(5);
        } else if (nonZeroBand.includes(currentVal + 5)) {
          out.push(currentVal + 5);
        }
      }
      if (dir !== 'up') {
        if (dom === 'down') {
          for (const v of nonZeroBand) if (v < currentVal) out.push(v);
        } else if (currentVal === 5 && nonZeroBand.includes(-5)) {
          out.push(-5);
        } else if (nonZeroBand.includes(currentVal - 5)) {
          out.push(currentVal - 5);
        }
      }
      return out.filter(v => v !== 0 && v >= -40 && (guardFloor !== undefined && guardFloor <= -5 ? v <= guardFloor : v <= 25));
    };

    // Trap-targeted separation analysis (recomputed lazily after accepted changes)
    let targetingDirty = true;
    let targetDownList: string[] = [];
    let targetUpList: string[] = [];
    const recomputeTargeting = () => {
      targetingDirty = false;
      targetDownList = [];
      targetUpList = [];
      let maxTrapS = -Infinity;
      for (let i = 0; i < numMatches; i++) {
        if (isTarget[i] === 0 && matchScores[i] > maxTrapS) maxTrapS = matchScores[i];
      }
      if (maxTrapS === -Infinity) return;
      const topTraps: number[] = [];
      const below: number[] = [];
      for (let i = 0; i < numMatches; i++) {
        if (isTarget[i] === 0) {
          if (matchScores[i] === maxTrapS) topTraps.push(i);
        } else if (matchScores[i] <= maxTrapS) {
          below.push(i);
        }
      }
      if (topTraps.length === 0 || below.length === 0) return;
      below.sort((a, b) => matchScores[b] - matchScores[a]);
      // Boundary targets: at / just below the top trap (ties count as blocked)
      let boundary = below.filter(i => matchScores[i] >= maxTrapS - 20);
      if (boundary.length < 3) boundary = below.slice(0, Math.min(6, below.length));
      const trapIdx = topTraps[Math.floor(Math.random() * topTraps.length)];
      const trapTrigs = profiles[trapIdx].triggersHit;
      const freq = new Map<string, number>();
      boundary.forEach(i => profiles[i].triggersHit.forEach(t => freq.set(t, (freq.get(t) || 0) + 1)));
      const bLen = boundary.length;
      // Present in top trap but rare among boundary targets -> step down
      trapTrigs.forEach(t => {
        if (!triggerToIndices.has(t)) return;
        const liveHits = triggerToIndices.get(t)?.length || 0;
        const histHits = histHitsMap.get(t)?.total || 0;
        if (!isHistoryMode && liveHits < 2 && histHits < 20) return;
        if ((freq.get(t) || 0) / bLen <= 0.40) targetDownList.push(t);
      });
      // Present in boundary targets -> step up
      // Enhanced: also include broad target-dominant triggers (even if present in that single top trap,
      // provided they heavily favor boundary targets over traps across the dataset)
      freq.forEach((c, t) => {
        if (!triggerToIndices.has(t)) return;
        const liveHits = triggerToIndices.get(t)?.length || 0;
        const histHits = histHitsMap.get(t)?.total || 0;
        if (!isHistoryMode && liveHits < 2 && histHits < 20) return;
        const inTrap = trapTrigs.has(t);
        const tHits = triggerTargetCounts.get(t) || 0;
        const trHits = triggerTrapCounts.get(t) || 0;
        const tot = tHits + trHits;
        const hCounts = histHitsMap.get(t);
        const hTot = hCounts ? hCounts.total : 0;
        const polarity = getTriggerSemanticPolarity(t);
        const isTargetPolarity = activeCategoryConfig.targetObjective === 'underdog_only'
          ? polarity === 'PRO_UNDERDOG'
          : polarity === 'PRO_MFAV';
        const isBroadTargetDriver = (tot >= 4 && tHits > trHits) || (hTot >= 20 && isTargetPolarity);

        if (!inTrap && c / bLen >= 0.30) {
          targetUpList.push(t);
        } else if (inTrap && isBroadTargetDriver && c / bLen >= 0.40) {
          // Broad trigger that hits majority of boundary targets and has strong global target accuracy
          targetUpList.push(t);
        }
      });
      // Lenient fallbacks (still trap-distinguishing)
      if (targetDownList.length === 0) {
        trapTrigs.forEach(t => {
          if (!triggerToIndices.has(t)) return;
          const liveHits = triggerToIndices.get(t)?.length || 0;
          const histHits = histHitsMap.get(t)?.total || 0;
          if (!isHistoryMode && liveHits < 2 && histHits < 20) return;
          if ((freq.get(t) || 0) < bLen) targetDownList.push(t);
        });
      }
      if (targetUpList.length === 0) {
        freq.forEach((_c, t) => {
          if (!triggerToIndices.has(t)) return;
          const liveHits = triggerToIndices.get(t)?.length || 0;
          const histHits = histHitsMap.get(t)?.total || 0;
          if (!isHistoryMode && liveHits < 2 && histHits < 20) return;
          targetUpList.push(t);
        });
      }
    };

    // Plateau escape & elite (best-ever) state with restart
    const LIVE_PLATEAU_EPS = 25;
    const LIVE_RESTART_AFTER = 4000;
    let liveStallCount = 0;
    let eliteEval = bestFastEval;
    let elitePoints = new Map(bestPoints);
    const eliteScores = new Int16Array(matchScores);
    const snapshotElite = () => {
      eliteEval = bestFastEval;
      elitePoints = new Map(bestPoints);
      eliteScores.set(matchScores);
    };
    const restoreElite = () => {
      matchScores.set(eliteScores);
      targetBuckets.fill(0);
      trapBuckets.fill(0);
      for (let i = 0; i < numMatches; i++) {
        const b = matchScores[i] + SCORE_OFFSET;
        if (isTarget[i] === 1) targetBuckets[b]++;
        else trapBuckets[b]++;
      }
      bestPoints = new Map(elitePoints);
      bestFastEval = eliteEval;
      targetingDirty = true;
    };
    const finalizeLive = () => {
      if (eliteEval.cleanTopMatches > bestFastEval.cleanTopMatches ||
        (eliteEval.cleanTopMatches === bestFastEval.cleanTopMatches && eliteEval.quality > bestFastEval.quality)) {
        restoreElite();
      }
    };

    // Diagnostics: coverage + simple pairwise infeasibility check within reachable bands
    const goalN = Math.max(1, Math.min(activeCategoryConfig.targetCapacity, totalCorrectMatches));
    const targetIdxs: number[] = [];
    const trapIdxs: number[] = [];
    for (let i = 0; i < numMatches; i++) (isTarget[i] === 1 ? targetIdxs : trapIdxs).push(i);
    const bandMaxMap = new Map<string, number>();
    const bandMinMap = new Map<string, number>();
    triggerToIndices.forEach((_v, t) => {
      const band = getLiveProfile(t).allowedBand;
      if (band.length > 0) {
        bandMaxMap.set(t, Math.max(...band));
        bandMinMap.set(t, Math.min(...band));
      }
    });
    const infeasible: { teams: string; separable: number; triggers: string[] }[] = [];
    if (totalCorrectMatches > 0 && trapIdxs.length * targetIdxs.length <= 400000) {
      for (const tr of trapIdxs) {
        const trSet = profiles[tr].triggersHit;
        let separable = 0;
        for (const tg of targetIdxs) {
          const tgSet = profiles[tg].triggersHit;
          let maxDiff = profiles[tg].baseScore - profiles[tr].baseScore;
          tgSet.forEach(t => { if (!trSet.has(t)) maxDiff += bandMaxMap.get(t) ?? 0; });
          trSet.forEach(t => { if (!tgSet.has(t)) maxDiff -= bandMinMap.get(t) ?? 0; });
          if (maxDiff > 0) separable++; // ties rank trap-first, so strict separation required
        }
        if (separable < goalN) {
          const distinguishing = Array.from(trSet)
            .filter(t => triggerToIndices.has(t))
            .map(t => ({ t, f: targetIdxs.length > 0 ? (triggerTargetCounts.get(t) || 0) / targetIdxs.length : 0 }))
            .sort((a, b) => a.f - b.f)
            .slice(0, 4)
            .map(x => `${x.t} (${Math.round(x.f * 100)}% of targets)`);
          infeasible.push({ teams: profiles[tr].teams, separable, triggers: distinguishing });
        }
      }
      infeasible.sort((a, b) => a.separable - b.separable);
    }
    const droppedNoOdds = Math.max(0, completedMatches.length - profiles.length);
    setDeepDiagnostics({
      seen: profiles.length,
      expected: completedMatches.length,
      targetsSeen: totalCorrectMatches,
      droppedNoOdds,
      goalN,
      infeasible
    });

    let currentGroupIndex = 0;
    let compsInCurrentGroup = 0;
    const COMPS_PER_GROUP = 3000; // 3,000 evaluations per group to thoroughly exhaust permutations

    const optStartTime = Date.now();
    let lastUiUpdate = Date.now();
    const updateUiState = (force: boolean = false) => {
      const now = Date.now();
      if (!force && now - lastUiUpdate < 30) return;
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
      setDeepTargetsInTop5000(bestFastEval.targetsInTop5000);
      if (bestFastEval.horizonMetrics) setDeepHorizonMetrics(bestFastEval.horizonMetrics);
      setDeepConvergenceMode(bestFastEval.ceilingMet ? 'perfect_100' : bestFastEval.floorMet ? 'sweet_spot' : 'none');
      setDeepPointsMap(new Map(bestPoints));
      setDeepCategoryPointsMap(prev => ({ ...prev, [activeCategory]: new Map(bestPoints) }));
    };

    // Run in high-throughput sliced asynchronous chunks to reach millions/min
    // Run in high-throughput sliced asynchronous chunks with adaptive time-budgeting (~25ms/frame)
    const runChunk = () => {
      if (stopDeepRef.current) {
        finalizeLive();
        setIsDeepOptimizing(false);
        setDeepStatus('paused');
        updateUiState(true);
        return;
      }

      const PATIENCE_BUDGET = 50000;
      const MAX_FRAME_MS = 25; // 25ms slice per frame for non-blocking 40fps responsiveness
      const frameStart = performance.now();
      const BATCH_INNER = 40;

      frameLoop: while (performance.now() - frameStart < MAX_FRAME_MS) {
        for (let sub = 0; sub < BATCH_INNER; sub++) {
          // Group Rotation: once a group has been exhaustively tested, rotate to the next!
          compsInCurrentGroup++;
          if (compsInCurrentGroup >= COMPS_PER_GROUP) {
            compsInCurrentGroup = 0;
            currentGroupIndex = (currentGroupIndex + 1) % triggerGroups.length;
            // When all groups in a cycle are exhausted, shuffle triggers to create fresh orthogonal groups
            if (currentGroupIndex === 0) {
              allWorkingTriggers.sort(() => Math.random() - 0.5);
              rebuildGroups();
            }
          }

          const activeGroup = triggerGroups[currentGroupIndex] || allWorkingTriggers;

          // Mutation Cluster Selection:
          // Single-trigger mutations for 75% of iterations allow surgical separation of top traps
          // and elevation of targets without multi-trigger collateral damage.
          let clusterSize: number = Math.random() < 0.75 ? 1 : 2;

          // Select up to clusterSize distinct triggers with balanced bonuses & penalties
          const selectedTriggersSet = new Set<string>();
          const batchMutations: {
            trigger: string;
            oldVal: number;
            newVal: number;
            delta: number;
            indices: Int32Array | undefined;
          }[] = [];

          // ~50% of iterations are trap-targeted separation moves
          // (lower triggers unique to the top trap / raise triggers shared by boundary targets but absent in the trap)
          let targetedMove = false;
          let pairwiseCompensating = false;
          let pairUpTrigger: string | null = null;
          let pairDownTrigger: string | null = null;

          if (Math.random() < 0.50) {
            if (targetingDirty || totalComps % 150 === 0) recomputeTargeting();
            if (targetDownList.length > 0 || targetUpList.length > 0) {
              targetedMove = true;
              // Compensating pairwise co-mutation: 40% chance when both up and down lists exist
              if (targetUpList.length > 0 && targetDownList.length > 0 && Math.random() < 0.40) {
                pairwiseCompensating = true;
                clusterSize = 2;
                pairUpTrigger = targetUpList[Math.floor(Math.random() * targetUpList.length)];
                pairDownTrigger = targetDownList[Math.floor(Math.random() * targetDownList.length)];
              } else {
                clusterSize = Math.random() < 0.75 ? 1 : 2;
              }
            }
          }

          for (let k = 0; k < clusterSize; k++) {
            let trigger: string;
            let targetedDir: 'up' | 'down' | null = null;
            let forceNegative = false;
            let forcePositive = false;

            if (pairwiseCompensating) {
              if (k === 0) {
                trigger = pairUpTrigger!;
                targetedDir = 'up';
              } else {
                trigger = pairDownTrigger!;
                targetedDir = 'down';
              }
            } else if (targetedMove) {
              const useDown = targetDownList.length > 0 && (targetUpList.length === 0 || Math.random() < 0.5);
              const list = useDown ? targetDownList : targetUpList;
              trigger = list[Math.floor(Math.random() * list.length)];
              targetedDir = useDown ? 'down' : 'up';
            } else {
              // 60% chance to select a broad high-match driver trigger, 40% any eligible trigger
              const useBroad = broadDriverTriggers.length > 0 && Math.random() < 0.60;
              const pool = useBroad ? broadDriverTriggers : (eligibleTriggers.length > 0
                ? eligibleTriggers
                : (isHistoryMode ? catalogTriggers : activeTriggers));
              if (pool.length === 0) continue;
              trigger = pool[Math.floor(Math.random() * pool.length)];
            }

            if (!trigger) continue;
            // In live mode, guard against mutating triggers with insufficient live + historical hits
            const liveH = triggerToIndices.get(trigger)?.length || 0;
            const histH = histHitsMap.get(trigger)?.total || 0;
            if (!isHistoryMode && liveH < 2 && histH < 20) continue;

            // DOMAIN POLARITY-BASED DIRECTION (skipped for trap-targeted moves, which carry their own direction):
            const trigPolarity = targetedDir ? 'TARGETED' : getTriggerSemanticPolarity(trigger);
            const isUnderdogCat = activeCategoryConfig.targetObjective === 'underdog_only';

            if (isUnderdogCat) {
              if (trigPolarity === 'PRO_UNDERDOG') forcePositive = true;
              else if (trigPolarity === 'PRO_MFAV') forceNegative = true;
            } else {
              // Mfav / Top 12 categories:
              if (trigPolarity === 'PRO_UNDERDOG') forceNegative = true;
              else if (trigPolarity === 'PRO_MFAV') forcePositive = true;
            }

            // Fallback to empirical stats if Neutral
            if (trigPolarity === 'NEUTRAL') {
              const counts = hitStatsMap.get(trigger);
              if (counts) {
                const totalH = counts.mfav + counts.draw + counts.underdog;
                if (totalH > 0) {
                  if (isUnderdogCat) {
                    if (counts.underdog / totalH >= 0.25) forcePositive = true;
                    else if ((counts.mfav + counts.draw) / totalH >= 0.60) forceNegative = true;
                  } else if (activeCategoryConfig.targetObjective === 'mfav_only') {
                    if (counts.mfav / totalH >= 0.55) forcePositive = true;
                    else if ((counts.draw + counts.underdog) / totalH >= 0.45) forceNegative = true;
                  } else {
                    if ((counts.mfav + counts.draw) / totalH >= 0.65) forcePositive = true;
                    else if (counts.underdog / totalH >= 0.22) forceNegative = true;
                  }
                }
              }
            }

            if (selectedTriggersSet.has(trigger)) continue;
            selectedTriggersSet.add(trigger);

            const counts = hitStatsMap.get(trigger);
            const calibratedAnchor = currentRulePointsMap.get(trigger);
            const profile = getLiveProfile(trigger);
            const currentVal = bestPoints.get(trigger) ?? 0;

            // Strictly incremental single 5-pt steps (dominant triggers may jump directly within their allowed band).
            // Semantic polarity is a 75/25 direction bias, not a hard lock; allowedBand still enforced.
            let dir: 'up' | 'down' | 'any';
            if (targetedDir) dir = targetedDir;
            else if (forcePositive) dir = Math.random() < 0.75 ? 'up' : 'down';
            else if (forceNegative) dir = Math.random() < 0.75 ? 'down' : 'up';
            else dir = 'any';
            let candidateValues = liveStepCandidates(trigger, currentVal, profile.allowedBand, dir);
            if (candidateValues.length === 0 && !targetedDir && dir !== 'any') {
              candidateValues = liveStepCandidates(trigger, currentVal, profile.allowedBand, 'any');
            }

            // Skip trigger if no valid step exists
            if (candidateValues.length === 0) continue;

            const testVal = candidateValues[Math.floor(Math.random() * candidateValues.length)];
            const delta = testVal - currentVal;
            const indices = triggerToIndices.get(trigger);

            batchMutations.push({
              trigger,
              oldVal: currentVal,
              newVal: testVal,
              delta,
              indices
            });
          }

        if (batchMutations.length === 0) continue;

        // Apply all mutations in the batch (recording exact pre-mutation scores in the undo log)
        undoIdx.length = 0;
        undoOld.length = 0;
        for (let m = 0; m < batchMutations.length; m++) {
          const item = batchMutations[m];
          bestPoints.set(item.trigger, item.newVal);
          if (!item.indices || item.indices.length === 0) continue;
          applyDelta(item.indices, item.delta);
        }

        totalComps++;

        const testFastEval = fastEvaluateBuckets(targetBuckets, trapBuckets, bestPoints);

        // Mutation Acceptance Evaluation:
        const cleanStreakMaintained = testFastEval.cleanTopMatches >= bestCleanStreak;
        const cleanStreakClimbed = testFastEval.cleanTopMatches > bestCleanStreak;
        const qualityImproved = testFastEval.quality > bestFastEval.quality;

        let acceptMutation = cleanStreakClimbed || (cleanStreakMaintained && qualityImproved);
        // Plateau escape: occasionally accept sideways moves (same clean count, near-equal quality)
        if (!acceptMutation &&
          testFastEval.cleanTopMatches === bestCleanStreak &&
          testFastEval.quality >= bestFastEval.quality - LIVE_PLATEAU_EPS &&
          Math.random() < 0.10) {
          acceptMutation = true;
        }

        if (acceptMutation) {
          targetingDirty = true;
          if (testFastEval.cleanTopMatches > bestCleanStreak) {
            bestCleanStreak = testFastEval.cleanTopMatches;
            compsSinceMilestone = 0;
            updateUiState(true);
          }
          bestFastEval = testFastEval;

          // --- Post-Breakthrough Contribution Rebalancing ---
          // Run only on genuine clean streak climbs to avoid unnecessary CPU overhead
          if (cleanStreakClimbed && batchMutations.length >= 2) {
            const rebalanceBatch: {
              trigger: string;
              oldVal: number;
              newVal: number;
              delta: number;
              indices: Int32Array | undefined;
            }[] = [];

            for (let bIdx = 0; bIdx < batchMutations.length; bIdx++) {
              const item = batchMutations[bIdx];
              const t = item.trigger;
              const indices = item.indices;
              if (!indices || indices.length === 0) continue;
              if (!isHistoryMode && indices.length < 3) continue;

              // Count targets vs traps hit by this trigger in the elevated positive scoring band
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

              const counts = hitStatsMap.get(t);
              const calibratedAnchor = currentRulePointsMap.get(t);
              const profile = getTriggerAccuracyProfile(t, counts, activeCategoryConfig.targetObjective, calibratedAnchor, isHistoryMode);
              const curPoints = bestPoints.get(t) ?? 0;
              let rebalancedVal = curPoints;

              if (targetRatio >= 0.75 && curPoints > 0) {
                // Star Contributor: boost bonus towards +20 or +25
                if (dominantTriggers.get(t) !== 'up') {
                  // Normal trigger: single +5 step only
                  if (profile.allowedBand.includes(curPoints + 5)) rebalancedVal = curPoints + 5;
                } else {
                  const higherBonus = profile.allowedBand.filter(v => v > curPoints);
                  if (higherBonus.length > 0) rebalancedVal = Math.min(25, Math.max(...higherBonus));
                }
              } else if (targetRatio <= 0.40 && curPoints > 0) {
                // Passenger / Drag: single -5 step only
                if (profile.allowedBand.includes(curPoints - 5)) rebalancedVal = curPoints - 5;
              } else if (trHits >= tHits * 1.5 && curPoints <= 0) {
                // High-conviction trap suppressor: deepen penalty towards -20 or -25
                if (dominantTriggers.get(t) !== 'down') {
                  // Normal trigger: single -5 step only
                  if (profile.allowedBand.includes(curPoints - 5)) rebalancedVal = curPoints - 5;
                } else {
                  const deeperNeg = profile.allowedBand.filter(v => v < curPoints);
                  if (deeperNeg.length > 0) rebalancedVal = Math.max(-40, Math.min(...deeperNeg));
                }
              }

              if (rebalancedVal !== curPoints) {
                rebalanceBatch.push({
                  trigger: t,
                  oldVal: curPoints,
                  newVal: rebalancedVal,
                  delta: rebalancedVal - curPoints,
                  indices
                });
              }
            }

            if (rebalanceBatch.length > 0) {
              // Apply rebalanced points to matches
              const rebalanceMark = undoIdx.length;
              for (let m = 0; m < rebalanceBatch.length; m++) {
                const item = rebalanceBatch[m];
                bestPoints.set(item.trigger, item.newVal);
                applyDelta(item.indices, item.delta);
              }

              totalComps++;
              const rebalanceEval = fastEvaluateBuckets(targetBuckets, trapBuckets, bestPoints);

              const rebalanceMaintained = rebalanceEval.cleanTopMatches >= bestCleanStreak;
              const rebalanceClimbed = rebalanceEval.cleanTopMatches > bestCleanStreak;
              const rebalanceQualityImproved = rebalanceEval.quality > bestFastEval.quality;

              if (rebalanceClimbed || (rebalanceMaintained && rebalanceQualityImproved)) {
                if (rebalanceClimbed) {
                  bestCleanStreak = rebalanceEval.cleanTopMatches;
                  compsSinceMilestone = 0;
                  updateUiState(true);
                }
                bestFastEval = rebalanceEval;
              } else {
                // Rollback rebalance if it didn't push more matches or improve quality (exact restore)
                for (let m = rebalanceBatch.length - 1; m >= 0; m--) {
                  bestPoints.set(rebalanceBatch[m].trigger, rebalanceBatch[m].oldVal);
                }
                rollbackTo(rebalanceMark);
              }
            }
          }
        } else {
          // Instant Batch Rollback: revert all mutations in the batch
          // (exact restore of stored pre-mutation scores — immune to ±299 clamp drift)
          for (let m = batchMutations.length - 1; m >= 0; m--) {
            bestPoints.set(batchMutations[m].trigger, batchMutations[m].oldVal);
          }
          rollbackTo(0);
        }

        // Track best-ever (elite) state; restart from it after a long non-improving stretch
        if (bestFastEval.cleanTopMatches > eliteEval.cleanTopMatches ||
          (bestFastEval.cleanTopMatches === eliteEval.cleanTopMatches && bestFastEval.quality > eliteEval.quality)) {
          snapshotElite();
          liveStallCount = 0;
        } else {
          liveStallCount++;
          if (liveStallCount >= LIVE_RESTART_AFTER) {
            restoreElite();
            liveStallCount = 0;
          }
        }

        // 1. 100% Ceiling achieved
        if (!initiallyCeilingMet && bestFastEval.ceilingMet) {
          finalizeLive();
          updateUiState(true);
          setDeepStatus('converged');
          setDeepConvergenceMode('perfect_100');
          setIsDeepOptimizing(false);
          showToast(`100% Perfect Separation! All ${bestFastEval.cleanTopMatches} winners are clean at the top!`);
          return;
        }

        // 2. Self-aware Plateau Detection: Once baseline floor is met or high-volume horizon thresholds achieved
        const topNPure = bestFastEval.trapInTopN === 0 || 
          bestFastEval.cleanTopMatches >= activeCategoryConfig.targetCapacity ||
          (bestFastEval.horizonMetrics && bestFastEval.horizonMetrics.h1000.traps <= 50 && bestFastEval.horizonMetrics.h500.traps <= 25);
        if ((bestFastEval.floorMet || initiallyCeilingMet) && topNPure) {
          compsSinceMilestone++;
          if (compsSinceMilestone >= PATIENCE_BUDGET) {
            finalizeLive();
            updateUiState(true);
            setDeepStatus('converged');
            setDeepConvergenceMode(bestFastEval.ceilingMet ? 'perfect_100' : 'sweet_spot');
            setIsDeepOptimizing(false);
            showToast(bestFastEval.ceilingMet
              ? `100% Perfect! Buffer margin (+${bestFastEval.bufferMargin.toFixed(1)} pts) over ${totalComps.toLocaleString()} computations!`
              : `Optimal Density Converged! Promoted ${bestFastEval.cleanTopMatches} clean winners (${bestFastEval.horizonMetrics?.h1000.traps ?? 0} traps / 1,000) over ${totalComps.toLocaleString()} computations!`
            );
            return;
          }
        }
      }
      }

      // Update UI after frame (throttled to 30ms for smooth millisecond updates)
      updateUiState(false);

      setTimeout(runChunk, 0);
    };

    setTimeout(runChunk, 0);
  }, [completedMatches, selectedDay, activeCategory, phaStatsMap, activeCategoryConfig, deepPointsMap, currentRulePointsMap, deepComputations, datasetScope]);

  const pauseDeepOptimization = useCallback(() => {
    stopDeepRef.current = true;
    setIsDeepOptimizing(false);
    setDeepStatus('paused');
    showToast(`Optimization paused at ${deepComputations.toLocaleString()} computations.`);
  }, [deepComputations]);

  const resetDeepOptimization = useCallback(() => {
    stopDeepRef.current = true;
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
            if (t === "Odds for underdog >= 3.0" && cat.targetObjective !== 'underdog_only') return;
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

        const catalogTriggers = getFullActiveCatalogTriggers();
        const catPoints = new Map<string, number>();
        const targetDay = selectedDay !== 'all' ? selectedDay : 'saturday';
        const existingCatRules = DAILY_OPTIMIZED_SETTINGS[targetDay]?.[cat.id]?.rules || [];
        const existingCatMap = new Map<string, number>();
        existingCatRules.forEach((r: any) => existingCatMap.set(r.description, r.points));

        catalogTriggers.forEach(desc => {
          const liveHits = profiles.filter(p => p.triggersHit.has(desc)).length;
          const histHits = allMatches ? allMatches.filter(m => (m as any)._opwCatalogTriggers?.has(desc)).length : 0;
          const totalHits = liveHits + histHits;
          const existingVal = existingCatMap.get(desc);
          let dflt: number;

          if (totalHits > 0) {
            if (existingVal !== undefined && existingVal !== 0) {
              dflt = existingVal;
            } else {
              const polarity = getTriggerSemanticPolarity(desc);
              const isUnderdogCat = cat.targetObjective === 'underdog_only';
              dflt = (isUnderdogCat ? polarity === 'PRO_UNDERDOG' : polarity === 'PRO_MFAV') ? 5 : -5;
            }
          } else {
            dflt = (existingVal !== undefined && existingVal !== 0)
              ? existingVal
              : borrowTriggerPoints(desc, cat.id, targetDay);
          }
          if (dflt === 0) {
            dflt = borrowTriggerPoints(desc, cat.id, targetDay);
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

        // Self-aware batch convergence: climbs past floor, expands frontier, stops on 100% or sweet-spot plateau
        let iter = 0;
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
            const targetTrigger = activeTriggers.length > 0 && Math.random() < 0.75
              ? activeTriggers[Math.floor(Math.random() * activeTriggers.length)]
              : catalogTriggers[Math.floor(Math.random() * catalogTriggers.length)];

            const currentVal = bestPoints.get(targetTrigger) ?? 0;
            const otherValues = ALLOWED_POINT_VALUES.filter(v => v !== currentVal);
            if (otherValues.length === 0) continue;
            const testVal = otherValues[Math.floor(Math.random() * otherValues.length)];

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
        points: points !== 0 ? points : borrowTriggerPoints(description, cat.id, targetDay)
      }));
      const finalRules = populateCategoryWithMasterRules(tunedRules, cat.targetObjective, cat.id, targetDay);
      const defaultSettings = DAILY_DEFAULT_CATEGORY_SETTINGS[targetDay]?.[cat.id] || DAILY_DEFAULT_CATEGORY_SETTINGS.saturday[cat.id] || OPTIMIZED_CATEGORY_SETTINGS[cat.id] || {
        name: cat.label,
        description: cat.description,
        baseLogic: "Points based on Primary Pattern PHA %.",
        baseWeightIntervals: [
          { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
          { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
          { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
          { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
          { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
          { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
        ],
        rules: []
      };
      const updated = { ...defaultSettings, rules: finalRules };
      if (selectedDay !== 'all') {
        updateDailyOptimizedCategorySettings(selectedDay, cat.id, updated, true);
      } else {
        updateOptimizedCategorySettings(cat.id, updated);
      }

      // Save bestPoints into deepCategoryPointsMap for ALL categories
      setDeepCategoryPointsMap(prev => ({ ...prev, [cat.id]: new Map(bestPoints) }));
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

  // Real Match Data Trigger Discovery & Synergistic Combo Mining
  const runTriggerDiscovery = useCallback(() => {
    if (!completedMatches || completedMatches.length === 0) {
      showToast('No completed matches available for discovery.');
      return;
    }

    setIsDiscovering(true);

    try {
      // Build real match profiles in memory directly from completed matches
      const profiles: { outcome: 'mfav' | 'draw' | 'underdog'; triggersHit: Set<string> }[] = [];
      const statsList: MatchStatSummary[] = [];

      const activeCatForEval = activeCategory === 'safety' ? 'best_bet' : activeCategory;

      completedMatches.forEach(m => {
        const actual = getActualResult(m.result || '');
        if (actual !== '1' && actual !== 'X' && actual !== '2') return;

        // Data integrity: Ensure valid market odds exist
        const moParts = (m.mo || '').split(/[- ,]+/).map(s => parseFloat(s.trim())).filter(p => !isNaN(p));
        if (moParts.length < 3 || moParts.some(o => o <= 1.0)) return;

        const mFav = getMarketFavorite(m);
        const outcome: 'mfav' | 'draw' | 'underdog' = actual === mFav ? 'mfav' : actual === 'X' ? 'draw' : 'underdog';

        let hitSet: Set<string>;
        const cached = (m as any)._opwCatalogTriggers;
        if (cached && (cached instanceof Set || Array.isArray(cached))) {
          hitSet = cached instanceof Set ? cached : new Set(cached);
        } else {
          const stats = extractMatchEvaluationStats(m, phaStatsMap, activeCatForEval);
          stats.evalCategoryId = activeCatForEval;
          hitSet = evaluateAllCatalogTriggers(stats, m);
          (m as any)._opwCatalogTriggers = hitSet;
        }

        profiles.push({ outcome, triggersHit: hitSet });
      });

      // 1. Mine Synergistic Combos on real match profiles
      const discoveryResult = mineSynergisticCombos(
        profiles,
        activeCategoryConfig.targetObjective,
        { minSupport: activeCategoryConfig.targetObjective === 'underdog_only' ? 12 : 18, minSynergyLift: 8.0 }
      );

      // 2. Mine Parameter Continuations on continuous variables
      const continuations = mineParameterContinuations(statsList, activeCategoryConfig.targetObjective);

      const merged = [...continuations, ...discoveryResult.candidates];
      setDiscoveredCandidates(merged);
      setShowDiscoveryPanel(true);
      if (merged.length > 0) {
        showToast(`Discovered ${merged.length} real dynamic combos across ${discoveryResult.totalMatchesScanned} matches! (${discoveryResult.totalPairsEvaluated} pairs evaluated)`);
      } else {
        showToast(`Scanned ${discoveryResult.totalMatchesScanned} matches (${discoveryResult.totalPairsEvaluated} pairs). No combos met the minimum +8% synergy threshold.`);
      }
    } catch (e) {
      console.error('Error during trigger discovery:', e);
      showToast('Error scanning match data for combos.');
    } finally {
      setIsDiscovering(false);
    }
  }, [completedMatches, activeCategory, selectedDay, activeCategoryConfig, phaStatsMap, showToast]);

  const handleApproveCandidate = useCallback((candidate: CandidateComboTrigger) => {
    const approved: ApprovedCustomTrigger = {
      id: candidate.id,
      description: candidate.description,
      triggerA: candidate.triggerA,
      triggerB: candidate.triggerB,
      type: candidate.type,
      points: candidate.recommendedPoints,
      targetObjective: candidate.targetObjective,
      approvedAt: new Date().toISOString(),
      isActive: true,
      domain: candidate.domain,
      realTotalHits: candidate.realTotalHits,
      realAccuracy: candidate.realAccuracy
    };

    saveApprovedCustomTrigger(approved);
    rawDataset.forEach(m => delete (m as any)._opwCatalogTriggers);
    if (matches) matches.forEach(m => delete (m as any)._opwCatalogTriggers);
    setApprovedCustomTriggersList(loadApprovedCustomTriggers());
    setCustomTriggersVersion(v => v + 1);
    setDiscoveredCandidates(prev => prev.filter(c => c.id !== candidate.id));
    showToast(`Approved "${candidate.description}" (${candidate.recommendedPoints > 0 ? '+' : ''}${candidate.recommendedPoints} PTS) and added to Catalog!`);
  }, [rawDataset, matches, showToast]);

  const handleDismissCandidate = useCallback((candidateId: string) => {
    setDiscoveredCandidates(prev => prev.filter(c => c.id !== candidateId));
  }, []);

  const handleToggleApproved = useCallback((triggerId: string) => {
    toggleApprovedCustomTrigger(triggerId);
    rawDataset.forEach(m => delete (m as any)._opwCatalogTriggers);
    if (matches) matches.forEach(m => delete (m as any)._opwCatalogTriggers);
    setApprovedCustomTriggersList(loadApprovedCustomTriggers());
    setCustomTriggersVersion(v => v + 1);
  }, [rawDataset, matches]);

  const handleRemoveApproved = useCallback((triggerId: string) => {
    removeApprovedCustomTrigger(triggerId);
    rawDataset.forEach(m => delete (m as any)._opwCatalogTriggers);
    if (matches) matches.forEach(m => delete (m as any)._opwCatalogTriggers);
    setApprovedCustomTriggersList(loadApprovedCustomTriggers());
    setCustomTriggersVersion(v => v + 1);
    showToast('Removed custom trigger from catalog.');
  }, [rawDataset, matches, showToast]);

  // Filter & sort recommendations table
  const filteredRecommendations = useMemo(() => {
    let list = effectiveRecommendations;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => r.description.toLowerCase().includes(q));
    }

    if (recommendationFilter === 'bonus') {
      list = list.filter(r => r.recommendedPoints > 0);
    } else if (recommendationFilter === 'penalty') {
      list = list.filter(r => r.recommendedPoints < 0);
    } else if (recommendationFilter === 'protected') {
      const guardedSet = new Set(protectedGuardsList.map(g => g.trigger));
      list = list.filter(r => guardedSet.has(r.description));
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
  }, [effectiveRecommendations, searchQuery, recommendationFilter, sortField, sortDir, protectedGuardsList]);

  // Apply Recommendations to Runtime Category Settings
  const handleApplyRecommendations = useCallback(async () => {
    // Only pass actively sample-tuned rules; preserve all algorithmically discovered points including 0
    const isDeepCalibrated = isDeepOptimizing || deepStatus === 'converged' || !!(deepCategoryPointsMap[activeCategory] && deepCategoryPointsMap[activeCategory].size > 0);
    const deepMap = deepCategoryPointsMap[activeCategory];

    let tunedRules: { description: string; points: number }[];
    if (deepMap && deepMap.size > 0) {
      tunedRules = Array.from(deepMap.entries()).map(([description, points]) => ({
        description,
        points: points !== 0 ? Math.max(-40, Math.min(25, points)) : borrowTriggerPoints(description, activeCategoryConfig.id, selectedDay !== 'all' ? selectedDay : undefined)
      }));
    } else {
      tunedRules = effectiveRecommendations
        .filter(r => isDeepCalibrated ? true : (r.totalHits >= 1))
        .map(r => ({
          description: r.description,
          points: r.recommendedPoints !== 0 ? Math.max(-40, Math.min(25, r.recommendedPoints)) : borrowTriggerPoints(r.description, activeCategoryConfig.id, selectedDay !== 'all' ? selectedDay : undefined)
        }));
    }

    const finalRules = populateCategoryWithMasterRules(
      tunedRules,
      activeCategoryConfig.targetObjective,
      activeCategoryConfig.id,
      selectedDay !== 'all' ? selectedDay : undefined
    );

    const existingSettings = activeSettings || {
      name: activeCategoryConfig.label,
      description: activeCategoryConfig.description,
      baseLogic: "Points based on Primary Pattern PHA %.",
      baseWeightIntervals: [
        { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
        { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
        { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
        { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
        { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
        { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
      ],
      rules: []
    };

    const updated = {
      ...existingSettings,
      rules: finalRules
    };

    if (selectedDay !== 'all') {
      updateDailyOptimizedCategorySettings(selectedDay, activeCategory, updated, false);
      showToast(`Applied ${finalRules.length} calibrated rules (${tunedRules.length} sample-tuned) to ${activeCategoryConfig.label} (${selectedDay.toUpperCase()})!`);
    } else {
      updateOptimizedCategorySettings(activeCategory, updated);
      showToast(`Applied ${finalRules.length} calibrated rules to Main Algo!`);
    }
    savePersistedDailySettings();

    // Clean up locked slips on client localStorage, backend disk, and Supabase
    const targetCats = (activeCategory === 'top_12_value' || activeCategory === 'top_10_value')
      ? ['top_12_value', 'top_10_value']
      : [activeCategory];

    if (typeof window !== 'undefined') {
      try {
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

      // Delete from backend disk storage and Supabase for current dates
      const distinctDates = new Set<string>();
      distinctDates.add(getAnalysisDateString());
      if (matches && matches.length > 0) {
        matches.forEach(m => {
          if (m.date) distinctDates.add(getAnalysisDateString(m.date));
        });
      }
      const deletePromises: Promise<any>[] = [];
      distinctDates.forEach(d => {
        targetCats.forEach(c => {
          deletePromises.push(deleteLockedSlip(d, c));
        });
      });
      await Promise.allSettled(deletePromises);

      window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', { detail: { category: activeCategory, day: selectedDay } }));
      window.dispatchEvent(new Event('seerLockedSlipsUpdated'));
    }
  }, [effectiveRecommendations, activeSettings, activeCategoryConfig, selectedDay, activeCategory, isDeepOptimizing, deepStatus, deepPointsMap, deepCategoryPointsMap, matches, showToast]);

  // Apply Recommendations across ALL Categories for the Selected Day and Main Algo
  const handleApplyRuntimeToAllCategories = useCallback(async () => {
    CATEGORIES.forEach(cat => {
      let rulesToApply: { description: string; points: number }[];

      const deepMap = deepCategoryPointsMap[cat.id];

      if (deepMap && deepMap.size > 0) {
        // 1. Prioritize Deep Continuous Permutation Optimizer points (resolve 0 to borrowTriggerPoints)
        rulesToApply = Array.from(deepMap.entries())
          .map(([description, points]) => ({
            description,
            points: points !== 0 ? Math.max(-40, Math.min(25, points)) : borrowTriggerPoints(description, cat.id, selectedDay !== 'all' ? selectedDay : undefined)
          }));
      } else if (cat.id === activeCategory && effectiveRecommendations.length > 0) {
        const isDeepCalibrated = isDeepOptimizing || deepStatus === 'converged' || !!(deepCategoryPointsMap[cat.id] && deepCategoryPointsMap[cat.id].size > 0);
        rulesToApply = effectiveRecommendations
          .filter(r => isDeepCalibrated ? true : (r.totalHits >= 1))
          .map(r => ({
            description: r.description,
            points: r.recommendedPoints !== 0 ? Math.max(-40, Math.min(25, r.recommendedPoints)) : borrowTriggerPoints(r.description, cat.id, selectedDay !== 'all' ? selectedDay : undefined)
          }));
      } else {
        // 2. Check if current runtime already has calibrated rules (e.g. from prior deep batch run)
        const targetDay = selectedDay !== 'all' ? selectedDay : 'saturday';
        const existingRules = DAILY_OPTIMIZED_SETTINGS[targetDay]?.[cat.id]?.rules;
        if (existingRules && existingRules.length > 0) {
          rulesToApply = existingRules.map(r => ({ description: r.description, points: r.points !== 0 ? r.points : borrowTriggerPoints(r.description, cat.id, targetDay) }));
        } else {
          // 3. Fallback to heuristic computation only if no deep optimization exists
          const computed = computeCategoryRecommendations(
            cat,
            rawDataset,
            phaStatsMap,
            matchStars,
            liveViewType,
            selectedDay,
            allMatches
          );
          rulesToApply = computed.recommendations
            .filter(r => r.totalHits >= 1)
            .map(r => ({
              description: r.description,
              points: r.recommendedPoints !== 0 ? Math.max(-40, Math.min(25, r.recommendedPoints)) : borrowTriggerPoints(r.description, cat.id, selectedDay !== 'all' ? selectedDay : undefined)
            }));
        }
      }

      const finalRules = populateCategoryWithMasterRules(rulesToApply, cat.targetObjective, cat.id, selectedDay !== 'all' ? selectedDay : undefined);
      const existingSettings = (selectedDay !== 'all' ? DAILY_OPTIMIZED_SETTINGS[selectedDay]?.[cat.id] : undefined) ||
        OPTIMIZED_CATEGORY_SETTINGS[cat.id] || 
        DAILY_DEFAULT_CATEGORY_SETTINGS.saturday[cat.id] || {
        name: cat.label,
        description: cat.description,
        baseLogic: "Points based on Primary Pattern PHA %.",
        baseWeightIntervals: [
          { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
          { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
          { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
          { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
          { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
          { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
        ],
        rules: []
      };

      const updated = { ...existingSettings, rules: finalRules };
      if (selectedDay !== 'all') {
        updateDailyOptimizedCategorySettings(selectedDay, cat.id, updated, false);
      } else {
        updateOptimizedCategorySettings(cat.id, updated);
      }
    });

    savePersistedDailySettings();

    // Sync any tuned combo points to approved custom triggers so localStorage & server stay in sync
    const approvedList = loadApprovedCustomTriggers();
    let approvedUpdated = false;
    CATEGORIES.forEach(cat => {
      const deepMap = deepCategoryPointsMap[cat.id];
      if (deepMap) {
        deepMap.forEach((points, desc) => {
          const custom = approvedList.find(c => c.description === desc);
          if (custom && custom.points !== points) {
            custom.points = points;
            approvedUpdated = true;
          }
        });
      }
    });
    if (approvedUpdated && typeof window !== 'undefined') {
      window.localStorage.setItem('seer_approved_custom_triggers_v1', JSON.stringify(approvedList));
      window.dispatchEvent(new CustomEvent('seerCustomTriggersUpdated'));
      fetch('/api/opw/save-custom-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggers: approvedList })
      }).catch(err => console.warn('[CustomTriggers] Sync error:', err));
    }

    if (typeof window !== 'undefined') {
      try {
        const toDelete: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith('local_locked_slip_')) {
            toDelete.push(key);
          }
        }
        toDelete.forEach(k => window.localStorage.removeItem(k));
      } catch (e) {}

      // Delete from backend disk storage and Supabase for current dates across all categories
      const distinctDates = new Set<string>();
      distinctDates.add(getAnalysisDateString());
      if (matches && matches.length > 0) {
        matches.forEach(m => {
          if (m.date) distinctDates.add(getAnalysisDateString(m.date));
        });
      }
      const deletePromises: Promise<any>[] = [];
      distinctDates.forEach(d => {
        CATEGORIES.forEach(cat => {
          deletePromises.push(deleteLockedSlip(d, cat.id));
          if (cat.id === 'top_12_value') {
            deletePromises.push(deleteLockedSlip(d, 'top_10_value'));
          }
        });
      });
      await Promise.allSettled(deletePromises);

      window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', { detail: { category: 'all', day: selectedDay } }));
      window.dispatchEvent(new Event('seerLockedSlipsUpdated'));
    }
    const dayLabel = selectedDay !== 'all' ? selectedDay.toUpperCase() : 'Main Algo';
    showToast(`Applied calibrated runtime weights across ALL 7 categories to ${dayLabel}!`);
  }, [activeCategory, effectiveRecommendations, rawDataset, phaStatsMap, matchStars, liveViewType, selectedDay, isDeepOptimizing, deepStatus, deepPointsMap, deepCategoryPointsMap, matches, showToast]);

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

    const isDeepCalibrated = isDeepOptimizing || deepStatus === 'converged' || !!(deepCategoryPointsMap[activeCategory] && deepCategoryPointsMap[activeCategory].size > 0);
    const deepMap = deepCategoryPointsMap[activeCategory];

    let tunedRules: { description: string; points: number }[];
    if (deepMap && deepMap.size > 0) {
      tunedRules = Array.from(deepMap.entries()).map(([description, points]) => ({
        description,
        points: points !== 0 ? Math.max(-40, Math.min(25, points)) : borrowTriggerPoints(description, activeCategoryConfig.id, selectedDay !== 'all' ? selectedDay : undefined)
      }));
    } else {
      tunedRules = effectiveRecommendations
        .filter(r => isDeepCalibrated ? true : (r.totalHits >= 1))
        .map(r => ({
          description: r.description,
          points: r.recommendedPoints !== 0 ? Math.max(-40, Math.min(25, r.recommendedPoints)) : borrowTriggerPoints(r.description, activeCategoryConfig.id, selectedDay !== 'all' ? selectedDay : undefined)
        }));
    }

    const finalRules = populateCategoryWithMasterRules(
      tunedRules,
      activeCategoryConfig.targetObjective,
      activeCategoryConfig.id,
      selectedDay !== 'all' ? selectedDay : undefined
    );

    const existingSettings = activeSettings || {
      name: activeCategoryConfig.label,
      description: activeCategoryConfig.description,
      baseLogic: "Points based on Primary Pattern PHA %.",
      baseWeightIntervals: [
        { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
        { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
        { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
        { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
        { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
        { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
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

    savePersistedDailySettings();

    // Clean up locked slips on client localStorage and backend disk
    const targetCats = (activeCategory === 'top_12_value' || activeCategory === 'top_10_value')
      ? ['top_12_value', 'top_10_value']
      : [activeCategory];

    if (typeof window !== 'undefined') {
      try {
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

      const distinctDates = new Set<string>();
      distinctDates.add(getAnalysisDateString());
      if (matches && matches.length > 0) {
        matches.forEach(m => {
          if (m.date) distinctDates.add(getAnalysisDateString(m.date));
        });
      }
      const deletePromises: Promise<any>[] = [];
      distinctDates.forEach(d => {
        targetCats.forEach(c => {
          deletePromises.push(deleteLockedSlip(d, c));
        });
      });
      await Promise.allSettled(deletePromises);

      window.dispatchEvent(new CustomEvent('optimizedWeightsUpdated', { detail: { category: activeCategory, days: adoptedDaysList } }));
      window.dispatchEvent(new Event('seerLockedSlipsUpdated'));
    }

    setShowAdoptModal(false);
    const targetDaysLabel = adoptedDaysList.length === 1
      ? adoptedDaysList[0].toUpperCase()
      : adoptedDaysList.length === 7
      ? 'ALL 7 DAYS'
      : adoptedDaysList.map(d => d.slice(0, 3).toUpperCase()).join(', ');
    showToast(`Adopted ${finalRules.length} calibrated rules for ${activeCategoryConfig.label} to ${targetDaysLabel}${adoptToMainAlgo ? ' & Main Algo' : ''}!`);
  }, [selectedAdoptDays, adoptToMainAlgo, activeCategory, activeCategoryConfig, activeSettings, effectiveRecommendations, isDeepOptimizing, deepStatus, deepPointsMap, deepCategoryPointsMap, matches, showToast]);

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
    const activeDayKey = selectedDay !== 'all' ? selectedDay : 'saturday';
    const targetFile = getDailyOpwFilename(activeDayKey);
    const deepMap = deepCategoryPointsMap[activeCategory];
    
    let nonZeroRules: { description: string; points: number; note: string }[];
    if (deepMap && deepMap.size > 0) {
      nonZeroRules = Array.from(deepMap.entries()).map(([description, points]) => {
        const finalPts = points !== 0 ? points : borrowTriggerPoints(description, activeCategoryConfig.id, selectedDay !== 'all' ? selectedDay : undefined);
        return {
          description,
          points: finalPts,
          note: `Deep Continuous Permutation Optimizer: ${finalPts > 0 ? '+' : ''}${finalPts} pts`
        };
      });
    } else {
      nonZeroRules = effectiveRecommendations.map(r => {
        const finalPts = r.recommendedPoints !== 0 ? r.recommendedPoints : borrowTriggerPoints(r.description, activeCategoryConfig.id, selectedDay !== 'all' ? selectedDay : undefined);
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
// OPW ALGO CODE UPDATE: ${activeDayKey.toUpperCase()} & MAIN ALGO
// Target File: ${targetFile} & src/opwalgo.tsx
// Category: ${activeCategoryConfig.label} ("${activeCategory}")
// Objective: ${activeCategoryConfig.targetObjective}
// Generated: ${new Date().toLocaleString()}
// Isolation Policy: Only ${activeDayKey.toUpperCase()} and Main Algo are adjusted.
// ============================================================================

rules: populateCategoryWithMasterRules([
${rulesCode}
], '${activeCategoryConfig.targetObjective}', '${activeCategoryConfig.id}', '${activeDayKey}')`;
  }, [effectiveRecommendations, selectedDay, activeCategory, activeCategoryConfig, getDailyOpwFilename, deepCategoryPointsMap]);

  const generateAllCodeUpdatesSnippet = useCallback(() => {
    const activeDayKey = selectedDay !== 'all' ? selectedDay : 'saturday';
    const targetFile = getDailyOpwFilename(activeDayKey);
    const dayLabel = selectedDay !== 'all' ? selectedDay.toUpperCase() : 'SATURDAY & MAIN ALGO';

    const sections: string[] = [
      `// ============================================================================`,
      `// SEER OPW ALGO CODE UPDATE: ${dayLabel} & MAIN ALGO`,
      `// Generated: ${new Date().toLocaleString()}`,
      `// Target Files: ${targetFile} & src/opwalgo.tsx`,
      `// Isolation Policy: Only ${dayLabel} and Main Algo are adjusted. Other daily files are unaffected.`,
      `// ============================================================================\n`
    ];

    CATEGORIES.forEach(cat => {
      sections.push(`// ----------------------------------------------------------------------------`);
      sections.push(`// Category: ${cat.label} ("${cat.id}") | Target Objective: '${cat.targetObjective}'`);
      sections.push(`// ----------------------------------------------------------------------------`);
      
      let rules: { description: string; points: number; note: string }[];
      const deepMap = deepCategoryPointsMap[cat.id];

      if (deepMap && deepMap.size > 0) {
        rules = Array.from(deepMap.entries()).map(([description, points]) => {
          const finalPts = points !== 0 ? points : borrowTriggerPoints(description, cat.id, selectedDay !== 'all' ? selectedDay : undefined);
          return {
            description,
            points: finalPts,
            note: `Deep Continuous Permutation Optimizer: ${finalPts > 0 ? '+' : ''}${finalPts} pts`
          };
        });
      } else if (cat.id === activeCategory && effectiveRecommendations.length > 0) {
        rules = effectiveRecommendations.map(r => {
          const finalPts = r.recommendedPoints !== 0 ? r.recommendedPoints : borrowTriggerPoints(r.description, cat.id, selectedDay !== 'all' ? selectedDay : undefined);
          return {
            description: r.description,
            points: finalPts,
            note: `${finalPts > 0 ? '+' : ''}${finalPts} pts (${r.mfavPct.toFixed(0)}% Mfav, ${r.drawPct.toFixed(0)}% Draw, ${r.underdogPct.toFixed(0)}% UD | ${r.totalHits} hits)`
          };
        });
      } else {
        const targetDay = selectedDay !== 'all' ? selectedDay : 'saturday';
        const existingRules = DAILY_OPTIMIZED_SETTINGS[targetDay]?.[cat.id]?.rules;
        if (existingRules && existingRules.length > 0) {
          rules = existingRules.map(r => {
            const finalPts = r.points !== 0 ? r.points : borrowTriggerPoints(r.description, cat.id, targetDay);
            return {
              description: r.description,
              points: finalPts,
              note: `Calibrated Runtime: ${finalPts > 0 ? '+' : ''}${finalPts} pts`
            };
          });
        } else {
          const computed = computeCategoryRecommendations(
            cat,
            rawDataset,
            phaStatsMap,
            matchStars,
            liveViewType,
            selectedDay,
            allMatches
          );
          rules = computed.recommendations.map(r => {
            const finalPts = r.recommendedPoints !== 0 ? r.recommendedPoints : borrowTriggerPoints(r.description, cat.id, selectedDay !== 'all' ? selectedDay : undefined);
            return {
              description: r.description,
              points: finalPts,
              note: `${finalPts > 0 ? '+' : ''}${finalPts} pts (${r.mfavPct.toFixed(0)}% Mfav, ${r.drawPct.toFixed(0)}% Draw, ${r.underdogPct.toFixed(0)}% UD | ${r.totalHits} hits)`
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
    sections.push(`// Copy to ${targetFile} (get${activeDayKey.charAt(0).toUpperCase() + activeDayKey.slice(1)}CategorySettings) and src/opwalgo.tsx.`);
    sections.push(`// ============================================================================`);

    return sections.join('\n');
  }, [effectiveRecommendations, activeCategory, rawDataset, phaStatsMap, matchStars, liveViewType, selectedDay, getDailyOpwFilename, deepCategoryPointsMap]);

  // Permanently save calibrated rules to codebase via /api/opw/save-to-code
  const handleSaveCalibratedRulesToCode = useCallback(async () => {
    try {
      setIsSavingCode(true);
      const targetDay = selectedDay !== 'all' ? selectedDay : 'saturday';
      
      const categoriesPayload: Record<string, { rules: { description: string; points: number; note?: string }[]; targetObjective: string }> = {};

      CATEGORIES.forEach(cat => {
        let rules: { description: string; points: number; note?: string }[] = [];
        const deepMap = deepCategoryPointsMap[cat.id];

        if (deepMap && deepMap.size > 0) {
          rules = Array.from(deepMap.entries()).map(([description, points]) => {
            const finalPts = points !== 0 ? points : borrowTriggerPoints(description, cat.id, targetDay);
            return {
              description,
              points: finalPts,
              note: `Deep Continuous Permutation Optimizer: ${finalPts > 0 ? '+' : ''}${finalPts} pts`
            };
          });
        } else if (cat.id === activeCategory && effectiveRecommendations.length > 0) {
          rules = effectiveRecommendations.map(r => {
            const finalPts = r.recommendedPoints !== 0 ? r.recommendedPoints : borrowTriggerPoints(r.description, cat.id, targetDay);
            return {
              description: r.description,
              points: finalPts,
              note: `${finalPts > 0 ? '+' : ''}${finalPts} pts (${r.mfavPct.toFixed(0)}% Mfav, ${r.drawPct.toFixed(0)}% Draw, ${r.underdogPct.toFixed(0)}% UD | ${r.totalHits} hits)`
            };
          });
        } else {
          const existingRules = DAILY_OPTIMIZED_SETTINGS[targetDay]?.[cat.id]?.rules;
          if (existingRules && existingRules.length > 0) {
            rules = existingRules.map(r => {
              const finalPts = r.points !== 0 ? r.points : borrowTriggerPoints(r.description, cat.id, targetDay);
              return {
                description: r.description,
                points: finalPts,
                note: `Calibrated Runtime: ${finalPts > 0 ? '+' : ''}${finalPts} pts`
              };
            });
          } else {
            const computed = computeCategoryRecommendations(cat, rawDataset, phaStatsMap, matchStars, liveViewType, selectedDay, allMatches);
            rules = computed.recommendations.map(r => {
              const finalPts = r.recommendedPoints !== 0 ? r.recommendedPoints : borrowTriggerPoints(r.description, cat.id, targetDay);
              return {
                description: r.description,
                points: finalPts,
                note: `${finalPts > 0 ? '+' : ''}${finalPts} pts (${r.mfavPct.toFixed(0)}% Mfav, ${r.drawPct.toFixed(0)}% Draw, ${r.underdogPct.toFixed(0)}% UD | ${r.totalHits} hits)`
              };
            });
          }
        }

        categoriesPayload[cat.id] = {
          rules,
          targetObjective: cat.targetObjective
        };
      });

      // Sync approved custom triggers points and include in save-to-code payload for permanent server persistence
      const approvedList = loadApprovedCustomTriggers();
      let approvedUpdated = false;
      CATEGORIES.forEach(cat => {
        const catRules = categoriesPayload[cat.id]?.rules;
        if (catRules) {
          catRules.forEach(r => {
            const custom = approvedList.find(c => c.description === r.description);
            if (custom && custom.points !== r.points) {
              custom.points = r.points;
              approvedUpdated = true;
            }
          });
        }
      });
      if (approvedUpdated && typeof window !== 'undefined') {
        window.localStorage.setItem('seer_approved_custom_triggers_v1', JSON.stringify(approvedList));
        window.dispatchEvent(new CustomEvent('seerCustomTriggersUpdated'));
      }

      const res = await fetch('/api/opw/save-to-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: targetDay,
          categories: categoriesPayload,
          customTriggers: approvedList
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to save to code');
      }

      // Automatically sync runtime weights & localStorage across all categories
      handleApplyRuntimeToAllCategories();

      showToast('Permanently saved Deep Continuous Optimizer rules to codebase and applied to runtime!');
    } catch (err: any) {
      console.error("Failed to save to code:", err);
      showToast(`Error saving to code: ${err.message}`);
    } finally {
      setIsSavingCode(false);
    }
  }, [selectedDay, deepCategoryPointsMap, activeCategory, effectiveRecommendations, rawDataset, phaStatsMap, matchStars, liveViewType, handleApplyRuntimeToAllCategories, showToast]);

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

  const bonusCount = effectiveRecommendations.filter(r => r.recommendedPoints > 0).length;
  const penaltyCount = effectiveRecommendations.filter(r => r.recommendedPoints < 0).length;
  const mismatchCount = effectiveRecommendations.filter(r => r.recommendedPoints !== r.currentPoints).length;

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
        <div className="flex items-center gap-2.5">
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
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {CATEGORIES.map(c => {
          const isActive = activeCategory === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
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
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Day Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dataset Scope:</span>
          {(['live', 'history', 'all'] as const).map(scope => {
            const isSel = datasetScope === scope;
            return (
              <button
                key={scope}
                onClick={() => {
                  setDatasetScope(scope);
                  userPickedDayRef.current = false;
                  if (scope === 'history' || scope === 'live') {
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
                  onClick={runTriggerDiscovery}
                  disabled={isDiscovering}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/40 flex items-center gap-1.5 transition disabled:opacity-50"
                  title="Scan real match data for synergistic trigger combos and non-colliding parameter continuations"
                >
                  {isDiscovering ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {isDiscovering ? 'Scanning...' : '🧠 Discover Combos'}
                </button>

                <button
                  onClick={() => setShowAdoptModal(true)}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/40 flex items-center gap-1.5 transition"
                  title="Adopt calibrated trigger points to selected daily algos (e.g. Saturday only, or all days)"
                >
                  <Layers size={14} /> Adopt to Daily Algos (Mon–Sun)
                </button>

                {deepComputations > 0 && !isDeepOptimizing && (
                  <button
                    onClick={resetDeepOptimization}
                    className="p-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
                    title="Reset Self-Learn Optimizer"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
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

                <button
                  onClick={runTriggerDiscovery}
                  disabled={isDiscovering}
                  className="px-3.5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/40 flex items-center gap-1.5 transition disabled:opacity-50"
                  title="Scan real match data for synergistic trigger combos and non-colliding parameter continuations"
                >
                  {isDiscovering ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {isDiscovering ? 'Scanning...' : '🧠 Discover Combos'}
                </button>

                {deepComputations > 0 && !isDeepOptimizing && (
                  <>
                    <button
                      onClick={handleApplyRecommendations}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 flex items-center gap-1.5 transition"
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

        {/* Live Optimizer Diagnostics (live / combined scope only) */}
        {datasetScope !== 'history' && deepDiagnostics && (
          <div className="mb-4 p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Targets seen by optimizer:{' '}
                <strong className={deepDiagnostics.seen < deepDiagnostics.expected ? 'text-amber-300' : 'text-emerald-300'}>
                  {deepDiagnostics.seen} / {deepDiagnostics.expected}
                </strong>
                <span className="text-slate-500"> matches ({deepDiagnostics.targetsSeen} targets)</span>
              </span>
              {deepDiagnostics.droppedNoOdds > 0 && (
                <span className="text-amber-400">
                  ⚠ {deepDiagnostics.droppedNoOdds} completed match{deepDiagnostics.droppedNoOdds === 1 ? '' : 'es'} dropped (missing odds)
                </span>
              )}
              <span className="text-slate-500">Goal: top {deepDiagnostics.goalN} targets clean</span>
            </div>
            {deepDiagnostics.infeasible.length > 0 && (
              <div className="text-rose-300">
                {deepDiagnostics.infeasible.slice(0, 5).map((inf, i) => (
                  <div key={i}>
                    ⛔ Trap <strong>{inf.teams}</strong> can't be beaten by trigger weights (only {inf.separable} of {deepDiagnostics.goalN} targets can be ranked above it within allowed bands)
                    {inf.triggers.length > 0 && (
                      <span className="text-slate-400"> — distinguishing triggers: {inf.triggers.join(', ')}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
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
              <span>Statistical evaluations</span>
              {deepElapsedMs > 0 && (
                <span className="text-slate-400">
                  {(deepElapsedMs / 1000).toFixed(2)}s
                </span>
              )}
            </div>
          </div>

          {(() => {
            const effectiveTargetFloor = deepTargetClean > 0 ? deepTargetClean : categoryHorizons.floor;
            const effectiveTargetCeiling = deepTargetCeiling > 0 ? deepTargetCeiling : categoryHorizons.ceiling;
            return (
              <>
                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">Clean Target</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                      deepConvergenceMode === 'perfect_100' || (effectiveTargetCeiling > 0 && deepCleanMatches >= effectiveTargetCeiling)
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : deepConvergenceMode === 'sweet_spot'
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                        : deepCleanMatches >= effectiveTargetFloor && effectiveTargetFloor > 0
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-indigo-500/20 text-indigo-300'
                    }`}>
                      {deepConvergenceMode === 'perfect_100' || (effectiveTargetCeiling > 0 && deepCleanMatches >= effectiveTargetCeiling)
                        ? '100% PERFECT'
                        : deepConvergenceMode === 'sweet_spot'
                        ? 'SWEET SPOT'
                        : deepCleanMatches >= effectiveTargetFloor && effectiveTargetFloor > 0
                        ? `FRONTIER: +${deepCleanMatches - effectiveTargetFloor}`
                        : `GOAL: ${effectiveTargetFloor}`}
                    </span>
                  </div>
                  <p className={`text-xl font-bold font-mono mt-1 ${
                    deepConvergenceMode === 'perfect_100' || deepConvergenceMode === 'sweet_spot' || (deepCleanMatches >= effectiveTargetFloor && effectiveTargetFloor > 0)
                      ? 'text-emerald-400'
                      : 'text-indigo-400'
                  }`}>
                    {effectiveTargetCeiling > 0 ? `${deepCleanMatches.toLocaleString()} / ${effectiveTargetCeiling.toLocaleString()}` : effectiveTargetFloor > 0 ? `${deepCleanMatches.toLocaleString()} / ${effectiveTargetFloor.toLocaleString()}` : '—'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {deepConvergenceMode === 'perfect_100'
                      ? 'All winners clean at the top'
                      : deepConvergenceMode === 'sweet_spot'
                      ? `Optimal sweet spot (floor ${effectiveTargetFloor} met)`
                      : deepCleanMatches >= effectiveTargetFloor && effectiveTargetFloor > 0
                      ? `Floor (${effectiveTargetFloor}) met • Climbing frontier`
                      : deepTargetsInTop5000 > 0
                      ? `${deepTargetsInTop5000.toLocaleString()} in top 5k • Target: 2,000`
                      : 'Clean picks before trap'}
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 uppercase font-semibold">First Trap Rank</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                      deepConvergenceMode === 'perfect_100'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : deepConvergenceMode === 'sweet_spot'
                        ? 'bg-teal-500/20 text-teal-300'
                        : deepCleanMatches >= effectiveTargetFloor && effectiveTargetFloor > 0
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-400'
                    }`}>
                      {deepConvergenceMode === 'perfect_100'
                        ? '100% CLEAN'
                        : deepConvergenceMode === 'sweet_spot'
                        ? 'OPTIMAL'
                        : deepCleanMatches >= effectiveTargetFloor && effectiveTargetFloor > 0
                        ? 'CLEAN'
                        : 'TRACKING'}
                    </span>
                  </div>
                  <p className={`text-xl font-bold font-mono mt-1 ${
                    deepConvergenceMode === 'perfect_100' || deepConvergenceMode === 'sweet_spot' || (deepCleanMatches >= effectiveTargetFloor && effectiveTargetFloor > 0)
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}>
                    {deepComputations > 0 ? `Rank #${deepFirstTrapRank}` : '—'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {deepCleanMatches} consecutive clean winners
                  </p>
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

      {/* Slip Upset Post-Mortem & Protected Trap Guards Panel */}
      {(slipPostMortems.length > 0 || protectedGuardsList.length > 0) && (
        <div className="bg-gradient-to-r from-slate-900 via-rose-950/20 to-slate-900 border border-rose-500/30 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rose-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-300 rounded-lg">
                <Shield size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Slip Upset Post-Mortem & Protected Trap Guards
                  </h3>
                  {slipPostMortems.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold">
                      {slipPostMortems.length} Slip {slipPostMortems.length === 1 ? 'Casualty' : 'Casualties'}
                    </span>
                  )}
                  {protectedGuardsList.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1">
                      <Shield size={11} />
                      {protectedGuardsList.length} Active Guards
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Identifies matches that reached the slip but suffered an outright upset. Protect their warning penalties so future optimizer computations never relax them.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowPostMortemPanel(p => !p)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {showPostMortemPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showPostMortemPanel ? 'Collapse' : 'Expand Post-Mortem'}
            </button>
          </div>

          {showPostMortemPanel && (
            <div className="space-y-4 pt-1">
              {slipPostMortems.length > 0 ? (
                <div className="space-y-3">
                  {slipPostMortems.map((pm, idx) => (
                    <div key={`${pm.matchId}_${idx}`} className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono font-bold">
                            #{pm.rankOnSlip} on Slip
                          </span>
                          <span className="font-bold text-white text-sm">
                            {pm.teams}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold">
                            FT: {pm.actualResult}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            Pred: {pm.prediction}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                            {pm.opwPoints > 0 ? `+${pm.opwPoints}` : pm.opwPoints} PTS
                          </span>
                          <span className="text-xs font-mono text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded font-semibold">
                            Deficit: -{pm.pointsDeficitToExit} pts needed
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {/* Active Warning Penalties */}
                        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/60 space-y-2">
                          <div className="flex items-center justify-between text-slate-300 font-semibold border-b border-slate-800/60 pb-1.5">
                            <span className="flex items-center gap-1.5 text-rose-400">
                              <AlertTriangle size={13} /> Active Warning Penalties
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">Overpowered warnings</span>
                          </div>

                          {pm.activePenalties.length === 0 ? (
                            <p className="text-slate-500 text-xs italic py-1">
                              No negative triggers fired. Match entered slip purely on base score and bonuses.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {pm.activePenalties.map(pen => {
                                const deepenedFloor = Math.min(-20, pen.points - Math.ceil(pm.pointsDeficitToExit / 5) * 5);
                                return (
                                  <div key={pen.trigger} className="p-2 rounded bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-slate-200 font-medium truncate">{pen.trigger}</p>
                                      <p className="text-[10px] text-slate-500 font-mono">Current points: {pen.points} pts</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {pen.isProtected ? (
                                        <div className="flex items-center gap-1">
                                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                                            <Shield size={10} /> Guard (≤ {pen.currentFloor})
                                          </span>
                                          <button
                                            onClick={() => removeProtectedPenaltyGuard(pen.trigger)}
                                            className="text-slate-500 hover:text-rose-400 text-[10px] underline ml-1"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() => {
                                              saveProtectedPenaltyGuard({
                                                trigger: pen.trigger,
                                                floorPoints: pen.points,
                                                sourceMatch: pm.teams,
                                                sourceDate: pm.date,
                                                category: pm.category,
                                                reason: `Locked from slip upset (${pm.teams})`,
                                                markedAt: new Date().toISOString()
                                              });
                                              showToast(`Protected "${pen.trigger}" at floor ${pen.points} pts.`);
                                            }}
                                            className="px-2 py-0.5 rounded bg-amber-600/90 hover:bg-amber-500 text-white text-[10px] font-bold flex items-center gap-1 transition shadow-xs"
                                            title="Lock this penalty so optimizer can never reduce it"
                                          >
                                            <Shield size={10} /> Lock Floor ({pen.points})
                                          </button>
                                          <button
                                            onClick={() => {
                                              saveProtectedPenaltyGuard({
                                                trigger: pen.trigger,
                                                floorPoints: deepenedFloor,
                                                sourceMatch: pm.teams,
                                                sourceDate: pm.date,
                                                category: pm.category,
                                                reason: `Deepened & locked from slip upset (${pm.teams})`,
                                                markedAt: new Date().toISOString()
                                              });
                                              showToast(`Deepened and protected "${pen.trigger}" to ${deepenedFloor} pts.`);
                                            }}
                                            className="px-2 py-0.5 rounded bg-indigo-600/90 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-1 transition shadow-xs"
                                            title="Deepen penalty to sink this match below slip capacity"
                                          >
                                            ⚖️ Deepen ({deepenedFloor})
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Exclusive Spoiler Triggers */}
                        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/60 space-y-2">
                          <div className="flex items-center justify-between text-slate-300 font-semibold border-b border-slate-800/60 pb-1.5">
                            <span className="flex items-center gap-1.5 text-amber-400">
                              <Sparkles size={13} /> Exclusive Spoiler Triggers
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">Present only on trap</span>
                          </div>

                          {pm.exclusiveSpoilerTriggers.length === 0 ? (
                            <p className="text-slate-500 text-xs italic py-1">
                              All positive triggers were shared with winning slip matches.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {pm.exclusiveSpoilerTriggers.map(sp => (
                                <div key={sp.trigger} className="p-2 rounded bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
                                  <span className="text-slate-300 font-medium truncate">{sp.trigger}</span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] font-mono text-slate-500">{sp.polarity}</span>
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold text-[11px]">
                                      +{sp.points} pts
                                    </span>
                                  </div>
                                </div>
                              ))}
                              <p className="text-[10px] text-slate-500 mt-1">
                                💡 These positive triggers boosted this match onto the slip, but were absent from all winning slip matches.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400 text-center">
                  No upset casualties detected on the active locked slip. All locked picks are either winning, hedged, or pending.
                </div>
              )}

              {/* Protected Guards Summary Table */}
              {protectedGuardsList.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase font-bold text-slate-300 flex items-center gap-1.5">
                      <Shield size={12} className="text-amber-400" /> All Protected Penalty Guards ({protectedGuardsList.length})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Optimizer is strictly forbidden from mutating these above their locked floor
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {protectedGuardsList.map(g => (
                      <div key={g.trigger} className="p-2.5 rounded-lg bg-slate-950/80 border border-amber-500/20 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-200 font-medium truncate">{g.trigger}</p>
                          <p className="text-[10px] text-amber-400/80 font-mono">Floor: ≤ {g.floorPoints} pts {g.sourceMatch ? `(${g.sourceMatch})` : ''}</p>
                        </div>
                        <button
                          onClick={() => {
                            removeProtectedPenaltyGuard(g.trigger);
                            showToast(`Removed protected guard for "${g.trigger}".`);
                          }}
                          className="text-slate-500 hover:text-rose-400 text-xs p-1"
                          title="Remove protection"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Live Selection Accuracy & Outcome Verification Panel */}
      {liveSelectionImpact && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-xl p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-500/20 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-lg">
                <Award size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  {activeCategoryConfig.label} Live Selection Impact: Current vs Recommended Weights
                </h3>
                <p className="text-xs text-slate-400">
                  100% Live empirical analysis: Evaluates real completed matches in the live database to verify selection accuracy under recommended vs current weights.
                </p>
              </div>
            </div>
            {liveSelectionImpact.improvement > 0 && (
              <div className="px-3.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <TrendingUp size={16} />
                +{liveSelectionImpact.improvement.toFixed(1)}% {liveSelectionImpact.metricLabel} Improvement
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 uppercase">Current Weights (Top {liveSelectionImpact.topN})</span>
                <span className="text-xs font-mono font-bold text-slate-400">{liveSelectionImpact.current.safePct.toFixed(1)}% {liveSelectionImpact.metricLabel}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">Mfav: {liveSelectionImpact.current.mfav}</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold">Draw: {liveSelectionImpact.current.draw}</span>
                <span className={`px-2 py-0.5 rounded font-mono font-bold ${liveSelectionImpact.current.ud > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>Underdog: {liveSelectionImpact.current.ud}</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[11px]">Inversions: {liveSelectionImpact.current.inversions}</span>
              </div>
            </div>

            <div className="bg-slate-950/70 p-4 rounded-lg border border-indigo-500/40 shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-300 uppercase flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-400" /> Recommended Weights (Top {liveSelectionImpact.topN})
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">{liveSelectionImpact.recommended.safePct.toFixed(1)}% {liveSelectionImpact.metricLabel}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">Mfav: {liveSelectionImpact.recommended.mfav}</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold">Draw: {liveSelectionImpact.recommended.draw}</span>
                <span className={`px-2 py-0.5 rounded font-mono font-bold ${liveSelectionImpact.recommended.ud === 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-400'}`}>Underdog: {liveSelectionImpact.recommended.ud}</span>
                <span className={`px-2 py-0.5 rounded font-mono text-[11px] ${liveSelectionImpact.recommended.inversions === 0 ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'bg-slate-800 text-slate-400'}`}>Inversions: {liveSelectionImpact.recommended.inversions}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Trigger Discovery & Synergistic Combos Section (Real Match Data) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-400">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  🧠 AI Trigger Discovery & Synergistic Combos
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                  Real Match Data
                </span>
                {discoveredCandidates.length > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {discoveredCandidates.length} Candidates
                  </span>
                )}
                {approvedCustomTriggersList.length > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {approvedCustomTriggersList.length} Approved Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Mines statistical co-occurrences on real matches. Discovers high-synergy pairs (e.g. 50% + 50% → 75%) and non-colliding parameter continuations with manual approval.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runTriggerDiscovery}
              disabled={isDiscovering}
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/40 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {isDiscovering ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {isDiscovering ? 'Scanning Real Matches...' : '🔍 Scan Real Match Data'}
            </button>
            <button
              onClick={() => setShowDiscoveryPanel(p => !p)}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1"
            >
              {showDiscoveryPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showDiscoveryPanel ? 'Collapse' : 'Expand Panel'}
            </button>
          </div>
        </div>

        {showDiscoveryPanel && (
          <div className="space-y-4 pt-1">
            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {(['all', 'combos', 'continuations', 'approved'] as const).map(tab => {
                  const isSel = discoveryFilter === tab;
                  const label = tab === 'all'
                    ? `All Candidates (${discoveredCandidates.length})`
                    : tab === 'combos'
                    ? `Synergy Combos (${discoveredCandidates.filter(c => c.type === 'synergy_combo').length})`
                    : tab === 'continuations'
                    ? `Continuations / Partitions (${discoveredCandidates.filter(c => c.type === 'progression_continuation').length})`
                    : `Approved in Catalog (${approvedCustomTriggersList.length})`;
                  return (
                    <button
                      key={tab}
                      onClick={() => setDiscoveryFilter(tab)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition border ${
                        isSel
                          ? 'bg-cyan-600 text-white border-cyan-500'
                          : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {discoveredCandidates.length > 0 && discoveryFilter !== 'approved' && (
                <button
                  onClick={() => setDiscoveredCandidates([])}
                  className="text-xs text-slate-500 hover:text-slate-300 underline"
                >
                  Clear Candidates
                </button>
              )}
            </div>

            {/* Content: Approved Tab */}
            {discoveryFilter === 'approved' ? (
              approvedCustomTriggersList.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/50 rounded-lg border border-slate-800 text-slate-500 text-xs">
                  No custom triggers approved yet. Click <strong>Scan Real Match Data</strong> to discover synergistic combos and continuations, then approve the ones you want.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Approved Trigger / Combo Description</th>
                        <th className="py-2.5 px-2">Domain</th>
                        <th className="py-2.5 px-2 text-center">Type</th>
                        <th className="py-2.5 px-2 text-center">Assigned PTS</th>
                        <th className="py-2.5 px-2 text-center">Real Sample</th>
                        <th className="py-2.5 px-2 text-center">Accuracy</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-mono">
                      {approvedCustomTriggersList.map(t => (
                        <tr key={t.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3">
                            <button
                              onClick={() => handleToggleApproved(t.id)}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold border transition ${
                                t.isActive
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : 'bg-slate-800 text-slate-500 border-slate-700'
                              }`}
                            >
                              {t.isActive ? 'Active' : 'Disabled'}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 font-sans font-semibold text-white">
                            {t.description}
                          </td>
                          <td className="py-2.5 px-2 font-sans text-slate-400 text-[11px]">
                            {t.domain}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {t.type === 'synergy_combo' ? 'Combo' : 'Continuation'}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded ${t.points > 0 ? 'bg-indigo-500/20 text-indigo-300' : t.points < 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
                              {t.points > 0 ? `+${t.points}` : t.points} PTS
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center text-slate-400">
                            {t.realTotalHits} matches
                          </td>
                          <td className="py-2.5 px-2 text-center text-emerald-400 font-bold">
                            {t.realAccuracy.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={() => handleRemoveApproved(t.id)}
                              className="p-1 rounded text-rose-400 hover:bg-rose-500/20 transition"
                              title="Delete from Catalog"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* Candidates Grid */
              (() => {
                const filtered = discoveredCandidates.filter(c => {
                  if (discoveryFilter === 'combos') return c.type === 'synergy_combo';
                  if (discoveryFilter === 'continuations') return c.type === 'progression_continuation';
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-8 text-center bg-slate-950/50 rounded-lg border border-slate-800 text-slate-500 text-xs">
                      {isDiscovering
                        ? 'Scanning match profiles for synergistic trigger co-occurrences...'
                        : 'No candidates currently queued. Click "Scan Real Match Data" above to discover new statistical combos on the active dataset.'}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {filtered.map(c => {
                      const isTrapCombo = c.recommendedPoints < 0;
                      return (
                        <div
                          key={c.id}
                          className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-4 space-y-3 transition flex flex-col justify-between"
                        >
                          <div className="space-y-2.5">
                            {/* Card Header */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  {c.domain}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  c.type === 'synergy_combo'
                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                }`}>
                                  {c.type === 'synergy_combo' ? '⚡ Synergistic Combo' : '🔄 Parameter Continuation'}
                                </span>
                              </div>
                              <span className={`px-2.5 py-0.5 rounded font-mono font-bold text-xs border ${
                                isTrapCombo
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              }`}>
                                {c.recommendedPoints > 0 ? `+${c.recommendedPoints}` : c.recommendedPoints} PTS
                              </span>
                            </div>

                            {/* Trigger Description */}
                            <h4 className="text-xs font-bold text-white leading-relaxed">
                              {c.description}
                            </h4>

                            {/* Real Data Statistics Proof Box */}
                            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2">
                              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                                <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800/80">
                                  <span className="text-[10px] text-slate-400 block font-sans">Real Matches</span>
                                  <strong className="text-white">{c.realTotalHits}</strong>
                                </div>
                                <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800/80">
                                  <span className="text-[10px] text-slate-400 block font-sans">Verified Win %</span>
                                  <strong className={isTrapCombo ? 'text-rose-400' : 'text-emerald-400'}>
                                    {c.realAccuracy.toFixed(1)}%
                                  </strong>
                                </div>
                                <div className="bg-slate-950/80 p-1.5 rounded border border-slate-800/80">
                                  <span className="text-[10px] text-slate-400 block font-sans">
                                    {isTrapCombo ? 'Trap Concentration' : 'Synergy Lift'}
                                  </span>
                                  <strong className={isTrapCombo ? 'text-rose-400' : 'text-emerald-300'}>
                                    {c.realSynergyLift >= 0 ? `+${c.realSynergyLift.toFixed(1)}%` : `${c.realSynergyLift.toFixed(1)}%`}
                                  </strong>
                                </div>
                              </div>

                              {c.type === 'synergy_combo' && (
                                <div className="bg-slate-950/90 p-2.5 rounded border border-slate-800/80 space-y-1.5 text-[11px] font-mono">
                                  <div className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-wider">
                                    Computational Proof & Efficiency Breakdown
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                                      <span className="text-slate-400 block font-sans truncate" title={c.triggerA}>Solo A: {c.triggerA}</span>
                                      <strong className="text-cyan-300">{c.winsA}/{c.hitsA} ({c.accuracyA.toFixed(1)}%)</strong>
                                    </div>
                                    <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                                      <span className="text-slate-400 block font-sans truncate" title={c.triggerB}>Solo B: {c.triggerB}</span>
                                      <strong className="text-cyan-300">{c.winsB}/{c.hitsB} ({c.accuracyB.toFixed(1)}%)</strong>
                                    </div>
                                  </div>
                                  <p className="text-[11px] text-slate-300 font-sans leading-normal pt-1">
                                    📊 Co-occurred in <strong>{c.realTotalHits} real matches</strong> with a combined win rate of <strong className={isTrapCombo ? 'text-rose-400' : 'text-emerald-400'}>{c.realAccuracy.toFixed(1)}%</strong> ({c.realTargetHits} targets, {c.realTrapHits} traps) — 
                                    <span className={c.realSynergyLift >= 0 ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
                                      {' '}{c.realSynergyLift >= 0 ? `+${c.realSynergyLift.toFixed(1)}% lift` : `${c.realSynergyLift.toFixed(1)}% trap shift`}
                                    </span> over solo performance.
                                  </p>
                                </div>
                              )}

                              {/* Collision / Partition Status */}
                              {c.collisionStatus === 'clean' ? (
                                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-sans">
                                  <Check size={13} className="text-emerald-400 shrink-0" />
                                  <span>Zero overlap collision with existing master rules.</span>
                                </div>
                              ) : (
                                <div className="text-[11px] text-amber-300/90 font-sans bg-amber-500/10 p-2 rounded border border-amber-500/30">
                                  <strong>Partition Note:</strong> {c.refinementNote}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                            <span className="text-[11px] text-slate-500 font-sans">
                              Target: <strong className="text-slate-400 uppercase">{c.targetObjective}</strong>
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDismissCandidate(c.id)}
                                className="px-2.5 py-1.5 rounded text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
                              >
                                Dismiss
                              </button>
                              <button
                                onClick={() => handleApproveCandidate(c)}
                                className="px-3.5 py-1.5 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 flex items-center gap-1.5 transition"
                              >
                                <Check size={14} /> Approve & Add to Catalog
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>

      {/* Trigger Recommendations Table Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${effectiveRecommendations.length} master & custom triggers...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            {(['all', 'bonus', 'penalty', 'protected', 'mismatch', 'zero'] as const).map(f => {
              const isSel = recommendationFilter === f;
              const label = f === 'mismatch'
                ? `Mismatch (${mismatchCount})`
                : f === 'protected'
                ? `Protected (${protectedGuardsList.length})`
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
              {filteredRecommendations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No triggers match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredRecommendations.map(row => {
                  const isBonus = row.recommendedPoints > 0;
                  const isPenalty = row.recommendedPoints < 0;
                  const isDiff = row.recommendedPoints !== row.currentPoints;

                  return (
                    <tr key={row.description} className="hover:bg-slate-800/40 transition">
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
                            {isProtectedPenalty(row.description) && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0"
                                title={`Protected Penalty Guard: Floor ≤ ${getProtectedFloor(row.description)} pts`}
                              >
                                <Shield size={10} className="text-amber-400" />
                                <span>≤ {getProtectedFloor(row.description)}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isProtectedPenalty(row.description) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  removeProtectedPenaltyGuard(row.description);
                                  showToast(`Removed protected guard for "${row.description}".`);
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-500/10 hover:bg-rose-500/20 text-amber-300 hover:text-rose-300 border border-amber-500/30 transition shrink-0"
                                title="Click to remove protection guard"
                              >
                                <Shield size={10} /> Protected
                              </button>
                            ) : (row.currentPoints < 0 || row.recommendedPoints < 0) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const floor = row.currentPoints < 0 ? row.currentPoints : row.recommendedPoints;
                                  saveProtectedPenaltyGuard({
                                    trigger: row.description,
                                    floorPoints: floor,
                                    reason: 'Protected from catalog table',
                                    markedAt: new Date().toISOString()
                                  });
                                  showToast(`Protected "${row.description}" at floor ${floor} pts.`);
                                }}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800/90 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 border border-slate-700/60 hover:border-amber-500/40 transition shrink-0"
                                title="Lock as protected penalty guard (optimizer will not relax it)"
                              >
                                <Shield size={10} /> Protect
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setHistoryInspectTrigger(row.description)}
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
                })
              )}
            </tbody>
          </table>
        </div>
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
                  🛡️ <strong>Asymmetric Ratchet Guarantee:</strong> When the live match sample has fewer than 5 matches, the algorithm evaluates historical data across weekdays and all days. If historical evidence justifies a stronger conviction bonus or deeper trap penalty, it grants leeway to scale it up (max +25 bonus, max -40 penalty). Existing calibrated points are <strong>never reduced or weakened</strong> on small sample sizes.
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
    </div>
  );
};

export default OPWAlgo;
