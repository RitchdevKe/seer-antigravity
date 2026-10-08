import fs from 'fs';
import path from 'path';

const matchesPath = path.join(process.cwd(), 'supabase_backup/precalculated_matches.json');
const matches = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));

console.log(`Loaded ${matches.length} matches.`);

// Bins
const exact36 = { total: 0, fav: 0, draw: 0, und: 0 };
const range33_37 = { total: 0, fav: 0, draw: 0, und: 0 };

for (let rawMatch of matches) {
    const match = rawMatch.data ? { ...rawMatch.data, ...rawMatch } : rawMatch;
    match.odds = match.odds || match.mo;

    if (!match.result || !match.odds) continue;
    
    // We only care if the match has odds for all 3
    const odds = typeof match.odds === 'string' ? match.odds.split(',') : match.odds;
    if (!odds || odds.length < 3) continue;
    
    const h = parseFloat(odds[0]);
    const d = parseFloat(odds[1]);
    const a = parseFloat(odds[2]);
    if (isNaN(h) || isNaN(d) || isNaN(a)) continue;
    
    const isFavHome = h <= a;
    
    const res = match.result.split(':');
    if (res.length !== 2) continue;
    
    const homeGoals = parseInt(res[0]);
    const awayGoals = parseInt(res[1]);
    
    let outcome = 'X';
    if (homeGoals > awayGoals) outcome = '1';
    if (awayGoals > homeGoals) outcome = '2';
    
    const favWinStr = isFavHome ? '1' : '2';
    const undWinStr = isFavHome ? '2' : '1';
    
    let isDraw = outcome === 'X';
    let isFav = outcome === favWinStr;
    let isUnd = outcome === undWinStr;

    // Get PAA Draw Percentage
    let paaDraw = match.paaDraw;
    if (paaDraw === undefined || paaDraw === null) continue;
    
    // Convert to rounded percentage if it's not already
    // Often it's a number like 36.3636... so we round it to the nearest integer
    const drawPct = Math.round(paaDraw);

    // Scenario 1: Exactly 36%
    if (drawPct === 36) {
        exact36.total++;
        if (isFav) exact36.fav++;
        if (isDraw) exact36.draw++;
        if (isUnd) exact36.und++;
    }

    // Scenario 2: Between 33% and 37% (inclusive)
    if (drawPct >= 33 && drawPct <= 37) {
        range33_37.total++;
        if (isFav) range33_37.fav++;
        if (isDraw) range33_37.draw++;
        if (isUnd) range33_37.und++;
    }
}

console.log(`\n--- SCENARIO 1: Seer Draw = EXACTLY 36% ---`);
console.log(`Total Matches: ${exact36.total}`);
if (exact36.total > 0) {
    console.log(`Favorite Wins: ${exact36.fav} (${((exact36.fav/exact36.total)*100).toFixed(1)}%)`);
    console.log(`Draws:         ${exact36.draw} (${((exact36.draw/exact36.total)*100).toFixed(1)}%)`);
    console.log(`Underdog Wins: ${exact36.und} (${((exact36.und/exact36.total)*100).toFixed(1)}%)`);
}

console.log(`\n--- SCENARIO 2: Seer Draw = 33% TO 37% ---`);
console.log(`Total Matches: ${range33_37.total}`);
if (range33_37.total > 0) {
    console.log(`Favorite Wins: ${range33_37.fav} (${((range33_37.fav/range33_37.total)*100).toFixed(1)}%)`);
    console.log(`Draws:         ${range33_37.draw} (${((range33_37.draw/range33_37.total)*100).toFixed(1)}%)`);
    console.log(`Underdog Wins: ${range33_37.und} (${((range33_37.und/range33_37.total)*100).toFixed(1)}%)`);
}
