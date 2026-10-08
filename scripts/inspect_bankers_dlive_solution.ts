import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_rules_catalog.json`, 'utf8'));
const optWeights = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_optimized_weights.json`, 'utf8'));
const stats = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_detailed_stats.json`, 'utf8'));

const activeRules: any[] = [];
rulesCatalog.forEach((r: any, idx: number) => {
  const w = optWeights[idx];
  const st = stats[idx];
  if (w !== 0 || r.currentPoints !== 0) {
    activeRules.push({
      idx,
      desc: r.description,
      oldPts: r.currentPoints,
      newPts: w,
      hits: st.totalHits,
      mfav: st.mfavHits,
      draw: st.drawHits,
      ud: st.udHits,
      winRate: st.winRate,
      drawRate: st.drawRate,
      udRate: st.udRate
    });
  }
});

console.log(`Total active/modified rules: ${activeRules.length}`);

console.log('\n--- POSITIVE BONUSES (w > 0) ---');
activeRules.filter(r => r.newPts > 0).forEach(r => {
  console.log(`[#${r.idx}] "${r.desc}": ${r.oldPts} -> +${r.newPts} (Hits: ${r.hits} [W:${r.mfav} D:${r.draw} L:${r.ud}], WinRate: ${r.winRate}%)`);
});

console.log('\n--- NEGATIVE PENALTIES (w < 0) ---');
activeRules.filter(r => r.newPts < 0).forEach(r => {
  console.log(`[#${r.idx}] "${r.desc}": ${r.oldPts} -> ${r.newPts} (Hits: ${r.hits} [W:${r.mfav} D:${r.draw} L:${r.ud}], WinRate: ${r.winRate}%, DrawRate: ${r.drawRate}%, UdRate: ${r.udRate}%)`);
});

console.log('\n--- ZEROED RULES (was non-zero -> 0) ---');
activeRules.filter(r => r.newPts === 0 && r.oldPts !== 0).forEach(r => {
  console.log(`[#${r.idx}] "${r.desc}": ${r.oldPts} -> 0 (Hits: ${r.hits} [W:${r.mfav} D:${r.draw} L:${r.ud}])`);
});
