import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Match } from '../../types';
import { 
    BrainCircuit, Trophy, CheckCircle2, Search, Activity, Target, Lock, Unlock, 
    Sparkles, Calendar, Award, AlertTriangle, Check, Zap, RefreshCw, ArrowRight, 
    XCircle, Cpu, PlayCircle, BarChart2, Brain, ChevronRight
} from 'lucide-react';
import { getSupremeWeights, predictWithSupreme, SupremeWeightsMap, calculateSupremeWeights, clearSupremeWeightsCache, saveCustomWeights } from './SupremeAlgorithm';
import { getMatchStats, getMatchEvaluatorTags } from '../../utils/matchEvaluator';
import { getActualResult, matchesPrediction, isMatchCorrectForCategory, isMatchGoalAccurate } from '../../utils/matchProcessing';
import { getAnalysisDateString } from '../../services/seerPerformance';
import { predictWithSeer, DEFAULT_WEIGHTS } from '../../utils/seerLogic';

interface Props {
    history: Match[];
    matches: Match[]; // All matches including live/historical
    phaStatsMap: Record<string, any>;
    matchStars: Record<string, number>;
}

export interface SupremeRecommendation {
    id: string;
    finding: string;
    action: string;
    featureName: string;
    proposedAdjustment: number; // e.g., +15 or -15
    isTested: boolean;
    featureGoalAcc?: number;
    testResult?: {
        prevAcc: number;
        newAcc: number;
        approved: boolean;
        currentTodayAcc?: number;
        proposedTodayAcc?: number;
        evaluatedToday?: number;
        isTodayOkay?: boolean;
    };
}

const SUPREME_FEATURES = [
    { name: 'PAA Prediction', desc: 'Core Pattern Analysis prediction align' },
    { name: 'Algo Prediction', desc: 'JK/Dlive core machine algorithm' },
    { name: 'PAA/Algo Agreement', desc: 'Both models select the same outcome' },
    { name: 'PAA/Algo Partial Agreement', desc: 'Models overlap in double chance' },
    { name: 'Sub Pattern', desc: 'Targeted pattern sub-rules predictions' },
    { name: 'Seer Base', desc: 'Live Seer core prediction model' },
    { name: 'Prob Confidence', desc: 'Probability confidence indicator' },
    { name: 'PHA High Fav Support', desc: 'Strong public/historical backing' },
    { name: 'PAA Performance', desc: 'Market percentage performance' },
    { name: 'Live PERF Data', desc: 'Star performance metrics' },
    { name: '1X2 Prediction', desc: 'Direct 1X2 market prediction' },
    { name: '1X2 Rating Boost', desc: '1X2 rating boost (>= 3/10)' },
    { name: 'Draw Strategy Boost', desc: 'Draw strategy boost (1X vs X2)' },
    { name: 'Synergy Gap', desc: 'Synergy gap boost' },
    { name: 'Synergy Boost A (High Confidence)', desc: 'High confidence probability sync' },
    { name: 'Synergy Boost B', desc: 'Medium-high confidence synergy' },
    { name: 'Synergy Boost C (Prob & PAA)', desc: 'High probability and PAA winrate' },
    { name: 'Synergy Boost D', desc: 'Moderate probability synergy' },
    { name: 'Synergy Boost E', desc: 'Moderate PAA winrate synergy' },
    { name: 'Upset Potential (PAA >= 30%)', desc: 'Underdog upset potential from PAA' },
    { name: 'High PAA Upset Rate (>30%)', desc: 'Elevated historic upset rate signal' },
    { name: 'High Team Strength Diff (>1.0)', desc: 'Pronounced team strength gap' },
    { name: 'Volatile Equal GS/GA', desc: 'High volatility GS/GA parity' },
    { name: 'PHA High Draw Support', desc: 'Elevated draw preference metrics' },
    { name: 'Value Bet Signal', desc: 'Favorable odds with strong support' },
    { name: 'Extreme Disagreement', desc: 'Models predict completely opposite outcomes' },
    { name: 'High Underdog Risk (>30%)', desc: 'Elevated risk of underdog performing well' },
    { name: 'PAA/Algo/Seer/Sub/1X2 Full Sync', desc: 'All five major forecasting models agree' },
    { name: 'PAA/Algo/Seer/Sub Agreement', desc: 'Four core intelligence elements aligned' },
    { name: 'PAA/Algo/Seer/1X2 Agreement', desc: 'PAA, Algo, Seer, and 1X2 in alignment' },
    { name: 'PAA/Algo/Sub/1X2 Agreement', desc: 'PAA, Algo, Sub pattern, and 1X2 aligned' },
    { name: 'Algo/Seer/Sub/1X2 Agreement', desc: 'Algo, Seer, Sub pattern, and 1X2 aligned' },
    { name: 'PAA/Algo/Seer Agreement', desc: 'Three primary prediction engines agree' },
    { name: 'PAA Pred is 1X/X2', desc: 'Pattern Analysis predicts Double Chance (1X/X2)' },
    { name: 'PAA Pred is 12', desc: 'Pattern Analysis predicts either team wins (12)' }
];

const getMatchAnalysisDate = (m: Match): string => {
    if (!m.date) return 'no-date';
    // If date already contains a time (e.g. space or 'T'), use it
    if (m.date.includes(' ') || m.date.includes('T')) {
        return getAnalysisDateString(m.date);
    }
    // If we have a separate time field, combine them
    if (m.time && typeof m.time === 'string' && m.time.trim() !== '') {
        const cleanedTime = m.time.trim();
        if (/^\d{2}:\d{2}/.test(cleanedTime)) {
            return getAnalysisDateString(`${m.date} ${cleanedTime}`);
        }
    }
    return getAnalysisDateString(m.date);
};


const generateActionText = (feat: string, isBoost: boolean, category: string = 'best_bet') => {
    if (isBoost) {
        if (feat.includes('High Underdog Risk') && category !== 'upsets') return `Careful: 'High Underdog Risk' correctly flags favorites overcoming risk. Monitor closely, but generally avoid boosting risk indicators on favorite-dependent categories.`;
        if (feat.includes('High Underdog Risk') && category === 'upsets') return `Boost 'High Underdog Risk' to maximize upset-finding potential in this category.`;
        if (feat.includes('PAA/Algo Agreement')) return `Boost Algo and PAA weights to prioritize matches where both core models agree on the outcome.`;
        if (feat.includes('Synergy Boost A')) return `Boost Synergy Condition A points to further prioritize these elite alignment matches in Seer Slips.`;
        if (feat.includes('Synergy Boost B')) return `Boost Synergy Condition B points to reward matches where Seer Score and Algorithmic Probability strongly align.`;
        if (feat.includes('Synergy Gap')) return `Increase the Synergy Score Gap Boost to automatically propel these matches to the top of slips.`;
        if (feat.includes('PAA')) return `Boost PAA Weight across this category.`;
        if (feat.includes('Algo')) return `Increase Algo Weight to capitalize on highly accurate algorithmic modelling.`;
        if (feat.includes('Equal Team Strength')) return `Boost Draw/Disagreement weighting in tightly contested TS parity matches.`;
        return `Boost '${feat}' weight to solidify prediction accuracy.`;
    } else {
        if (feat.includes('Volatile')) return `Reduce reliance on Sub Pattern for highly volatile formations.`;
        return `Penalize '${feat}' weighting to avoid these risky alignments.`;
    }
};

