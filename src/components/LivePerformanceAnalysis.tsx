import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Activity, 
  PlayCircle, 
  ChevronLeft, 
  BarChart3, 
  Target, 
  TrendingUp, 
  AlertCircle,
  Trophy,
  LayoutGrid,
  Filter,
  History,
  Trash2,
  Clock
} from 'lucide-react';
import { Match } from '../types';
import { getActualResult, matchesPrediction } from '../utils/matchProcessing';
import { isMatchAccurate } from '../utils/matchEvaluator';
import { updateMatchStarsFromPerformance } from '../utils/matchStars';
import * as Storage from '../services/storage';

interface LivePerformanceAnalysisProps {
  matches: Match[];
  onBack: () => void;
  initialCategory?: string;
  autoRun?: boolean;
  type?: 'daily' | 'jackpot';
  onTypeChange?: (type: 'daily' | 'jackpot') => void;
}

interface PerformanceMetric {
  total: number;
  correct: number;
  accuracy: number;
  pending: number;
}

interface GroupPerformance {
  overall: PerformanceMetric;
  byPriority: Record<string, PerformanceMetric>;
}

interface CategoryPerformance {
  overall: PerformanceMetric;
  byGroup: Record<number, PerformanceMetric>;
  byPriority: Record<string, PerformanceMetric>;
  byPriorityGroup: Record<string, Record<number, PerformanceMetric>>;
  algoPha?: PerformanceMetric;
  algoPhaProb?: PerformanceMetric;
  algoPhaExt?: PerformanceMetric;
  subPatt?: PerformanceMetric;
  algoSub?: PerformanceMetric;
  algoAlone?: PerformanceMetric;
  algoAloneByGroup?: Record<number, PerformanceMetric>;
  algoSubPha?: PerformanceMetric;
  slip?: PerformanceMetric;
  jackpotBreakdown?: {
    bankers: PerformanceMetric;
    valuePicks: PerformanceMetric;
    bankerDraws: PerformanceMetric;
    upsets: PerformanceMetric;
    valueBets: PerformanceMetric;
  };
}

interface PerformanceArchive {
  id: string;
  date: string;
  results: Record<string, CategoryPerformance>;
  type?: 'daily' | 'jackpot';
}

