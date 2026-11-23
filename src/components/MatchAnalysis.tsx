import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { BarChart, Filter, Calendar, History, Save, RefreshCw, Upload, FileText, PlayCircle, Activity, Search, TrendingUp, AlertTriangle, List, Layers, X, BrainCircuit, Grip, Trophy, Trash2, CheckCircle2, AlertCircle, Clock, LogOut, Shield, Calculator, Info, Cpu, Scan, Loader2, ScanLine, BarChart2, Eye, Copy, ArrowLeft, Database, Download, FileArchive, SlidersHorizontal, Scale, Sparkles } from 'lucide-react';
import { Match, User } from '../types';
import { RAW_MATCHES, JACKPOT_OPTIONS } from '../constants';
import Analysis from './Analysis';
import { processMatch, getActualResult, matchesPrediction, calculatePAAPrediction, calculatePHAPrediction, getFavoriteAndUnderdog } from '../utils/matchProcessing';
import { predictWithHybridML } from '../utils/hybridMachineLearning';
import LivePredictions from './LivePredictions';
import Archives from './Archives';
import MatchCard from './MatchCard';
import NerdyTips from './NerdyTips';
import LivePerformanceAnalysis from './LivePerformanceAnalysis';
import SeerAnalysis from './SeerAnalysis';
import OPWComparison from '../opwcomparison';
import { updateSeerSnapshots, getAnalysisDateString, deleteDailySeerSnapshot, removeMatchFromSeerSnapshot, syncSeerData, preloadAllSeerData } from '../services/seerPerformance';
import { getLogicalDate } from '../utils/matchProcessing';
import { loadPrecalculatedMatches, loadEmbeddedMatches, savePrecalculatedMatches, clearAllMatches, deletePrecalculatedMatchFromSupabase, deletePrecalculatedMatchesFromSupabaseBulk } from '../services/supabaseMatches';
import { loadUploadedMatchesFromSupabase, deleteUploadedMatchFromSupabase, deleteUploadedMatchesFromSupabaseBulk } from '../services/supabaseUploadedMatches';
import { loadLiveMatchesFromSupabase, deleteLiveMatchFromSupabase, deleteLiveMatchesFromSupabaseBulk } from '../services/supabaseLiveMatches';
import { parseExcelMatches } from '../utils/excelParser';
import { createMatchesZipBlob, extractMatchesFromZip } from '../utils/zipExportImport';
import { getStableMatchId } from '../utils/matchId';
import LZString from 'lz-string';
import { PATTERN_DESCRIPTIONS, SUB_PATTERN_RULES } from './Patterns';
import { GeminiAnalysis } from './ai/GeminiAnalysis';
import * as Storage from '../services/storage';
import { deduplicateMatches } from '../utils/storageUtils';
import { loadFromSupabase as loadFromSupabase } from '../services/supabaseStorage';
import { FORMULA_DEFINITIONS } from './SystemFormulas';
import { matchAlgorithm } from './ai/algorithm'; // Imported for global training
import { useMatchStars } from '../utils/matchStars';
import { evaluateMatchCategory, getMatchEvaluatorTags, MatchCategory, Priority } from '../utils/matchEvaluator';
import PatternAudit from './PatternAudit';
import { DEFAULT_WEIGHTS, getMatchScore, predictSeerDetailed, predictWithSeer } from '../utils/seerLogic';
import { getOptimizedScoreDetailed, getMatchDayOfWeek, DayOfWeek, clearOptimizedScoreCache, loadServerOpwRules } from '../utils/optimizedweights';
import { generateSeerSlips } from '../utils/seerSlipSelection';
import { generateSeerAiCognitiveSlips } from '../utils/seerAiSlipSelection';
import { saveLockedSlip, SeerLockedSlip, getLockedSlip, preloadSeerSlipsBackground, removeMatchFromSeerSlipsAndReplace } from '../services/seerSlips';
import AppShell from './AppShell';
import { addTombstones, filterTombstoned, hydrateTombstones, removeTombstones } from '../services/matchTombstones';
import { MachineLearningDashboard } from './MachineLearning/MachineLearningDashboard';
import { useMLMatrix } from '../context/MLMatrixContext';
import OPWAlgo from '../opwalgo';

interface MatchAnalysisProps {
    currentUser?: User | null;
    onLogout?: () => void;
    onNavigateAdmin?: () => void;
}

class SafeErrorBoundary extends React.Component<
  { fallback: (error: Error, reset: () => void) => React.ReactNode; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { fallback: (error: Error, reset: () => void) => React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Component Error Caught by SafeErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error, () => this.setState({ hasError: false, error: null }));
    }
    return this.props.children;
  }
}

type ViewMode = 'analysis' | 'live' | 'archive' | 'ai' | 'nerdy' | 'perf' | 'sub_pattern_audit' | 'seer' | 'ml' | 'opw_comp' | 'opw_algo';

const ViewSwitchSkeleton: React.FC<{ view: ViewMode }> = ({ view }) => {
  const title = view === 'live' ? 'Loading Live Analysis' : view === 'archive' ? 'Loading Archives' : view === 'perf' ? 'Loading Performance' : view === 'opw_comp' ? 'Loading OPW Comparison' : view === 'opw_algo' ? 'Loading OPW Recommendations' : 'Loading Workspace';
  return (
    <div className="space-y-4 p-4 md:p-6 animate-pulse" aria-live="polite" aria-busy="true">
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div className="space-y-2">
          <div className="h-3 w-36 rounded bg-muted" />
          <div className="h-2.5 w-56 rounded bg-muted/70" />
        </div>
        <div className="h-9 w-28 rounded-md bg-primary/20" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg border border-border bg-card p-4">
            <div className="mb-3 h-2.5 w-24 rounded bg-muted" />
            <div className="h-6 w-16 rounded bg-muted/80" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> {title}
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-md bg-muted/60" />
          ))}
        </div>
      </div>
    </div>
  );
};

