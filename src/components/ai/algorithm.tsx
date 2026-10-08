
import { Match, SelectionQuality } from '../../types';
import { getActualResult, matchesPrediction, enforceAlgoPredictionRules } from '../../utils/matchProcessing';
import { predictDaily } from './Dlivealgorithm';
import { predictJackpot } from './JKalgorithm';
import { applyAIFilters } from './Aifilters';

export interface PredictionDetail {
  team: string;
  prediction: string; // 1, X, 2, 1X, X2, 12
  primaryPrediction?: string;
  confidence: string; // "95%"
  rawConfidence: number;
  reason: string;
  odds: string;
  outcome?: "Correct" | "Incorrect" | "Pending";
  isUnshakable?: boolean; // New Flag: If true, AI should strictly adhere or hedge only
  activeFilters?: string[]; // Added for AI Filters Automation
  isTripleConsensus?: boolean; // Added for Triple Consensus overlap detection
}

export interface AlgorithmReport {
  bankers: PredictionDetail[];
  value_bets: PredictionDetail[];
  upsets: PredictionDetail[];
  top_10: PredictionDetail[];
  botb_best: PredictionDetail[];
  jackpot_predictions: PredictionDetail[];
  high_confidence: PredictionDetail[];
}

export interface OptimizationStats {
    totalProcessed: number;
    accuracyOverall: string;
    bankerAccuracy: string; // Confidence > 75
    falseBankers: { team: string, pred: string, actual: string, conf: number, subPattern?: string }[]; // High confidence failures
    missedUpsets: { team: string, pred: string, actual: string, odds: string, subPattern?: string }[]; // Low odds failures we missed
    accuracyByPattern: Record<string, string>;
    accuracyBySubPattern: Record<string, string>; // New granular stats
    accuracyByGroup: Record<string, string>; // Group 1, 2, 3 analysis
}

export class Algorithm {
  public patternStats = new Map<string, { 
    total: number; 
    paaTotal?: number;
    outcomes: { '1': number; 'X': number; '2': number };
    paa: { favWin: number; draw: number; upsetWin: number };
  }>();
  public isTrained = false;
  
  // Weights determine how much we trust a signal
  // UPDATED BASED ON STRATEGY ROOM ADJUSTMENTS: External Source Deprioritization (Zero Weight)
  public weights = {
    exactMatch: 0.0,   
    subPattern: 5.0,   
    mainPattern: 0.0,  
    flags: 0.0,        
    odds: 5.0,         
    external: 0.0,     
    points: 0.0,
    subPatternPrediction: 0.0        
  };

  /**
   * Learns from historical data by populating statistical maps.
   */
  train(history: Match[]) {
    this.patternStats.clear();
    
    history.forEach(m => {
      const result = getActualResult(m.result);
      if (result === 'pending') return;
      
      // 1. Main Pattern Stats
      this.recordStat(`M:${m.patternAnalysis?.mainPattern || 'NA'}`, result, m);
      
      // 2. Sub Pattern Stats
      this.recordStat(`S:${m.patternAnalysis?.subPattern || 'NA'}`, result, m);
      
      // 3. Flags Stats (Individual)
      m.patternAnalysis?.activeFlags.forEach(f => {
          this.recordStat(`F:${f}`, result, m);
      });

      // 4. Exact Scenario (Pattern + Sorted Flags)
      if (m.patternAnalysis?.activeFlags) {
        const flagKey = `EX:${m.patternAnalysis.mainPattern}|${m.patternAnalysis.activeFlags.sort().join('+')}`;
        this.recordStat(flagKey, result, m);
      }
    });

    this.isTrained = true;
  }

  async trainChunked(history: Match[], batchSize = 250, shouldCancel?: () => boolean) {
    this.patternStats.clear();
    this.isTrained = false;

    for (let start = 0; start < history.length; start += batchSize) {
      if (shouldCancel?.()) return;

      const end = Math.min(start + batchSize, history.length);
      for (let i = start; i < end; i++) {
        const m = history[i];
        const result = getActualResult(m.result);
        if (result === 'pending') continue;

        this.recordStat(`M:${m.patternAnalysis?.mainPattern || 'NA'}`, result, m);
        this.recordStat(`S:${m.patternAnalysis?.subPattern || 'NA'}`, result, m);
        m.patternAnalysis?.activeFlags.forEach(f => {
          this.recordStat(`F:${f}`, result, m);
        });

        if (m.patternAnalysis?.activeFlags) {
          const flagKey = `EX:${m.patternAnalysis.mainPattern}|${[...m.patternAnalysis.activeFlags].sort().join('+')}`;
          this.recordStat(flagKey, result, m);
        }
      }

      await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    }

    if (!shouldCancel?.()) {
      this.isTrained = true;
    }
  }

