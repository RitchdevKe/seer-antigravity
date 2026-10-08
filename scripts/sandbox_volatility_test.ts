import fs from 'fs';
import path from 'path';

// Load utility functions
import { Match } from '../src/types';
import { getMatchStats } from '../src/utils/matchEvaluator';

const getOdds = (m: Match) => {
    const moParts = (m.mo || "").split(",").map((s: string) => parseFloat(s.trim()));
    const o1 = !isNaN(moParts[0]) && moParts[0] > 0 ? moParts[0] : 2.0;
    const oX = !isNaN(moParts[1]) && moParts[1] > 0 ? moParts[1] : 3.0;
    const o2 = !isNaN(moParts[2]) && moParts[2] > 0 ? moParts[2] : 2.5;
    return { o1, oX, o2, favOdds: Math.min(o1, o2) };
};

// Load data
const dataPath = path.join(process.cwd(), 'supabase_backup', 'precalculated_matches.json');
const paaPath = path.join(process.cwd(), 'supabase_backup', 'pattern_accuracy_audit.json');

console.log("Loading dataset...");
const dbRows = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
const rawMatches = dbRows.map((r: any) => r.data || r);
const paaStatsRaw = JSON.parse(fs.readFileSync(paaPath, 'utf-8'));

const phaStatsMap: Record<string, any> = {};
for (const p of paaStatsRaw) {
    if (p.sub_pattern) {
        phaStatsMap[p.sub_pattern] = p;
    }
}
console.log(`Loaded ${rawMatches.length} matches and ${Object.keys(phaStatsMap).length} PHA stats.`);

let validMatches = rawMatches.filter((m: any) => {
    // We only care about matches with actual results and algoReport
    if (!m.result || !m.mo) return false;
    
    // We only care if we have ML Probs and Total Points
    if (!m.algoReport?.probabilities) return false;
    if (!m.totalPoints) return false;

    // Filter to matches where Market odds are standard (Fav < 2.50)
    // to focus on Top 12 candidates
    const odds = getOdds(m as Match);
    if (odds.favOdds < 1.3 || odds.favOdds > 2.50) return false;

    return true;
});

console.log(`Analyzing ${validMatches.length} valid matches...`);

interface EvalResult {
    total: number;
    favWins: number;
    draws: number;
    upsetWins: number;
    score0_draws: number; score0_upsets: number;
    score1_draws: number; score1_upsets: number;
    score2_draws: number; score2_upsets: number;
    score3_draws: number; score3_upsets: number;
    score4_draws: number; score4_upsets: number;
    score5_draws: number; score5_upsets: number;
}

const res: EvalResult = {
    total: 0, favWins: 0, draws: 0, upsetWins: 0,
    score0_draws: 0, score0_upsets: 0,
    score1_draws: 0, score1_upsets: 0,
    score2_draws: 0, score2_upsets: 0,
    score3_draws: 0, score3_upsets: 0,
    score4_draws: 0, score4_upsets: 0,
    score5_draws: 0, score5_upsets: 0,
};

let algoConflictDraws = 0;
let algoConflictUpsets = 0;