const MatchAnalysis: React.FC<MatchAnalysisProps> = ({ currentUser, onLogout, onNavigateAdmin }) => {
  const { mlData } = useMLMatrix();
  // Navigation State
  const [viewMode, setViewMode] = useState<ViewMode>('analysis');
  const [shellView, setShellView] = useState<ViewMode>('analysis');
  const [isViewPending, startViewTransition] = React.useTransition();
  const [viewPlaceholder, setViewPlaceholder] = useState(false);
  const viewPlaceholderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionDebounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [perfInitialCategory, setPerfInitialCategory] = useState<string>('top12');
  const [perfAutoRun, setPerfAutoRun] = useState<boolean>(false);
  const [opwCompInitialMode, setOpwCompInitialMode] = useState<'aggregate' | 'match_compare'>('aggregate');
  const [activeTab, setActiveTab] = useState('all'); // group1, group2, group3, analysis, all
  
  // Live View Sub-Mode (Daily vs Jackpot)
  const [liveViewType, setLiveViewType] = useState<'daily' | 'jackpot'>('daily');
  // New State for specific Jackpot selection
  const [activeJackpotId, setActiveJackpotId] = useState(JACKPOT_OPTIONS[0].id);

  // Match Type Filter (All, Bankers, Upsets) - Available in all modes
  const [matchTypeFilter, setMatchTypeFilter] = useState<MatchCategory>('all');
  const [activePriority, setActivePriority] = useState<Priority>('all');
  const [showUnderdogWins, setShowUnderdogWins] = useState(false);
  const [showFavWins, setShowFavWins] = useState(false);
  const [showDrawWins, setShowDrawWins] = useState(false);

  // Data State - Initialize empty, then load from Storage
  const [uploadedMatches, setUploadedMatches] = useState<Match[]>([]); 
  const [liveMatches, setLiveMatches] = useState<Match[]>([]); 
  const [archives, setArchives] = useState<{date: string, matches: Match[]}[]>([]); 
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSupabaseSynced, setIsSupabaseSynced] = useState(false);
  const [isRefreshingSubPatt, setIsRefreshingSubPatt] = useState(false);
  const lastSavedUploadedRef = useRef<Match[] | null>(null);
  const lastSavedLiveRef = useRef<Match[] | null>(null);
  
  useEffect(() => {
    // 1. Instantly hydrate live matches and archives from local cache (<10ms)
    Storage.getLiveMatchesAsync().then(lv => {
      if (lv && lv.length > 0) {
        lastSavedLiveRef.current = lv;
        setLiveMatches(lv);
      }
    }).catch(() => {});

    Storage.getArchivesAsync().then(ar => {
      if (ar && ar.length > 0) {
        setArchives(ar);
      }
    }).catch(() => {});

    // 2. Hydrate heavy historical universe in background
    Storage.getUploadedMatchesAsync().then(up => {
      const initialUp = up || [];
      lastSavedUploadedRef.current = initialUp;
      setUploadedMatches(initialUp);
      setIsLoaded(true);
    }).catch(() => {
      setIsLoaded(true);
    });
  }, []);
  
  const [selectedArchiveDate, setSelectedArchiveDate] = useState<string>('');

  const [precalculatedMatches, setPrecalculatedMatches] = useState<Match[]>([]);
  const [loadingCount, setLoadingCount] = useState(0);
  const [processedMatches, setProcessedMatches] = useState<Match[]>([]);
  
  // Load Embedded & Firestore matches with 12-hr cache using LZString compression
  useEffect(() => {
    const fetchPrecalculatedMatches = async () => {
      try {
        let dbMatches: Match[] = [];
        let embeddedMatches: Match[] = [];

        // 1. ALWAYS load embedded matches (costs zero quota, fast static JSON)
        setLoadingCount(1);
        embeddedMatches = await loadEmbeddedMatches();

        // 2. Load Firestore Matches (use cache if fresh)
        // Call loadPrecalculatedMatches to fetch firestore matches - it caches internally in IDB
        setLoadingCount(prev => prev + 1);
        dbMatches = await loadPrecalculatedMatches();

        // Combine and deduplicate (dbMatches should overwrite embeddedMatches if they share the same ID)
        const unique = new Map<string | number, Match>();
        [...embeddedMatches, ...dbMatches].forEach(m => {
           unique.set(m.id, m);
        });

        const withResults = Array.from(unique.values());
        setPrecalculatedMatches(withResults);
        setLoadingCount(0);

      } catch (e) {
        console.error("Error loading precalculated matches:", e);
      }
    };

    fetchPrecalculatedMatches();
  }, []);

  // Hydrate persistent tombstone list once. Loaders already filter using the
  // synchronous local cache; this pulls the authoritative list from Supabase
  // so a fresh device also sees permanent deletions from other sessions.
  useEffect(() => {
    hydrateTombstones().then(() => setTombstoneVersion(v => v + 1)).catch(() => {});
  }, []);


  // Fast-track Live Analysis: Fetch authoritative live matches from database immediately on mount!
  useEffect(() => {
    let active = true;
    const syncLiveImmediate = async () => {
      try {
        const liveFromSupabase = await loadLiveMatchesFromSupabase();
        if (active && liveFromSupabase && liveFromSupabase.length > 0) {
          console.log(`Loaded ${liveFromSupabase.length} live matches from database.`);
          lastSavedLiveRef.current = liveFromSupabase;
          setLiveMatches(liveFromSupabase);
          Storage.saveLiveMatches(liveFromSupabase, false, false);
        }
      } catch (liveSqlErr) {
        console.warn("Failed immediate load of live matches:", liveSqlErr);
      }
    };
    syncLiveImmediate();
    return () => { active = false; };
  }, []);

  // Background synchronize uploaded matches (historical universe) from Supabase after local storage has loaded!
  useEffect(() => {
    if (!isLoaded) return;

    let active = true;
    const syncUploaded = async () => {
      try {
        const uploadedFromSupabase = await loadUploadedMatchesFromSupabase();
        if (active && uploadedFromSupabase && uploadedFromSupabase.length > 0) {
          console.log(`Loaded ${uploadedFromSupabase.length} uploaded/analyzed matches.`);
          lastSavedUploadedRef.current = uploadedFromSupabase;
          setUploadedMatches(uploadedFromSupabase);
          Storage.saveUploadedMatches(uploadedFromSupabase, false, false);
        }
      } catch (uploadSqlErr) {
        console.warn("Failed background load of uploaded matches:", uploadSqlErr);
      } finally {
        if (active) setIsSupabaseSynced(true);
      }
    };

    syncUploaded();
    return () => { active = false; };
  }, [isLoaded]);
  
  // UI State
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  
  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSubPattern, setSearchSubPattern] = useState('');
  const [selected1X2, setSelected1X2] = useState('all');
  const [selectedPattern, setSelectedPattern] = useState('all');
  const [selectedPointsRange, setSelectedPointsRange] = useState('all');
  const [selectedDate, setSelectedDate] = useState('all');
  const userPickedDateRef = useRef(false);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'completed' | 'pending'>('all');
  const [selectedPaaWin, setSelectedPaaWin] = useState('all');
  const [selectedPaaDraw, setSelectedPaaDraw] = useState('all');
  const [selectedPaaUpset, setSelectedPaaUpset] = useState('all');
  const [selectedOpwSort, setSelectedOpwSort] = useState('none');
  const [showFilters, setShowFilters] = useState(false);
  const [weightsVersion, setWeightsVersion] = useState(0);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleWeightsUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        clearOptimizedScoreCache();
        setLiveMatches(prev => {
          if (!prev.some(m => (m as any).lockedOpwScores || (m as any).lockedOpwScore)) {
            return prev;
          }
          const nextArr = prev.map(m => {
            if ((m as any).lockedOpwScores || (m as any).lockedOpwScore) {
              const next = { ...m };
              delete (next as any).lockedOpwScores;
              delete (next as any).lockedOpwScore;
              return next;
            }
            return m;
          });
          lastSavedLiveRef.current = nextArr;
          return nextArr;
        });
        setUploadedMatches(prev => {
          if (!prev.some(m => (m as any).lockedOpwScores || (m as any).lockedOpwScore)) {
            return prev;
          }
          const nextArr = prev.map(m => {
            if ((m as any).lockedOpwScores || (m as any).lockedOpwScore) {
              const next = { ...m };
              delete (next as any).lockedOpwScores;
              delete (next as any).lockedOpwScore;
              return next;
            }
            return m;
          });
          lastSavedUploadedRef.current = nextArr;
          return nextArr;
        });
        setWeightsVersion(v => v + 1);
      }, 60);
    };
    window.addEventListener('optimizedWeightsUpdated', handleWeightsUpdate);
    window.addEventListener('opw-weights-updated', handleWeightsUpdate);
    window.addEventListener('seerLockedSlipsUpdated', handleWeightsUpdate);
    loadServerOpwRules(false).then(days => {
      if (days && days.length > 0) handleWeightsUpdate();
    });
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('optimizedWeightsUpdated', handleWeightsUpdate);
      window.removeEventListener('opw-weights-updated', handleWeightsUpdate);
      window.removeEventListener('seerLockedSlipsUpdated', handleWeightsUpdate);
    };
  }, []);

  const scheduleViewPlaceholder = useCallback(() => {
    // Avoid artificial skeleton blocking when switching views/tabs
    setViewPlaceholder(false);
    if (viewPlaceholderTimeoutRef.current) clearTimeout(viewPlaceholderTimeoutRef.current);
  }, []);

  const runResponsiveUpdate = useCallback((update: () => void, withPlaceholder = false) => {
    if (withPlaceholder) scheduleViewPlaceholder();
    startViewTransition(update);
  }, [scheduleViewPlaceholder, startViewTransition]);

  const runDebouncedAction = useCallback((key: string, action: () => void | Promise<void>, delay = 350) => {
    if (actionDebounceTimers.current[key]) clearTimeout(actionDebounceTimers.current[key]);
    actionDebounceTimers.current[key] = setTimeout(() => {
      delete actionDebounceTimers.current[key];
      React.startTransition(() => {
        void action();
      });
    }, delay);
  }, []);

  const navigateView = useCallback((mode: ViewMode, resetFilters = false) => {
    setShellView(mode);
    scheduleViewPlaceholder();
    window.setTimeout(() => {
      startViewTransition(() => {
        setViewMode(mode);
        if (resetFilters) {
          setMatchTypeFilter('all');
          setSearchQuery('');
          setSelected1X2('all');
          setSelectedPattern('all');
          setSelectedPointsRange('all');
          setSelectedDate('all');
          setActiveTab('all');
        }
      });
    }, 0);
  }, [scheduleViewPlaceholder, startViewTransition]);

  const switchLiveViewType = useCallback((type: 'daily' | 'jackpot') => {
    scheduleViewPlaceholder();
    window.setTimeout(() => {
      startViewTransition(() => setLiveViewType(type));
    }, 0);
  }, [scheduleViewPlaceholder, startViewTransition]);

  useEffect(() => {
    return () => {
      if (viewPlaceholderTimeoutRef.current) clearTimeout(viewPlaceholderTimeoutRef.current);
      Object.values(actionDebounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Seer Slips Automation States
  const [liveLoadTime, setLiveLoadTime] = useState<number | null>(null);
  const [seerAutomationStatus, setSeerAutomationStatus] = useState<string>('');
  const [automationTriggered, setAutomationTriggered] = useState<boolean>(false);

  // Helper for background syncing SEER data (Snapshots + Slips) seamlessly
  const handleBackgroundSeerSync = async (matches: Match[], statsMap: any, starsData: any) => {
      const matchIds = new Set(matches.map(m => m.id));
      const restLive = liveMatches.filter(m => !matchIds.has(m.id));
      
      const todayStr = getLogicalDate(new Date().toISOString().split('T')[0]);
      // Ensure we DO NOT include matches currently in the Analysis Board (uploadedMatches)
      // for TODAY's slips, as the user only wants today's matches from Live Analysis.
      const restUploaded = uploadedMatches.filter(m => 
        !matchIds.has(m.id) && 
        !restLive.some(l => l.id === m.id) &&
        getLogicalDate(m.date || '', m.time) !== todayStr
      );
      
      const allMatches = [...matches, ...restLive, ...restUploaded];

      syncSeerData(allMatches, statsMap, starsData).catch(err => {
          console.error("Seer background sync failed:", err);
      });
  };

  const handlePushNerdyToLive = (rawNerdyMatches: Match[]) => {
    // If the user EXPLICITLY pushes from NerdyTips, we want to allow resurrecting 
    // deleted matches, so we untombstone them.
    removeTombstones(rawNerdyMatches);
    const nerdyMatches = rawNerdyMatches;
    
    let newProcessed: Match[] = [];
    let updatedMatches: Match[] = [...liveMatches];
    let addedCount = 0;
    let updatedCount = 0;

    const normalize = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Prevent matches that were already "Saved & Cleared" (moved to Analysis Board) from reloading
    const clearedMatchKeys = new Set();
    uploadedMatches.forEach(um => {
        const dateStr = um.date ? um.date.split('T')[0].split(' ')[0] : 'Unknown';
        clearedMatchKeys.add(`${normalize(um.teams)}_${dateStr}`);
    });

    const matchIdMap = new Map();
    const matchTeamsDateMap = new Map();
    
    for (let i = 0; i < updatedMatches.length; i++) {
        const m = updatedMatches[i];
        matchIdMap.set(m.id, i);
        const mDateStr = m.date ? m.date.split('T')[0].split(' ')[0] : 'Unknown';
        matchTeamsDateMap.set(`${normalize(m.teams)}_${mDateStr}`, i);
    }

    nerdyMatches.forEach(nm => {
      const nmNormTeams = normalize(nm.teams);
      const nmDateStr = nm.date ? nm.date.split('T')[0].split(' ')[0] : 'Unknown';
      const teamsDateKey = `${nmNormTeams}_${nmDateStr}`;

      // CRITICAL FIX: If match was already cleared and is on Analysis Board, DO NOT push it back to Live Analysis
      if (clearedMatchKeys.has(teamsDateKey)) {
          return; // Skip this match entirely
      }

      let existingIndex = -1;
      if (matchIdMap.has(nm.id)) {
          existingIndex = matchIdMap.get(nm.id);
      } else if (matchTeamsDateMap.has(teamsDateKey)) {
          existingIndex = matchTeamsDateMap.get(teamsDateKey);
      }
      
        if (existingIndex !== -1) {
          // If the match was added in this current batch (its index >= updatedMatches.length),
          // it's an identical duplicate in the nerdyMatches payload, so just skip it.
          if (existingIndex >= updatedMatches.length) return;

          // Match already exists in liveMatches (e.g. as a Daily match or under another jackpot).
          // Update flags and merged jackpotIds so it appears in Live Analysis Jackpot.
          const existing = updatedMatches[existingIndex];
          let changed = false;

        let newIsDaily = existing.isDaily;
        if (nm.isDaily && !existing.isDaily) {
            newIsDaily = true;
            changed = true;
        }

        let newIsJackpot = existing.isJackpot;
        if (nm.isJackpot && !existing.isJackpot) {
            newIsJackpot = true;
            changed = true;
        }

        let newJackpotIds = existing.jackpotIds || [];
        if (nm.isJackpot && nm.jackpotIds && nm.jackpotIds.length > 0) {
            const merged = Array.from(new Set([...newJackpotIds, ...nm.jackpotIds]));
            if (merged.length !== newJackpotIds.length) {
                newJackpotIds = merged;
                changed = true;
            }
        }

        const isValid = (v: any) => v !== undefined && v !== null && v !== '' && v !== '-' && v !== 'Unknown' && v !== 'NA';
        const isValidResult = (v: any) => v !== undefined && v !== null && v !== '' && v !== '-' && v !== 'Unknown' && v !== 'pending';

        const freshRating = isValid(existing.rating) ? existing.rating : (isValid(nm.rating) ? nm.rating : existing.rating);
        const freshPred1x2 = isValid(existing.pred1x2) ? existing.pred1x2 : (isValid(nm.pred1x2) ? nm.pred1x2 : existing.pred1x2);
        const freshL10 = isValid(existing.l10) ? existing.l10 : (isValid(nm.l10) ? nm.l10 : existing.l10);
        const freshLe = isValid(existing.le) ? existing.le : (isValid(nm.le) ? nm.le : existing.le);
        const freshMo = isValid(existing.mo) ? existing.mo : (isValid(nm.mo) ? nm.mo : existing.mo);
        const freshGs = isValid(existing.gs) ? existing.gs : (isValid(nm.gs) ? nm.gs : existing.gs);
        const freshGa = isValid(existing.ga) ? existing.ga : (isValid(nm.ga) ? nm.ga : existing.ga);
        const freshResult = isValidResult(nm.result) ? nm.result : existing.result;

        if (
            (!isValid(existing.rating) && isValid(nm.rating)) ||
            (!isValid(existing.pred1x2) && isValid(nm.pred1x2)) ||
            (!isValid(existing.l10) && isValid(nm.l10)) ||
            (!isValid(existing.le) && isValid(nm.le)) ||
            (!isValid(existing.mo) && isValid(nm.mo)) ||
            (!isValid(existing.gs) && isValid(nm.gs)) ||
            (!isValid(existing.ga) && isValid(nm.ga)) ||
            (isValidResult(nm.result) && existing.result !== nm.result)
        ) {
            changed = true;
        }

        const updatedObj = {
            ...existing,
            result: freshResult,
            isDaily: newIsDaily,
            isJackpot: newIsJackpot,
            jackpotIds: newJackpotIds,
            mo: freshMo,
            gs: freshGs,
            ga: freshGa,
            l10: freshL10,
            le: freshLe,
            rating: freshRating,
            pred1x2: freshPred1x2,
        };

        if (changed) {
            const calcMatch = processMatch({
                ...updatedObj,
                group: updatedObj.group || 0,
                tsa: updatedObj.tsa || 0,
                tsb: updatedObj.tsb || 0,
                isPrecalculated: false,
            }, mlData);
            updatedMatches[existingIndex] = { ...calcMatch, isPrecalculated: true };
            updatedCount++;
        }
        } else {
          // New match - process and add
          const calcMatch = processMatch({ 
            ...nm, 
            result: nm.result || undefined, 
            group: nm.group || 0,
            tsa: nm.tsa || 0,
            tsb: nm.tsb || 0,
            isDaily: nm.isDaily,
            isJackpot: nm.isJackpot,
            jackpotIds: nm.jackpotIds || []
          }, mlData);
          const processed = { ...calcMatch, isPrecalculated: true };
          newProcessed.push(processed);
          addedCount++;
          
          // Update maps to prevent duplicates if nerdyMatches contains duplicates
          const newIndex = updatedMatches.length + newProcessed.length - 1;
          matchIdMap.set(processed.id, newIndex);
          matchTeamsDateMap.set(teamsDateKey, newIndex);
        }
    });

    // Unshift new matches to the top of the live board so they are immediately visible
    if (newProcessed.length > 0) {
        updatedMatches = [...newProcessed, ...updatedMatches];
    }

    if (addedCount === 0 && updatedCount === 0) {
        showNotification("All matches are already up to date in Live Analysis.", "success");
        return;
    }

    // Save state and local storage
    setLiveMatches(updatedMatches);
    Storage.saveLiveMatches(updatedMatches, true, true);
    handleBackgroundSeerSync(updatedMatches, phaStatsMap, matchStars);
    
    // Switch to live view and show success without blocking the click thread
    const firstJackpotId = nerdyMatches.find(m => m.isJackpot && m.jackpotIds && m.jackpotIds.length > 0)?.jackpotIds?.[0];
    setShellView('live');
    scheduleViewPlaceholder();
    startViewTransition(() => {
      setViewMode('live');
      // Reset filters so newly pushed matches (including pending matches without results) are immediately visible
      userPickedDateRef.current = false;
      setSelectedDate('all');
      setSelectedStatus('all');
      setShowFavWins(false);
      setShowUnderdogWins(false);
      setShowDrawWins(false);
      setMatchTypeFilter('all');
      setActivePriority('all');
      setSelected1X2('all');
      setSelectedPattern('all');
      setSelectedPointsRange('all');
      setSearchQuery('');
      setSearchSubPattern('');
      if (nerdyMatches.some(m => m.isJackpot)) {
        setLiveViewType('jackpot');
        if (firstJackpotId) {
          setActiveJackpotId(firstJackpotId);
        }
      } else if (nerdyMatches.some(m => m.isDaily)) {
        setLiveViewType('daily');
      }
    });

    showNotification(`Successfully pushed to Live Analysis: ${addedCount} new added, ${updatedCount} updated.`);
  };

  const handlePushNerdyResultsToLive = (nerdyMatches: Match[]) => {
    let updatedCount = 0;
    
    const normalize = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const nerdyTeamsDateMap = new Map();
    nerdyMatches.forEach(nm => {
        const nmDateStr = nm.date ? nm.date.split('T')[0].split(' ')[0] : 'Unknown';
        nerdyTeamsDateMap.set(`${normalize(nm.teams)}_${nmDateStr}`, nm);
    });

    const newLive = liveMatches.map(lm => {
      const lmDateStr = lm.date ? lm.date.split('T')[0].split(' ')[0] : 'Unknown';
      const teamsDateKey = `${normalize(lm.teams)}_${lmDateStr}`;
      const nerdyMatch = nerdyTeamsDateMap.get(teamsDateKey);
      
      if (nerdyMatch && nerdyMatch.result && nerdyMatch.result !== 'Unknown' && nerdyMatch.result !== '') {
        const normalizedResult = nerdyMatch.result;
        if (lm.result !== normalizedResult) {
          updatedCount++;
          return { ...lm, result: normalizedResult, lockedOpwScores: (lm as any).lockedOpwScores };
        }
      }
      return lm;
    });

    if (updatedCount > 0) {
      setLiveMatches(newLive);
      Storage.saveLiveMatches(newLive, true, true); // Force sync
      handleBackgroundSeerSync(newLive, phaStatsMap, matchStars);
    }
    return updatedCount;
  };

  // Modals State
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [visibleMatchCount, setVisibleMatchCount] = useState(50);
  const [pasteInput, setPasteInput] = useState('');
  const [showDateModal, setShowDateModal] = useState(false);
  const [uploadDate, setUploadDate] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPasteData, setPendingPasteData] = useState<string | null>(null);
  const [pendingSessionType, setPendingSessionType] = useState<'daily' | 'jackpot'>('daily');
  // New: pending jackpot ID for uploads
  const [pendingJackpotId, setPendingJackpotId] = useState(JACKPOT_OPTIONS[0].id);
  const [isImporting, setIsImporting] = useState(false);

  // New Modal State for Analysis Clear Safeguard
  const [showAnalysisClearModal, setShowAnalysisClearModal] = useState(false);
  
  // New Modal State for Live Clear Safeguard
  const [showLiveClearModal, setShowLiveClearModal] = useState(false);
  const [showDeleteVisibleModal, setShowDeleteVisibleModal] = useState(false);
  const [isDeletingVisible, setIsDeletingVisible] = useState(false);
  const [showArchiveDeleteModal, setShowArchiveDeleteModal] = useState(false);
  
  // Formula Modal State
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const [showSubPattModal, setShowSubPattModal] = useState(false);

  const [isUpdatingResults, setIsUpdatingResults] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  
  // Helper to show notifications
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };
  
  // Algo Processing State for Visualization
  const [algoProcessing, setAlgoProcessing] = useState<{ isProcessing: boolean, stage: string, progress: number } | null>(null);
  const matchStars = useMatchStars();

  // Data Integrity Migration: Ensure matches have explicit list flags AND jackpot ID array
  useEffect(() => {
      let changed = false;
      const verified = liveMatches.map(m => {
          let updated = { ...m };
          
          // Legacy Flag Migration
          let isJackpot = !!m.isJackpot;
          let isDaily = m.isDaily;

          if (isDaily === undefined) {
              isDaily = !isJackpot; // Default to daily if not jackpot
          }

          if (m.isDaily !== isDaily || m.isJackpot !== isJackpot) {
              updated.isDaily = isDaily;
              updated.isJackpot = isJackpot;
              changed = true;
          }

          // Legacy Jackpot ID Migration to Array
          if (!updated.jackpotIds) {
              updated.jackpotIds = [];
              if (updated.isJackpot) {
                  if (updated.jackpotId) {
                      updated.jackpotIds.push(updated.jackpotId);
                  } else {
                      // Default legacy jackpot matches without ID to first option
                      updated.jackpotIds.push(JACKPOT_OPTIONS[0].id);
                  }
              }
              changed = true;
          } else if (updated.isJackpot && updated.jackpotIds.length === 0 && updated.jackpotId) {
              // Sync single ID to array if array empty but single exists
              updated.jackpotIds.push(updated.jackpotId);
              changed = true;
          }

          return updated;
      });
      if (changed) setLiveMatches(verified);
  }, []);

  // Sync state to storage (Local and Supabase) ONLY when user actions mutate the array reference
  useEffect(() => {
    if (!isLoaded || !isSupabaseSynced) return;
    if (lastSavedUploadedRef.current === uploadedMatches) return;
    lastSavedUploadedRef.current = uploadedMatches;
    Storage.saveUploadedMatches(uploadedMatches);
  }, [uploadedMatches, isLoaded, isSupabaseSynced]);

  useEffect(() => {
    if (!isLoaded || !isSupabaseSynced) return;
    if (lastSavedLiveRef.current === liveMatches) return;
    lastSavedLiveRef.current = liveMatches;
    Storage.saveLiveMatches(liveMatches);
  }, [liveMatches, isLoaded, isSupabaseSynced]);

  
  // Pre-load Seer Data globally on app load
  useEffect(() => {
    if (!isLoaded) return;
    const runPreload = async () => {
      try {
        await preloadAllSeerData();
      } catch (e) {
        console.warn("Seer global preloading failed", e);
      }
    };
    // Defer execution slightly to not block initial render
    setTimeout(runPreload, 1500);
  }, [isLoaded]);

  // --- GLOBAL DATA AGGREGATION & PHA ---
  
  // Bump this to invalidate memoized derivations after a tombstone add.
  const [tombstoneVersion, setTombstoneVersion] = useState(0);

  // 1. Combine all available history sources
  const allHistory = useMemo(() => {
      // Create a comprehensive list including RAW, Uploaded, and ALL Archives
      // This ensures PHA stats are based on the entire known universe of matches.
      // RAW_MATCHES, precalculatedMatches, uploadedMatches and archives are filtered by tombstones 
      // so any match the user permanently deleted never resurrects on reload or sync.
      const rawFiltered = filterTombstoned<Match>(RAW_MATCHES as Match[]);
      const precalcFiltered = filterTombstoned<Match>(precalculatedMatches);
      const uploadedFiltered = filterTombstoned<Match>(uploadedMatches);
      const hist: Match[] = [...precalcFiltered, ...rawFiltered, ...uploadedFiltered];
      archives.forEach(a => {
          hist.push(...filterTombstoned<Match>(a.matches));
      });
      return hist;
      // tombstoneVersion is intentionally in deps so newly-tombstoned matches
      // fall out of the memo immediately after delete.
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precalculatedMatches, uploadedMatches, archives, tombstoneVersion]);

  const totalLoadedMatchesCount = useMemo(() => {
      // Find all unique matches from all sources that are completed (result is not pending)
      const allHistoricUniqueMap = new Map<string | number, Match>();
      allHistory.forEach(m => {
          if (m.id) {
              allHistoricUniqueMap.set(m.id, m);
          }
      });
      const uniqueList = Array.from(allHistoricUniqueMap.values());
      const completeOnly = uniqueList.filter(m => getActualResult(m.result || '') !== 'pending');
      return completeOnly.length;
  }, [allHistory]);

  const loadedCount = useMemo(() => {
      return processedMatches.length;
  }, [processedMatches]);



  // 2. De-duplicate by ID (Latest version wins)
  const uniqueMatchesMap = useMemo(() => {
      const map = new Map<string | number, Match>();
      
      liveMatches.forEach(m => { if (m.id) map.set(m.id, m); });
      
      allHistory.forEach(m => { 
          if (m.id) {
              if (map.has(m.id)) {
                  const existing = map.get(m.id)!;
                  if (getActualResult(existing.result) === 'pending' && getActualResult(m.result) !== 'pending') {
                      map.set(m.id, m);
                  }
              } else {
                  map.set(m.id, m);
              }
          }
      });
      return map;
  }, [allHistory, liveMatches]);

  // 3. Process ALL unique matches with CURRENT Algorithm
  const [fullProcessedHistory, setFullProcessedHistory] = useState<Match[]>([]);
  const [isHistoryProcessing, setIsHistoryProcessing] = useState(false);
  const lastProcessedFingerprintRef = useRef<string>('');

  // Hydrate fullProcessedHistory from IndexedDB cache immediately on mount for zero startup lag
  useEffect(() => {
    let active = true;
    import('idb-keyval').then(({ get }) => {
      get('prm_full_processed_history_cache_v5').then((cached) => {
        if (active && cached && Array.isArray(cached) && cached.length > 0) {
          setFullProcessedHistory(cached);
        }
      }).catch(() => {});
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const rawFingerprint = useMemo(() => {
    const rawMatches = Array.from(uniqueMatchesMap.values());
    if (rawMatches.length === 0) return '';
    const first = rawMatches[0]?.id || '';
    const last = rawMatches[rawMatches.length - 1]?.id || '';
    return `${rawMatches.length}_${first}_${last}_${tombstoneVersion}_ml_v5`;
  }, [uniqueMatchesMap, tombstoneVersion]);

  useEffect(() => {
      let cancelled = false;
      const rawMatches = Array.from(uniqueMatchesMap.values());
      if (rawMatches.length === 0) return;

      // Skip re-processing if fingerprint has not changed and we already have history
      if (rawFingerprint === lastProcessedFingerprintRef.current && fullProcessedHistory.length > 0) {
          return;
      }

      // Safety watchdog: ensure isHistoryProcessing is never stuck true for more than 8 seconds
      const safetyTimer = setTimeout(() => {
          if (!cancelled) {
              setIsHistoryProcessing(false);
          }
      }, 8000);

      const processHistoryInChunks = async () => {
          // Only show skeleton if we have zero processed matches currently loaded
          if (fullProcessedHistory.length === 0) {
              setIsHistoryProcessing(true);
          }
          await matchAlgorithm.trainChunked(rawMatches, 500, () => cancelled);
          if (cancelled) return;

          const processed: Match[] = [];
          const batchSize = 1000;
          for (let start = 0; start < rawMatches.length; start += batchSize) {
              if (cancelled) return;
              const batch = rawMatches.slice(start, start + batchSize).map((raw: Match) => {
                  if ((raw as any).isPrecalculated && (raw as any).patternAnalysis && (raw as any).mlInfo) {
                      return raw;
                  }
                  let p = (raw as any).isPrecalculated && (raw as any).patternAnalysis ? { ...raw } : processMatch(raw, mlData);
                  p.mlInfo = (raw as any).mlInfo || predictWithHybridML(p, mlData);
                  return p;
              });
              processed.push(...batch);
              // Yield to main event loop to ensure zero browser freeze
              await new Promise<void>(resolve => setTimeout(resolve, 0));
          }

          if (!cancelled) {
              clearTimeout(safetyTimer);
              lastProcessedFingerprintRef.current = rawFingerprint;
              React.startTransition(() => {
                  setFullProcessedHistory(processed);
                  setIsHistoryProcessing(false);
              });
              // Cache in IndexedDB for instant reload on next session
              import('idb-keyval').then(({ set }) => {
                  set('prm_full_processed_history_cache_v5', processed).catch(() => {});
              }).catch(() => {});
          }
      };

      processHistoryInChunks().catch(err => {
          console.error('History processing failed:', err);
          clearTimeout(safetyTimer);
          if (!cancelled) setIsHistoryProcessing(false);
      });

      return () => {
          cancelled = true;
          clearTimeout(safetyTimer);
      };
  }, [uniqueMatchesMap, rawFingerprint, mlData]);

  // 3b. Create a filtered version of processed history containing only saved/historic/pushed matches for the Analysis Board
  const savedProcessedHistory = useMemo(() => {
      const savedIds = new Set(allHistory.map(m => m.id));
      return fullProcessedHistory.filter(m => savedIds.has(m.id));
  }, [fullProcessedHistory, allHistory]);

  // 4. Calculate PHA Stats based on Full Processed History
  // Extract the cutoff date first so switching between live/nerdy/opw_algo/seer does NOT recompute PHA over 19,000 matches!
  const isArchiveMode = viewMode === 'archive';
  const isAnalysisMode = viewMode === 'analysis';
  const phaTargetDate = useMemo(() => {
      let targetDate = isArchiveMode && selectedArchiveDate ? selectedArchiveDate : getAnalysisDateString();
      if (!isArchiveMode && !isAnalysisMode && liveMatches && liveMatches.length > 0) {
          const activeLiveMatches = liveMatches.filter(m =>
              liveViewType === 'jackpot' ? Boolean(m.isJackpot) : (m.isDaily !== undefined ? m.isDaily : !m.isJackpot)
          );
          const targetDateMs = new Date(`${targetDate}T00:00:00Z`).getTime();
          const maxBacktrackMs = 3 * 24 * 60 * 60 * 1000;
          const liveLogicalDates = activeLiveMatches
              .map(m => getLogicalDate(m.date || '', m.time))
              .filter(d => {
                  if (!d) return false;
                  const dMs = new Date(`${d}T00:00:00Z`).getTime();
                  if (Number.isNaN(dMs) || Number.isNaN(targetDateMs)) return true;
                  return targetDateMs - dMs <= maxBacktrackMs;
              });
          if (liveLogicalDates.length > 0) {
              const earliestLive = [...liveLogicalDates].sort()[0];
              if (earliestLive && earliestLive < targetDate) {
                  targetDate = earliestLive;
              }
          }
      }
      return targetDate;
  }, [isArchiveMode, isAnalysisMode, selectedArchiveDate, liveMatches, liveViewType]);

  const phaStatsMap = useMemo(() => {
      const stats: Record<string, { total: number; paaTotal: number; correct: number; outcomes: { '1': number; 'X': number; '2': number }; favWin: number; draw: number; upsetWin: number }> = {};
      const targetDate = phaTargetDate;
      const liveIdSet = new Set((liveMatches || []).map(m => String(m.id)));

      fullProcessedHistory.forEach(m => {
          // Prevent data leakage & slip drifting:
          // 1. Exclude any match that is currently in the active live pool
          if (liveIdSet.has(String(m.id))) return;

          // 2. Exclude matches whose logical date or date is on or after targetDate (respecting 9:00 AM -> 8:59 AM day boundary)
          const mLogDate = getLogicalDate(m.date || '', m.time);
          if (mLogDate ? mLogDate >= targetDate : (m.date && m.date >= targetDate)) return;

          const sub = m.patternAnalysis?.subPattern;
          if (sub) {
              if (!stats[sub]) stats[sub] = { total: 0, paaTotal: 0, correct: 0, outcomes: { '1': 0, 'X': 0, '2': 0 }, favWin: 0, draw: 0, upsetWin: 0 };
              const actual = getActualResult(m.result);
              if (actual !== 'pending') {
                  stats[sub].total++;
                  const pred = m.finalPrediction || m.rawPrediction || '1';
                  if (matchesPrediction(pred, actual)) stats[sub].correct++;
                  if (actual === '1' || actual === 'X' || actual === '2') stats[sub].outcomes[actual]++;
                  
                  // PAA Logic: Fav Win, Draw, Upset
                  const favInfo = getFavoriteAndUnderdog(m);
                  if (favInfo) {
                    const { fav: moFav, underdog: moUnderdog } = favInfo;
                    stats[sub].paaTotal++;
                    if (actual === moFav) stats[sub].favWin++;
                    else if (actual === 'X') stats[sub].draw++;
                    else if (actual === moUnderdog) stats[sub].upsetWin++;
                  }
              }
          }
      });
      return stats;
  }, [fullProcessedHistory, phaTargetDate, liveMatches]);

  // Preload SEER Optimized Slips in background on App startup (at most once per dataset size)
  const lastPreloadKeyRef = useRef<string>('');
  useEffect(() => {
    if (!isLoaded) return;
    const preloadKey = `${liveMatches.length}_${uploadedMatches.length}`;
    if (lastPreloadKeyRef.current === preloadKey) return;
    const timer = setTimeout(() => {
      lastPreloadKeyRef.current = preloadKey;
      preloadSeerSlipsBackground({
        liveMatches,
        uploadedMatches,
        phaStatsMap,
        matchStars,
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [isLoaded, liveMatches.length, uploadedMatches.length, phaStatsMap, matchStars]);


  // --- VIEW LOGIC ---

  // 1. Memoize tagged live matches
  const taggedLiveMatches = useMemo(() => {
        // Removed viewMode early return to prevent recalculating on tab switch

      return liveMatches.map(m => {
          const processed = { ...((m as any).isPrecalculated && (m as any).patternAnalysis ? m : processMatch(m, mlData)) };
          processed.mlInfo = predictWithHybridML(processed, mlData);
          const sub = processed.patternAnalysis?.subPattern;
          if (sub && phaStatsMap[sub]) {
              const stats = phaStatsMap[sub];
              const denom = stats.paaTotal > 0 ? stats.paaTotal : stats.total;
              if (denom > 0) {
                  processed.paaWin = (stats.favWin / denom) * 100;
                  processed.paaDraw = (stats.draw / denom) * 100;
                  processed.paaUpset = (stats.upsetWin / denom) * 100;
              } else {
                  processed.paaWin = 0; processed.paaDraw = 0; processed.paaUpset = 0;
              }
              if (stats.total > 0 || stats.paaTotal > 0) {
                  const paaPred = calculatePAAPrediction(processed, stats);
                  if (paaPred) {
                      processed.paaPrimaryPrediction = paaPred.paaPrimaryPrediction;
                      processed.paaPrediction = paaPred.paaPrediction;
                  }

                  // We NO LONGER overwrite the pattern prediction. The rule prediction stands as the sole source.
                  const phaPred = calculatePHAPrediction(stats);
              }
          } else {
              processed.paaWin = 0; processed.paaDraw = 0; processed.paaUpset = 0;
          }

          processed.evaluatorTags = getMatchEvaluatorTags(processed, phaStatsMap, liveViewType === 'jackpot', true, matchStars);

          // Cache on source match
          m.evaluatorTags = processed.evaluatorTags;
          m.paaWin = processed.paaWin;
          m.paaDraw = processed.paaDraw;
          m.paaUpset = processed.paaUpset;
          m.paaPrimaryPrediction = processed.paaPrimaryPrediction;
          m.paaPrediction = processed.paaPrediction;
          m.mlInfo = processed.mlInfo;
          if (processed.patternAnalysis) m.patternAnalysis = processed.patternAnalysis;
          if (processed.algoReport) m.algoReport = processed.algoReport;
          if (processed.totalPoints) m.totalPoints = processed.totalPoints;

          return processed;
      });
  }, [liveMatches, phaStatsMap, matchStars, liveViewType, mlData, weightsVersion]);

  const liveMatchDay = useMemo<DayOfWeek>(() => {
    const counts: Partial<Record<DayOfWeek, number>> = {};
    const pool = (taggedLiveMatches && taggedLiveMatches.length > 0) ? taggedLiveMatches : (liveMatches || []);
    if (pool && pool.length > 0) {
      pool.forEach(m => {
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
  }, [taggedLiveMatches, liveMatches]);

  // 2. Memoize tagged historic matches (reuses savedProcessedHistory directly)
  const taggedHistoricMatches = useMemo(() => {
      const unique = Array.from(new Map(savedProcessedHistory.map(item => [item.id, item])).values());
      return unique.map(m => {
          if (m.paaWin !== undefined) {
              return m;
          }
          const processed = { ...m };
          // Evaluator tags are calculated asynchronously in the background process.
          // Don't block the UI thread calculating them here for 19,000 matches.
          
          const sub = processed.patternAnalysis?.subPattern;
          if (sub && phaStatsMap[sub]) {
              const stats = phaStatsMap[sub];
              const denom = stats.paaTotal > 0 ? stats.paaTotal : stats.total;
              if (denom > 0) {
                  processed.paaWin = (stats.favWin / denom) * 100;
                  processed.paaDraw = (stats.draw / denom) * 100;
                  processed.paaUpset = (stats.upsetWin / denom) * 100;
              } else {
                  processed.paaWin = 0; processed.paaDraw = 0; processed.paaUpset = 0;
              }
              if (stats.total > 0 || stats.paaTotal > 0) {
                  const paaPred = calculatePAAPrediction(processed, stats);
                  if (paaPred) {
                      processed.paaPrimaryPrediction = paaPred.paaPrimaryPrediction;
                      processed.paaPrediction = paaPred.paaPrediction;
                  }
              }
          } else {
              processed.paaWin = 0; processed.paaDraw = 0; processed.paaUpset = 0;
          }

          // Cache on source match
          m.evaluatorTags = processed.evaluatorTags;
          m.paaWin = processed.paaWin;
          m.paaDraw = processed.paaDraw;
          m.paaUpset = processed.paaUpset;
          m.paaPrimaryPrediction = processed.paaPrimaryPrediction;
          m.paaPrediction = processed.paaPrediction;
          m.mlInfo = processed.mlInfo;
          if (processed.patternAnalysis) m.patternAnalysis = processed.patternAnalysis;
          if (processed.algoReport) m.algoReport = processed.algoReport;
          if (processed.totalPoints) m.totalPoints = processed.totalPoints;

          return processed;
      });
  }, [savedProcessedHistory, phaStatsMap]);

  // Memoize fast lookup map for background calculated fields (like SEER) once when fullProcessedHistory updates
  const fullHistoryMap = useMemo(() => {
    return new Map<string | number, Match>(fullProcessedHistory.map(m => [m.id, m]));
  }, [fullProcessedHistory]);

  useEffect(() => {
    if (viewMode === 'nerdy') {
      return;
    }

    let sourceData: Match[] = [];
    if (viewMode === 'analysis') {
      sourceData = taggedHistoricMatches;
    } else if (viewMode === 'ai') {
      sourceData = taggedLiveMatches;
    } else if (viewMode === 'live' || viewMode === 'perf' || viewMode === 'opw_comp' || viewMode === 'opw_algo') {
      if (liveViewType === 'jackpot') {
        sourceData = taggedLiveMatches.filter(m => m.isJackpot && (m.jackpotIds?.includes(activeJackpotId) || m.jackpotId === activeJackpotId));
      } else {
        sourceData = taggedLiveMatches.filter(m => m.isDaily ?? !m.isJackpot);
      }
    } else if (viewMode === 'seer') {
      sourceData = taggedLiveMatches;
    } else if (viewMode === 'archive') {
      const archive = archives.find(a => a.date === selectedArchiveDate);
      if (archive) {
          sourceData = archive.matches.map(m => {
              const processed = { ...m };
              if (!processed.evaluatorTags) {
                  processed.evaluatorTags = getMatchEvaluatorTags(processed, phaStatsMap, false, true, matchStars);
              }
              return processed;
          });
      }
    }
    
    // De-duplicate by ID if mixing sources, and merge background calculated fields
    const unique = Array.from(new Map<string | number, Match>(sourceData.map(item => {
        const historyMatch = fullHistoryMap.get(item.id);
        const merged = historyMatch && (historyMatch.seerPrediction || historyMatch.seerScores) ? { 
            ...item, 
            seerPrediction: historyMatch.seerPrediction, 
            seerPrimaryPrediction: historyMatch.seerPrimaryPrediction, 
            seerPercentages: historyMatch.seerPercentages, 
            seerScores: historyMatch.seerScores 
        } : item;
        return [item.id, merged];
      })).values());
    const finalMatches = viewMode === 'analysis' ? (unique as Match[]) : deduplicateMatches(unique as Match[]);
    React.startTransition(() => setProcessedMatches(finalMatches));
    }, [viewMode, taggedLiveMatches, taggedHistoricMatches, selectedArchiveDate, archives, liveViewType, activeJackpotId, phaStatsMap, matchStars, fullHistoryMap]); 
  // Dependency on fullProcessedHistory ensures view updates if training model changes stats

  // Derived: Processed Live Matches (Subset of processedMatches that corresponds to Live Session)
  const processedLiveMatches = useMemo(() => {
      const liveIds = new Set(liveMatches.map(m => m.id));
      let filtered = processedMatches.filter(m => liveIds.has(m.id));
      if (selectedDate !== 'all') {
          filtered = filtered.filter(m => getLogicalDate(m.date || '', m.time) === selectedDate);
      }
      return filtered;
  }, [processedMatches, liveMatches, selectedDate]);

  // Stabilized props for React.memo(OPWAlgo)
  const opwAlgoMatches = useMemo(() => {
    if (processedLiveMatches.length > 0) return processedLiveMatches;
    if (selectedDate !== 'all') {
      return taggedLiveMatches.filter(m => getLogicalDate(m.date || '', m.time) === selectedDate);
    }
    return taggedLiveMatches;
  }, [processedLiveMatches, selectedDate, taggedLiveMatches]);

  const opwAlgoInitialCategory = useMemo(() => {
    switch (matchTypeFilter) {
      case 'top12':
      case 'top10':
      case 'top20': return 'top_12_value';
      case 'value_bets': return 'value_bets';
      case 'best_bet': return 'best_bet';
      case 'bankers_dlive': return 'bankers_dlive';
      case 'bankers_jackpot': return 'bankers_jackpot';
      case 'upsets': return 'upsets';
      case 'botb_best': return 'botb_best';
      default: return 'top_12_value';
    }
  }, [matchTypeFilter]);

  const opwAlgoInitialDay = useMemo(() => {
    return selectedDate && selectedDate !== 'all'
      ? getMatchDayOfWeek({ date: selectedDate } as Match)
      : liveMatchDay;
  }, [selectedDate, liveMatchDay]);

  const handleOpwAlgoBack = useCallback(() => {
    navigateView('live');
  }, [navigateView]);

  // Helper to map category to weights
  const getWeightsForCategory = (catId: string, hType: 'daily' | 'jackpot') => {
    let mappedKey = catId;
    if (catId === 'safety') {
      mappedKey = 'best_bet';
    } else if (catId === 'banker') {
      mappedKey = 'bankers_dlive';
    } else if (catId === 'upset') {
      mappedKey = 'upsets';
    } else if (catId === 'jackpot') {
      mappedKey = 'top_12_value';
    }

    const modePrefix = hType === 'jackpot' ? 'jackpot_' : 'daily_';
    const effectiveKey = `${modePrefix}${mappedKey}`;
    const seerWeights = Storage.getSeerWeights();

    return (
      seerWeights[effectiveKey] ||
      seerWeights[mappedKey] ||
      seerWeights[`${modePrefix}${catId}`] ||
      seerWeights[catId] ||
      DEFAULT_WEIGHTS
    );
  };

  // Handler for executing automated Seer category slip selection & locking in the background
  const executeBackgroundSeerAutomation = async () => {
    if (!processedLiveMatches || processedLiveMatches.length === 0) {
      setSeerAutomationStatus('');
      return;
    }

    setSeerAutomationStatus('[Seer Slips Automation] Running background selection algorithm...');
    console.log('[Seer Automation] Running pre-selection algorithm in background...');

    try {
      const hType = liveViewType;

      const slipCategories = [
        {
          id: "banker",
          name: "Elite Bankers",
          targetTags: ["bankers_jackpot", "bankers_dlive"],
          minSeer: 33,
          maxPicks: 10,
        },
        {
          id: "upset",
          name: "High-Value Upsets",
          targetTags: ["upsets", "value_bets"],
          minSeer: 25,
          maxPicks: 10,
        },
        {
          id: "jackpot",
          name: "Jackpot Boosters",
          targetTags: ["bankers_jackpot", "top12", "top10"],
          minSeer: 30,
          maxPicks: 10,
        },
        { id: "safety", name: "Safety Net", targetTags: ["best_bet"], minSeer: 35, maxPicks: 10 },
      ];

      let lockedAny = false;

      // Group matches by their actual Analysis Date
      const matchesByDate = processedLiveMatches.reduce((acc: Record<string, any[]>, m: any) => {
        const d = getLogicalDate(m.date, m.time);
        if (!acc[d]) acc[d] = [];
        acc[d].push(m);
        return acc;
      }, {});

      for (const [dateStr, matchesForDate] of Object.entries(matchesByDate)) {
        for (const cat of slipCategories) {
          // Skip if a locked slip already exists for this date+category
          const existingSlip = localStorage.getItem(`local_locked_slip_${dateStr}_${cat.id}`);
          if (existingSlip) {
            try {
              const parsed = JSON.parse(existingSlip);
              if (parsed && parsed.picks && parsed.picks.length > 0) continue;
            } catch(e) {}
          }

          const catWeights = getWeightsForCategory(cat.id, hType);
          
          // Filter recommendations using the stabilized match-card analytics
          const matchesToShow = matchesForDate.filter((m: any) => {
            // Calculate tags
            const tags = m.evaluatorTags && m.evaluatorTags.length > 0 ? m.evaluatorTags : getMatchEvaluatorTags(m, phaStatsMap, hType === 'jackpot', true, matchStars);
            const hardBans = tags.filter(
              (t) => t.startsWith("BANNED:") && t !== "PHA_TIE",
            );
            if (hardBans.length > 0) return false;

            const matchesCategory = cat.targetTags.some((tt) =>
              tags.some((t) => t.includes(tt)),
            );
            if (!matchesCategory) return false;

            const p1 = getMatchScore(m, "1", catWeights, phaStatsMap, matchStars);
            const p2 = getMatchScore(m, "2", catWeights, phaStatsMap, matchStars);
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

            if (cat.id === "banker" && conflictRes === "upset_win") return false;
            if (cat.id === "upset" && conflictRes === "banker_win") return false;

            const score = Math.max(
              p1,
              p2,
              getMatchScore(m, "X", catWeights, phaStatsMap, matchStars),
            );
            return score >= cat.minSeer;
          });

          if (matchesToShow.length > 0) {
            // Sort
            matchesToShow.sort((a: any, b: any) => {
              const tagsA = a.evaluatorTags && a.evaluatorTags.length > 0 ? a.evaluatorTags : getMatchEvaluatorTags(a, phaStatsMap, hType === 'jackpot', true, matchStars);
              const tagsB = b.evaluatorTags && b.evaluatorTags.length > 0 ? b.evaluatorTags : getMatchEvaluatorTags(b, phaStatsMap, hType === 'jackpot', true, matchStars);
              const p1A = getMatchScore(a, "1", catWeights, phaStatsMap, matchStars);
              const p2A = getMatchScore(a, "2", catWeights, phaStatsMap, matchStars);
              const p1B = getMatchScore(b, "1", catWeights, phaStatsMap, matchStars);
              const p2B = getMatchScore(b, "2", catWeights, phaStatsMap, matchStars);

              const scoreA = Math.max(p1A, p2A) - (tagsA.includes("PHA_TIE") ? 100 : 0);
              const scoreB = Math.max(p1B, p2B) - (tagsB.includes("PHA_TIE") ? 100 : 0);
              return scoreB - scoreA;
            });

            // Slice to max picks if defined
            const maxPicks = cat.maxPicks || 10;
            const slicedMatches = matchesToShow.slice(0, maxPicks);

            const matchDay = getMatchDayOfWeek({ date: dateStr } as Match);
            // Build Seer slip picks using clean model representations
            const picks = slicedMatches.map((m) => {
              const pred = m.seerPrediction || m.seerPrimaryPrediction || m.finalPrediction || m.rawPrediction || "1";
              const optScore = phaStatsMap ? getOptimizedScoreDetailed(m, cat.id, phaStatsMap, matchDay) : null;
              return {
                match_id: m.id,
                team: m.teams,
                prediction: pred,
                primaryPrediction: pred,
                odds: m.mo?.split(",")[0] || "1.0",
                reason: "Automated Background Selection",
                confidence: "100%",
                category: cat.id,
                le: m.le || "",
                l10: m.l10 || "",
                rating: m.rating || "",
                gs: m.gs || "",
                ga: m.ga || "",
                league: m.league || "",
                evaluatorTags: m.evaluatorTags || [],
                opwPoints: optScore?.totalScore,
                opwRulesHit: optScore?.rulesHit,
                opwBaseInfo: optScore?.baseInfo,
              };
            });

            const slip: SeerLockedSlip = {
              id: `${dateStr}_${cat.id}`,
              date: dateStr,
              category: cat.id,
              picks: picks,
              backups: [],
              weightsAtTime: catWeights,
              createdAt: new Date().toISOString(),
              type: hType,
            };

            // Save locked slip. forceOverwrite: false guarantees we never alter any manually locked slips
            await saveLockedSlip(slip, false);
            lockedAny = true;
          }
        }

        // Also lock the main category slips using generateSeerSlips
        const matchDay = getMatchDayOfWeek({ date: dateStr } as Match);
        const slipsObj = generateSeerSlips(matchesForDate, phaStatsMap, matchStars, hType === 'jackpot', false, matchDay);
        const allMainCats = [
          "top_12_value", "top_10_value", "best_bet", "bankers_dlive", "botb_best", 
          "high_confidence", "bankers_jackpot", "banker_draws", 
          "value_picks", "value_bets", "upsets"
        ];
        
        for (const catId of allMainCats) {
          // Skip if a locked slip already exists for this date+category
          const existingMainSlip = localStorage.getItem(`local_locked_slip_${dateStr}_${catId}`);
          if (existingMainSlip) {
            try {
              const parsed = JSON.parse(existingMainSlip);
              if (parsed && parsed.picks && parsed.picks.length > 0) continue;
            } catch(e) {}
          }

          const picksData = slipsObj.live[catId] || slipsObj.spec[catId];
          if (picksData && picksData.length > 0) {
            const picks = picksData.map((p: any) => ({
                match_id: p.match_id,
                team: p.team || "",
                prediction: p.prediction || "1",
                primaryPrediction: p.prediction || "1",
                odds: p.odds || "1.0",
                reason: p.reason || "Automated Background Selection",
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
            const slip: SeerLockedSlip = {
              id: `${dateStr}_${catId}`,
              date: dateStr,
              category: catId,
              picks: picks,
              backups: [],
              weightsAtTime: DEFAULT_WEIGHTS,
              createdAt: new Date().toISOString(),
              type: hType,
            };
            await saveLockedSlip(slip, false);
            lockedAny = true;
          }
        }

        // Note: AI Slips are generated strictly on demand by user click and are not pre-generated in background
      }

      if (lockedAny) {
        setSeerAutomationStatus('[Seer Slips Automation] Category slips pre-selection completed and saved!');
        window.dispatchEvent(new Event('seerLockedSlipsUpdated'));
      } else {
        setSeerAutomationStatus('[Seer Slips Automation] Slip check completed. No new qualifiers.');
      }

      setTimeout(() => {
        setSeerAutomationStatus('');
      }, 7000);

    } catch (err) {
      console.error('[Seer Automation] failed:', err);
      setSeerAutomationStatus('[Seer Slips Automation] Auto-selection error.');
      setTimeout(() => setSeerAutomationStatus(''), 5000);
    }
  };

  // Trigger loading timeout tracking when processedLiveMatches has matches and loads
  useEffect(() => {
    let isMounted = true;

    const checkAutomationReady = async () => {
      if (processedLiveMatches && processedLiveMatches.length > 0) {
        const dates = Array.from(new Set(processedLiveMatches.map((m: any) => getLogicalDate(m.date, m.time))));
        let needsAutomation = false;

        for (const d of dates) {
          // Check if primary slips exist in localStorage first (extremely fast and synchronous)
          const localBestBet = localStorage.getItem(`local_locked_slip_${d}_best_bet`);
          const localTop12 = localStorage.getItem(`local_locked_slip_${d}_top_12_value`) || localStorage.getItem(`local_locked_slip_${d}_top_10_value`);

          if (localBestBet && localTop12) {
            continue;
          }

          // If any is missing from localStorage, check getLockedSlip
          const bestBet = localBestBet ? JSON.parse(localBestBet) : await getLockedSlip(d, 'best_bet');
          const top12 = localTop12 ? JSON.parse(localTop12) : ((await getLockedSlip(d, 'top_12_value')) || (await getLockedSlip(d, 'top_10_value')));
          
          if (!bestBet || !top12) {
            needsAutomation = true;
            break;
          }
        }

        if (!isMounted) return;

        if (needsAutomation) {
          if (liveLoadTime === null) {
            setLiveLoadTime(Date.now());
            setAutomationTriggered(false);
          }
        } else {
          // Already generated and locked, prevent automation loop
          setLiveLoadTime(null);
          setSeerAutomationStatus('');
          setAutomationTriggered(true);
        }
      } else {
        if (!isMounted) return;
        setLiveLoadTime(null);
        setSeerAutomationStatus('');
        setAutomationTriggered(false);
      }
    };

    checkAutomationReady();
    return () => { isMounted = false; };
  }, [processedLiveMatches]);

  useEffect(() => {
    const handleReset = () => {
      setLiveLoadTime(Date.now());
      setAutomationTriggered(false);
      setSeerAutomationStatus('[Seer Slips Automation] Re-evaluating...');
    };
    window.addEventListener("resetSeerAutomation", handleReset);
    return () => window.removeEventListener("resetSeerAutomation", handleReset);
  }, []);

  // Handle automated action triggering (without 1-second interval re-render storm)
  useEffect(() => {
    if (liveLoadTime === null || automationTriggered) return;

    setSeerAutomationStatus('[Seer Slips Automation] Matches loaded. Background pre-selection scheduled...');

    const timer = setTimeout(() => {
      setAutomationTriggered(true);
      executeBackgroundSeerAutomation();
    }, 60000);

    return () => clearTimeout(timer);
  }, [liveLoadTime, automationTriggered, processedLiveMatches, phaStatsMap, matchStars, liveViewType]);

  // View-Specific Data for Clearing Logic
  const currentViewMatches = useMemo(() => {
      if (liveViewType === 'jackpot') {
          return liveMatches.filter(m => m.isJackpot && (m.jackpotIds?.includes(activeJackpotId) || m.jackpotId === activeJackpotId));
      }
      return liveMatches.filter(m => m.isDaily ?? !m.isJackpot);
  }, [liveMatches, liveViewType, activeJackpotId]);

  // Check if CURRENT VIEW matches are saved to the analysis board
  const isCurrentViewSaved = useMemo(() => {
      if (currentViewMatches.length === 0) return true;
      const uploadedIds = new Set(uploadedMatches.map(m => m.id));
      return currentViewMatches.every(m => uploadedIds.has(m.id));
  }, [currentViewMatches, uploadedMatches]);

  useEffect(() => {
    setVisibleMatchCount(50);
  }, [searchQuery, activeTab, viewMode, matchTypeFilter, selected1X2, selectedPattern, selectedPointsRange, selectedDate]);

  // --- FILTERING LOGIC ---
  const displayMatches = useMemo(() => {
    let filtered = processedMatches;

    // Filter based on Live View Type strictly to allow shared visibility
    if (viewMode === 'live') {
        if (liveViewType === 'jackpot') {
            filtered = filtered.filter(m => m.isJackpot && (m.jackpotIds?.includes(activeJackpotId) || m.jackpotId === activeJackpotId));
        } else {
            filtered = filtered.filter(m => m.isDaily ?? !m.isJackpot);
        }
    } 

    // 1. Search Filter
    const hasSearch = searchQuery.trim().length > 0;
    if (hasSearch) {
      filtered = filtered.filter(m => m.teams.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    // Sub Pattern Text Search
    if (searchSubPattern.trim()) {
      const lowerQuery = searchSubPattern.toLowerCase();
      filtered = filtered.filter(m => m.patternAnalysis?.subPattern?.toLowerCase().includes(lowerQuery));
    }

    if (showUnderdogWins) {
        filtered = filtered.filter(m => {
            const actual = getActualResult(m.result || '');
            if (actual === 'pending' || !actual || !m.mo) return false;
            const parts = m.mo.split(/[- ,]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
            if (parts.length >= 3) {
                const o1 = parts[0];
                const o2 = parts[2];
                if (o1 === o2) return false;
                const moUnderdog = o1 < o2 ? '2' : '1';
                return actual === moUnderdog;
            }
            return false;
        });
    }

    if (showFavWins) {
        filtered = filtered.filter(m => {
            const actual = getActualResult(m.result || '');
            if (actual === 'pending' || !actual || !m.mo) return false;
            const parts = m.mo.split(/[- ,]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
            if (parts.length >= 3) {
                const o1 = parts[0];
                const o2 = parts[2];
                if (o1 === o2) return false;
                const moFav = o1 < o2 ? '1' : '2';
                return actual === moFav;
            }
            return false;
        });
    }

    if (showDrawWins) {
        filtered = filtered.filter(m => getActualResult(m.result || '') === 'X');
    }

    // 2. Match Type Filter & Priority Filter
    if (matchTypeFilter !== 'all') {
        let categoryMatches = filtered.filter(m => {
            if (matchTypeFilter === 'pending' || matchTypeFilter === 'banned') {
                return evaluateMatchCategory(m, matchTypeFilter, 'all', phaStatsMap, liveViewType === 'jackpot', true);
            }
            const tags = (m.evaluatorTags && m.evaluatorTags.length > 0)
                ? m.evaluatorTags
                : (m.evaluatorTags = getMatchEvaluatorTags(m, phaStatsMap, liveViewType === 'jackpot', true, matchStars));
            if (matchTypeFilter === 'top12' || matchTypeFilter === 'top10') {
                return tags.some(t => t.startsWith('top12:') || t.startsWith('top10:'));
            }
            return tags.some(t => t.startsWith(`${matchTypeFilter}:`));
        });
        
        const mapFilterToOwCategory = (filter: string) => {
            switch (filter) {
                case 'top12':
                case 'top10': return 'top_12_value';
                case 'top20': return 'high_confidence';
                case 'value_bets': return 'value_bets';
                default: return filter === 'all' ? 'top_12_value' : filter;
            }
        };

        // Sort by Seer Score or OPW
        const categoryMatchesWithScores = categoryMatches.map(m => {
            let sortScore = 0;
            const mappedCat = mapFilterToOwCategory(matchTypeFilter);
            if (selectedOpwSort !== 'none') {
                let catId: string = matchTypeFilter;
                if (selectedOpwSort.startsWith('t12_')) catId = 'top_12_value';
                else if (selectedOpwSort.startsWith('bb_')) catId = 'best_bet';
                else if (selectedOpwSort.startsWith('bd_')) catId = 'bankers_dlive';
                else if (selectedOpwSort.startsWith('ups_')) catId = 'upsets';
                else if (selectedOpwSort.startsWith('bj_')) catId = 'bankers_jackpot';
                else if (selectedOpwSort.startsWith('vp_')) catId = 'value_picks';
                else if (selectedOpwSort.startsWith('vb_')) catId = 'value_bets';
                else {
                    if (catId === 'top12' || catId === 'top10') catId = 'top_12_value';
                    if (catId === 'top20') catId = 'high_confidence';
                    if (catId === 'value_bets') catId = 'value_bets';
                    if (catId === 'all') catId = 'top_12_value'; // fallback
                }
                const matchDay = getMatchDayOfWeek(m);
                sortScore = getOptimizedScoreDetailed(m, catId, phaStatsMap, matchDay).totalScore;
            } else if (matchTypeFilter !== 'all' && mappedCat && mappedCat !== 'all' && matchTypeFilter !== 'pending' && matchTypeFilter !== 'banned') {
                // When viewing a specific category filter, sort by that category's calibrated OPW points
                const matchDay = getMatchDayOfWeek(m);
                sortScore = getOptimizedScoreDetailed(m, mappedCat, phaStatsMap, matchDay).totalScore;
            } else {
                sortScore = Math.max(
                    getMatchScore(m, '1', DEFAULT_WEIGHTS, phaStatsMap, matchStars),
                    getMatchScore(m, 'X', DEFAULT_WEIGHTS, phaStatsMap, matchStars),
                    getMatchScore(m, '2', DEFAULT_WEIGHTS, phaStatsMap, matchStars)
                );
            }
            return { match: m, sortScore };
        });

        categoryMatchesWithScores.sort((a, b) => {
            const isDesc = selectedOpwSort !== 'none' 
                ? (selectedOpwSort.endsWith('desc') || selectedOpwSort === 'desc') 
                : true; // default is descending
            return isDesc ? b.sortScore - a.sortScore : a.sortScore - b.sortScore;
        });

        categoryMatches = categoryMatchesWithScores.map(item => item.match);

        // Apply Limits for Daily Predictions (don't limit in admin/analysis mode unless specific slip selected)
        // User requested to remove caps for Live Analysis so all tagged matches are visible.
        filtered = categoryMatches;

        if (activePriority !== 'all') {
            filtered = filtered.filter(m => {
                const tags = (m.evaluatorTags && m.evaluatorTags.length > 0)
                    ? m.evaluatorTags
                    : (m.evaluatorTags = getMatchEvaluatorTags(m, phaStatsMap, liveViewType === 'jackpot', true, matchStars));
                if (matchTypeFilter === 'top12' || matchTypeFilter === 'top10') {
                    return tags.includes(`top12:${activePriority}`) || tags.includes(`top10:${activePriority}`);
                }
                if (matchTypeFilter === 'upsets' && (activePriority === 'PR1' || activePriority === 'PR2')) {
                     return tags.some(t => t === `${matchTypeFilter}:${activePriority}a` || t === `${matchTypeFilter}:${activePriority}b` || t === `${matchTypeFilter}:${activePriority}c` || t === `${matchTypeFilter}:${activePriority}d`);
                }
                return tags.includes(`${matchTypeFilter}:${activePriority}`);
            });
        }
    } else if (selectedOpwSort !== 'none') {
        let catId = 'top_12_value';
        if (selectedOpwSort.startsWith('t12_')) catId = 'top_12_value';
        else if (selectedOpwSort.startsWith('bb_')) catId = 'best_bet';
        else if (selectedOpwSort.startsWith('bd_')) catId = 'bankers_dlive';
        else if (selectedOpwSort.startsWith('ups_')) catId = 'upsets';
        else if (selectedOpwSort.startsWith('bj_')) catId = 'bankers_jackpot';
        else if (selectedOpwSort.startsWith('vp_')) catId = 'value_picks';
        else if (selectedOpwSort.startsWith('vb_')) catId = 'value_bets';

        const matchesWithScores = filtered.map(m => {
            const matchDay = getMatchDayOfWeek(m);
            const sortScore = getOptimizedScoreDetailed(m, catId, phaStatsMap, matchDay).totalScore;
            return { match: m, sortScore };
        });

        const isDesc = selectedOpwSort.endsWith('desc') || selectedOpwSort === 'desc';
        matchesWithScores.sort((a, b) => isDesc ? b.sortScore - a.sortScore : a.sortScore - b.sortScore);
        filtered = matchesWithScores.map(item => item.match);
    }

    // 3. Group Filter (Skip if activeTab is 'analysis' - patterns view, OR if filtering incomplete)
    if (activeTab.startsWith('group')) {
        const groupNum = parseInt(activeTab.replace('group', ''));
        filtered = filtered.filter(m => m.group === groupNum);
    }
    
    // 4. Common Filters
    if (selected1X2 !== 'all') filtered = filtered.filter(m => m.pred1x2 === selected1X2);
    if (selectedPattern !== 'all') {
         if (selectedPattern === 'No Main Pattern') {
             filtered = filtered.filter(m => m.patternAnalysis?.mainPattern === 'FF' || m.patternAnalysis?.mainPattern === 'NA');
         } else if (selectedPattern === 'No Sub Pattern') {
             filtered = filtered.filter(m => m.patternAnalysis?.mainPattern !== 'FF' && m.patternAnalysis?.mainPattern !== 'NA' && !m.patternAnalysis?.subPattern);
         } else {
             filtered = filtered.filter(m => m.patternAnalysis?.mainPattern === selectedPattern || m.patternAnalysis?.appliedPattern === selectedPattern);
         }
    }
    if (selectedPointsRange !== 'all') filtered = filtered.filter(m => m.pointsRange === selectedPointsRange);
    if (selectedDate !== 'all') filtered = filtered.filter(m => getLogicalDate(m.date || '', m.time) === selectedDate);
    
    if (selectedStatus === 'completed') {
        filtered = filtered.filter(m => getActualResult(m.result || '') !== 'pending');
    } else if (selectedStatus === 'pending') {
        filtered = filtered.filter(m => getActualResult(m.result || '') === 'pending');
    }
    
    // PAA Filters
    const matchesPaaRange = (val: number | undefined, range: string) => {
        if (range === 'all') return true;
        const v = val || 0;
        if (range === '<20') return v < 20;
        if (range === '30-40') return v >= 30 && v < 40;
        if (range === '40-50') return v >= 40 && v < 50;
        if (range === '50-60') return v >= 50 && v < 60;
        if (range === '60-70') return v >= 60 && v < 70;
        if (range === '70-100') return v >= 70;
        return true;
    };

    if (selectedPaaWin !== 'all') filtered = filtered.filter(m => matchesPaaRange(m.paaWin, selectedPaaWin));
    if (selectedPaaDraw !== 'all') filtered = filtered.filter(m => matchesPaaRange(m.paaDraw, selectedPaaDraw));
    if (selectedPaaUpset !== 'all') filtered = filtered.filter(m => matchesPaaRange(m.paaUpset, selectedPaaUpset));
    
    return filtered;
  }, [processedMatches, activeTab, selected1X2, selectedPattern, selectedPointsRange, selectedDate, searchQuery, searchSubPattern, viewMode, matchTypeFilter, liveViewType, activeJackpotId, phaStatsMap, selectedPaaWin, selectedPaaDraw, selectedPaaUpset, matchStars, showUnderdogWins, showDrawWins, showFavWins, activePriority, selectedOpwSort, weightsVersion]);

  const accuracyStats = useMemo(() => {
      let totalCompleted = 0;
      let correct = 0;
      let seerCorrect = 0;
      let paaCorrect = 0;
      let algoCorrect = 0;
      let mlCorrect = 0;

      for (let i = 0; i < displayMatches.length; i++) {
          const m = displayMatches[i];
          const actual = getActualResult(m.result || '');
          if (actual === 'pending' || !actual) continue;
          totalCompleted++;

          const pred = m.finalPrediction || m.rawPrediction || '1';
          if (matchesPrediction(pred, actual)) correct++;

          const seerPred = m.seerPrediction || m.seerPrimaryPrediction || pred;
          if (matchesPrediction(seerPred, actual)) seerCorrect++;

          const paaPred = m.paaPrediction || m.paaPrimaryPrediction || pred;
          if (matchesPrediction(paaPred, actual)) paaCorrect++;

          const algoPred = m.algoReport?.prediction || m.calculatedPrediction || '1';
          if (matchesPrediction(algoPred, actual)) algoCorrect++;

          const mlPred = m.mlInfo?.mlPrediction || pred;
          if (matchesPrediction(mlPred, actual)) mlCorrect++;
      }

      const percentage = totalCompleted > 0 ? Math.round((correct / totalCompleted) * 100) : 0;
      const seerPercentage = totalCompleted > 0 ? Math.round((seerCorrect / totalCompleted) * 100) : 0;
      const paaPercentage = totalCompleted > 0 ? Math.round((paaCorrect / totalCompleted) * 100) : 0;
      const algoPercentage = totalCompleted > 0 ? Math.round((algoCorrect / totalCompleted) * 100) : 0;
      const mlPercentage = totalCompleted > 0 ? Math.round((mlCorrect / totalCompleted) * 100) : 0;
      
      return { 
          total: displayMatches.length, 
          completed: totalCompleted, 
          correct, 
          percentage, 
          seerCorrect, 
          seerPercentage, 
          paaCorrect, 
          paaPercentage,
          algoCorrect,
          algoPercentage,
          mlCorrect,
          mlPercentage
      };
  }, [displayMatches]);

  const uniqueDates = useMemo(() => {
    return [...new Set(processedMatches.map(m => m.date ? getLogicalDate(m.date, m.time) : ''))]
      .filter(Boolean)
      .sort()
      .reverse();
  }, [processedMatches]);

  useEffect(() => {
    if (viewMode === 'live') {
      if (uniqueDates.length > 0) {
        // If user picked a specific date that is no longer in uniqueDates, reset to 'all'
        if (userPickedDateRef.current && selectedDate !== 'all' && !uniqueDates.includes(selectedDate)) {
          setSelectedDate('all');
          userPickedDateRef.current = false;
        }
      } else if (selectedDate !== 'all') {
        setSelectedDate('all');
      }
    }
  }, [viewMode, uniqueDates, selectedDate]);
  const uniquePatterns = useMemo(() => {
      const all = new Set<string>(Object.keys(PATTERN_DESCRIPTIONS));
      all.delete('NA'); 
      return Array.from(all).sort();
  }, []);
  
  const pointsRanges = ['<40', '40-50', '50-60', '60-70', '70-80', '80-90', '90-100'];
  const paaRanges = ['<20', '30-40', '40-50', '50-60', '60-70', '70-100'];

  // Infinite Scroll Observer for automatic match loading on scroll
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
        observerRef.current.disconnect();
    }
    if (node) {
        observerRef.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                setVisibleMatchCount(prev => prev + 50);
            }
        }, { rootMargin: '250px' });
        observerRef.current.observe(node);
    }
  }, []);

  const handleRunAlgo = () => {
      // Start processing visualization
      setAlgoProcessing({ isProcessing: true, stage: "Initializing AI Engine...", progress: 2 });

      const steps = [
          { msg: "Loading Match Data...", progress: 5 },
          { msg: "Verifying Data Integrity...", progress: 10 },
          { msg: "Scanning Historical Patterns (PHA)...", progress: 20 },
          { msg: "Analyzing Sub-Pattern Synergies...", progress: 35 },
          { msg: "Calculating Weighted Probabilities...", progress: 50 },
          { msg: "Running Conflict Resolution Protocols...", progress: 65 },
          { msg: "Applying Risk & Safety Filters...", progress: 75 },
          { msg: "Validating against Historical Anomalies...", progress: 85 },
          { msg: "Optimizing Banker Selections...", progress: 92 },
          { msg: "Finalizing Independent Predictions...", progress: 100 }
      ];

      let currentStep = 0;

      const runNextStep = () => {
          if (currentStep < steps.length) {
              setAlgoProcessing({ 
                  isProcessing: true, 
                  stage: steps[currentStep].msg, 
                  progress: steps[currentStep].progress 
              });
              currentStep++;
              // Extended delay for accuracy maximization visualization
              setTimeout(runNextStep, 1200); 
          } else {
              // Actual Logic Execution
              setTimeout(() => {
                  const updatedMatches = liveMatches.map(m => {
                      // Determine if this match should be processed based on current view
                      const isTargetDaily = liveViewType === 'daily' && m.isDaily;
                      const isTargetJackpot = liveViewType === 'jackpot' && m.isJackpot && m.jackpotIds?.includes(activeJackpotId);

                      if (isTargetDaily || isTargetJackpot) {
                          const processed = (m as any).isPrecalculated && (m as any).patternAnalysis ? m : processMatch(m);
                          
                          return {
                              ...processed,
                              qualityAudit: processed.algoReport?.qualityAudit,
                              phaReliability: processed.phaReliability
                          };
                      }
                      return m;
                  });
                   React.startTransition(() => setLiveMatches(updatedMatches));
                  Storage.saveLiveMatches(updatedMatches);
                  setAlgoProcessing(null); // Finish
              }, 800);
          }
      };

      runNextStep();
  };

  const handleRunEvaluator = () => {
      setAlgoProcessing({ isProcessing: true, stage: "Evaluating Match Priorities...", progress: 10 });

      const steps = [
          { msg: "Scanning Categories...", progress: 30 },
          { msg: "Assigning Priorities...", progress: 50 },
          { msg: "Fetching Match Stars...", progress: 75 },
          { msg: "Finalizing Tags & Stars...", progress: 100 }
      ];

      let currentStep = 0;

      const runNextStep = () => {
          if (currentStep < steps.length) {
              setAlgoProcessing({ 
                  isProcessing: true, 
                  stage: steps[currentStep].msg, 
                  progress: steps[currentStep].progress 
              });
              currentStep++;
              setTimeout(runNextStep, 1500); // Extended run time
          } else {
              setTimeout(() => {
                  let targetMatches = viewMode === 'live' ? currentViewMatches : uploadedMatches;
                  const updatedMatches = targetMatches.map(m => {
                      const tags = getMatchEvaluatorTags(m, phaStatsMap, liveViewType === 'jackpot', true, matchStars);
                      return { ...m, evaluatorTags: tags };
                  });
                  if (viewMode === 'live') {
                      const newLive = liveMatches.map(lm => updatedMatches.find(um => um.id === lm.id) || lm);
                       React.startTransition(() => setLiveMatches(newLive));
                      Storage.saveLiveMatches(newLive);
                  } else if (viewMode === 'analysis') {
                      const newUploaded = uploadedMatches.map(um => updatedMatches.find(um2 => um2.id === um.id) || um);
                       React.startTransition(() => setUploadedMatches(newUploaded));
                      Storage.saveUploadedMatches(newUploaded);
                  }
                  window.dispatchEvent(new Event('matchStarsUpdated')); // Force refresh stars
                  setAlgoProcessing(null);
              }, 1500);
          }
      };

      runNextStep();
  };

  const handleRecategorizeAll = () => {
      if (uploadedMatches.length === 0) return;

      setAlgoProcessing({ isProcessing: true, stage: "Re-categorizing Matches...", progress: 0 });

      setTimeout(() => {
          const totalMatches = uploadedMatches.length;
          const BATCH_SIZE = 10; // Small batch size to make it take longer and show progress
          let currentIndex = 0;
          
          const processingQueue = [...uploadedMatches];

          const processNextBatch = () => {
              const batchEnd = Math.min(currentIndex + BATCH_SIZE, totalMatches);
              
              for (let i = currentIndex; i < batchEnd; i++) {
                  try {
                      // Re-run processMatch to re-categorize sub patterns
                      const processedMatch = (processingQueue[i] as any).isPrecalculated && (processingQueue[i] as any).patternAnalysis ? processingQueue[i] : processMatch(processingQueue[i]);
                      const prediction = matchAlgorithm.predict(processedMatch);
                      
                      processingQueue[i] = {
                          ...processedMatch,
                          algoReport: {
                              prediction: prediction.prediction,
                              primaryPrediction: prediction.primaryPrediction || prediction.prediction,
                              confidence: prediction.rawConfidence,
                              probabilities: prediction.probabilities,
                              category: prediction.category,
                              reason: prediction.reason,
                              activeFilters: prediction.activeFilters || []
                          }
                      };
                  } catch (err) {
                      console.error(`Error re-categorizing match ${i}:`, err);
                  }
              }

              currentIndex = batchEnd;
              const progress = Math.round((currentIndex / totalMatches) * 100);

              setAlgoProcessing(prev => prev ? ({ ...prev, stage: `Re-categorizing ${currentIndex}/${totalMatches} matches...`, progress }) : null);

              if (currentIndex < totalMatches) {
                  // Add a small delay to simulate deep processing and allow UI to update
                  setTimeout(processNextBatch, 100); 
              } else {
                   React.startTransition(() => setUploadedMatches(processingQueue));
                  Storage.saveUploadedMatches(processingQueue);
                  setAlgoProcessing(null);
              }
          };

          processNextBatch();
      }, 500);
  };

  const handleRunAnalysisAlgo = () => {
      if (uploadedMatches.length === 0) return;

      setAlgoProcessing({ isProcessing: true, stage: "Preparing Match Data...", progress: 0 });

      // Use setTimeout to break execution and allow UI to render the loading state
      setTimeout(() => {
          const totalMatches = uploadedMatches.length;
          const BATCH_SIZE = 50; // Smaller batch for stability
          let currentIndex = 0;
          
          // Clone the array to avoid mutating state directly during processing
          // We will update the state with this new array at the end
          const processingQueue = [...uploadedMatches];

          const processNextBatch = () => {
              const batchEnd = Math.min(currentIndex + BATCH_SIZE, totalMatches);
              
              // Process current batch
              for (let i = currentIndex; i < batchEnd; i++) {
                      try {
                          const match = processingQueue[i];
                          // Process match to get calculated fields
                          const processedMatch = (match as any).isPrecalculated && (match as any).patternAnalysis ? match : processMatch(match);
                          
                          // Update the match in the queue with the report
                          processingQueue[i] = {
                              ...processedMatch,
                              qualityAudit: processedMatch.algoReport?.qualityAudit,
                              phaReliability: processedMatch.phaReliability
                          };
                      } catch (err) {
                      console.error(`Error processing match ${i}:`, err);
                      // Continue to next match even if one fails
                  }
              }

              currentIndex = batchEnd;
              const progress = Math.round((currentIndex / totalMatches) * 100);

              setAlgoProcessing(prev => prev ? ({ ...prev, stage: `Analyzing ${currentIndex}/${totalMatches} matches...`, progress }) : null);

              if (currentIndex < totalMatches) {
                  // Schedule next batch
                  setTimeout(processNextBatch, 0);
              } else {
                  // Finalize
                  setAlgoProcessing(prev => prev ? ({ ...prev, stage: "Finalizing and Saving...", progress: 100 }) : null);
                  
                  // Wrap in timeout to allow render cycle for "Finalizing" text
                  setTimeout(() => {
                       React.startTransition(() => setUploadedMatches(processingQueue));
                      Storage.saveUploadedMatches(processingQueue);
                      setAlgoProcessing(null);
                  }, 500);
              }
          };

          // Start the loop
          processNextBatch();
      }, 500);
  };

  useEffect(() => {
    const handleStorageNotification = (e: any) => {
      if (e.detail?.message) {
        showNotification(e.detail.message, e.detail.type || 'success');
      }
    };
    window.addEventListener('notification', handleStorageNotification);
    return () => window.removeEventListener('notification', handleStorageNotification);
  }, []);

  const saveSession = async (silent = false) => {
      setIsActionLoading(true);
      try {
          let latestUploaded = uploadedMatches;

          if (viewMode === 'live') {
              const sourceIds = new Set(currentViewMatches.map(m => m.id));
              const source = processedMatches.filter(m => sourceIds.has(m.id));
              
              if (source.length > 0) {
                  let isUpdated = false;
                  const currentUploaded = [...uploadedMatches];
                  
                  const newMatches = source.map(sm => {
                      const stableSmId = getStableMatchId(sm);
                      const existingIndex = currentUploaded.findIndex(um => getStableMatchId(um) === stableSmId);
                      
                      if (existingIndex >= 0) {
                          const um = currentUploaded[existingIndex];
                          let changed = false;
                          if (sm.result && um.result !== sm.result) {
                              currentUploaded[existingIndex] = { ...um, result: sm.result };
                              changed = true;
                          }
                          if (changed) isUpdated = true;
                          return null;
                      } else {
                          isUpdated = true;
                          return { ...sm, id: stableSmId, isPrecalculated: true };
                      }
                  }).filter(Boolean) as Match[];

                  if (isUpdated || newMatches.length > 0) {
                      latestUploaded = [...currentUploaded, ...newMatches];
                      setUploadedMatches(latestUploaded);
                  }
              }
          }

          await Storage.saveUploadedMatches(latestUploaded, true, true);
          await Storage.saveLiveMatches(liveMatches, true, true);
          await handleBackgroundSeerSync(liveMatches, phaStatsMap, matchStars);
          if (!silent) showNotification("Session saved successfully!");
      } catch (error) {
          console.error("Save error:", error);
          showNotification("Failed to save session", "error");
      } finally {
          setIsActionLoading(false);
      }
  };

  const handleRecalculatePredictions = async () => {
      if (isActionLoading) return;
      setIsActionLoading(true);
      try {
          if (viewMode === 'live') {
              const updatedLive = liveMatches.map(m => {
                  let pm = processMatch({ ...m, isPrecalculated: false });
                  const seerResult = predictSeerDetailed(pm, DEFAULT_WEIGHTS, phaStatsMap, matchStars);
                  pm.seerPrimaryPrediction = seerResult.primary;
                  pm.seerPrediction = seerResult.final;
                  pm.seerPercentages = seerResult.percentages;
                  pm.seerScores = seerResult.scores;
                  return pm;
              });
              React.startTransition(() => setLiveMatches(updatedLive));
              await Storage.saveLiveMatches(updatedLive, true, true);
              showNotification("Predictions recalculated for Live matches.");
          } else if (viewMode === 'analysis') {
              const updatedUploaded = uploadedMatches.map(m => {
                  let pm = processMatch({ ...m, isPrecalculated: false });
                  const seerResult = predictSeerDetailed(pm, DEFAULT_WEIGHTS, phaStatsMap, matchStars);
                  pm.seerPrimaryPrediction = seerResult.primary;
                  pm.seerPrediction = seerResult.final;
                  pm.seerPercentages = seerResult.percentages;
                  pm.seerScores = seerResult.scores;
                  return pm;
              });
              React.startTransition(() => setUploadedMatches(updatedUploaded));
              await Storage.saveUploadedMatches(updatedUploaded, true, true);
              try {
                  await savePrecalculatedMatches(updatedUploaded);
                  showNotification("Predictions recalculated and saved to Supabase.");
              } catch (e) {
                  showNotification("Recalculated but Supabase sync failed.", "error");
              }
          }
      } catch (error) {
          console.error("Recalculate error:", error);
          showNotification("Failed to recalculate", "error");
      } finally {
          setIsActionLoading(false);
      }
  };

  const handleDownloadZip = async () => {
      if (isActionLoading) return;
      setIsActionLoading(true);
      showNotification("Generating ZIP...", "success");
      try {
          let matches = [];
          try {
              matches = await loadPrecalculatedMatches();
          } catch (e) {
              console.warn("Failed to load from Supabase:", e);
          }
          if (!matches || matches.length === 0) {
              // Fallback to currently loaded Analysis Board matches
              if (uploadedMatches && uploadedMatches.length > 0) {
                  matches = uploadedMatches;
                  showNotification("Using cached matches from Analysis Board.", "success");
              } else {
                  showNotification("No matches found to download.", "error");
                  return;
              }
          } else {
              showNotification("Fetched matches from Supabase.", "success");
          }

          const zipBlob = await createMatchesZipBlob(matches);
          const url = URL.createObjectURL(zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `nerdytips_matches_${matches.length}_${new Date().toISOString().split('T')[0]}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showNotification(`Successfully exported ${matches.length} matches to ZIP file!`, "success");
      } catch (err: any) {
          console.error("Zip download error:", err);
          showNotification("Failed to generate ZIP archive.", "error");
      } finally {
          setIsActionLoading(false);
      }
  };

  const handleArchiveSession = async (silent = false) => {
    // If used from Analysis Board (uploaded matches)
    const baseSource = viewMode === 'analysis' ? uploadedMatches : currentViewMatches;
    
    // We want all calculated fields, patterns, algo insights, and SEER logic to be completely sticky.
    // So we pull the fully processed equivalents.
    const sourceIds = new Set(baseSource.map(m => m.id));
    const source = processedMatches.filter(m => sourceIds.has(m.id));
    
    if (source.length === 0) return;
    
    setIsActionLoading(true);
    try {
        const date = source[0].date || new Date().toISOString().split('T')[0];
        
        // 1. Save to Archive (Sticky)
        await Storage.saveArchive(date, source);
        
        if (viewMode === 'live') {
            // 2. Add to Analysis Board (History) without duplication
            const currentUploaded = Storage.getUploadedMatches();
            const newMatches = source.filter(sm => 
                !currentUploaded.some(um => um.id === sm.id)
            );
            
            if (newMatches.length > 0) {
                const updated = [...currentUploaded, ...newMatches];
                setUploadedMatches(updated); 
                await Storage.saveUploadedMatches(updated);
            }
            if (!silent) showNotification(`Session archived for ${date}`);
        } else {
            if (!silent) showNotification(`Analysis Board archived for ${date}`);
        }

        // Update local archives state
        const savedArchives = Storage.getArchives();
        setArchives(savedArchives);
    } catch (error) {
        console.error("Archive error:", error);
        showNotification("Failed to archive session", "error");
    } finally {
        setIsActionLoading(false);
    }
  };

  const performClear = async () => {
      setIsActionLoading(true);
      try {
          // NON-DESTRUCTIVE CLEAR: Only remove the flags/IDs for the current view.
          // Matches shared across jackpots should persist in other jackpots.
          
          const newLive = liveMatches.map(m => {
              if (liveViewType === 'jackpot') {
                  // If in Jackpot mode, remove the active jackpot ID from the list
                  if (m.jackpotIds && m.jackpotIds.includes(activeJackpotId)) {
                      const newIds = m.jackpotIds.filter(id => id !== activeJackpotId);
                      return { 
                          ...m, 
                          jackpotIds: newIds,
                          isJackpot: newIds.length > 0 // Only true if it still belongs to at least one jackpot
                      };
                  }
                  return m;
              }
              else {
                  // In Daily mode, just turn off the daily flag
                  return { ...m, isDaily: false };
              }
          }).filter(m => m.isJackpot || m.isDaily); // Only keep match if it still belongs to at least one list
          
          setLiveMatches(newLive);
          await Storage.saveLiveMatches(newLive, true, false);
          
          // Clear Seer Today Snapshot for the current type in background so it doesn't block the UI
          const today = getAnalysisDateString();
          const coll = liveViewType === 'jackpot' ? 'seer_jackpot_history' : 'seer_performance_history';
          deleteDailySeerSnapshot(today, coll).catch(e => {
              console.error("Seer clear error in background:", e);
          });

          // Close modal and notify IMMEDIATELY
          setShowLiveClearModal(false);
          showNotification("Matches cleared successfully!");

          // Run force sync in background to align Supabase state
          Storage.forceSyncToSupabase().catch(e => {
              console.error("Force sync error in background:", e);
          });
      } catch (error) {
          console.error("Clear error:", error);
          showNotification("Failed to clear matches", "error");
      } finally {
          setIsActionLoading(false);
      }
  };

   const handleDeleteMatch = async (id: number | string) => {
      const strId = String(id);
      const matchToDelete = liveMatches.find(m => String(m.id) === strId) || 
                            uploadedMatches.find(m => String(m.id) === strId) || 
                            precalculatedMatches.find(m => String(m.id) === strId) ||
                            processedMatches.find(m => String(m.id) === strId);
      const stableId = matchToDelete ? getStableMatchId(matchToDelete) : strId;

      const newUploaded = uploadedMatches.filter(m => String(m.id) !== strId && getStableMatchId(m) !== stableId);
      const newLive = liveMatches.filter(m => String(m.id) !== strId && getStableMatchId(m) !== stableId);
      const newPrecalculated = precalculatedMatches.filter(m => String(m.id) !== strId && getStableMatchId(m) !== stableId);

      if (matchToDelete) {
          const dateStr = getLogicalDate(matchToDelete.date || new Date().toISOString().split('T')[0], matchToDelete.time);
          const coll = matchToDelete.isJackpot ? 'seer_jackpot_history' : 'seer_performance_history';
          removeMatchFromSeerSnapshot(id, dateStr, coll).catch(console.error);
          if (stableId !== strId) {
              removeMatchFromSeerSnapshot(stableId, dateStr, coll).catch(console.error);
          }
          await removeMatchFromSeerSlipsAndReplace(
              matchToDelete.id,
              matchToDelete.teams || '',
              dateStr,
              newLive,
              phaStatsMap,
              matchStars,
              matchToDelete.isJackpot || false
          );
      }

      setUploadedMatches(newUploaded);
      setLiveMatches(newLive);
      setPrecalculatedMatches(newPrecalculated);
      setProcessedMatches(prev => prev.filter(m => String(m.id) !== strId && getStableMatchId(m) !== stableId));

      // Save in background asynchronously without blocking UI
      (async () => {
          try {
              // Persistent tombstone so this match cannot resurrect from any
              // static source (embedded JSON, RAW_MATCHES) on next reload.
              await addTombstones(matchToDelete ? [matchToDelete] : [id]);
              setTombstoneVersion(v => v + 1);

              await deleteUploadedMatchFromSupabase(id);
              if (stableId !== String(id)) {
                  await deleteUploadedMatchFromSupabase(stableId);
              }
              await deleteLiveMatchFromSupabase(id);
              if (stableId !== String(id)) {
                  await deleteLiveMatchFromSupabase(stableId);
              }
              await deletePrecalculatedMatchFromSupabase(id);
              if (stableId !== String(id)) {
                  await deletePrecalculatedMatchFromSupabase(stableId);
              }
              await Storage.saveUploadedMatches(newUploaded, true, true);
              await Storage.saveLiveMatches(newLive, true, true);
          } catch (e) {
              console.error("Error saving after match deletion:", e);
          }
      })();
  };


  const handleDeleteVisible = async () => {
      setIsDeletingVisible(true);
      const idsToDelete = new Set(displayMatches.map(m => m.id));
      const stableIdsToDelete = new Set(displayMatches.map(m => getStableMatchId(m)));
      
      // Helper to clean up array using both direct and stable IDs to avoid leaks
      const clean = (list: Match[]) => list.filter(m => !idsToDelete.has(m.id) && !stableIdsToDelete.has(getStableMatchId(m)));

      const newUploaded = clean(uploadedMatches);
      const newLive = clean(liveMatches);
      const newPrecalculated = clean(precalculatedMatches);

      try {
          // Delete from Supabase backends permanently by using bulk
          const combinedIds = Array.from(new Set([...Array.from(idsToDelete), ...Array.from(stableIdsToDelete)]));

          // Persistent tombstones so pending/incomplete matches never come
          // back from RAW_MATCHES, embedded JSON, or a resync.
          await addTombstones(displayMatches);
          setTombstoneVersion(v => v + 1);

          const deletePromises: Promise<any>[] = [
              deleteUploadedMatchesFromSupabaseBulk(combinedIds),
              deleteLiveMatchesFromSupabaseBulk(combinedIds),
              deletePrecalculatedMatchesFromSupabaseBulk(combinedIds)
          ];

          await Promise.allSettled(deletePromises);


          await Storage.saveUploadedMatches(newUploaded, true, true);
          await Storage.saveLiveMatches(newLive, true, true);

          // Update local cache for precalculated matches if we removed some
          if (newPrecalculated.length !== precalculatedMatches.length) {
              try {
                  localStorage.setItem('prm_supabase_matches_cache_time', Date.now().toString());
                  // We don't necessarily want to save back to Supabase here 
                  // (as embedded matches shouldn't be deleted from the server usually this way)
                  // but we ensure the local viewer cache reflects the deletion.
              } catch (e) {}
          }
          
          // Clear Seer Today Snapshot for the current type
          const today = getAnalysisDateString();
          const coll = liveViewType === 'jackpot' ? 'seer_jackpot_history' : 'seer_performance_history';
          await deleteDailySeerSnapshot(today, coll);

          for (const m of displayMatches) {
              const dStr = getLogicalDate(m.date || '', m.time);
              if (dStr) {
                  removeMatchFromSeerSlipsAndReplace(
                      m.id,
                      m.teams || '',
                      dStr,
                      newLive,
                      phaStatsMap,
                      matchStars,
                      m.isJackpot || false
                  ).catch(console.error);
              }
          }
      } catch (e) {
          console.error("Seer clear error in background:", e);
      } finally {
          React.startTransition(() => {
            setUploadedMatches(newUploaded);
            setLiveMatches(newLive);
            setPrecalculatedMatches(newPrecalculated);
            setMatchTypeFilter('all');
          });

          setIsDeletingVisible(false);
          setShowDeleteVisibleModal(false);
      }
  };

  const activeJackpotName = useMemo(() => {
      return JACKPOT_OPTIONS.find(o => o.id === activeJackpotId)?.name || 'Jackpot';
  }, [activeJackpotId]);

  const handleSyncLiveFromCloud = async () => {
      setIsActionLoading(true);
      try {
          const liveFromSupabase = await loadLiveMatchesFromSupabase();
          if (liveFromSupabase && liveFromSupabase.length > 0) {
              // Complete overwrite/sync from cloud
              setLiveMatches(liveFromSupabase);
              Storage.saveLiveMatches(liveFromSupabase, true, false);
              showNotification(`Successfully loaded ${liveFromSupabase.length} live matches from Cloud.`, 'success');
          } else {
              showNotification(`No live matches found in Cloud.`, 'error');
          }
      } catch (err) {
          console.error("Failed to sync live matches from cloud:", err);
          showNotification("Failed to connect to Cloud.", "error");
      } finally {
          setIsActionLoading(false);
      }
  };

  const handleClearLiveSession = () => {
      if (!isCurrentViewSaved) {
          setShowLiveClearModal(true);
      } else {
          // Force modal for all clear actions to provide options
          setShowLiveClearModal(true);
      }
  };

  const handleSaveAndClearLive = async () => {
    setIsActionLoading(true);
    try {
        const savePromises: Promise<any>[] = [];
        
        // Archive the current view matches locally
        // Make them sticky by mapping through processedMatches
        const sourceIds = new Set(currentViewMatches.map(m => m.id));
        const source = processedMatches.filter(m => sourceIds.has(m.id));
        
        if (source.length > 0) {
            const date = source[0].date || new Date().toISOString().split('T')[0];
            savePromises.push(Storage.saveArchive(date, source, true));
            
            // Add to analysis board consistently using stable IDs
            let isUpdated = false;
            const currentUploaded = Storage.getUploadedMatches(); // Always fresh from storage logic
            const newMatches = source.map(sm => {
                const stableSmId = getStableMatchId(sm);
                const existingIndex = currentUploaded.findIndex(um => getStableMatchId(um) === stableSmId);
                
                if (existingIndex >= 0) {
                    const um = currentUploaded[existingIndex];
                    let changed = false;
                    if (sm.result && um.result !== sm.result) {
                        currentUploaded[existingIndex] = { ...um, result: sm.result };
                        changed = true;
                    }
                    if (changed) isUpdated = true;
                    return null;
                } else {
                    isUpdated = true;
                    return { ...sm, id: stableSmId, isPrecalculated: true };
                }
            }).filter(Boolean) as Match[];
            
            if (isUpdated || newMatches.length > 0) {
                const updatedUploaded = [...currentUploaded, ...newMatches];
                setUploadedMatches(updatedUploaded); 
                savePromises.push(Storage.saveUploadedMatches(updatedUploaded, true, false));
            }

            // Sync updated matches containing results to Seer performance snapshot and lock slips before clearing
            savePromises.push(handleBackgroundSeerSync(source, phaStatsMap, matchStars));
        }

        // 2. Perform Clear locally
        const newLive = liveMatches.map(m => {
            if (liveViewType === 'jackpot') {
                if (m.jackpotIds && m.jackpotIds.includes(activeJackpotId)) {
                    const newIds = m.jackpotIds.filter(id => id !== activeJackpotId);
                    return { 
                        ...m, 
                        jackpotIds: newIds,
                        isJackpot: newIds.length > 0 
                    };
                }
                return m;
            } else {
                return { ...m, isDaily: false };
            }
        }).filter(m => m.isJackpot || m.isDaily);
        
        setLiveMatches(newLive);
        savePromises.push(Storage.saveLiveMatches(newLive, true, false));
        
        // Wait for all local saves and background sync steps to execute concurrently
        await Promise.all(savePromises);
        
        // Clear Seer Today Snapshot for the current type in background to avoid blocking the UI
        const today = getAnalysisDateString();
        const coll = liveViewType === 'jackpot' ? 'seer_jackpot_history' : 'seer_performance_history';
        deleteDailySeerSnapshot(today, coll).catch(e => {
            console.error("Seer clear error in background:", e);
        });

        // Close modal and notify IMMEDIATELY for top-tier responsive UI feel
        setShowLiveClearModal(false);
        showNotification("Session saved and cleared successfully!");
        setArchives(Storage.getArchives());

        // Perform final remote synchronization in the background
        Storage.forceSyncToSupabase().catch(e => {
            console.error("Force sync error in background:", e);
        });
    } catch (error) {
        console.error("Bulk Save & Clear error:", error);
        showNotification("Action failed, but changes were saved locally.", "error");
    } finally {
        setIsActionLoading(false);
    }
  };

  const handleClearUploaded = async () => {
      setIsActionLoading(true);
      try {
          setUploadedMatches([]);
          await Storage.clearUploadedMatches();
          setShowAnalysisClearModal(false);
          showNotification("Analysis board cleared");
      } catch (error) {
          showNotification("Failed to clear analysis board", "error");
      } finally {
          setIsActionLoading(false);
      }
  };

  const handleWipeDatabaseMatches = async () => {
      setIsActionLoading(true);
      showNotification("Deleting all database matches...", "success");
      try {
          // Attempt to run the SQL drop query first if possible, otherwise we just use clearAllMatches.
          await clearAllMatches();

          // Also clear from local state so UI updates immediately
          setPrecalculatedMatches([]);
          setUploadedMatches([]);
          setLiveMatches([]);
          
          await Storage.clearUploadedMatches();
          await Storage.saveLiveMatches([], true, false);
          
          showNotification(`Successfully wiped all matches from Supabase.`, "success");
          setShowAnalysisClearModal(false);
      } catch (err: any) {
          console.error("Wipe failed:", err);
          showNotification(`Wipe failed: ${err.message}`, "error");
      } finally {
          setIsActionLoading(false);
      }
  };

  const handleSaveAndClearUploaded = async () => {
      await saveSession(true);
      await handleArchiveSession(true);
      await handleClearUploaded();
  };

  const switchView = (mode: ViewMode) => {
      navigateView(mode, true);
  };


  const getThemeClasses = () => {
      if (viewMode === 'live') return { 
          main: 'bg-red-600', text: 'text-red-600', hover: 'hover:bg-red-700', 
          lightText: 'text-red-100', activeBg: 'bg-white', shadow: 'shadow-sm', border: 'border-red-600'
      };
      if (viewMode === 'archive') return { 
          main: 'bg-emerald-600', text: 'text-emerald-600', hover: 'hover:bg-emerald-700',
          lightText: 'text-emerald-100', activeBg: 'bg-white', shadow: 'shadow-sm', border: 'border-emerald-600'
      };
      if (viewMode === 'ai') return {
          main: 'bg-violet-600', text: 'text-violet-600', hover: 'hover:bg-violet-700',
          lightText: 'text-violet-100', activeBg: 'bg-white', shadow: 'shadow-sm', border: 'border-violet-600'
      };
      if (viewMode === 'nerdy') return {
          main: 'bg-amber-600', text: 'text-amber-600', hover: 'hover:bg-amber-700',
          lightText: 'text-amber-100', activeBg: 'bg-white', shadow: 'shadow-sm', border: 'border-amber-600'
      };
      return { 
          main: 'bg-indigo-600', text: 'text-indigo-600', hover: 'hover:bg-indigo-700',
          lightText: 'text-indigo-100', activeBg: 'bg-white', shadow: 'shadow-sm', border: 'border-indigo-600'
      };
  };
  // NEW: Sub Pattern Recommendations Logic (analyzes ALL completed matches including recent & completed live matches without mutating leakage-free phaStatsMap)
  const subPatternAnalysis = useMemo(() => {
    if (!showSubPattModal) return { recs: [] as Array<{ sub: string; prim: string; fin: string; p1: number; px: number; p2: number; c1: number; cx: number; c2: number; total: number; shortCopyText: string }>, analyzedCount: 0 };

    // Deduplicate all matches across fullProcessedHistory and liveMatches so completed live matches are included
    const completedById = new Map<string, Match>();
    for (const m of fullProcessedHistory) {
      if (getActualResult(m.result) !== 'pending') {
        completedById.set(String(m.id), m);
      }
    }
    for (const m of (liveMatches || [])) {
      if (getActualResult(m.result) !== 'pending') {
        const key = String(m.id);
        const processed = m.patternAnalysis?.subPattern ? m : processMatch(m, mlData);
        completedById.set(key, processed);
      }
    }

    const completeStats: Record<string, { total: number; outcomes: { '1': number; 'X': number; '2': number } }> = {};
    completedById.forEach(m => {
      const sub = m.patternAnalysis?.subPattern;
      if (!sub) return;
      const actual = getActualResult(m.result);
      if (actual === '1' || actual === 'X' || actual === '2') {
        if (!completeStats[sub]) {
          completeStats[sub] = { total: 0, outcomes: { '1': 0, 'X': 0, '2': 0 } };
        }
        completeStats[sub].total++;
        completeStats[sub].outcomes[actual]++;
      }
    });

    const analyzedSubPatterns = Object.keys(completeStats);
    const recs = [];
    for (const sub of analyzedSubPatterns) {
      const stats = completeStats[sub];
      // Only show recommendations for sub-patterns that have actual results
      if (!stats || stats.total === 0) continue;

      const p1 = Math.round((stats.outcomes['1'] / stats.total) * 100) || 0;
      const px = Math.round((stats.outcomes['X'] / stats.total) * 100) || 0;
      const p2 = Math.round((stats.outcomes['2'] / stats.total) * 100) || 0;

      const c1 = stats.outcomes['1'];
      const cx = stats.outcomes['X'];
      const c2 = stats.outcomes['2'];

      let prim = '';
      if (c1 === cx && cx === c2) {
          prim = 'X';
      } else if (c1 === cx && c1 > c2) {
          prim = '1';
      } else if (c2 === cx && c2 > c1) {
          prim = '2';
      } else if (c1 === c2 && c1 > cx) {
          prim = '1';
      } else {
          if (c1 > cx && c1 > c2) prim = '1';
          else if (cx > c1 && cx > c2) prim = 'X';
          else if (c2 > c1 && c2 > cx) prim = '2';
      }

      const rule = SUB_PATTERN_RULES.find(r => r.id === sub);
      const subPattFin = rule ? rule.prediction : '1X'; // Fallback if missing
      const subPattPrim = rule ? (rule.primaryPrediction || '1') : '1';

      // Follow Sub Pattern fallback if balanced
      if (c1 === cx && cx === c2) {
          prim = subPattPrim;
      }

      let fin = '';
      if (c1 === cx && cx === c2) {
          fin = subPattFin;
      } else if (c1 > cx && cx === c2) {
          fin = '12';
      } else if (c2 > cx && cx === c1) {
          fin = '12';
      } else if (cx > c1 && c1 === c2) {
          fin = subPattFin;
      } else {
          const sorted = [
              { side: '1', val: c1 },
              { side: 'X', val: cx },
              { side: '2', val: c2 }
          ].sort((a,b) => b.val - a.val);
          
          const highest = sorted[0].side;
          const second = sorted[1].side;
          
          const combine = (sA: string, sB: string) => {
              if ((sA === '1' && sB === 'X') || (sA === 'X' && sB === '1')) return '1X';
              if ((sA === '1' && sB === '2') || (sA === '2' && sB === '1')) return '12';
              if ((sA === 'X' && sB === '2') || (sA === '2' && sB === 'X')) return 'X2';
              return '';
          };
          fin = combine(highest, second);
      }

      // Skip if the calculated predictions align with current predictions in SUB_PATTERN_RULES
      if (prim === subPattPrim && fin === subPattFin) {
          continue; // Skip if the predicted outputs already match the source code
      }

      const shortCopyText = `${sub}= Prim ${prim} fin ${fin}`;
      
      recs.push({
          sub,
          prim,
          fin,
          p1, px, p2,
          c1, cx, c2,
          total: stats.total,
          shortCopyText
      });
    }

    // Sort by total matches descending to put more confident ones first
    return {
      recs: recs.sort((a, b) => b.total - a.total),
      analyzedCount: analyzedSubPatterns.length
    };
  }, [showSubPattModal, fullProcessedHistory, liveMatches, mlData]);

  const subPatternRecommendations = subPatternAnalysis.recs;
  const analyzedSubPatternsCount = subPatternAnalysis.analyzedCount;

  const handleRefreshSubPattData = async () => {
    setIsRefreshingSubPatt(true);
    try {
      const freshUploaded = await loadUploadedMatchesFromSupabase(true);
      if (freshUploaded && freshUploaded.length > 0) {
        lastSavedUploadedRef.current = freshUploaded;
        setUploadedMatches(freshUploaded);
        Storage.saveUploadedMatches(freshUploaded, false, false);
        showNotification(`Refreshed ${freshUploaded.length.toLocaleString()} historical matches from database.`);
      } else {
        showNotification("No new historical matches found.", "error");
      }
    } catch (err) {
      console.error("Failed to refresh Sub Pattern data:", err);
      showNotification("Failed to refresh Sub Pattern data from database.", "error");
    } finally {
      setIsRefreshingSubPatt(false);
    }
  };

  const handleCopySubPattRecommendations = () => {
      const textToCopy = subPatternRecommendations.map(r => r.shortCopyText).join('\n');

      navigator.clipboard.writeText(textToCopy);
      showNotification("Copied recommendations to clipboard!");
  };

  const theme = getThemeClasses();

  const handleSyncCloud = async () => {
    setIsUpdatingResults(true);
    try {
      await loadFromSupabase(true);
      await Storage.syncFromServer();
      React.startTransition(() => {
        setUploadedMatches(Storage.getUploadedMatches());
        setLiveMatches(Storage.getLiveMatches());
        setArchives(Storage.getArchives());
      });
      showNotification("Data successfully synced from cloud!");
    } catch (err) {
      console.error("Sync failed:", err);
      showNotification("Sync partly failed or quota reached. Using local data.", "error");
    } finally {
      setIsUpdatingResults(false);
    }
  };

  return (
    <AppShell
      activeView={shellView as any}
      onNavigate={(v) => switchView(v as any)}
      currentUser={currentUser as any}
      onLogout={onLogout}
      onNavigateAdmin={onNavigateAdmin}
      onSyncCloud={() => runDebouncedAction('sync-cloud', handleSyncCloud, 500)}
      syncing={isUpdatingResults}
      banner={
        seerAutomationStatus ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--color-primary-glow)] shadow-sm animate-fade-in">
            <div className="flex items-center gap-2">
              <BrainCircuit className="animate-pulse" size={18} />
              <span>{seerAutomationStatus}</span>
            </div>
            {liveLoadTime !== null && !automationTriggered && (
                  <button
                    onClick={() => runDebouncedAction('seer-automation-now', () => {
                  setAutomationTriggered(true);
                  executeBackgroundSeerAutomation();
                    }, 250)}
                className="shrink-0 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-[var(--color-primary-foreground)] shadow-sm transition-all hover:brightness-110"
              >
                Run Now
              </button>
            )}
          </div>
        ) : null
      }
    >
      <div className={`w-full mx-auto ${viewMode === 'seer' ? 'max-w-none px-0' : 'max-w-[1400px]'}`}>



        {viewMode !== 'opw_comp' && (
        <div className="bg-white rounded-lg shadow-sm mb-2 overflow-hidden w-full">
          
          <div className="px-3 py-2 md:px-4 md:py-2 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
             <div className="w-full md:w-auto">
               <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                 {viewMode === 'analysis' && "Historical Pattern Analysis"}
                 {viewMode === 'live' && <span className="flex items-center gap-2 text-red-600"><PlayCircle className="hidden sm:block"/> Live Analysis</span>}
                 {viewMode === 'archive' && <span className="flex items-center gap-2 text-emerald-600"><History className="hidden sm:block"/> Archived Sessions</span>}
                 {viewMode === 'ai' && <span className="flex items-center gap-2 text-violet-600"><BrainCircuit className="hidden sm:block"/> AI Analyst Studio</span>}
                 {viewMode === 'nerdy' && <span className="flex items-center gap-2 text-amber-600"><Cpu className="hidden sm:block"/> Nerdy Tips</span>}
                 {viewMode === 'sub_pattern_audit' && <span className="flex items-center gap-2 text-indigo-900"><BarChart2 className="hidden sm:block"/> Sub-Pattern Accuracy Audit</span>}
                 {viewMode === 'seer' && <span className="flex items-center gap-2 text-teal-600"><Eye className="hidden sm:block"/> SEER Analysis</span>}
               </h2>
               <p className="text-gray-500 text-xs md:text-sm mt-1 leading-tight">
                 {viewMode === 'live' ? `Manage daily and jackpot predictions.` : viewMode === 'seer' ? "Self-Learning Prediction Algorithm." : viewMode === 'ai' ? "Self-learning analysis and supreme slips using Gemini 3.8 Flash High." : viewMode === 'nerdy' ? "Extract and analyze matches from NerdyTips." : viewMode === 'sub_pattern_audit' ? "Historical accuracy audit per sub-pattern." : "Evaluate strategies."}
               </p>
             </div>

             {/* LIVE VIEW CONTROLS */}
             {viewMode === 'live' && (
                <div className="flex flex-col gap-2 w-full md:w-auto">
                    <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
                        {/* View Toggle */}
                        <div className="flex bg-gray-100 rounded-md p-1">
                             <button onClick={() => switchLiveViewType('daily')} className={`px-3 py-1.5 rounded text-xs font-bold ${liveViewType === 'daily' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>Daily</button>
                             <button onClick={() => switchLiveViewType('jackpot')} className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1 ${liveViewType === 'jackpot' ? 'bg-white shadow text-amber-600' : 'text-gray-500'}`}><Trophy size={12}/> Jackpot</button>
                        </div>
                        
                        {/* Specific Jackpot Selection */}
                        {liveViewType === 'jackpot' && (
                            <select 
                                value={activeJackpotId} 
                                onChange={(e) => runResponsiveUpdate(() => setActiveJackpotId(e.target.value), true)}
                                className="text-xs font-bold border border-amber-200 rounded p-1 text-amber-800 bg-amber-50 outline-none focus:ring-1 focus:ring-amber-500 flex-1 sm:flex-none sm:w-auto"
                            >
                                {JACKPOT_OPTIONS.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                                ))}
                            </select>
                        )}

                        {/* Primary computation actions on mobile */}
                        <div className="flex sm:hidden items-center gap-1.5 ml-auto">
                            <button onClick={() => runDebouncedAction('live-run-algo', handleRunAlgo)} disabled={!!algoProcessing} className="px-2.5 py-1.5 bg-indigo-600 text-white rounded-md font-bold text-xs shadow-sm hover:bg-indigo-700 flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50">
                              {algoProcessing ? <Loader2 size={13} className="animate-spin"/> : <Cpu size={13}/>} Run Algo
                            </button>
                            <button onClick={() => runDebouncedAction('recalculate', handleRecalculatePredictions)} disabled={isActionLoading} className="px-2.5 py-1.5 bg-purple-600 text-white rounded-md font-bold text-xs shadow-sm hover:bg-purple-700 flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50">
                              {isActionLoading ? <Loader2 size={13} className="animate-spin"/> : <RefreshCw size={13}/>} Recalc
                            </button>
                        </div>
                    </div>
                    
                    {/* Action buttons toolbar: swipeable on mobile, flex on desktop */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 w-full">
                        <button onClick={() => runDebouncedAction('live-run-algo', handleRunAlgo)} disabled={!!algoProcessing} className="hidden sm:flex px-3 py-2 bg-indigo-600 text-white rounded-md font-bold text-xs md:text-sm shadow-sm hover:bg-indigo-700 items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50">
                          {algoProcessing ? <Loader2 size={14} className="animate-spin"/> : <Cpu size={14}/>} Run Algo
                       </button>
                        <button onClick={() => runDebouncedAction('recalculate', handleRecalculatePredictions)} disabled={isActionLoading} className="hidden sm:flex px-3 py-2 bg-purple-600 text-white rounded-md font-bold text-xs md:text-sm shadow-sm hover:bg-purple-700 items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50">
                          {isActionLoading ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>} Recalculate
                       </button>
                       <button onClick={() => runResponsiveUpdate(() => { 
                           setIsUpdatingResults(false); 
                           setPasteInput(''); 
                           setPendingFile(null); 
                           setPendingSessionType(liveViewType); // Auto-select current view type
                           setPendingJackpotId(activeJackpotId); 
                           setShowDateModal(true); 
                       })} className="flex-1 sm:flex-none px-3 py-1.5 sm:py-2 bg-blue-600 text-white rounded-md font-bold text-xs md:text-sm shadow-sm hover:bg-blue-700 flex items-center justify-center gap-1.5 whitespace-nowrap">
                          + New
                       </button>
                       <button onClick={() => runResponsiveUpdate(() => { setIsUpdatingResults(true); setPasteInput(''); setShowPasteModal(true); })} className="flex-1 sm:flex-none px-3 py-1.5 sm:py-2 bg-amber-500 text-white rounded-md font-bold text-xs md:text-sm shadow-sm hover:bg-amber-600 flex items-center justify-center gap-1.5 whitespace-nowrap">
                          <RefreshCw size={13}/> Update
                       </button>
                       <button onClick={() => runResponsiveUpdate(handleSyncLiveFromCloud)} disabled={isActionLoading} className="flex-1 sm:flex-none px-3 py-1.5 sm:py-2 bg-blue-500 text-white rounded-md font-bold text-xs md:text-sm shadow-sm hover:bg-blue-600 flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50">
                          {isActionLoading ? <Loader2 size={13} className="animate-spin"/> : <Database size={13}/>} Sync Cloud
                       </button>
                       <button onClick={() => runDebouncedAction('save-session', () => saveSession(), 500)} className="flex-1 sm:flex-none px-3 py-1.5 sm:py-2 bg-emerald-600 text-white rounded-md font-bold text-xs md:text-sm shadow-sm hover:bg-emerald-700 flex items-center justify-center gap-1.5 whitespace-nowrap">
                          <Save size={13}/> Save
                       </button>
                       <button onClick={() => runResponsiveUpdate(handleClearLiveSession)} className="flex-1 sm:flex-none px-3 py-1.5 sm:py-2 bg-gray-100 text-gray-600 rounded-md font-bold text-xs md:text-sm shadow-sm hover:bg-gray-200 border border-gray-200 flex items-center justify-center gap-1 whitespace-nowrap" title={`Clear ${liveViewType === 'jackpot' ? activeJackpotName : 'Daily'} Matches`}>
                          <Trash2 size={13}/> <span>Clear</span>
                       </button>
                       {liveViewType === 'jackpot' && (
                          <button 
                            onClick={() => {
                                setPerfInitialCategory('jackpot_slip');
                                setPerfAutoRun(true);
                                navigateView('perf');
                            }}
                            className="flex-1 sm:flex-none px-2 py-1.5 bg-amber-600/40 text-white/80 rounded-md font-bold text-[10px] shadow-sm hover:bg-amber-600/60 flex items-center justify-center gap-1 whitespace-nowrap border border-amber-500/20"
                          >
                            <Trophy size={11}/> Analysis
                          </button>
                       )}
                   </div>
               </div>
             )}
             
             {viewMode === 'archive' && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full md:w-auto">
                   <select className="p-2 border rounded-md text-sm w-full sm:w-auto" value={selectedArchiveDate} onChange={e => runResponsiveUpdate(() => setSelectedArchiveDate(e.target.value), true)}>
                      <option value="">-- Choose Session --</option>
                      {archives.map(a => <option key={a.date} value={a.date}>{a.date} ({a.matches.length} matches)</option>)}
                   </select>
                   {selectedArchiveDate && (
                      <button 
                         onClick={() => runResponsiveUpdate(() => setShowArchiveDeleteModal(true))}
                        className="p-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200"
                        title="Delete this archive"
                      >
                        <Trash2 size={16} />
                      </button>
                   )}
                </div>
             )}
          </div>
          
          <div className="flex flex-col px-3 md:px-4 pb-0 pt-0">
            {/* COCKPIT HEADER — Analysis Board, Live Analysis, Archives */}
            {(viewMode === 'analysis' || viewMode === 'live' || viewMode === 'archive') && (
            <div className="flex flex-col w-full overflow-hidden bg-card border border-border rounded-xl shadow-elegant p-3 gap-3">
              {/* Row 1 — Status + Primary Action + Signals */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${viewMode === 'live' ? 'bg-red-500' : viewMode === 'archive' ? 'bg-emerald-500' : 'bg-primary'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${viewMode === 'live' ? 'bg-red-500' : viewMode === 'archive' ? 'bg-emerald-500' : 'bg-primary'}`}></span>
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground whitespace-nowrap">
                    {viewMode === 'live' ? 'Live Performance Audit' : viewMode === 'archive' ? 'Archive Audit' : 'Historical Audit'}
                  </span>
                  <div className="hidden md:flex items-center gap-3 text-[11px] font-mono tabular-nums pl-2 border-l border-border">
                    <span className="flex items-center gap-1">
                      <Database size={11} className="text-muted-foreground"/>
                      <span className="font-bold text-foreground">{loadedCount.toLocaleString()}</span>
                      <span className="text-muted-foreground">loaded</span>
                    </span>
                    {displayMatches.length !== loadedCount && (
                      <span className="flex items-center gap-1">
                        <span className="font-bold text-primary">{displayMatches.length.toLocaleString()}</span>
                        <span className="text-muted-foreground">shown</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => runDebouncedAction('run-evaluator', handleRunEvaluator)}
                    className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-wide shadow-sm hover:bg-primary/90 active:scale-95 flex items-center gap-1.5 transition-all"
                  >
                    <PlayCircle size={12}/> Run Evaluator
                  </button>

                  {/* Signals segmented control */}
                  <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md">
                    {[
                      { k: 'fav', on: showFavWins, icon: TrendingUp, label: 'Fav', onClick: () => runResponsiveUpdate(() => { setShowFavWins(!showFavWins); setShowUnderdogWins(false); setShowDrawWins(false); }, true) },
                      { k: 'und', on: showUnderdogWins, icon: TrendingUp, label: 'Underdog', onClick: () => runResponsiveUpdate(() => { setShowUnderdogWins(!showUnderdogWins); setShowFavWins(false); setShowDrawWins(false); }, true) },
                      { k: 'draw', on: showDrawWins, icon: TrendingUp, label: 'Draw', onClick: () => runResponsiveUpdate(() => { setShowDrawWins(!showDrawWins); setShowUnderdogWins(false); setShowFavWins(false); }, true) },
                      { k: 'inc', on: matchTypeFilter === 'pending', icon: Clock, label: 'Incomplete', onClick: () => runResponsiveUpdate(() => { setMatchTypeFilter('pending' as MatchCategory); setActivePriority('all'); }, true) },
                    ].map(s => (
                      <button
                        key={s.k}
                        onClick={s.onClick}
                        className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${s.on ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <s.icon size={10}/> {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2 — Category pill rail */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-2 px-2 pb-1 scroll-smooth">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'best_bet', label: 'Best Bet' },
                  { id: 'top12', label: 'Top 12' },
                  { id: 'bankers_dlive', label: 'Bankers Dlive' },
                  { id: 'botb_best', label: 'BOTB' },
                  { id: 'top20', label: 'Top 20' },
                  { id: 'bankers_jackpot', label: 'Bankers (Jackpot)' },
                  { id: 'value_bets', label: 'Value Bets' },
                  { id: 'value_picks', label: 'Value Picks' },
                  { id: 'banker_draws', label: 'Banker Draws' },
                  { id: 'upsets', label: 'Upsets' },
                  { id: 'jackpot_slip', label: 'Jackpot Slip' },
                  { id: 'banned', label: 'Banned' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => runResponsiveUpdate(() => { setMatchTypeFilter(cat.id as MatchCategory); setActivePriority('all'); }, true)}
                    className={`px-3.5 py-1.5 sm:py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all min-h-[32px] sm:min-h-0 flex items-center justify-center ${matchTypeFilter === cat.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* PRIORITIES BAR (Hidden when 'All' or 'Pending' is selected) */}
              {matchTypeFilter !== 'all' && matchTypeFilter !== 'pending' && (
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 pt-1 border-t border-border">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest shrink-0">Priorities</span>
                  <div className="flex gap-1 items-center">
                    {['all', 'PR1', 'PR2', 'PR3', 'PR4', 'PR5', 'PR6', 'PR7', 'PR8', 'PR9', 'PR10', 'PR11', 'PR12', 'PR13', 'PR14', 'PR15'].map(pr => {
                      if (matchTypeFilter === 'upsets' && (pr === 'PR1' || pr === 'PR2')) {
                          return (
                              <div key={pr} className="relative inline-block">
                                  <select
                                      value={activePriority.startsWith(pr) ? activePriority : pr}
                                      onChange={(e) => runResponsiveUpdate(() => setActivePriority(e.target.value as Priority), true)}
                                      className={`px-2.5 py-1 pr-4 rounded-md text-[10px] font-bold transition-all whitespace-nowrap outline-none cursor-pointer appearance-none ${
                                          activePriority.startsWith(pr) ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted bg-transparent'
                                      }`}
                                  >
                                      <option value={pr}>{pr} (All)</option>
                                      <option value={`${pr}a`}>{pr}a</option>
                                      <option value={`${pr}b`}>{pr}b</option>
                                      <option value={`${pr}c`}>{pr}c</option>
                                      <option value={`${pr}d`}>{pr}d</option>
                                  </select>
                                  <div className="pointer-events-none absolute inset-y-0 right-1 flex items-center text-inherit text-[8px] opacity-70">
                                      ▼
                                  </div>
                              </div>
                          );
                      }
                      
                      return (
                        <button
                          key={pr}
                          onClick={() => runResponsiveUpdate(() => setActivePriority(pr as Priority), true)}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all whitespace-nowrap ${activePriority === pr ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                        >
                          {pr === 'all' ? 'All' : pr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* GROUP SWITCHER — segmented control */}
            {(viewMode === 'analysis' || viewMode === 'live' || viewMode === 'archive') && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg flex-1 min-w-0 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'group1', label: 'G1' },
                    { id: 'group2', label: 'G2' },
                    { id: 'group3', label: 'G3' },
                    { id: 'all', label: activeTab === 'all' && loadingCount > 0 ? `All · ${loadingCount}` : 'All Groups' },
                    ...(viewMode === 'analysis' ? [{ id: 'analysis', label: 'Patterns' }] : []),
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => runResponsiveUpdate(() => setActiveTab(t.id), true)}
                      className={`flex-1 min-w-[64px] py-1.5 px-3 rounded-md text-[11px] font-black uppercase tracking-wide whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {viewMode === 'live' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => navigateView('seer')}
                      className="py-1.5 px-2.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-muted text-foreground hover:bg-muted/70 border border-border flex items-center gap-1 transition-all"
                    >
                      <Eye size={10}/> SEER
                    </button>
                    <button
                      onClick={() => { setPerfInitialCategory('top12'); setPerfAutoRun(false); navigateView('perf'); }}
                      className="py-1.5 px-2.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-muted text-foreground hover:bg-muted/70 border border-border flex items-center gap-1 transition-all"
                    >
                      <BarChart size={10}/> PERF
                    </button>
                    {liveViewType === 'jackpot' && (
                      <button
                        onClick={() => { setPerfInitialCategory('jackpot_slip'); setPerfAutoRun(true); navigateView('perf'); }}
                        className="py-1.5 px-2.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200 flex items-center gap-1 transition-all"
                      >
                        <Trophy size={10}/> JACKPOT
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>


          {(activeTab !== 'analysis' || matchTypeFilter === 'pending') && viewMode !== 'ai' && (
            <div className="px-3 py-2 bg-white flex flex-col gap-2 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center w-full">
                  <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                    <div className="relative flex-1 sm:w-64 sm:flex-none">
                      <input type="text" placeholder="Search teams..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-8 py-2 border rounded-md focus:ring-2 focus:ring-primary focus:outline-none text-sm"/>
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                      {searchQuery && <button onClick={() => runResponsiveUpdate(() => setSearchQuery(''), true)} className="absolute right-2 top-2 text-gray-400 hover:text-red-500"><X size={16} /></button>}
                    </div>
                    <button onClick={() => runResponsiveUpdate(() => setShowFilters(!showFilters))} className="px-3.5 py-2 rounded-md font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 shadow-sm flex items-center justify-center gap-1.5 text-sm whitespace-nowrap shrink-0"><Filter size={16} /> Filters</button>
                  </div>
                  {viewMode === 'live' && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto py-0.5">
                      <button 
                        onClick={() => {
                          setOpwCompInitialMode('aggregate');
                          navigateView('opw_comp');
                        }} 
                        className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-md font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 shadow-sm flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap"
                        title="OPW Trigger Performance Breakdown (Aggregate)"
                      >
                          <SlidersHorizontal size={15} /> OPW-Comp
                      </button>
                      <button 
                        onClick={() => {
                          setOpwCompInitialMode('match_compare');
                          navigateView('opw_comp');
                        }} 
                        className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-md font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 shadow-sm flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap"
                        title="Compare OPW bonuses and penalties between two matches side-by-side"
                      >
                          <Scale size={15} /> Diff
                      </button>
                      <button 
                        onClick={() => {
                          navigateView('opw_algo');
                        }} 
                        className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-md font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 shadow-sm flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap"
                        title="OPW Point Recommendations & Algorithm Optimization (OPW P-recom)"
                      >
                          <Sparkles size={15} /> OPW P-recom
                      </button>
                      <button onClick={() => runResponsiveUpdate(() => setShowSubPattModal(true))} className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-md font-medium bg-primary/10 text-primary hover:bg-primary/20 shadow-sm flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
                          <BrainCircuit size={15} /> Sub Patt
                      </button>
                    </div>
                  )}
              </div>
              
              {/* DELETE INCOMPLETE ACTION */}
              {matchTypeFilter === 'pending' && displayMatches.length > 0 && (
                  <button onClick={() => runResponsiveUpdate(() => setShowDeleteVisibleModal(true))} className="px-4 py-2 rounded-md font-medium bg-red-100 text-red-700 hover:bg-red-200 shadow-sm flex items-center justify-center gap-2 text-sm whitespace-nowrap border border-red-200">
                      <Trash2 size={16} /> Delete Visible ({displayMatches.length})
                  </button>
              )}

              {(selected1X2 !== 'all' || selectedPattern !== 'all' || searchSubPattern !== '' || selectedPointsRange !== 'all' || searchQuery !== '' || selectedDate !== 'all' || selectedStatus !== 'all') && (
                <button onClick={() => runResponsiveUpdate(() => { userPickedDateRef.current = false; setSelected1X2('all'); setSelectedPattern('all'); setSearchSubPattern(''); setSelectedPointsRange('all'); setSelectedDate('all'); setSearchQuery(''); setSelectedStatus('all'); }, true)} className="text-red-600 text-sm font-medium">Reset</button>
              )}
              
              {viewMode === 'analysis' && (
                <div className="flex gap-1.5 w-full overflow-x-auto no-scrollbar items-center">
                  {/* Compute cluster */}
                  <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md shrink-0">
                    <button
                      onClick={() => runDebouncedAction('analysis-run-algo', handleRunAnalysisAlgo)}
                      disabled={!!algoProcessing || uploadedMatches.length === 0}
                      className="px-3 py-1.5 rounded text-[11px] font-black uppercase tracking-wide text-primary bg-card shadow-sm hover:bg-card/80 flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {algoProcessing ? <Loader2 size={12} className="animate-spin"/> : <Cpu size={12}/>} Run Algo
                    </button>
                    <button
                      onClick={() => runDebouncedAction('recalculate', handleRecalculatePredictions)}
                      disabled={isActionLoading || uploadedMatches.length === 0}
                      className="px-3 py-1.5 rounded text-[11px] font-black uppercase tracking-wide text-foreground hover:bg-card flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isActionLoading ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>} Recalc
                    </button>
                    <button
                      onClick={() => runDebouncedAction('recategorize', handleRecategorizeAll)}
                      disabled={!!algoProcessing || uploadedMatches.length === 0}
                      className="px-3 py-1.5 rounded text-[11px] font-black uppercase tracking-wide text-foreground hover:bg-card flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {algoProcessing ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>} Re-cat
                    </button>
                    <button
                      onClick={() => runResponsiveUpdate(() => setShowFormulaModal(true))}
                      className="px-3 py-1.5 rounded text-[11px] font-black uppercase tracking-wide text-foreground hover:bg-card flex items-center gap-1.5 whitespace-nowrap transition-all"
                    >
                      <Calculator size={12}/> Formulas
                    </button>
                  </div>

                  {/* Import & Export cluster */}
                  <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-md shrink-0">
                    <label className="px-3 py-1.5 rounded text-[11px] font-black uppercase tracking-wide text-foreground hover:bg-card cursor-pointer flex items-center gap-1.5 whitespace-nowrap transition-all">
                      <FileText size={12}/> CSV <input type="file" accept=".csv,.tsv,.txt" onChange={(e) => { if(e.target.files?.[0]) { setPendingFile(e.target.files[0]); setShowDateModal(true); } }} className="hidden" />
                    </label>
                    <label className="px-3 py-1.5 rounded text-[11px] font-black uppercase tracking-wide text-foreground hover:bg-card cursor-pointer flex items-center gap-1.5 whitespace-nowrap transition-all">
                      <FileText size={12}/> Excel <input type="file" accept=".xlsx,.xls" onChange={(e) => { if(e.target.files?.[0]) { setPendingFile(e.target.files[0]); setShowDateModal(true); } }} className="hidden" />
                    </label>
                    <label className="px-3 py-1.5 rounded text-[11px] font-black uppercase tracking-wide bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 cursor-pointer flex items-center gap-1.5 whitespace-nowrap transition-all border border-amber-500/20">
                      <FileArchive size={12}/> Upload Zip <input type="file" accept=".zip" onChange={(e) => { if(e.target.files?.[0]) { setPendingFile(e.target.files[0]); setShowDateModal(true); } }} className="hidden" />
                    </label>
                    <button
                      onClick={() => runResponsiveUpdate(() => { setShowPasteModal(true); setPendingSessionType(liveViewType); setPendingJackpotId(activeJackpotId); })}
                      className="px-3 py-1.5 rounded text-[11px] font-black uppercase tracking-wide text-foreground hover:bg-card flex items-center gap-1.5 whitespace-nowrap transition-all"
                    >
                      📋 Paste
                    </button>
                    <button
                      onClick={() => runDebouncedAction('download-zip', handleDownloadZip)}
                      disabled={isActionLoading}
                      className="px-3 py-1.5 rounded text-[11px] font-black uppercase tracking-wide bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 flex items-center gap-1.5 whitespace-nowrap transition-all disabled:opacity-50"
                    >
                      {isActionLoading ? <Loader2 size={12} className="animate-spin"/> : <Download size={12}/>} Download Zip
                    </button>
                  </div>

                  {(uploadedMatches.length > 0 || precalculatedMatches.length > 0) && (
                    <button
                      onClick={() => runResponsiveUpdate(() => setShowAnalysisClearModal(true))}
                      className="px-3 py-1.5 rounded-md text-[11px] font-black uppercase tracking-wide bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 flex items-center gap-1.5 whitespace-nowrap ml-auto shrink-0 transition-all"
                    >
                      <Trash2 size={12}/> Clear
                    </button>
                  )}
                </div>
              )}

            </div>
          )}

          {showFilters && activeTab !== 'analysis' && viewMode !== 'ai' && (
            <div className="bg-gray-50 p-4 border-b border-gray-200 grid grid-cols-2 md:grid-cols-5 gap-4">
              <select value={selected1X2} onChange={e => runResponsiveUpdate(() => setSelected1X2(e.target.value), true)} className="p-2 border rounded text-sm w-full"><option value="all">All 1X2</option>{['1', 'X', '2', '1X', 'X2'].map(o => <option key={o} value={o}>{o}</option>)}</select>
              <select value={selectedPattern} onChange={e => runResponsiveUpdate(() => setSelectedPattern(e.target.value), true)} className="p-2 border rounded text-sm w-full">
                  <option value="all">All Patterns</option>
                  <option value="No Main Pattern">No Main Pattern</option>
                  <option value="No Sub Pattern">No Sub Pattern</option>
                  {uniquePatterns.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input type="text" placeholder="Search sub pattern..." value={searchSubPattern} onChange={e => runResponsiveUpdate(() => setSearchSubPattern(e.target.value), true)} className="p-2 border rounded text-sm w-full bg-white"/>
              <select value={selectedPointsRange} onChange={e => runResponsiveUpdate(() => setSelectedPointsRange(e.target.value), true)} className="p-2 border rounded text-sm w-full"><option value="all">All Ranges</option>{pointsRanges.map(o => <option key={o} value={o}>{o}</option>)}</select>
              <select value={selectedDate} onChange={e => runResponsiveUpdate(() => { userPickedDateRef.current = true; setSelectedDate(e.target.value); }, true)} className="p-2 border rounded text-sm w-full"><option value="all">All Dates</option>{uniqueDates.map(o => <option key={o} value={o}>{o}</option>)}</select>
              <select value={selectedStatus} onChange={e => runResponsiveUpdate(() => setSelectedStatus(e.target.value as any), true)} className="p-2 border rounded text-sm w-full">
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
              <select value={selectedOpwSort} onChange={e => runResponsiveUpdate(() => setSelectedOpwSort(e.target.value), true)} className="p-2 border rounded text-sm w-full font-bold bg-amber-50 text-amber-900 border-amber-200">
                  <option value="none">OPW Sort: None</option>
                  <option value="desc">OPW Contextual: Highest</option>
                  <option value="asc">OPW Contextual: Lowest</option>
                  <option value="t12_desc">OPW T12: Highest</option>
                  <option value="t12_asc">OPW T12: Lowest</option>
                  <option value="bb_desc">OPW BB: Highest</option>
                  <option value="bb_asc">OPW BB: Lowest</option>
                  <option value="bd_desc">OPW BD: Highest</option>
                  <option value="bd_asc">OPW BD: Lowest</option>
                  <option value="bj_desc">OPW BJ: Highest</option>
                  <option value="bj_asc">OPW BJ: Lowest</option>
                  <option value="vp_desc">OPW VP: Highest</option>
                  <option value="vp_asc">OPW VP: Lowest</option>
                  <option value="vb_desc">OPW VB: Highest</option>
                  <option value="vb_asc">OPW VB: Lowest</option>
                  <option value="ups_desc">OPW UPS: Highest</option>
                  <option value="ups_asc">OPW UPS: Lowest</option>
              </select>
              <select value={selectedPaaWin} onChange={e => runResponsiveUpdate(() => setSelectedPaaWin(e.target.value), true)} className="p-2 border rounded text-sm w-full">
                  <option value="all">PAA Win %</option>
                  {paaRanges.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={selectedPaaDraw} onChange={e => runResponsiveUpdate(() => setSelectedPaaDraw(e.target.value), true)} className="p-2 border rounded text-sm w-full">
                  <option value="all">PAA Draw %</option>
                  {paaRanges.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={selectedPaaUpset} onChange={e => runResponsiveUpdate(() => setSelectedPaaUpset(e.target.value), true)} className="p-2 border rounded text-sm w-full">
                  <option value="all">PAA Upset %</option>
                  {paaRanges.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
        </div>
        )}

        {/* CONTENT */}
        {(isViewPending || viewPlaceholder || (isHistoryProcessing && fullProcessedHistory.length === 0 && processedMatches.length === 0 && (viewMode === 'analysis' || viewMode === 'archive'))) ? (
            <ViewSwitchSkeleton view={shellView} />
        ) : viewMode === 'sub_pattern_audit' ? (
            <PatternAudit 
                onBack={() => navigateView('analysis')} 
            />
        ) : viewMode === 'ai' ? (
            <div className="p-2">
                <GeminiAnalysis 
                    matches={processedMatches} 
                    liveSessionMatches={processedLiveMatches} 
                    activeJackpotId={activeJackpotId}
                    fullHistory={fullProcessedHistory} // Pass full history for self-learning
                    phaStatsMap={phaStatsMap} // NEW: Pass PHA stats for SEER integration
                />
            </div>
        ) : activeTab === 'analysis' && !searchQuery.trim() && matchTypeFilter !== 'pending' ? (
          <Analysis matches={savedProcessedHistory} /> 
        ) : viewMode === 'live' ? (
           (!isLoaded || (liveMatches.length === 0 && !isSupabaseSynced)) && displayMatches.length === 0 ? (
             <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-500 my-6 animate-pulse">
               <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
               <p className="font-bold text-slate-700 text-base">Matches loading...</p>
               <p className="text-xs text-slate-400 mt-1">Retrieving latest daily and jackpot predictions</p>
             </div>
           ) : (
             <SafeErrorBoundary
               fallback={(error, reset) => (
                 <div className="p-8 max-w-xl mx-auto my-12 bg-slate-900 border border-emerald-500/40 rounded-xl text-center shadow-2xl">
                   <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                     <AlertTriangle size={24} />
                   </div>
                   <h3 className="text-lg font-bold text-white mb-2">Live Analysis Temporary Notice</h3>
                   <p className="text-xs text-slate-300 font-mono bg-slate-950/60 p-3 rounded border border-slate-800 mb-6 text-left overflow-auto max-h-36">
                     {error.message || String(error)}
                   </p>
                   <div className="flex items-center justify-center gap-3">
                     <button
                       onClick={reset}
                       className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-all"
                     >
                       Reload Matches
                     </button>
                     <button
                       onClick={() => window.location.reload()}
                       className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-all"
                     >
                       Refresh Page
                     </button>
                   </div>
                 </div>
               )}
             >
               <LivePredictions 
                    matches={displayMatches} 
                    expandedMatch={expandedMatch} 
                    setExpandedMatch={setExpandedMatch}
                    phaStatsMap={phaStatsMap}
                    title={matchTypeFilter === 'upsets' ? "Upset Predictions" : matchTypeFilter === 'bankers_jackpot' ? "Banker Predictions" : matchTypeFilter === 'pending' ? "Incomplete Matches" : liveViewType === 'jackpot' ? `${activeJackpotName} Predictions` : "Daily Predictions"}
                    onDelete={handleDeleteMatch}
                    matchStars={matchStars}
               />
             </SafeErrorBoundary>
           )
        ) : viewMode === 'archive' ? (
           <Archives 
                matches={displayMatches} 
                expandedMatch={expandedMatch} 
                setExpandedMatch={setExpandedMatch}
                phaStatsMap={phaStatsMap}
                matchStars={matchStars}
           />
        ) : viewMode === 'nerdy' ? (
           <div className="p-4 md:p-6">
              <NerdyTips 
                onPushToLive={handlePushNerdyToLive} 
                onPushResultsToLive={handlePushNerdyResultsToLive} 
                liveMatches={liveMatches}
              />
           </div>
        ) : viewMode === 'perf' ? (
           <LivePerformanceAnalysis 
               matches={processedLiveMatches} 
               onBack={() => navigateView('live')} 
               initialCategory={perfInitialCategory}
               autoRun={perfAutoRun}
               type={liveViewType}
               onTypeChange={(t) => switchLiveViewType(t)}
           />
         ) : viewMode === 'opw_algo' ? (
              <SafeErrorBoundary
                fallback={(error, reset) => (
                  <div className="p-8 max-w-xl mx-auto my-12 bg-slate-900 border border-rose-500/40 rounded-xl text-center shadow-2xl">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                      <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Error Loading OPW P-recom</h3>
                    <p className="text-xs text-rose-300 font-mono bg-rose-950/60 p-3 rounded border border-rose-900 mb-6 text-left overflow-auto max-h-36">
                      {error.message || String(error)}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={reset}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => navigateView('live')}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-all"
                      >
                        Return to Live Analysis
                      </button>
                    </div>
                  </div>
                )}
              >
                <OPWAlgo
                    matches={opwAlgoMatches}
                    allLiveMatches={taggedLiveMatches}
                    allMatches={fullProcessedHistory}
                    phaStatsMap={phaStatsMap}
                    matchStars={matchStars}
                    liveViewType={liveViewType}
                    initialCategory={opwAlgoInitialCategory}
                    initialDay={opwAlgoInitialDay}
                    onBack={handleOpwAlgoBack}
                />
              </SafeErrorBoundary>
         ) : viewMode === 'opw_comp' ? (
             <OPWComparison
                 matches={taggedLiveMatches}
                 allMatches={fullProcessedHistory}
                 phaStatsMap={phaStatsMap}
                 matchStars={matchStars}
                 liveViewType={liveViewType}
                 initialMode={opwCompInitialMode}
                 initialCategory={(() => {
                     switch (matchTypeFilter) {
                         case 'top12':
                         case 'top10': return 'top_12_value';
                         case 'top20': return 'high_confidence';
                         case 'value_bets': return 'value_bets';
                         case 'all': return 'top_12_value';
                         default: return matchTypeFilter;
                     }
                 })()}
                 onBack={() => navigateView('live')}
             />
        ) : viewMode === 'seer' ? (
            <SafeErrorBoundary
                fallback={(error, reset) => (
                  <div className="p-8 max-w-xl mx-auto my-12 bg-slate-900 border border-rose-500/40 rounded-xl text-center shadow-2xl">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                      <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Error Loading SEER Analysis</h3>
                    <p className="text-xs text-rose-300 font-mono bg-rose-950/60 p-3 rounded border border-rose-900 mb-6 text-left overflow-auto max-h-36">
                      {error.message || String(error)}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={reset}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => navigateView('live')}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-semibold transition-all"
                      >
                        Return to Live Analysis
                      </button>
                    </div>
                  </div>
                )}
            >
              <SeerAnalysis
                  historicalMatches={taggedHistoricMatches}
                  liveMatches={taggedLiveMatches}
                  phaStatsMap={phaStatsMap}
              />
            </SafeErrorBoundary>
        ) : viewMode === 'ml' ? (
            <MachineLearningDashboard historicalMatches={taggedHistoricMatches} liveMatches={taggedLiveMatches} phaStatsMap={phaStatsMap} />
        ) : (
            <div className="space-y-2" key={activeTab}>
                <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-3 justify-between items-center text-sm">
                  <span className="font-bold text-gray-700 uppercase">
                    {searchQuery.trim() ? 'Search Results' : matchTypeFilter !== 'all' ? `${matchTypeFilter} List` : activeTab === 'all' ? 'All Groups' : activeTab.replace('group', 'Group ')}: {accuracyStats.total}
                  </span>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                     <span className="text-gray-500 hidden sm:inline">Completed: <span className="font-mono font-bold text-gray-700">{accuracyStats.completed}</span></span>
                     <span className="text-gray-500 hidden sm:inline">Sub patt correct: <span className="font-mono font-bold text-green-600">{accuracyStats.correct}</span> <span className="text-gray-400">({accuracyStats.percentage}%)</span></span>
                     <span className="text-gray-500 hidden sm:inline">SEER correct: <span className="font-mono font-bold text-indigo-600">{accuracyStats.seerCorrect}</span> <span className="text-gray-400">({accuracyStats.seerPercentage}%)</span></span>
                     <span className="text-gray-500 hidden sm:inline">ML correct: <span className="font-mono font-bold text-emerald-600">{accuracyStats.mlCorrect}</span> <span className="text-gray-400">({accuracyStats.mlPercentage}%)</span></span>
                     <span className="text-gray-500 hidden sm:inline">PAA correct: <span className="font-mono font-bold text-amber-600">{accuracyStats.paaCorrect}</span> <span className="text-gray-400">({accuracyStats.paaPercentage}%)</span></span>
                     <span className="text-gray-500 hidden sm:inline">Algo correct: <span className="font-mono font-bold text-blue-600">{accuracyStats.algoCorrect}</span> <span className="text-gray-400">({accuracyStats.algoPercentage}%)</span></span>
                  </div>
                </div>

                {displayMatches.length === 0 ? <div className="text-center p-12 text-gray-400 border-2 border-dashed rounded-lg">No matches found for this view.</div> : (
                  <>
                    {displayMatches.slice(0, visibleMatchCount).map((match, idx) => {
                      const sub = match.patternAnalysis?.subPattern;
                      const pha = sub ? phaStatsMap[sub] : undefined;
                      const phaPercentage = pha && pha.total > 0 ? Math.round((pha.correct / pha.total) * 100) : 0;
                      const phaDisplay = pha ? { ...pha, percentage: phaPercentage } : undefined;
                      const mapFilterToOwCategory = (filter: string) => {
                          switch (filter) {
                              case 'top12':
                              case 'top10': return 'top_12_value';
                              case 'top20': return 'high_confidence';
                              case 'value_bets': return 'value_bets';
                              default: return filter === 'all' ? 'top_12_value' : filter;
                          }
                      };
                      return <MatchCard key={`${match.id}_${idx}_${weightsVersion}`} match={match} expandedMatch={expandedMatch} setExpandedMatch={setExpandedMatch} phaStats={phaDisplay} phaStatsMap={phaStatsMap} onDelete={handleDeleteMatch} matchStars={matchStars} owCategory={mapFilterToOwCategory(matchTypeFilter)} />;
                    })}
                    {visibleMatchCount < displayMatches.length && (
                        <div 
                           ref={lastElementRef}
                           className="h-10 text-center text-sm font-medium text-gray-400 mt-4 flex items-center justify-center gap-2"
                        >
                            <Loader2 className="animate-spin" size={16} /> Loading more matches...
                        </div>
                    )}
                  </>
                )}
            </div>
        )}
      </div>

      {/* Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <h3 className="font-bold text-lg mb-2 flex-shrink-0">{isUpdatingResults ? 'Update Results' : 'Paste Match Data'}</h3>
            
            {/* Session Type Selection for Update */}
            {isUpdatingResults && (
                <div className="flex flex-col gap-2 mb-4 flex-shrink-0">
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                            <input type="radio" name="sessionType" checked={pendingSessionType === 'daily'} onChange={() => setPendingSessionType('daily')} />
                            <span className="font-bold text-sm">Daily Matches</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="radio" name="sessionType" checked={pendingSessionType === 'jackpot'} onChange={() => setPendingSessionType('jackpot')} />
                            <span className="font-bold text-sm text-amber-600">Jackpot Matches</span>
                        </label>
                    </div>
                    {/* Jackpot Type Selector for Updates */}
                    {pendingSessionType === 'jackpot' && (
                        <select 
                            value={pendingJackpotId} 
                            onChange={(e) => setPendingJackpotId(e.target.value)}
                            className="mt-2 p-2 border rounded text-xs font-bold text-amber-800 bg-amber-50"
                        >
                            {JACKPOT_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                        </select>
                    )}
                </div>
            )}

            <textarea value={pasteInput} onChange={e => setPasteInput(e.target.value)} className="w-full flex-1 border p-2 mb-4 font-mono text-xs rounded min-h-[200px]" placeholder={isUpdatingResults ? "Paste data containing results..." : "Paste full match data..."} />
            <div className="flex justify-end gap-2 flex-shrink-0">
              <button onClick={() => setShowPasteModal(false)} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
              <button onClick={() => { 
                setPendingPasteData(pasteInput); 
                setShowPasteModal(false); 
                if(!isUpdatingResults) setShowDateModal(true);
                else {
                     // ===== Robust Update Logic =====
                     // Normalise team strings so "TeamA vs TeamB", "TeamA-TeamB",
                     // "teama v teamb" etc. all collapse to the same key.
                     const normaliseTeams = (s: string) => {
                         if (!s) return '';
                         return s
                             .toLowerCase()
                             .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
                             .replace(/\s+vs?\.?\s+/g, ' vs ')
                             .replace(/\s+[-\u2013\u2014\/|]\s+/g, ' vs ')
                             .replace(/[^a-z0-9 ]+/g, ' ')
                             .replace(/\s+/g, ' ')
                             .trim();
                     };
                     const looksLikeScore = (s: string) =>
                         !!s && /\d+\s*[:\-\/\s]\s*\d+/.test(s);

                     const lines = pasteInput.split(/\r?\n/).filter(l => l.trim());
                     const updates = new Map<string, string>();

                     lines.forEach(l => {
                         const delimiter = l.includes('\t') ? '\t' : ',';
                         const cols = l.split(delimiter).map(s => s.trim()).filter(Boolean);
                         if (cols.length < 2) return;

                         // Find the first cell that looks like a score
                         const scoreIdx = cols.findIndex(looksLikeScore);
                         if (scoreIdx <= 0) return;

                         // Teams = the cell immediately before the score
                         // (skips leading id/number columns automatically)
                         const teams = cols[scoreIdx - 1];
                         const result = cols[scoreIdx];
                         const key = normaliseTeams(teams);
                         if (key && result) updates.set(key, result);
                     });

                     if (updates.size === 0) {
                         showNotification('No valid rows found. Expected format: [id]<tab/,>teams<tab/,>score', 'error');
                         setPasteInput('');
                         setPendingPasteData(null);
                         return;
                     }

                     const applyUpdate = (m: Match) => {
                         const k = normaliseTeams(m.teams);
                         if (updates.has(k)) {
                             // Reset precalc so downstream stars / correctness recompute
                             return { ...m, result: updates.get(k)!, isPrecalculated: false, lockedOpwScores: (m as any).lockedOpwScores };
                         }
                         return m;
                     };

                     let hits = 0;
                     const updatedLive = liveMatches.map(m => {
                         const next = applyUpdate(m);
                         if (next !== m) hits++;
                         return next;
                     });
                     const updatedUploaded = uploadedMatches.map(applyUpdate);

                     runResponsiveUpdate(() => {
                         setLiveMatches(updatedLive);
                         setUploadedMatches(updatedUploaded);
                     }, true);

                     Storage.saveLiveMatches(updatedLive, true, true);
                     Storage.saveUploadedMatches(updatedUploaded);
                     handleBackgroundSeerSync([...updatedLive, ...updatedUploaded], phaStatsMap, matchStars);

                     // Force MatchCards / star ratings to refresh
                     window.dispatchEvent(new Event('matchStarsUpdated'));
                     window.dispatchEvent(new Event('seerLockedSlipsUpdated'));

                     showNotification(`Updated ${hits} of ${updates.size} pasted results.`, hits > 0 ? 'success' : 'error');
                     setPasteInput('');
                     setPendingPasteData(null);
                }
              }} className="px-4 py-2 bg-blue-600 text-white rounded">Process</button>
            </div>
          </div>
        </div>
      )}

      {/* DATE MODAL */}
      {showDateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 overflow-y-auto">
              <h3 className="text-xl font-bold text-gray-800 text-center mb-4">{viewMode === 'live' ? 'New Live Session' : 'Upload Data'}</h3>
              
              {/* Session Type Selector for New Session - ALWAYS SHOW if Live Mode */}
              {viewMode === 'live' && (
                  <div className="flex flex-col gap-3 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <div className="flex items-center justify-center mb-1 text-xs font-bold text-gray-400 uppercase tracking-widest">
                          Target Board
                      </div>
                      <div className="flex gap-2 justify-center">
                        <button disabled={isImporting} onClick={() => setPendingSessionType('daily')} className={`flex-1 py-2 rounded border font-bold text-sm transition-all ${pendingSessionType === 'daily' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'} disabled:opacity-50 disabled:cursor-not-allowed`}>Daily</button>
                        <button disabled={isImporting} onClick={() => setPendingSessionType('jackpot')} className={`flex-1 py-2 rounded border font-bold text-sm transition-all flex items-center justify-center gap-1 ${pendingSessionType === 'jackpot' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'} disabled:opacity-50 disabled:cursor-not-allowed`}><Trophy size={14}/> Jackpot</button>
                      </div>
                      
                      {/* Specific Jackpot Selection */}
                      {pendingSessionType === 'jackpot' && (
                          <div className="mt-1">
                              <select 
                                  value={pendingJackpotId} 
                                  disabled={isImporting}
                                  onChange={(e) => setPendingJackpotId(e.target.value)}
                                  className="w-full p-2 border border-amber-200 rounded text-sm font-bold text-gray-800 bg-amber-50/50 outline-none focus:ring-1 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                  {JACKPOT_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                              </select>
                          </div>
                      )}
                  </div>
              )}

              {(!pendingFile && !pendingPasteData) ? (
                 <div className="mb-4">
                   <div className="flex flex-wrap gap-2 mb-3 justify-center">
                     <label className={`flex items-center gap-1.5 px-3 py-2 bg-gray-100 rounded cursor-pointer hover:bg-gray-200 text-xs font-bold text-gray-700 ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
                       <Upload size={14}/> File (CSV/XLSX/ZIP)
                       <input type="file" disabled={isImporting} accept=".csv,.tsv,.txt,.xlsx,.xls,.zip" onChange={(e) => {
                          if(e.target.files?.[0]) setPendingFile(e.target.files[0]); 
                       }} className="hidden" />
                     </label>
                     <span className="text-xs self-center text-gray-400">OR</span>
                     <label className={`flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-100 rounded text-xs font-bold text-blue-700 ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
                       <FileText size={14}/> Paste Data
                     </label>
                   </div>
                   <textarea disabled={isImporting} value={pasteInput} onChange={e => setPasteInput(e.target.value)} className="w-full h-32 p-2 border border-gray-300 rounded text-xs font-mono mb-4 disabled:opacity-50" placeholder="ID, Teams, Result..." />
                 </div>
              ) : (
                 <p className="text-gray-500 text-center text-sm mb-6">
                    {viewMode === 'live' ? `This will add matches to the ${pendingSessionType === 'jackpot' ? 'Jackpot' : 'Daily'} board.` : 'Select date for these matches.'}
                 </p>
              )}

              <input type="date" disabled={isImporting} value={uploadDate} onChange={e => setUploadDate(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg mb-6 text-center disabled:opacity-50 disabled:cursor-not-allowed" />
              <div className="flex gap-3">
                <button onClick={() => setShowDateModal(false)} className="flex-1 py-3 font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
                <button onClick={() => {
                  const parseLine = (line: string, index: number) => {
                     let v: string[] = [];
                     if (line.includes('\t')) {
                         v = line.split('\t').map(s => s.trim());
                     } else if ((line.match(/,/g) || []).length >= 5) {
                         // Robust CSV parsing that respects quoted fields (e.g. "2,3.25,3.65")
                         const matches = [];
                         let current = '';
                         let inQuotes = false;
                         for (let i = 0; i < line.length; i++) {
                             const char = line[i];
                             if (char === '"') {
                                 inQuotes = !inQuotes;
                             } else if (char === ',' && !inQuotes) {
                                 matches.push(current.trim());
                                 current = '';
                             } else {
                                 current += char;
                             }
                         }
                         matches.push(current.trim());
                         v = matches.map(s => {
                             if (s.startsWith('"') && s.endsWith('"')) {
                                 return s.slice(1, -1).trim();
                             }
                             return s;
                         });
                     } else {
                         v = line.split(/\s+/);
                     }

                    if (v.length < 2) return null;
                    const providedId = String(v[0]).trim();
                    const hasValidId = providedId !== '';
                    
                    const isJackpotSource = viewMode === 'live' && pendingSessionType === 'jackpot';
                    const isDailySource = viewMode === 'live' && pendingSessionType === 'daily';

                    // Robust calculation of Market Odds (mo) and Date (date)
                    let extractedMo = '2,3,4';
                    let extractedDate = uploadDate || new Date().toISOString().split('T')[0];

                    if (v.length > 9) {
                        // Find if there's any column that acts as a valid date (YYYY-MM-DD or similar dashed)
                        const dateIdx = v.findIndex((val, idx) => idx >= 9 && /\d{4}[-/]\d{2}[-/]\d{2}/.test(val));
                        if (dateIdx !== -1) {
                            extractedDate = v[dateIdx];
                            // Market odds is everything between column 9 and the date column
                            const moParts = v.slice(9, dateIdx).map(val => val.trim()).filter(Boolean);
                            if (moParts.length > 0) {
                                extractedMo = moParts.join(',');
                            }
                        } else {
                            // If no date column is found, check if columns 9, 10, 11 are numbers
                            const p9 = parseFloat(v[9]);
                            const p10 = parseFloat(v[10]);
                            const p11 = parseFloat(v[11]);
                            if (!isNaN(p9) && !isNaN(p10) && !isNaN(p11)) {
                                extractedMo = `${v[9]},${v[10]},${v[11]}`;
                                if (v[12]) extractedDate = v[12];
                            } else if (v[9]) {
                                extractedMo = v[9];
                                if (v[10]) extractedDate = v[10];
                            }
                        }
                    }

                    return {
                      id: hasValidId ? providedId : (Date.now() + Math.floor(Math.random() * 10000) + index),
                      teams: v[1] || 'Unknown',
                      result: v[2]?.replace(':', '-') || '?-?',
                      pred1x2: v[3] || '1',
                      rating: v[4] || '5/10',
                      // FIX: Default to 'NA' if missing to trigger Group 3 assignment instead of Group 1
                      gs: v[5] || 'NA',
                      ga: v[6] || 'NA',
                      l10: v[7] || 'NA',
                      le: v[8] || 'NA',
                      mo: extractedMo,
                      date: extractedDate,
                      isJackpot: isJackpotSource,
                      isDaily: isDailySource,
                      jackpotId: isJackpotSource ? pendingJackpotId : undefined, // Legacy support
                      jackpotIds: isJackpotSource ? [pendingJackpotId] : [] // Multi-jackpot support
                    } as Match;
                  };

                  let newItems: Match[] = [];
                  const processSource = (content: string) => {
                      const lines = content.split('\n').filter(l => l.trim());

                      const start = (lines[0].toLowerCase().includes('team')) ? 1 : 0;
                      return lines.slice(start).map((l, i) => parseLine(l, i)).filter(Boolean) as Match[];
                  };

                  const handleNewData = async (data: string | Match[]) => {
                      let parsedRaw: Match[] = [];
                      if (Array.isArray(data)) {
                        parsedRaw = data;
                      } else {
                        parsedRaw = processSource(data);
                      }

                      // Processes raw items to calculate PAA, patterns, points, etc., exactly like the Data Importer processor
                      const processedNewItems = parsedRaw.map((m, index) => {
                        const hasId = m.id && String(m.id).trim() !== '';
                        const id = hasId ? String(m.id).trim() : `import-${Date.now()}-${Math.floor(Math.random() * 10000)}-${index}`;
                        
                        let finalDate = m.date || uploadDate || new Date().toISOString().split('T')[0];
                        if (m.date && /^\d{1,2}:\d{2}$/.test(m.date.trim())) {
                            const baseD = uploadDate || new Date().toISOString().split('T')[0];
                            finalDate = `${baseD} ${m.date.trim()}`;
                        }

                        const mMatch = {
                          ...m,
                          id,
                          isPrecalculated: viewMode !== 'live',
                          date: finalDate
                        } as Match;

                        mMatch.id = getStableMatchId(mMatch);

                        let pMatch = processMatch(mMatch);

                        if (pMatch.patternAnalysis?.subPattern) {
                            const sub = pMatch.patternAnalysis.subPattern;
                            if (phaStatsMap[sub] && phaStatsMap[sub].total > 0) {
                                const stats = phaStatsMap[sub];
                                const paaPred = calculatePAAPrediction(pMatch, stats);
                                if (paaPred) {
                                   pMatch.paaPrimaryPrediction = paaPred.paaPrimaryPrediction;
                                   pMatch.paaPrediction = paaPred.paaPrediction;
                                }
                                
                                
                                // We NO LONGER override the hardcoded pattern prediction based purely on PHA stats
                                // The original pattern logic stands on its own.
                                const phaPred = calculatePHAPrediction(stats);
                            }
                        }

                        const seerResult = predictSeerDetailed(pMatch, DEFAULT_WEIGHTS, phaStatsMap, matchStars);
                        pMatch.seerPrimaryPrediction = seerResult.primary;
                        pMatch.seerPrediction = seerResult.final;
                        pMatch.seerPercentages = seerResult.percentages;
                        pMatch.seerScores = seerResult.scores;
                        
                        // Prevent client side re-evaluation
                        pMatch.isPrecalculated = true;

                        return pMatch;
                      }).filter(Boolean) as Match[];

                      newItems = processedNewItems;
                      
                      const isDuplicate = (m1: Match, m2: Match) => {
                          const sameTeams = m1.teams.toLowerCase().trim() === m2.teams.toLowerCase().trim();
                          if (!sameTeams) return false;
                          const sameDate = m1.date === m2.date;
                          const sameStats = m1.mo === m2.mo && m1.gs === m2.gs && m1.ga === m2.ga && m1.l10 === m2.l10 && m1.le === m2.le;
                          return sameDate || sameStats;
                      };

                      if (viewMode === 'live') { 
                          // Merge Logic: Correctly handle Shared Matches
                          const merged = [...liveMatches];
                          newItems.forEach(newItem => {
                              const existingIdx = merged.findIndex(m => isDuplicate(m, newItem));
                              if (existingIdx >= 0) {
                                  // Preserve existing flags + Add new ones (OR Logic)
                                  const existing = merged[existingIdx];
                                  
                                  // Merge Jackpot IDs logic
                                  const mergedJackpotIds = new Set(existing.jackpotIds || []);
                                  if (newItem.isJackpot && newItem.jackpotIds) {
                                      newItem.jackpotIds.forEach(id => mergedJackpotIds.add(id));
                                  } else if (existing.jackpotId) {
                                      mergedJackpotIds.add(existing.jackpotId);
                                  }

                                   merged[existingIdx] = { 
                                       ...existing, 
                                       ...newItem, // Update mutable data
                                       le: (newItem.le && newItem.le !== 'NA' && newItem.le.trim() !== '') ? newItem.le : existing.le,
                                       l10: (newItem.l10 && newItem.l10 !== 'NA' && newItem.l10.trim() !== '') ? newItem.l10 : existing.l10,
                                       gs: (newItem.gs && newItem.gs !== 'NA' && newItem.gs.trim() !== '') ? newItem.gs : existing.gs,
                                       ga: (newItem.ga && newItem.ga !== 'NA' && newItem.ga.trim() !== '') ? newItem.ga : existing.ga,
                                       isJackpot: newItem.isJackpot || existing.isJackpot,
                                       isDaily: newItem.isDaily || existing.isDaily,
                                       // If updating jackpot status, set the ID
                                       jackpotId: newItem.isJackpot ? newItem.jackpotId : existing.jackpotId, 
                                       jackpotIds: Array.from(mergedJackpotIds),
                                       id: existing.id // Keep original ID
                                   };
                               } else {
                                   merged.push(newItem);
                               }
                           });
                           setLiveMatches(merged);
                           Storage.saveLiveMatches(merged);
                           handleBackgroundSeerSync(merged, phaStatsMap, matchStars);
                       } else { 
                           // Duplicate prevention for Analysis Board
                           const merged = [...uploadedMatches];
                           newItems.forEach(newItem => {
                               const existingIdx = merged.findIndex(m => isDuplicate(m, newItem));
                               if (existingIdx >= 0) {
                                   // Update existing match with new data (e.g. results)
                                   merged[existingIdx] = { 
                                       ...merged[existingIdx], 
                                       ...newItem, 
                                       le: (newItem.le && newItem.le !== 'NA' && newItem.le.trim() !== '') ? newItem.le : merged[existingIdx].le,
                                       l10: (newItem.l10 && newItem.l10 !== 'NA' && newItem.l10.trim() !== '') ? newItem.l10 : merged[existingIdx].l10,
                                       gs: (newItem.gs && newItem.gs !== 'NA' && newItem.gs.trim() !== '') ? newItem.gs : merged[existingIdx].gs,
                                       ga: (newItem.ga && newItem.ga !== 'NA' && newItem.ga.trim() !== '') ? newItem.ga : merged[existingIdx].ga,
                                       id: merged[existingIdx].id 
                                   };
                               } else {
                                   // Add new unique match
                                   merged.push(newItem);
                               }
                           });
                          // Invalidate/clear localStorage caches to force fresh download on next reload/refresh
                          try {
                              localStorage.removeItem('precalculated_matches_cache_compressed-v11');
                              localStorage.removeItem('precalculated_matches_cache_time-v11');
                              localStorage.removeItem('prm_supabase_matches_cache');
                              localStorage.removeItem('prm_supabase_matches_cache_time');
                          } catch (cacheErr) {
                              console.warn("Failed to invalidate cache on import:", cacheErr);
                          }

                          setUploadedMatches(merged);
                          Storage.saveUploadedMatches(merged);
                          handleBackgroundSeerSync(merged, phaStatsMap, matchStars);

                          // Upload processed matches to Supabase (handling Excel, CSV, or pasted data)
                          if (newItems.length > 0) {
                              try {
                                  await savePrecalculatedMatches(newItems);
                                  showNotification(`${newItems.length} matches synced to Supabase!`, "success");
                              } catch (err) {
                                  console.error("Supabase sync failed during import on Analysis board:", err);
                                  showNotification("Partially synced. Supabase update failed.", "error");
                              }
                          }
                      }
                      setPendingFile(null);
                      setPendingPasteData(null);
                      setPasteInput('');
                      setShowDateModal(false);
                  };

                  const performImport = async () => {
                     setIsImporting(true);
                     try {
                        if (pendingFile) {
                          const isZip = pendingFile.name.toLowerCase().endsWith('.zip');
                          const isExcel = pendingFile.name.toLowerCase().endsWith('.xlsx') || pendingFile.name.toLowerCase().endsWith('.xls');
                          const reader = new FileReader();
                          await new Promise<void>((resolve, reject) => {
                             reader.onload = async (e) => {
                                try {
                                   if (isZip) {
                                      const buffer = e.target?.result as ArrayBuffer;
                                      const extractedMatches = await extractMatchesFromZip(buffer);
                                      await handleNewData(extractedMatches);
                                   } else if (isExcel) {
                                      const buffer = e.target?.result as ArrayBuffer;
                                      const matches = parseExcelMatches(buffer);
                                      await handleNewData(matches);
                                   } else {
                                      await handleNewData(e.target?.result as string);
                                   }
                                   resolve();
                                } catch (err) {
                                   reject(err);
                                }
                             };
                             reader.onerror = () => reject(new Error("File reading failed"));
                             if (isZip || isExcel) {
                                reader.readAsArrayBuffer(pendingFile);
                             } else {
                                reader.readAsText(pendingFile);
                             }
                          });
                        } else if (pendingPasteData || pasteInput) {
                          await handleNewData(pendingPasteData || pasteInput);
                        }
                     } catch (err: any) {
                        console.error("Import processing error: ", err);
                        showNotification("Import failed to process.", "error");
                     } finally {
                        setIsImporting(false);
                     }
                  };

                  performImport();
                }} className="flex-1 py-3 font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isImporting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    "Process Matches"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Algo Visualizer Overlay */}
      {algoProcessing && (
        <div className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center z-[100] backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-black/40 p-8 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-600/10 animate-pulse"></div>
                
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-30 animate-pulse rounded-full"></div>
                    <ScanLine size={64} className="text-indigo-400 animate-spin-slow relative z-10" />
                </div>

                <h3 className="text-2xl font-black mb-2 tracking-tight drop-shadow-md text-center">
                    AI Neural Engine Active
                </h3>
                <p className="text-indigo-200 text-sm font-medium mb-8 text-center animate-pulse">
                    {algoProcessing.stage}
                </p>

                <div className="w-full bg-gray-800/50 rounded-full h-2 mb-4 overflow-hidden border border-white/10">
                    <div 
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-700 ease-out" 
                        style={{ width: `${algoProcessing.progress}%` }}
                    ></div>
                </div>
                
                <div className="flex justify-between w-full text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                    <span>Analysis</span>
                    <span>{algoProcessing.progress}%</span>
                </div>
            </div>
        </div>
      )}

      {/* Clear Live Safeguard Modal */}
      {showLiveClearModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm border-l-4 border-amber-500">
            {/* ... */}
            <h3 className="font-bold text-lg mb-2 text-gray-800 flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={24} />
                Unsaved Changes
            </h3>
            <p className="text-sm text-gray-600 mb-4">
                You have unsaved live matches. If you clear now, they will be lost permanently.
                We recommend saving to Archives first.
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={handleSaveAndClearLive} 
                disabled={isActionLoading}
                className="w-full py-3 bg-emerald-600 text-white rounded font-bold text-sm shadow-sm hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {isActionLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16}/>}
                  Save & Clear
              </button>
              <button 
                onClick={performClear} 
                disabled={isActionLoading}
                className="w-full py-3 bg-gray-100 text-gray-600 rounded font-bold text-sm hover:bg-gray-200 border border-gray-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {isActionLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                  Clear Without Saving
              </button>
              <button onClick={() => setShowLiveClearModal(false)} disabled={isActionLoading} className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline text-center disabled:opacity-50">
                  Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analysis Clear Safeguard Modal */}
      {showAnalysisClearModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 backdrop-blur-sm">
          {/* ... */}
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm border-l-4 border-amber-500">
            <h3 className="font-bold text-lg mb-2 text-gray-800 flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={24} />
                Clear Analysis Data
            </h3>
            <p className="text-sm text-gray-600 mb-4">
                This will clear all matches from the Historical Analysis board.
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={handleSaveAndClearUploaded} 
                disabled={isActionLoading}
                className="w-full py-3 bg-emerald-600 text-white rounded font-bold text-sm shadow-sm hover:bg-emerald-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {isActionLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16}/>}
                  Archive & Clear
              </button>
              <button 
                onClick={handleClearUploaded} 
                disabled={isActionLoading}
                className="w-full py-3 bg-gray-100 text-gray-600 rounded font-bold text-sm hover:bg-gray-200 border border-gray-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {isActionLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                  Clear Without Saving
              </button>
              <button 
                onClick={handleWipeDatabaseMatches} 
                disabled={isActionLoading}
                className="w-full py-3 mt-4 bg-red-100 text-red-700 rounded font-bold text-sm hover:bg-red-200 border border-red-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {isActionLoading ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16}/>}
                  {isActionLoading ? 'Deleting...' : 'Wipe Database Matches'}
              </button>
              <button onClick={() => setShowAnalysisClearModal(false)} disabled={isActionLoading} className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline text-center disabled:opacity-50">
                  Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORMULA MODAL */}
      {showFormulaModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="font-bold text-indigo-900 flex items-center gap-2 text-lg">
                    <Calculator className="text-indigo-600" size={20}/> Core Calculation Protocols
                </h3>
                <button onClick={() => setShowFormulaModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X size={24}/>
                </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8">
                {/* Point System Formula */}
                <div className="bg-indigo-50/50 p-5 rounded-lg border border-indigo-100">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Grip size={20}/></div>
                        <div>
                            <h4 className="font-black text-indigo-900 text-lg uppercase tracking-wide">{FORMULA_DEFINITIONS.pointSystem.title}</h4>
                            <p className="text-indigo-600 text-xs font-bold">{FORMULA_DEFINITIONS.pointSystem.subtitle}</p>
                        </div>
                    </div>
                    
                    <p className="text-gray-700 text-sm mb-4 leading-relaxed font-medium">
                        {FORMULA_DEFINITIONS.pointSystem.description}
                    </p>

                    <div className="space-y-2 mb-4 bg-white p-4 rounded border border-indigo-100">
                        {FORMULA_DEFINITIONS.pointSystem.components.map((step, idx) => (
                            <p key={idx} className="text-xs text-gray-600 font-mono flex gap-2">
                                <span className="text-indigo-400 font-bold">•</span> {step}
                            </p>
                        ))}
                    </div>

                    <div className="bg-indigo-900 text-white p-3 rounded font-mono text-xs shadow-inner">
                        {FORMULA_DEFINITIONS.pointSystem.formula}
                    </div>
                </div>

                {/* Probability Confidence Formula */}
                <div className="bg-teal-50/50 p-5 rounded-lg border border-teal-100">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="p-2 bg-teal-100 text-teal-600 rounded-lg"><Activity size={20}/></div>
                        <div>
                            <h4 className="font-black text-teal-900 text-lg uppercase tracking-wide">{FORMULA_DEFINITIONS.probability.title}</h4>
                            <p className="text-teal-600 text-xs font-bold">{FORMULA_DEFINITIONS.probability.subtitle}</p>
                        </div>
                    </div>
                    
                    <p className="text-gray-700 text-sm mb-4 leading-relaxed font-medium">
                        {FORMULA_DEFINITIONS.probability.description}
                    </p>

                    <div className="space-y-2 mb-4 bg-white p-4 rounded border border-teal-100">
                        {FORMULA_DEFINITIONS.probability.components.map((step, idx) => (
                            <p key={idx} className="text-xs text-gray-600 font-mono flex gap-2">
                                <span className="text-teal-400 font-bold">•</span> {step}
                            </p>
                        ))}
                    </div>

                    <div className="bg-teal-900 text-white p-3 rounded font-mono text-xs shadow-inner">
                        {FORMULA_DEFINITIONS.probability.formula}
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Visible Safeguard Modal */}
      {showDeleteVisibleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Delete Matches?</h3>
              <p className="text-gray-500 mt-2">Are you sure you want to delete {displayMatches.length} visible matches? This action cannot be undone.</p>
              
              <div className="mt-6 flex flex-col gap-2">
                <button 
                  onClick={handleDeleteVisible} 
                  disabled={isDeletingVisible}
                  className={`w-full py-3 text-white rounded font-bold text-sm shadow-sm flex items-center justify-center gap-2 ${
                    isDeletingVisible ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {isDeletingVisible ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Yes, Delete All"
                  )}
                </button>
                <button 
                  onClick={() => setShowDeleteVisibleModal(false)} 
                  disabled={isDeletingVisible}
                  className="w-full py-3 bg-gray-100 text-gray-600 rounded font-bold text-sm hover:bg-gray-200 border border-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub Pattern Recommendations Modal */}
      {showSubPattModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                      <div className="flex items-center gap-2">
                          <BrainCircuit className="text-indigo-600" size={24} />
                          <h3 className="text-xl font-bold text-gray-800">Sub Pattern Recommendations</h3>
                      </div>
                      <div className="flex gap-2">
                          <button
                             onClick={handleRefreshSubPattData}
                             disabled={isRefreshingSubPatt}
                             className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-md font-bold text-sm hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2"
                             title="Force refresh historical matches from database"
                          >
                             <RefreshCw size={16} className={isRefreshingSubPatt ? 'animate-spin' : ''} /> {isRefreshingSubPatt ? 'Refreshing...' : 'Refresh'}
                          </button>
                          <button onClick={handleCopySubPattRecommendations} className="px-4 py-2 bg-indigo-600 text-white rounded-md font-bold text-sm hover:bg-indigo-700 flex flex-center gap-2">
                             <Copy size={16} /> Copy All Format
                          </button>
                          <button onClick={() => setShowSubPattModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors bg-white p-2 border border-gray-200 rounded-md shadow-sm flex items-center justify-center min-w-[36px]">
                              <X size={20} />
                          </button>
                      </div>
                  </div>
                  <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0 bg-gray-100 p-4 gap-4">
                      <div className="w-full md:w-1/3 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col min-h-0">
                          <div className="p-3 bg-gray-50 font-bold text-sm border-b border-gray-200 text-gray-700 rounded-t-lg">
                              Format to Copy
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] sm:text-xs leading-relaxed space-y-2 text-gray-800 select-all">
                              {subPatternRecommendations.map((r, i) => (
                                  <div key={i}>{r.shortCopyText}</div>
                              ))}
                              {subPatternRecommendations.length === 0 && (
                                  <div className="text-gray-400">
                                      {analyzedSubPatternsCount > 0
                                          ? `All ${analyzedSubPatternsCount} sub-patterns already match Patterns.tsx (0 updates needed)`
                                          : 'No data available'}
                                  </div>
                              )}
                          </div>
                      </div>
                      <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col min-h-0">
                           <div className="flex-1 overflow-auto rounded-lg">
                              <table className="w-full text-left text-sm whitespace-nowrap">
                                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm text-gray-600 font-bold border-b border-gray-200">
                                      <tr>
                                          <th className="p-3 text-center text-xs">Total</th>
                                          <th className="p-3 text-xs">Sub Pattern</th>
                                          <th className="p-3 text-center text-xs">Prim</th>
                                          <th className="p-3 text-center text-xs">Fin</th>
                                          <th className="p-3 text-center text-xs">PHA Matches (1:X:2)</th>
                                          <th className="p-3 text-center text-xs">PHA % (1:X:2)</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {subPatternRecommendations.map((r, i) => (
                                          <tr key={i} className="hover:bg-indigo-50/50 border-b border-gray-100 transition-colors">
                                              <td className="p-3 text-center font-mono font-medium text-gray-500 bg-gray-50/50">{r.total}</td>
                                              <td className="p-3 font-bold text-gray-800">{r.sub}</td>
                                              <td className="p-3 text-center font-bold text-indigo-700 bg-indigo-50/30">{r.prim}</td>
                                              <td className="p-3 text-center font-bold text-teal-700 bg-teal-50/30">{r.fin}</td>
                                              <td className="p-3 text-center font-mono text-gray-500 text-xs">{r.c1} : {r.cx} : {r.c2}</td>
                                              <td className="p-3 text-center font-mono text-gray-700 font-bold">{r.p1}% : {r.px}% : {r.p2}%</td>
                                          </tr>
                                      ))}
                                      {subPatternRecommendations.length === 0 && (
                                          <tr>
                                              <td colSpan={6} className="text-center p-8 text-gray-500">
                                                  {analyzedSubPatternsCount > 0
                                                      ? `All ${analyzedSubPatternsCount} analyzed sub-patterns already match Patterns.tsx (0 updates needed).`
                                                      : 'No sub pattern data to analyze.'}
                                              </td>
                                          </tr>
                                      )}
                                  </tbody>
                              </table>
                           </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Archive Delete Safeguard Modal */}
      {showArchiveDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Delete Archive?</h3>
              <p className="text-gray-500 mt-2">Delete archive for {selectedArchiveDate}? This will remove all matches in this session permanently.</p>
              
              <div className="mt-6 flex flex-col gap-2">
                <button 
                  onClick={async () => {
                    const updated = await Storage.deleteArchive(selectedArchiveDate);
                    setArchives(updated);
                    setSelectedArchiveDate('');
                    setShowArchiveDeleteModal(false);
                  }} 
                  className="w-full py-3 bg-red-600 text-white rounded font-bold text-sm shadow-sm hover:bg-red-700"
                >
                  Yes, Delete Archive
                </button>
                <button onClick={() => setShowArchiveDeleteModal(false)} className="w-full py-3 bg-gray-100 text-gray-600 rounded font-bold text-sm hover:bg-gray-200 border border-gray-200">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed bottom-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg shadow-2xl animate-in slide-in-from-bottom-4 duration-300 ${
          notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-sm">{notification.message}</span>
        </div>
      )}
    </AppShell>




  );
};

export default MatchAnalysis;
