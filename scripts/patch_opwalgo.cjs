const fs = require('fs');

let fileContent = fs.readFileSync('src/opwalgo.tsx', 'utf-8');

// 1. Definition of computeCategoryRecommendations
const computeFunctionCode = `export function computeCategoryRecommendations(
  cat: CategoryOption,
  rawDataset: Match[],
  phaStatsMap: Record<string, any> = {},
  matchStars: Record<string, number> = {},
  liveViewType: 'daily' | 'jackpot' = 'daily',
  selectedDay: DayOfWeek | 'all' = 'all'
): {
  recommendations: TriggerRecommendation[];
  baselineStats: {
    totalCompleted: number;
    totalMfav: number;
    totalDraw: number;
    totalUnderdog: number;
    baseMfavPct: number;
    baseDrawPct: number;
    baseUdPct: number;
    baseSafePct: number;
  };
  optimizerMeta: {
    totalComputations: number;
    compoundPenalties: number;
    activeTriggers: number;
    optimizationPasses: number;
  };
} {
  const prefix = cat.tagPrefix;
  const categoryMatches = !prefix ? rawDataset : rawDataset.filter(m => {
    const tags = m.evaluatorTags && m.evaluatorTags.length > 0
      ? m.evaluatorTags
      : getMatchEvaluatorTags(m, phaStatsMap, liveViewType === 'jackpot', true, matchStars);
    return tags.some(t => t.startsWith(prefix));
  });

  const completedMatches = categoryMatches.filter(m => {
    const actual = getActualResult(m.result || '');
    return actual === '1' || actual === 'X' || actual === '2';
  });

  let activeSettings: OptimizedCategorySettings | undefined;
  if (selectedDay !== 'all') {
    activeSettings = DAILY_OPTIMIZED_SETTINGS[selectedDay]?.[cat.id] ||
      DAILY_DEFAULT_CATEGORY_SETTINGS[selectedDay]?.[cat.id] ||
      OPTIMIZED_CATEGORY_SETTINGS[cat.id];
  } else {
    activeSettings = OPTIMIZED_CATEGORY_SETTINGS[cat.id] ||
      DAILY_DEFAULT_CATEGORY_SETTINGS.saturday?.[cat.id];
  }

  const currentRulePointsMap = new Map<string, number>();
  (activeSettings?.rules || []).forEach(r => currentRulePointsMap.set(r.description, r.points));

  let totalMfav = 0;
  let totalDraw = 0;
  let totalUnderdog = 0;

  // PASS 1: Trigger Correlation Matrix — count {mfav, draw, underdog} per trigger
  const hitStats = new Map<string, { mfav: number; draw: number; underdog: number }>();
  ALL_MASTER_CATALOG_TRIGGERS.forEach(desc => {
    hitStats.set(desc, { mfav: 0, draw: 0, underdog: 0 });
  });

  // Pre-compute per-match: outcome + which triggers fired
  interface MatchTriggerProfile {
    match: Match;
    outcome: 'mfav' | 'draw' | 'underdog';
    triggersHit: Set<string>;
    baseScore: number;
  }
  const matchProfiles: MatchTriggerProfile[] = [];

  completedMatches.forEach(match => {
    const actual = getActualResult(match.result || '');
    if (actual !== '1' && actual !== 'X' && actual !== '2') return;

    const mFav = getMarketFavorite(match);
    let outcome: 'mfav' | 'draw' | 'underdog';
    if (actual === mFav) {
      outcome = 'mfav';
      totalMfav++;
    } else if (actual === 'X') {
      outcome = 'draw';
      totalDraw++;
    } else {
      outcome = 'underdog';
      totalUnderdog++;
    }

    let detail;
    try {
      const matchDay = selectedDay !== 'all' ? selectedDay : getMatchDayOfWeek(match);
      detail = getOptimizedScoreDetailed(match, cat.id, phaStatsMap, matchDay);
    } catch (e) {
      return;
    }

    const triggersHit = new Set<string>();
    if (detail && detail.rulesHit && detail.rulesHit.length > 0) {
      const seen = new Set<string>();
      detail.rulesHit.forEach(h => {
        if (seen.has(h.description)) return;
        seen.add(h.description);
        triggersHit.add(h.description);

        let stat = hitStats.get(h.description);
        if (!stat) {
          stat = { mfav: 0, draw: 0, underdog: 0 };
          hitStats.set(h.description, stat);
        }
        if (outcome === 'mfav') stat.mfav++;
        else if (outcome === 'draw') stat.draw++;
        else stat.underdog++;
      });
    }

    matchProfiles.push({
      match,
      outcome,
      triggersHit,
      baseScore: detail?.baseInfo?.points ?? 0
    });
  });

  const totalCompleted = totalMfav + totalDraw + totalUnderdog;
  const baseMfavPct = totalCompleted > 0 ? (totalMfav / totalCompleted) * 100 : 0;
  const baseDrawPct = totalCompleted > 0 ? (totalDraw / totalCompleted) * 100 : 0;
  const baseUdPct = totalCompleted > 0 ? (totalUnderdog / totalCompleted) * 100 : 0;
  const baseSafePct = baseMfavPct + baseDrawPct;

  const objective = cat.targetObjective;

  // PASS 2: Objective-Aware Discriminative Power Score (DPS) per trigger
  const triggerDPS = new Map<string, number>();
  const baselineMfavRate = totalCompleted > 0 ? totalMfav / totalCompleted : 0;
  const baselineDrawRate = totalCompleted > 0 ? totalDraw / totalCompleted : 0;
  const baselineUdRate = totalCompleted > 0 ? totalUnderdog / totalCompleted : 0;
  const baselineSafeRate = totalCompleted > 0 ? (totalMfav + totalDraw) / totalCompleted : 0;

  Array.from(hitStats.entries()).forEach(([desc, counts]) => {
    const totalHits = counts.mfav + counts.draw + counts.underdog;
    if (totalHits < 2) {
      triggerDPS.set(desc, 0);
      return;
    }
    const mfavRate = totalHits > 0 ? counts.mfav / totalHits : 0;
    const drawRate = totalHits > 0 ? counts.draw / totalHits : 0;
    const udRate = totalHits > 0 ? counts.underdog / totalHits : 0;
    const safeRate = mfavRate + drawRate;

    let dps = 0;
    if (objective === 'underdog_only') {
      const trapRate = mfavRate + drawRate;
      dps = (baselineUdRate > 0 ? udRate / baselineUdRate : 0) -
            (baselineSafeRate > 0 ? trapRate / baselineSafeRate : 0);
    } else if (objective === 'mfav_only') {
      const nonMfavRate = drawRate + udRate;
      dps = (baselineMfavRate > 0 ? mfavRate / baselineMfavRate : 0) -
            ((baselineDrawRate + baselineUdRate) > 0 ? nonMfavRate / (baselineDrawRate + baselineUdRate) : 0);
    } else {
      // mfav_draw (Top 12, Best Bet, Bankers, BOTB): Draws are SAFE hedges, never penalized!
      dps = (baselineSafeRate > 0 ? safeRate / baselineSafeRate : 0) -
            (baselineUdRate > 0 ? udRate / baselineUdRate : 0);
    }
    triggerDPS.set(desc, dps);
  });

  // PASS 3: Iterative Point Optimization
  const scoreMatch = (profile: MatchTriggerProfile, pointsMap: Map<string, number>): number => {
    let score = profile.baseScore;
    profile.triggersHit.forEach(desc => {
      score += pointsMap.get(desc) ?? 0;
    });
    return score;
  };

  const measurePairwiseSeparation = (pointsMap: Map<string, number>): number => {
    if (matchProfiles.length === 0) return 0;
    const scored = matchProfiles.map(p => ({
      outcome: p.outcome,
      score: scoreMatch(p, pointsMap)
    }));
    scored.sort((a, b) => b.score - a.score);

    const topN = Math.min(scored.length, cat.targetCapacity);

    let targetOutcomes: Set<string>;
    let trapOutcomes: Set<string>;

    if (objective === 'underdog_only') {
      targetOutcomes = new Set(['underdog']);
      trapOutcomes = new Set(['mfav', 'draw']);
    } else if (objective === 'mfav_only') {
      targetOutcomes = new Set(['mfav']);
      trapOutcomes = new Set(['draw', 'underdog']);
    } else {
      targetOutcomes = new Set(['mfav', 'draw']);
      trapOutcomes = new Set(['underdog']);
    }

    let targetInTopN = 0;
    let trapInTopN = 0;
    for (let i = 0; i < topN; i++) {
      if (targetOutcomes.has(scored[i].outcome)) {
        targetInTopN++;
      } else if (trapOutcomes.has(scored[i].outcome)) {
        trapInTopN++;
      }
    }

    let inversions = 0;
    let pairwiseMarginSum = 0;
    const targetScores: number[] = [];
    const trapScores: number[] = [];

    for (let i = 0; i < scored.length; i++) {
      if (targetOutcomes.has(scored[i].outcome)) {
        targetScores.push(scored[i].score);
      } else if (trapOutcomes.has(scored[i].outcome)) {
        trapScores.push(scored[i].score);
      }
    }

    for (const ts of targetScores) {
      for (const us of trapScores) {
        if (us >= ts) {
          inversions++;
          pairwiseMarginSum -= (us - ts + 5);
        } else {
          pairwiseMarginSum += Math.min(15, ts - us);
        }
      }
    }

    const totalPairs = targetScores.length * trapScores.length;
    const normalizedPairwise = totalPairs > 0 ? (pairwiseMarginSum / (totalPairs * 15)) : 0;
    const purityRatio = topN > 0 ? targetInTopN / topN : 0;

    const quality = (purityRatio * 1000) - (trapInTopN * 400) + (normalizedPairwise * 150) - (inversions * 2);
    return quality;
  };

  const sortedTriggers = Array.from(triggerDPS.entries())
    .filter(([desc]) => {
      const counts = hitStats.get(desc);
      return counts && (counts.mfav + counts.draw + counts.underdog) >= 2;
    })
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([desc]) => desc);

  const POINT_VALUES = [-20, -15, -10, -5, 0, 5, 10, 15, 20];
  const OPTIMIZATION_PASSES = 3;
  let totalComputations = 0;

  const TRUE_UNDERDOG_TRIGGERS = new Set<string>([
    "Underdog has >= 5 more points on point system",
    "Underdog odds <= 2.80",
    "Odds for underdog <= odds for draw but < 2.8",
    "Underdog GS >Mfav GS with >=0.4 points",
    "LE Underdog won with 2+ goals",
    "LE : Underdog won the last encounter",
    "LE: Underdog won the last encounter with Mfav (H2H)",
    "Underdog was away on LE and Won",
    "LE, Underdog won the last encounter +Mfav L10= Und L10",
    "Sub pattern primary prediction supports the underdog",
    "Algo primary prediction supports the underdog",
    "Seer primary predicts on underdog",
    "Seer score on underdog >= 45%",
    "PHA Underdog probability >= 35%"
  ]);

  const FAVORITE_DOMINANCE_TRIGGERS = new Set<string>([
    "M.fav has hidden strength",
    "Mfav GA <= 1.0 but Underdog GA > 1.0",
    "M.fav GA is > 0.6 points lower than Underdog GA",
    "M.fav TS >= 2.0 and Underdog TS < 1.0",
    "Algo support for Mfav > 50%",
    "Algo support for Mfav is 45-50%",
    "Seer score on draw <= 20%",
    "All predictors (Algo, Seer, PAA, SubPattern) agree on 1X/X2",
    "PAA, Seer, Algo, and ML agree on 1X/X2",
    "PAA, Seer, and ML agree on 1X/X2",
    "LE : Market favorite won the last encounter",
    "LE: Market favorite won the last encounter with Underdog (H2H)",
    "LE Mfav won with 2+ goals"
  ]);

  const optimizedPoints = new Map<string, number>();
  ALL_MASTER_CATALOG_TRIGGERS.forEach(desc => {
    const masterDefault = Math.max(-20, Math.min(20, getMasterTriggerDefaultPoints(desc, objective)));
    const counts = hitStats.get(desc);
    if (!counts) {
      optimizedPoints.set(desc, masterDefault);
      return;
    }
    const totalHits = counts.mfav + counts.draw + counts.underdog;
    if (totalHits < 2) {
      optimizedPoints.set(desc, masterDefault);
      return;
    }

    const mfavRate = counts.mfav / totalHits;
    const drawRate = counts.draw / totalHits;
    const udRate = counts.underdog / totalHits;
    const safeRate = mfavRate + drawRate;
    const isUdTrap = TRUE_UNDERDOG_TRIGGERS.has(desc);
    const isFavDominant = FAVORITE_DOMINANCE_TRIGGERS.has(desc);

    let initialPts = masterDefault;

    if (objective === 'underdog_only') {
      if (udRate >= 0.55 || (isUdTrap && udRate >= 0.40)) initialPts = 20;
      else if (udRate >= 0.45) initialPts = 15;
      else if (udRate >= 0.35) initialPts = 10;
      else if (udRate > (baseUdPct / 100)) initialPts = 5;
      else if (mfavRate >= 0.60 || isFavDominant) initialPts = -20;
      else if (mfavRate >= 0.50) initialPts = -15;
      else if (mfavRate >= 0.40) initialPts = -10;
    } else if (objective === 'mfav_only') {
      if (mfavRate >= 0.65 || (isFavDominant && mfavRate >= 0.55)) initialPts = 20;
      else if (mfavRate >= 0.55) initialPts = 15;
      else if (mfavRate >= 0.45) initialPts = 10;
      else if (mfavRate > (baseMfavPct / 100) + 0.05) initialPts = 5;
      else if (udRate >= 0.40 || isUdTrap) initialPts = -20;
      else if (udRate >= 0.30 || drawRate >= 0.45) initialPts = -15;
      else if (udRate >= 0.25 || drawRate >= 0.38) initialPts = -10;
      else if (udRate > (baseUdPct / 100)) initialPts = -5;
    } else {
      if (isUdTrap) {
        if (udRate >= 0.40) initialPts = -20;
        else if (udRate >= 0.30) initialPts = -15;
        else if (udRate >= 0.20) initialPts = -10;
        else initialPts = -5;
      } else if (isFavDominant) {
        if (safeRate >= 0.85) initialPts = 20;
        else if (safeRate >= 0.70) initialPts = 15;
        else initialPts = 10;
      } else {
        if (safeRate >= 0.85) initialPts = 20;
        else if (safeRate >= 0.75) initialPts = 15;
        else if (safeRate >= 0.65) initialPts = 10;
        else if (safeRate > (baseSafePct / 100)) initialPts = 5;
        else if (udRate >= 0.45) initialPts = -20;
        else if (udRate >= 0.35) initialPts = -15;
        else if (udRate >= 0.25) initialPts = -10;
        else initialPts = masterDefault;
      }
    }

    optimizedPoints.set(desc, Math.max(-20, Math.min(20, initialPts)));
  });

  for (let pass = 0; pass < OPTIMIZATION_PASSES; pass++) {
    for (const triggerDesc of sortedTriggers) {
      const counts = hitStats.get(triggerDesc);
      const totalHits = counts ? counts.mfav + counts.draw + counts.underdog : 0;
      const dps = triggerDPS.get(triggerDesc) ?? 0;

      let searchValues = POINT_VALUES;
      if (pass === 0) {
        if (objective === 'underdog_only') {
          searchValues = dps > 0.1 ? [5, 10, 15, 20] : [-20, -15, -10, -5, 0];
        } else if (objective === 'mfav_only') {
          searchValues = dps > 0.1 ? [5, 10, 15, 20] : [-20, -15, -10, -5, 0];
        } else {
          if (dps > 0.15) searchValues = [5, 10, 15, 20];
          else if (dps > 0) searchValues = [0, 5, 10, 15];
          else if (dps < -0.2) searchValues = [-20, -15, -10, -5, 0];
          else searchValues = [-10, -5, 0, 5, 10];
        }
      }

      let bestPoints = optimizedPoints.get(triggerDesc) ?? 0;
      let bestQuality = measurePairwiseSeparation(optimizedPoints);

      for (const testPts of searchValues) {
        optimizedPoints.set(triggerDesc, testPts);
        let quality = measurePairwiseSeparation(optimizedPoints);
        totalComputations++;

        const pointMag = Math.abs(testPts);
        const regularization = (pointMag * pointMag) * 0.00003;
        quality -= regularization;

        if (totalHits < 4 && pointMag > 10) quality -= 0.015;
        else if (totalHits < 8 && pointMag > 15) quality -= 0.008;

        if (quality > bestQuality + 0.0001) {
          bestQuality = quality;
          bestPoints = testPts;
        }
      }
      optimizedPoints.set(triggerDesc, bestPoints);
    }
  }

  // PASS 4: Combination Trap Penalties
  let compoundPenalties = 0;
  if (objective === 'mfav_only') {
    const trapCorrelatedTriggers = Array.from(hitStats.entries())
      .filter(([_, counts]) => {
        const total = counts.mfav + counts.draw + counts.underdog;
        if (total < 3) return false;
        const trapRate = (counts.draw + counts.underdog) / total;
        return trapRate >= 0.50;
      })
      .map(([desc]) => desc);

    trapCorrelatedTriggers.forEach(desc => {
      const currentPts = optimizedPoints.get(desc) ?? 0;
      if (currentPts > 0) {
        optimizedPoints.set(desc, -10);
        compoundPenalties++;
      } else if (currentPts === 0) {
        optimizedPoints.set(desc, -10);
        compoundPenalties++;
      } else if (currentPts > -15) {
        optimizedPoints.set(desc, Math.max(-20, currentPts - 5));
        compoundPenalties++;
      }
    });
  } else if (objective === 'underdog_only') {
    const favoriteCorrelatedTriggers = Array.from(hitStats.entries())
      .filter(([_, counts]) => {
        const total = counts.mfav + counts.draw + counts.underdog;
        if (total < 3) return false;
        const favRate = counts.mfav / total;
        return favRate >= 0.60;
      })
      .map(([desc]) => desc);

    favoriteCorrelatedTriggers.forEach(desc => {
      const currentPts = optimizedPoints.get(desc) ?? 0;
      if (currentPts > 0) {
        optimizedPoints.set(desc, -15);
        compoundPenalties++;
      } else if (currentPts > -20) {
        optimizedPoints.set(desc, -20);
        compoundPenalties++;
      }
    });
  } else {
    const drawTrapTriggers = Array.from(hitStats.entries())
      .filter(([desc, counts]) => {
        const total = counts.mfav + counts.draw + counts.underdog;
        if (total < 3) return false;
        const udRate = counts.underdog / total;
        return udRate >= 0.40 && TRUE_UNDERDOG_TRIGGERS.has(desc);
      })
      .map(([desc]) => desc);

    drawTrapTriggers.forEach(desc => {
      const currentPts = optimizedPoints.get(desc) ?? 0;
      if (currentPts > -15) {
        optimizedPoints.set(desc, -20);
        compoundPenalties++;
      }
    });
  }

  // Final Trigger Recommendation Generation
  const recs: TriggerRecommendation[] = ALL_MASTER_CATALOG_TRIGGERS.map(desc => {
    const counts = hitStats.get(desc) || { mfav: 0, draw: 0, underdog: 0 };
    const totalHits = counts.mfav + counts.draw + counts.underdog;
    const mfavPct = totalHits > 0 ? (counts.mfav / totalHits) * 100 : 0;
    const drawPct = totalHits > 0 ? (counts.draw / totalHits) * 100 : 0;
    const underdogPct = totalHits > 0 ? (counts.underdog / totalHits) * 100 : 0;
    const safePct = mfavPct + drawPct;

    const currentPoints = currentRulePointsMap.get(desc) ?? 0;
    const recommendedPoints = optimizedPoints.get(desc) ?? 0;
    const dps = triggerDPS.get(desc) ?? 0;

    let confidence: TriggerRecommendation['confidence'] = 'Insufficient Data';
    if (totalHits >= 10) confidence = 'High';
    else if (totalHits >= 4) confidence = 'Medium';
    else if (totalHits >= 2) confidence = 'Low';

    let rationale = '';
    if (totalHits < 2) {
      rationale = totalHits === 0 ? 'Zero hits. No data.' : 'Sample too small (1 hit).';
    } else if (recommendedPoints > 0) {
      rationale = \`Mfav booster: \${mfavPct.toFixed(0)}% Mfav rate (DPS \${dps > 0 ? '+' : ''}\${dps.toFixed(2)}). Optimized via \${totalComputations.toLocaleString()} statistical tests.\`;
    } else if (recommendedPoints < 0) {
      const trapType = underdogPct > drawPct ? 'Underdog' : 'Draw';
      rationale = \`\${trapType} trap: \${(drawPct + underdogPct).toFixed(0)}% non-Mfav rate (DPS \${dps.toFixed(2)}). Penalty optimized to push traps below Mfav wins.\`;
    } else {
      rationale = \`Neutral after optimization (\${mfavPct.toFixed(0)}% Mfav, \${drawPct.toFixed(0)}% Draw, \${underdogPct.toFixed(0)}% UD). DPS=\${dps.toFixed(2)}.\`;
    }

    const netEdge = objective === 'underdog_only'
      ? (underdogPct - mfavPct)
      : (mfavPct - (underdogPct * 1.5 + drawPct * 0.5));

    return {
      description: desc,
      currentPoints,
      recommendedPoints,
      totalHits,
      mfavHits: counts.mfav,
      drawHits: counts.draw,
      underdogHits: counts.underdog,
      mfavPct,
      drawPct,
      underdogPct,
      safePct,
      netEdge,
      rationale,
      confidence
    };
  });

  return {
    recommendations: recs,
    baselineStats: {
      totalCompleted,
      totalMfav,
      totalDraw,
      totalUnderdog,
      baseMfavPct,
      baseDrawPct,
      baseUdPct,
      baseSafePct
    },
    optimizerMeta: {
      totalComputations,
      compoundPenalties,
      activeTriggers: sortedTriggers.length,
      optimizationPasses: OPTIMIZATION_PASSES
    }
  };
}
`;

