import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_rules_catalog.json`, 'utf8'));
const matchesMatrix = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_matches_matrix.json`, 'utf8'));
const scriptContent = fs.readFileSync('scripts/test_bankers_dlive_calibrated.ts', 'utf8');

const weights = new Array(rulesCatalog.length).fill(0);
const lines = scriptContent.split('\n');
for (const line of lines) {
  const m = line.match(/calibratedWeights\[(\d+)\]\s*=\s*(-?\d+);/);
  if (m) {
    weights[parseInt(m[1])] = parseInt(m[2]);
  }
}

const scored = matchesMatrix.map((m: any) => {
  let s = m.basePoints;
  const hits: any[] = [];
  for (const idx of m.triggeredRuleIndices) {
    s += weights[idx];
    hits.push({ idx, desc: rulesCatalog[idx].description, pts: weights[idx] });
  }
  return { ...m, score: s, hits };
});

scored.sort((a: any, b: any) => b.score - a.score);

const targetLosses = scored.slice(10, 20).filter((m: any) => m.outcome !== 'MFAV');

console.log(`Analyzing ${targetLosses.length} losses in ranks 11-20:`);
targetLosses.forEach((m: any) => {
  const rank = scored.findIndex((x: any) => x.id === m.id) + 1;
  console.log(`\nRank #${rank}: [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result}, Base: ${m.basePoints})`);
  console.log('Rules hit:');
  m.hits.forEach((h: any) => {
    console.log(`  [#${h.idx}] "${h.desc}": ${h.pts} pts`);
  });
});
