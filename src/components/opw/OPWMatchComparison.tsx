import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { 
  Search, 
  ArrowLeftRight, 
  SlidersHorizontal, 
  CheckCircle2, 
  Copy, 
  Download, 
  Check, 
  X, 
  TrendingUp, 
  Sparkles, 
  Scale, 
  Layers, 
  Calculator,
  Plus,
  Trash2,
  Minimize2,
  Maximize2,
  Trophy,
  Play
} from 'lucide-react';
import { Match } from '../../types';
import { getActualResult, processMatch, calculatePAAPrediction } from '../../utils/matchProcessing';
import { predictWithHybridML } from '../../utils/hybridMachineLearning';
import { L10Display } from '../../utils/l10Utils';
import { 
  getMarketFavorite, 
  getOptimizedScoreDetailed, 
  OPTIMIZED_CATEGORY_SETTINGS, 
  CODE_DEFAULT_CATEGORY_SETTINGS,
  OptimizedScoreDetail,
  updateOptimizedCategorySettings,
  updateDailyOptimizedCategorySettings,
  savePersistedDailySettings,
  DayOfWeek,
  DAILY_DEFAULT_CATEGORY_SETTINGS,
  DAILY_OPTIMIZED_SETTINGS
} from '../../utils/optimizedweights';
import {
  populateCategoryWithMasterRules,
  MASTER_TOP_12_RULES,
  MASTER_BEST_BET_RULES,
  MASTER_BANKERS_DLIVE_RULES,
  MASTER_BANKERS_JACKPOT_RULES,
  MASTER_VALUE_PICKS_RULES,
  MASTER_UPSETS_RULES,
  MASTER_BOTB_RULES
} from '../../utils/opwCatalog';
import { getMatchEvaluatorTags } from '../../utils/matchEvaluator';

const MASTER_RULES_MAP: Record<string, { description: string; points: number }[]> = {
  top_12_value: MASTER_TOP_12_RULES,
  top_10_value: MASTER_TOP_12_RULES,
  best_bet: MASTER_BEST_BET_RULES,
  bankers_dlive: MASTER_BANKERS_DLIVE_RULES,
  bankers_jackpot: MASTER_BANKERS_JACKPOT_RULES,
  value_picks: MASTER_VALUE_PICKS_RULES,
  upsets: MASTER_UPSETS_RULES,
  botb_best: MASTER_BOTB_RULES,
};

/**
 * Hydrates a match object with all required fields (pattern analysis, mlInfo, evaluatorTags, paaWin)
 * ensuring OPW score evaluation is 100% factual and identical to MatchCard & OptimizedWeightsModal.
 */
function hydrateMatchForEvaluation(
  rawMatch: Match | null,
  phaStatsMap: Record<string, any>,
  matchStars: Record<string, number> = {},
  isJackpot: boolean = false
): Match | null {
  if (!rawMatch) return null;

  // Flatten nested data if present (common from Supabase / history storage)
  let m: Match = (rawMatch as any).data ? { ...(rawMatch as any).data, id: rawMatch.id } : { ...rawMatch };

  // 1. Ensure core processing is present
  if (!m.patternAnalysis || !m.totalPoints) {
    try {
      m = processMatch(m);
    } catch (e) {
      console.warn('Error running processMatch on comparison match:', e);
    }
  }

  // 2. Ensure mlInfo is present
  if (!m.mlInfo) {
    try {
      m = predictWithHybridML(m);
    } catch (e) {}
  }

  // 3. Ensure evaluatorTags are computed
  if (!m.evaluatorTags || m.evaluatorTags.length === 0) {
    try {
      m = getMatchEvaluatorTags(m, phaStatsMap, isJackpot, true, matchStars);
    } catch (e) {}
  }

  // 4. Ensure PAA win percentages and predictions exist
  const sub = m.patternAnalysis?.subPattern;
  if (sub && phaStatsMap[sub]) {
    const stats = phaStatsMap[sub];
    const denom = (stats.paaTotal > 0 ? stats.paaTotal : stats.total) || 0;
    if (denom > 0 && (m.paaWin === undefined || m.paaWin === null)) {
      m.paaWin = Math.round(((stats.favWin ?? stats.outcomes?.[m.mFav || '1'] ?? 0) / denom) * 100);
      m.paaDraw = Math.round(((stats.draw ?? stats.outcomes?.['X'] ?? 0) / denom) * 100);
      m.paaUpset = Math.round(((stats.upsetWin ?? stats.outcomes?.[m.underdog || '2'] ?? 0) / denom) * 100);
    }
    if (!m.paaPrediction || !m.paaPrimaryPrediction) {
      try {
        const paaPred = calculatePAAPrediction(m, stats);
        if (paaPred) {
          m.paaPrimaryPrediction = paaPred.paaPrimaryPrediction;
          m.paaPrediction = paaPred.paaPrediction;
        }
      } catch (e) {}
    }
  }

  return m;
}

/**
 * Returns the list of OPW categories for which this match qualifies based on its evaluator tags.
 */
function getMatchQualifiedCategories(
  match: Match | null,
  phaStatsMap: Record<string, any>,
  matchStars: Record<string, number> = {},
  isJackpot: boolean = false
): { id: string; label: string; code: string }[] {
  if (!match) return [];
  const tags = match.evaluatorTags && match.evaluatorTags.length > 0
    ? match.evaluatorTags
    : getMatchEvaluatorTags(match, phaStatsMap, isJackpot, true, matchStars);

  const cats: { id: string; label: string; code: string }[] = [];
  if (tags.some(t => t.startsWith('top12:') || t.startsWith('top10:'))) cats.push({ id: 'top_12_value', label: 'Top 12 Value', code: 'T12' });
  if (tags.some(t => t.startsWith('best_bet:'))) cats.push({ id: 'best_bet', label: 'Best Bets', code: 'BB' });
  if (tags.some(t => t.startsWith('bankers_dlive:'))) cats.push({ id: 'bankers_dlive', label: 'Bankers Dlive', code: 'BD' });
  if (tags.some(t => t.startsWith('bankers_jackpot:'))) cats.push({ id: 'bankers_jackpot', label: 'Bankers Jackpot', code: 'BJ' });
  if (tags.some(t => t.startsWith('upsets:'))) cats.push({ id: 'upsets', label: 'Upsets', code: 'UPS' });
  if (tags.some(t => t.startsWith('value_picks:'))) cats.push({ id: 'value_picks', label: 'Value Picks', code: 'VP' });
  return cats;
}

export interface OPWMatchComparisonProps {
  matches: Match[];
  allMatches?: Match[];
  phaStatsMap: Record<string, any>;
  matchStars?: Record<string, number>;
  liveViewType?: 'daily' | 'jackpot';
  initialCategory?: string;
  onBack?: () => void;
  onSwitchToAggregate?: () => void;
}

interface CategoryOption {
  id: string;
  label: string;
  tagPrefix: string;
  description: string;
}

const CATEGORIES: CategoryOption[] = [
  { id: 'top_12_value', label: 'Top 12 Value', tagPrefix: 'top12:', description: 'Statistically sound value picks with high consensus.' },
  { id: 'best_bet', label: 'Best Bets', tagPrefix: 'best_bet:', description: 'Highest conviction selections across all algorithms.' },
  { id: 'bankers_dlive', label: 'Bankers Dlive', tagPrefix: 'bankers_dlive:', description: 'Optimized weights for Bankers D.live selections.' },
  { id: 'bankers_jackpot', label: 'Bankers Jackpot', tagPrefix: 'bankers_jackpot:', description: 'Optimized weights for Bankers Jackpot selections.' },
  { id: 'upsets', label: 'Upsets', tagPrefix: 'upsets:', description: 'High value underdogs based on pattern support.' },
  { id: 'value_picks', label: 'Value Picks', tagPrefix: 'value_picks:', description: 'Requires Market Favorite to win (odds 2.0-2.50) without draw or underdog traps.' },
  { id: 'botb_best', label: 'BOTB', tagPrefix: 'botb_best:', description: 'Premium tier selections with zero risk flags.' }
];

export interface SlotConfig {
  letter: string;
  name: string;
  colorName: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  borderAccent: string;
  bgLight: string;
  bgHeader: string;
  bgTint: string;
  textColor: string;
  textDark: string;
  ringFocus: string;
  leadBadgeBg: string;
  leadBadgeBorder: string;
  leadBadgeText: string;
}

