import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const matrix: any[] = JSON.parse(fs.readFileSync(`${outDir}\\upsets_augmented_matrix.json`, 'utf8'));

const draws = matrix.filter(m => m.outcome === 'DRAW');
const mfavs = matrix.filter(m => m.outcome === 'MFAV');
const underdogs = matrix.filter(m => m.outcome === 'UNDERDOG');

console.log(`Dataset summary: ${underdogs.length} Underdogs, ${draws.length} Draws, ${mfavs.length} MFavs.`);

// Inspect Grazer, Revilla, AS Roma, Odishi, Olympic
const specificDraws = ['Grazer', 'Revilla', 'AS Roma', 'Odishi', 'Olympic', 'Vaxjo', 'Kawasaki'];
specificDraws.forEach(name => {
  const match = draws.find(m => m.teams.includes(name));
  if (match) {
    console.log(`\n--- Draw Match: ${match.teams} (${match.result}) ---`);
    console.log(`Base: ${match.basePoints}`);
    console.log('Triggered rules:');
    match.triggeredDescriptions.forEach((d: string) => console.log('  -', d));
  }
});
