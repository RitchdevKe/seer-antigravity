import fs from 'fs';
import path from 'path';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
import mlModelData from '../public/ml_model.json';

const matchesPath = path.join(process.cwd(), 'supabase_backup/precalculated_matches.json');
const matches = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));

console.log(`Loaded ${matches.length} matches.`);

let primXCount = 0;
let drawHits = 0;
let favHits = 0;
let undHits = 0;

let currentHedgeHits = 0; // The 1X or X2 the current ML engine picked
let proposedHedgeHits = 0; // If we picked Draw+Und (X2 if Home Fav)

let proposedHedgeWonWhenCurrentLost = 0;

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
    
    // Run the ML prediction
    const mlResult = predictWithHybridML(match, mlModelData);
    
    if (mlResult.mlPrimaryPrediction === 'X') {
        primXCount++;
        
        const isDraw = outcome === 'X';
        const isFav = outcome === favWinStr;
        const isUnd = outcome === undWinStr;
        
        if (isDraw) drawHits++;
        if (isFav) favHits++;
        if (isUnd) undHits++;
        
        const currentPred = mlResult.mlPrediction;
        const currentHit = currentPred.includes(outcome);
        if (currentHit) currentHedgeHits++;
        
        // The proposed theory: if Prim X, hedge with Underdog + Draw (e.g. X2 if Fav is Home)
        const proposedHedge = isFavHome ? 'X2' : '1X';
        const proposedHit = proposedHedge.includes(outcome);
        if (proposedHit) proposedHedgeHits++;
        
        if (proposedHit && !currentHit) {
            proposedHedgeWonWhenCurrentLost++;
        }
    }
}

console.log(`--- RESULTS for Primary X Predictions ---`);
console.log(`Total Prim X Matches: ${primXCount}`);
if (primXCount > 0) {
    console.log(`Actual Results -> Draws: ${drawHits} (${((drawHits/primXCount)*100).toFixed(1)}%), Favorites: ${favHits} (${((favHits/primXCount)*100).toFixed(1)}%), Underdogs: ${undHits} (${((undHits/primXCount)*100).toFixed(1)}%)`);
    console.log(`-----------------------------------------`);
    console.log(`Current ML Hedge Hit Rate: ${((currentHedgeHits/primXCount)*100).toFixed(1)}% (${currentHedgeHits})`);
    console.log(`Proposed ML Hedge (Draw+Und) Hit Rate: ${((proposedHedgeHits/primXCount)*100).toFixed(1)}% (${proposedHedgeHits})`);
    console.log(`Matches where Proposed won and Current lost: ${proposedHedgeWonWhenCurrentLost}`);
}
