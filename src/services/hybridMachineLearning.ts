import { Match } from '../types';
import { extractMLFeatures, generateSITags, MLFeatures } from '../utils/mlFeatureExtractor';

export interface MLDecision {
  tags: string[];
  suggestedPrimary: string | null;
  suggestedHedge: string | null;
  lean: 'Fav' | 'Underdog' | 'Draw' | null;
  confidence: number;
  explanation: string[];
}

/**
 * HYBRID MACHINE LEARNING ENGINE
 * Evaluates combinations of granular SI Variant tags to pivot matches.
 */
export function evaluateSITags(match: Match, features: MLFeatures, tags: string[], favResult: string, undResult: string): MLDecision {
  const explanation: string[] = [];
  let suggestedPrimary: string | null = null;
  let suggestedHedge: string | null = null;
  let lean: 'Fav' | 'Underdog' | 'Draw' | null = null;
  
  explanation.push(`🔍 Vision Algo extracted tags: ${tags.join(', ')}`);

  // Example combination 1: Volatile Upset Potential
  // SIm1 (All predictors agree DC) + SIr1 (Draw Odds < 3.0) + SIt1 (Und Goal Diff > 0)
  if (tags.includes('SIm1') && tags.includes('SIr1') && tags.includes('SIt1')) {
    explanation.push('⚠️ High Volatility Pattern detected (SIm1 + SIr1 + SIt1): Predictors agree, but draw odds are low and underdog is secretly strong.');
    explanation.push('Action: Pivoting towards Underdog / Hedge 12');
    suggestedPrimary = undResult;
    suggestedHedge = '12';
    lean = 'Underdog';
    return { tags, suggestedPrimary, suggestedHedge, lean, confidence: 85, explanation };
  }

  // Example combination 2: Draw Pivot
  // SIf5 (SEER Draw >= 35%) + SIk1 (Max Draw % > 40%) + SIc2 (Sub pattern leans draw)
  if (tags.includes('SIf5') && tags.includes('SIk1') && tags.includes('SIc2')) {
    explanation.push('🎯 Strong Draw Pattern detected (SIf5 + SIk1 + SIc2): SEER, Max %, and Sub Pattern all strongly indicate draw.');
    explanation.push('Action: Pivoting hedge to cover Draw');
    suggestedPrimary = 'X';
    suggestedHedge = favResult === '1' ? '1X' : 'X2';
    lean = 'Draw';
    return { tags, suggestedPrimary, suggestedHedge, lean, confidence: 82, explanation };
  }

  // Example combination 3: Extreme Underdog Pivot
  // SIc3 (Sub pattern Und lean) + SIb4 (All PHA < 40%) + SIh1 (Hidden strength)
  if (tags.includes('SIc3') && tags.includes('SIb4') && tags.includes('SIh1')) {
    explanation.push('🚨 Upset Protocol Triggered (SIc3 + SIb4 + SIh1): High volatility + Sub Pattern Und + Hidden Strength.');
    explanation.push('Action: Pivoting hedge to cover Underdog');
    suggestedPrimary = undResult;
    suggestedHedge = undResult === '2' ? 'X2' : '1X';
    lean = 'Underdog';
    return { tags, suggestedPrimary, suggestedHedge, lean, confidence: 78, explanation };
  }

  // Example combination 4: Pure Underdog Strength
  // SIb10 (PHA Und >= 50%) or SIe10 (Algo Und >= 50%) or SIf10 (SEER Und >= 50%)
  if (tags.includes('SIb10') || tags.includes('SIe10') || tags.includes('SIf10')) {
    explanation.push('💪 Pure Underdog Strength detected: A primary model assigns >= 50% to the underdog.');
    explanation.push('Action: Protecting underdog side aggressively.');
    suggestedPrimary = undResult;
    suggestedHedge = undResult === '2' ? 'X2' : '1X';
    lean = 'Underdog';
    return { tags, suggestedPrimary, suggestedHedge, lean, confidence: 80, explanation };
  }

  return { tags, suggestedPrimary, suggestedHedge, lean, confidence: 0, explanation };
}
