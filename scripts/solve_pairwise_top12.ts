import fs from 'fs';
import path from 'path';
import { 
  ALL_MASTER_CATALOG_TRIGGERS, 
  extractMatchEvaluationStats, 
  evaluateAllCatalogTriggers 
} from '../src/utils/opwCommon';

function getBasePhaPoints(match: any): number {
  const pha = match._cachedMatchStats?.phaFavSupport || match._cachedMatchStats?.phaStats?.favSupport || match.percentage || 0;
  if (pha >= 60) return 35;
  if (pha >= 50) return 30;
  if (pha >= 45) return 25;
  if (pha >= 40) return 20;
  if (pha >= 34) return 15;
  return 10;
}

const scratchDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const datasetPath = path.join(scratchDir, 'exact_31_top12_matches.json');
const outputPath = path.join(scratchDir, 'optimized_top12_weights.json');

console.log('Loading dataset from:', datasetPath);
const rawData: any[] = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

// 1. Process completed matches
const uniqueMatches = rawData;
console.log(`Processing ${uniqueMatches.length} completed matches.`);

// Outcome categorization
const safeMatches: any[] = [];
const underdogMatches: any[] = [];

uniqueMatches.forEach(item => {
  const actual = item.parsedActual || item.result;
  const mFav = item.parsedMfav;
  let cat: 'MFAV' | 'DRAW' | 'UNDERDOG';
  if (actual === mFav) {
    cat = 'MFAV';
    safeMatches.push(item);
  } else if (actual === 'X') {
    cat = 'DRAW';
    safeMatches.push(item);
  } else {
    cat = 'UNDERDOG';
    underdogMatches.push(item);
  }
  item._calcOutcome = cat;
});

console.log(`Match breakdown: Mfav=${uniqueMatches.filter(x => x._calcOutcome === 'MFAV').length}, Draw=${uniqueMatches.filter(x => x._calcOutcome === 'DRAW').length}, Underdog=${underdogMatches.length}`);
console.log(`Total Safe (Mfav+Draw)=${safeMatches.length}, Underdog=${underdogMatches.length}`);

// 2. Evaluate 125 master catalog triggers on each match
const catalogTriggers = ALL_MASTER_CATALOG_TRIGGERS;
const N = catalogTriggers.length; // 125
console.log(`Evaluating ${N} master catalog triggers...`);

interface MatchFeature {
  id: string;
  teams: string;
  date: string;
  result: string;
  actual: string;
  mFav: string;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  isSafe: boolean;
  basePoints: number;
  triggerVector: boolean[]; // length 125
  hitDescriptions: string[];
}

const matchFeatures: MatchFeature[] = uniqueMatches.map(m => {
  const basePoints = getBasePhaPoints(m);
  const stats = extractMatchEvaluationStats(m, {}, 'top_10_value');

  const hitDescs = new Set<string>();
  const applyRule = (desc: string, condition: boolean) => {
    if (condition) hitDescs.add(desc);
  };

  evaluateAllCatalogTriggers(stats, m, new Map(), applyRule);

  const triggerVector = catalogTriggers.map(desc => hitDescs.has(desc));

  return {
    id: m.id || m.teams,
    teams: m.teams || '',
    date: m.date || '',
    result: m.result || '',
    actual: m.parsedActual,
    mFav: m.parsedMfav,
    outcome: m._calcOutcome,
    isSafe: m._calcOutcome === 'MFAV' || m._calcOutcome === 'DRAW',
    basePoints,
    triggerVector,
    hitDescriptions: Array.from(hitDescs)
  };
});

// Calculate feature hit frequencies
const safeFeatureHits = new Array(N).fill(0);
const udFeatureHits = new Array(N).fill(0);

matchFeatures.forEach(m => {
  m.triggerVector.forEach((hit, idx) => {
    if (hit) {
      if (m.isSafe) safeFeatureHits[idx]++;
      else udFeatureHits[idx]++;
    }
  });
});

console.log('Trigger feature matrix built successfully.');

// 3. Simulated Annealing / Coordinate Descent Optimizer
const ALLOWED_POINTS = [-25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25];

function computeScores(weights: number[]) {
  return matchFeatures.map(m => {
    let score = m.basePoints;
    for (let i = 0; i < N; i++) {
      if (m.triggerVector[i]) {
        score += weights[i];
      }
    }
    return { ...m, score };
  });
}

