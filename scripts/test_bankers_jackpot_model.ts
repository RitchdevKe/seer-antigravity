import fs from 'fs';
import { rulesCatalog, matchesMatrix, evaluateCandidateWeights } from './bankers_jackpot_eval_harness';

console.log(`Starting Bankers Jackpot Model Optimization with ${rulesCatalog.length} rules and ${matchesMatrix.length} matches...`);

// Initialize all weights to 0
const weights: number[] = new Array(rulesCatalog.length).fill(0);

// Helper to set rule by exact description
const setRule = (desc: string, pts: number) => {
  const idx = rulesCatalog.findIndex((r: any) => r.description === desc);
  if (idx !== -1) {
    weights[idx] = pts;
  } else {
    console.warn('Rule not found in catalog:', desc);
  }
};

// 1. Guardrails for unhit/dangerous rules
setRule("Match belongs to israel premier league or other israel teams", -20);
setRule("Match belong to sub pattern G2E5+Mfav GS - Ud GS >= 1.0", -25);
setRule("Seer score on draw >= 40% to <45%", -20);
setRule("Seer score on draw >= 35% to <40%", -15);
setRule("Seer score on draw >= 30% to <35%", -10);
setRule("Seer score on underdog >= 45%", -25);
setRule("Seer primary predicts on underdog", -20);
setRule("Sub pattern primary prediction supports the underdog", -10);
setRule("Algo primary prediction supports the underdog", -15);
setRule("Underdog has >= 5 more points on point system", -10);
setRule("LE (Last encounter) Underdog won with and scored 2 goals or more+ Seer score on draw >= 40%", -25);
setRule("LE (Last encounter) Underdog won with and scored 2 goals or more", -15);
setRule("Underdog was away on LE (Last encounter) and Won", -10);
setRule("A match has GS=GS=GA=GA", -20);
setRule("Match has PHA tie", -15);
setRule("Match has U21,U20 Tag (youth league)", -20);
setRule("Youth league + Banned: Upset risk tag", -20);
setRule("Odds for underdog < 3.0", -15);

// 2. Risk & Trap Suppressors (Empirical Draw & Underdog Traps)
setRule("M.fav has hidden strength", -15); // 67.6% failure rate (14 draws, 11 losses)
setRule("Mfav has hidden weakness", -15); // 65.5% failure rate (10 losses, 9 draws)
setRule("Underdog GS <= 1.0 but M.fav GS > 2.0", -20); // 80% failure rate
setRule("Synergy: Both TS <= 1.0 + Volatile match + Draw odds < 3.20", -20); // 75% failure rate (5 draws)
setRule("H.Bal + Equal GA + AGA=HGS+ M.fav GS>Uderdog GS with more than 0.5", -20); // 66.7% failure rate
setRule("Both teams GA => 1.5", -15); // 37 failures (16 draws, 21 losses)
setRule("1X2 Rating =>7", -15); // 33 failures (21 draws, 12 losses)
setRule("1X2 rating(R) =>5 to <7", -10); // 25 failures (15 draws, 10 losses)
setRule("Point system has >= 70 points on M.fav", -15); // Suppress false favorite trap
setRule("Point system has >= 60 to <70 points on M.fav", -10); // 34 failures
setRule("Point system has >= 50 to <60 points on M.fav", -5);
setRule("Synergy: Point system >= 60 on M.fav + Ud GS < 1.0 & Mfav GS > 1.0 + Ud GA >= 2.0", -20); // 0 wins, 3 failures
setRule("Synergy: Both TS <= 1.0 + Point system >= 60 on M.fav + Ud GS < 1.0 & Mfav GS > 1.0", -15); // 75% failure rate
setRule("Mfav was away on LE (Last encounter) and Won with 2 or more goals", -15); // 21 failures (11 draws, 10 losses)
setRule("Mfav TS 1.0-1.50 and Ud TS < 0.8", -15); // 31 failures
setRule("Mfav TS 1.0-1.50 and Ud TS < 0.8+Underdog has hidden strength/weakness", -20);
setRule("Mfav TS 1.0-1.50 and Ud TS < 0.8 + Banned: Upset risk tag", -20);
setRule("Seer score on draw >= 35% + Mfav TS 1.0-1.50 and Ud TS < 0.8", -20);
setRule("M.fav and Underdog TS difference <= 0.1", -15);
setRule("Both teams GA > GS and Both team GS <=1.0", -15);
setRule("Both teams GA > GS", -10);
setRule("Volatile match + Both teams GA > GS", -10);
setRule("Both teams GS < 1.0", -15);
setRule("Banned: Upset risk tag", -15);
setRule("Underdog TS > M.fav TS", -10);
setRule("1X2R <= 2.5", -5);
setRule("LE was a draw + Mfav L10= Und L10 (+-1) + 1X2R <= 2.5", -20);
setRule("Underdog has hidden strength/weakness + 1X2R <= 2.5", -15);
setRule("Mfav L10= Und L10", -15);
setRule("Underdog has a higher L10 than Mfav", -15);
setRule("Seer score on draw >= 35% to <40%+Underdog has a higher L10 than Mfav", -20);
setRule("PHA for draw and underdog => 20%", -10);
setRule("PHA for draw and underdog => 20%+M.fav TS >= 2.0 and Underdog TS < 1.0", -15);
setRule("PHA for draw and underdog => 20%+PAA, SubPattern, Algo, and ML agree on 12 hedge", -15);
setRule("M.fav TS >= 2.0 & Ud TS < 1.0 + Odds Ud <= Draw", -15);
setRule("M.fav TS >= 3.0 and Underdog TS < 1.0", -15);
setRule("M.fav TS >= 3.0 and Underdog TS < 1.0+Underdog has hidden strength/weakness", -20);
setRule("Paa fin, sub pattern fin and ML fin is 1X/X2 but Algo and Seer final is 12", -15);
setRule("PAA, SubPattern, Algo, and ML agree on 12 hedge+Both teams GA >= 1.1 (volatile match)+Both teams GA > GS", -20);
setRule("Algo for Mfav support <40%", -15);
setRule("Away favorite + M.fav and Underdog TS difference <= 0.1", -15);
setRule("Underdog has hidden strength/weakness", -15);
setRule("Mfav GA= Und GA (+-0.2)", -10);
setRule("Mfav GS=Underdog GS (+-0.2)", -10);
setRule("HGA=AGS + Equal GS", -10);
setRule("Synergy: PAA s.win 55% to <70% + M.fav hidden strength", -15);

