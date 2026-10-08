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

console.log('Total completed matches:', completed.length);

const scored = completed.map(match => {
  const actual = getActualResult(match.result || '');
  const mFav = getMarketFavorite(match);
  const outcome = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
  const detail = getOptimizedScoreDetailed(match, 'best_bet', phaStatsMap);
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

const calcStats = (list: any[]) => {
  const mfav = list.filter(m => m.outcome === 'MFAV').length;
  const draw = list.filter(m => m.outcome === 'DRAW').length;
  const ud = list.filter(m => m.outcome === 'UNDERDOG').length;
  return { total: list.length, mfav, draw, ud, mfavPct: (mfav / list.length) * 100 };
};

console.log('\n--- VERIFICATION WITH PRODUCTION src/utils/optimizedweights.ts ---');
console.log('Top 10:', calcStats(scored.slice(0, 10)));
console.log('Top 20:', calcStats(scored.slice(0, 20)));
console.log('Top 30:', calcStats(scored.slice(0, 30)));

console.log('\nTop 25 Matches:');
scored.slice(0, 25).forEach((m, idx) => {
  console.log(`#${idx + 1} [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});

console.log('\nHighest scoring non-mfav outcomes:');
scored.filter(m => m.outcome !== 'MFAV').slice(0, 5).forEach(m => {
  const rank = scored.findIndex(x => x.id === m.id) + 1;
  console.log(`Rank #${rank} [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});