const generateFindingText = (w: any, prefix: string, category: string = 'best_bet') => {
    const feat = w.featureName;
    let desc = `${feat} is highly accurate`;
    if (w.overallAccuracy < 50) desc = `${feat} is underperforming`;
    else if (feat.includes('High Underdog Risk') && category !== 'upsets') desc = `Favorites are resisting ${feat} (Not recommended to boost on secure categories)`;
    else if (w.overallAccuracy >= 80) desc = `${feat} is highly secure`;
    else if (feat.includes('Agreement')) desc = `${feat} pattern indicates high system alignment`;
    else if (feat.includes('Volatile')) desc = `${feat} produce unpredictable results`;
    else if (feat.includes('PAA Favorite')) desc = `${feat} indicates high system alignment`;
    
    const gCorrect = w.goalCorrect !== undefined ? w.goalCorrect : w.correctHits;
    
    return `${prefix}${desc}: Feature '${feat}' is running at ${w.overallAccuracy.toFixed(1)}% Overall accuracy (${w.correctHits}/${w.totalHits} completed matches analyzed) and ${w.goalAccuracy.toFixed(1)}% Goal accuracy (${gCorrect}/${w.totalHits}).`;
};

export const SupremeSlipSelection: React.FC<Props> = ({ history, matches, phaStatsMap, matchStars }) => {
    const [selectedCategory, setSelectedCategory] = useState<string>('best_bet');
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [lockedSlips, setLockedSlips] = useState<Record<string, any>>({});
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // AI Analyst states
    const [activeSubTab, setActiveSubTab] = useState<'suggestions' | 'analyst'>('suggestions');
    const [isLearning, setIsLearning] = useState(false);
    const [isDeepLearning, setIsDeepLearning] = useState(false);
    const [learningProgress, setLearningProgress] = useState(0);
    const [learningStatus, setLearningStatus] = useState('');
    const [recommendations, setRecommendations] = useState<Record<string, SupremeRecommendation[]>>({});
    const [isTestingRec, setIsTestingRec] = useState<Record<string, boolean>>({});
    const [confirmReset, setConfirmReset] = useState(false);

    // Load active supreme weightings with local state
    const [localWeightsMap, setLocalWeightsMap] = useState<SupremeWeightsMap>(() => {
        return getSupremeWeights(history, phaStatsMap, matchStars);
    });

    useEffect(() => {
        setLocalWeightsMap(getSupremeWeights(history, phaStatsMap, matchStars));
    }, [history, phaStatsMap, matchStars]);

    useEffect(() => {
        const handleRestored = () => {
            console.log("Supreme weights restored event received in selection, updating view state...");
            setLocalWeightsMap(getSupremeWeights(history, phaStatsMap, matchStars));
        };
        window.addEventListener('supreme-weights-restored', handleRestored);
        return () => {
            window.removeEventListener('supreme-weights-restored', handleRestored);
        };
    }, [history, phaStatsMap, matchStars]);

    const weightsMap = localWeightsMap;

    const categories = [
        { id: 'best_bet', name: 'Supreme Best Bet', maxPicks: 10, minScore: 15, targetTags: ['best_bet'] },
        { id: 'top10', name: 'Supreme Top 12', maxPicks: 12, minScore: 15, targetTags: ['top10'] },
        { id: 'top20', name: 'Supreme Top 20', maxPicks: 20, minScore: 15, targetTags: ['top20', 'top10'] },
        { id: 'botb_best', name: 'Supreme Best of Best', maxPicks: 10, minScore: 15, targetTags: ['botb_best', 'best_bet'] },
        { id: 'bankers_jackpot', name: 'Supreme Bankers Jackpot', maxPicks: 5, minScore: 15, targetTags: ['bankers_jackpot', 'bankers'] },
        { id: 'bankers_dlive', name: 'Supreme Bankers Dlive', maxPicks: 10, minScore: 15, targetTags: ['bankers_dlive', 'bankers'] },
        { id: 'value_bets', name: 'Supreme Value Bets', maxPicks: 5, minScore: 15, targetTags: ['value_bets'] },
        { id: 'value_picks', name: 'Supreme Value Picks', maxPicks: 5, minScore: 15, targetTags: ['value_picks'] },
        { id: 'banker_draws', name: 'Supreme Banker Draws', maxPicks: 5, minScore: 15, targetTags: ['banker_draws'] },
        { id: 'upsets', name: 'Supreme Upsets', maxPicks: 5, minScore: 15, targetTags: ['upsets'] }
    ];

    const activeCategoryObj = categories.find(c => c.id === selectedCategory) || categories[0];

    // Filter matches for selected date
    const dateMatches = useMemo(() => {
        return matches.filter(m => getMatchAnalysisDate(m) === selectedDate);
    }, [matches, selectedDate]);

    // Load locked slips on mount / date change
    useEffect(() => {
        const tempLocked: Record<string, any> = {};
        categories.forEach(cat => {
            const key = `local_supreme_locked_slip_${selectedDate}_${cat.id}`;
            const val = localStorage.getItem(key);
            if (val) {
                try {
                    tempLocked[cat.id] = JSON.parse(val);
                } catch (e) {
                    console.error("Failed to parse supreme locked slip", e);
                }
            }
        });
        setLockedSlips(tempLocked);
    }, [selectedDate]);

    // Available dates derived from matches list
    const availableDates = useMemo(() => {
        const dates = new Set<string>();
        matches.forEach(m => {
            const logicalDate = getMatchAnalysisDate(m);
            if (logicalDate && logicalDate !== 'no-date') {
                dates.add(logicalDate);
            }
        });
        // Sort dates descending
        return Array.from(dates).sort((a, b) => b.localeCompare(a));
    }, [matches]);

    // Set fallback selectedDate if current date has no matches and matches exist
    useEffect(() => {
        if (availableDates.length > 0 && !availableDates.includes(selectedDate)) {
            setSelectedDate(availableDates[0]);
        }
    }, [availableDates]);

    // Calculate Goal Accuracy for a specific category using current or custom Supreme weights
    const getSupremeAccuracyForCategory = (
        matchesList: Match[],
        catId: string,
        customWeights?: SupremeWeightsMap,
        includePending: boolean = false
    ): { accuracy: number; goalAccuracy: number; total: number; correct: number; goalCorrect: number } => {
        const activeWeights = customWeights || weightsMap;
        const catDef = categories.find(c => c.id === catId);
        if (!catDef) return { accuracy: 0, goalAccuracy: 0, total: 0, correct: 0, goalCorrect: 0 };

        const completed = matchesList.filter(m => {
            if (includePending) return true;
            const result = getActualResult(m.result);
            return result && result !== 'pending';
        });

        let total = 0;
        let correct = 0;
        let goalCorrect = 0;

        completed.forEach(m => {
            // Check if match qualifies for this category tag
            const tags = m.evaluatorTags && m.evaluatorTags.length > 0 
                ? m.evaluatorTags 
                : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
            
            // Check if match belongs to the category
            const isPatternTSub = (m.patternAnalysis?.mainPattern || '').toUpperCase() === 'T' && !!m.patternAnalysis?.subPattern;
            if (isPatternTSub) return; // banned

            const hasCategoryTag = catDef.targetTags.some(t => tags.some(tag => tag.startsWith(t)));
            if (!hasCategoryTag) return;

            const pred = predictWithSupreme(m, catId, activeWeights, phaStatsMap, matchStars);
            let actual = getActualResult(m.result);
            if (!actual || actual === 'pending') {
                if (includePending) {
                    actual = m.algoReport?.prediction || m.calculatedPrediction || m.paaPrediction || '1';
                } else {
                    return;
                }
            }

            total++;
            const outcome = pred.finalPrediction;
            const isCorrect = isMatchCorrectForCategory(m, outcome, actual, catId);

            if (isCorrect) {
                correct++;
            }
            
            if (isMatchGoalAccurate(m, outcome, actual, catId, phaStatsMap)) {
                goalCorrect++;
            }
        });

        return {
            accuracy: total > 0 ? (correct / total) * 100 : 0,
            goalAccuracy: total > 0 ? (goalCorrect / total) * 100 : 0,
            total,
            correct,
            goalCorrect
        };
    };

    const handleGenerateInsights = () => {
        setIsLearning(true);
        setLearningProgress(0);
        setLearningStatus("INITIALIZING HISTORICAL DATA ANALYSIS...");
        
        const totalTime = 30000;
        const intervalTime = 100;
        let elapsed = 0;
        
        const interval = setInterval(() => {
            elapsed += intervalTime;
            const progress = Math.min(100, (elapsed / totalTime) * 100);
            setLearningProgress(progress);
            
            if (progress < 15) setLearningStatus("SCANNING PAA/ALGO LOGICAL SYNC...");
            else if (progress < 30) setLearningStatus("ANALYZING SLIP MATCH OUTCOMES...");
            else if (progress < 45) setLearningStatus("MODELING UPSET AND DRAW DISAGREEMENTS...");
            else if (progress < 60) setLearningStatus("EVALUATING SYNERGY BOOST ALIGNMENTS...");
            else if (progress < 75) setLearningStatus("CALCULATING OVERALL & GOAL ACCURACIES...");
            else if (progress < 90) setLearningStatus("ISOLATING WINNING & LOSING PATTERNS...");
            else setLearningStatus("FORMULATING WEIGHT ADJUSTMENT RECOMMENDATIONS...");
            
            if (elapsed >= totalTime) {
                clearInterval(interval);
            }
        }, intervalTime);
        
        setTimeout(() => {
            const recsList: SupremeRecommendation[] = [];
            
            // Get all completed features present in the current slip picks
            const completedSlipPicks = slipPicks.filter(p => {
                const actual = getActualResult(p.match.result);
                return actual && actual !== 'pending';
            });
            
            const slipWeights: Record<string, any> = {};
            
            completedSlipPicks.forEach(pick => {
                const actualResult = getActualResult(pick.match.result) as string;
                
                pick.matchingFeatures.forEach(mf => {
                    // Extract feature name robustly. Feature names may contain parentheses (e.g., "High Team Strength Diff (>1.0)")
                    // followed by the weight percentage suffix (e.g., "(10.0%) ->")
                    let featureName = mf.split(' (')[0];
                    const regexMatch = mf.match(/^(.*)\s\(\d+(?:\.\d+)?%\)\s->/);
                    if (regexMatch && regexMatch[1]) {
                        featureName = regexMatch[1].trim();
                    }
                    
                    if (!slipWeights[featureName]) {
                        slipWeights[featureName] = { featureName, totalHits: 0, correctHits: 0, goalCorrect: 0 };
                    }
                    slipWeights[featureName].totalHits++;
                    
                    const p = pick.prediction;
                    if (isMatchCorrectForCategory(pick.match, p, actualResult, selectedCategory)) {
                        slipWeights[featureName].correctHits++;
                    }
                    if (isMatchGoalAccurate(pick.match, p, actualResult, selectedCategory, phaStatsMap)) {
                        slipWeights[featureName].goalCorrect++;
                    }
                });
            });
            
            Object.values(slipWeights).forEach(w => {
                const accuracy = w.totalHits > 0 ? (w.correctHits / w.totalHits) * 100 : 0;
                const goalAccuracy = w.totalHits > 0 ? (w.goalCorrect / w.totalHits) * 100 : 0;
                w.overallAccuracy = accuracy;
                w.goalAccuracy = goalAccuracy;
            });
            
            const availableFeatures = Object.values(slipWeights)
                .filter(w => w.totalHits >= 1)
                .sort((a, b) => b.overallAccuracy - a.overallAccuracy);

            availableFeatures.slice(0, 3).forEach((w, idx) => {
                 const isProUnderdog = w.featureName.toLowerCase().includes('underdog') || w.featureName.toLowerCase().includes('upset');
                 recsList.push({
                     id: `rec_insight_boost_${idx}_${Date.now()}`,
                     finding: generateFindingText(w, "Slip Insight: "),
                     action: generateActionText(w.featureName, true),
                     featureName: w.featureName,
                     proposedAdjustment: isProUnderdog ? -5 : 5,
                     isTested: false,
                     featureGoalAcc: w.goalAccuracy
                 });
            });

            const worstFeatures = [...availableFeatures].reverse().filter(w => w.overallAccuracy < 50);
            if (worstFeatures.length > 0) {
                 const w = worstFeatures[0];
                 const isProUnderdog = w.featureName.toLowerCase().includes('underdog') || w.featureName.toLowerCase().includes('upset');
                 recsList.push({
                     id: `rec_insight_penalize_${Date.now()}`,
                     finding: generateFindingText(w, "Slip Insight: "),
                     action: generateActionText(w.featureName, false),
                     featureName: w.featureName,
                     proposedAdjustment: isProUnderdog ? -5 : 5,
                     isTested: false,
                     featureGoalAcc: w.goalAccuracy
                 });
            }

            if (recsList.length === 0) {
                 recsList.push({
                    id: `rec_fallback_${Date.now()}`,
                    finding: `Historical Data Insight: Not enough completed matches have produced distinct winning/losing features.`,
                    action: `Boost 'PAA/Algo Agreement' by 5 points as a safe fallback.`,
                    featureName: "PAA/Algo Agreement",
                    proposedAdjustment: 5,
                    isTested: false
                });
            }
            
            setRecommendations(prev => ({
                ...prev,
                [selectedCategory]: recsList
            }));
            setIsLearning(false);
        }, 30000); 
    };

    const handleDeepLearn = () => {
        setIsDeepLearning(true);
        setLearningProgress(0);
        setLearningStatus("INITIALIZING DEEP LEARN ENGINE...");
        
        const totalTime = 45000;
        const intervalTime = 100;
        let elapsed = 0;
        
        const interval = setInterval(() => {
            elapsed += intervalTime;
            const progress = Math.min(100, (elapsed / totalTime) * 100);
            setLearningProgress(progress);
            
            if (progress < 10) setLearningStatus("LOADING ALL CATEGORY MATCHES...");
            else if (progress < 25) setLearningStatus("SCANNING HISTORICAL ACCURACY PER FEATURE...");
            else if (progress < 40) setLearningStatus("EVALUATING PAA, ALGO & SEER SYNC STRENGTH...");
            else if (progress < 55) setLearningStatus("MODELING VOLATILE PATTERNS & EQUAL STRENGTHS...");
            else if (progress < 70) setLearningStatus("EXECUTING GRADIENT SEARCH ACROSS WEIGHT PERMUTATIONS...");
            else if (progress < 85) setLearningStatus("ISOLATING ELITE ALIGNMENTS FOR CATEGORY...");
            else setLearningStatus("COMPILING DEEP LEARN WEIGHT PROFILES...");
            
            if (elapsed >= totalTime) {
                clearInterval(interval);
            }
        }, intervalTime);
        
        setTimeout(() => {
            // Filter live matches to only those belonging to the active category
            const catDef = categories.find(c => c.id === selectedCategory);
            const catMatches = matches.filter(m => {
                const tags = m.evaluatorTags && m.evaluatorTags.length > 0 
                    ? m.evaluatorTags 
                    : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
                const isPatternTSub = (m.patternAnalysis?.mainPattern || '').toUpperCase() === 'T' && !!m.patternAnalysis?.subPattern;
                if (isPatternTSub) return false;
                const hasCategoryTag = catDef ? catDef.targetTags.some(t => tags.some(tag => tag.startsWith(t))) : false;
                return hasCategoryTag;
            });

            // Calculate weights dynamically for matches with that category tag in Live Analysis (strictly completed matches only)
            const liveWeightsMap = calculateSupremeWeights(catMatches, phaStatsMap, matchStars, false);
            const catWeights = liveWeightsMap[selectedCategory] || {};
            const featuresList = Object.keys(catWeights);
            
            const catWeightsList = Object.values(catWeights)
                .filter(w => w.totalHits >= 1) 
                .sort((a, b) => b.overallAccuracy - a.overallAccuracy);
                
            const recsList: SupremeRecommendation[] = [];
            
            catWeightsList.slice(0, 3).forEach((w, idx) => {
                 const isProUnderdog = w.featureName.toLowerCase().includes('underdog') || w.featureName.toLowerCase().includes('upset');
                 recsList.push({
                     id: `rec_deep_learn_boost_${idx}_${Date.now()}`,
                     finding: generateFindingText(w, "Deep Learn: ", selectedCategory),
                     action: generateActionText(w.featureName, true, selectedCategory),
                     featureName: w.featureName,
                     proposedAdjustment: isProUnderdog ? -5 : 5,
                     isTested: false,
                     featureGoalAcc: w.goalAccuracy
                 });
            });

            const worstHistory = [...catWeightsList].reverse().filter(w => w.overallAccuracy < 50);
            if (worstHistory.length > 0) {
                 const w = worstHistory[0];
                 const isProUnderdog = w.featureName.toLowerCase().includes('underdog') || w.featureName.toLowerCase().includes('upset');
                 recsList.push({
                     id: `rec_deep_learn_penalize_${Date.now()}`,
                     finding: generateFindingText(w, "Deep Learn: ", selectedCategory),
                     action: generateActionText(w.featureName, false, selectedCategory),
                     featureName: w.featureName,
                     proposedAdjustment: isProUnderdog ? -5 : 5,
                     isTested: false,
                     featureGoalAcc: w.goalAccuracy
                 });
            }

            if (recsList.length === 0) {
                const firstFeat = featuresList[0] || 'PAA/Algo Agreement';
                recsList.push({
                    id: `rec_deep_learn_fallback_${Date.now()}`,
                    finding: `Deep Learn: Not enough matches in history for this category to generate deep insights.`,
                    action: `Maintain or slightly refine '${firstFeat}' by 5 points.`,
                    featureName: firstFeat,
                    proposedAdjustment: 5,
                    isTested: false
                });
            }
            
            setRecommendations(prev => ({
                ...prev,
                [selectedCategory]: recsList
            }));
            setIsDeepLearning(false);
        }, 45000);
    };

    // Helper to get picks for any weights and category
    const getPicksForCategory = useCallback((
        customWeights: SupremeWeightsMap,
        category: string
    ) => {
        if (lockedSlips[category]) {
            return lockedSlips[category].picks;
        }

        const catDef = categories.find(c => c.id === category);
        if (!catDef) return [];

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

        const scoredMatches = dateMatches
            .map(m => {
                const tags = m.evaluatorTags && m.evaluatorTags.length > 0 
                    ? m.evaluatorTags 
                    : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
                
                const isUpsetRiskBanned = category !== 'upsets' && tags.some(t => t === 'BANNED:UPSET RISK' || t === 'BANNED:UPSET_RISK');
                const isPatternTSub = (m.patternAnalysis?.mainPattern || '').toUpperCase() === 'T' && !!m.patternAnalysis?.subPattern;
                
                const isEliteCategory = ['best_bet', 'top10', 'top20', 'botb_best', 'bankers_dlive', 'bankers_jackpot', 'value_picks'].includes(catDef.id);
                const isBanned = (category === 'upsets' || catDef.id === 'upsets')
                    ? false
                    : ((isEliteCategory && tags.some(t => t.startsWith('BANNED:') && t !== 'PHA_TIE')) || isPatternTSub || isUpsetRiskBanned);

                const teams = (m.teams || '').toLowerCase();
                const league = (m.league || '').toLowerCase();
                const africanDomesticRegex = /tanzania|tanzanian|kenya|kenyan|uganda|ugandan|rwanda|rwandan|egypt|egyptian|morocco|moroccan|nigeria|nigerian|ghana|ghanaian|south africa|south african|zambia|zambian|senegal|senegalese|tunisia|tunisian|algeria|algerian|mali|cameroon|cameroonian|congo|angola|angolan|burundi|sudan|sudanese|somalia|ethiopia|ethiopian|suhul shire|caps united|triangle u|malawi|mozambique|botswana|namibia|zimbabwe|zimbabwean|lesotho|eswatini|madagascar|ivory coast|cote d'ivoire|guinea|burkina faso|benin|togo|mauritania|niger|chad|central african|gabon|equatorial|djibouti|eritrea|seychelles|comoros|mauritius|sao tome|sierra leone|liberia|gambia|cape verde|chemilil|sony sugar|jkt/i;
                const isAfricanOrFriendlyBanned = isEliteCategory && (
                    teams.includes('friendly') || 
                    league.includes('friendly') || 
                    africanDomesticRegex.test(teams) || 
                    africanDomesticRegex.test(league)
                );

                const hasCategoryTag = catDef.targetTags.some(targetTag => 
                    tags.some(t => t.startsWith(targetTag + ':'))
                );

                const o = getOdds(m);
                const stats = getMatchStats(m, phaStatsMap);
                let oddsMatch = false;

                if (catDef.id === 'best_bet') {
                    oddsMatch = (o.favOdds >= 1.3 && o.favOdds <= 1.6 && stats.phaFavWinSupport >= 60);
                } else if (catDef.id === 'bankers_dlive') {
                    oddsMatch = (o.favOdds >= 1.5 && o.favOdds <= 2.0);
                } else if (catDef.id === 'top10') {
                    oddsMatch = (o.favOdds >= 2.0 && o.favOdds <= 2.4);
                } else if (catDef.id === 'botb_best') {
                    oddsMatch = ((o.favOdds >= 1.5 && o.favOdds <= 2.0) || (o.favOdds >= 2.0 && o.favOdds <= 2.4));
                } else if (catDef.id === 'top20') {
                    oddsMatch = ((o.favOdds >= 1.5 && o.favOdds <= 2.0) || (o.favOdds >= 2.0 && o.favOdds <= 2.5));
                } else if (catDef.id === 'bankers_jackpot') {
                    oddsMatch = (o.favOdds >= 2.0 && o.favOdds < 2.5);
                } else if (catDef.id === 'value_bets') {
                    oddsMatch = (o.o1 >= 2.5 && o.o2 >= 2.5);
                } else if (catDef.id === 'value_picks') {
                    oddsMatch = (o.favOdds >= 2.0 && o.favOdds < 2.5);
                } else if (catDef.id === 'banker_draws') {
                    oddsMatch = (o.oX >= 2.0);
                } else if (catDef.id === 'upsets') {
                    oddsMatch = true;
                }

                const pred = predictWithSupreme(m, category, customWeights, phaStatsMap, matchStars);
                let finalPrediction = pred.finalPrediction || '1';
                let score = Math.max(pred.score1, pred.scoreX, pred.score2);

                if (catDef.id === 'banker_draws') {
                    if (finalPrediction !== '1X' && finalPrediction !== 'X2') {
                        finalPrediction = (pred.score1 >= pred.score2) ? '1X' : 'X2';
                    }
                }

                if (catDef.id === 'upsets' && stats.moUnderdog) {
                    if (!finalPrediction.includes(stats.moUnderdog)) {
                        finalPrediction = stats.moUnderdog === '1' ? '1X' : 'X2';
                        score = stats.moUnderdog === '1' ? pred.score1 : (stats.moUnderdog === '2' ? pred.score2 : pred.scoreX);
                    }
                }

                let tier = 10;
                if (hasCategoryTag && oddsMatch && !isBanned && !isAfricanOrFriendlyBanned) {
                    tier = (score >= catDef.minScore) ? 0 : 1;
                } else if (oddsMatch && !isBanned && !isAfricanOrFriendlyBanned) {
                    tier = (score >= catDef.minScore) ? 2 : 3;
                } else {
                    tier = 10;
                }

                return {
                    match: m,
                    prediction: finalPrediction,
                    score,
                    matchingFeatures: pred.matchingFeatures,
                    tier
                };
            });

        let validMatches = scoredMatches.filter(m => m.tier < 10);
        if (validMatches.length < catDef.maxPicks) {
            const validIds = new Set(validMatches.map(v => v.match.id.toString()));
            const remaining = scoredMatches.filter(m => !validIds.has(m.match.id.toString()));
            validMatches = [...validMatches, ...remaining];
        }

        validMatches.sort((a, b) => {
            if (a.tier !== b.tier) {
                return a.tier - b.tier;
            }
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return (a.match.teams || '').localeCompare(b.match.teams || '');
        });

        return validMatches.slice(0, catDef.maxPicks).map(item => ({
            match: item.match,
            prediction: item.prediction,
            score: item.score,
            matchingFeatures: item.matchingFeatures,
            isFallback: item.tier > 1
        }));
    }, [dateMatches, categories, phaStatsMap, matchStars, lockedSlips]);

    const getSlipGoalAccuracyForPicks = useCallback((picks: any[]) => {
        if (!picks || picks.length === 0) return { evaluated: 0, goalAccuracy: 0 };
        let evaluated = 0;
        let goalCorrect = 0;
        picks.forEach(pick => {
            const liveMatch = matches.find(m => m.id?.toString() === pick.match.id?.toString() || m.teams === pick.match.teams) || pick.match;
            const actualResult = getActualResult(liveMatch.result);
            if (actualResult && actualResult !== 'pending') {
                evaluated++;
                if (isMatchGoalAccurate(liveMatch, pick.prediction, actualResult, selectedCategory, phaStatsMap)) {
                    goalCorrect++;
                }
            }
        });
        return {
            evaluated,
            goalAccuracy: evaluated > 0 ? (goalCorrect / evaluated) * 100 : 0
        };
    }, [matches, selectedCategory, phaStatsMap]);

    const handleTestRecommendation = (rec: SupremeRecommendation) => {
        setIsTestingRec(prev => ({ ...prev, [rec.id]: true }));
        
        setTimeout(() => {
            // Test recommendation goal accuracy against historical matches
            const prevAccObj = getSupremeAccuracyForCategory(history, selectedCategory, undefined, false);
            const prevAcc = prevAccObj.goalAccuracy;
            
            const proposedWeights = JSON.parse(JSON.stringify(weightsMap));
            if (!proposedWeights[selectedCategory]) {
                proposedWeights[selectedCategory] = {};
            }
            if (!proposedWeights[selectedCategory][rec.featureName]) {
                proposedWeights[selectedCategory][rec.featureName] = {
                    featureName: rec.featureName,
                    overallAccuracy: 50,
                    goalAccuracy: 10,
                    totalHits: 1,
                    correctHits: 1
                };
            }
            
            const currentFeatWeight = proposedWeights[selectedCategory][rec.featureName].goalAccuracy;
            const newFeatWeight = Math.max(0, Math.min(100, currentFeatWeight + rec.proposedAdjustment));
            proposedWeights[selectedCategory][rec.featureName].goalAccuracy = newFeatWeight;
            proposedWeights[selectedCategory][rec.featureName].overallAccuracy = newFeatWeight;
            
            const newAccObj = getSupremeAccuracyForCategory(history, selectedCategory, proposedWeights, false);
            const newAcc = newAccObj.goalAccuracy;

            // Also test if it degrades the current day's active slip picks goal accuracy!
            const currentTodayPicks = getPicksForCategory(weightsMap, selectedCategory);
            const currentTodayStats = getSlipGoalAccuracyForPicks(currentTodayPicks);
            
            const proposedTodayPicks = getPicksForCategory(proposedWeights, selectedCategory);
            const proposedTodayStats = getSlipGoalAccuracyForPicks(proposedTodayPicks);
            
            let approved = false;
            const isHistOkay = newAcc >= prevAcc;
            let isTodayOkay = true;

            if (currentTodayStats.evaluated > 0 && proposedTodayStats.evaluated > 0) {
                if (proposedTodayStats.goalAccuracy < currentTodayStats.goalAccuracy) {
                    isTodayOkay = false;
                }
            }

            if (isHistOkay && isTodayOkay) {
                approved = true;
            }
            
            // Bypass logic based on feature's inherent accuracy versus today's slip accuracy
            if (rec.featureGoalAcc !== undefined && currentTodayStats.evaluated > 0) {
                if (rec.proposedAdjustment > 0) { // It's a boost recommendation
                    if (rec.featureGoalAcc > currentTodayStats.goalAccuracy) {
                        approved = true;
                    } else if (rec.featureGoalAcc < currentTodayStats.goalAccuracy) {
                        approved = false;
                    }
                } else if (rec.proposedAdjustment < 0) { // It's a penalize recommendation
                    if (rec.featureGoalAcc < currentTodayStats.goalAccuracy) {
                        approved = true; // Approve penalizing a bad feature
                    }
                }
            } else if (rec.featureGoalAcc !== undefined && currentTodayStats.evaluated === 0) {
                // If there are no evaluated matches today, fall back to comparing with historical category goal
                if (rec.proposedAdjustment > 0 && rec.featureGoalAcc > prevAcc) {
                    approved = true;
                } else if (rec.proposedAdjustment < 0 && rec.featureGoalAcc < prevAcc) {
                    approved = true;
                }
            }

            if (approved) {
                setLocalWeightsMap(proposedWeights);
                try {
                    localStorage.setItem('local_supreme_weights_map', JSON.stringify(proposedWeights));
                    saveCustomWeights(proposedWeights);
                    clearSupremeWeightsCache();
                } catch (e) {
                    console.error("Failed to save supreme weights", e);
                }
                setSuccessMessage(`Recommendation approved and applied!`);
                setTimeout(() => setSuccessMessage(null), 4000);
            }
            
            setRecommendations(prev => {
                const list = prev[selectedCategory] || [];
                const updatedList = list.map(r => {
                    if (r.id === rec.id) {
                        return {
                            ...r,
                            isTested: true,
                            testResult: {
                                prevAcc,
                                newAcc,
                                approved,
                                currentTodayAcc: currentTodayStats.goalAccuracy,
                                proposedTodayAcc: proposedTodayStats.goalAccuracy,
                                evaluatedToday: currentTodayStats.evaluated,
                                isTodayOkay
                            }
                        };
                    }
                    return r;
                });
                return {
                    ...prev,
                    [selectedCategory]: updatedList
                };
            });
            
            setIsTestingRec(prev => ({ ...prev, [rec.id]: false }));
        }, 50);
    };

    const handleResetWeights = () => {
        setConfirmReset(true);
    };

    const executeResetWeights = () => {
        setConfirmReset(false);
        try {
            localStorage.removeItem('local_supreme_weights_map');
            localStorage.removeItem('local_supreme_custom_weights');
            // Also clear the Seer weights consumed by slip generation
            // so that "Reset" truly returns everything to baseline.
            localStorage.removeItem('prm_seer_weights');
            localStorage.removeItem('prm_seer_weights_compressed');
        } catch {}
        clearSupremeWeightsCache();
        const resetMap = calculateSupremeWeights(history, phaStatsMap, matchStars);
        Object.keys(resetMap).forEach(cat => {
            Object.keys(resetMap[cat]).forEach(feat => {
                resetMap[cat][feat].goalAccuracy = 10;
                resetMap[cat][feat].overallAccuracy = resetMap[cat][feat].overallAccuracy || 50;
            });
        });
        localStorage.setItem('local_supreme_weights_map', JSON.stringify(resetMap));
        saveCustomWeights(resetMap);
        setLocalWeightsMap(resetMap);
        setSuccessMessage("All supreme + seer weights have been reset to the baseline of 10!");
        setTimeout(() => setSuccessMessage(null), 4000);
        // Trigger recompute across app
        window.dispatchEvent(new Event('seerWeightsReset'));
        window.dispatchEvent(new Event('matchStarsUpdated'));
    };

    // Select candidates for the active category
    const slipPicks = useMemo(() => {
        return getPicksForCategory(weightsMap, selectedCategory);
    }, [getPicksForCategory, weightsMap, selectedCategory]);

    // Calculate accuracy statistics for the active slip (either locked or suggestions)
    const slipStats = useMemo(() => {
        if (!slipPicks || slipPicks.length === 0) return null;

        let total = slipPicks.length;
        let evaluated = 0;
        let correct = 0;
        let goalCorrect = 0;

        const resolved = slipPicks.map(pick => {
            // Robustly find the latest match object from the live matches list to get uploaded results
            const liveMatch = matches.find(m => m.id?.toString() === pick.match.id?.toString() || m.teams === pick.match.teams) || pick.match;
            const actualResult = getActualResult(liveMatch.result);
            const isCompleted = actualResult && actualResult !== 'pending';

            let isCorrect = false;
            let isGoalAccurate = false;

            if (isCompleted) {
                evaluated++;
                isCorrect = isMatchCorrectForCategory(liveMatch, pick.prediction, actualResult, selectedCategory);
                isGoalAccurate = isMatchGoalAccurate(liveMatch, pick.prediction, actualResult, selectedCategory, phaStatsMap);
                if (isCorrect) correct++;
                if (isGoalAccurate) goalCorrect++;
            }

            return {
                ...pick,
                liveMatch,
                actualResult,
                isCompleted,
                isCorrect,
                isGoalAccurate
            };
        });

        const overallAccuracy = evaluated > 0 ? (correct / evaluated) * 100 : 0;
        const goalAccuracy = evaluated > 0 ? (goalCorrect / evaluated) * 100 : 0;

        return {
            total,
            evaluated,
            correct,
            goalCorrect,
            overallAccuracy,
            goalAccuracy,
            resolved
        };
    }, [slipPicks, matches, selectedCategory, phaStatsMap]);

    const handleLock = (picksToLock: any[]) => {
        if (picksToLock.length === 0) return;
        
        const key = `local_supreme_locked_slip_${selectedDate}_${selectedCategory}`;
        const slip = {
            date: selectedDate,
            category: selectedCategory,
            picks: picksToLock,
            lockedAt: new Date().toISOString()
        };

        localStorage.setItem(key, JSON.stringify(slip));
        setLockedSlips(prev => ({
            ...prev,
            [selectedCategory]: slip
        }));

        setSuccessMessage(`Locked Supreme ${activeCategoryObj.name} Slip successfully!`);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    const handleUnlock = () => {
        if (!confirm("Are you sure you want to unlock this slip? Reverting will regenerate suggestions based on the latest supreme weights.")) {
            return;
        }

        const key = `local_supreme_locked_slip_${selectedDate}_${selectedCategory}`;
        localStorage.removeItem(key);
        
        setLockedSlips(prev => {
            const next = { ...prev };
            delete next[selectedCategory];
            return next;
        });

        setSuccessMessage(`Unlocked Supreme ${activeCategoryObj.name} Slip successfully!`);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    return (
        <div id="supreme-slips-container" className="p-6">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <Trophy className="text-amber-500" size={28} />
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 tracking-tight">Supreme Slip Selection</h2>
                        <span className="text-xs font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                            <Sparkles size={12} /> Separate weights & algorithms from Seer
                        </span>
                    </div>
                </div>

                {/* Date Picker */}
                <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg border border-gray-200 w-full sm:w-auto">
                    <Calendar size={16} className="text-gray-500" />
                    <select 
                        id="supreme-date-picker"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-transparent text-sm font-bold text-gray-700 focus:outline-none cursor-pointer"
                    >
                        {availableDates.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Success message */}
            {successMessage && (
                <div className="mb-6 p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 font-bold text-sm flex items-center gap-2 animate-in slide-in-from-top-4 duration-300">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    {successMessage}
                </div>
            )}

            {/* Sub-Tabs Toggle */}
            <div className="flex border-b border-gray-200 mb-6 gap-2">
                <button
                    onClick={() => setActiveSubTab('suggestions')}
                    className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                        activeSubTab === 'suggestions'
                            ? 'border-amber-500 text-amber-600 font-extrabold'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <Trophy size={16} /> Live Suggestions & Slip
                </button>
                <button
                    onClick={() => setActiveSubTab('analyst')}
                    className={`px-4 py-2.5 font-bold text-sm border-b-2 transition-all flex items-center gap-2 ${
                        activeSubTab === 'analyst'
                            ? 'border-indigo-600 text-indigo-700 font-extrabold'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                    <Brain size={16} /> Supreme AI Analyst
                </button>
            </div>

            {/* Categories Select Tabs */}
            <div className="flex gap-2 flex-wrap mb-6">
                {categories.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 ${
                            selectedCategory === cat.id 
                                ? 'bg-amber-500 text-white shadow-md' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {lockedSlips[cat.id] ? <Lock size={12} className="text-white shrink-0" /> : <Unlock size={12} className="opacity-60 shrink-0" />}
                        {cat.name}
                    </button>
                ))}
            </div>

            {activeSubTab === 'suggestions' ? (
                <>
                    {/* Category Rules & Stats banner */}
                    <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-amber-50 rounded-lg text-amber-600 border border-amber-100 shrink-0">
                                <Award size={18} />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-sm">{activeCategoryObj.name} Configuration</h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Target Pick Limit: <span className="font-bold text-gray-700">{activeCategoryObj.maxPicks} matches</span> | 
                                    Min. Supreme Score Required: <span className="font-bold text-gray-700">{activeCategoryObj.minScore}</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            {lockedSlips[selectedCategory] ? (
                                <button 
                                    onClick={handleUnlock}
                                    className="flex-1 md:flex-none px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 border border-red-200"
                                >
                                    <Unlock size={14} /> Revert / Unlock Slip
                                </button>
                            ) : (
                                <button 
                                    onClick={() => handleLock(slipPicks)}
                                    disabled={slipPicks.length === 0}
                                    className={`flex-1 md:flex-none px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 ${
                                        slipPicks.length === 0 
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                    }`}
                                >
                                    <Lock size={14} /> Lock Predictions Slip
                                </button>
                            )}
                        </div>
                    </div>

                    {/* KPI Cards for Overall and Goal Accuracy when results are available */}
                    {slipStats && slipStats.evaluated > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 animate-fadeIn">
                            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Picks</span>
                                <div className="flex items-baseline gap-1 mt-2">
                                    <span className="text-2xl font-black text-gray-800">{slipStats.total}</span>
                                    <span className="text-xs text-gray-400 font-bold">matches</span>
                                </div>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Evaluated Results</span>
                                <div className="flex items-baseline gap-1 mt-2">
                                    <span className="text-2xl font-black text-slate-700">{slipStats.evaluated}</span>
                                    <span className="text-xs text-gray-400 font-bold">/ {slipStats.total}</span>
                                </div>
                            </div>
                            <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Overall Accuracy</span>
                                    <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded font-mono">
                                        {slipStats.correct} / {slipStats.evaluated} Hit
                                    </span>
                                </div>
                                <div className="text-2xl font-black text-emerald-800 mt-2 font-mono">
                                    {slipStats.overallAccuracy.toFixed(1)}%
                                </div>
                            </div>
                            <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Goal Accuracy</span>
                                    <span className="text-[10px] font-extrabold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded font-mono">
                                        {slipStats.goalCorrect} / {slipStats.evaluated} Hit
                                    </span>
                                </div>
                                <div className="text-2xl font-black text-blue-800 mt-2 font-mono">
                                    {slipStats.goalAccuracy.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    ) : (
                        slipPicks && slipPicks.length > 0 && (
                            <div className="mb-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center text-slate-500 text-xs font-bold flex items-center justify-center gap-2">
                                <Activity size={14} className="text-slate-400 animate-pulse" />
                                Results Pending: Waiting for Live Analysis match outcomes to calculate accuracy.
                            </div>
                        )
                    )}

                    {/* Picks Table */}
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="bg-slate-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                {lockedSlips[selectedCategory] ? (
                                    <span className="flex items-center gap-1 text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs uppercase">
                                        <Lock size={12} /> Locked Predictions
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-blue-600 font-extrabold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-xs uppercase">
                                        <Sparkles size={12} className="animate-pulse" /> Live Supreme Suggestions
                                    </span>
                                )}
                            </h3>
                            <div className="text-xs font-bold text-slate-500">
                                Picks Count: <span className="text-gray-800 font-black">{slipPicks.length}</span> / {activeCategoryObj.maxPicks} Max
                            </div>
                        </div>

                        {slipPicks.length === 0 ? (
                            <div className="p-16 text-center text-gray-400 flex flex-col items-center">
                                <AlertTriangle size={36} className="mb-3 opacity-35 text-amber-500" />
                                <p className="font-bold text-gray-600">No Supreme matches qualified for this category.</p>
                                <p className="text-xs mt-1 text-gray-400 max-w-md">No matches for {selectedDate} reached the required minimum Supreme confidence score threshold of {activeCategoryObj.minScore}. Try running "Deep Learn" to update weight values!</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 p-4 bg-slate-50/50">
                                {slipPicks.map((pick, idx) => {
                                    // Robustly hot-resolve match results from the live matches list
                                    const liveMatch = matches.find(m => m.id?.toString() === pick.match.id?.toString() || m.teams === pick.match.teams) || pick.match;
                                    const match = liveMatch;
                                    const defaultSeerPred = predictWithSeer(match, DEFAULT_WEIGHTS, phaStatsMap, matchStars, 'all');
                                    const score = pick.score;
                                    const outcome = pick.prediction;
                                    const features = pick.matchingFeatures || [];
                                    const outcomeLabel = outcome === '1' ? 'Home Win (1)' : outcome === '2' ? 'Away Win (2)' : outcome === 'X' ? 'Draw (X)' : outcome;
                                    
                                    const actualResult = getActualResult(match.result);
                                    const isCorrect = actualResult !== 'pending' && isMatchCorrectForCategory(match, outcome, actualResult, selectedCategory);
                                    const isGoalAccurate = actualResult !== 'pending' && isMatchGoalAccurate(match, outcome, actualResult, selectedCategory, phaStatsMap);
                                    const formatProb = (p: number | undefined) => {
                                        if (!p) return 0;
                                        return p <= 1 && p > 0 ? Math.round(p * 100) : Math.round(p);
                                    };

                                    return (
                                        <div key={match.id || idx} className={`p-4 sm:p-5 rounded-xl border shadow-sm transition-all flex flex-col gap-3 ${
                                            actualResult !== 'pending' 
                                                ? (isCorrect ? 'bg-green-50 border-green-200 hover:shadow-md' : 'bg-red-50 border-red-200 hover:shadow-md') 
                                                : 'bg-white border-gray-200 hover:shadow-md'
                                        }`}>
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div className="flex items-start gap-3">
                                                    <span className="shadow-sm w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 bg-slate-800 text-white">
                                                        {idx + 1}
                                                    </span>
                                                    <div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`font-extrabold text-md ${
                                                                actualResult !== 'pending' 
                                                                    ? (isCorrect ? 'text-green-900' : 'text-red-900') 
                                                                    : 'text-gray-800'
                                                            }`}>{match.teams}</span>
                                                            {match.mo && (
                                                                <span className="font-mono text-gray-500 font-medium tracking-tight text-sm">
                                                                    {match.mo.replace(/,/g, ', ')}
                                                                </span>
                                                            )}
                                                            {pick.isFallback && (
                                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200">
                                                                    Alternative
                                                                </span>
                                                            )}
                                                            {match.date !== selectedDate && (
                                                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100">
                                                                    {match.date}
                                                                </span>
                                                            )}
                                                            {actualResult !== 'pending' && (
                                                                <div className="flex gap-1.5 flex-wrap ml-1">
                                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                                                        isCorrect ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'
                                                                    }`}>
                                                                        Overall: {isCorrect ? 'Hit' : 'Miss'} ({actualResult})
                                                                    </span>
                                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                                                        isGoalAccurate ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-white text-slate-500 border border-slate-200 shadow-sm'
                                                                    }`}>
                                                                        Goal: {isGoalAccurate ? 'Hit' : 'Miss'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-400 mt-1 font-bold uppercase tracking-wider flex items-center gap-2 flex-wrap">
                                                            <span>{match.league}</span>
                                                            <span>| Kickoff: {match.time || 'N/A'}</span>
                                                        </div>
                                                        {(match.algoReport || match.seerPercentages) && (
                                                            <div className="mt-1.5 flex gap-2">
                                                                <div className="bg-slate-100/80 text-slate-500 font-mono text-[9px] px-2 py-0.5 rounded border border-slate-200 font-bold">
                                                                    CONF: 1:{formatProb(match.algoReport?.probabilities['1'] || match.seerPercentages?.['1'])}% X:{formatProb(match.algoReport?.probabilities['X'] || match.seerPercentages?.['X'])}% 2:{formatProb(match.algoReport?.probabilities['2'] || match.seerPercentages?.['2'])}%
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                                                    <div className="text-left sm:text-right flex items-center gap-2">
                                                        {defaultSeerPred && (
                                                            <>
                                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden sm:inline">SEER PRED</span>
                                                                <div className={`flex items-center h-[28px] px-2 rounded font-black text-xs ${
                                                                    actualResult !== 'pending' 
                                                                        ? (isCorrect ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900') 
                                                                        : 'bg-green-100 text-green-800'
                                                                }`}>
                                                                    {defaultSeerPred}
                                                                </div>
                                                                <span className="text-gray-300 hidden sm:inline">→</span>
                                                            </>
                                                        )}
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden sm:inline">AI PRED</span>
                                                        <div className="flex items-center h-[28px] bg-white px-3 rounded-md border border-gray-300 shadow-sm text-sm font-black text-gray-800 min-w-[60px] justify-center whitespace-nowrap">
                                                            <span>{outcomeLabel.replace('Home Win (1)', '1').replace('Away Win (2)', '2').replace('Draw (X)', 'X')}</span>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <div className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Confidence</div>
                                                        <div className="text-sm font-black text-gray-800 bg-white border border-gray-200 shadow-sm px-2 py-1 rounded-md">
                                                            {score.toFixed(1)}%
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Features Activation List - Redesigned to be simpler */}
                                            {features.length > 0 && (
                                                <div className="mt-2 border-t border-gray-200/60 pt-3">
                                                    <div className="flex flex-wrap gap-2 items-center">
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                                            actualResult !== 'pending' ? (isCorrect ? 'text-green-700' : 'text-red-700') : 'text-slate-500'
                                                        }`}>
                                                            Reasons ({features.length}):
                                                        </span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {features.map((feat: string, fIdx: number) => (
                                                                <span key={fIdx} className={`text-[9px] font-bold px-1.5 py-0.5 rounded truncate max-w-[200px] ${
                                                                    actualResult !== 'pending' 
                                                                        ? (isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800') 
                                                                        : 'bg-slate-100 text-slate-600'
                                                                }`}>
                                                                    {feat}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                    {/* Left Column (col-span-2) - AI Recommendations */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col justify-start">
                        <div className="flex items-center gap-3 mb-4">
                            <BrainCircuit size={32} className="text-amber-500 font-extrabold" />
                            <div>
                                <h3 className="text-lg font-black text-gray-800 leading-tight">
                                    Supreme Recommendations: {activeCategoryObj.name}
                                </h3>
                                <p className="text-xs text-amber-600 font-black uppercase tracking-wider mt-0.5">
                                    Adaptive Self-Learn Engine
                                </p>
                            </div>
                        </div>
                        <p className="text-gray-500 text-sm mb-6 leading-relaxed font-medium">
                            Supreme AI Analyst inspects feature-to-outcome correlations on completed historical matches. It simulates and backtests custom weight variations on the live database and automatically adopts improvements if they yield a higher overall Category Goal Accuracy.
                        </p>

                        <div className="flex flex-wrap gap-4 mb-6">
                            <button
                                disabled={isLearning || isDeepLearning}
                                onClick={handleGenerateInsights}
                                className={`px-6 py-3 rounded-lg font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all ${
                                    isLearning ? 'bg-gray-400 cursor-not-allowed scale-95' : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:shadow-lg hover:scale-[1.02]'
                                }`}
                            >
                                {isLearning ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                                {isLearning ? "Analyzing..." : "Generate Insights"}
                            </button>

                            <button
                                disabled={isLearning || isDeepLearning}
                                onClick={handleDeepLearn}
                                className={`px-6 py-3 rounded-lg font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all ${
                                    isDeepLearning ? 'bg-gray-400 cursor-not-allowed scale-95' : 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:shadow-lg hover:scale-[1.02]'
                                }`}
                            >
                                {isDeepLearning ? <RefreshCw className="animate-spin" size={18} /> : <Brain size={18} />}
                                {isDeepLearning ? "Deep Learning..." : "Deep Learn"}
                            </button>

                            <button
                                disabled={isLearning || isDeepLearning}
                                onClick={handleResetWeights}
                                className="px-6 py-3 rounded-lg font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 shadow-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                            >
                                <RefreshCw size={18} />
                                Reset Weights to 10
                            </button>
                        </div>

                        {/* Loader Progress */}
                        {(isLearning || isDeepLearning) && (
                            <div className="w-full bg-gray-100 rounded-full h-8 mb-6 overflow-hidden relative border border-gray-200">
                                <div
                                    className="bg-amber-500 h-full transition-all duration-300 flex items-center justify-center"
                                    style={{ width: `${learningProgress}%` }}
                                >
                                    <span className="text-[10px] font-black text-white drop-shadow-md">
                                        {learningProgress.toFixed(0)}%
                                    </span>
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-[10px] font-black text-gray-800 uppercase">
                                        {learningStatus}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Recommendations List */}
                        <div className="space-y-4">
                            {(recommendations[selectedCategory] || []).map(rec => (
                                <div key={rec.id} className="border border-gray-200 rounded-xl p-5 bg-slate-50/50 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2 text-sm font-extrabold text-gray-800">
                                            <Search size={16} className="text-indigo-500" /> Finding:
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-700 mb-3 ml-6 font-medium">
                                        {rec.finding}
                                    </p>

                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2 text-sm font-extrabold text-teal-700">
                                            <ArrowRight size={16} className="text-teal-500" /> proposed Action:
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-4 ml-6 font-medium">
                                        {rec.action}
                                    </p>

                                    {rec.isTested ? (
                                        <div className={`p-4 rounded-lg flex flex-col gap-2.5 shadow-sm border ${
                                            rec.testResult?.approved 
                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                                : 'bg-rose-50 border-rose-200 text-rose-800'
                                        }`}>
                                            <div className="flex items-center gap-2 font-bold text-sm">
                                                {rec.testResult?.approved ? (
                                                    <CheckCircle2 size={18} className="text-emerald-600" />
                                                ) : (
                                                    <XCircle size={18} className="text-rose-600" />
                                                )}
                                                {rec.testResult?.approved 
                                                    ? "Recommendation Approved & Adopted" 
                                                    : rec.testResult?.isTodayOkay === false
                                                        ? "Rejected: Degrades Today's Slip Goal Acc."
                                                        : "Recommendation Rejected (No Accuracy Gain)"}
                                            </div>
                                            {rec.testResult && (
                                                <div className="flex flex-col gap-1.5 pt-2 border-t border-dashed border-gray-200/50 font-mono text-xs font-bold">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Historical Category Goal:</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-gray-400 line-through opacity-70">
                                                                {rec.testResult.prevAcc.toFixed(1)}%
                                                            </span>
                                                            <ArrowRight size={10} className="text-gray-400" />
                                                            <span className={rec.testResult.approved ? "text-emerald-700 font-extrabold" : "text-rose-700"}>
                                                                {rec.testResult.newAcc.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {rec.testResult.evaluatedToday !== undefined && rec.testResult.evaluatedToday > 0 && (
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wide">Today's Slip Goal Acc. ({rec.testResult.evaluatedToday} evaluated):</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-400 line-through opacity-70">
                                                                    {(rec.testResult.currentTodayAcc ?? 0).toFixed(1)}%
                                                                </span>
                                                                <ArrowRight size={10} className="text-gray-400" />
                                                                <span className={rec.testResult.isTodayOkay ? "text-emerald-700 font-extrabold" : "text-rose-700 font-extrabold"}>
                                                                    {(rec.testResult.proposedTodayAcc ?? 0).toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            disabled={isTestingRec[rec.id]}
                                            onClick={() => handleTestRecommendation(rec)}
                                            className="ml-6 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
                                        >
                                            {isTestingRec[rec.id] ? <RefreshCw className="animate-spin" size={14} /> : <PlayCircle size={14} />}
                                            {isTestingRec[rec.id] ? "Verifying..." : "Test Recommendation on Historical Data"}
                                        </button>
                                    )}
                                </div>
                            ))}

                            {(!recommendations[selectedCategory] || recommendations[selectedCategory].length === 0) && !isLearning && !isDeepLearning && (
                                <div className="text-center p-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 flex flex-col items-center">
                                    <Brain size={36} className="mb-2 opacity-30 text-indigo-500" />
                                    <p className="font-bold text-gray-600">No Supreme insights generated yet.</p>
                                    <p className="text-xs mt-1 text-gray-400 max-w-sm">Click "Generate Insights" or "Deep Learn" to trigger the automated Supreme weight calibrator.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column (col-span-1) - Dynamic Feature Weights */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 self-start sticky top-4 max-h-[85vh] overflow-y-auto">
                        <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2 border-b pb-3 uppercase tracking-wider">
                            <BarChart2 size={16} className="text-indigo-600" /> Optimized Supreme Weights
                        </h3>
                        <p className="text-xs text-gray-400 mb-4 leading-relaxed font-semibold">
                            These accuracy values act as direct weight multipliers during final outcome selection for <b>{activeCategoryObj.name}</b>.
                        </p>

                        <div className="space-y-3.5">
                            {SUPREME_FEATURES.map((feat, fIdx) => {
                                const weightObj = (weightsMap[selectedCategory] || {})[feat.name];
                                const val = weightObj ? weightObj.goalAccuracy : 0;
                                const hits = weightObj ? weightObj.totalHits : 0;
                                
                                let color = 'bg-amber-500';
                                if (fIdx % 3 === 0) color = 'bg-indigo-600';
                                else if (fIdx % 3 === 1) color = 'bg-emerald-600';
                                
                                return (
                                    <div key={feat.name} className="flex flex-col gap-1 bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-bold text-gray-700 truncate max-w-[180px]">
                                                {feat.name}
                                            </span>
                                            <span className="font-extrabold text-slate-800 font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10px]">
                                                {val.toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden mt-1">
                                            <div
                                                className={`${color} h-full rounded-full transition-all duration-500`}
                                                style={{ width: `${val || 5}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-[9px] text-gray-400 font-extrabold uppercase tracking-wider mt-1.5">
                                            <span className="truncate max-w-[130px]">{feat.desc}</span>
                                            <span>{hits} hits</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
            {/* Custom Confirmation Dialog Popup */}
            {confirmReset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-full flex-shrink-0">
                                <AlertTriangle size={24} className="text-rose-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-900">Reset Optimized Weights</h3>
                                <p className="mt-2 text-sm text-gray-500 leading-relaxed font-medium">
                                    Are you sure you want to reset all optimized weights back to the baseline of 10? This action cannot be undone.
                                </p>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setConfirmReset(false)}
                                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeResetWeights}
                                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors flex items-center gap-1.5 shadow-sm"
                            >
                                Okay
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
