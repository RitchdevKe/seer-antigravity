import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const catalog: Array<{ index: number; description: string; currentPoints: number; isBorrowed?: boolean }> = JSON.parse(
  fs.readFileSync(`${outDir}\\augmented_top12_catalog.json`, 'utf8')
);

// Final calibrated point schedule (strictly clean multiples of 5, between -25 and +20)
const calibratedPoints: Record<string, number> = {
  // Native Rules
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
  "Odds for underdog < 2.8": -15,
  "Odds for draw is < 3.0": 10,
  "Odds for underdog <= odds for draw but >= 3.0": -10,
  "Odds for underdog <= odds for draw but between 2.8 to 3.0": 10,
  "Odds for underdog <= odds for draw but < 2.8": -15,
  "M.fav GA is > 0.6 points lower than Underdog GA": -15,
  "Mfav GA <= 1.0 but Underdog GA > 1.0": 15,
  "1X2 supports the underdog": 5,
  "Underdog GS < 1.0 but M.fav GS > 1.0": 10,
  "High Conviction Defense + Attack Dominance": 20,
  "Algo support for Mfav > 50%": 10,
  "Algo support for Mfav is 45-50%": 15,
  "Algo for Mfav support <40%": -5,
  "Underdog has hidden strength": 5,
  "Underdog has hidden weakness": -5,
  "M.fav has hidden strength": -15,
  "M.fav has hidden weakness": 5,
  "Volatile False Favorite Trap": -25,
  "Underdog GA >= 2.0": 0,
  "M.fav and Underdog TS difference <= 0.1": -10,
  "PAA, Seer, Algo, and ML agree on 1X/X2": 15,
  "PAA, Seer, and ML agree on 1X/X2": 5,
  "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2": 15,
  "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12": -10,
  "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12": -5,
  "Point system has >= 70 points on M.fav": 15,
  "Point system has >= 60 to <70 points on M.fav": 5,
  "Point system has >= 50 to <60 points on M.fav": -10,
  "Banned: Upset risk and Banned: Draw risk tags": -20,
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
  "Equal GS + AGA=HGS + M.fav has hidden weakness": -10,
  "A match has GS=GS=GA=GA": -10,
  "Both team TS difference less than 0.4": 0,
  "Both team TS difference less than 0.4 + Seer score on draw >= 35%": -10,
  "Both team TS difference less than 0.4 + PAA, SubPattern, Algo, and ML agree on 12 hedge + Odds for underdog <= odds for draw but >= 3.0": -15,
  "Both teams GA >= 1.1 (volatile match) + Odds for underdog <= odds for draw but >= 3.0": -15,
  "Away Favorite Razor Parity (Diff < 0.20)": -5,
  "High Favorite Odds (>= 2.50)": -15,
  "Point System Inversion (Underdog points > Favorite)": -15,
  "Mfav GS = Und Gs +-0.2": 10,
  "Banned: Upset risk tag": -15,
  "Match belongs to an african country league": -10,

  // Borrowed Win Drivers & Risk Suppressors
  "LE was a draw+Underdog has hidden strength/weakness": 20,
  "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)": 15,
  "LE was a draw+ Mfav GA and GS =>1.8": 15,
  "Both teams GA > GS and Both team GS <=1.0": 10,
  "1X2 Rating =>7": 15,
  "Synergy: Both TS <= 1.0 + Pred 1X2 on M.fav": 10,
  "Mfav GS - Ud GS >= 1.0": 10,
  "LE was a draw": 5,
  "LE, Underdog won the last encounter +Mfav L10= Und L10": -20,
  "Underdog was away on LE (Last encounter) and Won": -20,
  "LE was a draw+1X2R <= 2.5": -15,
  "Mfav GS =>1.8 and GA =<1.0": -15,
  "Away favorite + Mfav GA <= 1.0 & Ud GA > 1.0": -10
};

// 1. Build the Settings block (JSON array of rules)
const settingsRules = Object.entries(calibratedPoints).map(([description, points]) => {
  return `            { description: "${description}", points: ${points} }`;
});

const settingsBlock = `        rules: [\n${settingsRules.join(',\n')}\n        ]`;
fs.writeFileSync(`${outDir}\\top12_settings_block.txt`, settingsBlock);
console.log(`Saved settings block with ${settingsRules.length} rules to scratch/top12_settings_block.txt`);

