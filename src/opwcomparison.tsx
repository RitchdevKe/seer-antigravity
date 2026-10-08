import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  TrendingUp, 
  SlidersHorizontal, 
  CheckCircle2, 
  Database, 
  Copy, 
  Download, 
  ChevronUp, 
  ChevronDown, 
  Layers,
  Sparkles,
  HelpCircle,
  Scale,
  Calendar
} from 'lucide-react';
import { Match } from './types';
import { getActualResult } from './utils/matchProcessing';
import { 
  getMarketFavorite, 
  getOptimizedScoreDetailed, 
  OPTIMIZED_CATEGORY_SETTINGS, 
  CODE_DEFAULT_CATEGORY_SETTINGS,
  DayOfWeek,
  DAY_METADATA,
  getMatchDayOfWeek,
  DAILY_OPTIMIZED_SETTINGS,
  DAILY_DEFAULT_CATEGORY_SETTINGS
} from './utils/optimizedweights';
import { getMatchEvaluatorTags } from './utils/matchEvaluator';
import OPWMatchComparison from './components/opw/OPWMatchComparison';

export interface OPWComparisonProps {
  matches: Match[];
  allMatches?: Match[];
  phaStatsMap: Record<string, any>;
  matchStars?: Record<string, number>;
  liveViewType?: 'daily' | 'jackpot';
  initialCategory?: string;
  initialMode?: 'aggregate' | 'match_compare';
  onBack: () => void;
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
  { id: 'value_picks', label: 'Value Picks', tagPrefix: 'value_picks:', description: 'Value picks evaluated using Banker Jackpots OPW rules.' },
  { id: 'botb_best', label: 'BOTB', tagPrefix: 'botb_best:', description: 'Premium tier selections with zero risk flags.' }
];

type SortField = 'description' | 'points' | 'mfav' | 'draw' | 'underdog';
type SortDirection = 'asc' | 'desc';

interface RuleStatRow {
  description: string;
  points: number;
  mfavHits: number;
  drawHits: number;
  underdogHits: number;
  mfavPct: number;
  drawPct: number;
  underdogPct: number;
  totalHits: number;
}

const getNormalizedCategory = (cat?: string): string => {
  if (!cat || cat === 'all') return 'top_12_value';
  if (cat === 'top12' || cat === 'top_12_value' || cat === 'top10' || cat === 'top_10_value') return 'top_12_value';
  if (CATEGORIES.some(c => c.id === cat)) return cat;
  return 'top_12_value';
};

