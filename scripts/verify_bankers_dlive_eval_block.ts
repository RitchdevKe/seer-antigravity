import fs from 'fs';

const filePath = 'src/utils/optimizedweights.ts';
const content = fs.readFileSync(filePath, 'utf8');

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const comp = JSON.parse(fs.readFileSync(outDir + '\\bankers_dlive_full_comparison.json', 'utf8'));

const ruleMap = new Map<string, number>();
comp.forEach((r: any) => {
  ruleMap.set(r.description, r.newPoints);
});

// Find the bankers_dlive block in getOptimizedScoreDetailed
const startMarker = "} else if ((evalCategoryId || categoryId) === 'bankers_dlive') {";
const endMarker = "} else if (['bankers_jackpot', 'value_picks'].includes(evalCategoryId || categoryId)) {";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not locate bankers_dlive block!');
  process.exit(1);
}

const block = content.slice(startIdx, endIdx);
console.log('Block length:', block.length);

// Extract all rulesHit.push occurrences
const regex = /rulesHit\.push\(\{\s*description:\s*(["'][^"']+["']),\s*points:\s*(-?\d+)\s*\}\);/g;
let match;
const foundRules: Array<{ desc: string; currentPts: number; newPts: number | undefined }> = [];

while ((match = regex.exec(block)) !== null) {
  const desc = JSON.parse(match[1]);
  const currentPts = parseInt(match[2], 10);
  const newPts = ruleMap.get(desc);
  foundRules.push({ desc, currentPts, newPts });
}

console.log('Found', foundRules.length, 'rules evaluated in bankers_dlive block.');

const missingInCatalog = foundRules.filter(r => r.newPts === undefined);
console.log('Rules evaluated in code but missing from catalog:', missingInCatalog);

const differing = foundRules.filter(r => r.newPts !== undefined && r.currentPts !== r.newPts);
console.log('Rules with differing points between current code and new model:', differing.length);
