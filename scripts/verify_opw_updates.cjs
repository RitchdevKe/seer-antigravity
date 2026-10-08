const fs = require('fs');

const opwCatalog = fs.readFileSync('src/utils/opwCatalog.ts', 'utf-8');

const categories = [
  'MASTER_TOP_12_RULES',
  'MASTER_BEST_BET_RULES',
  'MASTER_BANKERS_DLIVE_RULES',
  'MASTER_BANKERS_JACKPOT_RULES',
  'MASTER_VALUE_PICKS_RULES',
  'MASTER_UPSETS_RULES',
  'MASTER_BOTB_RULES'
];

console.log('=== Checking src/utils/opwCatalog.ts ===');
categories.forEach(cat => {
  const match = opwCatalog.indexOf(`export const ${cat}`);
  if (match === -1) {
    console.error(`MISSING: ${cat}`);
  } else {
    console.log(`FOUND: ${cat}`);
  }
});

const opwAlgo = fs.readFileSync('src/opwalgo.tsx', 'utf-8');
console.log('\n=== Checking src/opwalgo.tsx ===');
console.log('MASTER_RULES_MAP present:', opwAlgo.includes('export const MASTER_RULES_MAP'));
console.log('savePersistedDailySettings imported:', opwAlgo.includes('savePersistedDailySettings'));

const opwComp = fs.readFileSync('src/components/opw/OPWMatchComparison.tsx', 'utf-8');
console.log('\n=== Checking src/components/opw/OPWMatchComparison.tsx ===');
console.log('MASTER_RULES_MAP present:', opwComp.includes('const MASTER_RULES_MAP'));
console.log('savePersistedDailySettings imported:', opwComp.includes('savePersistedDailySettings'));
