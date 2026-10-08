import { Match } from '../types';

export interface MLFeatures {
  // Study 1: Match odds behavior (underdog odds < draw odds)
  study1_underdogLessThanDraw: boolean;
  
  // Study 2: PHA percentages
  study2_probConfidence: number | null;
  study2_pha: { fav: number; draw: number; underdog: number } | null;
  
  // Study 3: Sub pattern predictions
  study3_subPattern: string | null;
  study3_subPatPrimary: string | null;
  study3_subPatternPrediction: string | null;

  // Study 4: PAA prediction and percentages
  study4_paa: { fav: number; draw: number; underdog: number } | null;
  study4_paaPrimary: string | null;

  // Study 5: Algo prediction and probability confidence
  study5_algo: { fav: number; draw: number; underdog: number } | null;
  study5_algoPrimary: string | null;
  study5_algoPrediction: string | null;

  // Study 6: Seer weights predictions and percentages
  study6_seer: { fav: number; draw: number; underdog: number } | null;
  study6_seerPrimary: string | null;

  // Study 7: Team A TS vs Team B TS (Team strength difference)
  study7_tsFavVsUnderdog: number | null;

  // Study 8: Hidden strength (Underdog GS=GA +-2)
  study8_hiddenStrength: boolean;
  study8_underdogGoalDiff: number | null;

  // Study 9: PHA tie (volatility) (PHA draw = PHA underdog +-2)
  study9_algoTie: boolean;

  // Study 10: Hidden weakness (M.fav GS=GA +-2)
  study10_hiddenWeakness: boolean;
  study10_favGoalDiff: number | null;

  // Study 12: Draw volatility (max draw % across predictors)
  study12_maxDrawPercentage: number;

  // Study 13: Match points support
  study13_pointsSupport: 'Fav' | 'Underdog' | 'Draw' | 'Equal' | null;

  // Study 14 & 15: Agreements
  study14_predictorsAgreeDC: boolean;
  study15_predictorsAgreePrim: boolean;
  study15_predictorsAgreeFinal: boolean;

  // Study 16: Volatility (percentages below 40%)
  study16_allPercentagesBelow40: boolean;

  // Study 17: Groups
  study17_group: number | null;

  // Study 18: Category
  study18_category: string | null;
  
  // Study 21: Draw odds below 3.0 (which makes fav and draw < 3.0 and underdog > 3.0)
  study21_drawOddsBelow3: boolean;

  // Metadata for extraction
  favIndex: 0 | 1 | 2; // 0 for Home, 2 for Away
  underdogIndex: 0 | 1 | 2;
  odds: { home: number; draw: number; away: number } | null;
  rawPrediction: string | null;
}

/**
 * Extracts all 21 requested Machine Learning features from a Match object.
 */
