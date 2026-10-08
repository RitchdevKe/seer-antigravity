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

let closeOdds = { total: 0, favWins: 0, undWins: 0, draws: 0 };
let moderateOdds = { total: 0, favWins: 0, undWins: 0, draws: 0 };
let extremeOdds = { total: 0, favWins: 0, undWins: 0, draws: 0 };

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
    if (subPatPrim !== favUnd.undResult) continue;

    if (favUnd.favOdds >= 2.0) {
        closeOdds.total++;
        if (actual === favUnd.favResult) closeOdds.favWins++;
        if (actual === favUnd.undResult) closeOdds.undWins++;
        if (actual === 'X') closeOdds.draws++;
    } else if (favUnd.favOdds >= 1.5) {
        moderateOdds.total++;
        if (actual === favUnd.favResult) moderateOdds.favWins++;
        if (actual === favUnd.undResult) moderateOdds.undWins++;
        if (actual === 'X') moderateOdds.draws++;
    } else {
        extremeOdds.total++;
        if (actual === favUnd.favResult) extremeOdds.favWins++;
        if (actual === favUnd.undResult) extremeOdds.undWins++;
        if (actual === 'X') extremeOdds.draws++;
    }
}

function printStats(name: string, s: any) {
    if (s.total === 0) return;
    const favPct = ((s.favWins / s.total) * 100).toFixed(1);
    const undPct = ((s.undWins / s.total) * 100).toFixed(1);
    const drawPct = ((s.draws / s.total) * 100).toFixed(1);
    const win12 = (((s.favWins + s.undWins) / s.total) * 100).toFixed(1);
    const winUndDC = (((s.undWins + s.draws) / s.total) * 100).toFixed(1);

    console.log(`\n${name} | Total Matches: ${s.total}`);
    console.log(`  Actual Results -> Fav: ${favPct}% | Und: ${undPct}% | Draw: ${drawPct}%`);
    console.log(`  Hedge 12 Win Rate: ${win12}%`);
    console.log(`  Hedge Und DC (X2/1X) Win Rate: ${winUndDC}%`);
}

console.log(`\n--- SMART HEDGING: ODDS BUCKETS ---`);
printStats("Close Odds (Fav Odds >= 2.0)", closeOdds);
printStats("Moderate Odds (1.5 <= Fav Odds < 2.0)", moderateOdds);
printStats("Extreme Odds (Fav Odds < 1.5)", extremeOdds);

function getFavUndFromOdds(m: any) {
  const oddsStr = m.mo || m.odds || '';
  const parts = oddsStr.split(/[- ,|]+/).map((p: string) => parseFloat(p.trim())).filter((p: number) => !isNaN(p));
  if (parts.length >= 3) {
    const o1 = parts[0];
    const o2 = parts[2];
    if (o1 !== o2) {
      return {
        favResult: o1 < o2 ? '1' : '2',
        undResult: o1 < o2 ? '2' : '1',
        favOdds: o1 < o2 ? o1 : o2
      };
    }
  }
  return null;
}
