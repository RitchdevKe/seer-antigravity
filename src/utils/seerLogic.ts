import { Match } from '../types';
import { getMatchMaxStars } from './matchStars';
import { getMatchSupremeTierUnderdog } from './seerSupremeTier';
import { calculatePAAPrediction } from './matchProcessing';
import { matchAlgorithm } from '../components/ai/algorithm';

export interface CategoryWeights {
  algoWeight: number;
  paaPredWeight: number;
  subPatternWeight: number;
  probConfWeight: number;
  phaWeight: number;
  paaPercentWeight: number;
  perfStarsWeight: number;
  pred1x2Weight: number;
  pred1x2RatingBoost: number;
  drawDisagreementBoost: number;
  synergyAgreementBoost: number;
  synergyCondA?: number;
  synergyCondB?: number;
  synergyCondC?: number;
  synergyCondD?: number;
  synergyCondE?: number;
  synergyGapBoost?: number;
  // Upset specific boosts
  upsetPaaBoost?: number;
  upsetProbBoost?: number;
  upsetSeerPrimBoost?: number;
  upsetPatternBoost?: number;
  paaAlgoAgreementBoost?: number;
  subPattPaaAgreementBoost?: number;
  paaAlgoSubPattAgreementBoost?: number;
}

export const DEFAULT_WEIGHTS: CategoryWeights = {
  algoWeight: 10,
  paaPredWeight: 44, // PAA is the primary anchor
  subPatternWeight: 42,
  probConfWeight: 46,
  phaWeight: 0,
  paaPercentWeight: 5,
  perfStarsWeight: 12,
  pred1x2Weight: 0,
  pred1x2RatingBoost: 75,
  drawDisagreementBoost: 14,
  synergyAgreementBoost: 15,
  synergyCondA: 300,
  synergyCondB: 195,
  synergyCondC: 200,
  synergyCondD: 200,
  synergyCondE: 200,
  synergyGapBoost: 250,
  upsetPaaBoost: 15, // Boosted PAA for Upset logic
  upsetProbBoost: 0,
  upsetSeerPrimBoost: 0,
  upsetPatternBoost: 0,
  paaAlgoAgreementBoost: 15,
  subPattPaaAgreementBoost: 15,
  paaAlgoSubPattAgreementBoost: 20,
};

export const getMatchScore = (m: Match, outcome: '1' | 'X' | '2', weights: CategoryWeights, phaStatsMap: Record<string, any>, matchStars: Record<string, number>, selectedCategory: string = 'all'): number => {
    let score = 0;
    
    // ALWAYS use live algorithm predictions instead of stale database values
    if (!(m as any)._liveAlgoReport) {
        (m as any)._liveAlgoReport = matchAlgorithm.predict(m);
    }
    const liveAlgoReport = (m as any)._liveAlgoReport;

    // Use live calculation instead of stored values
    const algoPred = liveAlgoReport.prediction || '';
    if (algoPred.includes(outcome)) score += weights.algoWeight;

    let paaPred = m.paaPrediction || m.paaPrimaryPrediction || '';
    let paaPrimary = m.paaPrimaryPrediction || '';
    const sub = m.patternAnalysis?.subPattern;
    if (sub && phaStatsMap && phaStatsMap[sub] && (phaStatsMap[sub].paaTotal > 0 || phaStatsMap[sub].total > 0)) {
        const computedPaa = calculatePAAPrediction(m, phaStatsMap[sub]);
        if (computedPaa) {
            paaPrimary = computedPaa.paaPrimaryPrediction;
            paaPred = computedPaa.paaPrediction;
            m.paaPrimaryPrediction = paaPrimary;
            m.paaPrediction = paaPred;
        }
    }

    if (paaPred.includes(outcome)) score += weights.paaPredWeight;
    if (paaPrimary === outcome) score += weights.paaPredWeight * 0.5;

    const subPred = m.patternAnalysis?.subPatternPrediction || '';
    if (subPred.includes(outcome)) score += weights.subPatternWeight;

    // Determine Market Odds dynamically
    let moFav = (m as any)._moFav;
    let moUpset = (m as any)._moUpset;
    if (moFav === undefined) {
        moFav = '1';
        moUpset = '2';
        if (m.mo && String(m.mo).trim() !== 'NA') {
            const parts = String(m.mo).split(/[,\s:\/\-]+/).filter(p => p.trim() !== '');
            const odds1 = parts.length > 0 ? parseFloat(parts[0]) : 0;
            const odds2 = parts.length > 2 ? parseFloat(parts[2]) : 0;
            if (!isNaN(odds1) && !isNaN(odds2)) {
                if (odds1 < odds2) {
                    moFav = '1'; moUpset = '2';
                } else if (odds2 < odds1) {
                    moFav = '2'; moUpset = '1';
                }
            }
        }
        (m as any)._moFav = moFav;
        (m as any)._moUpset = moUpset;
    }

    // Probability
    if (liveAlgoReport.probabilities) {
        const probs = liveAlgoReport.probabilities;
        const prob = probs[outcome as keyof typeof probs] || 0;
        const probPct = prob * 100;
        score += (probPct / 100) * weights.probConfWeight;

        // Jackpot Update: Prioritize draws with > 25% confidence
        if (outcome === 'X' && probPct > 25) {
            score += (probPct / 5); 
        }

        // Upset Algorithm: Massive explicit boost if probability points towards underdog
        if (selectedCategory === 'upsets' && outcome === moUpset && (weights.upsetProbBoost || 0) > 0) {
            score += (probPct / 100) * weights.upsetProbBoost!;
        }
    }

    // PHA (Pattern Historical Outcome Distribution)
    if (sub && phaStatsMap[sub]) {
        const pha = phaStatsMap[sub];
        if (pha.total > 0) {
            const phaOutcomes = pha.outcomes || {};
            const outcomeCount = phaOutcomes[outcome] || 0;
            const phaOutcomeProb = (outcomeCount / pha.total) * 100;
            
            // Apply standard and Upset Pattern History weight
            score += (phaOutcomeProb / 100) * weights.phaWeight;
            if (selectedCategory === 'upsets' && outcome === moUpset && (weights.upsetPatternBoost || 0) > 0) {
                 score += (phaOutcomeProb / 100) * weights.upsetPatternBoost!;
            }

            // PAA measures Market Favorite / Underdog performance
            let paaPct = 0;
            const pDenom = pha.paaTotal > 0 ? pha.paaTotal : pha.total;
            if (outcome === moFav) paaPct = (pha.favWin / pDenom) * 100;
            else if (outcome === 'X') paaPct = (pha.draw / pDenom) * 100;
            else if (outcome === moUpset) paaPct = (pha.upsetWin / pDenom) * 100;
            
            score += (paaPct / 100) * weights.paaPercentWeight;

            // Upset Algorithm: Explicit boost for underdog historical execution
            if (selectedCategory === 'upsets' && outcome === moUpset && (weights.upsetPaaBoost || 0) > 0) {
                 score += (paaPct / 100) * weights.upsetPaaBoost!;
            }

            // Synergy Agreement Boost
            if (liveAlgoReport.probabilities) {
                const prob = liveAlgoReport.probabilities[outcome] || 0;
                const probPct = prob * 100;
                if (probPct >= 45 && paaPct >= 50) {
                    score += weights.synergyAgreementBoost || 0;
                }
            }
        }
    }

    // Agreement Boosts
    const isPaaAgree = paaPred.includes(outcome);
    const isAlgoAgree = algoPred.includes(outcome);
    const isSubPattAgree = subPred.includes(outcome);

    if (isPaaAgree && isAlgoAgree) {
        score += weights.paaAlgoAgreementBoost || 0;
    }
    if (isSubPattAgree && isPaaAgree) {
        score += weights.subPattPaaAgreementBoost || 0;
    }
    if (isPaaAgree && isAlgoAgree && isSubPattAgree) {
        score += weights.paaAlgoSubPattAgreementBoost || 0;
    }

    // Stars
    const stars = getMatchMaxStars(m, matchStars) || 0;
    if (stars > 0) {
         score += (stars / 5) * weights.perfStarsWeight; 
    }

    // Volatile PHA Tie Penalty (discourage selection as a first resort)
    if (m.evaluatorTags?.includes('VOLATILE:PHA_TIE')) {
        score -= 15; // Optimized from -10
    }

    // Potential Upset Flag Penalty (discourage selection in non-upset categories by penalizing the favorite outcome)
    const hasPotentialUpsetFlag = (m.totalPoints?.breakdown?.upsetPotential !== undefined && m.totalPoints?.breakdown?.upsetPotential !== null) || 
                                  (m.totalPoints?.breakdown?.tsIndicators?.includes("Potential Upset")) || 
                                  false;
    if (hasPotentialUpsetFlag && selectedCategory !== 'upsets' && outcome === moFav) {
        score -= 50; // Restore original -50 penalty
    }

    // 1X2 Prediction
    const pred1x2 = m.pred1x2 || '';
    if (pred1x2.includes(outcome)) {
        score += weights.pred1x2Weight;
        
        const ratingMatch = String(m.rating || '').match(/(\d+(?:\.\d+)?)/);
        const ratingNum = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
        if (ratingNum >= 3) {
            score += weights.pred1x2RatingBoost;
        }
    }

    // Outright Disagreement Boost for 'X'
    if (outcome === 'X') {
        const isHomeBiased = (p: string) => ['1', '1X'].includes(p);
        const isAwayBiased = (p: string) => ['2', 'X2'].includes(p);
        if ((isHomeBiased(algoPred) && isAwayBiased(pred1x2)) || (isAwayBiased(algoPred) && isHomeBiased(pred1x2))) {
            score += weights.drawDisagreementBoost;
        }
    }

    // Upset Primary Base Check
    // If we are looking for Upsets, and Seer's base logic ALREADY liked the Upset, exponentially boost it.
    if (selectedCategory === 'upsets' && outcome === moUpset && (weights.upsetSeerPrimBoost || 0) > 0) {
        // We use algoPred and probUnderdog as proxy for baseseer liking the upset
        const probs = liveAlgoReport.probabilities;
        const probU = probs ? (probs[moUpset as keyof typeof probs] || 0) : 0;
        const probUPct = probU * 100;
        
        let baselineLikesUpset = false;
        if (algoPred.includes(moUpset) || probUPct >= 35 || pred1x2.includes(moUpset)) {
             baselineLikesUpset = true;
        }
        
        if (baselineLikesUpset) {
             score += weights.upsetSeerPrimBoost!;
        }
    }

    // RECOMMENDATION 1 & 3: Category-Specific Underdog Muzzle & Disagreement Filter
    const favoriteBiasedCategories = ['best_bet', 'top10', 'bankers_dlive', 'botb_best', 'top20', 'bankers_jackpot', 'value_picks'];
    const drawBiasedCategories = ['banker_draws'];
    
    if (favoriteBiasedCategories.includes(selectedCategory) || drawBiasedCategories.includes(selectedCategory)) {
        if (outcome === moUpset) {
            // Muzzle the underdog score so it cannot outscore the favorite naturally
            score -= 500; 
        }
        
        // PAA Disagreement Filter
        const probs = liveAlgoReport.probabilities;
        const probU = probs ? (probs[moUpset as keyof typeof probs] || 0) : 0;
        const probF = probs ? (probs[moFav as keyof typeof probs] || 0) : 0;
        let pha = null;
        if (m.patternAnalysis?.subPattern && phaStatsMap[m.patternAnalysis.subPattern]) {
            pha = phaStatsMap[m.patternAnalysis.subPattern];
        }
        
        const isAlgoUpsetFavored = probU > probF;
        let isPaaUpsetFavored = false;
        if (pha && pha.total > 0) {
            const denom = pha.paaTotal > 0 ? pha.paaTotal : pha.total;
            const paaFav = (pha.favWin / denom) * 100;
            const paaUpset = (pha.upsetWin / denom) * 100;
            isPaaUpsetFavored = paaUpset > paaFav;
        }

        if (isAlgoUpsetFavored && isPaaUpsetFavored && outcome === moFav) {
            // Penalize the favorite if the entire AI logic and historical logic says Upset
            // This will cause the match to score low on both favorite and upset, making it ineligible.
            score -= 500;
        }
    }

    return score;
};