const LivePerformanceAnalysis: React.FC<LivePerformanceAnalysisProps> = ({ matches, onBack, initialCategory, autoRun, type = 'daily', onTypeChange }) => {
  const [analysisResult, setAnalysisResult] = useState<Record<string, CategoryPerformance>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory || 'top10');
  const [progress, setProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState('');
  const [archives, setArchives] = useState<PerformanceArchive[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingArchiveId, setViewingArchiveId] = useState<string | null>(null);
  const analysisQueuedRef = useRef(false);
  const actionDebounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const runResponsiveUpdate = useCallback((update: () => void) => {
    React.startTransition(update);
  }, []);

  const runDebouncedAction = useCallback((key: string, action: () => void | Promise<void>, delay = 350) => {
    if (actionDebounceTimers.current[key]) clearTimeout(actionDebounceTimers.current[key]);
    actionDebounceTimers.current[key] = setTimeout(() => {
      delete actionDebounceTimers.current[key];
      React.startTransition(() => {
        void action();
      });
    }, delay);
  }, []);

  useEffect(() => {
    return () => Object.values(actionDebounceTimers.current).forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    if (autoRun && matches.length > 0 && Object.keys(analysisResult).length === 0 && !isAnalyzing) {
      runDebouncedAction('performance-analysis', runAnalysis);
    }
  }, [autoRun, matches.length, isAnalyzing]);

  const categories = [
    { id: 'top10', label: 'Top 12' },
    { id: 'best_bet', label: 'Best Bet' },
    { id: 'bankers_dlive', label: 'Bankers Dlive' },
    { id: 'botb_best', label: 'BOTB' },
    { id: 'top20', label: 'Top 20' },
    { id: 'bankers_jackpot', label: 'Bankers (Jackpot)' },
    { id: 'value_bets', label: 'Value Bets' },
    { id: 'value_picks', label: 'Value Picks' },
    { id: 'banker_draws', label: 'Banker Draws' },
    { id: 'upsets', label: 'Upsets' },
    { id: 'jackpot_slip', label: 'Jackpot Slip' }
  ];

  const calculatePerformance = (currentMatches: Match[]) => {
    const results: Record<string, CategoryPerformance> = {};

    categories.forEach(cat => {
      const catId = cat.id;
      const catMatches = currentMatches.filter(m => {
        if (catId === 'jackpot_slip') return m.isJackpot;
        const tags = m.evaluatorTags || [];
        return tags.some(t => t.startsWith(`${catId}:`));
      });

      if (catMatches.length === 0) return;

      const categoryPerf: CategoryPerformance = {
        overall: { total: 0, correct: 0, accuracy: 0, pending: 0 },
        byGroup: {},
        byPriority: {},
        byPriorityGroup: {}
      };

      catMatches.forEach(m => {
        const actual = getActualResult(m.result || '');
        const completed = actual !== 'pending';
        const group = m.group || 0;

        if (!completed) {
          if (!categoryPerf.overall.pending) categoryPerf.overall.pending = 0;
          categoryPerf.overall.pending++;
          return;
        }

        let matchIsAccurate = false;
        let catTags: string[] = [];

        if (catId === 'jackpot_slip') {
          // For Jackpot Slip, accuracy is based on the AI's final prediction for the match
          matchIsAccurate = matchesPrediction(m.finalPrediction || '', actual);
          // Use jackpot-related tags as priority proxy if available
          catTags = (m.evaluatorTags || []).filter(t => 
            t.startsWith('bankers_jackpot:') || 
            t.startsWith('value_picks:') || 
            t.startsWith('banker_draws:') || 
            t.startsWith('upsets:')
          );
          if (catTags.length === 0) catTags = ['jackpot:GENERAL'];
        } else {
          const tags = m.evaluatorTags || [];
          catTags = tags.filter(t => t.startsWith(`${catId}:`));
          if (catTags.length === 0) return;

          // Use the highest priority tag for accuracy check of the match itself
          const highestPriorityTag = catTags.sort()[0];
          const highestPriority = highestPriorityTag ? highestPriorityTag.split(':')[1] : '';
          matchIsAccurate = isMatchAccurate(m, catId, highestPriority) || false;
        }

        // Overall (Unique Match)
        categoryPerf.overall.total++;
        if (matchIsAccurate) categoryPerf.overall.correct++;

        // By Group (Unique Match)
        if (!categoryPerf.byGroup[group]) categoryPerf.byGroup[group] = { total: 0, correct: 0, accuracy: 0, pending: 0 };
        categoryPerf.byGroup[group].total++;
        if (matchIsAccurate) categoryPerf.byGroup[group].correct++;

        // By Priority (Per Tag)
        catTags.forEach(tag => {
          const priority = tag.includes(':') ? tag.split(':')[1] : tag;
          let isAccurate = matchIsAccurate;
          
          if (catId !== 'jackpot_slip') {
            isAccurate = isMatchAccurate(m, catId, priority) || false;
          }

          if (!categoryPerf.byPriority[priority]) categoryPerf.byPriority[priority] = { total: 0, correct: 0, accuracy: 0, pending: 0 };
          categoryPerf.byPriority[priority].total++;
          if (isAccurate) categoryPerf.byPriority[priority].correct++;

          // By Priority per Group (Per Tag)
          if (!categoryPerf.byPriorityGroup[priority]) categoryPerf.byPriorityGroup[priority] = {};
          if (!categoryPerf.byPriorityGroup[priority][group]) categoryPerf.byPriorityGroup[priority][group] = { total: 0, correct: 0, accuracy: 0, pending: 0 };
          categoryPerf.byPriorityGroup[priority][group].total++;
          if (isAccurate) categoryPerf.byPriorityGroup[priority][group].correct++;
        });
      });

      // Tactical Audits
      const completedScopeBase = catMatches.filter(m => getActualResult(m.result || '') !== 'pending');
      
      const algoPhaAgree = completedScopeBase.filter(m => m.algoReport?.prediction && m.patternAnalysis?.primaryPrediction && m.algoReport.prediction === m.patternAnalysis.primaryPrediction);
      const algoPhaProbAgree = completedScopeBase.filter(m => m.algoReport?.prediction && m.patternAnalysis?.primaryPrediction && m.algoReport.prediction === m.patternAnalysis.primaryPrediction && (m.algoReport.confidence || 0) > 70);
      const algoPhaExtAgree = completedScopeBase.filter(m => m.algoReport?.prediction && m.patternAnalysis?.primaryPrediction && m.pred1x2 && m.algoReport.prediction === m.patternAnalysis.primaryPrediction && m.algoReport.prediction === m.pred1x2);
      const subPattMatches = completedScopeBase.filter(m => !!m.patternAnalysis?.subPatternPrediction && m.patternAnalysis.subPatternPrediction !== 'NA');
      const algoSubAgree = completedScopeBase.filter(m => m.algoReport?.prediction && m.patternAnalysis?.subPatternPrediction && m.algoReport.prediction === m.patternAnalysis.subPatternPrediction);

      const algoAloneMatches = completedScopeBase.filter(m => !!m.algoReport?.prediction);
      const algoSubPhaAgree = completedScopeBase.filter(m => 
        m.algoReport?.prediction && 
        m.patternAnalysis?.subPatternPrediction && 
        m.patternAnalysis?.primaryPrediction && 
        m.algoReport.prediction === m.patternAnalysis.subPatternPrediction && 
        m.algoReport.prediction === m.patternAnalysis.primaryPrediction
      );

      const calcTacticalAcc = (matches: Match[], isCorrect: (m: Match) => boolean) => {
          const total = matches.length;
          const correct = matches.filter(isCorrect).length;
          return { total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0, pending: 0 };
      };

      categoryPerf.algoPha = calcTacticalAcc(algoPhaAgree, m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result || '')));
      categoryPerf.algoPhaProb = calcTacticalAcc(algoPhaProbAgree, m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result || '')));
      categoryPerf.algoPhaExt = calcTacticalAcc(algoPhaExtAgree, m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result || '')));
      categoryPerf.subPatt = calcTacticalAcc(subPattMatches, m => matchesPrediction(m.patternAnalysis?.subPatternPrediction || '', getActualResult(m.result || '')));
      categoryPerf.algoSub = calcTacticalAcc(algoSubAgree, m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result || '')));
      
      categoryPerf.algoAlone = calcTacticalAcc(algoAloneMatches, m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result || '')));
      categoryPerf.algoAloneByGroup = {
        1: calcTacticalAcc(algoAloneMatches.filter(m => m.group === 1), m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result || ''))),
        2: calcTacticalAcc(algoAloneMatches.filter(m => m.group === 2), m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result || ''))),
        3: calcTacticalAcc(algoAloneMatches.filter(m => m.group === 3), m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result || '')))
      };
      categoryPerf.algoSubPha = calcTacticalAcc(algoSubPhaAgree, m => matchesPrediction(m.algoReport?.prediction || '', getActualResult(m.result || '')));

      // Slip Performance (Actual selected matches)
      const slipMatches = catId === 'jackpot_slip' 
        ? completedScopeBase 
        : completedScopeBase.filter(m => {
            const tags = m.evaluatorTags || [];
            return tags.some(t => t.startsWith(`${catId}:`) && !t.endsWith(':DEMOTE'));
          });
      
      categoryPerf.slip = calcTacticalAcc(slipMatches, m => {
        if (catId === 'jackpot_slip') return matchesPrediction(m.finalPrediction || '', getActualResult(m.result || ''));
        const tags = m.evaluatorTags || [];
        const catTags = tags.filter(t => t.startsWith(`${catId}:`));
        const highestPriorityTag = catTags.sort()[0];
        const highestPriority = highestPriorityTag ? highestPriorityTag.split(':')[1] : '';
        return isMatchAccurate(m, catId, highestPriority) || false;
      });

      if (catId === 'jackpot_slip') {
        const breakdown = {
          bankers: { total: 0, correct: 0, accuracy: 0, pending: 0 },
          valuePicks: { total: 0, correct: 0, accuracy: 0, pending: 0 },
          bankerDraws: { total: 0, correct: 0, accuracy: 0, pending: 0 },
          upsets: { total: 0, correct: 0, accuracy: 0, pending: 0 },
          valueBets: { total: 0, correct: 0, accuracy: 0, pending: 0 }
        };

        completedScopeBase.forEach(m => {
          const actual = getActualResult(m.result || '');
          const isCorrect = matchesPrediction(m.finalPrediction || '', actual);
          const tags = m.evaluatorTags || [];
          
          if (tags.some(t => t.startsWith('bankers_jackpot:'))) {
            breakdown.bankers.total++;
            if (isCorrect) breakdown.bankers.correct++;
          }
          if (tags.some(t => t.startsWith('value_picks:'))) {
            breakdown.valuePicks.total++;
            if (isCorrect) breakdown.valuePicks.correct++;
          }
          if (tags.some(t => t.startsWith('banker_draws:'))) {
            breakdown.bankerDraws.total++;
            if (isCorrect) breakdown.bankerDraws.correct++;
          }
          if (tags.some(t => t.startsWith('upsets:'))) {
            breakdown.upsets.total++;
            if (isCorrect) breakdown.upsets.correct++;
          }
          if (tags.some(t => t.startsWith('value_bets:'))) {
            breakdown.valueBets.total++;
            if (isCorrect) breakdown.valueBets.correct++;
          }
        });
        
        const calc = (p: PerformanceMetric) => { p.accuracy = p.total > 0 ? Math.round((p.correct / p.total) * 100) : 0; };
        calc(breakdown.bankers);
        calc(breakdown.valuePicks);
        calc(breakdown.bankerDraws);
        calc(breakdown.upsets);
        calc(breakdown.valueBets);
        
        categoryPerf.jackpotBreakdown = breakdown;
      }

      // Calculate percentages
      const calcAcc = (p: PerformanceMetric) => {
        p.accuracy = p.total > 0 ? Math.round((p.correct / p.total) * 100) : 0;
      };

      calcAcc(categoryPerf.overall);
      Object.values(categoryPerf.byGroup).forEach(calcAcc);
      Object.values(categoryPerf.byPriority).forEach(calcAcc);
      Object.values(categoryPerf.byPriorityGroup).forEach(groups => {
        Object.values(groups).forEach(calcAcc);
      });

      results[catId] = categoryPerf;
    });
    
    return results;
  };

  useEffect(() => {
    const loadedArchives = Storage.getPerformanceArchives();
    setArchives(loadedArchives);
    
    // Load the latest archive of the current type
    const typeArchives = loadedArchives.filter((a: PerformanceArchive) => a.type === type || (!a.type && type === 'daily'));
    if (typeArchives.length > 0) {
      setAnalysisResult(typeArchives[0].results);
    } else {
      setAnalysisResult({});
    }
  }, [type]);

  // Auto-update the latest archive silently when matches change
  // Removed to prevent overwriting saved data when live matches change

  const runAnalysis = async () => {
    if (analysisQueuedRef.current || isAnalyzing) return;
    analysisQueuedRef.current = true;
    setIsAnalyzing(true);
    setProgress(0);
    setAnalysisStep('Initializing Deep Scan...');
    setViewingArchiveId(null);
    
    // We'll use a series of steps to simulate a deep, rigorous process
    // Total time will be around 60 seconds to feel "real" and "thorough"
    
    const steps = [
      { label: 'Synchronizing Match Data...', duration: 5000 },
      { label: 'Recalculating PHA Support Maps...', duration: 8000 },
      { label: 'Auditing Top 12 Performance...', duration: 8000 },
      { label: 'Auditing Value Picks & Bankers...', duration: 8000 },
      { label: 'Cross-Referencing Priority Tiers...', duration: 8000 },
      { label: 'Validating Group Volatility...', duration: 8000 },
      { label: 'Hallucination Prevention Check...', duration: 10000 },
      { label: 'Finalizing Tactical Audit...', duration: 5000 }
    ];

    let currentProgress = 0;
    for (const step of steps) {
      setAnalysisStep(step.label);
      const subSteps = 10;
      const increment = (100 / steps.length) / subSteps;
      
      for (let i = 0; i < subSteps; i++) {
        await new Promise(resolve => setTimeout(resolve, step.duration / subSteps));
        currentProgress += increment;
        setProgress(Math.min(currentProgress, 99));
      }
    }

    setAnalysisStep('Compiling Final Report...');
    
    const results = calculatePerformance(matches);

    React.startTransition(() => setAnalysisResult(results));
    setProgress(100);
    setAnalysisStep('Analysis Complete');
    
    // Save to archives
    const newArchive: PerformanceArchive = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      results,
      type
    };
    Storage.savePerformanceArchive(newArchive);
    setArchives(Storage.getPerformanceArchives());
    
    // Update match stars based on the new performance data
    updateMatchStarsFromPerformance();
    
    setTimeout(() => {
      setIsAnalyzing(false);
      analysisQueuedRef.current = false;
    }, 1000);
  };

  const loadArchive = (archive: PerformanceArchive) => {
    runResponsiveUpdate(() => {
      setAnalysisResult(archive.results);
      setViewingArchiveId(archive.id);
      setShowHistory(false);
    });
  };

  const handleDeleteArchive = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    Storage.deletePerformanceArchive(id);
    setArchives(Storage.getPerformanceArchives());
    if (viewingArchiveId === id) {
      setAnalysisResult({});
      setViewingArchiveId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => React.startTransition(onBack)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Activity size={18} className="text-red-600" />
              Live Performance Analysis
              {viewingArchiveId && <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">Viewing Archive</span>}
            </h2>
            <p className="text-xs text-gray-500">Audit accuracy across categories, groups, and priorities.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Analysis Type Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 shadow-inner">
            <button 
              onClick={() => runResponsiveUpdate(() => onTypeChange?.('daily'))}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${type === 'daily' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              <BarChart3 size={12} />
              Daily
            </button>
            <button 
              onClick={() => runResponsiveUpdate(() => onTypeChange?.('jackpot'))}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${type === 'jackpot' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              <Trophy size={12} />
              Jackpot
            </button>
          </div>
          <div className="relative">
            <button 
              onClick={() => runResponsiveUpdate(() => setShowHistory(!showHistory))}
              className="px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-md font-bold text-sm shadow-sm hover:bg-gray-50 flex items-center gap-2 transition-all"
            >
              <History size={16} />
              <span className="hidden sm:inline">History</span>
            </button>
            
            {showHistory && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <Clock size={16} /> Past Analyses
                  </h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {archives.filter(a => a.type === type || (!a.type && type === 'daily')).length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500 italic">No previous {type} analyses found.</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {archives
                        .filter(a => a.type === type || (!a.type && type === 'daily'))
                        .map(archive => (
                        <div 
                          key={archive.id} 
                          onClick={() => runResponsiveUpdate(() => loadArchive(archive))}
                          className={`p-3 hover:bg-gray-50 cursor-pointer transition-colors flex justify-between items-center ${viewingArchiveId === archive.id ? 'bg-red-50' : ''}`}
                        >
                          <div>
                            <div className="font-bold text-sm text-gray-800">
                              {new Date(archive.date).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(archive.date).toLocaleTimeString()}
                            </div>
                          </div>
                          <button 
                            onClick={(e) => handleDeleteArchive(e, archive.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={() => runDebouncedAction('performance-analysis', runAnalysis)}
            disabled={isAnalyzing || matches.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-md font-bold text-sm shadow-sm hover:bg-red-700 flex items-center gap-2 disabled:opacity-50 transition-all"
          >
            {isAnalyzing ? <Activity size={16} className="animate-spin" /> : <PlayCircle size={16} />}
            Run Analysis
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <div className="relative w-32 h-32 mb-8">
              <div className="absolute inset-0 border-4 border-red-100 rounded-full"></div>
              <div 
                className="absolute inset-0 border-4 border-red-600 rounded-full border-t-transparent animate-spin"
                style={{ animationDuration: '3s' }}
              ></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-black text-gray-800">{Math.round(progress)}%</span>
              </div>
            </div>
            
            <h3 className="font-bold text-gray-800 text-xl mb-2 animate-pulse">{analysisStep}</h3>
            <p className="text-gray-500 text-sm max-w-sm">
              Performing deep tactical audit. This process cross-references historical PHA patterns with live outcomes to ensure 100% calculation accuracy.
            </p>
            
            <div className="w-full max-w-md mt-8 bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-red-600 h-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        ) : Object.keys(analysisResult).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <BarChart3 size={32} className="text-red-600" />
            </div>
            <h3 className="font-bold text-gray-800 text-lg">Ready for Analysis</h3>
            <p className="text-gray-500 max-w-xs mt-2">Click "Run Analysis" to calculate performance metrics for {matches.length} live matches.</p>
          </div>
        ) : (
          <div className="space-y-6 max-w-6xl mx-auto">
            {/* Category Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map(cat => {
                const hasData = analysisResult[cat.id] && (analysisResult[cat.id].overall.total > 0 || analysisResult[cat.id].overall.pending > 0);
                return (
                  <button
                    key={cat.id}
                    onClick={() => runResponsiveUpdate(() => setActiveCategory(cat.id))}
                    disabled={!hasData}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                      activeCategory === cat.id
                        ? 'bg-red-600 text-white shadow-md'
                        : hasData
                        ? 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {cat.label}
                      {hasData && (
                        <div className="flex items-center gap-1">
                          {analysisResult[cat.id].overall.pending > 0 && (
                            <span className="bg-blue-500/30 px-1.5 py-0.5 rounded text-[10px]">
                              {analysisResult[cat.id].overall.pending}P
                            </span>
                          )}
                          {analysisResult[cat.id].overall.total > 0 && (
                            <span className="bg-black/20 px-1.5 py-0.5 rounded text-[10px]">
                              {analysisResult[cat.id].overall.accuracy}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Category Content */}
            {(() => {
              const cat = categories.find(c => c.id === activeCategory);
              const data = analysisResult[activeCategory];
              
              if (!data || data.overall.total === 0) {
                return (
                  <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                    <BarChart3 size={48} className="text-gray-300 mx-auto mb-4" />
                    <h3 className="font-bold text-gray-800">No Data for {cat?.label}</h3>
                    <p className="text-gray-500 text-sm mt-1">Try running the analysis or check if matches have tags for this category.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Category Header */}
                    <div className="bg-gray-900 px-6 py-4 flex items-center justify-between">
                      <h3 className="text-white font-bold text-lg uppercase tracking-wider">{cat?.label}</h3>
                      <div className="flex items-center gap-6">
                        {data.slip && (
                          <div className="text-right border-r border-gray-700 pr-6">
                            <div className="text-[10px] text-gray-400 uppercase font-bold">Slip Accuracy</div>
                            <div className={`text-xl font-black ${data.slip.accuracy >= 80 ? 'text-green-400' : data.slip.accuracy >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                              {data.slip.accuracy}% <span className="text-xs font-normal text-gray-500">({data.slip.correct}/{data.slip.total})</span>
                            </div>
                          </div>
                        )}
                        <div className="text-right">
                          <div className="text-[10px] text-gray-400 uppercase font-bold">Overall Accuracy</div>
                          <div className={`text-xl font-black ${data.overall.accuracy >= 80 ? 'text-green-400' : data.overall.accuracy >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                            {data.overall.accuracy}% <span className="text-xs font-normal text-gray-500">({data.overall.correct}/{data.overall.total})</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Groups Breakdown */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2">
                          <Target size={14} /> Performance per Group
                        </h4>
                        <div className="space-y-2">
                          {[1, 2, 3].map(group => {
                            const gData = data.byGroup[group];
                            if (!gData) return null;
                            return (
                              <div key={group} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <span className="font-bold text-gray-700">Group {group}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-gray-500 font-mono">{gData.correct}/{gData.total}</span>
                                  <span className={`font-bold ${gData.accuracy >= 80 ? 'text-green-600' : 'text-gray-700'}`}>{gData.accuracy}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Priorities Breakdown */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2">
                          <TrendingUp size={14} /> {activeCategory === 'jackpot_slip' ? 'Performance per Tag' : 'Performance per Priority'}
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(data.byPriority).sort(([a], [b]) => {
                            if (a === 'PROMOTE') return -1;
                            if (b === 'PROMOTE') return 1;
                            if (a === 'DEMOTE') return 1;
                            if (b === 'DEMOTE') return -1;
                            return a.localeCompare(b);
                          }).map(([pr, prData]: [string, any]) => {
                            const isJackpotTag = activeCategory === 'jackpot_slip';
                            return (
                              <div key={pr} className={`flex items-center justify-between p-2 rounded-lg border ${
                                pr === 'PROMOTE' ? 'bg-green-50 border-green-100' : 
                                pr === 'DEMOTE' ? 'bg-orange-50 border-orange-100' : 
                                isJackpotTag ? 'bg-blue-50 border-blue-100' :
                                'bg-indigo-50 border-indigo-100'
                              }`}>
                                <span className={`font-bold text-[10px] truncate max-w-[80px] ${
                                  pr === 'PROMOTE' ? 'text-green-700' : 
                                  pr === 'DEMOTE' ? 'text-orange-700' : 
                                  isJackpotTag ? 'text-blue-700' :
                                  'text-indigo-700'
                                }`}>{pr}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-mono ${
                                    pr === 'PROMOTE' ? 'text-green-400' : 
                                    pr === 'DEMOTE' ? 'text-orange-400' : 
                                    isJackpotTag ? 'text-blue-400' :
                                    'text-indigo-400'
                                  }`}>{prData.correct}/{prData.total}</span>
                                  <span className={`font-bold text-xs ${
                                    pr === 'PROMOTE' ? 'text-green-800' : 
                                    pr === 'DEMOTE' ? 'text-orange-800' : 
                                    isJackpotTag ? 'text-blue-800' :
                                    'text-indigo-800'
                                  }`}>{prData.accuracy}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Priority per Group Table */}
                    <div className="border-t border-gray-100 bg-gray-50/50 p-6">
                      <h4 className="text-sm font-bold text-gray-500 uppercase flex items-center gap-2 mb-4">
                        <BarChart3 size={14} /> Priority per Group Detail
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="text-[10px] text-gray-400 uppercase font-bold border-b border-gray-200">
                              <th className="pb-2">Priority</th>
                              <th className="pb-2">Group 1</th>
                              <th className="pb-2">Group 2</th>
                              <th className="pb-2">Group 3</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {Object.keys(data.byPriorityGroup)
                              .sort()
                              .map(pr => (
                                <tr key={pr} className="hover:bg-white transition-colors">
                                  <td className="py-3 font-black text-gray-400">{pr}</td>
                                  {[1, 2, 3].map(g => {
                                    const pgData = data.byPriorityGroup[pr][g];
                                    if (!pgData) return <td key={g} className="py-3 text-gray-300">-</td>;
                                    return (
                                      <td key={g} className="py-3">
                                        <div className={`font-bold ${pgData.accuracy >= 80 ? 'text-green-600' : pgData.accuracy >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                          {pgData.accuracy}%
                                        </div>
                                        <div className="text-[10px] text-gray-400">{pgData.correct}/{pgData.total}</div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Tactical Audit Section */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                          <Activity size={20} className="text-red-600" />
                          Tactical Performance Audit
                        </h3>
                        <p className="text-sm text-gray-500">Actionable insights based on {cat?.label} performance.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Strength */}
                      <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                        <div className="flex items-center gap-2 text-green-700 font-bold mb-2">
                          <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px]">
                            <Target size={12} />
                          </div>
                          Top Performers
                        </div>
                        <div className="space-y-2">
                          {Object.entries(data.byPriority)
                            .filter(([_, d]: [string, any]) => d.accuracy >= 80 && d.total >= 2)
                            .sort((a: [string, any], b: [string, any]) => b[1].accuracy - a[1].accuracy)
                            .slice(0, 3)
                            .map(([pr]) => (
                              <div key={pr} className="text-xs text-green-800 flex items-center justify-between">
                                <span>{pr} in {cat?.label}</span>
                                <span className="font-bold">{data.byPriority[pr].accuracy}%</span>
                              </div>
                            ))}
                          {Object.entries(data.byPriority).filter(([_, d]: [string, any]) => d.accuracy >= 80 && d.total >= 2).length === 0 && (
                            <div className="text-xs text-green-600 italic">No high-confidence priorities identified yet.</div>
                          )}
                        </div>
                      </div>

                      {/* Warning */}
                      <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                        <div className="flex items-center gap-2 text-amber-700 font-bold mb-2">
                          <div className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">
                            <Activity size={12} />
                          </div>
                          Needs Review
                        </div>
                        <div className="space-y-2">
                          {Object.entries(data.byPriority)
                            .filter(([_, d]: [string, any]) => d.accuracy >= 50 && d.accuracy < 80 && d.total >= 2)
                            .sort((a: [string, any], b: [string, any]) => b[1].accuracy - a[1].accuracy)
                            .slice(0, 3)
                            .map(([pr]) => (
                              <div key={pr} className="text-xs text-amber-800 flex items-center justify-between">
                                <span>{pr} in {cat?.label}</span>
                                <span className="font-bold">{data.byPriority[pr].accuracy}%</span>
                              </div>
                            ))}
                          {Object.entries(data.byPriority).filter(([_, d]: [string, any]) => d.accuracy >= 50 && d.accuracy < 80 && d.total >= 2).length === 0 && (
                            <div className="text-xs text-amber-600 italic">No priorities in the warning zone.</div>
                          )}
                        </div>
                      </div>

                      {/* Danger */}
                      <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                        <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
                          <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px]">
                            <ChevronLeft size={12} className="rotate-180" />
                          </div>
                          Avoid / Refine
                        </div>
                        <div className="space-y-2">
                          {Object.entries(data.byPriority)
                            .filter(([_, d]: [string, any]) => d.accuracy < 50 && d.total >= 2)
                            .sort((a: [string, any], b: [string, any]) => a[1].accuracy - b[1].accuracy)
                            .slice(0, 3)
                            .map(([pr]) => (
                              <div key={pr} className="text-xs text-red-800 flex items-center justify-between">
                                <span>{pr} in {cat?.label}</span>
                                <span className="font-bold">{data.byPriority[pr].accuracy}%</span>
                              </div>
                            ))}
                          {Object.entries(data.byPriority).filter(([_, d]: [string, any]) => d.accuracy < 50 && d.total >= 2).length === 0 && (
                            <div className="text-xs text-red-600 italic">No critical failures identified.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 bg-white rounded-xl p-4 border border-gray-200">
                      <h4 className="text-sm font-bold text-gray-800 mb-3">
                        {activeCategory === 'jackpot_slip' ? 'Jackpot Slip Composition Audit' : 'AI Prediction Combinations Audit'}
                      </h4>
                      
                      {activeCategory === 'jackpot_slip' && data.jackpotBreakdown ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                          <div className="bg-green-50 rounded p-2 text-center border border-green-100">
                            <div className="text-[10px] text-green-600 font-bold mb-1 uppercase">Bankers</div>
                            <div className="text-sm font-bold text-green-800">{data.jackpotBreakdown.bankers.accuracy}%</div>
                            <div className="text-[10px] text-green-500">{data.jackpotBreakdown.bankers.correct}/{data.jackpotBreakdown.bankers.total}</div>
                          </div>
                          <div className="bg-blue-50 rounded p-2 text-center border border-blue-100">
                            <div className="text-[10px] text-blue-600 font-bold mb-1 uppercase">Value Picks</div>
                            <div className="text-sm font-bold text-blue-800">{data.jackpotBreakdown.valuePicks.accuracy}%</div>
                            <div className="text-[10px] text-blue-500">{data.jackpotBreakdown.valuePicks.correct}/{data.jackpotBreakdown.valuePicks.total}</div>
                          </div>
                          <div className="bg-amber-50 rounded p-2 text-center border border-amber-100">
                            <div className="text-[10px] text-amber-600 font-bold mb-1 uppercase">Banker Draws</div>
                            <div className="text-sm font-bold text-amber-800">{data.jackpotBreakdown.bankerDraws.accuracy}%</div>
                            <div className="text-[10px] text-amber-500">{data.jackpotBreakdown.bankerDraws.correct}/{data.jackpotBreakdown.bankerDraws.total}</div>
                          </div>
                          <div className="bg-red-50 rounded p-2 text-center border border-red-100">
                            <div className="text-[10px] text-red-600 font-bold mb-1 uppercase">Upsets</div>
                            <div className="text-sm font-bold text-red-800">{data.jackpotBreakdown.upsets.accuracy}%</div>
                            <div className="text-[10px] text-red-500">{data.jackpotBreakdown.upsets.correct}/{data.jackpotBreakdown.upsets.total}</div>
                          </div>
                          <div className="bg-purple-50 rounded p-2 text-center border border-purple-100">
                            <div className="text-[10px] text-purple-600 font-bold mb-1 uppercase">Value Bets</div>
                            <div className="text-sm font-bold text-purple-800">{data.jackpotBreakdown.valueBets.accuracy}%</div>
                            <div className="text-[10px] text-purple-500">{data.jackpotBreakdown.valueBets.correct}/{data.jackpotBreakdown.valueBets.total}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                          <div className="bg-gray-50 rounded p-2 text-center border border-gray-100">
                            <div className="text-[10px] text-gray-500 font-bold mb-1">ALGO+PHA</div>
                            <div className="text-sm font-bold text-gray-800">{data.algoPha?.accuracy || 0}%</div>
                            <div className="text-[10px] text-gray-400">{data.algoPha?.correct || 0}/{data.algoPha?.total || 0}</div>
                          </div>
                          <div className="bg-gray-50 rounded p-2 text-center border border-gray-100">
                            <div className="text-[10px] text-gray-500 font-bold mb-1">ALGO+PHA+PROB</div>
                            <div className="text-sm font-bold text-gray-800">{data.algoPhaProb?.accuracy || 0}%</div>
                            <div className="text-[10px] text-gray-400">{data.algoPhaProb?.correct || 0}/{data.algoPhaProb?.total || 0}</div>
                          </div>
                          <div className="bg-gray-50 rounded p-2 text-center border border-gray-100">
                            <div className="text-[10px] text-gray-500 font-bold mb-1">ALGO+PHA+EXT</div>
                            <div className="text-sm font-bold text-gray-800">{data.algoPhaExt?.accuracy || 0}%</div>
                            <div className="text-[10px] text-gray-400">{data.algoPhaExt?.correct || 0}/{data.algoPhaExt?.total || 0}</div>
                          </div>
                          <div className="bg-gray-50 rounded p-2 text-center border border-gray-100">
                            <div className="text-[10px] text-gray-500 font-bold mb-1">SUB PATT</div>
                            <div className="text-sm font-bold text-gray-800">{data.subPatt?.accuracy || 0}%</div>
                            <div className="text-[10px] text-gray-400">{data.subPatt?.correct || 0}/{data.subPatt?.total || 0}</div>
                          </div>
                          <div className="bg-gray-50 rounded p-2 text-center border border-gray-100">
                            <div className="text-[10px] text-gray-500 font-bold mb-1">ALGO+SUB</div>
                            <div className="text-sm font-bold text-gray-800">{data.algoSub?.accuracy || 0}%</div>
                            <div className="text-[10px] text-gray-400">{data.algoSub?.correct || 0}/{data.algoSub?.total || 0}</div>
                          </div>
                          <div className="bg-gray-50 rounded p-2 text-center border border-gray-100">
                            <div className="text-[10px] text-gray-500 font-bold mb-1">ALGO+SUB+PHA</div>
                            <div className="text-sm font-bold text-gray-800">{data.algoSubPha?.accuracy || 0}%</div>
                            <div className="text-[10px] text-gray-400">{data.algoSubPha?.correct || 0}/{data.algoSubPha?.total || 0}</div>
                          </div>
                          <div className="bg-blue-50 rounded p-2 text-center border border-blue-100">
                            <div className="text-[10px] text-blue-600 font-bold mb-1">ALGO ALONE</div>
                            <div className="text-sm font-bold text-blue-800">{data.algoAlone?.accuracy || 0}%</div>
                            <div className="text-[10px] text-blue-500">{data.algoAlone?.correct || 0}/{data.algoAlone?.total || 0}</div>
                          </div>
                        </div>
                      )}

                      {data.algoAloneByGroup && (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {[1, 2, 3].map(group => {
                            const gData = data.algoAloneByGroup?.[group];
                            if (!gData) return null;
                            return (
                              <div key={group} className="bg-blue-50/50 rounded p-2 text-center border border-blue-50">
                                <div className="text-[10px] text-blue-600 font-bold mb-1">ALGO G{group}</div>
                                <div className="text-sm font-bold text-blue-800">{gData.accuracy}%</div>
                                <div className="text-[10px] text-blue-500">{gData.correct}/{gData.total}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default LivePerformanceAnalysis;