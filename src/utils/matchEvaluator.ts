import { Match } from '../types';
import { matchesPrediction, getActualResult, calculateTotalPoints } from './matchProcessing';
import { getMatchSupremeTierUnderdog } from './seerSupremeTier';
import { predictWithSeer, predictSeerDetailed, DEFAULT_WEIGHTS, CategoryWeights, getMatchScore } from './seerLogic';
import { getSeerWeights } from '../services/storage';
import { isBannedFromSeerSlips } from './leagueFilters';

// Constants for Banned Patterns (Shared for exclusions)
const G1_DRAW_RISK = ['FF53', 'FF32', 'R17', 'J15'];
const G1_UPSET_RISK = ['FF48', 'FF47', 'FF37', 'R16', 'R02', 'J4', 'FF45', 'J6', 'FF50', 'FF34', 'F31', 'EE3', 'FF57', 'P4'];
const G2_UPSET_RISK = ['FF43', 'FF30', 'FF42', 'FF21', 'G8', 'S11', 'FF35', 'FF25', 'FF28', 'CC2', 'F24', 'FF48', 'EE18', 'EE9', 'EE15', 'FF39', 'E5', 'J11', 'O11', 'GG1', 'FF57', 'FF52', 'FF49', 'FF32'];
const G2_DRAW_RISK = ['FF27', 'FF34', 'FF44', 'I6', 'J10']; 
const G3_DRAW_RISK = ['FF28', 'FF6', 'R13'];
const G3_UPSET_RISK = ['FF10', 'FF1', 'CC6', 'FF8', 'FF11', 'FF5'];

export type MatchCategory = 'all' | 'best_bet' | 'top12' | 'top10' | 'bankers_dlive' | 'botb_best' | 'top20' | 'bankers_jackpot' | 'value_bets' | 'value_picks' | 'banker_draws' | 'upsets' | 'pending' | 'banned';
export type Priority = 'all' | 'PR1a' | 'PR1b' | 'PR1c' | 'PR1d' | 'PR2a' | 'PR2b' | 'PR2c' | 'PR2d' | 'PR1' | 'PR2' | 'PR3' | 'PR4' | 'PR5' | 'PR6' | 'PR7' | 'PR8' | 'PR9' | 'PR10' | 'PR11' | 'PR12' | 'PR13' | 'PR14' | 'PR15' | 'PROMOTE' | 'DEMOTE';

interface MatchStats {
    o1: number;
    oX: number;
    o2: number;
    moFav: string;
    moUnderdog: string;
    favOdds: number;
    underdogOdds: number;
    
    // PHA (Pattern Historical Accuracy) - Map of 1, X, 2 outcomes
    phaStats: {
        home: number;
        draw: number;
        away: number;
        favSupport: number;
        underdogSupport: number;
        drawSupport: number;
    };
    
    // PAA (Pattern Accuracy Audit) - Reality audit of Fav vs Upset vs Draw
    paaStats: {
        favWin: number;
        draw: number;
        upsetWin: number;
        favWinRate: number;
        drawRate: number;
        upsetRate: number;
        total: number;
    };

    probFav: number;
    probUnderdog: number;
    probDraw: number;
    
    algoPred: string;
    subPatPred: string;
    finalPred: string;
    isHedged: boolean;
    totalMatches: number;

    // Legacy fields for backward compatibility
    phaFavSupport: number;
    phaUnderdogSupport: number;
    phaDrawSupport: number;
    phaFavWinSupport: number;
    paaUpsetSupport: number;
    phaUnderdogCount: number;
    phaDrawCount: number;
}

