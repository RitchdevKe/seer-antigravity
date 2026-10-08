import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_rules_catalog.json`, 'utf8'));
const optWeights = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_optimized_weights.json`, 'utf8'));
const stats = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_detailed_stats.json`, 'utf8'));

console.log('--- POSITIVE BONUSES (w > 0) ---');
rulesCatalog.forEach((r: any, idx: number) => {
  const w = optWeights[idx];
  const st = stats[idx];
  if (w > 0) {
    console.log(`[#${idx}] "${r.description}": ${r.currentPoints} -> +${w} (Hits: ${st.totalHits} [W:${st.mfavHits} D:${st.drawHits} L:${st.udHits}], WinRate: ${st.winRate}%)`);
  }
});

console.log('\n--- NEGATIVE PENALTIES (w < 0) ---');
rulesCatalog.forEach((r: any, idx: number) => {
  const w = optWeights[idx];
  const st = stats[idx];
  if (w < 0) {
    console.log(`[#${idx}] "${r.description}": ${r.currentPoints} -> ${w} (Hits: ${st.totalHits} [W:${st.mfavHits} D:${st.drawHits} L:${st.udHits}], WinRate: ${st.winRate}%, DrawRate: ${st.drawRate}%, UdRate: ${st.udRate}%)`);
  }
});
