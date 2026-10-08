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

let drawStats = {
    seerOnly: { total: 0, hit: 0 },
    seerPlusTS: { total: 0, hit: 0 },
    seerPlusPts: { total: 0, hit: 0 },
    seerPlusAlgo: { total: 0, hit: 0 },
};

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

    const algoPrim = features.study5_algoPrimary || '';
    const seerPrim = m.seerPrimaryPrediction || '';
    const ptsLean = features.study13_pointsSupport || '';
    const tsDiff = features.study7_tsFavVsUnderdog || 0;
    
    let tsLean = '';
    if (tsDiff > 0.2) tsLean = favUnd.favResult;
    else if (tsDiff < -0.2) tsLean = favUnd.undResult;
    else tsLean = 'X';

    const isHit = (actual === favUnd.favResult || actual === 'X');

    if (seerPrim === 'X') {
        drawStats.seerOnly.total++;
        if (isHit) drawStats.seerOnly.hit++;

        if (tsLean === 'X') {
            drawStats.seerPlusTS.total++;
            if (isHit) drawStats.seerPlusTS.hit++;
        }

        if (ptsLean === 'Draw') {
            drawStats.seerPlusPts.total++;
            if (isHit) drawStats.seerPlusPts.hit++;
        }

        if (algoPrim === 'X') {
            drawStats.seerPlusAlgo.total++;
            if (isHit) drawStats.seerPlusAlgo.hit++;
        }
    }
}

console.log(`\n--- DRAW PIVOT TARGETS ---`);
console.log(`Seer Only: ${(drawStats.seerOnly.hit / drawStats.seerOnly.total * 100).toFixed(2)}% (${drawStats.seerOnly.total})`);
console.log(`Seer + TS Draw: ${(drawStats.seerPlusTS.hit / drawStats.seerPlusTS.total * 100).toFixed(2)}% (${drawStats.seerPlusTS.total})`);
console.log(`Seer + Pts Draw: ${(drawStats.seerPlusPts.hit / drawStats.seerPlusPts.total * 100).toFixed(2)}% (${drawStats.seerPlusPts.total})`);
console.log(`Seer + Algo Draw: ${(drawStats.seerPlusAlgo.hit / drawStats.seerPlusAlgo.total * 100).toFixed(2)}% (${drawStats.seerPlusAlgo.total})`);

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
