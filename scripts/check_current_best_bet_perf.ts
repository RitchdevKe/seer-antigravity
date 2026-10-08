import fs from 'fs';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { getMarketFavorite, getOptimizedScoreDetailed } from '../src/utils/optimizedweights';
import { getMatchEvaluatorTags } from '../src/utils/matchEvaluator';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\live_matches_dump.json';
const liveMatches: Match[] = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const phaStatsMap = {};
const matchStars = {};

const categoryMatches = liveMatches.filter(m => {
  const tags = m.evaluatorTags && m.evaluatorTags.length > 0 
    ? m.evaluatorTags 
    : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
  return tags.some(t => t.startsWith('best_bet:'));
});

const completed = categoryMatches.filter(m => {
  const actual = getActualResult(m.result || '');
  return actual === '1' || actual === 'X' || actual === '2';
});

const scoredMatches = completed.map(m => {
  const actual = getActualResult(m.result || '');
  const mFav = getMarketFavorite(m);
  const outcome = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
  const detail = getOptimizedScoreDetailed(m, 'best_bet', phaStatsMap);
  return {
    id: m.id,
    teams: m.teams,
    mFav,
    result: m.result,
    actual,
    outcome,
    score: detail.totalScore,
    rulesHitCount: detail.rulesHit.length
  };
});

// Sort by score descending
scoredMatches.sort((a, b) => b.score - a.score);

console.log('--- CURRENT BEST BET RANKING ANALYSIS ---');
const top10 = scoredMatches.slice(0, 10);
const top20 = scoredMatches.slice(0, 20);
const top30 = scoredMatches.slice(0, 30);

const calcStats = (slice: typeof scoredMatches) => {
  const mfav = slice.filter(s => s.outcome === 'MFAV').length;
  const draw = slice.filter(s => s.outcome === 'DRAW').length;
  const ud = slice.filter(s => s.outcome === 'UNDERDOG').length;
  return { total: slice.length, mfav, draw, ud, mfavPct: ((mfav / slice.length) * 100).toFixed(1) };
};

console.log('Top 10:', calcStats(top10));
console.log('Top 20:', calcStats(top20));
console.log('Top 30:', calcStats(top30));
console.log('All 111:', calcStats(scoredMatches));

console.log('\nTop 15 Matches:');
scoredMatches.slice(0, 15).forEach((m, idx) => {
  console.log(`#${idx + 1} [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});
