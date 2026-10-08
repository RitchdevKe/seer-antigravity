import { Match } from '../types';
import { getMatchStats } from './matchEvaluator';

export const getOdds = (m: Match) => {
    const moParts = (m.mo || "").split(",").map((s: string) => parseFloat(s.trim()));
    const o1 = !isNaN(moParts[0]) && moParts[0] > 0 ? moParts[0] : 2.0;
    const oX = !isNaN(moParts[1]) && moParts[1] > 0 ? moParts[1] : 3.0;
    const o2 = !isNaN(moParts[2]) && moParts[2] > 0 ? moParts[2] : 2.5;
    return { o1, oX, o2, favOdds: Math.min(o1, o2) };
};

/**
 * The Volatility Engine evaluates a match across 7 distinct data layers
 * to classify the match into one of 4 Volatility Tiers.
 * 
 * Returns the mathematically optimal prediction (pure or hedged) for Slip Selection.
 */
export const getOptimalHedge = (m: Match, phaStatsMap: Record<string, any>): string => {
    const stats = getMatchStats(m, phaStatsMap);
    const algoProbs = m.algoReport?.probabilities || { '1': 0.33, 'X': 0.33, '2': 0.33 };
    
    // 1. Market Favorite Rule
    const odds = getOdds(m);
    const mFav = odds.o1 <= odds.o2 ? '1' : '2';
    const mUd = mFav === '1' ? '2' : '1';
    
    let volScore = 0;

    // A. PHA Percentages
    const paaDraw = stats.paaStats?.draw || 0;
    const paaUpset = stats.paaStats?.upsetWin || 0;
    const paaTotal = stats.paaStats?.total || 1;
    const phaDrawPct = (paaDraw / paaTotal) * 100;
    const phaUpsetPct = (paaUpset / paaTotal) * 100;
    
    if (phaUpsetPct > phaDrawPct * 1.2) volScore += 2;
    if (phaUpsetPct > 35) volScore += 1;
    if (phaUpsetPct > 50) volScore += 2;

    // B. ML Probs
    const mlDrawProb = algoProbs['X'] * 100;
    const mlUpsetProb = algoProbs[mUd as keyof typeof algoProbs] * 100;
    if (mlUpsetProb > mlDrawProb) volScore += 1.5;
    if (mlUpsetProb > mlDrawProb + 5) volScore += 1.5;
    if (mlUpsetProb > 40) volScore += 1;

    // C. Odds Constraints
    const drawOdds = odds.oX;
    const udOdds = mFav === '1' ? odds.o2 : odds.o1;
    if (udOdds < drawOdds) volScore += 2;
    if (udOdds < drawOdds + 0.3) volScore += 1;

    // D. Cognitive Total Points
    const homePts = m.totalPoints?.home || 0;
    const awayPts = m.totalPoints?.away || 0;
    const upsetHasMorePoints = (mUd === '1' && homePts > awayPts) || (mUd === '2' && awayPts > homePts);
    if (upsetHasMorePoints) volScore += 2;

    // E. League Context
    const league = (m.league || '').toLowerCase();
    const isVolatileLeague = /cup|friendly|tanzania|kenya|uganda|rwanda|egypt|morocco|nigeria|ghana|south africa|zambia|senegal|tunisia|algeria/i.test(league);
    if (isVolatileLeague) volScore += 1;

    // F. Negative Draw Weighting
    if (mlDrawProb > 35 || phaDrawPct > 40) {
        // If it's a known last-resort risk trap (e.g. 36% seer draw trap), we don't subtract!
        if (!(m as any).isLastResortRisk) {
            volScore -= 2;
        }
    }
    
    // Last Resort Risk (Triggered by slip engines for 30%+ Seer Draw or ud odds <= 3.0)
    if ((m as any).isLastResortRisk) {
        volScore += 5; // Push it firmly towards a 12 pivot (Score > 4.5)
    }
    
    // G. Goal Expectancy Filter
    const u25Prob = (algoProbs['U2.5'] || 0) * 100;
    if (u25Prob >= 65) {
        volScore -= 1.5;
    }
    
    if (volScore < 0) volScore = 0;
    
    // console.log(`volScore: ${volScore}`); // DEBUG

    // Tier 1 (Score 0-2): Pure favorite (1 or 2)
    if (volScore <= 2.0) {
        return mFav;
    }
    
    // Tier 2 (Score 2.5-4.5): 1X or X2 (Hedge with Draw)
    if (volScore > 2.0 && volScore <= 4.5) {
        return mFav === '1' ? '1X' : 'X2';
    }
    
    // Tier 3 (Score 5.0-6.5): 12 (Volatility spike - Upset or Fav)
    if (volScore > 4.5 && volScore <= 6.5) {
        return '12';
    }
    
    // Tier 4 (Score 7.0+): X2 or 1X favoring Underdog (Extreme Upset)
    return mUd === '1' ? '1X' : 'X2';
};