export const getMatchStats = (match: Match, phaStatsMap: Record<string, any>): MatchStats => {
    if ((match as any)._cachedMatchStats) {
        return (match as any)._cachedMatchStats;
    }

    let o1 = 0, oX = 0, o2 = 0;
    let moFav = '1';
    let moUnderdog = '2';
    if (match.mo) {
        // Robust parsing: handle commas, spaces, dashes
        const parts = match.mo.split(/[- ,]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
        if (parts.length >= 3) {
            o1 = parts[0];
            oX = parts[1];
            o2 = parts[2];
            moFav = o1 < o2 ? '1' : '2';
            moUnderdog = o1 < o2 ? '2' : '1';
        } else if (parts.length === 1) {
            const pred = match.finalPrediction || match.targetPrediction || match.seerPrediction || match.pred1x2 || '1';
            moFav = pred.includes('2') ? '2' : '1';
            moUnderdog = moFav === '1' ? '2' : '1';
            if (moFav === '1') { o1 = parts[0]; o2 = 99; } else { o2 = parts[0]; o1 = 99; }
        }
    }
    const favOdds = moFav === '1' ? o1 : o2;
    const underdogOdds = moUnderdog === '1' ? o1 : o2;

    const sub = match.patternAnalysis?.subPattern || 'NA';
    const pha = sub ? phaStatsMap[sub] : null;

    let phaStats = { home: 0, draw: 0, away: 0, favSupport: 0, underdogSupport: 0, drawSupport: 0 };
    let paaStats = { favWin: 0, draw: 0, upsetWin: 0, favWinRate: 0, drawRate: 0, upsetRate: 0, total: 0 };

    if (pha && pha.total > 0) {
        const total = pha.total;
        if (pha.outcomes) {
            phaStats.home = pha.outcomes['1'] || 0;
            phaStats.draw = pha.outcomes['X'] || 0;
            phaStats.away = pha.outcomes['2'] || 0;
            
            phaStats.drawSupport = (phaStats.draw / total) * 100;
            phaStats.favSupport = ((pha.outcomes[moFav as '1'|'2'] || 0) / total) * 100;
            phaStats.underdogSupport = ((pha.outcomes[moUnderdog as '1'|'2'] || 0) / total) * 100;

            paaStats.favWin = pha.favWin || 0;
            paaStats.draw = pha.draw || 0;
            paaStats.upsetWin = pha.upsetWin || 0;
            
            const paaTotal = pha.paaTotal ?? total;
            const pDenom = paaTotal > 0 ? paaTotal : total;
            paaStats.total = pDenom;
            paaStats.favWinRate = (paaStats.favWin / pDenom) * 100;
            paaStats.drawRate = (paaStats.draw / pDenom) * 100;
            paaStats.upsetRate = (paaStats.upsetWin / pDenom) * 100;
        } else {
            // Fallback for flat structure
            phaStats.home = (pha as any)['1'] || 0;
            phaStats.draw = (pha as any)['X'] || 0;
            phaStats.away = (pha as any)['2'] || 0;
            phaStats.drawSupport = (phaStats.draw / total) * 100;
            phaStats.favSupport = ((pha as any)[moFav as '1'|'2'] || 0) * 100; // If they are already rates
            phaStats.underdogSupport = ((pha as any)[moUnderdog as '1'|'2'] || 0) * 100;
            
            // In fallback, PAA might not exist, default to PHA as proxy
            paaStats.total = total;
            paaStats.favWinRate = phaStats.favSupport;
            paaStats.drawRate = phaStats.drawSupport;
            paaStats.upsetRate = phaStats.underdogSupport;
        }
    }

    let p1 = 0, pX = 0, p2 = 0;
    if (match.algoReport?.probabilities) {
        p1 = match.algoReport.probabilities['1'];
        pX = match.algoReport.probabilities['X'];
        p2 = match.algoReport.probabilities['2'];
    }
    const probFav = (moFav === '1' ? p1 : p2) * 100;
    const probUnderdog = (moUnderdog === '1' ? p1 : p2) * 100;
    const probDraw = pX * 100;

    const subPatPred = match.patternAnalysis?.subPatternPrediction || match.rawPrediction || '1';
    const algoPred = match.algoReport?.prediction || subPatPred;
    const finalPred = match.finalPrediction || subPatPred;
    const isHedged = finalPred.length > 1;
    const totalMatches = pha ? pha.total : 0;
    
    const result = {
        o1, oX, o2, moFav, moUnderdog, favOdds, underdogOdds,
        phaStats, paaStats,
        probFav, probUnderdog, probDraw,
        algoPred, subPatPred, finalPred, isHedged, totalMatches,
        // Map Legacy fields for compatibility
        phaFavSupport: paaStats.favWinRate,
        phaUnderdogSupport: paaStats.upsetRate,
        phaDrawSupport: paaStats.drawRate,
        phaFavWinSupport: paaStats.favWinRate,
        paaUpsetSupport: paaStats.upsetRate,
        phaUnderdogCount: moUnderdog === '1' ? phaStats.home : phaStats.away,
        phaDrawCount: phaStats.draw
    };
    (match as any)._cachedMatchStats = result;
    return result;
};

export const calculateStars = (accuracyInput: number | string): number => {
    const accuracy = typeof accuracyInput === 'string' ? parseInt(accuracyInput) : accuracyInput;
    if (isNaN(accuracy) || accuracy <= 0) return 0;
    if (accuracy < 50) return 1;
    if (accuracy < 65) return 2;
    if (accuracy < 75) return 3;
    if (accuracy < 85) return 4;
    return 5;
};

export const isMatchAccurate = (match: Match, category: string, priority: string): boolean | null => {
    const actual = getActualResult(match.result || '');
    if (!actual || actual === 'pending') return null;

    const cat = category.toLowerCase();
    
    // Get Market Favorite
    let o1 = 0, o2 = 0;
    if (match.mo) {
        const parts = match.mo.split(/[- ,]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
        if (parts.length >= 3) {
            o1 = parts[0];
            oX = parts[1];
            o2 = parts[2];
            moFav = o1 < o2 ? '1' : '2';
            moUnderdog = o1 < o2 ? '2' : '1';
        } else if (parts.length === 1) {
            const pred = match.finalPrediction || match.targetPrediction || match.seerPrediction || match.pred1x2 || '1';
            moFav = pred.includes('2') ? '2' : '1';
            moUnderdog = moFav === '1' ? '2' : '1';
            if (moFav === '1') { o1 = parts[0]; o2 = 99; } else { o2 = parts[0]; o1 = 99; }
        } else {
            // Fallback to pred1x2 if odds are missing or equal
            if (match.pred1x2 === '2') {
                moFav = '2';
                moUnderdog = '1';
            }
        }
    }

    // --- CATEGORY CALCULATOR RULES ---
    // Overall accuracy for all category matches is calculated by asking whether the match hit the hedged prediction (1X/X2 or 12).
    const rawPred = String(match.targetPrediction || match.finalPrediction || match.rawPrediction || '').trim().toUpperCase();

    // 1. If the match has an explicit '12' hedge (from hedging protocols or consensus)
    if (rawPred === '12') {
        return actual === '1' || actual === '2';
    }

    // 2. Upsets: Underdog Win or Draw (or 12 if PR10)
    if (cat.includes('upsets')) {
        if (priority === 'PR10' || rawPred === '12') {
            return actual === '1' || actual === '2';
        }
        if (moUnderdog === '1') return actual === '1' || actual === 'X';
        if (moUnderdog === '2') return actual === '2' || actual === 'X';
    }

    // 3. Banker Draws: Check whether underdog hedge or favorite hedge
    if (cat.includes('banker_draws')) {
        const hedgesUnderdog = (moUnderdog === '1' && (rawPred === '1X' || rawPred === 'X')) || 
                               (moUnderdog === '2' && (rawPred === 'X2' || rawPred === 'X'));

        const requiresUnderdogHedge = (priority === 'PR1' && hedgesUnderdog) || priority === 'PR2' || priority === 'PR4';

        if (requiresUnderdogHedge) {
            if (moUnderdog === '1') return actual === '1' || actual === 'X';
            if (moUnderdog === '2') return actual === '2' || actual === 'X';
        } else {
            if (moFav === '1') return actual === '1' || actual === 'X';
            if (moFav === '2') return actual === '2' || actual === 'X';
        }
    }

    // 4. Value Bets: Depends on priority
    if (cat.includes('value_bets')) {
        const underdogPriorities = ['PR2', 'PR4', 'PR6'];
        if (priority && underdogPriorities.includes(priority)) {
            if (moUnderdog === '1') return actual === '1' || actual === 'X';
            if (moUnderdog === '2') return actual === '2' || actual === 'X';
        }
        if (moFav === '1') return actual === '1' || actual === 'X';
        if (moFav === '2') return actual === '2' || actual === 'X';
    }

    // 5. All Favorite categories (top10, top20, botb_best, bankers_jackpot, bankers_dlive, value_picks, best_bet):
    if (rawPred === '1X') return actual === '1' || actual === 'X';
    if (rawPred === 'X2') return actual === '2' || actual === 'X';
    if (rawPred === '12') return actual === '1' || actual === '2';

    // Default Favorite Hedge (1X for home favorite, X2 for away favorite)
    if (moFav === '1') return actual === '1' || actual === 'X';
    if (moFav === '2') return actual === '2' || actual === 'X';

    // Fallback
    return matchesPrediction(rawPred, actual);
};

export const evaluateMatchCategory = (
    match: Match, 
    category: MatchCategory, 
    priority: Priority, 
    phaStatsMap: Record<string, any>,
    isJackpot: boolean,
    isLiveAnalysisUI: boolean = false,
    matchStars: Record<string, number> = {}
): boolean => {
    if (category === 'all') return true;
    if (category === 'pending') {
        return getActualResult(match.result || '') === 'pending';
    }

    // NOTE: Evaluator tags should tag all matches that qualify even when they are banned.
    // Therefore, absolute category early-rejections for Pattern T and African leagues have been removed at this level.
    // They are tagged with BANNED: tags at the evaluator level, and filtered during slip selection.

    const {
        o1, oX, o2, moFav, moUnderdog, favOdds, underdogOdds,
        phaFavSupport, phaUnderdogSupport, phaDrawSupport,
        phaFavWinSupport,
        phaUnderdogCount, phaDrawCount,
        probFav, probUnderdog, probDraw,
        algoPred, subPatPred, finalPred, isHedged, paaUpsetSupport, paaStats
    } = getMatchStats(match, phaStatsMap);

    const group = match.group || 0;
    const subPat = (match.patternAnalysis?.subPattern || '').toUpperCase();
    const subPatPrim = match.patternAnalysis?.primaryPrediction || '';
    const subPatFin = match.patternAnalysis?.subPatternPrediction || '';

    // --- BAN LOGIC ---
    const subPatLower = subPat.toLowerCase();
    const isBasicBanned = subPatLower.includes('t') || subPatLower.includes('y') || subPatLower.includes('nn') || subPatLower.includes('n');
    const isPatternJ = subPatLower.includes('j');
    const isPatternS = subPatLower.includes('s');
    
    const isDrawRisk = (
        (group === 1 && G1_DRAW_RISK.some(id => subPat.endsWith(id.toUpperCase()))) ||
        (group === 2 && G2_DRAW_RISK.some(id => subPat.endsWith(id.toUpperCase()))) ||
        (group === 3 && G3_DRAW_RISK.some(id => subPat.endsWith(id.toUpperCase())))
    );
    
    const isUpsetRisk = (
        (group === 1 && G1_UPSET_RISK.some(id => subPat.endsWith(id.toUpperCase()))) ||
        (group === 2 && G2_UPSET_RISK.some(id => subPat.endsWith(id.toUpperCase()))) ||
        (group === 3 && G3_UPSET_RISK.some(id => subPat.endsWith(id.toUpperCase())))
    );

    // --- UNDERDOG CONSENSUS SIGNAL (UCS) ---
    // When 2+ primary predictors independently point to the underdog, the match is an
    // underdog-only candidate. It must NOT appear in any safe/favorite categories.
    const algoPrimary = match.algoReport?.prediction?.split('')[0] || ''; // first char = primary
    const subPatPrimary = match.patternAnalysis?.primaryPrediction || '';
    const paaPrimary = match.paaPrimaryPrediction || '';
    const mlFavProb = probFav; // already derived from algoReport probabilities for moFav

    // Count how many primary predictors point to the underdog
    let underdogPrimaryVotes = 0;
    if (algoPrimary === moUnderdog) underdogPrimaryVotes++;
    if (subPatPrimary === moUnderdog) underdogPrimaryVotes++;
    if (paaPrimary === moUnderdog) underdogPrimaryVotes++;

    // UCS triggers when:
    //  - 2+ primary predictors back the underdog, OR
    //  - ML M.Fav probability is below 40% AND at least 1 primary predictor backs the underdog
    const isUnderdogConsensus = (underdogPrimaryVotes >= 2) ||
        (mlFavProb < 40 && underdogPrimaryVotes >= 1);

    // Rule 1 & 4 (Banned patterns T/Y/NN/N): allowed ONLY for Banker Draws, Value Bets, or Upsets
    // Replaced: Removed absolute restriction based on category for Banned Patterns
    
    // Rule 2 (Draw Risk): Let matches be tagged, let slip rules drop if BANNED:DRAW_RISK
    // Rule 5 (Pattern J & S): Let matches be tagged
    
    // Rule 3 (Upset Risk): allowed ONLY for Upsets, Value Bets, and specific Banker Draws
    // Replaced: Removed absolute restriction based on category for Upset Risk

    if (category === 'banned') {
        return Math.abs(phaUnderdogCount - phaDrawCount) <= 1;
    }

    // Rule 6: Disqualify Top 20, Bankers DLive, Bankers Jackpot, Value Picks if Algo=12 and 1X2=Underdog
    // Let matches be tagged, slips will handle constraints

    const activeFlags = match.patternAnalysis?.activeFlags || [];

    // --- BEST BET ---
    if (category === 'best_bet') {
        if (isUnderdogConsensus) return false;
        if (!matchesPrediction(finalPred, moFav)) return false;
        if (favOdds < 1.30 || favOdds > 1.60) return false;
        
        const algoAgrees = matchesPrediction(algoPred, moFav);
        
        const isPR1 = phaFavWinSupport >= 60 && probFav >= 60;
        const isPR2 = phaFavWinSupport >= 50 && probFav >= 50;
        const isPR3 = phaFavWinSupport >= 50 && probFav >= 45;
        const isPR4 = phaFavWinSupport >= 50;
        const isPR5 = phaFavWinSupport >= 40;

        if (priority === 'PR1') return isPR1;
        if (priority === 'PR2') return isPR2;
        if (priority === 'PR3') return isPR3;
        if (priority === 'PR4') return isPR4;
        if (priority === 'PR5') return isPR5;
        return priority === 'all' && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
    }

    // --- TOP 12 ---
    if (category === 'top12' || category === 'top10') {
        // UCS: Underdog consensus → route to upsets only
        if (isUnderdogConsensus) return false;
        // 1. All matches must be hedged
        // Let slip enforce hedge constraints
        // 2. Must be a bet on the market favorite
        if (!matchesPrediction(finalPred, moFav)) return false;
        // 3. Odds must be 2.0 to 3.00 (Tight range: 2.0-2.4, Above 2.4 is Last Resort)
        if (favOdds < 2.00 || favOdds > 3.00) return false;
        
        const algoAgrees = matchesPrediction(algoPred, moFav);
        
        const isPR1 = phaFavWinSupport >= 60 && probFav >= 60;
        const isPR2 = phaFavWinSupport >= 50 && probFav >= 50;
        const isPR3 = phaFavWinSupport >= 50 && probFav >= 45;
        const isPR4 = phaFavWinSupport >= 50;
        const isPR5 = phaFavWinSupport >= 40;

        if (priority === 'PR1') return isPR1;
        if (priority === 'PR2') return isPR2;
        if (priority === 'PR3') return isPR3;
        if (priority === 'PR4') return isPR4;
        if (priority === 'PR5') return isPR5;
        return priority === 'all' && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
    }

    // --- BANKERS DLIVE ---
    if (category === 'bankers_dlive') {
        // UCS: Underdog consensus → not safe
        if (isUnderdogConsensus) return false;
        // Exclude Draw Risk Banned patterns unless in Live Analysis (Hedged) - Removed to allow tagging

        // 1. No hedge (straight 1 or 2) - let slip deal with constraints
        // 2. Must be a bet on the market favorite
        if (!matchesPrediction(finalPred, moFav)) return false;
        // 3. Odds must be > 1.60 to < 2.00
        if (favOdds <= 1.60 || favOdds >= 2.00) return false;

        const isPR1 = phaFavWinSupport >= 60 && probFav >= 60;
        const isPR2 = phaFavWinSupport >= 50 && probFav >= 50;
        const isPR3 = phaFavWinSupport >= 50 && probFav >= 45;
        const isPR4 = phaFavWinSupport >= 50;
        const isPR5 = phaFavWinSupport >= 40;

        if (priority === 'PR1') return isPR1;
        if (priority === 'PR2') return isPR2;
        if (priority === 'PR3') return isPR3;
        if (priority === 'PR4') return isPR4;
        if (priority === 'PR5') return isPR5;
        return priority === 'all' && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
    }

    // --- BOTB (BEST OF THE BEST) ---
    if (category === 'botb_best') {
        // UCS: Underdog consensus → not safe
        if (isUnderdogConsensus) return false;
        const ratingStr = match.rating || '0/10';
        const ratingVal = parseInt(ratingStr.split('/')[0]);
        const extAgrees = matchesPrediction(match.pred1x2 || '', moFav);
        const subPatValidHedged = (subPatPred === '1X' || subPatPred === 'X2');
        const subPatValidUnhedged = isLiveAnalysisUI ? subPatValidHedged : (subPatPred === '1' || subPatPred === '2');
        
        const algoAgreesHedged = algoPred === subPatPred;
        const algoAgreesUnhedged = algoPred === subPatPred;

        const validHedgedOdds = favOdds >= 2.0 && favOdds < 2.4;
        const validUnhedgedOdds = favOdds >= 1.5 && favOdds < 2.0;

        const baseHedgedConditionsValid = subPatValidHedged && 
                                    algoAgreesHedged && 
                                    phaFavSupport >= 50 && 
                                    probFav >= 50 && 
                                    extAgrees;

        const baseUnhedgedConditionsValid = subPatValidUnhedged && 
                                    algoAgreesUnhedged && 
                                    phaFavSupport >= 50 && 
                                    probFav >= 50 && 
                                    extAgrees;

        const ratingValidHedged = ratingVal >= 2;
        const ratingValidUnhedged = ratingVal >= 3;

        // HEDGED constraints (Always requires strictly PAA >= 55% AND PHA >= 50%)
        const paaHedgedValid = phaFavWinSupport >= 60; // Upgraded from 55 to match PR1 target if possible, UI says 60 for PR1/PR2
        const isStrictHedged = (isLiveAnalysisUI || isHedged) && validHedgedOdds && baseHedgedConditionsValid && ratingValidHedged && paaHedgedValid;

        // UNHEDGED strict base (Relies on PAA tiers, with PHA >= 50%)
        const isStrictUnhedged = (isLiveAnalysisUI || !isHedged) && validUnhedgedOdds && baseUnhedgedConditionsValid && ratingValidUnhedged;

        // PR3: Minor Disagreements logic (Relaxed base)
        let disagreements = 0;
        if (subPatPred === '12') disagreements++;
        
        const algoContradicts = algoPred !== subPatPred;
        if (algoContradicts) disagreements++;
        
        const extContradicts = !matchesPrediction(match.pred1x2 || '', subPatPred);
        if (extContradicts) disagreements++;
        
        if (ratingVal < 3) disagreements++;

        // Algo and 1X2 cannot both contradict the Sub Pattern
        const isRelaxedBase = disagreements <= 3 && !(algoContradicts && extContradicts) && phaFavSupport >= 50 && probFav >= 50;
        
        const isRelaxedHedged = (isLiveAnalysisUI || isHedged) && validHedgedOdds && isRelaxedBase && (phaFavWinSupport >= 50);
        const isRelaxedUnhedged = (isLiveAnalysisUI || !isHedged) && validUnhedgedOdds && isRelaxedBase;

        const isPR1 = (isStrictHedged || isStrictUnhedged) && phaFavWinSupport >= 60;
        const isPR2 = (isStrictHedged || isStrictUnhedged) && phaFavWinSupport >= 55;
        const isPR3 = (isRelaxedHedged || isRelaxedUnhedged) && phaFavWinSupport >= 50;
        const isPR4 = (isRelaxedHedged || isRelaxedUnhedged) && phaFavWinSupport >= 45;
        const isPR5 = (isRelaxedHedged || isRelaxedUnhedged) && phaFavWinSupport >= 40;

        if (priority === 'PR1') return isPR1;
        if (priority === 'PR2') return isPR2;
        if (priority === 'PR3') return isPR3;
        if (priority === 'PR4') return isPR4;
        if (priority === 'PR5') return isPR5;
        
        return priority === 'all' && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
    }

    // --- 11-20 & Top 20 ---
    if (category === 'top20') {
        // UCS: Underdog consensus → not safe
        if (isUnderdogConsensus) return false;
        // Must be a bet on the market favorite.
        if (!matchesPrediction(finalPred, moFav)) return false;
        // Odds must be >= 1.5.
        if (favOdds < 1.5) return false;

        // Exclusion Protocol: IF Category == 'TOP20' AND (Home_Odds > 2.20 OR League CONTAINS 'U21' OR League CONTAINS 'Youth') THEN Exclude
        // Let matches be tagged, slips will handle constraints.
        const league = match.league?.toLowerCase() || '';
        
        const algoAgrees = matchesPrediction(algoPred, moFav);
        const subPatRaw = match.patternAnalysis?.subPattern || '';
        
        // Mitigation Protocol: IF Category == 'TOP20' AND Algo_Prediction IN ['1', '2'] AND SubPat == '12' AND Group == '2' THEN Modify Algo_Prediction to '1X' or 'X2' (Hedge)
        // Let matches be tagged, the slip compilation rules can enforce the hedge or drop.

        const isPR1 = phaFavWinSupport >= 60 && probFav >= 60;
        const isPR2 = phaFavWinSupport >= 50 && probFav >= 50;
        const isPR3 = phaFavWinSupport >= 50 && probFav >= 45;
        const isPR4 = phaFavWinSupport >= 50;
        const isPR5 = phaFavWinSupport >= 40;

        if (priority === 'PR1') return isPR1;
        if (priority === 'PR2') return isPR2;
        if (priority === 'PR3') return isPR3;
        if (priority === 'PR4') return isPR4;
        if (priority === 'PR5') return isPR5;
        return priority === 'all' && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
    }

    // --- BANKERS (JACKPOT) ---
    if (category === 'bankers_jackpot') {
        // UCS: Underdog consensus → not safe
        if (isUnderdogConsensus) return false;
        // Must be a bet on the market favorite.
        if (!matchesPrediction(finalPred, moFav)) return false;
        // Odds must be >= 1.80 to 2.4
        if (favOdds < 1.80 || favOdds > 2.4) return false;
        
        // PAA_S.win/Mfav should be >= 40%, or combined safety (Fav + Draw) >= 65%
        if (phaFavWinSupport < 40 && (phaFavWinSupport + (paaStats?.drawRate || 0)) < 65) return false;

        const isPR1 = phaFavWinSupport >= 60 && probFav >= 60;
        const isPR2 = phaFavWinSupport >= 50 && probFav >= 50;
        const isPR3 = phaFavWinSupport >= 50 && probFav >= 45;
        const isPR4 = phaFavWinSupport >= 50;
        const isPR5 = phaFavWinSupport >= 40;

        if (priority === 'PR1') return isPR1;
        if (priority === 'PR2') return isPR2;
        if (priority === 'PR3') return isPR3;
        if (priority === 'PR4') return isPR4;
        if (priority === 'PR5') return isPR5;
        return priority === 'all' && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
    }

    // --- VALUE BETS ---
    if (category === 'value_bets') {
        // Must be a bet on the market favorite or the underdog.
        if (!matchesPrediction(finalPred, moFav) && !matchesPrediction(finalPred, moUnderdog)) return false;
        // Odds must be >= 2.5 on both teams.
        if (o1 < 2.50 || o2 < 2.50) return false;
        // Must be hedged - let slip handle this constraint

        // Weighting Protocol: IF Category == 'VALUE_BETS' AND Algo Prediction != Sub Pattern Prediction, THEN DEFER to Sub Pattern Prediction
        // We'll check if finalPred matches subPatPred if they disagree
        if (subPatPred && algoPred !== subPatPred) {
            if (!matchesPrediction(finalPred, subPatPred)) return false;
        }

        const isPR1 = phaFavSupport >= 50 && probFav >= 50;
        const isPR2 = phaUnderdogSupport >= 50 && probUnderdog >= 50;
        const isPR3 = phaFavSupport >= 45 && probFav >= 45;
        const isPR4 = phaUnderdogSupport >= 45 && probUnderdog >= 45;
        const isPR5 = phaFavSupport >= 40 && probFav >= 40;
        const isPR6 = phaUnderdogSupport >= 40 && probUnderdog >= 40;
        const isPR7 = phaFavSupport >= 40;
        const isPR8 = phaUnderdogSupport >= 40;

        if (priority === 'PR1') return isPR1;
        if (priority === 'PR2') return isPR2;
        if (priority === 'PR3') return isPR3;
        if (priority === 'PR4') return isPR4;
        if (priority === 'PR5') return isPR5;
        if (priority === 'PR6') return isPR6;
        if (priority === 'PR7') return isPR7;
        if (priority === 'PR8') return isPR8;
        return priority === 'all' && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5 || isPR6 || isPR7 || isPR8);
    }

    // --- VALUE PICKS ---
    if (category === 'value_picks') {
        // UCS: Underdog consensus → not safe
        if (isUnderdogConsensus) return false;
        // Exclude Draw Risk Banned patterns unless in Live Analysis (Hedged) - Removed to allow tagging

        // Odds must be >= 2.0 to 2.50
        const minOdds = 2.00;
        if (favOdds < minOdds || favOdds > 2.50) return false;
        
        // PAA_S.win/Mfav should be >= 40%, or combined safety >= 65%
        if (phaFavWinSupport < 40 && (phaFavWinSupport + (paaStats?.drawRate || 0)) < 65) return false;

        const isPR1 = phaFavWinSupport >= 60 && probFav >= 60;
        const isPR2 = phaFavWinSupport >= 50 && probFav >= 50;
        const isPR3 = phaFavWinSupport >= 50 && probFav >= 45;
        const isPR4 = phaFavWinSupport >= 50;
        const isPR5 = phaFavWinSupport >= 40;

        if (priority === 'PR1') return isPR1;
        if (priority === 'PR2') return isPR2;
        if (priority === 'PR3') return isPR3;
        if (priority === 'PR4') return isPR4;
        if (priority === 'PR5') return isPR5;
        
        return priority === 'all' && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5);
    }

    // --- BANKER DRAWS ---
    if (category === 'banker_draws') {
        // Market favorite or underdog.
        // Odds must be > 2.0.
        // Rule: "Both home and away odds MUST be >= 2.0."
        if (o1 < 2.0 || o2 < 2.0) return false;
        
        // Draw Odds Cap: IF Category == 'BANKER_DRAWS' AND Draw_Odds > 3.80 THEN EXCLUDE
        if (oX > 3.80) return false;

        // Must be hedged or straight X - let slip handle constraints
        const isStraightX = finalPred === 'X';
        
        // [PROTOCOL: Banker Draw Hedging Strategy]
        // NO STRAIGHT DRAWS logic removed to support straight X.
        
        // Use Probability or PAA Draw Rate to allow unhedged draw
        const satisfiesUnhedgedDraw = probDraw >= 40 || paaStats.drawRate >= 40;
        
        const hedgesFav = (moFav === '1' && finalPred === '1X') || (moFav === '2' && finalPred === 'X2') || finalPred === 'X';
        const hedgesUnderdog = (moUnderdog === '1' && finalPred === '1X') || (moUnderdog === '2' && finalPred === 'X2') || finalPred === 'X';
        
        // When in LiveAnalysisUI, we allow tagging based on POTENTIAL hedge to guide Gemini
        const satisfiesHedgeFav = isLiveAnalysisUI || hedgesFav || satisfiesUnhedgedDraw;
        const satisfiesHedgeUnderdog = isLiveAnalysisUI || hedgesUnderdog || satisfiesUnhedgedDraw;
        
        // PR1: PAA Draw >= 30 AND Prob Draw >= 30 AND PAA S.win >= 40. MUST hedge towards Market favorite
        const isPR1 = paaStats.drawRate >= 30 && probDraw >= 30 && phaFavWinSupport >= 40 && satisfiesHedgeFav;

        // PR2: PAA Draw >= 30 AND Prob Draw >= 30 AND PAA Underdog > 30. MUST hedge towards Market underdog
        const isPR2 = paaStats.drawRate >= 30 && probDraw >= 30 && paaStats.upsetRate > 30 && satisfiesHedgeUnderdog;
        
        // PR3: PAA Draw >= 30 AND (hedge under if Upset >= 30 else hedge fav)
        const isPR3 = paaStats.drawRate >= 30 && (
            (paaStats.upsetRate >= 30 && satisfiesHedgeUnderdog) || 
            (paaStats.upsetRate < 30 && satisfiesHedgeFav)
        );

        // PR4: Prob Draw >= 30 AND (hedge under if Upset >= 30 else hedge fav)
        const isPR4 = probDraw >= 30 && (
            (paaStats.upsetRate >= 30 && satisfiesHedgeUnderdog) || 
            (paaStats.upsetRate < 30 && satisfiesHedgeFav)
        );

        if (priority === 'PR1') return isPR1;
        if (priority === 'PR2') return isPR2;
        if (priority === 'PR3') return isPR3;
        if (priority === 'PR4') return isPR4;
        return priority === 'all' && (isPR1 || isPR2 || isPR3 || isPR4);
    }

    // --- UPSETS ---
    if (category === 'upsets') {
        // Enforce valid odds and favorite/underdog structure to prevent blind tagging
        if (o1 <= 0 || o2 <= 0 || o1 === o2) return false;
        if (moUnderdog !== '1' && moUnderdog !== '2') return false;

        // Final prediction must support/cover the underdog
        if (!finalPred || !matchesPrediction(finalPred, moUnderdog)) return false;

        // 1. Core predictions support — require actual data before crediting support.
        // PAA primary prediction (must exist and equal the underdog side)
        const paaPrimPred = (match.paaPrimaryPrediction || '').trim();
        const paaPrimSupports = paaPrimPred.length > 0 && paaPrimPred === moUnderdog;

        // Seer primary prediction: prefer the sticky value stored on the match
        // (this is exactly what the match card displays). Only fall back to a
        // fresh computation using the SAME parameters the card uses ('all' +
        // DEFAULT_WEIGHTS) so we never disagree with what the user sees.
        let seerPrimPred = (match.seerPrimaryPrediction || '').trim();
        if (!seerPrimPred) {
            const seerDetailed = predictSeerDetailed(match, DEFAULT_WEIGHTS, phaStatsMap, matchStars, 'all');
            seerPrimPred = (seerDetailed?.primary || '').trim();
        }
        const seerPrimSupports = seerPrimPred.length > 0 && seerPrimPred === moUnderdog;

        // Algo final prediction (must exist; single or hedge that covers underdog)
        const algoPredVal = (match.algoReport?.prediction || '').trim();
        const algoSupports = algoPredVal.length > 0 && matchesPrediction(algoPredVal, moUnderdog);

        // Sub-pattern primary prediction (derived from PHA stats)
        const stats = getMatchStats(match, phaStatsMap);
        const pha = stats.phaStats;
        const maxPha = Math.max(pha.home, pha.draw, pha.away);
        let subPattPrimSupports = false;
        if (maxPha > 0) {
            const maxOutcomes = [];
            if (pha.home === maxPha) maxOutcomes.push('1');
            if (pha.draw === maxPha) maxOutcomes.push('X');
            if (pha.away === maxPha) maxOutcomes.push('2');
            subPattPrimSupports = maxOutcomes.includes(moUnderdog);
        }

        // PR1(a)-(d) Evaluation
        const isPR1a = subPattPrimSupports && algoSupports && seerPrimSupports;
        const isPR1b = subPattPrimSupports && seerPrimSupports && !isPR1a;
        const isPR1c = subPattPrimSupports && algoSupports && !isPR1a && !isPR1b;
        const isPR1d = subPattPrimSupports && !isPR1a && !isPR1b && !isPR1c;

        const isPR1 = isPR1a || isPR1b || isPR1c || isPR1d;

        // PR2(a)-(d) Evaluation
        const isPR2a = paaPrimSupports && seerPrimSupports && algoSupports;
        const isPR2b = paaPrimSupports && seerPrimSupports;
        const isPR2c = seerPrimSupports && algoSupports;
        const isPR2d = paaPrimSupports && algoSupports;

        const isPR2 = isPR2a || isPR2b || isPR2c || isPR2d;

        // PR3: Use the SAME points shown on the Match Card (match.totalPoints).
        // If they haven't been computed for this match yet, do NOT tag — otherwise
        // we'd score off a fresh recompute that disagrees with the card.
        const cardPoints = match.totalPoints;
        let isPR3 = false;
        if (cardPoints && typeof cardPoints.home === 'number' && typeof cardPoints.away === 'number') {
            const teamPointsUnderdog = moUnderdog === '1' ? cardPoints.home : cardPoints.away;
            const teamPointsFav = moFav === '1' ? cardPoints.home : cardPoints.away;
            isPR3 = teamPointsUnderdog >= (teamPointsFav + 5);
        }

        // PR4: Seer draw predictions % is >= 40% (default weights, 'all')
        const defaultSeerDetailed = predictSeerDetailed(match, DEFAULT_WEIGHTS, phaStatsMap, matchStars, 'all');
        const isPR4 = (defaultSeerDetailed?.percentages?.['X'] || 0) >= 40;

        // PR5: Algo confidence of the underdog is >=40% (requires an algo report)
        const isPR5 = !!match.algoReport && probUnderdog >= 40;

        // PR6: Match carries a genuine "Potential Upset" flag on the card.
        // Require either a positive upsetPotential.bonus favouring the underdog,
        // or an explicit "Potential Upset" tsIndicator — no null/undefined free passes.
        const upsetPotential: any = cardPoints?.breakdown?.upsetPotential;
        const hasUpsetPotentialBonus = !!upsetPotential
            && typeof upsetPotential === 'object'
            && (upsetPotential.bonus || 0) > 0
            && (!upsetPotential.team || upsetPotential.team === moUnderdog);
        const hasUpsetIndicator = typeof cardPoints?.breakdown?.tsIndicators === 'string'
            && cardPoints.breakdown.tsIndicators.includes('Potential Upset');
        const isPR6 = hasUpsetPotentialBonus || hasUpsetIndicator;

        if (priority === 'PR1') return isPR1;
        if (priority === 'PR1a') return isPR1a;
        if (priority === 'PR1b') return isPR1b;
        if (priority === 'PR1c') return isPR1c;
        if (priority === 'PR1d') return isPR1d;
        if (priority === 'PR2a') return isPR2a;
        if (priority === 'PR2b') return isPR2b;
        if (priority === 'PR2c') return isPR2c;
        if (priority === 'PR2d') return isPR2d;
        if (priority === 'PR2') return isPR2;
        if (priority === 'PR3') return isPR3;
        if (priority === 'PR4') return isPR4;
        if (priority === 'PR5') return isPR5;
        if (priority === 'PR6') return isPR6;

        return priority === 'all' && (isPR1 || isPR2 || isPR3 || isPR4 || isPR5 || isPR6);
    }

    return true;
};

