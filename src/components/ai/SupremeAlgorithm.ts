import { Match } from '../../types';
import { getActualResult, matchesPrediction, isMatchGoalAccurate } from '../../utils/matchProcessing';
import { getMatchStats, getMatchEvaluatorTags } from '../../utils/matchEvaluator';
import { predictWithSeer, DEFAULT_WEIGHTS, getMatchScore } from '../../utils/seerLogic';
import { debouncedSyncToSupabase, forceSyncToSupabase } from '../../services/supabaseStorage';
import { saveSupremeWeightsToDb } from '../../services/supabaseSupremeWeights';

export interface SupremeWeight {
    featureName: string;
    overallAccuracy: number;
    goalAccuracy: number;
    totalHits: number;
    correctHits: number;
    goalCorrect?: number;
}

export interface CategoryWeights {
    [feature: string]: SupremeWeight;
}

export type SupremeWeightsMap = Record<string, CategoryWeights>;

export const DEFAULT_SUPREME_TOP10_WEIGHTS: Record<string, number> = {
    'PAA Prediction': 48,
    'Algo Prediction': 5,
    'Sub Pattern': 12,
    'Prob Confidence': 10,
    'PHA High Fav Support': 20,
    'PAA Performance': 21,
    'Live PERF Data': 15,
    '1X2 Prediction': 10,
    '1X2 Rating Boost': 5,
    'Draw Strategy Boost': 50,
    'Synergy Gap': 75,
    'Synergy Boost A (High Confidence)': 70,
    'Synergy Boost B': 45,
    'Synergy Boost C (Prob & PAA)': 20,
    'Synergy Boost D': 40,
    'Synergy Boost E': 25,
    'PAA/Algo Agreement': 48,
    'PAA/Algo Partial Agreement': 24,
    'Seer Base': 30
};

