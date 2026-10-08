import { Match } from '../types';
import { predictWithSeer, predictSeerDetailed, DEFAULT_WEIGHTS, getMatchScore, CategoryWeights } from './seerLogic';
import { getMatchEvaluatorTags, getMatchPriorityScore, getMatchStats } from './matchEvaluator';
import { getOptimalHedge } from './volatilityEngine';
import { generateSeerUnderdogSlips } from './seerUnderdogSlipSelection';
import { Pick } from '../components/ai/GeminiCards';
import { getSeerWeights } from '../services/storage';
import { getMatchSupremeTier, getMatchSupremeTierUnderdog, calculateSupremeRules } from './seerSupremeTier';
import { calculatePAAPrediction } from './matchProcessing';
import { getOptimizedScore, getOptimizedScoreDetailed, applyHedgingProtocol } from './optimizedweights';
import { isBannedFromSeerSlips } from './leagueFilters';

const getSeerScoreForPrediction = (m: Match, pred: string, weights: CategoryWeights, phaStatsMap: Record<string, any>, matchStars: Record<string, number>) => {
    let s1 = pred.includes('1') ? getMatchScore(m, '1', weights, phaStatsMap, matchStars) : 0;
    let sx = pred.includes('X') ? getMatchScore(m, 'X', weights, phaStatsMap, matchStars) : 0;
    let s2 = pred.includes('2') ? getMatchScore(m, '2', weights, phaStatsMap, matchStars) : 0;
    return Math.max(s1, sx, s2);
};


export const getPAAPredictionForSeer = (m: Match, phaStatsMap: Record<string, any>): { paaPrimary: string, paaFinal: string } => {
  let paaPrim = m.paaPrimaryPrediction || "";
  let paaFinal = m.paaPrediction || "";
  if (m.patternAnalysis?.subPattern && phaStatsMap) {
    const sub = m.patternAnalysis.subPattern;
    if (phaStatsMap[sub] && (phaStatsMap[sub].paaTotal > 0 || phaStatsMap[sub].total > 0)) {
      const p = calculatePAAPrediction(m, phaStatsMap[sub]);
      if (p) {
        paaPrim = p.paaPrimaryPrediction || "";
        paaFinal = p.paaPrediction || "";
      }
    }
  }
  return { paaPrimary: paaPrim, paaFinal: paaFinal };
};