export interface SeerDetailedResult {
    primary: string;
    final: string;
    scores: { '1': number; 'X': number; '2': number };
    percentages: { '1': number; 'X': number; '2': number };
    isScoreStable?: boolean;
    isHighProb?: boolean;
    isSievePremium?: boolean;
}

const predictUpsetSeerDetailed = (m: Match, weights: CategoryWeights, phaStatsMap: Record<string, any>, matchStars: Record<string, number>): SeerDetailedResult => {
    let activeHedgingProtocol: string | undefined;
    let moFav = '1';
    let moUnderdog = '2';
    if (m.mo && String(m.mo).trim() !== 'NA') {
        const parts = String(m.mo).split(/[,\s:\/\-]+/).filter(p => p.trim() !== '');
        const odds1 = parts.length > 0 ? parseFloat(parts[0]) : 0;
        const odds2 = parts.length > 2 ? parseFloat(parts[2]) : 0;
        if (!isNaN(odds1) && !isNaN(odds2)) {
            if (odds1 < odds2) { moFav = '1'; moUnderdog = '2'; }
            else if (odds2 < odds1) { moFav = '2'; moUnderdog = '1'; }
        }
    }

    // ALWAYS use live algorithm predictions instead of stale database values
    if (!(m as any)._liveAlgoReport) {
        (m as any)._liveAlgoReport = matchAlgorithm.predict(m);
    }
    const liveAlgoReport = (m as any)._liveAlgoReport;

    const probUnderdog = liveAlgoReport.probabilities?.[moUnderdog as '1'|'2'] || 0;
    const probX = liveAlgoReport.probabilities?.['X'] || 0;
    const probFav = liveAlgoReport.probabilities?.[moFav as '1'|'2'] || 0;

    const algoPred = liveAlgoReport.prediction || '';
    let paaPred = m.paaPrediction || m.paaPrimaryPrediction || '';
    let paaPrimary = m.paaPrimaryPrediction || '';
    const sub = m.patternAnalysis?.subPattern;
    if (sub && phaStatsMap && phaStatsMap[sub] && (phaStatsMap[sub].paaTotal > 0 || phaStatsMap[sub].total > 0)) {
        const computedPaa = calculatePAAPrediction(m, phaStatsMap[sub]);
        if (computedPaa) {
            paaPrimary = computedPaa.paaPrimaryPrediction;
            paaPred = computedPaa.paaPrediction;
            m.paaPrimaryPrediction = paaPrimary;
            m.paaPrediction = paaPred;
        }
    }
    const subPred = m.patternAnalysis?.subPatternPrediction || '';
    const pred1x2 = m.pred1x2 || '';

    let paaUpsetPct = 0;
    let phaDrawPct = 0;
    let paaFavPct = 0;
    if (sub && phaStatsMap[sub]) {
        const pha = phaStatsMap[sub];
        if (pha.total > 0) {
            const pDenom = pha.paaTotal > 0 ? pha.paaTotal : pha.total;
            paaUpsetPct = (pha.upsetWin / pDenom) * 100;
            phaDrawPct = (pha.draw / pDenom) * 100;
            paaFavPct = (pha.favWin / pDenom) * 100;
        }
    }

    // Determine support
    const seerSupportsUnderdog = algoPred.includes(moUnderdog) || subPred.includes(moUnderdog) || pred1x2.includes(moUnderdog);
    const paaSupportsUnderdog = paaPred.includes(moUnderdog) || paaUpsetPct > 20;

    // Independent Upset scoring completely separate from standard weighting
    let uScoreUpset = 0;
    let uScoreDraw = 0;
    let uScoreFav = 0;

    // 1. Probability Power
    const probUnderdogPct = probUnderdog * 100;
    const probXPct = probX * 100;
    const probFavPct = probFav * 100;

    uScoreUpset += (probUnderdogPct / 100) * weights.probConfWeight;
    uScoreDraw += (probXPct / 100) * weights.probConfWeight;
    uScoreFav += (probFavPct / 100) * weights.probConfWeight;

    // High probability acceleration (underdog conf > 30% means higher chance)
    if (probUnderdogPct > 30) {
        uScoreUpset += (probUnderdogPct - 30) * (weights.upsetProbBoost || 2); 
    }

    // 2. Algo + Pred + Pattern logic (Seer support)
    if (algoPred.includes(moUnderdog)) uScoreUpset += weights.algoWeight;
    else if (algoPred.includes('X')) uScoreDraw += weights.algoWeight;
    else if (algoPred.includes(moFav)) uScoreFav += weights.algoWeight;

    if (subPred.includes(moUnderdog)) uScoreUpset += weights.subPatternWeight;
    else if (subPred.includes('X')) uScoreDraw += weights.subPatternWeight;
    else if (subPred.includes(moFav)) uScoreFav += weights.subPatternWeight;

    if (pred1x2.includes(moUnderdog)) uScoreUpset += weights.pred1x2Weight;
    else if (pred1x2.includes('X')) uScoreDraw += weights.pred1x2Weight;
    else if (pred1x2.includes(moFav)) uScoreFav += weights.pred1x2Weight;

    // 3. PAA / Historical Support
    if (paaPred.includes(moUnderdog)) uScoreUpset += weights.paaPredWeight;
    else if (paaPred.includes('X')) uScoreDraw += weights.paaPredWeight;
    else if (paaPred.includes(moFav)) uScoreFav += weights.paaPredWeight;

    uScoreUpset += (paaUpsetPct / 100) * weights.phaWeight;
    uScoreDraw += (phaDrawPct / 100) * weights.phaWeight;
    uScoreFav += (paaFavPct / 100) * weights.phaWeight;
    
    // Explicit dynamic boosting using Upset-specific weights
    if (paaUpsetPct > 20) {
        uScoreUpset += (weights.upsetPaaBoost || 0);
    }
    if (seerSupportsUnderdog) {
        uScoreUpset += (weights.upsetSeerPrimBoost || 0);
    }
    if (subPred.includes(moUnderdog)) {
         uScoreUpset += (weights.upsetPatternBoost || 0);
    }

    // Volatile PHA Tie Boost (prioritize for upsets)
    if (m.evaluatorTags?.includes('VOLATILE:PHA_TIE')) {
        uScoreUpset += 15; 
    }

    // Apply Underdog Supreme Tier Boost from high performing underdog insights
    const supremeUnderdog = getMatchSupremeTierUnderdog(m, phaStatsMap);
    uScoreUpset += supremeUnderdog.score;

    let sUpset = uScoreUpset;
    let sDraw = uScoreDraw;
    let sFav = uScoreFav;
    const minScore = Math.min(sUpset, sDraw, sFav);
    if (minScore < 0) {
        // Shift scores to be strictly positive if any is negative, to preserve relative differences and avoid 0% total
        const shift = Math.abs(minScore) + 2;
        sUpset += shift;
        sDraw += shift;
        sFav += shift;
    }

    const nonNegativeUpset = sUpset;
    const nonNegativeDraw = sDraw;
    const nonNegativeFav = sFav;

    const total = nonNegativeUpset + nonNegativeDraw + nonNegativeFav;
    // Normalize to 100 percentages
    let pUpset = total > 0 ? Math.round((nonNegativeUpset / total) * 100) : 0;
    let pDraw = total > 0 ? Math.round((nonNegativeDraw / total) * 100) : 0;
    let pFav = total > 0 ? Math.round((nonNegativeFav / total) * 100) : 0;
    
    if (total > 0) {
        const diff = 100 - (pUpset + pDraw + pFav);
        if (diff !== 0) {
            const arr = [
                { k: 'U', v: nonNegativeUpset },
                { k: 'D', v: nonNegativeDraw },
                { k: 'F', v: nonNegativeFav }
            ].sort((a,b) => b.v - a.v);
            if (arr[0].k === 'U') pUpset += diff;
            else if (arr[0].k === 'D') pDraw += diff;
            else pFav += diff;
        }
    }
    
    const percentages = {
        '1': moUnderdog === '1' ? pUpset : (moFav === '1' ? pFav : pDraw),
        'X': pDraw,
        '2': moUnderdog === '2' ? pUpset : (moFav === '2' ? pFav : pDraw),
    };

    const scores = {
        '1': moUnderdog === '1' ? uScoreUpset : (moFav === '1' ? uScoreFav : uScoreDraw),
        'X': uScoreDraw,
        '2': moUnderdog === '2' ? uScoreUpset : (moFav === '2' ? uScoreFav : uScoreDraw),
    };

    const scoresList = [
        { k: moUnderdog, v: uScoreUpset },
        { k: 'X', v: uScoreDraw },
        { k: moFav, v: uScoreFav },
    ].sort((a,b) => b.v - a.v);

    let primary = scoresList[0].k;
    const secondary = scoresList[1].k;

    let final = primary;
    
    // Determine natural prediction based on top 2 scores
    if (primary === '1') {
        if (secondary === '2') {
            const scoreXVal = scoresList.find(s => s.k === 'X')?.v || 0;
            const probX = (liveAlgoReport?.probabilities?.['X'] || 0) * 100;
            const tsDiff = (m.tsa !== undefined && m.tsb !== undefined) ? Math.abs(m.tsa - m.tsb) : null;
            
            const isScoreGapSmall = (scoresList[1].v - scoreXVal) < 12;
            const isProbXRisky = probX > 58;
            const isCloselyMatched = tsDiff !== null && tsDiff <= 0.01;

            if (isScoreGapSmall || isProbXRisky || isCloselyMatched) {
                final = '1X';
            } else {
                final = '12';
            }
        } else {
            final = '1X';
        }
    } else if (primary === '2') {
        if (secondary === '1') {
            const scoreXVal = scoresList.find(s => s.k === 'X')?.v || 0;
            const probX = (liveAlgoReport?.probabilities?.['X'] || 0) * 100;
            const tsDiff = (m.tsa !== undefined && m.tsb !== undefined) ? Math.abs(m.tsa - m.tsb) : null;
            
            const isScoreGapSmall = (scoresList[1].v - scoreXVal) < 12;
            const isProbXRisky = probX > 58;
            const isCloselyMatched = tsDiff !== null && tsDiff <= 0.01;

            if (isScoreGapSmall || isProbXRisky || isCloselyMatched) {
                final = 'X2';
            } else {
                final = '12';
            }
        } else {
            final = 'X2';
        }
    } else if (primary === 'X') {
        if (secondary === '1') {
            final = '1X';
        } else {
            final = 'X2';
        }
    } else {
        final = primary + secondary;
    }

    if (primary === '1' && final === '1X' && percentages['2'] > 35) {
        final = '12';
    } else if (primary === '2' && final === 'X2' && percentages['1'] > 35) {
        final = '12';
    }
    
    if (weights === DEFAULT_WEIGHTS) {
    // Upset algorithm OVERRIDE rules
    // Main goal: capture the underdog when merited, but avoid forcing it on pure favorites
    const favTS = moFav === '1' ? m.tsa : m.tsb;
    const upsetTS = moUnderdog === '1' ? m.tsa : m.tsb;
    const isUnderdogHigherTS = (favTS !== undefined && upsetTS !== undefined) && (upsetTS > favTS);
    const supremeUnderdog = getMatchSupremeTierUnderdog(m, phaStatsMap);

    const isAlgoSupportsUdog = algoPred.includes(moUnderdog);
    const isSubPatternSupportsUdog = subPred.includes(moUnderdog);
    const isPred1x2SupportsUdog = pred1x2.includes(moUnderdog);
    const isPaaUpsetDecent = paaUpsetPct >= 18;
    const isProbUdogDecent = probUnderdogPct >= 22;
    const isPointsUpsetFlag = !!m.totalPoints?.breakdown?.upsetPotential;

    const isAlgoUpsetStrict = algoPred.includes(moUnderdog) && !algoPred.includes(moFav);

    // Combining these into a broader, much more receptive threat detection formula
    const isStrongUpsetThreat = 
        isAlgoUpsetStrict || 
        paaUpsetPct > 30 || 
        supremeUnderdog.insightsHit > 0 ||
        isUnderdogHigherTS ||
        (isPaaUpsetDecent && isProbUdogDecent) || 
        (isPointsUpsetFlag && paaUpsetPct > 18) ||
        (isAlgoSupportsUdog && isSubPatternSupportsUdog) || // Double system agreement on underdog
        (isSubPatternSupportsUdog && isPaaUpsetDecent) ||   // Pattern matches historical performance
        (isAlgoSupportsUdog && isProbUdogDecent) ||          // Live algorithm probability aligns with prediction
        (isPred1x2SupportsUdog && isPaaUpsetDecent);         // 1X2 model aligns with history

    // User instruction: on Upsets we need the underdog to win, not draw or Mfav to win.
    primary = moUnderdog;
    final = moUnderdog;
    
    // Virtual Cognitive Failure-Study Agents (Pivot Rules)
    const udogSeerScore = percentages[moUnderdog as '1'|'2'] || 0;
    const drawSeerScore = percentages['X'] || 0;
    
    const favDrawHedge = moFav === '1' ? '1X' : 'X2';
    const udogDrawHedge = moUnderdog === '1' ? '1X' : 'X2';
    
    // Extract odds from m.mo
    let favOddsNum = 0;
    let udogOddsNum = 0;
    let drawOddsNum = 0;
    if (m.mo && String(m.mo).trim() !== 'NA') {
        const parts = String(m.mo).split(/[,\s:\/\-]+/).filter(p => p.trim() !== '');
        if (parts.length >= 3) {
            const odds1 = parseFloat(parts[0]);
            const oddsX = parseFloat(parts[1]);
            const odds2 = parseFloat(parts[2]);
            if (!isNaN(odds1) && !isNaN(odds2) && !isNaN(oddsX)) {
                favOddsNum = moFav === '1' ? odds1 : odds2;
                udogOddsNum = moUnderdog === '1' ? odds1 : odds2;
                drawOddsNum = oddsX;
            }
        }
    }

    // Agent 1: Underdog Pivot Analyst
    let agent1Triggered = false;
    if (final === favDrawHedge) {
        if (udogSeerScore >= 25.0 && paaUpsetPct >= 15.0 && udogOddsNum > 0 && udogOddsNum <= 4.50) {
            final = '12';
            agent1Triggered = true;
        }
    }

    // Agent 2: Favorite Demotion Analyst
    if (!agent1Triggered && final === favDrawHedge) {
        if (favOddsNum >= 1.80 && paaFavPct <= 50.0 && paaUpsetPct >= 20.0 && udogSeerScore >= 30.0) {
            final = udogDrawHedge;
        }
    }

    // Agent 3: Draw Risk Trap Analyst
    if (!agent1Triggered && final === '12') {
        if (drawSeerScore >= 25.0 && phaDrawPct >= 20.0 && drawOddsNum > 0 && drawOddsNum <= 3.80) {
            final = favDrawHedge;
        }
    }
    } // End of weights === DEFAULT_WEIGHTS check

    // Sort final (e.g. 21 -> 12, 2X -> X2, X1 -> 1X)
    if (final === '21') final = '12';
    if (final === '2X') final = 'X2';
    if (final === 'X1') final = '1X';

    return {
        primary,
        final,
        scores,
        percentages,
        activeHedgingProtocol
    };
};

