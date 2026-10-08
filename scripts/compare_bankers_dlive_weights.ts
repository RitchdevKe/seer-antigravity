import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_rules_catalog.json`, 'utf8'));
const scriptContent = fs.readFileSync('scripts/test_bankers_dlive_calibrated.ts', 'utf8');

const calibratedWeights = new Array(rulesCatalog.length).fill(0);
const lines = scriptContent.split('\n');
for (const line of lines) {
  const m = line.match(/calibratedWeights\[(\d+)\]\s*=\s*(-?\d+);/);
  if (m) {
    calibratedWeights[parseInt(m[1])] = parseInt(m[2]);
  }
}

const comparison = rulesCatalog.map((r: any, idx: number) => {
  return {
    index: idx,
    description: r.description,
    oldPoints: r.currentPoints,
    newPoints: calibratedWeights[idx],
    changed: r.currentPoints !== calibratedWeights[idx],
    totalHits: r.totalHits,
    mfavHits: r.mfavHits,
    drawHits: r.drawHits,
    udHits: r.udHits,
    winRate: r.mfavWinRate
  };
});

fs.writeFileSync(`${outDir}\\bankers_dlive_full_comparison.json`, JSON.stringify(comparison, null, 2));

const modified = comparison.filter((c: any) => c.changed);
console.log(`Total rules in catalog: ${comparison.length}`);
console.log(`Total rules modified: ${modified.length}`);
console.log(`Total active non-zero rules: ${comparison.filter((c: any) => c.newPoints !== 0).length}`);

console.log('\n--- ALL MODIFIED RULES ---');
modified.forEach((c: any) => {
  console.log(`[#${c.index}] "${c.description}": ${c.oldPoints} -> ${c.newPoints} (Hits: ${c.totalHits} [W:${c.mfavHits} D:${c.drawHits} L:${c.udHits}], WinRate: ${c.winRate}%)`);
});
