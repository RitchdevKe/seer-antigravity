import fs from 'fs';
import { evaluateWeights } from './eval_harness';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\best_bet_rules_catalog.json`, 'utf8'));

const sparseWeights = new Array(125).fill(0);

// Key Bonuses
sparseWeights[49] = 15; // Point system 60-70: +15
sparseWeights[40] = 15; // Away favorite: +15
sparseWeights[50] = 10; // Point system 50-60: +10
sparseWeights[43] = 10; // Ud GS < 1.0 & Mfav GS > 1.0: +10
sparseWeights[112] = 10; // Mfav GS = Ud GS (+-0.2): +10
sparseWeights[1] = 10;  // Mfav L10 = Und L10: +10
sparseWeights[66] = 5;  // Underdog hidden strength/weakness: +5
sparseWeights[28] = 10; // PAA s.win >= 70%: +10
sparseWeights[41] = 10; // Away fav + Mfav GA <= 1.0 & Ud GA > 1.0: +10
sparseWeights[44] = 10; // Mfav TS >= 2.0 & Ud TS < 1.0: +10
sparseWeights[26] = 10; // Mfav hidden strength: +10
sparseWeights[123] = 10; // Underdog was Home on LE and still Home: +10
sparseWeights[124] = 5;  // HGA=AGS + Equal GS: +5

// Key Penalties
sparseWeights[48] = -15; // Point system >= 70: -15
sparseWeights[47] = -15; // Banned: Upset risk: -15
sparseWeights[10] = -15; // Both teams GA >= 1.5: -15
sparseWeights[12] = -10; // 1X2 Rating >= 7: -10
sparseWeights[37] = -10; // Underdog GA >= 2.0: -10
sparseWeights[0] = -10;  // LE was a draw: -10
sparseWeights[71] = -10; // Mfav GA and GS >= 1.8: -10
sparseWeights[86] = -10; // Mfav was away on LE and won 2+: -10
sparseWeights[31] = -10; // Ud GS <= 1.0 but Mfav GS > 2.0: -10
sparseWeights[60] = -15; // Volatile + Odds ud <= draw: -15
sparseWeights[53] = -10; // Both TS <= 1.0: -10
sparseWeights[38] = -10; // Both GA > GS: -10
sparseWeights[99] = -10; // PAA, Sub, Algo, Seer final is 12: -10
sparseWeights[79] = -10; // Ud GS > Mfav GS by 0.5+: -10
sparseWeights[20] = -10; // Ud higher L10: -10

console.log('--- EVALUATION OF SPARSE 28-RULE MODEL ---');
const res = evaluateWeights(sparseWeights);
console.log(res);

// Also inspect the Top 15 matches ranked by this model
const matchesMatrix = JSON.parse(fs.readFileSync(`${outDir}\\best_bet_matches_matrix.json`, 'utf8'));
const scored = matchesMatrix.map((m: any) => {
  let s = m.basePoints;
  for (const idx of m.triggeredRuleIndices) {
    s += sparseWeights[idx];
  }
  return { ...m, score: s };
});

scored.sort((a: any, b: any) => b.score - a.score);

console.log('\nTop 20 Matches under Sparse Model:');
scored.slice(0, 20).forEach((m: any, idx: number) => {
  console.log(`#${idx + 1} [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});
