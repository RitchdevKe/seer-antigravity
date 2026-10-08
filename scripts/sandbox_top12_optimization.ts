import * as fs from 'fs';
import * as path from 'path';

import { Match } from '../src/types';
import { getOdds } from '../src/utils/volatilityEngine';
import { processMatch } from '../src/utils/matchProcessing';
import { getMatchStats, evaluateMatchCategory } from '../src/utils/matchEvaluator';
import { predictSeerDetailed } from '../src/utils/seerLogic';
import { DEFAULT_WEIGHTS } from '../src/utils/seerLogic';

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
    return true;
});

console.log(`Evaluating ${validMatches.length} valid historical matches for Top 12 Analysis...`);

let evaluated = 0;
let t12Matches: Match[] = [];

for (const rawM of validMatches) {
    const pMatch = processMatch(rawM);
    
    const seerResult = predictSeerDetailed(pMatch, DEFAULT_WEIGHTS, phaStatsMap, {});
    pMatch.seerPercentages = seerResult.percentages;
    pMatch.seerPrediction = seerResult.final;

    const stats = getMatchStats(pMatch, phaStatsMap);
    
    // Evaluate Top 12
    const isTop12 = evaluateMatchCategory(pMatch, 'top10', 'all', phaStatsMap, false, false, {});
    
    if (isTop12) {
        t12Matches.push(pMatch);
    }
    
    evaluated++;
}

console.log(`Found ${t12Matches.length} matches tagged as Top 12.`);

let favWon = 0;
let drawWon = 0;
let undWon = 0;

let losingStats = {
    avgFavOdds: 0,
    avgPhaSupport: 0,
    avgProbFav: 0,
    avgProbDraw: 0,
    avgSeerDraw: 0,
    seerDraw36: 0,
};

let winningStats = {
    avgFavOdds: 0,
    avgPhaSupport: 0,
    avgProbFav: 0,
    avgProbDraw: 0,
    avgSeerDraw: 0,
};

t12Matches.forEach(m => {
    const odds = getOdds(m);
    const mFav = odds.o1 <= odds.o2 ? '1' : '2';
    const mUd = mFav === '1' ? '2' : '1';
    
    const actualResult = (m.result || '').split('-')[0].trim();
    let act = '';
    if (m.result && m.result.includes(':')) {
        const [hg, ag] = m.result.split(':').map(Number);
        if (hg > ag) act = '1';
        else if (hg < ag) act = '2';
        else act = 'X';
    } else {
        act = (m.result || "").trim();
    }

    const isFavWin = act === mFav;
    const isDraw = act === 'X';
    const isUndWin = act === mUd;

    const stats = getMatchStats(m, phaStatsMap);
    const sDraw = m.seerPercentages ? Math.round(m.seerPercentages['X'] || 0) : 0;

    if (isFavWin) favWon++;
    if (isDraw) drawWon++;
    if (isUndWin) {
        undWon++;
        losingStats.avgFavOdds += stats.favOdds;
        losingStats.avgPhaSupport += stats.phaFavWinSupport;
        losingStats.avgProbFav += stats.probFav;
        losingStats.avgProbDraw += stats.probDraw;
        losingStats.avgSeerDraw += sDraw;
        if (sDraw === 36) losingStats.seerDraw36++;
    } else {
        winningStats.avgFavOdds += stats.favOdds;
        winningStats.avgPhaSupport += stats.phaFavWinSupport;
        winningStats.avgProbFav += stats.probFav;
        winningStats.avgProbDraw += stats.probDraw;
        winningStats.avgSeerDraw += sDraw;
    }
});

const totalWins = favWon + drawWon;
if (undWon > 0) {
    losingStats.avgFavOdds /= undWon;
    losingStats.avgPhaSupport /= undWon;
    losingStats.avgProbFav /= undWon;
    losingStats.avgProbDraw /= undWon;
    losingStats.avgSeerDraw /= undWon;
}
if (totalWins > 0) {
    winningStats.avgFavOdds /= totalWins;
    winningStats.avgPhaSupport /= totalWins;
    winningStats.avgProbFav /= totalWins;
    winningStats.avgProbDraw /= totalWins;
    winningStats.avgSeerDraw /= totalWins;
}