export const generateSeerAiCognitiveSlips = (
    targetMatches: Match[], 
    phaStatsMap: Record<string, any>, 
    matchStars: Record<string, number>, 
    isJackpot: boolean,
    isIntelligenceActive: boolean = false,
    overrideWeights?: Record<string, CategoryWeights>
) => {
    targetMatches = targetMatches.filter(m => !!m);

    const preCalculatedRules = calculateSupremeRules(phaStatsMap);

    const spec: any = {
        jackpot_slip: [],
        bankers_jackpot: [],
        bankers_dlive: [],
        value_bets: [],
        value_picks: [],
        banker_draws: [],
        upsets: [],
        unallocated: [],
        uncategorized: []
    };

    const candidates: Record<string, Match[]> = {};

    const live: any = {
        best_bet: [],
        top_10_value: [],
        high_confidence: [],
        botb_best: []
    };

    const usageCount = new Map<string, number>(); 
    const matchTagsMap = new Map<string, string[]>();
    const seerWeights = overrideWeights || getSeerWeights();
    const modePrefix = isJackpot ? 'jackpot_' : 'daily_';

    const getWeights = (cat: string) => {
        let mappedParent = cat;
        if (cat === 'best_bet' || cat === 'high_confidence' || cat === 'botb_best') {
            mappedParent = 'safety';
        } else if (cat === 'bankers_dlive' || cat === 'bankers_jackpot' || cat === 'value_picks' || cat === 'banker_draws') {
            mappedParent = 'banker';
        } else if (cat === 'upsets' || cat === 'value_bets') {
            mappedParent = 'upset';
        } else if (cat === 'top_10_value') {
            mappedParent = 'jackpot';
        }

        return (
            seerWeights[`${modePrefix}${cat}`] || 
            seerWeights[cat] || 
            seerWeights[`${modePrefix}${mappedParent}`] || 
            seerWeights[mappedParent] || 
            seerWeights[`${modePrefix}all`] || 
            seerWeights["all"] || 
            DEFAULT_WEIGHTS
        ) as CategoryWeights;
    };

    const getUpsetPriority = (m: Match, tags: string[]): number => {
        const stats = getMatchStats(m, phaStatsMap);
        const moUnderdog = stats.moUnderdog;

        const weightsAll = getWeights('all');
        const cardSeerDetailed = predictSeerDetailed(m, weightsAll, phaStatsMap, matchStars, 'all');
        const seerPrimary = cardSeerDetailed.primary;
        const seerFinal = cardSeerDetailed.final;

        const { paaPrimary, paaFinal } = getPAAPredictionForSeer(m, phaStatsMap);

        const isPriority1 = (seerPrimary === moUnderdog);
        const isPriority2 = (paaPrimary === moUnderdog);

        // Volatile PHA Tie is effectively an upset priority 4 because of the volatility noted by user
        if (tags.includes('VOLATILE:PHA_TIE')) return 4;

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

    const getAgreementBoost = (m: Match, catId: string): number => {
        let boost = 0;
        const weights = getWeights(catId);
        const stats = getMatchStats(m, phaStatsMap);
        const moFav = stats.moFav as '1'|'2';
        
        const probFav = stats.probFav;
        const paaSW = stats.phaFavWinSupport || 0;

        // Retrieve the baseline Match Card's pre-computed properties, falling back to predictable defaults if not loaded yet
        let seerScoreFav = 0;
        if (m.seerScores && m.seerScores[moFav as '1'|'2'] !== undefined) {
            seerScoreFav = m.seerScores[moFav as '1'|'2'];
        } else {
            const baseSeer = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars);
            seerScoreFav = baseSeer.scores[moFav as '1'|'2'] || 0;
        }

        // 1. Significant difference between highest probability and second highest
        const probs = m.algoReport?.probabilities;
        if (probs) {
            const probArray = [probs['1'] || 0, probs['X'] || 0, probs['2'] || 0].sort((a,b) => b-a);
            const probGap = (probArray[0] - (probArray[1] || 0)) * 100;
            const outcomeProb = (probs[moFav as keyof typeof probs] || 0) * 100;
            
            if (probGap >= 25 && outcomeProb >= (probArray[0] * 100)) {
                boost += weights.synergyGapBoost ?? 250; 
            }
        }

        // 2. Observations and combinations using the actual match-card base prediction results
        const isA = seerScoreFav >= 50 && probFav >= 45 && paaSW >= 50;
        const isB = seerScoreFav >= 50 && probFav >= 45 && !isA;
        const isC = probFav >= 50 && paaSW >= 50 && !isA && !isB;
        const isD = seerScoreFav >= 50 && paaSW >= 50 && !isA && !isB && !isC;
        const isE = seerScoreFav >= 45 && probFav >= 45 && paaSW >= 45 && !isA && !isB && !isC && !isD;

        if (isA) {
            boost += weights.synergyCondA ?? 300; // Condition A
        } else if (isB) {
            boost += weights.synergyCondB ?? 200; // Condition B
        } else if (isC) {
            boost += weights.synergyCondC ?? 200; // Condition C
        } else if (isD) {
            boost += weights.synergyCondD ?? 200; // Condition D
        } else if (isE) {
            boost += weights.synergyCondE ?? 200; // Condition E
        }

        const paaPredObj = getPAAPredictionForSeer(m, phaStatsMap);
        const paaPred = paaPredObj.paaFinal || paaPredObj.paaPrimary || "";
        if (paaPred === "1X" || paaPred === "X2") {
            boost += 150; 
        } else if (paaPred === "12") {
            boost -= 50;
        }

        return boost;
    };

    targetMatches.forEach(m => {
        // ALWAYS evaluate dynamically for slip generation so it exactly matches the Live Analysis UI pool
        // This ensures matches are not filtered out by strict backend constraints that the UI relaxes
        const tags = getMatchEvaluatorTags(m, phaStatsMap, isJackpot, true, matchStars);
        matchTagsMap.set(m.id.toString(), tags);
    });

    const getOdds = (m: Match) => {
        let o1 = 0, oX = 0, o2 = 0;
        if (m.mo) {
            const parts = m.mo.split(/[- ,]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
            if (parts.length >= 3) {
                o1 = parts[0];
                oX = parts[1];
                o2 = parts[2];
            }
        }
        const favOdds = o1 > 0 && o2 > 0 ? Math.min(o1, o2) : (o1 || o2);
        const underdogOdds = o1 > 0 && o2 > 0 ? Math.max(o1, o2) : 0;
        return { o1, oX, o2, favOdds, underdogOdds };
    };

    const getGatekeeperPriorityBoost = (m: Match, catId: string): number => {
        // Only apply to favorite/safe categories
        const isFavoriteCategory = ['best_bet', 'top_10_value', 'high_confidence', 'botb_best', 'bankers_dlive', 'bankers_jackpot', 'value_picks'].includes(catId);
        if (!isFavoriteCategory) return 0;

        let boost = 0;
        const sub = m.patternAnalysis?.subPattern;
        const s = sub ? phaStatsMap[sub] : null;

        const paaPredObj = getPAAPredictionForSeer(m, phaStatsMap);
              const paaPred = paaPredObj.paaFinal || paaPredObj.paaPrimary || '';
        const subPred = m.patternAnalysis?.subPatternPrediction || '';
        const algoPred = m.algoReport?.prediction || '';

        const isSubPaaAgree = !!subPred && !!paaPred && subPred === paaPred;
        const isPaaAlgoAgree = !!paaPred && !!algoPred && paaPred === algoPred;

        let favSupport = 0;
        let upsetRate = 1.0;
        if (s && s.paaTotal > 0) {
            favSupport = s.favWin / s.paaTotal;
            upsetRate = s.upsetWin / s.paaTotal;
        } else {
            // Fallback to match stats
            const stats = getMatchStats(m, phaStatsMap);
            favSupport = (stats.paaStats.favWinRate ?? 0) / 100;
            upsetRate = (stats.paaStats.upsetRate ?? 100) / 100;
        }

        // Gatekeeper Options Based on Research Data (A TO C):
        // Option A (Ultra-Safe): (Sub/PAA or PAA/Algo Agreement) AND PHA Fav Support >= 80% AND Upset Rate <= 10%
        if ((isSubPaaAgree || isPaaAlgoAgree) && favSupport >= 0.80 && upsetRate <= 0.10) {
            boost += 3000;
        } 
        // Option B (High Support): (Sub/PAA or PAA/Algo Agreement) AND PHA Fav Support >= 75% AND Upset Rate <= 10%
        else if ((isSubPaaAgree || isPaaAlgoAgree) && favSupport >= 0.75 && upsetRate <= 0.10) {
            boost += 2000;
        }
        // Option C (Massive PAA Support): PHA Fav Support >= 80% AND Upset Rate <= 10%
        else if (favSupport >= 0.80 && upsetRate <= 0.10) {
            boost += 1000;
        }
        // Option D (Hedged Safety Profile): Combined Support >= 75% AND Upset Rate <= 25%
        else {
            const drawSupport = (s && s.paaTotal > 0) ? (s.draw / s.paaTotal) : ((getMatchStats(m, phaStatsMap).paaStats.drawRate ?? 0) / 100);
            if ((isSubPaaAgree || isPaaAlgoAgree) && (favSupport + drawSupport >= 0.75) && upsetRate <= 0.25) {
                boost += 1500;
            }
        }

        return boost;
    };

    const globalJackpotDecisions = new Map<string, { finalPred: string, livePredPrimary: string, livePredFinal: string, reason: string, confScore: number }>();

    if (isJackpot) {
        // JACKPOT MODE: Global 50% hedged and 50% unhedged determination
        const scoredMatches = targetMatches.map(m => {
            const weights = getWeights("all");
            let livePredFinal = m.seerPrediction || predictWithSeer(m, weights, phaStatsMap, matchStars, 'all');
            let livePredPrimary = m.seerPrimaryPrediction;
            
            const p1 = getMatchScore(m, '1', weights, phaStatsMap, matchStars);
            const pX = getMatchScore(m, 'X', weights, phaStatsMap, matchStars);
            const p2 = getMatchScore(m, '2', weights, phaStatsMap, matchStars);

            if (!livePredPrimary) {
                 const max = Math.max(p1, pX, p2);
                 livePredPrimary = p1 === max ? '1' : (pX === max ? 'X' : '2');
            }

            // JACKPOT OVERRIDE: No straight X
            if (livePredPrimary === 'X') {
                // If seer prim is X and fin X2, then let the algorithm select 2 for a straight win
                if (livePredFinal.includes('2')) livePredPrimary = '2';
                else if (livePredFinal.includes('1')) livePredPrimary = '1';
                else livePredPrimary = p1 >= p2 ? '1' : '2';
            }

            // Ensure livePredFinal is not just "X" for Jackpot
            if (livePredFinal === 'X') {
                livePredFinal = p1 >= p2 ? '1X' : 'X2';
            }
            
            const scores = [p1, pX, p2].sort((a, b) => b - a);
            let confScore = scores[0] - (scores[1] || 0);

            // Jackpot Update: Prioritize matches with draw probability > 25% for hedging
            // We decrease the confScore for these matches to push them into the hedged group (2nd half of sorted list)
            const probX = m.algoReport?.probabilities?.['X'] || 0;
            if (probX > 25) {
                // Heavier penalty for higher draw probability to ensure hedging priority
                confScore -= (probX * 1.5); 
            }
            
            return { m, confScore, livePredPrimary, livePredFinal };
        });

        scoredMatches.sort((a, b) => b.confScore - a.confScore);
        const unhedgedCount = Math.floor(scoredMatches.length / 2);

        scoredMatches.forEach((item, index) => {
            const isUnhedged = index < unhedgedCount;
            const finalPred = isUnhedged ? item.livePredPrimary : item.livePredFinal;
            const reason = isUnhedged ? "High confidence - Unhedged" : "Volatile - Hedged to maximize accuracy";
            
            globalJackpotDecisions.set(item.m.id.toString(), {
                finalPred,
                livePredPrimary: item.livePredPrimary,
                livePredFinal: item.livePredFinal,
                reason,
                confScore: item.confScore * 2
            });
        });
    }

    const buildPick = (m: Match, cat: string, reasonDetails: string, forcedHedge: boolean = false): Pick => {
        const weights = getWeights(cat);
        let seerPred = predictWithSeer(m, weights, phaStatsMap, matchStars, cat);
        const detailed = predictSeerDetailed(m, weights, phaStatsMap, matchStars, cat);
        let primaryPred = detailed.primary;
        let score = getSeerScoreForPrediction(m, seerPred, weights, phaStatsMap, matchStars);
        let reason = `Seer (${score.toFixed(1)}): ${reasonDetails}`;
        const tags = matchTagsMap.get(m.id.toString()) || [];
        let optDetail: any = null;

        if (isJackpot) {
            const decision = globalJackpotDecisions.get(m.id.toString());
            if (decision) {
                seerPred = decision.finalPred;
                primaryPred = decision.livePredPrimary; 
                score = decision.confScore;
                reason = `Seer Algo: ${decision.reason} | ${reasonDetails}`;
            }
        } else {
            // Force hedge/unhedge based on category rules (Live Mode Only)
            if (forcedHedge) {
                if (seerPred === 'X') {
                    // If it's a draw, hedge with the stronger side
                    seerPred = detailed.percentages['1'] >= detailed.percentages['2'] ? '1X' : 'X2';
                } else {
                    // Intelligent Hedging: 1X/X2 vs 12 using Volatility Engine
                    seerPred = getOptimalHedge(m, phaStatsMap);
                }
            } else if (forcedHedge === false) { // Explicitly false means no hedge
                if (seerPred.length > 1) {
                    const stats = getMatchStats(m, phaStatsMap);
                    // For unhedging, pick the favorite or the first part
                    seerPred = stats.moFav || (seerPred.includes('1') ? '1' : (seerPred.includes('2') ? '2' : 'X'));
                }
            }
            primaryPred = seerPred;
            
            // Final override protocol for category specific hedges
            const rawSeerPred = seerPred;
            optDetail = phaStatsMap ? getOptimizedScoreDetailed(m, cat, phaStatsMap) : null;
            if (optDetail?.activeHedgingProtocol) {
                seerPred = optDetail.optimizedPrediction;
                reason = `HPR: Hedging Protocol Override (${seerPred}) | ${reasonDetails}`;
            } else {
                seerPred = applyHedgingProtocol(m, seerPred, cat, phaStatsMap);
                if (cat === 'top_10_value' && seerPred !== rawSeerPred) {
                    reason = `HPR: Hedging Protocol Override (${seerPred}) | ${reasonDetails}`;
                }
            }
        }

        if (cat === 'banker_draws') {
            primaryPred = 'X';
            seerPred = detailed.percentages['1'] >= detailed.percentages['2'] ? '1X' : 'X2';
            reason = `Banker Draw Hedged (${score.toFixed(1)}): ${seerPred} | ${reasonDetails}`;
        }

        if (cat === 'upsets') {
            const stats = getMatchStats(m, phaStatsMap);
            const moUnderdog = stats.moUnderdog;
            
            // Straight underdog win required (not draw or Mfav)
            seerPred = moUnderdog;
            primaryPred = moUnderdog;
            reason = `Upset Pure Underdog (${score.toFixed(1)}): Underdog is ${moUnderdog} | ${reasonDetails}`;
        }

        // --- UCS HEDGE CORRECTION ---
        // If a UCS match ends up in a safe/favorite category as a filler, ensure it is
        // always hedged with a double-chance that covers the draw (not 12, not straight underdog).
        // If an explicit active hedging protocol is already present, do not override it.
        const safeCategories = ['best_bet', 'top_10_value', 'top10', 'high_confidence', 'botb_best', 'bankers_dlive', 'bankers_jackpot', 'value_picks', 'top20'];
        if (!optDetail?.activeHedgingProtocol && safeCategories.includes(cat)) {
            const stats = getMatchStats(m, phaStatsMap);
            const algoPrim = m.algoReport?.prediction?.split('')[0] || '';
            const subPatPrim = m.patternAnalysis?.primaryPrediction || '';
            const paaPrim = m.paaPrimaryPrediction || '';
            const mlFavProbLocal = stats.probFav;

            let uVotes = 0;
            if (algoPrim === stats.moUnderdog) uVotes++;
            if (subPatPrim === stats.moUnderdog) uVotes++;
            if (paaPrim === stats.moUnderdog) uVotes++;
            const isUCS = uVotes >= 2 || (mlFavProbLocal < 40 && uVotes >= 1);

            if (isUCS) {
                // Force it to a double-chance covering Fav+Draw, NOT underdog-oriented
                // This protects the bettor if we had no better match available
                seerPred = stats.moFav === '1' ? '1X' : 'X2';
                primaryPred = stats.moFav;
                reason = `[UCS-Hedged] ${reason} — Forced 1X/X2 due to underdog consensus`;
            }
        }

        // Pivot check: previously default overrode optimized if contradicted. Now reversed: optimized overrides default.
        const defaultAnalysisPred = m.seerPrediction || predictWithSeer(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars, 'all');
        const hasIntersection = (p1: string, p2: string): boolean => {
            for (const char of p1) {
                if (char !== ' ' && p2.includes(char)) return true;
            }
            return false;
        };

        if (!hasIntersection(seerPred, defaultAnalysisPred)) {
            const original = defaultAnalysisPred;
            reason = `[Pivot Reversed: Optimized ${seerPred} overrides Default ${original}] ${reason}`;
        }

        const isHprOverride = cat === 'top_10_value' && (reason.includes('HPR:') || !!optDetail?.activeHedgingProtocol);

        return {
            match_id: m.id,
            team: m.teams,
            prediction: seerPred,
            primaryPrediction: primaryPred,
            odds: m.mo?.split(',')[0] || '1.0',
            reason: reason,
            confidence: isJackpot ? `${Math.min(99, Math.max(0, 50 + score))}%` : `${Math.min(99, Math.max(0, score))}%`,
            category: cat,
            tag_trace: tags.join(', '),
            le: m.le || '',
            l10: m.l10 || '',
            rating: m.rating || '',
            isHprOverride
        };
    };

    // Category Processing Config for Live Mode
    const categories = [
        { id: 'best_bet', tag: 'best_bet', size: 10, hedgedSize: 0, 
          filter: (m: Match) => { 
              const o = getOdds(m);
              return o.favOdds >= 1.3 && o.favOdds <= 1.6;
          } },
        
        { id: 'bankers_dlive', tag: 'bankers_dlive', size: 10, hedgedSize: 0,
          filter: (m: Match) => { const o = getOdds(m); return o.favOdds >= 1.5 && o.favOdds <= 1.99; } },
        
        { id: 'top_10_value', tag: 'top10', size: 12, hedgedSize: 12, 
          filter: (m: Match) => {
              const o = getOdds(m);
              return o.favOdds >= 2.0 && o.favOdds <= 2.5;
          } },
        
        { id: 'botb_best', tag: 'botb_best', size: 10, hedgedSize: 5,
          filter: (m: Match) => { 
              const o = getOdds(m); 
              return o.favOdds >= 1.5 && o.favOdds <= 2.49; 
          } },

        { id: 'high_confidence', tag: 'top20', size: 20, hedgedSize: 10, 
          filter: (m: Match) => { 
                const o = getOdds(m); 
                return o.favOdds >= 1.5 && o.favOdds <= 2.49; 
          } },

        { id: 'bankers_jackpot', tag: 'bankers_jackpot', size: 5, hedgedSize: 0,
          filter: (m: Match) => { const o = getOdds(m); return o.favOdds >= 1.8 && o.favOdds <= 2.0; } },
        
        { id: 'value_bets', tag: 'value_bets', size: 5, hedgedSize: 5,
          filter: (m: Match) => { const o = getOdds(m); return o.o1 >= 2.5 && o.o2 >= 2.5; } },
        
        { id: 'value_picks', tag: 'value_picks', size: 5, hedgedSize: 0,
          filter: (m: Match) => { const o = getOdds(m); return o.favOdds >= 2.0 && o.favOdds <= 2.49; } },
        
        { id: 'banker_draws', tag: 'banker_draws', size: 5, hedgedSize: 5,
          filter: (m: Match) => { const o = getOdds(m); return o.o1 >= 2.0 && o.o2 >= 2.0; } },
        
        { id: 'upsets', tag: 'upsets', size: 5, hedgedSize: 0,
          filter: (m: Match) => true }
    ];

    const processedCategories = isJackpot 
        ? categories.filter(c => !['best_bet', 'top_10_value', 'botb_best', 'high_confidence'].includes(c.id))
        : categories.slice().sort((a, b) => {
            // Force top_10_value to be processed first so it is never restricted by cross-slip sharing limits
            if (a.id === 'top_10_value') return -1;
            if (b.id === 'top_10_value') return 1;
            return 0;
        });

    processedCategories.forEach(catDef => {
        const tagPrefix = catDef.tag;
        const qualifyingMatches = targetMatches.filter(m => {
            const tags = matchTagsMap.get(m.id.toString()) || [];
            
            // Primary check: specific tag
            const hasPrimaryTag = tags.some(t => t.startsWith(tagPrefix + ':'));
            
            // All category slips must have the category specific evaluator tags
            if (!hasPrimaryTag && !['top_10_value', 'value_picks'].includes(catDef.id)) return false;

            // Strict Ban: Pattern T sub patterns are banned from all slip categories
            // Deprioritized instead of banned
            
            // Ban African country local league matches from selection to categories that require market favorite to win
            // Deprioritized instead of banned

            // --- Banned Match Slip Filtering Logic (Applies to all Live Analyst EXCEPT Jackpot) ---
            // Deprioritized instead of banned

            return true;
        }).filter(m => catDef.filter(m));

        candidates[catDef.id] = [...qualifyingMatches];

        const getDefaultSeerPenalty = (m: Match, catId: string): number => {
            let penalty = 0;
            const tags = matchTagsMap.get(m.id.toString()) || [];
            
            // Penalize Pattern T sub patterns
            const isPatternTSub = (m.patternAnalysis?.mainPattern || '').toUpperCase() === 'T' && !!m.patternAnalysis?.subPattern;
            if (isPatternTSub) penalty -= 200;

            // Penalize African country local league matches for favorite categories
            const isFavoriteCategory = ['best_bet', 'top_10_value', 'high_confidence', 'botb_best', 'bankers_dlive', 'bankers_jackpot', 'value_picks'].includes(catId);
            if (isFavoriteCategory) {
                const teams = (m.teams || '').toLowerCase();
                const league = (m.league || '').toLowerCase();
                const africanDomesticRegex = /tanzania|tanzanian|kenya|kenyan|uganda|ugandan|rwanda|rwandan|egypt|egyptian|morocco|moroccan|nigeria|nigerian|ghana|ghanaian|south africa|south african|zambia|zambian|senegal|senegalese|tunisia|tunisian|algeria|algerian|mali|cameroon|cameroonian|congo|angola|angolan|burundi|sudan|sudanese|somalia|ethiopia|ethiopian|suhul shire|caps united|triangle u|malawi|mozambique|botswana|namibia|zimbabwe|zimbabwean|lesotho|eswatini|madagascar|ivory coast|cote d'ivoire|guinea|burkina faso|benin|togo|mauritania|niger|chad|central african|gabon|equatorial|djibouti|eritrea|seychelles|comoros|mauritius|sao tome|sierra leone|liberia|gambia|cape verde|chemilil|sony sugar|jkt/i;
                if (africanDomesticRegex.test(teams) || africanDomesticRegex.test(league)) {
                    penalty -= 150;
                }
            }

            // Severe Deprioritization for risky matches in top slips
            if (['top_10_value', 'best_bet', 'bankers_dlive'].includes(catId)) {
                const stats = getMatchStats(m, phaStatsMap);
                const sDraw = m.seerPercentages ? Math.round(m.seerPercentages['X'] || 0) : 0;
                
                // If the underdog odds are too low, or there's a huge seer draw trap
                if (stats.underdogOdds <= 3.0 || sDraw > 30) {
                    penalty -= 2000;
                    (m as any).isLastResortRisk = true;
                }
            }

            if (catId === 'top_10_value') {
                const stats = getMatchStats(m, phaStatsMap);
                const upsetRate = stats.paaStats?.upsetRate || 0;
                const favSupport = stats.phaFavSupport || 0;
                const underdogOdds = stats.underdogOdds;
                const totalPaaMatches = stats.paaStats?.total || stats.totalMatches || 0;

                // Statistical Support
                penalty += favSupport * 4;

                // 1. Low sample size penalty
                if (totalPaaMatches <= 5) {
                    penalty -= 1500;
                }

                // 2. Strict Mathematical Filters
                if (favSupport < 55) penalty -= 2000;
                if (upsetRate >= 20) penalty -= 1000;
                if (underdogOdds <= 3.20 && upsetRate >= 25) penalty -= 2000;

                // 3. Proximity / Underdog Odds Distance
                if (underdogOdds > 0 && underdogOdds <= 3.20) {
                    penalty -= Math.round((3.30 - underdogOdds) * 500);
                } else if (underdogOdds >= 3.40) {
                    penalty += 300;
                }

                // Strict Disagreement Ban
                const paaPredObj = getPAAPredictionForSeer(m, phaStatsMap);
                const paaFinal = paaPredObj.paaFinal || paaPredObj.paaPrimary || '';
                const algoPred = m.algoReport?.prediction || '';
                
                // If PAA explicitly disagrees with Fav (predicts pure underdog)
                if (paaFinal && !paaFinal.includes(stats.moFav)) {
                    penalty -= 4000;
                }
                
                // If Algo explicitly disagrees with Fav
                if (algoPred && !algoPred.includes(stats.moFav)) {
                    penalty -= 3000;
                }

                // Reward consensus
                if (paaFinal.includes(stats.moFav) && algoPred.includes(stats.moFav)) {
                    penalty += 1500;
                }

                // Probability Gap & ML Probability check
                const probs = m.algoReport?.probabilities;
                if (probs) {
                    const pFav = (stats.moFav === '1' ? probs['1'] : probs['2']) * 100;
                    const pUnd = (stats.moUnderdog === '1' ? probs['1'] : probs['2']) * 100;
                    if (pFav - pUnd < 10) {
                        penalty -= 1500;
                    } else {
                        penalty += Math.round((pFav - pUnd) * 10);
                    }
                    
                    // Heavily weight overall ML Probability for Favorite
                    if (stats.probFav >= 65) penalty += 500;
                    else if (stats.probFav >= 60) penalty += 200;
                    else penalty -= 500;
                    
                    penalty += (stats.probFav * 10);
                }

                // 4. Heavy penalties for risk tags
                if (tags.some(t => t.includes('HIGH_ODDS_RISK') || t.includes('LAST_RESORT'))) {
                    penalty -= 800;
                }
                if (tags.some(t => t.endsWith(':DEMOTE'))) {
                    penalty -= 600;
                }
                if (tags.some(t => t.includes('AUTO_PICK'))) {
                    penalty -= 800; // Demote auto-picks on top10 value, we want pure statistically backed matches
                }
            }

            if (!isJackpot) {
                const isUnderdogCategory = ['upsets', 'value_bets'].includes(catId);
                
                // Penalize Pattern R for non-underdog categories
                const mainPat = (m.patternAnalysis?.mainPattern || '').toUpperCase();
                if (mainPat === 'R' && !isUnderdogCategory) penalty -= 150;
            }

            return penalty;
        };

        // Sorting by score with primary tag boost
        const mappedQualifyingMatches = qualifyingMatches.map((m) => {
            const weights = getWeights(catDef.id);
            const tags = matchTagsMap.get(m.id.toString()) || [];
            const hasPrimaryTag = tags.some(t => t.startsWith(tagPrefix + ':'));
            
            const seerPred = predictWithSeer(m, weights, phaStatsMap, matchStars, catDef.id);
            let score = getSeerScoreForPrediction(m, seerPred, weights, phaStatsMap, matchStars) + getMatchPriorityScore(m, tagPrefix, matchStars);
            
            score += getDefaultSeerPenalty(m, catDef.id);
            score += getAgreementBoost(m, catDef.id);
            score += catDef.id === 'upsets' 
                ? getMatchSupremeTierUnderdog(m, phaStatsMap).score 
                : getMatchSupremeTier(m, phaStatsMap, preCalculatedRules).score;
            score += getGatekeeperPriorityBoost(m, catDef.id);
            
            const group = (m as any).group || ((m as any).patternAnalysis?.group) || (m as any).pattern?.group || 3;
            if (group === 3 && !['banker_draws', 'upsets', 'value_bets'].includes(catDef.id)) {
                const stats = getMatchStats(m, phaStatsMap);
                const moFav = stats.moFav as '1'|'2';
                const probFav = stats.probFav;
                const paaSW = stats.phaFavWinSupport || 0;
                
                let seerScoreFav = 0;
                if (m.seerPercentages && m.seerPercentages[moFav] !== undefined) {
                    seerScoreFav = m.seerPercentages[moFav];
                } else if (m.seerScores && m.seerScores[moFav] !== undefined) {
                    seerScoreFav = m.seerScores[moFav];
                } else {
                    const baseSeer = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars);
                    seerScoreFav = baseSeer.percentages[moFav] || 0;
                }
                
                if (probFav < 50 && seerScoreFav < 50 && paaSW < 50) {
                    score -= 200;
                }
            }
            
            if (hasPrimaryTag) score += 1000;
            
            if (['best_bet', 'botb_best', 'bankers_dlive'].includes(catDef.id)) {
                const stats = getMatchStats(m, phaStatsMap);
                const moFav = stats.moFav as '1'|'2';
                let seerScoreFav = 0;
                if (m.seerPercentages && m.seerPercentages[moFav] !== undefined) {
                    seerScoreFav = m.seerPercentages[moFav];
                } else if (m.seerScores && m.seerScores[moFav] !== undefined) {
                    seerScoreFav = m.seerScores[moFav];
                } else {
                    const baseSeer = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, matchStars);
                    seerScoreFav = baseSeer.percentages[moFav] || 0;
                }
                
                if (seerScoreFav >= 55 && stats.probFav >= 55 && (stats.phaFavWinSupport || 0) >= 55) {
                    score += 500;
                }
            }
            
            if (['jackpot', 'bankers_jackpot'].includes(catDef.id)) {
                if (isIntelligenceActive && m.isJackpot) {
                    score += 500;
                }
            }
            
            if (['best_bet', 'botb_best', 'bankers_dlive', 'bankers_jackpot'].includes(catDef.id)) {
                score += getOptimizedScore(m, catDef.id, phaStatsMap);
            }
            if (['top_10_value', 'value_picks'].includes(catDef.id)) {
                score = getOptimizedScore(m, catDef.id, phaStatsMap);
            }
            
            return { m, score };
        });

        mappedQualifyingMatches.sort((a, b) => b.score - a.score);
        qualifyingMatches.length = 0; qualifyingMatches.push(...mappedQualifyingMatches.map(item => item.m));

        const selectedPicks: Pick[] = [];
        let sharedUsedInThisSlip = 0;
        const maxAllowedSharing = catDef.size <= 5 ? catDef.size : Math.floor(catDef.size / 2);

        // Helper to attempt adding a match to the slip
        const tryAddMatch = (m: Match, enforceSharingLimit: boolean, enforceSubSlotOdds: boolean) => {
            if (selectedPicks.length >= catDef.size) return false;

            const normMTeams = m.teams.toLowerCase().replace(/[^a-z0-9]/g, '');
            const isMatchAlreadyInSlip = selectedPicks.some(p => 
                p.match_id === m.id.toString() || 
                p.team.toLowerCase().replace(/[^a-z0-9]/g, '') === normMTeams
            );
            if (isMatchAlreadyInSlip) return false;

            const isAlreadyUsed = usageCount.has(m.id.toString());
            if (enforceSharingLimit && isAlreadyUsed && sharedUsedInThisSlip >= maxAllowedSharing) return false;

            const odds = getOdds(m);
            let shouldHedge = catDef.hedgedSize === catDef.size ? true : (catDef.hedgedSize > 0 ? null : false);

            if (enforceSubSlotOdds) {
                if (catDef.id === 'botb_best') {
                    const unhedgedRange = odds.favOdds >= 1.5 && odds.favOdds <= 2.0;
                    const hedgedRange = odds.favOdds >= 2.0 && odds.favOdds <= 2.49;
                    const hedgedCount = selectedPicks.filter(p => p.prediction.length > 1).length;
                    const unhedgedCount = selectedPicks.length - hedgedCount;

                    if (hedgedRange && hedgedCount < 5) shouldHedge = true;
                    else if (unhedgedRange && unhedgedCount < 5) shouldHedge = false;
                    else return false;
                } else if (catDef.id === 'high_confidence') {
                    const unhedgedRange = odds.favOdds >= 1.5 && odds.favOdds <= 2.0;
                    const hedgedRange = odds.favOdds >= 2.0 && odds.favOdds <= 2.49;
                    const hedgedCount = selectedPicks.filter(p => p.prediction.length > 1).length;
                    const unhedgedCount = selectedPicks.length - hedgedCount;

                    if (hedgedRange && hedgedCount < 10) shouldHedge = true;
                    else if (unhedgedRange && unhedgedCount < 10) shouldHedge = false;
                    else return false;
                }
            } else if (shouldHedge === null) {
                shouldHedge = odds.favOdds >= 2.0;
            }

            const pick = buildPick(m, catDef.id, isIntelligenceActive ? "AI Intelligence Selection" : "Pattern Match", shouldHedge === true);
            selectedPicks.push(pick);

            if (isAlreadyUsed) sharedUsedInThisSlip++;
            usageCount.set(m.id.toString(), (usageCount.get(m.id.toString()) || 0) + 1);
            return true;
        };

        // Pass 1: Strict rules (enforce sharing limit and strict sub-slot odds)
        for (const m of qualifyingMatches) {
            if (selectedPicks.length >= catDef.size) break;
            tryAddMatch(m, true, true);
        }

        // Pass 2: Relaxed sharing & sub-odds rules across qualifyingMatches to guarantee target count
        if (selectedPicks.length < catDef.size) {
            for (const m of qualifyingMatches) {
                if (selectedPicks.length >= catDef.size) break;
                tryAddMatch(m, false, false);
            }
        }

        // Pass 3: Fallback across all targetMatches (excluding hard-banned matches) to fill remaining slots up to target count
        if (selectedPicks.length < catDef.size && catDef.id !== 'top_10_value') {
            const fallbackPool = targetMatches.filter(m => {
                const mainPat = (m.patternAnalysis?.mainPattern || '').toUpperCase();
                const isPatternTSub = mainPat === 'T' && !!m.patternAnalysis?.subPattern;
                if (isPatternTSub) return false;

                const teams = (m.teams || '').toLowerCase();
                const league = (m.league || '').toLowerCase();
                const africanDomesticRegex = /tanzania|tanzanian|kenya|kenyan|uganda|ugandan|rwanda|rwandan|egypt|egyptian|morocco|moroccan|nigeria|nigerian|ghana|ghanaian|south africa|south african|zambia|zambian|senegal|senegalese|tunisia|tunisian|algeria|algerian|mali|cameroon|cameroonian|congo|angola|angolan|burundi|sudan|sudanese|somalia|ethiopia|ethiopian|suhul shire|caps united|triangle u|malawi|mozambique|botswana|namibia|zimbabwe|zimbabwean|lesotho|eswatini|madagascar|ivory coast|cote d'ivoire|guinea|burkina faso|benin|togo|mauritania|niger|chad|central african|gabon|equatorial|djibouti|eritrea|seychelles|comoros|mauritius|sao tome|sierra leone|liberia|gambia|cape verde|chemilil|sony sugar|jkt/i;
                const isFavoriteCategory = ['best_bet', 'top_10_value', 'high_confidence', 'botb_best', 'bankers_dlive', 'bankers_jackpot', 'value_picks'].includes(catDef.id);
                if (isFavoriteCategory && (africanDomesticRegex.test(teams) || africanDomesticRegex.test(league))) return false;

                return true;
            });

            for (const m of fallbackPool) {
                if (selectedPicks.length >= catDef.size) break;
                tryAddMatch(m, false, false);
            }
        }

        // Collect next 5 backups
        const backups: Pick[] = [];
        for (const m of qualifyingMatches) {
            if (backups.length >= 5) break;
            const normMTeams = m.teams.toLowerCase().replace(/[^a-z0-9]/g, '');
            const alreadyInPicks = selectedPicks.some(p => 
                p.match_id === m.id.toString() || 
                p.team.toLowerCase().replace(/[^a-z0-9]/g, '') === normMTeams
            );
            const alreadyInBackups = backups.some(b => 
                b.match_id === m.id.toString() || 
                b.team.toLowerCase().replace(/[^a-z0-9]/g, '') === normMTeams
            );
            if (!alreadyInPicks && !alreadyInBackups) {
                 const pick = buildPick(m, `${catDef.id}_backup`, "Filler/Backup");
                 backups.push(pick);
            }
        }

        // Assign to result object
        if (isJackpot) {
            spec[catDef.id] = selectedPicks;
            spec[`${catDef.id}_backups`] = backups;
        } else {
            if (live[catDef.id] !== undefined) {
                live[catDef.id] = selectedPicks;
                live[`${catDef.id}_backups`] = backups;
            } else {
                spec[catDef.id] = selectedPicks;
                spec[`${catDef.id}_backups`] = backups;
            }
        }
    });

    // Unallocated handling for Jackpots remains similar but uses the new registry
    if (isJackpot) {
        targetMatches.forEach(m => {
            if (usageCount.has(m.id.toString())) return;
            const tags = matchTagsMap.get(m.id.toString()) || [];
            const hasValidTag = tags.some(t => categories.some(c => t.startsWith(c.tag + ':')));
            
            if (hasValidTag) spec.unallocated.push(buildPick(m, 'unallocated', "Quota Full"));
            else spec.uncategorized.push(buildPick(m, 'uncategorized', "No Valid Tags"));
        });
    }

    // Delegate Upsets to our decoupled underdog selection algorithm logic
    const underdogSlips = generateSeerUnderdogSlips(targetMatches, phaStatsMap, matchStars, isJackpot, isIntelligenceActive);
    spec.upsets = underdogSlips.spec?.upsets || [];

    return { spec, live, candidates };
}

