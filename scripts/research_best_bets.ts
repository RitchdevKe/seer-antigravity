import { supabase } from '../src/lib/supabase';
import { RAW_MATCHES } from '../src/constants';
import { processMatch, getActualResult, getFavoriteAndUnderdog, matchesPrediction } from '../src/utils/matchProcessing';
import { predictSeerDetailed, DEFAULT_WEIGHTS } from '../src/utils/seerLogic';
import { getMatchEvaluatorTags } from '../src/utils/matchEvaluator';
import { Match } from '../src/types';
import * as fs from 'fs';

async function main() {
  console.log("=========================================================================");
  console.log("🧠 SEER COGNITIVE RESEARCH AGENT: BEST BET OPTIMIZATION");
  console.log("=========================================================================\n");

  // 1. Fetch completed/historical matches to reconstruct the full sub-pattern stats (phaStatsMap)
  console.log("Fetching precalculated matches from database...");
  let from = 0;
  const step = 1000;
  let hasMore = true;
  const precalcMatches: Match[] = [];

  while (hasMore) {
    const { data, error } = await supabase
      .from('precalculated_matches')
      .select('id, data')
      .range(from, from + step - 1);

    if (error) {
      console.error("Failed to fetch precalculated matches:", error);
      break;
    }
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach(row => {
        if (row.data) precalcMatches.push(row.data as Match);
      });
      if (data.length < step) hasMore = false;
      else from += step;
    }
  }

  console.log("Fetching user-uploaded matches...");
  const uploadedMatches: Match[] = [];
  from = 0;
  hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('user_uploaded_matches')
      .select('id, data')
      .range(from, from + step - 1);

    if (error) {
      console.error("Failed to fetch user-uploaded matches:", error);
      break;
    }
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach(row => {
        if (row.data) uploadedMatches.push(row.data as Match);
      });
      if (data.length < step) hasMore = false;
      else from += step;
    }
  }

  const allMatches = [...precalcMatches, ...uploadedMatches, ...(RAW_MATCHES as Match[])];
  console.log(`✅ Loaded total ${allMatches.length} raw matches from all sources.`);

  // Deduplicate matches
  const uniqueMap = new Map<string | number, Match>();
  allMatches.forEach(m => {
    if (m.id) {
      const existing = uniqueMap.get(m.id);
      if (!existing || (getActualResult(existing.result || '') === 'pending' && getActualResult(m.result || '') !== 'pending')) {
        uniqueMap.set(m.id, m);
      }
    }
  });
  const uniqueMatches = Array.from(uniqueMap.values());
  console.log(`✅ Deduplicated to ${uniqueMatches.length} unique matches.`);

  // Reconstruct phaStatsMap and process matches
  console.log("Processing matches to build sub-pattern statistics (phaStatsMap)...");
  const processedMatches = uniqueMatches.map(m => {
    if (m.isPrecalculated && m.totalPoints) return m;
    return processMatch(m);
  });

  const phaStatsMap: Record<string, any> = {};
  processedMatches.forEach(m => {
    const sub = m.patternAnalysis?.subPattern;
    if (sub) {
      if (!phaStatsMap[sub]) {
        phaStatsMap[sub] = { total: 0, paaTotal: 0, correct: 0, outcomes: { '1': 0, 'X': 0, '2': 0 }, favWin: 0, draw: 0, upsetWin: 0 };
      }
      const actual = getActualResult(m.result || '');
      if (actual !== 'pending') {
        phaStatsMap[sub].total++;
        const pred = m.finalPrediction || m.rawPrediction || '1';
        if (matchesPrediction(pred, actual)) phaStatsMap[sub].correct++;
        if (actual === '1' || actual === 'X' || actual === '2') {
          phaStatsMap[sub].outcomes[actual]++;
        }
        
        const favInfo = getFavoriteAndUnderdog(m);
        if (favInfo) {
          const { fav: moFav, underdog: moUnderdog } = favInfo;
          phaStatsMap[sub].paaTotal++;
          if (actual === moFav) phaStatsMap[sub].favWin++;
          else if (actual === 'X') phaStatsMap[sub].draw++;
          else if (actual === moUnderdog) phaStatsMap[sub].upsetWin++;
        }
      }
    }
  });
  console.log(`✅ Constructed phaStatsMap with ${Object.keys(phaStatsMap).length} sub-patterns.`);

  // 2. Identify Best Bet matches
  console.log("Analyzing evaluator tags on completed matches...");
  const bestBetMatches: Match[] = [];
  
  processedMatches.forEach(m => {
    const actual = getActualResult(m.result || '');
    if (actual === 'pending') return;

    const tags = m.evaluatorTags && m.evaluatorTags.length > 0
      ? m.evaluatorTags
      : getMatchEvaluatorTags(m, phaStatsMap, false, true, {});

    const hasBestBetTag = tags.some(t => t.toLowerCase().startsWith('best_bet:'));
    if (hasBestBetTag) {
      bestBetMatches.push(m);
    }
  });

  console.log(`\n🔍 Found ${bestBetMatches.length} completed matches with Best Bet evaluator tags.`);

  // Let's count outcomes (Favorite Win, Draw, Underdog Win)
  let favWins = 0;
  let draws = 0;
  let udogWins = 0;
  let unknownResults = 0;

  bestBetMatches.forEach(m => {
    const actual = getActualResult(m.result || '');
    const favInfo = getFavoriteAndUnderdog(m);
    if (!favInfo) {
      unknownResults++;
      return;
    }
    const { fav: moFav, underdog: moUnderdog } = favInfo;

    if (actual === moFav) {
      favWins++;
    } else if (actual === 'X') {
      draws++;
    } else if (actual === moUnderdog) {
      udogWins++;
    } else {
      unknownResults++;
    }
  });

  console.log(`📊 Core Outcomes of Best Bet tags:`);
  console.log(`   - Market Favorite Wins: ${favWins} (${((favWins / bestBetMatches.length) * 100).toFixed(1)}%)`);
  console.log(`   - Draws:                ${draws} (${((draws / bestBetMatches.length) * 100).toFixed(1)}%)`);
  console.log(`   - Underdog Wins:        ${udogWins} (${((udogWins / bestBetMatches.length) * 100).toFixed(1)}%)`);
  if (unknownResults > 0) {
    console.log(`   - Unknown/Pending outcomes: ${unknownResults}`);
  }

  // Define Success as Favorite Win or Draw (user request: "market favorite win or draw", which is standard 1X/X2 safety)
  const successCount = favWins + draws;
  const successPct = (successCount / bestBetMatches.length) * 100;
  console.log(`   - Favorite Win or Draw Success Rate: ${successCount}/${bestBetMatches.length} (${successPct.toFixed(1)}%)\n`);

  // 3. Let's analyze AGREEMENT patterns on these Best Bet matches
  console.log("-------------------------------------------------------------------------");
  console.log("🤝 PART A: ANALYSIS OF AGREEMENT PATTERNS (ACCURACY AND SUBSETS)");
  console.log("-------------------------------------------------------------------------");

  interface PatternStats {
    total: number;
    favWin: number;
    draw: number;
    udogWin: number;
  }

  const printPattern = (name: string, stats: PatternStats) => {
    const total = stats.total;
    if (total === 0) {
      console.log(`   👉 ${name}: No matches found.`);
      return;
    }
    const favPct = ((stats.favWin / total) * 100).toFixed(1);
    const drawPct = ((stats.draw / total) * 100).toFixed(1);
    const udogPct = ((stats.udogWin / total) * 100).toFixed(1);
    const successPct = (((stats.favWin + stats.draw) / total) * 100).toFixed(1);
    console.log(`   👉 ${name}:`);
    console.log(`      Total Matches: ${total}`);
    console.log(`      Fav Win: ${stats.favWin} (${favPct}%) | Draw: ${stats.draw} (${drawPct}%) | Underdog Win (Loss): ${stats.udogWin} (${udogPct}%)`);
    console.log(`      Success Rate (Fav Win or Draw): ${stats.favWin + stats.draw}/${total} (${successPct}%)\n`);
  };

  // 3.1 PAA / ALGO Agreement
  // PAA agrees with ALGO
  const paaAlgoAgree: PatternStats = { total: 0, favWin: 0, draw: 0, udogWin: 0 };
  const paaAlgoDisagree: PatternStats = { total: 0, favWin: 0, draw: 0, udogWin: 0 };

  // 3.2 SEER (default weights) / ALGO Agreement
  const seerAlgoAgree: PatternStats = { total: 0, favWin: 0, draw: 0, udogWin: 0 };

  // 3.3 Sub Pattern / PAA Agreement
  const subPaaAgree: PatternStats = { total: 0, favWin: 0, draw: 0, udogWin: 0 };

  // 3.4 Triple Agreement: PAA, ALGO, and Sub Pattern all agree on outcome
  const tripleAgree: PatternStats = { total: 0, favWin: 0, draw: 0, udogWin: 0 };

  // 3.5 Breakdowns by predictions
  const subPredStats: Record<string, PatternStats> = {};
  const paaPredStats: Record<string, PatternStats> = {};

  bestBetMatches.forEach(m => {
    const actual = getActualResult(m.result || '');
    const favInfo = getFavoriteAndUnderdog(m);
    if (!favInfo) return;
    const { fav: moFav, underdog: moUnderdog } = favInfo;

    const isFavWin = actual === moFav;
    const isDraw = actual === 'X';
    const isUdogWin = actual === moUnderdog;

    // Predictions
    const paaPred = (m.paaPrediction || m.paaPrimaryPrediction || '').trim();
    const liveAlgoReport = (m as any)._liveAlgoReport || { prediction: '' };
    const algoPred = (liveAlgoReport.prediction || '').trim();
    const subPred = (m.patternAnalysis?.subPatternPrediction || '').trim();

    const seerResult = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, {});
    const seerPred = seerResult.final;

    const recordOutcome = (stats: PatternStats) => {
      stats.total++;
      if (isFavWin) stats.favWin++;
      else if (isDraw) stats.draw++;
      else if (isUdogWin) stats.udogWin++;
    };

    // 3.1 PAA/ALGO Agreement (we define agreement as: intersection is not empty, or they are identical)
    // Let's do exact match or intersection
    const paaAlgoIntersect = [...paaPred].some(c => algoPred.includes(c));
    if (paaAlgoIntersect && paaPred !== '' && algoPred !== '') {
      recordOutcome(paaAlgoAgree);
    } else {
      recordOutcome(paaAlgoDisagree);
    }

    // SEER / ALGO Agreement
    const seerAlgoIntersect = [...seerPred].some(c => algoPred.includes(c));
    if (seerAlgoIntersect && seerPred !== '' && algoPred !== '') {
      recordOutcome(seerAlgoAgree);
    }

    // Sub Pattern / PAA Agreement
    const subPaaIntersect = [...subPred].some(c => paaPred.includes(c));
    if (subPaaIntersect && subPred !== '' && paaPred !== '') {
      recordOutcome(subPaaAgree);
    }

    // Triple Agreement
    const hasTriple = [...paaPred].some(c => algoPred.includes(c) && subPred.includes(c));
    if (hasTriple && paaPred !== '' && algoPred !== '' && subPred !== '') {
      recordOutcome(tripleAgree);
    }

    // Sub Pattern prediction breakdowns
    if (subPred) {
      if (!subPredStats[subPred]) {
        subPredStats[subPred] = { total: 0, favWin: 0, draw: 0, udogWin: 0 };
      }
      recordOutcome(subPredStats[subPred]);
    }

    // PAA prediction breakdowns
    if (paaPred) {
      if (!paaPredStats[paaPred]) {
        paaPredStats[paaPred] = { total: 0, favWin: 0, draw: 0, udogWin: 0 };
      }
      recordOutcome(paaPredStats[paaPred]);
    }
  });

  printPattern("PAA / ALGO Agreement (Any overlap)", paaAlgoAgree);
  printPattern("PAA / ALGO Disagreement (No overlap)", paaAlgoDisagree);
  printPattern("SEER (Default Weights) / ALGO Agreement", seerAlgoAgree);
  printPattern("Sub Pattern / PAA Agreement", subPaaAgree);
  printPattern("Triple Agreement (PAA, ALGO, and Sub Pattern all overlap)", tripleAgree);

  console.log("-------------------------------------------------------------------------");
  console.log("📈 PART B: BREAKDOWN BY SPECIFIC PREDICTIONS");
  console.log("-------------------------------------------------------------------------");
  
  console.log("\n--- Sub Pattern Prediction Breakdown ---");
  Object.keys(subPredStats).sort().forEach(pred => {
    printPattern(`When Sub Pattern predicts [${pred}]`, subPredStats[pred]);
  });

  console.log("\n--- PAA Prediction Breakdown ---");
  Object.keys(paaPredStats).sort().forEach(pred => {
    printPattern(`When PAA predicts [${pred}]`, paaPredStats[pred]);
  });

  // 4. Weight Optimization for Best Bet matches
  console.log("-------------------------------------------------------------------------");
  console.log("🏋️ PART C: WEIGHT COMBINATION SIMULATION ENGINE");
  console.log("-------------------------------------------------------------------------");
  console.log("Running optimization search to find weight combinations that select");
  console.log("the top 10 matches with the absolute highest accuracy (safest, lowest underdog wins)...\n");

  // We want to rank and select the top 10 matches for Best Bet category using custom weights
  // and see how many of them succeed (Fav Win or Draw).
  // Let's define the search space.
  // We can vary:
  // - paaPredWeight (e.g., 20, 50, 93)
  // - algoWeight (e.g., 10, 35, 60)
  // - subPatternWeight (e.g., 10, 20, 40)
  // - probConfWeight (e.g., 10, 30, 50)
  // - agreement boosts (paaAlgoAgreementBoost, subPattPaaAgreementBoost, paaAlgoSubPattAgreementBoost)

  // To simulate how slips are selected:
  // In each simulation run:
  // 1. Compute slip score for each of the 1533 Best Bet matches under the candidate weights.
  // 2. Sort matches by score descending.
  // 3. Select the top 10 matches (handling deduplication of teams just like the real code).
  // 4. Calculate the Favorite Win or Draw accuracy of these top 10 matches.
  // 5. Calculate the Favorite Win only (Pure) accuracy of these top 10 matches.

  // Let's define a helper to simulate selection for a specific weight config:
  const runSimulationSelection = (weights: typeof DEFAULT_WEIGHTS): { selected: Match[], successPct: number, pureFavPct: number } => {
    // Score all best bet matches
    const scored = bestBetMatches.map(m => {
      // Re-run predictSeerDetailed to get the candidate prediction and scores
      const seerResult = predictSeerDetailed(m, weights, phaStatsMap, {}, 'best_bet');
      const seerPred = seerResult.final;

      // Calculate score exactly like slip selection:
      // score = getSeerScoreForPrediction(m, seerPred, weights, phaStatsMap, matchStars) + Priority + agreementBoosts + supremeTier + etc.
      // Let's simplify and use the actual getMatchScore or predictWithSeer
      let score = 0;
      // Get score of the predicted option
      if (seerPred.includes('1')) score += predictSeerDetailed(m, weights, phaStatsMap, {}, 'best_bet').percentages['1'] || 0;
      if (seerPred.includes('X')) score += predictSeerDetailed(m, weights, phaStatsMap, {}, 'best_bet').percentages['X'] || 0;
      if (seerPred.includes('2')) score += predictSeerDetailed(m, weights, phaStatsMap, {}, 'best_bet').percentages['2'] || 0;

      // Add agreement boosts
      const paaPred = m.paaPrediction || m.paaPrimaryPrediction || '';
      const liveAlgoReport = (m as any)._liveAlgoReport || { prediction: '' };
      const algoPred = liveAlgoReport.prediction || '';
      const subPred = m.patternAnalysis?.subPatternPrediction || '';

      const isPaaAgree = paaPred.includes(seerPred);
      const isAlgoAgree = algoPred.includes(seerPred);
      const isSubPattAgree = subPred.includes(seerPred);

      if (isPaaAgree && isAlgoAgree) score += weights.paaAlgoAgreementBoost || 0;
      if (isSubPattAgree && isPaaAgree) score += weights.subPattPaaAgreementBoost || 0;
      if (isPaaAgree && isAlgoAgree && isSubPattAgree) score += weights.paaAlgoSubPattAgreementBoost || 0;

      // Primary tag boost
      // Since all these matches already have best_bet tags, we don't need tag boosts since it's uniform.
      
      // Group penalty check
      const group = (m as any).group || ((m as any).patternAnalysis?.group) || (m as any).pattern?.group || 3;
      if (group === 3) {
        const stats = m.patternAnalysis ? { probFav: m.patternAnalysis.probFav || 0, phaFavWinSupport: m.patternAnalysis.phaFavWinSupport || 0 } : { probFav: 0, phaFavWinSupport: 0 };
        const moFav = (m as any)._moFav || '1';
        const probFav = stats.probFav;
        const paaSW = stats.phaFavWinSupport;
        const seerScoreFav = seerResult.percentages[moFav] || 0;
        if (probFav < 50 && seerScoreFav < 50 && paaSW < 50) {
          score -= 200;
        }
      }

      // Best bet specific boost
      const stats = m.patternAnalysis ? { probFav: m.patternAnalysis.probFav || 0, phaFavWinSupport: m.patternAnalysis.phaFavWinSupport || 0 } : { probFav: 0, phaFavWinSupport: 0 };
      const moFav = (m as any)._moFav || '1';
      const seerScoreFav = seerResult.percentages[moFav] || 0;
      if (seerScoreFav >= 55 && stats.probFav >= 55 && (stats.phaFavWinSupport || 0) >= 55) {
        score += 500;
      }

      return { m, score };
    });

    // Sort scored
    scored.sort((a, b) => b.score - a.score);

    // Select top 10
    const selected: Match[] = [];
    for (const item of scored) {
      if (selected.length >= 10) break;
      const m = item.m;
      // Deduplicate teams
      const normMTeams = m.teams.toLowerCase().replace(/[^a-z0-9]/g, '');
      const alreadyIn = selected.some(p => 
        p.id.toString() === m.id.toString() ||
        p.teams.toLowerCase().replace(/[^a-z0-9]/g, '') === normMTeams
      );
      if (!alreadyIn) {
        selected.push(m);
      }
    }

    // Evaluate selected
    let successes = 0;
    let pureFavWins = 0;
    selected.forEach(m => {
      const actual = getActualResult(m.result || '');
      const favInfo = getFavoriteAndUnderdog(m);
      if (!favInfo) return;
      const { fav: moFav } = favInfo;

      if (actual === moFav) {
        successes++;
        pureFavWins++;
      } else if (actual === 'X') {
        successes++;
      }
    });

    return {
      selected,
      successPct: (successes / selected.length) * 100,
      pureFavPct: (pureFavWins / selected.length) * 100
    };
  };

  // Define some configurations to test
  // 1. Current weights
  const currentBestBetWeights: typeof DEFAULT_WEIGHTS = {
    algoWeight: 35,
    paaPredWeight: 93,
    subPatternWeight: 12,
    probConfWeight: 10,
    phaWeight: 10,
    paaPercentWeight: 6,
    perfStarsWeight: 15,
    pred1x2Weight: 10,
    pred1x2RatingBoost: 5,
    drawDisagreementBoost: 5,
    synergyAgreementBoost: 100,
    synergyCondA: 800,
    synergyCondB: 750,
    synergyCondC: 200,
    synergyCondD: 400,
    synergyCondE: 200,
    synergyGapBoost: 750,
    upsetPaaBoost: 0,
    upsetProbBoost: 0,
    upsetSeerPrimBoost: 0,
    upsetPatternBoost: 0,
    paaAlgoAgreementBoost: 15,
    subPattPaaAgreementBoost: 15,
    paaAlgoSubPattAgreementBoost: 20
  };

  const currentSim = runSimulationSelection(currentBestBetWeights);
  console.log(`Current Best Bet Configuration (PAA 93, Algo 35, SubPattern 12, Prob 10):`);
  console.log(`👉 Selected Top 10 matches:`);
  currentSim.selected.forEach((m, idx) => {
    const favInfo = getFavoriteAndUnderdog(m);
    console.log(`   ${idx+1}. ${m.teams} | Odds: ${m.mo} | Result: ${m.result} | Fav Win or Draw: ${getActualResult(m.result) === favInfo?.fav || getActualResult(m.result) === 'X' ? '✅ SUCCESS' : '❌ FAIL'}`);
  });
  console.log(`👉 Selection Success Rate (Fav Win or Draw): ${currentSim.successPct.toFixed(1)}%`);
  console.log(`👉 Pure Favorite Win Rate:                 ${currentSim.pureFavPct.toFixed(1)}%\n`);

  // Let's find highly optimized configurations
  // Let's test a list of custom weighting variations:
  const testScenarios = [
    {
      name: "Equal High Agreement Focus (Paa 45, Algo 45, SubPattern 45, Boosts 80)",
      weights: {
        ...currentBestBetWeights,
        paaPredWeight: 45,
        algoWeight: 45,
        subPatternWeight: 45,
        paaAlgoAgreementBoost: 80,
        subPattPaaAgreementBoost: 80,
        paaAlgoSubPattAgreementBoost: 100
      }
    },
    {
      name: "PAA-Anchored with High Synergy (Paa 90, Algo 20, SubPattern 10, Synergy Boost 150)",
      weights: {
        ...currentBestBetWeights,
        paaPredWeight: 90,
        algoWeight: 20,
        subPatternWeight: 10,
        synergyAgreementBoost: 150,
        paaAlgoAgreementBoost: 40,
        subPattPaaAgreementBoost: 40
      }
    },
    {
      name: "Probability and Stars heavy (Prob 60, Stars 40, Paa 40, Algo 20)",
      weights: {
        ...currentBestBetWeights,
        probConfWeight: 60,
        perfStarsWeight: 40,
        paaPredWeight: 40,
        algoWeight: 20,
        subPatternWeight: 10
      }
    },
    {
      name: "Perfect Agreement Shield (Paa 95, Algo 5, SubPattern 5, Agreements 120)",
      weights: {
        ...currentBestBetWeights,
        paaPredWeight: 95,
        algoWeight: 5,
        subPatternWeight: 5,
        paaAlgoAgreementBoost: 120,
        subPattPaaAgreementBoost: 120,
        paaAlgoSubPattAgreementBoost: 150
      }
    },
    {
      name: "Pure Agreement Engine (Paa 30, Algo 30, SubPattern 30, Boosts 150)",
      weights: {
        ...currentBestBetWeights,
        paaPredWeight: 30,
        algoWeight: 30,
        subPatternWeight: 30,
        paaAlgoAgreementBoost: 150,
        subPattPaaAgreementBoost: 150,
        paaAlgoSubPattAgreementBoost: 200
      }
    }
  ];

  let bestScenario = { name: "Current", successPct: currentSim.successPct, pureFavPct: currentSim.pureFavPct, weights: currentBestBetWeights };

  testScenarios.forEach(scen => {
    const sim = runSimulationSelection(scen.weights);
    console.log(`Scenario: ${scen.name}`);
    console.log(`👉 Top 10 Selection Success Rate (Fav Win or Draw): ${sim.successPct.toFixed(1)}%`);
    console.log(`👉 Pure Favorite Win Rate:                 ${sim.pureFavPct.toFixed(1)}%\n`);

    if (sim.successPct > bestScenario.successPct || (sim.successPct === bestScenario.successPct && sim.pureFavPct > bestScenario.pureFavPct)) {
      bestScenario = { name: scen.name, successPct: sim.successPct, pureFavPct: sim.pureFavPct, weights: scen.weights };
    }
  });

  // Let's do a micro grid search to find a combination that hits 100% success rate!
  console.log("-------------------------------------------------------------------------");
  console.log("🔍 GRID SEARCH OVER PARAMETER COMBINATIONS");
  console.log("-------------------------------------------------------------------------");
  console.log("Searching for any combinations of [paaPredWeight, algoWeight, subPatternWeight, agreementBoosts] that achieve 100% Selection Success...");

  const paaOptions = [30, 50, 70, 90];
  const algoOptions = [10, 30, 50];
  const subOptions = [10, 20, 40];
  const boostOptions = [20, 60, 100];

  let found100Count = 0;
  const successfulScenarios: any[] = [];

  for (const paa of paaOptions) {
    for (const algo of algoOptions) {
      for (const sub of subOptions) {
        for (const boost of boostOptions) {
          const testW = {
            ...currentBestBetWeights,
            paaPredWeight: paa,
            algoWeight: algo,
            subPatternWeight: sub,
            paaAlgoAgreementBoost: boost,
            subPattPaaAgreementBoost: boost,
            paaAlgoSubPattAgreementBoost: boost + 20
          };

          const sim = runSimulationSelection(testW);
          if (sim.successPct === 100) {
            found100Count++;
            successfulScenarios.push({
              paa,
              algo,
              sub,
              boost,
              pureFavPct: sim.pureFavPct,
              weights: testW
            });
          }
        }
      }
    }
  }

  console.log(`Found ${found100Count} weight combinations that yield exactly 100% Success Rate (Fav Win or Draw) for the selected Top 10 matches!`);
  
  if (successfulScenarios.length > 0) {
    // Sort by highest pure favorite win rate
    successfulScenarios.sort((a, b) => b.pureFavPct - a.pureFavPct);
    console.log("\nTop 3 Weighting Configurations with 100% Success (Fav Win or Draw) and highest Pure Favorite Win Rate:\n");

    successfulScenarios.slice(0, 3).forEach((scen, idx) => {
      console.log(`🏆 OPTIMIZED OPTION #${idx+1} (Pure Fav Win Rate: ${scen.pureFavPct.toFixed(1)}%)`);
      console.log(`   - PAA Prediction (Base):       ${scen.paa}`);
      console.log(`   - Algo Prediction (Audit):     ${scen.algo}`);
      console.log(`   - Sub Pattern Pred (Synergy):  ${scen.sub}`);
      console.log(`   - Agreement Boost:             ${scen.boost}`);
      console.log(`   - Triple Agreement Boost:      ${scen.boost + 20}`);
      console.log();
    });
  }

  console.log("=========================================================================");
  console.log("🏁 RESEARCH COMPLETED SUCCESSFULLY");
  console.log("=========================================================================");
}

main().catch(console.error);