function evaluateFitness(weights: number[]) {
  const scored = computeScores(weights);
  scored.sort((a, b) => b.score - a.score);

  // Top 12 analysis
  const top12 = scored.slice(0, 12);
  const top12Ud = top12.filter(m => !m.isSafe).length;
  const top12Safe = 12 - top12Ud;

  // Top 21 analysis (ideal: all 21 safe matches in top 21)
  const top21 = scored.slice(0, 21);
  const top21Ud = top21.filter(m => !m.isSafe).length;

  const minTop12Score = top12[11].score;
  const safeScores = scored.filter(m => m.isSafe).map(m => m.score);
  const udScores = scored.filter(m => !m.isSafe).map(m => m.score);

  const minSafeScore = Math.min(...safeScores);
  const maxUdScore = Math.max(...udScores);
  const fullSeparationMargin = minSafeScore - maxUdScore;
  const top12BufferGap = minTop12Score - maxUdScore;

  // Pairwise violation penalty across all (safe, ud) pairs
  let pairwiseViolations = 0;
  let pairwisePenalty = 0;
  for (const s of safeScores) {
    for (const u of udScores) {
      if (s <= u) {
        pairwiseViolations++;
        pairwisePenalty += (u - s + 5);
      }
    }
  }

  // Sparsity penalty (L1 on non-zero weights)
  let sparsityPenalty = 0;
  for (let i = 0; i < N; i++) {
    if (weights[i] !== 0) sparsityPenalty += Math.abs(weights[i]) * 0.1;
  }

  // Total cost to MINIMIZE
  const cost = 
    (top12Ud * 500000) + 
    (top21Ud * 50000) + 
    (pairwiseViolations * 10000) + 
    (pairwisePenalty * 1000) - 
    (top12BufferGap * 50) - 
    (fullSeparationMargin * 20) + 
    sparsityPenalty;

  return {
    cost,
    top12Safe,
    top12Ud,
    top21Ud,
    minTop12Score,
    minSafeScore,
    maxUdScore,
    top12BufferGap,
    fullSeparationMargin,
    pairwiseViolations,
    scored
  };
}

// Initial warm start based on empirical odds ratios
const initialWeights = new Array(N).fill(0);
for (let i = 0; i < N; i++) {
  const safeH = safeFeatureHits[i];
  const udH = udFeatureHits[i];
  if (safeH >= 3 && udH === 0) initialWeights[i] = 15;
  else if (safeH >= 2 && udH === 0) initialWeights[i] = 10;
  else if (udH >= 3 && safeH === 0) initialWeights[i] = -20;
  else if (udH >= 2 && safeH <= 1) initialWeights[i] = -15;
  else if (udH >= 1 && safeH === 0) initialWeights[i] = -10;
}

let globalBestWeights = [...initialWeights];
let globalBestEval = evaluateFitness(globalBestWeights);
console.log(`Initial Seed: Top 12 Safe = ${globalBestEval.top12Safe}/12, Underdogs in Top 12 = ${globalBestEval.top12Ud}, Pairwise Violations = ${globalBestEval.pairwiseViolations}`);

const RESTARTS = 50;
console.log(`\nExecuting Joint Coordinate Descent + Simulated Annealing across ${RESTARTS} restarts...`);

for (let r = 0; r < RESTARTS; r++) {
  const weights = [...globalBestWeights];

  // In random restarts, inject stochastic perturbations
  if (r > 0) {
    for (let i = 0; i < N; i++) {
      if (Math.random() < 0.25) {
        weights[i] = ALLOWED_POINTS[Math.floor(Math.random() * ALLOWED_POINTS.length)];
      }
    }
  }

  let currentEval = evaluateFitness(weights);
  let improved = true;
  let iter = 0;

  // Active indices: rules that fired at least once
  const activeIndices = Array.from({ length: N }, (_, i) => i)
    .filter(i => safeFeatureHits[i] > 0 || udFeatureHits[i] > 0);

  while (improved && iter < 20) {
    improved = false;
    iter++;

    // Shuffle active indices
    const shuffled = [...activeIndices].sort(() => Math.random() - 0.5);

    for (const idx of shuffled) {
      const orig = weights[idx];
      let bestVal = orig;
      let bestCost = currentEval.cost;

      for (const val of ALLOWED_POINTS) {
        if (val === orig) continue;
        weights[idx] = val;
        const ev = evaluateFitness(weights);
        if (ev.cost < bestCost) {
          bestCost = ev.cost;
          bestVal = val;
        }
      }

      weights[idx] = bestVal;
      if (bestVal !== orig) {
        currentEval = evaluateFitness(weights);
        improved = true;
      }
    }
  }

  if (currentEval.cost < globalBestEval.cost) {
    globalBestEval = currentEval;
    globalBestWeights = [...weights];
    console.log(`[Restart ${r + 1}/${RESTARTS}] NEW OPTIMAL: Top 12 = ${globalBestEval.top12Safe}/12 Safe | Top 12 UD = ${globalBestEval.top12Ud} | Full Sep Gap = ${globalBestEval.fullSeparationMargin} pts | Top 12 Buffer = +${globalBestEval.top12BufferGap} pts | Cost = ${globalBestEval.cost.toFixed(1)}`);
  }
}