/**
 * Converts any prediction string to a guaranteed hedged double-chance prediction (1X, X2, or 12).
 * Preserves '12' when prescribed by Hedging Protocol (HPR).
 */
export const ensureHedgedPrediction = (
  pred: string,
  m?: Match,
  phaStatsMap?: Record<string, any>
): string => {
  let odds1 = 2.0, odds2 = 2.5;
  if (m) {
    const moParts = (m.mo || "").split(",").map((s: string) => parseFloat(s.trim()));
    odds1 = moParts[0] || 2.0;
    odds2 = moParts[2] || 2.5;
  }
  const defaultFavHedge = odds1 <= odds2 ? "1X" : "X2";

  if (!pred) return defaultFavHedge;
  const p = pred.trim().toUpperCase();

  // If p is a valid double-chance hedge (1X, X2, or 12), preserve it
  if (p === "1X" || p === "X2" || p === "12") return p;

  if (p === "1" || p.includes("1")) return "1X";
  if (p === "2" || p.includes("2")) return "X2";
  if (p === "X") return defaultFavHedge;

  return defaultFavHedge;
};

/**
 * Helper to safely extract 1X2 market odds and identify market favorite odds.
 */
export const parseMatchOdds = (m: Match): { odds1: number; oddsX: number; odds2: number; mFavOdds: number } => {
  const moParts = (m.mo || "").split(",").map((s: string) => parseFloat(s.trim()));
  const odds1 = !isNaN(moParts[0]) && moParts[0] > 0 ? moParts[0] : 2.0;
  const oddsX = !isNaN(moParts[1]) && moParts[1] > 0 ? moParts[1] : 3.0;
  const odds2 = !isNaN(moParts[2]) && moParts[2] > 0 ? moParts[2] : 2.5;
  const mFavOdds = Math.min(odds1, odds2);
  return { odds1, oddsX, odds2, mFavOdds };
};

