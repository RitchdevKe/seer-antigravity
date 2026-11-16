import { Match } from '../types';
import { predictWithSeer, predictSeerDetailed, DEFAULT_WEIGHTS, getMatchScore, CategoryWeights } from './seerLogic';
import { getMatchEvaluatorTags, getMatchPriorityScore, getMatchStats } from './matchEvaluator';
import { Pick } from '../components/ai/GeminiCards';
import { getSeerWeights } from '../services/storage';
import { getMatchSupremeTier, calculateSupremeRules, getMatchSupremeTierUnderdog } from './seerSupremeTier';
import { getOptimizedScore, applyHedgingProtocol, getMatchDayOfWeek } from './optimizedweights';
import { isBannedFromSeerSlips } from './leagueFilters';

const getSeerScoreForPrediction = (m: Match, pred: string, weights: CategoryWeights, phaStatsMap: Record<string, any>, matchStars: Record<string, number>) => {
    let s1 = pred.includes('1') ? getMatchScore(m, '1', weights, phaStatsMap, matchStars) : 0;
    let sx = pred.includes('X') ? getMatchScore(m, 'X', weights, phaStatsMap, matchStars) : 0;
    let s2 = pred.includes('2') ? getMatchScore(m, '2', weights, phaStatsMap, matchStars) : 0;
    return Math.max(s1, sx, s2);
};

