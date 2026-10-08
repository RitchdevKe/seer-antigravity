import fs from 'fs';
import { getOptimizedScoreDetailed } from '../src/utils/optimizedweights';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_upsets_matches.json';
const matches: any[] = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const satMatches = matches.filter(m => m.batch.includes('Saturday'));
const scored = satMatches.map(m => {
  const detail = getOptimizedScoreDetailed(m.match, 'upsets', {});
  return {
    teams: m.teams,
    result: m.result,
    outcome: m.outcome,
    totalScore: detail.totalScore,
    rulesHit: detail.rulesHit
  };
});

scored.sort((a, b) => b.totalScore - a.totalScore);

console.log('=== TOP 10 HIGHEST SCORING MATCHES ON SATURDAY (CURRENT RULES) ===');
scored.slice(0, 10).forEach((m, idx) => {
  console.log(`${idx + 1}. [${m.outcome}] ${m.teams} (${m.result}) -> ${m.totalScore} pts`);
  console.log('   Rules (' + m.rulesHit.length + '):', m.rulesHit.map(r => `${r.description} (${r.points})`).join('; '));
});

const brighton = scored.find(m => m.teams.toLowerCase().includes('brighton') || m.teams.toLowerCase().includes('arsenal'));
console.log('\nBrighton vs Arsenal position:', scored.findIndex(m => m.teams.toLowerCase().includes('brighton') || m.teams.toLowerCase().includes('arsenal')) + 1);
console.log('Brighton score:', brighton?.totalScore);
console.log('Brighton rules:', brighton?.rulesHit);
