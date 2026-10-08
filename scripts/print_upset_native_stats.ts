import fs from 'fs';

const statsPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\upsets_native_rules_stats.json';
const stats: any[] = JSON.parse(fs.readFileSync(statsPath, 'utf8'));

stats.sort((a, b) => b.totalTriggers - a.totalTriggers);

console.log('Desc'.padEnd(65) + ' | Pts | Tot |  Ud | Drw |  Mf |   Ud% |  Sat% |  Sun%');
console.log('-'.repeat(115));
stats.forEach(s => {
  console.log(
    s.description.padEnd(65) + ' | ' +
    s.currentPoints.toString().padStart(3) + ' | ' +
    s.totalTriggers.toString().padStart(3) + ' | ' +
    s.underdogWins.toString().padStart(3) + ' | ' +
    s.draws.toString().padStart(3) + ' | ' +
    s.mfavWins.toString().padStart(3) + ' | ' +
    s.underdogWinPct.toFixed(1).padStart(5) + '% | ' +
    s.satWinPct.toFixed(1).padStart(5) + '% | ' +
    s.sunWinPct.toFixed(1).padStart(5) + '%'
  );
});
