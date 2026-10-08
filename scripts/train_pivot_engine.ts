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

// We want to test different rule combinations for the Pivot Engine
// Goal: 
// 1. Maximize M.Fav Precision/Recall
// 2. Maximize Underdog Pivot Hit Rate (> 75%)
// 3. Maximize Draw Pivot Hit Rate (> 81%)

const results = [];

function evaluateRules(undThresh: number, reqTsUnd: boolean, reqPtsUnd: boolean, drawThresh: number) {
    let mfavPreds = { total: 0, hits: 0 };
    let undPreds = { total: 0, hits: 0 };
    let drawPreds = { total: 0, hits: 0 };

    for (const m of matches) {
        if (!m.result || m.result === '?-?' || m.result === 'Unknown' || m.result === 'pending') continue;
        
        const resultStr = m.result;
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

        const favDC = favUnd.favResult === '1' ? '1X' : 'X2';
        const upsetDC = favUnd.favResult === '1' ? 'X2' : '1X';

        // PIVOT LOGIC SIMULATION
        let pivotPred = '';
        let pivotTarget = ''; // 'Fav', 'Und', 'Draw'

        // Underdog Pivot Logic
        if (subPatPrim === favUnd.undResult) {
            let undSignals = 1;
            if (algoPrim === favUnd.undResult) undSignals++;
            if (seerPrim === favUnd.undResult) undSignals++;
            if (tsLean === favUnd.undResult) undSignals++;
            if (ptsLean === 'Underdog') undSignals++;

            let valid = undSignals >= undThresh;
            if (reqTsUnd && tsLean !== favUnd.undResult) valid = false;
            if (reqPtsUnd && ptsLean !== 'Underdog') valid = false;

            if (valid) {
                pivotPred = '12';
                pivotTarget = 'Und';
            }
        } 
        
        // Draw Pivot Logic
        if (!pivotTarget && subPatPrim === 'X') {
            let drawSignals = 1;
            if (algoPrim === 'X') drawSignals++;
            if (seerPrim === 'X') drawSignals++;
            if (tsLean === 'X') drawSignals++;
            if (ptsLean === 'Draw') drawSignals++;

            if (drawSignals >= drawThresh) {
                pivotPred = favDC; // Hedges Draw and Fav
                pivotTarget = 'Draw';
            }
        }

        // Default M.Fav (Base Tri-Core fallback assumption)
        if (!pivotTarget) {
            pivotPred = favDC;
            pivotTarget = 'Fav';
        }

        // Evaluation
        let isHit = false;
        if (pivotPred === '1X' && (actual === '1' || actual === 'X')) isHit = true;
        if (pivotPred === 'X2' && (actual === '2' || actual === 'X')) isHit = true;
        if (pivotPred === '12' && (actual === '1' || actual === '2')) isHit = true;

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

    return {
        mfavAcc: mfavPreds.total > 0 ? (mfavPreds.hits / mfavPreds.total * 100).toFixed(2) : 0,
        mfavVol: mfavPreds.total,
        undAcc: undPreds.total > 0 ? (undPreds.hits / undPreds.total * 100).toFixed(2) : 0,
        undVol: undPreds.total,
        drawAcc: drawPreds.total > 0 ? (drawPreds.hits / drawPreds.total * 100).toFixed(2) : 0,
        drawVol: drawPreds.total
    };
}

const params = [
    { uT: 1, reqTs: false, reqPts: false, dT: 2 },
    { uT: 2, reqTs: false, reqPts: false, dT: 2 },
    { uT: 3, reqTs: false, reqPts: false, dT: 2 },
    { uT: 2, reqTs: true, reqPts: false, dT: 2 },
    { uT: 2, reqTs: false, reqPts: true, dT: 2 },
    { uT: 3, reqTs: true, reqPts: false, dT: 2 },
    { uT: 3, reqTs: false, reqPts: true, dT: 2 },
    { uT: 2, reqTs: false, reqPts: false, dT: 3 },
    { uT: 3, reqTs: true, reqPts: true, dT: 3 }
];

console.log(`--- OVERNIGHT TRAINING RESULTS ---`);
for (const p of params) {
    const res = evaluateRules(p.uT, p.reqTs, p.reqPts, p.dT);
    console.log(`Rules: UndThresh=${p.uT}, ReqTS=${p.reqTs}, ReqPts=${p.reqPts}, DrawThresh=${p.dT}`);
    console.log(`  M.Fav: ${res.mfavAcc}% (${res.mfavVol} matches)`);
    console.log(`  Underdog: ${res.undAcc}% (${res.undVol} matches)`);
    console.log(`  Draw: ${res.drawAcc}% (${res.drawVol} matches)`);
    console.log(`-----------------------------------`);
}

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
