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
  return tags.some(t => t.startsWith('top10:'));
});

const completed = categoryMatches.filter(m => {
  const actual = getActualResult(m.result || '');
  return actual === '1' || actual === 'X' || actual === '2';
});

const scored = completed.map(match => {
  const actual = getActualResult(match.result || '');
  const mFav = getMarketFavorite(match);
  const outcome = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
  const detail = getOptimizedScoreDetailed(match, 'top_10_value', phaStatsMap);
  return {
    id: match.id,
    teams: match.teams,
    result: match.result,
    actual,
    mFav,
    outcome,
    score: detail.totalScore,
    rulesHit: detail.rulesHit
  };
});

scored.sort((a, b) => b.score - a.score);

const calc = (slice: any[]) => {
  const mfav = slice.filter(x => x.outcome === 'MFAV').length;
  const draw = slice.filter(x => x.outcome === 'DRAW').length;
  const ud = slice.filter(x => x.outcome === 'UNDERDOG').length;
  const hedgedSuccess = mfav + draw;
  return {
    total: slice.length,
    mfav,
    draw,
    ud,
    mfavPct: ((mfav / slice.length) * 100).toFixed(1) + '%',
    hedgedSuccessPct: ((hedgedSuccess / slice.length) * 100).toFixed(1) + '% (1X success)'
  };
};

console.log('--- CURRENT MANUAL TUNING PERFORMANCE (TOP 12) ---');
console.log('Top 12:', calc(scored.slice(0, 12)));
console.log('Top 20:', calc(scored.slice(0, 20)));
console.log('Top 30:', calc(scored.slice(0, 30)));

console.log('\nTop 20 Matches:');
scored.slice(0, 20).forEach((m, idx) => {
  console.log(`#${idx + 1} [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});
