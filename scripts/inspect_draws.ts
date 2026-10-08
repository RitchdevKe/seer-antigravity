import fs from 'fs';

const matrix: any[] = JSON.parse(fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\upsets_augmented_matrix.json', 'utf8'));

const inspectTeams = ['Grazer AK', 'Revilla', 'AS Roma', 'Cham vs Bruhl', 'HJS Akatemia', 'Brighton'];

inspectTeams.forEach(tName => {
  const m = matrix.find(x => x.teams.toLowerCase().includes(tName.toLowerCase()));
  if (m) {
    console.log(`\n================ ${m.teams} (${m.result}, Outcome: ${m.outcome}) ================`);
    console.log(`Base points: ${m.basePoints}`);
    console.log(`Triggered rules (${m.triggeredDescriptions.length}):`);
    m.triggeredDescriptions.forEach((d: string) => console.log(` - ${d}`));
  }
});
