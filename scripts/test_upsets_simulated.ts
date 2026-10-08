import fs from 'fs';

const liveMatches = JSON.parse(fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_upsets_matches.json', 'utf8'));

const satMatches = liveMatches.filter((m: any) => m.dateStr === '2026-09-19' || m.id.includes('20260919'));
const sunMatches = liveMatches.filter((m: any) => m.dateStr === '2026-09-20' || m.id.includes('20260920'));

// Helper matching functions
function evaluateProposedUpsets(match: any, phaStatsMap: any = {}) {
  let totalScore = 0;
  const rulesHit: Array<{ description: string; points: number }> = [];

  const mFav = match.teamsData?.market_favorite || match.mFav || '1';
  const underdog = match.teamsData?.market_underdog || (mFav === '1' ? '2' : '1');
  const actual = match.resultData?.actual || match.actual;

  // Base Points
  let udPhaPct = 0;
  const subPatternStr = match.subPatternData?.pattern || match.subPattern;
  if (subPatternStr && phaStatsMap[subPatternStr]) {
    const stats = phaStatsMap[subPatternStr];
    const total = stats.total > 0 ? stats.total : 0;
    if (total > 0) {
      udPhaPct = ((stats.outcomes?.[underdog] || 0) / total) * 100;
    }
  }
  if (udPhaPct === 0 && match.baseInfo?.phaPercentage > 0) {
    udPhaPct = match.baseInfo.phaPercentage;
  }
  if (udPhaPct === 0 && match.phaPercentage > 0) {
    udPhaPct = match.phaPercentage;
  }

  let basePoints = 15;
  if (udPhaPct >= 70) basePoints = 50;
  else if (udPhaPct >= 65) basePoints = 45;
  else if (udPhaPct >= 60) basePoints = 40;
  else if (udPhaPct >= 50) basePoints = 35;
  else if (udPhaPct >= 45) basePoints = 30;
  else if (udPhaPct >= 40) basePoints = 25;
  else if (udPhaPct >= 34) basePoints = 20;

  totalScore = basePoints;

  // Metrics
  const mFavGS = mFav === '1' ? (match.goalsData?.homeGoalsScoredL10 ?? 0) : (match.goalsData?.awayGoalsScoredL10 ?? 0);
  const mFavGA = mFav === '1' ? (match.goalsData?.homeGoalsConcededL10 ?? 0) : (match.goalsData?.awayGoalsConcededL10 ?? 0);
  const underdogGS = underdog === '1' ? (match.goalsData?.homeGoalsScoredL10 ?? 0) : (match.goalsData?.awayGoalsScoredL10 ?? 0);
  const underdogGA = underdog === '1' ? (match.goalsData?.homeGoalsConcededL10 ?? 0) : (match.goalsData?.awayGoalsConcededL10 ?? 0);

  const gsHome = match.goalsData?.homeGoalsScoredL10 ?? 0;
  const gaHome = match.goalsData?.homeGoalsConcededL10 ?? 0;
  const gsAway = match.goalsData?.awayGoalsScoredL10 ?? 0;
  const gaAway = match.goalsData?.awayGoalsConcededL10 ?? 0;

  const favTS = mFav === '1' ? (match.tsData?.tsHome ?? 0) : (match.tsData?.tsAway ?? 0);
  const udTS = underdog === '1' ? (match.tsData?.tsHome ?? 0) : (match.tsData?.tsAway ?? 0);

  const favOdds = mFav === '1' ? (match.oddsData?.oddsHome ?? 0) : (match.oddsData?.oddsAway ?? 0);
  const udOdds = underdog === '1' ? (match.oddsData?.oddsHome ?? 0) : (match.oddsData?.oddsAway ?? 0);
  const oX = match.oddsData?.oddsDraw ?? 0;

  const mFavPoints = mFav === '1' ? (match.pointSystemHome ?? 0) : (match.pointSystemAway ?? 0);
  const udPoints = underdog === '1' ? (match.pointSystemHome ?? 0) : (match.pointSystemAway ?? 0);

  const leData = match.leData;
  const initialMatchTags: string[] = match.initialMatchTags || match.matchTags || [];

  const paaPred = match.paaPred || match.paaData?.prediction;
  const subPred = match.subPred || match.subPatternData?.finalPrediction;
  const algoPred = match.algoPred || match.algoData?.prediction;
  const mlPred = match.mlPred || match.mlData?.prediction;
  const seerPred = match.seerPred || match.seerData?.finalPrediction;

  const subPrimPred = match.subPrimPred || match.subPatternData?.primaryPrediction;
  const algoPrimPred = match.algoPrimPred || match.algoData?.primaryPrediction;
  const seerPrimPred = match.seerPrimPred || match.seerData?.primaryPrediction;

  const seerScoreUd = underdog === '1' ? (match.seerHomeScore ?? 0) : (match.seerAwayScore ?? 0);
  const seerScoreFav = mFav === '1' ? (match.seerHomeScore ?? 0) : (match.seerAwayScore ?? 0);
  const seerScoreDraw = match.seerDrawScore ?? 0;

  const isVolatile = gaHome >= 1.1 && gaAway >= 1.1;
  const udHiddenStrength = underdogGS >= underdogGA && Math.abs(underdogGS - underdogGA) <= 0.2;
  const mFavHiddenStrength = mFavGS >= mFavGA && Math.abs(mFavGS - mFavGA) <= 0.2;
  const mFavHiddenWeakness = mFavGS < mFavGA && Math.abs(mFavGS - mFavGA) <= 0.2;
  const absTSDiff = Math.abs(favTS - udTS);
  const isClose = (a: number, b: number, d: number = 0.2) => Math.abs(a - b) <= d;

  const oddsUnderdogLessEqDraw = udOdds > 0 && oX > 0 && udOdds <= oX;
  const is1XorX2 = (p?: string) => p === '1X' || p === 'X2';

  const subOnUd = subPrimPred === underdog;
  const algoOnUd = algoPrimPred === underdog;
  const seerOnUd = seerPrimPred === underdog;

  const gaDiff_upset = Math.round((mFavGA - underdogGA) * 100) / 100;
  const underdogHiddenStrengthOrWeakness = Math.abs(underdogGS - underdogGA) <= 0.2;

  const rating1X2 = match.rating1X2 ?? match.rating ?? 0;

  // RULE EVALUATIONS & CALIBRATED WEIGHTS:

  // 1. TOP UNDERDOG DRIVERS (High positive points)
  // LE: Underdog was away on LE and Won (41.9% Ud)
  if (leData && leData.underdogWasAway && leData.underdogWon) {
    totalScore += 20;
    rulesHit.push({ description: "Underdog was away on LE (Last encounter) and Won", points: 20 });
  }

  // Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength (40.9% Ud)
  if (Math.abs(underdogGS - mFavGS) <= 0.2 + Number.EPSILON && udHiddenStrength) {
    totalScore += 20;
    rulesHit.push({ description: "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", points: 20 });
  }

  // Underdog odds <= 2.80 (37.8% Ud, 111 matches)
  if (udOdds > 0 && udOdds <= 2.80) {
    totalScore += 15;
    rulesHit.push({ description: "Underdog odds <= 2.80", points: 15 });
  }

  // LE Underdog won with 2+ goals (33.3% Ud)
  if (leData && leData.underdogWon && (leData.underdogGoals ?? 0) >= 2) {
    totalScore += 15;
    rulesHit.push({ description: "LE Underdog won with 2+ goals", points: 15 });
  }

  // Both teams GA > GS and Both team GS <=1.0 (35.0% Ud)
  if (gaHome > gsHome && gaAway > gsAway && gsHome <= 1.0 && gsAway <= 1.0) {
    totalScore += 15;
    rulesHit.push({ description: "Both teams GA > GS and Both team GS <=1.0", points: 15 });
  }

  // High Favorite Odds (>= 2.50) (33.3% Ud)
  if (favOdds >= 2.50) {
    totalScore += 15;
    rulesHit.push({ description: "High Favorite Odds (>= 2.50)", points: 15 });
  }

  // Both teams GS < 1.0 and Und GS > Mfav GS (50.0% Ud)
  if (gsHome < 1.0 && gsAway < 1.0 && underdogGS > mFavGS) {
    totalScore += 15;
    rulesHit.push({ description: "Both teams GS < 1.0 and Und GS > Mfav GS", points: 15 });
  }

  // Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA (32.1% Ud)
  if (Math.abs(underdogGS - mFavGS) <= 0.2 + Number.EPSILON && underdogGA < mFavGA) {
    totalScore += 15;
    rulesHit.push({ description: "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", points: 15 });
  }

  // LE : Underdog won the last encounter (32.0% Ud)
  if (leData && leData.underdogWon) {
    totalScore += 15;
    rulesHit.push({ description: "LE : Underdog won the last encounter", points: 15 });
  }

  // Und GS and GA =>2.0 (46.2% Ud)
  if (underdogGS >= 2.0 && underdogGA >= 2.0) {
    totalScore += 10;
    rulesHit.push({ description: "Und GS and GA =>2.0", points: 10 });
  }

  // Underdog has hidden strength/weakness+Und GS and GA =>2.0 (44.4% Ud)
  if (underdogHiddenStrengthOrWeakness && underdogGS >= 2.0 && underdogGA >= 2.0) {
    totalScore += 10;
    rulesHit.push({ description: "Underdog has hidden strength/weakness+Und GS and GA =>2.0", points: 10 });
  }

  // Underdog has hidden strength/weakness (28.6% Ud)
  if (underdogHiddenStrengthOrWeakness) {
    totalScore += 10;
    rulesHit.push({ description: "Underdog has hidden strength/weakness", points: 10 });
  }

  // Underdog GA < Mfav GA with =>0.5 points
  if (gaDiff_upset >= 0.5) {
    totalScore += 10;
    rulesHit.push({ description: "Underdog GA < Mfav GA with =>0.5 points", points: 10 });
  }

  // Underdog GA < Mfav GA with =>0.1 but <0.5 points
  if (gaDiff_upset >= 0.1 && gaDiff_upset < 0.5) {
    totalScore += 10;
    rulesHit.push({ description: "Underdog GA < Mfav GA with =>0.1 but <0.5 points", points: 10 });
  }

  // Sub pattern + Algo primary prediction supports underdog (Consensus 10 pts -> +5)
  if (subOnUd && algoOnUd) {
    totalScore += 5;
    rulesHit.push({ description: "Sub pattern + Algo primary prediction supports underdog (Consensus 10 pts)", points: 5 });
  }

  // Seer primary predicts on underdog
  if (seerOnUd) {
    totalScore += 5;
    rulesHit.push({ description: "Seer primary predicts on underdog", points: 5 });
  }

  // Underdog was Home on LE and still playing at Home
  if (leData && !leData.underdogWasAway && underdog === '1') {
    totalScore += 5;
    rulesHit.push({ description: "Underdog was Home on LE and still playing at Home", points: 5 });
  }

  // Both teams GA >= 1.1 (volatile match)
  if (isVolatile) {
    totalScore += 5;
    rulesHit.push({ description: "Both teams GA >= 1.1 (volatile match)", points: 5 });
  }

  // Odds for underdog <= draw odds
  if (oddsUnderdogLessEqDraw) {
    totalScore += 5;
    rulesHit.push({ description: "Odds for underdog <= draw odds", points: 5 });
  }

  // Odds for underdog <= draw odds (2.80 to 3.00)
  if (oddsUnderdogLessEqDraw && udOdds >= 2.80 && udOdds <= 3.00) {
    totalScore += 5;
    rulesHit.push({ description: "Odds for underdog <= draw odds (2.80 to 3.00)", points: 5 });
  }

  // Mfav TS and underdog TS difference is <=0.4
  if (absTSDiff <= 0.4) {
    totalScore += 5;
    rulesHit.push({ description: "Mfav TS and underdog TS difference is <=0.4", points: 5 });
  }

  // PHA for Underdog >= 50%
  if (udPhaPct >= 50) {
    totalScore += 5;
    rulesHit.push({ description: "PHA for Underdog >= 50%", points: 5 });
  }

  // PHA for Underdog >= 40% to < 50%
  if (udPhaPct >= 40 && udPhaPct < 50) {
    totalScore += 5;
    rulesHit.push({ description: "PHA for Underdog >= 40% to < 50%", points: 5 });
  }

  // Seer score on draw <= 20%
  if (seerScoreDraw > 0 && seerScoreDraw <= 20) {
    totalScore += 10;
    rulesHit.push({ description: "Seer score on draw <= 20%", points: 10 });
  }

  // Seer score on underdog >= 45%
  if (seerScoreUd >= 45) {
    totalScore += 5;
    rulesHit.push({ description: "Seer score on underdog >= 45%", points: 5 });
  }

  // 2. PENALTIES & TRAP DAMPERS

  // INVERT: Mfav GS => 1.8 and GA =< 1.0 (Fav wins 61.1%, Und only 11.1%)
  if (mFavGS >= 1.8 && mFavGA <= 1.0) {
    totalScore += -20;
    rulesHit.push({ description: "INVERT: Mfav GS =>1.8 and GA =<1.0", points: -20 });
  }

  // INVERT: 1X2 Rating => 7 (Fav wins 57.1%, Und only 17.9%)
  if (rating1X2 >= 7) {
    totalScore += -20;
    rulesHit.push({ description: "INVERT: 1X2 Rating => 7", points: -20 });
  }

  // INVERT: Point system has >= 70 points on M.fav (Fav wins 62.5%, Und only 18.8%)
  if (mFavPoints >= 70) {
    totalScore += -15;
    rulesHit.push({ description: "INVERT: Point system has >= 70 points on M.fav", points: -15 });
  }

  // Point system has >= 60 points on M.fav
  if (mFavPoints >= 60) {
    totalScore += -10;
    rulesHit.push({ description: "Point system has >= 60 points on M.fav", points: -10 });
  }

  // Attack Void Penalty: Underdog GS < 1.0 but M.fav GS > 1.0 (Fav wins 65.4%)
  if (underdogGS < 1.0 && mFavGS > 1.0) {
    totalScore += -15;
    rulesHit.push({ description: "Underdog GS < 1.0 but M.fav GS > 1.0", points: -15 });
  }

  // M.fav TS >= 2.0 and Underdog TS < 1.0 (Fav wins 52.9%)
  if (favTS >= 2.0 && udTS < 1.0) {
    totalScore += -15;
    rulesHit.push({ description: "M.fav TS >= 2.0 and Underdog TS < 1.0", points: -15 });
  }

  // Mfav has hidden strength/weakness (Fav wins 58, Und only 21.6%)
  if (mFavHiddenStrength || mFavHiddenWeakness) {
    totalScore += -15;
    rulesHit.push({ description: "Mfav has hidden strength/weakness", points: -15 });
  }

  // Mfav GS and GA =>2.0
  if (mFavGS >= 2.0 && mFavGA >= 2.0) {
    totalScore += -10;
    rulesHit.push({ description: "Mfav GS and GA =>2.0", points: -10 });
  }

  // Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2) (Fav wins 55.6%!)
  if (Math.abs(underdogGS - mFavGS) <= 0.2 + Number.EPSILON && Math.abs(underdogGA - mFavGA) <= 0.2 + Number.EPSILON) {
    totalScore += -15;
    rulesHit.push({ description: "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", points: -15 });
  }

  // M.fav and Underdog TS difference <= 0.1 (Fav wins 45.6%)
  if (absTSDiff <= 0.1) {
    totalScore += -10;
    rulesHit.push({ description: "M.fav and Underdog TS difference <= 0.1", points: -10 });
  }

  // Odds for underdog <= odds for draw but >= 3.0 (Fav wins 49.6%)
  if (oddsUnderdogLessEqDraw && udOdds >= 3.0) {
    totalScore += -10;
    rulesHit.push({ description: "Odds for underdog <= odds for draw but >= 3.0", points: -10 });
  }

  // Odds for draw is < 3.0
  if (oX > 0 && oX < 3.0) {
    totalScore += -10;
    rulesHit.push({ description: "Odds for draw is < 3.0", points: -10 });
  }

  // Youth League (U21,U23,U20,U19)
  const isYouth = initialMatchTags.some(t => /\b(u21|u23|u20|u19|youth)\b/i.test(t)) ||
                  /\b(U21|U23|U20|U19)\b/i.test(match.teams || '') ||
                  /\b(U21|U23|U20|U19|Youth)\b/i.test(match.league || '');
  if (isYouth) {
    totalScore += -15;
    rulesHit.push({ description: "Youth League (U21,U23,U20,U19)", points: -15 });
  }

  // Banned: Upset risk tag
  if (initialMatchTags.some(t => t.startsWith('BANNED:UPSET_RISK'))) {
    totalScore += -10;
    rulesHit.push({ description: "Banned: Upset risk tag", points: -10 });
  }

  // Sub pattern primary on draw and hedges with underdog (Fav wins 50%)
  const subPrimIsDraw = subPrimPred === 'X';
  const subHedgesUd = (underdog === '2' && subPred === 'X2') || (underdog === '1' && subPred === '1X');
  if (subPrimIsDraw && subHedgesUd) {
    totalScore += -5;
    rulesHit.push({ description: "Sub pattern primary on draw and hedges with underdog", points: -5 });
  }

  // PAA,ML And seer final is 1X/X2 But Sub pattern and Algo final is 12 (Conflict)
  if (is1XorX2(paaPred) && is1XorX2(mlPred) && is1XorX2(seerPred) && subPred === '12' && algoPred === '12') {
    totalScore += -10;
    rulesHit.push({ description: "PAA,ML And seer final is 1X/X2 But Sub pattern and Algo final is 12", points: -10 });
  }

  // Equal GS + AGA=HGS + M.fav has hidden weakness
  if (isClose(gsHome, gsAway, 0.2) && isClose(gaAway, gsHome, 0.2)) {
    if (mFavHiddenWeakness) {
      totalScore += -10;
      rulesHit.push({ description: "Equal GS + AGA=HGS + M.fav has hidden weakness", points: -10 });
    }
    if (mFavHiddenStrength) {
      totalScore += -10;
      rulesHit.push({ description: "Equal GS + AGA=HGS + M.fav has hidden strength", points: -10 });
    }
  }

  // Dead-Heat Draw Trap Damping: High Favorite Odds (>= 2.50) + Low Underdog Odds (<= 2.80) produce 51.4% draws!
  // When favorite odds >= 2.50 and underdog odds <= 2.80 and odds draw < 3.30, apply -10 pts draw damper
  if (favOdds >= 2.50 && udOdds <= 2.80 && oX > 0 && oX < 3.30) {
    totalScore += -10;
    rulesHit.push({ description: "Dead-Heat Draw Trap: Fav >= 2.50 + Ud <= 2.80 + Draw < 3.30", points: -10 });
  }

  return { totalScore, basePoints, rulesHit };
}

function runSimulation(matches: any[], label: string) {
  const scored = matches.map(m => {
    const evalRes = evaluateProposedUpsets(m);
    const mFav = m.teamsData?.market_favorite || m.mFav;
    const moUnderdog = m.teamsData?.market_underdog || (mFav === '1' ? '2' : '1');
    const actual = m.resultData?.actual || m.actual;
    
    let outcome = 'DRAW';
    if (actual === moUnderdog) outcome = 'UNDERDOG';
    else if (actual === mFav) outcome = 'MFAV';
    
    return {
      teams: m.teams,
      result: m.result,
      actual,
      mFav,
      moUnderdog,
      outcome,
      totalScore: evalRes.totalScore,
      rulesHit: evalRes.rulesHit
    };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);
  const top5 = scored.slice(0, 5);
  const top10 = scored.slice(0, 10);
  const top20 = scored.slice(0, 20);

  const ud5 = top5.filter(m => m.outcome === 'UNDERDOG').length;
  const ud10 = top10.filter(m => m.outcome === 'UNDERDOG').length;
  const ud20 = top20.filter(m => m.outcome === 'UNDERDOG').length;

  const dr5 = top5.filter(m => m.outcome === 'DRAW').length;
  const dr10 = top10.filter(m => m.outcome === 'DRAW').length;
  const dr20 = top20.filter(m => m.outcome === 'DRAW').length;

  const mf5 = top5.filter(m => m.outcome === 'MFAV').length;
  const mf10 = top10.filter(m => m.outcome === 'MFAV').length;
  const mf20 = top20.filter(m => m.outcome === 'MFAV').length;

  const bRank = scored.findIndex(m => m.teams.toLowerCase().includes('brighton') || m.teams.toLowerCase().includes('arsenal')) + 1;
  const bScore = scored.find(m => m.teams.toLowerCase().includes('brighton') || m.teams.toLowerCase().includes('arsenal'))?.totalScore;

  console.log(`\n=================== PROPOSED CALIBRATION: ${label} ===================`);
  console.log(`Top 5:  ${ud5}/5 (${(ud5/5*100).toFixed(1)}%) [Drw: ${dr5}, MF: ${mf5}]`);
  console.log(`Top 10: ${ud10}/10 (${(ud10/10*100).toFixed(1)}%) [Drw: ${dr10}, MF: ${mf10}]`);
  console.log(`Top 20: ${ud20}/20 (${(ud20/20*100).toFixed(1)}%) [Drw: ${dr20}, MF: ${mf20}]`);
  if (bRank > 0) console.log(`Brighton vs Arsenal: Rank #${bRank} with ${bScore} pts`);

  console.log(`\n--- Top 10 Matches ---`);
  top10.forEach((m, idx) => {
    const mark = m.outcome === 'UNDERDOG' ? '✅ UD' : (m.outcome === 'DRAW' ? '⚠️ DR' : '❌ MF');
    console.log(`${(idx + 1).toString().padStart(2)}. [${mark}] ${m.teams.padEnd(35)} | Res: ${m.result.padEnd(5)} | Score: ${m.totalScore}`);
  });
}

runSimulation(satMatches, "SATURDAY");
runSimulation(sunMatches, "SUNDAY");
runSimulation(liveMatches, "COMBINED");
