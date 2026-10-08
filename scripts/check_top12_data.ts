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

console.log('Total completed matches in Top 12 (top10:):', completed.length);

let mfav = 0, draw = 0, ud = 0;
completed.forEach(m => {
  const actual = getActualResult(m.result || '');
  const fav = getMarketFavorite(m);
  if (actual === fav) mfav++;
  else if (actual === 'X') draw++;
  else ud++;
});

console.log(`Outcome breakdown:`);
console.log(`- Market Favorite (M.fav): ${mfav} (${((mfav/completed.length)*100).toFixed(1)}%)`);
console.log(`- Draw: ${draw} (${((draw/completed.length)*100).toFixed(1)}%)`);
console.log(`- Underdog Win: ${ud} (${((ud/completed.length)*100).toFixed(1)}%)`);
console.log(`- M.fav OR Draw (1X): ${mfav + draw} (${(((mfav+draw)/completed.length)*100).toFixed(1)}%)`);
console.log(`- Underdog Losses: ${ud} (${((ud/completed.length)*100).toFixed(1)}%)`);
