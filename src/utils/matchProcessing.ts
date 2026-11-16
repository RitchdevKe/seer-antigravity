import { getOptimizedScoreDetailed, applyHedgingProtocol, getMarketFavorite } from './optimizedweights';

import { Match, TotalPoints } from '../types';
import { getMatchStats } from './matchEvaluator';
import { calculateFlags, detectMainPattern, analyzeSubPatterns, detectLegacyPatterns, PATTERN_DESCRIPTIONS, LEGACY_DESCRIPTIONS, getActiveFlags, SUB_PATTERN_RULES } from '../components/Patterns';
import { matchAlgorithm } from '../components/ai/algorithm';
import { predictWithHybridML } from './hybridMachineLearning';
import { parseL10 } from './l10Utils';


// Helper for floating point comparisons - Strict check (+-0.2) with epsilon
export const isClose = (val1: number, val2: number, threshold: number = 0.2) => {
  return Math.abs(val1 - val2) <= threshold + Number.EPSILON;
};

// Enforce structural rules for Algo predictions:
// If the final prediction (override/pivot) conflicts with the primary prediction,
// the primary prediction MUST be deduced from the final prediction.
// E.g., if fin is X2, prim must be X or 2.
export const enforceAlgoPredictionRules = (
  primary: string,
  final: string,
  probs?: { '1': number; 'X': number; '2': number }
): { primaryPrediction: string; finalPrediction: string } => {
  let prim = (primary || '').trim().toUpperCase();
  let fin = (final || '').trim().toUpperCase();
  if (!fin) fin = prim;

  const p1 = probs?.['1'] ?? 0;
  const pX = probs?.['X'] ?? 0;
  const p2 = probs?.['2'] ?? 0;

  // Sanitize Primary to ensure it's a straight prediction
  if (!['1', 'X', '2'].includes(prim)) {
    if (prim.includes('1')) prim = '1';
    else if (prim.includes('2')) prim = '2';
    else prim = 'X';
  }

  // Check if final includes primary
  let isFinValid = false;
  if (prim === '1' && (fin === '1X' || fin === '12' || fin === '1')) isFinValid = true;
  else if (prim === 'X' && (fin === '1X' || fin === 'X2' || fin === 'X')) isFinValid = true;
  else if (prim === '2' && (fin === '12' || fin === 'X2' || fin === '2')) isFinValid = true;
  else if (fin === prim) isFinValid = true;

  if (!isFinValid) {
      if (prim === '1') {
          fin = pX >= p2 ? '1X' : '12';
      } else if (prim === '2') {
          fin = pX >= p1 ? 'X2' : '12';
      } else if (prim === 'X') {
          fin = p1 >= p2 ? '1X' : 'X2';
      }
  }

  return { primaryPrediction: prim, finalPrediction: fin };
};