// Insert computeCategoryRecommendations right before "export const OPWAlgo"
const opwAlgoMarker = 'export const OPWAlgo: React.FC<OPWAlgoProps> = ({';
if (!fileContent.includes(opwAlgoMarker)) {
  console.error('Marker export const OPWAlgo not found!');
  process.exit(1);
}
fileContent = fileContent.replace(opwAlgoMarker, computeFunctionCode + '\n' + opwAlgoMarker);

// Replace the inside of useMemo(() => { let totalMfav = 0; ... }, [...]) with a call to computeCategoryRecommendations
const useMemoStart = '  // Compute trigger statistics & recommendations via multi-pass statistical optimizer\n  const { recommendations, baselineStats, optimizerMeta } = useMemo(() => {';
const useMemoEnd = '  }, [completedMatches, currentRulePointsMap, activeCategoryConfig, selectedDay, activeCategory, phaStatsMap]);';

const startIdx = fileContent.indexOf(useMemoStart);
const endIdx = fileContent.indexOf(useMemoEnd);

if (startIdx === -1 || endIdx === -1) {
  console.error('useMemo boundaries not found! startIdx:', startIdx, 'endIdx:', endIdx);
  process.exit(1);
}

const replacementMemo = `  // Compute trigger statistics & recommendations via multi-pass statistical optimizer
  const { recommendations, baselineStats, optimizerMeta } = useMemo(() => {
    return computeCategoryRecommendations(
      activeCategoryConfig,
      rawDataset,
      phaStatsMap,
      matchStars,
      liveViewType,
      selectedDay
    );
  }, [activeCategoryConfig, rawDataset, phaStatsMap, matchStars, liveViewType, selectedDay]);`;

