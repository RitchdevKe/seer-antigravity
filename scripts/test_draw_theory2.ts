import fs from 'fs';
import path from 'path';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
import mlModelData from '../public/ml_model.json';

const matchesPath = path.join(process.cwd(), 'supabase_backup/precalculated_matches.json');
const matches = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));

let primXCount = 0, drawHits = 0, favHits = 0, undHits = 0;
let currentHedgeHits = 0, proposedUndDrawHits = 0, proposedFavDrawHits = 0;

for (let rawMatch of matches) {
    const match = rawMatch.data ? { ...rawMatch.data, ...rawMatch } : rawMatch;
    match.odds = match.odds || match.mo;
    if (!match.result || !match.odds) continue;
    
    const odds = typeof match.odds === 'string' ? match.odds.split(',') : match.odds;
    if (odds.length < 3) continue;
    
    const h = parseFloat(odds[0]), d = parseFloat(odds[1]), a = parseFloat(odds[2]);
    if (isNaN(h) || isNaN(d) || isNaN(a)) continue;
    
    const isFavHome = h <= a;
    const res = match.result.split(':');
    if (res.length !== 2) continue;
    
    const homeGoals = parseInt(res[0]), awayGoals = parseInt(res[1]);
    let outcome = 'X';
    if (homeGoals > awayGoals) outcome = '1';
    if (awayGoals > homeGoals) outcome = '2';
    
    const favWinStr = isFavHome ? '1' : '2';
    const undWinStr = isFavHome ? '2' : '1';
    const undDrawStr = isFavHome ? 'X2' : '1X';
    const favDrawStr = isFavHome ? '1X' : 'X2';
    
    const mlResult = predictWithHybridML(match, mlModelData);
    
    if (mlResult.mlPrimaryPrediction === 'X') {
        primXCount++;
        if (outcome === 'X') drawHits++;
        if (outcome === favWinStr) favHits++;
        if (outcome === undWinStr) undHits++;
        
        if (mlResult.mlPrediction.includes(outcome)) currentHedgeHits++;
        if (undDrawStr.includes(outcome)) proposedUndDrawHits++;
        if (favDrawStr.includes(outcome)) proposedFavDrawHits++;
    }
}
console.log(Matches:  | Draws:  | Favs:  | Unds: );
console.log(Current ML Hedge Hit Rate: %);
console.log(Und+Draw Hit Rate: %);
console.log(Fav+Draw Hit Rate: %);
