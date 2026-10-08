import fs from 'fs';
import { evaluateWeights } from './eval_harness';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\best_bet_rules_catalog.json`, 'utf8'));
const matchesMatrix = JSON.parse(fs.readFileSync(`${outDir}\\best_bet_matches_matrix.json`, 'utf8'));

// Initialize all 125 rules to 0 points (The "Reset to Zero" paradigm requested by user)
const finalWeights = new Array(125).fill(0);

// --- 1. CORE POSITIVE DRIVERS (Validated Bonuses) ---
finalWeights[49] = 15;  // Point system has >= 60 to <70 points on M.fav (+15, 90.0% win rate, OR 4.04)
finalWeights[50] = 10;  // Point system has >= 50 to <60 points on M.fav (+10, 90.0% win rate, OR 3.10)
finalWeights[40] = 15;  // Away favorite (+15, 81.5% win rate, 22 wins, 1 draw, OR 2.17)
finalWeights[41] = 10;  // Away favorite + Mfav GA <= 1.0 & Ud GA > 1.0 (+10, 76.9% win rate, 0 draws)
finalWeights[123] = 15; // Underdog was Home on LE and still playing at Home (+15, 100% win rate, 5/5 wins)
finalWeights[28] = 20;  // PAA s.win =>70% (+20, 76.9% win rate, 10 wins, 0 draws)
finalWeights[43] = 15;  // Underdog GS < 1.0 but M.fav GS > 1.0 (+15, 75.0% win rate, 21 wins)
finalWeights[112] = 10; // Mfav GS=Underdog GS (+-0.2) (+10, 77.8% win rate, 14 wins)
finalWeights[1] = 10;   // Mfav L10= Und L10 (+10, 78.6% win rate, 11 wins, was erroneously -15)
finalWeights[9] = 10;   // Mfav GA <= 1.1 and Und GA > 1.1 + Mfav GS=Und GS (+-0.2) (+10, 83.3% win rate)
finalWeights[8] = 5;    // Mfav GA <= 1.1 and Und GA > 1.1 (+5, 72.7% win rate, only 9% draws, was -5)
finalWeights[44] = 10;  // M.fav TS >= 2.0 and Underdog TS < 1.0 (+10, 76.9% win rate, 10 wins, 0 draws)
finalWeights[66] = 5;   // Underdog has hidden strength/weakness (+5, 76.5% win rate, was erroneously -20)
finalWeights[105] = 10; // Mfav GA= Und GA (+-0.2) + Mfav TS 1.0-1.50 and Ud TS < 0.8 (+10, 80% win rate, was -15)
finalWeights[124] = 10; // HGA=AGS + Equal GS (+10, 100% win rate, 4/4 wins, was erroneously -10)
finalWeights[26] = 5;   // M.fav has hidden strength (+5, 77.8% win rate)
finalWeights[108] = 5;  // Sub pattern final prediction is 1X/X2 (+5, 71.4% win rate)
finalWeights[116] = 5;  // Mfav L10 >Underdog L10 with >2 (+5, calibrated down from +15)

// --- 2. CORE RISK SUPPRESSORS & TRAP PENALTIES ---
finalWeights[48] = -15; // Point system has >= 70 points on M.fav (-15, 24 losses, was +15!)
finalWeights[47] = -20; // Banned: Upset risk tag (-20, 11 losses, was 0!)
finalWeights[10] = -15; // Both teams GA => 1.5 (-15, 13 losses, volatile defense, was +10!)
finalWeights[12] = -15; // 1X2 Rating =>7 (-15, 11 losses, public overconfidence trap, was +15!)
finalWeights[58] = -20; // Synergy: PAA 55-70% + Fav odds < 1.80 (-20, 8 upsets, was +10!)
finalWeights[31] = -15; // Underdog GS <= 1.0 but M.fav GS > 2.0 (-15, 35.3% upset rate)
finalWeights[0] = -10;  // LE was a draw (-10, 30.8% draw rate)
finalWeights[3] = -15;  // LE was a draw + Mfav L10= Und L10 (+-1) + 1X2R <= 2.5 (-15, 66.7% draw rate)
finalWeights[6] = -10;  // LE was a draw + 1X2R <= 2.5 (-10, 50% draw rate)
finalWeights[71] = -15; // Mfav GA and GS =>1.8 (-15, high volatility shootout trap)
finalWeights[86] = -10; // Mfav was away on LE and Won with 2+ goals (-10, 38.5% failures, was +15!)
finalWeights[88] = -15; // Mfav has hidden weakness (-15, 37.5% draw rate, was +15!)
finalWeights[106] = -15;// PHA TIE Tag (-15, explicit draw prediction, was -5)
finalWeights[79] = -15; // Underdog GS > Mfav GS with 0.5+ points (-15, 60% draw rate)
finalWeights[38] = -10; // Both teams GA > GS (-10, 33.3% draw rate)
finalWeights[39] = -15; // Both teams GA > GS and Both team GS <=1.0 (-15, 50% draw rate)
finalWeights[42] = -10; // Both teams GS < 1.0 (-10, 50% draw rate)
finalWeights[60] = -20; // Volatile match + Odds for underdog <= draw odds (-20, trap)
finalWeights[53] = -10; // Both teams TS <= 1.0 (-10, low threat stalemate trap)
finalWeights[45] = -10; // Underdog TS > M.fav TS (-10, 42.9% draw rate)
finalWeights[20] = -10; // Underdog has a higher L10 than Mfav (-10, 40% loss rate)
finalWeights[99] = -10; // PAA,Sub pattern,Algo and Seer Final is 12 (-10, 22.2% draw surge)
finalWeights[94] = -20; // Youth League (U21,U23,U20) (-20, unseeded variance)
finalWeights[95] = -20; // Youth League + Mfav TS 1.0-1.50 (-20)
finalWeights[27] = -15; // 1X2 supports the underdog (-15, 66.7% loss rate)
finalWeights[37] = -5;  // Underdog GA >= 2.0 (-5, below baseline)
finalWeights[2] = -5;   // 1X2R <= 2.5 (-5)
finalWeights[52] = -15; // Underdog has >= 5 more points on point system (-15 guardrail)

// --- 3. HARD GUARDRAILS FOR UNSEEN MATCHES (Safe defaults for 0-hit rules) ---
finalWeights[14] = -20; // Seer score on draw >= 40% to <45% (-20)
finalWeights[15] = -15; // Seer score on draw >= 35% to <40% (-15)
finalWeights[16] = -5;  // Seer score on draw >= 30% to <35% (-5)
finalWeights[36] = -25; // Seer score on underdog >= 45% (-25)
finalWeights[61] = -20; // Seer primary predicts on underdog (-20)
finalWeights[68] = -15; // Odds for underdog < 3.0 (-15)
finalWeights[85] = -25; // LE Underdog won 2+ goals + Seer draw >= 40% (-25)
finalWeights[17] = -20; // Sub pattern G2E5 + GS diff >= 1.0 (-20, clamped from -125!)

console.log('--- EVALUATION OF MASTER CALIBRATED MODEL ---');
const res = evaluateWeights(finalWeights);
console.log(res);

const scored = matchesMatrix.map((m: any) => {
  let s = m.basePoints;
  for (const idx of m.triggeredRuleIndices) {
    s += finalWeights[idx];
  }
  return { ...m, score: s };
});

scored.sort((a: any, b: any) => b.score - a.score);

console.log('\nTop 25 Matches under Master Model:');
scored.slice(0, 25).forEach((m: any, idx: number) => {
  console.log(`#${idx + 1} [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});

// Check where the highest scoring loss is
console.log('\nHighest scoring losses in dataset:');
const losses = scored.filter((m: any) => m.outcome !== 'MFAV');
losses.slice(0, 5).forEach((m: any) => {
  const rank = scored.findIndex((x: any) => x.id === m.id) + 1;
  console.log(`Rank #${rank} [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});
