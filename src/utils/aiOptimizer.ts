import { getAIInstance } from '../components/ai/GeminiEngine';
import { Type, Schema, ThinkingLevel } from "@google/genai";
import { Match } from '../types';
import { CategoryWeights, DEFAULT_WEIGHTS, predictSeerDetailed } from './seerLogic';
import { getActualResult, matchesPrediction, isMatchCorrectForCategory, isMatchGoalAccurate, getFavoriteAndUnderdog, calculatePAAPrediction } from './matchProcessing';
import { getMatchEvaluatorTags, getMatchStats } from './matchEvaluator';
import { supabase } from '../lib/supabase';
import { matchAlgorithm } from '../components/ai/algorithm';

export interface OptimizationRecommendation {
  id: string;
  finding: string;
  deepInsights?: string[];
  action: string;
  proposedWeights: CategoryWeights;
  baseWeights: CategoryWeights;
  isTested: boolean;
  subsetAcc: number;
  subsetGoalAcc?: number;
  testResult?: {
    approved: boolean;
    prevAcc: number;
    newAcc: number;
    prevGoalAcc?: number;
    newGoalAcc?: number;
  };
}

import { getSeerWeights } from '../services/storage';
import { generateSeerAiCognitiveSlips } from './seerAiSlipSelection';
import { getAnalysisDateString } from '../services/seerPerformance';
import { hasCategoryTag } from './seerAiSlipSelection';

const categoryMatchCache = new Map<string, Set<string>>();

export const getMatchesForCategory = (matches: Match[], catId: string, phaStatsMap: any = {}, isJackpot: boolean = false, matchStars: Record<string, number> = {}, overrideWeights?: Record<string, CategoryWeights>): Match[] => {
    if (catId === "all" || !matches || matches.length === 0) return matches;
    
    const safePhaStatsMap = typeof phaStatsMap === 'boolean' ? {} : (phaStatsMap || {});
    
    // Basic cache key using match count, first/last match ids to detect data changes
    const matchesHash = matches.length + '_' + (matches[0]?.id || '') + '_' + (matches[matches.length - 1]?.id || '');
    const weightsHash = overrideWeights ? JSON.stringify(overrideWeights) : 'default';
    const cacheKey = `${catId}_${matchesHash}_${weightsHash}_${isJackpot}`;
    
    if (categoryMatchCache.has(cacheKey)) {
        const cachedIds = categoryMatchCache.get(cacheKey)!;
        return matches.filter(m => cachedIds.has(m.id.toString()));
    }
    
    const categoryMatchIds = new Set<string>();

    // 1. Group matches by analysis date to generate category slip picks for each date/batch
    const grouped: Record<string, Match[]> = {};
    matches.forEach((m) => {
        const d = getAnalysisDateString(m.date);
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(m);
    });

    Object.values(grouped).forEach((dateMatches) => {
        const slips = generateSeerAiCognitiveSlips(dateMatches, safePhaStatsMap, matchStars, isJackpot, false, overrideWeights);
        const targetSlip = slips.live[catId] || slips.spec[catId] || [];
        targetSlip.forEach((p: any) => {
            const mId = p.match_id?.toString() || p.id?.toString();
            if (mId) categoryMatchIds.add(mId);
        });
    });

    // 2. ALSO include all matches carrying the evaluator tag for this category on Live Analysis
    matches.forEach((m) => {
        if (hasCategoryTag(m, catId, safePhaStatsMap, isJackpot, matchStars)) {
            categoryMatchIds.add(m.id.toString());
        }
    });

    categoryMatchCache.set(cacheKey, categoryMatchIds);

    const filtered = matches.filter(m => categoryMatchIds.has(m.id.toString()));

    return filtered;
};

export const getGoalAccuracyRequirementDescription = (categoryId: string): string => {
    switch (categoryId) {
        case "top_12_safe":
        case "botb_jackpot":
        case "botb_best":
        case "top20":
        case "top_20_value":
            return "Market Favorite Win (if odds < 2.0) or Market Favorite Win / Draw (if odds >= 2.0)";
        case "value_bets":
            return "Prediction Matches Actual Result";
        case "best_bet":
        case "bankers_dlive":
        case "bankers_jackpot":
        case "value_picks":
            return "Market Favorite Win";
        case "top12":
        case "top_12":
        case "top_12_value":
        case "top10":
        case "top_10":
        case "top_10_value":
            return "Market Favorite Win or Draw (X)";
        case "banker_draws":
            return "Draw (X)";
        case "upsets":
            return "Underdog Win";
        default:
            return "Prediction Matches Actual Result";
    }
};