export const getMatchEvaluatorTags = (match: Match, phaStatsMap: Record<string, any>, isJackpot: boolean, isLiveAnalysisUI: boolean = false, matchStars: Record<string, number> = {}): string[] => {
    const tags: string[] = [];
    const categories: MatchCategory[] = ['best_bet', 'top12', 'bankers_dlive', 'botb_best', 'top20', 'bankers_jackpot', 'value_bets', 'value_picks', 'banker_draws', 'upsets'];
    const priorities: Priority[] = ['PR1a', 'PR1b', 'PR1c', 'PR1d', 'PR2a', 'PR2b', 'PR2c', 'PR2d', 'PR1', 'PR2', 'PR3', 'PR4', 'PR5', 'PR6', 'PR7', 'PR8', 'PR9', 'PR10', 'PR11', 'PR12', 'PR13'];

    const stats = getMatchStats(match, phaStatsMap);

    // NEW RULES: Specific Sub-Pattern + Group BANS
    const subPat = (match.patternAnalysis?.subPattern || '').toUpperCase();
    const group = match.group || 0;

    let isBanned = false;
    const isPatternTSub = (match.patternAnalysis?.mainPattern || '').toUpperCase() === 'T' && !!match.patternAnalysis?.subPattern;
    if (isPatternTSub) {
        tags.push('BANNED:PATTERN_T');
        isBanned = true;
    }

    if (group === 1) {
        if (G1_DRAW_RISK.some(id => subPat.endsWith(id))) { tags.push('BANNED:DRAW_RISK'); isBanned = true; }
        if (G1_UPSET_RISK.some(id => subPat.endsWith(id))) { tags.push('BANNED:UPSET_RISK'); isBanned = true; }
    } else if (group === 2) {
        if (G2_UPSET_RISK.some(id => subPat.endsWith(id))) { tags.push('BANNED:UPSET_RISK'); isBanned = true; }
        if (G2_DRAW_RISK.some(id => subPat.endsWith(id))) { tags.push('BANNED:DRAW_RISK'); isBanned = true; }
    } else if (group === 3) {
        if (G3_DRAW_RISK.some(id => subPat.endsWith(id))) { tags.push('BANNED:DRAW_RISK'); isBanned = true; }
        if (G3_UPSET_RISK.some(id => subPat.endsWith(id))) { tags.push('BANNED:UPSET_RISK'); isBanned = true; }
    }

    // Tag African country local league matches as TAG:AFRICAN_LEAGUE (unbanned)
    const teams = (match.teams || '').toLowerCase();
    const league = (match.league || '').toLowerCase();
    const africanDomesticRegex = /tanzania|tanzanian|kenya|kenyan|uganda|ugandan|rwanda|rwandan|egypt|egyptian|morocco|moroccan|nigeria|nigerian|ghana|ghanaian|south africa|south african|zambia|zambian|senegal|senegalese|tunisia|tunisian|algeria|algerian|mali|cameroon|cameroonian|congo|angola|angolan|burundi|sudan|sudanese|somalia|ethiopia|ethiopian|suhul shire|caps united|triangle u|malawi|mozambique|botswana|namibia|zimbabwe|zimbabwean|lesotho|eswatini|madagascar|ivory coast|cote d'ivoire|guinea|burkina faso|benin|togo|mauritania|niger|chad|central african|gabon|equatorial|djibouti|eritrea|seychelles|comoros|mauritius|sao tome|sierra leone|liberia|gambia|cape verde|chemilil|sony sugar|jkt/i;
    if (africanDomesticRegex.test(teams) || africanDomesticRegex.test(league)) {
        tags.push('TAG:AFRICAN_LEAGUE');
    }

    // Tag youth league matches (U21, U20, Youth)
    if (/\b(u21|u20|youth)\b/i.test(teams) || /\b(u21|u20|youth)\b/i.test(league)) {
        tags.push('TAG:YOUTH_LEAGUE');
    }

    // All leagues and matches are completely unbanned from slips per user directive


    // LAST RESORT rule for unbanned R and FF
    const mainPat = (match.patternAnalysis?.mainPattern || '').toUpperCase();
    if (!isBanned && (mainPat === 'R' || mainPat === 'FF')) {
        tags.push('VOLATILE:LAST_RESORT');
    }

    for (const cat of categories) {
        let hasCategory = false;
        let matchedPriority: Priority | null = null;
        for (const pr of priorities) {
            if (evaluateMatchCategory(match, cat, pr, phaStatsMap, isJackpot, isLiveAnalysisUI, matchStars)) {
                matchedPriority = pr;
                tags.push(`${cat}:${pr}`);
                if (cat === 'top12') {
                    tags.push(`top10:${pr}`);
                }
                hasCategory = true;
                break; // Only tag with the highest priority met for this category
            }
        }

        // Apply Promote/Demote rules if it has the category
        if (hasCategory) {
            const subPatPred = match.patternAnalysis?.subPatternPrediction;
            const rawAlgoPred = match.algoReport?.prediction;
            const group = match.group || 3;

            // GLOBAL PROMOTE Rules
            // 1. Sub pattern prediction is 1X/X2
            const pRule1 = subPatPred === '1X' || subPatPred === 'X2';
            // 2. Algo agrees with sub pat prediction 1X/X2
            const pRule2 = (rawAlgoPred === '1X' || rawAlgoPred === 'X2') && rawAlgoPred === subPatPred;
            // 3. PHA support for market favorite >= 60%
            const pRule3 = stats.phaFavSupport >= 60;
            
            // GLOBAL PROMOTE Rules DO NOT apply to Upsets and Value Bets
            const isUpsetOrValueBet = cat === 'upsets' || cat === 'value_bets';
            
            // Category Specific PROMOTE
            let catPromote = false;
            let isExcellentStars = false;

            // NEW Rules for BOTB (Best of the Best)
            if (cat === 'botb_best') {
                const { phaFavWinSupport, probFav, subPatPred, algoPred } = stats;
                const ratingStr = match.rating || '0/10';
                const ratingVal = parseInt(ratingStr.split('/')[0]);
                const extAgrees = matchesPrediction(match.pred1x2 || '', stats.moFav);
                const subPatValidHedged = (subPatPred === '1X' || subPatPred === 'X2');
                const subPatValidUnhedged = isLiveAnalysisUI ? subPatValidHedged : (subPatPred === '1' || subPatPred === '2');
                const algoAgreesHedged = algoPred === subPatPred;
                const algoAgreesUnhedged = algoPred === subPatPred;

                const isPerfectHedged = (isLiveAnalysisUI || stats.isHedged) && 
                                       stats.favOdds >= 2.0 && stats.favOdds < 2.4 &&
                                       subPatValidHedged && 
                                       algoAgreesHedged && 
                                       stats.phaFavSupport > 50 && 
                                       phaFavWinSupport > 55 && 
                                       probFav >= 50 && 
                                       extAgrees && 
                                       ratingVal >= 2;

                const isPerfectUnhedged = (isLiveAnalysisUI || !stats.isHedged) && 
                                         stats.favOdds >= 1.5 && stats.favOdds < 2.0 &&
                                         subPatValidUnhedged && 
                                         algoAgreesUnhedged && 
                                         stats.phaFavSupport > 50 && 
                                         phaFavWinSupport > 60 && 
                                         probFav >= 50 && 
                                         extAgrees && 
                                         ratingVal >= 3;

                if (isPerfectHedged || isPerfectUnhedged) {
                    tags.push('botb_best:AUTO_PICK');
                    catPromote = true;
                }
                
                // Fallback promotion
                const validHedgedOddsFb = stats.favOdds >= 2.0 && stats.favOdds < 2.4;
                const validUnhedgedOddsFb = stats.favOdds >= 1.5 && stats.favOdds < 2.0;
                
                const oddsValidFallback = (isLiveAnalysisUI || stats.isHedged) && validHedgedOddsFb || (isLiveAnalysisUI || !stats.isHedged) && validUnhedgedOddsFb;
                
                const fallbackSubPatValid = (isLiveAnalysisUI || stats.isHedged) ? subPatValidHedged : subPatValidUnhedged;
                const fallbackAlgoAgrees = (isLiveAnalysisUI || stats.isHedged) ? algoAgreesHedged : algoAgreesUnhedged;

                if (phaFavWinSupport >= 50 && oddsValidFallback && fallbackSubPatValid && fallbackAlgoAgrees && stats.phaFavSupport > 50 && probFav >= 50) {
                    catPromote = true;
                }

                // PR3 promotion
                let disagreements = 0;
                if (subPatPred === '12') disagreements++;
                const algoContradicts = algoPred !== subPatPred;
                if (algoContradicts) disagreements++;
                const extContradicts = !matchesPrediction(match.pred1x2 || '', subPatPred);
                if (extContradicts) disagreements++;
                if (ratingVal < 3) disagreements++;

                if (disagreements <= 3 && !(algoContradicts && extContradicts) && oddsValidFallback && stats.phaFavSupport > 50 && probFav >= 50 && phaFavWinSupport >= 50) {
                    catPromote = true;
                }
            }

            const isTargetSlip = ['best_bet', 'top12', 'top10', 'bankers_dlive', 'botb_best', 'top20', 'bankers_jackpot', 'value_picks'].includes(cat);
            const ratingStr = match.rating || '0/10';
            const ratingVal = parseInt(ratingStr.split('/')[0]);
            const isHighRatingFor12 = ratingVal >= 5;
            const isHighRatingSupport = ratingVal >= 3;
            
            // Main Priority (b)
            const isUnderdogGreaterEqualDraw = stats.underdogOdds >= stats.oX && stats.underdogOdds > 0 && stats.oX > 0;
            const isUnderdogGreaterDraw = stats.underdogOdds > stats.oX && stats.underdogOdds > 0 && stats.oX > 0;
            
            // Main Priority (c)
            const phaDiff = Math.abs(stats.phaUnderdogSupport - stats.phaDrawSupport);
            const isPhaDiffValid = phaDiff > 1;

            // Main Priority (d)
            const excludedGroups = ['T', 'N', 'NN', 'Y', 't', 'y', 'n', 'nn'];
            const mainPattern = match.patternAnalysis?.mainPattern || '';
            const isExcludedGroup = excludedGroups.some(g => mainPattern.toLowerCase().startsWith(g.toLowerCase()));

            if (isTargetSlip) {
                // Calculate stars for this specific tag
                const abbrMap: Record<string, string> = {
                    'top12': 'T12', 'top10': 'T12', 'bankers_dlive': 'BDL', 'top20': 'T20', 
                    'bankers': 'BNK', 'bankers_jackpot': 'BNK',
                    'value_bets': 'VB', 'value_picks': 'VP', 
                    'banker_draws': 'BD', 'upsets': 'UPS'
                };
                const abbr = abbrMap[cat];
                const starKey = `${abbr}-${matchedPriority}-G${group}`;
                const fallbackStarKey = `${abbr}-${matchedPriority}-G3`;
                let stars = matchStars[starKey];
                if (stars === undefined) stars = matchStars[fallbackStarKey];
                isExcellentStars = stars !== undefined && stars >= 4;

                // Main Priority (a)
                const isSubPatValid = (subPatPred === '1X' || subPatPred === 'X2' || subPatPred === '1' || subPatPred === '2') || 
                                     (subPatPred === '12' && isHighRatingFor12 && isExcellentStars);

                // Support Priorities
                const algoAgrees = rawAlgoPred === subPatPred;
                const isGoodPR = matchedPriority && ['PR1', 'PR2', 'PR3', 'PR4', 'PR5'].includes(matchedPriority);

                const isPriorityUnderdog = stats.underdogOdds > 3.0;

                const hasMainPriorities = isSubPatValid && 
                                          ((cat === 'top12' || cat === 'top10') ? (isUnderdogGreaterEqualDraw && isPriorityUnderdog) : isUnderdogGreaterDraw) && 
                                          isPhaDiffValid && 
                                          !isExcludedGroup;
                
                const hasSupportPriorities = algoAgrees || isHighRatingSupport || isExcellentStars || isGoodPR;

                if (hasMainPriorities) {
                    catPromote = true;
                    if (hasSupportPriorities) {
                        tags.push(`${cat}:AUTO_PICK`);
                        if (cat === 'top12') tags.push(`top10:AUTO_PICK`);
                    }
                }
            }

            // 9. TOP 12 / TOP 20: Algo Synergy & Safety Vetoes
            if (['top12', 'top10', 'top20'].includes(cat)) {
                const reasonStr = (match.algoReport?.reason || '') + (match.qualityAudit?.reason || '');
                const hasCriticalDrawRisk = reasonStr.includes('Critical Draw Risk') || reasonStr.includes('High PHA Draw');
                const drawCeilingCap = stats.phaDrawSupport > 30;
                const hasBannedTie = tags.includes('PHA_TIE');
                const isUnhedged = !stats.isHedged;

                let shouldVeto = false;
                if (cat === 'top12' || cat === 'top10') {
                    // Top 12 usually hedged, draw is okay.
                    shouldVeto = false;
                } else {
                    // Top 20 & Next Best: If unhedged, Draw Risk is a trap.
                    shouldVeto = isUnhedged && (hasCriticalDrawRisk || drawCeilingCap);
                }

                if (shouldVeto) {
                    catPromote = false;
                } else if ((cat === 'top12' || cat === 'top10') && stats.underdogOdds <= 3.0) {
                    // Deprioritize Top 12 matches with Underdog odds <= 3.0
                    catPromote = false;
                } else if (matchesPrediction(rawAlgoPred || '', stats.moFav) && stats.phaFavSupport >= 50) {
                    catPromote = true;
                }
            }
            
            if (cat === 'banker_draws' && rawAlgoPred === subPatPred && (subPatPred === '1X' || subPatPred === 'X2' || subPatPred === 'X')) catPromote = true;
            
            if (cat === 'value_picks') {
                const agreesWithFinal = rawAlgoPred === match.finalPrediction;
                if (!agreesWithFinal) {
                    catPromote = false;
                } else if ((rawAlgoPred === '1X' || rawAlgoPred === 'X2' || rawAlgoPred === '1' || rawAlgoPred === '2') && rawAlgoPred === subPatPred) {
                    catPromote = true;
                }
            }

            if (cat === 'bankers_jackpot') {
                const hasSevereUpset = tags.some(t => t.startsWith('upsets:PR10') || t.startsWith('upsets:PR11') || t.startsWith('upsets:PR12') || t.startsWith('upsets:PR13'));
                if (hasSevereUpset) {
                    catPromote = false;
                }
            }

            if (cat === 'upsets') {
                const moUnderdog = stats.moFav === '1' ? '2' : '1';
                const algoIncludesUnderdog = rawAlgoPred?.includes(moUnderdog);
                const finalIncludesUnderdog = match.finalPrediction?.includes(moUnderdog);
                const isNot12Hedge = match.finalPrediction !== '12';
                const hasUpsetPAA = matchedPriority && ['PR10', 'PR11', 'PR12', 'PR13'].includes(matchedPriority);

                if ((hasUpsetPAA && algoIncludesUnderdog && finalIncludesUnderdog && isNot12Hedge) || (stats.underdogOdds <= 3.0 && stats.underdogOdds > 0)) {
                    catPromote = true;
                }
            }

            // [RULE BATCH 32] Underdog Threat Promotion for Value Bets & Banker Draws
            const isUnderdogThreatRel = stats.underdogOdds <= 3.0 && stats.underdogOdds > 0;
            if (isUnderdogThreatRel) {
                const isVBUnderdog = cat === 'value_bets' && ['PR2', 'PR4', 'PR6'].includes(matchedPriority || '');
                const isBDUnderdog = cat === 'banker_draws' && (
                    (matchedPriority === 'PR1' && stats.paaStats.upsetRate >= 30) ||
                    ['PR2', 'PR4'].includes(matchedPriority || '')
                );
                
                if (isVBUnderdog || isBDUnderdog) {
                    catPromote = true;
                }
            }

            // STALEMATE Detection (Bankers Jackpot + Upsets)
            const hasBankerTag = tags.some(t => t.startsWith('bankers_jackpot:'));
            const hasUpsetTag = tags.some(t => t.startsWith('upsets:'));
            if (hasBankerTag && hasUpsetTag) {
                tags.push('stalemate:DRAW_RISK');
            }

            // Post Match Audit Overrides logic setup
            const abbrMapStats: Record<string, string> = {
                'top12': 'T12', 'top10': 'T12', 'bankers_dlive': 'BDL', 'top20': 'T20', 
                'bankers': 'BNK', 'bankers_jackpot': 'BNK',
                'value_bets': 'VB', 'value_picks': 'VP', 
                'banker_draws': 'BD', 'upsets': 'UPS', 'uncategorized': 'UNC'
            };
            const abbrStats = abbrMapStats[cat];
            const starKeyStats = `${abbrStats}-${matchedPriority}-G${group}`;
            const fallbackStarKeyStats = `${abbrStats}-${matchedPriority}-G3`;
            let loopStars = abbrStats ? matchStars[starKeyStats] : undefined;
            if (loopStars === undefined && abbrStats) loopStars = matchStars[fallbackStarKeyStats];
            
            const isFiveStars = loopStars !== undefined && loopStars === 5;
            const isLowStars = loopStars !== undefined && loopStars < 3;

            let finalAction: 'PROMOTE' | 'DEMOTE' | 'NONE' = 'NONE';

            if (((pRule1 || pRule2 || pRule3) && !isUpsetOrValueBet) || catPromote) {
                finalAction = 'PROMOTE';
            }

            // GLOBAL DEMOTE Rules
            // 1. Algo predicts 12
            const dRule1 = rawAlgoPred === '12';
            // 2. Sub pattern prediction is 12
            const dRule2 = subPatPred === '12';
            // 3. Sub pat predicts 1X/X2 but algo predicts opposite (1X/X2), this doesnt include Algo predicting 12,X,1 or 2.
            const dRule3 = ((subPatPred === '1X' && rawAlgoPred === 'X2') || (subPatPred === 'X2' && rawAlgoPred === '1X'));
            
            const isTargetCat = ['best_bet', 'top12', 'top10', 'bankers_dlive', 'top20', 'bankers_jackpot', 'value_picks'].includes(cat);

            // 4. Underdog odds <= 3.0 (Volatility Rule)
            const dRule4 = isTargetCat ? stats.underdogOdds <= 3.0 : stats.underdogOdds <= 2.8;
            // 5. PHA Underdog vs Draw Support (Top 12, Next Best, Top 20, Bankers, Value Picks)
            const dRule5 = isTargetCat && Math.abs(stats.phaUnderdogSupport - stats.phaDrawSupport) <= 2;
            // 6. Sample Size Rule (All categories)
            const dRule6 = stats.totalMatches <= 5;
            
            // Category Specific DEMOTE
            let catDemote = false;
            
            // New User Rule: Deprioritize matches where underdog odds <= 3.0 for target slips
            // This is now handled by dRule4 but we keep it explicit for clarity if needed
            if (isTargetSlip && stats.underdogOdds <= 3.0 && stats.underdogOdds > 0) {
                catDemote = true;
            }

            // New User Rule: High Favorite Odds (>= 2.4 to <= 2.5) are LAST RESORT for Top 12, Bankers Jackpot, and Value Picks
            if (['top12', 'top10', 'bankers_jackpot', 'value_picks'].includes(cat) && stats.favOdds >= 2.4 && stats.favOdds <= 2.5) {
                catDemote = true;
                tags.push(`${cat}:HIGH_ODDS_RISK`);
                if (cat === 'top12') tags.push(`top10:HIGH_ODDS_RISK`);
            }

            if (cat === 'banker_draws' && subPatPred === '12') catDemote = true;

            if (finalAction !== 'PROMOTE') {
                if ((((dRule1 || dRule2 || dRule3 || dRule4 || dRule5) && !isUpsetOrValueBet) || dRule6 || catDemote)) {
                    finalAction = 'DEMOTE';
                } else if (cat === 'bankers_jackpot') {
                    const hasSevereUpset = tags.some(t => t.startsWith('upsets:PR10') || t.startsWith('upsets:PR11') || t.startsWith('upsets:PR12') || t.startsWith('upsets:PR13'));
                    if (hasSevereUpset) {
                        finalAction = 'DEMOTE';
                    }
                } else if (['top12', 'top10', 'top20'].includes(cat)) {
                    // ... (existing code for Top 12/20 demote)
                    const reasonStr = (match.algoReport?.reason || '') + (match.qualityAudit?.reason || '');
                    const hasCriticalDrawRisk = reasonStr.includes('Critical Draw Risk') || reasonStr.includes('High PHA Draw');
                    const drawCeilingCap = stats.phaDrawSupport > 30;
                    const hasBannedTie = tags.includes('PHA_TIE');
                    const isUnhedged = !stats.isHedged;

                    let shouldDemote = false;
                    if (cat === 'top12' || cat === 'top10') {
                        shouldDemote = stats.underdogOdds <= 3.0;
                    } else {
                        shouldDemote = isUnhedged && (hasCriticalDrawRisk || drawCeilingCap);
                    }

                    if (shouldDemote) {
                        finalAction = 'DEMOTE';
                    }
                }
            }

            // Removed BANNED:UPSET_RISK demotion enforcement to allow them if they meet seer criteria

            // Apply Post Match Audit Overrides for Tags
            if (finalAction === 'PROMOTE' && isLowStars) {
                finalAction = 'DEMOTE';
            } else if (finalAction === 'DEMOTE' && isFiveStars) {
                finalAction = 'PROMOTE';
            }

            if (finalAction === 'PROMOTE') {
                tags.push(`${cat}:PROMOTE`);
                if (cat === 'top12') tags.push(`top10:PROMOTE`);
            } else if (finalAction === 'DEMOTE') {
                if (cat === 'top20' && stats.isHedged) {
                    // Specific escape: hedged top 20 does not get demoted
                } else {
                    tags.push(`${cat}:DEMOTE`);
                    if (cat === 'top12') tags.push(`top10:DEMOTE`);
                }
            }
            
            // Last Resort Check for Market Favorite Odds > 2.40 or PAA Upset >= 30% or Underdog Threat
            if (['best_bet', 'top12', 'top10', 'top20', 'bankers_jackpot', 'value_picks', 'bankers_dlive', 'botb_best'].includes(cat)) {
                const isUnderdogThreat = stats.underdogOdds <= 3.0 && stats.underdogOdds > 0;
                if (stats.favOdds > 2.40 || stats.paaStats.upsetRate >= 30 || isUnderdogThreat) {
                    if (!tags.includes(`${cat}:LAST_RESORT`)) {
                        tags.push(`${cat}:LAST_RESORT`);
                        if (cat === 'top12') tags.push(`top10:LAST_RESORT`);
                    }
                }
            }

            // Last Resort Check for Algo=12 & SubPat=1X/X2
            if (['best_bet', 'bankers_dlive', 'bankers_jackpot', 'value_picks', 'botb_best', 'top20'].includes(cat)) {
                const isApplicable = cat !== 'botb_best' || !stats.isHedged;
                if (isApplicable) {
                    const has12Conflict = rawAlgoPred === '12' && (subPatPred === '1X' || subPatPred === 'X2');
                    
                    if (has12Conflict) {
                        if (!tags.includes(`${cat}:LAST_RESORT`)) {
                            tags.push(`${cat}:LAST_RESORT`);
                        }
                    }
                }
            }
        }
    }

    // [PROTOCOL: PHA_TIE Enforcement - Last Resort]
    // If Underdog PHA and Draw PHA are close, it's a high risk tie or upset.
    // Exclude Bankers, Value bets and Upsets from this ban.
    if (Math.abs(stats.phaUnderdogCount - stats.phaDrawCount) <= 1) {
        const isElite = tags.some(t => 
            t.startsWith('bankers_jackpot:') || 
            t.startsWith('bankers_dlive:') || 
            t.startsWith('value_bets:') || 
            t.startsWith('value_picks:') || 
            t.startsWith('upsets:')
        );

        if (!isElite) {
            tags.push('PHA_TIE');
        } else {
            tags.push('VOLATILE:PHA_TIE');
        }
    }

    return tags;
};