export const extractMatchFeatures = (match: Match, phaStatsMap: Record<string, any>, matchStars: Record<string, number>): Record<string, string> => {
    const stats = getMatchStats(match, phaStatsMap);
    const moFav = stats.moFav;
    const moUnd = stats.moUnderdog;
    const features: Record<string, string> = {};

    // 1. PAA/Algo Agreement: Algo Prediction
    const paaPred = match.paaPrediction || match.paaPrimaryPrediction || '';
    const algoPred = match.algoReport?.prediction || match.calculatedPrediction || '';
    
    if (paaPred) features['PAA Prediction'] = paaPred;
    if (algoPred) features['Algo Prediction'] = algoPred;
    
    if (paaPred && algoPred && paaPred === algoPred) {
         features['PAA/Algo Agreement'] = paaPred;
    } else if (paaPred && algoPred && paaPred.includes(algoPred.charAt(0))) {
         features['PAA/Algo Partial Agreement'] = paaPred;
    }

    if (match.patternAnalysis?.subPatternPrediction) features['Sub Pattern'] = match.patternAnalysis.subPatternPrediction;

    const seerPred = predictWithSeer(match, DEFAULT_WEIGHTS, phaStatsMap, matchStars, 'all');
    if (seerPred) features['Seer Base'] = seerPred;

    // Deep Learn features
    const seerScoreFav = getMatchScore(match, moFav as "1" | "2" | "X", DEFAULT_WEIGHTS, phaStatsMap, matchStars);
    const probFav = stats.probFav * 100;
    const paaFavRate = stats.paaStats.favWinRate;
    const paaUpsetRate = stats.paaStats.upsetRate;

    if (probFav >= 45) features['Prob Confidence'] = moFav || '1';
    if (paaFavRate >= 45) features['PAA Performance'] = moFav || '1';
    if (matchStars[match.id || ''] >= 3) features['Live PERF Data'] = moFav || '1';
    if (match.pred1x2) features['1X2 Prediction'] = match.pred1x2;
    if (match.rating && match.rating !== 'Unknown') features['1X2 Rating Boost'] = moFav || '1';
    if (paaPred === '1X' || paaPred === 'X2') features['Draw Strategy Boost'] = paaPred;
    if (seerScoreFav >= 50) features['Synergy Gap'] = moFav || '1';
    if (seerScoreFav >= 40 && probFav >= 40) features['Synergy Boost B'] = moFav || '1';
    if (probFav >= 45) features['Synergy Boost D'] = moFav || '1';
    if (paaFavRate >= 45) features['Synergy Boost E'] = moFav || '1';

    // 2. Synergy Boost A (Seer Score >= 50, Prob Confidence >= 45%, PAA >= 50%)
    if (seerScoreFav >= 50 && probFav >= 45 && paaFavRate >= 50) {
        features['Synergy Boost A (High Confidence)'] = moFav;
    }

    // 3. Synergy Boost C (Prob Confidence >= 50%, PAA >= 50%)
    if (probFav >= 50 && paaFavRate >= 50) {
        features['Synergy Boost C (Prob & PAA)'] = moFav;
    }

    // 4. Upset Potential (paa.upsetWin >= 30%)
    if (paaUpsetRate >= 30) {
         features['Upset Potential (PAA >= 30%)'] = moUnd;
    }
    
    // 8. Matches with PAA Upset rates > 30%
    if (paaUpsetRate > 30) {
        features['High PAA Upset Rate (>30%)'] = moUnd;
    }

    // 5. Matches with High Team Strength Diff (> 1.0) 
    const tsa = match.tsa || 0;
    const tsb = match.tsb || 0;
    const tsDiff = Math.abs(tsa - tsb);
    if (tsDiff > 1.0) {
        features['High Team Strength Diff (>1.0)'] = tsa > tsb ? '1' : '2';
    }

    // 6. Volatile patterns with Equal GS/GA produce unpredictable results.
    const gsHome = match.gsHome || 0;
    const gaHome = match.gaHome || 0;
    const gsAway = match.gsAway || 0;
    const gaAway = match.gaAway || 0;
    if (gsHome === gaHome && gsAway === gaAway) {
        features['Volatile Equal GS/GA'] = '1X2';
    }

    // 7. Extreme Disagreement
    if (paaPred && algoPred && paaPred !== algoPred && !paaPred.includes(algoPred.charAt(0)) && !algoPred.includes(paaPred.charAt(0))) {
         features['Extreme Disagreement'] = moFav; // Will act as a penalty against favorite if weight is negative
    }

    // 8. Underdog Score > 30%
    const seerScoreUnd = getMatchScore(match, moUnd as "1" | "2" | "X", DEFAULT_WEIGHTS, phaStatsMap, matchStars);
    if (seerScoreUnd > 30 || paaUpsetRate > 30) {
         features['High Underdog Risk (>30%)'] = moFav; // Assign to fav so a negative weight penalizes fav, or assign to underdog if positive
    }

    // New AI Analyst Requested Agreements
    const m1X2Pred = match.pred1x2 || '';
    
    // Check overlaps - using the favorite outcome or the actual prediction string
    // Helper to check if a group of predictions agree on a common outcome (e.g. all contain '1')
    const checkAgreement = (preds: (string|undefined)[], outcome: string) => {
        return preds.every(p => p && p.includes(outcome));
    };

    ['1', 'X', '2'].forEach(outcome => {
        const hasPaa = paaPred?.includes(outcome);
        const hasAlgo = algoPred?.includes(outcome);
        const hasSeer = seerPred?.includes(outcome);
        const hasSub = match.patternAnalysis?.subPatternPrediction?.includes(outcome);
        const has1x2 = m1X2Pred?.includes(outcome);

        if (hasPaa && hasAlgo && hasSeer && hasSub && has1x2) {
            features['PAA/Algo/Seer/Sub/1X2 Full Sync'] = outcome;
        } else if (hasPaa && hasAlgo && hasSeer && hasSub) {
            features['PAA/Algo/Seer/Sub Agreement'] = outcome;
        } else if (hasPaa && hasAlgo && hasSeer && has1x2) {
            features['PAA/Algo/Seer/1X2 Agreement'] = outcome;
        } else if (hasPaa && hasAlgo && hasSub && has1x2) {
            features['PAA/Algo/Sub/1X2 Agreement'] = outcome;
        } else if (hasAlgo && hasSeer && hasSub && has1x2) {
            features['Algo/Seer/Sub/1X2 Agreement'] = outcome;
        } else if (hasPaa && hasAlgo && hasSeer) {
            features['PAA/Algo/Seer Agreement'] = outcome;
        }
    });

    if (paaPred === '1X' || paaPred === 'X2') {
        features['PAA Pred is 1X/X2'] = paaPred;
    }
    if (paaPred === '12') {
        features['PAA Pred is 12'] = paaPred;
    }

    if (stats.phaFavSupport >= 60) features['PHA High Fav Support'] = moFav || '1';
    if (stats.phaDrawSupport >= 60) features['PHA High Draw Support'] = 'X';
    if (stats.favOdds >= 2.0 && stats.phaFavSupport > 40) features['Value Bet Signal'] = moFav || '1';

    return features;
};

