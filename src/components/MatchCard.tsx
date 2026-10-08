
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calculator, Activity, Lightbulb, Target, CheckCircle, XCircle, Star, Cpu, ArrowRight, Eye, Database } from 'lucide-react';
import { Match } from '../types';
import { getActualResult, matchesPrediction, isClose, formatProbabilities, formatScore, calculatePAAPrediction, enforceAlgoPredictionRules, calculateTotalPoints } from '../utils/matchProcessing';
import { LEGACY_DESCRIPTIONS } from './Patterns';
import { getMatchMaxStars } from '../utils/matchStars';
import { predictWithSeer, predictSeerDetailed, DEFAULT_WEIGHTS, SeerDetailedResult } from '../utils/seerLogic';
import { getMatchEvaluatorTags } from '../utils/matchEvaluator';
import { getOptimizedScore, getOptimizedScoreDetailed, getMatchDayOfWeek } from '../utils/optimizedweights';
import MLDataModal from './MLDataModal';
import OptimizedWeightsModal from './OptimizedWeightsModal';

interface MatchCardProps {
  match: Match;
  expandedMatch: number | null;
  setExpandedMatch: (id: number | null) => void;
  phaStats?: { 
    total: number; 
    paaTotal?: number;
    correct: number; 
    percentage: number; 
    outcomes: { '1': number; 'X': number; '2': number };
    favWin: number;
    draw: number;
    upsetWin: number;
  };
  phaStatsMap?: Record<string, any>; // Added for SEER
  onDelete?: (id: string | number) => void;
  matchStars?: Record<string, number>;
  owCategory?: string;
}

