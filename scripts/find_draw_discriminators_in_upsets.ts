import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const matrix: any[] = JSON.parse(fs.readFileSync(`${outDir}\\upsets_augmented_matrix.json`, 'utf8'));
const catalog: any[] = JSON.parse(fs.readFileSync(`${outDir}\\upsets_augmented_catalog.json`, 'utf8'));

console.log('=== RULE-BY-RULE RATIO: UNDERDOG WINS vs DRAWS ===');
console.log('Desc'.padEnd(65) + ' | Tot |  Ud | Drw |  Mf | Ud/Drw Ratio');
console.log('-'.repeat(110));

const ruleRatios: Array<{
  id: number;
  description: string;
  total: number;
  ud: number;
  dr: number;
  mf: number;
  udPct: number;
  drPct: number;
  ratio: number;
}> = [];

catalog.forEach(r => {
  let ud = 0, dr = 0, mf = 0;
  matrix.forEach(m => {
    if (m.triggeredRuleIds.includes(r.id)) {
      if (m.outcome === 'UNDERDOG') ud++;
      else if (m.outcome === 'DRAW') dr++;
      else mf++;
    }
  });
  const total = ud + dr + mf;
  const ratio = dr > 0 ? (ud / dr) : (ud > 0 ? 99 : 0);
  if (total >= 10) {
    ruleRatios.push({
      id: r.id,
      description: r.description,
      total,
      ud,
      dr,
      mf,
      udPct: total > 0 ? (ud / total) * 100 : 0,
      drPct: total > 0 ? (dr / total) * 100 : 0,
      ratio
    });
  }
});

// Sort by highest Ud to Draw ratio
ruleRatios.sort((a, b) => b.ratio - a.ratio);

console.log('--- TOP RULES FAVORING OUTRIGHT UNDERDOG OVER DRAW (High Ud/Draw Ratio) ---');
ruleRatios.slice(0, 15).forEach(r => {
  console.log(
    r.description.padEnd(65) + ' | ' +
    r.total.toString().padStart(3) + ' | ' +
    r.ud.toString().padStart(3) + ' | ' +
    r.dr.toString().padStart(3) + ' | ' +
    r.mf.toString().padStart(3) + ' | ' +
    r.ratio.toFixed(2).padStart(5) + ' (Ud: ' + r.udPct.toFixed(1) + '%, Dr: ' + r.drPct.toFixed(1) + '%)'
  );
});

console.log('\n--- WORST RULES FAVORING DRAW OVER UNDERDOG (Low Ud/Draw Ratio, Draw Traps) ---');
ruleRatios.slice(-15).reverse().forEach(r => {
  console.log(
    r.description.padEnd(65) + ' | ' +
    r.total.toString().padStart(3) + ' | ' +
    r.ud.toString().padStart(3) + ' | ' +
    r.dr.toString().padStart(3) + ' | ' +
    r.mf.toString().padStart(3) + ' | ' +
    r.ratio.toFixed(2).padStart(5) + ' (Ud: ' + r.udPct.toFixed(1) + '%, Dr: ' + r.drPct.toFixed(1) + '%)'
  );
});
