const fs = require('fs');
const content = fs.readFileSync('src/utils/opwCatalog.ts', 'utf8');

const t12Rules = [];
const ruleRegex = /\{\s*description:\s*"([^"]+)",\s*points:\s*(-?\d+)\s*\}/g;
const t12Section = content.substring(content.indexOf('export const MASTER_TOP_12_RULES'), content.indexOf('export const MASTER_BEST_BET_RULES'));
let m;
while ((m = ruleRegex.exec(t12Section)) !== null) {
  t12Rules.push({ desc: m[1], points: parseInt(m[2], 10) });
}

const drawPoints = {};
const pointRegex = /"([^"]+)":\s*(-?\d+)/g;
const drawSection = content.substring(content.indexOf('export const MASTER_MFAV_DRAW_POINTS'), content.indexOf('export const MASTER_MFAV_ONLY_POINTS'));
while ((m = pointRegex.exec(drawSection)) !== null) {
  drawPoints[m[1]] = parseInt(m[2], 10);
}

console.log('Comparing MASTER_TOP_12_RULES vs MASTER_MFAV_DRAW_POINTS:');
t12Rules.forEach(r => {
  const dVal = drawPoints[r.desc];
  if (dVal !== undefined && dVal !== r.points) {
    console.log(`Discrepancy: "${r.desc}" -> MASTER_TOP_12: ${r.points}, MASTER_MFAV_DRAW: ${dVal}`);
  }
});
