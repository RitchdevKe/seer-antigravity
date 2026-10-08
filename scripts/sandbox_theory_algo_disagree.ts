import * as fs from 'fs';
import * as path from 'path';

import { Match } from '../src/types';
import { getMatchStats } from '../src/utils/matchEvaluator';
import { getOdds } from '../src/utils/volatilityEngine';
import { runPivotEngine } from '../src/utils/pivotEngine';
import { detectMainPattern, analyzeSubPatterns, getActiveFlags, SUB_PATTERN_RULES } from '../src/components/Patterns';

const dataPath = path.join(process.cwd(), 'supabase_backup', 'precalculated_matches.json');
const paaPath = path.join(process.cwd(), 'supabase_backup', 'pattern_accuracy_audit.json');

const dbRows = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
const rawMatches = dbRows.map((r: any) => r.data || r);
const paaStatsRaw = JSON.parse(fs.readFileSync(paaPath, 'utf-8'));

const phaStatsMap: Record<string, any> = {};
for (const p of paaStatsRaw) {
    if (p.sub_pattern) {
        phaStatsMap[p.sub_pattern] = p;
    }
}

let validMatches = rawMatches.filter((m: any) => {
    if (!m.result || !m.mo) return false;
    if (!m.algoReport?.probabilities) return false;
    if (!m.totalPoints) return false;
    const odds = getOdds(m as Match);
    if (odds.favOdds < 1.3 || odds.favOdds > 2.80) return false;
    return true;
});

let testStats = { 
    totalConflicts: 0, 
    mlKept: { count: 0, wins: 0, gross: 0 }, 
    pivotForced1X: { count: 0, wins: 0, gross: 0 },
    pivotForced12: { count: 0, wins: 0, gross: 0 }
};

