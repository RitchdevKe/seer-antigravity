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
    if (!m.result || !m.mo) return false;
    if (!m.algoReport?.probabilities) return false;
    if (!m.totalPoints) return false;
    
    // Focus on standard odds ranges where hedge logic applies
    const odds = getOdds(m as Match);
    if (odds.favOdds < 1.3 || odds.favOdds > 2.80) return false;

    return true;
});

console.log(`Analyzing ${validMatches.length} valid matches...`);

// Stats tracking
let tier1Stats = { count: 0, wins: 0, losses: 0, cost: 0, gross: 0 };
let tier2Stats = { count: 0, wins: 0, losses: 0, cost: 0, gross: 0 };
let tier3Stats = { count: 0, wins: 0, losses: 0, cost: 0, gross: 0 };
let tier4Stats = { count: 0, wins: 0, losses: 0, cost: 0, gross: 0 };

for (const m of validMatches) {
    const stats = getMatchStats(m, phaStatsMap);
    const algoProbs = m.algoReport.probabilities;
    
    const odds = getOdds(m);
    
    // 1. Market Favorite Rule
    const mFav = odds.o1 <= odds.o2 ? '1' : '2';
    const mUd = mFav === '1' ? '2' : '1';
    
    let volScore = 0;

    // A. PHA Percentages
    const paaDraw = stats.paaStats?.draw || 0;
    const paaUpset = stats.paaStats?.upset_win || 0;
    const paaTotal = stats.paaStats?.total || 1;
    const phaDrawPct = (paaDraw / paaTotal) * 100;
    const phaUpsetPct = (paaUpset / paaTotal) * 100;
    
    if (phaUpsetPct > phaDrawPct * 1.2) volScore += 2;
    if (phaUpsetPct > 35) volScore += 1;
    if (phaUpsetPct > 50) volScore += 2;

    // B. ML Probs
    const mlDrawProb = algoProbs['X'] * 100;
    const mlUpsetProb = algoProbs[mUd] * 100;
    if (mlUpsetProb > mlDrawProb) volScore += 1.5;
    if (mlUpsetProb > mlDrawProb + 5) volScore += 1.5;
    if (mlUpsetProb > 40) volScore += 1;

    // C. Odds Constraints
    const drawOdds = odds.oX;
    const udOdds = mFav === '1' ? odds.o2 : odds.o1;
    if (udOdds < drawOdds) volScore += 2;
    if (udOdds < drawOdds + 0.3) volScore += 1;

    // D. Cognitive Total Points
    const homePts = m.totalPoints.home;
    const awayPts = m.totalPoints.away;
    const upsetHasMorePoints = (mUd === '1' && homePts > awayPts) || (mUd === '2' && awayPts > homePts);
    if (upsetHasMorePoints) volScore += 2;

    // E. League Context
    const league = (m.league || '').toLowerCase();
    const isVolatileLeague = /cup|friendly|tanzania|kenya|uganda|rwanda|egypt|morocco|nigeria|ghana|south africa|zambia|senegal|tunisia|algeria/i.test(league);
    if (isVolatileLeague) volScore += 1;

    // F. Negative Draw Weighting
    if (mlDrawProb > 35 || phaDrawPct > 40) {
        volScore -= 2;
    }
    
    // G. Goal Expectancy Filter
    const u25Prob = (algoProbs['U2.5'] || 0) * 100;
    if (u25Prob >= 65) {
        volScore -= 1.5;
    }
    
    if (volScore < 0) volScore = 0;

    // Result Parsing
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
    let isFav = ar === mFav;
    let isUd = ar === mUd;
    
    // Simulate Net Gain calculations
    if (volScore <= 2.0) {
        tier1Stats.count++;
        tier1Stats.cost += 1;
        if (isFav) {
            tier1Stats.wins++;
            tier1Stats.gross += odds.favOdds;
        } else {
            tier1Stats.losses++;
        }
    } else if (volScore > 2.0 && volScore <= 4.5) {
        tier2Stats.count++;
        const dcOdds = (odds.favOdds * drawOdds) / (odds.favOdds + drawOdds); 
        tier2Stats.cost += 1;
        if (isFav || isDraw) {
            tier2Stats.wins++;
            tier2Stats.gross += dcOdds;
        } else {
            tier2Stats.losses++;
        }
    } else if (volScore > 4.5 && volScore <= 6.5) {
        tier3Stats.count++;
        const dc12Odds = (odds.favOdds * udOdds) / (odds.favOdds + udOdds);
        tier3Stats.cost += 1;
        if (isFav || isUd) {
            tier3Stats.wins++;
            tier3Stats.gross += dc12Odds;
        } else {
            tier3Stats.losses++;
        }
    } else if (volScore > 6.5) {
        tier4Stats.count++;
        const dcUdXOdds = (udOdds * drawOdds) / (udOdds + drawOdds);
        tier4Stats.cost += 1;
        if (isUd || isDraw) {
            tier4Stats.wins++;
            tier4Stats.gross += dcUdXOdds;
        } else {
            tier4Stats.losses++;
        }
    }
}