export const SLOT_CONFIGS: SlotConfig[] = [
  {
    letter: 'A',
    name: 'Match A',
    colorName: 'emerald',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    borderColor: 'border-emerald-300',
    borderAccent: 'border-emerald-500',
    bgLight: 'bg-emerald-50/50',
    bgHeader: 'bg-emerald-50/80',
    bgTint: 'bg-emerald-50/30',
    textColor: 'text-emerald-700',
    textDark: 'text-emerald-950',
    ringFocus: 'focus:ring-emerald-500',
    leadBadgeBg: 'bg-emerald-900/80',
    leadBadgeBorder: 'border-emerald-500',
    leadBadgeText: 'text-emerald-300'
  },
  {
    letter: 'B',
    name: 'Match B',
    colorName: 'blue',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    borderColor: 'border-blue-300',
    borderAccent: 'border-blue-500',
    bgLight: 'bg-blue-50/50',
    bgHeader: 'bg-blue-50/80',
    bgTint: 'bg-blue-50/30',
    textColor: 'text-blue-700',
    textDark: 'text-blue-950',
    ringFocus: 'focus:ring-blue-500',
    leadBadgeBg: 'bg-blue-900/80',
    leadBadgeBorder: 'border-blue-500',
    leadBadgeText: 'text-blue-300'
  },
  {
    letter: 'C',
    name: 'Match C',
    colorName: 'purple',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    borderColor: 'border-purple-300',
    borderAccent: 'border-purple-500',
    bgLight: 'bg-purple-50/50',
    bgHeader: 'bg-purple-50/80',
    bgTint: 'bg-purple-50/30',
    textColor: 'text-purple-700',
    textDark: 'text-purple-950',
    ringFocus: 'focus:ring-purple-500',
    leadBadgeBg: 'bg-purple-900/80',
    leadBadgeBorder: 'border-purple-500',
    leadBadgeText: 'text-purple-300'
  },
  {
    letter: 'D',
    name: 'Match D',
    colorName: 'amber',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    borderColor: 'border-amber-300',
    borderAccent: 'border-amber-500',
    bgLight: 'bg-amber-50/50',
    bgHeader: 'bg-amber-50/80',
    bgTint: 'bg-amber-50/30',
    textColor: 'text-amber-700',
    textDark: 'text-amber-950',
    ringFocus: 'focus:ring-amber-500',
    leadBadgeBg: 'bg-amber-900/80',
    leadBadgeBorder: 'border-amber-500',
    leadBadgeText: 'text-amber-300'
  },
  {
    letter: 'E',
    name: 'Match E',
    colorName: 'rose',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-800',
    borderColor: 'border-rose-300',
    borderAccent: 'border-rose-500',
    bgLight: 'bg-rose-50/50',
    bgHeader: 'bg-rose-50/80',
    bgTint: 'bg-rose-50/30',
    textColor: 'text-rose-700',
    textDark: 'text-rose-950',
    ringFocus: 'focus:ring-rose-500',
    leadBadgeBg: 'bg-rose-900/80',
    leadBadgeBorder: 'border-rose-500',
    leadBadgeText: 'text-rose-300'
  }
];

type FilterMode = 'all_triggered' | 'all_matches' | 'shared' | 'only_a' | 'only_b' | 'differences' | 'bonus' | 'penalty' | 'neutral' | 'all_rules';

