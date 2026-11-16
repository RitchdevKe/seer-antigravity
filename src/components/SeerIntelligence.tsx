import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Database,
  Search,
  Activity,
  PlayCircle,
  GitBranch,
  History,
  Cpu,
  Zap,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Save,
  Sliders,
  TrendingUp,
  Layers,
  PauseCircle,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { Match } from '../types';
import MatchCard from './MatchCard';
import PatternTree from './PatternTree';
import {
  generateSITags,
  extractMLFeatures,
  ML_BASE_PATTERNS_DESCRIPTIONS,
  ML_VARIABLES_DESCRIPTIONS,
} from '../utils/mlFeatureExtractor';
import { useMLMatrix } from '../context/MLMatrixContext';
import { parseMatchOdds } from '../utils/seerAiSlipSelection';
import { getActualResult } from '../utils/matchProcessing';
import { SUB_PATTERN_RULES } from './Patterns';
import {
  SANDBOX_TRIGGERS,
  SubPatternSandboxModel,
  CompactSandboxMatch,
  SubPatternEvaluationSummary,
  buildCompactSandboxMatch,
  createDefaultSandboxModel,
  evaluateSubPatternMatches,
  optimizeSubPatternModel,
  computeTriggerStatsForSubPattern,
  getDetailedSandboxMatchPrediction,
  loadSavedSandboxModels,
  saveSandboxModelsToStorage,
  clearSavedSandboxModels,
} from '../utils/siComputeSandbox';

interface MLMatrixViewerProps {
  historicalMatches: Match[];
  liveMatches: Match[];
  phaStatsMap?: Record<string, any>;
}

