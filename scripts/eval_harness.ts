import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\best_bet_rules_catalog.json`, 'utf8'));
const matchesMatrix = JSON.parse(fs.readFileSync(`${outDir}\\best_bet_matches_matrix.json`, 'utf8'));

interface MatchRecord {
  id: string | number;
  teams: string;
  result: string;
  actual: string;
  mFav: string;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  basePoints: number;
  triggeredRuleIndices: number[];
}

const matches: MatchRecord[] = matchesMatrix;
const N_RULES = rulesCatalog.length; // 125

export interface EvalResult {
  top10: { total: number; mfav: number; draw: number; ud: number; mfavPct: number };
  top20: { total: number; mfav: number; draw: number; ud: number; mfavPct: number };
  top30: { total: number; mfav: number; draw: number; ud: number; mfavPct: number };
  firstLossRank: number; // 1-based rank of the first draw or underdog
  lossCountInTop20: number;
  lossCountInTop30: number;
  scoreGapTop10VsLoss: number; // minimum score of top 10 Mfav minus highest score of any loss
}

export function evaluateWeights(weights: number[]): EvalResult {
  const scored = matches.map(m => {
    let score = m.basePoints;
    for (const rIdx of m.triggeredRuleIndices) {
      score += weights[rIdx] || 0;
    }
    return { outcome: m.outcome, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  const getStats = (slice: typeof scored) => {
    let mfav = 0, draw = 0, ud = 0;
    for (const item of slice) {
      if (item.outcome === 'MFAV') mfav++;
      else if (item.outcome === 'DRAW') draw++;
      else ud++;
    }
    return { total: slice.length, mfav, draw, ud, mfavPct: (mfav / slice.length) * 100 };
  };

  const top10 = getStats(scored.slice(0, 10));
  const top20 = getStats(scored.slice(0, 20));
  const top30 = getStats(scored.slice(0, 30));

  let firstLossRank = scored.length + 1;
  let highestLossScore = -Infinity;
  for (let i = 0; i < scored.length; i++) {
    if (scored[i].outcome !== 'MFAV') {
      if (firstLossRank > scored.length) firstLossRank = i + 1;
      if (scored[i].score > highestLossScore) highestLossScore = scored[i].score;
    }
  }

  const tenthMfavScore = scored[9]?.score ?? 0;

  return {
    top10,
    top20,
    top30,
    firstLossRank,
    lossCountInTop20: top20.draw + top20.ud,
    lossCountInTop30: top30.draw + top30.ud,
    scoreGapTop10VsLoss: tenthMfavScore - highestLossScore
  };
}

// Check baseline with current weights
const currentWeights = rulesCatalog.map((r: any) => r.currentPoints);
console.log('--- CURRENT BASELINE ---');
console.log(evaluateWeights(currentWeights));

// Check all zero weights
const zeroWeights = new Array(N_RULES).fill(0);
console.log('--- ALL ZERO WEIGHTS ---');
console.log(evaluateWeights(zeroWeights));
