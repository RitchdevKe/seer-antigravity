import fs from 'fs';
import { Match } from '../src/types';
import { getMarketFavorite, getOptimizedBaseWeight, getOptimizedScoreDetailed } from '../src/utils/optimizedweights';
import { parseL10 } from '../src/utils/l10Utils';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_upsets_matches.json';
const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const matchEntries: Array<{
  id: any;
  teams: string;
  league: string;
  result: string;
  actual: string;
  mFav: string;
  moUnderdog: string;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  basePoints: number;
  batch: string;
  match: Match;
}> = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const phaStatsMap = {};

// Helpers exact from optimizedweights.ts
const parseLastEncounter = (leStr: string | undefined, mFav: '1' | '2', underdog: '1' | '2') => {
  if (!leStr || leStr === 'NA' || leStr === '-' || leStr === 'Unknown') return null;
  const matchLE = leStr.trim().match(/^([AB])?\s*(\d+)\s*[:\-]\s*(\d+)$/i);
  if (!matchLE) return null;

  const prefix = matchLE[1] ? matchLE[1].toUpperCase() : 'A';
  const s1 = parseInt(matchLE[2], 10);
  const s2 = parseInt(matchLE[3], 10);
  if (isNaN(s1) || isNaN(s2)) return null;

  const teamAGoals = prefix === 'B' ? s2 : s1;
  const teamBGoals = prefix === 'B' ? s1 : s2;

  const mFavGoals = mFav === '1' ? teamAGoals : teamBGoals;
  const underdogGoals = underdog === '1' ? teamAGoals : teamBGoals;

  const mFavWon = mFavGoals > underdogGoals;
  const underdogWon = underdogGoals > mFavGoals;
  const isDraw = mFavGoals === underdogGoals;

  const mFavWasAway = (mFav === '1' && prefix === 'B') || (mFav === '2' && prefix === 'A');
  const underdogWasAway = (underdog === '1' && prefix === 'B') || (underdog === '2' && prefix === 'A');
  const margin = Math.abs(mFavGoals - underdogGoals);

  return {
    mFavGoals,
    underdogGoals,
    mFavWon,
    underdogWon,
    isDraw,
    mFavWasAway,
    underdogWasAway,
    margin
  };
};

