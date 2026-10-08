import { Match } from '../types';
import { extractMLFeatures, getMLVariations, MLFeatures } from '../utils/mlFeatureExtractor';
import { getCompositeDecision, CompositeDecision } from './compositeIntelligenceEngine';
import mlModelRaw from '../data/seer_intelligence_tree.json';

const mlTree = mlModelRaw as any[];

export interface IntelligenceReport {
  features: MLFeatures;
  historicalInsights: Array<{
    study: string;
    condition: string;
    favPct: number;
    drawPct: number;
    underdogPct: number;
    total: number;
  }>;
  overallFavProb: number;
  overallDrawProb: number;
  overallUndProb: number;
  siPatternMatch: string | null;
  siPatternAccuracy: number | null;
  siPatternLean: string | null;
  recommendedPrediction: string;
  recommendedHedge: string;
  decisionLogic?: string;
  /** Composite Two-Algo decision (BASE + EDGE CASES) */
  compositeDecision?: CompositeDecision | null;
}

export function getIntelligenceReport(match: Match): IntelligenceReport | null {
  const features = extractMLFeatures(match);
  if (!features) return null;

  const variations = getMLVariations(match, features);
  
  // Find the deepest matching path in the tree
  let bestPath: any[] = [];
  let bestLeaf: any = null;

  const traverse = (node: any, currentPath: any[], levelIndex: number) => {
    const isLeaf = !node.children || node.children.length === 0;
    if (isLeaf) {
      if (currentPath.length > bestPath.length) {
        bestPath = [...currentPath];
        bestLeaf = node;
      }
      return;
    }

    const nextVariationKeys = ['Points', 'TS', 'PHA', 'Algo', 'PAA', 'SEER', 'Agreement'];
    if (levelIndex >= nextVariationKeys.length) {
        if (currentPath.length > bestPath.length) {
            bestPath = [...currentPath];
            bestLeaf = node;
        }
        return;
    }

    const keyName = nextVariationKeys[levelIndex];
    const matchVarValue = variations[keyName] || 'Unknown';
    const expectedName = `${keyName}: ${matchVarValue}`;

    const matchingChild = node.children.find((c: any) => c.name === expectedName);
    if (matchingChild) {
      traverse(matchingChild, [...currentPath, { study: keyName, condition: expectedName, stats: matchingChild.stats }], levelIndex + 1);
    } else {
      if (currentPath.length > bestPath.length) {
        bestPath = [...currentPath];
        bestLeaf = node;
      }
    }
  };

  // Find the base data point that matches
  const baseDataPoints = [
    { name: 'Underdog Odds < Draw Odds', match: features.study1_underdogLessThanDraw },
    { name: 'Hidden Strength (Underdog GS=GA+-2)', match: features.study8_hiddenStrength },
    { name: 'PHA Volatility Tie (Draw=Und+-2)', match: features.study9_algoTie },
    { name: 'Hidden Weakness (Fav GS=GA+-2)', match: features.study10_hiddenWeakness },
    { name: 'Draw Odds < 3.0', match: features.study21_drawOddsBelow3 },
    { name: 'Match Category: Top 12', match: features.study18_category === 'Top 12' },
    { name: 'Match Category: Jackpot', match: features.study18_category === 'Jackpot' },
    { name: 'Match Group 1', match: features.study17_group === 1 },
    { name: 'Match Group 2', match: features.study17_group === 2 },
    { name: 'Match Group 3', match: features.study17_group === 3 },
    { name: 'Match Group 4', match: features.study17_group === 4 },
    { name: 'Extreme Volatility (All < 40%)', match: features.study16_allPercentagesBelow40 },
    { name: 'Fav Points Support', match: features.study13_pointsSupport === 'Fav' },
    { name: 'Underdog Points Support', match: features.study13_pointsSupport === 'Underdog' },
    { name: 'Equal Points Support', match: features.study13_pointsSupport === 'Equal' },
    { name: 'TS Fav > TS Underdog (Strength Diff > 5)', match: features.study7_tsFavVsUnderdog && features.study7_tsFavVsUnderdog > 5 },
    { name: 'TS Underdog > TS Fav', match: features.study7_tsFavVsUnderdog && features.study7_tsFavVsUnderdog < -2 },
    { name: 'Predictors Agree DC', match: features.study14_predictorsAgreeDC },
    { name: 'Predictors Agree Primary', match: features.study15_predictorsAgreePrim },
    { name: 'Max Draw Percentage > 33%', match: features.study12_maxDrawPercentage > 33 },
    { name: 'PHA Predicts Underdog', match: features.study2_pha && features.study2_pha.underdog > features.study2_pha.fav }
  ];

  for (const dp of baseDataPoints) {
    if (dp.match) {
      const treeNode = mlTree.find(t => t.name === dp.name);
      if (treeNode) {
        traverse(treeNode, [{ study: 'Base Pattern', condition: treeNode.name, stats: treeNode.stats }], 0);
      }
    }
  }

  const historicalInsights = bestPath.map(p => {
    const t = p.stats.total;
    return {
      study: p.study,
      condition: p.condition,
      favPct: t > 0 ? (p.stats.fav / t) * 100 : 0,
      drawPct: t > 0 ? (p.stats.draw / t) * 100 : 0,
      underdogPct: t > 0 ? (p.stats.und / t) * 100 : 0,
      total: t
    };
  });

  // Calculate Historical Lean
  let histFavProb = 33, histDrawProb = 33, histUndProb = 33;
  if (bestLeaf && bestLeaf.stats.total > 0) {
    histFavProb = (bestLeaf.stats.fav / bestLeaf.stats.total) * 100;
    histDrawProb = (bestLeaf.stats.draw / bestLeaf.stats.total) * 100;
    histUndProb = (bestLeaf.stats.und / bestLeaf.stats.total) * 100;
  }
  const histLean = Math.max(histFavProb, histDrawProb, histUndProb) === histFavProb ? 'Fav' : 
                   Math.max(histFavProb, histDrawProb, histUndProb) === histUndProb ? 'Underdog' : 'Draw';

  // ── Decision Logic ───────────────────────────────────────────────────────────
  // When the tree leaf has 20+ matches, trust it directly (SUPPORT).
  // Otherwise, run the variance scoring (PIVOT).

  const treeConfidence = bestLeaf ? Math.min(1, bestLeaf.stats.total / 200) : 0;
  let decisionLogic = treeConfidence >= 0.1 ? 'SUPPORT' : 'PIVOT'; // 20+ matches = SUPPORT

  let finalLean = histLean;
  let overallFavProb = histFavProb;
  let overallUndProb = histUndProb;
  let overallDrawProb = histDrawProb;

  if (decisionLogic === 'PIVOT') {
    // ── Variance Scoring ───────────────────────────────────────────────────────
    // Count how many of the 6 main signals point to Fav / Underdog / Draw.
    // Signal convergence is key — we only deviate from Fav when multiple signals align.
    let signalFav = 0, signalUnd = 0, signalDraw = 0;

    const ptsVar = variations['Points'] || '';
    if (ptsVar.startsWith('Fav')) signalFav++;
    else if (ptsVar.startsWith('Und')) signalUnd++;

    const tsVar = variations['TS'] || '';
    if (tsVar.startsWith('Fav')) signalFav++;
    else if (tsVar.startsWith('Und')) signalUnd++;

    ['PHA', 'Algo', 'PAA', 'SEER'].forEach(k => {
      const v = variations[k];
      if (v === 'Fav') signalFav++;
      else if (v === 'Underdog') signalUnd++;
      else if (v === 'Draw') signalDraw++;
    });

    const totalSignals = signalFav + signalUnd + signalDraw || 1;

    // Only call Underdog if it has at least as many signals as Fav AND at least 2 signals
    // Only call Draw if Draw signals dominate with at least 2 signals
    if (signalUnd >= signalFav && signalUnd >= signalDraw && signalUnd >= 2) {
      finalLean = 'Underdog';
    } else if (signalDraw >= signalFav && signalDraw >= signalUnd && signalDraw >= 2) {
      finalLean = 'Draw';
    } else {
      finalLean = 'Fav';
    }

    // Set probabilities based on signal strength
    const undPct = (signalUnd / totalSignals) * 100;
    const drawPct = (signalDraw / totalSignals) * 100;
    const favPct = (signalFav / totalSignals) * 100;

    // Blend with historical tree (even if small sample, anchor slightly)
    const varWeight = 0.7;
    const histWeight = 0.3;
    overallFavProb = (favPct * varWeight) + (histFavProb * histWeight);
    overallUndProb = (undPct * varWeight) + (histUndProb * histWeight);
    overallDrawProb = (drawPct * varWeight) + (histDrawProb * histWeight);
  }

  // Recommendations
  const isHomeFav = features.favIndex === 0;
  let recommendedPrediction = '1X';
  let recommendedHedge = 'Unknown';
  let siPatternMatch = bestLeaf?.name || null;
  let siPatternAccuracy = Math.max(overallFavProb, overallUndProb, overallDrawProb);
  
  if (finalLean === 'Fav') {
     recommendedPrediction = isHomeFav ? 'PRIM 1' : 'PRIM 2';
     recommendedHedge = isHomeFav ? (overallDrawProb > overallUndProb ? 'FIN 1X' : 'FIN 12') : (overallDrawProb > overallFavProb ? 'FIN X2' : 'FIN 12');
  } else if (finalLean === 'Underdog') {
     recommendedPrediction = isHomeFav ? 'PRIM 2' : 'PRIM 1';
     recommendedHedge = isHomeFav ? (overallDrawProb > overallFavProb ? 'FIN X2' : 'FIN 12') : (overallDrawProb > overallUndProb ? 'FIN 1X' : 'FIN 12');
  } else {
     recommendedPrediction = 'PRIM X';
     recommendedHedge = 'FIN 1X/X2'; // Unclear
  }

  // ── Composite Two-Algo Engine ───────────────────────────────────────────────
  // Runs the BASE + EDGE CASES intelligence hedging on top of the tree logic
  const compositeDecision = getCompositeDecision(match);

  // If composite engine has an edge case recommendation, use it
  if (compositeDecision && compositeDecision.tier !== 'BASE') {
    recommendedPrediction = compositeDecision.primaryPrediction;
    recommendedHedge = compositeDecision.hedge;
    decisionLogic = `${decisionLogic} + ${compositeDecision.tier}`;
  }

  return {
    features,
    historicalInsights,
    overallFavProb,
    overallDrawProb,
    overallUndProb,
    siPatternMatch,
    siPatternAccuracy,
    siPatternLean: finalLean,
    recommendedPrediction,
    recommendedHedge,
    decisionLogic,
    compositeDecision
  };
}

