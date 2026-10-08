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

const stats: Record<number, { total: number, favWins: number, undWins: number, draws: number, seerDraws: number }> = {};

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
    if (subPatPrim !== favUnd.undResult) continue; // Only analyze when SubPat calls the upset

    const algoPrim = features.study5_algoPrimary || '';
    const seerPrim = m.seerPrimaryPrediction || '';
    const ptsLean = features.study13_pointsSupport || '';
    const tsDiff = features.study7_tsFavVsUnderdog || 0;
    
    let tsLean = '';
    if (tsDiff > 0.2) tsLean = favUnd.favResult;
    else if (tsDiff < -0.2) tsLean = favUnd.undResult;
    else tsLean = 'X';

    let undSignals = 1; // SubPat
    if (algoPrim === favUnd.undResult) undSignals++;
    if (seerPrim === favUnd.undResult) undSignals++;
    if (tsLean === favUnd.undResult) undSignals++;
    if (ptsLean === 'Underdog') undSignals++;

    if (!stats[undSignals]) {
        stats[undSignals] = { total: 0, favWins: 0, undWins: 0, draws: 0, seerDraws: 0 };
    }

    stats[undSignals].total++;
    if (actual === favUnd.favResult) stats[undSignals].favWins++;
    if (actual === favUnd.undResult) stats[undSignals].undWins++;
    if (actual === 'X') stats[undSignals].draws++;

    if (seerPrim === 'X') stats[undSignals].seerDraws++;
}

console.log(`\n--- SMART HEDGING ANALYSIS ---`);
console.log(`Analyzing outcomes when Sub Pattern predicts Underdog, grouped by total Underdog signals:\n`);

for (let i = 1; i <= 5; i++) {
    if (!stats[i]) continue;
    const s = stats[i];
    const favPct = ((s.favWins / s.total) * 100).toFixed(1);
    const undPct = ((s.undWins / s.total) * 100).toFixed(1);
    const drawPct = ((s.draws / s.total) * 100).toFixed(1);
    
    // Evaluate hedges
    const hedge12 = s.favWins + s.undWins;
    const hedgeUndDC = s.undWins + s.draws;
    const win12 = ((hedge12 / s.total) * 100).toFixed(1);
    const winUndDC = ((hedgeUndDC / s.total) * 100).toFixed(1);

    console.log(`Signals: ${i} | Total Matches: ${s.total}`);
    console.log(`  Actual Results -> Fav: ${favPct}% | Und: ${undPct}% | Draw: ${drawPct}%`);
    console.log(`  Seer Predicted Draw in ${s.seerDraws} matches (${((s.seerDraws / s.total) * 100).toFixed(1)}%)`);
    console.log(`  Hedge 12 Win Rate: ${win12}%`);
    console.log(`  Hedge Und DC (X2/1X) Win Rate: ${winUndDC}%`);
    console.log(`-------------------------------------------------`);
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