let cachedSupremeWeights: SupremeWeightsMap | null = null;

export const clearSupremeWeightsCache = () => {
    cachedSupremeWeights = null;
};

export const saveCustomWeights = (weightsMap: SupremeWeightsMap) => {
    try {
        const customOnly: Record<string, Record<string, { goalAccuracy: number; overallAccuracy: number }>> = {};
        Object.keys(weightsMap).forEach(cat => {
            customOnly[cat] = {};
            Object.keys(weightsMap[cat]).forEach(feat => {
                if (typeof weightsMap[cat][feat].goalAccuracy === 'number') {
                    customOnly[cat][feat] = {
                        goalAccuracy: weightsMap[cat][feat].goalAccuracy,
                        overallAccuracy: weightsMap[cat][feat].overallAccuracy
                    };
                }
            });
        });
        localStorage.setItem('local_supreme_custom_weights', JSON.stringify(customOnly));
        localStorage.setItem('local_supreme_weights_map', JSON.stringify(weightsMap));
        
        // Sync custom weights and full weights to Supabase
        debouncedSyncToSupabase('local_supreme_custom_weights');
        debouncedSyncToSupabase('local_supreme_weights_map');

        // Direct database upsert into supreme_custom_weights table for maximum durability
        saveSupremeWeightsToDb(weightsMap).catch(err => {
            console.error("Failed to save supreme custom weights to database:", err);
        });
        
        // Force immediate sync to bypass debounce delay and save user edits safely on exit/refresh
        forceSyncToSupabase().catch(err => {
            console.warn("Failed immediate Supabase sync, falling back to debounced sync:", err);
        });
    } catch (e) {
        console.error("Failed to save custom weights to persistent storage:", e);
    }
};

