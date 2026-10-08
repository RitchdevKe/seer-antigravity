import * as fs from 'fs';
import * as path from 'path';

import { Match } from '../src/types';
import { getOdds } from '../src/utils/volatilityEngine';
import { processMatch } from '../src/utils/matchProcessing';
import { predictSeerDetailed, DEFAULT_WEIGHTS } from '../src/utils/seerLogic';
import { getMatchStats } from '../src/utils/matchEvaluator';

// Parse Precalculated Matches (approx 14,500+)
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

console.log(`Evaluating ${validMatches.length} valid historical matches with Seer Percentages...`);

interface BucketStats {
    total: number;
    favWon: number;
    drawWon: number;
    undWon: number;
    targetDCHit: number;
}

const buckets: Record<string, BucketStats> = {
    '35_to_40': { total: 0, favWon: 0, drawWon: 0, undWon: 0, targetDCHit: 0 },
    '30_to_34': { total: 0, favWon: 0, drawWon: 0, undWon: 0, targetDCHit: 0 },
    'exactly_36': { total: 0, favWon: 0, drawWon: 0, undWon: 0, targetDCHit: 0 },
};

let evaluated = 0;

for (const rawM of validMatches) {
    const pMatch = processMatch(rawM);
    const seerResult = predictSeerDetailed(pMatch, DEFAULT_WEIGHTS, phaStatsMap, {});
    pMatch.seerPercentages = seerResult.percentages;
    pMatch.seerPrediction = seerResult.final;
    const m = pMatch;

    const odds = getOdds(m);
    const mFav = odds.o1 <= odds.o2 ? '1' : '2';
    const mUd = mFav === '1' ? '2' : '1';
    const favDC = mFav === '1' ? '1X' : 'X2';
    const upsetDC = mUd === '1' ? '1X' : 'X2';

    // The 4 main predictors
    const paa = m.paaPrediction || '';
    const seer = m.seerPrediction || '';
    const algo = m.algoReport?.prediction || '';
    const subP = m.patternAnalysis?.subPatternPrediction || '';

    const preds = [paa, seer, algo, subP].filter(p => p !== '');
    const agrees1X = (p: string) => ['1', '1X', 'X1', 'X'].includes(p);
    const agreesX2 = (p: string) => ['2', 'X2', '2X', 'X'].includes(p);

    const count1X = preds.filter(agrees1X).length;
    const countX2 = preds.filter(agreesX2).length;

    let targetDC: string | null = null;
    if (count1X >= 3 && count1X > countX2) targetDC = '1X';
    else if (countX2 >= 3 && countX2 > count1X) targetDC = 'X2';

    if (!targetDC) continue; // Must have 3+ agreement on a DC
    
    evaluated++;

    const seerDraw = Math.round(m.seerPercentages['X']);
    if (!buckets[seerDraw]) buckets[seerDraw] = { total: 0, favWon: 0, drawWon: 0, undWon: 0, targetDCHit: 0 };
    
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
    const isTargetHit = targetDC.includes(act);

    const updateBucket = (b: BucketStats) => {
        b.total++;
        if (isFavWin) b.favWon++;
        if (isDraw) b.drawWon++;
        if (isUndWin) b.undWon++;
        if (isTargetHit) b.targetDCHit++;
    };

    updateBucket(buckets[seerDraw]);

    if (seerDraw >= 35 && seerDraw <= 40) {
        updateBucket(buckets['35_to_40']);
    }
    if (seerDraw >= 30 && seerDraw < 35) { // 30 to 34
        updateBucket(buckets['30_to_34']);
    }
    if (seerDraw === 36) {
        updateBucket(buckets['exactly_36']);
    }
}

console.log(`\nFound ${evaluated} matches where 3+ predictors agreed on a Double Chance (1X/X2).`);

function printBucket(name: string, label: string) {
    const b = buckets[name];
    if (!b || b.total === 0) return;
    console.log(`\n==============================================`);
    console.log(`CONDITION: ${label}`);
    console.log(`Total Matches: ${b.total}`);

    console.log(`   -> Target DC Hit Rate: ${((b.targetDCHit / b.total) * 100).toFixed(1)}% (${b.targetDCHit}/${b.total})`);
    console.log(`   -> M.Fav Won:          ${((b.favWon / b.total) * 100).toFixed(1)}% (${b.favWon}/${b.total})`);
    console.log(`   -> Draw:               ${((b.drawWon / b.total) * 100).toFixed(1)}% (${b.drawWon}/${b.total})`);
    console.log(`   -> Underdog Won:       ${((b.undWon / b.total) * 100).toFixed(1)}% (${b.undWon}/${b.total})`);
}

printBucket('30_to_34', 'Seer Draw % is between 30% and 34%');
printBucket('35_to_40', 'Seer Draw % is between 35% and 40%');
printBucket('exactly_36', 'Seer Draw % is exactly 36%');

console.log("\n==============================================");
console.log("SEER DRAW DISTRIBUTION");
Object.keys(buckets).forEach(k => {
    if (k !== '35_to_40' && k !== '30_to_34' && k !== 'exactly_36') {
        if (buckets[k].total > 0) {
            console.log(`Draw ${k}% : ${buckets[k].total} matches`);
        }
    }
});