export const generateSeerUnderdogSlips = (
    targetMatches: Match[], 
    phaStatsMap: Record<string, any>, 
    matchStars: Record<string, number>, 
    isJackpot: boolean,
    isIntelligenceActive: boolean = false
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

    const live: any = {
        best_bet: [],
        top_12_value: [],
        top_10_value: [],
        high_confidence: [],
        botb_best: []
    };

    const usageCount = new Map<string, number>(); 
    const matchTagsMap = new Map<string, string[]>();
    const seerWeights = getSeerWeights();
    const modePrefix = isJackpot ? 'jackpot_' : 'daily_';

    const getWeights = (cat: string) => {
        let mappedParent = cat;
        if (cat === 'best_bet' || cat === 'high_confidence' || cat === 'botb_best') {
            mappedParent = 'safety';
        } else if (cat === 'bankers_dlive' || cat === 'bankers_jackpot' || cat === 'value_picks' || cat === 'banker_draws') {
            mappedParent = 'banker';
        } else if (cat === 'upsets' || cat === 'value_bets') {
            mappedParent = 'upset';
        } else if (cat === 'top_12_value' || cat === 'top_10_value') {
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

        const paaPrimary = m.paaPrimaryPrediction || m.paaPrediction || "";
        const paaFinal = m.paaPrediction || "";

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

        const hasUpsetPR1to2ad = tags.some(t => {
            if (!t.startsWith('upsets:')) return false;
            const pr = t.split(':')[1];
            return ['PR1a', 'PR1b', 'PR1c', 'PR1d', 'PR2a', 'PR2b', 'PR2c', 'PR2d'].includes(pr);
        });

        if (hasUpsetPR1to2ad) return 0;
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

        const paaPred = m.paaPrediction || m.paaPrimaryPrediction || "";
        if (paaPred === "1X" || paaPred === "X2") {
            boost += 150; 
        } else if (paaPred === "12") {
            boost -= 50;
        }

        return boost;
    };

    targetMatches.forEach(m => {
        let tags = m.evaluatorTags || [];
        if (tags.length === 0) {
            tags = getMatchEvaluatorTags(m, phaStatsMap, true, true, matchStars);
            m.evaluatorTags = tags;
        }
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
        let primaryPred = predictSeerDetailed(m, weights, phaStatsMap, matchStars, cat).primary;
        let score = (cat === 'upsets' || cat === 'top_12_value' || cat === 'top_10_value') ? getOptimizedScore(m, cat, phaStatsMap, getMatchDayOfWeek(m)) : getSeerScoreForPrediction(m, seerPred, weights, phaStatsMap, matchStars);
        let reason = `Seer (${score.toFixed(1)}): ${reasonDetails}`;
        const tags = matchTagsMap.get(m.id.toString()) || [];

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
                if (seerPred.length === 1) {
                    if (seerPred === 'X') {
                        // If it's a draw, hedge with the stronger side
                        const s1 = getMatchScore(m, '1', weights, phaStatsMap, matchStars);
                        const s2 = getMatchScore(m, '2', weights, phaStatsMap, matchStars);
                        seerPred = s1 >= s2 ? '1X' : 'X2';
                    } else {
                        seerPred = seerPred === '1' ? '1X' : 'X2';
                    }
                }
            } else if (forcedHedge === false) { // Explicitly false means no hedge
                if (seerPred.length > 1) {
                    const stats = getMatchStats(m, phaStatsMap);
                    // For unhedging, pick the favorite or the first part
                    seerPred = stats.moFav || (seerPred.includes('1') ? '1' : (seerPred.includes('2') ? '2' : 'X'));
                }
            }
            primaryPred = seerPred;
        }

        if (cat === 'banker_draws') {
            primaryPred = 'X';
            const detailed = predictSeerDetailed(m, weights, phaStatsMap, matchStars, cat);
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

        if (cat !== 'upsets') {
            seerPred = applyHedgingProtocol(m, seerPred, cat, phaStatsMap);
        }

        return {
            match_id: m.id,
            team: m.teams,
            prediction: seerPred,
            primaryPrediction: primaryPred,
            odds: m.mo?.split(',')[0] || '1.0',
            reason: reason,
            confidence: isJackpot ? `${Math.min(99, Math.max(0, 50 + score))}%` : `${Math.min(99, Math.max(0, score))}%`,
            category: cat,
            tag_trace: tags.join(', ')
        };
    };

    // Category Processing Config for Live Mode
    const categories = [
        { id: 'best_bet', tag: 'best_bet', size: 10, hedgedSize: 0, 
          filter: (m: Match) => { 
              const o = getOdds(m); 
              const stats = getMatchStats(m, phaStatsMap);
              
              if (o.favOdds < 1.3 || o.favOdds > 1.6) return false;
              if (stats.phaFavWinSupport < 40) return false;

              // Configuration A to C Checks:
              const sub = m.patternAnalysis?.subPattern;
              const s = sub ? phaStatsMap[sub] : null;

              const paaPred = m.paaPrediction || m.paaPrimaryPrediction || '';
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
                  favSupport = (stats.paaStats.favWinRate ?? 0) / 100;
                  upsetRate = (stats.paaStats.upsetRate ?? 100) / 100;
              }

              // Option A (Ultra-Safe)
              const configA = (isSubPaaAgree || isPaaAlgoAgree) && favSupport >= 0.80 && upsetRate <= 0.10;
              // Option B (High Support)
              const configB = (isSubPaaAgree || isPaaAlgoAgree) && favSupport >= 0.75 && upsetRate <= 0.10;
              // Option C (Massive PAA Support)
              const configC = favSupport >= 0.80 && upsetRate <= 0.10;

              return configA || configB || configC;
          } },
        
        { id: 'bankers_dlive', tag: 'bankers_dlive', size: 10, hedgedSize: 0,
          filter: (m: Match) => { const o = getOdds(m); return o.favOdds > 1.5 && o.favOdds <= 1.8; } },
        
        { id: 'top_12_value', tag: 'top12', size: 12, hedgedSize: 12, 
          filter: (m: Match) => { const o = getOdds(m); return o.favOdds >= 2.0 && o.favOdds <= 2.49; } },
        
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
          filter: (m: Match) => { const o = getOdds(m); return o.favOdds > 1.8 && o.favOdds <= 2.0; } },
        
        { id: 'value_bets', tag: 'value_bets', size: 5, hedgedSize: 5,
          filter: (m: Match) => { const o = getOdds(m); return o.o1 >= 2.5 && o.o2 >= 2.5 && o.o1 < 90 && o.o2 < 90; } },
        
        { id: 'value_picks', tag: 'value_picks', size: 5, hedgedSize: 0,
          filter: (m: Match) => { const o = getOdds(m); return o.favOdds >= 2.0 && o.favOdds <= 2.49; } },
        
        { id: 'banker_draws', tag: 'banker_draws', size: 5, hedgedSize: 5,
          filter: (m: Match) => { const o = getOdds(m); return o.o1 >= 2.0 && o.o2 >= 2.0; } },
        
        { id: 'upsets', tag: 'upsets', size: 5, hedgedSize: 0,
          filter: (m: Match) => true }
    ];

    const processedCategories = isJackpot 
        ? categories.filter(c => !['best_bet', 'top_12_value', 'top_10_value', 'botb_best', 'high_confidence'].includes(c.id))
        : categories;

    processedCategories.forEach(catDef => {
        const tagPrefix = catDef.tag;
        const qualifyingMatches = targetMatches.filter(m => {
            const tags = matchTagsMap.get(m.id.toString()) || [];
            
            // Primary check: specific tag
            const hasPrimaryTag = tags.some(t => t.startsWith(tagPrefix + ':'));
            
            // BOTB Fallback check
            let isValid = hasPrimaryTag;
            if (catDef.id === 'upsets') {
                const supreme = getMatchSupremeTierUnderdog(m, phaStatsMap);
                if (supreme.insightsHit > 0) {
                    isValid = true;
                } else {
                    const stats = getMatchStats(m, phaStatsMap);
                    const upsetPct = stats.paaStats?.upsetRate || 0;
                    isValid = hasPrimaryTag || upsetPct >= 25;
                }
            } else if (!isValid && catDef.id === 'botb_best') {
                 const fallbackTags = ['top12', 'top10', 'top20', 'bankers_dlive', 'value_picks'];
                 isValid = tags.some(t => fallbackTags.some(ft => t.startsWith(ft + ':')));
            }
            
            if (!isValid) return false;

            // --- Banned Match Slip Filtering Logic (Applies to all Live Analyst EXCEPT Jackpot) ---
            if (!isJackpot) {
                // Note: Matches with BANNED: UPSET RISK / BANNED:UPSET_RISK are fully eligible for seerUnderdogSlipSelection!
            }

            return true;
        }).filter(m => catDef.filter(m));

        // Sorting by score with primary tag boost
        qualifyingMatches.sort((a, b) => {
            const isUpsetCategory = catDef.id === 'upsets' || catDef.id === 'top_12_value' || catDef.id === 'top_10_value';
            if (isUpsetCategory) {
                let pointsSupportsUnderdogA = false;
                if (a.totalPoints) {
                    const udA = getMatchStats(a, phaStatsMap).moFav === '1' ? '2' : '1';
                    if (udA === '1' && a.totalPoints.home > a.totalPoints.away) pointsSupportsUnderdogA = true;
                    if (udA === '2' && a.totalPoints.away > a.totalPoints.home) pointsSupportsUnderdogA = true;
                }
                
                let pointsSupportsUnderdogB = false;
                if (b.totalPoints) {
                    const udB = getMatchStats(b, phaStatsMap).moFav === '1' ? '2' : '1';
                    if (udB === '1' && b.totalPoints.home > b.totalPoints.away) pointsSupportsUnderdogB = true;
                    if (udB === '2' && b.totalPoints.away > b.totalPoints.home) pointsSupportsUnderdogB = true;
                }
                
                if (pointsSupportsUnderdogA && !pointsSupportsUnderdogB) return -1;
                if (pointsSupportsUnderdogB && !pointsSupportsUnderdogA) return 1;
            }

            const weights = getWeights(catDef.id);
            
            const tagsA = matchTagsMap.get(a.id.toString()) || [];
            const tagsB = matchTagsMap.get(b.id.toString()) || [];
            const hasPrimaryTagA = tagsA.some(t => t.startsWith(tagPrefix + ':'));
            const hasPrimaryTagB = tagsB.some(t => t.startsWith(tagPrefix + ':'));

            const seerPredA = predictWithSeer(a, weights, phaStatsMap, matchStars, catDef.id);
            const seerPredB = predictWithSeer(b, weights, phaStatsMap, matchStars, catDef.id);
            
            let scoreA = (isUpsetCategory ? getOptimizedScore(a, catDef.id, phaStatsMap, getMatchDayOfWeek(a)) : getSeerScoreForPrediction(a, seerPredA, weights, phaStatsMap, matchStars)) + getMatchPriorityScore(a, tagPrefix, matchStars);
            let scoreB = (isUpsetCategory ? getOptimizedScore(b, catDef.id, phaStatsMap, getMatchDayOfWeek(b)) : getSeerScoreForPrediction(b, seerPredB, weights, phaStatsMap, matchStars)) + getMatchPriorityScore(b, tagPrefix, matchStars);
            
            // Add global agreement boosts
            scoreA += getAgreementBoost(a, catDef.id);
            scoreB += getAgreementBoost(b, catDef.id);

            // Add SUPREME TIER BOOST based on high performing insights dynamically hit!
            const supremeA = isUpsetCategory
                ? getMatchSupremeTierUnderdog(a, phaStatsMap).score
                : getMatchSupremeTier(a, phaStatsMap, preCalculatedRules).score;
            const supremeB = isUpsetCategory
                ? getMatchSupremeTierUnderdog(b, phaStatsMap).score
                : getMatchSupremeTier(b, phaStatsMap, preCalculatedRules).score;
            scoreA += supremeA;
            scoreB += supremeB;

            if (hasPrimaryTagA) scoreA += 1000;
            if (hasPrimaryTagB) scoreB += 1000;

            // Golden Triangle Soft-Boost for Premium Slips
            if (['best_bet', 'botb_best'].includes(catDef.id)) {
                const getGoldenBoost = (m: Match, seerScore: number) => {
                    const stats = getMatchStats(m, phaStatsMap);
                    const moFav = stats.moFav as '1'|'2';
                    const probFav = m.algoReport?.probabilities?.[moFav] || 0;
                    const paaSW = stats.phaFavWinSupport || 0;
                    if (seerScore >= 50 && probFav >= 45 && paaSW >= 50) {
                        return 500;
                    }
                    return 0;
                };

                const sScoreA = getMatchScore(a, getMatchStats(a, phaStatsMap).moFav as '1'|'2', weights, phaStatsMap, matchStars);
                scoreA += getGoldenBoost(a, sScoreA);

                const sScoreB = getMatchScore(b, getMatchStats(b, phaStatsMap).moFav as '1'|'2', weights, phaStatsMap, matchStars);
                scoreB += getGoldenBoost(b, sScoreB);
            }

            // Priority removed: Ranked by SeerScore automatically


            return scoreB - scoreA;
        });

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
        if (selectedPicks.length < catDef.size) {
            const fallbackPool = targetMatches.filter(m => {
                if (catDef.id === 'upsets') return true;
                const mainPat = (m.patternAnalysis?.mainPattern || '').toUpperCase();
                const isPatternTSub = mainPat === 'T' && !!m.patternAnalysis?.subPattern;
                if (isPatternTSub) return false;
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
                if (catDef.id === 'top_12_value') {
                    live['top_10_value'] = selectedPicks;
                    live['top_10_value_backups'] = backups;
                }
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

    return { spec, live };
}
