import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
import { Match } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(__dirname, '../public/embedded_matches.json');
const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const matches = rawData.map((r: any) => {
    const m = r.data || r;
    m.result = r.result;
    return m;
});

let mlFavStats = { total: 0, hits: 0 };
let mlDrawStats = { total: 0, hits: 0 };
let mlUndStats = { total: 0, hits: 0 };

for (const m of matches) {
    if (!m.result || m.result === '?-?' || m.result === 'Unknown' || m.result === 'pending') continue;
    
    let resultStr = m.result;
    const parts = resultStr.split(/[:\-]/);
    if (parts.length !== 2) continue;
    const h = parseInt(parts[0]);
    const a = parseInt(parts[1]);
    const actual = h > a ? '1' : h < a ? '2' : 'X';
    
    const favUnd = getFavUndFromOdds(m);
    if (!favUnd) continue;
    
    const mlDecision = predictWithHybridML(m as Match);
    if (!mlDecision.mlApplied) continue;

    const mlPred = mlDecision.mlPrediction; // '1X', 'X2', '12'
    
    let isHit = false;
    if (mlPred === '1X' && (actual === '1' || actual === 'X')) isHit = true;
    if (mlPred === 'X2' && (actual === '2' || actual === 'X')) isHit = true;
    if (mlPred === '12' && (actual === '1' || actual === '2')) isHit = true;

    // Determine the ML's target
    let target = 'Unknown';
    if (mlPred === '1X' && favUnd.favResult === '1') target = 'Fav';
    else if (mlPred === 'X2' && favUnd.favResult === '2') target = 'Fav';
    else if (mlPred === '12') target = 'Underdog'; // Usually 12 covers fav and underdog, leaning underdog upset
    else if (mlPred === '1X' && favUnd.undResult === '1') target = 'Draw/Und';
    else if (mlPred === 'X2' && favUnd.undResult === '2') target = 'Draw/Und';

    if (target === 'Fav') {
        mlFavStats.total++;
        if (isHit) mlFavStats.hits++;
    } else if (target === 'Underdog') {
        mlUndStats.total++;
        if (isHit) mlUndStats.hits++;
    } else if (target === 'Draw/Und') {
        mlDrawStats.total++;
        if (isHit) mlDrawStats.hits++;
    }
}

console.log(`ML TARGET: MARKET FAVORITE (1X/X2 covering Fav)`);
console.log(`Hits: ${mlFavStats.hits} / ${mlFavStats.total} (${(mlFavStats.hits/mlFavStats.total*100).toFixed(1)}%)`);

console.log(`\nML TARGET: UNDERDOG (12 covering Upset)`);
console.log(`Hits: ${mlUndStats.hits} / ${mlUndStats.total} (${(mlUndStats.hits/mlUndStats.total*100).toFixed(1)}%)`);

console.log(`\nML TARGET: DRAW/UNDERDOG (1X/X2 covering Und)`);
console.log(`Hits: ${mlDrawStats.hits} / ${mlDrawStats.total} (${(mlDrawStats.total > 0 ? mlDrawStats.hits/mlDrawStats.total*100 : 0).toFixed(1)}%)`);

function getFavUndFromOdds(m: any) {
  const oddsStr = m.mo || m.odds || '';
  const parts = oddsStr.split(/[- ,|]+/).map((p: string) => parseFloat(p.trim())).filter((p: number) => !isNaN(p));
  if (parts.length >= 3) {
    const o1 = parts[0];
    const o2 = parts[2];
    if (o1 !== o2) {
      return {
        favResult: o1 < o2 ? '1' : '2',
        undResult: o1 < o2 ? '2' : '1'
      };
    }
  }
  return null;
}
