import fs from 'fs';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { getMarketFavorite, getOptimizedScoreDetailed, getOptimizedBaseWeight, CODE_DEFAULT_CATEGORY_SETTINGS } from '../src/utils/optimizedweights';
import { getMatchEvaluatorTags } from '../src/utils/matchEvaluator';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\live_matches_dump.json';
const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const liveMatches: Match[] = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const phaStatsMap = {};
const matchStars = {};

const categoryMatches = liveMatches.filter(m => {
  const tags = m.evaluatorTags && m.evaluatorTags.length > 0 
    ? m.evaluatorTags 
    : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
  return tags.some(t => t.startsWith('top10:'));
});

const completed = categoryMatches.filter(m => {
  const actual = getActualResult(m.result || '');
  return actual === '1' || actual === 'X' || actual === '2';
});

// 1. Native catalog (80 rules)
const nativeRules = CODE_DEFAULT_CATEGORY_SETTINGS.top_10_value.rules;
const augmentedCatalog: Array<{ index: number; description: string; currentPoints: number; isBorrowed?: boolean }> = [];

nativeRules.forEach((r, idx) => {
  augmentedCatalog.push({
    index: idx,
    description: r.description,
    currentPoints: r.points,
    isBorrowed: false
  });
});

// 2. Borrowed rules from BB, BDL, BJ
const borrowedRulesToAdd = [
  { description: "Synergy: Both TS <= 1.0 + Pred 1X2 on M.fav", currentPoints: 0 },
  { description: "1X2 Rating =>7", currentPoints: 0 },
  { description: "Mfav GS - Ud GS >= 1.0", currentPoints: 0 },
  { description: "LE was a draw+Underdog has hidden strength/weakness", currentPoints: 0 },
  { description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", currentPoints: 0 },
  { description: "LE was a draw+ Mfav GA and GS =>1.8", currentPoints: 0 },
  { description: "Both teams GA > GS and Both team GS <=1.0", currentPoints: 0 },
  { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", currentPoints: 0 },
  { description: "Underdog was away on LE (Last encounter) and Won", currentPoints: 0 },
  { description: "LE was a draw+1X2R <= 2.5", currentPoints: 0 },
  { description: "Away favorite + Mfav GA <= 1.0 & Ud GA > 1.0", currentPoints: 0 },
  { description: "Mfav GS =>1.8 and GA =<1.0", currentPoints: 0 }
];

borrowedRulesToAdd.forEach(br => {
  if (!augmentedCatalog.some(r => r.description === br.description)) {
    augmentedCatalog.push({
      index: augmentedCatalog.length,
      description: br.description,
      currentPoints: br.currentPoints,
      isBorrowed: true
    });
  }
});

const descToIndex = new Map<string, number>();
augmentedCatalog.forEach(c => descToIndex.set(c.description, c.index));

const augmentedMatrix: Array<{
  id: string | number;
  teams: string;
  result: string;
  actual: string;
  mFav: string;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  basePoints: number;
  triggeredIndices: number[];
  triggeredDescriptions: string[];
}> = [];

completed.forEach(match => {
  const actual = getActualResult(match.result || '');
  const mFav = getMarketFavorite(match);
  const outcome = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
  const baseInfo = getOptimizedBaseWeight(match, phaStatsMap, 'top_10_value');

  const top12Detail = getOptimizedScoreDetailed(match, 'top_10_value', phaStatsMap);
  const bbDetail = getOptimizedScoreDetailed(match, 'best_bet', phaStatsMap);
  const bdlDetail = getOptimizedScoreDetailed(match, 'bankers_dlive', phaStatsMap);
  const bjDetail = getOptimizedScoreDetailed(match, 'bankers_jackpot', phaStatsMap);

  const triggeredSet = new Set<string>();
  top12Detail.rulesHit.forEach(h => triggeredSet.add(h.description));

  const checkBorrowed = (hits: Array<{ description: string }>) => {
    hits.forEach(h => {
      if (borrowedRulesToAdd.some(b => b.description === h.description)) {
        triggeredSet.add(h.description);
      }
    });
  };

  checkBorrowed(bbDetail.rulesHit);
  checkBorrowed(bdlDetail.rulesHit);
  checkBorrowed(bjDetail.rulesHit);

  const indices: number[] = [];
  const descs: string[] = [];

  triggeredSet.forEach(desc => {
    const idx = descToIndex.get(desc);
    if (idx !== undefined) {
      indices.push(idx);
      descs.push(desc);
    }
  });

  indices.sort((a, b) => a - b);

  augmentedMatrix.push({
    id: match.id,
    teams: match.teams || '',
    result: match.result || '',
    actual,
    mFav,
    outcome,
    basePoints: baseInfo.points,
    triggeredIndices: indices,
    triggeredDescriptions: descs
  });
});

fs.writeFileSync(`${outDir}\\augmented_top12_catalog.json`, JSON.stringify(augmentedCatalog, null, 2));
fs.writeFileSync(`${outDir}\\augmented_top12_matrix.json`, JSON.stringify(augmentedMatrix, null, 2));

console.log(`Augmented Top 12 catalog has ${augmentedCatalog.length} rules (${nativeRules.length} native + ${augmentedCatalog.length - nativeRules.length} borrowed).`);
console.log(`Augmented Top 12 matrix has ${augmentedMatrix.length} matches.`);
