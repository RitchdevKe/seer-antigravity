import { getOptimizedScoreDetailed } from '../src/utils/optimizedweights.js';
import fs from 'fs';

const liveMatches = JSON.parse(fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_upsets_matches.json', 'utf8'));

const arkonia = liveMatches.find((m: any) => m.teams.includes('Arkonia'));
if (arkonia) {
  const detailed = getOptimizedScoreDetailed(arkonia.match || arkonia, 'upsets', {});
  console.log("Arkonia totalScore:", detailed.totalScore);
  detailed.rulesHit.forEach((r: any) => console.log(`  ${r.points > 0 ? '+' : ''}${r.points}: ${r.description}`));
}

const touring = liveMatches.find((m: any) => m.teams.includes('Touring'));
if (touring) {
  const detailed = getOptimizedScoreDetailed(touring.match || touring, 'upsets', {});
  console.log("\nTouring totalScore:", detailed.totalScore);
  detailed.rulesHit.forEach((r: any) => console.log(`  ${r.points > 0 ? '+' : ''}${r.points}: ${r.description}`));
}
