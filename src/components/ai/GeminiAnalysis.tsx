
import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Match, AIAnalysisArchive } from '../../types';
import { matchAlgorithm } from './algorithm';
import { BrainCircuit, Sparkles, Loader2, AlertTriangle, FileText, Wrench, Microscope, Trophy, PlayCircle, Save, Target, ListOrdered, Medal, CheckCircle2, RotateCcw, Archive, X, Trash2, Zap, DollarSign, ShieldCheck, Star, GraduationCap, ArrowRightLeft, Clock, Divide, ShieldAlert, Cpu, BarChart2, MousePointerClick, FilePlus, Search, Calculator, BookOpen, ListFilter, Percent, Lightbulb, Award, Eye } from 'lucide-react';
import * as Storage from '../../services/storage';
import { JACKPOT_OPTIONS } from '../../constants';
import { Pick, PickCard, PostMatchCard, StrategyItem, InsightCard, TacticalAuditView } from './GeminiCards';
import { executeGeminiAnalysis, AIResponse, normalizeTeamName } from './GeminiEngine';
import { getActualResult, matchesPrediction } from '../../utils/matchProcessing';
import { saveMatchStars, useMatchStars } from '../../utils/matchStars';
import { DEFAULT_WEIGHTS, getMatchScore, predictWithSeer, predictSeerDetailed } from '../../utils/seerLogic';
import { generateSeerSlips } from '../../utils/seerSlipSelection';
import { getMatchEvaluatorTags, getMatchStats } from '../../utils/matchEvaluator';
import { SystemFormulasView } from '../SystemFormulas';
import MatchSelector from '../MatchSelector';
import { SystemArchitecture } from './SystemArchitecture';
import { MatchStarsUpdateModal } from './MatchStarsUpdateModal';
// Supreme Weightings view removed per product decision.
import { SupremeSlipSelection } from './SupremeSlipSelection';
import { getSupremeWeights, predictWithSupreme } from './SupremeAlgorithm';


interface GeminiAnalysisProps {
  matches: Match[]; 
  liveSessionMatches?: Match[]; 
  activeJackpotId?: string;
  fullHistory?: Match[]; // NEW: Full historical dataset for Self Learning
  phaStatsMap?: Record<string, any>; // NEW: PHA Stats for SEER
}

// Helper to ensure stats sum to 100%
const formatAlgoStats = (probabilities?: { '1': number; 'X': number; '2': number }) => {
    if (!probabilities) return "1:0% X:0% 2:0%";
    let p1 = Math.round((probabilities['1'] || 0) * 100);
    let pX = Math.round((probabilities['X'] || 0) * 100);
    let p2 = Math.round((probabilities['2'] || 0) * 100);
    
    const sum = p1 + pX + p2;
    const diff = 100 - sum;
    
    if (diff !== 0 && sum > 0) {
        // Adjust the largest value to absorb the rounding error to minimize visual impact
        const maxVal = Math.max(p1, pX, p2);
        if (p1 === maxVal) p1 += diff;
        else if (pX === maxVal) pX += diff;
        else p2 += diff;
    }
    
    return `1:${p1}% X:${pX}% 2:${p2}%`;
};