  reset() {
    this.patternStats.clear();
    this.isTrained = false;
  }

  private recordStat(key: string, result: string, match: Match) {
    if (!this.patternStats.has(key)) {
      this.patternStats.set(key, { 
        total: 0, 
        paaTotal: 0,
        outcomes: { '1': 0, 'X': 0, '2': 0 },
        paa: { favWin: 0, draw: 0, upsetWin: 0 }
      });
    }
    const stats = this.patternStats.get(key)!;
    stats.total++;
    if (stats.paaTotal === undefined) stats.paaTotal = 0;
    
    // PHA Logic
    if (result === '1' || result === 'X' || result === '2') {
      stats.outcomes[result]++;
    }

    // PAA Logic
    let moFav = '';
    let moUnderdog = '';
    if (match.mo) {
      const parts = String(match.mo).split(/[,\s:\/\-]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
      if (parts.length >= 3) {
        const o1 = parts[0];
        const o2 = parts[2];
        moFav = o1 < o2 ? '1' : '2';
        moUnderdog = o1 < o2 ? '2' : '1';
      }
    }

    if (moFav && moUnderdog) {
      stats.paaTotal++;
      if (result === moFav) stats.paa.favWin++;
      else if (result === 'X') stats.paa.draw++;
      else if (result === moUnderdog) stats.paa.upsetWin++;
    }
  }

  // Public accessor for Self Learning Engine
  public getRawPatternStats(key: string) {
      return this.patternStats.get(key);
  }

  public getProbabilities(key: string, minSample = 0): { '1': number; 'X': number; '2': number; total: number; paaTotal?: number; favWin: number; draw: number; upsetWin: number } | null {
    const stats = this.patternStats.get(key);
    if (!stats || stats.total < minSample) return null;
    return {
      '1': stats.outcomes['1'] / stats.total,
      'X': stats.outcomes['X'] / stats.total,
      '2': stats.outcomes['2'] / stats.total,
      total: stats.total,
      paaTotal: stats.paaTotal ?? stats.total,
      favWin: stats.paa.favWin,
      draw: stats.paa.draw,
      upsetWin: stats.paa.upsetWin
    };
  }

  // Convert a 1X2 string into probabilities for weighting
  public getProbsFromPrediction(pred: string | undefined): { '1': number; 'X': number; '2': number } {
      const p = pred ? pred.trim() : '';
      if (p === '1') return { '1': 0.85, 'X': 0.10, '2': 0.05 };
      if (p === '2') return { '1': 0.05, 'X': 0.10, '2': 0.85 };
      if (p === 'X') return { '1': 0.2, 'X': 0.6, '2': 0.2 };
      if (p === '1X') return { '1': 0.55, 'X': 0.35, '2': 0.1 };
      if (p === 'X2') return { '1': 0.1, 'X': 0.35, '2': 0.55 };
      if (p === '12') return { '1': 0.48, 'X': 0.04, '2': 0.48 };
      return { '1': 0.33, 'X': 0.33, '2': 0.33 };
  }

  /**
   * Helper to calculate the historical win rate of a specific prediction for a sub-pattern.
   */
  public getPatternWinRate(subPattern: string | null, patternPrediction: string | null): number {
      if (!subPattern || !patternPrediction) return 0;
      const key = `S:${subPattern}`;
      const stats = this.patternStats.get(key);
      if (!stats || stats.total < 3) return 0;
      
      let wins = 0;
      const p = patternPrediction;
      // Calculate how many outcomes match the prediction logic
      if (p.includes('1')) wins += stats.outcomes['1'];
      if (p.includes('X')) wins += stats.outcomes['X'];
      if (p.includes('2')) wins += stats.outcomes['2'];
      
      // Note: This approximation works because 1X sums 1 and X, etc.
      // For '12', it sums 1 and 2.
      
      return (wins / stats.total) * 100;
  }

  /**
   * Public helper to get a distribution string for a pattern key.
   */
  public getPatternReliability(subPattern: string | null): string {
      if (!subPattern) return "No Data";
      const key = `S:${subPattern}`;
      const stats = this.patternStats.get(key);
      if (!stats || stats.total < 3) return "Low Data";
      const t = stats.total;
      const p1 = Math.round((stats.outcomes['1']/t)*100);
      const pX = Math.round((stats.outcomes['X']/t)*100);
      const p2 = Math.round((stats.outcomes['2']/t)*100);
      return `1:${p1}% X:${pX}% 2:${p2}% (N=${t})`;
  }

  /**
   * IMPLEMENTING USER'S 7-STEP FILTER ALGORITHM
   * This logic is strictly for Selection Filtering, separate from raw prediction.
   */
  public evaluateMatchQuality(match: Match): SelectionQuality {
      let score = 100;
      const reasons: string[] = [];
      let isQualified = true;
      let phaLean = 'Clean';
      let forceHedge = false;

      // Parse Odds
      const moParts = String(match.mo || '').split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      const o1 = moParts[0] || 0;
      const oX = moParts[1] || 0;
      const o2 = moParts[2] || 0;
      
      // Determine Market Favorite
      const minOdds = Math.min(o1, oX, o2);
      let moPred = '';
      if (moParts.length >= 3) {
          if (minOdds === o1) moPred = '1';
          else if (minOdds === o2) moPred = '2';
          else moPred = 'X';
      }

      // New Flag for Value Protocols: If Odds >= 2.0, certain checks are relaxed (Legacy)
      const isHighOdds = !isNaN(minOdds) && minOdds >= 2.0;

      // --- CHECK 0: PROHIBITED ODDS (< 1.35) ---
      // Rule 1: Matches with odds below 1.35 are prohibited from Top 10, top 20, etc.
      // UPDATED: Strict enforcement per Banker Optimization Strategy
      if (!isNaN(minOdds) && minOdds < 1.35) {
          return {
              score: 0,
              isQualified: false,
              reason: "Odds < 1.35 (Prohibited)",
              recommendedType: 'Avoid',
              phaLean: 'None'
          };
      }

      // --- CHECK: HIGH VOLATILITY EXCLUSION ---
      if (!isNaN(o1) && !isNaN(o2) && o1 >= 2.50 && o2 >= 2.50) {
          // This match is too volatile for Top 10 or Banker lists
          score -= 25;
          reasons.push("Volatile (Both > 2.50)");
          // Force Hedge if not avoided
          forceHedge = true;
      }

      // --- CHECK PHA AUTHORITY (SELF LEARN PROTOCOL) ---
      // IF PHA > 60% for a single outcome, it overrides Points Divergence checks.
      const subP = match.patternAnalysis?.subPattern;
      const phaStats = subP ? this.patternStats.get(`S:${subP}`) : null;
      let hasPhaAuthority = false;
      if (phaStats && phaStats.total >= 3) {
          const p1 = phaStats.outcomes['1'] / phaStats.total;
          const p2 = phaStats.outcomes['2'] / phaStats.total;
          if (p1 > 0.60 || p2 > 0.60) hasPhaAuthority = true;
      }

      // [PROTOCOL: PHA DIVERGENCE RISK]
      // IF PHA disagrees with MO, REMOVE 'Banker' status and FLAG as High Risk.
      if (moPred && phaStats && phaStats.total >= 3) {
          const p1 = phaStats.outcomes['1'] / phaStats.total;
          const pX = phaStats.outcomes['X'] / phaStats.total;
          const p2 = phaStats.outcomes['2'] / phaStats.total;
          let phaFav = '';
          if (p1 > pX && p1 > p2) phaFav = '1';
          else if (p2 > p1 && p2 > pX) phaFav = '2';
          
          // Check if PHA Fav contradicts Market Fav
          if (phaFav && phaFav !== moPred && phaFav !== 'X') {
              isQualified = false; // Disqualify from Banker/High Quality lists
              reasons.push("PHA Divergence Risk (Fav Mismatch)");
              score -= 40;
          }
      }

      // --- CHECK 1: Points must be supported by Market Odds ---
      // If Points pred (calculatedPrediction) and MO pred completely disagree (e.g. 1 vs 2), disqualify.
      // EXCEPTION: If PHA Authority is present, ignore this check.
      const pointsPred = match.calculatedPrediction || '';
      // Helper to check contradiction (1 vs 2)
      const isContradiction = (p1: string, p2: string) => {
          if ((p1 === '1' || p1.includes('1')) && (p2 === '2' || p2.includes('2'))) return true;
          if ((p1 === '2' || p1.includes('2')) && (p2 === '1' || p2.includes('1'))) return true;
          return false;
      };

      // [PROTOCOL: HIGH ODDS ALGO SUPREMACY]
      if (isHighOdds) {
          // Rule: Points System Neutralization
          // We do NOT check points.

          // Rule: PHA High-Threshold Fallacy
          // We do NOT check PHA support threshold (though we might use PHA direction in predict).

          // Rule: Algo-Exclusive Green Light / Mandatory Hedge
          // If we are evaluating the Market Favorite (moPred), we need Algo to agree.
          const algoPred = match.patternAnalysis?.subPatternPrediction;
          if (algoPred && moPred && !matchesPrediction(algoPred, moPred)) {
               // Mandatory Hedge / Disqualification for 'Single Win' lists
               // If Algo disagrees with Market Fav, it's a BAD bet on the Fav.
               // However, it might be a good UPSET bet. But for "Standard Quality", it fails.
               isQualified = false;
               reasons.push("Algo Disagreement (High Odds)");
               score -= 100;
          }
      } else {
          // Standard Check for Low Odds
          if (!hasPhaAuthority && pointsPred && moPred && isContradiction(pointsPred, moPred)) {
              // [PROTOCOL: ALGO PREDICTION PRIMACY]
              // If Algo explicitly predicts Upset, it overrides conflicting raw point projections.
              const algoPred = match.patternAnalysis?.subPatternPrediction;
              const isAlgoUpset = algoPred && moPred && !matchesPrediction(algoPred, moPred);
              
              if (!isAlgoUpset) {
                  isQualified = false;
                  reasons.push("Points vs Market Disagreement");
                  score -= 50;
              }
          }
      }

      // --- CHECK 2: PHA Existence ---
      if (!phaStats || phaStats.total < 3) {
          isQualified = false;
          reasons.push("No PHA / Low Data");
          score -= 40;
          phaLean = 'None';
      } else {
          // --- CHECK 3: PHA Lean (Split?) ---
          const total = phaStats.total;
          const pX = phaStats.outcomes['X'] / total;
          
          // "if its split between the favorite and draw, then the match has a high probability of draw"
          // We define "Split" if Draw % > 30%
          if (pX > 0.30) {
              phaLean = 'Split';
              score -= 20;
              reasons.push("PHA Split (High Draw Risk)");
              // Note: If we are betting Straight, this is a disqualifier. 
              // If we are hedging, it might be acceptable but downgraded.
          }

          // [PROTOCOL: CRITICAL PHA DRAW THRESHOLD]
          // IF Match_Odds < 2.0 AND PHA_Draw > 30% THEN Remove_From_Bankers
          if (!isNaN(minOdds) && minOdds < 2.0 && pX > 0.30) {
              isQualified = false;
              reasons.push("Critical Draw Risk (>30%)");
              score -= 30; // Serious penalty for Banker candidates
          }
      }

      // --- CHECK 4: Check TS Support ---
      // If picking 1, need TSA > TSB. If picking 2, need TSB > TSA.
      // We check against the Market Favorite (moPred) since that's usually the 'Pick' in this context.
      // EXCEPTION: High Odds Value Protocol - TS Irrelevance
      const tsa = match.tsa || 0;
      const tsb = match.tsb || 0;
      
      const algoPred = match.patternAnalysis?.subPatternPrediction;
      const isUpsetCandidate = algoPred && moPred && !matchesPrediction(algoPred, moPred);
      
      // [PROTOCOL: JACKPOT TS EXCLUSION]
      // IF Jackpot, TS is irrelevant. Skip this check.
      if (!match.isJackpot && !isHighOdds && !isUpsetCandidate) {
          // [PROTOCOL: TS OVERRIDE (Self Learn)]
          // Allow 'TS Opposes Favorite' matches to qualify if Market Fav Odds < 1.50.
          if (moPred === '1' && tsb > tsa && minOdds >= 1.50) {
              score -= 30;
              isQualified = false; // Strict TS requirement for lower odds
              reasons.push("TS Opposes Favorite");
          } else if (moPred === '2' && tsa > tsb && minOdds >= 1.50) {
              score -= 30;
              isQualified = false;
              reasons.push("TS Opposes Favorite");
          }
      }

      // --- CHECK 5: Check Flags ---
      const flags = match.patternAnalysis?.activeFlags || [];
      if (flags.includes('POTENTIAL_DRAW')) {
          score -= 15;
          reasons.push("Potential Draw Flag");
      }

      // --- CHECK 6: Sub Pattern (Last Checkpoint) ---
      // If SubPattern prediction is explicit 'Upset' or 'MO' (dynamic), treat as lower confidence
      const subPred = match.patternAnalysis?.subPatternPrediction;
      if (subPred === 'MO' || subPred === 'Upset' || subPred === 'PTS') {
          score -= 10;
      }

      // --- CHECK 7: Hedge vs Straight (Recommendation) ---
      // Rule 2: Matches with odds between 1.35 to 1.99 cannot be hedged.
      // Rule 3: Matches with odds above 2.0 should be hedged.
      
      let recommendedType: 'Single' | 'Hedge' | 'Avoid' = 'Avoid';
      
      if (isQualified && score >= 50) {
          if (minOdds >= 1.35 && minOdds <= 1.99) {
              recommendedType = forceHedge ? 'Hedge' : 'Single';
          } else if (minOdds >= 2.0) {
              // DEFAULT is Hedge, BUT allow Single for Value Pick Candidates
              let isValuePickCandidate = false;
              if (minOdds <= 2.60 && phaStats && phaStats.total >= 3) {
                  const p1 = phaStats.outcomes['1'] / phaStats.total;
                  const p2 = phaStats.outcomes['2'] / phaStats.total;
                  // If Market Fav has >= 45% PHA support and Algo agrees, it's a Value Pick candidate (Single)
                  const algoAgree = match.patternAnalysis?.subPatternPrediction && matchesPrediction(match.patternAnalysis.subPatternPrediction, moPred);
                  if (((moPred === '1' && p1 >= 0.45) || (moPred === '2' && p2 >= 0.45)) && algoAgree) {
                      isValuePickCandidate = true;
                  }
              }

              if (isValuePickCandidate && !forceHedge) {
                  recommendedType = 'Single'; 
              } else {
                  recommendedType = 'Hedge';
              }
          } else {
              // Should be caught by Check 0, but safe fallback
              recommendedType = 'Avoid';
          }
      } else {
          recommendedType = 'Avoid';
      }

      // --- CHECK 8 (SELF LEARN UPDATE): Value Bet Gatekeepers ---
      // [PROTOCOL: MANDATORY PHA SUPPORT GATEKEEPER]
      // IF Odds > 1.80 AND PHA_Support <= 50% THEN Immediately Discard Prediction
      // EXCEPTION: High Odds Algo-Exclusive Green Light bypasses this (Protocol 2).
      // But here we are in generic quality check.
      // UPDATE: Skipped for High Odds as per Value Bet Strategy Decoupling
      if (!isHighOdds && minOdds > 1.80 && phaStats && phaStats.total >= 3) {
          const support = phaStats.outcomes[moPred as '1'|'2'] / phaStats.total;
          if (support <= 0.50) {
              isQualified = false;
              reasons.push("Value Trap: Low PHA Support");
              score -= 60;
          }
      }

      // [PROTOCOL: CONFLICT RESOLUTION PROTOCOL (Value Bet Identification)]
      // IF Odds > 2.60 AND PHA_Prediction == TRUE -> Label as 'Value Bet' (Retain Qualified)
      // IF Odds < 2.50 AND PHA Disagrees with Market -> Discard (Disqualify)
      if (moPred && phaStats && phaStats.total >= 3) {
          const p1 = phaStats.outcomes['1'] / phaStats.total;
          const p2 = phaStats.outcomes['2'] / phaStats.total;
          const pX = phaStats.outcomes['X'] / phaStats.total;
          const maxP = Math.max(p1, pX, p2);
          
          let phaPred = '';
          if (maxP === p1) phaPred = '1';
          else if (maxP === p2) phaPred = '2';
          else phaPred = 'X';

          // Check if PHA disagrees with Market Fav
          if (phaPred !== moPred && phaPred !== 'X') {
               const minO = Math.min(o1, o2);
               if (minO > 2.60) {
                   // This is a Value Bet Candidate (Upset Potential)
                   // Keep isQualified TRUE, maybe boost score for 'Value' list
                   reasons.push("High Value Conflict (>2.60)");
               } else if (minO < 2.50) {
                   // Discard due to Conflict Resolution Protocol
                   isQualified = false;
                   reasons.push("Conflict Resolution: Discard (<2.50)");
                   score -= 100;
               }
          }
      }

      // [PROTOCOL: POINTS DISAGREEMENT SAFETY]
      // IF Odds < 1.70 AND Points_Disagree_With_Market = TRUE THEN Remove 'Banker' Status (Disqualify)
      // EXCEPTION: PHA Authority overrides this.
      // EXCEPTION: Algo Primacy (Upset) overrides this.
      const isAlgoUpsetOverride = algoPred && moPred && !matchesPrediction(algoPred, moPred);
      if (!isAlgoUpsetOverride && !hasPhaAuthority && minOdds < 1.70 && pointsPred && !matchesPrediction(pointsPred, moPred)) {
          isQualified = false;
          reasons.push("Points Disagree with Fav (<1.70)");
          score -= 40;
      }

      // --- PROTOCOL 9: CONFLICT ZONE AVOIDANCE (New Self Learn) ---
      // "IF Points_System_Prediction != Market_Odds_Favorite AND SubPattern_Prediction == 'None' THEN Abort Bet"
      if (pointsPred && moPred && pointsPred !== moPred) {
          const hasSubPattern = subP && subP !== 'NA' && subP !== 'None';
          if (!hasSubPattern) {
              isQualified = false;
              reasons.push("Conflict Zone (No SubPattern)");
              score -= 100;
          }
      }

      // --- PROTOCOL 10: POINTS VALIDATION REQUIREMENT (New Self Learn) ---
      // "Points should never be used as a standalone signal."
      // If Points suggests a pick that contradicts MO, and SubPattern doesn't explicitly back Points, distrust it.
      // Exception: PHA Authority OR High Odds (Decoupling Protocol)
      if (!isHighOdds && !hasPhaAuthority && pointsPred && pointsPred !== moPred) {
          const subPred = match.patternAnalysis?.subPatternPrediction;
          if (subPred && !matchesPrediction(subPred, pointsPred)) {
              isQualified = false;
              reasons.push("Points Unverified");
              score -= 30;
          }
      }

      // --- PROTOCOL 11: LOW POINTS VOLATILITY (User Request) ---
      if ((match.maxPoints || 0) < 45) {
          score -= 20;
          reasons.push("Low Points (Volatile)");
          // Force Hedge if qualified
          if (recommendedType === 'Single') recommendedType = 'Hedge';
      }

      // --- PROTOCOL 12: GROUP 2 VOLATILITY CONTAINMENT (New) ---
      // Downgrade all 'Banker' candidates falling into Group 2 if TS Diff < 1.5
      if (!match.isJackpot && match.group === 2 && Math.abs((match.tsa || 0) - (match.tsb || 0)) < 1.5) {
          score -= 15; // Penalty to likely drop out of Banker threshold (usually high score required)
          reasons.push("Group 2 Volatility (TS Diff < 1.5)");
          // Mandatory Hedge override
          recommendedType = 'Hedge'; 
      }

      // [PROTOCOL: NEXT BEST OPTIMIZATION (AWAY FILTER)]
      // REMOVED: 'Volatile Away Fav (>1.80)' exclusion filter per Self Learning Update.

      // [PROTOCOL: GROUP 3 EFFICIENCY CULL]
      // IF Group == 3 AND Confidence (proxy via PHA/Odds) > high AND Odds < 1.70 THEN Promote
      if (match.group === 3 && !isNaN(minOdds) && minOdds < 1.70) {
          // Check internal stability
          if (phaStats && phaStats.total >= 3) {
              score += 15; // Boost into BOTB potential
          }
      }

      // --- PROTOCOL: YOUTH LEAGUE EXCLUSION (New) ---
      const isYouthLeague = /\b(U21|U23|Res|Reserve|Youth)\b/i.test(match.teams);
      if (isYouthLeague) {
          score -= 30;
          reasons.push("Youth League Variance");
          if (recommendedType !== 'Avoid') recommendedType = 'Hedge';
      }

      // Final strict filter for qualification
      if (score < 50) isQualified = false;

      return {
          score: Math.max(0, score),
          isQualified,
          reason: reasons.join(' | ') || "Clean Profile",
          recommendedType,
          phaLean
      };
  }

  /**
   * Static helper to apply dynamic protocols that override static sub-pattern rules.
   * This is used in processMatch (before AI Analysis).
   */
  public static applyPatternOverrides(match: Match, subPatternId: string, basePrediction: string): string {
      return basePrediction;
  }

  /**
   * Returns a confidence rating (0-5 stars) and color based on Sub-Pattern reliability.
   */
  public static getPatternConfidence(subPatternId: string): { stars: number, color: string } {
      if (['G2ff42', 'G3q3', 'G2ff38', 'G2p10', 'G2ff_fav_h', 'G2ff_fav_a'].includes(subPatternId)) {
          return { stars: 5, color: 'text-amber-500' }; 
      }
      if (['G2ff43', 'G2m14', 'G1g14', 'G1r1_new', 'G1ff_2'].includes(subPatternId)) {
          return { stars: 4.5, color: 'text-emerald-500' }; 
      }
      if (['G1t2', 'G2i13', 'G2q1', 'G3m1', 'G2o7', 'G3t_x'].includes(subPatternId)) {
          return { stars: 4, color: 'text-blue-500' }; 
      }
      if (['G2ee15', 'G2ee9', 'G2ff39', 'G2e5', 'G2ee11', 'G2j11', 'G2o11', 'G1o12', 'G2y1', 'G1a6'].includes(subPatternId)) {
          return { stars: 1.5, color: 'text-orange-500' }; 
      }
      return { stars: 3, color: 'text-gray-400' };
  }

  /**
   * Final validation pass to ensure independence and protocol adherence.
   */
  private validatePrediction(match: Match, result: any): any {
      const updated = { ...result };
      const subP = match.patternAnalysis?.subPattern;
      const stats = subP ? this.getRawPatternStats(`S:${subP}`) : null;

      // [PROTOCOL: INDEPENDENCE CHECK]
      // Ensure we are not blindly following market odds if internal signals are weak.
      const moParts = String(match.mo || '').split(/[- ,]+/).map(s => parseFloat(s.trim())).filter(s => !isNaN(s));
      const o1 = moParts[0];
      const o2 = moParts[2];

      if (!isNaN(o1) && !isNaN(o2)) {
          const marketFav = o1 < o2 ? '1' : '2';
          const marketFavOdds = Math.min(o1, o2);

          // If Market Odds < 1.50 (Strong Fav) but PHA Support < 40%
          if (updated.prediction === marketFav && marketFavOdds < 1.50 && stats && stats.total >= 3) {
              const support = stats.outcomes[marketFav as '1'|'2'] / stats.total;
              if (support < 0.40) {
                  updated.reason = `[INDEPENDENCE CHECK] Weak Internal Support (${Math.round(support * 100)}%) for Fav. Downgraded. | ` + updated.reason;
                  updated.category = 'Standard'; // Downgrade from Banker
                  updated.rawConfidence = Math.min(updated.rawConfidence, 60);
                  updated.isUnshakable = false;
              }
          }
      }

      // [PROTOCOL: EXHAUSTIVE PROTOCOL CHECK]
      // Ensure "Conflict Zone" matches are handled correctly.
      if (updated.prediction !== match.calculatedPrediction && !updated.reason.includes("Conflict")) {
          // Check if reason mentions any protocol override
          const hasProtocolOverride = updated.reason.includes("Protocol") || updated.reason.includes("Override") || updated.reason.includes("Hedge") || updated.reason.includes("Trap") || updated.reason.includes("Risk");
          if (!hasProtocolOverride) {
               // If no explicit protocol override, but disagrees with Points, flag it as verified divergence
               updated.reason = `[PROTOCOL CHECK] Points Disagreement Verified. | ` + updated.reason;
          }
      }

      return updated;
  }

  /**
   * Generates a prediction for a single match based on learned stats.
   * Delegates to specialized engines based on match type.
   */
  predict(match: Match): PredictionDetail & { probabilities: { '1': number; 'X': number; '2': number }, category: string, activeFilters: string[], qualityAudit: SelectionQuality } {
    let result: PredictionDetail & { probabilities: { '1': number; 'X': number; '2': number }, category: string, activeFilters?: string[], qualityAudit?: SelectionQuality };
    
    if (match.isJackpot) {
        result = predictJackpot(match, this);
    } else {
        result = predictDaily(match, this);
    }

    // --- AUTOMATED FILTER LABELING ---
    const phaStats = this.getRawPatternStats(`S:${match.patternAnalysis?.subPattern}`);
    const filters = applyAIFilters(match, result.probabilities, phaStats);
    result.activeFilters = filters;

    // --- TRIPLE CONSENSUS DETECTION ---
    const pointsPred = match.calculatedPrediction || match.finalPrediction || '';
    const paaPred = match.patternAnalysis?.subPatternPrediction || '';
    const basePred = result.prediction;
    const hasConsensus = pointsPred !== '' && paaPred !== '' && [...basePred].some(char => pointsPred.includes(char) && paaPred.includes(char));
    result.isTripleConsensus = hasConsensus;

    // --- FINAL INDEPENDENCE & PROTOCOL VALIDATION ---
    result = this.validatePrediction(match, result);

    // --- QUALITY AUDIT (Pre-calculated for AI) ---
    const qualityAudit = this.evaluateMatchQuality(match);

    // --- ENFORCE STRUCTURAL ALGO PREDICTION RULES ---
    const enforced = enforceAlgoPredictionRules(
      result.primaryPrediction || result.prediction,
      result.prediction,
      result.probabilities
    );
    result.primaryPrediction = enforced.primaryPrediction;
    result.prediction = enforced.finalPrediction;

    return {
      ...result,
      qualityAudit
    } as any;
  }

  generateReport(matches: Match[]): AlgorithmReport {
      const predictions = matches.map(m => this.predict(m));
      
      const bankers = predictions.filter(p => p.category === 'Banker');
      const value = predictions.filter(p => p.category === 'Value');
      const upsets = predictions.filter(p => p.category === 'Upset');
      
      const sorted = [...predictions].sort((a, b) => b.rawConfidence - a.rawConfidence);
      
      // [PROTOCOL: TOP 20 RECOVERY PROTOCOL]
      // IF Category == 'BOTB' AND PHA_Score < 65% THEN Downgrade to 'General List'
      const botb_best = sorted.slice(10, 20).filter(p => p.rawConfidence >= 65);

      return {
          bankers,
          value_bets: value,
          upsets,
          top_10: sorted.slice(0, 10),
          botb_best,
          jackpot_predictions: predictions, 
          high_confidence: predictions.filter(p => p.rawConfidence >= 75)
      };
  }

  getOptimizationData(matches: Match[]): OptimizationStats {
      const predictions = matches.map(m => ({ ...this.predict(m), actual: getActualResult(m.result), match: m }));
      const completed = predictions.filter(p => p.actual !== 'pending');
      const total = completed.length;
      
      const correct = completed.filter(p => matchesPrediction(p.prediction, p.actual)).length;
      
      const bankers = completed.filter(p => p.rawConfidence >= 75);
      const bankersCorrect = bankers.filter(p => matchesPrediction(p.prediction, p.actual)).length;
      
      const falseBankers = bankers.filter(p => !matchesPrediction(p.prediction, p.actual)).map(p => ({
          team: p.team,
          pred: p.prediction,
          actual: p.actual,
          conf: p.rawConfidence,
          subPattern: p.match.patternAnalysis?.subPattern || undefined
      }));

      const missedUpsets: any[] = [];
      completed.forEach(p => {
          const moParts = String(p.match.mo || '').split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
          const homeOdds = moParts[0];
          const awayOdds = moParts[2];
          const minOdds = Math.min(homeOdds, awayOdds);
          
          if (!isNaN(minOdds) && minOdds < 1.50 && !matchesPrediction(p.prediction, p.actual)) {
               missedUpsets.push({
                   team: p.team,
                   pred: p.prediction,
                   actual: p.actual,
                   odds: p.odds,
                   subPattern: p.match.patternAnalysis?.subPattern || undefined
               });
          }
      });

      const getAcc = (subset: typeof completed) => {
          if (subset.length === 0) return "N/A";
          const c = subset.filter(p => matchesPrediction(p.prediction, p.actual)).length;
          return `${Math.round((c/subset.length)*100)}% (${c}/${subset.length})`;
      };

      const accuracyByPattern: Record<string, string> = {};
      const patterns = [...new Set(completed.map(p => p.match.patternAnalysis?.mainPattern || 'NA'))];
      patterns.forEach(pat => {
          accuracyByPattern[pat] = getAcc(completed.filter(p => (p.match.patternAnalysis?.mainPattern || 'NA') === pat));
      });

      const accuracyBySubPattern: Record<string, string> = {};
      const subPatterns = [...new Set(completed.map(p => p.match.patternAnalysis?.subPattern || 'NA'))];
      subPatterns.forEach(pat => {
          accuracyBySubPattern[pat] = getAcc(completed.filter(p => (p.match.patternAnalysis?.subPattern || 'NA') === pat));
      });

      const accuracyByGroup: Record<string, string> = {};
      [1, 2, 3].forEach(g => {
          accuracyByGroup[`Group ${g}`] = getAcc(completed.filter(p => p.match.group === g));
      });

      return {
          totalProcessed: total,
          accuracyOverall: total > 0 ? `${Math.round((correct/total)*100)}%` : "0%",
          bankerAccuracy: bankers.length > 0 ? `${Math.round((bankersCorrect/bankers.length)*100)}%` : "N/A",
          falseBankers,
          missedUpsets,
          accuracyByPattern,
          accuracyBySubPattern,
          accuracyByGroup
      };
  }
}

export const matchAlgorithm = new Algorithm();