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

let stats: Record<string, { total: number, hits: number }> = {};

function addStat(name: string, isHit: boolean) {
    if (!stats[name]) stats[name] = { total: 0, hits: 0 };
    stats[name].total++;
    if (isHit) stats[name].hits++;
}

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
    
    const isUndDC = actual === favUnd.undResult || actual === 'X';
    const isFavDC = actual === favUnd.favResult || actual === 'X';
    const is12 = actual === '1' || actual === '2';
    
    const features = extractMLFeatures(m);
    if (!features) continue;

    const algoPrim = features.study5_algoPrimary;
    const seerPrim = m.seerPrimaryPrediction || '';
    const subPatPrim = features.study3_subPatPrimary;
    const tsDiff = features.study7_tsFavVsUnderdog;
    const ptsLean = features.study13_pointsSupport;
    const phaUnd = features.study2_pha?.underdog || 0;
    const phaFav = features.study2_pha?.fav || 0;

    const subPatIsUnd = subPatPrim === favUnd.undResult;
    const seerIsUnd = seerPrim === favUnd.undResult;
    const algoIsUnd = algoPrim === favUnd.undResult;
    
    const tsIsUnd = tsDiff !== null && tsDiff < -0.2;
    const ptsIsUnd = ptsLean === 'Underdog';
    const phaIsUnd = phaUnd > 35; // Significant PHA for underdog

    if (subPatIsUnd) {
        addStat('SubPat=Und', isUndDC);
        if (tsIsUnd) addStat('SubPat=Und + TS=Und', isUndDC);
        if (ptsIsUnd) addStat('SubPat=Und + Pts=Und', isUndDC);
        if (tsIsUnd && ptsIsUnd) addStat('SubPat=Und + TS=Und + Pts=Und', isUndDC);
        if (phaIsUnd) addStat('SubPat=Und + PHA>35', isUndDC);
    }
    
    if (algoIsUnd) {
        addStat('Algo=Und', isUndDC);
        if (tsIsUnd) addStat('Algo=Und + TS=Und', isUndDC);
        if (ptsIsUnd) addStat('Algo=Und + Pts=Und', isUndDC);
        if (phaIsUnd) addStat('Algo=Und + PHA>35', isUndDC);
        if (tsIsUnd && ptsIsUnd) addStat('Algo=Und + TS+Pts', isUndDC);
    }

    if (seerIsUnd) {
        addStat('Seer=Und', isUndDC);
        if (tsIsUnd) addStat('Seer=Und + TS=Und', isUndDC);
        if (ptsIsUnd) addStat('Seer=Und + Pts=Und', isUndDC);
        if (phaIsUnd) addStat('Seer=Und + PHA>35', isUndDC);
        if (tsIsUnd && ptsIsUnd) addStat('Seer=Und + TS+Pts', isUndDC);
    }

    // Strong combinations
    if (algoIsUnd || seerIsUnd) {
        if (ptsIsUnd && tsIsUnd && phaIsUnd) {
            addStat('Algo/Seer=Und + Pts+TS+PHA', isUndDC);
        }
    }
    
    // Test the 12 prediction (when we predict 12 instead of 1X/X2)
    // 12 is historically the easiest DC to hit (around 70-75% base rate)
    // If the models predict Underdog, does `12` hit at 90%+?
    if (algoIsUnd) {
        addStat('Algo=Und (Hit Rate of 12 DC)', is12);
    }
    if (seerIsUnd) {
        addStat('Seer=Und (Hit Rate of 12 DC)', is12);
    }
    if (subPatIsUnd) {
        addStat('SubPat=Und (Hit Rate of 12 DC)', is12);
    }
}

// Sort by hit rate
const sorted = Object.entries(stats).sort((a, b) => {
    const rateA = a[1].total > 0 ? a[1].hits / a[1].total : 0;
    const rateB = b[1].total > 0 ? b[1].hits / b[1].total : 0;
    return rateB - rateA;
});

console.log(`\n--- FILTERS FOR UNDERDOG PREDICTIONS ---`);
for (const [key, stat] of sorted) {
    if (stat.total >= 50) { // Only show statistically significant samples
        const rate = ((stat.hits / stat.total) * 100).toFixed(1);
        console.log(`${key.padEnd(35)}: ${stat.hits} / ${stat.total} (${rate}%)`);
    }
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
