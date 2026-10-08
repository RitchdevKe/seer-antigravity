const fs = require('fs');
const text = fs.readFileSync('scratch/user_code_prompt.txt', 'utf-8');

const categoryBlocks = text.split(/\/\/ Category: /g);

const categoryMap = {
  top_10_value: 'MASTER_TOP_12_RULES',
  best_bet: 'MASTER_BEST_BET_RULES',
  bankers_dlive: 'MASTER_BANKERS_DLIVE_RULES',
  bankers_jackpot: 'MASTER_BANKERS_JACKPOT_RULES',
  value_picks: 'MASTER_VALUE_PICKS_RULES',
  upsets: 'MASTER_UPSETS_RULES',
  botb_best: 'MASTER_BOTB_RULES'
};

const generatedCode = {};

categoryBlocks.slice(1).forEach((block) => {
  const header = block.split('\n')[0].trim();
  const idMatch = header.match(/\("([^"]+)"\)/);
  if (!idMatch) return;
  const catId = idMatch[1];
  const constName = categoryMap[catId];
  if (!constName) return;

  const startIdx = block.indexOf('populateCategoryWithMasterRules([');
  if (startIdx === -1) return;
  const arrStart = startIdx + 'populateCategoryWithMasterRules(['.length;
  const endIdx = block.indexOf('],', arrStart);
  if (endIdx === -1) return;

  const rawRules = block.substring(arrStart, endIdx).trim();
  generatedCode[constName] = `export const ${constName}: { description: string; points: number }[] = [\n${rawRules}\n];`;
  console.log(`Generated ${constName} (${catId})`);
});

fs.writeFileSync('scratch/master_rules_code.txt', Object.values(generatedCode).join('\n\n'), 'utf-8');
console.log('Saved all generated master rules to scratch/master_rules_code.txt');