/**
 * Checks if a match carries the evaluator tag for a given category in Live Analysis.
 */
export const hasCategoryTag = (
  m: Match,
  catId: string,
  phaStatsMap: Record<string, any>,
  isJackpot: boolean,
  matchStars: Record<string, number> = {}
): boolean => {
  const tags = getMatchEvaluatorTags(m, phaStatsMap, isJackpot, true, matchStars);
  const tagPrefixMap: Record<string, string[]> = {
    best_bet: ['best_bet:'],
    top_10_value: ['top10:', 'top_10_value:'],
    bankers_dlive: ['bankers_dlive:'],
    botb_best: ['botb_best:'],
    high_confidence: ['top20:', 'high_confidence:'],
    top20: ['top20:', 'high_confidence:'],
    bankers_jackpot: ['bankers_jackpot:'],
    value_bets: ['value_bets:'],
    value_picks: ['value_picks:'],
    banker_draws: ['banker_draws:'],
    upsets: ['upsets:']
  };
  const prefixes = tagPrefixMap[catId] || [`${catId}:`];
  return tags.some(t => prefixes.some(p => t.startsWith(p)));
};

/**
 * Mock or fallback AI cognitive score to prevent breaking GeminiEngine.ts
 */
export const calculateAiCognitiveScore = (
  m: Match,
  catId: string,
  phaStatsMap: Record<string, any>,
  matchStars: Record<string, number>,
  isJackpot: boolean
) => {
  const stats = getMatchStats(m, phaStatsMap);
  return {
    prediction: stats.moFav || '1X',
    score: 80,
    reason: 'Supreme Slip Pattern Alignment (Fallback)'
  };
};
