import fs from 'fs';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { 
  getMarketFavorite, 
  getOptimizedScoreDetailed, 
  CODE_DEFAULT_CATEGORY_SETTINGS,
  getOptimizedBaseWeight 
} from '../src/utils/optimizedweights';
import { getMatchEvaluatorTags } from '../src/utils/matchEvaluator';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\live_matches_dump.json';
const liveMatches: Match[] = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const phaStatsMap = {};
const matchStars = {};

const categoryMatches = liveMatches.filter(m => {
  const tags = m.evaluatorTags && m.evaluatorTags.length > 0 
    ? m.evaluatorTags 
    : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
  return tags.some(t => t.startsWith('bankers_jackpot:'));
});

const completed = categoryMatches.filter(m => {
  const actual = getActualResult(m.result || '');
  return actual === '1' || actual === 'X' || actual === '2';
});

console.log(`Total bankers_jackpot matches in dump: ${categoryMatches.length}, completed: ${completed.length}`);

const outcomeCounts = { MFAV: 0, DRAW: 0, UNDERDOG: 0 };
completed.forEach(m => {
  const actual = getActualResult(m.result || '');
  const mFav = getMarketFavorite(m);
  const outcome = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
  outcomeCounts[outcome]++;
});
console.log('Outcome distribution:', outcomeCounts);
console.log(`Mfav Win Rate: ${((outcomeCounts.MFAV / completed.length) * 100).toFixed(1)}%`);
console.log(`Draw Rate: ${((outcomeCounts.DRAW / completed.length) * 100).toFixed(1)}%`);
console.log(`Underdog Loss Rate: ${((outcomeCounts.UNDERDOG / completed.length) * 100).toFixed(1)}%`);

// Collect rules from CODE_DEFAULT_CATEGORY_SETTINGS['bankers_jackpot'].rules
const defaultRules = [...CODE_DEFAULT_CATEGORY_SETTINGS['bankers_jackpot'].rules];

// Also collect any rule that triggers during detailed evaluation
const allTriggeredDescs = new Set<string>();
completed.forEach(m => {
  const detail = getOptimizedScoreDetailed(m, 'bankers_jackpot', phaStatsMap);
  detail.rulesHit.forEach(hit => {
    allTriggeredDescs.add(hit.description);
  });
});

console.log(`Rules in default settings: ${defaultRules.length}`);
console.log(`Unique rules triggered across completed matches: ${allTriggeredDescs.size}`);

// Combine default settings rules + any triggered rule missing from settings
const unifiedRules: Array<{ description: string; points: number }> = [...defaultRules];
allTriggeredDescs.forEach(desc => {
  if (!unifiedRules.some(r => r.description === desc)) {
    unifiedRules.push({ description: desc, points: 0 });
  }
});
console.log(`Total unified rules catalog size: ${unifiedRules.length}`);

const ruleDescToIndex = new Map<string, number>();
const rulesCatalog = unifiedRules.map((r, idx) => {
  ruleDescToIndex.set(r.description, idx);
  return {
    index: idx,
    description: r.description,
    currentPoints: r.points,
    mfavHits: 0,
    drawHits: 0,
    udHits: 0,
    totalHits: 0,
    mfavWinRate: 0
  };
});

const matchesMatrix: Array<{
  id: string | number;
  teams: string;
  result: string;
  actual: string;
  mFav: string;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  basePoints: number;
  currentTotalScore: number;
  triggeredRuleIndices: number[];
  triggeredRuleDescriptions: string[];
}> = [];

completed.forEach(match => {
  const actual = getActualResult(match.result || '');
  const mFav = getMarketFavorite(match);
  const outcome = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
  const baseInfo = getOptimizedBaseWeight(match, phaStatsMap, 'bankers_jackpot');
  const detail = getOptimizedScoreDetailed(match, 'bankers_jackpot', phaStatsMap);

  const triggeredIndices: number[] = [];
  const triggeredDescs: string[] = [];

  const seen = new Set<string>();
  detail.rulesHit.forEach(hit => {
    if (seen.has(hit.description)) return;
    seen.add(hit.description);

    const idx = ruleDescToIndex.get(hit.description);
    if (idx !== undefined) {
      triggeredIndices.push(idx);
      triggeredDescs.push(hit.description);

      const cat = rulesCatalog[idx];
      cat.totalHits++;
      if (outcome === 'MFAV') cat.mfavHits++;
      else if (outcome === 'DRAW') cat.drawHits++;
      else cat.udHits++;
    } else {
      console.warn('Unknown rule triggered in bankers_jackpot:', hit.description);
    }
  });

  matchesMatrix.push({
    id: match.id,
    teams: match.teams || '',
    result: match.result || '',
    actual,
    mFav,
    outcome,
    basePoints: baseInfo.points,
    currentTotalScore: detail.totalScore,
    triggeredRuleIndices: triggeredIndices.sort((a, b) => a - b),
    triggeredRuleDescriptions: triggeredDescs
  });
});

rulesCatalog.forEach(r => {
  r.mfavWinRate = r.totalHits > 0 ? parseFloat(((r.mfavHits / r.totalHits) * 100).toFixed(1)) : 0;
});

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
fs.writeFileSync(`${outDir}\\bankers_jackpot_rules_catalog.json`, JSON.stringify(rulesCatalog, null, 2));
fs.writeFileSync(`${outDir}\\bankers_jackpot_matches_matrix.json`, JSON.stringify(matchesMatrix, null, 2));

console.log(`Exported exactly ${rulesCatalog.length} rules and ${matchesMatrix.length} matches to ${outDir}`);

// Current tuning ranking check
matchesMatrix.sort((a, b) => b.currentTotalScore - a.currentTotalScore);
const calcTop = (list: typeof matchesMatrix) => {
  const mfav = list.filter(m => m.outcome === 'MFAV').length;
  const draw = list.filter(m => m.outcome === 'DRAW').length;
  const ud = list.filter(m => m.outcome === 'UNDERDOG').length;
  return { total: list.length, mfav, draw, ud, pct: ((mfav / list.length) * 100).toFixed(1) + '%' };
};

console.log('\n--- CURRENT PERFORMANCE UNDER EXISTING SETTINGS ---');
console.log('Top 10:', calcTop(matchesMatrix.slice(0, 10)));
console.log('Top 20:', calcTop(matchesMatrix.slice(0, 20)));
console.log('Top 30:', calcTop(matchesMatrix.slice(0, 30)));

console.log('\nTop 15 Matches currently:');
matchesMatrix.slice(0, 15).forEach((m, idx) => {
  console.log(`#${idx + 1} [${m.currentTotalScore} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});