// 2. Build the Evaluation block
const evalBlock = `        // Dynamic rule evaluations
        if ((evalCategoryId || categoryId) === 'top_10_value') {
            
            if (isAfricanLeagueMatch) {
                totalScore += -10;
                rulesHit.push({ description: "Match belongs to an african country league", points: -10 });
            }

            if (seerScoreUd >= 45) {
                totalScore += -25;
                rulesHit.push({ description: "Seer score on underdog >= 45%", points: -25 });
            }

            if (seerScoreDraw >= 35) {
                totalScore += -10;
                rulesHit.push({ description: "Seer score on draw >= 35%", points: -10 });
            } else if (seerScoreDraw > 0 && seerScoreDraw <= 20) {
                totalScore += 15;
                rulesHit.push({ description: "Seer score on draw <= 20%", points: 15 });
            } else if (seerScoreDraw <= 20) {
                // Fallback when seerScoreDraw is unpopulated but <= 20
                totalScore += 15;
                rulesHit.push({ description: "Seer score on draw <= 20%", points: 15 });
            }
            
            if (seerPrimPred.includes(underdog)) {
                totalScore += -20;
                rulesHit.push({ description: "Seer primary predicts on underdog", points: -20 });
            }
            
            if (udPoints - mFavPoints >= 5) {
                totalScore += -15;
                rulesHit.push({ description: "Underdog has >= 5 more points on point system", points: -15 });
            }

            if (mFavPoints >= 70) {
                totalScore += 15;
                rulesHit.push({ description: "Point system has >= 70 points on M.fav", points: 15 });
            } else if (mFavPoints >= 60) {
                totalScore += 5;
                rulesHit.push({ description: "Point system has >= 60 to <70 points on M.fav", points: 5 });
            } else if (mFavPoints >= 50) {
                totalScore += -10;
                rulesHit.push({ description: "Point system has >= 50 to <60 points on M.fav", points: -10 });
            }

            if (favTS <= 1.0 && udTS <= 1.0) {
                totalScore += -10;
                rulesHit.push({ description: "Both team TS <= 1.0", points: -10 });
            }

            if (Math.abs(favTS - udTS) < 0.4) {
                totalScore += 0;
                rulesHit.push({ description: "Both team TS difference less than 0.4", points: 0 });
            }

            if (Math.abs(favTS - udTS) <= 0.1) {
                totalScore += -10;
                rulesHit.push({ description: "M.fav and Underdog TS difference <= 0.1", points: -10 });
            }

            if (Math.abs(favTS - udTS) < 0.4 && seerScoreDraw >= 35) {
                totalScore += -10;
                rulesHit.push({ description: "Both team TS difference less than 0.4 + Seer score on draw >= 35%", points: -10 });
            }

            if (Math.abs(favTS - udTS) < 0.4 && (paaPred === '12' && subPred === '12' && algoPred === '12' && mlPred === '12') && (oddsUnderdogLessEqDraw && udOdds >= 3.0)) {
                totalScore += -15;
                rulesHit.push({ description: "Both team TS difference less than 0.4 + PAA, SubPattern, Algo, and ML agree on 12 hedge + Odds for underdog <= odds for draw but >= 3.0", points: -15 });
            }

            if (gsHome >= 1.8 && gsAway >= 1.8) {
                totalScore += -15;
                rulesHit.push({ description: "Both team GS => 1.8", points: -15 });
            }

            if (underdogGA > 1.5 && underdogGS >= 1.8) {
                totalScore += -15;
                rulesHit.push({ description: "Underdog GA= >1.5 and GS =>1.8", points: -15 });
            }

            if (Math.abs(mFavGA - underdogGA) <= 0.2) {
                totalScore += 0;
                rulesHit.push({ description: "Mfav GA=Und GA (+-0.2)", points: 0 });
            }

            if (Math.abs(mFavGS - underdogGS) <= 0.2 && mFavGA >= underdogGA) {
                totalScore += -10;
                rulesHit.push({ description: "Mfav GS=Und GS (+-0.2)+Mfav GA=>Und GA", points: -10 });
            }

            if (mFavGA > 1.0 && underdogGA >= 1.0) {
                totalScore += 0;
                rulesHit.push({ description: "Mfav GA>1.0 and Under Dog GA =>1.0", points: 0 });
            }

            if (initialMatchTags.includes('BANNED:UPSET_RISK') && initialMatchTags.includes('BANNED:DRAW_RISK')) {
                totalScore -= 20;
                rulesHit.push({ description: "Banned: Upset risk and Banned: Draw risk tags", points: -20 });
            }

            if (initialMatchTags.some(t => t.startsWith('BANNED:UPSET_RISK'))) {
                totalScore += -15;
                rulesHit.push({ description: "Banned: Upset risk tag", points: -15 });
            }

            if (Math.abs(mFavGS - underdogGS) <= 0.2 && !(mFavGA >= underdogGA)) {
                totalScore += 10;
                rulesHit.push({ description: "Mfav GS = Und Gs +-0.2", points: 10 });
            }

            if (gsHome >= 2.0 && gsAway >= 2.0 && gaHome >= 1.0 && gaAway >= 1.0) {
                totalScore += -15;
                rulesHit.push({ description: "Team A and Team B GS >= 2.0 and GA >= 1.0", points: -15 });
            }

            if (bothTeamsGAGreaterThanGS) {
                totalScore += -10;
                rulesHit.push({ description: "Both teams GA > GS", points: -10 });
            }
            
            if (isVolatile) {
                totalScore += 0;
                rulesHit.push({ description: "Both teams GA >= 1.1 (volatile match)", points: 0 });
            }

            if (isVolatile && oddsUnderdogLessEqDraw && udOdds >= 3.0) {
                totalScore += -15;
                rulesHit.push({ description: "Both teams GA >= 1.1 (volatile match) + Odds for underdog <= odds for draw but >= 3.0", points: -15 });
            }

            if (isVolatile && (favTS >= 1.0 && favTS <= 1.50 && udTS < 0.8)) {
                totalScore += -15;
                rulesHit.push({ description: "Both teams GA >= 1.1 (volatile match) + Mfav TS 1.0-1.50 and Ud TS < 0.8", points: -15 });
            }

            if (isAwayFav && oddsDiff < 0.20) {
                totalScore += -5;
                rulesHit.push({ description: "Away Favorite Razor Parity (Diff < 0.20)", points: -5 });
            }

            if (favOdds >= 2.50) {
                totalScore += -15;
                rulesHit.push({ description: "High Favorite Odds (>= 2.50)", points: -15 });
            }

            if (udPoints > mFavPoints && udPoints > 0) {
                totalScore += -15;
                rulesHit.push({ description: "Point System Inversion (Underdog points > Favorite)", points: -15 });
            }

            if (gsHome < 1.0 && gsAway < 1.0) {
                totalScore += 15;
                rulesHit.push({ description: "Both teams GS < 1.0", points: 15 });
            }

            if (gsHome < 1.0 && gsAway < 1.0 && bothTeamsGAGreaterThanGS) {
                totalScore += 0;
                rulesHit.push({ description: "Both teams GS < 1.0 and Both team GS <GA", points: 0 });
            }
            
            if (favTS >= 3.0 && udTS < 0.8) {
                totalScore += 10;
                rulesHit.push({ description: "Mfav TS >= 3.0 and Ud TS < 0.8", points: 10 });
            }
            if (favTS >= 2.0 && udTS < 0.7) {
                totalScore += 10;
                rulesHit.push({ description: "Mfav TS >= 2.0 and Underdog TS < 0.7", points: 10 });
            }
            if (favTS >= 2.0 && udTS < 0.7 && seerScoreDraw >= 35) {
                totalScore += -10;
                rulesHit.push({ description: "Mfav TS >= 2.0 and Underdog TS < 0.7 + Seer score on draw >= 35%", points: -10 });
            }
            if (favTS >= 3.0 && udTS <= 1.7 && Math.abs(mFavGS - underdogGS) <= 0.2) {
                totalScore += -10;
                rulesHit.push({ description: "Mfav TS >= 3.0 and Ud TS <= 1.7 and MFAV GS ≈ UND GS", points: -10 });
            }
            if (favTS >= 1.5 && favTS < 2.0 && udTS < 0.5) {
                totalScore += 5;
                rulesHit.push({ description: "Mfav TS 1.5-1.99 and Ud TS < 0.5", points: 5 });
            }
            if (favTS >= 1.0 && favTS <= 1.50 && udTS < 0.8) {
                totalScore += -15;
                rulesHit.push({ description: "Mfav TS 1.0-1.50 and Ud TS < 0.8", points: -15 });
            }
            
            if (subPrimPred.includes(underdog)) {
                totalScore += -20;
                rulesHit.push({ description: "Sub pattern primary prediction supports the underdog", points: -20 });
            }
            
            if (algoPrimPred.includes(underdog)) {
                totalScore += -15;
                rulesHit.push({ description: "Algo primary prediction supports the underdog", points: -15 });
            }
            
            if (paaPred === '12' && subPred === '12' && algoPred === '12') {
                if (mlPred === '12') {
                    totalScore += -15;
                    rulesHit.push({ description: "PAA, SubPattern, Algo, and ML agree on 12 hedge", points: -15 });
                } else {
                    totalScore += -10;
                    rulesHit.push({ description: "PAA, SubPattern, and Algo agree on 12 hedge", points: -10 });
                }
            }
            
            // 1X/X2 Consensus Group
            const isAllAgree = is1XorX2(algoPred) && is1XorX2(seerPred) && is1XorX2(paaPred) && is1XorX2(subPred);
            const isPaaSeerAlgoMlAgree = is1XorX2(paaPred) && is1XorX2(seerPred) && is1XorX2(mlPred) && is1XorX2(algoPred);
            const isPaaSeerMlAgree = is1XorX2(paaPred) && is1XorX2(seerPred) && is1XorX2(mlPred);
            const isAlgoFinal1XorX2 = algoPred === '1X' || algoPred === 'X2';

            if (isAllAgree || isPaaSeerAlgoMlAgree || isPaaSeerMlAgree || isAlgoFinal1XorX2) {
                if (isAllAgree) {
                    totalScore += 15;
                    rulesHit.push({ description: "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2", points: 15 });
                } else if (isPaaSeerAlgoMlAgree) {
                    totalScore += 15;
                    rulesHit.push({ description: "PAA, Seer, Algo, and ML agree on 1X/X2", points: 15 });
                } else if (isPaaSeerMlAgree) {
                    totalScore += 5;
                    rulesHit.push({ description: "PAA, Seer, and ML agree on 1X/X2", points: 5 });
                } else {
                    totalScore += 15;
                    rulesHit.push({ description: "Algo final prediction is 1X/X2", points: 15 });
                }
            }
            
            if (is1XorX2(algoPred) && is1XorX2(seerPred) && is1XorX2(mlPred) && paaPred === '12' && subPred === '12') {
                totalScore += -10;
                rulesHit.push({ description: "Algo,seer,and ML final agree on 1X/X2 But PAA and Sub pattern final is 12", points: -10 });
            }

            if (is1XorX2(paaPred) && is1XorX2(seerPred) && is1XorX2(mlPred) && subPred === '12' && algoPred === '12') {
                totalScore += -5;
                rulesHit.push({ description: "PAA, ML and seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -5 });
            }
            
            if (oddsUnderdogLessEqDraw) {
                if (udOdds >= 3.0) {
                    totalScore += -10;
                    rulesHit.push({ description: "Odds for underdog <= odds for draw but >= 3.0", points: -10 });
                } else if (udOdds >= 2.8) {
                    totalScore += 10;
                    rulesHit.push({ description: "Odds for underdog <= odds for draw but between 2.8 to 3.0", points: 10 });
                } else {
                    totalScore += -15;
                    rulesHit.push({ description: "Odds for underdog <= odds for draw but < 2.8", points: -15 });
                }
            } else if (udOdds > 0) {
                if (udOdds >= 2.8 && udOdds < 3.0) {
                    totalScore += -5;
                    rulesHit.push({ description: "Odds for underdog >= 2.80 to 3.0", points: -5 });
                } else if (udOdds < 2.8) {
                    totalScore += -15;
                    rulesHit.push({ description: "Odds for underdog < 2.8", points: -15 });
                }
            }
            
            if (oX > 0 && oX < 3.0) {
                totalScore += 10;
                rulesHit.push({ description: "Odds for draw is < 3.0", points: 10 });
            }
            
            if (underdogGA - mFavGA > 0.6) {
                if (!bothTeamsGAGreaterThanGS && !oddsUnderdogLessEqDraw) {
                    totalScore += -15; 
                    rulesHit.push({ description: "M.fav GA is > 0.6 points lower than Underdog GA", points: -15 });
                }
            }
            
            if (mFavGA <= 1.0 && underdogGA > 1.0) {
                totalScore += 15;
                rulesHit.push({ description: "Mfav GA <= 1.0 but Underdog GA > 1.0", points: 15 });
            }

            if (underdogGA >= 2.0) {
                if (!bothTeamsGAGreaterThanGS && !oddsUnderdogLessEqDraw) {
                    totalScore += 0; 
                    rulesHit.push({ description: "Underdog GA >= 2.0", points: 0 });
                }
            }

            if (pred1x2.includes(underdog)) {
                totalScore += 5;
                rulesHit.push({ description: "1X2 supports the underdog", points: 5 });
            }

            if (underdogGS < 1.0 && mFavGS > 1.0) {
                totalScore += 10;
                rulesHit.push({ description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: 10 });
            }

            // Compound Synergy: High Conviction Defense + Attack Dominance
            if (mFavGA <= 1.0 && underdogGA > 1.0 && underdogGS < 1.0 && mFavGS > 1.0) {
                totalScore += 20;
                rulesHit.push({ description: "High Conviction Defense + Attack Dominance", points: 20 });
            }

            if (algoPercentage > 50) {
                totalScore += 10;
                rulesHit.push({ description: "Algo support for Mfav > 50%", points: 10 });
            } else if (algoPercentage >= 45 && algoPercentage <= 50) {
                totalScore += 15;
                rulesHit.push({ description: "Algo support for Mfav is 45-50%", points: 15 });
            } else if (algoPercentage > 0 && algoPercentage < 40) {
                totalScore += -5;
                rulesHit.push({ description: "Algo for Mfav support <40%", points: -5 });
            }

            // Hidden Strength & Weakness evaluations
            const underdogHiddenStrength = underdogGS >= underdogGA && Math.abs(underdogGS - underdogGA) <= 0.2;
            const mFavHiddenStrength = mFavGS >= mFavGA && Math.abs(mFavGS - mFavGA) <= 0.2;
            const underdogHiddenWeakness = underdogGS < underdogGA && Math.abs(underdogGS - underdogGA) <= 0.2;
            const mFavHiddenWeakness = mFavGS < mFavGA && Math.abs(mFavGS - mFavGA) <= 0.2;
            
            if (underdogHiddenStrength) {
                totalScore += 5;
                rulesHit.push({ description: "Underdog has hidden strength", points: 5 });
            }
            if (underdogHiddenWeakness) {
                totalScore += -5;
                rulesHit.push({ description: "Underdog has hidden weakness", points: -5 });
            }
            if (mFavHiddenStrength) {
                if (isVolatile && oddsUnderdogLessEqDraw && udOdds >= 3.0) {
                    totalScore += -25;
                    rulesHit.push({ description: "Volatile False Favorite Trap", points: -25 });
                } else {
                    totalScore += -15;
                    rulesHit.push({ description: "M.fav has hidden strength", points: -15 });
                }
            }
            if (mFavHiddenWeakness) {
                totalScore += 5;
                rulesHit.push({ description: "M.fav has hidden weakness", points: 5 });
            }

            if (baseInfo.phaPercentage > 0 && baseInfo.phaPercentage <= 40) {
                totalScore += -10;
                rulesHit.push({ description: "PHA M.fav <= 40%", points: -10 });
            }
            if (baseInfo.phaPercentage >= 70) {
                totalScore += 20;
                rulesHit.push({ description: "PHA on Mfav >= 70%", points: 20 });
            } else if (baseInfo.phaPercentage >= 60) {
                totalScore += 10;
                rulesHit.push({ description: "PHA on Mfav >= 60 to <70%", points: 10 });
            } else if (baseInfo.phaPercentage >= 55 && baseInfo.phaPercentage < 60) {
                totalScore += 5;
                rulesHit.push({ description: "PHA on Mfav >= 55% to < 60%", points: 5 });
            }

            if (isGSGAGA) {
                totalScore += -10;
                rulesHit.push({ description: "A match has GS=GS=GA=GA", points: -10 });
            }
            const isClose = (a: number, b: number, d: number = 0.2) => Math.abs(a - b) <= d;
            if (isClose(gsHome, gsAway, 0.2) && isClose(gaAway, gsHome, 0.2)) {
                if (mFavHiddenStrength) {
                    totalScore += -15;
                    rulesHit.push({ description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: -15 });
                }
                if (mFavHiddenWeakness) {
                    totalScore += -10;
                    rulesHit.push({ description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -10 });
                }
            }
            if (isClose(gaHome, gsAway, 0.2) && isClose(gsHome, gsAway, 0.2)) {
                totalScore += 10;
                rulesHit.push({ description: "HGA=AGS + Equal GS", points: 10 });
            }
            if (isPhaTie) {
                totalScore += -10;
                rulesHit.push({ description: "Match has PHA tie", points: -10 });
            }
            if (favTS < 1.5 && udTS < 0.8 && seerScoreDraw >= 35) {
                totalScore += -10;
                rulesHit.push({ description: "Mfav TS < 1.5, Ud TS < 0.8, Seer score draw >= 35%", points: -10 });
            }
            if (udTS > favTS) {
                totalScore += -15;
                rulesHit.push({ description: "Underdog TS > M.fav TS", points: -15 });
            }

            if (isVolatile && underdogHiddenStrength) {
                totalScore += 15;
                rulesHit.push({ description: "Both teams GA >= 1.1 (volatile) and Underdog has hidden strength", points: 15 });
            }

            // --- BORROWED HIGH-CONVICTION RULES ---
            if (leData && leData.isDraw && underdogHiddenStrengthOrWeakness) {
                totalScore += 20;
                rulesHit.push({ description: "LE was a draw+Underdog has hidden strength/weakness", points: 20 });
            }

            if (mFavHiddenStrength && Math.abs(mFavGA - underdogGA) <= 0.2) {
                totalScore += 15;
                rulesHit.push({ description: "M.fav has hidden strength+Mfav GA=Und GA (+-0.2)", points: 15 });
            }

            if (leData && leData.isDraw && mFavGA >= 1.8 && mFavGS >= 1.8) {
                totalScore += 15;
                rulesHit.push({ description: "LE was a draw+ Mfav GA and GS =>1.8", points: 15 });
            }

            if (bothTeamsGAGreaterThanGS && gsHome <= 1.0 && gsAway <= 1.0) {
                totalScore += 10;
                rulesHit.push({ description: "Both teams GA > GS and Both team GS <=1.0", points: 10 });
            }

            if (isRatingGreaterEq7) {
                totalScore += 15;
                rulesHit.push({ description: "1X2 Rating =>7", points: 15 });
            }

            if (favTS <= 1.0 && udTS <= 1.0 && pred1x2.includes(mFav)) {
                totalScore += 10;
                rulesHit.push({ description: "Synergy: Both TS <= 1.0 + Pred 1X2 on M.fav", points: 10 });
            }

            if (mFavGS - underdogGS >= 1.0) {
                totalScore += 10;
                rulesHit.push({ description: "Mfav GS - Ud GS >= 1.0", points: 10 });
            }

            if (leData && leData.isDraw) {
                totalScore += 5;
                rulesHit.push({ description: "LE was a draw", points: 5 });
            }

            // Borrowed Risk Suppressors
            if (leData && leData.underdogWon && isL10Equal) {
                totalScore += -20;
                rulesHit.push({ description: "LE, Underdog won the last encounter +Mfav L10= Und L10", points: -20 });
            }

            if (leData && leData.underdogWasAway && leData.underdogWon) {
                totalScore += -20;
                rulesHit.push({ description: "Underdog was away on LE (Last encounter) and Won", points: -20 });
            }

            if (leData && leData.isDraw && isRatingLessEq2_5) {
                totalScore += -15;
                rulesHit.push({ description: "LE was a draw+1X2R <= 2.5", points: -15 });
            }

            if (mFavGS >= 1.8 && mFavGA <= 1.0) {
                totalScore += -15;
                rulesHit.push({ description: "Mfav GS =>1.8 and GA =<1.0", points: -15 });
            }

            if (isAwayFav && mFavGA <= 1.0 && underdogGA > 1.0) {
                totalScore += -10;
                rulesHit.push({ description: "Away favorite + Mfav GA <= 1.0 & Ud GA > 1.0", points: -10 });
            }
`;

fs.writeFileSync(`${outDir}\\top12_eval_block.txt`, evalBlock);
console.log(`Saved evaluation block to scratch/top12_eval_block.txt`);