export const GeminiAnalysis: React.FC<GeminiAnalysisProps> = ({ matches, liveSessionMatches, activeJackpotId, fullHistory, phaStatsMap }) => {
  const matchStars = useMatchStars();

  const getPickStars = (pick: Pick, pickCategory?: string) => {
      if (!pick.match_id) return 0;
      const match = (liveSessionMatches || matches).find(m => m.id === pick.match_id || m.id === parseInt(pick.match_id as string));
      if (!match || !match.evaluatorTags || match.evaluatorTags.length === 0) return 0;

      const abbrMap: Record<string, string> = {
          'top10': 'T12',
          'botb_best': 'NB',
          'top20': 'T20',
          'bankers_dlive': 'BDL',
          'bankers': 'BNK',
          'bankers_jackpot': 'BNK',
          'value_bets': 'VB',
          'value_picks': 'VP',
          'banker_draws': 'BD',
          'upsets': 'UPS'
      };

      // If a specific category is provided, try to find the tag for that category first
      const targetCategory = pickCategory || pick.category;
      
      if (targetCategory) {
          const targetAbbr = abbrMap[targetCategory];
          if (targetAbbr) {
              const tag = match.evaluatorTags.find(t => t.startsWith(`${targetCategory}:`));
              if (tag) {
                  const [, pr] = tag.split(':');
                  const group = match.group || 3;
                  const key = `${targetAbbr}-${pr}-G${group}`;
                  const fallbackKey = `${targetAbbr}-${pr}-G3`;
                  
                  let stars = matchStars[key];
                  if (stars === undefined) {
                      stars = matchStars[fallbackKey];
                  }
                  
                  if (stars !== undefined) {
                      return stars;
                  }
              }
          }
      }

      // Fallback: just use the first tag that has stars
      for (const tag of match.evaluatorTags) {
          const [cat, pr] = tag.split(':');
          const abbr = abbrMap[cat];
          if (abbr && pr) {
              const group = match.group || 3;
              const key = `${abbr}-${pr}-G${group}`;
              const fallbackKey = `${abbr}-${pr}-G3`;
              
              let stars = matchStars[key];
              if (stars === undefined) {
                  stars = matchStars[fallbackKey];
              }
              
              if (stars !== undefined) {
                  return stars;
              }
          }
      }
      return 0;
  };

  const renderPostMatch = (pick: Pick, stars: number, isJackpot: boolean, index: number = 0) => {
      const pName = normalizeTeamName(pick.team);
      let match = liveSessionMatches?.find(m => {
          const mName = normalizeTeamName(m.teams);
          return mName.includes(pName) || pName.includes(mName);
      });
      if (!match) match = matches.find(m => normalizeTeamName(m.teams).includes(pName) || pName.includes(normalizeTeamName(m.teams)));
      
      let algoStats = undefined;
      let algoPrediction = undefined;
      if (match) {
          if (!pick.primaryPrediction) {
              pick.primaryPrediction = match.seerPrimaryPrediction || predictSeerDetailed(match, DEFAULT_WEIGHTS, phaStatsMap || {}, matchStars, pick.category || 'all').primary;
          }
          if (match.algoReport) {
              algoStats = formatAlgoStats(match.algoReport.probabilities);
              algoPrediction = match.algoReport.prediction;
          }
      }
  
      return <PostMatchCard key={`${pick.match_id || pick.team}_${index}`} pick={pick} match={match} algoStats={algoStats} algoPrediction={algoPrediction} stars={stars} matchTags={match?.evaluatorTags} isJackpot={isJackpot} />;
  };

  const [mode, setMode] = useState<'architect' | 'live' | 'jackpot' | 'post_match' | 'self_learn' | 'system_architecture' | 'supreme_slips'>(() => {
      try {
          const saved = localStorage.getItem('prm_ai_last_mode');
          // 'supreme_weightings' was removed; migrate old saved value silently.
          const normalized = saved === 'supreme_weightings' ? 'supreme_slips' : saved;
          return (normalized as any) || 'supreme_slips';
      } catch { return 'supreme_slips'; }
  });

  
  const [postMatchMode, setPostMatchMode] = useState<'daily' | 'jackpot'>('daily');
  const [postMatchCategory, setPostMatchCategory] = useState<'top10' | 'bankers_dlive' | 'botb_best' | 'top20' | 'best_bet' | 'bankers_jackpot' | 'value_bets' | 'value_picks' | 'banker_draws' | 'upsets' | 'uncategorized' | 'jackpot_slip'>('top10');
  const [selfLearnFilter, setSelfLearnFilter] = useState<'all' | 'recent' | 'all_jackpots' | 'recent_jackpots' | 'priorities'>('all');
  const [selfLearnStrategy, setSelfLearnStrategy] = useState<'general' | 'draw' | 'upset' | 'hedge' | 'value_bets' | 'value_picks' | 'algo' | 'pha' | 'banker' | 'jackpot_audit' | 'pattern_creator' | 'points_system' | 'match_selector' | 'ai_filters' | 'probability_review' | 'system_rebuild'>('general');
  const [selectedJackpotId, setSelectedJackpotId] = useState<string>(activeJackpotId || JACKPOT_OPTIONS[0].id);
  const [showSystemFormulas, setShowSystemFormulas] = useState(false); // Toggle for Formulas in Architect mode
  const [showMatchSelector, setShowMatchSelector] = useState(false); // Toggle for Match Criteria Modal
  const [showMatchStarsModal, setShowMatchStarsModal] = useState(false); // Toggle for Match Stars Modal

  useEffect(() => {
      if(activeJackpotId) setSelectedJackpotId(activeJackpotId);
  }, [activeJackpotId]);

  // Ensure Algorithm is trained when matches change
  useEffect(() => {
      // Train with full history if available, otherwise fallback to matches
      const trainingSet = (fullHistory && fullHistory.length > 0) ? fullHistory : matches;
      if (trainingSet.length > 0) {
          matchAlgorithm.train(trainingSet);
      }
  }, [matches, fullHistory]);
  
  const [resultsFilter, setResultsFilter] = useState<'all' | 'top_10' | 'top_20' | 'best_bet' | 'botb' | 'bankers_jackpot' | 'bankers_dlive' | 'value' | 'value_picks' | 'banker_draws' | 'upsets'>('all');
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  const [systemData, setSystemData] = useState<AIResponse | null>(null);
  const [liveData, setLiveData] = useState<AIResponse | null>(null);
  const [jackpotData, setJackpotData] = useState<AIResponse | null>(null);
  const [selfLearnData, setSelfLearnData] = useState<AIResponse | null>(null); 
  
  const [postMatchDailyData, setPostMatchDailyData] = useState<AIResponse | null>(null);
  const [postMatchJackpotData, setPostMatchJackpotData] = useState<AIResponse | null>(null);
  
  const [aiHistory, setAiHistory] = useState<AIAnalysisArchive[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  const [predictionSource, setPredictionSource] = useState<'cache' | 'archive'>('cache');
  const [selectedBaselineArchiveId, setSelectedBaselineArchiveId] = useState<string>('');

  const [showClearChoiceModal, setShowClearChoiceModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIntelligenceActive, setIsIntelligenceActive] = useState(false);
  const [seerIntelligenceSlips, setSeerIntelligenceSlips] = useState<any[]>([]);
  const [isSeerLoading, setIsSeerLoading] = useState(false);
  
  let data: AIResponse | null = null;
  if (mode === 'architect') data = systemData;
  else if (mode === 'live') data = liveData;
  else if (mode === 'jackpot') data = jackpotData;
  else if (mode === 'self_learn') data = selfLearnData;
  else if (mode === 'post_match') {
      data = postMatchMode === 'daily' ? postMatchDailyData : postMatchJackpotData;
  }

  useEffect(() => {
    // Load AI data asynchronously in chunks to prevent UI freeze on mount
    setTimeout(() => setSystemData(Storage.getCurrentAnalysis('system')), 10);
    setTimeout(() => setLiveData(Storage.getCurrentAnalysis('live')), 50);
    setTimeout(() => setJackpotData(Storage.getCurrentAnalysis('jackpot')), 100);
    setTimeout(() => setSelfLearnData(Storage.getCurrentAnalysis('self_learn')), 150);
    setTimeout(() => setPostMatchDailyData(Storage.getCurrentAnalysis('post_match_daily')), 200);
    setTimeout(() => setPostMatchJackpotData(Storage.getCurrentAnalysis('post_match_jackpot')), 250);
    setTimeout(() => setAiHistory(Storage.getAIHistory()), 300);
  }, []);

  const handleModeChange = (newMode: 'architect' | 'live' | 'jackpot' | 'post_match' | 'self_learn' | 'system_architecture' | 'supreme_slips') => {
      setMode(newMode);
      setResultsFilter('all');
      localStorage.setItem('prm_ai_last_mode', newMode);
      setError(null);
      if (newMode !== 'architect') setShowSystemFormulas(false);
  };

  const currentJackpotName = useMemo(() => {
      return JACKPOT_OPTIONS.find(o => o.id === selectedJackpotId)?.name || 'Jackpot';
  }, [selectedJackpotId]);

  const contextInfo = useMemo(() => {
      if (mode === 'architect') return { count: matches.length, label: 'Historical' };
      if (mode === 'self_learn') {
          if (selfLearnStrategy === 'jackpot_audit') {
              const count = fullHistory ? fullHistory.filter(m => m.isJackpot).length : matches.filter(m => m.isJackpot).length;
              return { count, label: 'Jackpot History' };
          }
          return { count: fullHistory ? fullHistory.length : matches.length, label: 'Historical (Full)' };
      }
      
      const session = liveSessionMatches || [];

      if (mode === 'live') {
          // Use getActualResult to robustly detect pending matches (handles ' - ', '?', etc.)
          const count = session.filter(m => m.isDaily && getActualResult(m.result) === 'pending').length;
          return { count, label: 'Daily Pending' };
      }
      if (mode === 'jackpot') {
          const count = session.filter(m => m.isJackpot && m.jackpotIds?.includes(selectedJackpotId) && getActualResult(m.result) === 'pending').length;
          return { count, label: `${currentJackpotName} Pending` };
      }
      if (mode === 'post_match') {
          if (postMatchMode === 'jackpot') {
              const count = session.filter(m => m.isJackpot && m.jackpotIds?.includes(selectedJackpotId)).length;
              return { count, label: `${currentJackpotName} Audit` };
          } else {
              const count = session.filter(m => m.isDaily).length;
              return { count, label: 'Daily Audit' };
          }
      }
      return { count: 0, label: '-' };
  }, [mode, matches, liveSessionMatches, postMatchMode, selectedJackpotId, currentJackpotName, fullHistory, selfLearnStrategy]);

  const handleSaveReport = () => {
      if (!data) return;
      
      let archiveMode = mode;
      if (mode === 'post_match') {
          archiveMode = `post_match_${postMatchMode}` as any;
      }

      const archiveEntry: AIAnalysisArchive = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          mode: archiveMode as any,
          data: data,
          stats: { 
              totalMatches: contextInfo.count,
              jackpotId: mode === 'jackpot' || (mode === 'post_match' && postMatchMode === 'jackpot') ? selectedJackpotId : undefined,
              strategy: mode === 'self_learn' ? selfLearnStrategy : undefined
          }
      };
      Storage.saveAIHistory(archiveEntry);
      setAiHistory(prev => [archiveEntry, ...prev]);
      alert("Report saved to Archives!");
  };

  const handleUpdateStars = () => {
      if (postMatchDailyData) {
          setShowMatchStarsModal(true);
      } else {
          const latestDaily = aiHistory.find(h => h.mode === 'post_match_daily');
          if (latestDaily && latestDaily.data) {
              setShowMatchStarsModal(true);
          } else {
              alert("No Daily Live post-match audit found. Please run or load a Daily Live audit first.");
          }
      }
  };

    const generateSeerSlipsLocal = (matchList: Match[], stats: any, stars: any, isJackpot: boolean = false, isIntelligenceActive: boolean = false) => {
        const getLocalUpsetPriority = (m: Match, tags: string[]): number => {
        const mStats = getMatchStats(m, stats);
        const moUnderdog = mStats.moUnderdog;

        const cardSeerDetailed = predictSeerDetailed(m, DEFAULT_WEIGHTS, stats, stars, 'all');
        const seerPrimary = cardSeerDetailed.primary;
        const seerFinal = cardSeerDetailed.final;

        const paaPrimary = m.paaPrimaryPrediction || m.paaPrediction || "";
        const paaFinal = m.paaPrediction || "";

        const isPriority1 = (seerPrimary === moUnderdog);
        const isPriority2 = (paaPrimary === moUnderdog);
        const hasUpsetPR1toPR7 = tags.some(t => {
            if (!t.startsWith('upsets:')) return false;
            const pr = t.split(':')[1];
            return ['PR1', 'PR2', 'PR3', 'PR4', 'PR5', 'PR6', 'PR7'].includes(pr);
        });
        const isPriority3 = hasUpsetPR1toPR7 && (paaFinal === '12' || seerFinal === '12');

        if (isPriority1) return 1;
        if (isPriority2) return 2;
        if (isPriority3) return 3;
        return 4; // Not eligible
    };

        const supremeWeightsMap = getSupremeWeights(fullHistory || matchList, stats, stars);

    const slipCategories = [
        { id: 'bankers_dlive', name: 'Elite Bankers', targetTags: ['bankers_jackpot', 'bankers_dlive'], minSeer: 33 },
        { id: 'upsets', name: 'High-Value Upsets', targetTags: ['upsets', 'value_bets'], minSeer: 25 },
        { id: 'top10', name: 'Jackpot Boosters', targetTags: ['bankers_jackpot', 'top10'], minSeer: 30 },
        { id: 'best_bet', name: 'Safety Net', targetTags: ['best_bet'], minSeer: 35 }
    ];

    return slipCategories.map(cat => {
        const recommended = matchList.filter(m => {
            const tags = getMatchEvaluatorTags(m, stats, isJackpot, true, stars);
            const hardBans = tags.filter(t => t.startsWith('BANNED:') && t !== 'PHA_TIE');
            if (hardBans.length > 0) return false;
            
            let matchesCategory = cat.targetTags.some(tt => tags.some(t => t.includes(tt)));
            
            if (cat.id === 'upsets') {
                const priority = getLocalUpsetPriority(m, tags);
                matchesCategory = (priority === 1 || priority === 2 || priority === 3);
            }

            if (!matchesCategory) return false;

            // Extra check for Safety Net (Best Bets): PAA S.win >= 60%
            if (cat.id === 'safety') {
                const mStats = getMatchStats(m, stats);
                if (mStats.phaFavWinSupport < 60) return false;
            }

            let score = 0;
            if (isIntelligenceActive) {
                 const supremePred = predictWithSupreme(m, cat.id, supremeWeightsMap, stats, stars);
                 score = Math.max(supremePred.score1, supremePred.scoreX, supremePred.score2);
                 return score > 0; // Just needs to hit some supreme weights
            } else {
                 score = Math.max(
                     getMatchScore(m, '1', DEFAULT_WEIGHTS, stats, stars),
                     getMatchScore(m, 'X', DEFAULT_WEIGHTS, stats, stars),
                     getMatchScore(m, '2', DEFAULT_WEIGHTS, stats, stars)
                 );
                 return score >= cat.minSeer;
            }
        });

        recommended.sort((a, b) => {
            const tagsA = getMatchEvaluatorTags(a, stats, isJackpot, true, stars);
            const tagsB = getMatchEvaluatorTags(b, stats, isJackpot, true, stars);

            if (cat.id === 'upsets') {
                const pA = getLocalUpsetPriority(a, tagsA);
                const pB = getLocalUpsetPriority(b, tagsB);
                if (pA !== pB) {
                    return pA - pB;
                }
            }

            let scoreA = 0;
            let scoreB = 0;
            if (isIntelligenceActive) {
                const sA = predictWithSupreme(a, cat.id, supremeWeightsMap, stats, stars);
                const sB = predictWithSupreme(b, cat.id, supremeWeightsMap, stats, stars);
                scoreA = Math.max(sA.score1, sA.scoreX, sA.score2);
                scoreB = Math.max(sB.score1, sB.scoreX, sB.score2);
            } else {
                scoreA = Math.max(
                    getMatchScore(a, '1', DEFAULT_WEIGHTS, stats, stars),
                    getMatchScore(a, 'X', DEFAULT_WEIGHTS, stats, stars),
                    getMatchScore(a, '2', DEFAULT_WEIGHTS, stats, stars)
                );
                scoreB = Math.max(
                    getMatchScore(b, '1', DEFAULT_WEIGHTS, stats, stars),
                    getMatchScore(b, 'X', DEFAULT_WEIGHTS, stats, stars),
                    getMatchScore(b, '2', DEFAULT_WEIGHTS, stats, stars)
                );
            }
            return scoreB - scoreA;
        });

        const slicedMatches = recommended.slice(0, 8).map(m => {
            let localPred = m.seerPrediction;
            let localPrimary = m.seerPrimaryPrediction;
            
            if (isIntelligenceActive) {
                const sP = predictWithSupreme(m, cat.id, supremeWeightsMap, stats, stars);
                if (sP.finalPrediction) {
                    localPred = sP.finalPrediction;
                    localPrimary = sP.finalPrediction.substring(0, 1);
                } else {
                    localPred = predictWithSeer(m, DEFAULT_WEIGHTS, stats, stars, cat.id);
                }
            } else {
                localPred = localPred || predictWithSeer(m, DEFAULT_WEIGHTS, stats, stars, cat.id);
            }

            if (cat.id === 'upsets') {
                const mStats = getMatchStats(m, stats);
                const moUnderdog = mStats.moUnderdog;
                
                localPred = moUnderdog;
                localPrimary = moUnderdog;
            }
            
            return {
                ...m,
                seerPrediction: localPred,
                seerPrimaryPrediction: localPrimary
            };
        });

        return { ...cat, matches: slicedMatches };
    });
  };

  const SeerIntelligencePanel = () => {
    if (!seerIntelligenceSlips.length && !isSeerLoading) return null;

    return (
        <div className="mt-8 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 mb-6 bg-gradient-to-r from-teal-500 to-indigo-600 p-4 rounded-2xl shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <BrainCircuit size={80} />
                </div>
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                    <Eye className="text-white" size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">SEER Intelligence Slips</h2>
                    <p className="text-indigo-100 text-[10px] font-bold uppercase opacity-80 tracking-widest">Optimized Selections via Automated Precision Audit</p>
                </div>
                {isSeerLoading && <Loader2 className="animate-spin text-white ml-auto" size={20} />}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {seerIntelligenceSlips.map(slip => (
                    <div key={slip.id} className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col group hover:border-indigo-200 transition-all duration-300">
                        <div className="bg-slate-900 px-5 py-4 flex justify-between items-center group-hover:bg-indigo-950 transition-colors">
                            <div className="flex items-center gap-3">
                                <Award className="text-teal-400" size={20} />
                                <h3 className="font-black text-white uppercase tracking-wider text-xs">{slip.name}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                {(() => {
                                    let completedCount = 0;
                                    let correctCount = 0;
                                    slip.matches.forEach((m: Match) => {
                                        const actual = getActualResult(m.result || '');
                                        if (actual !== 'pending') {
                                            completedCount++;
                                            const pred = m.seerPrediction || predictWithSeer(m, DEFAULT_WEIGHTS, phaStatsMap || {}, matchStars, slip.id);
                                            if (matchesPrediction(pred, actual)) {
                                                correctCount++;
                                            }
                                        }
                                    });
                                    if (completedCount > 0) {
                                        const pct = Math.round((correctCount / completedCount) * 100);
                                        return (
                                            <>
                                                <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-full border border-indigo-400/30">
                                                    ACCURATE {correctCount} / {completedCount}
                                                </span>
                                                <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-400/30">
                                                    {pct}%
                                                </span>
                                            </>
                                        );
                                    }
                                    return null;
                                })()}
                                <span className="text-[10px] font-black bg-white/10 text-teal-300 px-3 py-1 rounded-full border border-white/10">
                                    {slip.matches.length} SUGGESTIONS
                                </span>
                            </div>
                        </div>
                        <div className="p-5 space-y-3 flex-1 bg-slate-50/30 overflow-y-auto" style={{ maxHeight: '400px' }}>
                            {slip.matches.length === 0 ? (
                                <div className="text-center py-10 flex flex-col items-center gap-2 opacity-30">
                                    <ShieldAlert size={32} />
                                    <p className="italic text-xs font-bold">No criteria matches found.</p>
                                </div>
                            ) : (
                                slip.matches.map((m: Match, idx: number) => {
                                    const pred = m.seerPrediction || predictWithSeer(m, DEFAULT_WEIGHTS, phaStatsMap || {}, matchStars, slip.id);
                                    const actual = getActualResult(m.result || '');
                                    const isCompleted = actual !== 'pending' && !!m.result && m.result !== 'Unknown' && m.result.toLowerCase() !== 'unknown';
                                    const isCorrect = isCompleted && matchesPrediction(pred, actual);
                                    
                                    return (
                                        <div key={`${m.id}_${idx}`} className={`p-4 border rounded-xl bg-white transition-all duration-200 ${isCompleted ? (isCorrect ? 'border-emerald-200 shadow-sm shadow-emerald-100/50' : 'border-red-200 shadow-sm shadow-red-100/50') : 'border-slate-100 hover:shadow-lg hover:border-indigo-200'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-slate-400 tracking-tighter uppercase">LE: {m.le || "NA"}</span>
                                                    <span className="text-[8px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-black border border-indigo-100">{m.mo?.split(',').slice(0,3).join(',') || 'N/A'}</span>
                                                </div>
                                                {isCompleted && (
                                                    <span className="text-[10px] font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                        FT: {m.result}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm font-black text-slate-800 line-clamp-1 uppercase tracking-tight mb-3">{m.teams}</div>
                                            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                                                <div className="flex gap-1.5">
                                                    {m.evaluatorTags?.filter((t: string) => !t.startsWith('BANNED:')).slice(0, 2).map((t: string) => (
                                                        <span key={t} className="text-[8px] font-black text-slate-500 uppercase bg-slate-100 px-1.5 py-0.5 rounded tracking-tighter">
                                                            {t.split(':')[0].replace('_', ' ')}
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className={`flex items-center gap-2 pr-0.5 py-0.5 pl-3 rounded-lg shadow-sm border ${isCompleted ? (isCorrect ? 'bg-emerald-900 border-emerald-800' : 'bg-red-900 border-red-800') : 'bg-slate-900 border-slate-800'}`}>
                                                    <span className={`text-[9px] font-black uppercase italic tracking-tighter ${isCompleted ? (isCorrect ? 'text-emerald-300' : 'text-red-300') : 'text-indigo-400'}`}>SEER</span>
                                                    <span className={`text-xs font-black text-white px-3 py-1 rounded-md ${isCompleted ? (isCorrect ? 'bg-emerald-600' : 'bg-red-600') : 'bg-indigo-600'}`}>{pred}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
  };

  const handleResetAnalysis = () => {
      if (mode === 'architect') { setSystemData(null); Storage.saveCurrentAnalysis('system', null); }
      else if (mode === 'live') { setLiveData(null); Storage.saveCurrentAnalysis('live', null); }
      else if (mode === 'jackpot') { setJackpotData(null); Storage.saveCurrentAnalysis('jackpot', null); }
      else if (mode === 'self_learn') { setSelfLearnData(null); Storage.saveCurrentAnalysis('self_learn', null); }
      else if (mode === 'post_match') {
          if (postMatchMode === 'daily') {
              setPostMatchDailyData(null); 
              Storage.saveCurrentAnalysis('post_match_daily', null);
          } else {
              setPostMatchJackpotData(null);
              Storage.saveCurrentAnalysis('post_match_jackpot', null);
          }
      }
  };

  const handleUpdatePredictionResults = () => {
      const currentData = mode === 'live' ? liveData : (mode === 'jackpot' ? jackpotData : null);
      if (!currentData) {
          alert('No live or jackpot analysis active to update.');
          return;
      }

      const updatedData = { ...currentData };
      
      const updatePicks = (obj: any) => {
          if (!obj) return;
          Object.keys(obj).forEach(key => {
              const slips = obj[key];
              if (Array.isArray(slips)) {
                  slips.forEach(pick => {
                      if (pick.match_id || pick.team) {
                           let mId = pick.match_id ? (typeof pick.match_id === 'string' ? parseInt(pick.match_id) : pick.match_id) : null;
                           let match;
                           if (mId) {
                               match = (liveSessionMatches || matches).find(m => m.id === mId);
                           } else {
                               const pName = normalizeTeamName(pick.team);
                               match = (liveSessionMatches || matches).find(m => {
                                   const mName = normalizeTeamName(m.teams);
                                   return mName.includes(pName) || pName.includes(mName);
                               });
                           }
                           
                           if (match) {
                               pick.actualResult = getActualResult(match.result);
                               if (pick.actualResult && pick.actualResult !== 'pending' && pick.actualResult !== 'postponed' && pick.actualResult !== 'cancelled') {
                                   if (pick.prediction.includes(pick.actualResult)) {
                                       pick.outcome = 'Correct';
                                   } else {
                                       pick.outcome = 'Incorrect';
                                   }
                               } else {
                                   pick.outcome = 'Pending';
                               }
                           }
                      }
                  });
              }
          });
      };

      updatePicks(updatedData.specialized_analysis);
      updatePicks(updatedData.live_predictions);

      if (mode === 'live') {
          setLiveData(updatedData);
          Storage.saveCurrentAnalysis('live', updatedData);
      } else if (mode === 'jackpot') {
          setJackpotData(updatedData);
          Storage.saveCurrentAnalysis('jackpot', updatedData);
      }
      alert('Prediction results and outcomes synchronized with live match statuses!');
  };

  const handleDeleteHistory = async (id: string) => {
      if (window.confirm("Are you sure you want to delete this report?")) {
          const updated = await Storage.deleteAIHistory(id);
          setAiHistory(updated);
      }
  };

  const handleLoadHistory = (entry: AIAnalysisArchive) => {
      const m = entry.mode;
      if (m === 'architect') { setMode('architect'); setSystemData(entry.data); }
      else if (m === 'live') { setMode('live'); setLiveData(entry.data); }
      else if (m === 'jackpot') { 
          setMode('jackpot'); 
          setJackpotData(entry.data);
          if (entry.stats?.jackpotId) setSelectedJackpotId(entry.stats.jackpotId);
      }
      else if (m === 'self_learn') { 
          setMode('self_learn'); 
          setSelfLearnData(entry.data);
          if (entry.stats?.strategy) setSelfLearnStrategy(entry.stats.strategy as any);
      }
      else if (m.startsWith('post_match')) {
          setMode('post_match');
          if (m.includes('daily')) {
              setPostMatchMode('daily');
              setPostMatchCategory('top10');
              setPostMatchDailyData(entry.data);
          } else {
              setPostMatchMode('jackpot');
              setPostMatchCategory('jackpot_slip');
              setPostMatchJackpotData(entry.data);
              if (entry.stats?.jackpotId) setSelectedJackpotId(entry.stats.jackpotId);
          }
      }
      setShowHistoryModal(false);
  };

  const compatibleArchives = useMemo(() => {
      if (mode !== 'post_match') return [];
      const targetMode = postMatchMode === 'daily' ? 'live' : 'jackpot';
      
      return aiHistory.filter(h => {
          const isModeMatch = h.mode === targetMode;
          if (postMatchMode === 'jackpot') {
              return isModeMatch && h.stats?.jackpotId === selectedJackpotId;
          }
          return isModeMatch;
      });
  }, [aiHistory, mode, postMatchMode, selectedJackpotId]);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setLoadingMessage(isIntelligenceActive ? 'Initializing Seer Engine...' : 'Analyzing matches...');

    try {
        // Ensure algoReport is populated for all matches
        const ensureAlgoReport = (matchList: Match[]) => {
            return matchList.map(m => {
                if (!m.algoReport) {
                    const prediction = matchAlgorithm.predict(m);
                    return {
                        ...m,
                        algoReport: {
                            prediction: prediction.prediction,
                            primaryPrediction: prediction.primaryPrediction,
                            confidence: prediction.rawConfidence,
                            probabilities: prediction.probabilities,
                            category: prediction.category,
                            reason: prediction.reason,
                            activeFilters: prediction.activeFilters || []
                        }
                    };
                }
                return m;
            });
        };

        const processedMatches = ensureAlgoReport(matches);
        const processedLiveSessionMatches = liveSessionMatches ? ensureAlgoReport(liveSessionMatches) : undefined;

        if (isIntelligenceActive && phaStatsMap) {
            setIsSeerLoading(true);
            setSeerIntelligenceSlips([]);
            
            // Intelligence Mode: Simulate deep processing
            setLoadingMessage('Simulating match scenarios...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            setLoadingMessage('Enforcing strict category parameters...');
            await new Promise(resolve => setTimeout(resolve, 1200));
            
            setLoadingMessage('Filtering by odds requirements...');
            await new Promise(resolve => setTimeout(resolve, 1200));
            
            setLoadingMessage('Optimizing hedging balance...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const slips = generateSeerSlipsLocal(processedLiveSessionMatches || processedMatches, phaStatsMap, matchStars, mode === 'jackpot', isIntelligenceActive);
            setSeerIntelligenceSlips(slips);
            
            setLoadingMessage('Generating final intelligence report...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            setIsSeerLoading(false);
        }

        setLoadingMessage(isIntelligenceActive ? 'Engaging Deep analysis core...' : 'Executing Gemini analysis...');

        if (mode === 'post_match') {
            const isDaily = postMatchMode === 'daily';
            
            if (!isIntelligenceActive) {
                // Determine category based on mode
                const targetCategory = isDaily ? 'top10' : 'jackpot_slip';
                setLoadingMessage('Executing deterministic audit...');
                
                const result = await executeGeminiAnalysis({
                    mode,
                    matches: processedMatches,
                    liveSessionMatches: processedLiveSessionMatches,
                    selectedJackpotId,
                    postMatchMode,
                    postMatchCategory: 'all', // Request all categories at once
                    selfLearnFilter,
                    selfLearnStrategy,
                    predictionSource,
                    selectedBaselineArchiveId,
                    aiHistory,
                    liveData,
                    jackpotData,
                    fullHistory,
                    isIntelligenceActive: false
                });

                if (!result) throw new Error("Deterministic Audit failed to return meta-data.");
                
                if (isDaily) setPostMatchDailyData(result);
                else setPostMatchJackpotData(result);

                // FINAL SAVE
                Storage.saveCurrentAnalysis(isDaily ? 'post_match_daily' : 'post_match_jackpot', result);
                await saveMatchStars(result);
                
                // Return to target view
                setPostMatchCategory(targetCategory as any);
            } else {
                // Intelligence Mode: Run categorizations in parallel with Promise.all
                const categories = isDaily 
                    ? ['best_bet', 'top10', 'bankers_dlive', 'botb_best', 'top20', 'bankers_jackpot', 'value_bets', 'value_picks', 'banker_draws', 'upsets', 'uncategorized']
                    : ['jackpot_slip', 'bankers_jackpot', 'value_bets', 'value_picks', 'banker_draws', 'upsets', 'uncategorized'];
                
                setLoadingMessage('Engaging Deep Analysis concurrent cores...');
                
                const results = await Promise.all(
                    categories.map(async (category) => {
                        const result = await executeGeminiAnalysis({
                            mode,
                            matches: processedMatches,
                            liveSessionMatches: processedLiveSessionMatches,
                            selectedJackpotId,
                            postMatchMode,
                            postMatchCategory: category as any,
                            selfLearnFilter,
                            selfLearnStrategy,
                            predictionSource,
                            selectedBaselineArchiveId,
                            aiHistory,
                            liveData,
                            jackpotData,
                            fullHistory,
                            isIntelligenceActive: true
                        });
                        return { category, result };
                    })
                );
                
                let accumulatedResult: AIResponse | null = null;
                
                for (const { category, result } of results) {
                    if (!result) throw new Error(`No data returned for category ${category}`);
                    
                    if (!accumulatedResult) {
                        accumulatedResult = result;
                    } else {
                        // Merge performance_report carefully to avoid overwriting with empty arrays
                        if (result.performance_report) {
                            const newReport = { ...accumulatedResult.performance_report };
                            
                            // Only copy arrays that actually have items (the ones processed in this stage)
                            for (const key of Object.keys(result.performance_report)) {
                                const val = (result.performance_report as any)[key];
                                if (Array.isArray(val) && val.length > 0) {
                                    if (key !== 'metrics' && key !== 'adjustments' && key !== 'key_failures') {
                                        (newReport as any)[key] = val;
                                    }
                                } else if (val && !Array.isArray(val)) {
                                    if (key === 'tactical_audits') {
                                        newReport.tactical_audits = {
                                            ...(accumulatedResult.performance_report?.tactical_audits || {}),
                                            ...val
                                        };
                                    } else {
                                        // Copy objects like tactical_audit if they exist
                                        (newReport as any)[key] = val;
                                    }
                                }
                            }
                            
                            // Merge arrays that accumulate
                            newReport.metrics = [
                                ...(accumulatedResult.performance_report?.metrics || []),
                                ...(result.performance_report?.metrics || [])
                            ];
                            
                            // Deduplicate metrics by category
                            const uniqueMetrics = new Map();
                            newReport.metrics.forEach((m: any) => {
                                if (m && m.category) uniqueMetrics.set(m.category, m);
                            });
                            newReport.metrics = Array.from(uniqueMetrics.values());

                            newReport.adjustments = [
                                ...(accumulatedResult.performance_report?.adjustments || []),
                                ...(result.performance_report?.adjustments || [])
                            ];
                            
                            newReport.key_failures = [
                                ...(accumulatedResult.performance_report?.key_failures || []),
                                ...(result.performance_report?.key_failures || [])
                            ];
                            
                            accumulatedResult.performance_report = newReport;
                        }
                        if (result.detailed_analysis) {
                            accumulatedResult.detailed_analysis = (accumulatedResult.detailed_analysis ? accumulatedResult.detailed_analysis + '\n\n' : '') + result.detailed_analysis;
                            if (!accumulatedResult.category_analysis) accumulatedResult.category_analysis = {};
                            accumulatedResult.category_analysis[category] = result.detailed_analysis;
                        }
                        if (result.insights) {
                            accumulatedResult.insights = [
                                ...(accumulatedResult.insights || []),
                                ...(result.insights || [])
                            ];
                        }
                    }
                    
                    // Update state incrementally so UI shows progress
                    if (isDaily) {
                        setPostMatchDailyData({...accumulatedResult});
                    } else {
                        setPostMatchJackpotData({...accumulatedResult});
                    }
                }
                
                // FINAL SAVE: Only save once after parallel completion to save quota
                if (accumulatedResult) {
                    if (isDaily) Storage.saveCurrentAnalysis('post_match_daily', accumulatedResult);
                    else Storage.saveCurrentAnalysis('post_match_jackpot', accumulatedResult);
                    
                    // Save stars only once after everything is calculated
                    await saveMatchStars(accumulatedResult);
                }
                
                // Reset to first category after finishing
                if (isDaily) {
                    setPostMatchCategory('top10');
                } else {
                    setPostMatchCategory('jackpot_slip');
                }
            }
        } else {
            const result = await executeGeminiAnalysis({
                mode: mode as any,
                matches: processedMatches,
                liveSessionMatches: processedLiveSessionMatches,
                selectedJackpotId,
                postMatchMode,
                postMatchCategory,
                selfLearnFilter,
                selfLearnStrategy,
                predictionSource,
                selectedBaselineArchiveId,
                aiHistory,
                liveData,
                jackpotData,
                fullHistory, // Pass full history here
                isIntelligenceActive
            });

            if (!result) throw new Error("No data returned from AI Engine");

            // --- ENFORCE SEER PREDICTIONS FOR LIVE & JACKPOT ---
            if (mode === 'live' || mode === 'jackpot') {
                const targetMatches = mode === 'live' ? processedLiveSessionMatches : processedMatches.filter(m => m.jackpotId === selectedJackpotId);
                const processSection = (picks: any) => {
                    if (picks && Array.isArray(picks)) {
                        picks.forEach(p => {
                            const pId = p.id || p.match_id;
                            const exactMatch = targetMatches.find(m => m.id == pId);
                            if (exactMatch && exactMatch.seerPrediction) {
                                p.prediction = exactMatch.seerPrediction;
                            }
                        });
                    }
                };
                if (result.specialized_analysis) {
                   Object.keys(result.specialized_analysis).forEach(key => {
                        processSection((result.specialized_analysis as any)[key]);
                   });
                }
                if (result.live_predictions) {
                   Object.keys(result.live_predictions).forEach(key => {
                        processSection((result.live_predictions as any)[key]);
                   });
                }
            }

            // Update State & Storage based on mode
            if (mode === 'live') {
                setLiveData(result);
                Storage.saveCurrentAnalysis('live', result);
            } else if (mode === 'jackpot') {
                setJackpotData(result);
                Storage.saveCurrentAnalysis('jackpot', result);
            } else if (mode === 'self_learn') {
                setSelfLearnData(result);
                Storage.saveCurrentAnalysis('self_learn', result);
                // Auto-archive self-learn runs as they are historical studies
                const archiveEntry: AIAnalysisArchive = { 
                    id: Date.now().toString(), 
                    date: new Date().toISOString(), 
                    mode: 'self_learn', 
                    data: result, 
                    stats: { 
                        totalMatches: fullHistory ? fullHistory.length : matches.length,
                        strategy: selfLearnStrategy // SAVE STRATEGY CONTEXT
                    } 
                };
                Storage.saveAIHistory(archiveEntry);
                setAiHistory(prev => [archiveEntry, ...prev]);
            } else if (mode === 'architect') {
                setSystemData(result);
                Storage.saveCurrentAnalysis('system', result);
            }
        }

    } catch (err: any) {
        console.error(err);
        if (err.message?.includes('429')) {
            setError("Daily Token Limit Reached.");
        } else {
            setError(err.message || "An error occurred.");
        }
    } finally {
        setLoading(false);
    }
  };

  const renderSpecializedSection = (data: AIResponse | null) => {
      if (!data) return null;
      const special = data.specialized_analysis;
      const perf = data.performance_report; 

      let picksToDisplay: Pick[] = [];
      let sectionColor = "bg-gray-100";
      let sectionIcon = <Target size={24} />;
      let title = "Predictions";
      let isAudit = false;
      let metricDisplay = null;

      if (mode === 'post_match' && perf) {
          isAudit = true;
          if (resultsFilter === 'best_bet') {
              picksToDisplay = Array.isArray(perf.best_bet_performance) ? perf.best_bet_performance : [];
              sectionColor = "border-amber-500 bg-amber-50";
              sectionIcon = <Star className="text-amber-600" size={24} />;
              title = "BEST BET PERFORMANCE AUDIT";
          } else if (resultsFilter === 'botb') {
              picksToDisplay = Array.isArray(perf.botb_best_performance) ? perf.botb_best_performance : [];
              sectionColor = "border-rose-500 bg-rose-50";
              sectionIcon = <Trophy className="text-rose-600" size={24} />;
              title = "BOTB BEST PERFORMANCE AUDIT";
          } else if (resultsFilter === 'top_10') {
              picksToDisplay = Array.isArray(perf.top_10_performance) ? perf.top_10_performance : [];
              sectionColor = "border-green-500 bg-green-50";
              sectionIcon = <Star className="text-green-600" size={24} />;
              title = "TOP 12 PERFORMANCE AUDIT";
          } else if (resultsFilter === 'top_20') {
              picksToDisplay = Array.isArray(perf.high_confidence_performance) ? perf.high_confidence_performance : [];
              sectionColor = "border-blue-500 bg-blue-50";
              sectionIcon = <Star className="text-blue-600" size={24} />;
              title = "TOP 20 PERFORMANCE AUDIT";
          } else if (resultsFilter === 'bankers_jackpot') {
              picksToDisplay = Array.isArray(perf.bankers_jackpot_performance) ? perf.bankers_jackpot_performance : [];
              sectionColor = "border-purple-500 bg-purple-50";
              sectionIcon = <ShieldCheck className="text-purple-600" size={24} />;
              title = postMatchMode === 'daily' ? "BANKERS DLIVE PERFORMANCE AUDIT" : "BANKERS JACKPOT PERFORMANCE AUDIT";
          } else if (resultsFilter === 'bankers_dlive') {
              picksToDisplay = Array.isArray(perf.bankers_dlive_performance) ? perf.bankers_dlive_performance : [];
              sectionColor = "border-indigo-500 bg-indigo-50";
              sectionIcon = <ShieldCheck className="text-indigo-600" size={24} />;
              title = "BANKERS DLIVE PERFORMANCE AUDIT";
          } else if (resultsFilter === 'value') {
              picksToDisplay = Array.isArray(perf.value_performance) ? perf.value_performance : [];
              sectionColor = "border-blue-500 bg-blue-50";
              sectionIcon = <DollarSign className="text-blue-600" size={24} />;
              title = "VALUE BETS PERFORMANCE AUDIT";
          } else if (resultsFilter === 'value_picks') { // NEW
              picksToDisplay = Array.isArray(perf.value_picks_performance) ? perf.value_picks_performance : [];
              sectionColor = "border-teal-500 bg-teal-50";
              sectionIcon = <MousePointerClick className="text-teal-600" size={24} />;
              title = "VALUE PICKS AUDIT";
          } else if (resultsFilter === 'banker_draws') { // NEW
              picksToDisplay = Array.isArray(perf.banker_draws_performance) ? perf.banker_draws_performance : [];
              sectionColor = "border-slate-500 bg-slate-50";
              sectionIcon = <Divide className="text-slate-600" size={24} />;
              title = "BANKER DRAWS AUDIT";
          } else if (resultsFilter === 'upsets') {
              picksToDisplay = Array.isArray(perf.upsets_performance) ? perf.upsets_performance : [];
              sectionColor = "border-orange-500 bg-orange-50";
              sectionIcon = <Zap className="text-orange-600" size={24} />;
              title = "UPSETS PERFORMANCE AUDIT";
          } else {
              return null; 
          }

          if (perf.metrics) {
              const m = perf.metrics.find(x => x.category.toLowerCase().includes(resultsFilter.replace('_', ' ').toLowerCase()));
              if (m) {
                 metricDisplay = (
                     <span className={`ml-auto text-xs font-black px-3 py-1 rounded-full border ${parseInt(m.accuracy) >= 70 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-200'}`}>
                        {m.accuracy} Accuracy
                     </span>
                 );
              }
          }

      } 
      else if (special || data.live_predictions) {
          if (resultsFilter === 'best_bet') {
              picksToDisplay = Array.isArray(data.live_predictions?.best_bet) ? data.live_predictions!.best_bet : [];
              sectionColor = "border-amber-500 bg-amber-50";
              sectionIcon = <Star className="text-amber-600" size={24} />;
              title = "BEST BET PREDICTIONS";
          } else if (resultsFilter === 'botb') {
              picksToDisplay = Array.isArray(data.live_predictions?.botb_best) ? data.live_predictions!.botb_best : [];
              sectionColor = "border-rose-500 bg-rose-50";
              sectionIcon = <Trophy className="text-rose-600" size={24} />;
              title = "BOTB BEST PREDICTIONS";
          } else if (resultsFilter === 'top_10') {
              picksToDisplay = Array.isArray(data.live_predictions?.top_10_value) ? data.live_predictions!.top_10_value : [];
              sectionColor = "border-green-500 bg-green-50";
              sectionIcon = <Star className="text-green-600" size={24} />;
              title = "TOP 12 PREDICTIONS";
          } else if (resultsFilter === 'top_20') {
              picksToDisplay = Array.isArray(data.live_predictions?.high_confidence) ? data.live_predictions!.high_confidence : [];
              sectionColor = "border-blue-500 bg-blue-50";
              sectionIcon = <Star className="text-blue-600" size={24} />;
              title = "TOP 20 PREDICTIONS";
          } else if (resultsFilter === 'bankers_jackpot') {
              picksToDisplay = Array.isArray(special?.bankers_jackpot) ? special!.bankers_jackpot : [];
              sectionColor = "border-purple-500 bg-purple-50";
              sectionIcon = <ShieldCheck className="text-purple-600" size={24} />;
              title = mode === 'live' ? "BANKERS DLIVE (Target: 5/5)" : "BANKERS JACKPOT (Target: 5/5)";
          } else if (resultsFilter === 'bankers_dlive') {
              picksToDisplay = Array.isArray(special?.bankers_dlive) ? special!.bankers_dlive : [];
              sectionColor = "border-indigo-500 bg-indigo-50";
              sectionIcon = <ShieldCheck className="text-indigo-600" size={24} />;
              title = "BANKERS DLIVE (Target: 10/10)";
          } else if (resultsFilter === 'value') {
              picksToDisplay = Array.isArray(special?.value_bets) ? special!.value_bets : [];
              sectionColor = "border-blue-500 bg-blue-50";
              sectionIcon = <DollarSign className="text-blue-600" size={24} />;
              title = "VALUE BETS (Hedged > 2.0)";
          } else if (resultsFilter === 'value_picks') { // NEW
              picksToDisplay = Array.isArray(special?.value_picks) ? special!.value_picks : [];
              sectionColor = "border-teal-500 bg-teal-50";
              sectionIcon = <MousePointerClick className="text-teal-600" size={24} />;
              title = "VALUE PICKS (Unhedged > 2.0)";
          } else if (resultsFilter === 'banker_draws') { // NEW
              picksToDisplay = Array.isArray(special?.banker_draws) ? special!.banker_draws : [];
              sectionColor = "border-slate-500 bg-slate-50";
              sectionIcon = <Divide className="text-slate-600" size={24} />;
              title = "BANKER DRAWS (Hedged)";
          } else if (resultsFilter === 'upsets') {
              picksToDisplay = Array.isArray(special?.upsets) ? special!.upsets : [];
              sectionColor = "border-orange-500 bg-orange-50";
              sectionIcon = <Zap className="text-orange-600" size={24} />;
              title = "UPSET PREDICTIONS";
          } else {
              return null;
          }
      } else {
          return null;
      }

      return (
          <div className={`rounded-xl shadow-sm border-l-4 p-6 ${sectionColor} animate-in fade-in slide-in-from-bottom-2`}>
              <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                      {sectionIcon}
                      {title}
                  </h3>
                  {metricDisplay}
              </div>
              {picksToDisplay.length === 0 ? (
                  <p className="text-gray-500 italic text-center py-8">No picks available for this category.</p>
              ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {picksToDisplay.map((pick, i) => {
                          if (isAudit) {
                              return renderPostMatch(pick, getPickStars(pick), mode === 'jackpot' || (mode === 'post_match' && postMatchMode === 'jackpot'), i);
                          }

                          const pName = normalizeTeamName(pick.team);
                          let match = liveSessionMatches?.find(m => {
                              const mName = normalizeTeamName(m.teams);
                              return mName.includes(pName) || pName.includes(mName);
                          });
                          if (!match) match = matches.find(m => normalizeTeamName(m.teams).includes(pName) || pName.includes(normalizeTeamName(m.teams)));

                          let algoStats = undefined;
                          let algoPrediction = undefined;
                          if (match) {
                              if (!pick.primaryPrediction) {
                                  pick.primaryPrediction = match.seerPrimaryPrediction || predictSeerDetailed(match, DEFAULT_WEIGHTS, phaStatsMap || {}, matchStars).primary;
                              }
                              if (match.algoReport) {
                                  algoStats = formatAlgoStats(match.algoReport.probabilities);
                                  algoPrediction = match.algoReport.prediction;
                              }
                          }

                          return (
                              <PickCard 
                                  key={i} 
                                  pick={pick} 
                                  type={resultsFilter === 'bankers_jackpot' ? 'confidence' : resultsFilter === 'value' || resultsFilter === 'value_picks' ? 'value' : 'standard'} 
                                  algoStats={algoStats}
                                  algoPrediction={algoPrediction}
                                  stars={getPickStars(pick)}
                                  marketOdds={match?.mo}
                                  matchTags={match?.evaluatorTags}
                                  isJackpot={mode === 'jackpot' || (mode === 'post_match' && postMatchMode === 'jackpot')}
                              />
                          );
                      })}
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className={`p-6 text-white relative overflow-hidden transition-colors ${mode === 'jackpot' ? 'bg-gradient-to-r from-amber-600 to-orange-700' : mode === 'post_match' ? 'bg-gradient-to-r from-green-600 to-emerald-700' : mode === 'live' ? 'bg-gradient-to-r from-red-600 to-rose-700' : mode === 'self_learn' ? 'bg-gradient-to-r from-teal-600 to-cyan-700' : 'bg-gradient-to-r from-violet-700 to-fuchsia-800'}`}>
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <BrainCircuit size={120} />
            </div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end relative z-10 gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm shadow-lg">
                            {mode === 'jackpot' ? <Trophy size={28} className="text-amber-200" /> : mode === 'post_match' ? <CheckCircle2 size={28} className="text-green-200" /> : mode === 'live' ? <PlayCircle size={28} className="text-red-200" /> : mode === 'self_learn' ? <GraduationCap size={28} className="text-teal-200" /> : <Microscope size={28} className="text-violet-200" />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight drop-shadow-md">
                                {mode === 'jackpot' ? 'Jackpot Specialist' : mode === 'post_match' ? 'Performance Auditor' : mode === 'live' ? 'Live Prediction Analyst' : mode === 'self_learn' ? 'Algorithm Self-Learning' : 'System Architect AI'}
                            </h2>
                            <p className="text-white/80 text-xs font-medium tracking-wide uppercase">
                                Powered by {isIntelligenceActive ? 'Gemini 3.1 Pro' : 'Gemini 3.8 Flash High'} ({isIntelligenceActive ? 'Deep Thinking' : 'High Thinking Analysis'})
                            </p>
                        </div>
                    </div>
                    <p className="text-white/90 text-sm max-w-xl font-medium">
                        {mode === 'jackpot' 
                            ? `Analyzing ${currentJackpotName} using ${isIntelligenceActive ? 'deep thinking patterns and AI intuition' : 'standard statistical analysis'}.` 
                            : mode === 'post_match' 
                                ? `Evaluating Performance on Daily/Jackpot, Upsets, and Value Bets with ${isIntelligenceActive ? 'high-level reasoning' : 'standard audit logic'}.` 
                                : mode === 'live' 
                                    ? `Scanning for Bankers, Value, and Upset opportunities with ${isIntelligenceActive ? 'deep AI verification' : 'standard pattern matching'}.` 
                                    : mode === 'self_learn' 
                                        ? `Reviewing historical performance to generate 20+ improvement strategies using ${isIntelligenceActive ? 'advanced logic' : 'standard optimization'}.` 
                                        : `${isIntelligenceActive ? 'Historical Optimization & Pattern Discovery with System Architecture Intelligence' : 'Standard System Architecture Review'}.`}
                    </p>
                </div>

                {/* Jackpot Selector Logic */}
                {(mode === 'jackpot' || (mode === 'post_match' && postMatchMode === 'jackpot')) && (
                    <div className="bg-white/20 backdrop-blur-md p-2 rounded-lg border border-white/30 flex flex-col gap-1 w-full md:w-auto">
                        <label className="text-[10px] font-bold text-white/80 uppercase tracking-wider">Select Active Jackpot</label>
                        <select 
                            value={selectedJackpotId} 
                            onChange={(e) => setSelectedJackpotId(e.target.value)}
                            className="bg-white text-gray-800 text-xs font-bold p-1.5 rounded outline-none border border-transparent focus:border-amber-400"
                        >
                            {JACKPOT_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </div>

        {/* Controls - Tabs and Run Button */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col lg:flex-row items-center justify-between gap-4">
            
            {/* Mode Selection Tabs */}
            <div className="flex p-1 bg-gray-200 rounded-lg overflow-x-auto w-full lg:w-auto">
                {/* Supreme Weightings tab removed per product decision. */}

                <button 
                    onClick={() => handleModeChange('supreme_slips')}
                    className={`px-4 py-2 rounded-md font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${mode === 'supreme_slips' ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Trophy size={16} /> Supreme Slips
                </button>
                <button 
                    onClick={() => handleModeChange('live')}
                    className={`px-4 py-2 rounded-md font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${mode === 'live' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <PlayCircle size={16} /> Live
                </button>
                <button 
                    onClick={() => handleModeChange('jackpot')}
                    className={`px-4 py-2 rounded-md font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${mode === 'jackpot' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Trophy size={16} /> Jackpot
                </button>
                <button 
                    onClick={() => handleModeChange('post_match')}
                    className={`px-4 py-2 rounded-md font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${mode === 'post_match' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <CheckCircle2 size={16} /> Post-Match
                </button>
                <button 
                    onClick={() => handleModeChange('self_learn')}
                    className={`px-4 py-2 rounded-md font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${mode === 'self_learn' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <GraduationCap size={16} /> Self Learn
                </button>
                <button 
                    onClick={() => handleModeChange('system_architecture')}
                    className={`px-4 py-2 rounded-md font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${mode === 'system_architecture' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <BrainCircuit size={16} /> System Architecture
                </button>
                <button 
                    onClick={() => handleModeChange('architect')}
                    className={`px-4 py-2 rounded-md font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${mode === 'architect' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Wrench size={16} /> System
                </button>
            </div>

            {/* Post Match Sub-Filter */}
            {mode === 'post_match' && (
                <div className="flex flex-col gap-2 w-full lg:w-auto">
                    <div className="flex bg-gray-200 rounded-lg p-1 flex-wrap gap-1">
                        <button onClick={() => { setPostMatchMode('daily'); setPostMatchCategory('top10'); }} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${postMatchMode === 'daily' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}><PlayCircle size={14}/> Daily Live</button>
                        <button onClick={() => { setPostMatchMode('jackpot'); setPostMatchCategory('jackpot_slip'); }} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${postMatchMode === 'jackpot' ? 'bg-white shadow-sm text-amber-700' : 'text-gray-500'}`}><Trophy size={14}/> Jackpot</button>
                    </div>
                </div>
            )}

            {/* Self Learn Filters (Top Row: Data Scope) */}
            {mode === 'self_learn' && (
                <div className="flex bg-gray-200 rounded-lg p-1 overflow-x-auto">
                    <button onClick={() => setSelfLearnFilter('all')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${selfLearnFilter === 'all' ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500'}`}>All Matches</button>
                    <button onClick={() => setSelfLearnFilter('recent')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${selfLearnFilter === 'recent' ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500'}`}>Recent Matches</button>
                    {/* Jackpot filters now subsumed by Jackpot Audit Strategy but kept for legacy */}
                    <button onClick={() => setSelfLearnFilter('all_jackpots')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${selfLearnFilter === 'all_jackpots' ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500'}`}>All Jackpots</button>
                    <button onClick={() => setSelfLearnFilter('recent_jackpots')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${selfLearnFilter === 'recent_jackpots' ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500'}`}>Recent Jackpots</button>
                    <button onClick={() => setSelfLearnFilter('priorities')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${selfLearnFilter === 'priorities' ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500'}`}>Priorities</button>
                </div>
            )}

            {/* Run Action */}
            <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 px-3 py-1.5 bg-white border border-gray-200 rounded-md shadow-sm">
                    <FileText size={14}/>
                    <span>{contextInfo.label}: <strong>{contextInfo.count}</strong></span>
                </div>
                {/* Action Buttons */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-md shadow-sm">
                    <Zap size={14} className={isIntelligenceActive ? "text-amber-500" : "text-gray-400"} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Intelligence</span>
                    <button 
                        onClick={() => setIsIntelligenceActive(!isIntelligenceActive)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${isIntelligenceActive ? 'bg-amber-500' : 'bg-gray-300'}`}
                    >
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isIntelligenceActive ? 'translate-x-4' : ''}`} />
                    </button>
                </div>
                <button onClick={() => setShowMatchSelector(true)} className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 border border-indigo-200" title="Selection Criteria"><ListFilter size={20} /></button>
                <button onClick={() => setShowHistoryModal(true)} className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200" title="Load History"><Archive size={20} /></button>
                {mode === 'post_match' && (
                    <button onClick={handleUpdateStars} className="p-2 bg-yellow-100 text-yellow-600 rounded-lg hover:bg-yellow-200" title="Update Match Stars from Daily Live Audit"><Star size={20} /></button>
                )}
                {data && (
                    <>
                        {(mode === 'live' || mode === 'jackpot') && (
                            <button onClick={handleUpdatePredictionResults} className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200" title="Sync Prediction Results with Current Match Status"><CheckCircle2 size={20} /></button>
                        )}
                        <button onClick={handleSaveReport} className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200" title="Save Report to Archive"><Save size={20} /></button>
                        <button onClick={handleResetAnalysis} className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200" title="Reset / New Analysis"><RotateCcw size={20} /></button>
                        <button onClick={() => setShowClearChoiceModal(true)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 flex items-center gap-1" title="Clear Analysis Report">
                            <Trash2 size={20} />
                            <span className="text-xs font-bold hidden sm:inline">Clear</span>
                        </button>
                    </>
                )}
                {/* Only show Run Analysis if NOT in Architect mode, or if architect is reset. 
                    Actually architect mode triggers on mount usually or via button. */}
                {mode !== 'architect' && (
                    <button 
                        onClick={runAnalysis}
                        disabled={loading || (contextInfo.count === 0 && mode !== 'post_match')}
                        className={`flex-1 lg:flex-none px-6 py-2.5 rounded-lg font-bold text-white shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap transform hover:scale-105 active:scale-95
                            ${loading || (contextInfo.count === 0 && mode !== 'post_match') ? 'bg-gray-400 cursor-not-allowed' : mode === 'jackpot' ? 'bg-amber-600 hover:bg-amber-700' : mode === 'post_match' ? 'bg-green-600 hover:bg-green-700' : mode === 'live' ? 'bg-red-600 hover:bg-red-700' : mode === 'self_learn' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-violet-600 hover:bg-violet-700'}
                        `}
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        {loading ? (loadingMessage || 'Gemini is Thinking...') : isIntelligenceActive ? 'Run Intelligence Analysis' : 'Run Standard Analysis'}
                    </button>
                )}
            </div>
        </div>

        {/* Content Area */}
        <div className="p-6 min-h-[400px] bg-gray-50/50 relative">
            {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-50 flex items-center justify-center p-8 text-center">
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-indigo-100 flex flex-col items-center max-w-sm w-full transform animate-in fade-in zoom-in duration-300">
                        <div className="relative mb-6">
                            <div className="w-20 h-20 rounded-full border-4 border-indigo-50 border-t-indigo-600 animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Cpu size={32} className="text-indigo-600 animate-pulse" />
                            </div>
                        </div>
                        <h3 className="text-xl font-black text-gray-900 mb-2 truncate max-w-full">{isIntelligenceActive ? 'Seer Intelligence' : 'Standard Analysis'}</h3>
                        <p className="text-gray-500 font-medium text-sm mb-6">{loadingMessage}</p>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 animate-loading-bar transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.5)]"></div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* System Architect Controls */}
            {mode === 'architect' && (
                <div className="flex gap-4 mb-6">
                    <button 
                        onClick={() => { setShowSystemFormulas(false); if(!data) runAnalysis(); }}
                        className={`px-4 py-2 rounded-lg font-bold text-sm border flex items-center gap-2 transition-all ${!showSystemFormulas ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-300 hover:border-violet-300'}`}
                    >
                        <Sparkles size={16} /> AI Insights
                    </button>
                    <button 
                        onClick={() => setShowSystemFormulas(true)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm border flex items-center gap-2 transition-all ${showSystemFormulas ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'}`}
                    >
                        <BookOpen size={16} /> System Formulas
                    </button>
                </div>
            )}

            {/* SELF LEARN STRATEGY SELECTOR (NEW) */}
            {mode === 'self_learn' && (
                <div className="mb-6 bg-white p-3 rounded-lg border border-teal-200 shadow-sm flex flex-col gap-4">
                    <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-teal-800 text-sm flex items-center gap-2">
                             <GraduationCap size={16} className="text-teal-600"/>
                             Select Learning Strategy
                        </h4>
                        <p className="text-xs text-gray-500">Choose a hypothesis to test against historical data.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSelfLearnStrategy('general')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${selfLearnStrategy === 'general' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-300 hover:border-teal-300'}`}>General Optimization</button>
                        <button onClick={() => setSelfLearnStrategy('value_picks')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'value_picks' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-teal-600 border-teal-200 hover:border-teal-300'}`}><MousePointerClick size={12}/> Value Picks</button>
                        <button onClick={() => setSelfLearnStrategy('value_bets')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'value_bets' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-200 hover:border-blue-300'}`}><DollarSign size={12}/> Value Bets</button>
                        <button onClick={() => setSelfLearnStrategy('upset')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'upset' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-orange-600 border-orange-200 hover:border-orange-300'}`}><Zap size={12}/> Upset Seeker</button>
                        <button onClick={() => setSelfLearnStrategy('banker')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'banker' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-300'}`}><ShieldCheck size={12}/> Banker Optimization</button>
                        <button onClick={() => setSelfLearnStrategy('draw')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'draw' ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}><Divide size={12}/> Draw Seeker</button>
                        <button onClick={() => setSelfLearnStrategy('hedge')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'hedge' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-200 hover:border-blue-300'}`}><ShieldAlert size={12}/> Hedge Seeker</button>
                        <button onClick={() => setSelfLearnStrategy('algo')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'algo' ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-pink-600 border-pink-200 hover:border-pink-300'}`}><Cpu size={12}/> Algo Audit</button>
                        <button onClick={() => setSelfLearnStrategy('pha')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'pha' ? 'bg-cyan-600 text-white border-cyan-600' : 'bg-white text-cyan-600 border-cyan-200 hover:border-cyan-300'}`}><BarChart2 size={12}/> PHA Deep Dive</button>
                        <button onClick={() => setSelfLearnStrategy('jackpot_audit')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'jackpot_audit' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-600 border-amber-200 hover:border-amber-300'}`}><Search size={12}/> Jackpot Audit</button>
                        <button onClick={() => setSelfLearnStrategy('pattern_creator')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'pattern_creator' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:border-indigo-300'}`}><FilePlus size={12}/> Pattern Creator</button>
                        <button onClick={() => setSelfLearnStrategy('points_system')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'points_system' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:border-indigo-300'}`}><Calculator size={12}/> Points System</button>
                        <button onClick={() => setSelfLearnStrategy('match_selector')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'match_selector' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-violet-600 border-violet-200 hover:border-violet-300'}`}><ListFilter size={12}/> Match Selector</button>
                        <button onClick={() => setSelfLearnStrategy('ai_filters')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'ai_filters' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-600 border-rose-200 hover:border-rose-300'}`}><Sparkles size={12}/> AI Filters</button>
                        <button onClick={() => setSelfLearnStrategy('probability_review')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${selfLearnStrategy === 'probability_review' ? 'bg-fuchsia-600 text-white border-fuchsia-600' : 'bg-white text-fuchsia-600 border-fuchsia-200 hover:border-fuchsia-300'}`}><Percent size={12}/> Prob Formula</button>
                    </div>
                </div>
            )}

            {/* POST MATCH PREDICTION SOURCE SELECTOR */}
            {mode === 'post_match' && (
                <div className="flex flex-col gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex-1">
                            <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                 <ArrowRightLeft size={16} className="text-green-600"/>
                                 Prediction Source
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">Select where to load the PREDICTIONS from to compare against current results.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <div className="flex bg-gray-100 rounded p-1">
                                <button 
                                    onClick={() => setPredictionSource('cache')}
                                    className={`px-3 py-1.5 rounded text-xs font-bold ${predictionSource === 'cache' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}
                                >
                                    Current Live Cache
                                </button>
                                <button 
                                    onClick={() => setPredictionSource('archive')}
                                    className={`px-3 py-1.5 rounded text-xs font-bold ${predictionSource === 'archive' ? 'bg-white shadow text-green-700' : 'text-gray-500'}`}
                                >
                                    Load from Archive
                                </button>
                            </div>
                            {predictionSource === 'archive' && (
                                 <select 
                                    value={selectedBaselineArchiveId}
                                    onChange={(e) => setSelectedBaselineArchiveId(e.target.value)}
                                    className="text-xs border border-gray-300 rounded p-1.5 w-full sm:w-64 outline-none focus:border-green-500"
                                 >
                                     <option value="">-- Select Archive File --</option>
                                     {compatibleArchives.map(arch => (
                                         <option key={arch.id} value={arch.id}>
                                             {new Date(arch.date).toLocaleDateString()} - {arch.stats?.totalMatches} Matches
                                             {arch.stats?.jackpotId ? ` (${JACKPOT_OPTIONS.find(j => j.id === arch.stats?.jackpotId)?.name})` : ''}
                                         </option>
                                     ))}
                                 </select>
                            )}
                        </div>
                    </div>
                    
                    {/* Category Tabs */}
                    <div className="flex bg-gray-200 rounded-lg p-1 flex-wrap gap-1">
                        {postMatchMode === 'daily' ? (
                            <>
                                <button onClick={() => setPostMatchCategory('best_bet')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${postMatchCategory === 'best_bet' ? 'bg-white shadow-sm text-amber-700' : 'text-gray-500'}`}>BEST BET</button>
                                <button onClick={() => setPostMatchCategory('top10')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${postMatchCategory === 'top10' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}>TOP 12</button>
                                <button onClick={() => setPostMatchCategory('bankers_dlive')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${postMatchCategory === 'bankers_dlive' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'}`}>BANKERS DLIVE</button>
                                <button onClick={() => setPostMatchCategory('botb_best')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${postMatchCategory === 'botb_best' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}>BOTB</button>
                                <button onClick={() => setPostMatchCategory('top20')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${postMatchCategory === 'top20' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}>TOP 20</button>
                            </>
                        ) : (
                            <button onClick={() => setPostMatchCategory('jackpot_slip')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${postMatchCategory === 'jackpot_slip' ? 'bg-white shadow-sm text-amber-700' : 'text-gray-500'}`}>Jackpot Slip</button>
                        )}
                        <button onClick={() => setPostMatchCategory('bankers_jackpot')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${postMatchCategory === 'bankers_jackpot' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}>Bankers Jackpot</button>
                        <button onClick={() => setPostMatchCategory('value_bets')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${postMatchCategory === 'value_bets' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}>Value Bets</button>
                        <button onClick={() => setPostMatchCategory('value_picks')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${postMatchCategory === 'value_picks' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}>Value Picks</button>
                        <button onClick={() => setPostMatchCategory('banker_draws')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${postMatchCategory === 'banker_draws' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}>Banker Draws</button>
                        <button onClick={() => setPostMatchCategory('upsets')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${postMatchCategory === 'upsets' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}>Upsets</button>
                        {postMatchMode === 'jackpot' && (
                            <button onClick={() => setPostMatchCategory('uncategorized')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${postMatchCategory === 'uncategorized' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500'}`}>Uncategorized</button>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-3 mb-6">
                    <AlertTriangle className="shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                        <h4 className="font-bold">Analysis Failed</h4>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}

            {/* System Formulas View */}
            {mode === 'architect' && showSystemFormulas && (
                <div className="animate-in fade-in duration-300">
                    <SystemFormulasView />
                </div>
            )}

            {/* System Architecture View */}
            {mode === 'system_architecture' && (
                <div className="animate-in fade-in duration-300">
                    <SystemArchitecture trainingSet={matches} fullHistory={fullHistory} />
                </div>
            )}

            {/* Supreme Weightings view removed per product decision. */}


            {/* Supreme Slips View */}
            {mode === 'supreme_slips' && (
                <div className="animate-in fade-in duration-300">
                    <SupremeSlipSelection history={fullHistory || matches} matches={matches} phaStatsMap={phaStatsMap || {}} matchStars={matchStars} />
                </div>
            )}

            {/* Default State (When not showing formulas and no data) */}
            {mode === 'architect' && !showSystemFormulas && !data && !loading && !error && (
                 <div className="h-80 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-xl bg-white">
                    <BrainCircuit size={48} className="opacity-20 text-gray-600 mb-4" />
                    <h3 className="font-bold text-gray-600 text-lg">System Architect</h3>
                    <p className="text-sm text-gray-400 mt-2">
                        Run a deep scan of historical patterns to generate system improvements.
                    </p>
                    <button 
                        onClick={runAnalysis}
                        className="mt-4 px-6 py-2 bg-violet-600 text-white rounded-lg font-bold shadow-sm hover:bg-violet-700"
                    >
                        Run Deep Scan
                    </button>
                </div>
            )}

            {!data && !loading && !error && mode !== 'architect' && mode !== 'system_architecture' && mode !== 'supreme_slips' && (
                <div className="h-80 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-xl bg-white">
                    <BrainCircuit size={48} className="opacity-20 text-gray-600 mb-4" />
                    <h3 className="font-bold text-gray-600 text-lg">Ready to Analyze</h3>
                    <p className="text-sm text-gray-400 mt-2">
                        {mode === 'self_learn' ? 'Generating 20+ Improvement Strategies.' : mode === 'post_match' ? 'Compare previous predictions with live results.' : `Running ${contextInfo.label} Analysis (${contextInfo.count} matches).`}
                    </p>
                </div>
            )}

            {loading && (
                <div className="h-64 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse p-6">
                    <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
                    <div className="space-y-3"><div className="h-4 bg-gray-100 rounded w-full"></div><div className="h-4 bg-gray-100 rounded w-5/6"></div></div>
                </div>
            )}

            {data && !showSystemFormulas && (
                <div className="space-y-8 animate-in fade-in duration-500">
                    
                    {/* Mode Specific Filters (Now enabled for Jackpot too) */}
                    {mode !== 'architect' && mode !== 'self_learn' && mode !== 'post_match' && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            <button onClick={() => setResultsFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${resultsFilter === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>All Results</button>
                            <button onClick={() => setResultsFilter('top_10')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${resultsFilter === 'top_10' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-600 border-green-200 hover:border-green-300'}`}><Star size={12}/> Top 12</button>
                            <button onClick={() => setResultsFilter('top_20')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${resultsFilter === 'top_20' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-200 hover:border-blue-300'}`}><Star size={12}/> Top 20</button>
                            <button onClick={() => setResultsFilter('best_bet')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${resultsFilter === 'best_bet' ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-600 border-amber-200 hover:border-amber-300'}`}><Star size={12}/> Best Bet</button>
                            <button onClick={() => setResultsFilter('botb')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${resultsFilter === 'botb' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-600 border-rose-200 hover:border-rose-300'}`}><Trophy size={12}/> BOTB</button>
                            <button onClick={() => setResultsFilter('bankers_dlive')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${resultsFilter === 'bankers_dlive' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:border-indigo-300'}`}><ShieldCheck size={12}/> Bankers Dlive</button>
                            <button onClick={() => setResultsFilter('bankers_jackpot')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${resultsFilter === 'bankers_jackpot' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-600 border-purple-200 hover:border-purple-300'}`}><ShieldCheck size={12}/> Bankers Jackpot</button>
                            <button onClick={() => setResultsFilter('value')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${resultsFilter === 'value' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-200 hover:border-blue-300'}`}><DollarSign size={12}/> Value Bets</button>
                            <button onClick={() => setResultsFilter('value_picks')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${resultsFilter === 'value_picks' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-teal-600 border-teal-200 hover:border-teal-300'}`}><MousePointerClick size={12}/> Value Picks</button>
                            <button onClick={() => setResultsFilter('banker_draws')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${resultsFilter === 'banker_draws' ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}><Divide size={12}/> Banker Draws</button>
                            <button onClick={() => setResultsFilter('upsets')} className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${resultsFilter === 'upsets' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-orange-600 border-orange-200 hover:border-orange-300'}`}><Zap size={12}/> Upsets</button>
                        </div>
                    )}

                    {/* Specialized Analysis View */}
                    {resultsFilter !== 'all' && renderSpecializedSection(data)}

                    {/* Default View: All Results */}
                    {resultsFilter === 'all' && (
                        <>
                            {/* POST MATCH REPORT - TACTICAL BOARD STYLE */}
                            {mode === 'post_match' && data.performance_report && (
                                <div className="space-y-6">
                                    {/* COMPREHENSIVE CATEGORY AUDITS */}
                                    {(() => {
                                        let aiPicks: Pick[] = [];
                                        if (postMatchCategory === 'top10') aiPicks = data.performance_report.top_10_performance || [];
                                        else if (postMatchCategory === 'best_bet') aiPicks = data.performance_report.best_bet_performance || [];
                                        else if (postMatchCategory === 'bankers_dlive') aiPicks = data.performance_report.bankers_dlive_performance || [];
                                        else if (postMatchCategory === 'botb_best') aiPicks = data.performance_report.botb_best_performance || [];
                                        else if (postMatchCategory === 'top20') aiPicks = data.performance_report.high_confidence_performance || [];
                                        else if (postMatchCategory === 'bankers_jackpot') aiPicks = data.performance_report.bankers_jackpot_performance || [];
                                        else if (postMatchCategory === 'value_bets') aiPicks = data.performance_report.value_performance || [];
                                        else if (postMatchCategory === 'value_picks') aiPicks = data.performance_report.value_picks_performance || [];
                                        else if (postMatchCategory === 'banker_draws') aiPicks = data.performance_report.banker_draws_performance || [];
                                        else if (postMatchCategory === 'upsets') aiPicks = data.performance_report.upsets_performance || [];
                                        else if (postMatchCategory === 'uncategorized') aiPicks = data.performance_report.uncategorized_performance || [];
                                        else if (postMatchCategory === 'jackpot_slip') aiPicks = data.performance_report.jackpot_performance || [];

                                        let slipMetric = {total:0, correct:0, accuracy:'0%'};
                                        if (aiPicks && aiPicks.length > 0) {
                                            const completedPicks = aiPicks.filter(p => p.outcome === 'Correct' || p.outcome === 'Incorrect');
                                            const correctPicks = completedPicks.filter(p => p.outcome === 'Correct');
                                            const total = completedPicks.length;
                                            const correct = correctPicks.length;
                                            const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
                                            slipMetric = { total, correct, accuracy: `${accuracy}%` };
                                        }

                                        const archives = Storage.getPerformanceArchives();
                                        const latestArchive = archives.length > 0 ? archives[0] : null;
                                        
                                        let lookupCategory: string = postMatchCategory || 'all';
                                        if (postMatchCategory === 'bankers_jackpot') {
                                            lookupCategory = postMatchCategory;
                                        }
                                        
                                        const catPerf = latestArchive?.results?.[lookupCategory];

                                        let auditData: any = null;
                                        if (catPerf) {
                                            const priorities: Record<string, any> = {};
                                            if (catPerf.byPriority) {
                                                Object.keys(catPerf.byPriority).forEach(pr => {
                                                    priorities[pr] = {
                                                        overall: { ...catPerf.byPriority[pr], accuracy: `${catPerf.byPriority[pr].accuracy}%` },
                                                        groups: {}
                                                    };
                                                    if (catPerf.byPriorityGroup && catPerf.byPriorityGroup[pr]) {
                                                        Object.keys(catPerf.byPriorityGroup[pr]).forEach(g => {
                                                            priorities[pr].groups[g] = { ...catPerf.byPriorityGroup[pr][g], accuracy: `${catPerf.byPriorityGroup[pr][g].accuracy}%` };
                                                        });
                                                    }
                                                });
                                            }

                                            const groups: Record<number, any> = {};
                                            if (catPerf.byGroup) {
                                                Object.keys(catPerf.byGroup).forEach(g => {
                                                    groups[Number(g)] = { ...catPerf.byGroup[Number(g)], accuracy: `${catPerf.byGroup[Number(g)].accuracy}%` };
                                                });
                                            }

                                            auditData = {
                                                overall: { ...catPerf.overall, accuracy: `${catPerf.overall.accuracy}%` },
                                                slip: { category: 'Slip', ...slipMetric, notes: '' },
                                                priorities: priorities,
                                                groups: groups,
                                                algo: { total: 0, correct: 0, accuracy: '0%' },
                                                algoAlone: catPerf.algoAlone ? { ...catPerf.algoAlone, accuracy: `${catPerf.algoAlone.accuracy}%` } : { total: 0, correct: 0, accuracy: '0%' },
                                                algoAloneByGroup: catPerf.algoAloneByGroup ? {
                                                    1: { ...catPerf.algoAloneByGroup[1], accuracy: `${catPerf.algoAloneByGroup[1]?.accuracy || 0}%` },
                                                    2: { ...catPerf.algoAloneByGroup[2], accuracy: `${catPerf.algoAloneByGroup[2]?.accuracy || 0}%` },
                                                    3: { ...catPerf.algoAloneByGroup[3], accuracy: `${catPerf.algoAloneByGroup[3]?.accuracy || 0}%` }
                                                } : undefined,
                                                algoPha: catPerf.algoPha ? { ...catPerf.algoPha, accuracy: `${catPerf.algoPha.accuracy}%` } : { total: 0, correct: 0, accuracy: '0%' },
                                                algoPhaProb: catPerf.algoPhaProb ? { ...catPerf.algoPhaProb, accuracy: `${catPerf.algoPhaProb.accuracy}%` } : { total: 0, correct: 0, accuracy: '0%' },
                                                algoPhaExt: catPerf.algoPhaExt ? { ...catPerf.algoPhaExt, accuracy: `${catPerf.algoPhaExt.accuracy}%` } : { total: 0, correct: 0, accuracy: '0%' },
                                                subPatt: catPerf.subPatt ? { ...catPerf.subPatt, accuracy: `${catPerf.subPatt.accuracy}%` } : { total: 0, correct: 0, accuracy: '0%' },
                                                algoSub: catPerf.algoSub ? { ...catPerf.algoSub, accuracy: `${catPerf.algoSub.accuracy}%` } : { total: 0, correct: 0, accuracy: '0%' },
                                                algoSubPha: catPerf.algoSubPha ? { ...catPerf.algoSubPha, accuracy: `${catPerf.algoSubPha.accuracy}%` } : { total: 0, correct: 0, accuracy: '0%' }
                                            };
                                        } else if (data.performance_report.tactical_audits && data.performance_report.tactical_audits[postMatchCategory]) {
                                            auditData = { ...data.performance_report.tactical_audits[postMatchCategory] };
                                            auditData.slip = { category: 'Slip', ...slipMetric, notes: '' };
                                        } else if (data.performance_report.tactical_audit) {
                                            auditData = { ...data.performance_report.tactical_audit };
                                            auditData.slip = { category: 'Slip', ...slipMetric, notes: '' };
                                        }

                                        if (auditData) {
                                            return (
                                                <>
                                                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
                                                        <h4 className="font-black text-white text-lg mb-4 flex items-center gap-2 uppercase tracking-wider">
                                                            <Trophy className="text-amber-400" size={20}/> {postMatchCategory.replace('_', ' ')} Tactical Performance Audit
                                                        </h4>
                                                        <div className="grid grid-cols-1 gap-6">
                                                            <TacticalAuditView 
                                                                audit={auditData as any} 
                                                                category={postMatchCategory} 
                                                            />
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* JACKPOT AUDIT GRID */}
                                    {postMatchCategory === 'jackpot_slip' && Array.isArray(data.performance_report.jackpot_performance) && (
                                        <div className="max-w-4xl mx-auto mt-6">
                                            <h4 className="font-bold text-gray-700 text-sm mb-3 uppercase tracking-wider border-b pb-1 flex items-center gap-2">
                                                <Trophy size={16} className="text-amber-500"/> Full Jackpot Slip Review ({data.performance_report.jackpot_performance.length})
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {data.performance_report.jackpot_performance.map((pick, i) => renderPostMatch(pick, getPickStars(pick), true, i))}
                                            </div>
                                        </div>
                                    )}

                                    {/* CATEGORY AUDIT GRIDS */}
                                    {postMatchCategory !== 'jackpot_slip' && (
                                        <div className="max-w-4xl mx-auto mt-6">
                                            <h4 className="font-bold text-gray-700 text-sm mb-3 uppercase tracking-wider border-b pb-1 flex items-center gap-2">
                                                <ListOrdered size={16} className="text-blue-500"/> {postMatchCategory.replace('_', ' ')} Review
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {postMatchCategory === 'best_bet' && data.performance_report.best_bet_performance?.map((pick, i) => renderPostMatch(pick, getPickStars(pick, 'best_bet'), false, i))}
                                                {postMatchCategory === 'top10' && data.performance_report.top_10_performance?.map((pick, i) => renderPostMatch(pick, getPickStars(pick, 'top10'), false, i))}
                                                {postMatchCategory === 'bankers_dlive' && data.performance_report.bankers_dlive_performance?.map((pick, i) => renderPostMatch(pick, getPickStars(pick, 'bankers_dlive'), false, i))}
                                                {postMatchCategory === 'botb_best' && data.performance_report.botb_best_performance?.map((pick, i) => renderPostMatch(pick, getPickStars(pick, 'botb_best'), false, i))}
                                                {postMatchCategory === 'top20' && data.performance_report.high_confidence_performance?.map((pick, i) => renderPostMatch(pick, getPickStars(pick, 'top20'), false, i))}
                                                {postMatchCategory === 'bankers_jackpot' && data.performance_report.bankers_jackpot_performance?.map((pick, i) => renderPostMatch(pick, getPickStars(pick, 'bankers_jackpot'), false, i))}
                                                {postMatchCategory === 'value_bets' && data.performance_report.value_performance?.map((pick, i) => renderPostMatch(pick, getPickStars(pick, 'value_bets'), false, i))}
                                                {postMatchCategory === 'value_picks' && data.performance_report.value_picks_performance?.map((pick, i) => renderPostMatch(pick, getPickStars(pick, 'value_picks'), false, i))}
                                                {postMatchCategory === 'banker_draws' && data.performance_report.banker_draws_performance?.map((pick, i) => renderPostMatch(pick, getPickStars(pick, 'banker_draws'), false, i))}
                                                {postMatchCategory === 'upsets' && data.performance_report.upsets_performance?.map((pick, i) => renderPostMatch(pick, getPickStars(pick, 'upsets'), false, i))}
                                                {postMatchCategory === 'uncategorized' && data.performance_report.uncategorized_performance?.map((pick, i) => renderPostMatch(pick, getPickStars(pick, 'uncategorized'), false, i))}
                                            </div>
                                        </div>
                                    )}

                                     {Array.isArray(data.performance_report.adjustments) && data.performance_report.adjustments.filter(a => !a.category || a.category === postMatchCategory || a.category.includes(postMatchCategory)).length > 0 && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mt-6">
                                            <h4 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2">
                                                <BrainCircuit className="text-indigo-600"/> STRATEGY ROOM: ADJUSTMENTS
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {data.performance_report.adjustments.filter(a => !a.category || a.category === postMatchCategory || a.category.includes(postMatchCategory)).map((insight, idx) => (
                                                    <StrategyItem key={idx} insight={insight} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* STRATEGY ROOM: DETAILED ANALYSIS */}
                                    {(data.detailed_analysis || data.category_analysis) && (
                                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-6 shadow-md">
                                            <div className="bg-slate-800 p-4 text-white flex items-center justify-between">
                                                <h4 className="font-black text-lg flex items-center gap-2 uppercase tracking-tight">
                                                    <FileText className="text-blue-400"/> Strategy Room: Tactical Analysis
                                                </h4>
                                                <div className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-2 py-1 rounded border border-blue-500/30 uppercase">
                                                    Deep Dive Audit
                                                </div>
                                            </div>
                                            
                                            <div className="p-6">
                                                {/* Category specific analysis if available */}
                                                {data.category_analysis && data.category_analysis[postMatchCategory] ? (
                                                    <div className="animate-in fade-in duration-500">
                                                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
                                                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                                            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                                                Detailed Audit: {postMatchCategory.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                        <div className="prose prose-slate max-w-none text-slate-600 markdown-body">
                                                            <ReactMarkdown>{data.category_analysis[postMatchCategory]}</ReactMarkdown>
                                                        </div>
                                                    </div>
                                                ) : (!data.category_analysis && data.detailed_analysis) ? (
                                                    <div className="prose prose-slate max-w-none text-slate-600 markdown-body">
                                                        <ReactMarkdown>{data.detailed_analysis}</ReactMarkdown>
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-12 text-gray-400 italic">
                                                        No detailed analysis available for this category.
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Actionable Footer */}
                                            <div className="bg-gray-50 p-4 border-t border-gray-100 flex items-center gap-3">
                                                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                                    <Lightbulb size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-gray-800">Pro Tip</p>
                                                    <p className="text-[10px] text-gray-500">Use these insights to adjust your selection criteria in the System Architect.</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SELF LEARNING REPORT */}
                            {mode === 'self_learn' && Array.isArray(data.insights) && (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-black text-teal-800 mb-2 flex items-center gap-2 border-l-4 border-teal-500 pl-3 uppercase">
                                        <GraduationCap className="text-teal-600" size={24} />
                                        {selfLearnStrategy === 'value_bets' ? 'Value Bets (High Odds) Strategy' : selfLearnStrategy === 'value_picks' ? 'Value Picks (Decisive) Strategy' : selfLearnStrategy === 'pha' ? 'PHA Deep Dive Analysis' : selfLearnStrategy === 'banker' ? 'Banker Optimization Strategy' : selfLearnStrategy === 'jackpot_audit' ? 'Jackpot Performance Audit' : selfLearnStrategy === 'pattern_creator' ? 'Pattern Creator' : selfLearnStrategy === 'points_system' ? 'Points System Performance Audit' : selfLearnStrategy.replace('_', ' ') + ' Strategy Report'}
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {data.insights.map((insight, idx) => (
                                            <InsightCard key={idx} insight={insight} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* SYSTEM MODE: Insights Grid */}
                            {mode === 'architect' && Array.isArray(data.insights) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {data.insights.map((insight, idx) => (
                                        <InsightCard key={idx} insight={insight} />
                                    ))}
                                </div>
                            )}

                            {/* JACKPOT MODE: NEW TICKET UI */}
                            {mode === 'jackpot' && Array.isArray(data.jackpot_predictions) && (
                                <div className="max-w-3xl mx-auto">
                                    <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-amber-200 relative">
                                        {/* Ticket Header */}
                                        <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-4 text-white text-center relative overflow-hidden">
                                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
                                            <Trophy className="mx-auto mb-1 text-amber-100" size={32} />
                                            <h3 className="text-2xl font-black tracking-tight uppercase">Jackpot Slip</h3>
                                            <p className="text-amber-100 text-xs font-bold tracking-widest opacity-80">AI GENERATED • {new Date().toLocaleDateString()}</p>
                                        </div>
                                        
                                        {/* Ticket Body */}
                                        <div className="bg-amber-50/30 p-4">
                                            <div className="grid grid-cols-1 gap-4">
                                                {data.jackpot_predictions.map((pick, i) => {
                                                    const pName = normalizeTeamName(pick.team);
                                                    
                                                    // Priority 1: Match against the actual Jackpot List used for analysis
                                                    const jackpotMatches = liveSessionMatches?.filter(m => m.isJackpot && m.jackpotIds?.includes(selectedJackpotId)) || [];
                                                    
                                                    let match = jackpotMatches.find(m => {
                                                        const mName = normalizeTeamName(m.teams);
                                                        return mName.includes(pName) || pName.includes(mName);
                                                    });

                                                    // Priority 2: Fallback to any live match
                                                    if (!match) {
                                                        match = liveSessionMatches?.find(m => {
                                                            const mName = normalizeTeamName(m.teams);
                                                            // Loose matching for "Team A vs Team B" vs "Team A"
                                                            return mName.includes(pName) || pName.includes(mName);
                                                        });
                                                    }
                                                    
                                                    if (!match) match = matches.find(m => normalizeTeamName(m.teams).includes(pName) || pName.includes(normalizeTeamName(m.teams)));

                                                    let algoStats = undefined;
                                                    let algoPrediction = undefined;

                                                    if (match) {
                                                        if (match.algoReport) {
                                                            algoStats = formatAlgoStats(match.algoReport.probabilities);
                                                            algoPrediction = match.algoReport.prediction;
                                                        } else {
                                                            const pred = matchAlgorithm.predict(match);
                                                            algoStats = formatAlgoStats(pred.probabilities);
                                                            algoPrediction = pred.prediction;
                                                        }
                                                    }

                                                    return (
                                                        <PickCard 
                                                            key={i} 
                                                            pick={pick} 
                                                            rank={i + 1} 
                                                            type="value"
                                                            algoStats={algoStats}
                                                            algoPrediction={algoPrediction}
                                                            stars={getPickStars(pick)}
                                                            marketOdds={match?.mo}
                                                            matchTags={match?.evaluatorTags}
                                                            isJackpot={true}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Ticket Footer */}
                                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                                            <span>{data.jackpot_predictions.length} Selections</span>
                                            <div className="flex items-center gap-1 font-bold text-amber-600">
                                                <Sparkles size={14}/>
                                                GOOD LUCK
                                            </div>
                                        </div>
                                    </div>

                                    {/* Additional Jackpot Insights */}
                                    {Array.isArray(data.specialized_analysis?.bankers_jackpot) && data.specialized_analysis.bankers_jackpot.length > 0 && (
                                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="bg-white p-4 rounded-lg border-l-4 border-purple-500 shadow-sm">
                                                <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><ShieldCheck size={16} className="text-purple-500"/> Bankers Jackpot</h4>
                                                <ul className="text-sm space-y-1 text-gray-600">
                                                    {data.specialized_analysis.bankers_jackpot.slice(0,5).map((b, i) => (
                                                        <li key={i} className="flex justify-between"><span>{b.team}</span><span className="font-bold">{b.prediction}</span></li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg border-l-4 border-orange-500 shadow-sm">
                                                <h4 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Zap size={16} className="text-orange-500"/> Risk Options</h4>
                                                <ul className="text-sm space-y-1 text-gray-600">
                                                    {Array.isArray(data.specialized_analysis?.upsets) && data.specialized_analysis.upsets.slice(0,5).map((b, i) => (
                                                        <li key={i} className="flex justify-between"><span>{b.team}</span><span className="font-bold">{b.prediction}</span></li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* LIVE MODE: Predictions Lists */}
                            {mode === 'live' && data.live_predictions && (
                                <div className="space-y-8">
                                    {Array.isArray(data.live_predictions.top_10_value) && (
                                        <div>
                                            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 border-l-4 border-green-500 pl-3">
                                                <Target className="text-green-600" size={24} />
                                                TOP 12 VALUE PICKS
                                            </h3>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                                {data.live_predictions.top_10_value.map((pick, i) => {
                                                    const pName = normalizeTeamName(pick.team);
                                                    // Try to find the match in live session or all matches to get details
                                                    let match = liveSessionMatches?.find(m => {
                                                        const mName = normalizeTeamName(m.teams);
                                                        // Loose matching for "Team A vs Team B" vs "Team A"
                                                        return mName.includes(pName) || pName.includes(mName);
                                                    });
                                                    
                                                    if (!match) match = matches.find(m => normalizeTeamName(m.teams).includes(pName) || pName.includes(normalizeTeamName(m.teams)));

                                                    let algoStats = undefined;
                                                    let algoPrediction = undefined;
                                                    if (match) {
                                                        if (match.algoReport) {
                                                            algoStats = formatAlgoStats(match.algoReport.probabilities);
                                                            algoPrediction = match.algoReport.prediction;
                                                        } else {
                                                            const pred = matchAlgorithm.predict(match);
                                                            algoStats = formatAlgoStats(pred.probabilities);
                                                            algoPrediction = pred.prediction;
                                                        }
                                                    }

                                                    return <PickCard key={i} pick={pick} rank={i + 1} type="value" algoStats={algoStats} algoPrediction={algoPrediction} stars={getPickStars(pick)} marketOdds={match?.mo} matchTags={match?.evaluatorTags} />;
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* BOTB Section */}
                                    {Array.isArray(data.live_predictions.botb_best) && data.live_predictions.botb_best.length > 0 && (
                                        <div>
                                            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 border-l-4 border-blue-500 pl-3">
                                                <Target className="text-blue-600" size={24} />
                                                BOTB (BEST OF THE BEST)
                                            </h3>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                                {data.live_predictions.botb_best.map((pick, i) => {
                                                    const pName = normalizeTeamName(pick.team);
                                                    let match = liveSessionMatches?.find(m => {
                                                        const mName = normalizeTeamName(m.teams);
                                                        return mName.includes(pName) || pName.includes(mName);
                                                    });
                                                    if (!match) match = matches.find(m => normalizeTeamName(m.teams).includes(pName) || pName.includes(normalizeTeamName(m.teams)));

                                                    let algoStats = undefined;
                                                    let algoPrediction = undefined;
                                                    if (match) {
                                                        if (match.algoReport) {
                                                            algoStats = formatAlgoStats(match.algoReport.probabilities);
                                                            algoPrediction = match.algoReport.prediction;
                                                        } else {
                                                            const pred = matchAlgorithm.predict(match);
                                                            algoStats = formatAlgoStats(pred.probabilities);
                                                            algoPrediction = pred.prediction;
                                                        }
                                                    }

                                                    return <PickCard key={i} pick={pick} rank={i + 1} type={pick.prediction.length > 1 ? "value" : "standard"} algoStats={algoStats} algoPrediction={algoPrediction} stars={getPickStars(pick)} marketOdds={match?.mo} matchTags={match?.evaluatorTags} />;
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* High Confidence */}
                                    {Array.isArray(data.live_predictions.high_confidence) && (
                                        <div>
                                            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 border-l-4 border-purple-500 pl-3">
                                                <Medal className="text-purple-600" size={24} />
                                                TOP 20 HIGH CONFIDENCE
                                            </h3>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                                {data.live_predictions.high_confidence.map((pick, i) => {
                                                    const pName = normalizeTeamName(pick.team);
                                                    let match = liveSessionMatches?.find(m => {
                                                        const mName = normalizeTeamName(m.teams);
                                                        return mName.includes(pName) || pName.includes(mName);
                                                    });
                                                    if (!match) match = matches.find(m => normalizeTeamName(m.teams).includes(pName) || pName.includes(normalizeTeamName(m.teams)));

                                                    let algoStats = undefined;
                                                    let algoPrediction = undefined;
                                                    if (match) {
                                                        if (match.algoReport) {
                                                            algoStats = formatAlgoStats(match.algoReport.probabilities);
                                                            algoPrediction = match.algoReport.prediction;
                                                        } else {
                                                            const pred = matchAlgorithm.predict(match);
                                                            algoStats = formatAlgoStats(pred.probabilities);
                                                            algoPrediction = pred.prediction;
                                                        }
                                                    }

                                                    return <PickCard key={i} pick={pick} type="confidence" algoStats={algoStats} algoPrediction={algoPrediction} stars={getPickStars(pick)} marketOdds={match?.mo} matchTags={match?.evaluatorTags} />;
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>

        {/* --- MODAL: MATCH CRITERIA --- */}
        <MatchSelector isOpen={showMatchSelector} onClose={() => setShowMatchSelector(false)} />

        <SeerIntelligencePanel />

        {/* --- MODAL: MATCH STARS UPDATE --- */}
        {showMatchStarsModal && (postMatchDailyData || aiHistory.find(h => h.mode === 'post_match_daily')?.data) && (
            <MatchStarsUpdateModal 
                onClose={() => setShowMatchStarsModal(false)} 
                latestDailyData={postMatchDailyData || aiHistory.find(h => h.mode === 'post_match_daily')!.data} 
            />
        )}

        {/* --- MODAL: HISTORY --- */}
        {showHistoryModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Archive className="text-gray-500" size={20}/> Saved Analysis Reports
                        </h3>
                        <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
                    </div>
                    <div className="overflow-y-auto p-2 space-y-2 flex-1">
                        {aiHistory.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">No saved reports found.</div>
                        ) : (
                            aiHistory.map(entry => (
                                <div key={entry.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow flex justify-between items-center group">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-white ${entry.mode === 'live' ? 'bg-red-500' : entry.mode === 'jackpot' ? 'bg-amber-500' : entry.mode === 'self_learn' ? 'bg-teal-500' : 'bg-indigo-500'}`}>
                                                {entry.mode.replace('_', ' ')}
                                            </span>
                                            <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                                <Clock size={12}/> {new Date(entry.date).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {entry.stats?.totalMatches || 0} Matches Analyzed
                                            {entry.stats?.jackpotId && <span className="ml-1 text-amber-600 font-bold">({JACKPOT_OPTIONS.find(j => j.id === entry.stats?.jackpotId)?.name || 'Jackpot'})</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleLoadHistory(entry)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded text-xs font-bold hover:bg-indigo-100">Load</button>
                                        <button onClick={() => handleDeleteHistory(entry.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* --- MODAL: CLEAR SAFEGUARD --- */}
        {showClearChoiceModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm border-l-4 border-amber-500">
                    <h3 className="font-bold text-lg mb-2 text-gray-800 flex items-center gap-2">
                        <AlertTriangle className="text-amber-500" size={24} />
                        Clear Current Report?
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                        This will clear the current analysis view. Make sure you have saved important insights to History.
                    </p>
                    <div className="flex flex-col gap-2">
                        <button onClick={() => { handleSaveReport(); handleResetAnalysis(); setShowClearChoiceModal(false); }} className="w-full py-3 bg-emerald-600 text-white rounded font-bold text-sm shadow-sm hover:bg-emerald-700 flex items-center justify-center gap-2">
                            <Save size={16}/> Save & Clear
                        </button>
                        <button onClick={() => { handleResetAnalysis(); setShowClearChoiceModal(false); }} className="w-full py-3 bg-red-600 text-white rounded font-bold text-sm shadow-sm hover:bg-red-700 flex items-center justify-center gap-2">
                            <Trash2 size={16}/> Clear Without Saving
                        </button>
                        <button onClick={() => setShowClearChoiceModal(false)} className="w-full py-3 bg-gray-100 text-gray-600 rounded font-bold text-sm hover:bg-gray-200 border border-gray-200">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}

    </div>
  );
}