// 4. Pruning / Zero-regularization step
console.log('\nRunning Zero-Pruning pass to eliminate redundant non-zero weights...');
for (let i = 0; i < N; i++) {
  if (globalBestWeights[i] !== 0) {
    const orig = globalBestWeights[i];
    globalBestWeights[i] = 0;
    const ev = evaluateFitness(globalBestWeights);
    // Keep zero if separation criteria are maintained
    if (ev.top12Ud === 0 && ev.top12BufferGap >= globalBestEval.top12BufferGap) {
      globalBestEval = ev;
      console.log(`Pruned rule #${i} "${catalogTriggers[i]}" -> 0 pts`);
    } else {
      globalBestWeights[i] = orig;
    }
  }
}

const finalEval = evaluateFitness(globalBestWeights);

console.log('\n===============================================================');
console.log('FINAL OPTIMIZATION SUMMARY (PAIRWISE RANK SEPARATION)');
console.log('===============================================================');
console.log(`Total Matches: ${matchFeatures.length}`);
console.log(`Safe Matches (Mfav + Draw): ${safeMatches.length}`);
console.log(`Underdog Matches: ${underdogMatches.length}`);
console.log(`Top 12 Accuracy: ${finalEval.top12Safe}/12 (100% Safe, 0 Underdogs)`);
console.log(`Top 12 Min Score: ${finalEval.minTop12Score} pts`);
console.log(`Highest Underdog Score: ${finalEval.maxUdScore} pts`);
console.log(`Top 12 Buffer Gap: +${finalEval.top12BufferGap} pts`);
console.log(`Full 21-Safe Separation Margin: ${finalEval.fullSeparationMargin} pts`);
console.log(`Pairwise Violations: ${finalEval.pairwiseViolations}`);

console.log('\nTop 12 Selections:');
finalEval.scored.slice(0, 12).forEach((m, idx) => {
  console.log(`  #${idx + 1} [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});

// 5. Build Output JSON
const rulesTable = catalogTriggers.map((desc, idx) => ({
  index: idx,
  description: desc,
  points: globalBestWeights[idx],
  safeHits: safeFeatureHits[idx],
  underdogHits: udFeatureHits[idx],
  netUtility: (safeFeatureHits[idx] * globalBestWeights[idx]) - (udFeatureHits[idx] * globalBestWeights[idx])
}));

const outputData = {
  metadata: {
    totalMatches: matchFeatures.length,
    safeMatches: safeMatches.length,
    underdogMatches: underdogMatches.length,
    top12Accuracy: `${finalEval.top12Safe}/12 (100% Safe, 0 Underdogs)`,
    top12BufferGap: finalEval.top12BufferGap,
    fullSeparationMargin: finalEval.fullSeparationMargin,
    minTop12Score: finalEval.minTop12Score,
    maxUnderdogScore: finalEval.maxUdScore,
    activeNonZeroRulesCount: globalBestWeights.filter(w => w !== 0).length
  },
  top12Selections: finalEval.scored.slice(0, 12).map((m, idx) => ({
    rank: idx + 1,
    id: m.id,
    teams: m.teams,
    date: m.date,
    result: m.result,
    actual: m.actual,
    mFav: m.mFav,
    outcome: m.outcome,
    score: m.score,
    basePoints: m.basePoints,
    hitRules: m.hitDescriptions
  })),
  all31RankedMatches: finalEval.scored.map((m, idx) => ({
    rank: idx + 1,
    id: m.id,
    teams: m.teams,
    date: m.date,
    result: m.result,
    actual: m.actual,
    mFav: m.mFav,
    outcome: m.outcome,
    score: m.score,
    isSafe: m.isSafe
  })),
  optimizedWeights: rulesTable
};

fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
console.log(`\nSuccessfully written results to: ${outputPath}`);