for (const m of validMatches) {
    const stats = getMatchStats(m, phaStatsMap);
    const algoProbs = m.algoReport.probabilities;
    const underdogSide = stats.moUnderdog;
    const favSide = stats.moFav;
    
    let volatilityScore = 0;

    // Parameter 1: PHA Percentages
    const paaDraw = stats.paaStats?.draw || 0;
    const paaUpset = stats.paaStats?.upset_win || 0;
    const paaTotal = stats.paaStats?.total || 1;
    const phaDrawPct = (paaDraw / paaTotal) * 100;
    const phaUpsetPct = (paaUpset / paaTotal) * 100;
    
    if (phaUpsetPct > phaDrawPct * 1.2) volatilityScore += 2;
    if (phaUpsetPct > 35) volatilityScore += 1;

    // Parameter 2: ML Algorithm Probabilities
    const mlDrawProb = algoProbs['X'] * 100;
    const mlUpsetProb = algoProbs[underdogSide] * 100;
    if (mlUpsetProb > mlDrawProb) volatilityScore += 1;
    if (mlUpsetProb > mlDrawProb + 5) volatilityScore += 1;

    // Parameter 3: Market Odds
    const odds = getOdds(m);
    const drawOdds = odds.oX;
    const underdogOdds = favSide === '1' ? odds.o2 : odds.o1;
    if (underdogOdds < drawOdds) volatilityScore += 2;
    if (underdogOdds < drawOdds + 0.3) volatilityScore += 1;

    // Parameter 4: Cognitive Engine Total Points
    const homePts = m.totalPoints.home;
    const awayPts = m.totalPoints.away;
    const upsetHasMorePoints = (underdogSide === '1' && homePts > awayPts) || (underdogSide === '2' && awayPts > homePts);
    if (upsetHasMorePoints) volatilityScore += 2;

    // Parameter 5: League Context
    const teams = (m.teams || '').toLowerCase();
    const league = (m.league || '').toLowerCase();
    const isVolatileLeague = /tanzania|kenya|uganda|rwanda|egypt|morocco|nigeria|ghana|south africa|zambia|senegal|tunisia|algeria|mali|cameroon|cup|friendly/i.test(teams) || /tanzania|kenya|uganda|rwanda|egypt|morocco|nigeria|ghana|south africa|zambia|senegal|tunisia|algeria|mali|cameroon|cup|friendly/i.test(league);
    if (isVolatileLeague) volatilityScore += 1;

    // Cap at 5 for bucketing
    if (volatilityScore > 5) volatilityScore = 5;

    // Check result
    let ar = "";
    if (m.result && m.result.includes(':')) {
        const [hg, ag] = m.result.split(':').map(Number);
        if (hg > ag) ar = '1';
        else if (hg < ag) ar = '2';
        else ar = 'X';
    } else {
        ar = (m.result || "").trim();
    }
    
    let isDraw = ar === 'X';
    let isUpset = ar === underdogSide;
    let isFav = ar === favSide;

    res.total++;
    if (isFav) res.favWins++;
    if (isDraw) res.draws++;
    if (isUpset) res.upsetWins++;

    if (volatilityScore === 0) { if (isDraw) res.score0_draws++; if (isUpset) res.score0_upsets++; }
    if (volatilityScore === 1) { if (isDraw) res.score1_draws++; if (isUpset) res.score1_upsets++; }
    if (volatilityScore === 2) { if (isDraw) res.score2_draws++; if (isUpset) res.score2_upsets++; }
    if (volatilityScore === 3) { if (isDraw) res.score3_draws++; if (isUpset) res.score3_upsets++; }
    if (volatilityScore === 4) { if (isDraw) res.score4_draws++; if (isUpset) res.score4_upsets++; }
    if (volatilityScore === 5) { if (isDraw) res.score5_draws++; if (isUpset) res.score5_upsets++; }

    // Special case requested by user: Algo predicts 12 final when others predict 1X/X2
    // Wait, the user said "when Algo predicts 12 final when others or two predictors predict 1X/X2"
    const algoPred = m.algoReport.prediction; // e.g. '12'
    const paaPred = m.paaPrediction || m.paaPrimaryPrediction;
    const subPred = m.patternAnalysis?.subPatternPrediction;
    
    if (algoPred === '12' && (paaPred === '1X' || paaPred === 'X2' || subPred === '1X' || subPred === 'X2')) {
        if (isDraw) algoConflictDraws++;
        if (isUpset) algoConflictUpsets++;
    }
}

console.log("\n================ VOLATILITY ENGINE TEST ================\n");
console.log(`Total Evaluated: ${res.total}`);
console.log(`Market Favorite Wins: ${res.favWins}`);
console.log(`Draws: ${res.draws}`);
console.log(`Upset Wins: ${res.upsetWins}`);
console.log("\nBUCKET ANALYSIS (Draws vs Upsets):");

console.log(`Score 0: Draws: ${res.score0_draws} | Upsets: ${res.score0_upsets} -> Upset Ratio: ${res.score0_draws + res.score0_upsets > 0 ? (res.score0_upsets / (res.score0_draws + res.score0_upsets) * 100).toFixed(1) : 0}%`);
console.log(`Score 1: Draws: ${res.score1_draws} | Upsets: ${res.score1_upsets} -> Upset Ratio: ${res.score1_draws + res.score1_upsets > 0 ? (res.score1_upsets / (res.score1_draws + res.score1_upsets) * 100).toFixed(1) : 0}%`);
console.log(`Score 2: Draws: ${res.score2_draws} | Upsets: ${res.score2_upsets} -> Upset Ratio: ${res.score2_draws + res.score2_upsets > 0 ? (res.score2_upsets / (res.score2_draws + res.score2_upsets) * 100).toFixed(1) : 0}%`);
console.log(`Score 3: Draws: ${res.score3_draws} | Upsets: ${res.score3_upsets} -> Upset Ratio: ${res.score3_draws + res.score3_upsets > 0 ? (res.score3_upsets / (res.score3_draws + res.score3_upsets) * 100).toFixed(1) : 0}%`);
console.log(`Score 4: Draws: ${res.score4_draws} | Upsets: ${res.score4_upsets} -> Upset Ratio: ${res.score4_draws + res.score4_upsets > 0 ? (res.score4_upsets / (res.score4_draws + res.score4_upsets) * 100).toFixed(1) : 0}%`);
console.log(`Score 5: Draws: ${res.score5_draws} | Upsets: ${res.score5_upsets} -> Upset Ratio: ${res.score5_draws + res.score5_upsets > 0 ? (res.score5_upsets / (res.score5_draws + res.score5_upsets) * 100).toFixed(1) : 0}%`);

console.log("\nUSER SCENARIO: Algo predicts 12, PAA/Sub predicts 1X/X2");
console.log(`  Draws: ${algoConflictDraws}`);
console.log(`  Upsets: ${algoConflictUpsets}`);
console.log(`  Upset Ratio: ${algoConflictDraws + algoConflictUpsets > 0 ? (algoConflictUpsets / (algoConflictDraws + algoConflictUpsets) * 100).toFixed(1) : 0}%`);
