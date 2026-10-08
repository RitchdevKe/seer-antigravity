import fs from 'fs';
import { CODE_DEFAULT_CATEGORY_SETTINGS } from '../src/utils/optimizedweights';

const rules = CODE_DEFAULT_CATEGORY_SETTINGS['bankers_dlive'].rules;
console.log('Total rules in CODE_DEFAULT_CATEGORY_SETTINGS.bankers_dlive:', rules.length);

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const catalog = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_rules_catalog.json`, 'utf8'));
console.log('Total rules in catalog:', catalog.length);

// Compare descriptions
rules.forEach((r, idx) => {
  if (r.description !== catalog[idx]?.description) {
    console.log(`Mismatch at index ${idx}: settings="${r.description}" vs catalog="${catalog[idx]?.description}"`);
  }
});

if (catalog.length > rules.length) {
  console.log('Extra rules in catalog beyond settings length:');
  for (let i = rules.length; i < catalog.length; i++) {
    console.log(`[#${i}] "${catalog[i].description}"`);
  }
}