// 3. Positive Drivers (Empirical Win Factors)
setRule("Both team GS => 1.8", 15); // 65.6% win rate (21 wins, only 2 draws, 9 losses)
setRule("1X2 supports the underdog", 10); // 63.6% win rate (21 wins, 5 draws, 7 losses)
setRule("All predictors fin prediction final 1X/X2 but algo final 12", 15); // 58.6% win rate (17 wins, 4 draws, 8 losses)
setRule("Synergy: PAA s.win 55% to <70% + Mfav GS - Ud GS >= 0.5 + Ud hidden strength", 10); // 75% win rate (3 wins, 1 draw)
setRule("Mfav GS ≥1.1 over Ud GS", 10);
setRule("Mfav GS ≥0.8 to <1.1 over Ud GS", 10);
setRule("Mfav GS ≥0.5 but <0.8 over Ud GS", 5);
setRule("Underdog GA >= 2.0", 10);
setRule("Underdog GS < 1.0 but M.fav GS > 1.0", 10);
setRule("Algo Mfav >=60%", 10);
setRule("Algo Mfav =>50% to <60%", 5);
setRule("PAA s.win =55% to <70%", 5);
setRule("PAA s.win =>70%", 10);
setRule("1X2 supports 1X/X2", 5);
setRule("PAA, SubPattern, Algo, and ML agree on 12 hedge", 5);
setRule("PAA, Seer, Algo, and ML agree on 1X/X2", 0); // Neutralize draw pull (34.3% draw rate)

const initialRes = evaluateCandidateWeights(weights);
console.log('\n--- Initial Hypothesis Performance ---');
console.log('Top 10:', initialRes.top10);
console.log('Top 20:', initialRes.top20);
console.log('Top 30:', initialRes.top30);
console.log('First failure rank:', initialRes.firstFailureRank);
console.log('Clean streak:', initialRes.cleanStreak);
console.log('Min Top 10 Score:', initialRes.minTop10Score, '| Max Failure Score:', initialRes.maxFailureScore, '| Gap:', initialRes.scoreGap);

console.log('\nTop 15 Matches:');
initialRes.sortedMatches.slice(0, 15).forEach((m, idx) => {
  console.log(`#${idx + 1} [${m.totalScore} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});