console.log("\n================ VOLATILITY ENGINE TIERS TEST ================\n");
console.log(`Total Valid Matches: ${validMatches.length}`);
console.log("\n--- Tier 1: Pure Favorite (Score 0 - 2.0) ---");
console.log(`Matches: ${tier1Stats.count}`);
if (tier1Stats.count > 0) {
    console.log(`Win Rate: ${(tier1Stats.wins / tier1Stats.count * 100).toFixed(1)}%`);
    console.log(`Net Gain (Units): ${(tier1Stats.gross - tier1Stats.cost).toFixed(2)}`);
    console.log(`ROI: ${((tier1Stats.gross - tier1Stats.cost) / tier1Stats.cost * 100).toFixed(1)}%`);
}

console.log("\n--- Tier 2: Standard Hedge (1X/X2) (Score 2.5 - 4.5) ---");
console.log(`Matches: ${tier2Stats.count}`);
if (tier2Stats.count > 0) {
    console.log(`Win Rate: ${(tier2Stats.wins / tier2Stats.count * 100).toFixed(1)}%`);
    console.log(`Net Gain (Units): ${(tier2Stats.gross - tier2Stats.cost).toFixed(2)}`);
    console.log(`ROI: ${((tier2Stats.gross - tier2Stats.cost) / tier2Stats.cost * 100).toFixed(1)}%`);
}

console.log("\n--- Tier 3: Volatility Hedge (12) (Score 5.0 - 6.5) ---");
console.log(`Matches: ${tier3Stats.count}`);
if (tier3Stats.count > 0) {
    console.log(`Win Rate: ${(tier3Stats.wins / tier3Stats.count * 100).toFixed(1)}%`);
    console.log(`Net Gain (Units): ${(tier3Stats.gross - tier3Stats.cost).toFixed(2)}`);
    console.log(`ROI: ${((tier3Stats.gross - tier3Stats.cost) / tier3Stats.cost * 100).toFixed(1)}%`);
}

console.log("\n--- Tier 4: Underdog Hedge (Ud + Draw) (Score > 6.5) ---");
console.log(`Matches: ${tier4Stats.count}`);
if (tier4Stats.count > 0) {
    console.log(`Win Rate: ${(tier4Stats.wins / tier4Stats.count * 100).toFixed(1)}%`);
    console.log(`Net Gain (Units): ${(tier4Stats.gross - tier4Stats.cost).toFixed(2)}`);
    console.log(`ROI: ${((tier4Stats.gross - tier4Stats.cost) / tier4Stats.cost * 100).toFixed(1)}%`);
}

const totalGross = tier1Stats.gross + tier2Stats.gross + tier3Stats.gross + tier4Stats.gross;
const totalCost = tier1Stats.cost + tier2Stats.cost + tier3Stats.cost + tier4Stats.cost;
console.log("\n--- OVERALL PERFORMANCE ---");
console.log(`Total Net Gain: ${(totalGross - totalCost).toFixed(2)} units`);
console.log(`Total ROI: ${((totalGross - totalCost) / totalCost * 100).toFixed(1)}%`);
