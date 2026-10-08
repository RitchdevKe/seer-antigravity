import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const matrix: any[] = JSON.parse(fs.readFileSync(`${outDir}\\upsets_augmented_matrix.json`, 'utf8'));

// Check combo: High Fav Odds (>=2.50) [id 23] AND Underdog Odds <= 2.80 [id 26]
let tot = 0, ud = 0, dr = 0, mf = 0;
matrix.forEach(m => {
  if (m.triggeredRuleIds.includes(23) && m.triggeredRuleIds.includes(26)) {
    tot++;
    if (m.outcome === 'UNDERDOG') ud++;
    else if (m.outcome === 'DRAW') dr++;
    else mf++;
  }
});

console.log(`High Fav Odds (>=2.50) + Ud Odds <= 2.80:`);
console.log(`Total: ${tot} | Ud: ${ud} (${(ud/tot*100).toFixed(1)}%) | Draw: ${dr} (${(dr/tot*100).toFixed(1)}%) | MFav: ${mf} (${(mf/tot*100).toFixed(1)}%)`);

// What about Underdog odds <= 2.80 WITHOUT High Fav Odds (i.e. Fav odds < 2.50)?
let tot2 = 0, ud2 = 0, dr2 = 0, mf2 = 0;
matrix.forEach(m => {
  if (m.triggeredRuleIds.includes(26) && !m.triggeredRuleIds.includes(23)) {
    tot2++;
    if (m.outcome === 'UNDERDOG') ud2++;
    else if (m.outcome === 'DRAW') dr2++;
    else mf2++;
  }
});

console.log(`\nUd Odds <= 2.80 WITHOUT High Fav Odds (Genuine Favorite < 2.50):`);
console.log(`Total: ${tot2} | Ud: ${ud2} (${(ud2/tot2*100).toFixed(1)}%) | Draw: ${dr2} (${(dr2/tot2*100).toFixed(1)}%) | MFav: ${mf2} (${(mf2/tot2*100).toFixed(1)}%)`);

// And what about when Underdog was Away on LE and Won (id 40) vs when LE was a draw?
let tot3 = 0, ud3 = 0, dr3 = 0, mf3 = 0;
matrix.forEach(m => {
  if (m.triggeredRuleIds.includes(40)) {
    tot3++;
    if (m.outcome === 'UNDERDOG') ud3++;
    else if (m.outcome === 'DRAW') dr3++;
    else mf3++;
  }
});
console.log(`\nUnderdog was away on LE and Won (id 40):`);
console.log(`Total: ${tot3} | Ud: ${ud3} (${(ud3/tot3*100).toFixed(1)}%) | Draw: ${dr3} (${(dr3/tot3*100).toFixed(1)}%) | MFav: ${mf3} (${(mf3/tot3*100).toFixed(1)}%)`);
