import fs from 'fs';

const liveMatches = JSON.parse(fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_upsets_matches.json', 'utf8'));

const satMatches = liveMatches.filter((m: any) => m.dateStr === '2026-09-19' || m.id.includes('20260919'));
const sunMatches = liveMatches.filter((m: any) => m.dateStr === '2026-09-20' || m.id.includes('20260920'));

// Test an explicit map of rule description -> points for native rules
export function evaluateNativeUpsets(match: any, rulePoints: Record<string, number>, phaStatsMap: any = {}) {
  let totalScore = 0;
  const rulesHit: Array<{ description: string; points: number }> = [];

  const mFav = match.teamsData?.market_favorite || match.mFav || '1';
  const underdog = match.teamsData?.market_underdog || (mFav === '1' ? '2' : '1');

  // Base Weight
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

  const m = match.match || match;

  // Goals
  const gaParts = (m.ga || '').split(/[:\- ]+/).map((s: string) => parseFloat(s.trim()));
  const gsParts = (m.gs || '').split(/[:\- ]+/).map((s: string) => parseFloat(s.trim()));
  const gaHome = m.gaHome ?? (!isNaN(gaParts[0]) ? gaParts[0] : 0);
  const gaAway = m.gaAway ?? (!isNaN(gaParts[1]) ? gaParts[1] : 0);
  const gsHome = m.gsHome ?? (!isNaN(gsParts[0]) ? gsParts[0] : 0);
  const gsAway = m.gsAway ?? (!isNaN(gsParts[1]) ? gsParts[1] : 0);

  const mFavGS = mFav === '1' ? gsHome : gsAway;
  const mFavGA = mFav === '1' ? gaHome : gaAway;
  const underdogGS = underdog === '1' ? gsHome : gsAway;
  const underdogGA = underdog === '1' ? gaHome : gaAway;

  // TS
  const favTS = mFav === '1' ? (m.tsa ?? 0) : (m.tsb ?? 0);
  const udTS = underdog === '1' ? (m.tsa ?? 0) : (m.tsb ?? 0);
  const absTSDiff = Math.abs(favTS - udTS);

  // Odds
  const moParts = (m.mo || '').split(/[- ,]+/).map((s: string) => parseFloat(s.trim())).filter((p: number) => !isNaN(p));
  const o1 = moParts[0] || 0;
  const oX = moParts[1] || 0;
  const o2 = moParts[2] || 0;
  const favOdds = mFav === '1' ? o1 : o2;
  const udOdds = underdog === '1' ? o1 : o2;
  const oddsUnderdogLessEqDraw = udOdds > 0 && oX > 0 && udOdds <= oX;

  // Points system
  const mFavPoints = mFav === '1' ? (m.pointSystemHome ?? 0) : (m.pointSystemAway ?? 0);
  const udPoints = underdog === '1' ? (m.pointSystemHome ?? 0) : (m.pointSystemAway ?? 0);

  // Predictions
  const paaPred = m.paaPred || m.paaData?.prediction || m.paaPrediction || '';
  const subPred = m.subPred || m.subPatternData?.finalPrediction || m.subPatternPrediction || '';
  const algoPred = m.algoPred || m.algoData?.prediction || m.algoPrediction || '';
  const mlPred = m.mlPred || m.mlData?.prediction || m.mlInfo?.mlPrediction || '';
  const seerPred = m.seerPred || m.seerData?.finalPrediction || '';

  const subPrimPred = m.subPrimPred || m.subPatternData?.primaryPrediction || m.subPatternPrimaryPrediction || '';
  const algoPrimPred = m.algoPrimPred || m.algoData?.primaryPrediction || m.algoPrimaryPrediction || '';
  const seerPrimPred = m.seerPrimPred || m.seerData?.primaryPrediction || '';

  const seerScoreUd = underdog === '1' ? (m.seerHomeScore ?? 0) : (m.seerAwayScore ?? 0);
  const seerScoreDraw = m.seerDrawScore ?? 0;

  // LE
  const leParts = (m.le || '').trim();
  let leData: any = null;
  if (leParts && leParts !== '-' && leParts !== 'NA') {
    const isAway = leParts.startsWith('B') || leParts.startsWith('b');
    const scoreStr = leParts.replace(/^[ABab]/, '');
    const scores = scoreStr.split(/[:\-]/).map((s: string) => parseInt(s.trim(), 10));
    if (scores.length === 2 && !isNaN(scores[0]) && !isNaN(scores[1])) {
      const homeScore = scores[0];
      const awayScore = scores[1];
      const isDraw = homeScore === awayScore;
      const homeWon = homeScore > awayScore;
      const awayWon = awayScore > homeScore;
      const favWon = mFav === '1' ? homeWon : awayWon;
      const udWon = underdog === '1' ? homeWon : awayWon;
      const udGoals = underdog === '1' ? homeScore : awayScore;
      const udWasAway = underdog === '2';
      leData = { isDraw, underdogWon: udWon, favoriteWon: favWon, underdogGoals: udGoals, underdogWasAway: udWasAway };
    }
  }

  // Tags & League
  const initialMatchTags: string[] = m.evaluatorTags || m.initialMatchTags || m.matchTags || [];
  const isIsraelMatch = initialMatchTags.some((t: string) => t.includes('ISRAEL')) || (m.league || '').toLowerCase().includes('israel');
  const isAfricanLeagueMatch = initialMatchTags.some((t: string) => t.includes('AFRICA')) || (m.league || '').toLowerCase().includes('africa');
  const isYouthMatch = initialMatchTags.some((t: string) => /\b(u21|u23|u20|u19|youth)\b/i.test(t)) ||
                       /\b(U21|U23|U20|U19)\b/i.test(m.teams || '') ||
                       /\b(U21|U23|U20|U19|Youth)\b/i.test(m.league || '');

  // L10
  const l10Parts = (m.l10 || '').split(/[:\- ]+/).map((s: string) => parseFloat(s.trim()));
  const l10Home = !isNaN(l10Parts[0]) ? l10Parts[0] : 0;
  const l10Away = !isNaN(l10Parts[1]) ? l10Parts[1] : 0;
  const mFavL10 = mFav === '1' ? l10Home : l10Away;
  const underdogL10 = underdog === '1' ? l10Home : l10Away;
  const hasValidL10 = !!(m.l10 && m.l10 !== 'NA' && m.l10 !== '-' && m.l10.includes(':') && !isNaN(l10Parts[0]) && !isNaN(l10Parts[1]));
  const underdogHasHigherL10 = hasValidL10 && (underdogL10 > mFavL10);

  // Hidden Dynamics
  const isClose = (a: number, b: number, d: number = 0.2) => Math.abs(a - b) <= d;
  const udHiddenStrength = underdogGS >= underdogGA && Math.abs(underdogGS - underdogGA) <= 0.2;
  const mFavHiddenStrength = mFavGS >= mFavGA && Math.abs(mFavGS - mFavGA) <= 0.2;
  const mFavHiddenWeakness = mFavGS < mFavGA && Math.abs(mFavGS - mFavGA) <= 0.2;
  const underdogHiddenStrengthOrWeakness = Math.abs(underdogGS - underdogGA) <= 0.2;
  const isVolatile = gaHome >= 1.1 && gaAway >= 1.1;
  const gaDiff_upset = Math.round((mFavGA - underdogGA) * 100) / 100;

  const is1XorX2 = (p?: string) => p === '1X' || p === 'X2';
  const subOnUd = subPrimPred === underdog;
  const algoOnUd = algoPrimPred === underdog;
  const seerOnUd = seerPrimPred === underdog;

  const applyRule = (desc: string) => {
    if (desc in rulePoints && rulePoints[desc] !== 0) {
      const pts = rulePoints[desc];
      totalScore += pts;
      rulesHit.push({ description: desc, points: pts });
    }
  };

  // EVALUATE ALL NATIVE RULES:

  // Rule 42: Match has BB, T12, or BD opw < 10%
  // Handled via rulePoints["Match has BB, T12, or BD opw < 10%"]
  // (In simulation, we assume minOtherOpw triggered if present in original rulesHit)
  if (match.rulesHit?.some((r: any) => r.description.includes("BB, T12, or BD opw < 10%"))) {
    applyRule("Match has BB, T12, or BD opw < 10%");
  }

  // PHA tiers
  if (udPhaPct >= 50) applyRule("PHA for Underdog >= 50%");
  else if (udPhaPct >= 40 && udPhaPct < 50) applyRule("PHA for Underdog >= 40% to < 50%");

  // Attack void penalty
  if (underdogGS < 1.0 && mFavGS > 1.0) applyRule("Underdog GS < 1.0 but M.fav GS > 1.0");

  // TS mismatches
  if (favTS >= 2.0 && udTS < 1.0) applyRule("M.fav TS >= 2.0 and Underdog TS < 1.0");
  if (absTSDiff <= 0.1) applyRule("M.fav and Underdog TS difference <= 0.1");
  if (absTSDiff <= 0.4) applyRule("Mfav TS and underdog TS difference is <=0.4");

  // Point system
  if (mFavPoints >= 60) applyRule("Point system has >= 60 points on M.fav");

  // Volatile & Attack / Defense
  if (isVolatile) applyRule("Both teams GA >= 1.1 (volatile match)");
  if (underdogGS - mFavGS >= 0.4) applyRule("Underdog GS >Mfav GS with >=0.4 points");
  if (Math.abs(underdogGS - mFavGS) <= 0.2 + Number.EPSILON && udHiddenStrength) {
    applyRule("Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength");
  }
  if (isClose(gaHome, gsAway, 0.2) && isClose(gsHome, gsAway, 0.2)) {
    applyRule("HGA=AGS + Equal GS");
  }
  if (gsHome < 1.0 && gsAway < 1.0 && underdogGS > mFavGS) {
    applyRule("Both teams GS < 1.0 and Und GS > Mfav GS");
  }
  if (mFavGS >= 2.0 && mFavGA >= 2.0 && underdogGA < 2.0 && underdogGA > 1.0 && underdogGS < 2.0 && underdogGS > 1.0 && underdogGS > underdogGA) {
    applyRule("Mfav GS and GA >= 2.0 And Underdog GA and GS <2.0 but >1.0 and GS >GA.");
  }
  if ((isClose(gaHome, gaAway, 0.2) || isClose(gsHome, gsAway, 0.2)) && mFavGS <= 1.0 && underdogGS >= 1.5) {
    applyRule("GS=GS + Mfav Gs <=1.0 and under dog GS >=1.5");
  }

  // Equal GS + AGA=HGS
  if (isClose(gsHome, gsAway, 0.2) && isClose(gaAway, gsHome, 0.2)) {
    if (mFavHiddenWeakness) applyRule("Equal GS + AGA=HGS + M.fav has hidden weakness");
    if (mFavHiddenStrength) applyRule("Equal GS + AGA=HGS + M.fav has hidden strength");
  }

  // Odds
  if (oddsUnderdogLessEqDraw) applyRule("Odds for underdog <= draw odds");
  if (oddsUnderdogLessEqDraw && udOdds >= 3.0) applyRule("Odds for underdog <= odds for draw but >= 3.0");
  if (oddsUnderdogLessEqDraw && udOdds >= 2.80 && udOdds <= 3.00) applyRule("Odds for underdog <= draw odds (2.80 to 3.00)");
  if (oX > 0 && oX < 3.0) applyRule("Odds for draw is < 3.0");
  if (favOdds >= 2.50) applyRule("High Favorite Odds (>= 2.50)");
  if (favOdds > 0 && oX > 0 && udOdds > 0 && favOdds < 3.0 && oX < 3.0 && udOdds < 3.0) {
    applyRule("Odds for Mfav,draw and Underdog are all <3.0");
  }

  // Seer
  if (seerScoreDraw > 0 && seerScoreDraw <= 20) applyRule("Seer score on draw <= 20%");
  if (seerScoreUd >= 45) applyRule("Seer score on underdog >= 45%");

  // Consensus
  if (subOnUd && algoOnUd) {
    applyRule("Sub pattern + Algo primary prediction supports underdog (Consensus 10 pts)");
    if (seerOnUd) applyRule("Seer primary predicts on underdog");
  } else if (seerOnUd) {
    applyRule("Seer primary predicts on underdog");
  } else if (algoOnUd) {
    applyRule("Algo primary prediction supports the underdog");
  }

  if (is1XorX2(paaPred) && is1XorX2(mlPred) && is1XorX2(seerPred) && subPred === '12' && algoPred === '12') {
    applyRule("PAA,ML And seer final is 1X/X2 But Sub pattern and Algo final is 12");
  }
  if (paaPred === '12' && subPred === '12' && algoPred === '12' && mlPred === '12') {
    applyRule("PAA, SubPattern, Algo, and ML agree on 12 hedge");
  }

  // Sub pattern draw hedge
  const subPrimIsDraw = subPrimPred === 'X';
  const subHedgesUd = (underdog === '2' && subPred === 'X2') || (underdog === '1' && subPred === '1X');
  if (subPrimIsDraw && subHedgesUd) applyRule("Sub pattern primary on draw and hedges with underdog");

  const algoPrimIsDraw = algoPrimPred === 'X';
  const algoHedgesUd = (underdog === '2' && algoPred === 'X2') || (underdog === '1' && algoPred === '1X');
  if (algoPrimIsDraw && algoHedgesUd) applyRule("Algo primary on draw and hedges with underdog");

  // LE & L10
  if (leData && leData.underdogWon) applyRule("LE : Underdog won the last encounter");
  if (underdogHasHigherL10) applyRule("Underdog L10 greater than Mfav L10");
  if (leData && !leData.underdogWasAway && underdog === '1') applyRule("Underdog was Home on LE and still playing at Home");

  // Leagues & Tags
  if (isIsraelMatch) applyRule("Match belong to israel leagues");
  if (isAfricanLeagueMatch) applyRule("Match belong to African leagues");
  if (isYouthMatch) applyRule("Youth League (U21,U23,U20,U19)");
  if (initialMatchTags.some((t: string) => t.startsWith('BANNED:UPSET_RISK'))) applyRule("Banned: Upset risk tag");

  // Hidden dynamics
  if (mFavHiddenStrength || mFavHiddenWeakness) applyRule("Mfav has hidden strength/weakness");
  if (mFavGS >= 2.0 && mFavGA >= 2.0) applyRule("Mfav GS and GA =>2.0");

  if (Math.abs(underdogGS - mFavGS) <= 0.2 + Number.EPSILON && underdogGA < mFavGA) {
    applyRule("Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA");
  }
  if (gaDiff_upset >= 0.5) applyRule("Underdog GA < Mfav GA with =>0.5 points");
  if (gaDiff_upset >= 0.1 && gaDiff_upset < 0.5) applyRule("Underdog GA < Mfav GA with =>0.1 but <0.5 points");

  if (underdogHiddenStrengthOrWeakness) applyRule("Underdog has hidden strength/weakness");
  if (underdogHiddenStrengthOrWeakness && underdogGS >= 2.0 && underdogGA >= 2.0) {
    applyRule("Underdog has hidden strength/weakness+Und GS and GA =>2.0");
  }
  if (underdogGS >= 2.0 && underdogGA >= 2.0) applyRule("Und GS and GA =>2.0");

  if (Math.abs(underdogGS - mFavGS) <= 0.2 + Number.EPSILON && Math.abs(underdogGA - mFavGA) <= 0.2 + Number.EPSILON) {
    applyRule("Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)");
  }

  // Borrowed high performers:
  if (leData && leData.underdogWasAway && leData.underdogWon) {
    applyRule("Underdog was away on LE and Won");
  }
  if (leData && leData.underdogWon && (leData.underdogGoals ?? 0) >= 2) {
    applyRule("LE Underdog won with 2+ goals");
  }
  if (udOdds > 0 && udOdds <= 2.80) {
    applyRule("Underdog odds <= 2.80");
  }
  if (gaHome > gsHome && gaAway > gsAway && gsHome <= 1.0 && gsAway <= 1.0) {
    applyRule("Both teams GA > GS and Both team GS <=1.0");
  }

  // Draw Trap Damper
  if (favOdds >= 2.50 && udOdds <= 2.80 && oX > 0 && oX < 3.30) {
    applyRule("Dead-Heat Draw Trap: Fav >= 2.50 + Ud <= 2.80 + Draw < 3.30");
  }

  return { totalScore, basePoints, rulesHit };
}

// Map calibrated points strictly to multiples of 5
const finalRulePoints: Record<string, number> = {
  // Primary drivers (Positive points)
  "Underdog was away on LE and Won": 20,
  "Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength": 20,
  "Underdog odds <= 2.80": 15,
  "LE Underdog won with 2+ goals": 15,
  "Both teams GA > GS and Both team GS <=1.0": 15,
  "Both teams GS < 1.0 and Und GS > Mfav GS": 15,
  "Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA": 15,
  "LE : Underdog won the last encounter": 15,
  "High Favorite Odds (>= 2.50)": 15,
  "Und GS and GA =>2.0": 10,
  "Underdog has hidden strength/weakness+Und GS and GA =>2.0": 10,
  "Underdog has hidden strength/weakness": 10,
  "Underdog GA < Mfav GA with =>0.5 points": 10,
  "Underdog GA < Mfav GA with =>0.1 but <0.5 points": 10,
  "Sub pattern + Algo primary prediction supports underdog (Consensus 10 pts)": 5,
  "Seer primary predicts on underdog": 5,
  "Underdog was Home on LE and still playing at Home": 5,
  "Both teams GA >= 1.1 (volatile match)": 5,
  "Odds for underdog <= draw odds": 5,
  "Odds for underdog <= draw odds (2.80 to 3.00)": 5,
  "Mfav TS and underdog TS difference is <=0.4": 5,
  "PHA for Underdog >= 50%": 5,
  "PHA for Underdog >= 40% to < 50%": 5,
  "Seer score on draw <= 20%": 10,
  "Seer score on underdog >= 45%": 5,

  // Severe Negative Penalties (Suppressing False Upsets & Traps)
  "Dead-Heat Draw Trap: Fav >= 2.50 + Ud <= 2.80 + Draw < 3.30": -10,
  "Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)": -15,
  "Underdog GS < 1.0 but M.fav GS > 1.0": -15,
  "M.fav TS >= 2.0 and Underdog TS < 1.0": -15,
  "Mfav has hidden strength/weakness": -15,
  "Youth League (U21,U23,U20,U19)": -15,
  "M.fav and Underdog TS difference <= 0.1": -10,
  "Point system has >= 60 points on M.fav": -10,
  "Odds for underdog <= odds for draw but >= 3.0": -10,
  "Odds for draw is < 3.0": -10,
  "Mfav GS and GA =>2.0": -10,
  "Banned: Upset risk tag": -10,
  "PAA,ML And seer final is 1X/X2 But Sub pattern and Algo final is 12": -10,
  "Equal GS + AGA=HGS + M.fav has hidden weakness": -10,
  "Equal GS + AGA=HGS + M.fav has hidden strength": -10,
  "Sub pattern primary on draw and hedges with underdog": -5,

  // Zero-Pruned Noise
  "Match has BB, T12, or BD opw < 10%": 0,
  "Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog": 0,
  "Underdog GS >Mfav GS with >=0.4 points": 0,
  "Underdog L10 greater than Mfav L10": 0,
  "HGA=AGS + Equal GS": 0,
  "Match belong to israel leagues": 0,
  "Match belong to African leagues": 0,
  "PAA, SubPattern, Algo, and ML agree on 12 hedge": 0,
  "Odds for Mfav,draw and Underdog are all <3.0": 0,
};

function testEvaluation(matches: any[], label: string) {
  const scored = matches.map(m => {
    const evalRes = evaluateNativeUpsets(m, finalRulePoints);
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

  console.log(`\n=================== ${label} ===================`);
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

testEvaluation(satMatches, "SATURDAY RESULTS");
testEvaluation(sunMatches, "SUNDAY RESULTS");
testEvaluation(liveMatches, "COMBINED 489 MATCHES RESULTS");
