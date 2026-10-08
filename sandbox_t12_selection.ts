import * as fs from 'fs';
import * as path from 'path';

import { Match } from './src/types';
import { getOdds } from './src/utils/volatilityEngine';
import { processMatch } from './src/utils/matchProcessing';
import { getMatchStats, evaluateMatchCategory } from './src/utils/matchEvaluator';
import { getPAAPredictionForSeer } from './src/utils/seerAiSlipSelection';

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
    const actualResult = (m.result || '').split('-')[0].trim();
    if (!actualResult || actualResult.toLowerCase() === 'pending' || actualResult.toLowerCase() === 'unknown') return false;
    return true;
});

// Extract all Top 12 eligible matches
const eligibleTop12: any[] = [];
for (const rawM of validMatches) {
    const m = processMatch(rawM);
    const isTop12 = evaluateMatchCategory(m, 'top10', 'all', phaStatsMap, false, false, {});
    if (!isTop12) continue;
    
    const stats = getMatchStats(m, phaStatsMap);
    const { favOdds } = getOdds(m);
    // Base category odds filter
    if (favOdds < 2.00 || favOdds > 2.49) continue;
    
    eligibleTop12.push(m);
}

console.log(`Found ${eligibleTop12.length} total historical eligible Top 12 matches.`);

// Simulate scoring logic
const scoredMatches = eligibleTop12.map(m => {
    let penalty = 0;
    const stats = getMatchStats(m, phaStatsMap);
    const sDraw = m.seerPercentages ? Math.round(m.seerPercentages['X'] || 0) : 0;
    const upsetRate = stats.paaStats?.upsetRate || 0;
    const underdogOdds = stats.underdogOdds;
    const isPatternTSub = (m.patternAnalysis?.mainPattern || '').toUpperCase() === 'T' && !!m.patternAnalysis?.subPattern;
    
    if (isPatternTSub) penalty -= 200;
    
    // Base scoring logic
    if (stats.underdogOdds <= 3.0 || sDraw > 30) {
        penalty -= 2000;
    }
    
    penalty += (stats.phaFavSupport || 0) * 4;
    
    const totalPaaMatches = stats.paaStats?.total || stats.totalMatches || 0;
    if (totalPaaMatches <= 5) penalty -= 1500;
    if (totalPaaMatches < 15) penalty -= 1000;
    if (totalPaaMatches >= 30) penalty += 200;
    
    if (underdogOdds > 0 && underdogOdds <= 3.20) {
        penalty -= Math.round((3.30 - underdogOdds) * 500);
    } else if (underdogOdds >= 3.40) {
        penalty += 300;
    }

    // ---------- STRICT FILTERS ADDED AS PENALTIES ----------
    const paaPredObj = getPAAPredictionForSeer(m, phaStatsMap);
    const paaFinal = paaPredObj.paaFinal || paaPredObj.paaPrimary || '';
    const algoPred = m.algoReport?.prediction || '';
    
    // Original bans restored:
    if (paaFinal && !paaFinal.includes(stats.moFav)) penalty -= 4000;
    if (algoPred && !algoPred.includes(stats.moFav)) penalty -= 3000;
    if (underdogOdds <= 3.20 && upsetRate >= 25) penalty -= 2000;
    
    // Additional strict mathematical filters for 100% accuracy:
    if (stats.phaFavSupport < 55) penalty -= 2000;
    if (upsetRate >= 20) penalty -= 1000;
    
    // Weight ML probabilities heavily
    if (stats.probFav >= 65) penalty += 500;
    else if (stats.probFav >= 60) penalty += 200;
    else penalty -= 500;

    // Calculate final score
    let finalScore = penalty + (stats.probFav * 10);
    return { match: m, score: finalScore, stats };
});

// Sort by highest score first
scoredMatches.sort((a, b) => b.score - a.score);

// Let's test the accuracy of the TOP N matches across history
const testSizes = [12, 50, 100, 200, 500, 1000];

for (const size of testSizes) {
    if (scoredMatches.length < size) break;
    
    const selected = scoredMatches.slice(0, size);
    let wins = 0;
    
    for (const item of selected) {
        const m = item.match;
        const stats = item.stats;
        let act = '';
        if (m.result && m.result.includes(':')) {
            const [hg, ag] = m.result.split(':').map(Number);
            if (hg > ag) act = '1';
            else if (hg < ag) act = '2';
            else act = 'X';
        } else {
            act = (m.result || "").trim();
        }
        
        const mFav = stats.moFav;
        if (act === mFav || act === 'X') {
            wins++; 
        }
    }
    
    console.log(`Top ${size} Matches Accuracy: ${wins}/${size} (${((wins/size)*100).toFixed(2)}%)`);
}

// Log out the characteristics of the Top 12 to see how clean they are
console.log(`\n=== PROFILES OF TOP 12 SELECTED MATCHES ===`);
const top12 = scoredMatches.slice(0, 12);
top12.forEach((item, i) => {
    const m = item.match;
    let act = '';
    if (m.result && m.result.includes(':')) {
        const [hg, ag] = m.result.split(':').map(Number);
        if (hg > ag) act = '1';
        else if (hg < ag) act = '2';
        else act = 'X';
    } else {
        act = (m.result || "").trim();
    }
    const isWin = (act === item.stats.moFav || act === 'X') ? 'WIN' : 'LOSS';
    console.log(`#${i+1} [${isWin}] - ${item.match.teams} | Score: ${item.score.toFixed(1)} | PAA_Total: ${item.stats.paaStats?.total} | FavSupport: ${item.stats.phaFavSupport}% | UpsetRate: ${item.stats.paaStats?.upsetRate}% | Odds: ${item.stats.favOdds}`);
});
