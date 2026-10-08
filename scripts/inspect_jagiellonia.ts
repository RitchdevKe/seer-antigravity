import fs from 'fs';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { getMarketFavorite, getOptimizedScoreDetailed } from '../src/utils/optimizedweights';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\live_matches_dump.json';
const liveMatches: Match[] = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const phaStatsMap = {};
const match = liveMatches.find(m => m.teams?.includes('Jagiellonia'));

if (match) {
  const detail = getOptimizedScoreDetailed(match, 'bankers_jackpot', phaStatsMap);
  console.log('Jagiellonia match:', match.teams, match.result);
  console.log('Total Score:', detail.totalScore);
  console.log('Rules hit:', detail.rulesHit);
} else {
  console.log('Match not found');
}
