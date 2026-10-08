import fs from 'fs';
import path from 'path';

import { Match } from '../src/types';
import { getMatchStats } from '../src/utils/matchEvaluator';

const getOdds = (m: Match) => {
    const moParts = (m.mo || "").split(",").map((s: string) => parseFloat(s.trim()));
    const o1 = !isNaN(moParts[0]) && moParts[0] > 0 ? moParts[0] : 2.0;
    const oX = !isNaN(moParts[1]) && moParts[1] > 0 ? moParts[1] : 3.0;
    const o2 = !isNaN(moParts[2]) && moParts[2] > 0 ? moParts[2] : 2.5;
    return { o1, oX, o2, favOdds: Math.min(o1, o2) };
};

const getVolatilityScore = (m: Match, stats: any, algoProbs: any, odds: any) => {
    const mFav = odds.o1 <= odds.o2 ? '1' : '2';
    const mUd = mFav === '1' ? '2' : '1';
    let volScore = 0;
    const paaDraw = stats.paaStats?.draw || 0;
    const paaUpset = stats.paaStats?.upset_win || 0;
    const paaTotal = stats.paaStats?.total || 1;
    const phaDrawPct = (paaDraw / paaTotal) * 100;
    const phaUpsetPct = (paaUpset / paaTotal) * 100;
    
    if (phaUpsetPct > phaDrawPct * 1.2) volScore += 2;
    if (phaUpsetPct > 35) volScore += 1;
    if (phaUpsetPct > 50) volScore += 2;

    const mlDrawProb = (algoProbs['X'] || 0) * 100;
    const mlUpsetProb = (algoProbs[mUd] || 0) * 100;
    if (mlUpsetProb > mlDrawProb) volScore += 1.5;
    if (mlUpsetProb > mlDrawProb + 5) volScore += 1.5;
    if (mlUpsetProb > 40) volScore += 1;

    const drawOdds = odds.oX;
    const udOdds = mFav === '1' ? odds.o2 : odds.o1;
    if (udOdds < drawOdds) volScore += 2;
    if (udOdds < drawOdds + 0.3) volScore += 1;

    const homePts = m.totalPoints?.home || 0;
    const awayPts = m.totalPoints?.away || 0;
    const upsetHasMorePoints = (mUd === '1' && homePts > awayPts) || (mUd === '2' && awayPts > homePts);
    if (upsetHasMorePoints) volScore += 2;

    const league = (m.league || '').toLowerCase();
    const isVolatileLeague = /cup|friendly|tanzania|kenya|uganda|rwanda|egypt|morocco|nigeria|ghana|south africa|zambia|senegal|tunisia|algeria/i.test(league);
    if (isVolatileLeague) volScore += 1;

    if (mlDrawProb > 35 || phaDrawPct > 40) volScore -= 2;
    const u25Prob = (algoProbs['U2.5'] || 0) * 100;
    if (u25Prob >= 65) volScore -= 1.5;
    
    if (volScore < 0) volScore = 0;
    return volScore;
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
let sniperStats = { count: 0, wins: 0, cost: 0, gross: 0, pureHits: 0, hedgeHits: 0, snipes: 0, snipeHits: 0 };

for (const m of validMatches) {
    const stats = getMatchStats(m, phaStatsMap);
    const algoProbs = m.algoReport.probabilities;
    const odds = getOdds(m);
    
    const mFav = odds.o1 <= odds.o2 ? '1' : '2';
    const mUd = mFav === '1' ? '2' : '1';
    const favDC = mFav === '1' ? '1X' : 'X2';
    const upsetDC = mUd === '1' ? '1X' : 'X2';
    const udOdds = mFav === '1' ? odds.o2 : odds.o1;
    
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
    
    const paaDraw = stats.paaStats?.drawRate || 0;
    const paaUd = stats.paaStats?.upsetRate || 0;
    const mlDraw = (algoProbs['X'] || 0) * 100;
    const mlUd = (algoProbs[mUd] || 0) * 100;
    const matrixDraw = (paaDraw + mlDraw) / 2;
    const matrixUnd = (paaUd + mlUd) / 2;

    const volScore = getVolatilityScore(m, stats, algoProbs, odds);

    // BASELINE HYBRID ML PIVOT
    let basePred = mFav;
    if (matrixUnd >= 45) basePred = upsetDC;
    else if (matrixUnd >= 35) basePred = '12';
    else if (matrixDraw >= 35) basePred = favDC;
    
    // SNIPER PIVOT: Use Volatility to find extreme value Pure Underdogs
    let sniperPred = basePred;
    let isSnipe = false;
    
    // If Baseline wants to play Pure Fav, but Volatility is extreme (>= 7.0) AND Underdog odds are massive
    if ((basePred === '1' || basePred === '2') && volScore >= 7.0 && udOdds >= 3.0) {
        sniperPred = mUd; // Snipe the Pure Underdog!
        isSnipe = true;
        sniperStats.snipes++;
    }

    const processPrediction = (pred: string, s: any, isSnipeBet: boolean = false) => {
        s.count++;
        s.cost += 1;
        if (pred === '1' || pred === '2') {
            if (ar === pred) {
                s.wins++; s.pureHits++; 
                const hitOdds = pred === '1' ? odds.o1 : odds.o2;
                s.gross += hitOdds;
                if (isSnipeBet) s.snipeHits++;
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
    processPrediction(sniperPred, sniperStats, isSnipe);
}

console.log("--- BASELINE PIVOT ENGINE ---");
console.log(`Matches: ${baselineStats.count}`);
console.log(`Win Rate: ${(baselineStats.wins / baselineStats.count * 100).toFixed(1)}%`);
console.log(`Net Gain (Units): ${(baselineStats.gross - baselineStats.cost).toFixed(2)}`);
console.log(`ROI: ${((baselineStats.gross - baselineStats.cost) / baselineStats.cost * 100).toFixed(1)}%\n`);

console.log("--- SNIPER PIVOT (VOLATILITY INTEGRATION) ---");
console.log(`Matches: ${sniperStats.count}`);
console.log(`Attempted Pure Underdog Snipes: ${sniperStats.snipes}`);
console.log(`Successful Snipes (Huge Odds Hits): ${sniperStats.snipeHits}`);
console.log(`Win Rate: ${(sniperStats.wins / sniperStats.count * 100).toFixed(1)}%`);
console.log(`Net Gain (Units): ${(sniperStats.gross - sniperStats.cost).toFixed(2)}`);
console.log(`ROI: ${((sniperStats.gross - sniperStats.cost) / sniperStats.cost * 100).toFixed(1)}%\n`);