fileContent = fileContent.substring(0, startIdx) + replacementMemo + fileContent.substring(endIdx + useMemoEnd.length);

// Update handleApplyRuntimeToAllCategories
const applyAllStart = '  // Apply Recommendations across ALL Categories and Days\n  const handleApplyRuntimeToAllCategories = useCallback(() => {';
const applyAllEnd = '    showToast(\'Applied calibrated runtime weights with master rules to ALL 7 categories across ALL days!\');\n  }, [activeCategory, effectiveRecommendations, activeSettings, activeCategoryConfig, isDeepOptimizing, deepStatus, deepPointsMap, showToast]);';

const applyStartIdx = fileContent.indexOf(applyAllStart);
const applyEndIdx = fileContent.indexOf(applyAllEnd);

if (applyStartIdx === -1 || applyEndIdx === -1) {
  console.error('applyAll boundaries not found! applyStartIdx:', applyStartIdx, 'applyEndIdx:', applyEndIdx);
  process.exit(1);
}

const replacementApplyAll = `  // Apply Recommendations across ALL Categories and Days
  const handleApplyRuntimeToAllCategories = useCallback(() => {
    const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    CATEGORIES.forEach(cat => {
      let rulesToApply: { description: string; points: number }[];

      if (cat.id === activeCategory && effectiveRecommendations.length > 0) {
        rulesToApply = effectiveRecommendations
          .filter(r => (r.totalHits >= 1 || isDeepOptimizing || deepStatus === 'converged' || !!deepPointsMap) && r.recommendedPoints !== 0)
          .map(r => ({
            description: r.description,
            points: Math.max(-20, Math.min(20, r.recommendedPoints))
          }));
      } else {
        // Dynamically compute live recommendations for this category using current matches!
        const computed = computeCategoryRecommendations(
          cat,
          rawDataset,
          phaStatsMap,
          matchStars,
          liveViewType,
          selectedDay
        );
        rulesToApply = computed.recommendations
          .filter(r => r.totalHits >= 1 && r.recommendedPoints !== 0)
          .map(r => ({
            description: r.description,
            points: Math.max(-20, Math.min(20, r.recommendedPoints))
          }));
      }

      const finalRules = populateCategoryWithMasterRules(rulesToApply, cat.targetObjective);
      const existingSettings = OPTIMIZED_CATEGORY_SETTINGS[cat.id] || DAILY_DEFAULT_CATEGORY_SETTINGS.saturday[cat.id] || {
        name: cat.label,
        description: cat.description,
        baseLogic: "Points based on Primary Pattern PHA %.",
        baseWeightIntervals: [
          { id: '1', min: 60, max: 100, points: 35, metric: 'pha_market_fav' },
          { id: '2', min: 50, max: 59.99, points: 30, metric: 'pha_market_fav' },
          { id: '3', min: 45, max: 49.99, points: 25, metric: 'pha_market_fav' },
          { id: '4', min: 40, max: 44.99, points: 20, metric: 'pha_market_fav' },
          { id: '5', min: 34, max: 39.99, points: 15, metric: 'pha_market_fav' },
          { id: '6', min: 0, max: 33.99, points: 10, metric: 'pha_market_fav' }
        ],
        rules: []
      };

      const updated = { ...existingSettings, rules: finalRules };
      updateOptimizedCategorySettings(cat.id, updated);
      days.forEach(d => updateDailyOptimizedCategorySettings(d, cat.id, updated));
    });

    savePersistedDailySettings();
    showToast('Dynamically optimized and applied calibrated runtime weights to ALL 7 categories across ALL days!');
  }, [activeCategory, effectiveRecommendations, rawDataset, phaStatsMap, matchStars, liveViewType, selectedDay, isDeepOptimizing, deepStatus, deepPointsMap, showToast]);`;

