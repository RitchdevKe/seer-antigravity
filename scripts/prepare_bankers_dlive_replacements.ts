import fs from 'fs';

const filePath = 'src/utils/optimizedweights.ts';
let content = fs.readFileSync(filePath, 'utf8');

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const comp = JSON.parse(fs.readFileSync(outDir + '\\bankers_dlive_full_comparison.json', 'utf8'));

const ruleMap = new Map<string, number>();
comp.forEach((r: any) => {
  ruleMap.set(r.description, r.newPoints);
});

// Also ensure "A match has GS=GS=GA=GA" has 0 points
if (!ruleMap.has("A match has GS=GS=GA=GA")) {
  ruleMap.set("A match has GS=GS=GA=GA", 0);
}

// 1. Prepare new default rules block for bankers_dlive
const defaultRulesLines = comp.map((r: any) => `            { description: ${JSON.stringify(r.description)}, points: ${r.newPoints} },`);

const catHeader = 'bankers_dlive: {';
const rulesSub = 'rules: [';
const nextCat = 'bankers_jackpot: {';

const bDliveIdx = content.indexOf(catHeader);
if (bDliveIdx === -1) {
  console.error('bankers_dlive: { not found');
  process.exit(1);
}

const rulesIdx = content.indexOf(rulesSub, bDliveIdx);
if (rulesIdx === -1) {
  console.error('rules: [ for bankers_dlive not found');
  process.exit(1);
}

const nextCatIdx = content.indexOf(nextCat, rulesIdx);
if (nextCatIdx === -1) {
  console.error('bankers_jackpot: { not found');
  process.exit(1);
}

const rulesCloseBracket = content.lastIndexOf(']', nextCatIdx);
if (rulesCloseBracket === -1) {
  console.error('bankers_dlive closing bracket not found');
  process.exit(1);
}

content = content.slice(0, rulesIdx + rulesSub.length) + '\n' + defaultRulesLines.join('\n') + '\n        ' + content.slice(rulesCloseBracket);
console.log('Replaced CODE_DEFAULT_CATEGORY_SETTINGS.bankers_dlive.rules successfully.');

// 2. Replace getOptimizedScoreDetailed bankers_dlive evaluation block
const evalStartMarker = "} else if ((evalCategoryId || categoryId) === 'bankers_dlive') {";
const evalEndMarker = "} else if (['bankers_jackpot', 'value_picks'].includes(evalCategoryId || categoryId)) {";

const eStart = content.indexOf(evalStartMarker);
const eEnd = content.indexOf(evalEndMarker);

if (eStart === -1 || eEnd === -1) {
  console.error('Could not find eval block in getOptimizedScoreDetailed for bankers_dlive');
  process.exit(1);
}

let evalBlock = content.slice(eStart, eEnd);

let updateCount = 0;

for (const [desc, newPts] of ruleMap.entries()) {
  const escapedDesc = desc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(totalScore\\s*\\+=\\s*)(-?\\d+)(;\\s*\\r?\\n\\s*rulesHit\\.push\\(\\{\\s*description:\\s*["']${escapedDesc}["'],\\s*points:\\s*)(-?\\d+)(\\s*\\}\\);)`,
    'g'
  );

  evalBlock = evalBlock.replace(pattern, (match, p1, p2, p3, p4, p5) => {
    updateCount++;
    return `${p1}${newPts}${p3}${newPts}${p5}`;
  });
}

console.log('Updated', updateCount, 'rule evaluations in getOptimizedScoreDetailed for bankers_dlive.');

content = content.slice(0, eStart) + evalBlock + content.slice(eEnd);

fs.writeFileSync('src/utils/optimizedweights.candidate.ts', content);
console.log('Wrote updated content to src/utils/optimizedweights.candidate.ts');
