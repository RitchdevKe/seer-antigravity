import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(__dirname, '../public/embedded_matches.json');
const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const matches = rawData.map((r: any) => {
    const m = r.data || r;
    m.result = r.result;
    return m;
});

let seerDrawTotal = 0;
let seerDrawHitDC = 0; // Hit 1X or X2 (Market Fav DC)
let seerDrawHitX = 0; // Hit straight X

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
    
    const seerPrim = m.seerPrimaryPrediction;
    if (seerPrim === 'X') {
        seerDrawTotal++;
        if (actual === 'X') seerDrawHitX++;
        if (actual === favUnd.favResult || actual === 'X') seerDrawHitDC++;
    }
}

console.log(`--- SEER DRAW ACCURACY ---`);
console.log(`Seer predicts X (Total): ${seerDrawTotal}`);
console.log(`Hit straight Draw: ${seerDrawHitX} (${(seerDrawHitX / seerDrawTotal * 100).toFixed(1)}%)`);
console.log(`Hit Market Fav DC (1X/X2): ${seerDrawHitDC} (${(seerDrawHitDC / seerDrawTotal * 100).toFixed(1)}%)`);

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