const MatchCard: React.FC<MatchCardProps> = ({ match, expandedMatch, setExpandedMatch, phaStats, phaStatsMap, onDelete, matchStars = {}, owCategory = 'top_12_value' }) => {
  const isPending = getActualResult(match.result) === 'pending';
  const actual = getActualResult(match.result);
  const [isMLModalOpen, setIsMLModalOpen] = useState(false);
  const [isOWModalOpen, setIsOWModalOpen] = useState(false);
  const [activeOWCategory, setActiveOWCategory] = useState<string | null>(null);
  const [, setWeightTrigger] = useState(0);

  React.useEffect(() => {
    const onWeightsUpdate = () => setWeightTrigger(v => v + 1);
    window.addEventListener('optimizedWeightsUpdated', onWeightsUpdate);
    return () => window.removeEventListener('optimizedWeightsUpdated', onWeightsUpdate);
  }, []);

  // Display match ID
  const displayMatchId = match.id || '-';

  // Dynamically compute/retrieve evaluator tags to guarantee they are displayed and up-to-date
  const computedTags = match.evaluatorTags && match.evaluatorTags.length > 0
    ? match.evaluatorTags
    : getMatchEvaluatorTags(match, phaStatsMap || {}, match.isJackpot || false, true, matchStars);

  const isTop12Tag = computedTags && computedTags.some(tag => tag.startsWith('top12:') || tag.startsWith('top10:'));
  const isBestBetTag = computedTags && computedTags.some(tag => tag.startsWith('best_bet:'));
  const isBankersDliveTag = computedTags && computedTags.some(tag => tag.startsWith('bankers_dlive:'));
  const isUpsetsTag = computedTags && computedTags.some(tag => tag.startsWith('upsets:'));
  const isBankersJackpotTag = computedTags && computedTags.some(tag => tag.startsWith('bankers_jackpot:'));
  const isValuePicksTag = computedTags && computedTags.some(tag => tag.startsWith('value_picks:'));
  
  const optCategories: {id: string, label: string}[] = [];
  if (isTop12Tag) optCategories.push({ id: 'top_12_value', label: 'T12' });
  if (isBestBetTag) optCategories.push({ id: 'best_bet', label: 'BB' });
  if (isBankersDliveTag) optCategories.push({ id: 'bankers_dlive', label: 'BD' });
  if (isUpsetsTag) optCategories.push({ id: 'upsets', label: 'UPS' });
  if (isBankersJackpotTag) optCategories.push({ id: 'bankers_jackpot', label: 'BJ' });
  if (isValuePicksTag) optCategories.push({ id: 'value_picks', label: 'VP' });

  const defaultOptScoreCategory = optCategories.length > 0 ? optCategories[0].id : null;

  const categoryScores = React.useMemo(() => {
    if (!phaStatsMap || optCategories.length === 0) return {};
    const matchDay = getMatchDayOfWeek(match);
    const result: Record<string, { totalScore: number; rulesCount: number }> = {};
    for (const cat of optCategories) {
      const detailed = getOptimizedScoreDetailed(match, cat.id, phaStatsMap, matchDay);
      if (detailed) {
        result[cat.id] = {
          totalScore: detailed.totalScore,
          rulesCount: detailed.rulesHit.length
        };
      }
    }
    return result;
  }, [match, optCategories, phaStatsMap]);

  // Dynamic PAA Prediction Lookups and Fallback Calculations
  let paaPrim = match.paaPrimaryPrediction;
  let paaFinal = match.paaPrediction;
  
  // STICKINESS FIX: Only recalculate PAA dynamically if the match has no PAA prediction saved
  if ((!match.paaPrediction || !match.paaPrimaryPrediction) && match.patternAnalysis?.subPattern && phaStatsMap) {
      const sub = match.patternAnalysis.subPattern;
      if (phaStatsMap[sub] && (phaStatsMap[sub].paaTotal > 0 || phaStatsMap[sub].total > 0)) {
          const paaPred = calculatePAAPrediction(match, phaStatsMap[sub]);
          if (paaPred) {
              paaPrim = paaPred.paaPrimaryPrediction;
              paaFinal = paaPred.paaPrediction;
          }
      }
  }

  if (paaPrim && paaFinal) {
      const syncedPAA = enforceAlgoPredictionRules(paaPrim, paaFinal);
      paaPrim = syncedPAA.primaryPrediction;
      paaFinal = syncedPAA.finalPrediction;
  }

  let mlPrim = match.mlInfo?.mlPrimaryPrediction || match.rawPrediction || '';
  let mlFinal = match.mlInfo?.mlPrediction || '';
  if (match.mlInfo?.mlApplied && mlPrim && mlFinal) {
      const syncedML = enforceAlgoPredictionRules(mlPrim, mlFinal, match.mlInfo.probabilities);
      mlPrim = syncedML.primaryPrediction;
      mlFinal = syncedML.finalPrediction;
  }

  const predictionToCheck = match.patternAnalysis?.subPatternPrediction || match.finalPrediction || match.rawPrediction || '1';
  const finalCorrect = matchesPrediction(predictionToCheck, actual);
  const paaCorrect = paaFinal ? matchesPrediction(paaFinal, actual) : false;
  const effectiveTotalPoints = (match.totalPoints && (match.totalPoints.home > 0 || match.totalPoints.away > 0 || match.totalPoints.draw > 0))
    ? match.totalPoints
    : ((match as any).data?.totalPoints && ((match as any).data.totalPoints.home > 0 || (match as any).data.totalPoints.away > 0 || (match as any).data.totalPoints.draw > 0))
      ? (match as any).data.totalPoints
      : calculateTotalPoints(match);

  const pts = {
    home: effectiveTotalPoints?.home || 0,
    draw: effectiveTotalPoints?.draw || 0,
    away: effectiveTotalPoints?.away || 0,
    breakdown: effectiveTotalPoints?.breakdown || {
      pts1x2: { home: 0, draw: 0, away: 0 },
      ptsTS: { home: 0, draw: 0, away: 0 },
      ptsGA: { home: 0, draw: 0, away: 0 },
      ptsGS: { home: 0, draw: 0, away: 0 },
      ptsL10: { home: 0, draw: 0, away: 0 },
      ptsMO: { home: 0, draw: 0, away: 0 },
      ptsLE: { home: 0, draw: 0, away: 0 }
    }
  };
  const { algoReport } = match;
  const hasAlgoReport = !!algoReport;
  // Find the star rating for this match based on priority performance
  const currentStars = getMatchMaxStars(match, matchStars);
  
  // Format probabilities for display if report exists
  const formattedProbs = algoReport ? formatProbabilities(algoReport.probabilities) : { '1': 0, 'X': 0, '2': 0 };

  const { algoPrimary, algoFinal } = (() => {
    const rawPrim = (() => {
      if (algoReport?.primaryPrediction && algoReport.primaryPrediction !== 'N/A' && ['1', 'X', '2'].includes(algoReport.primaryPrediction)) {
        return algoReport.primaryPrediction;
      }
      if (match.rawPrediction && ['1', 'X', '2'].includes(match.rawPrediction)) {
        return match.rawPrediction;
      }
      if (algoReport?.prediction && ['1', 'X', '2'].includes(algoReport.prediction)) {
        return algoReport.prediction;
      }
      if (algoReport?.probabilities) {
        const p1 = algoReport.probabilities['1'] || 0;
        const pX = algoReport.probabilities['X'] || 0;
        const p2 = algoReport.probabilities['2'] || 0;
        if (p1 >= pX && p1 >= p2 && p1 > 0) return '1';
        if (p2 >= p1 && p2 >= pX && p2 > 0) return '2';
        if (pX >= p1 && pX >= p2 && pX > 0) return 'X';
      }
      if (algoReport?.prediction === '1X') return '1';
      if (algoReport?.prediction === 'X2') return '2';
      if (algoReport?.prediction === '12') return '1';
      return 'N/A';
    })();

    const rawFin = algoReport?.prediction || 'N/A';

    if (rawPrim === 'N/A' || rawFin === 'N/A') {
      return { algoPrimary: rawPrim, algoFinal: rawFin };
    }

    const enforced = enforceAlgoPredictionRules(rawPrim, rawFin, algoReport?.probabilities);
    return { algoPrimary: enforced.primaryPrediction, algoFinal: enforced.finalPrediction };
  })();
  
  // Extract TS Indicators
  const tsIndicators = match.totalPoints?.breakdown?.tsIndicators
    ? match.totalPoints.breakdown.tsIndicators.split('|').map(s => s.trim()).filter(s => s.includes('⚠️'))
    : [];

  let cardBgClass = "bg-white"; // Default to white
  let borderColorClass = "border-l-gray-200";
  
  if (isPending) {
      if (hasAlgoReport) {
          cardBgClass = "bg-slate-50";
          borderColorClass = "border-l-indigo-400";
      }
  } else {
    if (finalCorrect) {
      cardBgClass = "bg-emerald-50";
      borderColorClass = "border-l-emerald-500";
    } else {
      cardBgClass = "bg-rose-50";
      borderColorClass = "border-l-rose-500";
    }
  }

  // PHA Logic
  const hasPHA = phaStats && phaStats.total > 0;
  const totalPhaMatches = hasPHA ? (phaStats.outcomes['1'] || 0) + (phaStats.outcomes['X'] || 0) + (phaStats.outcomes['2'] || 0) : 0;
  const phaPct1 = totalPhaMatches > 0 ? Math.round(((phaStats.outcomes['1'] || 0) / totalPhaMatches) * 100) : 0;
  const phaPctX = totalPhaMatches > 0 ? Math.round(((phaStats.outcomes['X'] || 0) / totalPhaMatches) * 100) : 0;
  const phaPct2 = totalPhaMatches > 0 ? Math.round(((phaStats.outcomes['2'] || 0) / totalPhaMatches) * 100) : 0;

  // --- STATS RELATIONSHIP LOGIC ---
  // Using 0.2 tolerance as requested
  const gsH = Number(match.gsHome) || 0;
  const gsA = Number(match.gsAway) || 0;
  const gaH = Number(match.gaHome) || 0;
  const gaA = Number(match.gaAway) || 0;

  const rels = {
      eqGS: isClose(gsH, gsA, 0.2),       // Horizontal Top
      eqGA: isClose(gaH, gaA, 0.2),       // Horizontal Bottom
      hBal: isClose(gsH, gaH, 0.2),       // Vertical Left
      aBal: isClose(gsA, gaA, 0.2),       // Vertical Right
      cross1: isClose(gaH, gsA, 0.2),     // Diagonal / (GA H - GS A) -> HGA=AGS
      cross2: isClose(gaA, gsH, 0.2),     // Diagonal \ (GA A - GS H) -> AGA=HGS
  };
  
  // Confidence Stars Render
  const renderStars = (count: number | undefined, colorClass: string = "text-yellow-500", size: number = 10, minStars: number = 0) => {
      if (count === undefined || count < minStars) return null;
      return (
        <div className="flex -space-x-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star 
              key={i} 
              size={size} 
              className={`${i < count ? colorClass : 'text-gray-200'} ${i < count ? 'fill-current' : ''}`}
            />
          ))}
        </div>
      );
  };
  
  // SEER Logic
  const rawSeerDetails = React.useMemo(() => {
    // STICKINESS FIX: If the match has a saved Seer prediction, lock it in immediately.
    // Avoid dynamic recomputation which causes predictions to appear to change when results are uploaded.
    if (match.seerPrediction && match.seerPrimaryPrediction) {
      return {
        primary: match.seerPrimaryPrediction,
        final: match.seerPrediction,
        percentages: match.seerPercentages || { '1': 0, 'X': 0, '2': 0 },
        scores: match.seerScores || {},
      } as SeerDetailedResult;
    }
    if (!phaStatsMap) return null;
    return predictSeerDetailed(match, DEFAULT_WEIGHTS, phaStatsMap, matchStars || {});
  }, [match, phaStatsMap, matchStars]);

  const sanitizePercentages = (pct: any) => {
    if (!pct) return { '1': 0, 'X': 0, '2': 0 };
    const v1 = Math.max(0, pct['1'] || 0);
    const vX = Math.max(0, pct['X'] || 0);
    const v2 = Math.max(0, pct['2'] || 0);
    const t = v1 + vX + v2;
    if (t === 0) return { '1': 0, 'X': 0, '2': 0 };
    
    let p1 = Math.round((v1 / t) * 100);
    let pX = Math.round((vX / t) * 100);
    let p2 = Math.round((v2 / t) * 100);
    
    const diff = 100 - (p1 + pX + p2);
    if (diff !== 0) {
        const arr = [
            { k: '1', v: v1 },
            { k: 'X', v: vX },
            { k: '2', v: v2 }
        ].sort((a,b) => b.v - a.v);
        if (arr[0].k === '1') p1 += diff;
        else if (arr[0].k === 'X') pX += diff;
        else p2 += diff;
    }
    return { '1': p1, 'X': pX, '2': p2 };
  };

  if (rawSeerDetails && rawSeerDetails.percentages) {
      rawSeerDetails.percentages = sanitizePercentages(rawSeerDetails.percentages);
  }
  
  let seerFinal = rawSeerDetails?.final || 'N/A';
  let seerPrim = match.seerPrimaryPrediction || rawSeerDetails?.primary || 'N/A';
  
  // Rule enforcement:
  // Seer primary prediction can only be 1, X or 2 and never 12, 1X, or x2.
  // Seer final prediction can only be 12, 1X, OR X2 and never 1, X, or 2.
  const isHedged = (p: string) => ['1X', 'X1', '12', '21', 'X2', '2X'].includes(p);
  const isStraight = (p: string) => ['1', 'X', '2'].includes(p);

  if (isHedged(seerPrim) && isStraight(seerFinal)) {
      // Swap them back if they were reversed by another module (e.g. Jackpot slips)
      const temp = seerPrim;
      seerPrim = seerFinal;
      seerFinal = temp;
  }

  // GUARANTEED SEER PREDICTION SANITY RULES
  // - A prim of 2 cant have a fin of 1X only X2 or 12
  // - A prim of 1 cant have a fin of X2, only 1X or 12
  // - A prim of X cant have a fin of 12, Only 1X or X2.
  const syncedSeer = enforceAlgoPredictionRules(seerPrim, seerFinal, rawSeerDetails?.percentages);
  seerPrim = syncedSeer.primaryPrediction;
  seerFinal = syncedSeer.finalPrediction;

  // Persist percentages safely based on raw details
  const seerDetails = rawSeerDetails; 
  
  const getCombinedSeerPct = () => {
    if (!seerDetails) return 0;
    const final = seerFinal;
    const percentages = seerDetails.percentages;
    
    let pct = 0;
    if (final.includes('1')) pct += percentages['1'] || 0;
    if (final.includes('X')) pct += percentages['X'] || 0;
    if (final.includes('2')) pct += percentages['2'] || 0;
    return pct;
  };

  const combinedPct = getCombinedSeerPct();

  // Check Triple Consensus (Points System, PAA Model, and Core Algorithm align)
  const pointsPredVal = match.calculatedPrediction || match.finalPrediction || '';
  const paaPredVal = paaFinal || '';
  const algoPredVal = algoReport?.prediction || '';
  const isTripleConsensus = pointsPredVal !== '' && paaPredVal !== '' && algoPredVal !== '' && 
    [...algoPredVal].some(char => pointsPredVal.includes(char) && paaPredVal.includes(char));

  // Check Seer Sieve Premium
  const isSievePremium = seerDetails?.isSievePremium || false;

  return (
    <div className={`${cardBgClass} rounded-lg shadow-sm border-l-4 ${borderColorClass} overflow-hidden transition-all mb-2 relative flex flex-col`}>
      <div className="p-2 cursor-pointer hover:bg-opacity-80" onClick={() => setExpandedMatch(expandedMatch === Number(match.id) ? null : Number(match.id))}>
        <div className="flex flex-col gap-1"> 
          
          {/* Header Row: Structured with 3 Sections */}
          <div className="flex flex-wrap items-start justify-between gap-y-2 gap-x-1 mb-1">
             
             {/* 1. Left Side: Match Meta & Pattern */}
             <div className="flex flex-wrap items-center gap-1.5 leading-none pt-0.5">
                 <div className="flex flex-col gap-0.5">
                     <span className="text-[10px] text-gray-500 font-medium">{match.date}</span>
                     <span className="bg-white border border-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">Match No: {displayMatchId}</span>
                 </div>
                 {onDelete && (
                     <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(Number(match.id));
                        }}
                        className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
                        title="Delete Match"
                     >
                        <XCircle size={14} />
                     </button>
                 )}
                 <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-[10px] font-bold">G{match.group}</span>
                 <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{match.pointsRange || (Math.max(pts.home, pts.draw, pts.away) > 0 ? `${Math.round(Math.max(pts.home, pts.draw, pts.away))}` : '-')} pts</span>
                 <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold border border-amber-200" title="Team Strength (Home:Away)">TS {match.tsa?.toFixed(2)}:{match.tsb?.toFixed(2)}</span>
                 <div className="flex flex-col gap-0.5 items-center">
                     <span className="bg-green-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold font-mono" title="Market Odds">MO {match.mo}</span>
                     {optCategories.map(cat => {
                         const scoreData = categoryScores[cat.id];
                         if (!scoreData) return null;
                         return (
                             <button 
                                 key={cat.id}
                                 onClick={(e) => { e.stopPropagation(); setActiveOWCategory(cat ? cat.id : owCategory); setIsOWModalOpen(true); }}
                                 className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 transition-colors px-1.5 py-0.5 rounded flex items-center justify-center gap-1 shadow-sm font-black whitespace-nowrap w-full cursor-pointer mt-0.5" 
                                 title={`${cat.label}: ${scoreData.rulesCount} rules applied. Click to view breakdown.`}
                             >
                                 <Star size={10} className="text-amber-500 fill-current flex-shrink-0" />
                                 {cat.label} {scoreData.totalScore}
                             </button>
                         );
                     })}
                 </div>
                 {match.patternAnalysis?.mainPattern && match.patternAnalysis.mainPattern !== 'NA' && (
                     <span className="bg-purple-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold" title={match.patternAnalysis.mainPatternDescription}>
                        Pat {match.patternAnalysis.mainPattern}
                    </span>
                 )}
                 {currentStars > 0 && (
                     <div className="flex items-center gap-0.5" title="Match Performance Rating">
                         {renderStars(currentStars, "text-amber-500", 12)}
                     </div>
                 )}
             </div>

             {/* 2. Center: ML PRED block */}
             <div className="flex items-start gap-2 flex-1 mx-2 min-w-[240px]">
                 {match.mlInfo?.mlApplied && (
                     <div className="flex flex-col bg-emerald-50 border border-emerald-200 rounded p-1.5 shadow-sm w-full">
                        <div className="flex items-center gap-2 mb-1">
                             <span className="font-bold text-emerald-700 text-[10px] bg-emerald-100 px-1 rounded">ML PRED</span>
                             <span className="font-bold text-emerald-900 text-xs">{mlPrim}</span>
                             {!isPending && (matchesPrediction(mlPrim, actual) ? <span className="text-[10px] ml-0.5">✅</span> : <span className="text-[10px] ml-0.5">❌</span>)}
                             <div className="w-px h-3 bg-emerald-300 mx-0.5"></div>
                             <span className="font-bold text-emerald-700 text-[10px]">FIN</span>
                             <span className="font-bold text-emerald-900 text-xs">{mlFinal}</span>
                             <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1 rounded ml-1">{match.mlInfo.mlConfidence}%</span>
                             {!isPending && (matchesPrediction(mlFinal, actual) ? <span className="text-[10px] ml-0.5">✅</span> : <span className="text-[10px] ml-0.5">❌</span>)}
                             <button 
                                 onClick={(e) => { e.stopPropagation(); setIsMLModalOpen(true); }}
                                 className="ml-auto text-[9px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded shadow-sm hover:bg-emerald-700 transition-colors flex items-center gap-1"
                             >
                                 <Database size={10} /> ML Data
                             </button>
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-bold">
                             <div className="flex gap-2 text-emerald-800">
                                 <span>M.Fav {match.mlInfo.mlPercentages?.fav ?? 0}%</span>
                                 <span>Draw {match.mlInfo.mlPercentages?.draw ?? 0}%</span>
                                 <span>Und {match.mlInfo.mlPercentages?.underdog ?? 0}%</span>
                             </div>
                             <span className="text-emerald-600 italic border-l border-emerald-200 pl-2 ml-2 truncate" title={match.mlInfo.mlReasoning}>
                                 {match.mlInfo.mlPredictionSource || 'Matrix'}
                             </span>
                        </div>
                     </div>
                 )}
             </div>

             {/* 3. Right Side: 1x2 + PHA */}
             <div className="flex items-start gap-2 ml-auto">
                  <div className="flex flex-col items-end gap-0.5">
                      <span className="bg-white border border-gray-300 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm" title="Source 1X2">
                         1x2: {match.pred1x2 || '-'}
                      </span>
                      <span className="bg-amber-50 border border-amber-200 text-amber-800 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm font-mono whitespace-nowrap" title="1X2 Rating">
                         R: {(match.rating && match.rating !== "Unknown" && match.rating !== "-") ? match.rating : '-'}
                      </span>
                      <span className="bg-gray-50 border border-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm font-mono whitespace-nowrap" title="Last 10 Matches (L10)">
                         L10: {match.l10 || '-'}
                      </span>
                  </div>
                 {hasPHA && (
                    <div title="Pattern Historical Accuracy" className={`px-2 py-0.5 rounded text-[10px] font-bold text-white shadow-sm flex flex-col items-center justify-center min-w-[80px] ${phaStats.percentage >= 70 ? 'bg-indigo-600' : phaStats.percentage >= 50 ? 'bg-indigo-500' : 'bg-indigo-400'}`}>
                        <span className="leading-none mb-0.5 text-xs">PHA: {phaStats.percentage}%</span>
                        <div className="flex gap-2 text-[9px] opacity-90 font-mono leading-none border-t border-white/20 pt-1 w-full justify-center">
                           <div className="flex flex-col items-center">
                              <span>1:{phaStats.outcomes['1']}</span>
                              <span className="text-[7.5px] opacity-75">{phaPct1}%</span>
                           </div>
                           <div className="flex flex-col items-center">
                              <span>X:{phaStats.outcomes['X']}</span>
                              <span className="text-[7.5px] opacity-75">{phaPctX}%</span>
                           </div>
                           <div className="flex flex-col items-center">
                              <span>2:{phaStats.outcomes['2']}</span>
                              <span className="text-[7.5px] opacity-75">{phaPct2}%</span>
                           </div>
                        </div>
                    </div>
                 )}
             </div>
          </div>
            
          {/* Teams Row */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-900 text-sm md:text-base leading-tight">{match.teams}</h3>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isPending ? (hasAlgoReport ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-600') : finalCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {formatScore(match.result)}
            </span>
          </div>

          {/* Stats Grid */}
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-[auto_auto_1fr] gap-1 text-xs bg-white bg-opacity-60 p-2 rounded border border-gray-200 shadow-sm items-center">
              
              {/* Col 1: Points */}
              <div className="flex items-center gap-1.5 border-b sm:border-b-0 sm:border-r border-gray-300 pb-1 sm:pb-0 pr-2 h-full" title="Calculated Points (PTS)">
                 <div className="flex flex-col items-center min-w-[20px]">
                   <span className="font-bold text-gray-400 text-[8px] uppercase">Pts</span>
                   <Calculator size={10} className="text-gray-400"/>
                 </div>
                 <div className="flex gap-1.5 font-mono font-bold text-xs">
                   <span className="text-blue-700" title="Home Points">{pts.home.toFixed(1)}</span>
                   <span className="text-yellow-600" title="Draw Points">{pts.draw.toFixed(1)}</span>
                   <span className="text-red-600" title="Away Points">{pts.away.toFixed(1)}</span>
                 </div>
              </div>

              {/* Col 2: GS/GA Visualization */}
              <div className="relative border-b sm:border-b-0 sm:border-r border-gray-300 pb-1 sm:pb-0 px-2 h-full min-w-[120px]">
                 {/* SVG Overlay */}
                 <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ opacity: 0.6 }}>
                    <defs>
                        <marker id="arrowhead-h" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                            <polygon points="0 0, 6 2, 0 4" fill="#3b82f6" />
                        </marker>
                        <marker id="arrowhead-v" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                            <polygon points="0 0, 6 2, 0 4" fill="#10b981" />
                        </marker>
                        <marker id="arrowhead-d" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                            <polygon points="0 0, 6 2, 0 4" fill="#8b5cf6" />
                        </marker>
                    </defs>
                    
                    {/* Positions based on Grid: GS Row (25%), GA Row (75%), Home Col (40%), Away Col (80%) */}
                    {/* Horizontal: Equal Stats */}
                    {rels.eqGS && <line x1="40%" y1="25%" x2="78%" y2="25%" stroke="#3b82f6" strokeWidth="1.5" markerEnd="url(#arrowhead-h)" />}
                    {rels.eqGS && <line x1="78%" y1="25%" x2="40%" y2="25%" stroke="#3b82f6" strokeWidth="1.5" markerEnd="url(#arrowhead-h)" />}
                    
                    {rels.eqGA && <line x1="40%" y1="75%" x2="78%" y2="75%" stroke="#3b82f6" strokeWidth="1.5" markerEnd="url(#arrowhead-h)" />}
                    {rels.eqGA && <line x1="78%" y1="75%" x2="40%" y2="75%" stroke="#3b82f6" strokeWidth="1.5" markerEnd="url(#arrowhead-h)" />}

                    {/* Vertical: Balanced */}
                    {rels.hBal && <line x1="38%" y1="30%" x2="38%" y2="70%" stroke="#10b981" strokeWidth="1.5" markerEnd="url(#arrowhead-v)" />}
                    {rels.aBal && <line x1="82%" y1="30%" x2="82%" y2="70%" stroke="#10b981" strokeWidth="1.5" markerEnd="url(#arrowhead-v)" />}

                    {/* Diagonal: Cross Match */}
                    {/* HGA -> AGS (Bottom Left to Top Right) */}
                    {rels.cross1 && <line x1="42%" y1="70%" x2="78%" y2="30%" stroke="#8b5cf6" strokeWidth="1.2" strokeDasharray="2,1" />}
                    
                    {/* AGA -> HGS (Bottom Right to Top Left) */}
                    {rels.cross2 && <line x1="78%" y1="70%" x2="42%" y2="30%" stroke="#8b5cf6" strokeWidth="1.2" strokeDasharray="2,1" />}
                 </svg>

                 {/* Stats Grid Layout */}
                 <div className="grid grid-cols-[20px_1fr_1fr] gap-y-2 gap-x-1 h-full items-center">
                    {/* Row 1: GS */}
                    <div className="text-[9px] font-bold text-gray-400 uppercase text-center">GS</div>
                    <div className="text-center font-bold text-blue-700 bg-blue-50/50 rounded py-0.5 border border-blue-100/50">{match.gsHome?.toFixed(1)}</div>
                    <div className="text-center font-bold text-red-700 bg-red-50/50 rounded py-0.5 border border-red-100/50">{match.gsAway?.toFixed(1)}</div>

                    {/* Row 2: GA */}
                    <div className="text-[9px] font-bold text-gray-400 uppercase text-center">GA</div>
                    <div className="text-center font-bold text-blue-700 bg-blue-50/50 rounded py-0.5 border border-blue-100/50">{match.gaHome?.toFixed(1)}</div>
                    <div className="text-center font-bold text-red-700 bg-red-50/50 rounded py-0.5 border border-red-100/50">{match.gaAway?.toFixed(1)}</div>
                 </div>
              </div>

              {/* Col 3: Insights & SEER */}
              <div className="flex items-center gap-2 w-full pl-1" title="Insights (Flags)">
                  <div className="flex flex-row items-start gap-1.5 flex-1 min-w-0">
                    <div className="flex flex-col items-center justify-start pt-0.5 min-w-[20px]">
                        <span className="font-bold text-gray-400 text-[8px] uppercase">INS</span>
                        <Lightbulb size={10} className="text-yellow-500"/>
                    </div>
                    <div className="flex flex-wrap gap-1 content-start w-full">
                        {tsIndicators.map((ind, i) => (
                                <span key={`ts-${i}`} className="px-1.5 py-0.5 text-[9px] rounded bg-orange-50 border border-orange-100 text-orange-800 font-bold animate-pulse whitespace-nowrap">
                                {ind}
                            </span>
                        ))}
                        {match.patterns?.map(p => (
                            <span key={p} className="px-1.5 py-0.5 text-[9px] rounded bg-blue-50 border border-blue-100 text-blue-800 font-medium whitespace-nowrap" title={LEGACY_DESCRIPTIONS[p]}>
                                <span className="font-bold">{p}:</span> <span className="opacity-80">{LEGACY_DESCRIPTIONS[p]}</span>
                            </span>
                        ))}
                        {(!match.patterns || match.patterns.length === 0) && tsIndicators.length === 0 && <span className="text-gray-300 text-[9px] italic">None</span>}
                    </div>
                  </div>

                  {/* ALGO COMPONENT */}
                  {algoReport && (
                      <div className="flex flex-col items-end shrink-0 border-l border-slate-200 pl-3 pr-1" title={algoReport.reason}>
                         <div className="flex items-center gap-1 mb-0.5">
                             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter pr-1">ALGO</span>
                             <span className="text-[8px] font-bold text-slate-400 uppercase">Prim</span>
                             <span className="px-1.5 py-0.5 rounded text-[10px] font-black shadow-inner min-w-[24px] text-center bg-slate-200 text-slate-700">
                                 {algoPrimary}
                             </span>
                             {!isPending && (matchesPrediction(algoPrimary, actual) ? <span className="text-[10px] ml-0.5">✅</span> : <span className="text-[10px] ml-0.5">❌</span>)}
                             <span className="text-[8px] font-bold text-slate-400 uppercase ml-0.5">Fin</span>
                             <span className={`px-1.5 py-0.5 rounded text-[10px] font-black shadow-inner min-w-[24px] text-center ${algoFinal === match.finalPrediction ? 'bg-teal-500 text-white' : 'bg-blue-500 text-white'}`}>
                                 {algoFinal}
                             </span>
                             {!isPending && (matchesPrediction(algoFinal, actual) ? <span className="text-[10px] ml-0.5">✅</span> : <span className="text-[10px] ml-0.5">❌</span>)}
                             <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ml-0.5 ${algoFinal === match.finalPrediction ? 'text-teal-700 bg-teal-50 border-teal-200' : 'text-blue-700 bg-blue-50 border-blue-200'}`}>
                                 {algoReport.confidence}%
                             </span>
                         </div>
                         <div className="flex gap-1.5 text-[8px] font-bold font-mono text-slate-500 bg-slate-50/50 px-1.5 py-0.5 rounded mt-0.5">
                             <span>1:{formattedProbs['1']}%</span>
                             <span>X:{formattedProbs['X']}%</span>
                             <span>2:{formattedProbs['2']}%</span>
                         </div>
                      </div>
                  )}

                  {/* SEER PREDICTION COMPONENT */}
                  {phaStatsMap && (
                      <div className="flex items-center gap-3 border-l border-slate-200 pl-4 py-1 pr-2 shrink-0">
                          <div className="h-px w-8 bg-slate-300"></div>
                          <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-2 px-3 py-1 bg-white rounded border border-slate-100 shadow-sm">
                                  <span className="text-[10px] font-black uppercase tracking-tighter whitespace-nowrap text-teal-500">
                                      SEER PREDICTS:
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                      <span className="text-[8px] font-bold text-slate-400 uppercase">Prim</span>
                                      <span className="bg-emerald-600 text-white text-[11px] font-black px-2 py-0.5 rounded shadow-inner min-w-[28px] text-center">
                                          {seerPrim}
                                      </span>
                                      <span className="text-[8px] font-bold text-slate-400 uppercase ml-0.5">Fin</span>
                                      <div className="flex items-center gap-1">
                                        <span className="text-white text-[11px] font-black px-2 py-0.5 rounded shadow-inner min-w-[28px] text-center bg-indigo-600">
                                            {seerFinal}
                                        </span>
                                        <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                            {combinedPct}%
                                        </span>
                                      </div>
                                      {!isPending && (
                                          <div className="ml-1">
                                              {matchesPrediction(seerFinal, actual) ? 
                                                  <CheckCircle size={10} className="text-green-500"/> : 
                                                  <XCircle size={10} className="text-red-400"/>
                                              }
                                          </div>
                                      )}
                                  </div>
                              </div>
                              {/* Individual Scores */}
                              <div className="flex gap-2 text-[9px] font-bold font-mono text-slate-500 bg-slate-50/50 px-2 rounded">
                                 <span>SS 1:{Math.round(seerDetails?.percentages['1'] || 0)}%</span>
                                 <span>X:{Math.round(seerDetails?.percentages['X'] || 0)}%</span>
                                 <span>2:{Math.round(seerDetails?.percentages['2'] || 0)}%</span>
                              </div>
                          </div>
                      </div>
                  )}
              </div>
          </div>

          {/* FOOTER ROW */}
          <div className="flex justify-between items-end mt-2">
                
                {/* LEFT: Predictions & Pattern String */}
                <div className="flex flex-col gap-1.5 max-w-[80%]">
                     <div className="flex items-center gap-2 flex-wrap">
                         {/* PAA Prediction Box */}
                         {paaFinal && paaPrim && (
                             <div title="PAA Prediction" className="flex items-center bg-teal-50 border border-teal-200 rounded px-2 py-1 gap-2 shadow-sm text-xs">
                                <span className="font-bold text-teal-600 text-[10px]">PAA PRIM</span>
                                <span className="font-bold text-teal-900">{paaPrim}</span>
                                <div className="w-px h-3 bg-teal-300 mx-1"></div>
                                <span className="font-bold text-teal-600 text-[10px]">PAA FIN</span>
                                <span className="font-bold text-teal-900">{paaFinal}</span>
                                {!isPending && ((paaCorrect || finalCorrect) ? <CheckCircle size={12} className="text-green-600"/> : <XCircle size={12} className="text-red-500"/>)}
                             </div>
                         )}

                         {/* Prediction Box (Engine) */}
                         <div className="flex items-center bg-white border border-gray-200 rounded px-2 py-1 gap-2 shadow-sm text-xs">
                            <span className="font-bold text-gray-500 text-[10px]">PRIM</span>
                            <span className="font-bold text-gray-900">{match.patternAnalysis?.primaryPrediction || match.rawPrediction}</span>
                            {!isPending && (matchesPrediction(match.patternAnalysis?.primaryPrediction || match.rawPrediction, actual) ? <CheckCircle size={12} className="text-green-600"/> : <XCircle size={12} className="text-red-500"/>)}
                            <div className="w-px h-3 bg-gray-300 mx-1"></div>
                            <span className="font-bold text-gray-500 text-[10px]">FIN</span>
                            <span className="font-bold text-indigo-700">{match.patternAnalysis?.subPatternPrediction || match.finalPrediction}</span>
                            {!isPending && (matchesPrediction(match.patternAnalysis?.subPatternPrediction || match.finalPrediction, actual) ? <CheckCircle size={12} className="text-green-600"/> : <XCircle size={12} className="text-red-500"/>)}
                         </div>

                         {/* Pattern String */}
                         {match.patternAnalysis?.formattedString && (
                            <div className="flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 px-2 py-1 rounded border border-purple-100">
                                 <Target size={12} className="text-purple-500"/>
                                 <span className="font-mono font-bold leading-tight">{match.patternAnalysis.formattedString}</span>
                            </div>
                         )}
                     </div>
                     {/* Evaluator Tags (Priorities) */}
                     {computedTags && computedTags.filter(tag => !tag.endsWith(':PROMOTE') && !tag.endsWith(':DEMOTE') && !tag.endsWith(':LAST_RESORT') && tag !== 'VOLATILE:LAST_RESORT' && !tag.includes('HIGH_ODDS_RISK') && !(tag.startsWith('top10:') && computedTags.some(t => t.startsWith('top12:')))).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {computedTags.filter(tag => !tag.endsWith(':PROMOTE') && !tag.endsWith(':DEMOTE') && !tag.endsWith(':LAST_RESORT') && tag !== 'VOLATILE:LAST_RESORT' && !tag.includes('HIGH_ODDS_RISK') && !(tag.startsWith('top10:') && computedTags.some(t => t.startsWith('top12:')))).map((tag, index) => {
                                const [cat, pr] = tag.split(':');
                                const label = cat.replace(/_/g, ' ').toUpperCase();
                                
                                let catAbbr = cat;
                                if (cat === 'top12' || cat === 'top10') catAbbr = 'T12';
                                else if (cat === 'next_best') catAbbr = 'NB';
                                else if (cat === 'top20') catAbbr = 'T20';
                                else if (cat === 'bankers_dlive') catAbbr = 'BDL';
                                else if (cat === 'bankers_jackpot') catAbbr = 'BNK';
                                else if (cat === 'botb_best') catAbbr = 'BOTB';
                                else if (cat === 'value_bets') catAbbr = 'VB';
                                else if (cat === 'value_picks') catAbbr = 'VP';
                                else if (cat === 'banker_draws') catAbbr = 'BD';
                                else if (cat === 'upsets') catAbbr = 'UPS';
                                
                                const group = match.group || 3;
                                const starKey = `${catAbbr}-${pr}-G${group}`;
                                const fallbackStarKey = `${catAbbr}-${pr}-G3`;
                                
                                let stars = matchStars[starKey];
                                if (stars === undefined) {
                                    stars = matchStars[fallbackStarKey];
                                }

                                if (cat === 'BANNED') {
                                    return (
                                        <span key={`${tag}-${index}`} className="px-1.5 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[9px] font-bold flex items-center gap-1">
                                            BANNED: {pr.replace(/_/g, ' ')}
                                        </span>
                                    );
                                }

                                if (tag === 'PHA_TIE' || tag === 'VOLATILE:PHA_TIE') {
                                    return (
                                        <span key={`${tag}-${index}`} className="px-1.5 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded text-[9px] font-bold flex items-center gap-1">
                                            PHA TIE
                                        </span>
                                    );
                                }

                                let badgeBg = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                                let badgeText = 'criteria met';
                                
                                if (cat === 'VOLATILE') {
                                    badgeBg = 'bg-red-50 text-red-700 border-red-200';
                                }

                                return (
                                    <span key={`${tag}-${index}`} className={`px-1.5 py-0.5 border rounded text-[9px] font-bold flex items-center gap-1 ${badgeBg}`}>
                                        {label} {pr} {badgeText}
                                        {stars !== undefined && stars > 0 && (
                                            <span className="flex items-center ml-1 text-yellow-500" title={`${stars} Stars (${stars === matchStars[starKey] ? starKey : fallbackStarKey})`}>
                                                {renderStars(stars, "text-yellow-500", 10)}
                                            </span>
                                        )}
                                    </span>
                                );
                            })}
                        </div>
                     )}
                </div>

                 <div className="flex items-end gap-3 translate-y-1">
                    {/* PAA Logic */}
                    {hasPHA && (
                        <div className="flex flex-col items-center">
                            <span className="bg-[#0071BC] text-white px-2 py-0.5 text-[9px] font-black leading-none uppercase select-none rounded-t-sm">PAA</span>
                            <div className="bg-[#0071BC] text-white px-2 py-1 text-[10px] font-bold flex items-center gap-3 shadow-sm rounded-b-sm rounded-l-sm min-w-[200px]">
                                <span>S.Win: {(phaStats.paaTotal ?? phaStats.total) > 0 ? Math.round((phaStats.favWin / (phaStats.paaTotal ?? phaStats.total)) * 100) : 0}%</span>
                                <span>Draw :{(phaStats.paaTotal ?? phaStats.total) > 0 ? Math.round((phaStats.draw / (phaStats.paaTotal ?? phaStats.total)) * 100) : 0}%</span>
                                <span>Upset {(phaStats.paaTotal ?? phaStats.total) > 0 ? Math.round((phaStats.upsetWin / (phaStats.paaTotal ?? phaStats.total)) * 100) : 0}%</span>
                            </div>
                        </div>
                    )}

                    {/* RIGHT: Max Pts and OW */}
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase whitespace-nowrap pb-1">
                         {optCategories.length > 0 ? (
                             <div className="flex items-center gap-1 flex-wrap">
                                 {optCategories.map(cat => (
                                     <button 
                                         key={cat.id}
                                         onClick={(e) => { e.stopPropagation(); setActiveOWCategory(cat ? cat.id : owCategory); setIsOWModalOpen(true); }}
                                         className="flex items-center gap-1 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                                         title={`View ${cat.label} Optimized Weight Breakdown`}
                                     >
                                         {cat.label} <span className="text-indigo-600 text-sm font-black">{categoryScores[cat.id]?.totalScore ?? '-'}</span>
                                     </button>
                                 ))}
                             </div>
                         ) : (
                               <button 
                                   onClick={(e) => { e.stopPropagation(); setActiveOWCategory(owCategory); setIsOWModalOpen(true); }}
                                 className="flex items-center gap-1 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                                 title="View Optimized Weight Breakdown"
                             >
                                 OW <span className="text-indigo-600 text-sm font-black">-</span>
                             </button>
                         )}
                         <div className="flex items-center gap-1 border-l pl-2">
                             MAX PTS <span className="text-gray-900 text-sm font-black">{(match.maxPoints && match.maxPoints > 0 ? match.maxPoints : Math.max(pts.home, pts.draw, pts.away))?.toFixed(1)}</span>
                             {expandedMatch === match.id ? <ChevronUp size={14} className="ml-1"/> : <ChevronDown size={14} className="ml-1"/>}
                         </div>
                    </div>
                </div>
          </div>

        </div>
      </div>

      {/* EXPANDED DETAILS */}
      {expandedMatch === match.id && (
        <div className="border-t border-gray-200 bg-white p-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            
            {/* Points Breakdown Table */}
            <div className="bg-white p-2 rounded border border-gray-200 shadow-sm">
              <h4 className="font-bold text-gray-700 text-xs mb-2 uppercase">Points Breakdown</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500 text-[10px] uppercase">
                      <th className="text-left py-1 font-medium">Metric</th>
                      <th className="text-center py-1 font-medium">Home</th>
                      <th className="text-center py-1 font-medium">Draw</th>
                      <th className="text-center py-1 font-medium">Away</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {['1x2', 'TS', 'GA', 'GS', 'L10', 'MO', 'LE'].map(metric => {
                       const key = `pts${metric}`;
                       const p = pts.breakdown[key as keyof typeof pts.breakdown] as { home: number, draw: number, away: number };
                       return (
                         <tr key={metric} className="hover:bg-gray-50 border-b border-gray-50 last:border-0">
                           <td className="py-1 text-gray-600 font-medium uppercase">{metric}</td>
                           <td className="py-1 text-center text-blue-600">{p?.home.toFixed(1)}</td>
                           <td className="py-1 text-center text-yellow-600">{p?.draw.toFixed(1)}</td>
                           <td className="py-1 text-center text-red-600">{p?.away.toFixed(1)}</td>
                         </tr>
                       );
                    })}
                    <tr className="border-t-2 border-gray-100 font-bold text-xs bg-gray-50">
                      <td className="py-2 pl-1 text-gray-800">TOTAL</td>
                      <td className="py-2 text-center text-blue-700">{pts.home.toFixed(1)}</td>
                      <td className="py-2 text-center text-yellow-700">{pts.draw.toFixed(1)}</td>
                      <td className="py-2 text-center text-red-700">{pts.away.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 shadow-sm text-xs">
                <h4 className="text-gray-500 font-bold uppercase mb-2 border-b border-gray-200 pb-1">Match Data</h4>
                <div className="grid grid-cols-2 gap-y-1 gap-x-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Rating</span>
                    <span className="font-mono font-medium text-gray-700">{match.rating}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">L10</span>
                    <span className="font-mono font-medium text-gray-700">{match.l10}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">LE</span>
                    <span className="font-mono font-medium text-gray-700">{match.le}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">MO</span>
                    <span className="font-mono font-medium text-gray-700">{match.mo}</span>
                  </div>
                </div>
              </div>
              
              {match.hedgeNote && (
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 font-medium flex items-start gap-2">
                      <Lightbulb size={12} className="mt-0.5 shrink-0"/>
                      <span>{match.hedgeNote}</span>
                  </div>
              )}
            </div>

          </div>
        </div>
      )}
      {/* ML Data Modal */}
      {isMLModalOpen && match.mlInfo && (
          <MLDataModal 
              isOpen={isMLModalOpen}
              onClose={() => setIsMLModalOpen(false)}
              matrixStats={match.mlInfo.matrixStats}
              tags={match.mlInfo.tags}
          />
      )}

      {phaStatsMap && (
          <OptimizedWeightsModal
              isOpen={isOWModalOpen}
              onClose={() => { setActiveOWCategory(null); setIsOWModalOpen(false); }}
              match={match}
              phaStatsMap={phaStatsMap}
              categoryId={activeOWCategory || defaultOptScoreCategory || owCategory}
          />
      )}

    </div>
  );
};

export default React.memo(MatchCard);