export default function SeerIntelligence({
  historicalMatches,
  liveMatches,
  phaStatsMap,
}: MLMatrixViewerProps) {
  const { mlData, isLoading } = useMLMatrix();

  // Top-level mode: Default to 'sandbox' (the Per-Sub-Pattern ML Compute Sandbox)
  const [workspaceMode, setWorkspaceMode] = useState<'sandbox' | 'matrix'>('sandbox');

  // ── SANDBOX STATES ──────────────────────────────────────────────────────────
  const [datasetMode, setDatasetMode] = useState<'history' | 'live'>('history');
  const [patternSystem, setPatternSystem] = useState<'system_sub' | 'si_sub'>('system_sub');
  const [batchPreset, setBatchPreset] = useState<'top10' | 'batch2' | 'batch3' | 'batch4' | 'all'>('top10');
  const [targetObjective, setTargetObjective] = useState<'both' | 'final' | 'primary'>('both');
  const [subSearch, setSubSearch] = useState('');
  const [selectedSubPattern, setSelectedSubPattern] = useState<string | null>(null);
  const [rightInspectorTab, setRightInspectorTab] = useState<'triggers' | 'matches'>('triggers');
  const [triggerRoleFilter, setTriggerRoleFilter] = useState<'ALL' | 'PRO_MFAV' | 'PRO_DRAW' | 'PRO_UNDERDOG'>('ALL');
  const [matchDiffFilter, setMatchDiffFilter] = useState<'all' | 'flipped_good' | 'flipped_bad' | 'fav' | 'draw' | 'und'>('all');

  const [sandboxModels, setSandboxModels] = useState<Record<string, SubPatternSandboxModel>>(() =>
    loadSavedSandboxModels()
  );
  const [isComputingBatch, setIsComputingBatch] = useState(false);
  const [computingProgress, setComputingProgress] = useState<{
    current: number;
    total: number;
    currentSub: string;
    totalPasses: number;
  } | null>(null);
  const stopComputeRef = useRef(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // ── MATRIX LEGACY STATES ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'basePatterns' | 'subPatterns' | 'combos'>('combos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [showTree, setShowTree] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: 'total' | 'fav' | 'draw' | 'und';
    direction: 'asc' | 'desc';
  }>({ key: 'total', direction: 'desc' });
  const [viewMode, setViewMode] = useState<'prehistoric' | 'live'>('prehistoric');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'fav' | 'draw' | 'und'>('all');

  const activeSourceMatches = datasetMode === 'history' ? historicalMatches : liveMatches;

  // 1. Pre-index all completed matches into CompactSandboxMatch for blazing-fast compute
  const { compactMatches, subPatternBuckets } = useMemo(() => {
    const compact: CompactSandboxMatch[] = [];
    const buckets: Record<string, CompactSandboxMatch[]> = {};

    for (let i = 0; i < activeSourceMatches.length; i++) {
      const m = activeSourceMatches[i];
      const cm = buildCompactSandboxMatch(m, mlData, phaStatsMap);
      if (!cm) continue;
      compact.push(cm);

      if (patternSystem === 'system_sub') {
        const key = cm.subPattern || 'NO_SUB';
        if (key === 'NO_SUB' || key === 'NA') continue;
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(cm);
      } else {
        for (const tag of cm.siSubPatterns) {
          if (!buckets[tag]) buckets[tag] = [];
          buckets[tag].push(cm);
        }
      }
    }

    return { compactMatches: compact, subPatternBuckets: buckets };
  }, [activeSourceMatches, mlData, phaStatsMap, patternSystem]);

  // 2. Sort all sub-patterns by match volume descending so Top 10 is deterministic & high-impact
  const allSortedSubPatternKeys = useMemo(() => {
    return Object.keys(subPatternBuckets).sort(
      (a, b) => subPatternBuckets[b].length - subPatternBuckets[a].length
    );
  }, [subPatternBuckets]);

  // 3. Determine the active batch of sub-patterns (e.g. Top 10 first!)
  const activeBatchKeys = useMemo(() => {
    let keys = allSortedSubPatternKeys;
    if (subSearch.trim()) {
      const q = subSearch.trim().toLowerCase();
      keys = keys.filter(k => k.toLowerCase().includes(q));
      return keys;
    }
    if (batchPreset === 'top10') return keys.slice(0, 10);
    if (batchPreset === 'batch2') return keys.slice(10, 20);
    if (batchPreset === 'batch3') return keys.slice(20, 30);
    if (batchPreset === 'batch4') return keys.slice(30, 40);
    return keys;
  }, [allSortedSubPatternKeys, batchPreset, subSearch]);

  // Auto-select first sub-pattern in batch if none selected
  useEffect(() => {
    if (activeBatchKeys.length > 0 && (!selectedSubPattern || !subPatternBuckets[selectedSubPattern])) {
      setSelectedSubPattern(activeBatchKeys[0]);
    }
  }, [activeBatchKeys, selectedSubPattern, subPatternBuckets]);

  // 4. Evaluate summaries for all sub-patterns in the active batch
  const batchSummaries = useMemo<SubPatternEvaluationSummary[]>(() => {
    return activeBatchKeys.map(subKey => {
      const matches = subPatternBuckets[subKey] || [];
      const model = sandboxModels[subKey] || createDefaultSandboxModel(subKey);
      return evaluateSubPatternMatches(subKey, matches, model);
    });
  }, [activeBatchKeys, subPatternBuckets, sandboxModels]);

  // 5. Aggregate scoreboard across the active batch (e.g., the 10 sub-patterns) AND global dataset
  const batchAggregate = useMemo(() => {
    let totalMatches = 0;
    let favCount = 0;
    let drawCount = 0;
    let undCount = 0;
    let basePrimCorrect = 0;
    let baseFinalCorrect = 0;
    let sandboxPrimCorrect = 0;
    let sandboxFinalCorrect = 0;
    let improvedSubCount = 0;

    let baseFavCalls = 0, baseFavHits = 0;
    let baseDrawCalls = 0, baseDrawHits = 0;
    let baseUndCalls = 0, baseUndHits = 0;
    let baseFavDcCalls = 0, baseFavDcHits = 0;
    let baseUndDcCalls = 0, baseUndDcHits = 0;
    let baseSplitCalls = 0, baseSplitHits = 0;

    let sbFavCalls = 0, sbFavHits = 0;
    let sbDrawCalls = 0, sbDrawHits = 0;
    let sbUndCalls = 0, sbUndHits = 0;
    let sbFavDcCalls = 0, sbFavDcHits = 0;
    let sbUndDcCalls = 0, sbUndDcHits = 0;
    let sbSplitCalls = 0, sbSplitHits = 0;

    for (const s of batchSummaries) {
      totalMatches += s.totalMatches;
      favCount += s.favCount;
      drawCount += s.drawCount;
      undCount += s.undCount;
      basePrimCorrect += s.basePrimCorrect;
      baseFinalCorrect += s.baseFinalCorrect;
      sandboxPrimCorrect += s.sandboxPrimCorrect;
      sandboxFinalCorrect += s.sandboxFinalCorrect;
      if (s.improved) improvedSubCount++;

      baseFavCalls += s.baseCalls.fav.calls; baseFavHits += s.baseCalls.fav.hits;
      baseDrawCalls += s.baseCalls.draw.calls; baseDrawHits += s.baseCalls.draw.hits;
      baseUndCalls += s.baseCalls.und.calls; baseUndHits += s.baseCalls.und.hits;
      baseFavDcCalls += s.baseCalls.favDc.calls; baseFavDcHits += s.baseCalls.favDc.hits;
      baseUndDcCalls += s.baseCalls.undDc.calls; baseUndDcHits += s.baseCalls.undDc.hits;
      baseSplitCalls += s.baseCalls.split12.calls; baseSplitHits += s.baseCalls.split12.hits;

      sbFavCalls += s.sandboxCalls.fav.calls; sbFavHits += s.sandboxCalls.fav.hits;
      sbDrawCalls += s.sandboxCalls.draw.calls; sbDrawHits += s.sandboxCalls.draw.hits;
      sbUndCalls += s.sandboxCalls.und.calls; sbUndHits += s.sandboxCalls.und.hits;
      sbFavDcCalls += s.sandboxCalls.favDc.calls; sbFavDcHits += s.sandboxCalls.favDc.hits;
      sbUndDcCalls += s.sandboxCalls.undDc.calls; sbUndDcHits += s.sandboxCalls.undDc.hits;
      sbSplitCalls += s.sandboxCalls.split12.calls; sbSplitHits += s.sandboxCalls.split12.hits;
    }

    const basePrimPct = totalMatches > 0 ? (basePrimCorrect / totalMatches) * 100 : 0;
    const baseFinalPct = totalMatches > 0 ? (baseFinalCorrect / totalMatches) * 100 : 0;
    const sandboxPrimPct = totalMatches > 0 ? (sandboxPrimCorrect / totalMatches) * 100 : 0;
    const sandboxFinalPct = totalMatches > 0 ? (sandboxFinalCorrect / totalMatches) * 100 : 0;

    return {
      subCount: batchSummaries.length,
      improvedSubCount,
      totalMatches,
      favCount,
      drawCount,
      undCount,
      basePrimCorrect,
      basePrimPct,
      baseFinalCorrect,
      baseFinalPct,
      sandboxPrimCorrect,
      sandboxPrimPct,
      sandboxFinalCorrect,
      sandboxFinalPct,
      primLiftMatches: sandboxPrimCorrect - basePrimCorrect,
      primLiftPct: sandboxPrimPct - basePrimPct,
      finalLiftMatches: sandboxFinalCorrect - baseFinalCorrect,
      finalLiftPct: sandboxFinalPct - baseFinalPct,
      calls: {
        baseFav: { calls: baseFavCalls, hits: baseFavHits, pct: baseFavCalls > 0 ? (baseFavHits / baseFavCalls) * 100 : 0 },
        sbFav: { calls: sbFavCalls, hits: sbFavHits, pct: sbFavCalls > 0 ? (sbFavHits / sbFavCalls) * 100 : 0 },
        baseDraw: { calls: baseDrawCalls, hits: baseDrawHits, pct: baseDrawCalls > 0 ? (baseDrawHits / baseDrawCalls) * 100 : 0 },
        sbDraw: { calls: sbDrawCalls, hits: sbDrawHits, pct: sbDrawCalls > 0 ? (sbDrawHits / sbDrawCalls) * 100 : 0 },
        baseUnd: { calls: baseUndCalls, hits: baseUndHits, pct: baseUndCalls > 0 ? (baseUndHits / baseUndCalls) * 100 : 0 },
        sbUnd: { calls: sbUndCalls, hits: sbUndHits, pct: sbUndCalls > 0 ? (sbUndHits / sbUndCalls) * 100 : 0 },
        baseFavDc: { calls: baseFavDcCalls, hits: baseFavDcHits, pct: baseFavDcCalls > 0 ? (baseFavDcHits / baseFavDcCalls) * 100 : 0 },
        sbFavDc: { calls: sbFavDcCalls, hits: sbFavDcHits, pct: sbFavDcCalls > 0 ? (sbFavDcHits / sbFavDcCalls) * 100 : 0 },
        baseUndDc: { calls: baseUndDcCalls, hits: baseUndDcHits, pct: baseUndDcCalls > 0 ? (baseUndDcHits / baseUndDcCalls) * 100 : 0 },
        sbUndDc: { calls: sbUndDcCalls, hits: sbUndDcHits, pct: sbUndDcCalls > 0 ? (sbUndDcHits / sbUndDcCalls) * 100 : 0 },
        baseSplit: { calls: baseSplitCalls, hits: baseSplitHits, pct: baseSplitCalls > 0 ? (baseSplitHits / baseSplitCalls) * 100 : 0 },
        sbSplit: { calls: sbSplitCalls, hits: sbSplitHits, pct: sbSplitCalls > 0 ? (sbSplitHits / sbSplitCalls) * 100 : 0 },
      },
    };
  }, [batchSummaries]);

  // 6. Selected sub-pattern details
  const selectedSummary = useMemo(() => {
    if (!selectedSubPattern) return null;
    const matches = subPatternBuckets[selectedSubPattern] || [];
    const model = sandboxModels[selectedSubPattern] || createDefaultSandboxModel(selectedSubPattern);
    return evaluateSubPatternMatches(selectedSubPattern, matches, model);
  }, [selectedSubPattern, subPatternBuckets, sandboxModels]);

  const selectedTriggerStats = useMemo(() => {
    if (!selectedSubPattern) return [];
    const matches = subPatternBuckets[selectedSubPattern] || [];
    return computeTriggerStatsForSubPattern(matches);
  }, [selectedSubPattern, subPatternBuckets]);

  const selectedSubMatchesDetailed = useMemo(() => {
    if (!selectedSubPattern || !selectedSummary) return [];
    const matches = subPatternBuckets[selectedSubPattern] || [];
    const model = selectedSummary.model;

    return matches
      .map(cm => {
        const detail = getDetailedSandboxMatchPrediction(cm, model);
        return { cm, detail };
      })
      .filter(({ cm, detail }) => {
        if (matchDiffFilter === 'flipped_good') {
          return (!cm.baseFinalCorrect && detail.finalCorrect) || (!cm.basePrimCorrect && detail.primCorrect);
        }
        if (matchDiffFilter === 'flipped_bad') {
          return (cm.baseFinalCorrect && !detail.finalCorrect) || (cm.basePrimCorrect && !detail.primCorrect);
        }
        if (matchDiffFilter === 'fav') return cm.actualOutcomeType === 0;
        if (matchDiffFilter === 'draw') return cm.actualOutcomeType === 1;
        if (matchDiffFilter === 'und') return cm.actualOutcomeType === 2;
        return true;
      });
  }, [selectedSubPattern, selectedSummary, subPatternBuckets, matchDiffFilter]);

  // ── COMPUTE HANDLERS ────────────────────────────────────────────────────────
  const runComputeForSubPatternList = useCallback(
    async (keysToOptimize: string[], iterationsPerSub: number = 1800) => {
      if (keysToOptimize.length === 0 || isComputingBatch) return;
      stopComputeRef.current = false;
      setIsComputingBatch(true);
      setStatusBanner(null);

      const updatedModels: Record<string, SubPatternSandboxModel> = { ...sandboxModels };
      let improvedCount = 0;

      for (let i = 0; i < keysToOptimize.length; i++) {
        if (stopComputeRef.current) break;
        const subKey = keysToOptimize[i];
        const matches = subPatternBuckets[subKey] || [];
        if (matches.length === 0) continue;

        setComputingProgress({
          current: i + 1,
          total: keysToOptimize.length,
          currentSub: subKey,
          totalPasses: iterationsPerSub,
        });

        // Yield to UI frame so progress bar and live numbers update smoothly
        await new Promise<void>(resolve => setTimeout(resolve, 15));
        if (stopComputeRef.current) break;

        const existing = updatedModels[subKey];
        const optimized = optimizeSubPatternModel(
          subKey,
          matches,
          existing,
          iterationsPerSub,
          targetObjective
        );
        updatedModels[subKey] = optimized;
        if (optimized.useComputed) improvedCount++;

        setSandboxModels({ ...updatedModels });
      }

      saveSandboxModelsToStorage(updatedModels);
      setIsComputingBatch(false);
      setComputingProgress(null);
      setStatusBanner(
        `Compute complete across ${keysToOptimize.length} sub-pattern(s): ${improvedCount} sub-pattern(s) unlocked verified accuracy gains over Baseline ML.`
      );
    },
    [isComputingBatch, sandboxModels, subPatternBuckets, targetObjective]
  );

  const handleManualWeightChange = (subKey: string, trigId: number, delta: number) => {
    setSandboxModels(prev => {
      const base = prev[subKey] || createDefaultSandboxModel(subKey);
      const nextWeights = [...base.triggerWeights];
      nextWeights[trigId] = Math.max(0, Math.min(60, (nextWeights[trigId] ?? 15) + delta));
      const updated: SubPatternSandboxModel = {
        ...base,
        triggerWeights: nextWeights,
        useComputed: true,
      };
      const nextMap = { ...prev, [subKey]: updated };
      saveSandboxModelsToStorage(nextMap);
      return nextMap;
    });
  };

  const handleThresholdChange = (
    subKey: string,
    field: keyof Pick<
      SubPatternSandboxModel,
      | 'undDcPivotMargin'
      | 'undPrimMargin'
      | 'drawPrimMargin'
      | 'splitDrawCeiling'
      | 'undPenaltyOnFavTenths'
      | 'drawPenaltyOnFavTenths'
    >,
    delta: number
  ) => {
    setSandboxModels(prev => {
      const base = prev[subKey] || createDefaultSandboxModel(subKey);
      const updated: SubPatternSandboxModel = {
        ...base,
        [field]: (base[field] as number) + delta,
        useComputed: true,
      };
      const nextMap = { ...prev, [subKey]: updated };
      saveSandboxModelsToStorage(nextMap);
      return nextMap;
    });
  };

  const handleResetSubPattern = (subKey: string) => {
    setSandboxModels(prev => {
      const next = { ...prev };
      delete next[subKey];
      saveSandboxModelsToStorage(next);
      return next;
    });
    setStatusBanner(`Reset sub-pattern ${subKey} back to Baseline ML.`);
  };

  const handleResetAllSandbox = () => {
    clearSavedSandboxModels();
    setSandboxModels({});
    setStatusBanner('Cleared all sandbox calibrations. All sub-patterns reset to Baseline ML.');
  };

  // ── LEGACY MATRIX LOGIC ─────────────────────────────────────────────────────
  const baseMatches = viewMode === 'prehistoric' ? historicalMatches : liveMatches;

  const tagIndex = useMemo(() => {
    if (workspaceMode !== 'matrix') return { tags: {} as Record<string, Match[]> };
    const index: Record<string, Match[]> = {};
    baseMatches.forEach(m => {
      const features = extractMLFeatures(m);
      if (!features) return;
      const tags = generateSITags(features);
      if (!tags) return;
      for (const tag of tags) {
        if (!index[tag]) index[tag] = [];
        index[tag].push(m);
      }
    });
    return { tags: index };
  }, [baseMatches, workspaceMode]);

  const processItemMatches = useMemo(() => {
    if (!selectedItem || workspaceMode !== 'matrix') return [];
    let filteredMatches: Match[] = [];
    if (activeTab === 'combos') {
      const requiredTags = selectedItem.split('+');
      if (requiredTags.length === 0) return [];
      filteredMatches = tagIndex.tags[requiredTags[0]] || [];
      for (let i = 1; i < requiredTags.length; i++) {
        const tagSet = new Set((tagIndex.tags[requiredTags[i]] || []).map(m => m.id));
        filteredMatches = filteredMatches.filter(m => tagSet.has(m.id));
      }
    } else {
      filteredMatches = tagIndex.tags[selectedItem] || [];
    }

    if (outcomeFilter !== 'all') {
      filteredMatches = filteredMatches.filter(m => {
        const actual = getActualResult(m.result);
        if (actual === 'pending') return false;
        const { odds1, odds2 } = parseMatchOdds(m);
        const isFavHome = odds1 <= odds2;
        if (outcomeFilter === 'fav') return (actual === '1' && isFavHome) || (actual === '2' && !isFavHome);
        if (outcomeFilter === 'draw') return actual === 'X';
        if (outcomeFilter === 'und') return (actual === '2' && isFavHome) || (actual === '1' && !isFavHome);
        return true;
      });
    }
    return filteredMatches;
  }, [selectedItem, activeTab, tagIndex, outcomeFilter, workspaceMode]);

  const handleSort = (key: 'total' | 'fav' | 'draw' | 'und') => {
    if (sortConfig.key === key) {
      setSortConfig({ key, direction: sortConfig.direction === 'desc' ? 'asc' : 'desc' });
    } else {
      setSortConfig({ key, direction: 'desc' });
    }
  };

  const getSubPatternDescriptionText = (subKey: string): string => {
    if (patternSystem === 'system_sub') {
      const rule = (SUB_PATTERN_RULES as any)?.[subKey];
      if (rule?.description) return rule.description;
      if (rule?.prediction) return `Default Rule Prediction: ${rule.prediction}`;
      return 'System Match Sub-Pattern';
    } else {
      const base = ML_BASE_PATTERNS_DESCRIPTIONS[subKey.replace(/[0-9]+$/, '')] || '';
      const varMatch = subKey.match(/[0-9]+$/);
      const variable = varMatch ? ML_VARIABLES_DESCRIPTIONS[parseInt(varMatch[0], 10)] : '';
      return variable ? `${base} + ${variable}` : base || 'SI Matrix Sub-Pattern';
    }
  };

  return (
    <>
      {showTree && mlData && <PatternTree mlData={mlData} onClose={() => setShowTree(false)} />}

      <div className="space-y-4">
        {/* TOP WORKSPACE MODE SWITCHER */}
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-md border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
              <Cpu size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">
                  SEER Intelligence — ML Compute Sandbox
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  Isolated Sandbox • OPW Untouched
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Per-Sub-Pattern Continuous Compute Engine using standalone Pro-Mfav, Pro-Draw & Pro-Underdog triggers across {compactMatches.length.toLocaleString()} completed matches.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setWorkspaceMode('sandbox')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                  workspaceMode === 'sandbox'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap size={14} />
                🧪 Sub-Pattern Compute Sandbox
              </button>
              <button
                onClick={() => setWorkspaceMode('matrix')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                  workspaceMode === 'matrix'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Database size={14} />
                📊 Data-Driven ML Matrix
              </button>
            </div>
          </div>
        </div>

        {workspaceMode === 'sandbox' ? (
          <div className="space-y-4">
            {/* CONTROL BAR: BATCH SELECTION (10 SUB-PATTERNS FIRST), DATASET & COMPUTE ACTIONS */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
                {/* Left controls: Dataset + Sub-Pattern Type + Batch Selector */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Dataset toggle */}
                  <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                    <button
                      onClick={() => setDatasetMode('history')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        datasetMode === 'history'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      History ({historicalMatches.length.toLocaleString()})
                    </button>
                    <button
                      onClick={() => setDatasetMode('live')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        datasetMode === 'live'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      Live ({liveMatches.length.toLocaleString()})
                    </button>
                  </div>

                  {/* Sub-Pattern System Selector */}
                  <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                    <button
                      onClick={() => {
                        setPatternSystem('system_sub');
                        setSelectedSubPattern(null);
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        patternSystem === 'system_sub'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Match Sub-Patterns (Disjoint)
                    </button>
                    <button
                      onClick={() => {
                        setPatternSystem('si_sub');
                        setSelectedSubPattern(null);
                      }}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        patternSystem === 'si_sub'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      SI Sub-Patterns (SIa1..SIxx12)
                    </button>
                  </div>

                  {/* 10-Sub-Pattern Batch Selector */}
                  <div className="flex bg-amber-50 p-1 rounded-lg border border-amber-200">
                    {[
                      { id: 'top10', label: '🎯 Batch 1: Top 10 Sub-Patterns' },
                      { id: 'batch2', label: 'Batch 2 (11–20)' },
                      { id: 'batch3', label: 'Batch 3 (21–30)' },
                      { id: 'batch4', label: 'Batch 4 (31–40)' },
                      { id: 'all', label: `All (${allSortedSubPatternKeys.length})` },
                    ].map(b => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setBatchPreset(b.id as any);
                          setSubSearch('');
                        }}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                          batchPreset === b.id && !subSearch
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'text-amber-900 hover:bg-amber-100'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>

                  {/* Target Objective */}
                  <select
                    value={targetObjective}
                    onChange={e => setTargetObjective(e.target.value as any)}
                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700"
                    title="Optimization Objective"
                  >
                    <option value="both">Target: Final DC + Primary</option>
                    <option value="final">Target: Final DC (1X/X2/12) Only</option>
                    <option value="primary">Target: Primary (1/X/2) Only</option>
                  </select>
                </div>

                {/* Right Compute Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {!isComputingBatch ? (
                    <>
                      <button
                        onClick={() => runComputeForSubPatternList(activeBatchKeys, 2000)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wide shadow-sm flex items-center gap-1.5 transition-all"
                      >
                        <PlayCircle size={15} />
                        Run Compute on {activeBatchKeys.length} Sub-Patterns
                      </button>
                      {selectedSubPattern && (
                        <button
                          onClick={() => runComputeForSubPatternList([selectedSubPattern], 4000)}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                        >
                          <Sparkles size={14} />
                          Deep Compute Selected ({selectedSubPattern})
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        stopComputeRef.current = true;
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black uppercase tracking-wide shadow-sm flex items-center gap-1.5 animate-pulse"
                    >
                      <PauseCircle size={15} />
                      Stop Compute ({computingProgress?.current}/{computingProgress?.total} • {computingProgress?.currentSub})
                    </button>
                  )}

                  <button
                    onClick={handleResetAllSandbox}
                    disabled={isComputingBatch}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold border border-gray-200 flex items-center gap-1 transition-all disabled:opacity-50"
                  >
                    <RotateCcw size={13} />
                    Reset Sandbox
                  </button>
                </div>
              </div>

              {statusBanner && (
                <div className="px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between">
                  <span>✅ {statusBanner}</span>
                  <button
                    onClick={() => setStatusBanner(null)}
                    className="text-emerald-700 hover:text-emerald-950 font-black ml-4"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* FACTUAL SCOREBOARD: BASELINE ML VS SANDBOX COMPUTE ACROSS ACTIVE BATCH (10 SUB-PATTERNS) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              {/* Card 1: Scope & Sub-Patterns Improved */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">
                    Active Test Scope
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-black">
                    {batchAggregate.improvedSubCount} / {batchAggregate.subCount} Improved
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-gray-900 font-mono">
                    {batchAggregate.totalMatches.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-gray-500">
                    completed matches in {batchAggregate.subCount} sub-patterns
                  </span>
                </div>
                <div className="mt-3 pt-2.5 border-t border-gray-100 grid grid-cols-3 gap-1 text-[11px] font-mono">
                  <div className="text-emerald-700 font-bold">
                    Fav: {batchAggregate.totalMatches > 0 ? ((batchAggregate.favCount / batchAggregate.totalMatches) * 100).toFixed(1) : '0.0'}%
                  </div>
                  <div className="text-amber-700 font-bold">
                    Draw: {batchAggregate.totalMatches > 0 ? ((batchAggregate.drawCount / batchAggregate.totalMatches) * 100).toFixed(1) : '0.0'}%
                  </div>
                  <div className="text-rose-700 font-bold">
                    Und: {batchAggregate.totalMatches > 0 ? ((batchAggregate.undCount / batchAggregate.totalMatches) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>

              {/* Card 2: Final DC (1X / X2 / 12) Accuracy Before vs After */}
              <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
                    Final ML Prediction (1X / X2 / 12)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-black font-mono ${
                      batchAggregate.finalLiftMatches > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {batchAggregate.finalLiftMatches >= 0 ? '+' : ''}
                    {batchAggregate.finalLiftMatches} matches ({batchAggregate.finalLiftPct >= 0 ? '+' : ''}
                    {batchAggregate.finalLiftPct.toFixed(2)}%)
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-gray-400">Baseline ML</div>
                    <div className="text-lg font-black text-gray-600 font-mono">
                      {batchAggregate.baseFinalPct.toFixed(2)}%{' '}
                      <span className="text-xs font-normal text-gray-400">
                        ({batchAggregate.baseFinalCorrect.toLocaleString()})
                      </span>
                    </div>
                  </div>
                  <div className="text-gray-300 font-black text-lg">→</div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase text-emerald-600">Sandbox Compute</div>
                    <div className="text-2xl font-black text-emerald-700 font-mono">
                      {batchAggregate.sandboxFinalPct.toFixed(2)}%{' '}
                      <span className="text-xs font-bold text-emerald-600">
                        ({batchAggregate.sandboxFinalCorrect.toLocaleString()})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 3: Primary (1 / X / 2) Accuracy Before vs After */}
              <div className="bg-white rounded-xl p-4 border border-indigo-200 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-indigo-700">
                    Primary ML Prediction (1 / X / 2)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-black font-mono ${
                      batchAggregate.primLiftMatches > 0
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {batchAggregate.primLiftMatches >= 0 ? '+' : ''}
                    {batchAggregate.primLiftMatches} matches ({batchAggregate.primLiftPct >= 0 ? '+' : ''}
                    {batchAggregate.primLiftPct.toFixed(2)}%)
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-gray-400">Baseline ML</div>
                    <div className="text-lg font-black text-gray-600 font-mono">
                      {batchAggregate.basePrimPct.toFixed(2)}%{' '}
                      <span className="text-xs font-normal text-gray-400">
                        ({batchAggregate.basePrimCorrect.toLocaleString()})
                      </span>
                    </div>
                  </div>
                  <div className="text-gray-300 font-black text-lg">→</div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase text-indigo-600">Sandbox Compute</div>
                    <div className="text-2xl font-black text-indigo-700 font-mono">
                      {batchAggregate.sandboxPrimPct.toFixed(2)}%{' '}
                      <span className="text-xs font-bold text-indigo-600">
                        ({batchAggregate.sandboxPrimCorrect.toLocaleString()})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 4: 3-Way Support Breakdown (Mfav vs Draw vs Underdog) */}
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2">
                  When Sandbox Supports Mfav / Draw / Und
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-emerald-700">Mfav DC (1X/X2):</span>
                    <span>
                      {batchAggregate.calls.sbFavDc.hits}/{batchAggregate.calls.sbFavDc.calls} (
                      <strong className="text-emerald-700">{batchAggregate.calls.sbFavDc.pct.toFixed(1)}%</strong>)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-rose-700">Und DC (X2/1X):</span>
                    <span>
                      {batchAggregate.calls.sbUndDc.hits}/{batchAggregate.calls.sbUndDc.calls} (
                      <strong className="text-rose-700">{batchAggregate.calls.sbUndDc.pct.toFixed(1)}%</strong>)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-amber-700">Split (12) / Prim X:</span>
                    <span>
                      {batchAggregate.calls.sbSplit.hits}/{batchAggregate.calls.sbSplit.calls} • X:{' '}
                      {batchAggregate.calls.sbDraw.hits}/{batchAggregate.calls.sbDraw.calls}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN TWO-COLUMN SANDBOX WORKSPACE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* LEFT COLUMN (5 cols): SUB-PATTERN COMPUTE LEADERBOARD */}
              <div className="lg:col-span-5 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-800">
                      Sub-Patterns in Batch ({batchSummaries.length})
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Click any sub-pattern to inspect or tune its triggers & matches
                    </p>
                  </div>
                  <div className="relative w-44">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
                    <input
                      type="text"
                      value={subSearch}
                      onChange={e => setSubSearch(e.target.value)}
                      placeholder="Filter sub-pattern..."
                      className="w-full pl-8 pr-2 py-1 bg-white border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[680px] divide-y divide-gray-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 sticky top-0 z-10 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-2.5">#</th>
                        <th className="py-2.5 px-2">Sub-Pattern</th>
                        <th className="py-2.5 px-2 text-right">Vol</th>
                        <th className="py-2.5 px-2 text-right">Split (F/D/U)</th>
                        <th className="py-2.5 px-2 text-right">Final (Base→SB)</th>
                        <th className="py-2.5 px-2 text-right">Prim (Base→SB)</th>
                        <th className="py-2.5 px-2 text-center">Compute</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {batchSummaries.map((s, idx) => {
                        const isSelected = selectedSubPattern === s.subPattern;
                        return (
                          <tr
                            key={s.subPattern}
                            onClick={() => setSelectedSubPattern(s.subPattern)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-emerald-50/90 hover:bg-emerald-100/70'
                                : 'bg-white hover:bg-gray-50'
                            }`}
                          >
                            <td className="py-2.5 px-2.5 font-mono text-gray-400 text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-gray-900">
                                  {s.subPattern}
                                </span>
                                {s.improved && (
                                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[9px] font-black">
                                    +{s.finalLiftMatches}F / +{s.primLiftMatches}P
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400 truncate max-w-[135px]">
                                {getSubPatternDescriptionText(s.subPattern)}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-bold text-gray-700">
                              {s.totalMatches}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-[10px]">
                              <span className="text-emerald-600 font-bold">{s.favPct.toFixed(0)}</span>/
                              <span className="text-amber-600 font-bold">{s.drawPct.toFixed(0)}</span>/
                              <span className="text-rose-600 font-bold">{s.undPct.toFixed(0)}%</span>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono">
                              <span className="text-gray-400">{s.baseFinalPct.toFixed(1)}%</span>
                              <span className="mx-1 text-gray-300">→</span>
                              <span
                                className={`font-black ${
                                  s.finalLiftMatches > 0
                                    ? 'text-emerald-700'
                                    : 'text-gray-700'
                                }`}
                              >
                                {s.sandboxFinalPct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono">
                              <span className="text-gray-400">{s.basePrimPct.toFixed(1)}%</span>
                              <span className="mx-1 text-gray-300">→</span>
                              <span
                                className={`font-black ${
                                  s.primLiftMatches > 0
                                    ? 'text-indigo-700'
                                    : 'text-gray-700'
                                }`}
                              >
                                {s.sandboxPrimPct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setSelectedSubPattern(s.subPattern);
                                  runComputeForSubPatternList([s.subPattern], 3000);
                                }}
                                disabled={isComputingBatch}
                                className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] border border-indigo-200 disabled:opacity-40"
                                title={`Run 3,000 compute permutations on ${s.subPattern}`}
                              >
                                ⚡ Run
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RIGHT COLUMN (7 cols): SELECTED SUB-PATTERN TRIGGER & MATCH INSPECTOR */}
              <div className="lg:col-span-7 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                {selectedSummary ? (
                  <>
                    {/* Selected Sub-Pattern Header */}
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono text-sm font-black">
                            {selectedSummary.subPattern}
                          </span>
                          <span className="text-xs font-bold text-gray-600">
                            {selectedSummary.totalMatches} Matches • Fav {selectedSummary.favPct.toFixed(1)}% | Draw{' '}
                            {selectedSummary.drawPct.toFixed(1)}% | Und {selectedSummary.undPct.toFixed(1)}%
                          </span>
                          {selectedSummary.model.useComputed ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black">
                              COMPUTED ACTIVE ({selectedSummary.model.iterationsRun} passes)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-[10px] font-bold">
                              BASELINE ML
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {getSubPatternDescriptionText(selectedSummary.subPattern)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                          <button
                            onClick={() => setRightInspectorTab('triggers')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                              rightInspectorTab === 'triggers'
                                ? 'bg-emerald-600 text-white'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            🎯 Triggers & Rules
                          </button>
                          <button
                            onClick={() => setRightInspectorTab('matches')}
                            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                              rightInspectorTab === 'matches'
                                ? 'bg-emerald-600 text-white'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            🔍 Matches ({selectedSummary.totalMatches})
                          </button>
                        </div>

                        {selectedSummary.model.useComputed && (
                          <button
                            onClick={() => handleResetSubPattern(selectedSummary.subPattern)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200"
                            title="Reset this sub-pattern to Baseline ML"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Sub-Pattern 3-Way Call Comparison Strip */}
                    <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border-b border-gray-200 text-xs font-mono">
                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <div className="text-[10px] font-black uppercase text-emerald-700">
                          When Supporting Mfav (Prim / DC)
                        </div>
                        <div className="mt-1 flex justify-between">
                          <span className="text-gray-500">Base DC:</span>
                          <span className="font-bold">
                            {selectedSummary.baseCalls.favDc.hits}/{selectedSummary.baseCalls.favDc.calls} (
                            {selectedSummary.baseCalls.favDc.accuracy.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="flex justify-between text-emerald-700">
                          <span>Sandbox DC:</span>
                          <span className="font-black">
                            {selectedSummary.sandboxCalls.favDc.hits}/{selectedSummary.sandboxCalls.favDc.calls} (
                            {selectedSummary.sandboxCalls.favDc.accuracy.toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <div className="text-[10px] font-black uppercase text-amber-700">
                          When Supporting Draw / Split 12
                        </div>
                        <div className="mt-1 flex justify-between">
                          <span className="text-gray-500">Base Prim X:</span>
                          <span className="font-bold">
                            {selectedSummary.baseCalls.draw.hits}/{selectedSummary.baseCalls.draw.calls} (
                            {selectedSummary.baseCalls.draw.accuracy.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="flex justify-between text-amber-700">
                          <span>Sandbox Prim X:</span>
                          <span className="font-black">
                            {selectedSummary.sandboxCalls.draw.hits}/{selectedSummary.sandboxCalls.draw.calls} (
                            {selectedSummary.sandboxCalls.draw.accuracy.toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                        <div className="text-[10px] font-black uppercase text-rose-700">
                          When Supporting Underdog (DC)
                        </div>
                        <div className="mt-1 flex justify-between">
                          <span className="text-gray-500">Base Und DC:</span>
                          <span className="font-bold">
                            {selectedSummary.baseCalls.undDc.hits}/{selectedSummary.baseCalls.undDc.calls} (
                            {selectedSummary.baseCalls.undDc.accuracy.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="flex justify-between text-rose-700">
                          <span>Sandbox Und DC:</span>
                          <span className="font-black">
                            {selectedSummary.sandboxCalls.undDc.hits}/{selectedSummary.sandboxCalls.undDc.calls} (
                            {selectedSummary.sandboxCalls.undDc.accuracy.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {rightInspectorTab === 'triggers' ? (
                      <div className="p-4 space-y-4 overflow-y-auto max-h-[550px]">
                        {/* Decision Boundary Thresholds Box */}
                        <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5">
                          <div className="text-xs font-black uppercase tracking-wider text-indigo-900 mb-2.5 flex items-center justify-between">
                            <span>Calibrated Decision Boundaries for {selectedSummary.subPattern}</span>
                            <span className="text-[10px] font-mono text-indigo-700">
                              Predictor Weights: Algo={selectedSummary.model.wAlgo} | PAA={selectedSummary.model.wPaa} | SEER={selectedSummary.model.wSeer} | PHA={selectedSummary.model.wPha} | Matrix={selectedSummary.model.wMatrix}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                            <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                              <div className="text-[10px] font-bold text-gray-500 uppercase">
                                Pivot to Und DC Margin
                              </div>
                              <div className="mt-1 flex items-center justify-between">
                                <span className="font-mono font-black text-sm text-rose-700">
                                  {selectedSummary.model.undDcPivotMargin} pts
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() =>
                                      handleThresholdChange(selectedSummary.subPattern, 'undDcPivotMargin', -5)
                                    }
                                    className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-bold"
                                  >
                                    -5
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleThresholdChange(selectedSummary.subPattern, 'undDcPivotMargin', 5)
                                    }
                                    className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-bold"
                                  >
                                    +5
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                              <div className="text-[10px] font-bold text-gray-500 uppercase">
                                Primary Underdog Margin
                              </div>
                              <div className="mt-1 flex items-center justify-between">
                                <span className="font-mono font-black text-sm text-rose-700">
                                  {selectedSummary.model.undPrimMargin} pts
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() =>
                                      handleThresholdChange(selectedSummary.subPattern, 'undPrimMargin', -5)
                                    }
                                    className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-bold"
                                  >
                                    -5
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleThresholdChange(selectedSummary.subPattern, 'undPrimMargin', 5)
                                    }
                                    className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-bold"
                                  >
                                    +5
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                              <div className="text-[10px] font-bold text-gray-500 uppercase">
                                Primary Draw Margin
                              </div>
                              <div className="mt-1 flex items-center justify-between">
                                <span className="font-mono font-black text-sm text-amber-700">
                                  {selectedSummary.model.drawPrimMargin} pts
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() =>
                                      handleThresholdChange(selectedSummary.subPattern, 'drawPrimMargin', -5)
                                    }
                                    className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-bold"
                                  >
                                    -5
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleThresholdChange(selectedSummary.subPattern, 'drawPrimMargin', 5)
                                    }
                                    className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-bold"
                                  >
                                    +5
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                              <div className="text-[10px] font-bold text-gray-500 uppercase">
                                Split (12) Draw Ceiling
                              </div>
                              <div className="mt-1 flex items-center justify-between">
                                <span className="font-mono font-black text-sm text-indigo-700">
                                  {selectedSummary.model.splitDrawCeiling} pts
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() =>
                                      handleThresholdChange(selectedSummary.subPattern, 'splitDrawCeiling', -5)
                                    }
                                    className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-bold"
                                  >
                                    -5
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleThresholdChange(selectedSummary.subPattern, 'splitDrawCeiling', 5)
                                    }
                                    className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded font-bold"
                                  >
                                    +5
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Sandbox Trigger Role Filter */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex bg-gray-100 p-1 rounded-lg">
                            {[
                              { id: 'ALL', label: 'All Triggers (48)' },
                              { id: 'PRO_MFAV', label: '🟢 Pro-Mfav Bonuses (18)' },
                              { id: 'PRO_DRAW', label: '🟡 Pro-Draw Signals (14)' },
                              { id: 'PRO_UNDERDOG', label: '🔴 Pro-Underdog / Trap Penalties (16)' },
                            ].map(tab => (
                              <button
                                key={tab.id}
                                onClick={() => setTriggerRoleFilter(tab.id as any)}
                                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                                  triggerRoleFilter === tab.id
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-800'
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Sandbox Triggers Table */}
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 border-b border-gray-200">
                              <tr>
                                <th className="py-2 px-3">Sandbox Trigger (Standalone Copy)</th>
                                <th className="py-2 px-2">Role</th>
                                <th className="py-2 px-2 text-right">Hits</th>
                                <th className="py-2 px-2 text-right">Fav% / Draw% / Und%</th>
                                <th className="py-2 px-3 text-right">Sandbox Pts</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {selectedTriggerStats
                                .filter(
                                  st =>
                                    triggerRoleFilter === 'ALL' || st.def.role === triggerRoleFilter
                                )
                                .map(st => {
                                  const w =
                                    selectedSummary.model.triggerWeights[st.def.id] ??
                                    st.def.defaultPoints;
                                  const roleBadge =
                                    st.def.role === 'PRO_MFAV'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : st.def.role === 'PRO_DRAW'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200';
                                  const ptsPrefix =
                                    st.def.role === 'PRO_MFAV'
                                      ? '+Mfav '
                                      : st.def.role === 'PRO_DRAW'
                                      ? '+Draw '
                                      : '+Und / -Mfav ';
                                  return (
                                    <tr key={st.def.id} className="hover:bg-gray-50">
                                      <td className="py-2 px-3 font-medium text-gray-800">
                                        {st.def.label}
                                      </td>
                                      <td className="py-2 px-2">
                                        <span
                                          className={`px-1.5 py-0.5 rounded border text-[9px] font-black ${roleBadge}`}
                                        >
                                          {st.def.role.replace('PRO_', '')}
                                        </span>
                                      </td>
                                      <td className="py-2 px-2 text-right font-mono font-bold text-gray-600">
                                        {st.total}
                                      </td>
                                      <td className="py-2 px-2 text-right font-mono text-[11px]">
                                        {st.total > 0 ? (
                                          <>
                                            <span className="text-emerald-600 font-bold">
                                              {st.favPct.toFixed(0)}%
                                            </span>{' '}
                                            /{' '}
                                            <span className="text-amber-600 font-bold">
                                              {st.drawPct.toFixed(0)}%
                                            </span>{' '}
                                            /{' '}
                                            <span className="text-rose-600 font-bold">
                                              {st.undPct.toFixed(0)}%
                                            </span>
                                          </>
                                        ) : (
                                          <span className="text-gray-300">—</span>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 text-right">
                                        <div className="inline-flex items-center gap-1.5">
                                          <button
                                            onClick={() =>
                                              handleManualWeightChange(
                                                selectedSummary.subPattern,
                                                st.def.id,
                                                -5
                                              )
                                            }
                                            className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold"
                                          >
                                            -5
                                          </button>
                                          <span className="font-mono font-black text-gray-900 min-w-[78px] text-right">
                                            {ptsPrefix}
                                            {w}
                                          </span>
                                          <button
                                            onClick={() =>
                                              handleManualWeightChange(
                                                selectedSummary.subPattern,
                                                st.def.id,
                                                5
                                              )
                                            }
                                            className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-bold"
                                          >
                                            +5
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      /* MATCH-BY-MATCH VERIFICATION TAB */
                      <div className="p-4 space-y-3 overflow-y-auto max-h-[550px]">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
                          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
                            {[
                              { id: 'all', label: 'All Matches' },
                              { id: 'flipped_good', label: '✅ Flipped Wrong → Right' },
                              { id: 'flipped_bad', label: '❌ Flipped Right → Wrong' },
                              { id: 'fav', label: 'M.Fav Wins' },
                              { id: 'draw', label: 'Draws' },
                              { id: 'und', label: 'Underdogs' },
                            ].map(f => (
                              <button
                                key={f.id}
                                onClick={() => setMatchDiffFilter(f.id as any)}
                                className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                                  matchDiffFilter === f.id
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-800'
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                          <span className="text-xs font-mono font-bold text-gray-500">
                            Showing {selectedSubMatchesDetailed.length} matches
                          </span>
                        </div>

                        {selectedSubMatchesDetailed.length === 0 ? (
                          <div className="p-8 text-center text-gray-400 text-xs font-medium">
                            No matches match this filter in {selectedSummary.subPattern}.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {selectedSubMatchesDetailed.slice(0, 80).map(({ cm, detail }, idx) => (
                              <div
                                key={`${cm.matchId}_${idx}`}
                                className="p-3 rounded-xl border border-gray-200 bg-gray-50/60 space-y-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <span className="font-bold text-gray-900 text-xs">
                                      {cm.match.teams}
                                    </span>
                                    <span className="ml-2 font-mono text-[11px] text-gray-500">
                                      ({cm.match.result || cm.actual} • Actual: {cm.actual})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs font-mono">
                                    <span
                                      className={`px-2 py-0.5 rounded border ${
                                        cm.baseFinalCorrect
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-rose-50 text-rose-700 border-rose-200'
                                      }`}
                                    >
                                      Base ML: {cm.basePrimPred} / {cm.baseFinalPred}{' '}
                                      {cm.baseFinalCorrect ? '✓' : '✗'}
                                    </span>
                                    <span>→</span>
                                    <span
                                      className={`px-2 py-0.5 rounded border font-black ${
                                        detail.finalCorrect
                                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                          : 'bg-rose-100 text-rose-900 border-rose-300'
                                      }`}
                                    >
                                      Sandbox: {detail.primPred} / {detail.finalPred}{' '}
                                      {detail.finalCorrect ? '✓' : '✗'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-gray-600">
                                  <span>
                                    Mfav Score: <strong className="text-emerald-700">{detail.mfavScore}</strong> (+{detail.proMfavPts} bonus)
                                  </span>
                                  <span>
                                    Draw Score: <strong className="text-amber-700">{detail.drawScore}</strong> (+{detail.proDrawPts} draw)
                                  </span>
                                  <span>
                                    Und Score: <strong className="text-rose-700">{detail.undScore}</strong> (+{detail.proUndPts} und)
                                  </span>
                                </div>

                                {detail.activeTriggers.length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {detail.activeTriggers.map(t => (
                                      <span
                                        key={t.def.id}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                                          t.def.role === 'PRO_MFAV'
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                            : t.def.role === 'PRO_DRAW'
                                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                                            : 'bg-rose-50 text-rose-800 border-rose-200'
                                        }`}
                                      >
                                        {t.def.label} ({t.weight})
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-12 text-center text-gray-400">
                    Select a sub-pattern on the left to inspect its triggers and matches.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* PRESERVED DATA-DRIVEN ML MATRIX VIEW */
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {isLoading || !mlData ? (
              <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <Database className="w-12 h-12 mb-4 animate-bounce text-emerald-600" />
                <p className="font-semibold text-lg animate-pulse text-gray-800">
                  Loading ML Matrix Data...
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Database size={20} className="text-emerald-600" />
                      <div>
                        <h2 className="text-lg font-black text-gray-800 tracking-tight leading-tight">
                          Data-Driven ML Matrix
                        </h2>
                        <p className="text-xs font-medium text-gray-500">
                          Live reflection of the self-updating AI matrix.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex bg-gray-200 p-1 rounded-lg">
                        <button
                          onClick={() => setViewMode('prehistoric')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                            viewMode === 'prehistoric'
                              ? 'bg-white text-gray-800 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <History size={14} />
                          Prehistoric
                        </button>
                        <button
                          onClick={() => setViewMode('live')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                            viewMode === 'live'
                              ? 'bg-white text-emerald-600 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Activity size={14} />
                          Live Matches
                        </button>
                      </div>
                      <button
                        onClick={() => setShowTree(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <GitBranch size={14} />
                        Pattern Tree
                      </button>
                    </div>

                    <div className="flex items-center gap-2 bg-white rounded-md border border-gray-200 p-1 shadow-sm">
                      <button
                        onClick={() => {
                          setActiveTab('basePatterns');
                          setSelectedItem(null);
                        }}
                        className={`px-4 py-1.5 rounded text-xs font-bold transition-colors ${
                          activeTab === 'basePatterns'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        Base Patterns
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('subPatterns');
                          setSelectedItem(null);
                        }}
                        className={`px-4 py-1.5 rounded text-xs font-bold transition-colors ${
                          activeTab === 'subPatterns'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        Sub Patterns
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('combos');
                          setSelectedItem(null);
                        }}
                        className={`px-4 py-1.5 rounded text-xs font-bold transition-colors ${
                          activeTab === 'combos'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        Exact Combos
                      </button>
                    </div>
                  </div>
                </div>

                {(() => {
                  const currentDataSet = mlData[activeTab] || {};
                  const filteredKeys = Object.keys(currentDataSet)
                    .filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
                    .sort((a, b) => {
                      let valA = 0,
                        valB = 0;
                      if (sortConfig.key === 'total') {
                        valA = currentDataSet[a].total;
                        valB = currentDataSet[b].total;
                      } else if (sortConfig.key === 'fav') {
                        valA = currentDataSet[a].favPct;
                        valB = currentDataSet[b].favPct;
                      } else if (sortConfig.key === 'draw') {
                        valA = currentDataSet[a].drawPct;
                        valB = currentDataSet[b].drawPct;
                      } else if (sortConfig.key === 'und') {
                        valA = currentDataSet[a].undPct;
                        valB = currentDataSet[b].undPct;
                      }
                      return sortConfig.direction === 'desc' ? valB - valA : valA - valB;
                    });

                  return (
                    <div className="flex flex-col md:flex-row min-h-[600px] max-h-[800px]">
                      <div
                        className={`w-full ${
                          selectedItem ? 'md:w-1/2 border-r' : 'md:w-full'
                        } border-gray-200 flex flex-col`}
                      >
                        <div className="p-3 border-b border-gray-100">
                          <div className="relative">
                            <Search
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                              size={16}
                            />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              placeholder={`Search ${activeTab}...`}
                              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-gray-50" style={{ maxHeight: '700px' }}>
                          <table className="w-full text-left text-xs text-gray-600">
                            <thead className="bg-white border-b border-gray-200 sticky top-0 z-10">
                              <tr>
                                <th className="px-2 py-3 font-bold text-gray-700 uppercase tracking-wider text-center w-8">
                                  #
                                </th>
                                <th className="px-4 py-3 font-bold text-gray-700 uppercase tracking-wider">
                                  Pattern
                                </th>
                                <th
                                  onClick={() => handleSort('total')}
                                  className="px-4 py-3 font-bold text-gray-700 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100"
                                >
                                  Vol
                                </th>
                                <th
                                  onClick={() => handleSort('fav')}
                                  className="px-4 py-3 font-bold text-gray-700 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100"
                                >
                                  Fav
                                </th>
                                <th
                                  onClick={() => handleSort('draw')}
                                  className="px-4 py-3 font-bold text-gray-700 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100"
                                >
                                  Draw
                                </th>
                                <th
                                  onClick={() => handleSort('und')}
                                  className="px-4 py-3 font-bold text-gray-700 uppercase tracking-wider text-right cursor-pointer hover:bg-gray-100"
                                >
                                  Und
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredKeys.map((k, idx) => {
                                const st = currentDataSet[k];
                                const isSelected = selectedItem === k;
                                return (
                                  <tr
                                    key={k}
                                    onClick={() => setSelectedItem(isSelected ? null : k)}
                                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                                      isSelected
                                        ? 'bg-emerald-50 hover:bg-emerald-100'
                                        : 'bg-white hover:bg-gray-50'
                                    }`}
                                  >
                                    <td className="px-2 py-3 text-center text-gray-400 font-mono text-xs w-8">
                                      {idx + 1}
                                    </td>
                                    <td className="px-4 py-3 font-mono font-bold text-gray-800">
                                      {activeTab === 'combos' ? k.split('+').join(' + ') : k}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-600">
                                      {st.total}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                      <span
                                        className={
                                          st.favPct >= 60
                                            ? 'text-emerald-600 font-bold'
                                            : 'text-gray-500'
                                        }
                                      >
                                        {st.favPct.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                      <span
                                        className={
                                          st.drawPct >= 35
                                            ? 'text-amber-600 font-bold'
                                            : 'text-gray-500'
                                        }
                                      >
                                        {st.drawPct.toFixed(1)}%
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                      <span
                                        className={
                                          st.undPct >= 40
                                            ? 'text-rose-600 font-bold'
                                            : 'text-gray-500'
                                        }
                                      >
                                        {st.undPct.toFixed(1)}%
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {selectedItem && (
                        <div
                          className="w-full md:w-1/2 flex flex-col bg-gray-50 overflow-y-auto"
                          style={{ maxHeight: '700px' }}
                        >
                          <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-sm">
                            <h3 className="font-bold text-gray-800 text-sm">
                              Matches for {selectedItem} ({processItemMatches.length})
                            </h3>
                          </div>
                          <div className="p-4 space-y-4">
                            {processItemMatches.map((m, idx) => (
                              <MatchCard
                                key={`${m.id}_${idx}`}
                                match={m}
                                expandedMatch={expandedMatch}
                                setExpandedMatch={setExpandedMatch}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