fileContent = fileContent.substring(0, applyStartIdx) + replacementApplyAll + fileContent.substring(applyEndIdx + applyAllEnd.length);

// Update generateAllCodeUpdatesSnippet
const codeSnippetStart = '  const generateAllCodeUpdatesSnippet = useCallback(() => {';
const codeSnippetEnd = '    return sections.join(\'\\n\');\n  }, [effectiveRecommendations, activeCategory]);';

const snippetStartIdx = fileContent.indexOf(codeSnippetStart);
const snippetEndIdx = fileContent.indexOf(codeSnippetEnd);

if (snippetStartIdx === -1 || snippetEndIdx === -1) {
  console.error('snippet boundaries not found! snippetStartIdx:', snippetStartIdx, 'snippetEndIdx:', snippetEndIdx);
  process.exit(1);
}

const replacementSnippet = `  const generateAllCodeUpdatesSnippet = useCallback(() => {
    const sections: string[] = [
      \`// ============================================================================\`,
      \`// SEER OPW ALGO MASTER CODE UPDATE: ALL CATEGORIES & ALL DAYS\`,
      \`// Generated: \${new Date().toLocaleString()}\`,
      \`// Includes: All 8 Categories, 7 Daily Modules (Monday - Sunday), Master Catalog Defaults\`,
      \`// ============================================================================\\n\`
    ];

    CATEGORIES.forEach(cat => {
      sections.push(\`// ----------------------------------------------------------------------------\`);
      sections.push(\`// Category: \${cat.label} ("\${cat.id}") | Target Objective: '\${cat.targetObjective}'\`);
      sections.push(\`// ----------------------------------------------------------------------------\`);
      
      let rules: { description: string; points: number; note: string }[];

      if (cat.id === activeCategory && effectiveRecommendations.length > 0) {
        rules = effectiveRecommendations.filter(r => r.recommendedPoints !== 0).map(r => ({
          description: r.description,
          points: r.recommendedPoints,
          note: \`\${r.recommendedPoints > 0 ? '+' : ''}\${r.recommendedPoints} pts (\${r.mfavPct.toFixed(0)}% Mfav, \${r.drawPct.toFixed(0)}% Draw, \${r.underdogPct.toFixed(0)}% UD | \${r.totalHits} hits)\`
        }));
      } else {
        const computed = computeCategoryRecommendations(
          cat,
          rawDataset,
          phaStatsMap,
          matchStars,
          liveViewType,
          selectedDay
        );
        rules = computed.recommendations.filter(r => r.recommendedPoints !== 0).map(r => ({
          description: r.description,
          points: r.recommendedPoints,
          note: \`\${r.recommendedPoints > 0 ? '+' : ''}\${r.recommendedPoints} pts (\${r.mfavPct.toFixed(0)}% Mfav, \${r.drawPct.toFixed(0)}% Draw, \${r.underdogPct.toFixed(0)}% UD | \${r.totalHits} hits)\`
        }));
      }

      const rulesCode = rules.map(r => 
        \`                { description: \${JSON.stringify(r.description)}, points: \${r.points} }, // \${r.note}\`
      ).join('\\n');

      sections.push(\`rules: populateCategoryWithMasterRules([\\n\${rulesCode}\\n], '\${cat.targetObjective}')\\n\`);
    });

    sections.push(\`// ============================================================================\`);
    sections.push(\`// MASTER CATALOG DEFAULTS (src/utils/opwCatalog.ts)\`);
    sections.push(\`// ============================================================================\`);
    sections.push(\`// Active catalog triggers: 125 triggers with non-zero calibrated points.\`);
    sections.push(\`// Default points routing: 'mfav_draw' -> MASTER_MFAV_DRAW_POINTS, 'mfav_only' -> MASTER_MFAV_ONLY_POINTS, 'underdog_only' -> MASTER_UNDERDOG_ONLY_POINTS\`);

    return sections.join('\\n');
  }, [effectiveRecommendations, activeCategory, rawDataset, phaStatsMap, matchStars, liveViewType, selectedDay]);`;

fileContent = fileContent.substring(0, snippetStartIdx) + replacementSnippet + fileContent.substring(snippetEndIdx + codeSnippetEnd.length);

fs.writeFileSync('src/opwalgo.tsx', fileContent, 'utf-8');
console.log('Successfully patched src/opwalgo.tsx! New length:', fileContent.length);
