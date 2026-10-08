import fs from 'fs';
import { evaluateBankersDliveWeights } from './bankers_dlive_eval_harness';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_rules_catalog.json`, 'utf8'));
const matchesMatrix = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_matches_matrix.json`, 'utf8'));

// Initialize all 131 rules to 0
const calibratedWeights = new Array(rulesCatalog.length).fill(0);

// --- 1. CORE POSITIVE DRIVERS (Validated Outright Win Drivers) ---
calibratedWeights[87] = 15;  // Mfav GS =>1.8 and GA =<1.0 (+15, 80.0% win rate, 16 wins, 1 loss, OR 3.79)
calibratedWeights[36] = 15;  // Both team GS => 1.8 (+15, 72.0% win rate, 18 wins, 2 draws, 5 losses, OR 2.52)
calibratedWeights[76] = 15;  // All predictors fin prediction final 1X/X2 but algo final 12 (+15, 77.8% win rate, 7 wins, 1 loss)
calibratedWeights[35] = 10;  // Underdog GA >=0.5 more than Mfav GA (+10, 57.6% win rate, 53 wins!)
calibratedWeights[122] = 10; // Mfav L10 >Underdog L10 with >2 (+10, 62.0% win rate, 44 wins!)
calibratedWeights[7] = 5;    // L10 for both teams =>5 (+5, 59.6% win rate, 28 wins)
calibratedWeights[47] = 10;  // M.fav TS >= 2.0 and Underdog TS < 1.0 (+10, 60.0% win rate, 6 wins, 2 losses)
calibratedWeights[44] = 5;   // Away favorite + Mfav GA <= 1.0 & Ud GA > 1.0 (+5, 58.8% win rate, 10 wins)
calibratedWeights[43] = 5;   // Away favorite (+5, 56.5% win rate, 26 wins)
calibratedWeights[34] = 5;   // Mfav GS - Ud GS >= 1.0 (+5, 58.6% win rate, 17 wins)
calibratedWeights[117] = 10; // Mfav GS=Underdog GS (+-0.2)+ MFav GA<=1.0 and Und GA >1.0 (+10, 58.3% win rate)
calibratedWeights[78] = 5;   // Sub pattern final prediction is 1X/X2 (+5, 57.7% win rate, 41 wins)
calibratedWeights[8] = 5;    // Mfav GA <= 1.1 and Und GA > 1.1 (+5, 57.4% win rate, 35 wins)
calibratedWeights[57] = 5;   // Synergy: TS diff >= 1.0 + Ud GA >= 2.0 + Odds Ud <= Draw (+5, 63.6% win rate, 7 wins)
calibratedWeights[50] = 5;   // Banned: Upset risk tag (+5, 65.6% win rate, 21 wins)
calibratedWeights[27] = 5;   // 1X2 supports the underdog (+5, 66.7% win rate, 10 wins, 1 loss)