console.log(`\n--- T12 OUTCOMES ---`);
console.log(`M.Fav Won: ${favWon} (${((favWon/t12Matches.length)*100).toFixed(1)}%)`);
console.log(`Draw:      ${drawWon} (${((drawWon/t12Matches.length)*100).toFixed(1)}%)`);
console.log(`Underdog:  ${undWon} (${((undWon/t12Matches.length)*100).toFixed(1)}%)`);
console.log(`\nDouble Chance Accuracy (Fav/Draw): ${(((favWon+drawWon)/t12Matches.length)*100).toFixed(1)}%`);

console.log(`\n--- LOSERS (Underdog Wins) PROFILE ---`);
console.log(`Avg Fav Odds: ${losingStats.avgFavOdds.toFixed(2)}`);
console.log(`Avg PHA Support: ${losingStats.avgPhaSupport.toFixed(1)}%`);
console.log(`Avg Prob Fav: ${losingStats.avgProbFav.toFixed(1)}%`);
console.log(`Avg Prob Draw: ${losingStats.avgProbDraw.toFixed(1)}%`);
console.log(`Avg Seer Draw: ${losingStats.avgSeerDraw.toFixed(1)}%`);
console.log(`Losses with Seer Draw = 36%: ${losingStats.seerDraw36}`);

console.log(`\n--- WINNERS (Fav/Draw) PROFILE ---`);
console.log(`Avg Fav Odds: ${winningStats.avgFavOdds.toFixed(2)}`);
console.log(`Avg PHA Support: ${winningStats.avgPhaSupport.toFixed(1)}%`);
console.log(`Avg Prob Fav: ${winningStats.avgProbFav.toFixed(1)}%`);
console.log(`Avg Prob Draw: ${winningStats.avgProbDraw.toFixed(1)}%`);
console.log(`Avg Seer Draw: ${winningStats.avgSeerDraw.toFixed(1)}%`);

// Trial 1: Strict filters
let filteredMatches = t12Matches.filter(m => {
    const stats = getMatchStats(m, phaStatsMap);
    const sDraw = m.seerPercentages ? Math.round(m.seerPercentages['X'] || 0) : 0;
    
    // 1. Strict Fav Odds
    if (stats.favOdds > 2.25) return false;

    // 2. Strong PHA Support
    if (stats.phaFavWinSupport < 55) return false;

    // 3. No massive draw threat
    if (stats.probDraw > 29) return false;

    // 4. Seer Draw specific ban
    if (sDraw >= 35 && sDraw <= 40) return false;

    // 5. Algo prediction must be Fav
    if (stats.algoPred !== stats.moFav && stats.algoPred !== (stats.moFav === '1' ? '1X' : 'X2')) return false;

    return true;
});

let fFav = 0, fDraw = 0, fUnd = 0;
filteredMatches.forEach(m => {
    const odds = getOdds(m);
    const mFav = odds.o1 <= odds.o2 ? '1' : '2';
    const mUd = mFav === '1' ? '2' : '1';
    let act = '';
    if (m.result && m.result.includes(':')) {
        const [hg, ag] = m.result.split(':').map(Number);
        if (hg > ag) act = '1';
        else if (hg < ag) act = '2';
        else act = 'X';
    } else {
        act = (m.result || "").trim();
    }
    if (act === mFav) fFav++;
    if (act === 'X') fDraw++;
    if (act === mUd) fUnd++;
});

console.log(`\n--- TRIAL FILTER OUTCOMES (Seer Draw < 30) ---`);
console.log(`Matches passing filter: ${filteredMatches.length}`);
if (filteredMatches.length > 0) {
    console.log(`Hit Rate: ${(((fFav+fDraw)/filteredMatches.length)*100).toFixed(1)}%`);
    console.log(`Losers (Und): ${fUnd}`);
}
