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

console.log(`Extracted ${completed.length} completed Top 12 matches.`);

const catalog = CODE_DEFAULT_CATEGORY_SETTINGS.top_10_value.rules.map((r, index) => ({
  index,
  description: r.description,
  currentPoints: r.points
}));

fs.writeFileSync(`${outDir}\\top12_rules_catalog.json`, JSON.stringify(catalog, null, 2));

const descToIndex = new Map<string, number>();
catalog.forEach(c => descToIndex.set(c.description, c.index));

// For each match, compute base weight and triggered rules
const matchDataList: any[] = [];
const ruleStats = catalog.map(c => ({
  index: c.index,
  description: c.description,
  currentPoints: c.currentPoints,
  totalHits: 0,
  mfavHits: 0,
  drawHits: 0,
  udHits: 0,
  mfavPct: 0,
  drawPct: 0,
  udPct: 0,
  hedged1XPct: 0
}));

completed.forEach(match => {
  const actual = getActualResult(match.result || '');
  const mFav = getMarketFavorite(match);
  const outcome = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
  const baseInfo = getOptimizedBaseWeight(match, phaStatsMap, 'top_10_value');
  const detail = getOptimizedScoreDetailed(match, 'top_10_value', phaStatsMap);

  const triggeredIndices: number[] = [];
  const triggeredDescs: string[] = [];

  detail.rulesHit.forEach(h => {
    const idx = descToIndex.get(h.description);
    if (idx !== undefined) {
      if (!triggeredIndices.includes(idx)) {
        triggeredIndices.push(idx);
        triggeredDescs.push(h.description);
      }
    }
  });

  triggeredIndices.sort((a, b) => a - b);

  triggeredIndices.forEach(idx => {
    ruleStats[idx].totalHits++;
    if (outcome === 'MFAV') ruleStats[idx].mfavHits++;
    else if (outcome === 'DRAW') ruleStats[idx].drawHits++;
    else ruleStats[idx].udHits++;
  });

  matchDataList.push({
    id: match.id,
    teams: match.teams,
    result: match.result,
    actual,
    mFav,
    outcome,
    basePoints: baseInfo.points,
    currentScore: detail.totalScore,
    triggeredIndices,
    triggeredDescriptions: triggeredDescs
  });
});

ruleStats.forEach(rs => {
  if (rs.totalHits > 0) {
    rs.mfavPct = Number(((rs.mfavHits / rs.totalHits) * 100).toFixed(1));
    rs.drawPct = Number(((rs.drawHits / rs.totalHits) * 100).toFixed(1));
    rs.udPct = Number(((rs.udHits / rs.totalHits) * 100).toFixed(1));
    rs.hedged1XPct = Number((((rs.mfavHits + rs.drawHits) / rs.totalHits) * 100).toFixed(1));
  }
});

fs.writeFileSync(`${outDir}\\top12_matches_matrix.json`, JSON.stringify(matchDataList, null, 2));
fs.writeFileSync(`${outDir}\\top12_detailed_stats.json`, JSON.stringify(ruleStats, null, 2));

console.log(`Saved top12_rules_catalog.json (80 rules), top12_matches_matrix.json (${matchDataList.length} matches), top12_detailed_stats.json`);