/**
 * Calculates a comprehensive priority score for a match in a specific category.
 * Score = BasePriority + PriorityStars + PromoteStars - DemotePenalty
 */
export const getMatchPriorityScore = (match: Match, category: string, matchStars: Record<string, number>): number => {
    const tags = match.evaluatorTags || [];
    const catTags = tags.filter(t => t.startsWith(category + ':'));
    if (catTags.length === 0) return -1000;

    const abbrMap: Record<string, string> = {
        'top12': 'T12', 'top10': 'T12', 'bankers_dlive': 'BDL', 'top20': 'T20', 
        'bankers': 'BNK', 'bankers_jackpot': 'BNK',
        'value_bets': 'VB', 'value_picks': 'VP', 
        'banker_draws': 'BD', 'upsets': 'UPS'
    };
    const abbr = abbrMap[category];
    const group = match.group || 3;

    let score = 0;
    let basePriorityScore = 0;
    let priorityStars = 0;
    let promoteStars = 0;
    let isDemoted = false;

    // 1. Base Priority Score (PR1=100, PR2=90, ...)
    const prTag = catTags.find(t => t.includes(':PR'));
    if (prTag) {
        const prNum = parseInt(prTag.split(':PR')[1]);
        if (!isNaN(prNum)) {
            basePriorityScore = 110 - (prNum * 10);
            
            // Get Stars for this Priority
            if (abbr) {
                const key = `${abbr}-PR${prNum}-G${group}`;
                const fallbackKey = `${abbr}-PR${prNum}-G3`;
                priorityStars = (matchStars[key] ?? matchStars[fallbackKey] ?? 0) * 10;
            }
        }
    }

    // 2. Promote Stars
    if (catTags.some(t => t.endsWith(':PROMOTE'))) {
        if (abbr) {
            const key = `${abbr}-PROMOTE-G${group}`;
            const fallbackKey = `${abbr}-PROMOTE-G3`;
            promoteStars = (matchStars[key] ?? matchStars[fallbackKey] ?? 0) * 10;
        }
        // Base bonus for being promoted
        score += 20;
    }

    // 3. Demote Penalty
    if (catTags.some(t => t.endsWith(':DEMOTE'))) {
        isDemoted = true;
        score -= 200; // Increased penalty map it well below baseline
    }

    // 4. Last Resort Penalty
    if (catTags.some(t => t.endsWith(':LAST_RESORT')) || tags.some(t => t.endsWith(':LAST_RESORT'))) {
        score -= 1000; // Severe penalty, guarantee they rank at bottom unless nothing else exists
    }

    // 4b. Volatile PHA Tie Penalty (discourage non-upset selection)
    if (tags.includes('VOLATILE:PHA_TIE') && category !== 'upsets') {
        score -= 100; // Small penalty to favor cleaner matches
    }

    // 5. Banned Penalty
    if (tags.some(t => t.startsWith('BANNED:'))) {
        if (tags.includes('PHA_TIE')) {
             // PHA_TIE is no longer a hard ban, but we keep a heavy penalty to favor cleaner matches
             score -= 1000; 
        }
        
        const hasDrawRisk = tags.includes('BANNED:DRAW_RISK');
        const hasUpsetRisk = tags.includes('BANNED:UPSET_RISK');

        // Draw and Upset risk are now eligible as long as they meet seer slip selection criteria
        // No explicit priority penalty applied here.
    }

    return basePriorityScore + priorityStars + promoteStars + score;
};
