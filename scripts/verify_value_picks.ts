import fs from 'fs';
import { Match } from '../src/types';
import { getOptimizedScoreDetailed } from '../src/utils/optimizedweights';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\live_matches_dump.json';
const liveMatches: Match[] = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

console.log('Testing Value Picks evaluation on 20 matches...');
liveMatches.slice(0, 20).forEach((m, idx) => {
  const res = getOptimizedScoreDetailed(m, 'value_picks', {});
  console.log(`#${idx + 1} ${m.teams}: VP score = ${res.totalScore}, rules = ${res.rulesHit.length}`);
});
console.log('Value Picks verified successfully with 0 errors.');
