import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
export const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\bankers_jackpot_rules_catalog.json`, 'utf8'));
export const matchesMatrix = JSON.parse(fs.readFileSync(`${outDir}\\bankers_jackpot_matches_matrix.json`, 'utf8'));

export interface EvalSummary {
  top10: { total: number; mfav: number; draw: number; ud: number; winRate: number };
  top20: { total: number; mfav: number; draw: number; ud: number; winRate: number };
  top30: { total: number; mfav: number; draw: number; ud: number; winRate: number };
  firstFailureRank: number;
  minTop10Score: number;
  maxFailureScore: number;
  scoreGap: number;
  cleanStreak: number;
  sortedMatches: Array<{
    id: string | number;
    teams: string;
    result: string;
    actual: string;
    mFav: string;
    outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
    totalScore: number;
  }>;
}

export function evaluateCandidateWeights(weights: number[]): EvalSummary {
  const scored = matchesMatrix.map((m: any) => {
    let score = m.basePoints;
    for (const ruleIdx of m.triggeredRuleIndices) {
      if (ruleIdx < weights.length) {
        score += weights[ruleIdx];
      }
    }
    return {
      id: m.id,
      teams: m.teams,
      result: m.result,
      actual: m.actual,
      mFav: m.mFav,
      outcome: m.outcome,
      totalScore: score
    };
  });

  // Sort by totalScore descending
  scored.sort((a: any, b: any) => b.totalScore - a.totalScore);

  const calcStats = (slice: any[]) => {
    const mfav = slice.filter(x => x.outcome === 'MFAV').length;
    const draw = slice.filter(x => x.outcome === 'DRAW').length;
    const ud = slice.filter(x => x.outcome === 'UNDERDOG').length;
    return {
      total: slice.length,
      mfav,
      draw,
      ud,
      winRate: slice.length > 0 ? parseFloat(((mfav / slice.length) * 100).toFixed(1)) : 0
    };
  };

  const top10 = calcStats(scored.slice(0, 10));
  const top20 = calcStats(scored.slice(0, 20));
  const top30 = calcStats(scored.slice(0, 30));

  let firstFailureRank = scored.findIndex((x: any) => x.outcome !== 'MFAV') + 1;
  if (firstFailureRank === 0) firstFailureRank = scored.length + 1;

  let cleanStreak = 0;
  for (const m of scored) {
    if (m.outcome === 'MFAV') cleanStreak++;
    else break;
  }

  const top10Matches = scored.slice(0, 10);
  const minTop10Score = top10Matches.length > 0 ? top10Matches[top10Matches.length - 1].totalScore : 0;

  const failures = scored.filter((x: any) => x.outcome !== 'MFAV');
  const maxFailureScore = failures.length > 0 ? failures[0].totalScore : 0;
  const scoreGap = minTop10Score - maxFailureScore;

  return {
    top10,
    top20,
    top30,
    firstFailureRank,
    minTop10Score,
    maxFailureScore,
    scoreGap,
    cleanStreak,
    sortedMatches: scored
  };
}

const isDirectRun = process.argv[1] && process.argv[1].includes('bankers_jackpot_eval_harness');
if (isDirectRun) {
  const currentWeights = rulesCatalog.map((r: any) => r.currentPoints);
  const res = evaluateCandidateWeights(currentWeights);
  console.log('--- Current Weights Performance ---');
  console.log('Top 10:', res.top10);
  console.log('Top 20:', res.top20);
  console.log('Top 30:', res.top30);
  console.log('First failure rank:', res.firstFailureRank);
  console.log('Clean streak:', res.cleanStreak);
  console.log('Min Top 10 Score:', res.minTop10Score, '| Max Failure Score:', res.maxFailureScore, '| Gap:', res.scoreGap);
}