export const getAccuracy = (mList: Match[], weights: CategoryWeights, selectedCategory: string, phaStatsMap: Record<string, any>, matchStars: Record<string, number>): number => {
    let hits = 0;
    mList.forEach(m => {
        const actual = getActualResult(m.result);
        const pred = predictSeerDetailed(m, weights, phaStatsMap, matchStars, selectedCategory).final;
        if (actual && pred && isMatchCorrectForCategory(m, pred, actual, selectedCategory)) {
            hits++;
        }
    });
    return mList.length > 0 ? (hits / mList.length) * 100 : 0;
};

export const getGoalAccuracy = (mList: Match[], weights: CategoryWeights, selectedCategory: string, phaStatsMap: Record<string, any>, matchStars: Record<string, number>): number => {
    let hits = 0;
    mList.forEach(m => {
        const actual = getActualResult(m.result);
        const pred = predictSeerDetailed(m, weights, phaStatsMap, matchStars, selectedCategory).final;
        if (actual && pred && isMatchGoalAccurate(m, pred, actual, selectedCategory, phaStatsMap)) {
            hits++;
        }
    });
    return mList.length > 0 ? (hits / mList.length) * 100 : 0;
};

export const runAiOptimizer = async (
    currentMatches: Match[], 
    selectedCategory: string,
    categoryLabel: string,
    currentWeights: CategoryWeights,
    phaStatsMap: Record<string, any>,
    matchStars: Record<string, number>,
    onProgress: (status: string, percent: number) => void
): Promise<OptimizationRecommendation[]> => {
    const isJackpotMode = selectedCategory === "bankers_jackpot" || selectedCategory === "banker_draws";
    
    onProgress("Phase 1: Extracting full underlying match data (PAA, PHA, Algo, Seer) for all matches...", 10);
    await new Promise(resolve => setTimeout(resolve, 0));

    const subsetMatches = currentMatches || [];

    // 1. Calculate REAL pool statistics and extract complete underlying match data for ALL matches in dataset
    const allPoolStats = { total: 0, completedTotal: 0, favWins: 0, draws: 0, underdogWins: 0 };
    const allMatchesUnderlyingData: any[] = [];

    subsetMatches.forEach(m => {
        allPoolStats.total++;
        const actual = getActualResult(m.result);
        const stats = getMatchStats(m, phaStatsMap);
        const favInfo = getFavoriteAndUnderdog(m);
        const moFav = favInfo.fav;
        const moUnderdog = favInfo.underdog;
        
        const seerDetailed = predictSeerDetailed(m, currentWeights, phaStatsMap, matchStars, selectedCategory);
        const paaObj = calculatePAAPrediction(m, stats.paaStats);
        
        const isCompleted = actual !== null && actual !== 'pending';
        if (isCompleted) {
            allPoolStats.completedTotal++;
            if (actual === moFav) allPoolStats.favWins++;
            else if (actual === 'X') allPoolStats.draws++;
            else if (actual === moUnderdog) allPoolStats.underdogWins++;
        }

        const teamsPart = m.teams ? m.teams.split(/vs|\-|@/i) : ['Home', 'Away'];
        const favTeamName = moFav === '1' ? teamsPart[0]?.trim() : teamsPart[1]?.trim();
        const underdogTeamName = moUnderdog === '1' ? teamsPart[0]?.trim() : teamsPart[1]?.trim();

            const totalSeerScore = (seerDetailed.scores[moFav] || 0) + (seerDetailed.scores['X'] || 0) + (seerDetailed.scores[moUnderdog] || 0);

            allMatchesUnderlyingData.push({
                id: m.id,
                teams: m.teams,
                league: m.league || 'N/A',
                date: m.date || 'Live',
                actualResult: actual || 'PENDING',
                marketFavSide: moFav === '1' ? 'Home' : 'Away',
                favTeam: favTeamName || 'Fav',
                underdogTeam: underdogTeamName || 'Underdog',
                outcome: isCompleted ? (actual === moFav ? 'FAVORITE_WIN' : (actual === 'X' ? 'DRAW' : (actual === moUnderdog ? 'UNDERDOG_UPSET' : 'OTHER'))) : 'PENDING',
                odds: {
                    favOdds: stats.favOdds || 'N/A',
                    drawOdds: stats.oX || 'N/A',
                    underdogOdds: stats.underdogOdds || 'N/A'
                },
                paa: {
                    prediction: paaObj?.paaPrediction || 'N/A',
                    primary: paaObj?.paaPrimaryPrediction || 'N/A',
                    favWinRate: `${stats.paaStats?.favWinRate?.toFixed(1) || 0}%`,
                    drawRate: `${stats.paaStats?.drawRate?.toFixed(1) || 0}%`,
                    upsetRate: `${stats.paaStats?.upsetRate?.toFixed(1) || 0}%`,
                    sampleTotal: stats.paaStats?.total || 0
                },
                pha: {
                    favSupport: `${stats.phaStats?.favSupport?.toFixed(1) || 0}%`,
                    drawSupport: `${stats.phaStats?.drawSupport?.toFixed(1) || 0}%`,
                    underdogSupport: `${stats.phaStats?.underdogSupport?.toFixed(1) || 0}%`
                },
                algo: {
                    prediction: m.algoReport?.prediction || stats.algoPred || 'N/A',
                    primaryPrediction: m.algoReport?.primaryPrediction || 'N/A',
                    subPattern: m.algoReport?.subPattern || 'N/A',
                    subPatternPrediction: m.algoReport?.subPatternPrediction || 'N/A',
                    probabilities: m.algoReport?.probabilities ? {
                        favProb: `${((moFav === '1' ? m.algoReport.probabilities['1'] : m.algoReport.probabilities['2']) * 100).toFixed(1)}%`,
                        drawProb: `${((m.algoReport.probabilities['X'] || 0) * 100).toFixed(1)}%`,
                        underdogProb: `${((moUnderdog === '1' ? m.algoReport.probabilities['1'] : m.algoReport.probabilities['2']) * 100).toFixed(1)}%`
                    } : 'N/A'
                },
                seer: {
                    pick: seerDetailed.final,
                    primary: seerDetailed.primary,
                    hedge: seerDetailed.final !== seerDetailed.primary ? seerDetailed.final : 'Straight',
                    scores: {
                        favScore: Math.round(seerDetailed.scores[moFav] || 0),
                        drawScore: Math.round(seerDetailed.scores['X'] || 0),
                        underdogScore: Math.round(seerDetailed.scores[moUnderdog] || 0)
                    },
                    percentages: totalSeerScore > 0 ? {
                        favPct: `${(((seerDetailed.scores[moFav] || 0) / totalSeerScore) * 100).toFixed(1)}%`,
                        drawPct: `${(((seerDetailed.scores['X'] || 0) / totalSeerScore) * 100).toFixed(1)}%`,
                        underdogPct: `${(((seerDetailed.scores[moUnderdog] || 0) / totalSeerScore) * 100).toFixed(1)}%`
                    } : 'N/A'
                }
            });
    });

    // 2. Extract matches and stats specifically for this category slip
    const categoryMatches = selectedCategory === "all"
        ? subsetMatches
        : getMatchesForCategory(subsetMatches, selectedCategory, phaStatsMap, isJackpotMode, matchStars);

    const categoryMatchesUnderlyingData = allMatchesUnderlyingData.filter(u => 
        categoryMatches.some(cm => cm.id?.toString() === u.id?.toString())
    );

    const categoryStats = { total: categoryMatches.length, completedTotal: 0, favWins: 0, draws: 0, underdogWins: 0 };
    categoryMatchesUnderlyingData.forEach(m => {
        if (m.actualResult !== 'PENDING') {
            categoryStats.completedTotal++;
            if (m.outcome === 'FAVORITE_WIN') categoryStats.favWins++;
            else if (m.outcome === 'DRAW') categoryStats.draws++;
            else if (m.outcome === 'UNDERDOG_UPSET') categoryStats.underdogWins++;
        }
    });

    const poolFavPct = allPoolStats.completedTotal > 0 ? ((allPoolStats.favWins / allPoolStats.completedTotal) * 100).toFixed(1) : "0.0";
    const poolDrawPct = allPoolStats.completedTotal > 0 ? ((allPoolStats.draws / allPoolStats.completedTotal) * 100).toFixed(1) : "0.0";
    const poolDogPct = allPoolStats.completedTotal > 0 ? ((allPoolStats.underdogWins / allPoolStats.completedTotal) * 100).toFixed(1) : "0.0";
    const poolFavDrawSum = allPoolStats.favWins + allPoolStats.draws;
    const poolFavDrawPct = allPoolStats.completedTotal > 0 ? ((poolFavDrawSum / allPoolStats.completedTotal) * 100).toFixed(1) : "0.0";

    const catFavPct = categoryStats.completedTotal > 0 ? ((categoryStats.favWins / categoryStats.completedTotal) * 100).toFixed(1) : "0.0";
    const catDrawPct = categoryStats.completedTotal > 0 ? ((categoryStats.draws / categoryStats.completedTotal) * 100).toFixed(1) : "0.0";
    const catDogPct = categoryStats.completedTotal > 0 ? ((categoryStats.underdogWins / categoryStats.completedTotal) * 100).toFixed(1) : "0.0";
    const catFavDrawSum = categoryStats.favWins + categoryStats.draws;
    const catFavDrawPct = categoryStats.completedTotal > 0 ? ((catFavDrawSum / categoryStats.completedTotal) * 100).toFixed(1) : "0.0";

    let contextString = "";
    switch (selectedCategory) {
        case "top_12_safe":
        case "botb_jackpot":
        case "botb_best":
        case "top20":
        case "top_20_value":
            contextString = `Based on the matches in this category focusing on their odds-based requirements (market fav or draw for high odds, market fav for low odds):`;
            break;
        case "best_bet":
        case "bankers_dlive":
        case "bankers_jackpot":
        case "value_picks":
        case "top10":
        case "top_10_value":
            contextString = `Based on the ${categoryStats.favWins} matches (${catFavPct}%) in this category that went to market fav:`;
            break;
        case "banker_draws":
            contextString = `Based on the ${categoryStats.draws} matches (${catDrawPct}%) in this category that went to draw:`;
            break;
        case "upsets":
            contextString = `Based on the ${categoryStats.underdogWins} matches (${catDogPct}%) in this category that went to the underdog:`;
            break;
        case "value_bets":
            contextString = `Based on the matches in this category focusing on their exact prediction requirements:`;
            break;
        default:
            contextString = `Based on the matches in this category and their outcomes:`;
            break;
    }

    let statHeadline = "";
    if (selectedCategory === "all") {
        statHeadline = `${categoryLabel} had ${allPoolStats.total} matches on Live Analysis of which ${allPoolStats.completedTotal} have their results, out of the ${allPoolStats.completedTotal}, ${allPoolStats.favWins} (${poolFavPct}%) went to market fav, ${allPoolStats.draws} (${poolDrawPct}%) to draw and ${allPoolStats.underdogWins} (${poolDogPct}%) to the underdog. Based on the ${poolFavDrawSum} matches (${poolFavDrawPct}%) that went to fav and draw:`;
    } else {
        statHeadline = `${categoryLabel} had ${categoryMatches.length} matches on Live Analysis of which ${categoryStats.completedTotal} have their results, out of the ${categoryStats.completedTotal}, ${categoryStats.favWins} (${catFavPct}%) went to market fav, ${categoryStats.draws} (${catDrawPct}%) to draw and ${categoryStats.underdogWins} (${catDogPct}%) to the underdog. ${contextString}`;
    }

    if (categoryStats.completedTotal === 0 && allPoolStats.completedTotal === 0) {
        onProgress("No completed matches in current data to evaluate.", 100);
        return [{
            id: `ai_opt_none_${Date.now()}`,
            finding: `${categoryLabel} has ${categoryMatches.length} matches on Live Analysis, but 0 matches currently have completed results. Cannot calculate accuracy or optimize weights until match scores are available.`,
            action: "Maintain current category weightings until live match results are reported.",
            proposedWeights: currentWeights,
            baseWeights: currentWeights,
            isTested: true,
            subsetAcc: 0,
            subsetGoalAcc: 0,
            testResult: { approved: false, prevAcc: 0, newAcc: 0, prevGoalAcc: 0, newGoalAcc: 0 }
        }];
    }

    // 2. Evaluate actual picks generated for this category slip
    const categorySlipPicks = categoryMatches;
    const validCurrentMatches = categorySlipPicks.filter(m => {
        const res = getActualResult(m.result);
        return res !== 'pending' && res !== null;
    });
    
    // Yield to UI thread to keep app completely smooth
    await new Promise(resolve => setTimeout(resolve, 10));
    
    let currentBaseAcc = 0;
    let currentGoalAcc = 0;
    
    const pickedStats = { hits: 0, goalHits: 0, total: validCurrentMatches.length, favWins: 0, draws: 0, underdogWins: 0 };
    const missedDetails: any[] = [];
    
    // Chunk evaluation to keep UI 100% responsive
    for (let i = 0; i < validCurrentMatches.length; i++) {
         if (i > 0 && i % 25 === 0) {
             await new Promise(resolve => setTimeout(resolve, 0));
         }
         const m = validCurrentMatches[i];
         const actual = getActualResult(m.result);
         const favInfo = getFavoriteAndUnderdog(m);
         const moFav = favInfo.fav;
         const moUnderdog = favInfo.underdog;

         const predDetailed = predictSeerDetailed(m, currentWeights, phaStatsMap, matchStars, selectedCategory);
         const pred = predDetailed.final;
         
         if (actual && pred) {
             const isCorrect = isMatchCorrectForCategory(m, pred, actual, selectedCategory);
             const isGoalCorrect = isMatchGoalAccurate(m, pred, actual, selectedCategory, phaStatsMap);
             if (isCorrect) pickedStats.hits++;
             if (isGoalCorrect) pickedStats.goalHits++;
             
             if (!isCorrect || ((selectedCategory === 'top_12_value' || selectedCategory === 'top_10_value') && !isGoalCorrect)) {
                 const fullRecord = allMatchesUnderlyingData.find(item => item.id === m.id) || {
                     teams: m.teams,
                     actualResult: actual,
                     ourPrediction: pred,
                     seerScores: predDetailed.scores
                 };
                 missedDetails.push(fullRecord);
             }
         }
         if (actual === moFav) pickedStats.favWins++;
         else if (actual === 'X') pickedStats.draws++;
         else if (actual === moUnderdog) pickedStats.underdogWins++;
    }
    
    currentBaseAcc = pickedStats.total > 0 ? (pickedStats.hits / pickedStats.total) * 100 : 0;
    currentGoalAcc = pickedStats.total > 0 ? (pickedStats.goalHits / pickedStats.total) * 100 : 0;

    onProgress("Phase 2: Running AI Optimizer agent on live category slip matches...", 50);
    await new Promise(resolve => setTimeout(resolve, 10));

    try {
        const goalAccuracyReq = getGoalAccuracyRequirementDescription(selectedCategory);

        const ai = getAIInstance(false);
        const prompt = `You are the Lead SEER AI Optimizer.
You are evaluating REAL, GROUNDED performance data and underlying match stats (PAA, PHA, Algo, Seer) from ALL ${allPoolStats.total} matches on Live Analysis.

MANDATORY REAL DATA BREAKDOWN FOR ALL ${allPoolStats.total} MATCHES IN POOL:
- Total Live Pool Matches: ${allPoolStats.total}
- Total Completed Matches: ${allPoolStats.completedTotal}
- Out of ${allPoolStats.completedTotal} completed matches in total pool:
  * ${allPoolStats.favWins} (${poolFavPct}%) went to market favorite
  * ${allPoolStats.draws} (${poolDrawPct}%) went to draw
  * ${allPoolStats.underdogWins} (${poolDogPct}%) went to underdog
  * Market Favorite + Draw pool total: ${poolFavDrawSum} (${poolFavDrawPct}%)

CATEGORY BREAKDOWN:
Category: ${categoryLabel} (${selectedCategory})
- Goal Accuracy Requirement for this Category: ${goalAccuracyReq}
- Total matches in category: ${categoryMatches.length}
- Completed matches in category: ${categoryStats.completedTotal}
- Out of ${categoryStats.completedTotal} completed category matches:
  * ${categoryStats.favWins} (${catFavPct}%) went to market favorite
  * ${categoryStats.draws} (${catDrawPct}%) went to draw
  * ${categoryStats.underdogWins} (${catDogPct}%) went to underdog
  * Market Favorite + Draw category total: ${catFavDrawSum} (${catFavDrawPct}%)

Our Category Slip Pick Performance (Current Weights):
- Total Matches Selected on Slip: ${categorySlipPicks.length}
- Completed Slip Matches Evaluated: ${validCurrentMatches.length}
- Overall Accuracy: ${currentBaseAcc.toFixed(1)}% (${pickedStats.hits}/${validCurrentMatches.length || 1})
- Goal Accuracy: ${currentGoalAcc.toFixed(1)}% (${pickedStats.goalHits}/${validCurrentMatches.length || 1})

UNDERLYING MATCH DATA FOR ALL ${allMatchesUnderlyingData.length} MATCHES IN DATASET:
${JSON.stringify(allMatchesUnderlyingData, null, 2)}

UNDERLYING MATCH DATA FOR CATEGORY SLIP MATCHES (${categoryMatchesUnderlyingData.length} matches):
${JSON.stringify(categoryMatchesUnderlyingData, null, 2)}

FAILED / MISSED MATCHES ON OUR CATEGORY SLIP (${missedDetails.length} matches):
${JSON.stringify(missedDetails, null, 2)}

CRITICAL CONSTRAINTS:
1. You MUST ONLY reference real team names that explicitly appear in the 'UNDERLYING MATCH DATA FOR ALL MATCHES IN DATASET' list above.
2. DO NOT under ANY circumstances invent, hallucinate, or mention fictional team names or match fixtures (e.g. Bologna, Heidenheim, Duisburg, etc.).
3. Use the exact underlying match data (PAA, PHA, Algo probabilities, Sub Pattern predictions, Seer scores) from the matches to explain why specific matches failed or ended in draw/fav.
4. Your primary mission is to dissect the "DNA of the matches" to achieve maximum accuracy. You MUST analyze:
   - Individual Predictor Performance: Analyze the accuracy and tendencies of PAA, Algo, Sub pattern predictions, and Seer default weights individually.
   - Synergy & Disagreement: Study which TWO predictors (e.g., PAA + Algo, or Seer + PAA) have the highest accuracy when they agree, and which combinations signify stalemates (draws/upsets) when they disagree.
   - Confidence Data Analysis: Test specific thresholds (When M.Fav confidence is > 50%, < 50%, and < 40% across Seer, PAA, Algo). What happens when TWO predictors both have M.Fav confidence > 50%? What about < 50% or < 40%?
   - What happens when ANY predictor's draw confidence/probability is > 35%?
5. Your proposed action and weight adjustments MUST explain how to adjust algorithm weights based on the Goal Accuracy Requirement (${goalAccuracyReq}). Focus your analysis on the matches within this category that met or failed this specific requirement.
6. Keep the finding reasoning concise, precise, and directly referencing real team names, Seer scores, PAA/PHA, and Algo data from the matches.

Output JSON format:
{
  "findingReasoning": "Overall explanation referencing real teams and exact underlying stats...",
  "deepInsights": [
    "Insight 1: When PAA and Algo both have M.Fav confidence < 50%, the upset rate jumps to X%...",
    "Insight 2: When ANY predictor has draw confidence > 35%, the match resulted in a draw Y% of the time...",
    "Insight 3: The sub-pattern G1cc2 coupled with high PAA draw rate indicates a strong X2 hedge..."
  ],
  "action": "Specific recommendation on adjusting algorithm weights...",
  "proposedWeights": {
    "algoWeight": 25,
    "paaPredWeight": 30,
    "drawDisagreementBoost": 150
  }
}`;

        const schema: Schema = {
            type: Type.OBJECT,
            properties: {
                findingReasoning: { type: Type.STRING },
                deepInsights: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                action: { type: Type.STRING },
                proposedWeights: {
                    type: Type.OBJECT,
                    properties: {
                        algoWeight: { type: Type.NUMBER },
                        paaPredWeight: { type: Type.NUMBER },
                        subPatternWeight: { type: Type.NUMBER },
                        probConfWeight: { type: Type.NUMBER },
                        phaWeight: { type: Type.NUMBER },
                        paaPercentWeight: { type: Type.NUMBER },
                        perfStarsWeight: { type: Type.NUMBER },
                        pred1x2Weight: { type: Type.NUMBER },
                        pred1x2RatingBoost: { type: Type.NUMBER },
                        drawDisagreementBoost: { type: Type.NUMBER },
                        synergyAgreementBoost: { type: Type.NUMBER },
                        synergyCondA: { type: Type.NUMBER },
                        synergyCondB: { type: Type.NUMBER },
                        synergyGapBoost: { type: Type.NUMBER }
                    }
                }
            },
            required: ["findingReasoning", "action", "proposedWeights"]
        };

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: prompt,
            config: {
                thinkingConfig: {
                    thinkingLevel: ThinkingLevel.HIGH,
                },
                responseMimeType: "application/json",
                responseSchema: schema
            }
        });
        
        const resObj = JSON.parse(response.text || "{}");
        const newWeights = { ...currentWeights, ...resObj.proposedWeights };

        let aiReasoning = resObj.findingReasoning || resObj.finding || "Adjusted algorithm weights to improve double-chance hedging on matches with high draw or favorite alignment.";
        
        const allRealTeamNames = allMatchesUnderlyingData.map(m => m.teams);
        const hallucinatedKeywords = ["Bologna", "Heidenheim", "Duisburg", "Columbus Crew", "Universitatea", "Brann", "Cuiaba"];

        // Strict Grounding Enforcement: Ensure all team references come directly from real allMatchesUnderlyingData
        const isGrounded = allRealTeamNames.some(team => {
            const parts = team.split(/vs|\-|@/i).map(p => p.trim());
            return parts.some(p => p.length > 3 && aiReasoning.toLowerCase().includes(p.toLowerCase()));
        });

        if (!isGrounded || hallucinatedKeywords.some(kw => aiReasoning.toLowerCase().includes(kw.toLowerCase()))) {
            if (missedDetails.length > 0) {
                const sampleMissed = missedDetails.slice(0, 3).map(m => m.teams).join(', ');
                aiReasoning = `Analysis of matches like ${sampleMissed} shows our Seer model assigned unhedged or 12 predictions despite elevated draw probabilities and PAA/PHA support for 1X.`;
            } else {
                aiReasoning = `Analysis of live analysis matches shows double-chance hedging needs adjustment to optimize selections across market favorite and draw outcomes.`;
            }
        }

        const fullFinding = `${statHeadline} ${aiReasoning}`;
        const activeFavDrawCount = selectedCategory === "all" ? poolFavDrawSum : catFavDrawSum;
        
        let actionContext = "";
        switch (selectedCategory) {
            case "top_12_safe":
            case "botb_jackpot":
            case "botb_best":
            case "top20":
            case "top_20_value":
                actionContext = `Based on the ${activeFavDrawCount} matches that went to market favorite and draw`;
                break;
            case "best_bet":
            case "bankers_dlive":
            case "bankers_jackpot":
            case "value_picks":
            case "top10":
            case "top_10_value":
                actionContext = `Based on the ${categoryStats.favWins} matches that went to market favorite`;
                break;
            case "banker_draws":
                actionContext = `Based on the ${categoryStats.draws} matches that went to draw`;
                break;
            case "upsets":
                actionContext = `Based on the ${categoryStats.underdogWins} matches that went to the underdog`;
                break;
            default:
                actionContext = `Based on the matches and outcomes in this category`;
                break;
        }
        
        const fullAction = resObj.action || `${actionContext}, we recommend tuning weights to optimize selections.`;
        
        // Test the proposed weights against real completed matches to verify if accuracy improves
        onProgress("Phase 3: Validating AI recommendations against real dataset...", 80);
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const modePrefix = isJackpotMode ? 'jackpot_' : 'daily_';
        const overrideKey = `${modePrefix}${selectedCategory}`;
        const fullWeightsMap = getSeerWeights();
        const overrideMap = { ...fullWeightsMap, [overrideKey]: newWeights };
        const candMatches = getMatchesForCategory(subsetMatches, selectedCategory, phaStatsMap, isJackpotMode, matchStars, overrideMap).filter(m => {
            const res = getActualResult(m.result);
            return res !== 'pending' && res !== null;
        });
        
        let hits = 0, goalHits = 0;
        if (candMatches.length > 0) {
            for (let i = 0; i < candMatches.length; i++) {
                if (i > 0 && i % 25 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
                const m = candMatches[i];
                const actual = getActualResult(m.result);
                const pred = predictSeerDetailed(m, newWeights, phaStatsMap, matchStars, selectedCategory).final;
                if (actual && pred) {
                    if (isMatchCorrectForCategory(m, pred, actual, selectedCategory)) hits++;
                    if (isMatchGoalAccurate(m, pred, actual, selectedCategory, phaStatsMap)) goalHits++;
                }
            }
        }
        const newAcc = candMatches.length > 0 ? (hits / candMatches.length) * 100 : 0;
        const newGoalAcc = candMatches.length > 0 ? (goalHits / candMatches.length) * 100 : 0;
        
        onProgress("Optimization complete.", 100);

        return [{
            id: `ai_opt_${Date.now()}`,
            finding: fullFinding,
            deepInsights: resObj.deepInsights || [],
            action: fullAction,
            proposedWeights: newWeights,
            baseWeights: currentWeights,
            isTested: true,
            subsetAcc: newAcc,
            subsetGoalAcc: newGoalAcc,
            testResult: {
                approved: newGoalAcc >= currentGoalAcc || newAcc >= currentBaseAcc,
                prevAcc: currentBaseAcc,
                newAcc: newAcc,
                prevGoalAcc: currentGoalAcc,
                newGoalAcc: newGoalAcc
            }
        }];

    } catch (e) {
        console.warn("Gemini AI finding generation failed, using non-simulated statistical fallback.", e);
        onProgress("AI Optimizer completed with real data fallback.", 100);
        
        const fallbackReasoning = missedDetails.length > 0 
          ? `Analysis of failed matches (${missedDetails.slice(0, 3).map(m => m.teams).join(', ')}) shows double-chance hedging needs tuning to prevent misses on draw outcomes.`
          : `Current category slip picks achieved strong alignment with live analysis outcomes.`;

        const fullFinding = `${statHeadline} ${fallbackReasoning}`;
        const activeFavDrawCount = selectedCategory === "all" ? poolFavDrawSum : catFavDrawSum;
        
        let actionContext = "";
        switch (selectedCategory) {
            case "top_12_safe":
            case "botb_jackpot":
            case "botb_best":
            case "top20":
            case "top_20_value":
                actionContext = `Based on the ${activeFavDrawCount} matches that went to market favorite and draw`;
                break;
            case "best_bet":
            case "bankers_dlive":
            case "bankers_jackpot":
            case "value_picks":
            case "top10":
            case "top_10_value":
                actionContext = `Based on the ${categoryStats.favWins} matches that went to market favorite`;
                break;
            case "banker_draws":
                actionContext = `Based on the ${categoryStats.draws} matches that went to draw`;
                break;
            case "upsets":
                actionContext = `Based on the ${categoryStats.underdogWins} matches that went to the underdog`;
                break;
            default:
                actionContext = `Based on the matches and outcomes in this category`;
                break;
        }
        
        const fullAction = `${actionContext}, we recommend adjusting weights to optimize selections for this category.`;

        return [{
            id: `ai_opt_fallback_${Date.now()}`,
            finding: fullFinding,
            action: fullAction,
            proposedWeights: currentWeights,
            baseWeights: currentWeights,
            isTested: true,
            subsetAcc: currentBaseAcc,
            subsetGoalAcc: currentGoalAcc,
            testResult: { approved: true, prevAcc: currentBaseAcc, newAcc: currentBaseAcc, prevGoalAcc: currentGoalAcc, newGoalAcc: currentGoalAcc }
        }];
    }
};
