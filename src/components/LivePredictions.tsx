import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Database, FlaskConical } from 'lucide-react';
import { Match } from '../types';
import MatchCard from './MatchCard';
import { getActualResult, matchesPrediction } from '../utils/matchProcessing';
import { predictWithSeer, DEFAULT_WEIGHTS } from '../utils/seerLogic';
import { predictWithHybridML } from '../utils/hybridMachineLearning';
import { useMLMatrix } from '../context/MLMatrixContext';

interface LivePredictionsProps {
  matches: Match[];
  expandedMatch: number | null;
  setExpandedMatch: (id: number | null) => void;
  phaStatsMap: Record<string, { total: number; correct: number; outcomes: { '1': number; 'X': number; '2': number }; favWin: number; draw: number; upsetWin: number }>;
  title?: string;
  onDelete?: (id: string | number) => void;
  matchStars?: Record<string, number>;
}

const PAGE_SIZE = 40;

const LivePredictions: React.FC<LivePredictionsProps> = ({ matches, expandedMatch, setExpandedMatch, phaStatsMap, title = "Live Matches", onDelete, matchStars = {} }) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showMLDropdown, setShowMLDropdown] = useState(false);
  const [mlSourceFilter, setMlSourceFilter] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const { mlData } = useMLMatrix();

  useEffect(() => {
      setVisibleCount(PAGE_SIZE);
  }, [matches]);

  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      observerRef.current = new IntersectionObserver(entries => {
          if (entries[0].isIntersecting) {
              setVisibleCount(prev => Math.min(prev + PAGE_SIZE, matches.length));
          }
      }, { rootMargin: '250px' });
      observerRef.current.observe(node);
  }, [matches.length]);

  const processedMatches = useMemo(() => {
      return matches.map(m => {
          // STICKINESS FIX: If a match already has embedded ML Info (e.g. from processMatch or a manual pivot),
          // do NOT recalculate it dynamically. This makes the ML pivot engine fully sticky.
          if (m.mlInfo?.mlPrediction) {
              return m; 
          }

          // Fallback only if missing (should be rare since processMatch handles it)
          const mlInfo = predictWithHybridML(m, mlData);
          return {
              ...m,
              mlInfo
          };
      });
  }, [matches, mlData]);

  const accuracyStats = useMemo(() => {
      // Filter strictly pending matches using getActualResult
      const completed = processedMatches.filter(m => getActualResult(m.result) !== 'pending');
      const totalCompleted = completed.length;
      
      const correct = completed.filter(m => {
          const actual = getActualResult(m.result);
          let pred = m.finalPrediction || m.rawPrediction || '1';
          
          if (m.mlInfo?.mlApplied) {
              pred = m.mlInfo.mlPrediction;
          }
          
          return matchesPrediction(pred, actual);
      }).length;
      
      const seerCorrect = completed.filter(m => {
          const actual = getActualResult(m.result);
          let pred = m.seerPrediction || m.seerPrimaryPrediction;
          if (!pred) {
              pred = predictWithSeer(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars, 'all');
              m.seerPrediction = pred;
          }
          return matchesPrediction(pred, actual);
      }).length;

      const paaCorrect = completed.filter(m => {
          const actual = getActualResult(m.result);
          const pred = m.paaPrediction || m.paaPrimaryPrediction || m.finalPrediction || m.rawPrediction || '1';
          return matchesPrediction(pred, actual);
      }).length;

      const algoCorrect = completed.filter(m => {
          const actual = getActualResult(m.result || '');
          const pred = m.algoReport?.prediction || m.calculatedPrediction || '1';
          return matchesPrediction(pred, actual);
      }).length;
      
      const mlEngines: Record<string, { total: number, correct: number }> = {
          'Pivot Engine': { total: 0, correct: 0 },
          'Tri-Core Hybrid': { total: 0, correct: 0 },
          'Smart Override Engine': { total: 0, correct: 0 },
          'AI Consensus Lock': { total: 0, correct: 0 },
          'Chaos Theory Engine': { total: 0, correct: 0 }
      };

      let mlCorrect = 0;
      completed.forEach(m => {
          const actual = getActualResult(m.result || '');
          const pred = m.mlInfo?.mlPrediction || m.finalPrediction || m.rawPrediction || '1';
          const isCorrect = matchesPrediction(pred, actual);
          
          if (isCorrect) mlCorrect++;

          const source = m.mlInfo?.mlPredictionSource;
          if (source) {
              if (!mlEngines[source]) {
                  mlEngines[source] = { total: 0, correct: 0 };
              }
              mlEngines[source].total += 1;
              if (isCorrect) mlEngines[source].correct += 1;
          }
      });

      const subPatternCorrect = completed.filter(m => {
          const actual = getActualResult(m.result || '');
          const pred = m.patternAnalysis?.subPatternPrediction || m.subPatternOverride?.final || m.finalPrediction || m.rawPrediction || '1';
          return matchesPrediction(pred, actual);
      }).length;

      const percentage = totalCompleted > 0 ? Math.round((correct / totalCompleted) * 100) : 0;
      const seerPercentage = totalCompleted > 0 ? Math.round((seerCorrect / totalCompleted) * 100) : 0;
      const paaPercentage = totalCompleted > 0 ? Math.round((paaCorrect / totalCompleted) * 100) : 0;
      const algoPercentage = totalCompleted > 0 ? Math.round((algoCorrect / totalCompleted) * 100) : 0;
      const mlPercentage = totalCompleted > 0 ? Math.round((mlCorrect / totalCompleted) * 100) : 0;
      const subPatternPercentage = totalCompleted > 0 ? Math.round((subPatternCorrect / totalCompleted) * 100) : 0;
      
      return { 
          total: processedMatches.length, 
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
          mlPercentage,
          subPatternCorrect,
          subPatternPercentage,
          mlEngines
      };
  }, [processedMatches, phaStatsMap, matchStars]);

  if (processedMatches.length === 0) {
      return (
          <div className="text-center p-12 text-gray-400 border-2 border-dashed rounded-lg">
             No matches found for this board.
          </div>
      );
  }

  const displayedMatches = mlSourceFilter 
      ? processedMatches.filter(m => m.mlInfo?.mlPredictionSource === mlSourceFilter)
      : processedMatches;

  return (
    <div className="space-y-4">

        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-4 justify-between items-center text-sm">
            <span className="font-bold text-gray-700 uppercase">
              {title}: {accuracyStats.total}
            </span>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
               <span className="text-gray-500 hidden sm:inline">Completed: <span className="font-mono font-bold text-gray-700">{accuracyStats.completed}</span></span>
               <span className="text-gray-500 hidden sm:inline">Sub pattern correct: <span className="font-mono font-bold text-purple-600">{accuracyStats.subPatternCorrect}</span> <span className="text-gray-400">({accuracyStats.subPatternPercentage}%)</span></span>
               <span className="text-gray-500 hidden sm:inline">SEER correct: <span className="font-mono font-bold text-indigo-600">{accuracyStats.seerCorrect}</span> <span className="text-gray-400">({accuracyStats.seerPercentage}%)</span></span>
               <div className="relative inline-block text-left" onMouseLeave={() => setShowMLDropdown(false)}>
                   <span 
                       className="text-gray-500 hidden sm:inline cursor-pointer hover:text-gray-700"
                       onMouseEnter={() => setShowMLDropdown(true)}
                       onClick={() => setShowMLDropdown(!showMLDropdown)}
                   >
                       ML correct: <span className="font-mono font-bold text-emerald-600">{accuracyStats.mlCorrect}</span> <span className="text-gray-400">({accuracyStats.mlPercentage}%)</span>
                   </span>
                   {showMLDropdown && (
                       <div className="absolute z-50 left-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg p-2 text-xs">
                           <div className="font-bold text-gray-700 mb-2 pb-1 border-b border-gray-100 flex justify-between items-center">
                               <span>ML Engines</span>
                               {mlSourceFilter && (
                                   <button 
                                       onClick={() => setMlSourceFilter(null)}
                                       className="text-[10px] text-blue-500 hover:text-blue-700 font-normal"
                                   >
                                       Clear Filter
                                   </button>
                               )}
                           </div>
                           {Object.entries(accuracyStats.mlEngines).map(([name, stats]) => {
                               const enginePct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                               const isSelected = mlSourceFilter === name;
                               return (
                                   <div 
                                       key={name} 
                                       onClick={() => setMlSourceFilter(name)}
                                       className={`flex justify-between items-center py-1 cursor-pointer hover:bg-emerald-50 rounded px-1 transition-colors ${isSelected ? 'bg-emerald-100 font-bold' : ''}`}
                                   >
                                       <span className="text-gray-600 truncate mr-2" title={name}>{name}</span>
                                       <div className="whitespace-nowrap">
                                            <span className="font-mono font-bold text-emerald-600">{stats.correct}/{stats.total}</span>
                                            <span className="text-gray-400 ml-1">({enginePct}%)</span>
                                       </div>
                                   </div>
                               );
                           })}
                       </div>
                   )}
               </div>
               <span className="text-gray-500 hidden sm:inline">PAA correct: <span className="font-mono font-bold text-amber-600">{accuracyStats.paaCorrect}</span> <span className="text-gray-400">({accuracyStats.paaPercentage}%)</span></span>
               <span className="text-gray-500 hidden sm:inline">Algo correct: <span className="font-mono font-bold text-blue-600">{accuracyStats.algoCorrect}</span> <span className="text-gray-400">({accuracyStats.algoPercentage}%)</span></span>
            </div>
        </div>

        {displayedMatches.slice(0, visibleCount).map((match, idx) => {
            const sub = match.patternAnalysis?.subPattern;
            const pha = sub ? phaStatsMap[sub] : undefined;
            // Calculate percentage for this specific pattern
            const phaPercentage = pha && pha.total > 0 ? Math.round((pha.correct / pha.total) * 100) : 0;
            const phaDisplay = pha ? { ...pha, percentage: phaPercentage } : undefined;

            return (
                <MatchCard 
                    key={`${match.id}_${idx}`} 
                    match={match} 
                    expandedMatch={expandedMatch} 
                    setExpandedMatch={setExpandedMatch}
                    phaStats={phaDisplay}
                    phaStatsMap={phaStatsMap}
                    onDelete={onDelete}
                    matchStars={matchStars}
                />
            );
        })}
        {visibleCount < processedMatches.length && (
            <div ref={lastElementRef} className="h-10 text-center text-sm font-medium text-gray-400 mt-4 flex items-center justify-center gap-2">
                Loading more matches…
            </div>
        )}
    </div>
  );
};

export default LivePredictions;