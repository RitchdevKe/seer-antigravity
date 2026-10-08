import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\best_bet_rules_catalog.json`, 'utf8'));
const matchesMatrix = JSON.parse(fs.readFileSync(`${outDir}\\best_bet_matches_matrix.json`, 'utf8'));
const detailedStats = JSON.parse(fs.readFileSync(`${outDir}\\detailed_rule_statistics.json`, 'utf8'));

interface MatchRecord {
  id: string | number;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  basePoints: number;
  triggeredRuleIndices: number[];
}

const matches: MatchRecord[] = matchesMatrix;
const N = rulesCatalog.length; // 125

// Allowed point values
const ALLOWED_VALUES = [-25, -20, -15, -10, -5, 0, 5, 10, 15, 20];

// Evaluate fitness
function evaluate(weights: number[]) {
  const scores: { outcome: 'MFAV' | 'DRAW' | 'UNDERDOG'; score: number }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    let s = m.basePoints;
    for (let j = 0; j < m.triggeredRuleIndices.length; j++) {
      s += weights[m.triggeredRuleIndices[j]];
    }
    scores.push({ outcome: m.outcome, score: s });
  }

  // Sort descending
  scores.sort((a, b) => b.score - a.score);

  let top10_losses = 0;
  for (let i = 0; i < 10; i++) {
    if (scores[i].outcome !== 'MFAV') top10_losses++;
  }

  let top20_losses = 0;
  for (let i = 0; i < 20; i++) {
    if (scores[i].outcome !== 'MFAV') top20_losses++;
  }

  let top30_losses = 0;
  for (let i = 0; i < 30; i++) {
    if (scores[i].outcome !== 'MFAV') top30_losses++;
  }

  let firstLossRank = scores.length + 1;
  let highestLossScore = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    if (scores[i].outcome !== 'MFAV') {
      if (firstLossRank > scores.length) firstLossRank = i + 1;
      if (scores[i].score > highestLossScore) highestLossScore = scores[i].score;
    }
  }

  const tenthMfavScore = scores[9]?.score ?? 0;
  const scoreMargin = tenthMfavScore - highestLossScore;

  // L1 regularization penalty (prefer sparse weights, 0 points for unnecessary rules)
  let nonZeroCount = 0;
  for (let i = 0; i < N; i++) {
    if (weights[i] !== 0) nonZeroCount++;
  }

  // Cost function to MINIMIZE
  // 0 losses in top 10 is mandatory.
  // Then minimize top 20 losses, top 30 losses, maximize scoreMargin, minimize non-zero rules.
  const cost = (top10_losses * 100000) + 
               (top20_losses * 5000) + 
               (top30_losses * 500) - 
               (Math.min(firstLossRank, 31) * 200) - 
               (scoreMargin * 10) + 
               (nonZeroCount * 2);

  return {
    cost,
    top10_losses,
    top20_losses,
    top30_losses,
    firstLossRank,
    scoreMargin,
    nonZeroCount
  };
}

// Directional constraints based on domain knowledge:
// If a rule strongly favors Mfav (e.g. odds ratio >= 1.5), it shouldn't be negative.
// If a rule is a known risk rule or favors losses (odds ratio <= 0.7), it shouldn't be positive.
const minVal = new Array(N).fill(-25);
const maxVal = new Array(N).fill(20);

detailedStats.forEach((stat: any) => {
  const i = stat.index;
  if (stat.oddsRatio >= 1.5 && stat.mfavHits >= 5) {
    minVal[i] = 0; // cannot be negative
  } else if (stat.oddsRatio <= 0.6 && (stat.drawHits + stat.udHits) >= 2) {
    maxVal[i] = 0; // cannot be positive
  } else if (stat.totalHits === 0) {
    // 0 hits in dataset: lock to 0 unless clear domain rule
    minVal[i] = 0;
    maxVal[i] = 0;
  }
});

// Run Coordinate Descent with multiple random restarts
console.log('Starting Coordinate Descent Optimizer...');

let globalBestWeights = new Array(N).fill(0);
let globalBestEval = evaluate(globalBestWeights);
console.log('Starting All-Zeros Cost:', globalBestEval);

const NUM_RESTARTS = 30;
for (let restart = 0; restart < NUM_RESTARTS; restart++) {
  // Initialize weights: either all zeros or warm start
  const currentWeights = new Array(N).fill(0);

  // In some restarts, seed with statistical priors
  if (restart > 0) {
    detailedStats.forEach((stat: any) => {
      const i = stat.index;
      if (Math.random() > 0.4) {
        if (stat.recommendation === 'STRONG_BONUS') currentWeights[i] = 15;
        else if (stat.recommendation === 'MODERATE_BONUS') currentWeights[i] = 10;
        else if (stat.recommendation === 'SLIGHT_BONUS') currentWeights[i] = 5;
        else if (stat.recommendation === 'STRONG_PENALTY') currentWeights[i] = -15;
        else if (stat.recommendation === 'MODERATE_PENALTY') currentWeights[i] = -10;
        else if (stat.recommendation === 'SLIGHT_PENALTY') currentWeights[i] = -5;
      }
    });
  }

  let currentEval = evaluate(currentWeights);
  let improved = true;
  let iterations = 0;

  while (improved && iterations < 15) {
    improved = false;
    iterations++;

    // Randomize rule order to prevent ordering bias
    const indices = Array.from({ length: N }, (_, i) => i).sort(() => Math.random() - 0.5);

    for (const i of indices) {
      if (minVal[i] === 0 && maxVal[i] === 0) continue; // locked rule

      const prevW = currentWeights[i];
      let bestWForI = prevW;
      let bestCostForI = currentEval.cost;

      for (const val of ALLOWED_VALUES) {
        if (val < minVal[i] || val > maxVal[i]) continue;
        if (val === prevW) continue;

        currentWeights[i] = val;
        const ev = evaluate(currentWeights);
        if (ev.cost < bestCostForI) {
          bestCostForI = ev.cost;
          bestWForI = val;
        }
      }

      currentWeights[i] = bestWForI;
      if (bestWForI !== prevW) {
        currentEval = evaluate(currentWeights);
        improved = true;
      }
    }
  }

  if (currentEval.cost < globalBestEval.cost) {
    globalBestEval = currentEval;
    globalBestWeights = [...currentWeights];
    console.log(`[Restart ${restart+1}/${NUM_RESTARTS}] NEW BEST COST: ${globalBestEval.cost} | Top10 Losses: ${globalBestEval.top10_losses} | Top20 Losses: ${globalBestEval.top20_losses} | Top30 Losses: ${globalBestEval.top30_losses} | 1st Loss Rank: #${globalBestEval.firstLossRank} | NonZero: ${globalBestEval.nonZeroCount}`);
  }
}

console.log('\n--- OPTIMIZATION COMPLETE ---');
console.log('Final Best Evaluation:', globalBestEval);

// Save best weights
const resultOutput = rulesCatalog.map((r: any, idx: number) => ({
  index: idx,
  description: r.description,
  oldPoints: r.currentPoints,
  newPoints: globalBestWeights[idx],
  mfavHits: r.mfavHits,
  drawHits: r.drawHits,
  udHits: r.udHits,
  totalHits: r.totalHits
}));

fs.writeFileSync(`${outDir}\\optimized_candidate_weights.json`, JSON.stringify(resultOutput, null, 2));

console.log('\nTop 25 Changed Non-Zero Rules:');
resultOutput.filter(r => r.newPoints !== 0).slice(0, 25).forEach(r => {
  console.log(`[#${r.index}] ${r.description}: ${r.newPoints} pts (old: ${r.oldPoints}) [Mfav:${r.mfavHits}, Loss:${r.drawHits+r.udHits}]`);
});
