import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_rules_catalog.json`, 'utf8'));
const matchesMatrix = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_matches_matrix.json`, 'utf8'));

export interface MetricSummary {
  total: number;
  mfav: number;
  draw: number;
  ud: number;
  mfavPct: number;
}

export interface EvalResult {
  top10: MetricSummary;
  top20: MetricSummary;
  top30: MetricSummary;
  firstLossRank: number;
  lossCountInTop20: number;
  lossCountInTop30: number;
  scoreGapTop10VsLoss: number;
}

export function evaluateBankersDliveWeights(weights: number[]): EvalResult {
  const scored = matchesMatrix.map((m: any) => {
    let score = m.basePoints;
    for (const ruleIdx of m.triggeredRuleIndices) {
      if (ruleIdx < weights.length) {
        score += weights[ruleIdx];
      }
    }
    return {
      ...m,
      score
    };
  });

  // Sort descending by score
  scored.sort((a: any, b: any) => b.score - a.score);

  const calcSlice = (slice: any[]): MetricSummary => {
    const total = slice.length;
    const mfav = slice.filter((x: any) => x.outcome === 'MFAV').length;
    const draw = slice.filter((x: any) => x.outcome === 'DRAW').length;
    const ud = slice.filter((x: any) => x.outcome === 'UNDERDOG').length;
    return {
      total,
      mfav,
      draw,
      ud,
      mfavPct: total > 0 ? (mfav / total) * 100 : 0
    };
  };

  const top10 = calcSlice(scored.slice(0, 10));
  const top20 = calcSlice(scored.slice(0, 20));
  const top30 = calcSlice(scored.slice(0, 30));

  const firstLossIdx = scored.findIndex((x: any) => x.outcome !== 'MFAV');
  const firstLossRank = firstLossIdx === -1 ? 999 : firstLossIdx + 1;

  const lossCountInTop20 = top20.draw + top20.ud;
  const lossCountInTop30 = top30.draw + top30.ud;

  const minTop10Score = scored.length >= 10 ? scored[9].score : 0;
  const highestLossScore = firstLossIdx !== -1 ? scored[firstLossIdx].score : -999;
  const scoreGapTop10VsLoss = minTop10Score - highestLossScore;

  return {
    top10,
    top20,
    top30,
    firstLossRank,
    lossCountInTop20,
    lossCountInTop30,
    scoreGapTop10VsLoss
  };
}

// Check baseline with current weights
const currentWeights = rulesCatalog.map((r: any) => r.currentPoints);
console.log('--- CURRENT BANKERS DLIVE BASELINE ---');
console.log(evaluateBankersDliveWeights(currentWeights));

// Check zero weights
const zeroWeights = new Array(rulesCatalog.length).fill(0);
console.log('--- ALL ZERO WEIGHTS BASELINE ---');
console.log(evaluateBankersDliveWeights(zeroWeights));
