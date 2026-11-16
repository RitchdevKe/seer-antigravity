import { Match } from '../types';
import { Pick } from '../components/ai/GeminiCards';
import { getMatchStats, getMatchEvaluatorTags, getMatchPriorityScore } from './matchEvaluator';
import { getOptimalHedge } from './volatilityEngine';
import { generateSeerUnderdogSlips } from './seerUnderdogSlipSelection';
import { calculatePAAPrediction } from './matchProcessing';
import { getOptimizedScore, getOptimizedScoreDetailed, applyHedgingProtocol, getMatchDayOfWeek, DayOfWeek } from './optimizedweights';
import { isBannedFromSeerSlips } from './leagueFilters';

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

const hasAlgoConflictSignal = (m: Match, phaStatsMap: Record<string, any>): boolean => {
    const algoPred = m.algoReport?.prediction;
    if (algoPred !== '12') return false;

    const { paaFinal: paaPred } = getPAAPredictionForSeer(m, phaStatsMap);
    const stats = getMatchStats(m, phaStatsMap);
    const seerPred = stats.moFav === '1' ? '1X' : 'X2';

    return (paaPred === '1X' || paaPred === 'X2') && (seerPred === '1X' || seerPred === 'X2');
};

const getOdds = (m: Match) => {
    let o1 = 0, oX = 0, o2 = 0;
    if (m.mo) {
        const parts = m.mo
            .split(/[- ,/|]+|\s+/)
            .map((s: string) => parseFloat(s.replace(/[^0-9.]/g, '').trim()))
            .filter((n: number) => !isNaN(n));
        if (parts.length >= 3) {
            o1 = parts[0];
            oX = parts[1];
            o2 = parts[2];
        } else if (parts.length === 1) {
            o1 = parts[0];
        }
    }
    const favOdds = (o1 > 0 && o2 > 0) ? Math.min(o1, o2) : (o1 > 0 ? o1 : o2);
    return { o1, oX, o2, favOdds };
};

export const calculateMatchProbability = (m: Match, phaStatsMap: Record<string, any>): number => {
    const stats = getMatchStats(m, phaStatsMap);
    let prob = 0;
    
    // 1. Algo ML Probability (Base)
    const algoProbs = m.algoReport?.probabilities || { '1': 0.33, 'X': 0.33, '2': 0.33 };
    const favAlgoProb = (stats.moFav === '1' ? algoProbs['1'] : algoProbs['2']) * 100;
    
    // 2. PAA Historical Support (Weight: Heavy)
    const paaFavSupport = stats.phaFavSupport || 0;
    const paaTotal = stats.paaStats?.total || 0;
    
    // 3. Upset/Volatility Risk
    const upsetRate = stats.paaStats?.upsetRate || 0;
    const safeRate = paaFavSupport + (stats.phaDrawSupport || 0);
    
    // Dynamic Weighting based on sample size
    if (paaTotal > 15) {
        prob = (favAlgoProb * 0.4) + (paaFavSupport * 0.5) - (upsetRate * 0.25);
    } else if (paaTotal > 5) {
        prob = (favAlgoProb * 0.6) + (paaFavSupport * 0.3) - (upsetRate * 0.15);
    } else {
        prob = (favAlgoProb * 0.9) - (upsetRate * 0.1);
    }
    
    // 4. Sub-pattern agreement boost
    const paaPredObj = getPAAPredictionForSeer(m, phaStatsMap);
    const paaPred = paaPredObj.paaFinal || paaPredObj.paaPrimary || '';
    if (paaPred.includes(stats.moFav)) prob += 5;
    
    // 5. Algo prediction agreement
    const algoPred = m.algoReport?.prediction || '';
    if (algoPred.includes(stats.moFav)) prob += 5;

    // 6. Hedged Safety Boost
    if (safeRate >= 75) {
        prob += 5;
    }
    
    return Math.min(100, Math.max(0, prob));
};

