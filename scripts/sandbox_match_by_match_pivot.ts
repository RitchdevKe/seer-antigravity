import fs from 'fs';
import path from 'path';

import { Match } from '../src/types';
import { getMatchStats } from '../src/utils/matchEvaluator';
import { getOdds, getOptimalHedge } from '../src/utils/volatilityEngine';

import { runPivotEngine } from '../src/utils/pivotEngine';
import { runPivotEngineBaseline } from '../src/utils/pivotEngine_baseline';

// Hardcoded logic to mirror hybridMachineLearning.ts exactly
const runEngine = (m: Match, stats: any, useVolatilityEngine: boolean = false) => {
    const algoProbs = m.algoReport?.probabilities || { '1': 0, 'X': 0, '2': 0 };
    const odds = getOdds(m);
    const mFav = odds.o1 <= odds.o2 ? '1' : '2';
    const mUd = mFav === '1' ? '2' : '1';
    
    const favDC = mFav === '1' ? '1X' : 'X2';
    const upsetDC = mUd === '1' ? '1X' : 'X2';
    const favWin = mFav;
    const undWin = mUd;

    // Simulate Hybrid Probs calculation
    const rawFav = (algoProbs[mFav] || 0) * 100;
    const rawDraw = (algoProbs['X'] || 0) * 100;
    const rawUnd = (algoProbs[mUd] || 0) * 100;
    const total = rawFav + rawDraw + rawUnd || 1;
    const hybridFav = (rawFav / total) * 100;
    const hybridDraw = (rawDraw / total) * 100;
    const hybridUnd = (rawUnd / total) * 100;

    const paaDraw = stats.paaStats?.drawRate || 0;
    const paaUd = stats.paaStats?.upsetRate || 0;
    const matrixDraw = (paaDraw + rawDraw) / 2;
    const matrixUnd = (paaUd + rawUnd) / 2;

    const paaPred = m.paaPrediction || favDC;
    const algoPred = m.algoReport?.prediction || favDC;
    const seerPred = m.seerPrediction || favDC;

    // Data for Theory Overrides
    const paaDrawCount = stats.paaStats?.draw || 0;
    const paaUpsetCount = stats.paaStats?.upset_win || 0;
    const paaTotal = stats.paaStats?.total || 1;
    const phaDrawPct = (paaDrawCount / paaTotal) * 100;
    const phaUpsetPct = (paaUpsetCount / paaTotal) * 100;
    
    const seerDrawRaw = m.seerPercentages ? m.seerPercentages['X'] : 0;
    const algoDrawRaw = m.algoReport?.probabilities?.['X'] || 0;
    const algoDrawReal = algoDrawRaw <= 1 ? algoDrawRaw * 100 : algoDrawRaw;
    const maxDraw = Math.max(paaDraw, seerDrawRaw, algoDrawReal);

    const paaFav = mFav === '1' ? (m.paaWin||0) : (m.paaUpset||0);
    const paaUnd = mFav === '1' ? (m.paaUpset||0) : (m.paaWin||0);
    const paaMax = Math.max(paaFav, paaDraw, paaUnd);

    const algoP1 = m.algoReport?.probabilities?.['1'] || 0;
    const algoP2 = m.algoReport?.probabilities?.['2'] || 0;
    const algoFavP = (algoP1 <= 1 ? algoP1 * 100 : algoP1) === 0 ? 0 : (mFav === '1' ? algoP1 : algoP2) * (algoP1 <= 1 ? 100 : 1);
    const algoUndP = (algoP2 <= 1 ? algoP2 * 100 : algoP2) === 0 ? 0 : (mFav === '1' ? algoP2 : algoP1) * (algoP2 <= 1 ? 100 : 1);
    const algoMax = Math.max(algoFavP, algoDrawReal, algoUndP);

    let paaPrim = m.paaPrimaryPrediction || '';
    let seerPrim = m.seerPrimaryPrediction || '';
    let algoPrim = m.algoReport?.primaryPrediction || '';
    if (!algoPrim && algoFavP > 0) {
        if (algoFavP > algoDrawReal && algoFavP > algoUndP) algoPrim = favWin;
        else if (algoUndP > algoFavP && algoUndP > algoDrawReal) algoPrim = undWin;
        else if (algoDrawReal > algoFavP && algoDrawReal > algoUndP) algoPrim = 'X';
    }
    const subPrim = m.patternAnalysis?.primaryPrediction || m.subPatternOverride?.primary || '';

    // ---- VOLATILITY ENGINE COMPUTATION ----
    let volScore: number | undefined = undefined;
    if (useVolatilityEngine) {
        volScore = 0;
        if (phaUpsetPct > phaDrawPct * 1.2) volScore += 2;
        if (phaUpsetPct > 35) volScore += 1;
        if (phaUpsetPct > 50) volScore += 2;

        if (rawUnd > rawDraw) volScore += 1.5;
        if (rawUnd > rawDraw + 5) volScore += 1.5;
        if (rawUnd > 40) volScore += 1;

        const udOdds = mFav === '1' ? odds.o2 : odds.o1;
        if (udOdds < odds.oX) volScore += 2;
        if (udOdds < odds.oX + 0.3) volScore += 1;

        const homePts = m.totalPoints?.home || 0;
        const awayPts = m.totalPoints?.away || 0;
        const upsetHasMorePoints = (mUd === '1' && homePts > awayPts) || (mUd === '2' && awayPts > homePts);
        if (upsetHasMorePoints) volScore += 2;

        const league = (m.league || '').toLowerCase();
        const isVolLeague = /cup|friendly|tanzania|kenya|uganda|rwanda|egypt|morocco|nigeria|ghana|south africa|zambia|senegal|tunisia|algeria/i.test(league);
        if (isVolLeague) volScore += 1;

        if (rawDraw > 35 || phaDrawPct > 40) volScore -= 2;
        const u25Prob = (algoProbs['U2.5'] || 0) * 100;
        if (u25Prob >= 65) volScore -= 1.5;
        
        if (volScore < 0) volScore = 0;
    }

    const input = {
        matrixUnd, matrixDraw, rawFav, rawDraw, rawUnd,
        paaPred, algoPred, seerPred,
        paaPrim, seerPrim, algoPrim, subPrim,
        favDC, upsetDC, favWin, undWin,
        hybridFav, hybridDraw, hybridUnd,
        algoMax, paaMax, maxDraw,
        volScore
    };
    const res = useVolatilityEngine ? runPivotEngine(m, input) : runPivotEngineBaseline(m, input);
    if (res.sourceName === 'Smart Override Engine') {
        console.log(`Triggered Smart Override Engine for match: ${m.homeTeam} vs ${m.awayTeam}`);
    }
    return res.prediction;
};


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