// Safe Float Parser
const safeParseFloat = (val: string | number | undefined, defaultVal: number = 0): number => {
    if (typeof val === 'number') return val;
    if (!val) return defaultVal;
    
    // Normalize string: replace comma with dot, remove non-numeric chars except dot/minus
    const str = val.toString().replace(/,/g, '.').replace(/[^\d.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? defaultVal : num;
};

// Completely sanitize match odds to pure numeric values without trend arrows or unicode symbols
export function sanitizeMatchOdds(mo?: string | null): string {
    if (!mo || mo === 'Unknown' || mo === '-') return 'Unknown';
    const parts = String(mo)
        .split(/[- ,]+/)
        .map(s => s.replace(/[^0-9.]/g, '').trim())
        .filter(s => s.length > 0 && !isNaN(parseFloat(s)) && parseFloat(s) > 0);
    return parts.length > 0 ? parts.join(',') : 'Unknown';
}

// Helper to ensure probabilities display sums to 100% (Largest Remainder Method)
export const formatProbabilities = (probs: { '1': number; 'X': number; '2': number }) => {
    let p1 = Math.round(probs['1'] * 100);
    let pX = Math.round(probs['X'] * 100);
    let p2 = Math.round(probs['2'] * 100);
    
    const sum = p1 + pX + p2;
    const diff = 100 - sum;
    
    if (diff !== 0) {
        // Distribute the difference to the largest probability component to minimize relative visual error
        const max = Math.max(p1, pX, p2);
        
        if (p1 === max) p1 += diff;
        else if (pX === max) pX += diff;
        else p2 += diff;
    }
    
    return { '1': p1, 'X': pX, '2': p2 };
};

// Toggle for Sub-Pattern Overrides
const SUB_PATTERNS_ACTIVE = true;

// Helper to determine the actual result from a score string.
// Returns '1', 'X', '2', or 'pending' if no result is available.
// Matches with no results (empty string, '?-?', or 'pending') are explicitly treated as 'pending'
// and should be excluded from accuracy scores in audits.
/**
 * Evaluates the logical date of a match based on the 12:00 to 11:59 cycle.
 * A prediction day starts at 9:00 AM and ends at 8:59 AM the next day.
 * Matches starting before 9:00 AM belong to the previous logical day.
 */
export const getLogicalDate = (dateStr: string, timeStr?: string): string => {
    let normalizedDateStr = dateStr;
    
    let extractedTime = timeStr;
    
    // Normalize DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY to YYYY-MM-DD for consistency
    const trimmedDate = (normalizedDateStr || '').trim();
    if (/^\d{2}[-/.]\d{2}[-/.]\d{4}/.test(trimmedDate)) {
      const parts = trimmedDate.split(/[-/.\s]/);
      if (parts.length >= 3) {
        normalizedDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        if (!extractedTime && parts.length > 3) {
           extractedTime = parts.slice(3).join(' ');
        }
      }
    } else if (normalizedDateStr.includes('T')) {
      // If it's an ISO string like 2026-08-14T10:00:00Z, strip the time portion
      if (!extractedTime) {
          extractedTime = normalizedDateStr.split('T')[1].substring(0, 5);
      }
      normalizedDateStr = normalizedDateStr.split('T')[0];
    } else if (normalizedDateStr.includes(' ')) {
      // If it has space separated time like 2026-08-14 10:00:00
      if (!extractedTime) {
          extractedTime = normalizedDateStr.split(' ')[1];
      }
      normalizedDateStr = normalizedDateStr.split(' ')[0];
    }

    if (!extractedTime) return normalizedDateStr;
    
    // Numeric check for 9:00 AM EAT cutoff (handles both '02:00' and '2:00')
    const timeParts = extractedTime.trim().split(':');
    const hour = parseInt(timeParts[0], 10);
    if (!isNaN(hour) && hour < 9) {
      // Matches strictly before 9:00 AM EAT belong to the previous prediction day
      const dateObj = new Date(normalizedDateStr);
      if (!isNaN(dateObj.getTime())) {
        dateObj.setUTCDate(dateObj.getUTCDate() - 1);
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
        const day = String(dateObj.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }
    
    return normalizedDateStr;
};

export const getActualResult = (result?: string) => {
  if (result === 'pending' || result === '?-?' || !result) return 'pending';
  
  // 1. Clean input 
  const trimmed = result.trim().toLowerCase();
  if (trimmed === 'pending' || trimmed === 'cancelled' || trimmed === 'postponed' || trimmed === 'abn') return 'pending';
  
  // Extract only the score pattern if it's messy (e.g. "U23 1:0")
  // We look for two groups of digits separated by common delimiters or spaces
  // Regex: (\d+)\s*[:\-\/\s]\s*(\d+)
  // We prefer the LAST match in case there are other numbers in labels 
  // but usually results are the only XX-XX pattern.
  const scoreMatch = trimmed.match(/(\d+)\s*[:\-\/\s]\s*(\d+)/);
  let hStr = "";
  let aStr = "";
  
  if (scoreMatch) {
      hStr = scoreMatch[1];
      aStr = scoreMatch[2];
      
      // Handle cases where team names might be digits or dates prefixed (e.g. "20241:0")
      if (hStr.length >= 3 && parseInt(hStr) > 20) hStr = hStr.slice(-1);
      if (aStr.length >= 3 && parseInt(aStr) > 20) aStr = aStr.slice(0, 1);
  } else {
      // Try one more fallback: just digits separated by ANYTHING
      const fallbackMatch = trimmed.match(/(\d+)[^\d]+(\d+)/);
      if (fallbackMatch) {
          hStr = fallbackMatch[1];
          aStr = fallbackMatch[2];
      } else {
          return 'pending';
      }
  }

  const h = parseInt(hStr, 10);
  const a = parseInt(aStr, 10);
  
  if (isNaN(h) || isNaN(a)) return 'pending';
  // If it's still suspiciously high after cleaning (e.g. basketball or error), treat with caution
  // But for football 15 is a reasonable cutoff for data errors
  if (h > 15 || a > 15) {
      if (hStr.length > 2 || aStr.length > 2) return 'pending';
  }

  if (h > a) return "1";
  if (h === a) return "X";
  return "2";
};

export const formatScore = (result: string | undefined): string => {
  if (!result || result === 'pending' || result === '?-?') return '-';
  
  const cleanResult = result.trim();
  
  // Match home and away scores separated by any non-digit character (excluding spaces if they are internal)
  // Look for the last clear score pattern
  const matches = cleanResult.match(/(\d+)\s*[:\-\/\s]\s*(\d+)/g);
  if (matches && matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const digitsMatch = lastMatch.match(/(\d+)\s*[:\-\/\s]\s*(\d+)/);
    if (digitsMatch) {
      let h = digitsMatch[1];
      let a = digitsMatch[2];
      
      if (h.length >= 3 && parseInt(h) > 20) h = h.slice(-1);
      if (a.length >= 3 && parseInt(a) > 20) a = a.slice(0, 1);
      
      return `${h}:${a}`;
    }
  }
  
  return result;
};

export const matchesPrediction = (pred: string, actual: string) => {
  if (!pred || !actual || actual === 'pending') return false;
  const cleanPred = pred.trim();
  
  if (cleanPred === actual) return true;
  if (cleanPred === "1X" && (actual === "1" || actual === "X")) return true;
  if (cleanPred === "X2" && (actual === "X" || actual === "2")) return true;
  if (cleanPred === "12" && (actual === "1" || actual === "2")) return true;
  return false;
};



const safeEnsureHedgedPrediction = (pred: string, m: Match, phaStatsMap?: Record<string, any>): string => {
  let odds1 = 2.0, odds2 = 2.5;
  if (m) {
    const moParts = (m.mo || (m as any).odds || (m as any).data?.mo || (m as any).data?.odds || "").split(/[- ,]+/).map((s: string) => parseFloat(s.replace(/[^0-9.]/g, '').trim())).filter((p: number) => !isNaN(p));
    odds1 = moParts[0] || 2.0;
    odds2 = (moParts.length >= 3 ? moParts[2] : (moParts.length === 2 ? moParts[1] : 0)) || 2.5;
  }
  const defaultFavHedge = odds1 <= odds2 ? "1X" : "X2";
  if (!pred) return defaultFavHedge;
  const p = pred.trim().toUpperCase();
  if (p === "1X" || p === "X2" || p === "12") return p;
  if (p === "1") return "1X";
  if (p === "2") return "X2";
  if (p === "X") return defaultFavHedge;
  return defaultFavHedge;
};
export const getHistoricalHedgedPrediction = (
  m: Match,
  baseCatId: string,
  phaStatsMap?: Record<string, any>,
  fallbackPred?: string
): string => {
  if (baseCatId === 'upsets' || baseCatId === 'upset' || baseCatId === 'sandbox_upsets') {
    const { underdog } = getFavoriteAndUnderdog(m);
    return underdog;
  }
  let pred = fallbackPred || m.targetPrediction || m.seerPrediction || m.mlInfo?.mlPrediction || m.finalPrediction || m.rawPrediction || "1";
  const hedgedPred = safeEnsureHedgedPrediction(pred, m, phaStatsMap);
  
  // Check active OPW hedging protocol if available
  const opwResult = getOptimizedScoreDetailed(m, baseCatId, phaStatsMap || {});
  if (opwResult && opwResult.activeHedgingProtocol) {
    if (opwResult.activeHedgingProtocol.includes('Hedge 1X')) return '1X';
    if (opwResult.activeHedgingProtocol.includes('Hedge X2')) return 'X2';
    if (opwResult.activeHedgingProtocol.includes('Hedge 12')) return '12';
    if (opwResult.optimizedPrediction) return opwResult.optimizedPrediction;
  }

  // Check HPR protocol
  const hprPred = applyHedgingProtocol(m, hedgedPred, baseCatId, phaStatsMap || {});
  if (hprPred && (hprPred === '1X' || hprPred === 'X2' || hprPred === '12')) {
    return hprPred;
  }
  
  return hedgedPred;
};

export const isMatchCorrectForCategory = (
  match: Match,
  pred: string,
  actual: string,
  category: string,
  phaStatsMap?: Record<string, any>
): boolean => {
  if (!actual || actual === 'pending' || actual === 'Unknown' || actual === '?-?') return false;

  const isUpsetCategory = category === 'upsets' || category === 'upset' || category === 'sandbox_upsets';
  if (isUpsetCategory) {
    const { underdog } = getFavoriteAndUnderdog(match);
    // User instruction: on Upsets we need the underdog to win, not draw or Mfav to win.
    return actual === underdog;
  }

  const isValuePicks = category === 'value_picks' || category === 'sandbox_value_picks';
  if (isValuePicks) {
    const { fav } = getFavoriteAndUnderdog(match);
    // Value Picks strictly adheres to mfav_only: favorite must win
    return actual === fav;
  }

  // Strict check on the final hedged prediction:
  // Overall accuracy must check if the outcome hit the final hedged prediction without overriding with conflicting fallback hedges.
  if (pred && pred.trim()) {
    return matchesPrediction(pred, actual);
  }

  const rawSeer = match.seerPrediction || match.targetPrediction || match.finalPrediction || match.rawPrediction || "1";
  const hedgedPred = safeEnsureHedgedPrediction(rawSeer, match, phaStatsMap);
  return matchesPrediction(hedgedPred, actual);
};

// ... (Rest of the file remains unchanged - keeping helper functions)
export const getPointsRange = (maxPoints: number) => {
    if (maxPoints < 40) return '<40';
    if (maxPoints < 50) return '40-50';
    if (maxPoints < 60) return '50-60';
    if (maxPoints < 70) return '60-70';
    if (maxPoints < 80) return '70-80';
    if (maxPoints < 90) return '80-90';
    return '90-100';
  };

const calculate1X2Points = (pred: string, rating: string) => {
    // 1X2 RATING gets up to 10 points
    let ratingNum = 5;
    if (rating) {
        if (rating.includes('/')) {
             ratingNum = safeParseFloat(rating.split('/')[0], 5);
        } else {
             ratingNum = safeParseFloat(rating, 5);
        }
    }
    
    // Cap at 10 to ensure the max points for this feature is 10
    if (ratingNum > 10) ratingNum = 10;
    
    const primaryShare = ratingNum;
    const secondaryShare = 10 - ratingNum;
    
    let home = 0, draw = 0, away = 0;

    if (pred === "1") {
      home = primaryShare;
      draw = secondaryShare / 2;
      away = secondaryShare / 2;
    } else if (pred === "X") {
      draw = primaryShare;
      home = secondaryShare / 2;
      away = secondaryShare / 2;
    } else if (pred === "2") {
      away = primaryShare;
      home = secondaryShare / 2;
      draw = secondaryShare / 2;
    } else if (pred === "1X") {
      home = primaryShare * 0.65;
      draw = primaryShare * 0.35;
      away = secondaryShare;
    } else if (pred === "X2") {
      away = primaryShare * 0.65;
      draw = primaryShare * 0.35;
      home = secondaryShare;
    } else {
        home = 3.33; draw = 3.33; away = 3.33;
    }
    
    return { 
      home: parseFloat(home.toFixed(2)), 
      draw: parseFloat(draw.toFixed(2)), 
      away: parseFloat(away.toFixed(2)) 
    };
};

const calculateGAPoints = (gaHome: number, gaAway: number) => {
    // DEFENSE (GA) gets 12 points
    const diff = Math.abs(gaHome - gaAway);
    if (diff <= 0.2 + Number.EPSILON) {
        return { home: 4, draw: 4, away: 4 };
    }
    
    const better = gaHome < gaAway ? 'home' : 'away';
    return { home: better === 'home' ? 12 : 0, draw: 0, away: better === 'away' ? 12 : 0 };
};

const calculateGSPoints = (gsHome: number, gsAway: number) => {
    // OFFENSE (GS) gets 20 Points
    const diff = Math.abs(gsHome - gsAway);
    
    // Close logic (<= 0.2)
    if (diff <= 0.2 + Number.EPSILON) {
        return { home: 7, draw: 6, away: 7 };
    }
    
    const better = gsHome > gsAway ? 'home' : 'away';
    
    // If Diff > 0.5
    if (diff > 0.5) {
        return { home: better === 'home' ? 20 : 0, draw: 0, away: better === 'away' ? 20 : 0 };
    } 
    
    // Between >0.2 and <=0.5 (Interpreted from ">2 but <=5")
    // Better 12, Other 8, Draw 0
    return { 
        home: better === 'home' ? 12 : 8, 
        draw: 0, 
        away: better === 'away' ? 12 : 8 
    };
};

const calculateL10Points = (l10: string) => {
    // FORM (L10) gets 8 points
    if (!l10 || l10 === 'NA') return { home: 2.7, draw: 2.6, away: 2.7 }; // Split 8 roughly
    const parsed = parseL10(l10);
    if (!parsed.isValid) return { home: 2.7, draw: 2.6, away: 2.7 };

    const home = parsed.homeWins;
    const away = parsed.awayWins;
    
    const diff = Math.abs(home - away);
    
    if (diff <= 1) {
        if (home === away) return { home: 3, draw: 2, away: 3 }; // 8 points split
        const better = home > away ? 'home' : 'away';
        return {
            home: better === 'home' ? 4 : 2,
            draw: 2,
            away: better === 'away' ? 4 : 2
        };
    }
    
    // Diff > 1
    return home > away ? { home: 8, draw: 0, away: 0 } : { home: 0, draw: 0, away: 8 };
};

const calculateMOPoints = (mo: string) => {
    // Market odds gets 20 points (previously 25)
    try {
      if (!mo) return { home: 7, draw: 6, away: 7 };
      const odds = String(mo).split(/[,\s:\/\-\|]+/).map(o => safeParseFloat(o.trim(), NaN)).filter(o => !isNaN(o));
      if (odds.length < 3) return { home: 7, draw: 6, away: 7 };
      
      const o1 = odds[0];
      const o2 = odds[2];
      
      const minOdds = Math.min(o1, o2);
      const fav = o1 <= o2 ? 'home' : 'away';
      
      // 4. If Team A and B have 2.5 odds and above (both > 2.50)
      if (o1 > 2.50 && o2 > 2.50) {
          return { home: 7, draw: 6, away: 7 };
      }
      
      // 1. If Team A has 1.5 odds and below
      if (minOdds <= 1.50) {
          return { home: fav === 'home' ? 20 : 0, draw: 0, away: fav === 'away' ? 20 : 0 };
      }
      
      // 2. If Team A has 1.6 to 2.0 odds
      if (minOdds <= 2.00) {
          return { 
              home: fav === 'home' ? 10 : 5, 
              draw: 5, 
              away: fav === 'away' ? 10 : 5 
          };
      }
      
      // 3. If Team A has 2.01 to 2.5 odds
      if (minOdds <= 2.50) {
          return {
              home: fav === 'home' ? 11 : 5,
              draw: 4,
              away: fav === 'away' ? 11 : 5
          };
      }
      
      return { home: 7, draw: 6, away: 7 };
      
    } catch (e) { return { home: 7, draw: 6, away: 7 }; }
};

const calculateLEPoints = (le: string) => {
    // LAST ENCOUNTER (LE) gets 10 points
    // Format expected: "1-0", "2-2", "0-1", "NA" etc.
    // Assuming 'le' contains the score of the last encounter from Home perspective? 
    // Or is it just a result code? The prompt says "The team won last encounter".
    // Usually LE data is a score string like "2-1".
    
    if (!le || le === 'NA') {
        return { home: 0, draw: 10, away: 0, wasDrawn: true };
    }

    // Try to parse score
    const parts = le.split(/[-:]/);
    if (parts.length !== 2) {
         // Fallback if format is unknown/invalid
         return { home: 0, draw: 10, away: 0, wasDrawn: true };
    }

    const h = safeParseFloat(parts[0], NaN);
    const a = safeParseFloat(parts[1], NaN);

    if (isNaN(h) || isNaN(a)) {
        return { home: 0, draw: 10, away: 0, wasDrawn: true };
    }

    if (h > a) {
        return { home: 10, draw: 0, away: 0, wasDrawn: false };
    } else if (a > h) {
        return { home: 0, draw: 0, away: 10, wasDrawn: false };
    } else {
        return { home: 0, draw: 10, away: 0, wasDrawn: true };
    }
};

const calculateTSPoints = (match: any) => {
    // TEAM STRENGTH (TS) GETS 15 points
    const { tsa, tsb } = match;
    
    let points = { home: 0, draw: 0, away: 0 };
    let bonuses = { home: 0, away: 0 };
    let indicators = [];
    
    const stronger = tsa > tsb ? 'home' : 'away';
    
    // Base: Stronger receives 15 pts
    points[stronger] = 15;
    
    const diff = Math.abs(tsa - tsb);
    
    // If TS Differential is < 0.2 (Close)
    if (diff <= 0.2 + Number.EPSILON) {
        // Redistributed: Home 5, Draw 5, Away 5
        points.home = 5;
        points.draw = 5;
        points.away = 5;
        indicators.push("Equal TS");
    }
    
    // Legacy indicators for UI feedback
    let upsetPotential = null;
    
    if (tsa >= 2.0 && tsb < 0.6) {
        upsetPotential = { team: 'away', bonus: 20 }; // Bonus tracked but not added to total score unless logic changed
        indicators.push("⚠️ Potential Upset");
    } else if (tsb >= 2.0 && tsa < 0.6) {
        upsetPotential = { team: 'home', bonus: 20 };
        indicators.push("⚠️ Potential Upset");
    } else if ((tsa >= 2.0 && tsb < 1.0) || (tsb >= 2.0 && tsa < 1.0)) {
        indicators.push("⚠️ Potential Draw");
    }
    
    if (diff >= 1.0) {
        indicators.push("⚠️ TS Diff Draw");
    }
    
    return { points, bonuses, upsetPotential, indicators: indicators.join(" | ") };
};

export const calculateTotalPoints = (match: any) => {
    const pts1x2 = calculate1X2Points(match.pred1x2, match.rating);
    const tsResult = calculateTSPoints(match);
    const ptsGA = calculateGAPoints(match.gaHome, match.gaAway);
    const ptsGS = calculateGSPoints(match.gsHome, match.gsAway);
    const ptsL10 = calculateL10Points(match.l10);
    const ptsMO = calculateMOPoints(match.mo);
    const ptsLE = calculateLEPoints(match.le);
    
    // SUMMATION FIX: Use toFixed(2) then parseFloat to avoid floating point errors like 78.00000001
    const homeRaw = (pts1x2.home || 0) + (tsResult.points.home || 0) + (ptsGA.home || 0) + (ptsGS.home || 0) + (ptsL10.home || 0) + (ptsMO.home || 0) + (ptsLE.home || 0);
    const drawRaw = (pts1x2.draw || 0) + (tsResult.points.draw || 0) + (ptsGA.draw || 0) + (ptsGS.draw || 0) + (ptsL10.draw || 0) + (ptsMO.draw || 0) + (ptsLE.draw || 0);
    const awayRaw = (pts1x2.away || 0) + (tsResult.points.away || 0) + (ptsGA.away || 0) + (ptsGS.away || 0) + (ptsL10.away || 0) + (ptsMO.away || 0) + (ptsLE.away || 0);

    const home = parseFloat(homeRaw.toFixed(2));
    const draw = parseFloat(drawRaw.toFixed(2));
    const away = parseFloat(awayRaw.toFixed(2));

    let finalIndicators = tsResult.indicators;
    
    // Inject Points-based Potential Draw logic: Draw Points >= 27 (Adjusted for new scale? Keep for now)
    if (draw >= 27) {
         const flag = "⚠️ Potential Draw";
         if (!finalIndicators.includes(flag)) {
             finalIndicators = finalIndicators ? `${finalIndicators} | ${flag}` : flag;
         }
    }

    return {
      home,
      draw,
      away,
      breakdown: { pts1x2, ptsTS: tsResult.points, ptsGA, ptsGS, ptsL10, ptsMO, ptsLE, tsIndicators: finalIndicators, bonuses: tsResult.bonuses, upsetPotential: tsResult.upsetPotential }
    };
};

const getPrediction = (points: TotalPoints) => {
    const { home, draw, away } = points;
    if (isClose(home, away, 3)) {
      const max = Math.max(home, draw, away);
      if (home === max) return "1X";
      if (away === max) return "X2";
      return "X";
    }
    const max = Math.max(home, draw, away);
    if (home === max) return "1";
    if (draw === max) return "X";
    return "2";
};

const getMOPrediction = (mo: string) => {
    try {
        if (!mo) return undefined;
        const odds = String(mo).split(',').map(o => safeParseFloat(o.trim(), NaN)).filter(o => !isNaN(o));
        if (odds.length < 3) return undefined;
        const minOdds = Math.min(...odds);
        const minIndex = odds.indexOf(minOdds);
        if (minIndex === 0) return '1';
        if (minIndex === 1) return 'X';
        if (minIndex === 2) return '2';
        return undefined;
    } catch {
        return undefined;
    }
}

// Ensure Primary Prediction matches strict hedging rules relative to Final Prediction
const validateAndFixHedging = (primary: string, final: string, match?: Match): string => {
    const p = primary.trim();
    const f = final.trim();

    // Rule 1: Prim 1 -> Fin 1, 1X, 12
    if (p === '1' && ['1', '1X', '12'].includes(f)) return p;
    
    // Rule 2: Prim 2 -> Fin 2, X2, 12
    if (p === '2' && ['2', 'X2', '12'].includes(f)) return p;
    
    // Rule 3: Prim X -> Fin X, 1X, X2
    if (p === 'X' && ['X', '1X', 'X2'].includes(f)) return p;
    
    // Mismatch detected. Align Primary to Final using probabilities if possible.
    if (f === '1') return '1';
    if (f === '2') return '2';
    if (f === 'X') return 'X';

    let prob1 = 0, probX = 0, prob2 = 0;
    if (match && match.algoReport?.probabilities) {
        prob1 = match.algoReport.probabilities['1'] || 0;
        probX = match.algoReport.probabilities['X'] || 0;
        prob2 = match.algoReport.probabilities['2'] || 0;
    } else if (match && match.mlInfo?.mlPercentages) {
        // Fallback to ML percentages if available
        const { fav, underdog } = getFavoriteAndUnderdog(match);
        const isFavHome = fav === '1';
        prob1 = isFavHome ? match.mlInfo.mlPercentages.fav : match.mlInfo.mlPercentages.underdog;
        prob2 = isFavHome ? match.mlInfo.mlPercentages.underdog : match.mlInfo.mlPercentages.fav;
        probX = match.mlInfo.mlPercentages.draw;
    } else if (match && match.totalPoints) {
        // Fallback to points
        prob1 = match.totalPoints.home;
        probX = match.totalPoints.draw;
        prob2 = match.totalPoints.away;
    }

    if (f === '1X') return probX > prob1 ? 'X' : '1';
    if (f === 'X2') return probX > prob2 ? 'X' : '2';
    if (f === '12') return prob2 > prob1 ? '2' : '1';
    
    return p; // Should not happen if inputs are standard
};

const sortPrediction = (p1: string, p2: string) => {
    if ((p1 === '1' && p2 === '2') || (p1 === '2' && p2 === '1')) return '12';
    if ((p1 === '1' && p2 === 'X') || (p1 === 'X' && p2 === '1')) return '1X';
    if ((p1 === 'X' && p2 === '2') || (p1 === '2' && p2 === 'X')) return 'X2';
    return p1 + p2;
};

export const getFavoriteAndUnderdog = (m: Match): { fav: '1' | '2'; underdog: '2' | '1' } => {
    // 1. Try to parse market odds (mo)
    const moStr = m.mo || m.odds || '';
    if (moStr && moStr !== 'NA' && moStr !== 'Unknown') {
        const parts = String(moStr).split(/[,\s:\/\-\|]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
        if (parts.length >= 3) {
            const o1 = parts[0];
            const o2 = parts[2];
            const fav = o1 <= o2 ? '1' : '2';
            const underdog = o1 <= o2 ? '2' : '1';
            return { fav, underdog };
        }
    }
    
    // 2. Fallback to Team Strength (tsa vs tsb) if odds are missing
    const tsa = m.tsa || 0;
    const tsb = m.tsb || 0;
    if (tsa > 0 || tsb > 0) {
        const fav = tsa >= tsb ? '1' : '2';
        const underdog = tsa >= tsb ? '2' : '1';
        return { fav, underdog };
    }

    // 3. Ultimate fallback (Home bias)
    return { fav: '1', underdog: '2' };
};

export const calculatePHAPrediction = (stats: any): { phaPrimaryPrediction: string, phaPrediction: string } | null => {
    if (!stats || !stats.outcomes || Object.keys(stats.outcomes).length === 0) return null;
    const denom = stats.total > 0 ? stats.total : 1;
    
    const home = ((stats.outcomes['1'] || 0) / denom) * 100;
    const draw = ((stats.outcomes['X'] || 0) / denom) * 100;
    const away = ((stats.outcomes['2'] || 0) / denom) * 100;

    const map = [
        { key: '1', val: home },
        { key: 'X', val: draw },
        { key: '2', val: away }
    ];

    // Sort descending by value. On tie, prioritize Away (2), then Draw (X), then Home (1).
    map.sort((a, b) => {
        if (b.val !== a.val) {
            return b.val - a.val;
        }
        if (a.key === '2') return -1;
        if (b.key === '2') return 1;
        if (a.key === 'X') return -1;
        if (b.key === 'X') return 1;
        return 0;
    });

    const primary = map[0].key;
    const hedge = map[1].val > 0 ? map[1].key : map[0].key;

    const finalStr = sortPrediction(primary, hedge);
    return { phaPrimaryPrediction: primary, phaPrediction: finalStr };
};

export const calculatePAAPrediction = (match: Match, stats: any): { paaPrimaryPrediction: string, paaPrediction: string } | null => {
    if (!stats) return null;
    const denom = stats.paaTotal > 0 ? stats.paaTotal : stats.total;
    if (denom === 0) return null;

    const { fav } = getFavoriteAndUnderdog(match);
    const favWin = stats.fav_win ?? stats.favWin ?? 0;
    const upsetWin = stats.upset_win ?? stats.upsetWin ?? 0;
    const draws = stats.draw ?? 0;
    
    let homeCount = 0;
    let awayCount = 0;
    let drawCount = draws;

    if (fav === '1') {
        homeCount = favWin;
        awayCount = upsetWin;
    } else if (fav === '2') {
        awayCount = favWin;
        homeCount = upsetWin;
    } else {
        return null; // Cannot reliably map without a favorite
    }

    const home = (homeCount / denom) * 100;
    const draw = (drawCount / denom) * 100;
    const away = (awayCount / denom) * 100;

    const map = [
        { key: '1', val: home },
        { key: 'X', val: draw },
        { key: '2', val: away }
    ];

    // Sort descending by value. On tie, prioritize the market favorite.
    map.sort((a, b) => {
        if (b.val !== a.val) {
            return b.val - a.val;
        }
        if (a.key === fav) return -1;
        if (b.key === fav) return 1;
        if (a.key === 'X') return -1;
        if (b.key === 'X') return 1;
        return 0;
    });

    const primary = map[0].key;
    const hedge = map[1].key;

    const finalStr = sortPrediction(primary, hedge);
    return { paaPrimaryPrediction: primary, paaPrediction: finalStr };
};

export const processMatch = (m: Match, globalMlData?: any): Match => {
    // Fast path: if this match was already fully processed (pattern analysis
    // present + isPrecalculated flag set), skip the whole recomputation. This
    // is the single biggest source of load-time CPU when we have 10k+ matches.
    if (m && (m as any).isPrecalculated && (m as any).patternAnalysis) {
        return m;
    }
    try {
      // DATA INTEGRITY PHASE: Clean Input Parsing
      const parseStats = (str: string | number | undefined): [number, number] => {
        if (str === undefined || str === null || str === 'NA' || str === '') return [0, 0];
        
        const clean = String(str).replace(/['"]/g, '').trim();
        // Fallback robust splitter for `:` or `-` or `/`
        // We use regex to handle formats like "1.5:2.5", "1.5 - 2.5", "1.5/2.5"
        const parts = clean.split(/[:\-\/]/).map(s => s.trim());
        
        const v1 = safeParseFloat(parts[0], 0);
        // Ensure v2 is parsed correctly, if separated by space instead of dash
        let v2 = 0;
        if (parts.length > 1 && parts[1] !== '') {
            v2 = safeParseFloat(parts[1], 0);
        } else {
            // Check if they are separated just by space (e.g. "1.5 2.5")
            const spaceParts = clean.split(/\s+/);
            if (spaceParts.length > 1) {
                v2 = safeParseFloat(spaceParts[1], 0);
            }
        }
        return [v1, v2];
      };

      let gsHome = m.gsHome ?? 0;
      let gsAway = m.gsAway ?? 0;
      
      if (typeof m.gs === 'string' && m.gs !== 'NA' && m.gs !== '') {
          const [h, a] = parseStats(m.gs);
          if (h !== 0 || a !== 0) { gsHome = h; gsAway = a; }
      }

      let gaHome = m.gaHome ?? 0;
      let gaAway = m.gaAway ?? 0;

      if (typeof m.ga === 'string' && m.ga !== 'NA' && m.ga !== '') {
          const [h, a] = parseStats(m.ga);
          if (h !== 0 || a !== 0) { gaHome = h; gaAway = a; }
      }
      
      // Calculate TS with high precision for computation, avoid zero division
      const tsaRaw = gsHome / (gaHome < 0.01 ? 0.01 : gaHome);
      const tsbRaw = gsAway / (gaAway < 0.01 ? 0.01 : gaAway);
      
      // Round to 3 decimal places for stability
      const tsa = m.tsa !== undefined && m.tsa > 0 ? m.tsa : parseFloat(tsaRaw.toFixed(3));
      const tsb = m.tsb !== undefined && m.tsb > 0 ? m.tsb : parseFloat(tsbRaw.toFixed(3));
      
      // GROUP ASSIGNMENT LOGIC (Strict)
      let group = m.group || 3;
      // Only assign if it wasn't pre-defined or 0
      if (!m.group || m.group === 0) {
          if (tsa >= 1.0 && tsb >= 1.0) {
              group = 1; // TT
          } else if ((tsa >= 1.0 && tsb < 1.0) || (tsa < 1.0 && tsb >= 1.0)) {
              group = 2; // TF or FT
          } else {
              group = 3; // FF
          }
      }
      
      const calcMatch = { ...m, tsa, tsb, group, gsHome, gsAway, gaHome, gaAway };
      const totalPoints = calculateTotalPoints(calcMatch);
      const maxPoints = Math.max(totalPoints.home, totalPoints.draw, totalPoints.away);
      const pointsRange = getPointsRange(maxPoints);
      
      // 1. Establish Initial Raw Prediction (Calculated Primary)
      let calculatedPrediction = getPrediction(totalPoints);
      let moPrediction = getMOPrediction(m.mo);
      
      // Pattern Analysis
      const flags = calculateFlags(calcMatch);
      const mainPattern = detectMainPattern(calcMatch);
      const { patterns: legacyPatterns, pCode } = detectLegacyPatterns(calcMatch, totalPoints, calculatedPrediction);
      const subPatternData = analyzeSubPatterns(calcMatch, mainPattern, flags, legacyPatterns, maxPoints);

      // 2. Determine Display Primary
      // Use Fav DC as the baseline foundation if PAA isn't available, as it has 82% accuracy
      let displayPrimary = calculatedPrediction;
      if (m.paaPrediction || m.paaPrimaryPrediction) {
          displayPrimary = m.paaPrediction || m.paaPrimaryPrediction || displayPrimary;
      } else {
          // Default to Favorite DC (82% benchmark baseline)
          const { fav } = getFavoriteAndUnderdog(calcMatch as Match);
          const isFavHome = fav === '1';
          displayPrimary = isFavHome ? '1X' : 'X2';
      }

      // 3. Determine Base Final Prediction (Priority: Rule > Display Primary)
      let finalPrediction = displayPrimary;
      // If PAA is NOT the baseline, apply the legacy pattern overrides
      if (!m.paaPrediction && !m.paaPrimaryPrediction && subPatternData && subPatternData.prediction !== 'PTS') {
          // --- ALGORITHM INTEGRATION: Apply Dynamic Overrides here ---
          // This keeps Patterns.tsx pure and moves logic to algorithm.tsx class static helper
          const AlgoClass = matchAlgorithm.constructor as any; 
          finalPrediction = AlgoClass.applyPatternOverrides(calcMatch, subPatternData.subPattern, subPatternData.prediction);
      }

      // 4. Auto-Sync Logic (Only if Rule didn't enforce Primary)
      // If we rely on calculated raw, but pattern gives a strong single result (1, X, 2), align Primary to it.
      if (!subPatternData?.primaryPrediction) {
           if (['1', 'X', '2'].includes(finalPrediction)) {
               displayPrimary = finalPrediction;
           }
      }

      // 5. Apply Legacy Hedges (P2)
      // P2 implies a tight game (L10 close), suggesting a Draw possibility.
      if (legacyPatterns.includes('P2')) {
          if (finalPrediction === '1') finalPrediction = '1X';
          else if (finalPrediction === '2') finalPrediction = 'X2';
      }
      
      // 6. STRICT HEDGING ENFORCEMENT
      // Ensure displayPrimary matches finalPrediction rules.
      displayPrimary = validateAndFixHedging(displayPrimary, finalPrediction, calcMatch as Match);

      const activeFlags = getActiveFlags(flags);
      let hedgeNote = "";
      if (pCode !== "NA") {
          hedgeNote = `Hedge ${pCode}`;
      }

      let formattedString = "";
      let confidenceData = { stars: 3, color: 'text-gray-400' };

      if (subPatternData) {
          const riders = (subPatternData.matchedRiders && subPatternData.matchedRiders.length > 0) 
              ? subPatternData.matchedRiders.slice(0, 4).join('+') 
              : ""; 
          
          const desc = PATTERN_DESCRIPTIONS[mainPattern] || "";
          // @ts-ignore
          const overrideLabel = subPatternData.override || ""; 
          const idPart = `${subPatternData.subPattern}${overrideLabel}`;
          formattedString = riders ? `${idPart}: ${riders}|${desc}` : `${idPart}|${desc}`;

          // Get Confidence Stars
          const AlgoClass = matchAlgorithm.constructor as any;
          confidenceData = AlgoClass.getPatternConfidence(subPatternData.subPattern);

      } else if (mainPattern) {
          // No rule matched. Show flags for manual analysis.
          const flagStr = activeFlags.length > 0 ? activeFlags.join('+') : "None";
          formattedString = `${mainPattern} [${flagStr}]`;
      }

      // Determine applied pattern code for filtering
      let appliedPattern = mainPattern;
      if (subPatternData) {
          // Look up rule to get its pattern code
          const rule = SUB_PATTERN_RULES.find(r => r.id === subPatternData.subPattern);
          if (rule) appliedPattern = rule.mainPattern;
      }

      const patternAnalysis = {
          mainPattern,
          subPattern: subPatternData ? subPatternData.subPattern : null,
          subPatternPrediction: subPatternData ? subPatternData.prediction : null, // Store Original Rule Prediction
          primaryPrediction: subPatternData ? subPatternData.primaryPrediction : null,
          activeFlags,
          mainPatternDescription: PATTERN_DESCRIPTIONS[mainPattern] || 'Unknown',
          formattedString,
          appliedPattern,
          confidenceStars: confidenceData.stars,
          confidenceColor: confidenceData.color
      };

      // 7. Automated AI Fields Population & Hybrid ML Pivot
      const hybridML = m.mlInfo ? m.mlInfo : predictWithHybridML(calcMatch, globalMlData);
      
      // 7. Automated AI Fields Population
      // Sticky probability confidence logic
      const stickyRawConfidence = (m.probabilityConfidence !== undefined && m.probabilityConfidence !== 0) 
            ? m.probabilityConfidence 
            : (m.algoReport?.confidence !== undefined && m.algoReport.confidence !== 0) 
               ? m.algoReport.confidence 
               : undefined;

      const algoPrediction = matchAlgorithm.predict({ 
          ...calcMatch, 
          patternAnalysis // Ensure pattern analysis is available to algo
      });

      const enforcedAlgo = enforceAlgoPredictionRules(
        algoPrediction.primaryPrediction || algoPrediction.prediction,
        algoPrediction.prediction,
        algoPrediction.probabilities
      );

      const finalConfidence = stickyRawConfidence !== undefined ? stickyRawConfidence : algoPrediction.rawConfidence;

      return {
        ...calcMatch,
        isPrecalculated: true,
        totalPoints,
        maxPoints,
        pointsRange,
        patterns: legacyPatterns, 
        patternCode: pCode,
        rawPrediction: displayPrimary, 
        finalPrediction, // This is the Hedged Prediction
        hedgeNote,
        priority: "",
        patternAnalysis,
        moPrediction,
        calculatedPrediction,
        seerPrediction: m.seerPrediction,
        seerPrimaryPrediction: m.seerPrimaryPrediction,
        paaPrediction: m.paaPrediction,
        paaPrimaryPrediction: m.paaPrimaryPrediction,
        probabilityConfidence: finalConfidence,
        activeAiFilters: algoPrediction.activeFilters,
        algoReport: {
            prediction: enforcedAlgo.finalPrediction,
            primaryPrediction: enforcedAlgo.primaryPrediction,
            confidence: finalConfidence,
            probabilities: algoPrediction.probabilities,
            category: algoPrediction.category,
            reason: algoPrediction.reason,
            activeFilters: algoPrediction.activeFilters || [],
            qualityAudit: algoPrediction.qualityAudit
        }
      };
    } catch (e) {
      console.error("Error processing match:", m, e);
      return { 
        ...m, 
        group: 3, 
        pointsRange: '<40', 
        patterns: [],
        totalPoints: {
            home: 0, draw: 0, away: 0,
            breakdown: {
                pts1x2: {home:0, draw:0, away:0},
                ptsTS: {home:0, draw:0, away:0},
                tsIndicators: '',
                ptsGA: {home:0, draw:0, away:0},
                ptsGS: {home:0, draw:0, away:0},
                ptsL10: {home:0, draw:0, away:0},
                ptsMO: {home:0, draw:0, away:0},
                ptsLE: {home:0, draw:0, away:0}
            }
        }
      };
    }
};

export const isMatchGoalAccurate = (
    m: Match,
    pred: string,
    actual: string,
    categoryId: string,
    phaStatsMap: Record<string, any>
): boolean => {
    if (!actual || actual === 'pending') return false;

    const stats = getMatchStats(m, phaStatsMap);
    const moFav = stats.moFav; 
    const moUnderdog = stats.moUnderdog;
    const favOdds = stats.favOdds;

    switch (categoryId) {
        case "top_12_safe":
        case "botb_jackpot":
        case "botb_best":
        case "ai_botb_best":
        case "sandbox_botb_best":
        case "top20":
        case "top_20_value":
        case "high_confidence":
        case "ai_high_confidence":
        case "sandbox_high_confidence": {
            const fav = getMarketFavorite(m) || stats.moFav || getFavoriteAndUnderdog(m).fav;
            const isFavWin = actual === fav || actual === stats.moFav || actual === getFavoriteAndUnderdog(m).fav;

            let effectiveFavOdds = stats.favOdds;
            const oddsStr = m.mo || m.odds || '';
            if (oddsStr && oddsStr !== 'NA' && oddsStr !== 'Unknown') {
                const parts = String(oddsStr).split(/[,\s:\/\-\|]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
                if (parts.length >= 3) {
                    effectiveFavOdds = Math.min(parts[0], parts[2]);
                }
            }

            // For matches with Odds >= 2.0, calculate if the match went to Mfav or draw.
            // For matches with odds < 2.0, calculate if the match went to Mfav.
            if (effectiveFavOdds >= 2.0) {
                return isFavWin || actual === 'X';
            }
            return isFavWin;
        }

        case "value_bets":
        case "value_bet":
        case "ai_value_bets":
        case "sandbox_value_bets":
        case "top12":
        case "top_12":
        case "top_12_value":
        case "ai_top_12_value":
        case "sandbox_top_12_value":
        case "top10":
        case "top_10":
        case "top_10_value":
        case "ai_top_10_value":
        case "sandbox_top_10_value": {
            const t12Fav = getMarketFavorite(m) || stats.moFav || getFavoriteAndUnderdog(m).fav;
            return actual === "X" || actual === t12Fav || actual === stats.moFav || actual === getFavoriteAndUnderdog(m).fav;
        }

        case "best_bet":
        case "bankers_dlive":
        case "bankers_jackpot":
        case "value_picks":
            return actual === moFav;

        case "banker_draws":
            return actual === "X";

        case "upsets":
            return actual === moUnderdog;

        default:
            return matchesPrediction(pred, actual);
    }
};