export const generateSeerSlips = (
    targetMatches: Match[], 
    phaStatsMap: Record<string, any>, 
    matchStars: Record<string, number>, 
    isJackpot: boolean,
    isIntelligenceActive: boolean = false,
    dayOverride?: DayOfWeek
) => {
    targetMatches = targetMatches.filter(m => !!m);

    const spec: any = {
        jackpot_slip: [], bankers_jackpot: [], bankers_dlive: [],
        value_bets: [], value_picks: [], banker_draws: [], upsets: [],
        unallocated: [], uncategorized: []
    };

    const live: any = {
        best_bet: [], top_12_value: [], top_10_value: [], high_confidence: [], botb_best: []
    };

    // Calculate probabilities for all matches
    const scoredMatches = targetMatches.map(m => {
        return {
            m,
            prob: calculateMatchProbability(m, phaStatsMap)
        };
    }).sort((a, b) => b.prob - a.prob);

    const categories = [
        { id: 'best_bet', type: 'live', size: 10, hedgedSize: 10, 
          filter: (m: Match) => { const o = getOdds(m); return o.favOdds >= 1.3 && o.favOdds <= 1.6; } },
        
        { id: 'bankers_dlive', type: 'live', size: 10, hedgedSize: 10, 
          filter: (m: Match) => { const o = getOdds(m); return o.favOdds > 1.5 && o.favOdds <= 1.8; } },
        
        { id: 'top_12_value', type: 'live', size: 12, hedgedSize: 12, 
          filter: (m: Match) => { 
              const o = getOdds(m); 
              return o.favOdds >= 2.0 && o.favOdds <= 3.0;
          } },
        
        

        

        { id: 'bankers_jackpot', type: 'spec', size: 5, hedgedSize: 0,
          filter: (m: Match) => { const o = getOdds(m); return o.favOdds > 1.8 && o.favOdds <= 2.0; } },
        
        { id: 'value_bets', type: 'spec', size: 5, hedgedSize: 5,
          filter: (m: Match) => { const o = getOdds(m); return o.favOdds >= 2.5 && o.o1 >= 2.5 && o.o2 >= 2.5 && o.o1 < 90 && o.o2 < 90; } },
        
        { id: 'value_picks', type: 'spec', size: 5, hedgedSize: 0,
          filter: (m: Match) => { const o = getOdds(m); return o.favOdds >= 2.0 && o.favOdds <= 2.5; } },
        
        { id: 'banker_draws', type: 'spec', size: 5, hedgedSize: 5,
          filter: (m: Match) => { const o = getOdds(m); return o.o1 >= 2.0 && o.o2 >= 2.0; } },
        
        { id: 'upsets', type: 'spec', size: 5, hedgedSize: 0,
          filter: (m: Match) => true }
    ];

    const processedCategories = isJackpot 
        ? categories.filter(c => !['best_bet', 'top_12_value', 'top_10_value', 'botb_best', 'high_confidence'].includes(c.id))
        : categories;

    const buildPick = (m: Match, catDef: any, shouldHedge: boolean, prob: number): Pick => {
        const stats = getMatchStats(m, phaStatsMap);
        let seerPred = stats.moFav as string;
        let primaryPred = seerPred;

        if (catDef.id === 'banker_draws') {
            primaryPred = 'X';
            seerPred = stats.moFav === '1' ? '1X' : 'X2';
        } else if (catDef.id === 'upsets') {
            primaryPred = stats.moUnderdog;
            seerPred = shouldHedge ? (primaryPred === '1' ? '1X' : 'X2') : primaryPred;
        } else if (catDef.id === 'value_bets') {
            primaryPred = stats.moUnderdog; // Value bets typically target the underdog side or draw
            seerPred = shouldHedge ? (primaryPred === '1' ? '1X' : 'X2') : primaryPred;
        } else {
            if (shouldHedge) {
                // Volatility Engine determines optimal hedge (1X/X2 vs 12)
                seerPred = getOptimalHedge(m, phaStatsMap);
            }
        }
        
        // Final override protocol for category specific hedges
        const rawSeerPred = seerPred;
        const matchDay = dayOverride || getMatchDayOfWeek(m);
        const optDetail = phaStatsMap ? getOptimizedScoreDetailed(m, catDef.id, phaStatsMap, matchDay) : null;
        let isHprOverride = false;
        if (catDef.id === 'value_picks') {
            // Value picks requires pure Market Favorite win without draw hedge
            seerPred = stats.moFav;
        } else if (optDetail?.activeHedgingProtocol) {
            seerPred = optDetail.optimizedPrediction;
            isHprOverride = true;
        } else {
            seerPred = applyHedgingProtocol(m, seerPred, catDef.id, phaStatsMap, matchDay);
            isHprOverride = seerPred !== rawSeerPred;
        }

        return {
            match_id: m.id,
            team: m.teams,
            prediction: seerPred,
            primaryPrediction: primaryPred,
            odds: m.mo?.split(',')[0] || '1.0',
            reason: isHprOverride ? `HPR: Hedging Protocol Override (${seerPred})` : `ML Algo: High Probability Selection (${prob.toFixed(1)}%)`,
            confidence: `${prob.toFixed(1)}%`,
            category: catDef.id,
            tag_trace: isHprOverride ? `hpr:${seerPred}` : `prob:${prob.toFixed(1)}`,
            le: m.le || '',
            l10: m.l10 || '',
            rating: m.rating || '',
            isHprOverride,
            opwPoints: optDetail?.totalScore,
            opwRulesHit: optDetail?.rulesHit,
            opwBaseInfo: optDetail?.baseInfo,
            gs: m.gs || '',
            ga: m.ga || '',
            league: m.league || '',
            evaluatorTags: m.evaluatorTags || []
        };
    };

    const usageCount = new Map<string, number>();

    processedCategories.forEach(catDef => {
        const qualifyingMatches = scoredMatches.filter(sm => {
            const tagMap: Record<string, string> = {
                'best_bet': 'best_bet',
                'bankers_dlive': 'bankers_dlive',
                'top_12_value': 'top12',
                'top_10_value': 'top12',
                'botb_best': 'botb_best',
                'high_confidence': 'top20',
                'bankers_jackpot': 'bankers_jackpot',
                'value_bets': 'value_bets',
                'value_picks': 'value_picks',
                'banker_draws': 'banker_draws',
                'upsets': 'upsets'
            };
            const expectedTagPrefix = tagMap[catDef.id];
            
            if (expectedTagPrefix) {
                let tags = sm.m.evaluatorTags || [];
                if (tags.length === 0) {
                    tags = getMatchEvaluatorTags(sm.m, phaStatsMap, isJackpot, true, matchStars);
                    sm.m.evaluatorTags = tags;
                }
                const hasPrimaryTag = tags.some(t => 
                    t.startsWith(expectedTagPrefix + ':') || 
                    (expectedTagPrefix === 'top12' && t.startsWith('top10:'))
                );
                
                // All category slips must have the category specific evaluator tags
                if (!hasPrimaryTag) return false;
            }
            if (catDef.filter && !catDef.filter(sm.m)) {
                return false;
            }

            return true;
        });
        
        if (['top_12_value', 'top_10_value', 'best_bet', 'bankers_dlive', 'botb_best', 'high_confidence', 'upsets', 'bankers_jackpot', 'value_picks', 'value_bets', 'banker_draws'].includes(catDef.id)) {
            // Pre-calculate optimized scores to avoid blocking the main thread during O(n log n) sorting evaluations
            const optScoreMap = new Map<string, number>();
            qualifyingMatches.forEach(q => {
                const matchDay = dayOverride || getMatchDayOfWeek(q.m);
                optScoreMap.set(String(q.m.id), getOptimizedScore(q.m, catDef.id, phaStatsMap, matchDay));
            });

            // Sort: prioritize OPW points descending (pure score separation), followed by probability if tied
            qualifyingMatches.sort((a, b) => {
                const scoreA = optScoreMap.get(String(a.m.id)) ?? 0;
                const scoreB = optScoreMap.get(String(b.m.id)) ?? 0;

                if (scoreA !== scoreB) {
                    return scoreB - scoreA;
                }
                
                // If slip is heavily hedged (>= 50%), evaluate by the optimal hedge probability
                if (catDef.hedgedSize >= catDef.size / 2) {
                    const hedgeA = getOptimalHedge(a.m, phaStatsMap);
                    const hedgeB = getOptimalHedge(b.m, phaStatsMap);
                    
                    const calculateHedgeConfidence = (m: Match, target: string) => {
                        if (!m.seerPercentages) return 0;
                        const p1 = m.seerPercentages['1'] || 0;
                        const pX = m.seerPercentages['X'] || 0;
                        const p2 = m.seerPercentages['2'] || 0;
                        if (target === '1X') return p1 + pX;
                        if (target === 'X2') return pX + p2;
                        if (target === '12') return p1 + p2;
                        return m.seerPercentages[target] || 0;
                    };

                    const confA = calculateHedgeConfidence(a.m, hedgeA);
                    const confB = calculateHedgeConfidence(b.m, hedgeB);
                    
                    if (confA !== confB) return confB - confA; // Highest hedge confidence first
                }
                
                // Fallback to the default probability
                return b.prob - a.prob;
            });
        }
        
        const selectedPicks: Pick[] = [];
        let hedgedCount = 0;
        const maxAllowedSharing = catDef.size <= 5 ? catDef.size : Math.floor(catDef.size / 2);

        for (const sm of qualifyingMatches) {
            if (selectedPicks.length >= catDef.size) break;
            
            const m = sm.m;
            // Basic deduplication in same slip
            if (selectedPicks.some(p => p.match_id === m.id.toString())) continue;
            
            // No duplicate rule - any match can be in any category

            const isUnhedgedSlot = (selectedPicks.length - hedgedCount) < (catDef.size - catDef.hedgedSize);
            const shouldHedge = !isUnhedgedSlot;

            const pick = buildPick(m, catDef, shouldHedge, sm.prob);
            selectedPicks.push(pick);
            
            if (shouldHedge) hedgedCount++;
            // usageCount tracking removed
        }

        if (catDef.type === 'live') {
            live[catDef.id] = selectedPicks;
        } else {
            spec[catDef.id] = selectedPicks;
        }
    });

    
    // Manually assemble BOTB and Top 20 (high_confidence)
    const top12 = live['top_12_value'] || live['top_10_value'] || [];
    if (live['top_12_value']) {
        live['top_10_value'] = live['top_12_value'];
    } else if (live['top_10_value']) {
        live['top_12_value'] = live['top_10_value'];
    }
    const bankersDlive = live['bankers_dlive'] || [];
    const bankersJackpot = spec['bankers_jackpot'] || [];

    // BOTB: 5 best from Top 12, 5 best from Bankers Dlive
    live['botb_best'] = [
        ...top12.slice(0, 5),
        ...bankersDlive.slice(0, 5)
    ].map(p => ({ ...p, category: 'botb_best' }));

    // Top 20: 10 best from Top 12, 10 from Bankers Dlive + Bankers Jackpot
    const combinedBankers = [...bankersDlive, ...bankersJackpot];
    const uniqueBankers = [];
    const uniqueBankerIds = new Set();
    for (const b of combinedBankers) {
        if (!uniqueBankerIds.has(b.match_id)) {
            uniqueBankerIds.add(b.match_id);
            uniqueBankers.push(b);
        }
    }

    live['high_confidence'] = [
        ...top12.slice(0, 10),
        ...uniqueBankers.slice(0, 10)
    ].map(p => ({
        ...p,
        sourceCategory: p.sourceCategory || (p.category === 'top_10_value' ? 'top_12_value' : p.category),
        category: 'high_confidence'
    }));

    return { spec, live };

};
