import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import { Match } from '../types';
import MatchCard from './MatchCard';
import { getActualResult, matchesPrediction } from '../utils/matchProcessing';
import { predictWithSeer, DEFAULT_WEIGHTS } from '../utils/seerLogic';

interface ArchivesProps {
  matches: Match[];
  expandedMatch: number | null;
  setExpandedMatch: (id: number | null) => void;
  phaStatsMap: Record<string, { total: number; correct: number; outcomes: { '1': number; 'X': number; '2': number }; favWin: number; draw: number; upsetWin: number }>;
  matchStars?: Record<string, number>;
}

const PAGE_SIZE = 40;

const Archives: React.FC<ArchivesProps> = ({ matches, expandedMatch, setExpandedMatch, phaStatsMap, matchStars = {} }) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);

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

  const accuracyStats = useMemo(() => {
      const completed = matches.filter(m => getActualResult(m.result) !== 'pending');
      const totalCompleted = completed.length;
      
      const correct = completed.filter(m => {
          const actual = getActualResult(m.result);
          const pred = m.finalPrediction || m.rawPrediction || '1';
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

      const mlCorrect = completed.filter(m => {
          const actual = getActualResult(m.result || '');
          const pred = m.mlInfo?.mlPrediction || m.finalPrediction || m.rawPrediction || '1';
          return matchesPrediction(pred, actual);
      }).length;

      const percentage = totalCompleted > 0 ? Math.round((correct / totalCompleted) * 100) : 0;
      const seerPercentage = totalCompleted > 0 ? Math.round((seerCorrect / totalCompleted) * 100) : 0;
      const paaPercentage = totalCompleted > 0 ? Math.round((paaCorrect / totalCompleted) * 100) : 0;
      const algoPercentage = totalCompleted > 0 ? Math.round((algoCorrect / totalCompleted) * 100) : 0;
      const mlPercentage = totalCompleted > 0 ? Math.round((mlCorrect / totalCompleted) * 100) : 0;

      return { 
          total: matches.length, 
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
  }, [matches, phaStatsMap, matchStars]);

  if (matches.length === 0) {
      return (
          <div className="text-center p-12 text-gray-400 border-2 border-dashed rounded-lg">
             Select a date from the archive dropdown to view matches.
          </div>
      );
  }

  return (
    <div className="space-y-4">
        <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 flex flex-wrap gap-4 justify-between items-center text-sm">
            <span className="font-bold text-gray-700 uppercase">
              Archived Matches: {accuracyStats.total}
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

        {matches.slice(0, visibleCount).map((match, idx) => {
            const sub = match.patternAnalysis?.subPattern;
            const pha = sub ? phaStatsMap[sub] : undefined;
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
                    matchStars={matchStars}
                />
            );
        })}
        {visibleCount < matches.length && (
            <div ref={lastElementRef} className="h-10 text-center text-sm font-medium text-gray-400 mt-4 flex items-center justify-center gap-2">
                Loading more matches…
            </div>
        )}
    </div>
  );
};

export default Archives;