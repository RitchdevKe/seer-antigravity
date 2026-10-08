import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractMLFeatures } from '../src/utils/mlFeatureExtractor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(__dirname, '../public/embedded_matches.json');
const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const matches = rawData.map((r: any) => {
    const m = r.data || r;
    m.result = r.result;
    return m;
});

let simpleStats = { total: 0, hits: 0 };
let undStats = { total: 0, hits: 0 };
let drawStats = { total: 0, hits: 0 };
let favStats = { total: 0, hits: 0 };

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
    
    const features = extractMLFeatures(m);
    if (!features) continue;

    const subPatPrim = features.study3_subPatPrimary;
    const algoPrim = features.study5_algoPrimary;
    
    let finalPred = '1X';
    let target = 'Fav';

    const favDC = favUnd.favResult === '1' ? '1X' : 'X2';

    if (subPatPrim === favUnd.undResult) {
        finalPred = '12';
        target = 'Und';
    } else if (subPatPrim === 'X') {
        finalPred = favDC;
        target = 'Draw';
    } else {
        // Sub Pattern predicts Fav
        finalPred = favDC; 
        target = 'Fav';
    }

    simpleStats.total++;
    const isHit = matchesPrediction(finalPred, actual);
    if (isHit) simpleStats.hits++;

    if (target === 'Und') {
        undStats.total++;
        if (isHit) undStats.hits++;
    } else if (target === 'Draw') {
        drawStats.total++;
        if (isHit) drawStats.hits++;
    } else if (target === 'Fav') {
        favStats.total++;
        if (isHit) favStats.hits++;
    }
}

console.log(`--- SIMPLE RULE ---`);
console.log(`Hits: ${simpleStats.hits} / ${simpleStats.total} (${(simpleStats.hits/simpleStats.total*100).toFixed(1)}%)`);

console.log(`\n--- TARGET: UNDERDOG (12) ---`);
console.log(`Hits: ${undStats.hits} / ${undStats.total} (${(undStats.hits/undStats.total*100).toFixed(1)}%)`);

console.log(`\n--- TARGET: DRAW (Fav DC) ---`);
console.log(`Hits: ${drawStats.hits} / ${drawStats.total} (${(drawStats.hits/drawStats.total*100).toFixed(1)}%)`);

console.log(`\n--- TARGET: FAV (Fav DC) ---`);
console.log(`Hits: ${favStats.hits} / ${favStats.total} (${(favStats.hits/favStats.total*100).toFixed(1)}%)`);

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

function matchesPrediction(prediction: string, actualResult: string): boolean {
    if (!prediction || !actualResult) return false;
    const predUpper = prediction.toUpperCase();
    if (predUpper === '1X' && (actualResult === '1' || actualResult === 'X')) return true;
    if (predUpper === 'X2' && (actualResult === '2' || actualResult === 'X')) return true;
    if (predUpper === '12' && (actualResult === '1' || actualResult === '2')) return true;
    return predUpper === actualResult;
}
