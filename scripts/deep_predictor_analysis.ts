/**
 * SEER Intelligence — Hedge Disagreement Analysis
 * 
 * When predictors disagree on the hedge (e.g., Algo says "12" but Sub Pattern says "1X"),
 * which one should SEER Intelligence follow? 
 * 
 * This also maps match card signals to hedge outcomes to build the intelligence hedging.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { extractMLFeatures, getMLVariations } from '../src/utils/mlFeatureExtractor';
import { Match } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '..', 'db_export', 'user_uploaded_matches.json');
const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
let allMatches: Match[] = [];
if (Array.isArray(rawData)) {
  allMatches = rawData.map((r: any) => r.data || r);
} else if (rawData.matches) {
  allMatches = rawData.matches.map((r: any) => r.data || r);
}

const completed = allMatches.filter(m => {
  const r = getActualResult(m.result || '');
  return r && r !== 'pending';
});

console.log(`\n🔬 Hedge Disagreement Analysis — ${completed.length} matches\n`);

interface B { total: number; correct: number }
const mkB = (): B => ({ total: 0, correct: 0 });
const pct = (a: number, b: number) => b > 0 ? ((a/b)*100).toFixed(1)+'%' : 'N/A';

// ─── SECTION 1: When Algo and Sub Pattern AGREE vs DISAGREE on hedge ─────────
const algoSubAgree = mkB();
const algoSubDisagree = mkB();
const algoSubDisagreeAlgoWins = mkB();
const algoSubDisagreeSubWins = mkB();

// ─── SECTION 2: What happens when we ALWAYS follow the best predictor per outcome type
const alwaysAlgo = mkB();   // Always use Algo's hedge
const alwaysSub = mkB();    // Always use Sub Pattern's hedge  
const alwaysSeer = mkB();   // Always use SEER's hedge
const bestOfThree = mkB();  // Majority vote of all three
const conditionalBest = mkB(); // Use each predictor where it's strongest

// ─── SECTION 3: Match card signals → actual result correlation ───────────────
// When TS favors underdog, what really happens?
const tsUndFavor = { total: 0, favWin: 0, draw: 0, undWin: 0 };
// When Points favor underdog
const ptsUndFavor = { total: 0, favWin: 0, draw: 0, undWin: 0 };
// When both TS and Points favor underdog  
const bothUndFavor = { total: 0, favWin: 0, draw: 0, undWin: 0 };
// When hidden strength detected
const hiddenStr = { total: 0, favWin: 0, draw: 0, undWin: 0 };
// When hidden weakness detected
const hiddenWeak = { total: 0, favWin: 0, draw: 0, undWin: 0 };
// When both hidden strength AND weakness
const hiddenBoth = { total: 0, favWin: 0, draw: 0, undWin: 0 };
// When Algo says Und (algo.underdog > algo.fav)
const algoSaysUnd = { total: 0, favWin: 0, draw: 0, undWin: 0 };
// When SEER's draw > fav AND draw > und
const seerSaysDraw = { total: 0, favWin: 0, draw: 0, undWin: 0 };
// When sub pattern predicts underdog (1X when fav=away, X2 when fav=home)
const subSaysUnd = { total: 0, favWin: 0, draw: 0, undWin: 0 };

// ─── SECTION 4: Compelling pivot signals (multiple agree) ───────────────────
// When 3+ signals say underdog
const threeUndSignals = { total: 0, favWin: 0, draw: 0, undWin: 0 };
// When 4+ signals say underdog
const fourUndSignals = { total: 0, favWin: 0, draw: 0, undWin: 0 };

completed.forEach(m => {
  const actual = getActualResult(m.result || '');
  if (!actual) return;
  
  const features = extractMLFeatures(m);
  if (!features) return;
  
  const isHomeFav = features.favIndex === 0;
  const favResult = isHomeFav ? '1' : '2';
  const undResult = isHomeFav ? '2' : '1';
  const isFavWin = actual === favResult;
  const isDraw = actual === 'X';
  const isUndWin = actual === undResult;

  const algoPred = m.algoReport?.prediction || m.calculatedPrediction || '1';
  const subPred = m.finalPrediction || m.rawPrediction || '1';
  const seerPred = m.seerPrediction || '';
  
  // Section 1: Agreement analysis
  if (algoPred === subPred) {
    algoSubAgree.total++;
    if (matchesPrediction(algoPred, actual)) algoSubAgree.correct++;
  } else {
    algoSubDisagree.total++;
    const algoRight = matchesPrediction(algoPred, actual);
    const subRight = matchesPrediction(subPred, actual);
    if (algoRight) { algoSubDisagreeAlgoWins.total++; algoSubDisagreeAlgoWins.correct++; }
    if (subRight) { algoSubDisagreeSubWins.total++; algoSubDisagreeSubWins.correct++; }
    if (algoRight || subRight) algoSubDisagree.correct++;
  }
  
  // Section 2: Always-follow strategies
  alwaysAlgo.total++;
  if (matchesPrediction(algoPred, actual)) alwaysAlgo.correct++;
  
  alwaysSub.total++;
  if (matchesPrediction(subPred, actual)) alwaysSub.correct++;
  
  if (seerPred) {
    alwaysSeer.total++;
    if (matchesPrediction(seerPred, actual)) alwaysSeer.correct++;
  }
  
  // Best of three — majority vote
  const votes: Record<string, number> = {};
  [algoPred, subPred, seerPred || algoPred].forEach(p => {
    if (p) votes[p] = (votes[p] || 0) + 1;
  });
  const majorityPred = Object.entries(votes).sort((a,b) => b[1]-a[1])[0]?.[0] || '12';
  bestOfThree.total++;
  if (matchesPrediction(majorityPred, actual)) bestOfThree.correct++;
  
  // Section 3: Match card signals
  const variations = getMLVariations(m, features);
  
  const tsVar = variations['TS'] || '';
  const ptsVar = variations['Points'] || '';
  
  const addToOutcome = (bucket: typeof tsUndFavor) => {
    bucket.total++;
    if (isFavWin) bucket.favWin++;
    if (isDraw) bucket.draw++;
    if (isUndWin) bucket.undWin++;
  };
  
  const tsUnd = tsVar.startsWith('Und');
  const ptsUnd = ptsVar.startsWith('Und');
  
  if (tsUnd) addToOutcome(tsUndFavor);
  if (ptsUnd) addToOutcome(ptsUndFavor);
  if (tsUnd && ptsUnd) addToOutcome(bothUndFavor);
  if (features.study8_hiddenStrength) addToOutcome(hiddenStr);
  if (features.study10_hiddenWeakness) addToOutcome(hiddenWeak);
  if (features.study8_hiddenStrength && features.study10_hiddenWeakness) addToOutcome(hiddenBoth);
  
  if (features.study5_algo && features.study5_algo.underdog > features.study5_algo.fav) addToOutcome(algoSaysUnd);
  if (features.study6_seer && features.study6_seer.draw > features.study6_seer.fav && features.study6_seer.draw > features.study6_seer.underdog) addToOutcome(seerSaysDraw);
  
  // Sub says underdog: sub prediction includes undResult but not favResult
  const subIncludesUnd = subPred.includes(undResult);
  const subIncludesFav = subPred.includes(favResult);
  if (subIncludesUnd && !subIncludesFav) addToOutcome(subSaysUnd);
  
  // Section 4: Count underdog signals
  let undSignals = 0;
  if (tsUnd) undSignals++;
  if (ptsUnd) undSignals++;
  if (features.study8_hiddenStrength) undSignals++;
  if (features.study10_hiddenWeakness) undSignals++;
  if (features.study5_algo && features.study5_algo.underdog > features.study5_algo.fav) undSignals++;
  if (subIncludesUnd && !subIncludesFav) undSignals++;
  
  if (undSignals >= 3) addToOutcome(threeUndSignals);
  if (undSignals >= 4) addToOutcome(fourUndSignals);
});

const printOutcome = (label: string, b: typeof tsUndFavor) => {
  if (b.total === 0) return;
  console.log(`  ${label.padEnd(55)} n=${String(b.total).padStart(5)} | Fav=${pct(b.favWin,b.total).padStart(6)} Draw=${pct(b.draw,b.total).padStart(6)} Und=${pct(b.undWin,b.total).padStart(6)}`);
};

console.log('═══════════════════════════════════════════════════════════════');
console.log('SECTION 1: Algo vs Sub Pattern Agreement');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  When AGREE (same hedge): ${pct(algoSubAgree.correct, algoSubAgree.total)} DC (${algoSubAgree.correct}/${algoSubAgree.total})`);
console.log(`  When DISAGREE: at least one right ${pct(algoSubDisagree.correct, algoSubDisagree.total)} (${algoSubDisagree.correct}/${algoSubDisagree.total})`);
console.log(`    → Algo was right: ${algoSubDisagreeAlgoWins.total} times`);
console.log(`    → Sub was right:  ${algoSubDisagreeSubWins.total} times`);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('SECTION 2: Always-Follow Strategies (Overall DC)');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Always Algo:          ${pct(alwaysAlgo.correct, alwaysAlgo.total)} (${alwaysAlgo.correct}/${alwaysAlgo.total})`);
console.log(`  Always Sub Pattern:   ${pct(alwaysSub.correct, alwaysSub.total)} (${alwaysSub.correct}/${alwaysSub.total})`);
console.log(`  Always SEER:          ${pct(alwaysSeer.correct, alwaysSeer.total)} (${alwaysSeer.correct}/${alwaysSeer.total})`);
console.log(`  Majority Vote (best of 3): ${pct(bestOfThree.correct, bestOfThree.total)} (${bestOfThree.correct}/${bestOfThree.total})`);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('SECTION 3: Match Card Signals → Actual Outcome');
console.log('(What happens when specific signals fire?)');
console.log('═══════════════════════════════════════════════════════════════');
printOutcome('TS favors Underdog (TS: Und >> Fav or Und > Fav)', tsUndFavor);
printOutcome('Points favor Underdog', ptsUndFavor);
printOutcome('BOTH TS AND Points favor Underdog', bothUndFavor);
printOutcome('Hidden Strength detected (Und GS≈GA)', hiddenStr);
printOutcome('Hidden Weakness detected (Fav GS≈GA)', hiddenWeak);
printOutcome('BOTH Hidden Str AND Hidden Weak', hiddenBoth);
printOutcome('Algo probabilities say Underdog > Fav', algoSaysUnd);
printOutcome('SEER draw > fav AND draw > und (draw dominant)', seerSaysDraw);
printOutcome('Sub Pattern leans Underdog (e.g. X2 when fav=home)', subSaysUnd);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('SECTION 4: Underdog Signal Convergence');
console.log('(When MULTIPLE match card signals point to underdog)');
console.log('═══════════════════════════════════════════════════════════════');
printOutcome('3+ underdog signals converge', threeUndSignals);
printOutcome('4+ underdog signals converge ← COMPELLING', fourUndSignals);
