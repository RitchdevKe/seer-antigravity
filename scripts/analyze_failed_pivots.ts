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

const failed = [];
const success = [];

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
    const subPatPrim = features.study3_subPatPrimary || '';
    const ptsLean = features.study13_pointsSupport || '';
    const tsDiff = features.study7_tsFavVsUnderdog || 0;
    
    let tsLean = '';
    if (tsDiff > 0.2) tsLean = favUnd.favResult;
    else if (tsDiff < -0.2) tsLean = favUnd.undResult;
    else tsLean = 'X';

    // PHA percentages
    const phaFav = m.study2Data?.pha?.favPct || m.pha?.favPct || 0;
    const phaDraw = m.study2Data?.pha?.drawPct || m.pha?.drawPct || 0;
    const phaUnd = m.study2Data?.pha?.undPct || m.pha?.undPct || 0;
    const pointsFav = features.study13_points?.favPct || 0;

    if (subPatPrim === favUnd.undResult) {
        let undSignals = 1;
        if (algoPrim === favUnd.undResult) undSignals++;
        if (seerPrim === favUnd.undResult) undSignals++;
        if (tsLean === favUnd.undResult) undSignals++;
        if (ptsLean === 'Underdog') undSignals++;

        if (undSignals >= 3) {
            const dataStr = `TS: ${tsDiff.toFixed(2)} | PHA Fav: ${phaFav}% | Pts Fav: ${pointsFav.toFixed(0)}%`;
            if (actual === favUnd.favResult) {
                failed.push(dataStr);
            } else {
                success.push(dataStr);
            }
        }
    }
}

console.log(`\n--- FAILED PIVOTS (Sample) ---`);
for (let i = 0; i < 10 && i < failed.length; i++) console.log(failed[i]);

console.log(`\n--- SUCCESSFUL PIVOTS (Sample) ---`);
for (let i = 0; i < 10 && i < success.length; i++) console.log(success[i]);

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
