import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
import { extractMLFeatures } from '../src/utils/mlFeatureExtractor';
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

let customStats = { total: 0, hits: 0 };
let defaultStats = { total: 0, hits: 0 };
let pivotUndStats = { total: 0, hits: 0 };

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

    // Run baseline Tri-Core
    const mlDecision = predictWithHybridML(m as Match);
    if (mlDecision.mlApplied) {
        defaultStats.total++;
        if (matchesPrediction(mlDecision.mlPrediction, actual)) {
            defaultStats.hits++;
        }
    }

    // PIvot Logic Check
    const algoPrim = features.study5_algoPrimary;
    const seerPrim = m.seerPrimaryPrediction || '';
    const subPatPrim = features.study3_subPatPrimary;
    const ptsLean = features.study13_pointsSupport;
    const tsDiff = features.study7_tsFavVsUnderdog;

    const subPatIsUnd = subPatPrim === favUnd.undResult;
    const algoIsUnd = algoPrim === favUnd.undResult;
    const seerIsUnd = seerPrim === favUnd.undResult;
    const tsIsUnd = tsDiff !== null && tsDiff < -0.2;
    const ptsIsUnd = ptsLean === 'Underdog';

    const subPatIsDraw = subPatPrim === 'X';
    const seerIsDraw = seerPrim === 'X';
    const tsIsDraw = tsDiff !== null && Math.abs(tsDiff) <= 0.2;

    let finalPred = mlDecision.mlPrediction;
    let didPivot = false;

    // Rule 1: Massive Underdog Consensus -> Pivot to '12' (Upset Double Chance)
    // If Sub Pattern and Seer predict Underdog, and Algo predicts Underdog, we confidently pivot to '12'
    if (subPatIsUnd || algoIsUnd || seerIsUnd) {
        let undSignals = 0;
        if (subPatIsUnd) undSignals++;
        if (algoIsUnd) undSignals++;
        if (seerIsUnd) undSignals++;
        if (tsIsUnd) undSignals++;
        if (ptsIsUnd) undSignals++;

        if (undSignals >= 3) { // 3 or more signals pointing to underdog
            finalPred = '12';
            didPivot = true;
        } else if (subPatIsUnd && (tsIsUnd || ptsIsUnd)) {
            finalPred = '12';
            didPivot = true;
        }
    }

    // Rule 2: Strong Draw Consensus -> Pivot to Draw DC
    if (!didPivot && (subPatIsDraw || seerIsDraw)) {
        if (subPatIsDraw && seerIsDraw) {
            // Predict Draw DC covering the favorite
            finalPred = favUnd.favResult === '1' ? '1X' : 'X2';
            didPivot = true;
        } else if ((subPatIsDraw || seerIsDraw) && tsIsDraw) {
            finalPred = favUnd.favResult === '1' ? '1X' : 'X2';
            didPivot = true;
        }
    }

    if (finalPred) {
        customStats.total++;
        const isHit = matchesPrediction(finalPred, actual);
        if (isHit) customStats.hits++;
        
        if (didPivot && finalPred === '12') {
            pivotUndStats.total++;
            if (isHit) pivotUndStats.hits++;
        }
    }
}

console.log(`--- BASELINE TRI-CORE HYBRID ---`);
console.log(`Hits: ${defaultStats.hits} / ${defaultStats.total} (${(defaultStats.hits/defaultStats.total*100).toFixed(1)}%)`);

console.log(`\n--- CUSTOM PIVOT HYBRID ---`);
console.log(`Hits: ${customStats.hits} / ${customStats.total} (${(customStats.hits/customStats.total*100).toFixed(1)}%)`);

console.log(`\n--- PIVOT UNDERDOG TRIGGER (12) ---`);
console.log(`Hits: ${pivotUndStats.hits} / ${pivotUndStats.total} (${(pivotUndStats.total > 0 ? pivotUndStats.hits/pivotUndStats.total*100 : 0).toFixed(1)}%)`);

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
