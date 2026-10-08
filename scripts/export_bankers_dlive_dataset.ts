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
  return tags.some(t => t.startsWith('bankers_dlive:'));
});

const completed = categoryMatches.filter(m => {
  const actual = getActualResult(m.result || '');
  return actual === '1' || actual === 'X' || actual === '2';
});

console.log(`Total bankers_dlive matches: ${categoryMatches.length}, completed: ${completed.length}`);

const outcomeCounts = { MFAV: 0, DRAW: 0, UNDERDOG: 0 };
completed.forEach(m => {
  const actual = getActualResult(m.result || '');
  const mFav = getMarketFavorite(m);
  const outcome = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
  outcomeCounts[outcome]++;
});
console.log('Outcome distribution:', outcomeCounts);

// Rules catalog
const defaultRules = [...CODE_DEFAULT_CATEGORY_SETTINGS['bankers_dlive'].rules];
if (!defaultRules.some(r => r.description === "HGA=AGS + Equal GS")) {
  defaultRules.push({ description: "HGA=AGS + Equal GS", points: -10 });
}

const ruleDescToIndex = new Map<string, number>();
const rulesCatalog = defaultRules.map((r, idx) => {
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
  triggeredRuleIndices: number[];
  triggeredRuleDescriptions: string[];
}> = [];

completed.forEach(match => {
  const actual = getActualResult(match.result || '');
  const mFav = getMarketFavorite(match);
  const outcome = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
  const baseInfo = getOptimizedBaseWeight(match, phaStatsMap, 'bankers_dlive');
  const detail = getOptimizedScoreDetailed(match, 'bankers_dlive', phaStatsMap);

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
      console.warn('Unknown rule triggered in bankers_dlive:', hit.description);
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
    triggeredRuleIndices: triggeredIndices.sort((a, b) => a - b),
    triggeredRuleDescriptions: triggeredDescs
  });
});

rulesCatalog.forEach(r => {
  r.mfavWinRate = r.totalHits > 0 ? parseFloat(((r.mfavHits / r.totalHits) * 100).toFixed(1)) : 0;
});

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
fs.writeFileSync(`${outDir}\\bankers_dlive_rules_catalog.json`, JSON.stringify(rulesCatalog, null, 2));
fs.writeFileSync(`${outDir}\\bankers_dlive_matches_matrix.json`, JSON.stringify(matchesMatrix, null, 2));

console.log(`Exported exactly ${rulesCatalog.length} rules and ${matchesMatrix.length} matches.`);
