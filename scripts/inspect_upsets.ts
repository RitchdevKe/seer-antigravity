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

const andorra = matrix.find(m => m.teams.includes('Andorra'));
console.log('--- Andorra Match ---');
console.log('Teams:', andorra?.teams);
console.log('Result:', andorra?.result, 'Outcome:', andorra?.outcome);
console.log('Base points:', andorra?.basePoints);
console.log('Triggered rules:');
andorra?.triggeredDescriptions.forEach((d, i) => {
  console.log(`  [Idx ${andorra.triggeredIndices[i]}] ${d}`);
});

console.log('\n--- Other Underdog Matches with high base or triggers ---');
const upsets = matrix.filter(m => m.outcome === 'UNDERDOG');
console.log(`Total upsets: ${upsets.length}`);
upsets.slice(0, 5).forEach(u => {
  console.log(`Match: ${u.teams} (${u.result}), base: ${u.basePoints}, triggers: ${u.triggeredDescriptions.length}`);
  console.log('  Triggers:', u.triggeredDescriptions.slice(0, 5).join(' | '));
});
