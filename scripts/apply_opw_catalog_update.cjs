const fs = require('fs');

const originalFile = fs.readFileSync('src/utils/opwCatalog.ts', 'utf-8');
const replacementCode = fs.readFileSync('scratch/master_rules_code.txt', 'utf-8');

const startMarker = 'export const MASTER_TOP_12_RULES: { description: string; points: number }[] = [';
const endMarker = 'export function getMasterTriggerDefaultPoints(';

const startIndex = originalFile.indexOf(startMarker);
const endIndex = originalFile.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found! startIndex:', startIndex, 'endIndex:', endIndex);
  process.exit(1);
}

const before = originalFile.substring(0, startIndex);
const after = originalFile.substring(endIndex);

const updatedFile = before + replacementCode + '\n\n' + after;

fs.writeFileSync('src/utils/opwCatalog.ts', updatedFile, 'utf-8');
console.log('Successfully updated src/utils/opwCatalog.ts! New length:', updatedFile.length);
