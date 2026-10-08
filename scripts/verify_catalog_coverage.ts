import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const catalog: Array<{ index: number; description: string; currentPoints: number; isBorrowed?: boolean }> = JSON.parse(
  fs.readFileSync(`${outDir}\\augmented_top12_catalog.json`, 'utf8')
);

// Read current solver weights from solve_top12_master.ts logic
// Let's create an explicit map of all rules and their calibrated points
const calibrationMap: Record<string, number> = {
  // Guardrails & Inactive Protective Rules
  "Seer score on underdog >= 45%": -25,
  "Seer score on draw >= 35%": -10,
  "Seer score on draw <= 20%": 15,
  "PAA, SubPattern, Algo, and ML agree on 12 hedge": -15,
  "PAA, SubPattern, and Algo agree on 12 hedge": -10,
  "Seer primary predicts on underdog": -20,
  "Underdog has >= 5 more points on point system": -15,
  "Algo final prediction is 1X/X2": 15,
  "Team A and Team B GS >= 2.0 and GA >= 1.0": -15,
  "Both teams GA > GS": -10,
  "Both teams GA >= 1.1 (volatile match)": 0,
  "Both teams GS < 1.0": 15,
  "Both teams GS < 1.0 and Both team GS <GA": 0,
  "Mfav TS >= 2.0 and Underdog TS < 0.7": 10,
  "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%": -10,
  "Mfav TS >= 3.0 and Ud TS < 0.8": 10,
  "Mfav TS 1.5-1.99 and Ud TS < 0.5": 5,
  "Mfav TS 1.0-1.50 and Ud TS < 0.8": -15,
  "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%": -10,
  "Odds for underdog >= 2.80 to 3.0": -5,
  "Odds for underdog < 2.8": -10,
  "Odds for draw is < 3.0": 10,
  "Odds for underdog <= odds for draw but >= 3.0": -10,
  "Odds for underdog <= odds for draw but between 2.8 to 3.0": 10,
  "Odds for underdog <= odds for draw but < 2.8": -15,
  "M.fav GA is > 0.6 points lower than Underdog GA": -15,
  "Mfav GA <= 1.0 but Underdog GA > 1.0": 15,
  "1X2 supports the underdog": 5,
  "Underdog GS < 1.0 but M.fav GS > 1.0": 10,
  "High Conviction Defense + Attack Dominance": 20,
  "Algo support for Mfav > 50%": 5,
  "Algo support for Mfav is 45-50%": 15,
  "Algo for Mfav support <40%": -5,
  "Underdog has hidden strength": 5,
  "Underdog has hidden weakness": -5,
  "M.fav has hidden strength": -15,
  "M.fav has hidden weakness": 5,
  "Volatile False Favorite Trap": -20,
  "Underdog GA >= 2.0": 0,
  "M.fav and Underdog TS difference <= 0.1": -10,
  "PAA, Seer, Algo, and ML agree on 1X/X2": 15,
  "PAA, Seer, and ML agree on 1X/X2": 5,
  "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2": 15,
  "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12": -10,
  "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": -5,
  "Point system has >= 70 points on M.fav": 5,
  "Point system has >= 60 to <70 points on M.fav": 5,
  "Point system has >= 50 to <60 points on M.fav": -10,
  "Banned: Upset risk and Banned: Draw risk tags": -10,
  "PHA on Mfav >= 70%": 20,
  "PHA on Mfav >= 60 to <70%": 10,
  "PHA on Mfav >= 55% to < 60%": 5,
  "PHA M.fav <= 40%": -10,
  "Underdog TS > M.fav TS": -15,
  "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength": 15,
  "Both teams GA >= 1.1 (volatile match) + Mfav TS 1.0-1.50 and Ud TS < 0.8": -15,
  "Sub pattern primary prediction supports the underdog": -20,
  "Algo primary prediction supports the underdog": -15,
  "Mfav TS >= 3.0 and Ud TS <= 1.7 and MFAV GS ≈ UND GS": -10,
  "Both team TS <= 1.0": -10,
  "Both team GS => 1.8": -15,
  "Underdog GA= >1.5 and GS =>1.8": -15,
  "Mfav GA=Und GA (+-0.2)": 0,
  "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA": -10,
  "Mfav GA>1.0 and Under Dog GA =>1.0": 0,
  "HGA=AGS + Equal GS": 10,
  "Equal GS + AGA=HGS + M.fav has hidden strength": -15,
  "Equal GS + AGA=HGS + M.fav has hidden weakness": -15,
  "A match has GS=GS=GA=GA": -10,
  "Both team TS difference less than 0.4": 0,
  "Both team TS difference less than 0.4 + Seer score on draw >= 35%": -10,
  "Both team TS difference less than 0.4 + PAA, SubPattern, Algo, and ML agree on 12 hedge + Odds for underdog <= odds for draw but >= 3.0": -15,
  "Both teams GA >= 1.1 (volatile match) + Odds for underdog <= odds for draw but >= 3.0": -15,
  "Away Favorite Razor Parity (Diff < 0.20)": -5,
  "High Favorite Odds (>= 2.50)": -10,
  "Point System Inversion (Underdog points > Favorite)": -15,
  "Mfav GS = Und Gs +-0.2": 10,
  "Banned: Upset risk tag": 0,
  "Match belongs to an african country league": -10,

  // Borrowed Rules (Top Win Drivers & Risk Suppressors)
  "LE was a draw+Underdog has hidden strength/weakness": 20,
  "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)": 15,
  "LE was a draw+ Mfav GA and GS =>1.8": 15,
  "Both teams GA > GS and Both team GS <=1.0": 10,
  "1X2 Rating =>7": 15,
  "Synergy: Both TS <= 1.0 + Pred 1X2 on M.fav": 10,
  "Mfav GS - Ud GS >= 1.0": 10,
  "LE, Underdog won the last encounter +Mfav L10= Und L10": -20,
  "Underdog was away on LE (Last encounter) and Won": -20,
  "LE was a draw+1X2R <= 2.5": -15,
  "Away favorite + Mfav GA <= 1.0 & Ud GA > 1.0": -10,
  "Mfav GS =>1.8 and GA =<1.0": -15
};

console.log('--- Checking all catalog rules ---');
let missing = 0;
catalog.forEach((r, idx) => {
  if (calibrationMap[r.description] === undefined) {
    console.log(`Missing calibration for [Idx ${idx}]: "${r.description}" (current: ${r.currentPoints})`);
    missing++;
  }
});

console.log(`Total catalog rules: ${catalog.length}. Missing: ${missing}`);
fs.writeFileSync(`${outDir}\\final_calibrated_map.json`, JSON.stringify(calibrationMap, null, 2));
