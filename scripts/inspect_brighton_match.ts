import fs from 'fs';

const matrixPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\upsets_augmented_matrix.json';
const matrix: any[] = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));

const brighton = matrix.find(m => m.teams.toLowerCase().includes('brighton') || m.teams.toLowerCase().includes('arsenal'));

console.log('=== BRIGHTON VS ARSENAL DETAILS ===');
console.log('Teams:', brighton?.teams);
console.log('Result:', brighton?.result, 'Outcome:', brighton?.outcome);
console.log('MFav:', brighton?.mFav, 'moUnderdog:', brighton?.moUnderdog);
console.log('Base Points:', brighton?.basePoints);
console.log('Triggered Rules (' + brighton?.triggeredDescriptions.length + '):');
brighton?.triggeredDescriptions.forEach((d: string) => console.log('  -', d));

// Also let's inspect the top 5 false upsets that outscored Brighton on Saturday
const satMatches = matrix.filter(m => m.batch.includes('Saturday'));
console.log('\nTotal Saturday matches:', satMatches.length);
