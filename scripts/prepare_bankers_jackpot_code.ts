import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rules: Array<{ description: string; points: number }> = JSON.parse(
  fs.readFileSync(`${outDir}\\final_calibrated_bj_rules.json`, 'utf8')
);

console.log(`Loaded ${rules.length} calibrated rules.`);

// 1. Generate rules array for CODE_DEFAULT_CATEGORY_SETTINGS.bankers_jackpot
const settingsRules = rules.map(r => `            { description: "${r.description}", points: ${r.points} }`).join(',\n');
const fullSettingsBlock = `        rules: [\n${settingsRules}\n        ]`;
fs.writeFileSync(`${outDir}\\bj_settings_block.txt`, fullSettingsBlock);

// 2. Generate dedicated evaluation block for bankers_jackpot
const evalLines: string[] = [];
evalLines.push("        } else if ((evalCategoryId || categoryId) === 'bankers_jackpot') {");
evalLines.push("            // Calibrated Dedicated Bankers Jackpot Evaluation (100 Rules)");
evalLines.push("            const underdogHiddenStrength_bj = underdogGS >= underdogGA && (Math.round(Math.abs(underdogGS - underdogGA) * 100) / 100 <= 0.2001);");
evalLines.push("            const mFavHiddenStrength_bj = mFavGS >= mFavGA && (Math.round(Math.abs(mFavGS - mFavGA) * 100) / 100 <= 0.2001);");
evalLines.push("            const mFavHiddenWeakness_bj = mFavGS < mFavGA && (Math.round(Math.abs(mFavGS - mFavGA) * 100) / 100 <= 0.2001);");
evalLines.push("");

