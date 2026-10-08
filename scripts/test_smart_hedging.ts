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

let mfavPreds = { total: 0, hits: 0 };
let undPreds = { total: 0, hits: 0 };
let drawPreds = { total: 0, hits: 0 };
let favRecall = { actualFavWins: 0, correctCalls: 0 };

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

    const subPatPrim = features.study3_subPatPrimary || '';
    const algoPrim = features.study5_algoPrimary || '';
    const seerPrim = m.seerPrimaryPrediction || '';
    const seerFin = m.seerPrediction || '';
    const ptsLean = features.study13_pointsSupport || '';
    const tsDiff = features.study7_tsFavVsUnderdog || 0;
    
    let tsLean = '';
    if (tsDiff > 0.2) tsLean = favUnd.favResult;
    else if (tsDiff < -0.2) tsLean = favUnd.undResult;
    else tsLean = 'X';
    
    const favDC = favUnd.favResult === '1' ? '1X' : 'X2';
    const upsetDC = favUnd.undResult === '1' ? '1X' : 'X2';
    
    if (actual === favUnd.favResult) favRecall.actualFavWins++;

    let pivotPred = '';
    let pivotTarget = '';

    // Draw Pivot
    if (seerPrim === 'X' && subPatPrim === 'X') {
        pivotPred = seerFin || favDC; // Use Seer's recommended hedge
        pivotTarget = 'Draw';
    }
    // Underdog Pivot
    else if (subPatPrim === favUnd.undResult && seerPrim !== 'X') {
        let undSignals = 1; 
        if (algoPrim === favUnd.undResult) undSignals++;
        if (tsLean === favUnd.undResult) undSignals++;
        if (ptsLean === 'Underdog') undSignals++;

        if (undSignals >= 3) {
            // Full Pivot - Smart Hedging
            if (tsLean === 'X' || seerFin === upsetDC) {
                pivotPred = upsetDC;
            } else {
                pivotPred = '12';
            }
        } else {
            // Partial Pivot
            pivotPred = '12';
        }
        pivotTarget = 'Und';
    } 
    // Market Fav
    else {
        pivotPred = favDC;
        pivotTarget = 'Fav';
    }

    let isHit = false;
    if (pivotPred === '1X' && (actual === '1' || actual === 'X')) isHit = true;
    if (pivotPred === 'X2' && (actual === '2' || actual === 'X')) isHit = true;
    if (pivotPred === '12' && (actual === '1' || actual === '2')) isHit = true;

    // Track recall for Fav Wins
    if (actual === favUnd.favResult && isHit) {
        favRecall.correctCalls++;
    }

    if (pivotTarget === 'Fav') {
        mfavPreds.total++;
        if (isHit) mfavPreds.hits++;
    } else if (pivotTarget === 'Und') {
        undPreds.total++;
        if (isHit) undPreds.hits++;
    } else if (pivotTarget === 'Draw') {
        drawPreds.total++;
        if (isHit) drawPreds.hits++;
    }
}

console.log(`\n--- SMART HEDGING TARGET RESULTS ---`);
console.log(`M.Fav Target Accuracy: ${(mfavPreds.hits / mfavPreds.total * 100).toFixed(2)}% (${mfavPreds.hits}/${mfavPreds.total})`);
console.log(`Underdog Target Accuracy: ${(undPreds.hits / undPreds.total * 100).toFixed(2)}% (${undPreds.hits}/${undPreds.total})`);
console.log(`Draw Target Accuracy: ${(drawPreds.hits / drawPreds.total * 100).toFixed(2)}% (${drawPreds.hits}/${drawPreds.total})`);
console.log(`M.Fav Win Recall (Did we catch the favorite when it won?): ${(favRecall.correctCalls / favRecall.actualFavWins * 100).toFixed(2)}%`);

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