export async function askGeminiIntelligence(match: Match, report: IntelligenceReport): Promise<string> {
  const apiKey = typeof process !== 'undefined' ? process.env.VITE_GEMINI_API_KEY : (import.meta as any).env?.VITE_GEMINI_API_KEY;
  if (!apiKey) return "Gemini API Key is missing in .env";

  const contextStr = report.historicalInsights.map(i => 
    `- ${i.study} (${i.condition}): Fav ${i.favPct.toFixed(1)}%, Draw ${i.drawPct.toFixed(1)}%, Underdog ${i.underdogPct.toFixed(1)}% (Based on ${i.total} historical matches)`
  ).join('\n');

  const prompt = `You are "SEER Intelligence", an elite football prediction algorithm. Analyze the following match.

Match: ${match.teams}
Result (if known): ${match.result || 'Pending'}
Market Odds: ${match.mo || match.odds || 'N/A'}
Match Category: ${match.priority || 'Standard'}
Group: ${match.group || 'N/A'}

I have processed this match through our historical machine learning model against 21 specific study points. 
Here are the statistical correlations found based on 12,000+ past matches matching this game's exact conditions:

${contextStr}

Overall Statistical Probability Consensus:
Favorite: ${report.overallFavProb.toFixed(1)}%
Draw: ${report.overallDrawProb.toFixed(1)}%
Underdog: ${report.overallUndProb.toFixed(1)}%

Provide a concise, highly analytical "Thinking Process" (max 3 short paragraphs).
1. Synthesize the historical data. What is the most likely outcome based on these conditions?
2. Are there any warning signs or hidden strengths/weaknesses?
3. End with a definitive Final Prediction (e.g., "1X", "2", "12").
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    return "Error communicating with Gemini AI. Check console for details.";
  }
}