// Loop through each rule and generate the exact evaluation condition
rules.forEach(r => {
  const d = r.description;
  const p = r.points;
  const lineAdd = `                totalScore += ${p};\n                rulesHit.push({ description: "${d}", points: ${p} });`;

  if (d === "LE was a draw") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (leWasDraw) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav L10= Und L10") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isL10Equal) {\n${lineAdd}\n            }\n`);
  } else if (d === "1X2R <= 2.5") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isRatingLessEq2_5) {\n${lineAdd}\n            }\n`);
  } else if (d === "LE was a draw + Mfav L10= Und L10 (+-1) + 1X2R <= 2.5") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (leWasDraw && isL10Close && isRatingLessEq2_5) {\n${lineAdd}\n            }\n`);
  } else if (d === "Underdog has hidden strength/weakness + 1X2R <= 2.5") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (underdogHiddenStrengthOrWeakness && isRatingLessEq2_5) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav GA <= 1.1 and Und GA > 1.1") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isMfavGaLe1_1AndUndGaGt1_1) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav GA <= 1.1 and Und GA > 1.1 + Mfav GS=Und GS (+-0.2)") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isMfavGaLe1_1AndUndGaGt1_1 && isMfavGsUndGsClose) {\n${lineAdd}\n            }\n`);
  } else if (d === "Both teams GA => 1.5") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isBothTeamsGaGe1_5) {\n${lineAdd}\n            }\n`);
  } else if (d === "1X2 rating(R) =>5 to <7") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isRating5to7) {\n${lineAdd}\n            }\n`);
  } else if (d === "1X2 Rating =>7") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isRatingGreaterEq7) {\n${lineAdd}\n            }\n`);
  } else if (d === "Match has U21,U20 Tag (youth league)") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isYouthLeague) {\n${lineAdd}\n            }\n`);
  } else if (d === "Youth league + Banned: Upset risk tag") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isYouthLeague && initialMatchTags.some(t => t.startsWith('BANNED:UPSET_RISK'))) {\n${lineAdd}\n            }\n`);
  } else if (d === "Match belong to sub pattern G2E5+Mfav GS - Ud GS >= 1.0") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isG2E5 && (mFavGS - underdogGS >= 1.0 - Number.EPSILON)) {\n${lineAdd}\n            }\n`);
  } else if (d === "Underdog has a higher L10 than Mfav") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (underdogHasHigherL10) {\n${lineAdd}\n            }\n`);
  } else if (d === "Seer score on draw >= 35% to <40%+Underdog has a higher L10 than Mfav") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (seerScoreDraw >= 35 && seerScoreDraw < 40 && underdogHasHigherL10) {\n${lineAdd}\n            }\n`);
  } else if (d === "PHA for draw and underdog => 20%") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (phaDrawPct >= 20 && phaUdPct >= 20) {\n${lineAdd}\n            }\n`);
  } else if (d === "PHA for draw and underdog => 20%+M.fav TS >= 2.0 and Underdog TS < 1.0") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (phaDrawPct >= 20 && phaUdPct >= 20 && favTS >= 2.0 && udTS < 1.0) {\n${lineAdd}\n            }\n`);
  } else if (d === "PHA for draw and underdog => 20%+PAA, SubPattern, Algo, and ML agree on 12 hedge") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (phaDrawPct >= 20 && phaUdPct >= 20 && isPaaSubAlgoMl12) {\n${lineAdd}\n            }\n`);
  } else if (d === "Paa fin, sub pattern fin and ML fin is 1X/X2 but Algo and Seer final is 12") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (is1XorX2(paaPred) && is1XorX2(subPred) && is1XorX2(mlPred) && algoPred === '12' && seerPred === '12') {\n${lineAdd}\n            }\n`);
  } else if (d === "All predictors fin prediction final 1X/X2 but algo final 12") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (is1XorX2(paaPred) && is1XorX2(subPred) && is1XorX2(mlPred) && is1XorX2(seerPred) && algoPred === '12') {\n${lineAdd}\n            }\n`);
  } else if (d === "Match belongs to israel premier league or other israel teams") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isIsraelMatch) {\n${lineAdd}\n            }\n`);
  } else if (d === "Seer score on draw >= 40% to <45%") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (seerScoreDraw >= 40) {\n${lineAdd}\n            }\n`);
  } else if (d === "Seer score on draw >= 35% to <40%") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (seerScoreDraw >= 35 && seerScoreDraw < 40) {\n${lineAdd}\n            }\n`);
  } else if (d === "Seer score on draw >= 30% to <35%") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (seerScoreDraw >= 30 && seerScoreDraw < 35) {\n${lineAdd}\n            }\n`);
  } else if (d === "Seer score on underdog >= 45%") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (seerScoreUd >= 45) {\n${lineAdd}\n            }\n`);
  } else if (d === "HGA=AGS + Equal GS") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isClose(gaHome, gsAway, 0.2) && isClose(gsHome, gsAway, 0.2)) {\n${lineAdd}\n            }\n`);
  } else if (d === "H.Bal + Equal GA + AGA=HGS+ M.fav GS>Uderdog GS with more than 0.5") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isClose(gsHome, gaHome, 0.2) && isClose(gaHome, gaAway, 0.2) && isClose(gaAway, gsHome, 0.2) && (mFavGS - underdogGS > 0.5)) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav GS ≥1.1 over Ud GS") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (mFavGS - underdogGS >= 1.1 - Number.EPSILON) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav GS ≥0.8 to <1.1 over Ud GS") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (mFavGS - underdogGS >= 0.8 - Number.EPSILON && mFavGS - underdogGS < 1.1 - Number.EPSILON) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav GS ≥0.5 but <0.8 over Ud GS") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (mFavGS - underdogGS >= 0.5 - Number.EPSILON && mFavGS - underdogGS < 0.8 - Number.EPSILON) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav GS ≥0.1 to <0.5 over Ud GS") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (mFavGS - underdogGS >= 0.1 - Number.EPSILON && mFavGS - underdogGS < 0.5 - Number.EPSILON) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav GA= Und GA (+-0.2)") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (Math.abs(mFavGA - underdogGA) <= 0.2 + Number.EPSILON) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav GS=Underdog GS (+-0.2)") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (Math.abs(mFavGS - underdogGS) <= 0.2 + Number.EPSILON) {\n${lineAdd}\n            }\n`);
  } else if (d === "Underdog GA >= 2.0") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (underdogGA >= 2.0 - Number.EPSILON) {\n${lineAdd}\n            }\n`);
  } else if (d === "Both teams GA > GS") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (bothTeamsGAGreaterThanGS) {\n${lineAdd}\n            }\n`);
  } else if (d === "Both teams GA > GS and Both team GS <=1.0") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (bothTeamsGAGreaterThanGS && gsHome <= 1.0 && gsAway <= 1.0) {\n${lineAdd}\n            }\n`);
  } else if (d === "Volatile match + Both teams GA > GS") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isVolatile && bothTeamsGAGreaterThanGS) {\n${lineAdd}\n            }\n`);
  } else if (d === "Away favorite") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isAwayFav) {\n${lineAdd}\n            }\n`);
  } else if (d === "Away favorite + Mfav GA <= 1.0 & Ud GA > 1.0") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isAwayFav && mFavGA <= 1.0 && underdogGA > 1.0) {\n${lineAdd}\n            }\n`);
  } else if (d === "Away favorite + M.fav and Underdog TS difference <= 0.1") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isAwayFav && Math.abs(favTS - udTS) <= 0.1) {\n${lineAdd}\n            }\n`);
  } else if (d === "Both teams GS < 1.0") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (gsHome < 1.0 && gsAway < 1.0) {\n${lineAdd}\n            }\n`);
  } else if (d === "Underdog GS < 1.0 but M.fav GS > 1.0") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (underdogGS < 1.0 && mFavGS > 1.0) {\n${lineAdd}\n            }\n`);
  } else if (d === "Underdog GS <= 1.0 but M.fav GS > 2.0") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (underdogGS <= 1.0 && mFavGS > 2.0) {\n${lineAdd}\n            }\n`);
  } else if (d === "Both team GS => 1.8") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (gsHome >= 1.8 - Number.EPSILON && gsAway >= 1.8 - Number.EPSILON) {\n${lineAdd}\n            }\n`);
  } else if (d === "M.fav TS >= 2.0 and Underdog TS < 1.0") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (favTS >= 2.0 && udTS < 1.0) {\n${lineAdd}\n            }\n`);
  } else if (d === "M.fav TS >= 2.0 & Ud TS < 1.0 + Odds Ud <= Draw") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (favTS >= 2.0 && udTS < 1.0 && oddsUnderdogLessEqDraw) {\n${lineAdd}\n            }\n`);
  } else if (d === "M.fav TS >= 3.0 and Underdog TS < 1.0") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (favTS >= 3.0 && udTS < 1.0) {\n${lineAdd}\n            }\n`);
  } else if (d === "M.fav TS >= 3.0 and Underdog TS < 1.0+Underdog has hidden strength/weakness") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (favTS >= 2.995 && udTS < 1.005 && underdogHiddenStrengthOrWeakness) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav TS 1.0-1.50 and Ud TS < 0.8") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (favTS >= 1.0 && favTS <= 1.50 && udTS < 0.8) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav TS 1.0-1.50 and Ud TS < 0.8+Underdog has hidden strength/weakness") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (favTS >= 1.0 && favTS <= 1.50 && udTS < 0.8 && underdogHiddenStrengthOrWeakness) {\n${lineAdd}\n            }\n`);
  } else if (d === "Seer score on draw >= 35% + Mfav TS 1.0-1.50 and Ud TS < 0.8") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (seerScoreDraw >= 35 && (favTS >= 1.0 && favTS <= 1.50 && udTS < 0.8)) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav TS 1.0-1.50 and Ud TS < 0.8 + Banned: Upset risk tag") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (favTS >= 1.0 && favTS <= 1.50 && udTS < 0.8 && initialMatchTags.some(t => t.startsWith('BANNED:UPSET_RISK'))) {\n${lineAdd}\n            }\n`);
  } else if (d === "Underdog TS > M.fav TS") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (udTS > favTS) {\n${lineAdd}\n            }\n`);
  } else if (d === "M.fav and Underdog TS difference <= 0.1") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (Math.abs(favTS - udTS) <= 0.1) {\n${lineAdd}\n            }\n`);
  } else if (d === "Banned: Upset risk tag") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (initialMatchTags.some(t => t.startsWith('BANNED:UPSET_RISK'))) {\n${lineAdd}\n            }\n`);
  } else if (d === "Point system has >= 70 points on M.fav") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (mFavPoints >= 70) {\n${lineAdd}\n            }\n`);
  } else if (d === "Point system has >= 60 to <70 points on M.fav") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (mFavPoints >= 60 && mFavPoints < 70) {\n${lineAdd}\n            }\n`);
  } else if (d === "Point system has >= 50 to <60 points on M.fav") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (mFavPoints >= 50 && mFavPoints < 60) {\n${lineAdd}\n            }\n`);
  } else if (d === "Underdog has >= 5 more points on point system") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (udPoints - mFavPoints >= 5) {\n${lineAdd}\n            }\n`);
  } else if (d === "Seer primary predicts on underdog") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (seerPrimPred.includes(underdog)) {\n${lineAdd}\n            }\n`);
  } else if (d === "Sub pattern primary prediction supports the underdog") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (subPrimPred.includes(underdog)) {\n${lineAdd}\n            }\n`);
  } else if (d === "Algo primary prediction supports the underdog") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (algoPrimPred.includes(underdog)) {\n${lineAdd}\n            }\n`);
  } else if (d === "1X2 supports the underdog") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (pred1x2.includes(underdog)) {\n${lineAdd}\n            }\n`);
  } else if (d === "1X2 supports 1X/X2") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (is1XorX2(pred1x2)) {\n${lineAdd}\n            }\n`);
  } else if (d === "Algo Mfav >=60%") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (algoPercentage >= 60) {\n${lineAdd}\n            }\n`);
  } else if (d === "Algo Mfav =>50% to <60%") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (algoPercentage >= 50 && algoPercentage < 60) {\n${lineAdd}\n            }\n`);
  } else if (d === "Algo for Mfav support <40%") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (algoPercentage > 0 && algoPercentage < 40) {\n${lineAdd}\n            }\n`);
  } else if (d === "Underdog has hidden strength/weakness") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (underdogHiddenStrengthOrWeakness) {\n${lineAdd}\n            }\n`);
  } else if (d === "M.fav has hidden strength") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (mFavHiddenStrength_bj) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav has hidden weakness") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (mFavHiddenWeakness_bj) {\n${lineAdd}\n            }\n`);
  } else if (d === "Synergy: Both TS <= 1.0 + Point system >= 60 on M.fav + Ud GS < 1.0 & Mfav GS > 1.0") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (favTS <= 1.0 && udTS <= 1.0 && mFavPoints >= 60 && (underdogGS < 1.0 && mFavGS > 1.0)) {\n${lineAdd}\n            }\n`);
  } else if (d === "Synergy: Point system >= 60 on M.fav + Ud GS < 1.0 & Mfav GS > 1.0 + Ud GA >= 2.0") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (mFavPoints >= 60 && (underdogGS < 1.0 && mFavGS > 1.0) && underdogGA >= 2.0) {\n${lineAdd}\n            }\n`);
  } else if (d === "Synergy: Point system >= 60 on M.fav + Mfav GS - Ud GS >= 1.0 + Fav odds < 1.80") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (mFavPoints >= 60 && (mFavGS - underdogGS >= 1.0) && favOdds > 0 && favOdds < 1.80) {\n${lineAdd}\n            }\n`);
  } else if (d === "Synergy: PAA s.win 55% to <70% + M.fav hidden strength") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (effPaaWin >= 55 && effPaaWin < 70 && mFavHiddenStrength_bj) {\n${lineAdd}\n            }\n`);
  } else if (d === "Synergy: PAA s.win 55% to <70% + Mfav GS - Ud GS >= 0.5 + Ud hidden strength") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (effPaaWin >= 55 && effPaaWin < 70 && (mFavGS - underdogGS >= 0.5) && underdogHiddenStrength_bj) {\n${lineAdd}\n            }\n`);
  } else if (d === "Synergy: PAA s.win 55% to <70% + Mfav GS - Ud GS >= 1.0 + Fav odds < 1.80") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (effPaaWin >= 55 && effPaaWin < 70 && (mFavGS - underdogGS >= 1.0) && favOdds > 0 && favOdds < 1.80) {\n${lineAdd}\n            }\n`);
  } else if (d === "Synergy: Both TS <= 1.0 + Volatile match + Draw odds < 3.20") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (favTS <= 1.0 && udTS <= 1.0 && isVolatile && oX > 0 && oX < 3.20) {\n${lineAdd}\n            }\n`);
  } else if (d === "PHA M.fav <= 40%") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (effPaaWin > 0 && effPaaWin <= 40) {\n${lineAdd}\n            }\n`);
  } else if (d === "PAA s.win =>70%") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (effPaaWin >= 70) {\n${lineAdd}\n            }\n`);
  } else if (d === "PAA s.win =55% to <70%") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (effPaaWin >= 55 && effPaaWin < 70) {\n${lineAdd}\n            }\n`);
  } else if (d === "Odds for underdog < 3.0") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (udOdds > 0 && udOdds < 3.0) {\n${lineAdd}\n            }\n`);
  } else if (d === "PAA, SubPattern, Algo, and ML agree on 12 hedge+Both teams GA >= 1.1 (volatile match)+Both teams GA > GS") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (paaPred === '12' && subPred === '12' && algoPred === '12' && mlPred === '12' && isVolatile && bothTeamsGAGreaterThanGS) {\n${lineAdd}\n            }\n`);
  } else if (d === "PAA, SubPattern, Algo, and ML agree on 12 hedge") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (paaPred === '12' && subPred === '12' && algoPred === '12' && mlPred === '12' && !(isVolatile && bothTeamsGAGreaterThanGS)) {\n${lineAdd}\n            }\n`);
  } else if (d === "PAA, Seer, Algo, and ML agree on 1X/X2") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (is1XorX2(paaPred) && is1XorX2(seerPred) && is1XorX2(mlPred) && is1XorX2(algoPred)) {\n${lineAdd}\n            }\n`);
  } else if (d === "A match has GS=GS=GA=GA") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isGSGAGA) {\n${lineAdd}\n            }\n`);
  } else if (d === "Match has PHA tie") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (isPhaTie) {\n${lineAdd}\n            }\n`);
  } else if (d === "LE (Last encounter) Underdog won with and scored 2 goals or more") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (leData && leData.underdogWon && leData.underdogGoals >= 2) {\n${lineAdd}\n            }\n`);
  } else if (d === "LE (Last encounter) Underdog won with and scored 2 goals or more+ Seer score on draw >= 40%") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (leData && leData.underdogWon && leData.underdogGoals >= 2 && seerScoreDraw >= 40) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav was away on LE (Last encounter) and Won with 2 or more goals") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (leData && leData.mFavWasAway && leData.mFavWon && leData.mFavGoals >= 2) {\n${lineAdd}\n            }\n`);
  } else if (d === "Underdog was away on LE (Last encounter) and Won") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (leData && leData.underdogWasAway && leData.underdogWon) {\n${lineAdd}\n            }\n`);
  } else if (d === "Underdog was Home on LE and still playing at Home") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (leData && !leData.underdogWasAway && underdog === '1') {\n${lineAdd}\n            }\n`);
  } else if (d === "Both Teams GA > 2.0") {
    evalLines.push(`            // ${d} = ${p} points (Borrowed from BB & BDL)`);
    evalLines.push(`            if (gaHome > 2.0 - Number.EPSILON && gaAway > 2.0 - Number.EPSILON) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav L10 >Underdog L10 with >2") {
    evalLines.push(`            // ${d} = ${p} points (Borrowed from BB & BDL)`);
    evalLines.push(`            if (hasValidL10 && mFavL10 - underdogL10 > 2) {\n${lineAdd}\n            }\n`);
  } else if (d === "LE was a draw+ Mfav GA and GS =>1.8") {
    evalLines.push(`            // ${d} = ${p} points (Borrowed from BB & BDL)`);
    evalLines.push(`            if (leWasDraw && mFavGA >= 1.8 - Number.EPSILON && mFavGS >= 1.8 - Number.EPSILON) {\n${lineAdd}\n            }\n`);
  } else if (d === "Synergy: TS diff >= 1.0 + Ud GA >= 2.0 + Odds Ud <= Draw") {
    evalLines.push(`            // ${d} = ${p} points (Borrowed from BB & BDL)`);
    evalLines.push(`            if ((favTS - udTS >= 1.0 - Number.EPSILON) && (underdogGA >= 2.0 - Number.EPSILON) && oddsUnderdogLessEqDraw) {\n${lineAdd}\n            }\n`);
  } else if (d === "LE, Underdog won the last encounter +Mfav L10= Und L10") {
    evalLines.push(`            // ${d} = ${p} points (Borrowed from BB & BDL)`);
    evalLines.push(`            if (leData && leData.underdogWon && isL10Equal) {\n${lineAdd}\n            }\n`);
  } else if (d === "Synergy: Mfav GS - Ud GS >= 0.5 + M.fav hidden strength") {
    evalLines.push(`            // ${d} = ${p} points (Borrowed from BB & BDL)`);
    evalLines.push(`            if ((mFavGS - underdogGS >= 0.5 - Number.EPSILON) && mFavHiddenStrength_bj) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav L10 > Underdog L10 with <=2 + R(1X2 rating)<3.0") {
    evalLines.push(`            // ${d} = ${p} points (Borrowed from BB & BDL)`);
    evalLines.push(`            if (hasValidL10 && (mFavL10 - underdogL10 <= 2) && isRatingLessEq2_5) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav GA= Und GA (+-0.2) +Mfav TS 1.0-1.50 and Ud TS < 0.8") {
    evalLines.push(`            // ${d} = ${p} points (Borrowed from BB & BDL)`);
    evalLines.push(`            if (Math.abs(mFavGA - underdogGA) <= 0.2 + Number.EPSILON && (favTS >= 1.0 && favTS <= 1.50 && udTS < 0.8)) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav GS=Underdog GS (+-0.2) + M.fav has hidden strength") {
    evalLines.push(`            // ${d} = ${p} points (Borrowed from BB & BDL)`);
    evalLines.push(`            if (Math.abs(mFavGS - underdogGS) <= 0.2 + Number.EPSILON && mFavHiddenStrength_bj) {\n${lineAdd}\n            }\n`);
  } else if (d === "Mfav TS >= 3.0 and Ud TS < 0.8") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (favTS >= 3.0 && udTS < 0.8) {\n${lineAdd}\n            }\n`);
  } else if (d === "M.fav TS >= 2.0 and Underdog TS < 1.0+All predictors fin prediction final 1X/X2 but algo final 12") {
    evalLines.push(`            // ${d} = ${p} points`);
    evalLines.push(`            if (favTS >= 2.0 && udTS < 1.0 && is1XorX2(paaPred) && is1XorX2(subPred) && is1XorX2(mlPred) && is1XorX2(seerPred) && algoPred === '12') {\n${lineAdd}\n            }\n`);
  } else {
    console.warn("Unmatched rule in generation:", d);
  }
});

const fullEvalBlock = evalLines.join('\n');
fs.writeFileSync(`${outDir}\\bj_eval_block.txt`, fullEvalBlock);
console.log(`Generated full dedicated eval block for Bankers Jackpot, length: ${fullEvalBlock.length}`);