for (const m of validMatches) {
    const stats = getMatchStats(m, phaStatsMap);
    const odds = getOdds(m);
    
    const mFav = odds.o1 <= odds.o2 ? '1' : '2';
    const mUd = mFav === '1' ? '2' : '1';
    
    const favDC = mFav === '1' ? '1X' : 'X2';
    const upsetDC = mUd === '1' ? '1X' : 'X2';
    const favWin = mFav;
    const undWin = mUd;

    let ar = "";
    if (m.result && m.result.includes(':')) {
        const [hg, ag] = m.result.split(':').map(Number);
        if (hg > ag) ar = '1';
        else if (hg < ag) ar = '2';
        else ar = 'X';
    } else {
        ar = (m.result || "").trim();
    }
    const isFav = ar === mFav;
    const isDraw = ar === 'X';
    const isUd = ar === mUd;

    // Simulate Sub Pattern Prediction (because some older matches don't have it on the object)
    const mainPattern = detectMainPattern(m);
    const activeFlags = getActiveFlags(m);
    const subPatternAnalysis = analyzeSubPatterns(mainPattern, m, activeFlags, []);
    const subPred = subPatternAnalysis?.finalPrediction || favDC;

    const paaPred = m.paaPrediction || favDC;
    const algoPred = m.algoReport?.prediction || favDC;
    const seerPred = m.seerPrediction || favDC;

    // CONFLICT DETECTION: Sub/PAA/Seer agree on FavDC (1X/X2), but Algo says 12.
    // User requested: "Matches where the sub pattern, PAA and seer or Seer+ Paa agree on final as 1X/X2 but Algo disagrees and hedges 12"
    
    const isPaaSeerAgree = (paaPred === favDC && seerPred === favDC);
    const isPaaSubSeerAgree = (paaPred === favDC && seerPred === favDC && subPred === favDC);

    if ((isPaaSeerAgree || isPaaSubSeerAgree) && algoPred === '12') {
        testStats.totalConflicts++;

        // We need to see what the Base ML would do (run the math):
        const algoProbs = m.algoReport?.probabilities || { '1': 0, 'X': 0, '2': 0 };
        const rawFav = (algoProbs[mFav] || 0) * 100;
        const rawDraw = (algoProbs['X'] || 0) * 100;
        const rawUnd = (algoProbs[mUd] || 0) * 100;
        const total = rawFav + rawDraw + rawUnd || 1;
        const hybridFav = (rawFav / total) * 100;
        const hybridDraw = (rawDraw / total) * 100;
        const hybridUnd = (rawUnd / total) * 100;

        const paaDrawCount = stats.paaStats?.draw || 0;
        const paaUpsetCount = stats.paaStats?.upset_win || 0;
        const paaTotal = stats.paaStats?.total || 1;
        const phaDrawPct = (paaDrawCount / paaTotal) * 100;
        const phaUpsetPct = (paaUpsetCount / paaTotal) * 100;

        const matrixDraw = (phaDrawPct + rawDraw) / 2;
        const matrixUnd = (phaUpsetPct + rawUnd) / 2;

        const seerDrawRaw = m.seerPercentages ? m.seerPercentages['X'] : 0;
        const algoDrawRaw = m.algoReport?.probabilities?.['X'] || 0;
        const algoDrawReal = algoDrawRaw <= 1 ? algoDrawRaw * 100 : algoDrawRaw;
        const maxDraw = Math.max(phaDrawPct, seerDrawRaw, algoDrawReal);

        const paaFav = mFav === '1' ? (m.paaWin||0) : (m.paaUpset||0);
        const paaUnd = mFav === '1' ? (m.paaUpset||0) : (m.paaWin||0);
        const paaMax = Math.max(paaFav, phaDrawPct, paaUnd);

        const algoP1 = m.algoReport?.probabilities?.['1'] || 0;
        const algoP2 = m.algoReport?.probabilities?.['2'] || 0;
        const algoFavP = (algoP1 <= 1 ? algoP1 * 100 : algoP1) === 0 ? 0 : (mFav === '1' ? algoP1 : algoP2) * (algoP1 <= 1 ? 100 : 1);
        const algoUndP = (algoP2 <= 1 ? algoP2 * 100 : algoP2) === 0 ? 0 : (mFav === '1' ? algoP2 : algoP1) * (algoP2 <= 1 ? 100 : 1);
        const algoMax = Math.max(algoFavP, algoDrawReal, algoUndP);

        let algoPrim = m.algoReport?.primaryPrediction || '';
        const subPrim = subPatternAnalysis?.primaryPrediction || favWin;

        const input = {
            matrixUnd, matrixDraw, rawFav, rawDraw, rawUnd,
            paaPred, algoPred, seerPred,
            paaPrim: m.paaPrimaryPrediction || '', seerPrim: m.seerPrimaryPrediction || '', algoPrim, subPrim,
            favDC, upsetDC, favWin, undWin,
            hybridFav, hybridDraw, hybridUnd,
            algoMax, paaMax, maxDraw
        };

        // Get the real ML prediction through the Pivot Engine
        const res = runPivotEngine(m, input);
        const mlFinal = res.prediction;

        // Evaluate standard ML behavior
        testStats.mlKept.count++;
        if (mlFinal === favDC) {
            if (isFav || isDraw) {
                testStats.mlKept.wins++;
                const oddsToUse = mFav === '1' ? odds.o1 : odds.o2;
                testStats.mlKept.gross += (oddsToUse * odds.oX) / (oddsToUse + odds.oX);
            }
        } else if (mlFinal === '12') {
            if (isFav || isUd) {
                testStats.mlKept.wins++;
                testStats.mlKept.gross += (odds.o1 * odds.o2) / (odds.o1 + odds.o2);
            }
        }

        // Test Theory: Force Pivot to 1X/X2 (Ignore Algo completely)
        testStats.pivotForced1X.count++;
        if (isFav || isDraw) {
            testStats.pivotForced1X.wins++;
            const oddsToUse = mFav === '1' ? odds.o1 : odds.o2;
            testStats.pivotForced1X.gross += (oddsToUse * odds.oX) / (oddsToUse + odds.oX);
        }

        // Test Theory: Force Pivot to 12 (Trust Algo blindly)
        testStats.pivotForced12.count++;
        if (isFav || isUd) {
            testStats.pivotForced12.wins++;
            testStats.pivotForced12.gross += (odds.o1 * odds.o2) / (odds.o1 + odds.o2);
        }

        // Test Theory: Let Volatility Engine Decide
        testStats.pivotVolatilityDecision = testStats.pivotVolatilityDecision || { count: 0, wins: 0, gross: 0 };
        testStats.pivotVolatilityDecision.count++;

        // Let's compute volScore locally just like Pivot Engine does
        let volScore = 0;
        const paaDrawPct2 = stats.paaStats?.draw || 0;
        const isFavHome = mFav === '1';
        const paaUpsetPct2 = isFavHome ? (stats.paaStats?.upsetWin || 0) : (stats.paaStats?.upsetWin || 0);

        if (paaUpsetPct2 > paaDrawPct2 * 1.2) volScore += 2;
        if (paaUpsetPct2 > 35) volScore += 1;
        if (paaUpsetPct2 > 50) volScore += 2;
        if (rawUnd > rawDraw) volScore += 1.5;
        if (rawUnd > rawDraw + 5) volScore += 1.5;
        if (rawUnd > 40) volScore += 1;
        if (rawUnd > 30) volScore += 1;
        if (rawUnd > 45) volScore += 2;
        const homePts = m.totalPoints?.home || 0;
        const awayPts = m.totalPoints?.away || 0;
        const upsetHasMorePoints = (mUd === '1' && homePts > awayPts) || (mUd === '2' && awayPts > homePts);
        if (upsetHasMorePoints) volScore += 2;
        const league = (m.league || '').toLowerCase();
        if (/cup|friendly|tanzania|kenya|uganda|rwanda|egypt|morocco|nigeria|ghana|south africa|zambia|senegal|tunisia|algeria/i.test(league)) volScore += 1;
        if (rawDraw > 35 || paaDrawPct2 > 40) volScore -= 2;
        const u25Prob = (m.algoReport?.probabilities?.['U2.5'] || 0) * 100;
        if (u25Prob >= 65) volScore -= 1.5;
        if (volScore < 0) volScore = 0;

        let volPred = favDC;
        if (volScore >= 4.5) volPred = '12'; // High volatility = trust Algo's 12 hedge
        if (volScore >= 6.5) volPred = upsetDC; // Extreme volatility = full pivot

        if (volPred === favDC) {
            if (isFav || isDraw) {
                testStats.pivotVolatilityDecision.wins++;
                const oddsToUse = mFav === '1' ? odds.o1 : odds.o2;
                testStats.pivotVolatilityDecision.gross += (oddsToUse * odds.oX) / (oddsToUse + odds.oX);
            }
        } else if (volPred === '12') {
            if (isFav || isUd) {
                testStats.pivotVolatilityDecision.wins++;
                testStats.pivotVolatilityDecision.gross += (odds.o1 * odds.o2) / (odds.o1 + odds.o2);
            }
        } else if (volPred === upsetDC) {
            if (isUd || isDraw) {
                testStats.pivotVolatilityDecision.wins++;
                const oddsToUse = mUd === '1' ? odds.o1 : odds.o2;
                testStats.pivotVolatilityDecision.gross += (oddsToUse * odds.oX) / (oddsToUse + odds.oX);
            }
        }
    }
}