let baselineStats = { count: 0, wins: 0, cost: 0, gross: 0, pureHits: 0, hedgeHits: 0 };
let upgradedStats = { count: 0, wins: 0, cost: 0, gross: 0, pureHits: 0, hedgeHits: 0 };

for (const m of validMatches) {
    const stats = getMatchStats(m, phaStatsMap);
    const odds = getOdds(m);
    
    const mFav = odds.o1 <= odds.o2 ? '1' : '2';
    const mUd = mFav === '1' ? '2' : '1';
    
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

    const basePred = runEngine(m, stats, false);
    const smartPred = runEngine(m, stats, true);

    const processPrediction = (pred: string, s: any) => {
        s.count++;
        s.cost += 1;
        if (pred === '1' || pred === '2') {
            if (ar === pred) {
                s.wins++; s.pureHits++; s.gross += odds.favOdds;
            }
        } else if (pred === '1X' || pred === 'X2') {
            const side = pred.includes('1') && !pred.includes('2') ? '1' : (pred.includes('2') ? '2' : '');
            if (ar === side || isDraw) {
                s.wins++; s.hedgeHits++; 
                const primaryOdds = side === '1' ? odds.o1 : odds.o2;
                s.gross += (primaryOdds * odds.oX) / (primaryOdds + odds.oX);
            }
        } else if (pred === '12') {
            if (isFav || isUd) {
                s.wins++; s.hedgeHits++;
                s.gross += (odds.o1 * odds.o2) / (odds.o1 + odds.o2);
            }
        }
    };

    processPrediction(basePred, baselineStats);
    processPrediction(smartPred, upgradedStats);
}

console.log("--- BASELINE PIVOT ENGINE ---");
console.log(`Matches: ${baselineStats.count}`);
console.log(`Win Rate: ${(baselineStats.wins / baselineStats.count * 100).toFixed(1)}%`);
console.log(`Net Gain (Units): ${(baselineStats.gross - baselineStats.cost).toFixed(2)}`);
console.log(`ROI: ${((baselineStats.gross - baselineStats.cost) / baselineStats.cost * 100).toFixed(1)}%\n`);

console.log("--- VOLATILITY-ENHANCED PIVOT ENGINE ---");
console.log(`Matches: ${upgradedStats.count}`);
console.log(`Win Rate: ${(upgradedStats.wins / upgradedStats.count * 100).toFixed(1)}%`);
console.log(`Net Gain (Units): ${(upgradedStats.gross - upgradedStats.cost).toFixed(2)}`);
console.log(`ROI: ${((upgradedStats.gross - upgradedStats.cost) / upgradedStats.cost * 100).toFixed(1)}%\n`);
