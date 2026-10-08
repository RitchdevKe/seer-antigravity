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

// We are going to collect hit rates for every possible unique signature
// Signature: "Algo:Fav|Seer:Draw|SubPat:Und|Pts:Fav|TS:Draw"
const signatures: Record<string, { total: number, hitFavDC: number, hitUndDC: number, hit12: number }> = {};

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

    const algoPrim = features.study5_algoPrimary;
    const seerPrim = m.seerPrimaryPrediction || 'None';
    const subPatPrim = features.study3_subPatPrimary;
    const ptsLean = features.study13_pointsSupport || 'None';
    const tsDiff = features.study7_tsFavVsUnderdog;
    
    let tsLean = 'None';
    if (tsDiff !== null) {
        if (tsDiff > 0.2) tsLean = 'Fav';
        else if (tsDiff < -0.2) tsLean = 'Und';
        else tsLean = 'Draw';
    }

    const mapLean = (pred: string) => {
        if (pred === favUnd.favResult) return 'Fav';
        if (pred === favUnd.undResult) return 'Und';
        if (pred === 'X') return 'Draw';
        return 'None';
    };

    const algoL = mapLean(algoPrim);
    const seerL = mapLean(seerPrim);
    const subPatL = mapLean(subPatPrim);
    const ptsL = ptsLean === 'Fav' || ptsLean === 'Underdog' || ptsLean === 'Draw' ? (ptsLean === 'Underdog' ? 'Und' : ptsLean) : 'None';

    const sig = `${algoL}|${seerL}|${subPatL}|${ptsL}|${tsLean}`;
    
    if (!signatures[sig]) {
        signatures[sig] = { total: 0, hitFavDC: 0, hitUndDC: 0, hit12: 0 };
    }
    
    const sigStats = signatures[sig];
    sigStats.total++;
    
    if (actual === favUnd.favResult || actual === 'X') sigStats.hitFavDC++;
    if (actual === favUnd.undResult || actual === 'X') sigStats.hitUndDC++;
    if (actual === '1' || actual === '2') sigStats.hit12++;
}

// Now find the best prediction for each signature
let totalMatches = 0;
let bestHits = 0;

for (const [sig, stats] of Object.entries(signatures)) {
    totalMatches += stats.total;
    
    // Which prediction hits the highest?
    const maxHits = Math.max(stats.hitFavDC, stats.hitUndDC, stats.hit12);
    bestHits += maxHits;
}

console.log(`\n--- MAXIMUM THEORETICAL ACCURACY ---`);
console.log(`If we pick the PERFECT Double Chance (FavDC, UndDC, or 12) for EVERY combination of Algo/Seer/SubPat/Pts/TS:`);
console.log(`Total Hits: ${bestHits} / ${totalMatches} (${(bestHits/totalMatches*100).toFixed(2)}%)`);

// Print top signatures
console.log(`\n--- TOP SIGNATURES (Volume > 50) ---`);
const sigArr = Object.entries(signatures).filter(s => s[1].total > 50);

// Sort by highest individual hit rate (e.g. if hitFavDC/total > 0.90)
const sigWithBest = sigArr.map(([sig, stats]) => {
    let bestType = '';
    let maxHit = 0;
    if (stats.hitFavDC >= stats.hitUndDC && stats.hitFavDC >= stats.hit12) { bestType = 'FavDC'; maxHit = stats.hitFavDC; }
    else if (stats.hitUndDC >= stats.hitFavDC && stats.hitUndDC >= stats.hit12) { bestType = 'UndDC'; maxHit = stats.hitUndDC; }
    else { bestType = '12'; maxHit = stats.hit12; }
    
    return { sig, stats, bestType, maxHit, rate: maxHit / stats.total };
});

sigWithBest.sort((a, b) => b.rate - a.rate);

for (let i = 0; i < Math.min(20, sigWithBest.length); i++) {
    const s = sigWithBest[i];
    console.log(`${(s.rate*100).toFixed(1)}% -> ${s.bestType.padEnd(6)} | ${s.maxHit.toString().padStart(4)}/${s.stats.total.toString().padEnd(4)} | ${s.sig}`);
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