export const OPWComparison: React.FC<OPWComparisonProps> = ({
  matches = [],
  allMatches = [],
  phaStatsMap = {},
  matchStars = {},
  liveViewType = 'daily',
  initialCategory,
  initialMode = 'aggregate',
  onBack
}) => {
  const [comparisonMode, setComparisonMode] = useState<'aggregate' | 'match_compare'>(initialMode || 'aggregate');
  const [activeCategory, setActiveCategory] = useState<string>(() => getNormalizedCategory(initialCategory));
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>('all');
  const [datasetScope, setDatasetScope] = useState<'live' | 'history' | 'all'>('live');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pointFilter, setPointFilter] = useState<'all' | 'bonus' | 'penalty' | 'zero'>('all');
  const [sortField, setSortField] = useState<SortField>('points');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  useEffect(() => {
    if (initialMode) {
      setComparisonMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (initialCategory && initialCategory !== 'all') {
      setActiveCategory(getNormalizedCategory(initialCategory));
    }
  }, [initialCategory]);

  const activeCategoryConfig = useMemo(() => {
    return CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0];
  }, [activeCategory]);

  // Combine or select active dataset based on user preference and optional day filter
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

  // Strictly filter matches belonging to active category (e.g. top12:, top10:, best_bet:, etc.)
  const categoryMatches = useMemo(() => {
    const prefix = activeCategoryConfig.tagPrefix;
    if (!prefix) return rawDataset;
    const isTop12Cat = activeCategoryConfig.id === 'top_12_value' || activeCategoryConfig.id === 'top_10_value' || prefix === 'top12:' || prefix === 'top10:';
    return rawDataset.filter(m => {
      const tags = m.evaluatorTags && m.evaluatorTags.length > 0 
        ? m.evaluatorTags 
        : getMatchEvaluatorTags(m, phaStatsMap, liveViewType === 'jackpot', true, matchStars);
      if (isTop12Cat) {
        return tags.some(t => t.startsWith('top12:') || t.startsWith('top10:'));
      }
      return tags.some(t => t.startsWith(prefix));
    });
  }, [rawDataset, activeCategoryConfig, phaStatsMap, liveViewType, matchStars]);

  // Separate category matches into completed results and pending
  const { completedCategoryMatches, pendingCategoryMatches } = useMemo(() => {
    const completed: Match[] = [];
    const pending: Match[] = [];
    categoryMatches.forEach(m => {
      const actual = getActualResult(m.result || '');
      if (actual === '1' || actual === 'X' || actual === '2') {
        completed.push(m);
      } else {
        pending.push(m);
      }
    });
    return { completedCategoryMatches: completed, pendingCategoryMatches: pending };
  }, [categoryMatches]);

  // Compute OPW Trigger statistics across Mfav, Draw, and Underdog outcomes
  const { rows, totals } = useMemo(() => {
    let totalMfav = 0;
    let totalDraw = 0;
    let totalUnderdog = 0;

    // Map rule description -> { points, mfavHits, drawHits, underdogHits }
    const ruleMap = new Map<string, { points: number; mfavHits: number; drawHits: number; underdogHits: number }>();

    // Seed ruleMap with all configured rules for the active category and day
    const evalCat = activeCategory;
    if (selectedDay !== 'all') {
      const catSettings = DAILY_OPTIMIZED_SETTINGS[selectedDay]?.[evalCat] || DAILY_DEFAULT_CATEGORY_SETTINGS[selectedDay]?.[evalCat] || OPTIMIZED_CATEGORY_SETTINGS[evalCat];
      if (catSettings && catSettings.rules) {
        catSettings.rules.forEach(r => {
          ruleMap.set(r.description, { points: r.points, mfavHits: 0, drawHits: 0, underdogHits: 0 });
        });
      }
    } else {
      // When All Days is selected, collect all unique triggers across all days for this category
      const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      days.forEach(d => {
        const catSettings = DAILY_OPTIMIZED_SETTINGS[d]?.[evalCat] || DAILY_DEFAULT_CATEGORY_SETTINGS[d]?.[evalCat];
        if (catSettings && catSettings.rules) {
          catSettings.rules.forEach(r => {
            if (!ruleMap.has(r.description)) {
              ruleMap.set(r.description, { points: r.points, mfavHits: 0, drawHits: 0, underdogHits: 0 });
            }
          });
        }
      });
    }

    // Process each completed match in this category
    completedCategoryMatches.forEach(match => {
      const actual = getActualResult(match.result || '');
      if (actual !== '1' && actual !== 'X' && actual !== '2') return;

      // Data integrity: Ensure valid market odds exist to prevent hallucinated market favorites
      const moParts = (match.mo || '').split(/[- ,]+/).map(s => parseFloat(s.trim())).filter(p => !isNaN(p));
      const homeOdds = moParts[0] || 0;
      const awayOdds = moParts[2] || 0;
      if (homeOdds <= 0 || awayOdds <= 0) return;

      const mFav = getMarketFavorite(match);
      const underdog = mFav === '1' ? '2' : '1';

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

      // Calculate OPW score and determine all triggered rules using the match's day or selected day
      let detail;
      try {
        const matchDay = selectedDay !== 'all' ? selectedDay : getMatchDayOfWeek(match);
        detail = getOptimizedScoreDetailed(match, evalCat, phaStatsMap, matchDay);
      } catch (e) {
        console.error('Error calculating OPW detailed score:', e);
        return;
      }

      if (detail && detail.rulesHit && detail.rulesHit.length > 0) {
        // Track unique rules hit for this match to avoid double counting on duplicate rules
        const matchHitDescriptions = new Set<string>();

        detail.rulesHit.forEach(hit => {
          if (matchHitDescriptions.has(hit.description)) return;
          matchHitDescriptions.add(hit.description);

          let entry = ruleMap.get(hit.description);
          if (!entry) {
            entry = { points: hit.points, mfavHits: 0, drawHits: 0, underdogHits: 0 };
            ruleMap.set(hit.description, entry);
          }

          if (outcome === 'mfav') {
            entry.mfavHits++;
          } else if (outcome === 'draw') {
            entry.drawHits++;
          } else if (outcome === 'underdog') {
            entry.underdogHits++;
          }
        });
      }
    });

    const totalCompleted = totalMfav + totalDraw + totalUnderdog;

    // Convert ruleMap into an array of RuleStatRow evaluated strictly on triggered matches (totalHits)
    const computedRows: RuleStatRow[] = Array.from(ruleMap.entries()).map(([description, data]) => {
      const totalHits = data.mfavHits + data.drawHits + data.underdogHits;
      const mfavPct = totalHits > 0 ? (data.mfavHits / totalHits) * 100 : 0;
      const drawPct = totalHits > 0 ? (data.drawHits / totalHits) * 100 : 0;
      const underdogPct = totalHits > 0 ? (data.underdogHits / totalHits) * 100 : 0;

      return {
        description,
        points: data.points,
        mfavHits: data.mfavHits,
        drawHits: data.drawHits,
        underdogHits: data.underdogHits,
        mfavPct,
        drawPct,
        underdogPct,
        totalHits
      };
    });

    return {
      rows: computedRows,
      totals: {
        totalMfav,
        totalDraw,
        totalUnderdog,
        totalCompleted,
        totalMatches: categoryMatches.length,
        totalPending: pendingCategoryMatches.length
      }
    };
  }, [completedCategoryMatches, pendingCategoryMatches, categoryMatches, activeCategory, phaStatsMap, selectedDay]);

  // Filter rows based on search query and points filter
  const filteredRows = useMemo(() => {
    let result = rows;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(r => r.description.toLowerCase().includes(query));
    }

    if (pointFilter === 'bonus') {
      result = result.filter(r => r.points > 0);
    } else if (pointFilter === 'penalty') {
      result = result.filter(r => r.points < 0);
    } else if (pointFilter === 'zero') {
      result = result.filter(r => r.points === 0);
    }

    // Sort rows
    return [...result].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'description') {
        comparison = a.description.localeCompare(b.description);
      } else if (sortField === 'points') {
        comparison = a.points - b.points;
      } else if (sortField === 'mfav') {
        comparison = a.mfavPct - b.mfavPct || a.mfavHits - b.mfavHits;
      } else if (sortField === 'draw') {
        comparison = a.drawPct - b.drawPct || a.drawHits - b.drawHits;
      } else if (sortField === 'underdog') {
        comparison = a.underdogPct - b.underdogPct || a.underdogHits - b.underdogHits;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rows, searchQuery, pointFilter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'description' ? 'asc' : 'desc');
    }
  };

  const handleCopyTable = useCallback(() => {
    const header = `Trigger\tPoints\tTotal Triggered\tMfav Win Rate\tDraw Rate\tUnderdog Rate`;
    const body = filteredRows.map(r => {
      const pts = r.points > 0 ? `+${r.points}` : `${r.points}`;
      const mfavStr = `${r.mfavHits}/${r.totalHits} (${r.mfavPct.toFixed(1)}%)`;
      const drawStr = `${r.drawHits}/${r.totalHits} (${r.drawPct.toFixed(1)}%)`;
      const udStr = `${r.underdogHits}/${r.totalHits} (${r.underdogPct.toFixed(1)}%)`;
      return `${r.description}\t${pts}\t${r.totalHits}\t${mfavStr}\t${drawStr}\t${udStr}`;
    }).join('\n');

    navigator.clipboard.writeText(`${header}\n${body}`);
    setCopiedNotification('Table copied to clipboard!');
    setTimeout(() => setCopiedNotification(null), 2500);
  }, [filteredRows]);

  const handleExportCSV = useCallback(() => {
    const csvHeader = 'Trigger,Points,Total Hits,Mfav Hits,Mfav Pct,Draw Hits,Draw Pct,Underdog Hits,Underdog Pct';
    const csvRows = filteredRows.map(r => {
      const desc = `"${r.description.replace(/"/g, '""')}"`;
      const pts = r.points > 0 ? `+${r.points}` : `${r.points}`;
      return `${desc},${pts},${r.totalHits},${r.mfavHits},${r.mfavPct.toFixed(1)}%,${r.drawHits},${r.drawPct.toFixed(1)}%,${r.underdogHits},${r.underdogPct.toFixed(1)}%`;
    });

    const blob = new Blob([`${csvHeader}\n${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `OPW_Comp_${activeCategoryConfig.label.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredRows, activeCategoryConfig]);

  const formatRatioPct = (hits: number, total: number, pct: number, type: 'mfav' | 'draw' | 'underdog') => {
    if (total === 0) {
      return (
        <div className="inline-flex items-center gap-1.5 font-mono text-xs text-gray-400">
          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 font-semibold border border-gray-200">
            0/0
          </span>
          <span className="text-gray-400 font-semibold">0.0%</span>
        </div>
      );
    }

    let badgeColor = '';
    let pctColor = '';

    if (hits === 0) {
      badgeColor = 'bg-gray-100 text-gray-500 font-bold border border-gray-200';
      pctColor = 'text-gray-400 font-semibold';
    } else if (type === 'mfav') {
      badgeColor = 'bg-emerald-100 text-emerald-950 font-black border border-emerald-300 shadow-xs';
      pctColor = 'text-emerald-700 font-black';
    } else if (type === 'draw') {
      badgeColor = 'bg-amber-100 text-amber-950 font-black border border-amber-300 shadow-xs';
      pctColor = 'text-amber-700 font-black';
    } else {
      badgeColor = 'bg-purple-100 text-purple-950 font-black border border-purple-300 shadow-xs';
      pctColor = 'text-purple-700 font-black';
    }

    return (
      <div className="inline-flex items-center gap-1.5 font-mono text-xs">
        <span className={`px-2 py-0.5 rounded-md ${badgeColor}`}>
          {hits}/{total}
        </span>
        <span className="text-gray-400 font-bold">=</span>
        <span className={`${pctColor}`}>
          {pct.toFixed(1)}%
        </span>
      </div>
    );
  };

  if (comparisonMode === 'match_compare') {
    return (
      <div className="w-full max-w-[1400px] mx-auto p-3 sm:p-5 space-y-4">
        {/* Top Header Mode Toggle */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-xs self-start sm:self-auto"
            title="Back to Live Analysis"
          >
            <ArrowLeft size={16} />
            <span>Back to Live</span>
          </button>
          <div className="inline-flex rounded-lg bg-gray-100 p-1 border border-gray-200 text-xs w-full sm:w-auto">
            <button
              onClick={() => setComparisonMode('aggregate')}
              className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-md font-bold text-gray-600 hover:text-gray-900 transition-colors flex items-center justify-center gap-1.5"
            >
              <Layers size={14} />
              <span>Rule Performance Breakdown</span>
            </button>
            <button
              onClick={() => setComparisonMode('match_compare')}
              className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-md font-bold bg-white text-purple-700 shadow-xs flex items-center justify-center gap-1.5"
            >
              <Scale size={14} />
              <span>Match vs Match Comparison</span>
            </button>
          </div>
        </div>

        <OPWMatchComparison
          matches={matches}
          allMatches={allMatches}
          phaStatsMap={phaStatsMap}
          matchStars={matchStars}
          liveViewType={liveViewType}
          initialCategory={activeCategory}
          onSwitchToAggregate={() => setComparisonMode('aggregate')}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto p-3 sm:p-5 space-y-4">
      {/* Top Header Mode Toggle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-xs self-start sm:self-auto"
          title="Back to Live Analysis"
        >
          <ArrowLeft size={16} />
          <span>Back to Live</span>
        </button>
        <div className="inline-flex rounded-lg bg-gray-100 p-1 border border-gray-200 text-xs w-full sm:w-auto">
          <button
            onClick={() => setComparisonMode('aggregate')}
            className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-md font-bold bg-white text-purple-700 shadow-xs flex items-center justify-center gap-1.5"
          >
            <Layers size={14} />
            <span>Rule Performance Breakdown</span>
          </button>
          <button
            onClick={() => setComparisonMode('match_compare')}
            className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-md font-bold text-gray-600 hover:text-gray-900 transition-colors flex items-center justify-center gap-1.5"
          >
            <Scale size={14} />
            <span>Match vs Match Comparison</span>
          </button>
        </div>
      </div>

      {/* Top Header & Breadcrumb */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1.5 text-sm font-semibold shadow-xs"
            title="Back to Live Analysis"
          >
            <ArrowLeft size={18} />
            <span className="hidden sm:inline">Back to Live</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-purple-100 text-purple-700">
                <SlidersHorizontal size={18} />
              </span>
              <h1 className="text-xl font-black text-gray-900 tracking-tight">OPW Comparison Analysis</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold border border-purple-200">
                OPW-Comp
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Analyze how bonuses and penalties triggered across finished matches ending in Mfav, Draw, and Underdog wins.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={handleCopyTable}
            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-gray-200 shadow-xs"
            title="Copy Table to Clipboard"
          >
            <Copy size={14} />
            <span className="hidden md:inline">Copy Table</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold flex items-center gap-1.5 transition-colors border border-purple-200 shadow-xs"
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

      {/* Day of Week Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 min-w-max text-xs">
          <span className="font-bold text-gray-500 px-2 flex items-center gap-1">
            <Calendar size={13} />
            Day:
          </span>
          <button
            onClick={() => setSelectedDay('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              selectedDay === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            All Days
          </button>
          {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as DayOfWeek[]).map(d => {
            const meta = DAY_METADATA[d];
            const isSelected = selectedDay === d;
            return (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <span>{meta.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  meta.volatilityTier === 'volatile'
                    ? (isSelected ? 'bg-red-400 text-red-950 font-black' : 'bg-red-100 text-red-700')
                    : meta.volatilityTier === 'safest'
                    ? (isSelected ? 'bg-emerald-300 text-emerald-950 font-black' : 'bg-emerald-100 text-emerald-700')
                    : (isSelected ? 'bg-blue-300 text-blue-950 font-black' : 'bg-blue-100 text-blue-700')
                }`}>
                  {meta.volatilityLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 overflow-x-auto no-scrollbar">
        <div className="flex gap-1.5 min-w-max">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all flex items-center gap-2 ${
                activeCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-100'
              }`}
            >
              <Sparkles size={12} className={activeCategory === cat.id ? 'text-purple-200' : 'text-gray-400'} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dataset Scope Controls + Outcome Stat Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Controls Card */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-3.5 space-y-2 flex flex-col justify-between">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
              Data Source
            </label>
            <div className="grid grid-cols-1 gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setDatasetScope('live')}
                className={`py-1 text-[11px] font-bold rounded-md transition-all ${
                  datasetScope === 'live' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Live Analysis ({matches.length})
              </button>
              <button
                onClick={() => setDatasetScope('history')}
                className={`py-1 text-[11px] font-bold rounded-md transition-all ${
                  datasetScope === 'history' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Historical Universe ({allMatches.length})
              </button>
              <button
                onClick={() => setDatasetScope('all')}
                className={`py-1 text-[11px] font-bold rounded-md transition-all ${
                  datasetScope === 'all' ? 'bg-white text-purple-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Combined
              </button>
            </div>
          </div>
          <div className="text-[10px] text-gray-400 font-medium">
            Category: <span className="font-bold text-purple-700">{activeCategoryConfig.label}</span>
          </div>
        </div>

        {/* Outcome Summary Cards */}
        <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Total Category Matches */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3.5 flex flex-col justify-between">
            <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">
              {activeCategoryConfig.label}
            </div>
            <div className="mt-1">
              <span className="text-2xl font-black text-gray-900">{categoryMatches.length}</span>
              <span className="text-xs text-gray-500 font-bold ml-1.5">matches</span>
            </div>
            <div className="text-[11px] text-gray-600 font-semibold mt-0.5">
              {totals.totalCompleted} finished{pendingCategoryMatches.length > 0 ? ` · ${pendingCategoryMatches.length} pending` : ''}
            </div>
          </div>

          {/* Mfav Wins */}
          <div className="bg-gradient-to-br from-emerald-50/80 to-white rounded-xl shadow-sm border border-emerald-200 p-3.5 flex flex-col justify-between">
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
              <span>Mfav Wins</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs"></span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-700">{totals.totalMfav}</span>
              <span className="text-xs text-emerald-600 font-bold font-mono">/ {totals.totalCompleted}</span>
            </div>
            <div className="text-[10px] text-emerald-700 font-bold mt-0.5">
              {totals.totalCompleted > 0 ? ((totals.totalMfav / totals.totalCompleted) * 100).toFixed(1) : '0.0'}% of finished
            </div>
          </div>

          {/* Draws */}
          <div className="bg-gradient-to-br from-amber-50/80 to-white rounded-xl shadow-sm border border-amber-200 p-3.5 flex flex-col justify-between">
            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center justify-between">
              <span>Draws (X)</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs"></span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-700">{totals.totalDraw}</span>
              <span className="text-xs text-amber-600 font-bold font-mono">/ {totals.totalCompleted}</span>
            </div>
            <div className="text-[10px] text-amber-700 font-bold mt-0.5">
              {totals.totalCompleted > 0 ? ((totals.totalDraw / totals.totalCompleted) * 100).toFixed(1) : '0.0'}% of finished
            </div>
          </div>

          {/* Underdog Wins */}
          <div className="bg-gradient-to-br from-purple-50/80 to-white rounded-xl shadow-sm border border-purple-200 p-3.5 flex flex-col justify-between">
            <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider flex items-center justify-between">
              <span>Underdog Wins</span>
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-xs"></span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-purple-700">{totals.totalUnderdog}</span>
              <span className="text-xs text-purple-600 font-bold font-mono">/ {totals.totalCompleted}</span>
            </div>
            <div className="text-[10px] text-purple-700 font-bold mt-0.5">
              {totals.totalCompleted > 0 ? ((totals.totalUnderdog / totals.totalCompleted) * 100).toFixed(1) : '0.0'}% of finished
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search triggers by keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none bg-gray-50/50"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider flex items-center gap-1 pl-1">
            <Filter size={12} /> Points:
          </span>
          <button
            onClick={() => setPointFilter('all')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors ${
              pointFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setPointFilter('bonus')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors ${
              pointFilter === 'bonus' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Bonuses (+)
          </button>
          <button
            onClick={() => setPointFilter('penalty')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors ${
              pointFilter === 'penalty' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            Penalties (-)
          </button>
          <button
            onClick={() => setPointFilter('zero')}
            className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors ${
              pointFilter === 'zero' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            0 pts
          </button>
        </div>
      </div>

      {/* Main Comparison Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-black uppercase tracking-wider text-gray-500">
                <th
                  onClick={() => handleSort('description')}
                  className="py-3 px-4 cursor-pointer hover:text-gray-900 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Trigger</span>
                    {sortField === 'description' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('points')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-gray-900 transition-colors select-none w-24"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Points</span>
                    {sortField === 'points' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('mfav')}
                  className="py-3 px-4 cursor-pointer hover:text-emerald-700 transition-colors select-none text-right sm:text-left min-w-[160px]"
                >
                  <div className="flex items-center gap-1 justify-end sm:justify-start">
                    <span className="text-emerald-800 font-black">Mfav Win Rate</span>
                    {sortField === 'mfav' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('draw')}
                  className="py-3 px-4 cursor-pointer hover:text-amber-700 transition-colors select-none text-right sm:text-left min-w-[160px]"
                >
                  <div className="flex items-center gap-1 justify-end sm:justify-start">
                    <span className="text-amber-800 font-black">Draw Rate</span>
                    {sortField === 'draw' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('underdog')}
                  className="py-3 px-4 cursor-pointer hover:text-purple-700 transition-colors select-none text-right sm:text-left min-w-[160px]"
                >
                  <div className="flex items-center gap-1 justify-end sm:justify-start">
                    <span className="text-purple-800 font-black">Underdog Rate</span>
                    {sortField === 'underdog' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400 font-medium">
                    No triggers found matching the current search or filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
                  <tr key={`${row.description}_${idx}`} className="hover:bg-gray-50/60 transition-colors">
                    {/* Trigger description */}
                    <td className="py-3 px-4 font-semibold text-gray-800 leading-relaxed max-w-md">
                      <div>{row.description}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {row.totalHits > 0 ? (
                          <span>
                            Triggered in <strong className="text-gray-700">{row.totalHits}</strong> matches 
                            {' '}(<span className="text-emerald-700 font-bold">{row.mfavPct.toFixed(0)}% Mfav</span> · <span className="text-amber-700 font-bold">{row.drawPct.toFixed(0)}% Draw</span> · <span className="text-purple-700 font-bold">{row.underdogPct.toFixed(0)}% Ud</span>)
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">0 matches triggered</span>
                        )}
                      </div>
                    </td>

                    {/* Points Badge */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black ${
                          row.points > 0
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : row.points < 0
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {row.points > 0 ? `+${row.points}` : row.points}
                      </span>
                    </td>

                    {/* Mfav ratio & pct */}
                    <td className="py-3 px-4 text-right sm:text-left">
                      {formatRatioPct(row.mfavHits, row.totalHits, row.mfavPct, 'mfav')}
                    </td>

                    {/* Draw ratio & pct */}
                    <td className="py-3 px-4 text-right sm:text-left">
                      {formatRatioPct(row.drawHits, row.totalHits, row.drawPct, 'draw')}
                    </td>

                    {/* Underdog ratio & pct */}
                    <td className="py-3 px-4 text-right sm:text-left">
                      {formatRatioPct(row.underdogHits, row.totalHits, row.underdogPct, 'underdog')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="bg-gray-50 px-4 py-2.5 border-t border-gray-200 text-xs text-gray-500 flex flex-col sm:flex-row justify-between items-center gap-2">
          <div>
            Showing <span className="font-bold text-gray-700">{filteredRows.length}</span> of{' '}
            <span className="font-bold text-gray-700">{rows.length}</span> triggers for{' '}
            <span className="font-bold text-purple-700">{activeCategoryConfig.label}</span>
          </div>
          <div className="text-[11px] text-gray-400">
            Click any column header to sort ascending / descending
          </div>
        </div>
      </div>
    </div>
  );
};

export default OPWComparison;