export const getSupremeWeights = (
    history: Match[],
    phaStatsMap: Record<string, any>,
    matchStars: Record<string, number>
): SupremeWeightsMap => {
    // If cache exists and is already fully initialized with historical records, use it.
    // However, if the current history is non-empty but the cached version has zero hits (was loaded with empty history during loading phase),
    // we should re-compute to populate hits/accuracy while preserving the custom goalAccuracy values.
    // Force reset for top10 category weights to ensure new updates apply immediately
    const forceResetKey = 'prm_supreme_top12_weights_reset_v4';
    if (localStorage.getItem(forceResetKey) !== 'true') {
        try {
            localStorage.setItem(forceResetKey, 'true');
            const customSaved = localStorage.getItem('local_supreme_custom_weights');
            let parsed = customSaved ? JSON.parse(customSaved) : {};
            parsed['top10'] = DEFAULT_SUPREME_TOP10_WEIGHTS;
            localStorage.setItem('local_supreme_custom_weights', JSON.stringify(parsed));
            cachedSupremeWeights = null;
        } catch (e) {
            // ignore
        }
    }

    if (cachedSupremeWeights) {
        const hasLoadedData = Object.values(cachedSupremeWeights['best_bet'] || {}).some(w => w.totalHits > 0);
        if (history.length === 0 || hasLoadedData) {
            return cachedSupremeWeights;
        }
    }

    const computed = calculateSupremeWeights(history, phaStatsMap, matchStars);

    // Bulletproof custom weights restoration block
    const customGoalAccuracies: Record<string, Record<string, { goalAccuracy: number; overallAccuracy: number }>> = {};
    let customLoaded = false;

    // 1. Try reading from primary local_supreme_custom_weights
    try {
        const customSaved = localStorage.getItem('local_supreme_custom_weights');
        if (customSaved) {
            const parsed = JSON.parse(customSaved);
            if (parsed && typeof parsed === 'object') {
                Object.keys(parsed).forEach(cat => {
                    if (parsed[cat] && typeof parsed[cat] === 'object') {
                        Object.keys(parsed[cat]).forEach(feat => {
                            if (typeof parsed[cat][feat] === 'number') {
                                if (!customGoalAccuracies[cat]) customGoalAccuracies[cat] = {};
                                customGoalAccuracies[cat][feat] = {
                                    goalAccuracy: parsed[cat][feat],
                                    overallAccuracy: parsed[cat][feat]
                                };
                                customLoaded = true;
                            } else if (typeof parsed[cat][feat] === 'object' && parsed[cat][feat] !== null) {
                                if (!customGoalAccuracies[cat]) customGoalAccuracies[cat] = {};
                                customGoalAccuracies[cat][feat] = {
                                    goalAccuracy: parsed[cat][feat].goalAccuracy,
                                    overallAccuracy: parsed[cat][feat].overallAccuracy
                                };
                                customLoaded = true;
                            }
                        });
                    }
                });
            }
        }
    } catch (e) {
        console.error("Error loading local_supreme_custom_weights:", e);
    }

    // 2. Try reading from local_supreme_weights_map as a fallback
    try {
        const savedMap = localStorage.getItem('local_supreme_weights_map');
        if (savedMap) {
            const parsedMap = JSON.parse(savedMap) as SupremeWeightsMap;
            if (parsedMap && typeof parsedMap === 'object') {
                Object.keys(parsedMap).forEach(cat => {
                    if (parsedMap[cat] && typeof parsedMap[cat] === 'object') {
                        Object.keys(parsedMap[cat]).forEach(feat => {
                            const item = parsedMap[cat][feat];
                            if (item && typeof item.goalAccuracy === 'number') {
                                if (!customGoalAccuracies[cat]) customGoalAccuracies[cat] = {};
                                if (!customGoalAccuracies[cat][feat]) {
                                    customGoalAccuracies[cat][feat] = {
                                        goalAccuracy: item.goalAccuracy,
                                        overallAccuracy: item.overallAccuracy || item.goalAccuracy
                                    };
                                    customLoaded = true;
                                }
                            }
                        });
                    }
                });
            }
        }
    } catch (e) {
        console.error("Error loading local_supreme_weights_map fallback:", e);
    }

    // Always ensure top10 defaults to DEFAULT_SUPREME_TOP10_WEIGHTS if not explicitly set
    if (!customGoalAccuracies['top10']) {
        customGoalAccuracies['top10'] = {};
        Object.entries(DEFAULT_SUPREME_TOP10_WEIGHTS).forEach(([feat, val]) => {
            customGoalAccuracies['top10'][feat] = { goalAccuracy: val, overallAccuracy: val };
        });
        customLoaded = true;
    } else {
        Object.entries(DEFAULT_SUPREME_TOP10_WEIGHTS).forEach(([feat, val]) => {
            if (customGoalAccuracies['top10'][feat] === undefined) {
                customGoalAccuracies['top10'][feat] = { goalAccuracy: val, overallAccuracy: val };
            }
        });
    }

    // Merge restored custom values into computed map
    if (customLoaded) {
        Object.keys(customGoalAccuracies).forEach(cat => {
            if (!computed[cat]) computed[cat] = {};
            
            Object.keys(customGoalAccuracies[cat]).forEach(feat => {
                if (!computed[cat][feat]) {
                    computed[cat][feat] = {
                        featureName: feat,
                        overallAccuracy: 50,
                        goalAccuracy: 10,
                        totalHits: 1,
                        correctHits: 1,
                        goalCorrect: 1
                    };
                }
                computed[cat][feat].goalAccuracy = customGoalAccuracies[cat][feat].goalAccuracy;
                if (typeof customGoalAccuracies[cat][feat].overallAccuracy === 'number') {
                    computed[cat][feat].overallAccuracy = customGoalAccuracies[cat][feat].overallAccuracy;
                }
            });
        });
    }

    if (history.length > 0) {
        cachedSupremeWeights = computed;
        try {
            localStorage.setItem('local_supreme_weights_map', JSON.stringify(computed));
        } catch (e) {
            // ignore storage errors
        }
    }

    return computed;
};