// --- 2. CORE RISK SUPPRESSORS & TRAP PENALTIES ---
calibratedWeights[92] = -20; // Underdog GS > Mfav GS with 0.5 points or more (-20, 76.9% loss/draw rate, 6 losses)
calibratedWeights[129] = -20;// Underdog was Home on LE and still playing at Home (-20, 85.7% failure rate, 3 draws, 3 losses)
calibratedWeights[32] = -15; // Underdog GS <= 1.0 but M.fav GS > 2.0 (-15, 83.3% loss/draw rate, 3 draws, 2 losses)
calibratedWeights[59] = -15; // Synergy: Mfav GS - Ud GS >= 0.5 + M.fav hidden strength (-15, 77.8% failure rate)
calibratedWeights[102] = -15;// Mfav has hidden weakness (-15, 70.0% failure rate, 7 losses, 7 draws)
calibratedWeights[103] = -20;// Mfav has hidden weakness + Underdog GS > Mfav GS with 0.5+ pts (-20, 66.7% underdog loss rate)
calibratedWeights[26] = -15; // M.fav has hidden strength (-15, 65.6% failure rate, 15 draws, 6 losses)
calibratedWeights[90] = -20; // Underdog has hidden strength + M.fav has hidden strength (-20, 75.0% draw rate)
calibratedWeights[81] = -15; // Mfav GS=Underdog GS (+-0.2) + M.fav has hidden strength (-15, 54.5% draw rate)
calibratedWeights[104] = -15;// Mfav has hidden weakness + Mfav GS = Under GS (+-0.2) (-15, 66.7% draw rate)
calibratedWeights[94] = -15; // Synergy: Both TS <= 1.0 + Pred 1X2 on M.fav (-15, 62.2% failure rate, 17 draws, 11 losses)
calibratedWeights[12] = -15; // Synergy: PAA s.win 55% to <70% + M.fav hidden strength (-15, 64.7% failure rate, 7 draws, 4 losses)
calibratedWeights[41] = -15; // Both teams GA > GS and Both team GS <=1.0 (-15, 61.5% failure rate, 5 draws, 3 losses)
calibratedWeights[18] = -15; // Mfav TS 1.0-1.50 and Ud TS < 0.8 (-15, 58.1% failure rate, 13 losses, 12 draws)
calibratedWeights[86] = -15; // Mfav GA and GS =>1.8 (-15, 58.8% failure rate, 6 draws, 4 losses)
calibratedWeights[100] = -15;// Mfav was away on LE and Won with 2+ goals (-15, 57.1% failure rate, 13 draws, 7 losses)
calibratedWeights[93] = -10; // Both teams TS <= 1.0 (Mutual low threat) (-10, 56.7% failure rate, 20 draws, 14 losses)
calibratedWeights[82] = -15; // Both teams GA => 1.5 (-15, 56.4% failure rate, 16 losses, 15 draws)
calibratedWeights[48] = -10; // Underdog TS > M.fav TS (-10, 55.8% failure rate, 12 losses, 12 draws)
calibratedWeights[22] = -15; // M.fav TS >= 3.0 and Underdog TS < 1.0 (-15, 55.6% failure rate, 4 draws, 1 loss)
calibratedWeights[23] = -10; // M.fav TS >= 3.0 and Und TS < 1.0 + Und hidden strength/weakness (-10, draw suppressor)
calibratedWeights[45] = -15; // Both teams GS < 1.0 (-15, 55.6% failure rate, 3 draws, 2 losses)
calibratedWeights[113] = -15;// M.fav has hidden strength+Mfav GA=Und GA (+-0.2) (-15, 55.6% failure rate, 4 draws, 1 loss)
calibratedWeights[115] = -15;// PHA TIE Tag (-15, 55.6% failure rate, 12 draws, 8 losses)
calibratedWeights[40] = -10; // Both teams GA > GS (-10, 55.3% failure rate, 14 draws, 12 losses)
calibratedWeights[0] = -15;  // LE was a draw (-15, 54.3% failure rate, 13 draws, 6 losses)
calibratedWeights[6] = -10;  // LE was a draw+1X2R <= 2.5 (-10, 50% draw rate)
calibratedWeights[39] = -10; // Underdog GA >= 2.0 (-10, 27 failures out of 54)
calibratedWeights[109] = -15;// PAA,Sub pattern,Algo and Seer Final is 12 (-15, 53.2% failure rate, 18 losses, 15 draws)
calibratedWeights[53] = -10; // Point system has >= 50 to <60 points on M.fav (-10, 40.0% draw rate, 16 draws)
calibratedWeights[51] = -15; // Point system has >= 70 points on M.fav (-15, 11 losses, 6 draws)
calibratedWeights[120] = -15;// LE was a draw+Underdog has hidden strength/weakness (-15, 60% failure rate)
calibratedWeights[121] = -15;// Underdog has hidden strength/weakness+ R(1X2 rating)<3.0 (-15, 60% failure rate)
calibratedWeights[124] = -10;// LE, Underdog won the last encounter (-10, 23 failures out of 46)
calibratedWeights[125] = -15;// LE, Underdog won the last encounter +Mfav L10= Und L10 (-15, 57.1% failure rate)
calibratedWeights[105] = -15;// Banned: Draw risk (-15, 56.3% failure rate, 5 losses, 4 draws)
calibratedWeights[55] = -10; // Underdog has >= 5 more points on point system (-10, 51.7% failure rate)
calibratedWeights[2] = -5;   // 1X2R <= 2.5 (-5, 50.9% failure rate)
calibratedWeights[10] = -10; // 1X2 rating(R) =>5 to <7 (-10, 43.9% failure rate)
calibratedWeights[11] = -10; // 1X2 Rating =>7 (-10, public overconfidence trap)
calibratedWeights[70] = -20; // Youth League (U21,U23,U20) (-20, unseeded variance)

// --- 3. HARD GUARDRAILS FOR UNSEEN MATCHES (Safe defaults for 0-hit rules) ---
calibratedWeights[14] = -20; // Seer score on draw >= 40% to <45% (-20)
calibratedWeights[15] = -15; // Seer score on draw >= 35% to <40% (-15)
calibratedWeights[16] = -5;  // Seer score on draw >= 30% to <35% (-5)
calibratedWeights[38] = -25; // Seer score on underdog >= 45% (-25)
calibratedWeights[60] = -20; // Seer primary predicts on underdog (-20)
calibratedWeights[67] = -15; // Odds for underdog < 3.0 (-15)
calibratedWeights[99] = -25; // LE Underdog won 2+ goals + Seer score on draw >= 40% (-25)
calibratedWeights[17] = -20; // Match belong to sub pattern G2E5 (-20, clamped from -125)

console.log('--- EVALUATION OF REFINED MODEL ---');
const res = evaluateBankersDliveWeights(calibratedWeights);
console.log(res);

const scored = matchesMatrix.map((m: any) => {
  let s = m.basePoints;
  for (const idx of m.triggeredRuleIndices) {
    s += calibratedWeights[idx];
  }
  return { ...m, score: s };
});

scored.sort((a: any, b: any) => b.score - a.score);

console.log('\nTop 25 Matches under Refined Model:');
scored.slice(0, 25).forEach((m: any, idx: number) => {
  console.log(`#${idx + 1} [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});

console.log('\nHighest scoring non-mfav outcomes:');
const losses = scored.filter((m: any) => m.outcome !== 'MFAV');
losses.slice(0, 5).forEach((m: any) => {
  const rank = scored.findIndex((x: any) => x.id === m.id) + 1;
  console.log(`Rank #${rank} [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});