export const OPWMatchComparison: React.FC<OPWMatchComparisonProps> = ({
  matches = [],
  allMatches = [],
  phaStatsMap = {},
  matchStars = {},
  liveViewType = 'daily',
  initialCategory = 'top_12_value',
  onBack,
  onSwitchToAggregate
}) => {
  // Category state
  const [activeCategory, setActiveCategory] = useState<string>(() => {
    if (initialCategory === 'top10' || initialCategory === 'top_10_value' || initialCategory === 'top12' || initialCategory === 'top_12_value') return 'top_12_value';
    if (initialCategory && CATEGORIES.some(c => c.id === initialCategory)) return initialCategory;
    return 'top_12_value';
  });

  // Dataset scope for match search: live vs history vs all
  const [datasetScope, setDatasetScope] = useState<'live' | 'history' | 'all'>('live');

  // Active pool of searchable matches
  const availableMatches = useMemo(() => {
    if (datasetScope === 'live') {
      return matches;
    } else if (datasetScope === 'history') {
      return allMatches.length > 0 ? allMatches : matches;
    } else {
      const combined = new Map<string | number, Match>();
      matches.forEach(m => combined.set(m.id, m));
      allMatches.forEach(m => {
        if (!combined.has(m.id)) combined.set(m.id, m);
      });
      return Array.from(combined.values());
    }
  }, [datasetScope, matches, allMatches]);

  // Selected matches IDs (Dynamic array: 2 to 5 matches)
  const [selectedMatchIds, setSelectedMatchIds] = useState<(string | number)[]>(() => {
    const ids: (string | number)[] = [];
    if (matches.length > 0) ids.push(matches[0].id);
    if (matches.length > 1) ids.push(matches[1].id);
    else if (matches.length === 1) ids.push(matches[0].id);
    return ids.length >= 2 ? ids : [0, 1];
  });

  // Column minimization toggle (compact view allows up to 5 matches without excessive horizontal space)
  const [isCompactColumns, setIsCompactColumns] = useState<boolean>(() => {
    return false;
  });

  // Search queries per slot
  const [searchQueries, setSearchQueries] = useState<string[]>(['', '', '', '', '']);
  const [openDropdownSlot, setOpenDropdownSlot] = useState<number | null>(null);

  // Table filter mode and search query
  const [filterMode, setFilterMode] = useState<FilterMode>('all_triggered');
  const [ruleSearch, setRuleSearch] = useState<string>('');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const selectorsContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorsContainerRef.current && !selectorsContainerRef.current.contains(event.target as Node)) {
        setOpenDropdownSlot(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync category state when initialCategory prop changes
  useEffect(() => {
    if (initialCategory && CATEGORIES.some(c => c.id === initialCategory)) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  // Add match slot (up to 5)
  const handleAddMatch = () => {
    if (selectedMatchIds.length >= 5) return;
    const availableNext = availableMatches.find(m => !selectedMatchIds.includes(m.id));
    const nextId = availableNext ? availableNext.id : (availableMatches[0]?.id ?? '');
    setSelectedMatchIds(prev => [...prev, nextId]);
  };

  // Remove match slot (minimum 2 matches)
  const handleRemoveMatch = (index: number) => {
    if (selectedMatchIds.length <= 2) return;
    setSelectedMatchIds(prev => prev.filter((_, i) => i !== index));
    setOpenDropdownSlot(null);
  };

  // Select match for slot
  const handleSelectMatch = (index: number, matchId: string | number) => {
    setSelectedMatchIds(prev => {
      const next = [...prev];
      next[index] = matchId;
      return next;
    });
    setOpenDropdownSlot(null);
    setSearchQueries(prev => {
      const next = [...prev];
      next[index] = '';
      return next;
    });
  };

  // Swap matches A and B
  const handleSwapFirstTwo = () => {
    if (selectedMatchIds.length < 2) return;
    setSelectedMatchIds(prev => {
      const next = [...prev];
      const tmp = next[0];
      next[0] = next[1];
      next[1] = tmp;
      return next;
    });
  };

  // Resolved raw matches for each slot
  const selectedMatches: (Match | null)[] = useMemo(() => {
    return selectedMatchIds.map(id => availableMatches.find(m => String(m.id) === String(id)) || null);
  }, [selectedMatchIds, availableMatches]);

  // Hydrate each match with complete metadata, evaluatorTags, and predictions
  const hydratedMatches: (Match | null)[] = useMemo(() => {
    return selectedMatches.map(m => hydrateMatchForEvaluation(m, phaStatsMap, matchStars, liveViewType === 'jackpot'));
  }, [selectedMatches, phaStatsMap, matchStars, liveViewType]);

  // Calculate OPW Detailed scores for each hydrated match
  const matchDetails: (OptimizedScoreDetail | null)[] = useMemo(() => {
    return hydratedMatches.map(hm => {
      if (!hm) return null;
      try {
        return getOptimizedScoreDetailed(hm, activeCategory, phaStatsMap);
      } catch (err) {
        console.error('Error computing OPW score for match:', err);
        return null;
      }
    });
  }, [hydratedMatches, activeCategory, phaStatsMap]);

  // Extract bonuses, penalties, and neutral totals for each match
  const matchStats = useMemo(() => {
    return matchDetails.map(detail => {
      if (!detail) {
        return { bonus: 0, penalty: 0, netAdjustment: 0, bonusCount: 0, penaltyCount: 0, neutralCount: 0, totalTriggered: 0 };
      }
      let bonus = 0;
      let penalty = 0;
      let bonusCount = 0;
      let penaltyCount = 0;
      let neutralCount = 0;
      detail.rulesHit.forEach(r => {
        if (r.points > 0) {
          bonus += r.points;
          bonusCount++;
        } else if (r.points < 0) {
          penalty += r.points;
          penaltyCount++;
        } else {
          neutralCount++;
        }
      });
      return { 
        bonus, 
        penalty, 
        netAdjustment: bonus + penalty, 
        bonusCount, 
        penaltyCount, 
        neutralCount, 
        totalTriggered: detail.rulesHit.length 
      };
    });
  }, [matchDetails]);

  // Ranked matches leaderboard
  const rankedMatches = useMemo(() => {
    return hydratedMatches.map((m, idx) => ({
      index: idx,
      slot: SLOT_CONFIGS[idx] || SLOT_CONFIGS[0],
      match: m,
      detail: matchDetails[idx],
      stats: matchStats[idx],
      score: matchDetails[idx]?.totalScore ?? -999
    })).sort((a, b) => b.score - a.score);
  }, [hydratedMatches, matchDetails, matchStats]);

  const topMatch = rankedMatches[0];
  const secondMatch = rankedMatches[1];
  const leaderLeadPts = topMatch && secondMatch ? topMatch.score - secondMatch.score : 0;

  // Filtered dropdown search results generator
  const getSearchResults = useCallback((query: string) => {
    if (!query.trim()) return availableMatches.slice(0, 50);
    const q = query.toLowerCase().trim();
    return availableMatches.filter(m => 
      (m.teams && m.teams.toLowerCase().includes(q)) ||
      (m.league && m.league.toLowerCase().includes(q)) ||
      (String(m.id).toLowerCase().includes(q))
    ).slice(0, 50);
  }, [availableMatches]);

  // Multi-Match Comparison Row
  interface MultiComparisonRow {
    description: string;
    rulePoints: number;
    hits: boolean[];          // array of boolean for each match slot
    points: number[];        // points awarded for each match
    hitCount: number;        // total matches triggering this rule
    status: 'all' | 'shared' | 'single' | 'none';
    singleHitIndex?: number; // index of the single match that hit if hitCount === 1
  }

  // Build unified comparison rows for up to 5 matches
  const comparisonMatrix: MultiComparisonRow[] = useMemo(() => {
    const numMatches = selectedMatchIds.length;
    const matchRuleMaps = matchDetails.map(detail => {
      const map = new Map<string, number>();
      if (detail) {
        detail.rulesHit.forEach(h => map.set(h.description, h.points));
      }
      return map;
    });

    // Also get all configured rules for this category
    const catSettings = OPTIMIZED_CATEGORY_SETTINGS[activeCategory] || CODE_DEFAULT_CATEGORY_SETTINGS[activeCategory];
    const allConfiguredRules = catSettings?.rules || [];
    const configuredPointsMap = new Map<string, number>();
    allConfiguredRules.forEach(r => configuredPointsMap.set(r.description, r.points));

    // Combine all unique rule descriptions across all matches
    const allDescriptions = new Set<string>();
    matchDetails.forEach(detail => {
      if (detail) {
        detail.rulesHit.forEach(h => allDescriptions.add(h.description));
      }
    });

    if (filterMode === 'all_rules') {
      allConfiguredRules.forEach(r => allDescriptions.add(r.description));
    }

    const rows: MultiComparisonRow[] = [];

    allDescriptions.forEach(desc => {
      const hits: boolean[] = [];
      const points: number[] = [];
      let hitCount = 0;
      let singleHitIndex: number | undefined;

      for (let i = 0; i < numMatches; i++) {
        const hasHit = matchRuleMaps[i].has(desc);
        hits.push(hasHit);
        const pts = matchRuleMaps[i].get(desc) ?? 0;
        points.push(pts);
        if (hasHit) {
          hitCount++;
          singleHitIndex = i;
        }
      }

      // Determine rule base points
      let rulePoints = configuredPointsMap.get(desc) ?? 0;
      if (rulePoints === 0 && hitCount > 0) {
        for (let i = 0; i < numMatches; i++) {
          if (hits[i] && points[i] !== 0) {
            rulePoints = points[i];
            break;
          }
        }
      }

      let status: 'all' | 'shared' | 'single' | 'none';
      if (hitCount === numMatches && numMatches > 0) {
        status = 'all';
      } else if (hitCount > 1) {
        status = 'shared';
      } else if (hitCount === 1) {
        status = 'single';
      } else {
        status = 'none';
      }

      rows.push({
        description: desc,
        rulePoints,
        hits,
        points,
        hitCount,
        status,
        singleHitIndex: hitCount === 1 ? singleHitIndex : undefined
      });
    });

    // Sort: rules hit by at least one match first, then by points magnitude descending
    rows.sort((a, b) => {
      const aTriggered = a.hitCount > 0;
      const bTriggered = b.hitCount > 0;
      if (aTriggered !== bTriggered) return aTriggered ? -1 : 1;

      if (b.rulePoints !== a.rulePoints) {
        return b.rulePoints - a.rulePoints;
      }
      return a.description.localeCompare(b.description);
    });

    return rows;
  }, [matchDetails, selectedMatchIds.length, activeCategory, filterMode]);

  // Filtered rows for display
  const displayRows = useMemo(() => {
    let result = comparisonMatrix;
    const numMatches = selectedMatchIds.length;

    if (filterMode === 'all_matches') {
      result = result.filter(r => r.status === 'all');
    } else if (filterMode === 'shared') {
      result = result.filter(r => r.status === 'all' || r.status === 'shared');
    } else if (filterMode === 'differences') {
      result = result.filter(r => r.hitCount > 0 && r.hitCount < numMatches);
    } else if (filterMode === 'only_a') {
      result = result.filter(r => r.singleHitIndex === 0);
    } else if (filterMode === 'only_b') {
      result = result.filter(r => r.singleHitIndex === 1);
    } else if (filterMode === 'bonus') {
      result = result.filter(r => r.rulePoints > 0 && r.hitCount > 0);
    } else if (filterMode === 'penalty') {
      result = result.filter(r => r.rulePoints < 0 && r.hitCount > 0);
    } else if (filterMode === 'neutral') {
      result = result.filter(r => r.rulePoints === 0 && r.hitCount > 0);
    } else if (filterMode === 'all_triggered') {
      result = result.filter(r => r.hitCount > 0);
    }

    // Text search filter
    if (ruleSearch.trim()) {
      const q = ruleSearch.toLowerCase().trim();
      result = result.filter(r => r.description.toLowerCase().includes(q));
    }

    return result;
  }, [comparisonMatrix, filterMode, ruleSearch, selectedMatchIds.length]);

  // Counts for filter pills
  const counts = useMemo(() => {
    const numMatches = selectedMatchIds.length;
    let allTriggered = 0;
    let allMatches = 0;
    let shared = 0;
    let differences = 0;
    let onlyA = 0;
    let onlyB = 0;
    let bonus = 0;
    let penalty = 0;
    let neutral = 0;

    comparisonMatrix.forEach(r => {
      if (r.hitCount > 0) {
        allTriggered++;
        if (r.status === 'all') allMatches++;
        if (r.status === 'all' || r.status === 'shared') shared++;
        if (r.hitCount < numMatches) differences++;
        if (r.singleHitIndex === 0) onlyA++;
        if (r.singleHitIndex === 1) onlyB++;
        if (r.rulePoints > 0) bonus++;
        else if (r.rulePoints < 0) penalty++;
        else neutral++;
      }
    });

    return { 
      allTriggered, 
      allMatches, 
      shared, 
      differences, 
      onlyA, 
      onlyB, 
      bonus, 
      penalty, 
      neutral, 
      totalRules: comparisonMatrix.length 
    };
  }, [comparisonMatrix, selectedMatchIds.length]);

  // Copy Comparison Diff to Clipboard for all active matches
  const handleCopyComparison = useCallback(() => {
    const catLabel = CATEGORIES.find(c => c.id === activeCategory)?.label || activeCategory;
    const lines: string[] = [
      `=== OPW MULTI-MATCH COMPARISON (${selectedMatchIds.length} MATCHES) [${catLabel}] ===`,
      `Date Generated: ${new Date().toLocaleString()}`,
      ''
    ];

    // Summary of each match
    selectedMatches.forEach((m, idx) => {
      const hm = hydratedMatches[idx] || m;
      const detail = matchDetails[idx];
      const stats = matchStats[idx];
      const slot = SLOT_CONFIGS[idx] || SLOT_CONFIGS[0];
      if (!hm || !detail || !stats) return;

      lines.push(`[${slot.name}] ${hm.teams} (${hm.league || 'Unknown League'})`);
      lines.push(`Net OPW Score: ${detail.totalScore.toFixed(1)} pts | Opt. Pred: ${detail.optimizedPrediction}`);
      lines.push(`Base Weight: +${detail.baseInfo.points} pts (PHA: ${detail.baseInfo.phaPercentage.toFixed(1)}%)`);
      lines.push(`Bonuses: +${stats.bonus} pts (${stats.bonusCount} rules) | Penalties: ${stats.penalty} pts (${stats.penaltyCount} rules) | Neutral: ${stats.neutralCount} rules`);
      lines.push('');
    });

    // Leaderboard
    if (topMatch && secondMatch) {
      lines.push(`[LEADERBOARD] #1 ${topMatch.match?.teams} (${topMatch.score.toFixed(1)} pts) leads by +${leaderLeadPts.toFixed(1)} pts`);
      lines.push('');
    }

    lines.push('--- TRIGGER DIFFERENTIAL BREAKDOWN ---');
    displayRows.forEach(r => {
      const sign = r.rulePoints > 0 ? `+${r.rulePoints}` : `${r.rulePoints}`;
      const statuses = r.hits.map((hit, i) => {
        const slot = SLOT_CONFIGS[i] || SLOT_CONFIGS[0];
        return hit ? `${slot.letter}: HIT (${sign})` : `${slot.letter}: —`;
      }).join(' | ');

      let summaryNote = '';
      if (r.status === 'all') summaryNote = `ALL ${selectedMatchIds.length} TRIGGERED`;
      else if (r.status === 'single' && r.singleHitIndex !== undefined) summaryNote = `ONLY ${SLOT_CONFIGS[r.singleHitIndex].name}`;
      else if (r.status === 'shared') summaryNote = `${r.hitCount} OF ${selectedMatchIds.length} TRIGGERED`;
      else summaryNote = 'NONE';

      lines.push(`[${sign} pts] ${r.description} -> ${statuses} [${summaryNote}]`);
    });

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedNotification(`Comparison diff for ${selectedMatchIds.length} matches copied to clipboard!`);
    setTimeout(() => setCopiedNotification(null), 2500);
  }, [activeCategory, selectedMatchIds.length, selectedMatches, hydratedMatches, matchDetails, matchStats, topMatch, secondMatch, leaderLeadPts, displayRows]);

  // Export CSV of the multi-match comparison
  const handleExportCSV = useCallback(() => {
    const catLabel = CATEGORIES.find(c => c.id === activeCategory)?.label || activeCategory;
    const matchCols = selectedMatches.map((m, i) => {
      const slot = SLOT_CONFIGS[i] || SLOT_CONFIGS[0];
      const team = m?.teams || slot.name;
      return `"${slot.name} (${team.replace(/"/g, '""')})"`;
    }).join(',');

    const csvHeader = `Rule Description,Rule Points,${matchCols},Trigger Summary`;
    const csvRows = displayRows.map(r => {
      const desc = `"${r.description.replace(/"/g, '""')}"`;
      const pts = r.rulePoints > 0 ? `+${r.rulePoints}` : `${r.rulePoints}`;
      const hitCols = r.hits.map((hit, i) => {
        return hit ? `"HIT (${pts})"` : '"—"';
      }).join(',');

      let note = '';
      if (r.status === 'all') note = `All ${selectedMatchIds.length} Matches`;
      else if (r.status === 'single' && r.singleHitIndex !== undefined) note = `Only ${SLOT_CONFIGS[r.singleHitIndex].name}`;
      else if (r.status === 'shared') note = `${r.hitCount} of ${selectedMatchIds.length} Matches`;
      else note = 'Not Triggered';

      return `${desc},${pts},${hitCols},"${note}"`;
    });

    const blob = new Blob([`${csvHeader}\n${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `OPW_MultiMatch_Diff_${selectedMatchIds.length}Matches_${catLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [activeCategory, selectedMatches, displayRows, selectedMatchIds.length]);

  // Apply Tuned Runtime Weights to ALL Categories and Days
  const handleApplyRuntimeToAllCategories = useCallback(() => {
    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const allCategories: { id: string; targetObjective: 'mfav_draw' | 'mfav_only' | 'underdog_only'; label: string }[] = [
      { id: 'top_12_value', targetObjective: 'mfav_draw', label: 'Top 12 Value' },
      { id: 'best_bet', targetObjective: 'mfav_only', label: 'Best Bets' },
      { id: 'bankers_dlive', targetObjective: 'mfav_only', label: 'Bankers Dlive' },
      { id: 'bankers_jackpot', targetObjective: 'mfav_only', label: 'Bankers Jackpot' },
      { id: 'value_picks', targetObjective: 'mfav_only', label: 'Value Picks' },
      { id: 'upsets', targetObjective: 'underdog_only', label: 'Upsets' },
      { id: 'botb_best', targetObjective: 'mfav_only', label: 'BOTB' }
    ];

    allCategories.forEach(cat => {
      const existingSettings = OPTIMIZED_CATEGORY_SETTINGS[cat.id] || DAILY_DEFAULT_CATEGORY_SETTINGS.saturday[cat.id];
      const masterRules = MASTER_RULES_MAP[cat.id] || existingSettings?.rules || [];
      const finalRules = populateCategoryWithMasterRules(masterRules, cat.targetObjective);
      
      const updated = {
        ...(existingSettings || {}),
        name: existingSettings?.name || cat.label,
        description: existingSettings?.description || `${cat.label} calibrated settings`,
        baseLogic: existingSettings?.baseLogic || "Points based on Primary Pattern PHA %.",
        baseWeightIntervals: existingSettings?.baseWeightIntervals || [
          { id: '1', min: 60, max: 100, points: 45, metric: 'pha_market_fav' },
          { id: '2', min: 50, max: 59.99, points: 40, metric: 'pha_market_fav' },
          { id: '3', min: 45, max: 49.99, points: 35, metric: 'pha_market_fav' },
          { id: '4', min: 40, max: 44.99, points: 25, metric: 'pha_market_fav' },
          { id: '5', min: 34, max: 39.99, points: 10, metric: 'pha_market_fav' },
          { id: '6', min: 0, max: 33.99, points: 5, metric: 'pha_market_fav' }
        ],
        rules: finalRules
      };

      updateOptimizedCategorySettings(cat.id, updated as any);
      days.forEach(d => updateDailyOptimizedCategorySettings(d, cat.id, updated as any));
    });

    savePersistedDailySettings();
    setCopiedNotification('Applied calibrated runtime weights across ALL categories and ALL days!');
    setTimeout(() => setCopiedNotification(null), 4000);
  }, []);

  // Render individual match card
  const renderMatchCard = (
    match: Match | null, 
    detail: OptimizedScoreDetail | null, 
    stats: { bonus: number; penalty: number; netAdjustment: number; bonusCount: number; penaltyCount: number; neutralCount: number; totalTriggered: number }, 
    slotConfig: SlotConfig,
    index: number,
    isLead: boolean,
    scoreDiff: number
  ) => {
    if (!match || !detail) {
      return (
        <div key={index} className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center flex flex-col items-center justify-center min-h-[300px]">
          <Scale size={36} className="text-gray-300 mb-2" />
          <h3 className="text-sm font-bold text-gray-700">No Match Selected ({slotConfig.name})</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-xs">
            Use the match selector bar above to pick a match from live or history.
          </p>
        </div>
      );
    }

    const actual = getActualResult(match.result || '');
    const isFinished = actual === '1' || actual === 'X' || actual === '2';
    const mFav = getMarketFavorite(match);
    const isFavHome = mFav === '1';

    // Qualified Categories for this match
    const qualifiedCats = getMatchQualifiedCategories(match, phaStatsMap, matchStars, liveViewType === 'jackpot');

    // Highlight score badge color
    const scoreVal = detail.totalScore;
    let scoreColor = 'bg-gray-100 text-gray-800 border-gray-300';
    if (scoreVal >= 70) scoreColor = 'bg-emerald-500 text-white border-emerald-600 shadow-md';
    else if (scoreVal >= 55) scoreColor = 'bg-blue-600 text-white border-blue-700 shadow-md';
    else if (scoreVal >= 40) scoreColor = 'bg-amber-500 text-white border-amber-600 shadow-md';
    else scoreColor = 'bg-rose-500 text-white border-rose-600 shadow-md';

    return (
      <div 
        key={index}
        className={`bg-white rounded-xl border ${slotConfig.borderColor} shadow-sm p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden transition-all`}
      >
        {/* Top Header Tag */}
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${slotConfig.badgeBg} ${slotConfig.badgeText}`}>
              {slotConfig.letter}
            </span>
            <div className="truncate max-w-[130px] sm:max-w-[160px]">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider block truncate">
                {slotConfig.name} {match.league ? `• ${match.league}` : ''}
              </span>
              <span className="text-[11px] text-gray-400">
                {match.date} {match.time ? `• ${match.time}` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isFinished ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-gray-900 text-white">
                FT: {match.result || actual}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Live
              </span>
            )}

            {isLead && scoreDiff > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                <Sparkles size={11} /> #{1} Lead
              </span>
            )}

            {/* Remove button if > 2 matches */}
            {selectedMatchIds.length > 2 && (
              <button
                onClick={() => handleRemoveMatch(index)}
                className="p-1 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title={`Remove ${slotConfig.name} from comparison`}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Match Teams Title */}
        <div className="my-2.5">
          <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-tight line-clamp-2">
            {match.teams}
          </h2>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs">
            <span className="font-semibold text-gray-500">
              Fav: <strong className="text-gray-900">{isFavHome ? 'Home (1)' : 'Away (2)'}</strong>
            </span>
            <span className="text-gray-300">•</span>
            <span className="font-semibold text-gray-500">
              Opt: <strong className="text-purple-700 font-black px-1.5 py-0.2 bg-purple-50 rounded border border-purple-200">{detail.optimizedPrediction}</strong>
            </span>
            {detail.activeHedgingProtocol && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {detail.activeHedgingProtocol}
              </span>
            )}
          </div>
        </div>

        {/* Big OPW Score & Components Row */}
        <div className="bg-gray-50/80 rounded-xl p-2.5 sm:p-3 border border-gray-200/80 my-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className={`px-3 py-1.5 rounded-xl text-xl font-black tracking-tight ${scoreColor}`}>
                {detail.totalScore.toFixed(1)}
                <span className="text-[10px] font-bold opacity-80 block text-center uppercase tracking-wider">
                  OPW
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-gray-500 font-bold">Base:</span>
                  <span className="text-[11px] font-black text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                    +{detail.baseInfo.points} pts
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-600">
                  <span className="text-[10px] text-gray-500 font-medium">PHA:</span>
                  <span className="font-bold text-gray-900 bg-gray-100 px-1 py-0.2 rounded border border-gray-200 text-[11px]">
                    {detail.baseInfo.phaPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Bonuses vs Penalties stats pill */}
            <div className="flex items-center gap-1 flex-wrap">
              <div className="px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-center min-w-[58px]">
                <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Bonus ({stats.bonusCount})
                </span>
                <span className="text-xs font-black text-emerald-700">
                  +{stats.bonus}
                </span>
              </div>
              <div className="px-2 py-1 rounded bg-rose-50 border border-rose-200 text-center min-w-[58px]">
                <span className="text-[9px] font-bold text-rose-800 uppercase tracking-wider block">
                  Pen ({stats.penaltyCount})
                </span>
                <span className="text-xs font-black text-rose-700">
                  {stats.penalty}
                </span>
              </div>
              <div className="px-2 py-1 rounded bg-gray-100 border border-gray-200 text-center min-w-[48px]">
                <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider block">
                  Neut ({stats.neutralCount})
                </span>
                <span className="text-xs font-black text-gray-700">
                  0
                </span>
              </div>
            </div>
          </div>

          {/* Rules Total Banner */}
          <div className="mt-2 pt-1.5 border-t border-gray-200 flex items-center justify-between text-xs flex-wrap gap-1">
            <span className="text-gray-600 font-bold text-[11px]">
              Triggered: <strong className="text-purple-700 font-black">{stats.totalTriggered} rules</strong>
            </span>
            <span className="text-gray-600 font-bold text-[11px]">
              Net Rules: <strong className={stats.netAdjustment >= 0 ? 'text-emerald-700 font-black' : 'text-rose-700 font-black'}>{stats.netAdjustment > 0 ? `+${stats.netAdjustment}` : stats.netAdjustment} pts</strong>
            </span>
          </div>
        </div>

        {/* Qualified Category Badges */}
        {qualifiedCats.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap my-1.5 pt-1.5 border-t border-gray-100">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Qualified:
            </span>
            {qualifiedCats.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-all border ${
                  activeCategory === cat.id
                    ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                    : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
                }`}
                title={`Switch OPW comparison to ${cat.label} rules`}
              >
                ★ {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Vital Match Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2 text-xs border-t border-gray-100">
          <div className="p-1.5 rounded bg-gray-50 border border-gray-100">
            <span className="text-[9px] text-gray-500 block uppercase font-bold">GS / GA</span>
            <span className="font-bold text-gray-800 text-[11px]">
              {match.gs || (match.gsHome !== undefined ? `${match.gsHome}:${match.gsAway}` : '—')} / {match.ga || (match.gaHome !== undefined ? `${match.gaHome}:${match.gaAway}` : '—')}
            </span>
          </div>
          <div className="p-1.5 rounded bg-gray-50 border border-gray-100">
            <span className="text-[9px] text-gray-500 block uppercase font-bold">L10 Form</span>
            <span className="font-bold text-gray-800 text-[11px] block">
              <L10Display l10={match.l10} />
            </span>
          </div>
          <div className="p-1.5 rounded bg-gray-50 border border-gray-100">
            <span className="text-[9px] text-gray-500 block uppercase font-bold">1X2 Rating</span>
            <span className="font-bold text-gray-800 text-[11px]">
              {match.rating || '—'}
            </span>
          </div>
          <div className="p-1.5 rounded bg-gray-50 border border-gray-100">
            <span className="text-[9px] text-gray-500 block uppercase font-bold">Market Odds</span>
            <span className="font-bold text-gray-800 truncate block text-[11px]" title={match.mo || '—'}>
              {match.mo || '—'}
            </span>
          </div>
        </div>

        {/* Secondary Meta Row: TS & LE & SubPattern */}
        <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-gray-100 text-[10px] text-gray-500 flex-wrap">
          {match.tsa !== undefined && match.tsb !== undefined && (
            <span className="bg-amber-50 text-amber-900 border border-amber-200 px-1 py-0.2 rounded font-bold">
              TS: {typeof match.tsa === 'number' ? match.tsa.toFixed(2) : match.tsa}:{typeof match.tsb === 'number' ? match.tsb.toFixed(2) : match.tsb}
            </span>
          )}
          {match.le && match.le !== 'NA' && match.le !== '-' && (
            <span className="bg-slate-100 text-slate-800 border border-slate-200 px-1 py-0.2 rounded font-semibold">
              LE: {match.le}
            </span>
          )}
          {match.patternAnalysis?.subPattern && (
            <span className="bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 rounded font-semibold">
              Sub: {match.patternAnalysis.subPattern}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1500px] mx-auto p-3 sm:p-5 space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1.5 text-sm font-semibold shadow-xs"
              title="Back to Live Analysis"
            >
              <ArrowLeftRight size={18} />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 rounded-md bg-purple-100 text-purple-700">
                <Scale size={18} />
              </span>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">OPW Match Comparison</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-200">
                Comparing {selectedMatchIds.length} Matches (Max 5)
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Comprehensive side-by-side bonus, penalty, and base weight comparison across up to 5 matches under active OPW category rules.
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
          <button
            onClick={handleApplyRuntimeToAllCategories}
            className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            title="Commit tuned weights across ALL categories and ALL days to live runtime settings"
          >
            <Play size={13} className="fill-white" />
            <span>Apply Runtime to All Categories</span>
          </button>
          {onSwitchToAggregate && (
            <button
              onClick={onSwitchToAggregate}
              className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-gray-200 shadow-xs"
              title="Switch to Aggregate Trigger Performance Breakdown"
            >
              <Layers size={14} />
              <span>Aggregate Rules</span>
            </button>
          )}
          <button
            onClick={() => setIsCompactColumns(prev => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors border shadow-xs ${
              isCompactColumns 
                ? 'bg-purple-600 text-white border-purple-700' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
            }`}
            title="Toggle compact table column widths to fit all matches on screen"
          >
            {isCompactColumns ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            <span>{isCompactColumns ? 'Comfort View' : 'Minimize Columns'}</span>
          </button>
          <button
            onClick={handleCopyComparison}
            disabled={selectedMatches.filter(Boolean).length < 2}
            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-gray-200 shadow-xs disabled:opacity-50"
            title="Copy Comparison Diff"
          >
            <Copy size={14} />
            <span className="hidden md:inline">Copy Diff</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={selectedMatches.filter(Boolean).length < 2}
            className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-purple-200 shadow-xs disabled:opacity-50"
            title="Export CSV"
          >
            <Download size={14} />
            <span className="hidden md:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {copiedNotification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-2 rounded-lg font-medium flex items-center gap-2 animate-fade-in shadow-xs">
          <CheckCircle2 size={16} className="text-emerald-600" />
          {copiedNotification}
        </div>
      )}

      {/* Category Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 sm:p-3 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2 flex items-center gap-1">
            <SlidersHorizontal size={13} />
            OPW Category:
          </span>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-600'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Match Selectors Bar (2 to 5 matches) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3" ref={selectorsContainerRef}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
              Select Matches to Compare ({selectedMatchIds.length}/5):
            </span>
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5 border border-gray-200 text-xs">
              <button
                onClick={() => setDatasetScope('live')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors ${datasetScope === 'live' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Live ({matches.length})
              </button>
              <button
                onClick={() => setDatasetScope('history')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors ${datasetScope === 'history' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
              >
                History ({allMatches.length})
              </button>
              <button
                onClick={() => setDatasetScope('all')}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors ${datasetScope === 'all' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Combined ({availableMatches.length})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedMatchIds.length === 2 && (
              <button
                onClick={handleSwapFirstTwo}
                className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center gap-1.5 border border-gray-200 transition-colors shadow-xs"
                title="Swap Match A and Match B"
              >
                <ArrowLeftRight size={13} />
                <span>Swap A ⇄ B</span>
              </button>
            )}

            {selectedMatchIds.length < 5 && (
              <button
                onClick={handleAddMatch}
                className="px-3 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold flex items-center gap-1.5 border border-purple-200 transition-colors shadow-xs"
                title="Add another match slot to compare (up to 5 matches)"
              >
                <Plus size={14} />
                <span>Add Match ({selectedMatchIds.length + 1}/5)</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Match Selectors Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${
          selectedMatchIds.length === 3 ? 'lg:grid-cols-3' : 
          selectedMatchIds.length === 4 ? 'lg:grid-cols-2 xl:grid-cols-4' : 
          selectedMatchIds.length === 5 ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-2'
        } gap-3`}>
          {selectedMatchIds.map((matchId, index) => {
            const slot = SLOT_CONFIGS[index] || SLOT_CONFIGS[0];
            const currentMatch = selectedMatches[index];
            const searchVal = searchQueries[index] || '';
            const isDropdownOpen = openDropdownSlot === index;
            const searchResults = getSearchResults(searchVal);

            return (
              <div key={index} className={`relative p-2.5 rounded-xl border ${slot.borderColor} ${slot.bgTint}`}>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1 ${slot.textColor}`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white ${
                      slot.colorName === 'emerald' ? 'bg-emerald-600' :
                      slot.colorName === 'blue' ? 'bg-blue-600' :
                      slot.colorName === 'purple' ? 'bg-purple-600' :
                      slot.colorName === 'amber' ? 'bg-amber-600' : 'bg-rose-600'
                    }`}>
                      {slot.letter}
                    </span>
                    {slot.name}
                  </span>

                  {selectedMatchIds.length > 2 && (
                    <button
                      onClick={() => handleRemoveMatch(index)}
                      className="text-gray-400 hover:text-rose-600 p-0.5 rounded transition-colors"
                      title={`Remove ${slot.name}`}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder={currentMatch ? currentMatch.teams : `Search ${slot.name}...`}
                    value={searchVal}
                    onFocus={() => setOpenDropdownSlot(index)}
                    onChange={e => {
                      const val = e.target.value;
                      setSearchQueries(prev => {
                        const next = [...prev];
                        next[index] = val;
                        return next;
                      });
                      setOpenDropdownSlot(index);
                    }}
                    className={`w-full pl-8 pr-7 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 ${slot.ringFocus}`}
                  />
                  <Search size={14} className={`absolute left-2.5 top-2 ${slot.textColor}`} />
                  {searchVal && (
                    <button
                      onClick={() => setSearchQueries(prev => {
                        const next = [...prev];
                        next[index] = '';
                        return next;
                      })}
                      className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Dropdown Menu for this slot */}
                {isDropdownOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-xl p-1 text-xs">
                    {searchResults.length === 0 ? (
                      <div className="p-3 text-center text-gray-400">No matching matches found</div>
                    ) : (
                      searchResults.map(m => {
                        const actualRes = getActualResult(m.result || '');
                        const isSelected = String(m.id) === String(matchId);
                        return (
                          <button
                            key={m.id}
                            onClick={() => handleSelectMatch(index, m.id)}
                            className={`w-full text-left p-2 rounded-lg flex items-center justify-between hover:bg-gray-50 transition-colors ${isSelected ? `${slot.bgLight} font-black ${slot.textDark}` : 'text-gray-800'}`}
                          >
                            <div className="truncate pr-2">
                              <div className="font-bold text-xs text-gray-900 truncate">{m.teams}</div>
                              <div className="text-[10px] text-gray-500 truncate">
                                {m.league || 'League'} • {m.date} {m.time ? `• ${m.time}` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {actualRes ? (
                                <span className="px-1 py-0.2 rounded bg-gray-200 text-gray-800 font-bold text-[9px]">
                                  FT: {actualRes}
                                </span>
                              ) : (
                                <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[9px]">
                                  Live
                                </span>
                              )}
                              {isSelected && <Check size={13} className={slot.textColor} />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side Hero Match Cards (Up to 5 matches responsive grid) */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${
        selectedMatchIds.length === 3 ? 'lg:grid-cols-3' : 
        selectedMatchIds.length === 4 ? 'lg:grid-cols-2 xl:grid-cols-4' : 
        selectedMatchIds.length === 5 ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-2'
      } gap-4`}>
        {selectedMatchIds.map((_, idx) => {
          const slot = SLOT_CONFIGS[idx] || SLOT_CONFIGS[0];
          const m = hydratedMatches[idx];
          const detail = matchDetails[idx];
          const stats = matchStats[idx];
          const isLead = topMatch?.index === idx;
          return renderMatchCard(m, detail, stats, slot, idx, isLead, leaderLeadPts);
        })}
      </div>

      {/* Multi-Match Conviction Leaderboard Card */}
      {matchDetails.filter(Boolean).length >= 2 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                <Trophy size={18} />
              </span>
              <div>
                <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 flex-wrap">
                  <span>Conviction Leaderboard:</span>
                  <span className="text-purple-700">
                    {topMatch?.match?.teams || 'Top Match'} Leads with {topMatch?.score.toFixed(1)} pts
                  </span>
                  {leaderLeadPts > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black border border-emerald-300">
                      +{leaderLeadPts.toFixed(1)} pts lead
                    </span>
                  )}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ranked by Net OPW Points under <strong>{CATEGORIES.find(c => c.id === activeCategory)?.label}</strong>.
                </p>
              </div>
            </div>

            {/* Standings Pills */}
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              {rankedMatches.map((item, rIdx) => {
                const isWinner = rIdx === 0;
                return (
                  <div 
                    key={item.index}
                    className={`px-2.5 py-1 rounded-lg border font-bold flex items-center gap-1.5 ${
                      isWinner 
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs' 
                        : 'bg-gray-50 text-gray-700 border-gray-200'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black text-white ${
                      item.slot.colorName === 'emerald' ? 'bg-emerald-600' :
                      item.slot.colorName === 'blue' ? 'bg-blue-600' :
                      item.slot.colorName === 'purple' ? 'bg-purple-600' :
                      item.slot.colorName === 'amber' ? 'bg-amber-600' : 'bg-rose-600'
                    }`}>
                      {item.slot.letter}
                    </span>
                    <span className="truncate max-w-[90px] sm:max-w-[120px]">{item.match?.teams ? item.match.teams.split(' vs ')[0] : item.slot.name}</span>
                    <span className="font-black text-purple-700">{item.score.toFixed(1)} pts</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Triggers Comparison Matrix Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Table Filter Controls */}
        <div className="p-3 sm:p-4 border-b border-gray-200 space-y-3 bg-gray-50/50">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1 shrink-0">
                Filter:
              </span>
              <button
                onClick={() => setFilterMode('all_triggered')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  filterMode === 'all_triggered' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                All Triggered ({counts.allTriggered})
              </button>
              <button
                onClick={() => setFilterMode('all_matches')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  filterMode === 'all_matches' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                All {selectedMatchIds.length} Matches Hit ({counts.allMatches})
              </button>
              <button
                onClick={() => setFilterMode('differences')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  filterMode === 'differences' ? 'bg-purple-600 text-white shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                Differences Only ({counts.differences})
              </button>
              {selectedMatchIds.length === 2 && (
                <>
                  <button
                    onClick={() => setFilterMode('only_a')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                      filterMode === 'only_a' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                    }`}
                  >
                    Only Match A ({counts.onlyA})
                  </button>
                  <button
                    onClick={() => setFilterMode('only_b')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                      filterMode === 'only_b' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-blue-800 hover:bg-blue-50 border border-blue-200'
                    }`}
                  >
                    Only Match B ({counts.onlyB})
                  </button>
                </>
              )}
              <button
                onClick={() => setFilterMode('bonus')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  filterMode === 'bonus' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                }`}
              >
                Bonuses (+) ({counts.bonus})
              </button>
              <button
                onClick={() => setFilterMode('penalty')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  filterMode === 'penalty' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-rose-800 hover:bg-rose-50 border border-rose-200'
                }`}
              >
                Penalties (-) ({counts.penalty})
              </button>
              <button
                onClick={() => setFilterMode('neutral')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  filterMode === 'neutral' ? 'bg-gray-700 text-white shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                Neutral (0 pts) ({counts.neutral})
              </button>
              <button
                onClick={() => setFilterMode('all_rules')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  filterMode === 'all_rules' ? 'bg-gray-800 text-white shadow-xs' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                All Category Rules ({counts.totalRules})
              </button>
            </div>

            {/* Search inside rules */}
            <div className="relative sm:w-64 shrink-0">
              <input
                type="text"
                placeholder="Search rule keywords..."
                value={ruleSearch}
                onChange={e => setRuleSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              {ruleSearch && (
                <button
                  onClick={() => setRuleSearch('')}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Table Content with Sticky Left Description and Smooth Horizontal Scroll */}
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-black tracking-wider text-[11px]">
              <tr>
                {/* Sticky Left Column: Rule Description */}
                <th className={`py-3 px-3.5 sticky left-0 bg-gray-50 z-20 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] ${
                  isCompactColumns ? 'w-[260px] min-w-[240px]' : 'w-[360px] min-w-[300px]'
                }`}>
                  Trigger / Condition Description
                </th>

                {/* Points Column */}
                <th className="py-3 px-2.5 text-center w-[65px] min-w-[60px] whitespace-nowrap">
                  Points
                </th>

                {/* Dynamic Columns for each match (2 to 5 matches) */}
                {selectedMatchIds.map((_, idx) => {
                  const slot = SLOT_CONFIGS[idx] || SLOT_CONFIGS[0];
                  const m = selectedMatches[idx];
                  const teamName = m ? m.teams.split(' vs ')[0] : slot.name;
                  return (
                    <th 
                      key={idx}
                      className={`py-3 ${isCompactColumns ? 'px-2 min-w-[90px]' : 'px-3 min-w-[130px]'} text-center ${slot.bgHeader} ${slot.textDark} border-r border-gray-200/80`}
                    >
                      <div className="flex items-center justify-center gap-1 truncate">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white ${
                          slot.colorName === 'emerald' ? 'bg-emerald-600' :
                          slot.colorName === 'blue' ? 'bg-blue-600' :
                          slot.colorName === 'purple' ? 'bg-purple-600' :
                          slot.colorName === 'amber' ? 'bg-amber-600' : 'bg-rose-600'
                        }`}>
                          {slot.letter}
                        </span>
                        <span className="truncate max-w-[110px]" title={m?.teams || slot.name}>
                          {teamName}
                        </span>
                      </div>
                    </th>
                  );
                })}

                {/* Multi-Match Trigger Distribution Column */}
                <th className={`py-3 px-3 text-center ${isCompactColumns ? 'w-[130px] min-w-[120px]' : 'w-[180px] min-w-[160px]'}`}>
                  Trigger Summary
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 font-medium">
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={selectedMatchIds.length + 3} className="py-12 text-center text-gray-400">
                    <Scale size={32} className="mx-auto mb-2 opacity-40" />
                    No rules found matching the current filter.
                  </td>
                </tr>
              ) : (
                displayRows.map((row, rowIdx) => {
                  const isBonus = row.rulePoints > 0;
                  const isPenalty = row.rulePoints < 0;

                  // Trigger distribution badge
                  let summaryBadge = null;
                  if (row.status === 'all') {
                    summaryBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                        ⚖️ All {selectedMatchIds.length} Hit ({row.rulePoints > 0 ? `+${row.rulePoints}` : row.rulePoints})
                      </span>
                    );
                  } else if (row.status === 'single' && row.singleHitIndex !== undefined) {
                    const slot = SLOT_CONFIGS[row.singleHitIndex] || SLOT_CONFIGS[0];
                    summaryBadge = (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${slot.badgeBg} ${slot.textDark} border ${slot.borderColor} shadow-xs`}>
                        Only {slot.name} ({row.rulePoints > 0 ? `+${row.rulePoints}` : row.rulePoints})
                      </span>
                    );
                  } else if (row.status === 'shared') {
                    // List letters that hit e.g. A, C, D
                    const hitLetters = row.hits.map((h, i) => h ? SLOT_CONFIGS[i]?.letter : null).filter(Boolean).join(', ');
                    summaryBadge = (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                        {row.hitCount} of {selectedMatchIds.length} ({hitLetters})
                      </span>
                    );
                  } else {
                    summaryBadge = <span className="text-gray-400 text-[10px]">None</span>;
                  }

                  return (
                    <tr 
                      key={rowIdx} 
                      className={`hover:bg-gray-50/80 transition-colors ${
                        row.status === 'single' && row.singleHitIndex !== undefined
                          ? `${SLOT_CONFIGS[row.singleHitIndex]?.bgTint || ''}`
                          : ''
                      }`}
                    >
                      {/* Sticky Left Description */}
                      <td className={`py-2.5 px-3.5 font-semibold text-gray-900 leading-snug sticky left-0 bg-white z-10 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]`}>
                        {row.description}
                      </td>

                      {/* Rule Base Points */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded font-black text-xs inline-block min-w-[38px] ${
                          isBonus 
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                            : isPenalty 
                            ? 'bg-rose-100 text-rose-900 border border-rose-300' 
                            : 'bg-gray-100 text-gray-600 border border-gray-200'
                        }`}>
                          {row.rulePoints > 0 ? `+${row.rulePoints}` : `${row.rulePoints}`}
                        </span>
                      </td>

                      {/* Match Slots (2 to 5 columns) */}
                      {selectedMatchIds.map((_, i) => {
                        const slot = SLOT_CONFIGS[i] || SLOT_CONFIGS[0];
                        const hit = row.hits[i];
                        const pts = row.points[i];
                        const ptsDisplay = pts > 0 ? `+${pts}` : pts;

                        return (
                          <td 
                            key={i} 
                            className={`py-2 ${isCompactColumns ? 'px-1.5' : 'px-2.5'} text-center ${slot.bgTint} border-r border-gray-100`}
                          >
                            {hit ? (
                              isCompactColumns ? (
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${slot.badgeBg} ${slot.textDark} font-black border ${slot.borderColor} text-[11px] whitespace-nowrap shadow-xs`}>
                                  <Check size={11} className={`${slot.textColor} stroke-[3]`} />
                                  <span>{ptsDisplay}</span>
                                </span>
                              ) : (
                                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ${slot.badgeBg} ${slot.textDark} font-black border ${slot.borderColor} shadow-xs text-xs whitespace-nowrap`}>
                                  <Check size={13} className={`${slot.textColor} stroke-[3]`} />
                                  <span>HIT ({ptsDisplay})</span>
                                </div>
                              )
                            ) : (
                              <span className="text-gray-300 font-bold text-xs">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Summary Breakdown */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {summaryBadge}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer: Reconciliation for all 2 to 5 matches */}
            {matchDetails.filter(Boolean).length >= 2 && (
              <tfoot className="bg-gray-100/95 border-t-2 border-gray-300 font-bold text-xs">
                {/* Total Bonuses Row */}
                <tr className="border-b border-gray-200">
                  <td className="py-2.5 px-3.5 text-gray-700 font-black sticky left-0 bg-gray-100 z-10 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Total Bonus Points
                  </td>
                  <td className="py-2.5 px-2 text-center text-gray-400 font-bold">—</td>
                  {selectedMatchIds.map((_, i) => (
                    <td key={i} className="py-2.5 px-2 text-center font-black text-emerald-800 bg-emerald-50/40 border-r border-gray-200 whitespace-nowrap">
                      +{matchStats[i].bonus} pts ({matchStats[i].bonusCount})
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-center text-[10px] font-bold text-emerald-700">
                    Highest: {Math.max(...matchStats.map(s => s.bonus))} pts
                  </td>
                </tr>

                {/* Total Penalties Row */}
                <tr className="border-b border-gray-200">
                  <td className="py-2.5 px-3.5 text-gray-700 font-black sticky left-0 bg-gray-100 z-10 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Total Penalty Points
                  </td>
                  <td className="py-2.5 px-2 text-center text-gray-400 font-bold">—</td>
                  {selectedMatchIds.map((_, i) => (
                    <td key={i} className="py-2.5 px-2 text-center font-black text-rose-800 bg-rose-50/40 border-r border-gray-200 whitespace-nowrap">
                      {matchStats[i].penalty} pts ({matchStats[i].penaltyCount})
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-center text-[10px] font-bold text-rose-700">
                    Fewest: {Math.max(...matchStats.map(s => s.penalty))} pts
                  </td>
                </tr>

                {/* Net Rules Adjustment Row */}
                <tr className="border-b border-gray-200 bg-gray-50">
                  <td className="py-2.5 px-3.5 text-gray-800 font-black sticky left-0 bg-gray-50 z-10 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                    Net Rules Adjustment (Bonuses + Penalties)
                  </td>
                  <td className="py-2.5 px-2 text-center text-gray-400 font-bold">—</td>
                  {selectedMatchIds.map((_, i) => {
                    const net = matchStats[i].netAdjustment;
                    return (
                      <td key={i} className={`py-2.5 px-2 text-center font-black border-r border-gray-200 whitespace-nowrap ${net >= 0 ? 'text-emerald-900 bg-emerald-50/30' : 'text-rose-900 bg-rose-50/30'}`}>
                        {net > 0 ? `+${net}` : net} pts
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 text-center text-[10px] font-black text-purple-700">
                    Highest Net: +{Math.max(...matchStats.map(s => s.netAdjustment))} pts
                  </td>
                </tr>

                {/* Base Weight Row */}
                <tr className="border-b-2 border-gray-300">
                  <td className="py-2.5 px-3.5 text-gray-800 font-black sticky left-0 bg-gray-100 z-10 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                    Base Weight (Starting Points)
                  </td>
                  <td className="py-2.5 px-2 text-center text-gray-400 font-bold">—</td>
                  {selectedMatchIds.map((_, i) => (
                    <td key={i} className="py-2.5 px-2 text-center font-black text-gray-900 border-r border-gray-200 whitespace-nowrap">
                      +{matchDetails[i]?.baseInfo.points ?? 0} pts
                    </td>
                  ))}
                  <td className="py-2.5 px-3 text-center text-[10px] font-black text-gray-700">
                    Max Base: +{Math.max(...matchDetails.map(d => d?.baseInfo.points ?? 0))} pts
                  </td>
                </tr>

                {/* GRAND TOTAL ROW */}
                <tr className="bg-gray-900 text-white text-sm">
                  <td className="py-3.5 px-3.5 font-black uppercase tracking-wider text-amber-300 sticky left-0 bg-gray-900 z-10 border-r border-gray-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.2)] flex items-center gap-2">
                    <Sparkles size={16} className="text-amber-400 shrink-0" />
                    <span>TOTAL POINTS PER MATCH (NET OPW)</span>
                  </td>
                  <td className="py-3.5 px-2 text-center text-gray-400 text-xs font-bold">—</td>
                  {selectedMatchIds.map((_, i) => {
                    const slot = SLOT_CONFIGS[i] || SLOT_CONFIGS[0];
                    const score = matchDetails[i]?.totalScore ?? 0;
                    const isWinner = topMatch?.index === i;

                    return (
                      <td 
                        key={i} 
                        className={`py-3.5 px-2 text-center font-black text-base border-r border-gray-800 whitespace-nowrap ${
                          isWinner ? 'text-amber-300 bg-gray-800/90' : 'text-white'
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <span>{score.toFixed(1)} pts</span>
                          {isWinner && (
                            <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-400 text-gray-950 mt-0.5">
                              #1 Winner
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-3.5 px-3 text-center font-black text-xs text-amber-300 whitespace-nowrap">
                    {topMatch?.slot.name} Leads (+{leaderLeadPts.toFixed(1)} pts)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>
            Showing <strong>{displayRows.length}</strong> of <strong>{comparisonMatrix.length}</strong> rules across <strong>{selectedMatchIds.length}</strong> matches
          </span>
          <span className="text-gray-400 text-[11px]">
            Horizontal scrolling and compact columns enabled for seamless comparison.
          </span>
        </div>
      </div>

      {/* Bottom Summary: Total Points Per Match Reconciliation Grid */}
      {matchDetails.filter(Boolean).length >= 2 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Calculator size={18} className="text-purple-600" />
                Total Points Reconciliation & Summary ({selectedMatchIds.length} Matches)
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Complete mathematical breakdown of Base Weight and active Bonuses/Penalties for each selected match.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleApplyRuntimeToAllCategories}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                title="Commit tuned weights across ALL categories and ALL days to live runtime settings"
              >
                <Play size={13} className="fill-white" />
                <span>Apply Runtime to All Categories</span>
              </button>
              <span className="text-xs font-black px-3 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                {CATEGORIES.find(c => c.id === activeCategory)?.label || activeCategory}
              </span>
            </div>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 ${
            selectedMatchIds.length === 3 ? 'lg:grid-cols-3' : 
            selectedMatchIds.length === 4 ? 'lg:grid-cols-2 xl:grid-cols-4' : 
            selectedMatchIds.length === 5 ? 'lg:grid-cols-3 xl:grid-cols-5' : 'lg:grid-cols-2'
          } gap-4`}>
            {selectedMatchIds.map((_, i) => {
              const slot = SLOT_CONFIGS[i] || SLOT_CONFIGS[0];
              const m = selectedMatches[i];
              const detail = matchDetails[i];
              const stats = matchStats[i];
              const isWinner = topMatch?.index === i;
              if (!detail) return null;

              return (
                <div key={i} className={`p-4 rounded-xl border ${slot.borderColor} ${slot.bgTint} space-y-2.5 relative overflow-hidden`}>
                  {isWinner && (
                    <div className="absolute top-0 right-0 bg-amber-400 text-gray-950 font-black text-[10px] px-2 py-0.5 rounded-bl-lg uppercase tracking-wider">
                      #1 Highest OPW
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className={`w-6 h-6 rounded-md text-white font-black text-xs flex items-center justify-center shrink-0 ${
                        slot.colorName === 'emerald' ? 'bg-emerald-600' :
                        slot.colorName === 'blue' ? 'bg-blue-600' :
                        slot.colorName === 'purple' ? 'bg-purple-600' :
                        slot.colorName === 'amber' ? 'bg-amber-600' : 'bg-rose-600'
                      }`}>
                        {slot.letter}
                      </span>
                      <span className="text-sm font-black text-gray-900 truncate" title={m?.teams}>
                        {m?.teams || slot.name}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Base (PHA {detail.baseInfo.phaPercentage.toFixed(1)}%):</span>
                      <span className="font-bold text-gray-900">+{detail.baseInfo.points} pts</span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-700">
                      <span>Active Bonuses ({stats.bonusCount}):</span>
                      <span className="font-black">+{stats.bonus} pts</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-700">
                      <span>Active Penalties ({stats.penaltyCount}):</span>
                      <span className="font-black">{stats.penalty} pts</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-500">
                      <span>Neutral ({stats.neutralCount}):</span>
                      <span className="font-semibold">0 pts</span>
                    </div>
                  </div>

                  <div className={`pt-2 border-t ${slot.borderColor} flex justify-between items-center`}>
                    <span className="text-xs font-black uppercase text-gray-700 tracking-wider">Total OPW:</span>
                    <span className={`text-lg font-black px-2.5 py-0.5 rounded-lg border shadow-xs ${slot.badgeBg} ${slot.textDark} ${slot.borderColor}`}>
                      {detail.totalScore.toFixed(1)} pts
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Leaderboard Summary Banner */}
          <div className="bg-gray-900 rounded-xl p-3.5 text-white flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 font-semibold">
              <Trophy size={18} className="text-amber-400 shrink-0" />
              <span>
                <strong className="text-amber-300">{topMatch?.match?.teams || topMatch?.slot.name}</strong> has the highest conviction rating with <strong className="text-amber-300 font-black">{topMatch?.score.toFixed(1)} points</strong>.
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-gray-300 font-medium flex-wrap">
              <span>Standings:</span>
              {rankedMatches.map((item, idx) => (
                <span key={item.index} className="inline-flex items-center gap-1 bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                  <strong className="text-amber-400">#{idx + 1}</strong> {item.slot.letter}: {item.score.toFixed(1)} pts
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OPWMatchComparison;