export const calculateSupremeWeights = (
    history: Match[], 
    phaStatsMap: Record<string, any>, 
    matchStars: Record<string, number>,
    includePending: boolean = false
): SupremeWeightsMap => {
    const categories = ['best_bet', 'top10', 'botb_best', 'top20', 'bankers_jackpot', 'bankers_dlive', 'value_bets', 'value_picks', 'banker_draws', 'upsets'];
    const weightsMap: SupremeWeightsMap = {};

    const FEATURES = [
        'PAA Prediction', 'Algo Prediction', 'PAA/Algo Agreement', 'PAA/Algo Partial Agreement',
        'Sub Pattern', 'Seer Base', 'Synergy Boost A (High Confidence)', 'Synergy Boost B',
        'Synergy Boost C (Prob & PAA)', 'Synergy Boost D', 'Synergy Boost E',
        'Prob Confidence', 'PAA Performance', 'Live PERF Data', '1X2 Prediction',
        '1X2 Rating Boost', 'Draw Strategy Boost', 'Synergy Gap',
        'Upset Potential (PAA >= 30%)', 'High PAA Upset Rate (>30%)', 'High Team Strength Diff (>1.0)',
        'Volatile Equal GS/GA', 'PHA High Fav Support', 'PHA High Draw Support', 'Value Bet Signal',
        'Extreme Disagreement', 'High Underdog Risk (>30%)', 'PAA/Algo/Seer/Sub/1X2 Full Sync',
        'PAA/Algo/Seer/Sub Agreement', 'PAA/Algo/Seer/1X2 Agreement', 'PAA/Algo/Sub/1X2 Agreement',
        'Algo/Seer/Sub/1X2 Agreement', 'PAA/Algo/Seer Agreement', 'PAA Pred is 1X/X2', 'PAA Pred is 12'
    ];

    categories.forEach(cat => {
        weightsMap[cat] = {};
        FEATURES.forEach(feat => {
            const defaultVal = cat === 'top10' && DEFAULT_SUPREME_TOP10_WEIGHTS[feat] !== undefined
                ? DEFAULT_SUPREME_TOP10_WEIGHTS[feat]
                : 10;
            weightsMap[cat][feat] = {
                featureName: feat,
                overallAccuracy: defaultVal,
                goalAccuracy: defaultVal,
                totalHits: 1,
                correctHits: 1,
                goalCorrect: 1
            };
        });
    });

    history.forEach(match => {
        let actualResult = getActualResult(match.result);
        if (!actualResult || actualResult === 'pending') {
            if (includePending) {
                actualResult = match.algoReport?.prediction || match.calculatedPrediction || match.paaPrediction || '1';
            } else {
                return;
            }
        }

        const tags = match.evaluatorTags && match.evaluatorTags.length > 0 
            ? match.evaluatorTags 
            : (match.evaluatorTags = getMatchEvaluatorTags(match, phaStatsMap, false, true, matchStars));
            
        const matchCategories = new Set<string>();
        
        tags.forEach(tag => {
            const cat = tag.split(':')[0];
            if (categories.includes(cat)) {
                matchCategories.add(cat);
            }
        });

        if (matchCategories.size === 0) return;

        const features = extractMatchFeatures(match, phaStatsMap, matchStars);

        matchCategories.forEach(cat => {
            Object.entries(features).forEach(([featureName, featurePred]) => {
                if (!weightsMap[cat][featureName]) {
                    const defaultVal = cat === 'top10' && DEFAULT_SUPREME_TOP10_WEIGHTS[featureName] !== undefined
                        ? DEFAULT_SUPREME_TOP10_WEIGHTS[featureName]
                        : 10;
                    weightsMap[cat][featureName] = { 
                        featureName, 
                        overallAccuracy: defaultVal, 
                        goalAccuracy: defaultVal, 
                        totalHits: 0, 
                        correctHits: 0,
                        goalCorrect: 0
                    };
                }
                
                weightsMap[cat][featureName].totalHits++;
                if (matchesPrediction(featurePred, actualResult)) {
                    weightsMap[cat][featureName].correctHits++;
                }
                if (isMatchGoalAccurate(match, featurePred, actualResult, cat, phaStatsMap)) {
                    if (weightsMap[cat][featureName].goalCorrect === undefined) {
                        weightsMap[cat][featureName].goalCorrect = 0;
                    }
                    weightsMap[cat][featureName].goalCorrect!++;
                }
            });
        });
    });

    Object.keys(weightsMap).forEach(cat => {
        Object.keys(weightsMap[cat]).forEach(feat => {
            const w = weightsMap[cat][feat];
            if (cat === 'top10' && DEFAULT_SUPREME_TOP10_WEIGHTS[feat] !== undefined) {
                // Preserve Top 12 explicit default weights unless user customizes them
            } else if (w.totalHits > 0) {
                w.overallAccuracy = (w.correctHits / w.totalHits) * 100;
                w.goalAccuracy = w.goalCorrect !== undefined ? (w.goalCorrect / w.totalHits) * 100 : 0;
            } else {
                w.overallAccuracy = 50;
                w.goalAccuracy = 10;
            }
        });
    });

    return weightsMap;
};

