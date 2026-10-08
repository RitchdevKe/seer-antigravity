/**
 * CORRECTED Predictor Audit — Uses db_export (12K Analysis Board matches)
 * Replicates EXACTLY what the Analysis Board shows when you click Fav/Underdog/Draw
 * 
 * Key: matchesPrediction() is DC scoring — "1X" is correct if actual is "1" or "X"
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { extractMLFeatures, getMLVariations } from '../src/utils/mlFeatureExtractor';
// predictWithSeer requires live weights/phaStats — we'll use stored seerPrediction instead
import { Match } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// USE THE CORRECT DATA SOURCE — db_export (what Analysis Board actually has)
const DATA_FILE = path.join(__dirname, '..', 'db_export', 'user_uploaded_matches.json');
const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
let allMatches: Match[] = [];
if (Array.isArray(rawData)) {
  allMatches = rawData.map((r: any) => r.data || r);
} else if (rawData.matches) {
  allMatches = rawData.matches.map((r: any) => r.data || r);
}

// Filter to completed matches only (matching what Analysis Board does)
const completed = allMatches.filter(m => {
  const r = getActualResult(m.result || '');
  return r && r !== 'pending';
});

console.log(`\n📊 CORRECTED AUDIT — Using db_export (Analysis Board data)`);
console.log(`Total matches: ${allMatches.length}`);
console.log(`Completed matches: ${completed.length}\n`);

// ─── Step 1: Check what each predictor actually outputs ──────────────────────
// Sample a few matches to see the prediction format
console.log('═══ SAMPLE: What do predictors actually output? ═══');
for (let i = 0; i < Math.min(5, completed.length); i++) {
  const m = completed[i];
  const actual = getActualResult(m.result || '');
  console.log(`  Match: ${m.teams?.substring(0, 35)} | Result: ${actual}`);
  console.log(`    Algo prediction:      "${m.algoReport?.prediction || m.calculatedPrediction || 'N/A'}"`);
  console.log(`    PAA prediction:       "${m.paaPrediction || m.paaPrimaryPrediction || m.finalPrediction || m.rawPrediction || 'N/A'}"`);
  console.log(`    SEER (default) pred:  "${m.seerPrediction || 'N/A (not stored)'}"`);
  console.log(`    Sub Pattern:          "${m.patternAnalysis?.subPattern || m.subPattern || 'N/A'}"`);
  console.log(`    Sub Pattern Pred:     "${m.finalPrediction || m.rawPrediction || 'N/A'}"`);
  console.log('');
}

// ─── Step 2: Replicate Analysis Board accuracy EXACTLY ───────────────────────
// This mirrors lines 1387-1410 of MatchAnalysis.tsx

let subPattCorrect = 0;
let seerCorrect = 0;
let paaCorrect = 0;
let algoCorrect = 0;

// Also break down by what actually happened (fav/draw/underdog)
let favWinTotal = 0, drawTotal = 0, undWinTotal = 0;
let subPattCorrectOnFav = 0, subPattCorrectOnDraw = 0, subPattCorrectOnUnd = 0;
let algoCorrectOnFav = 0, algoCorrectOnDraw = 0, algoCorrectOnUnd = 0;
let seerCorrectOnFav = 0, seerCorrectOnDraw = 0, seerCorrectOnUnd = 0;

// Track what predictions look like
const algoPredFormats: Record<string, number> = {};
const subPattPredFormats: Record<string, number> = {};

completed.forEach(m => {
  const actual = getActualResult(m.result || '');
  if (!actual) return;
  
  // Determine fav/underdog from odds (same as Analysis Board filter)
  const oddsStr = m.mo || m.odds || '';
  const parts = oddsStr.split(/[- ,]+/).map((p: string) => parseFloat(p.trim())).filter((p: number) => !isNaN(p));
  let moFav = '', moUnd = '';
  if (parts.length >= 3) {
    const o1 = parts[0];
    const o2 = parts[2];
    if (o1 !== o2) {
      moFav = o1 < o2 ? '1' : '2';
      moUnd = o1 < o2 ? '2' : '1';
    }
  }
  
  const isFavWin = actual === moFav;
  const isDrawWin = actual === 'X';
  const isUndWin = actual === moUnd;
  
  if (isFavWin) favWinTotal++;
  if (isDrawWin) drawTotal++;
  if (isUndWin) undWinTotal++;

  // Sub Pattern prediction (same as finalPrediction / rawPrediction in Analysis Board)
  const subPred = m.finalPrediction || m.rawPrediction || '1';
  if (matchesPrediction(subPred, actual)) {
    subPattCorrect++;
    if (isFavWin) subPattCorrectOnFav++;
    if (isDrawWin) subPattCorrectOnDraw++;
    if (isUndWin) subPattCorrectOnUnd++;
  }
  subPattPredFormats[subPred] = (subPattPredFormats[subPred] || 0) + 1;
  
  // Algo prediction
  const algoPred = m.algoReport?.prediction || m.calculatedPrediction || '1';
  if (matchesPrediction(algoPred, actual)) {
    algoCorrect++;
    if (isFavWin) algoCorrectOnFav++;
    if (isDrawWin) algoCorrectOnDraw++;
    if (isUndWin) algoCorrectOnUnd++;
  }
  algoPredFormats[algoPred] = (algoPredFormats[algoPred] || 0) + 1;
  
  // PAA prediction
  const paaPred = m.paaPrediction || m.paaPrimaryPrediction || m.finalPrediction || m.rawPrediction || '1';
  if (matchesPrediction(paaPred, actual)) paaCorrect++;
  
  // SEER (default) — we can't call predictWithSeer without phaStatsMap and weights,
  // so we'll use stored seerPrediction if available
  const seerPred = m.seerPrediction || '';
  if (seerPred && matchesPrediction(seerPred, actual)) {
    seerCorrect++;
    if (isFavWin) seerCorrectOnFav++;
    if (isDrawWin) seerCorrectOnDraw++;
    if (isUndWin) seerCorrectOnUnd++;
  }
});

const pct = (a: number, b: number) => b > 0 ? ((a/b)*100).toFixed(1) + '%' : 'N/A';

console.log('═══════════════════════════════════════════════════════════════');
console.log('        ANALYSIS BOARD ACCURACY REPLICATION (DC scoring)      ');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`  Completed matches: ${completed.length}`);
console.log(`  Fav wins: ${favWinTotal} (${pct(favWinTotal, completed.length)})`);
console.log(`  Draw:     ${drawTotal} (${pct(drawTotal, completed.length)})`);
console.log(`  Und wins: ${undWinTotal} (${pct(undWinTotal, completed.length)})`);
const noOdds = completed.length - favWinTotal - drawTotal - undWinTotal;
if (noOdds > 0) console.log(`  No odds:  ${noOdds} (${pct(noOdds, completed.length)})`);

console.log('\n─── OVERALL DC ACCURACY (matches Analysis Board toolbar) ───');
console.log(`  Sub Pattern: ${pct(subPattCorrect, completed.length)} (${subPattCorrect}/${completed.length})`);
console.log(`  Algo:        ${pct(algoCorrect, completed.length)} (${algoCorrect}/${completed.length})`);
console.log(`  PAA:         ${pct(paaCorrect, completed.length)} (${paaCorrect}/${completed.length})`);
console.log(`  SEER:        ${pct(seerCorrect, completed.length)} (${seerCorrect}/${completed.length})`);

console.log('\n─── BREAKDOWN: When FAV wins ───');
console.log(`  Sub Pattern correct: ${pct(subPattCorrectOnFav, favWinTotal)} (${subPattCorrectOnFav}/${favWinTotal})`);
console.log(`  Algo correct:        ${pct(algoCorrectOnFav, favWinTotal)} (${algoCorrectOnFav}/${favWinTotal})`);
console.log(`  SEER correct:        ${pct(seerCorrectOnFav, favWinTotal)} (${seerCorrectOnFav}/${favWinTotal})`);

console.log('\n─── BREAKDOWN: When DRAW happens ───');
console.log(`  Sub Pattern correct: ${pct(subPattCorrectOnDraw, drawTotal)} (${subPattCorrectOnDraw}/${drawTotal})`);
console.log(`  Algo correct:        ${pct(algoCorrectOnDraw, drawTotal)} (${algoCorrectOnDraw}/${drawTotal})`);
console.log(`  SEER correct:        ${pct(seerCorrectOnDraw, drawTotal)} (${seerCorrectOnDraw}/${drawTotal})`);

console.log('\n─── BREAKDOWN: When UNDERDOG wins ───');
console.log(`  Sub Pattern correct: ${pct(subPattCorrectOnUnd, undWinTotal)} (${subPattCorrectOnUnd}/${undWinTotal})`);
console.log(`  Algo correct:        ${pct(algoCorrectOnUnd, undWinTotal)} (${algoCorrectOnUnd}/${undWinTotal})`);
console.log(`  SEER correct:        ${pct(seerCorrectOnUnd, undWinTotal)} (${seerCorrectOnUnd}/${undWinTotal})`);

console.log('\n─── PREDICTION FORMAT DISTRIBUTION ───');
console.log('  Algo outputs:');
Object.entries(algoPredFormats).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log(`    "${k}": ${v} (${pct(v, completed.length)})`);
});
console.log('  Sub Pattern outputs:');
Object.entries(subPattPredFormats).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => {
  console.log(`    "${k}": ${v} (${pct(v, completed.length)})`);
});
