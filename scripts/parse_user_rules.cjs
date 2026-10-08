const fs = require('fs');
const text = fs.readFileSync('scratch/user_code_prompt.txt', 'utf-8');

const categoryBlocks = text.split(/\/\/ Category: /g);
console.log('Total blocks:', categoryBlocks.length);

const parsed = {};

categoryBlocks.slice(1).forEach((block, idx) => {
  const header = block.split('\n')[0].trim();
  const idMatch = header.match(/\("([^"]+)"\)/);
  const catId = idMatch ? idMatch[1] : `unknown_${idx}`;
  
  // Extract rules array content between populateCategoryWithMasterRules([ and ],
  const startIdx = block.indexOf('populateCategoryWithMasterRules([');
  if (startIdx !== -1) {
    const arrStart = startIdx + 'populateCategoryWithMasterRules(['.length;
    const endIdx = block.indexOf('],', arrStart);
    if (endIdx !== -1) {
      const rawRules = block.substring(arrStart, endIdx).trim();
      const rules = [];
      const lines = rawRules.split('\n');
      for (const line of lines) {
        const m = line.match(/\{\s*description:\s*(".*?"|'.*?'),\s*points:\s*(-?\d+)\s*\}/);
        if (m) {
          const desc = JSON.parse(m[1].startsWith('"') ? m[1] : JSON.stringify(m[1].slice(1, -1)));
          const pts = parseInt(m[2], 10);
          rules.push({ description: desc, points: pts });
        }
      }
      parsed[catId] = { header, count: rules.length, rules, rawRules };
      console.log(`Parsed ${catId} (${header}): ${rules.length} rules`);
    }
  }
});

fs.writeFileSync('scratch/parsed_rules.json', JSON.stringify(parsed, null, 2), 'utf-8');
console.log('Saved parsed rules to scratch/parsed_rules.json');
