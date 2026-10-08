import { getOptimizedScoreDetailed } from '../src/utils/optimizedweights.js';
import fs from 'fs';

const liveMatches = JSON.parse(fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_upsets_matches.json', 'utf8'));

const brighton = liveMatches.find((m: any) => m.teams.toLowerCase().includes('brighton') || m.teams.toLowerCase().includes('arsenal'));

if (brighton) {
  console.log("Found Brighton match:", brighton.teams, brighton.result);
  const detailed = getOptimizedScoreDetailed(brighton, 'upsets', {});
  console.log("Total score:", detailed.totalScore);
  console.log("Base points:", detailed.basePoints);
  console.log("Rules hit:");
  detailed.rulesHit.forEach((r: any) => console.log(`  ${r.points > 0 ? '+' : ''}${r.points}: ${r.description}`));
} else {
  console.log("Brighton not found in combined_upsets_matches.json");
}