export const predictWithSupreme = (
    match: Match, 
    category: string, 
    weightsMap: SupremeWeightsMap, 
    phaStatsMap: Record<string, any>, 
    matchStars: Record<string, number>
): { score1: number, scoreX: number, score2: number, finalPrediction: string, matchingFeatures: string[] } => {
    
    let score1 = 0;
    let scoreX = 0;
    let score2 = 0;
    const matchingFeatures: string[] = [];

    const features = extractMatchFeatures(match, phaStatsMap, matchStars);
    const catWeights = weightsMap[category] || {};

    Object.entries(features).forEach(([featureName, featurePred]) => {
        const weightObj = catWeights[featureName];
        if (weightObj) { 
            const weightVal = weightObj.goalAccuracy;
            if (weightVal > 0) {
                if (featurePred.includes('1')) score1 += weightVal;
                if (featurePred.includes('X')) scoreX += weightVal;
                if (featurePred.includes('2')) score2 += weightVal;
                
                matchingFeatures.push(`${featureName} (${weightVal.toFixed(1)}%) -> ${featurePred}`);
            }
        }
    });

    // We should rely on the learned weights rather than hardcoding a 1000 score override.
    // However, if the category is 'upsets', we might want to ensure the final prediction defaults to the underdog if it's strongly suggested.
    // The previous logic blindly assigned +1000 based on PAA > 30, which broke upsets.

    let finalPrediction = '';
    const threshold = 1; 
    
    const scores = [
        { outcome: '1', s: score1 },
        { outcome: 'X', s: scoreX },
        { outcome: '2', s: score2 }
    ].sort((a, b) => b.s - a.s);

    if (scores[0].s >= threshold) {
        finalPrediction = scores[0].outcome;
        if (scores[1].s >= threshold * 0.7 && category !== 'bankers_jackpot' && category !== 'bankers_dlive') { 
             if (scores[0].outcome === '1' && scores[1].outcome === 'X') finalPrediction = '1X';
             else if (scores[0].outcome === 'X' && scores[1].outcome === '1') finalPrediction = '1X';
             else if (scores[0].outcome === '2' && scores[1].outcome === 'X') finalPrediction = 'X2';
             else if (scores[0].outcome === 'X' && scores[1].outcome === '2') finalPrediction = 'X2';
             else if (scores[0].outcome === '1' && scores[1].outcome === '2') finalPrediction = '12';
        }

        if (category === 'banker_draws') {
            // Force hedge for banker draws
            if (scores[0].outcome === 'X') {
                 if (scores[1].outcome === '1') finalPrediction = '1X';
                 else if (scores[1].outcome === '2') finalPrediction = 'X2';
                 else {
                     // Determine favorite to hedge with
                     const stats = getMatchStats(match, phaStatsMap);
                     finalPrediction = stats.moFav === '1' ? '1X' : 'X2';
                 }
            } else if (scores[0].outcome === '1') {
                 finalPrediction = '1X';
            } else if (scores[0].outcome === '2') {
                 finalPrediction = 'X2';
            }
        }
    }

    return { score1, scoreX, score2, finalPrediction, matchingFeatures };
};
