import fs from 'fs';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { getMarketFavorite, getOptimizedBaseWeight } from '../src/utils/optimizedweights';
import { getMatchEvaluatorTags } from '../src/utils/matchEvaluator';

// Load calibrated rules
const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rules: Array<{ description: string; points: number }> = JSON.parse(
  fs.readFileSync(`${outDir}\\final_calibrated_bj_rules.json`, 'utf8')
);
const ruleMap = new Map(rules.map(r => [r.description, r.points]));

// Dedicated Bankers Jackpot evaluation function matching the proposed decoupled code
export function evaluateBankersJackpotDecoupled(match: Match, phaStatsMap: any = {}) {
  const mFav = getMarketFavorite(match);
  const underdog = mFav === '1' ? '2' : '1';
  const baseInfo = getOptimizedBaseWeight(match, phaStatsMap, 'bankers_jackpot');
  let totalScore = baseInfo.points;
  const rulesHit: Array<{ description: string; points: number }> = [];

  const addHit = (desc: string) => {
    const pts = ruleMap.get(desc) ?? 0;
    totalScore += pts;
    rulesHit.push({ description: desc, points: pts });
  };

  const isClose = (a: number, b: number, tol = 0.2) => Math.abs(a - b) <= tol + Number.EPSILON;
  const is1XorX2 = (pred?: string) => pred === '1X' || pred === 'X2';

  const o1 = parseFloat(match.odds1 || '0');
  const o2 = parseFloat(match.odds2 || '0');
  const oX = parseFloat(match.oddsX || '0');
  const favOdds = mFav === '1' ? o1 : o2;
  const udOdds = mFav === '1' ? o2 : o1;
  const oddsUnderdogLessEqDraw = udOdds > 0 && oX > 0 && udOdds <= oX;

  const gsHome = match.homeAvgScored || 0;
  const gaHome = match.homeAvgConceded || 0;
  const gsAway = match.awayAvgScored || 0;
  const gaAway = match.awayAvgConceded || 0;

  const mFavGS = mFav === '1' ? gsHome : gsAway;
  const underdogGS = mFav === '1' ? gsAway : gsHome;
  const mFavGA = mFav === '1' ? gaHome : gaAway;
  const underdogGA = mFav === '1' ? gaAway : gaHome;

  const favTS = mFav === '1' ? (match.tsHome || 0) : (match.tsAway || 0);
  const udTS = mFav === '1' ? (match.tsAway || 0) : (match.tsHome || 0);

  const mFavL10 = mFav === '1' ? (match.last10HomePoints ?? -1) : (match.last10AwayPoints ?? -1);
  const underdogL10 = mFav === '1' ? (match.last10AwayPoints ?? -1) : (match.last10HomePoints ?? -1);
  const hasValidL10 = mFavL10 >= 0 && underdogL10 >= 0;
  const isL10Equal = hasValidL10 && mFavL10 === underdogL10;
  const isL10Close = hasValidL10 && Math.abs(mFavL10 - underdogL10) <= 1;
  const underdogHasHigherL10 = hasValidL10 && underdogL10 > mFavL10;

  const leData = match.h2hLastEncounterData;
  const leWasDraw = (match.h2hLastEncounterResult || '').toLowerCase().includes('draw') ||
                    (match.h2hLastEncounterResult || '').toLowerCase() === 'x' ||
                    (leData && leData.wasDraw);

  const initialMatchTags: string[] = match.evaluatorTags && match.evaluatorTags.length > 0
    ? match.evaluatorTags
    : getMatchEvaluatorTags(match, phaStatsMap, false, true, {});

  const isRatingLessEq2_5 = initialMatchTags.some(t => {
    const m = t.match(/1X2R:([0-9.]+)/);
    return m && parseFloat(m[1]) <= 2.5;
  });
  const isRating5to7 = initialMatchTags.some(t => {
    const m = t.match(/1X2R:([0-9.]+)/);
    return m && parseFloat(m[1]) >= 5 && parseFloat(m[1]) < 7;
  });
  const isRatingGreaterEq7 = initialMatchTags.some(t => {
    const m = t.match(/1X2R:([0-9.]+)/);
    return m && parseFloat(m[1]) >= 7;
  });

  const underdogHiddenStrength_bj = underdogGS >= underdogGA && isClose(underdogGS, underdogGA, 0.2);
  const mFavHiddenStrength_bj = mFavGS >= mFavGA && isClose(mFavGS, mFavGA, 0.2);
  const mFavHiddenWeakness_bj = mFavGS < mFavGA && isClose(mFavGS, mFavGA, 0.2);
  const underdogHiddenStrengthOrWeakness = isClose(underdogGS, underdogGA, 0.2);

  const isMfavGaLe1_1AndUndGaGt1_1 = mFavGA <= 1.1 + Number.EPSILON && underdogGA > 1.1;
  const isMfavGsUndGsClose = isClose(mFavGS, underdogGS, 0.2);
  const isBothTeamsGaGe1_5 = gaHome >= 1.5 - Number.EPSILON && gaAway >= 1.5 - Number.EPSILON;

  const isYouthLeague = initialMatchTags.some(t => /\b(u21|u20|youth)\b/i.test(t)) ||
    /\b(U21|U20)\b/i.test(match.teams || '') ||
    /\b(U21|U20|Youth)\b/i.test(match.league || '');

  const isG2E5 = (match.patternG2E5 || '').includes('G2E5') || initialMatchTags.some(t => t.includes('G2E5'));

  const paaPred = match.paaFinalPrediction || '';
  const subPred = match.subPatternFinalPrediction || '';
  const algoPred = match.algoFinalPrediction || '';
  const mlPred = match.hybridMlFinalPrediction || '';
  const seerPred = match.seerFinalPrediction || '';
  const pred1x2 = match.prediction1X2 || '';

  const isPaaSubAlgoMl12 = paaPred === '12' && subPred === '12' && algoPred === '12' && mlPred === '12';

  const isIsraelMatch = (match.league && /israel/i.test(match.league)) ||
    (match.teams && /hapoel|maccabi|beitar|bnei/i.test(match.teams));

  const bothTeamsGAGreaterThanGS = gaHome > gsHome && gaAway > gsAway;
  const isVolatile = gaHome >= 1.1 - Number.EPSILON && gaAway >= 1.1 - Number.EPSILON;
  const isAwayFav = mFav === '2';

  const mFavPoints = mFav === '1' ? (match.pointSystemHomePoints || 0) : (match.pointSystemAwayPoints || 0);
  const udPoints = mFav === '1' ? (match.pointSystemAwayPoints || 0) : (match.pointSystemHomePoints || 0);

  const algoPercentage = match.algoPercentage || 0;
  const seerPrimPred = match.seerPrimaryPrediction || '';
  const subPrimPred = match.subPatternPrimaryPrediction || '';
  const algoPrimPred = match.algoPrimaryPrediction || '';

  const effPaaWin = baseInfo.phaPercentage > 0 ? baseInfo.phaPercentage : (match.paaSWin || 0);

  const isGSGAGA = isClose(gsHome, gsAway, 0.2) && isClose(gaHome, gaAway, 0.2) && isClose(gsHome, gaHome, 0.2);
  const isPhaTie = initialMatchTags.some(t => t.includes('PHA:TIE') || t.includes('TAG:PHA_TIE'));

  // --- EVALUATION OF ALL 100 RULES ---

  // 1. LE was a draw
  if (leWasDraw) addHit("LE was a draw");

  // 2. Mfav L10= Und L10
  if (isL10Equal) addHit("Mfav L10= Und L10");

  // 3. 1X2R <= 2.5
  if (isRatingLessEq2_5) addHit("1X2R <= 2.5");

  // 4. LE was a draw + Mfav L10= Und L10 (+-1) + 1X2R <= 2.5
  if (leWasDraw && isL10Close && isRatingLessEq2_5) addHit("LE was a draw + Mfav L10= Und L10 (+-1) + 1X2R <= 2.5");

  // 5. Underdog has hidden strength/weakness + 1X2R <= 2.5
  if (underdogHiddenStrengthOrWeakness && isRatingLessEq2_5) addHit("Underdog has hidden strength/weakness + 1X2R <= 2.5");

  // 6. Mfav GA <= 1.1 and Und GA > 1.1
  if (isMfavGaLe1_1AndUndGaGt1_1) addHit("Mfav GA <= 1.1 and Und GA > 1.1");

  // 7. Mfav GA <= 1.1 and Und GA > 1.1 + Mfav GS=Und GS (+-0.2)
  if (isMfavGaLe1_1AndUndGaGt1_1 && isMfavGsUndGsClose) addHit("Mfav GA <= 1.1 and Und GA > 1.1 + Mfav GS=Und GS (+-0.2)");

  // 8. Both teams GA => 1.5
  if (isBothTeamsGaGe1_5) addHit("Both teams GA => 1.5");

  // 9. 1X2 rating(R) =>5 to <7
  if (isRating5to7) addHit("1X2 rating(R) =>5 to <7");

  // 10. 1X2 Rating =>7
  if (isRatingGreaterEq7) addHit("1X2 Rating =>7");

  // 11. Youth League checks
  if (isYouthLeague) addHit("Match has U21,U20 Tag (youth league)");
  if (isYouthLeague && initialMatchTags.some(t => t.startsWith('BANNED:UPSET_RISK'))) {
    addHit("Youth league + Banned: Upset risk tag");
  }

  // 12. G2E5 check
  if (isG2E5 && (mFavGS - underdogGS >= 1.0 - Number.EPSILON)) {
    addHit("Match belong to sub pattern G2E5+Mfav GS - Ud GS >= 1.0");
  }

  // 13. Underdog higher L10
  if (underdogHasHigherL10) addHit("Underdog has a higher L10 than Mfav");

  // 14. 12 hedge multi-predictor conflict
  if (is1XorX2(paaPred) && is1XorX2(subPred) && is1XorX2(mlPred) && algoPred === '12' && seerPred === '12') {
    addHit("Paa fin, sub pattern fin and ML fin is 1X/X2 but Algo and Seer final is 12");
  }
  if (is1XorX2(paaPred) && is1XorX2(subPred) && is1XorX2(mlPred) && is1XorX2(seerPred) && algoPred === '12') {
    addHit("All predictors fin prediction final 1X/X2 but algo final 12");
  }

  // 15. Israel
  if (isIsraelMatch) addHit("Match belongs to israel premier league or other israel teams");

  // 16. HGA=AGS + Equal GS
  if (isClose(gaHome, gsAway, 0.2) && isClose(gsHome, gsAway, 0.2)) {
    addHit("HGA=AGS + Equal GS");
  }

  // 17. H.Bal + Equal GA + AGA=HGS+ M.fav GS>Uderdog GS with more than 0.5
  if (isClose(gsHome, gaHome, 0.2) && isClose(gaHome, gaAway, 0.2) && isClose(gaAway, gsHome, 0.2) && (mFavGS - underdogGS > 0.5)) {
    addHit("H.Bal + Equal GA + AGA=HGS+ M.fav GS>Uderdog GS with more than 0.5");
  }

  // 18. GS tiers
  const gsDiff = mFavGS - underdogGS;
  if (gsDiff >= 1.1 - Number.EPSILON) addHit("Mfav GS ≥1.1 over Ud GS");
  else if (gsDiff >= 0.8 - Number.EPSILON) addHit("Mfav GS ≥0.8 to <1.1 over Ud GS");
  else if (gsDiff >= 0.5 - Number.EPSILON) addHit("Mfav GS ≥0.5 but <0.8 over Ud GS");
  else if (gsDiff >= 0.1 - Number.EPSILON) addHit("Mfav GS ≥0.1 to <0.5 over Ud GS");

  // 19. Equality metrics
  if (isClose(mFavGA, underdogGA, 0.2)) addHit("Mfav GA= Und GA (+-0.2)");
  if (isClose(mFavGS, underdogGS, 0.2)) addHit("Mfav GS=Underdog GS (+-0.2)");

  // 20. Underdog GA >= 2.0
  if (underdogGA >= 2.0 - Number.EPSILON) addHit("Underdog GA >= 2.0");

  // 21. Both teams GA > GS
  if (bothTeamsGAGreaterThanGS) addHit("Both teams GA > GS");
  if (bothTeamsGAGreaterThanGS && gsHome <= 1.0 && gsAway <= 1.0) {
    addHit("Both teams GA > GS and Both team GS <=1.0");
  }
  if (isVolatile && bothTeamsGAGreaterThanGS) {
    addHit("Volatile match + Both teams GA > GS");
  }

  // 22. Away favorite
  if (isAwayFav) addHit("Away favorite");
  if (isAwayFav && mFavGA <= 1.0 && underdogGA > 1.0) {
    addHit("Away favorite + Mfav GA <= 1.0 & Ud GA > 1.0");
  }
  if (isAwayFav && Math.abs(favTS - udTS) <= 0.1) {
    addHit("Away favorite + M.fav and Underdog TS difference <= 0.1");
  }

  // 23. Both GS < 1.0
  if (gsHome < 1.0 && gsAway < 1.0) addHit("Both teams GS < 1.0");

  // 24. Underdog GS < 1.0 but Mfav GS > 1.0
  if (underdogGS < 1.0 && mFavGS > 1.0) addHit("Underdog GS < 1.0 but M.fav GS > 1.0");
  if (underdogGS <= 1.0 && mFavGS > 2.0) addHit("Underdog GS <= 1.0 but M.fav GS > 2.0");

  // 25. Both team GS => 1.8
  if (gsHome >= 1.8 - Number.EPSILON && gsAway >= 1.8 - Number.EPSILON) {
    addHit("Both team GS => 1.8");
  }

  // 26. TS checks
  if (favTS >= 2.0 && udTS < 1.0) addHit("M.fav TS >= 2.0 and Underdog TS < 1.0");
  if (favTS >= 2.0 && udTS < 1.0 && oddsUnderdogLessEqDraw) {
    addHit("M.fav TS >= 2.0 & Ud TS < 1.0 + Odds Ud <= Draw");
  }
  if (favTS >= 3.0 && udTS < 1.0) addHit("M.fav TS >= 3.0 and Underdog TS < 1.0");
  if (favTS >= 2.995 && udTS < 1.005 && underdogHiddenStrengthOrWeakness) {
    addHit("M.fav TS >= 3.0 and Underdog TS < 1.0+Underdog has hidden strength/weakness");
  }
  if (favTS >= 1.0 && favTS <= 1.50 && udTS < 0.8) {
    addHit("Mfav TS 1.0-1.50 and Ud TS < 0.8");
  }
  if (favTS >= 1.0 && favTS <= 1.50 && udTS < 0.8 && underdogHiddenStrengthOrWeakness) {
    addHit("Mfav TS 1.0-1.50 and Ud TS < 0.8+Underdog has hidden strength/weakness");
  }
  if (favTS >= 1.0 && favTS <= 1.50 && udTS < 0.8 && initialMatchTags.some(t => t.startsWith('BANNED:UPSET_RISK'))) {
    addHit("Mfav TS 1.0-1.50 and Ud TS < 0.8 + Banned: Upset risk tag");
  }
  if (udTS > favTS) addHit("Underdog TS > M.fav TS");
  if (Math.abs(favTS - udTS) <= 0.1) addHit("M.fav and Underdog TS difference <= 0.1");

  // 27. Upset tag
  if (initialMatchTags.some(t => t.startsWith('BANNED:UPSET_RISK'))) {
    addHit("Banned: Upset risk tag");
  }

  // 28. Point system
  if (mFavPoints >= 70) addHit("Point system has >= 70 points on M.fav");
  else if (mFavPoints >= 60) addHit("Point system has >= 60 to <70 points on M.fav");
  else if (mFavPoints >= 50) addHit("Point system has >= 50 to <60 points on M.fav");

  if (udPoints - mFavPoints >= 5) addHit("Underdog has >= 5 more points on point system");

  // 29. Predictions
  if (seerPrimPred.includes(underdog)) addHit("Seer primary predicts on underdog");
  if (subPrimPred.includes(underdog)) addHit("Sub pattern primary prediction supports the underdog");
  if (algoPrimPred.includes(underdog)) addHit("Algo primary prediction supports the underdog");
  if (pred1x2.includes(underdog)) addHit("1X2 supports the underdog");
  if (is1XorX2(pred1x2)) addHit("1X2 supports 1X/X2");

  // 30. Algo support
  if (algoPercentage >= 60) addHit("Algo Mfav >=60%");
  else if (algoPercentage >= 50) addHit("Algo Mfav =>50% to <60%");
  else if (algoPercentage > 0 && algoPercentage < 40) addHit("Algo for Mfav support <40%");

  // 31. Hidden strength/weakness
  if (underdogHiddenStrengthOrWeakness) addHit("Underdog has hidden strength/weakness");
  if (mFavHiddenStrength_bj) addHit("M.fav has hidden strength");
  if (mFavHiddenWeakness_bj) addHit("Mfav has hidden weakness");

  // 32. Synergies
  if (favTS <= 1.0 && udTS <= 1.0 && mFavPoints >= 60 && (underdogGS < 1.0 && mFavGS > 1.0)) {
    addHit("Synergy: Both TS <= 1.0 + Point system >= 60 on M.fav + Ud GS < 1.0 & Mfav GS > 1.0");
  }
  if (mFavPoints >= 60 && (underdogGS < 1.0 && mFavGS > 1.0) && underdogGA >= 2.0) {
    addHit("Synergy: Point system >= 60 on M.fav + Ud GS < 1.0 & Mfav GS > 1.0 + Ud GA >= 2.0");
  }
  if (mFavPoints >= 60 && (mFavGS - underdogGS >= 1.0) && favOdds > 0 && favOdds < 1.80) {
    addHit("Synergy: Point system >= 60 on M.fav + Mfav GS - Ud GS >= 1.0 + Fav odds < 1.80");
  }
  if (effPaaWin >= 55 && effPaaWin < 70 && mFavHiddenStrength_bj) {
    addHit("Synergy: PAA s.win 55% to <70% + M.fav hidden strength");
  }
  if (effPaaWin >= 55 && effPaaWin < 70 && (mFavGS - underdogGS >= 0.5) && underdogHiddenStrength_bj) {
    addHit("Synergy: PAA s.win 55% to <70% + Mfav GS - Ud GS >= 0.5 + Ud hidden strength");
  }
  if (effPaaWin >= 55 && effPaaWin < 70 && (mFavGS - underdogGS >= 1.0) && favOdds > 0 && favOdds < 1.80) {
    addHit("Synergy: PAA s.win 55% to <70% + Mfav GS - Ud GS >= 1.0 + Fav odds < 1.80");
  }
  if (favTS <= 1.0 && udTS <= 1.0 && isVolatile && oX > 0 && oX < 3.20) {
    addHit("Synergy: Both TS <= 1.0 + Volatile match + Draw odds < 3.20");
  }

  // 33. PAA win
  if (effPaaWin > 0 && effPaaWin <= 40) addHit("PHA M.fav <= 40%");
  if (effPaaWin >= 70) addHit("PAA s.win =>70%");
  else if (effPaaWin >= 55 && effPaaWin < 70) addHit("PAA s.win =55% to <70%");

  // 34. Odds
  if (udOdds > 0 && udOdds < 3.0) addHit("Odds for underdog < 3.0");

  // 35. Hedges
  if (paaPred === '12' && subPred === '12' && algoPred === '12' && mlPred === '12' && isVolatile && bothTeamsGAGreaterThanGS) {
    addHit("PAA, SubPattern, Algo, and ML agree on 12 hedge+Both teams GA >= 1.1 (volatile match)+Both teams GA > GS");
  } else if (paaPred === '12' && subPred === '12' && algoPred === '12' && mlPred === '12') {
    addHit("PAA, SubPattern, Algo, and ML agree on 12 hedge");
  }
  if (is1XorX2(paaPred) && is1XorX2(seerPred) && is1XorX2(mlPred) && is1XorX2(algoPred)) {
    addHit("PAA, Seer, Algo, and ML agree on 1X/X2");
  }

  // 36. Tie / Special
  if (isGSGAGA) addHit("A match has GS=GS=GA=GA");
  if (isPhaTie) addHit("Match has PHA tie");

  // 37. LE checks
  if (leData && leData.underdogWon && leData.underdogGoals >= 2) {
    addHit("LE (Last encounter) Underdog won with and scored 2 goals or more");
  }
  if (leData && leData.underdogWon && leData.underdogGoals >= 2 && (match.seerScoreDraw || 0) >= 40) {
    addHit("LE (Last encounter) Underdog won with and scored 2 goals or more+ Seer score on draw >= 40%");
  }
  if (leData && leData.mFavWasAway && leData.mFavWon && leData.mFavGoals >= 2) {
    addHit("Mfav was away on LE (Last encounter) and Won with 2 or more goals");
  }
  if (leData && leData.underdogWasAway && leData.underdogWon) {
    addHit("Underdog was away on LE (Last encounter) and Won");
  }
  if (leData && !leData.underdogWasAway && underdog === '1') {
    addHit("Underdog was Home on LE and still playing at Home");
  }

  // 38. BORROWED RULES FROM BEST BET & BANKERS DLIVE
  // Borrowed 1: Both Teams GA > 2.0
  if (gaHome > 2.0 - Number.EPSILON && gaAway > 2.0 - Number.EPSILON) {
    addHit("Both Teams GA > 2.0");
  }
  // Borrowed 2: Mfav L10 >Underdog L10 with >2
  if (hasValidL10 && mFavL10 - underdogL10 > 2) {
    addHit("Mfav L10 >Underdog L10 with >2");
  }
  // Borrowed 3: LE was a draw+ Mfav GA and GS =>1.8
  if (leWasDraw && mFavGA >= 1.8 - Number.EPSILON && mFavGS >= 1.8 - Number.EPSILON) {
    addHit("LE was a draw+ Mfav GA and GS =>1.8");
  }
  // Borrowed 4: Synergy: TS diff >= 1.0 + Ud GA >= 2.0 + Odds Ud <= Draw
  if ((favTS - udTS >= 1.0 - Number.EPSILON) && (underdogGA >= 2.0 - Number.EPSILON) && oddsUnderdogLessEqDraw) {
    addHit("Synergy: TS diff >= 1.0 + Ud GA >= 2.0 + Odds Ud <= Draw");
  }
  // Borrowed 5: LE, Underdog won the last encounter +Mfav L10= Und L10
  if (leData && leData.underdogWon && isL10Equal) {
    addHit("LE, Underdog won the last encounter +Mfav L10= Und L10");
  }
  // Borrowed 6: Synergy: Mfav GS - Ud GS >= 0.5 + M.fav hidden strength
  if ((mFavGS - underdogGS >= 0.5 - Number.EPSILON) && mFavHiddenStrength_bj) {
    addHit("Synergy: Mfav GS - Ud GS >= 0.5 + M.fav hidden strength");
  }
  // Borrowed 7: Mfav L10 > Underdog L10 with <=2 + R(1X2 rating)<3.0
  if (hasValidL10 && (mFavL10 - underdogL10 <= 2) && isRatingLessEq2_5) {
    addHit("Mfav L10 > Underdog L10 with <=2 + R(1X2 rating)<3.0");
  }
  // Borrowed 8: Mfav GA= Und GA (+-0.2) +Mfav TS 1.0-1.50 and Ud TS < 0.8
  if (isClose(mFavGA, underdogGA, 0.2) && (favTS >= 1.0 && favTS <= 1.50 && udTS < 0.8)) {
    addHit("Mfav GA= Und GA (+-0.2) +Mfav TS 1.0-1.50 and Ud TS < 0.8");
  }
  // Borrowed 9: Mfav GS=Underdog GS (+-0.2) + M.fav has hidden strength
  if (isClose(mFavGS, underdogGS, 0.2) && mFavHiddenStrength_bj) {
    addHit("Mfav GS=Underdog GS (+-0.2) + M.fav has hidden strength");
  }

  return { totalScore, rulesHit };
}