console.log(`\n--- CONFLICT THEORY SANDBOX RESULTS ---`);
console.log(`Scenario: Sub/PAA/Seer say 1X/X2, but Algo says 12`);
console.log(`Total Matches Found: ${testStats.totalConflicts}\n`);

const calcROI = (gross: number, count: number) => (((gross - count) / count) * 100).toFixed(1);

console.log(`1. What the Hybrid ML (Pivot Engine) currently does naturally:`);
console.log(`Win Rate: ${((testStats.mlKept.wins / testStats.mlKept.count) * 100).toFixed(1)}%`);
console.log(`Net Gain: ${(testStats.mlKept.gross - testStats.mlKept.count).toFixed(2)} units (ROI: ${calcROI(testStats.mlKept.gross, testStats.mlKept.count)}%)\n`);

console.log(`2. If we force Pivot Engine to IGNORING Algo and sticking to 1X/X2:`);
console.log(`Win Rate: ${((testStats.pivotForced1X.wins / testStats.pivotForced1X.count) * 100).toFixed(1)}%`);
console.log(`Net Gain: ${(testStats.pivotForced1X.gross - testStats.pivotForced1X.count).toFixed(2)} units (ROI: ${calcROI(testStats.pivotForced1X.gross, testStats.pivotForced1X.count)}%)\n`);

console.log(`3. If we force Pivot Engine to TRUST Algo and play 12:`);
console.log(`Win Rate: ${((testStats.pivotForced12.wins / testStats.pivotForced12.count) * 100).toFixed(1)}%`);
console.log(`Net Gain: ${(testStats.pivotForced12.gross - testStats.pivotForced12.count).toFixed(2)} units (ROI: ${calcROI(testStats.pivotForced12.gross, testStats.pivotForced12.count)}%)\n`);

console.log(`4. If we let the Volatility Engine decide (volScore >= 4.5 -> 12, volScore >= 6.5 -> Upset DC, else 1X/X2):`);
console.log(`Win Rate: ${((testStats.pivotVolatilityDecision.wins / testStats.pivotVolatilityDecision.count) * 100).toFixed(1)}%`);
console.log(`Net Gain: ${(testStats.pivotVolatilityDecision.gross - testStats.pivotVolatilityDecision.count).toFixed(2)} units (ROI: ${calcROI(testStats.pivotVolatilityDecision.gross, testStats.pivotVolatilityDecision.count)}%)\n`);

