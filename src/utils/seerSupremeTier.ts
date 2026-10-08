import { Match } from '../types';
import { getMatchStats } from './matchEvaluator';
import { getUploadedMatches } from '../services/storage';
import { getActualResult, matchesPrediction } from './matchProcessing';

export interface SupremeTierBoost {
    score: number;       // total points to add
    insightsHit: number; // how many high-performing insights were met
    tags: string[];      // names of the performing insights
}

export const getMatchSupremeTier = (m: Match, phaStatsMap: Record<string, any>, preCalculatedRules?: any[]): SupremeTierBoost => {
    // 1. Check if we have pre-calculated rules, if not, do it now.
    // (We could cache this in memory so we don't recalculate for every live match)
    const rulesToUse = preCalculatedRules || calculateSupremeRules(phaStatsMap);

    let score = 0;
    let insightsHit = 0;
    const tags: string[] = [];

    // 2. Check which performing rules this match hits
    for (const rule of rulesToUse) {
        if (rule.test(m)) {
            // Rule is a match!
            insightsHit++;
            tags.push(rule.name);
            // Boost relative to rule accuracy, e.g., 85% = 850 points.
            score += Math.floor(rule.accuracy * 10);
            
            // Extra multiplier if it's exceptionally high
            if (rule.accuracy > 90) score += 500;
        }
    }

    // Exponential supreme boost to heavily prioritize matches hitting multiple performing insights
    if (insightsHit > 1) {
        score += (insightsHit * 1000); 
    }

    return { score, insightsHit, tags };
};

// Internal memory cache to prevent constant recalculation
let cachedRules: any[] | null = null;
let lastCacheTime = 0;

export const calculateSupremeRules = (phaStatsMap: Record<string, any>) => {
    const now = Date.now();
    // Cache for 5 minutes
    if (cachedRules && (now - lastCacheTime < 5 * 60 * 1000)) {
        return cachedRules;
    }

    const history = getUploadedMatches().filter(m => getActualResult(m.result) !== 'pending');
    // Using the last 2000 matches gives us a robust, recent sample
    const recentHistory = history.slice(0, 2000); 

    const rawRules = [
        {
            id: 'strategy_eta',
            name: 'Strategy Eta (The Ultimate Shield)',
            test: (m: Match, statsList?: any) => {
                const stats = statsList || getMatchStats(m, phaStatsMap);
                const subPred = m.patternAnalysis?.subPatternPrediction || '';
                const paaPred = m.paaPrediction || m.paaPrimaryPrediction || '';
                const algoPred = m.algoReport?.prediction || '';
                const hasTripleAgreement = [...paaPred].some(c => algoPred.includes(c) && subPred.includes(c));
                const isDoubleChancePatt = ['12', 'X2'].includes(subPred);
                return hasTripleAgreement && isDoubleChancePatt && stats.favOdds <= 1.42;
            }
        },
        {
            id: 'paa_fav_algo',
            name: 'PAA Favorite + Algo Support',
            test: (m: Match, statsList?: any) => {
                const stats = statsList || getMatchStats(m, phaStatsMap);
                const isPaaFav = stats.phaFavSupport >= 50;
                const algoSupportsFav = matchesPrediction(m.algoReport?.prediction || '', stats.moFav);
                return isPaaFav && algoSupportsFav;
            }
        },
        {
            id: 'paa_algo_agr',
            name: 'PAA/Algo Agreement',
            test: (m: Match) => {
                return !!m.algoReport?.prediction && !!m.patternAnalysis?.subPatternPrediction && 
                       m.algoReport.prediction === m.patternAnalysis.subPatternPrediction;
            }
        },
        {
            id: 'synergy_boost_a',
            name: 'Synergy Boost A',
            test: (m: Match, statsList?: any) => {
                const stats = statsList || getMatchStats(m, phaStatsMap);
                const probFav = stats.probFav;
                const paaSW = stats.phaFavWinSupport || 0;
                return probFav >= 45 && paaSW >= 50 && stats.favOdds >= 1.4 && stats.favOdds <= 2.2;
            }
        },
        {
            id: 'goal_opt_mfav',
            name: 'Goal Optimization (mFAV)',
            test: (m: Match, statsList?: any) => {
                const stats = statsList || getMatchStats(m, phaStatsMap);
                return stats.phaFavWinSupport >= 60 && stats.favOdds < 2.0;
            }
        },
        {
            id: 'strong_underdog',
            name: 'Strong Underdog Alignment',
            test: (m: Match, statsList?: any) => {
                const stats = statsList || getMatchStats(m, phaStatsMap);
                const moFav = stats.moFav;
                const underdogStr = moFav === '1' ? '2' : (moFav === '2' ? '1' : '');
                return matchesPrediction(m.patternAnalysis?.subPatternPrediction || '', underdogStr) &&
                       matchesPrediction(m.algoReport?.prediction || '', underdogStr);
            }
        }
    ];

    if (recentHistory.length === 0) {
        // Return from localStorage if no history to base performance on
        try {
            if (typeof localStorage !== 'undefined') {
                const saved = localStorage.getItem('supreme_rules_fav');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    // We need to re-attach the 'test' functions based on ID
                    const reattached = parsed.map((p: any) => {
                        const found = rawRules.find(r => r.id === p.id);
                        return found ? { ...p, test: found.test } : null;
                    }).filter(Boolean);
                    if (reattached.length > 0) {
                        cachedRules = reattached;
                        lastCacheTime = now;
                        return reattached;
                    }
                }
            }
        } catch (e) {
             console.warn("Failed to load supreme rules from local storage", e);
        }
        return [];
    }

    const performingRules = [];

    // Evaluate each rule
    for (const rule of rawRules) {
        let hits = 0;
        let total = 0;

        for (const m of recentHistory) {
            const stats = getMatchStats(m, phaStatsMap);
            if (rule.test(m, stats)) {
                total++;
                const actual = getActualResult(m.result);
                
                let won = false;
                if (rule.id === 'strategy_eta') {
                    const subPred = m.patternAnalysis?.subPatternPrediction || '';
                    won = !!actual && matchesPrediction(subPred, actual);
                } else {
                    let targetOutcome = stats.moFav;
                    // If it's the underdog rule, flip target
                    if (rule.id === 'strong_underdog') {
                        targetOutcome = stats.moFav === '1' ? '2' : (stats.moFav === '2' ? '1' : '');
                    }
                    won = !!actual && !!targetOutcome && matchesPrediction(targetOutcome, actual);
                }

                if (won) {
                    hits++;
                }
            }
        }

        if (total >= 5) {
            const accuracy = (hits / total) * 100;
            // The user requested >= 80%
            if (accuracy >= 80) {
                performingRules.push({
                    id: rule.id,
                    name: rule.name,
                    test: rule.test,
                    accuracy,
                    total,
                    hits
                });
            }
        }
    }

    cachedRules = performingRules;
    lastCacheTime = now;
    
    // Save to local storage for persistence across reloads/sessions when history isn't loaded yet
    try {
        if (typeof localStorage !== 'undefined') {
            const toSave = performingRules.map(r => ({ id: r.id, name: r.name, accuracy: r.accuracy, total: r.total, hits: r.hits }));
            localStorage.setItem('supreme_rules_fav', JSON.stringify(toSave));
        }
    } catch(e) {}
    
    return performingRules;
};

