import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const matrix: Array<{
  id: string | number;
  teams: string;
  result: string;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  basePoints: number;
  triggeredIndices: number[];
  triggeredDescriptions: string[];
}> = JSON.parse(fs.readFileSync(`${outDir}\\augmented_top12_matrix.json`, 'utf8'));

const catalog: Array<{ index: number; description: string; currentPoints: number; isBorrowed?: boolean }> = JSON.parse(
  fs.readFileSync(`${outDir}\\augmented_top12_catalog.json`, 'utf8')
);

// Read settings block to parse point mappings
const settingsContent = fs.readFileSync(`${outDir}\\top12_settings_block.txt`, 'utf8');
const regex = /description:\s*"([^"]+)",\s*points:\s*(-?\d+)/g;
const pointMap: Record<string, number> = {};
let match;
while ((match = regex.exec(settingsContent)) !== null) {
  pointMap[match[1]] = parseInt(match[2], 10);
}

console.log(`Parsed ${Object.keys(pointMap).length} rules from settings block.`);

const scored = matrix.map(m => {
  let score = m.basePoints;
  for (const desc of m.triggeredDescriptions) {
    if (pointMap[desc] !== undefined) {
      score += pointMap[desc];
    }
  }
  return {
    id: m.id,
    teams: m.teams,
    result: m.result,
    outcome: m.outcome,
    score
  };
});

scored.sort((a, b) => b.score - a.score);

const calc = (slice: any[]) => {
  const mfav = slice.filter(x => x.outcome === 'MFAV').length;
  const draw = slice.filter(x => x.outcome === 'DRAW').length;
  const ud = slice.filter(x => x.outcome === 'UNDERDOG').length;
  return {
    total: slice.length,
    mfav,
    draw,
    ud,
    mfavPct: ((mfav / slice.length) * 100).toFixed(1) + '%',
    hedged1XPct: (((mfav + draw) / slice.length) * 100).toFixed(1) + '%'
  };
};

const top12 = calc(scored.slice(0, 12));
const top20 = calc(scored.slice(0, 20));
const top30 = calc(scored.slice(0, 30));

let cleanStreak1X = 0;
for (const m of scored) {
  if (m.outcome === 'MFAV' || m.outcome === 'DRAW') cleanStreak1X++;
  else break;
}

const firstUd = scored.find(m => m.outcome === 'UNDERDOG');
const firstUdRank = firstUd ? scored.findIndex(m => m.id === firstUd.id) + 1 : -1;

const top12MinScore = scored[11].score;
const maxUdScore = firstUd ? firstUd.score : 0;
const bufferGap = top12MinScore - maxUdScore;

console.log(`\n================== VERIFIED SETTINGS EVALUATION ==================`);
console.log('Top 12:', top12);
console.log('Top 20:', top20);
console.log('Top 30:', top30);
console.log(`Clean 1X Hedged Streak: ${cleanStreak1X}`);
console.log(`First Underdog Loss Rank: #${firstUdRank} (${firstUd?.teams}, ${firstUd?.result}, ${firstUd?.score} pts)`);
console.log(`Score Cushion Gap (Top 12 Min [${top12MinScore} pts] vs Max Underdog Loss [${maxUdScore} pts]): +${bufferGap} pts`);

console.log('\nTop 15 Selections:');
scored.slice(0, 15).forEach((m, idx) => {
  console.log(`#${idx + 1} [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});
