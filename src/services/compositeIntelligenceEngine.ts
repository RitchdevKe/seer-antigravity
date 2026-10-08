/**
 * SEER Intelligence — Composite Two-Algo Engine
 * 
 * BASE ALGO: Uses Algo prediction (82.3% DC overall, 97.9% on fav wins)
 *            Enhanced by Sub Pattern agreement (83% when they agree)
 * 
 * EDGE CASES ALGO: Per-match intelligence hedging that examines match card data
 *                  and pivots the hedge (or primary if compelling) when edge signals fire.
 * 
 * Data source: Verified against 12,221 Analysis Board matches.
 */
import { Match } from '../types';
import { extractMLFeatures, getMLVariations, MLFeatures, generateSITags } from '../utils/mlFeatureExtractor';
import { predictWithHybridML } from '../utils/hybridMachineLearning';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CompositeTier = 'BASE' | 'EDGE_SINGLE' | 'EDGE_COMPELLING';

export interface EdgeTrigger {
  id: string;
  name: string;
  description: string;
  /** The raw data that caused this trigger to fire */
  evidence: string;
  /** What this trigger suggests: 'DRAW' or 'UNDERDOG' */
  suggestsOutcome: 'DRAW' | 'UNDERDOG';
}

export interface CompositeDecision {
  /** Which tier of the engine made this decision */
  tier: CompositeTier;
  /** Edge triggers that fired (empty for BASE tier) */
  triggers: EdgeTrigger[];
  /** The final DC prediction (e.g. "1X", "X2", "12") — used for scoring */
  dcPrediction: string;
  /** Primary prediction (e.g. "PRIM 1", "PRIM 2", "PRIM X") — for display */
  primaryPrediction: string;
  /** Hedge (e.g. "FIN 1X", "FIN X2", "FIN 12") — for display */
  hedge: string;
  /** Confidence: 0-100 */
  confidence: number;
  /** Human-readable explanation bullets */
  explanation: string[];
  /** The lean direction: 'Fav' | 'Underdog' | 'Draw' */
  lean: 'Fav' | 'Underdog' | 'Draw';
  /** Whether Algo and Sub Pattern agreed */
  algoSubAgree: boolean;
  /** The raw predictions used */
  rawPredictions: {
    algo: string;
    subPattern: string;
    seer: string;
  };
  /** Vision Algo Tags */
  siTags: string[];
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/** Get Algo's DC prediction from a match */
function getAlgoPrediction(m: Match): string {
  return (m as any).algoReport?.prediction || (m as any).calculatedPrediction || '1';
}

/** Get Sub Pattern's DC prediction from a match */
function getSubPatternPrediction(m: Match): string {
  return (m as any).finalPrediction || (m as any).rawPrediction || '1';
}

/** Get stored SEER prediction */
function getSeerPrediction(m: Match): string {
  return (m as any).seerPrediction || '';
}

/** Get PAA prediction */
function getPaaPrediction(m: Match): string {
  return (m as any).paaPrediction || (m as any).calculatedPrediction || '';
}

/** Determine fav result from odds (same logic as MatchAnalysis.tsx) */
function getFavUndFromOdds(m: Match): { favResult: string; undResult: string } | null {
  const oddsStr = (m as any).mo || (m as any).odds || '';
  const parts = oddsStr.split(/[- ,|]+/).map((p: string) => parseFloat(p.trim())).filter((p: number) => !isNaN(p));
  if (parts.length >= 3) {
    const o1 = parts[0];
    const o2 = parts[2];
    if (o1 !== o2) {
      return {
        favResult: o1 < o2 ? '1' : '2',
        undResult: o1 < o2 ? '2' : '1'
      };
    }
  }
  return null;
}

/** Check if a prediction covers a specific result (DC matching) */
function predictionCovers(pred: string, result: string): boolean {
  if (!pred || !result) return false;
  const clean = pred.trim().toUpperCase();
  const r = result.toUpperCase();
  if (clean === r) return true;
  if (clean === '1X' && (r === '1' || r === 'X')) return true;
  if (clean === 'X2' && (r === 'X' || r === '2')) return true;
  if (clean === '12' && (r === '1' || r === '2')) return true;
  return false;
}

/** Check if a prediction leans toward a specific side */
function predictionLeans(pred: string, favResult: string, undResult: string): 'fav' | 'und' | 'draw' | 'both' | 'unknown' {
  const clean = pred.trim();
  
  // Pure result
  if (clean === favResult) return 'fav';
  if (clean === undResult) return 'und';
  if (clean === 'X' || clean === 'x') return 'draw';
  
  // DC predictions
  const includesFav = clean.includes(favResult);
  const includesUnd = clean.includes(undResult);
  const includesX = clean.toLowerCase().includes('x');
  
  if (includesFav && includesX && !includesUnd) return 'fav'; // e.g. 1X when fav=1
  if (includesUnd && includesX && !includesFav) return 'und'; // e.g. X2 when fav=1
  if (includesFav && includesUnd && !includesX) return 'both'; // 12
  
  return 'unknown';
}

// ─── Edge Case Detection ─────────────────────────────────────────────────────

function detectEdgeTriggers(m: Match, features: MLFeatures, favResult: string, undResult: string): EdgeTrigger[] {
  const triggers: EdgeTrigger[] = [];
  const variations = getMLVariations(m, features);
  
  // ── Trigger 1: SEER Draw Dominant ──────────────────────────────────────────
  // When SEER's draw probability is higher than both fav AND underdog.
  // Data: n=1,028, Draw=41.5%, Fav=34.7%, Und=23.7%
  if (features.study6_seer) {
    const { fav, draw, underdog } = features.study6_seer;
    if (draw > fav && draw > underdog) {
      triggers.push({
        id: 'seer_draw_dominant',
        name: 'SEER Draw Dominant',
        description: 'SEER predicts draw has highest probability — Draw occurs 41.5% in this scenario',
        evidence: `SEER: Fav=${fav}%, Draw=${draw}%, Und=${underdog}%`,
        suggestsOutcome: 'DRAW'
      });
    }
  }
  
  // ── Trigger 2: Algo Probability Says Underdog > Fav ────────────────────────
  // When Algo's own probability says underdog is more likely than favorite.
  // Data: n=1,537, Fav=35.3%, Draw=28.7%, Und=36.0%
  if (features.study5_algo) {
    const { fav, underdog } = features.study5_algo;
    if (underdog > fav) {
      triggers.push({
        id: 'algo_prob_underdog',
        name: 'Algo Probability Underdog',
        description: 'Algo probability computation shows underdog more likely than favorite',
        evidence: `Algo probs: Fav=${fav}%, Und=${underdog}%`,
        suggestsOutcome: 'UNDERDOG'
      });
    }
  }
  
  // ── Trigger 3: Sub Pattern Leans Underdog ──────────────────────────────────
  // When Sub Pattern's prediction leans toward the underdog.
  // Data: n=1,344, Fav=37.7%, Draw=33.9%, Und=28.4%
  const subPred = getSubPatternPrediction(m);
  const subLean = predictionLeans(subPred, favResult, undResult);
  if (subLean === 'und') {
    triggers.push({
      id: 'sub_pattern_underdog',
      name: 'Sub Pattern Underdog',
      description: 'Sub Pattern prediction leans underdog — Draw is also elevated to 33.9%',
      evidence: `Sub Pattern: ${subPred} (leans ${undResult})`,
      suggestsOutcome: 'UNDERDOG'
    });
  }
  
  // ── Trigger 4: TS + Points Both Favor Underdog (supporting signal) ─────────
  // Data: n=3,004, Fav=46.4%, Draw=27.0%, Und=26.5%
  // This alone is not compelling enough — it strengthens other triggers
  const tsVar = variations['TS'] || '';
  const ptsVar = variations['Points'] || '';
  const tsUnd = tsVar.startsWith('Und');
  const ptsUnd = ptsVar.startsWith('Und');
  if (tsUnd && ptsUnd) {
    triggers.push({
      id: 'ts_pts_underdog',
      name: 'TS + Points Underdog',
      description: 'Both Team Strength and Points metrics favor the underdog',
      evidence: `TS: ${tsVar}, Points: ${ptsVar}`,
      suggestsOutcome: 'UNDERDOG'
    });
  }
  
  return triggers;
}

// ─── Intelligence Hedging ────────────────────────────────────────────────────

/**
 * Given edge triggers and match context, decide how to adjust the hedge/primary.
 * This is the "intelligence" — it examines each match individually.
 */
function applyIntelligenceHedging(
  algoDefault: string,
  subPred: string,
  seerPred: string,
  paaPred: string,
  triggers: EdgeTrigger[],
  features: MLFeatures,
  favResult: string,
  undResult: string,
  algoSubAgree: boolean,
  match: Match
): { dcPrediction: string; lean: 'Fav' | 'Underdog' | 'Draw'; explanation: string[] } {
  const explanation: string[] = [];
  
  if (triggers.length === 0) {
    // BASE ENGINE — no edge triggers
    if (algoSubAgree) {
      explanation.push('Algo and Sub Pattern agree → HIGH CONFIDENCE (83% DC)');
      return { dcPrediction: algoDefault, lean: determineLean(algoDefault, favResult, undResult), explanation };
    } else {
      // ── DISAGREEMENT TIE-BREAKER ─────────────────────────────────────────────
      // Algo and Sub Pattern disagree. Use objective match data to decide.
      // Key insight: variations give us what PHA, SEER, Algo probability lean toward.
      const variations = getMLVariations(match, features);
      const subLean = predictionLeans(subPred, favResult, undResult);
      
      // Count how many secondary predictors agree with Sub Pattern's lean
      let subBackers = 0;
      let subBackerNames: string[] = [];
      
      if (variations['SEER'] === 'Underdog' && subLean === 'und') { subBackers++; subBackerNames.push('SEER'); }
      if (variations['SEER'] === 'Draw' && subLean === 'draw') { subBackers++; subBackerNames.push('SEER'); }
      if (variations['SEER'] === 'Fav' && subLean === 'fav') { subBackers++; subBackerNames.push('SEER'); }
      
      if (variations['PHA'] === 'Underdog' && subLean === 'und') { subBackers++; subBackerNames.push('PHA'); }
      if (variations['PHA'] === 'Draw' && subLean === 'draw') { subBackers++; subBackerNames.push('PHA'); }
      if (variations['PHA'] === 'Fav' && subLean === 'fav') { subBackers++; subBackerNames.push('PHA'); }
      
      if (variations['Algo'] === 'Underdog' && subLean === 'und') { subBackers++; subBackerNames.push('Algo%'); }
      if (variations['Algo'] === 'Draw' && subLean === 'draw') { subBackers++; subBackerNames.push('Algo%'); }
      
      // TS + Points as the 4th signal
      const tsVar = variations['TS'] || '';
      const ptsVar = variations['Points'] || '';
      if (subLean === 'und' && (tsVar.startsWith('Und') || ptsVar.startsWith('Und'))) { 
        subBackers++; 
        subBackerNames.push('TS/Pts'); 
      }

      if (subBackers >= 2) {
        explanation.push(`🔄 DISAGREEMENT OVERRIDE: Sub Pattern backed by ${subBackerNames.join(', ')}`);
        explanation.push(`Pivoting from Algo (${algoDefault}) → Sub Pattern (${subPred})`);
        return { dcPrediction: subPred, lean: determineLean(subPred, favResult, undResult), explanation };
      }
      
      explanation.push('Algo prediction used as default (82.3% DC overall)');
      explanation.push(`Sub Pattern disagreed but only ${subBackers}/4 secondaries back it (need 2)`);
      return { dcPrediction: algoDefault, lean: determineLean(algoDefault, favResult, undResult), explanation };
    }
  }
  
  // Count what the triggers suggest
  const drawTriggers = triggers.filter(t => t.suggestsOutcome === 'DRAW');
  const undTriggers = triggers.filter(t => t.suggestsOutcome === 'UNDERDOG');
  
  // Determine the edge direction
  const algoLean = predictionLeans(algoDefault, favResult, undResult);
  const isAlgoFavLeaning = algoLean === 'fav' || algoLean === 'both';
  
  if (triggers.length === 1) {
    // ── SINGLE TRIGGER: Keep primary, pivot hedge ────────────────────────────
    explanation.push(`⚠️ Edge signal detected: ${triggers[0].name}`);
    explanation.push(`Evidence: ${triggers[0].evidence}`);
    
    if (drawTriggers.length === 1) {
      // Draw trigger fired — pivot hedge to cover draw
      explanation.push('Action: Keeping primary, pivoting hedge to cover Draw');
      
      if (algoDefault === '12') {
        // 12 misses draws entirely — pivot to fav+draw
        const newPred = favResult === '1' ? '1X' : 'X2';
        explanation.push(`Hedge pivoted from 12 → ${newPred} (draw protection)`);
        return { dcPrediction: newPred, lean: 'Fav', explanation };
      }
      // Already covering draw with 1X/X2 — keep as-is
      explanation.push(`Current hedge already covers Draw (${algoDefault})`);
      return { dcPrediction: algoDefault, lean: 'Fav', explanation };
      
    } else if (undTriggers.length === 1) {
      // Underdog trigger fired — check which one and respond proportionally
      const trigger = undTriggers[0];
      
      if (trigger.id === 'ts_pts_underdog') {
        // TS+Points alone is supporting — not strong enough to pivot
        explanation.push('TS+Points underdog is a supporting signal only — keeping Algo prediction');
        return { dcPrediction: algoDefault, lean: determineLean(algoDefault, favResult, undResult), explanation };
      }
      
      if (trigger.id === 'algo_prob_underdog') {
        // Algo's own probability says underdog — pivot hedge to cover underdog
        explanation.push('Algo probability computation shows underdog — pivoting hedge');
        if (algoDefault === '1X' && favResult === '1') {
          return { dcPrediction: '12', lean: 'Fav', explanation };
        }
        if (algoDefault === 'X2' && favResult === '2') {
          return { dcPrediction: '12', lean: 'Fav', explanation };
        }
        // If already 12, check if underdog is very strong
        if (features.study5_algo && features.study5_algo.underdog > 45) {
          const undPred = undResult === '2' ? 'X2' : '1X';
          explanation.push(`Algo underdog probability > 45% — pivoting to cover underdog side: ${undPred}`);
          return { dcPrediction: undPred, lean: 'Underdog', explanation };
        }
        return { dcPrediction: algoDefault, lean: 'Fav', explanation };
      }
      
      if (trigger.id === 'sub_pattern_underdog') {
        explanation.push('Sub Pattern leans underdog — checking for SEER/PHA confirmation for upset');
        
        const variations = getMLVariations(match, features);
        let upsetBackers = 0;
        
        // Check if SEER probabilities lean underdog
        if (variations['SEER'] === 'Underdog') upsetBackers++;
        // Check if PHA leans underdog  
        if (variations['PHA'] === 'Underdog') upsetBackers++;
        // Check if Algo's own probability shows underdog is competitive
        if (features.study5_algo && features.study5_algo.underdog >= 35) upsetBackers++;
        
        if (upsetBackers >= 2) {
          const upsetPred = undResult === '2' ? 'X2' : '1X';
          explanation.push(`Upset confirmed by ${upsetBackers} sources (SEER/PHA/Algo%). Pivoting to: ${upsetPred}`);
          return { dcPrediction: upsetPred, lean: 'Underdog', explanation };
        }
        
        // If no strong confirmation, just protect the draw
        explanation.push('Unconfirmed upset — applying draw protection only');
        if (algoDefault === '12') {
          const drawSidePred = favResult === '1' ? '1X' : 'X2';
          explanation.push(`Pivoting hedge from 12 → ${drawSidePred} (draw protection)`);
          return { dcPrediction: drawSidePred, lean: 'Fav', explanation };
        }
        return { dcPrediction: algoDefault, lean: 'Fav', explanation };
      }
    }
    
    // Fallback for single trigger
    return { dcPrediction: algoDefault, lean: 'Fav', explanation };
  }
  
  // ── 2+ TRIGGERS: COMPELLING — be smart about pivoting ────────────────────────
  // Key insight from data: Algo at 82.3% DC is hard to beat.
  // We should mostly adjust the HEDGE direction, not the primary.
  // Only pivot the primary when the evidence is overwhelming.
  explanation.push(`🔴 COMPELLING: ${triggers.length} edge signals detected`);
  triggers.forEach(t => explanation.push(`  → ${t.name}: ${t.evidence}`));
  
  const hasDrawTrigger = drawTriggers.length > 0;
  const hasUndTrigger = undTriggers.length > 0;
  const hasAlgoUndTrigger = undTriggers.some(t => t.id === 'algo_prob_underdog');
  const hasSubUndTrigger = undTriggers.some(t => t.id === 'sub_pattern_underdog');
  const hasTsPtsUndTrigger = undTriggers.some(t => t.id === 'ts_pts_underdog');
  // Count STRONG triggers (excluding ts_pts which is supporting-only)
  const strongTriggerCount = triggers.filter(t => t.id !== 'ts_pts_underdog').length;
  
  // Special case: SEER draw dominant + ANY underdog trigger
  // Both draw and underdog signals = fav is unreliable, hedge to cover draw side
  if (hasDrawTrigger && hasUndTrigger) {
    const seerDraw = features.study6_seer?.draw || 0;
    // Keep fav primary, but pivot hedge to cover draw (the dominant risk)
    if (algoDefault === '12') {
      const drawPred = favResult === '1' ? '1X' : 'X2';
      explanation.push(`Draw + Underdog signals: Fav unreliable, pivoting hedge from 12 → ${drawPred}`);
      return { dcPrediction: drawPred, lean: 'Fav', explanation };
    }
    // Already covering draw (1X/X2) — keep as is, draw protection is in place
    explanation.push('Draw + Underdog signals detected, but hedge already covers draw');
    return { dcPrediction: algoDefault, lean: 'Fav', explanation };
  }
  
  // Multiple underdog triggers (no draw trigger)
  if (undTriggers.length >= 2) {
    // If both Algo prob AND Sub Pattern say underdog (strong+strong) — pivot hedge
    if (hasAlgoUndTrigger && hasSubUndTrigger) {
      // Algo's own probability says underdog AND Sub Pattern confirms
      // Still keep fav primary but hedge to cover underdog side
      if (algoDefault === '1X' && favResult === '1') {
        explanation.push('Algo prob + Sub Pattern both say underdog — pivoting hedge to cover underdog');
        return { dcPrediction: '12', lean: 'Fav', explanation };
      }
      if (algoDefault === 'X2' && favResult === '2') {
        explanation.push('Algo prob + Sub Pattern both say underdog — pivoting hedge to cover underdog');
        return { dcPrediction: '12', lean: 'Fav', explanation };
      }
      // Algo already says 12 — covers both sides, keep it
      explanation.push('Both Algo prob and Sub Pattern lean underdog, hedge already covers both');
      return { dcPrediction: algoDefault, lean: 'Fav', explanation };
    }
    
    // One strong trigger + supporting TS+Pts — pivot hedge conservatively
    if ((hasAlgoUndTrigger || hasSubUndTrigger) && hasTsPtsUndTrigger) {
      if (algoDefault === '1X' && favResult === '1') {
        explanation.push('Strong underdog signal + TS/Points — pivoting hedge 1X → 12');
        return { dcPrediction: '12', lean: 'Fav', explanation };
      }
      if (algoDefault === 'X2' && favResult === '2') {
        explanation.push('Strong underdog signal + TS/Points — pivoting hedge X2 → 12');
        return { dcPrediction: '12', lean: 'Fav', explanation };
      }
    }
    
    // Just TS+Pts + another weaker signal — keep Algo
    explanation.push('Multiple underdog signals but none strong enough to override Algo');
    return { dcPrediction: algoDefault, lean: 'Fav', explanation };
  }
  
  // Multiple draw triggers (rare)
  if (drawTriggers.length >= 2) {
    if (algoDefault === '12') {
      const drawPred = favResult === '1' ? '1X' : 'X2';
      explanation.push(`Multiple draw signals — pivoting hedge from 12 → ${drawPred}`);
      return { dcPrediction: drawPred, lean: 'Fav', explanation };
    }
    return { dcPrediction: algoDefault, lean: 'Fav', explanation };
  }
  
  // Fallback for 2+ triggers with unclear direction — trust Algo
  explanation.push('Mixed signals — keeping Algo default');
  return { dcPrediction: algoDefault, lean: determineLean(algoDefault, favResult, undResult), explanation };
}

/** Determine the lean direction from a DC prediction */
function determineLean(pred: string, favResult: string, undResult: string): 'Fav' | 'Underdog' | 'Draw' {
  const lean = predictionLeans(pred, favResult, undResult);
  if (lean === 'und') return 'Underdog';
  if (lean === 'draw') return 'Draw';
  return 'Fav';
}

/** Convert a DC prediction + lean into PRIM/FIN display format */
function toDisplayFormat(dcPrediction: string, lean: 'Fav' | 'Underdog' | 'Draw', favResult: string, undResult: string): { primary: string; hedge: string } {
  // Primary is the lean direction
  let primary: string;
  if (lean === 'Fav') primary = `PRIM ${favResult}`;
  else if (lean === 'Underdog') primary = `PRIM ${undResult}`;
  else primary = 'PRIM X';
  
  // Hedge is the DC prediction
  const hedge = `FIN ${dcPrediction}`;
  
  return { primary, hedge };
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Run the Composite Two-Algo Engine on a match.
 * 
 * Returns the composite decision including tier, triggers, prediction, and explanation.
 * This is the entry point that seerIntelligenceEngine.ts will call.
 */
export function getCompositeDecision(match: Match, globalMlData?: any): CompositeDecision | null {
  const features = extractMLFeatures(match);
  if (!features) return null;
  
  const favUnd = getFavUndFromOdds(match);
  if (!favUnd) {
    // Can't determine fav/underdog from odds — use features
    const isHomeFav = features.favIndex === 0;
    var favResult = isHomeFav ? '1' : '2';
    var undResult = isHomeFav ? '2' : '1';
  } else {
    var favResult = favUnd.favResult;
    var undResult = favUnd.undResult;
  }
  
  // Get predictions from each predictor
  const algoPred = getAlgoPrediction(match);
  const subPred = getSubPatternPrediction(match);
  const seerPred = getSeerPrediction(match);
  const paaPred = getPaaPrediction(match);
  
  const triggers: any[] = [];
  
  // Check agreement
  const algoSubAgree = algoPred === subPred;
  
  // Run the Vision Algo (Pattern Extractor)
  const siTags = generateSITags(features);
  
  // Run the Hybrid Machine Learning Engine (Pivoting based on Tags)
  const mlDecision = predictWithHybridML(match, globalMlData);

  // If the ML Engine found a highly volatile / compelling pivot, let it override
  if (mlDecision.mlApplied && mlDecision.mlPrediction) {
    const mlLean = determineLean(mlDecision.mlPrediction, favResult, undResult);
    const display = toDisplayFormat(mlDecision.mlPrediction, mlLean, favResult, undResult);
    
    // Merge explanation
    const fullExplanation = [
      '🤖 DATA-DRIVEN ML PIVOT TRIGGERED',
      mlDecision.mlReasoning,
      ...(mlDecision.matrixStats?.exactCombo ? 
         [`Exact Combo Match: ${mlDecision.matrixStats.exactCombo.total} historical matches`] : 
         ['Used Sub-pattern Probability Averaging'])
    ];

    return {
      tier: 'EDGE_COMPELLING',
      triggers: triggers,
      dcPrediction: mlDecision.mlPrediction,
      primaryPrediction: display.primary,
      hedge: display.hedge,
      confidence: mlDecision.mlConfidence || 75,
      explanation: fullExplanation,
      lean: mlLean,
      algoSubAgree,
      rawPredictions: {
        algo: algoPred,
        subPattern: subPred,
        seer: seerPred
      },
      siTags
    };
  }

  // Apply intelligence hedging (per-match decision) for standard Edge Cases
  const { dcPrediction, lean, explanation } = applyIntelligenceHedging(
    algoPred, subPred, seerPred, paaPred, triggers, features, favResult, undResult, algoSubAgree, match
  );
  
  // Determine tier
  let tier: CompositeTier;
  if (triggers.length === 0) {
    tier = 'BASE';
  } else if (triggers.length === 1) {
    tier = 'EDGE_SINGLE';
  } else {
    tier = 'EDGE_COMPELLING';
  }
  
  // Calculate confidence
  let confidence: number;
  if (tier === 'BASE') {
    confidence = algoSubAgree ? 83 : 80;
  } else if (tier === 'EDGE_SINGLE') {
    confidence = 70;
  } else {
    confidence = 65;
  }
  
  // Convert to display format
  const display = toDisplayFormat(dcPrediction, lean, favResult, undResult);
  
  return {
    tier,
    triggers,
    dcPrediction,
    primaryPrediction: display.primary,
    hedge: display.hedge,
    confidence,
    explanation,
    lean,
    algoSubAgree,
    rawPredictions: {
      algo: algoPred,
      subPattern: subPred,
      seer: seerPred
    },
    siTags
  };
}
