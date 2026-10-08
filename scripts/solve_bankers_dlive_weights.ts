import fs from 'fs';
import { evaluateBankersDliveWeights } from './bankers_dlive_eval_harness';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_rules_catalog.json`, 'utf8'));
const matchesMatrix = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_matches_matrix.json`, 'utf8'));
const stats = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_detailed_stats.json`, 'utf8'));

// Initialize all rules to 0
const weights = new Array(rulesCatalog.length).fill(0);

// We want to test step-by-step additions of:
// 1. High-win-rate drivers with positive points (+5, +10, +15, +20)
// 2. High-draw and high-upset traps with negative penalties (-5, -10, -15, -20, -25)
// 3. Clamping and zero-pruning

// Let's write an intelligent heuristic optimizer that explores clean OPW multiples of 5:
// Allowed points: [-25, -20, -15, -10, -5, 0, 5, 10, 15, 20]

const allowedPoints = [-25, -20, -15, -10, -5, 0, 5, 10, 15, 20];

// Step 1: Initial assignments based on statistical odds ratios
stats.forEach((r: any) => {
  if (r.totalHits >= 3) {
    if (r.winRate >= 75 && r.winOR >= 2.0) {
      weights[r.index] = 15;
    } else if (r.winRate >= 65 && r.winOR >= 1.5) {
      weights[r.index] = 10;
    } else if (r.drawRate >= 45 || r.udRate >= 35) {
      weights[r.index] = -15;
    } else if (r.drawRate >= 35 || r.udRate >= 28) {
      weights[r.index] = -10;
    }
  }
});

console.log('--- INITIAL STATISTICAL SEED ---');
console.log(evaluateBankersDliveWeights(weights));

// Coordinate ascent / local search over active rules
// Objective function:
// Primary: Maximize Top 10 Mfav wins (weight 1000)
// Secondary: Maximize Top 20 Mfav wins (weight 100)
// Tertiary: Maximize Top 30 Mfav wins (weight 10)
// Quaternary: Maximize scoreGapTop10VsLoss (weight 1)
// Penalty for non-zero weights (sparsity regularizer, weight -0.5)

function scoreWeights(w: number[]): number {
  const evalRes = evaluateBankersDliveWeights(w);
  const nonZeroCount = w.filter(x => x !== 0).length;
  return (
    evalRes.top10.mfav * 10000 +
    evalRes.top20.mfav * 500 +
    evalRes.top30.mfav * 50 +
    evalRes.firstLossRank * 100 +
    evalRes.scoreGapTop10VsLoss * 5 -
    nonZeroCount * 2
  );
}

let bestScore = scoreWeights(weights);
let bestWeights = [...weights];

console.log('Initial score:', bestScore);

let improved = true;
let iteration = 0;

while (improved && iteration < 15) {
  improved = false;
  iteration++;
  console.log(`\n--- Iteration ${iteration} (Best Score: ${bestScore}) ---`);

  // Try modifying rules that have hits > 0
  for (let i = 0; i < stats.length; i++) {
    const r = stats[i];
    if (r.totalHits === 0) continue; // Keep unhit rules at 0 (or safe guardrail)

    const orig = bestWeights[i];
    let bestLocalVal = orig;
    let bestLocalScore = bestScore;

    for (const p of allowedPoints) {
      if (p === orig) continue;
      bestWeights[i] = p;
      const s = scoreWeights(bestWeights);
      if (s > bestLocalScore) {
        bestLocalScore = s;
        bestLocalVal = p;
      }
    }

    if (bestLocalScore > bestScore) {
      bestWeights[i] = bestLocalVal;
      bestScore = bestLocalScore;
      improved = true;
      console.log(`Improved rule #${i} "${r.description}": ${orig} -> ${bestLocalVal} (New score: ${bestScore})`);
      console.log('Current eval:', evaluateBankersDliveWeights(bestWeights));
    } else {
      bestWeights[i] = orig;
    }
  }
}

console.log('\n================ FINAL OPTIMIZATION RESULT ================');
const finalEval = evaluateBankersDliveWeights(bestWeights);
console.log(finalEval);

fs.writeFileSync(`${outDir}\\bankers_dlive_optimized_weights.json`, JSON.stringify(bestWeights, null, 2));