// --- UNDERDOG SUPREME RULES ---

let cachedUnderdogRules: any[] | null = null;
let lastUnderdogCacheTime = 0;

export const calculateSupremeRulesUnderdog = (phaStatsMap: Record<string, any>) => {
    const now = Date.now();
    // Cache for 5 minutes
    if (cachedUnderdogRules && (now - lastUnderdogCacheTime < 5 * 60 * 1000)) {
        return cachedUnderdogRules;
    }

    const history = getUploadedMatches().filter(m => getActualResult(m.result) !== 'pending');
    const recentHistory = history.slice(0, 2000); 

    const rawRules = [
        {
            id: 'paa_underdog',
            name: 'PAA Supports Underdog',
            test: (m: Match, statsList?: any) => {
                const stats = statsList || getMatchStats(m, phaStatsMap);
                const moUnderdog = stats.moUnderdog;
                const paaPred = m.paaPrediction || m.paaPrimaryPrediction || '';
                return paaPred.includes(moUnderdog);
            }
        },
        {
            id: 'algo_and_sub_underdog',
            name: 'Algo and SubPattern Underdog Support',
            test: (m: Match, statsList?: any) => {
                const stats = statsList || getMatchStats(m, phaStatsMap);
                const moUnderdog = stats.moUnderdog;
                const algoPred = m.algoReport?.prediction || '';
                const subPred = m.patternAnalysis?.subPatternPrediction || '';
                return algoPred.includes(moUnderdog) && subPred.includes(moUnderdog);
            }
        },
        {
            id: 'underdog_prob_30',
            name: 'Underdog Probability >30%',
            test: (m: Match, statsList?: any) => {
                const stats = statsList || getMatchStats(m, phaStatsMap);
                const moUnderdog = stats.moUnderdog;
                const probUnderdog = (m.algoReport?.probabilities?.[moUnderdog as '1'|'2'] || 0) * 100;
                return probUnderdog > 30;
            }
        },
        {
            id: 'underdog_paa_outperform',
            name: 'High Underdog PAA Outperformance (>25%)',
            test: (m: Match) => {
                const sub = m.patternAnalysis?.subPattern;
                if (sub && phaStatsMap[sub]) {
                    const pha = phaStatsMap[sub];
                    if (pha.total > 0) {
                        const pDenom = pha.paaTotal > 0 ? pha.paaTotal : pha.total;
                        const paaUpsetPct = (pha.upsetWin / pDenom) * 100;
                        return paaUpsetPct > 25;
                    }
                }
                return false;
            }
        },
        {
            id: 'double_system_underdog',
            name: 'Double System Underdog Agreement (Algo + 1X2)',
            test: (m: Match, statsList?: any) => {
                const stats = statsList || getMatchStats(m, phaStatsMap);
                const moUnderdog = stats.moUnderdog;
                const algoPred = m.algoReport?.prediction || '';
                const pred1x2 = m.pred1x2 || '';
                return algoPred.includes(moUnderdog) && pred1x2.includes(moUnderdog);
            }
        },
        {
            id: 'underdog_higher_ts',
            name: 'Underdog Higher Team Strength Than Favorite',
            test: (m: Match, statsList?: any) => {
                const stats = statsList || getMatchStats(m, phaStatsMap);
                const moUnderdog = stats.moUnderdog;
                const moFav = stats.moFav;
                if (m.tsa !== undefined && m.tsb !== undefined) {
                    const favTS = moFav === '1' ? m.tsa : m.tsb;
                    const upsetTS = moUnderdog === '1' ? m.tsa : m.tsb;
                    return upsetTS > favTS;
                }
                return false;
            }
        },
        {
            id: 'upset_risk_tagged',
            name: 'Upset Risk Tagged Match',
            test: (m: Match) => {
                const tags = m.evaluatorTags || [];
                return tags.some((t: string) => t.includes('UPSET_RISK') || t.includes('UPSET RISK') || t.includes('upsets:'));
            }
        }
    ];

    if (recentHistory.length === 0) {
        try {
            if (typeof localStorage !== 'undefined') {
                const saved = localStorage.getItem('supreme_rules_underdog');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    const reattached = parsed.map((p: any) => {
                        const found = rawRules.find(r => r.id === p.id);
                        return found ? { ...p, test: found.test } : null;
                    }).filter(Boolean);
                    if (reattached.length > 0) {
                        cachedUnderdogRules = reattached;
                        lastUnderdogCacheTime = now;
                        return reattached;
                    }
                }
            }
        } catch (e) {
             console.warn("Failed to load supreme rules for underdog from local storage", e);
        }
        // Fallback default rules when history is not loaded yet
        const defaultUnderdogRules = rawRules.map(r => ({
            id: r.id,
            name: r.name,
            test: r.test,
            accuracy: 42,
            total: 20,
            hits: 8
        }));
        cachedUnderdogRules = defaultUnderdogRules;
        lastUnderdogCacheTime = now;
        return defaultUnderdogRules;
    }

    const performingRules = [];

    // Evaluate underdog rules against underdog win historical outcomes
    for (const rule of rawRules) {
        let hits = 0;
        let total = 0;

        for (const m of recentHistory) {
            const stats = getMatchStats(m, phaStatsMap);
            if (rule.test(m, stats)) {
                total++;
                const moUnderdog = stats.moUnderdog;
                const actual = getActualResult(m.result);
                
                if (actual && moUnderdog && actual === moUnderdog) {
                    hits++;
                }
            }
        }

        if (total >= 5) {
            const accuracy = (hits / total) * 100;
            // A 35%+ direct underdog win rate is exceptional/profitable
            if (accuracy >= 35) {
                performingRules.push({
                    id: rule.id,
                    name: rule.name,
                    test: rule.test,
                    accuracy,
                    total,
                    hits
                });
            }
        }
    }

    cachedUnderdogRules = performingRules;
    lastUnderdogCacheTime = now;
    
    try {
        if (typeof localStorage !== 'undefined') {
            const toSave = performingRules.map(r => ({ id: r.id, name: r.name, accuracy: r.accuracy, total: r.total, hits: r.hits }));
            localStorage.setItem('supreme_rules_underdog', JSON.stringify(toSave));
        }
    } catch(e) {}
    
    return performingRules;
};

export const getMatchSupremeTierUnderdog = (m: Match, phaStatsMap: Record<string, any>, preCalculatedRules?: any[]): SupremeTierBoost => {
    const rulesToUse = preCalculatedRules || calculateSupremeRulesUnderdog(phaStatsMap);

    let score = 0;
    let insightsHit = 0;
    const tags: string[] = [];

    for (const rule of rulesToUse) {
        if (rule.test(m)) {
            insightsHit++;
            tags.push(rule.name);
            // Boost relative to rule accuracy
            score += Math.floor(rule.accuracy * 15);
            
            // Extra multiplier if exceptionally high
            if (rule.accuracy > 45) score += 600;
        }
    }

    // Exponential boost for multiple hitting underdog insights
    if (insightsHit > 1) {
        score += (insightsHit * 1200); 
    }

    return { score, insightsHit, tags };
};

