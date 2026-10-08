import {
  FRIDAY_TOP_12_RULES,
  FRIDAY_BEST_BET_RULES,
  FRIDAY_BANKERS_DLIVE_RULES,
  FRIDAY_BANKERS_JACKPOT_RULES,
  FRIDAY_VALUE_PICKS_RULES,
  FRIDAY_UPSETS_RULES,
  FRIDAY_BOTB_RULES
} from '../src/utils/opwFridayRules';
import { getFridayCategorySettings } from '../src/opwfriday';
import { calculateTargetHorizons } from '../src/opwalgo';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${msg}`);
    failed++;
  }
}

console.log('--- 1. Testing Friday Rules Export and Count ---');
assert(FRIDAY_TOP_12_RULES.length === 104, `FRIDAY_TOP_12_RULES has 104 rules (got ${FRIDAY_TOP_12_RULES.length})`);
assert(FRIDAY_BEST_BET_RULES.length === 107, `FRIDAY_BEST_BET_RULES has 107 rules (got ${FRIDAY_BEST_BET_RULES.length})`);
assert(FRIDAY_BANKERS_DLIVE_RULES.length === 107, `FRIDAY_BANKERS_DLIVE_RULES has 107 rules (got ${FRIDAY_BANKERS_DLIVE_RULES.length})`);
assert(FRIDAY_BANKERS_JACKPOT_RULES.length === 106, `FRIDAY_BANKERS_JACKPOT_RULES has 106 rules (got ${FRIDAY_BANKERS_JACKPOT_RULES.length})`);
assert(FRIDAY_VALUE_PICKS_RULES.length === 108, `FRIDAY_VALUE_PICKS_RULES has 108 rules (got ${FRIDAY_VALUE_PICKS_RULES.length})`);
assert(FRIDAY_UPSETS_RULES.length === 108, `FRIDAY_UPSETS_RULES has 108 rules (got ${FRIDAY_UPSETS_RULES.length})`);
assert(FRIDAY_BOTB_RULES.length === 106, `FRIDAY_BOTB_RULES has 106 rules (got ${FRIDAY_BOTB_RULES.length})`);

console.log('\n--- 2. Testing Friday Category Settings Integration ---');
const fridaySettings = getFridayCategorySettings();
const expectedCategories = ['top_10_value', 'best_bet', 'bankers_dlive', 'bankers_jackpot', 'value_picks', 'upsets', 'botb_best'];
expectedCategories.forEach(cat => {
  assert(!!fridaySettings[cat], `fridaySettings contains ${cat}`);
  assert(fridaySettings[cat].rules.length >= 100, `${cat} rules populated (got ${fridaySettings[cat].rules.length})`);
});

console.log('\n--- 3. Testing Target Horizons (23/23 vs 23/15) ---');
// Friday Top 12: totalCompleted = 24, totalCorrect = 23, categoryGoal = 12
const horizons = calculateTargetHorizons(24, 23, 12);
assert(horizons.floor === 15, `Target floor is 15 (12 + 3) (got ${horizons.floor})`);
assert(horizons.ceiling === 23, `Target ceiling is 23 (100% correct) (got ${horizons.ceiling})`);

// HUD rendering test
const cleanMatches = 23;
const targetCeiling = horizons.ceiling;
const targetClean = horizons.floor;
const hudDisplay = targetCeiling > 0 
  ? `${cleanMatches} / ${targetCeiling}` 
  : targetClean > 0 
  ? `${cleanMatches} / ${targetClean}` 
  : '—';

assert(hudDisplay === '23 / 23', `HUD displays '23 / 23' when targetCeiling is set (got '${hudDisplay}')`);

console.log(`\n========================================`);
console.log(`Summary: ${passed} passed, ${failed} failed`);
console.log(`========================================`);

if (failed > 0) process.exit(1);
