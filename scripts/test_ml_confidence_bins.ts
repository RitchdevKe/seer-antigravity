import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
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

const bins: Record<string, { total: number, hits: number }> = {
    '90+': { total: 0, hits: 0 },
    '85-89': { total: 0, hits: 0 },
    '80-84': { total: 0, hits: 0 },
    '75-79': { total: 0, hits: 0 },
    '70-74': { total: 0, hits: 0 },
    '<70': { total: 0, hits: 0 },
};

let favTargetHits = 0;
let favTargetTotal = 0;

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
    
    const mlDecision = predictWithHybridML(m as Match);
    if (!mlDecision.mlApplied) continue;

    const conf = mlDecision.mlConfidence || 0;
    const pred = mlDecision.mlPrediction;
    
    let isHit = false;
    if (pred === '1X' && (actual === '1' || actual === 'X')) isHit = true;
    if (pred === 'X2' && (actual === '2' || actual === 'X')) isHit = true;
    if (pred === '12' && (actual === '1' || actual === '2')) isHit = true;

    // Check bin
    let bin = '<70';
    if (conf >= 90) bin = '90+';
    else if (conf >= 85) bin = '85-89';
    else if (conf >= 80) bin = '80-84';
    else if (conf >= 75) bin = '75-79';
    else if (conf >= 70) bin = '70-74';

    bins[bin].total++;
    if (isHit) bins[bin].hits++;

    // Track M Fav accuracy specifically
    // If the ML target covers the market favorite (e.g. 1X and 1 is favorite)
    if ((pred === '1X' && favUnd.favResult === '1') || (pred === 'X2' && favUnd.favResult === '2')) {
        favTargetTotal++;
        if (isHit) favTargetHits++;
    }
}

console.log(`\n--- ML CONFIDENCE BIN ACCURACY ---`);
for (const [bin, stat] of Object.entries(bins)) {
    const rate = stat.total > 0 ? (stat.hits / stat.total * 100).toFixed(1) : '0.0';
    console.log(`Confidence ${bin.padEnd(6)}: ${stat.hits.toString().padStart(4)} / ${stat.total.toString().padEnd(4)} (${rate}%)`);
}

console.log(`\nOverall ML M.Fav accuracy: ${(favTargetHits/favTargetTotal*100).toFixed(1)}%`);

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
