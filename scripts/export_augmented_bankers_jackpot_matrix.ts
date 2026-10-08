import fs from 'fs';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { 
  getMarketFavorite, 
  getOptimizedScoreDetailed, 
  CODE_DEFAULT_CATEGORY_SETTINGS,
  getOptimizedBaseWeight 
} from '../src/utils/optimizedweights';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\live_matches_dump.json';
const liveMatches: Match[] = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const phaStatsMap = {};

const categoryMatches = liveMatches.filter(m => {
  const tags = m.evaluatorTags || [];
  return tags.some(t => t.startsWith('bankers_jackpot:'));
});

const completed = categoryMatches.filter(m => {
  const actual = getActualResult(m.result || '');
  return actual === '1' || actual === 'X' || actual === '2';
});

console.log(`Processing ${completed.length} completed Bankers Jackpot matches for augmented matrix...`);

// Load existing 91 rules
const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const nativeCatalog: Array<{ description: string; currentPoints: number }> = JSON.parse(
  fs.readFileSync(`${outDir}\\bankers_jackpot_rules_catalog.json`, 'utf8')
);

// High-performing borrowable rules from Best Bet / Bankers Dlive
const borrowedRulesToAdd = [
  { description: "Both Teams GA > 2.0", defaultPoints: 15 },
  { description: "Mfav L10 >Underdog L10 with >2", defaultPoints: 10 },
  { description: "LE was a draw+ Mfav GA and GS =>1.8", defaultPoints: 15 },
  { description: "Synergy: TS diff >= 1.0 + Ud GA >= 2.0 + Odds Ud <= Draw", defaultPoints: 10 },
  { description: "LE, Underdog won the last encounter +Mfav L10= Und L10", defaultPoints: -20 },
  { description: "Synergy: Mfav GS - Ud GS >= 0.5 + M.fav hidden strength", defaultPoints: -20 },
  { description: "Mfav L10 > Underdog L10 with <=2 + R(1X2 rating)<3.0", defaultPoints: -15 },
  { description: "Mfav GA= Und GA (+-0.2) +Mfav TS 1.0-1.50 and Ud TS < 0.8", defaultPoints: -15 },
  { description: "Mfav GS=Underdog GS (+-0.2) + M.fav has hidden strength", defaultPoints: -15 },
];

const augmentedCatalog = [...nativeCatalog.map((r, i) => ({
  index: i,
  description: r.description,
  currentPoints: r.currentPoints,
  isBorrowed: false
}))];

borrowedRulesToAdd.forEach(br => {
  if (!augmentedCatalog.some(r => r.description === br.description)) {
    augmentedCatalog.push({
      index: augmentedCatalog.length,
      description: br.description,
      currentPoints: br.defaultPoints,
      isBorrowed: true
    });
  }
});

console.log(`Total augmented catalog size: ${augmentedCatalog.length} rules (Native: ${nativeCatalog.length}, Borrowed: ${augmentedCatalog.length - nativeCatalog.length})`);

const descToIndex = new Map<string, number>();
augmentedCatalog.forEach(r => descToIndex.set(r.description, r.index));

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
  const baseInfo = getOptimizedBaseWeight(match, phaStatsMap, 'bankers_jackpot');
  
  // Native BJ evaluation
  const bjDetail = getOptimizedScoreDetailed(match, 'bankers_jackpot', phaStatsMap);
  // BB evaluation for borrowed rules
  const bbDetail = getOptimizedScoreDetailed(match, 'best_bet', phaStatsMap);
  // BDL evaluation for borrowed rules
  const bdlDetail = getOptimizedScoreDetailed(match, 'bankers_dlive', phaStatsMap);

  const triggeredSet = new Set<string>();
  bjDetail.rulesHit.forEach(h => triggeredSet.add(h.description));
  bbDetail.rulesHit.forEach(h => {
    if (borrowedRulesToAdd.some(b => b.description === h.description)) {
      triggeredSet.add(h.description);
    }
  });
  bdlDetail.rulesHit.forEach(h => {
    if (borrowedRulesToAdd.some(b => b.description === h.description)) {
      triggeredSet.add(h.description);
    }
  });

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

fs.writeFileSync(`${outDir}\\augmented_bankers_jackpot_catalog.json`, JSON.stringify(augmentedCatalog, null, 2));
fs.writeFileSync(`${outDir}\\augmented_bankers_jackpot_matrix.json`, JSON.stringify(augmentedMatrix, null, 2));

console.log(`Saved augmented catalog and matrix to ${outDir}`);