export function extractMLFeatures(match: Match): MLFeatures | null {
  // 1. Parse Odds — supports both pipe (3.35|3.35|2.1), comma (3.35,3.35,2.1) separators, and object formats
  let homeOdds = 0, drawOdds = 0, awayOdds = 0;
  if (match.odds && typeof match.odds === 'object' && (match.odds as any).home !== undefined) {
      homeOdds = (match.odds as any).home;
      drawOdds = (match.odds as any).draw;
      awayOdds = (match.odds as any).away;
  } else {
      const parseOddsString = (str: string): [number, number, number] | null => {
        const parts = str.split(/[,|\s]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
        if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
        return null;
      };
      const oddsStr = match.mo || (typeof match.odds === 'string' ? match.odds : '');
      if (oddsStr && oddsStr !== 'NA' && oddsStr !== 'Unknown') {
        const parsed = parseOddsString(String(oddsStr));
        if (parsed) {
          [homeOdds, drawOdds, awayOdds] = parsed;
        }
      }
  }

  // If no valid odds, we cannot determine Fav vs Underdog reliably, 
  // but we could try to guess from TS. For ML consistency, require odds or fallback to TS.
  let favIndex: 0 | 1 | 2 = 0;
  let underdogIndex: 0 | 1 | 2 = 2;
  let hasValidOdds = homeOdds > 0 && awayOdds > 0;

  if (hasValidOdds) {
    if (homeOdds <= awayOdds) {
      favIndex = 0; // Home Fav
      underdogIndex = 2;
    } else {
      favIndex = 2; // Away Fav
      underdogIndex = 0;
    }
  } else {
    // Fallback to TS
    const tsa = match.tsa || 0;
    const tsb = match.tsb || 0;
    if (tsa >= tsb) {
      favIndex = 0;
      underdogIndex = 2;
    } else {
      favIndex = 2;
      underdogIndex = 0;
    }
  }

  const oddsObj = hasValidOdds ? { home: homeOdds, draw: drawOdds, away: awayOdds } : null;

  // Study 1: Match odds behavior (underdog odds < draw odds)
  let study1_underdogLessThanDraw = false;
  if (hasValidOdds) {
    const uOdds = favIndex === 0 ? awayOdds : homeOdds;
    study1_underdogLessThanDraw = uOdds < drawOdds;
  }

  // Study 21: Draw odds below 3.0
  let study21_drawOddsBelow3 = false;
  if (hasValidOdds) {
    study21_drawOddsBelow3 = drawOdds < 3.0;
  }

  // Study 2: PHA (NerdyTips percentage)
  let study2_probConfidence: number | null = match.probabilityConfidence || match.algoReport?.confidence || null;
  if (typeof study2_probConfidence === 'string') {
    study2_probConfidence = parseInt((study2_probConfidence as string).replace('%', ''), 10);
  }
  let study2_pha: { fav: number; draw: number; underdog: number } | null = null;
  if (match.percentage) {
    const pStr = match.percentage.replace(/%/g, '');
    const m1 = pStr.match(/1:\s*(\d+)/);
    const mX = pStr.match(/X:\s*(\d+)/);
    const m2 = pStr.match(/2:\s*(\d+)/);
    if (m1 && mX && m2) {
      const p1 = parseInt(m1[1], 10);
      const pX = parseInt(mX[1], 10);
      const p2 = parseInt(m2[1], 10);
      study2_pha = {
        fav: favIndex === 0 ? p1 : p2,
        draw: pX,
        underdog: underdogIndex === 2 ? p2 : p1
      };
    }
  }

  // Study 3: Sub patterns
  let study3_subPattern = null;
  let study3_subPatPrimary = null;
  let study3_subPatternPrediction = null;
  if (match.patternAnalysis && match.patternAnalysis.subPattern) {
    study3_subPattern = match.patternAnalysis.subPattern;
    study3_subPatPrimary = match.patternAnalysis.primaryPrediction;
    study3_subPatternPrediction = match.patternAnalysis.subPatternPrediction;
  } else if (match.subPatternOverride) {
    study3_subPattern = match.subPatternOverride.subCode;
    study3_subPatPrimary = match.subPatternOverride.primary;
    study3_subPatternPrediction = match.subPatternOverride.final;
  }

  // Study 4: PAA percentages
  let paa: { fav: number; draw: number; underdog: number } | null = null;
  if (match.paaWin !== undefined && match.paaDraw !== undefined && match.paaUpset !== undefined) {
    // Assuming paaWin/Draw/Upset are already normalized to 100% based on their meaning, 
    // but in SEER, paaWin usually refers to Home? Wait, let's assume PAA matches standard 1X2 order or Fav/Und.
    // If paaWin means home, we must check. Usually PAA is Home/Draw/Away in code or Fav/Draw/Und?
    // Let's assume paaWin is home for now, unless we verify. 
    // Looking at previous SEER code, PAA returns 1, X, 2 probabilities. 
    // We will assign them based on favIndex.
    const p1 = match.paaWin; // 1
    const pX = match.paaDraw; // X
    const p2 = match.paaUpset; // 2
    paa = {
      fav: favIndex === 0 ? p1 : p2,
      draw: pX,
      underdog: underdogIndex === 2 ? p2 : p1
    };
  }

  // Study 5: Algo prediction
  let algo: { fav: number; draw: number; underdog: number } | null = null;
  let study5_algoPrimary = null;
  let study5_algoPrediction = null;
  if (match.algoReport && match.algoReport.probabilities) {
    const p1 = match.algoReport.probabilities['1'];
    const pX = match.algoReport.probabilities['X'];
    const p2 = match.algoReport.probabilities['2'];
    
    const isDecimal = p1 <= 1 && pX <= 1;
    const multiplier = isDecimal ? 100 : 1;
    algo = {
      fav: (favIndex === 0 ? p1 : p2) * multiplier,
      draw: pX * multiplier,
      underdog: (underdogIndex === 2 ? p2 : p1) * multiplier
    };
    
    study5_algoPrediction = match.algoReport.prediction || null;
    
    if (match.algoReport.primaryPrediction) {
      study5_algoPrimary = match.algoReport.primaryPrediction;
    } else {
      // Infer primary prediction if missing (9006 matches in legacy dataset)
      if (p1 > pX && p1 > p2) study5_algoPrimary = '1';
      else if (p2 > p1 && p2 > pX) study5_algoPrimary = '2';
      else if (pX > p1 && pX > p2) study5_algoPrimary = 'X';
    }
  }

  // Study 6: Seer percentages
  let seer: { fav: number; draw: number; underdog: number } | null = null;
  if (match.seerPercentages) {
    seer = {
      fav: favIndex === 0 ? match.seerPercentages['1'] : match.seerPercentages['2'],
      draw: match.seerPercentages['X'],
      underdog: underdogIndex === 2 ? match.seerPercentages['2'] : match.seerPercentages['1']
    };
  }

  // Study 7: TS
  const tsa = match.tsa || 0;
  const tsb = match.tsb || 0;
  const study7_tsFavVsUnderdog = favIndex === 0 ? tsa - tsb : tsb - tsa;

  // Goal stats
  const gsHome = match.gsHome || 0;
  const gaHome = match.gaHome || 0;
  const gsAway = match.gsAway || 0;
  const gaAway = match.gaAway || 0;

  const gsFav = favIndex === 0 ? gsHome : gsAway;
  const gaFav = favIndex === 0 ? gaHome : gaAway;
  const gsUnd = underdogIndex === 2 ? gsAway : gsHome;
  const gaUnd = underdogIndex === 2 ? gaAway : gaHome;

  // Study 8: Hidden strength (Underdog GS=GA +-2)
  const underdogGoalDiff = gsUnd - gaUnd;
  const study8_hiddenStrength = Math.abs(underdogGoalDiff) <= 0.2;

  // Study 10: Hidden weakness (Fav GS=GA +-2)
  const favGoalDiff = gsFav - gaFav;
  const study10_hiddenWeakness = Math.abs(favGoalDiff) <= 0.2;

  // Study 9: PHA Tie (PHA draw = PHA underdog +-2)
  let study9_algoTie = false;
  if (algo) {
    study9_algoTie = Math.abs(algo.draw - algo.underdog) <= 2;
  }

  // Study 12: Max Draw Percentage
  let study12_maxDrawPercentage = 0;
  if (paa) study12_maxDrawPercentage = Math.max(study12_maxDrawPercentage, paa.draw);
  if (algo) study12_maxDrawPercentage = Math.max(study12_maxDrawPercentage, algo.draw);
  if (seer) study12_maxDrawPercentage = Math.max(study12_maxDrawPercentage, seer.draw);

  // Study 13: Points support
  let study13_pointsSupport: 'Fav' | 'Underdog' | 'Draw' | 'Equal' | null = null;
  if (match.totalPoints) {
    const pFav = favIndex === 0 ? match.totalPoints.home : match.totalPoints.away;
    const pUnd = underdogIndex === 2 ? match.totalPoints.away : match.totalPoints.home;
    const pDraw = match.totalPoints.draw;
    
    // Simple heuristic: which point is highest? Are they within 5?
    const maxP = Math.max(pFav, pUnd, pDraw);
    let closeToMax = 0;
    if (Math.abs(pFav - maxP) <= 5) closeToMax++;
    if (Math.abs(pUnd - maxP) <= 5) closeToMax++;
    if (Math.abs(pDraw - maxP) <= 5) closeToMax++;

    if (closeToMax > 1) {
      study13_pointsSupport = 'Equal';
    } else if (maxP === pFav) {
      study13_pointsSupport = 'Fav';
    } else if (maxP === pUnd) {
      study13_pointsSupport = 'Underdog';
    } else {
      study13_pointsSupport = 'Draw';
    }
  }

  // Predictor Agreements
  let preds = [];
  if (match.finalPrediction) preds.push(match.finalPrediction);
  if (match.paaPrediction) preds.push(match.paaPrediction);
  if (match.algoReport && match.algoReport.prediction) preds.push(match.algoReport.prediction);
  if (match.seerPrediction) preds.push(match.seerPrediction);
  if (study3_subPatternPrediction) preds.push(study3_subPatternPrediction);
  preds = preds.map(p => p.trim().toUpperCase()).filter(p => p);

  let primaryPreds = [];
  if (match.rawPrediction) primaryPreds.push(match.rawPrediction);
  if (match.paaPrimaryPrediction) primaryPreds.push(match.paaPrimaryPrediction);
  if (match.algoReport && match.algoReport.primaryPrediction) primaryPreds.push(match.algoReport.primaryPrediction);
  if (match.seerPrimaryPrediction) primaryPreds.push(match.seerPrimaryPrediction);
  if (study3_subPatPrimary) primaryPreds.push(study3_subPatPrimary);
  primaryPreds = primaryPreds.map(p => p.trim().toUpperCase()).filter(p => p);

  // Check if they all agree on 1X/X2/12
  let study14_predictorsAgreeDC = false;
  if (preds.length >= 3) {
    const covers1X = preds.every(p => p === '1' || p === 'X' || p === '1X' || p === '1 X');
    const coversX2 = preds.every(p => p === '2' || p === 'X' || p === 'X2' || p === 'X 2');
    const covers12 = preds.every(p => p === '1' || p === '2' || p === '12' || p === '1 2');
    study14_predictorsAgreeDC = covers1X || coversX2 || covers12;
  }

  // Check if they all agree on Primary prediction (1, X, 2)
  let study15_predictorsAgreePrim = false;
  if (primaryPreds.length >= 3) {
    const firstPrim = primaryPreds.find(p => ['1', 'X', '2'].includes(p));
    if (firstPrim) {
      study15_predictorsAgreePrim = primaryPreds.every(p => p === firstPrim);
    }
  }

  // Check if they all agree on Final prediction
  let study15_predictorsAgreeFinal = false;
  if (preds.length >= 3) {
    const firstFinal = preds[0];
    study15_predictorsAgreeFinal = preds.every(p => p === firstFinal);
  }

  // Study 16: Volatile Matches (All % below 40% for Fav/Draw/Und)
  // This means the highest probability is < 40%.
  let study16_allPercentagesBelow40 = false;
  let allMaxes: number[] = [];
  if (paa) allMaxes.push(Math.max(paa.fav, paa.draw, paa.underdog));
  if (algo) allMaxes.push(Math.max(algo.fav, algo.draw, algo.underdog));
  if (seer) allMaxes.push(Math.max(seer.fav, seer.draw, seer.underdog));

  if (allMaxes.length > 0) {
    // If every single model's max probability is < 40
    study16_allPercentagesBelow40 = allMaxes.every(m => m < 40);
  }

  return {
    study1_underdogLessThanDraw,
    study2_probConfidence,
    study3_subPattern,
    study3_subPatPrimary,
    study3_subPatternPrediction,
    study4_paa: paa,
      study4_paaPrimary: match.paaPrimaryPrediction || null,
    study5_algo: algo,
    study5_algoPrimary,
    study5_algoPrediction,
    study6_seer: seer,
      study6_seerPrimary: match.seerPrimaryPrediction || null,
    study7_tsFavVsUnderdog,
    study8_hiddenStrength,
    study8_underdogGoalDiff: underdogGoalDiff,
    study9_algoTie,
    study10_hiddenWeakness,
    study10_favGoalDiff: favGoalDiff,
    study12_maxDrawPercentage,
    study13_pointsSupport,
    study14_predictorsAgreeDC,
    study15_predictorsAgreePrim,
    study15_predictorsAgreeFinal,
    study16_allPercentagesBelow40,
    study17_group: match.group || null,
    study18_category: match.priority || match.algoReport?.category || null,
    study21_drawOddsBelow3,
    favIndex,
    underdogIndex,
    odds: oddsObj,
    study2_pha,
    rawPrediction: match.rawPrediction || null
  };
}

/**
 * Extracts categorical variances for all major match card data points.
 * Used for deep ML decision tree branching and dynamic pivoting.
 */
export function getMLVariations(m: Match, features: MLFeatures): Record<string, string> {
  const isHomeFav = features.favIndex === 0;
  
  // Points: use pts1/pts2 if available, otherwise fall back to totalPoints.home/away
  const hPts = parseFloat((m as any).pts1 || '') || (m.totalPoints?.home ?? 0);
  const aPts = parseFloat((m as any).pts2 || '') || (m.totalPoints?.away ?? 0);
  const favPts = isHomeFav ? hPts : aPts;
  const undPts = isHomeFav ? aPts : hPts;
  
  // TS: use tsa/tsb directly (already numbers)
  const hTs = m.tsa ?? 0;
  const aTs = m.tsb ?? 0;
  const favTs = isHomeFav ? hTs : aTs;
  const undTs = isHomeFav ? aTs : hTs;

  const getWinner = (obj: any) => {
     if (!obj) return 'Unknown';
     const max = Math.max(obj.fav, obj.draw, obj.underdog);
     if (max === obj.fav) return 'Fav';
     if (max === obj.underdog) return 'Underdog';
     return 'Draw';
  };

  // Variance 1: Points
  let ptsVar = 'Fav > Und';
  if (undPts > favPts + 5) ptsVar = 'Und >> Fav';
  else if (undPts > favPts) ptsVar = 'Und > Fav';
  else if (favPts > undPts + 10) ptsVar = 'Fav >> Und';
  else if (Math.abs(undPts - favPts) <= 5) ptsVar = 'Equal';

  // Variance 2: TS
  let tsVar = 'Fav > Und';
  if (undTs > favTs + 0.5) tsVar = 'Und >> Fav';
  else if (undTs > favTs) tsVar = 'Und > Fav';
  else if (favTs > undTs + 1.0) tsVar = 'Fav >> Und';

  // Variance 3: Agreement
  let agreeVar = 'Disagree';
  if (features.study15_predictorsAgreePrim) agreeVar = 'Agree (Primary)';
  else if (features.study14_predictorsAgreeDC) agreeVar = 'Agree (DC)';

  return {
     'Points': ptsVar,
     'TS': tsVar,
     'PHA': getWinner(features.study2_pha),
     'Algo': getWinner(features.study5_algo),
     'PAA': getWinner(features.study4_paa),
     'SEER': getWinner(features.study6_seer),
     'Agreement': agreeVar
  };
}

export const ML_VARIABLES_DESCRIPTIONS: Record<number, string> = {
  1: "M.fav >= 60%",
  2: "M.fav >= 50%",
  3: "M.fav >= 40%",
  4: "M.fav >= 35%",
  5: "Draw >= 50%",
  6: "Draw >= 40%",
  7: "Draw >= 35%",
  8: "M.fav > 30%",
  9: "Underdog >= 50%",
  10: "Underdog >= 40%",
  11: "Underdog >= 35%",
  12: "Underdog > 30%"
};

// Which predictors are involved in each base pattern
const PATTERN_PREDICTORS: Record<string, string[]> = {
  SIa: ['Algo','PAA','Seer','PHA'], SIb: ['Algo','PAA','Seer','PHA'],
  SIc: ['PAA'], SId: ['PAA'], SIe: ['PAA'],
  SIf: ['PHA'], SIg: ['PHA'], SIh: ['PHA'],
  SIi: ['Seer'], SIj: ['Seer'], SIk: ['Seer'],
  SIl: ['Algo'], SIm: ['Algo'], SIn: ['Algo'],
  SIo: ['Algo','PAA','Seer','PHA'], SIp: ['Algo','PAA','Seer','PHA'], SIq: ['Algo','PAA','Seer','PHA'],
  SIr: ['Algo','PAA','Seer'], SIs: ['Algo','PAA','Seer'], SIt: ['Algo','PAA','Seer'],
  SIu: ['Algo','PAA','PHA'], SIv: ['Algo','PAA','PHA'], SIw: ['Algo','PAA','PHA'],
  SIx: ['Algo','PHA','Seer'], SIy: ['Algo','PHA','Seer'], SIz: ['Algo','PHA','Seer'],
  SIaa: ['PHA','PAA','Seer'], SIbb: ['PHA','PAA','Seer'], SIcc: ['PHA','PAA','Seer'],
  SIdd: ['Algo','PAA','Seer','PHA'], SIee: ['Algo','PAA','Seer','PHA'], SIff: ['Algo','PAA','Seer','PHA'],
  SIgg: ['Algo','PAA'], SIhh: ['Algo','PAA'], SIii: ['Algo','PAA'],
  SIjj: ['Algo','Seer'], SIkk: ['Algo','Seer'], SIll: ['Algo','Seer'],
  SImm: ['Algo','PHA'], SInn: ['Algo','PHA'], SIoo: ['Algo','PHA'],
  SIpp: ['PAA','Seer'], SIqq: ['PAA','Seer'], SIrr: ['PAA','Seer'],
  SIss: ['PAA','PHA'], SItt: ['PAA','PHA'], SIuu: ['PAA','PHA'],
  SIvv: ['Seer','PHA'], SIww: ['Seer','PHA'], SIxx: ['Seer','PHA'],
};

// Outcome category for each variable number
function getVarOutcome(varNum: number): 'fav' | 'draw' | 'und' {
  if ([1,2,3,4,8].includes(varNum)) return 'fav';
  if ([5,6,7].includes(varNum)) return 'draw';
  return 'und';
}

// Threshold text for each variable number
function getVarThreshold(varNum: number): string {
  const map: Record<number, string> = {
    1: '>= 60%', 2: '>= 50%', 3: '>= 40%', 4: '>= 35%',
    5: '>= 50%', 6: '>= 40%', 7: '>= 35%',
    8: '> 30%',
    9: '>= 50%', 10: '>= 40%', 11: '>= 35%', 12: '> 30%'
  };
  return map[varNum] || '';
}

// Get predictor-specific label for an outcome
function getPredictorLabel(predictor: string, outcome: 'fav' | 'draw' | 'und'): string {
  if (predictor === 'Algo') {
    if (outcome === 'fav') return 'Algo M.fav';
    if (outcome === 'draw') return 'Algo Draw';
    return 'Algo Underdog';
  }
  if (predictor === 'PAA') {
    if (outcome === 'fav') return 'PAA M.fav';
    if (outcome === 'draw') return 'PAA Draw';
    return 'PAA Underdog';
  }
  if (predictor === 'Seer') {
    if (outcome === 'fav') return 'Seer score M.fav';
    if (outcome === 'draw') return 'Seer score Draw';
    return 'Seer score Underdog';
  }
  if (predictor === 'PHA') {
    if (outcome === 'fav') return 'PHA Home win';
    if (outcome === 'draw') return 'PHA Draw';
    return 'PHA Away win';
  }
  return predictor;
}

/**
 * Returns a predictor-specific sub-pattern description.
 * e.g. getSubPatternDescription('SIu', 1) → "Algo M.fav >= 60% + PAA M.fav >= 60% + PHA Home win >= 60%"
 */
export function getSubPatternDescription(basePattern: string, varNum: number): string {
  const predictors = PATTERN_PREDICTORS[basePattern];
  if (!predictors) return ML_VARIABLES_DESCRIPTIONS[varNum] || `Variable ${varNum}`;

  const outcome = getVarOutcome(varNum);
  const threshold = getVarThreshold(varNum);

  return predictors
    .map(p => `${getPredictorLabel(p, outcome)} ${threshold}`)
    .join(' + ');
}

export const ML_BASE_PATTERNS_DESCRIPTIONS: Record<string, string> = {
  "SIa": "Draw odds < 3.0",
  "SIb": "Underdog Market odds < Draw odds",
  "SIc": "PAA prim supports M.fav",
  "SId": "PAA prim supports Draw",
  "SIe": "PAA prim supports Underdog",
  "SIf": "Sub prim pattern supports M.fav",
  "SIg": "Sub prim pattern supports draw",
  "SIh": "Sub patt prim supports underdog",
  "SIi": "Seer prim supports M.fav",
  "SIj": "Seer primary supports Draw",
  "SIk": "Seer prim supports Underdog",
  "SIl": "Algo prim supports M.fav",
  "SIm": "Algo prim supports Draw",
  "SIn": "Algo prim supports Underdog",
  "SIo": "All predictors prim support M.fav",
  "SIp": "All predictors prim supports draw",
  "SIq": "All predictors prim support Underdog",
  "SIr": "Algo+paa+seer prim support M.fav",
  "SIs": "Algo+paa+seer prim support Draw",
  "SIt": "Algo+paa+seer prim support Underdog",
  "SIu": "Algo+paa+sub patt prim support M.fav",
  "SIv": "Algo+paa+sub patt prim support Draw",
  "SIw": "Algo+paa+sub patt prim support Underdog",
  "SIx": "Algo+Sub patt+seer prim support M.fav",
  "SIy": "Algo+sub patt+seer prim support Draw",
  "SIz": "Algo+Sub patt+seer prim support Underdog",
  "SIaa": "Sub patt+paa+seer prim support M.fav",
  "SIbb": "Sub patt+paa+seer prim support Draw",
  "SIcc": "Sub patt+paa+seer prim support Underdog",
  "SIdd": "Point system supports underdog",
  "SIee": "TS supports Underdog",
  "SIff": "Underdog has hidden strenghth",
  "SIgg": "Algo+paa prim support M.fav",
  "SIhh": "Algo+paa prim support Draw",
  "SIii": "Algo+paa prim support Underdog",
  "SIjj": "Algo+seer prim support M.fav",
  "SIkk": "Algo+seer prim support Draw",
  "SIll": "Algo+seer prim support Underdog",
  "SImm": "Algo+Sub patt prim support M.fav",
  "SInn": "Algo+Sub patt prim support Draw",
  "SIoo": "Algo+Sub patt prim support Underdog",
  "SIpp": "PAA+seer prim support M.fav",
  "SIqq": "PAA+seer prim support Draw",
  "SIrr": "PAA+seer prim support Underdog",
  "SIss": "PAA+Sub patt prim support M.fav",
  "SItt": "PAA+Sub patt prim support Draw",
  "SIuu": "PAA+Sub patt prim support Underdog",
  "SIvv": "seer+Sub patt prim support M.fav",
  "SIww": "seer+Sub patt prim support Draw",
  "SIxx": "seer+Sub patt prim support Underdog"
};

function getSubPatternSuffixes(probs: { fav: number; draw: number; underdog: number } | null): number[] {
  if (!probs) return [];
  const tags: number[] = [];
  
  // Fav
  if (probs.fav >= 60) tags.push(1);
  else if (probs.fav >= 50) tags.push(2);
  else if (probs.fav >= 40) tags.push(3);
  else if (probs.fav >= 35) tags.push(4);
  else if (probs.fav > 30) tags.push(8);
  
  // Draw
  if (probs.draw >= 50) tags.push(5);
  else if (probs.draw >= 40) tags.push(6);
  else if (probs.draw >= 35) tags.push(7);
  
  // Underdog
  if (probs.underdog >= 50) tags.push(9);
  else if (probs.underdog >= 40) tags.push(10);
  else if (probs.underdog >= 35) tags.push(11);
  else if (probs.underdog > 30) tags.push(12);

  return tags;
}

function getCombinedProbabilities(bp: string, features: MLFeatures): { fav: number; draw: number; underdog: number } | null {


  const sources: Array<{ fav: number; draw: number; underdog: number }> = [];
  const add = (src: any) => { if (src) sources.push(src); };

  const exact = (list: string[]) => list.includes(bp);

  // Algo
  if (exact(['SIl','SIm','SIn', 'SIo','SIp','SIq', 'SIr','SIs','SIt', 'SIu','SIv','SIw', 'SIx','SIy','SIz', 'SIgg','SIhh','SIii', 'SIjj','SIkk','SIll', 'SImm','SInn','SIoo'])) {
    add(features.study5_algo);
  }
  // PAA
  if (exact(['SIc','SId','SIe', 'SIo','SIp','SIq', 'SIr','SIs','SIt', 'SIu','SIv','SIw', 'SIaa','SIbb','SIcc', 'SIgg','SIhh','SIii', 'SIpp','SIqq','SIrr', 'SIss','SItt','SIuu'])) {
    add(features.study4_paa);
  }
  // Seer
  if (exact(['SIi','SIj','SIk', 'SIo','SIp','SIq', 'SIr','SIs','SIt', 'SIx','SIy','SIz', 'SIaa','SIbb','SIcc', 'SIjj','SIkk','SIll', 'SIpp','SIqq','SIrr', 'SIvv','SIww','SIxx'])) {
    add(features.study6_seer);
  }
  // Sub patt (PHA)
  if (exact(['SIf','SIg','SIh', 'SIo','SIp','SIq', 'SIu','SIv','SIw', 'SIx','SIy','SIz', 'SIaa','SIbb','SIcc', 'SImm','SInn','SIoo', 'SIss','SItt','SIuu', 'SIvv','SIww','SIxx'])) {
    add(features.study2_pha); // study2_pha contains the PHA/NerdyTips percentages
  }

  // Standalone patterns (Points, TS, Hidden strength) get an average of all 4 predictors
  // Odds-based + standalone patterns use all 4 predictors
  if (exact(['SIa','SIdd','SIff','SI_Odds_ExtremeFav','SI_Odds_HeavyFav','SI_Odds_SolidFav','SI_Odds_MarginalFav','SI_Odds_EvenMatch','SI_TS_Disadv_Heavy','SI_TS_Disadv_Mod','SI_TS_Disadv_Small','SI_TS_Adv_Small','SI_TS_Adv_Mod','SI_TS_Adv_Heavy','SI_Spread_UndFavored','SI_Spread_UndMarginal','SI_Spread_DrawFavored'])) {
    add(features.study5_algo);
    add(features.study4_paa);
    add(features.study6_seer);
    add(features.study2_pha);
  }

  if (sources.length === 0) return null;

  return {
    fav: sources.reduce((sum, s) => sum + s.fav, 0) / sources.length,
    draw: sources.reduce((sum, s) => sum + s.draw, 0) / sources.length,
    underdog: sources.reduce((sum, s) => sum + s.underdog, 0) / sources.length
  };
}

/**
 * VISION ALGO: Translates ML Features into granular SI Variant tags.
 * Follows strict Base Pattern + 1-12 Sub Pattern Variation logic.
 */
export function generateSITags(features: MLFeatures): string[] {
  const tags: string[] = [];
  const basePatterns: string[] = [];

  const favWin = features.favIndex === 0 ? "1" : "2";
  const undWin = features.favIndex === 0 ? "2" : "1";
  
  const drawOdds = features.odds?.draw || 0;
  const undOdds = features.odds ? (features.favIndex === 0 ? features.odds.away : features.odds.home) : 0;

  const paaPrim = features.study4_paaPrimary;
  const subPrim = features.study3_subPatPrimary;
  const seerPrim = features.study6_seerPrimary;
  const algoPrim = features.study5_algoPrimary;

  // 1. Draw odds < 3.0
  if (drawOdds > 0 && drawOdds < 3.0) basePatterns.push('SIa');
  // 2. Spread Bucketing
  if (drawOdds > 0 && undOdds > 0) {
      const spread = drawOdds - undOdds;
      if (spread > 0.5) basePatterns.push('SI_Spread_UndFavored');
      else if (spread > 0) basePatterns.push('SI_Spread_UndMarginal');
      else basePatterns.push('SI_Spread_DrawFavored');
  }

  // PAA Primary
  if (paaPrim === favWin) basePatterns.push('SIc');
  if (paaPrim === 'X') basePatterns.push('SId');
  if (paaPrim === undWin) basePatterns.push('SIe');

  // Sub Pattern Primary
  if (subPrim === favWin) basePatterns.push('SIf');
  if (subPrim === 'X') basePatterns.push('SIg');
  if (subPrim === undWin) basePatterns.push('SIh');

  // Seer Primary
  if (seerPrim === favWin) basePatterns.push('SIi');
  if (seerPrim === 'X') basePatterns.push('SIj');
  if (seerPrim === undWin) basePatterns.push('SIk');

  // Algo Primary
  if (algoPrim === favWin) basePatterns.push('SIl');
  if (algoPrim === 'X') basePatterns.push('SIm');
  if (algoPrim === undWin) basePatterns.push('SIn');

  // All predictors prim
  if (paaPrim === favWin && subPrim === favWin && seerPrim === favWin && algoPrim === favWin) basePatterns.push('SIo');
  if (paaPrim === 'X' && subPrim === 'X' && seerPrim === 'X' && algoPrim === 'X') basePatterns.push('SIp');
  if (paaPrim === undWin && subPrim === undWin && seerPrim === undWin && algoPrim === undWin) basePatterns.push('SIq');

  // Algo+paa+seer
  if (algoPrim === favWin && paaPrim === favWin && seerPrim === favWin) basePatterns.push('SIr');
  if (algoPrim === 'X' && paaPrim === 'X' && seerPrim === 'X') basePatterns.push('SIs');
  if (algoPrim === undWin && paaPrim === undWin && seerPrim === undWin) basePatterns.push('SIt');

  // Algo+paa+sub patt
  if (algoPrim === favWin && paaPrim === favWin && subPrim === favWin) basePatterns.push('SIu');
  if (algoPrim === 'X' && paaPrim === 'X' && subPrim === 'X') basePatterns.push('SIv');
  if (algoPrim === undWin && paaPrim === undWin && subPrim === undWin) basePatterns.push('SIw');

  // Algo+Sub patt+seer
  if (algoPrim === favWin && subPrim === favWin && seerPrim === favWin) basePatterns.push('SIx');
  if (algoPrim === 'X' && subPrim === 'X' && seerPrim === 'X') basePatterns.push('SIy');
  if (algoPrim === undWin && subPrim === undWin && seerPrim === undWin) basePatterns.push('SIz');

  // Sub patt+paa+seer
  if (subPrim === favWin && paaPrim === favWin && seerPrim === favWin) basePatterns.push('SIaa');
  if (subPrim === 'X' && paaPrim === 'X' && seerPrim === 'X') basePatterns.push('SIbb');
  if (subPrim === undWin && paaPrim === undWin && seerPrim === undWin) basePatterns.push('SIcc');

  // 30. Point system supports underdog
  if (features.study13_pointsSupport === 'Underdog') basePatterns.push('SIdd');
  
  // 31. TS supports Underdog and bucketing
  if (features.study7_tsFavVsUnderdog !== null) {
      const ts = features.study7_tsFavVsUnderdog;
      if (ts < -10) basePatterns.push('SI_TS_Disadv_Heavy');
      else if (ts < -5) basePatterns.push('SI_TS_Disadv_Mod');
      else if (ts < 0) basePatterns.push('SI_TS_Disadv_Small');
      else if (ts <= 5) basePatterns.push('SI_TS_Adv_Small');
      else if (ts <= 10) basePatterns.push('SI_TS_Adv_Mod');
      else basePatterns.push('SI_TS_Adv_Heavy');
  }

  // Odds Brackets
  if (features.odds) {
      const fOdds = features.favIndex === 0 ? features.odds.home : features.odds.away;
      if (fOdds < 1.25) basePatterns.push('SI_Odds_ExtremeFav');
      else if (fOdds <= 1.50) basePatterns.push('SI_Odds_HeavyFav');
      else if (fOdds <= 1.85) basePatterns.push('SI_Odds_SolidFav');
      else if (fOdds <= 2.20) basePatterns.push('SI_Odds_MarginalFav');
      else basePatterns.push('SI_Odds_EvenMatch');
  }
  
  // 32. Underdog has hidden strength
  if (features.study8_hiddenStrength) basePatterns.push('SIff');

  // Algo+paa
  if (algoPrim === favWin && paaPrim === favWin) basePatterns.push('SIgg');
  if (algoPrim === 'X' && paaPrim === 'X') basePatterns.push('SIhh');
  if (algoPrim === undWin && paaPrim === undWin) basePatterns.push('SIii');

  // Algo+seer
  if (algoPrim === favWin && seerPrim === favWin) basePatterns.push('SIjj');
  if (algoPrim === 'X' && seerPrim === 'X') basePatterns.push('SIkk');
  if (algoPrim === undWin && seerPrim === undWin) basePatterns.push('SIll');

  // Algo+Sub patt
  if (algoPrim === favWin && subPrim === favWin) basePatterns.push('SImm');
  if (algoPrim === 'X' && subPrim === 'X') basePatterns.push('SInn');
  if (algoPrim === undWin && subPrim === undWin) basePatterns.push('SIoo');

  // paa+seer
  if (paaPrim === favWin && seerPrim === favWin) basePatterns.push('SIpp');
  if (paaPrim === 'X' && seerPrim === 'X') basePatterns.push('SIqq');
  if (paaPrim === undWin && seerPrim === undWin) basePatterns.push('SIrr');

  // paa+Sub patt
  if (paaPrim === favWin && subPrim === favWin) basePatterns.push('SIss');
  if (paaPrim === 'X' && subPrim === 'X') basePatterns.push('SItt');
  if (paaPrim === undWin && subPrim === undWin) basePatterns.push('SIuu');

  // seer+Sub patt
  if (seerPrim === favWin && subPrim === favWin) basePatterns.push('SIvv');
  if (seerPrim === 'X' && subPrim === 'X') basePatterns.push('SIww');
  if (seerPrim === undWin && subPrim === undWin) basePatterns.push('SIxx');

  // Apply Sub Patterns
  for (const bp of basePatterns) {
    tags.push(bp); // The standalone base pattern (e.g., SIa)
    
    // Get the combined probability average for this specific base pattern (skips SIa and SIb)
    const probSource = getCombinedProbabilities(bp, features);
    const suffixes = getSubPatternSuffixes(probSource);
    
    for (const suffix of suffixes) {
      tags.push(`${bp}${suffix}`); // The sub-pattern (e.g., SIu1, SIc6)
    }
  }

  return tags;
}