export const predictSeerDetailed = (m: Match, weights: CategoryWeights, phaStatsMap: Record<string, any>, matchStars: Record<string, number>, selectedCategory: string = 'all', isDefaultRun: boolean = false): SeerDetailedResult => {
    if (selectedCategory === 'upsets') {
        return predictUpsetSeerDetailed(m, weights, phaStatsMap, matchStars);
    }
    
    // ALWAYS use live algorithm predictions instead of stale database values
    if (!(m as any)._liveAlgoReport) {
        (m as any)._liveAlgoReport = matchAlgorithm.predict(m);
    }
    const liveAlgoReport = (m as any)._liveAlgoReport;

    const score1 = getMatchScore(m, '1', weights, phaStatsMap, matchStars, selectedCategory);
    const scoreX = getMatchScore(m, 'X', weights, phaStatsMap, matchStars, selectedCategory);
    const score2 = getMatchScore(m, '2', weights, phaStatsMap, matchStars, selectedCategory);

    let s1 = score1;
    let sX = scoreX;
    let s2 = score2;
    const minScore = Math.min(s1, sX, s2);
    if (minScore < 0) {
        // Shift scores to be strictly positive if any is negative, to preserve relative differences and avoid 0% total
        const shift = Math.abs(minScore) + 2;
        s1 += shift;
        sX += shift;
        s2 += shift;
    }

    const nonNegative1 = s1;
    const nonNegativeX = sX;
    const nonNegative2 = s2;

    const percentTotal = nonNegative1 + nonNegativeX + nonNegative2;
    let p1 = percentTotal > 0 ? Math.round((nonNegative1 / percentTotal) * 100) : 0;
    let pX = percentTotal > 0 ? Math.round((nonNegativeX / percentTotal) * 100) : 0;
    let p2 = percentTotal > 0 ? Math.round((nonNegative2 / percentTotal) * 100) : 0;
    
    if (percentTotal > 0) {
        const diff = 100 - (p1 + pX + p2);
        if (diff !== 0) {
            const arr = [
                { k: '1', v: nonNegative1 },
                { k: 'X', v: nonNegativeX },
                { k: '2', v: nonNegative2 }
            ].sort((a,b) => b.v - a.v);
            if (arr[0].k === '1') p1 += diff;
            else if (arr[0].k === 'X') pX += diff;
            else p2 += diff;
        }
    }

    const percentages = { '1': p1, 'X': pX, '2': p2 };

    const scoresList = [
        { k: '1', v: score1 },
        { k: 'X', v: scoreX },
        { k: '2', v: score2 },
    ].sort((a,b) => b.v - a.v);

    let primary = scoresList[0].k;
    const secondary = scoresList[1].k;
    
    let final = primary;
    
    // Determine natural prediction based on top 2 scores
    if (primary === '1') {
        if (secondary === '2') {
            // High scorers are 1 and 2, check if draw (X) is a significant threat
            const scoreXVal = scoresList.find(s => s.k === 'X')?.v || 0;
            const probX = (liveAlgoReport.probabilities?.['X'] || 0) * 100;
            const tsDiff = (m.tsa !== undefined && m.tsb !== undefined) ? Math.abs(m.tsa - m.tsb) : null;
            
            // Safely identify when a '12' is weak and requires a safe hedge
            const isScoreGapSmall = (scoresList[1].v - scoreXVal) < 12; // Draw score is closing in on 2nd place
            const isProbXRisky = probX > 58; // High raw draw probability (Optimized)
            const isCloselyMatched = tsDiff !== null && tsDiff <= 0.01; // OPTIMIZED

            if (isScoreGapSmall || isProbXRisky || isCloselyMatched) {
                final = '1X'; // Hedge with Draw because it's risky
            } else {
                final = '12'; // Keep the win-win hedge
            }
        } else {
            // Secondary is already X
            final = '1X';
        }
    } else if (primary === '2') {
        if (secondary === '1') {
            const scoreXVal = scoresList.find(s => s.k === 'X')?.v || 0;
            const probX = (liveAlgoReport.probabilities?.['X'] || 0) * 100;
            const tsDiff = (m.tsa !== undefined && m.tsb !== undefined) ? Math.abs(m.tsa - m.tsb) : null;
            
            const isScoreGapSmall = (scoresList[1].v - scoreXVal) < 12;
            const isProbXRisky = probX > 58; // Optimized
            const isCloselyMatched = tsDiff !== null && tsDiff <= 0.01; // OPTIMIZED

            if (isScoreGapSmall || isProbXRisky || isCloselyMatched) {
                final = 'X2';
            } else {
                final = '12';
            }
        } else {
            // Secondary is already X
            final = 'X2';
        }
    } else if (primary === 'X') {
        // If primary is X, we must pick secondary win option to form a DC hedge
        if (secondary === '1') {
            final = '1X';
        } else {
            final = 'X2';
        }
    } else {
        // Fallback for unexpected cases
        final = primary + secondary;
    }

    // Stop defaulting to 1X/X2 when it is clear that the match will either end in home or away
    if (primary === '1' && final === '1X' && percentages['2'] > 35) {
        final = '12';
    } else if (primary === '2' && final === 'X2' && percentages['1'] > 35) {
        final = '12';
    }

    // NEW OPTIMIZATION: Stalemate Draw Interceptor & Upset Preserver
    const sub = m.patternAnalysis?.subPattern;
    const stats = sub ? phaStatsMap[sub] : null;
    let moFav = (m as any)._moFav;
    let moUpset = (m as any)._moUpset;
    let favOdds = (m as any)._favOdds || 0;
    if (moFav === undefined) {
        moFav = '1';
        moUpset = '2';
        if (m.mo && String(m.mo).trim() !== 'NA') {
            const parts = String(m.mo).split(/[,\s:\/\-]+/).filter(p => p.trim() !== '');
            const odds1 = parts.length > 0 ? parseFloat(parts[0]) : 0;
            const odds2 = parts.length > 2 ? parseFloat(parts[2]) : 0;
            if (!isNaN(odds1) && !isNaN(odds2) && odds1 > 0 && odds2 > 0) {
                if (odds1 < odds2) {
                    moFav = '1'; moUpset = '2'; favOdds = odds1;
                } else if (odds2 < odds1) {
                    moFav = '2'; moUpset = '1'; favOdds = odds2;
                } else {
                    moFav = '1'; moUpset = '2'; favOdds = odds1;
                }
            }
        }
        (m as any)._moFav = moFav;
        (m as any)._moUpset = moUpset;
        (m as any)._favOdds = favOdds;
    }

    let finalPercentages = { ...percentages };
    let finalScores = { '1': score1, 'X': scoreX, '2': score2 };

    if (weights === DEFAULT_WEIGHTS) {
        if (stats) {
            const total = stats.total || 0;
        if (total > 0) {
            const drawRate = (stats.draw / total) * 100;
            const favWinRate = (stats.favWin / total) * 100;
            const upsetWinRate = (stats.upsetWin / total) * 100;
            const tsDiff = (m.tsa !== undefined && m.tsb !== undefined) ? Math.abs(m.tsa - m.tsb) : null;

            // GS Average parsing safely
            let gsH = m.gsHome;
            let gsA = m.gsAway;
            if (gsH === undefined || gsA === undefined) {
                if (m.gs) {
                    const partsGs = String(m.gs).split(/[:\-\/]/).map(s => parseFloat(s.trim()));
                    gsH = partsGs[0] || 0;
                    gsA = partsGs[1] || 0;
                }
            }

            const favoriteBiasedCats = ['best_bet', 'top10', 'top_10_value', 'bankers_dlive', 'botb_best', 'top20', 'bankers_jackpot', 'value_picks'];
            const drawBiasedCats = ['banker_draws'];
            
            // A. Stalemate Draw Interceptor
            if (final === '12') {
                const isLowScoring = gsH !== undefined && gsA !== undefined && gsH <= 1 && gsA <= 1;
                if (drawRate >= 29 || (tsDiff !== null && tsDiff <= 0.3 && isLowScoring) || drawBiasedCats.includes(selectedCategory)) {
                    final = moFav === '1' ? '1X' : 'X2';
                }
            }

            // B. Upset Preserver (Disable for Favorite/Draw Biased Categories)
            if (!favoriteBiasedCats.includes(selectedCategory) && !drawBiasedCats.includes(selectedCategory)) {
                if (tsDiff !== null && tsDiff <= 0.3 && upsetWinRate > favWinRate && upsetWinRate >= 23) {
                    if (final !== '12') {
                        final = '12';
                    }
                }
            }
        }
    }

    // C. High Draw Threat Hedge (Double Chance Upset)
    if (final === '12' && percentages['X'] >= 35) {
        final = moUpset === '1' ? '1X' : 'X2';
    }

    // --- ENHANCED 4-SCENARIO HEDGING & STALEMATE ENGINE ---
    const algoPredFinal = liveAlgoReport?.prediction || '';
    const paaPredFinal = m.paaPrediction || m.paaPrimaryPrediction || '';
    const subPredFinal = m.patternAnalysis?.subPatternPrediction || '';

    const isAlgo12 = algoPredFinal === '12';
    const isPaa12 = paaPredFinal === '12';
    const isSub12 = subPredFinal === '12';

    // Scenario 1: Unanimous '12' (Sub Pattern + Algo + PAA all agree on '12') -> Preserve '12'
    if (isAlgo12 && isPaa12 && isSub12) {
        final = '12';
        if (primary === 'X') {
            primary = percentages['1'] >= percentages['2'] ? '1' : '2';
        }
    } 
    // Scenario 2: Sub Pattern + Algo agree on '12', but PAA dissents -> PAA draw signal valid -> Hedge 1X/X2
    else if (isSub12 && isAlgo12 && !isPaa12) {
        final = moFav === '1' ? '1X' : 'X2';
    } 
    // Scenario 3: Sub Pattern + PAA agree on '12', but Algo dissents -> Follow Algo's 1X/X2
    else if (isSub12 && isPaa12 && !isAlgo12) {
        if (algoPredFinal === '1X' || algoPredFinal === 'X2') {
            final = algoPredFinal;
        } else {
            final = moFav === '1' ? '1X' : 'X2';
        }
    } 
    // Scenario 4: PAA + Algo agree on '12', but Sub Pattern dissents -> Check Sub Pattern Underdog vs Draw rate
    else if (isPaa12 && isAlgo12 && !isSub12) {
        if (stats && stats.total > 0) {
            const upsetWinRate = (stats.upsetWin / stats.total) * 100;
            const drawRate = (stats.draw / stats.total) * 100;
            if (upsetWinRate > drawRate) {
                final = '12';
            } else {
                final = moFav === '1' ? '1X' : 'X2';
            }
        } else {
            final = moFav === '1' ? '1X' : 'X2';
        }
    }

    // STALEMATE DRAW VS UNDERDOG CLASSIFICATION
    const tsDiff = (m.tsa !== undefined && m.tsb !== undefined) ? Math.abs(m.tsa - m.tsb) : null;
    let gsH = m.gsHome;
    let gsA = m.gsAway;
    if (gsH === undefined || gsA === undefined) {
        if (m.gs) {
            const partsGs = String(m.gs).split(/[:\-\/]/).map(s => parseFloat(s.trim()));
            gsH = partsGs[0] || 0;
            gsA = partsGs[1] || 0;
        }
    }

    const probX = (liveAlgoReport?.probabilities?.['X'] || 0) * 100;
    const isStalemate = tsDiff !== null && tsDiff <= 0.25;

    if (isStalemate && stats && stats.total > 0) {
        const drawRate = (stats.draw / stats.total) * 100;
        const upsetWinRate = (stats.upsetWin / stats.total) * 100;
        const isLowScoring = gsH !== undefined && gsA !== undefined && gsH <= 1.0 && gsA <= 1.0;

        // Condition A: Draw-Dominated Stalemate (Low scoring OR Draw Rate > Underdog Win Rate OR High Model Draw Prob)
        if (isLowScoring || drawRate > upsetWinRate || probX >= 30) {
            if (final === '12') {
                final = moFav === '1' ? '1X' : 'X2';
            }
        } 
        // Condition B: Underdog-Dominated Stalemate (High scoring attack OR Underdog Win Rate > Draw Rate)
        else if ((gsH > 1.2 || gsA > 1.2) || upsetWinRate > drawRate) {
            const favCategories = ['best_bet', 'top10', 'top_10_value', 'bankers_dlive', 'botb_best', 'top20', 'bankers_jackpot', 'value_picks'];
            const drawCategories = ['banker_draws'];
            if (!favCategories.includes(selectedCategory) && !drawCategories.includes(selectedCategory)) {
                final = '12';
            }
        }
    }

    // --- DUAL SYNERGY ENGINE (ALGO MARKET FAV + SUB PATTERN UNDERDOG) ---
    const favDC = moFav === '1' ? '1X' : 'X2';
    const upsetDC = moUpset === '1' ? '1X' : 'X2';

    const probs = liveAlgoReport?.probabilities || {};
    const favProb = (probs[moFav] || 0) * 100;

    // Signal 1: Algo High Confidence Market Favorite (88.62% DC hit rate historically)
    const isAlgoFav = (algoPredFinal === moFav || algoPredFinal === favDC || algoPredFinal === '12');
    const isAlgoHighConfFav = isAlgoFav && (favProb >= 45 || (favOdds > 0 && favOdds <= 1.85));

    // Signal 2: Sub Pattern Underdog Primary Prediction (Based on Historical Audit)
    // - Underdog Win: 33.17%, Fav Win: 40.46%, Draw: 26.37%
    // - Non-Draw ('12'): 73.63% hit rate (74.54% when tsDiff > 0.3)
    const subPredPrimary = m.patternAnalysis?.primaryPrediction || '';
    const isSubPrimaryUnderdog = (subPredPrimary === moUpset);
    const isWideGap = tsDiff !== null && tsDiff > 0.3;

    const favoriteBiasedCatsList = ['best_bet', 'top10', 'top_10_value', 'bankers_dlive', 'botb_best', 'top20', 'bankers_jackpot', 'value_picks'];
    const isFavCategory = favoriteBiasedCatsList.includes(selectedCategory);

    // Signal 3: Underdog Has Higher Team Strength (TS) Than Market Favorite (Audit: 10,114 Matches)
    // - Underdog Win: 38.49% (vs Fav Win: 36.11%), Draw: 25.40%
    // - Underdog Double Chance (1X/X2): 63.89% hit rate (up to 67.40% when TS gap > 0.8)
    // - Underdog TS Higher + Sub Predicts Underdog: Underdog Win = 43.49%, Underdog DC = 68.59%, Non-Draw = 74.91%
    let isUnderdogHigherTS = false;
    let tsAdvantage = 0;
    if (m.tsa !== undefined && m.tsb !== undefined) {
        const favTS = moFav === '1' ? m.tsa : m.tsb;
        const upsetTS = moUpset === '1' ? m.tsa : m.tsb;
        if (upsetTS > favTS) {
            isUnderdogHigherTS = true;
            tsAdvantage = upsetTS - favTS;
        }
    }

    if (isAlgoHighConfFav && !isSubPrimaryUnderdog && !isUnderdogHigherTS) {
        // Market favorite dominates across both odds, patterns, and team strength
        if (final === 'X' || final === upsetDC || final === '12') {
            final = favDC;
        }
    } else if (isUnderdogHigherTS && !isFavCategory) {
        // Underdog actually possesses higher Team Strength than Market Favorite
        if (tsAdvantage > 0.8 || (isUnderdogHigherTS && isSubPrimaryUnderdog)) {
            // Strong Underdog TS Advantage (>0.8) or Dual Alignment (Higher TS + Sub-Pattern both back Underdog)
            // Historical Audit: Underdog wins outright 43.5%-44.2%, Underdog DC hits 67.4%-68.6%
            if (!isAlgoHighConfFav) {
                primary = moUpset;
                final = upsetDC;
            } else {
                // Clash between Algo odds market favorite and Underdog team strength/patterns -> '12' Non-Draw (74.9%-76.8% hit rate)
                final = '12';
                primary = moUpset;
            }
        } else if (tsAdvantage > 0.3) {
            // Moderate Underdog TS Advantage (63.7% Underdog DC, 74.9% Non-Draw)
            if (!isAlgoHighConfFav) {
                if (final === 'X' || final === favDC) {
                    final = upsetDC;
                }
                if (primary === 'X' || primary === moFav) {
                    primary = moUpset;
                }
            } else {
                final = '12';
            }
        } else {
            // Small Underdog TS Advantage (<= 0.3)
            if (isSubPrimaryUnderdog && !isAlgoHighConfFav) {
                final = upsetDC;
                primary = moUpset;
            }
        }
    } else if (isSubPrimaryUnderdog && !isAlgoHighConfFav && !isFavCategory) {
        // Sub predicts underdog, Algo is NOT high confidence favorite
        // High volatility match -> '12' captures the non-draw outcomes well (73.6% hit rate)
        if (final === favDC || final === '1' || final === '2' || final === 'X') {
            final = '12';
            if (primary === 'X') {
                primary = isWideGap ? moFav : moUpset; // In wide gap, Fav still wins 42%. In close, it's 34% vs 37%
            }
        }
    } else if (isAlgoHighConfFav && isSubPrimaryUnderdog) {
        // Dual alignment clash: Algo strongly backs Favorite, Sub explicitly backs Underdog
        // Prime volatile scenario. Draw rate drops heavily (25-28%), making '12' the optimal play.
        final = '12';
        if (primary === 'X') {
            primary = percentages['1'] >= percentages['2'] ? '1' : '2';
        }
    }

    // RECOMMENDATION 2: Safe Hedge Enforcer for Favorite/Draw biased categories
    const favCategories = ['best_bet', 'top10', 'top_10_value', 'bankers_dlive', 'botb_best', 'top20', 'bankers_jackpot', 'value_picks'];
    const drawCategories = ['banker_draws'];
    
    if (favCategories.includes(selectedCategory)) {
        if (primary === moUpset) {
            primary = moFav; // Override primary
        }
        if (final.includes(moUpset)) {
            final = final.replace(moUpset, 'X');
            if (final === 'XX' || final === 'X') final = moFav === '1' ? '1X' : 'X2';
            if (final === 'X1') final = '1X';
            if (final === '2X') final = 'X2';
        }
    } else if (drawCategories.includes(selectedCategory)) {
        primary = 'X';
        final = percentages['1'] >= percentages['2'] ? '1X' : 'X2';
    }

    // ENFORCE HEDGE RULES
    // A hedge MUST include the primary prediction.
    if (primary === '1') {
        if (final !== '1X' && final !== '12' && final !== 'X1' && final !== '21') {
            final = percentages['X'] >= percentages['2'] ? '1X' : '12';
        }
    } else if (primary === '2') {
        if (final !== 'X2' && final !== '12' && final !== '2X' && final !== '21') {
            final = percentages['X'] >= percentages['1'] ? 'X2' : '12';
        }
    } else if (primary === 'X') {
        if (final !== '1X' && final !== 'X2' && final !== 'X1' && final !== '2X') {
            final = percentages['1'] >= percentages['2'] ? '1X' : 'X2';
        }
    }

    // D. MATCH-POINT SUB-PATTERN HEDGE ADJUSTMENTS
    if (m.totalPoints && sub) {
        const favPts = moFav === '1' ? m.totalPoints.home : m.totalPoints.away;
        const udogPts = moUpset === '1' ? m.totalPoints.home : m.totalPoints.away;
        const ptDiff = favPts - udogPts;

        // Scenario 1: Underdog Points Lead (ptDiff < 0)
        if (ptDiff < 0 && final === '12') {
            const s1_12_subs = [
                'G1g16', 'G1q17', 'G2b2', 'G2hh2', 'G3i2', 'G3N1', 'G1x1', 'G2i15',
                'G1o1', 'G1w4', 'G1ff47', 'G2j4', 'G1m3', 'G3j4', 'G1a7', 'G1aa1',
                'G1r2', 'G1a6', 'G1ff53', 'G1g14', 'G3ff45', 'G3b1', 'G1mm1'
            ];
            if (s1_12_subs.includes(sub)) {
                final = moUpset === '1' ? '1X' : 'X2';
            }
        }

        // Scenario 2: Favorite Lead < 10 (0 <= ptDiff < 10)
        if (ptDiff >= 0 && ptDiff < 10 && final === '12') {
            const s2_12_subs = ['G3N1', 'G3u16', 'G1ff57', 'G1ff49', 'G3ii1', 'G2s16', 'G3aa5'];
            if (s2_12_subs.includes(sub)) {
                final = moUpset === '1' ? '1X' : 'X2';
            }
        }
    }

    // TOSS-UP OVERRIDES (GA-based)
    const gaHome = m.gaHome ?? 0;
    const gaAway = m.gaAway ?? 0;
    let tossFav = '1';
    let tossUdog = '2';
    
    if (m.mo && m.mo !== 'NA' && m.mo !== 'Unknown' && m.mo !== '') {
        const parts = String(m.mo).split(/[,\s:\/\-]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
        if (parts.length >= 3) {
            const o1 = parts[0];
            const o2 = parts[2];
            if (o1 !== o2) {
                tossFav = o1 < o2 ? '1' : '2';
                tossUdog = o1 < o2 ? '2' : '1';
            }
        }
    }
    
    const isBothGA12 = gaHome >= 1.2 && gaAway >= 1.2;
    const isBothGA15 = gaHome >= 1.5 && gaAway >= 1.5;
    const isBothGA17 = gaHome >= 1.7 && gaAway >= 1.7;
    const isBothGA20 = gaHome >= 2.0 && gaAway >= 2.0;
    const isOneGA12Other15 = (gaHome >= 1.2 && gaAway >= 1.5) || (gaHome >= 1.5 && gaAway >= 1.2);

    // TOSS-UP OVERRIDES (Points-based)
    const pts = {
        '1': m.totalPoints?.home || 0,
        '2': m.totalPoints?.away || 0
    };
    const fPts = pts[tossFav as '1' | '2'];
    const uPts = pts[tossUdog as '1' | '2'];

    const isUdogFav0 = uPts > fPts;
    const isUdogFav5 = uPts >= fPts + 5;
    const isUdogFav10 = uPts >= fPts + 10;
    const isUdogFav15 = uPts >= fPts + 15;
    const isEqualOrFavLt10 = (fPts === uPts) || (fPts > uPts && fPts < uPts + 10);

    // TOSS-UP OVERRIDES (Hidden Strength)
    const uGs = tossUdog === '1' ? (m.gsHome ?? 0) : (m.gsAway ?? 0);
    const uGa = tossUdog === '1' ? (m.gaHome ?? 0) : (m.gaAway ?? 0);
    const uTs = uGa === 0 ? (uGs === 0 ? 1 : 2) : uGs / uGa;
    const isUdogHiddenStrength = Math.abs(uGs - uGa) <= 0.2;
    const isUdogTsEq1 = isUdogHiddenStrength && uTs === 1;
    const isUdogTsGt1 = isUdogHiddenStrength && uTs > 1.0;
    const isUdogTsLt1 = isUdogHiddenStrength && uTs < 1.0;

    // Standardize representation
    if (final === '21') final = '12';
    if (final === 'X1') final = '1X';
    if (final === '2X') final = 'X2';

    // GUARANTEED SEER PREDICTION SANITY RULES
    // - A prim of 2 cant have a fin of 1X only X2 or 12
    // - A prim of 1 cant have a fin of X2, only 1X or 12
    // - A prim of X cant have a fin of 12, Only 1X or X2.
    if (primary === '1') {
        if (final !== '1X' && final !== '12') {
            final = percentages['X'] >= percentages['2'] ? '1X' : '12';
        }
    } else if (primary === '2') {
        if (final !== 'X2' && final !== '12') {
            final = percentages['X'] >= percentages['1'] ? 'X2' : '12';
        }
    } else if (primary === 'X') {
        if (final !== '1X' && final !== 'X2') {
            final = percentages['1'] >= percentages['2'] ? '1X' : 'X2';
        }
    }

    // ==========================================
    // DYNAMIC SOVEREIGN SAFEGUARD PROTOCOL
    // ==========================================
    const delegateList = [
        "G1g16","G2m14","G2g4","G2f20","G2o2","G3a1","G2i13","G2o8","G1ff53","G1i17","G1ff45","G3j4","G3g1","G3p5","G2a3","G2ee9","G1w4","G2ee7","G3s3","G3f14","G1bb2","G1a7","G3j11","G3t12","G3x3"
    ];

    if (sub) {
        let shouldDelegate = false;
        if (delegateList.includes(sub)) {
            shouldDelegate = true;
        } else {
            // Parse odds
            let minOdds = 2.0;
            if (m.mo && String(m.mo).trim() !== 'NA') {
                const parts = String(m.mo).split(/[,\s:\/\-]+/).filter(p => p.trim() !== '');
                const odds1 = parts.length > 0 ? parseFloat(parts[0]) : 0;
                const odds2 = parts.length > 2 ? parseFloat(parts[2]) : 0;
                if (!isNaN(odds1) && !isNaN(odds2)) {
                    minOdds = Math.min(odds1, odds2);
                }
            }

            if (sub === 'G2p10' && minOdds < 2.3) {
                shouldDelegate = true;
            } else if (sub === 'G3r13' && minOdds < 2.3) {
                shouldDelegate = true;
            } else if (sub === 'G2ff43' && minOdds < 2.1) {
                shouldDelegate = true;
            } else if (sub === 'G3j2' && minOdds < 2.1) {
                shouldDelegate = true;
            } else if (sub === 'G1r18' && minOdds < 1.5) {
                shouldDelegate = true;
            }
        }

        if (shouldDelegate && liveAlgoReport) {
            final = liveAlgoReport.prediction;
            if (liveAlgoReport.probabilities) {
                const p1 = liveAlgoReport.probabilities['1'] || 0;
                const pX = liveAlgoReport.probabilities['X'] || 0;
                const p2 = liveAlgoReport.probabilities['2'] || 0;

                // Set primary to highest probability
                if (pX > p1 && pX > p2) primary = 'X';
                else if (p2 > p1 && p2 > pX) primary = '2';
                else primary = '1';

                // Map probabilities to percentages
                const pct1 = Math.round(p1 * 100);
                const pctX = Math.round(pX * 100);
                const pct2 = Math.round(p2 * 100);

                finalPercentages = { '1': pct1, 'X': pctX, '2': pct2 };
                finalScores = { '1': pct1, 'X': pctX, '2': pct2 };
            }
        }
    }

    // Removed SEER OPTIMIZED SELECTOR LOGIC to allow optimized slips to make their own independent predictions and hedging.

    // Removed DYNAMIC COGNITIVE DRAW-DISAGREEMENT SAFEGUARD PROTOCOL and DYNAMIC COGNITIVE S.WIN & UNDERDOG PERCENTAGE-BASED HEDGING PROTOCOL as they reduced baseline accuracy.

    // OPTIMIZED '12' vs PAA CONFLICT RESOLUTION (Rule 4)
    if (final === '12') {
        const subForPaa = m.patternAnalysis?.subPattern;
        const statForPaa = subForPaa ? phaStatsMap[subForPaa] : null;
        if (statForPaa) {
            const paaPredObj = calculatePAAPrediction(m, statForPaa);
            const pPred = paaPredObj ? paaPredObj.paaPrediction : (m.paaPrediction || m.paaPrimaryPrediction || '');
            if (pPred === '1X' || pPred === 'X2') {
                const totalPaa = statForPaa.paaTotal || 1;
                const paaDrawPct = (statForPaa.paaDraw / totalPaa) * 100;
                
                // Rule 4: Switch to PAA if PAA Draw % >= 30 OR Seer Draw Score >= 30, UNLESS Seer score data is strongly against PAA prediction
                if (paaDrawPct >= 30 || finalScores['X'] >= 30) {
                    const isPaaOppositeMuchHigher = (pPred === '1X' && finalPercentages['2'] > finalPercentages['1'] + 5) ||
                                                    (pPred === 'X2' && finalPercentages['1'] > finalPercentages['2'] + 5);
                    if (!isPaaOppositeMuchHigher) {
                        final = pPred;
                        if (primary === '1' && pPred === 'X2') primary = '2';
                        if (primary === '2' && pPred === '1X') primary = '1';
                    } else {
                        // Seer Score data is strongly against PAA; do not follow PAA prediction
                        if (finalPercentages['2'] > finalPercentages['1']) {
                            final = 'X2';
                            primary = '2';
                        } else {
                            final = '1X';
                            primary = '1';
                        }
                    }
                }
            }
        }
    }

    } // End of weights === DEFAULT_WEIGHTS check

    // SEER SCORE ALIGNMENT SAFEGUARD: Ensure primary & final do not follow PAA or market fav when Seer scores are strongly against it
    const sortedSeerK = (['1', 'X', '2'] as const).slice().sort((a,b) => (finalPercentages[b] || 0) - (finalPercentages[a] || 0));
    const topSeerK = sortedSeerK[0];
    const topSeerPct = finalPercentages[topSeerK] || 0;
    const currentPrimPct = finalPercentages[primary as '1'|'X'|'2'] || 0;

    // If the top outcome by Seer Score is strongly higher than current primary (by >5%), align primary and final with Seer Scores
    if (topSeerPct > currentPrimPct + 5) {
        primary = topSeerK;
        const secondSeerK = sortedSeerK[1];
        if (primary === '1') {
            if (secondSeerK === '2' && finalPercentages['2'] >= 35) {
                final = '12';
            } else {
                final = '1X';
            }
        } else if (primary === '2') {
            if (secondSeerK === '1' && finalPercentages['1'] >= 35) {
                final = '12';
            } else {
                final = 'X2';
            }
        } else if (primary === 'X') {
            final = finalPercentages['1'] >= finalPercentages['2'] ? '1X' : 'X2';
        }
    }

    let activeHedgingProtocol: string | undefined;

    // TOP 12 HEDGING PROTOCOL
    if (selectedCategory === 'top_10_value') {
        let shouldHedge12 = false;
        
        const moParts = (m.mo || '').split(',').map(s => parseFloat(s.trim()));
        const homeOdds = moParts[0] || 0;
        const awayOdds = moParts[2] || 0;
        let mFav = '1';
        if (homeOdds > 0 && awayOdds > 0 && awayOdds < homeOdds) {
            mFav = '2';
        }
        
        const tsHome = m.tsa || 0;
        const tsAway = m.tsb || 0;
        const mFavTs = mFav === '1' ? tsHome : tsAway;
        const udTs = mFav === '1' ? tsAway : tsHome;

        // Ensure we have paa prediction
        let paaFin = m.paaPrediction || m.paaPrimaryPrediction || '';
        if (!paaFin && m.patternAnalysis?.subPattern && phaStatsMap[m.patternAnalysis.subPattern]) {
            const computedPaa = calculatePAAPrediction(m, phaStatsMap[m.patternAnalysis.subPattern]);
            if (computedPaa) paaFin = computedPaa.paaPrediction;
        }
        
        const algoFin = liveAlgoReport?.prediction || m.algoReport?.prediction || '';
        
        // Protocol 1: Paa fin and seer fina predicts 1X/X2 but Algo predicts 12
        const isDC = (p: string) => p === '1X' || p === 'X2';
        if (isDC(paaFin) && isDC(final) && algoFin === '12') {
            shouldHedge12 = true;
        }

        // Protocol 2
        if (mFavTs >= 3.0 && udTs < 0.8) { shouldHedge12 = true; activeHedgingProtocol = "Mfav TS >= 3.0 & Ud TS < 0.8 (Hedge 12)"; }
        else if (mFavTs >= 2.0 && udTs < 0.7) { shouldHedge12 = true; activeHedgingProtocol = "Mfav TS >= 2.0 & Ud TS < 0.7 (Hedge 12)"; }
        else if (mFavTs >= 1.5 && mFavTs < 2.0 && udTs < 0.5) { shouldHedge12 = true; activeHedgingProtocol = "Mfav TS 1.5-1.99 & Ud TS < 0.5 (Hedge 12)"; }
        else if (mFavTs >= 1.0 && mFavTs < 1.5 && udTs < 0.5) { shouldHedge12 = true; activeHedgingProtocol = "Mfav TS 1.0-1.49 & Ud TS < 0.5 (Hedge 12)"; }
        else if (mFavTs < 1.0 && udTs < 1.0) { shouldHedge12 = true; activeHedgingProtocol = "Mfav TS < 1.0 & Ud TS < 1.0 (Hedge 12)"; }

        // Protocol 3: When Team A GA = Team B GA (+- 0.2) and algo final is 12
        const gaDiff = Math.abs((m.gaHome ?? 0) - (m.gaAway ?? 0));
        if (gaDiff <= 0.2 && algoFin === '12') {
            shouldHedge12 = true;
            activeHedgingProtocol = "Team A GA = Team B GA (+-0.2) & Algo 12 (Hedge 12)";
        }
        
        // Protocol 4: Both teams GA >= 1.1 (volatile match)
        if ((m.gaHome ?? 0) >= 1.1 && (m.gaAway ?? 0) >= 1.1) {
            shouldHedge12 = true;
            activeHedgingProtocol = "Both teams GA >= 1.1 (volatile match) (Hedge 12)";
        }

        // Protocol 5: Underdog has >= 5 more points on point system
        const mFavPoints = mFav === '1' ? (m.totalPoints?.home || 0) : (m.totalPoints?.away || 0);
        const udPoints = mFav === '1' ? (m.totalPoints?.away || 0) : (m.totalPoints?.home || 0);
        if (udPoints - mFavPoints >= 5 && udTs > mFavTs) {
            shouldHedge12 = true;
            activeHedgingProtocol = "Underdog has >= 5 more points on point system + Underdog TS > M.fav TS (Hedge 12)";
        }

        if (isDC(paaFin) && isDC(final) && algoFin === '12') {
            shouldHedge12 = true;
            if (!activeHedgingProtocol) activeHedgingProtocol = "PAA & SEER 1X/X2 but Algo 12 (Hedge 12)";
        }

        if (shouldHedge12) {
            final = '12';
        }
    }

    // SIEVE PREMIUM CONSENSUS CALCULATION
    const scoreDiff = finalScores[primary] - (finalScores['X'] + finalScores[primary === '1' ? '2' : '1']) / 2;
    const isScoreStable = scoreDiff >= 25;
    const isHighProb = liveAlgoReport?.probabilities?.[primary as '1'|'X'|'2'] * 100 >= 52;
    const isSievePremium = isScoreStable && isHighProb;

    return { 
        primary, 
        final, 
        scores: finalScores,
        percentages: finalPercentages,
        isScoreStable,
        isHighProb,
        isSievePremium
    };
};

export const predictWithSeer = (m: Match, weights: CategoryWeights, phaStatsMap: Record<string, any>, matchStars: Record<string, number>, selectedCategory: string = 'all'): string => {
    return predictSeerDetailed(m, weights, phaStatsMap, matchStars, selectedCategory).final;
};