// Test against all completed BJ matches
const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\live_matches_dump.json';
const liveMatches: Match[] = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
const bjMatches = liveMatches.filter(m => (m.evaluatorTags || []).some(t => t.startsWith('bankers_jackpot:')));
const completed = bjMatches.filter(m => {
  const a = getActualResult(m.result || '');
  return a === '1' || a === 'X' || a === '2';
});

console.log(`Testing decoupled evaluation across ${completed.length} completed matches...`);

const scored = completed.map(m => {
  const actual = getActualResult(m.result || '');
  const mFav = getMarketFavorite(m);
  const outcome = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
  const res = evaluateBankersJackpotDecoupled(m);
  return {
    id: m.id,
    teams: m.teams,
    result: m.result,
    outcome,
    score: res.totalScore
  };
});

scored.sort((a, b) => b.score - a.score);

const calc = (slice: any[]) => {
  const mfav = slice.filter(x => x.outcome === 'MFAV').length;
  const draw = slice.filter(x => x.outcome === 'DRAW').length;
  const ud = slice.filter(x => x.outcome === 'UNDERDOG').length;
  return { total: slice.length, mfav, draw, ud, pct: ((mfav / slice.length) * 100).toFixed(1) + '%' };
};

console.log('Top 10:', calc(scored.slice(0, 10)));
console.log('Top 20:', calc(scored.slice(0, 20)));
console.log('Top 30:', calc(scored.slice(0, 30)));

let cleanStreak = 0;
for (const m of scored) {
  if (m.outcome === 'MFAV') cleanStreak++;
  else break;
}
console.log('Clean Streak:', cleanStreak);

console.log('\nTop 20 Matches:');
scored.slice(0, 20).forEach((m, idx) => {
  console.log(`#${idx + 1} [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});