const checkIsIsraelMatch = (match: Match): boolean => {
  const league = (match.league || '').toLowerCase();
  const teams = (match.teams || '').toLowerCase();
  return /\b(israel|ligat\s*ha['`’]?al|liga\s*leumit|israeli)\b/i.test(league) ||
         /\b(israel|ligat\s*ha['`’]?al|liga\s*leumit|israeli)\b/i.test(teams) ||
         /\((isr|israel)\)/i.test(teams);
};

const checkIsAfricanLeagueMatch = (match: Match): boolean => {
  const tags = match.evaluatorTags || [];
  if (tags.includes('BANNED:AFRICAN_LEAGUE')) return true;
  const league = (match.league || '').toLowerCase();
  const teams = (match.teams || '').toLowerCase();
  const r = /egypt|south africa|morocco|algeria|tunisia|ghana|nigeria|kenya|uganda|tanzania|zambia|angola|congo|cameroon|senegal|caf/i;
  return r.test(teams) || r.test(league);
};

export interface EvaluatedRule {
  id: number;
  description: string;
  category: 'ATTACK_DEFENSE' | 'ODDS_MARKET' | 'TEAM_STRENGTH_POINTS' | 'CONSENSUS_PREDICTORS';
  defaultPoints: number;
  test: (ctx: MatchContext) => boolean;
}

interface MatchContext {
  m: Match;
  mFav: '1' | '2';
  underdog: '1' | '2';
  mFavGS: number;
  underdogGS: number;
  mFavGA: number;
  underdogGA: number;
  favTS: number;
  udTS: number;
  mFavPoints: number;
  udPoints: number;
  isVolatile: boolean;
  mFavHiddenStrength: boolean;
  mFavHiddenWeakness: boolean;
  underdogHiddenStrength: boolean;
  underdogHiddenWeakness: boolean;
  udOdds: number;
  favOdds: number;
  drawOdds: number;
  oddsUnderdogLessEqDraw: boolean;
  rating1X2: number | null;
  isRatingGreaterEq7: boolean;
  leData: any;
  underdogHasHigherL10: boolean;
  hasLowOtherOpw: boolean;
  hasMidOtherOpw: boolean;
  subOnUd: boolean;
  algoOnUd: boolean;
  seerOnUd: boolean;
  subPrimIsDraw: boolean;
  subHedgesUd: boolean;
  isPaaSubAlgoMl12: boolean;
  isYouthMatch: boolean;
  isBannedUpsetRisk: boolean;
  isIsraelMatch: boolean;
  isAfricanLeagueMatch: boolean;
}

const catalog: EvaluatedRule[] = [];
function reg(description: string, category: EvaluatedRule['category'], defaultPoints: number, test: (ctx: MatchContext) => boolean) {
  catalog.push({ id: catalog.length, description, category, defaultPoints, test });
}

// 1. ATTACK & DEFENSE
reg("Both teams GA >= 1.1 (volatile match)", "ATTACK_DEFENSE", 5, (c) => c.isVolatile);
reg("Underdog GS >Mfav GS with >=0.4 points", "ATTACK_DEFENSE", 10, (c) => (c.underdogGS - c.mFavGS) >= 0.4);
reg("Und GS =Mfav GS (+-0.2) +Und GA <Mfav GA", "ATTACK_DEFENSE", 15, (c) => Math.abs(c.underdogGS - c.mFavGS) <= 0.2001 && c.underdogGA < c.mFavGA);
reg("Underdog GA < Mfav GA with =>0.1 but <0.5 points", "ATTACK_DEFENSE", 10, (c) => {
  const diff = c.mFavGA - c.underdogGA;
  return diff >= 0.1 && diff < 0.5;
});
reg("Underdog GA < Mfav GA with =>0.5 points", "ATTACK_DEFENSE", 15, (c) => (c.mFavGA - c.underdogGA) >= 0.5);
reg("Und GS =Mfav GS (+-0.2)+Und GA =Mfav GA (+-0.2)", "ATTACK_DEFENSE", 10, (c) => Math.abs(c.underdogGS - c.mFavGS) <= 0.2001 && Math.abs(c.underdogGA - c.mFavGA) <= 0.2001);
reg("Mfav GS=Underdog GS (+-0.2)+Underdog has hidden strength", "ATTACK_DEFENSE", 10, (c) => Math.abs(c.underdogGS - c.mFavGS) <= 0.2001 && c.underdogHiddenStrength);
reg("Underdog has hidden strength/weakness", "ATTACK_DEFENSE", 15, (c) => c.underdogHiddenStrength || c.underdogHiddenWeakness);
reg("Mfav has hidden strength/weakness", "ATTACK_DEFENSE", -15, (c) => c.mFavHiddenStrength || c.mFavHiddenWeakness);
reg("Und GS and GA =>2.0", "ATTACK_DEFENSE", 10, (c) => c.underdogGS >= 2.0 && c.underdogGA >= 2.0);
reg("Underdog has hidden strength/weakness+Und GS and GA =>2.0", "ATTACK_DEFENSE", 10, (c) => (c.underdogHiddenStrength || c.underdogHiddenWeakness) && c.underdogGS >= 2.0 && c.underdogGA >= 2.0);
reg("Both teams GS < 1.0 and Und GS > Mfav GS", "ATTACK_DEFENSE", 5, (c) => c.underdogGS > c.mFavGS && c.underdogGS < 1.0 && c.mFavGS < 1.0);
reg("Underdog GS < 1.0 but M.fav GS > 1.0", "ATTACK_DEFENSE", 5, (c) => c.underdogGS < 1.0 && c.mFavGS > 1.0);
reg("Mfav GS and GA =>2.0", "ATTACK_DEFENSE", -10, (c) => c.mFavGS >= 2.0 && c.mFavGA >= 2.0);
reg("GS=GS + Mfav Gs <=1.0 and under dog GS >=1.5", "ATTACK_DEFENSE", 15, (c) => Math.abs(c.mFavGS - c.underdogGS) <= 0.2 && c.mFavGS <= 1.0 && c.underdogGS >= 1.5);
reg("INVERT: Mfav GS =>1.8 and GA =<1.0", "ATTACK_DEFENSE", -20, (c) => c.mFavGS >= 1.8 && c.mFavGA <= 1.0);
reg("INVERT: Mfav GS - Ud GS >= 1.0", "ATTACK_DEFENSE", -15, (c) => (c.mFavGS - c.underdogGS) >= 1.0);
reg("INVERT: M.fav GA is > 0.6 points lower than Underdog GA", "ATTACK_DEFENSE", -15, (c) => (c.underdogGA - c.mFavGA) > 0.6);
reg("INVERT: Away favorite + Mfav GA <= 1.0 & Ud GA > 1.0", "ATTACK_DEFENSE", -15, (c) => c.mFav === '2' && c.mFavGA <= 1.0 && c.underdogGA > 1.0);
reg("Both teams GA > GS and Both team GS <=1.0", "ATTACK_DEFENSE", 10, (c) => c.mFavGA > c.mFavGS && c.underdogGA > c.underdogGS && c.mFavGS <= 1.0 && c.underdogGS <= 1.0);

// 2. ODDS & MARKET SENTIMENT
reg("Odds for underdog <= draw odds", "ODDS_MARKET", 5, (c) => c.oddsUnderdogLessEqDraw);
reg("Odds for underdog <= odds for draw but >= 3.0", "ODDS_MARKET", 5, (c) => c.oddsUnderdogLessEqDraw && c.udOdds >= 3.0);
reg("Odds for underdog <= draw odds (2.80 to 3.00)", "ODDS_MARKET", 5, (c) => c.oddsUnderdogLessEqDraw && c.udOdds >= 2.80 && c.udOdds <= 3.00);
reg("High Favorite Odds (>= 2.50)", "ODDS_MARKET", 10, (c) => c.favOdds >= 2.50);
reg("Odds for draw is < 3.0", "ODDS_MARKET", 5, (c) => c.drawOdds > 0 && c.drawOdds < 3.0);
reg("Odds for Mfav,draw and Underdog are all <3.0", "ODDS_MARKET", 10, (c) => c.favOdds > 0 && c.favOdds < 3.0 && c.drawOdds > 0 && c.drawOdds < 3.0 && c.udOdds > 0 && c.udOdds < 3.0);
reg("Underdog odds <= 2.80", "ODDS_MARKET", 15, (c) => c.udOdds > 0 && c.udOdds <= 2.80);
reg("INVERT: 1X2 Rating => 7", "ODDS_MARKET", -15, (c) => c.isRatingGreaterEq7);

// 3. TEAM STRENGTH & POINT SYSTEM & LAST ENCOUNTER
reg("Mfav TS and underdog TS difference is <=0.4", "TEAM_STRENGTH_POINTS", 5, (c) => Math.abs(c.favTS - c.udTS) <= 0.4);
reg("M.fav and Underdog TS difference <= 0.1", "TEAM_STRENGTH_POINTS", 10, (c) => Math.abs(c.favTS - c.udTS) <= 0.1);
reg("M.fav TS >= 2.0 and Underdog TS < 1.0", "TEAM_STRENGTH_POINTS", 10, (c) => c.favTS >= 2.0 && c.udTS < 1.0);
reg("INVERT: Mfav TS >= 2.0 and Ud TS < 0.7", "TEAM_STRENGTH_POINTS", -20, (c) => c.favTS >= 2.0 && c.udTS < 0.7);
reg("Point system has >= 60 points on M.fav", "TEAM_STRENGTH_POINTS", -5, (c) => c.mFavPoints >= 60);
reg("INVERT: Point system has >= 70 points on M.fav", "TEAM_STRENGTH_POINTS", -15, (c) => c.mFavPoints >= 70);
reg("Underdog has >= 45 points on point system + Sub pattern primary prediction supports the underdog", "TEAM_STRENGTH_POINTS", 0, (c) => c.udPoints >= 45 && c.subOnUd);
reg("Underdog has >= 5 more points on point system", "TEAM_STRENGTH_POINTS", 10, (c) => (c.udPoints - c.mFavPoints) >= 5);
reg("Point System Inversion (Underdog points > Favorite)", "TEAM_STRENGTH_POINTS", 10, (c) => c.udPoints > c.mFavPoints);
reg("Underdog L10 greater than Mfav L10", "TEAM_STRENGTH_POINTS", 10, (c) => c.underdogHasHigherL10);
reg("LE : Underdog won the last encounter", "TEAM_STRENGTH_POINTS", 10, (c) => !!c.leData && c.leData.underdogWon);
reg("Underdog was Home on LE and still playing at Home", "TEAM_STRENGTH_POINTS", 10, (c) => !!c.leData && !c.leData.underdogWasAway && c.underdog === '1');
reg("Underdog was away on LE and Won", "TEAM_STRENGTH_POINTS", 15, (c) => !!c.leData && c.leData.underdogWasAway && c.leData.underdogWon);
reg("LE Underdog won with 2+ goals", "TEAM_STRENGTH_POINTS", 15, (c) => !!c.leData && c.leData.underdogWon && c.leData.margin >= 2);

// 4. CONSENSUS, PREDICTORS & OTHER OPW CATEGORIES
reg("Match has BB, T12, or BD opw < 10%", "CONSENSUS_PREDICTORS", 20, (c) => c.hasLowOtherOpw);
reg("Match has BB, T12, or BD OPW 10–25% + Sub primary supports underdog", "CONSENSUS_PREDICTORS", 5, (c) => c.hasMidOtherOpw && c.subOnUd);
reg("Sub pattern + Algo primary prediction supports underdog (Consensus 10 pts)", "CONSENSUS_PREDICTORS", 10, (c) => c.subOnUd && c.algoOnUd);
reg("Seer primary predicts on underdog", "CONSENSUS_PREDICTORS", 5, (c) => c.seerOnUd);
reg("Sub pattern primary on draw and hedges with underdog", "CONSENSUS_PREDICTORS", 10, (c) => c.subPrimIsDraw && c.subHedgesUd);
reg("PAA, SubPattern, Algo, and ML agree on 12 hedge", "CONSENSUS_PREDICTORS", 10, (c) => c.isPaaSubAlgoMl12);
reg("Youth League (U21,U23,U20,U19)", "CONSENSUS_PREDICTORS", -15, (c) => c.isYouthMatch);
reg("Banned: Upset risk tag", "CONSENSUS_PREDICTORS", 5, (c) => c.isBannedUpsetRisk);
reg("Match belong to israel leagues", "CONSENSUS_PREDICTORS", 10, (c) => c.isIsraelMatch);
reg("Match belong to African leagues", "CONSENSUS_PREDICTORS", 10, (c) => c.isAfricanLeagueMatch);

// Save Catalog
const catalogOut = catalog.map(c => ({
  id: c.id,
  description: c.description,
  category: c.category,
  defaultPoints: c.defaultPoints
}));
fs.writeFileSync(`${outDir}\\upsets_augmented_catalog.json`, JSON.stringify(catalogOut, null, 2));

// BUILD MATRIX
const matrix: Array<{
  id: any;
  teams: string;
  league: string;
  result: string;
  actual: string;
  mFav: string;
  moUnderdog: string;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  basePoints: number;
  batch: string;
  triggeredRuleIds: number[];
  triggeredDescriptions: string[];
}> = [];

matchEntries.forEach(entry => {
  const m = entry.match;
  const mFav = getMarketFavorite(m) as '1' | '2';
  const underdog = (mFav === '1' ? '2' : '1') as '1' | '2';

  let gaH = parseFloat(m.gaHome?.toString() || '0');
  let gaA = parseFloat(m.gaAway?.toString() || '0');
  let gsH = parseFloat(m.gsHome?.toString() || '0');
  let gsA = parseFloat(m.gsAway?.toString() || '0');
  if ((gsH === 0 && gsA === 0) && typeof m.gs === 'string' && m.gs.includes(':')) {
    const parts = m.gs.split(/[:\- ]+/).map(s => parseFloat(s.trim()));
    if (!isNaN(parts[0])) gsH = parts[0];
    if (!isNaN(parts[1])) gsA = parts[1];
  }
  if ((gaH === 0 && gaA === 0) && typeof m.ga === 'string' && m.ga.includes(':')) {
    const parts = m.ga.split(/[:\- ]+/).map(s => parseFloat(s.trim()));
    if (!isNaN(parts[0])) gaH = parts[0];
    if (!isNaN(parts[1])) gaA = parts[1];
  }
  const mFavGA = mFav === '1' ? gaH : gaA;
  const underdogGA = underdog === '1' ? gaH : gaA;
  const mFavGS = mFav === '1' ? gsH : gsA;
  const underdogGS = underdog === '1' ? gsH : gsA;

  let rawTsa = m.tsa !== undefined && m.tsa !== null ? parseFloat(m.tsa.toString()) : NaN;
  let rawTsb = m.tsb !== undefined && m.tsb !== null ? parseFloat(m.tsb.toString()) : NaN;
  if (isNaN(rawTsa) || rawTsa === 0) {
    if (gaH > 0) rawTsa = parseFloat((gsH / gaH).toFixed(3));
    else if (gsH > 0) rawTsa = 2.0;
    else rawTsa = 0;
  }
  if (isNaN(rawTsb) || rawTsb === 0) {
    if (gaA > 0) rawTsb = parseFloat((gsA / gaA).toFixed(3));
    else if (gsA > 0) rawTsb = 2.0;
    else rawTsb = 0;
  }
  const favTS = mFav === '1' ? rawTsa : rawTsb;
  const udTS = mFav === '1' ? rawTsb : rawTsa;

  const mFavPoints = mFav === '1' ? (m.totalPoints?.home ?? 0) : (m.totalPoints?.away ?? 0);
  const udPoints = underdog === '1' ? (m.totalPoints?.home ?? 0) : (m.totalPoints?.away ?? 0);

  const isVolatile = mFavGA >= 1.1 && underdogGA >= 1.1;
  const mFavHiddenStrength = mFavGS >= mFavGA && Math.abs(mFavGS - mFavGA) <= 0.2;
  const mFavHiddenWeakness = mFavGS < mFavGA && Math.abs(mFavGS - mFavGA) <= 0.2;
  const underdogHiddenStrength = underdogGS >= underdogGA && Math.abs(underdogGS - underdogGA) <= 0.2;
  const underdogHiddenWeakness = underdogGS < underdogGA && Math.abs(underdogGS - underdogGA) <= 0.2;

  const moParts = (m.mo || '').split(/[- ,]+/).map(s => parseFloat(s.trim())).filter(p => !isNaN(p));
  const o1 = moParts[0] || 0;
  const oX = moParts[1] || 0;
  const o2 = moParts[2] || 0;
  const udOdds = underdog === '1' ? o1 : underdog === '2' ? o2 : 0;
  const favOdds = mFav === '1' ? o1 : mFav === '2' ? o2 : 0;
  const drawOdds = oX;
  const oddsUnderdogLessEqDraw = udOdds > 0 && drawOdds > 0 && udOdds <= drawOdds;

  const rawRating = m.rating || (m as any).rating1x2 || '';
  const ratingMatch = String(rawRating).match(/(\d+(?:\.\d+)?)/);
  const rating1X2 = ratingMatch ? parseFloat(ratingMatch[1]) : null;
  const isRatingGreaterEq7 = rating1X2 !== null && rating1X2 >= 7.0 - Number.EPSILON;

  const leData = parseLastEncounter(m.le, mFav, underdog);

  const parsedScriptL10 = parseL10(m.l10);
  const l10Home = parsedScriptL10.homeWins;
  const l10Away = parsedScriptL10.awayWins;
  const mFavL10 = mFav === '1' ? l10Home : l10Away;
  const underdogL10 = underdog === '1' ? l10Home : l10Away;
  const hasValidL10 = parsedScriptL10.isValid;
  const underdogHasHigherL10 = hasValidL10 && (underdogL10 > mFavL10);

  // Other OPW
  const checkCategories = [
    { tag: 'best_bet', catId: 'best_bet' },
    { tag: 'top10', catId: 'top_10_value' },
    { tag: 'bankers_dlive', catId: 'bankers_dlive' },
    { tag: 'bankers_jackpot', catId: 'bankers_jackpot' },
  ];
  let minOtherOpw: number | null = null;
  const tags = m.evaluatorTags || [];
  for (const item of checkCategories) {
    if (tags.some(t => t.startsWith(item.tag))) {
      const score = getOptimizedScoreDetailed(m, item.catId, phaStatsMap).totalScore;
      if (minOtherOpw === null || score < minOtherOpw) {
        minOtherOpw = score;
      }
    }
  }
  if (minOtherOpw === null) {
    for (const item of checkCategories) {
      const bw = getOptimizedBaseWeight(m, phaStatsMap, item.catId).points;
      if (bw < 25) {
        if (minOtherOpw === null || bw < minOtherOpw) minOtherOpw = bw;
      }
    }
  }
  const hasLowOtherOpw = minOtherOpw !== null && minOtherOpw < 10;
  const hasMidOtherOpw = minOtherOpw !== null && minOtherOpw >= 10 && minOtherOpw < 25;

  const subPrim = m.patternAnalysis?.primaryPrediction || '';
  const subFin = m.patternAnalysis?.subPatternPrediction || '';
  const subOnUd = subPrim === underdog;
  const subPrimIsDraw = subPrim === 'X';
  const udHedge = underdog === '1' ? '1X' : 'X2';
  const subHedgesUd = subFin === udHedge;

  const algoPrim = m.algoReport?.primaryPrediction || m.rawPrediction || m.pred1x2 || '';
  const algoFin = m.algoReport?.prediction || m.finalPrediction || '';
  const algoOnUd = algoPrim === underdog || algoFin === underdog;

  const seerPrim = m.seerPrimaryPrediction || '';
  const seerScores = m.seerScores || {};
  const seerOnUd = seerPrim === underdog || (seerScores[underdog] > (seerScores[mFav] || 0) && seerScores[underdog] > (seerScores['X'] || 0));

  const paaFin = m.paaPrediction || '';
  const mlFin = m.mlInfo?.mlPrediction || '';
  const isPaaSubAlgoMl12 = (paaFin === '12' || m.paaPrimaryPrediction === '12') && subFin === '12' && (algoFin === '12' || algoPrim === '12') && (mlFin === '12');

  const initialMatchTags = m.evaluatorTags || [];
  const isYouthMatch = initialMatchTags.some(t => /\b(u21|u23|u20|u19|youth)\b/i.test(t)) ||
                       /\b(U21|U23|U20|U19)\b/i.test(m.teams || '') ||
                       /\b(U21|U23|U20|U19|Youth)\b/i.test(m.league || '');
  const isBannedUpsetRisk = initialMatchTags.some(t => t.startsWith('BANNED:UPSET_RISK'));
  const isIsrael = checkIsIsraelMatch(m);
  const isAfrican = checkIsAfricanLeagueMatch(m);

  const ctx: MatchContext = {
    m,
    mFav,
    underdog,
    mFavGS,
    underdogGS,
    mFavGA,
    underdogGA,
    favTS,
    udTS,
    mFavPoints,
    udPoints,
    isVolatile,
    mFavHiddenStrength,
    mFavHiddenWeakness,
    underdogHiddenStrength,
    underdogHiddenWeakness,
    udOdds,
    favOdds,
    drawOdds,
    oddsUnderdogLessEqDraw,
    rating1X2,
    isRatingGreaterEq7,
    leData,
    underdogHasHigherL10,
    hasLowOtherOpw,
    hasMidOtherOpw,
    subOnUd,
    algoOnUd,
    seerOnUd,
    subPrimIsDraw,
    subHedgesUd,
    isPaaSubAlgoMl12,
    isYouthMatch,
    isBannedUpsetRisk,
    isIsraelMatch: isIsrael,
    isAfricanLeagueMatch: isAfrican
  };

  const triggeredRuleIds: number[] = [];
  const triggeredDescriptions: string[] = [];

  catalog.forEach(rule => {
    if (rule.test(ctx)) {
      triggeredRuleIds.push(rule.id);
      triggeredDescriptions.push(rule.description);
    }
  });

  const baseWeight = getOptimizedBaseWeight(m, phaStatsMap, 'upsets');

  matrix.push({
    id: entry.id,
    teams: entry.teams,
    league: entry.league,
    result: entry.result,
    actual: entry.actual,
    mFav: entry.mFav,
    moUnderdog: entry.moUnderdog,
    outcome: entry.outcome,
    basePoints: baseWeight.points,
    batch: entry.batch,
    triggeredRuleIds,
    triggeredDescriptions
  });
});

fs.writeFileSync(`${outDir}\\upsets_augmented_matrix.json`, JSON.stringify(matrix, null, 2));
console.log(`Successfully rebuilt matrix of ${matrix.length} matches with ${catalog.length} rules.`);
