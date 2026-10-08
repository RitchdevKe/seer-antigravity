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

let drawStatsFavDC = { total: 0, hits: 0 };
let drawStatsSeerFin = { total: 0, hits: 0 };

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

    const seerPrim = m.seerPrimaryPrediction || '';
    const subPatPrim = features.study3_subPatPrimary || '';
    const seerFin = m.seerPrediction || '';
    
    const favDC = favUnd.favResult === '1' ? '1X' : 'X2';

    // Draw Pivot
    if (seerPrim === 'X' && subPatPrim === 'X') {
        // Evaluate FavDC
        let isHitFav = false;
        if (favDC === '1X' && (actual === '1' || actual === 'X')) isHitFav = true;
        if (favDC === 'X2' && (actual === '2' || actual === 'X')) isHitFav = true;
        
        drawStatsFavDC.total++;
        if (isHitFav) drawStatsFavDC.hits++;

        // Evaluate SeerFin
        let isHitSeer = false;
        if (seerFin === '1X' && (actual === '1' || actual === 'X')) isHitSeer = true;
        if (seerFin === 'X2' && (actual === '2' || actual === 'X')) isHitSeer = true;
        if (seerFin === '12' && (actual === '1' || actual === '2')) isHitSeer = true;

        drawStatsSeerFin.total++;
        if (isHitSeer) drawStatsSeerFin.hits++;
    }
}

console.log(`\n--- DRAW PIVOT HEDGE COMPARISON ---`);
console.log(`Using FavDC (Hardcoded to Market Fav): ${(drawStatsFavDC.hits / drawStatsFavDC.total * 100).toFixed(2)}% (${drawStatsFavDC.hits}/${drawStatsFavDC.total})`);
console.log(`Using SeerFin (Respecting Seer's Hedge): ${(drawStatsSeerFin.hits / drawStatsSeerFin.total * 100).toFixed(2)}% (${drawStatsSeerFin.hits}/${drawStatsSeerFin.total})`);

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
