import { supabase } from '../src/lib/supabase';
import { processMatch, getActualResult, getFavoriteAndUnderdog } from '../src/utils/matchProcessing';
import { getMatchEvaluatorTags, getMatchStats } from '../src/utils/matchEvaluator';
import { predictSeerDetailed } from '../src/utils/seerLogic';
import { generateSeerSlips, getPAAPredictionForSeer } from '../src/utils/seerSlipSelection';
import { Match } from '../src/types';
import weights from '../src/utils/seerWeights.json';

// Local storage & fetch mock for Node environment
if (typeof global !== 'undefined') {
  (global as any).localStorage = { 
    getItem: () => null, 
    setItem: () => {}, 
    removeItem: () => {}, 
    clear: () => {} 
  };
  (global as any).fetch = async () => ({ ok: true, json: async () => ({}) });
}

async function runAgentAnalysis() {
  console.log("=========================================================================");
  console.log("🤖 REAL AGENT ENGINE: FULL ANALYSIS OF ALL CANDIDATE MATCHES & TOP 12 SLIP");
  console.log("=========================================================================");

  // Step 1: Load all matches from Supabase
  const rawMatches: Match[] = [];
  const step = 1000;

  for (const table of ['precalculated_matches', 'user_uploaded_matches']) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase.from(table).select('id, data').range(from, from + step - 1);
      if (error || !data || data.length === 0) break;
      data.forEach(row => { if (row.data) rawMatches.push(row.data as Match); });
      if (data.length < step) break;
      from += step;
    }
  }

  const uniqueMap = new Map<string, Match>();
  rawMatches.forEach(m => { if (m && m.id) uniqueMap.set(m.id.toString(), m); });
  const allMatches = Array.from(uniqueMap.values()).map(m => processMatch(m));
  console.log(`[Database] Loaded ${allMatches.length} total unique processed matches.`);

  // Step 2: Build complete PHA/PAA Stats Map across all completed matches in database
  const phaStatsMap: Record<string, any> = {};
  allMatches.forEach(m => {
    const sub = m.patternAnalysis?.subPattern;
    if (sub) {
      if (!phaStatsMap[sub]) {
        phaStatsMap[sub] = {
          total: 0,
          paaTotal: 0,
          correct: 0,
          outcomes: { '1': 0, 'X': 0, '2': 0 },
          favWin: 0,
          draw: 0,
          upsetWin: 0
        };
      }
      const actual = getActualResult(m.result ? String(m.result) : '');
      if (actual !== 'pending' && actual !== 'UNKNOWN') {
        phaStatsMap[sub].total++;
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

  console.log(`[PHA Engine] Built stats map for ${Object.keys(phaStatsMap).length} sub-patterns.`);

  // Step 3: Identify Candidate Matches (Odds 2.00 - 2.49 or tagged top10)
  const candidateMatches: Match[] = [];
  allMatches.forEach(m => {
    const tags = getMatchEvaluatorTags(m, phaStatsMap, false, true);
    m.evaluatorTags = tags;
    const hasTop10Tag = tags.some(t => t.startsWith('top10:'));
    const stats = getMatchStats(m, phaStatsMap);
    
    if (hasTop10Tag || (stats.favOdds >= 2.00 && stats.favOdds <= 2.49)) {
      const actual = getActualResult(m.result ? String(m.result) : '');
      if (actual !== 'pending' && actual !== 'UNKNOWN') {
        candidateMatches.push(m);
      }
    }
  });

  console.log(`\n[Dataset] Total Completed Candidate Matches for Top 10 Value: ${candidateMatches.length}`);

  // Classify outcomes: Safe (Fav Win or Draw) vs Upset (Underdog Win)
  const safeMatches: { m: Match; stats: any; actual: string }[] = [];
  const upsetMatches: { m: Match; stats: any; actual: string }[] = [];

  candidateMatches.forEach(m => {
    const stats = getMatchStats(m, phaStatsMap);
    const actual = getActualResult(m.result ? String(m.result) : '');
    if (actual === stats.moFav || actual === 'X') {
      safeMatches.push({ m, stats, actual });
    } else {
      upsetMatches.push({ m, stats, actual });
    }
  });

  const favWinCount = candidateMatches.filter(m => getActualResult(m.result ? String(m.result) : '') === getMatchStats(m, phaStatsMap).moFav).length;
  const drawCount = candidateMatches.filter(m => getActualResult(m.result ? String(m.result) : '') === 'X').length;
  const upsetCount = candidateMatches.filter(m => {
    const st = getMatchStats(m, phaStatsMap);
    const act = getActualResult(m.result ? String(m.result) : '');
    return act === st.moUnderdog;
  }).length;

  console.log(`\n📊 BREAKDOWN OF ALL CANDIDATE MATCHES:`);
  console.log(`- Market Favorite Win: ${favWinCount} (${(favWinCount / candidateMatches.length * 100).toFixed(1)}%)`);
  console.log(`- Draw (X): ${drawCount} (${(drawCount / candidateMatches.length * 100).toFixed(1)}%)`);
  console.log(`- TOTAL SAFE (Fav Win or Draw): ${safeMatches.length} (${(safeMatches.length / candidateMatches.length * 100).toFixed(1)}%)`);
  console.log(`- UPSETS (Underdog Win): ${upsetCount} (${(upsetCount / candidateMatches.length * 100).toFixed(1)}%)`);

  // Step 4: Run Current Seer Slip Generation with overrideWeights to get the 12 picks
  const slips = generateSeerSlips(candidateMatches, phaStatsMap, {}, false, true, weights as any);
  const currentSlipPicks = slips.live?.top_10_value || slips.spec?.top_10_value || [];

  console.log(`\n=========================================================================`);
  console.log(`📋 DETAILED ANALYSIS OF THE MATCHES SELECTED FOR THE TOP 12 SLIP (${currentSlipPicks.length} picks)`);
  console.log(`=========================================================================`);

  let slipFavWins = 0;
  let slipDraws = 0;
  let slipUpsets = 0;

  currentSlipPicks.forEach((p: any, idx: number) => {
    const m = candidateMatches.find(x => x.id.toString() === p.match_id);
    if (!m) return;
    const stats = getMatchStats(m, phaStatsMap);
    const actual = getActualResult(m.result ? String(m.result) : '');
    const isSafe = (actual === stats.moFav || actual === 'X');

    if (actual === stats.moFav) slipFavWins++;
    else if (actual === 'X') slipDraws++;
    else slipUpsets++;

    const seerRes = predictSeerDetailed(m, weights.daily_top_10_value as any, phaStatsMap, {});
    const paaObj = getPAAPredictionForSeer(m, phaStatsMap);
    const paaFinal = paaObj.paaFinal || paaObj.paaPrimary || 'N/A';
    const algoPred = stats.algoPred || 'N/A';
    const subPred = stats.subPatPred || 'N/A';

    // Probabilities
    const probs = m.algoReport?.probabilities || { '1': 0, 'X': 0, '2': 0 };
    const probFav = (stats.moFav === '1' ? probs['1'] : probs['2']) * 100;
    const probDraw = probs['X'] * 100;
    const probUnderdog = (stats.moUnderdog === '1' ? probs['1'] : probs['2']) * 100;

    // Seer score difference
    const scoreFav = seerRes.scores[stats.moFav] || 0;
    const scoreDraw = seerRes.scores['X'] || 0;
    const scoreUnderdog = seerRes.scores[stats.moUnderdog] || 0;
    const seerMargin = scoreFav - scoreUnderdog;

    // PAA / PHA Stats
    const paaFavWinRate = stats.paaStats?.favWinRate ?? stats.phaFavSupport ?? 0;
    const paaUpsetRate = stats.paaStats?.upsetRate ?? stats.phaUnderdogSupport ?? 0;
    const paaTotal = stats.paaStats?.total ?? 0;

    console.log(`\n-------------------------------------------------------------------------`);
    console.log(`Pick #${idx + 1}: ${m.teams} (${m.league || 'League N/A'})`);
    console.log(`  Outcome: Actual=${actual} | Market Fav=${stats.moFav} | Status=${isSafe ? (actual === stats.moFav ? '✅ FAV WIN' : '🤝 DRAW (SAFE)') : '❌ UPSET LOSS'}`);
    console.log(`  Odds: Fav=${stats.favOdds} | X=${stats.oX} | Underdog=${stats.underdogOdds}`);
    console.log(`  Slip Prediction: ${p.prediction} | Primary: ${p.primary_prediction} | Confidence: ${p.confidence}`);
    console.log(`  Predictors: Algo=${algoPred} | PAA=${paaFinal} | SubPattern=${subPred}`);
    console.log(`  Algo Probabilities: Fav=${probFav.toFixed(1)}% | Draw=${probDraw.toFixed(1)}% | Underdog=${probUnderdog.toFixed(1)}%`);
    console.log(`  Seer Scores: Fav(${stats.moFav})=${scoreFav.toFixed(1)} | Draw(X)=${scoreDraw.toFixed(1)} | Underdog(${stats.moUnderdog})=${scoreUnderdog.toFixed(1)} | Margin=${seerMargin.toFixed(1)}`);
    console.log(`  PAA Stats: FavWinRate=${paaFavWinRate.toFixed(1)}% | UpsetRate=${paaUpsetRate.toFixed(1)}% | Sample Size (Total)=${paaTotal}`);
    console.log(`  PHA Support: Fav=${stats.phaStats?.favSupport?.toFixed(1)}% | Draw=${stats.phaStats?.drawSupport?.toFixed(1)}% | Underdog=${stats.phaStats?.underdogSupport?.toFixed(1)}%`);
    console.log(`  Agreements:`);
    console.log(`    - Algo Agrees Fav? ${algoPred.includes(stats.moFav)}`);
    console.log(`    - PAA Agrees Fav? ${paaFinal.includes(stats.moFav)}`);
    console.log(`    - PAA Opposes Fav (Predicts Pure Underdog)? ${!paaFinal.includes(stats.moFav) && paaFinal.includes(stats.moUnderdog)}`);
    console.log(`    - Algo Opposes Fav (Predicts Pure Underdog)? ${!algoPred.includes(stats.moFav) && algoPred.includes(stats.moUnderdog)}`);
  });

  console.log(`\n=========================================================================`);
  console.log(`📊 CURRENT SLIP SUMMARY:`);
  console.log(`   Fav Wins: ${slipFavWins} / ${currentSlipPicks.length}`);
  console.log(`   Draws: ${slipDraws} / ${currentSlipPicks.length}`);
  console.log(`   Safe Picks Total (Fav Win + Draw): ${slipFavWins + slipDraws} / ${currentSlipPicks.length} (${currentSlipPicks.length > 0 ? ((slipFavWins + slipDraws)/currentSlipPicks.length*100).toFixed(1) : 0}%)`);
  console.log(`   Upset Losses: ${slipUpsets} / ${currentSlipPicks.length}`);
  console.log(`=========================================================================`);

  // Step 5: DISCRIMINANT STATISTICAL COMPARISON (SAFE MATCHES vs UPSET MATCHES)
  console.log(`\n=========================================================================`);
  console.log(`🔬 DISCRIMINANT STATISTICAL ANALYSIS: SAFE MATCHES (N=${safeMatches.length}) VS UPSET MATCHES (N=${upsetMatches.length})`);
  console.log(`=========================================================================`);

  function compareFeature(name: string, extractor: (item: { m: Match; stats: any; actual: string }) => number | boolean | string | null) {
    const safeVals: number[] = [];
    const upsetVals: number[] = [];
    const safeDist: Record<string, number> = {};
    const upsetDist: Record<string, number> = {};

    safeMatches.forEach(item => {
      const v = extractor(item);
      if (typeof v === 'number' && !isNaN(v)) safeVals.push(v);
      else if (v !== null && v !== undefined) {
        const key = String(v);
        safeDist[key] = (safeDist[key] || 0) + 1;
      }
    });

    upsetMatches.forEach(item => {
      const v = extractor(item);
      if (typeof v === 'number' && !isNaN(v)) upsetVals.push(v);
      else if (v !== null && v !== undefined) {
        const key = String(v);
        upsetDist[key] = (upsetDist[key] || 0) + 1;
      }
    });

    if (safeVals.length > 0 || upsetVals.length > 0) {
      const avgSafe = safeVals.length > 0 ? (safeVals.reduce((a, b) => a + b, 0) / safeVals.length).toFixed(2) : 'N/A';
      const avgUpset = upsetVals.length > 0 ? (upsetVals.reduce((a, b) => a + b, 0) / upsetVals.length).toFixed(2) : 'N/A';
      const minSafe = safeVals.length > 0 ? Math.min(...safeVals).toFixed(2) : 'N/A';
      const minUpset = upsetVals.length > 0 ? Math.min(...upsetVals).toFixed(2) : 'N/A';
      const maxSafe = safeVals.length > 0 ? Math.max(...safeVals).toFixed(2) : 'N/A';
      const maxUpset = upsetVals.length > 0 ? Math.max(...upsetVals).toFixed(2) : 'N/A';
      console.log(`\n📌 [Metric] ${name}`);
      console.log(`   Safe Avg: ${avgSafe} (Range: ${minSafe} - ${maxSafe}) | Upset Avg: ${avgUpset} (Range: ${minUpset} - ${maxUpset})`);
    } else {
      console.log(`\n📌 [Categorical] ${name}`);
      const formatDist = (d: Record<string, number>, total: number) => 
        Object.entries(d).map(([k, v]) => `${k}:${v}(${(v / total * 100).toFixed(1)}%)`).join(' | ');
      console.log(`   Safe Distribution: ${formatDist(safeDist, safeMatches.length)}`);
      console.log(`   Upset Distribution: ${formatDist(upsetDist, upsetMatches.length)}`);
    }
  }

  compareFeature("Market Favorite Odds", x => x.stats.favOdds);
  compareFeature("Draw Odds", x => x.stats.oX);
  compareFeature("Underdog Odds", x => x.stats.underdogOdds);
  compareFeature("Odds Difference (Underdog Odds - Fav Odds)", x => x.stats.underdogOdds - x.stats.favOdds);

  compareFeature("Algo Prob Fav (%)", x => {
    const p = x.m.algoReport?.probabilities;
    return p ? (x.stats.moFav === '1' ? p['1'] : p['2']) * 100 : null;
  });

  compareFeature("Algo Prob Draw (%)", x => {
    const p = x.m.algoReport?.probabilities;
    return p ? p['X'] * 100 : null;
  });

  compareFeature("Algo Prob Underdog (%)", x => {
    const p = x.m.algoReport?.probabilities;
    return p ? (x.stats.moUnderdog === '1' ? p['1'] : p['2']) * 100 : null;
  });

  compareFeature("Prob Gap (Prob Fav - Prob Underdog) (%)", x => {
    const p = x.m.algoReport?.probabilities;
    if (!p) return null;
    const pFav = (x.stats.moFav === '1' ? p['1'] : p['2']) * 100;
    const pUnd = (x.stats.moUnderdog === '1' ? p['1'] : p['2']) * 100;
    return pFav - pUnd;
  });

  compareFeature("PAA Favorite Win Rate (%)", x => x.stats.paaStats?.favWinRate ?? null);
  compareFeature("PAA Upset Rate (%)", x => x.stats.paaStats?.upsetRate ?? null);
  compareFeature("PAA Sample Size (paaTotal)", x => x.stats.paaStats?.total ?? 0);

  compareFeature("PHA Favorite Support (%)", x => x.stats.phaStats?.favSupport ?? null);
  compareFeature("PHA Draw Support (%)", x => x.stats.phaStats?.drawSupport ?? null);
  compareFeature("PHA Underdog Support (%)", x => x.stats.phaStats?.underdogSupport ?? null);

  compareFeature("Seer Score Favorite", x => {
    const res = predictSeerDetailed(x.m, weights.daily_top_10_value as any, phaStatsMap, {});
    return res.scores[x.stats.moFav] || null;
  });

  compareFeature("Seer Score Underdog", x => {
    const res = predictSeerDetailed(x.m, weights.daily_top_10_value as any, phaStatsMap, {});
    return res.scores[x.stats.moUnderdog] || null;
  });

  compareFeature("Seer Score Margin (Fav - Underdog)", x => {
    const res = predictSeerDetailed(x.m, weights.daily_top_10_value as any, phaStatsMap, {});
    const sf = res.scores[x.stats.moFav] || 0;
    const su = res.scores[x.stats.moUnderdog] || 0;
    return sf - su;
  });

  compareFeature("Does PAA explicitly support Market Favorite? (paaFinal contains moFav)", x => {
    const p = getPAAPredictionForSeer(x.m, phaStatsMap).paaFinal || '';
    return p.includes(x.stats.moFav);
  });

  compareFeature("Does PAA explicitly oppose Market Favorite? (predicts pure moUnderdog)", x => {
    const p = getPAAPredictionForSeer(x.m, phaStatsMap).paaFinal || '';
    return !p.includes(x.stats.moFav) && p.includes(x.stats.moUnderdog);
  });

  compareFeature("Does Algo explicitly support Market Favorite? (algoPred contains moFav)", x => {
    const a = x.stats.algoPred || '';
    return a.includes(x.stats.moFav);
  });

  compareFeature("Does Algo explicitly oppose Market Favorite? (predicts pure moUnderdog)", x => {
    const a = x.stats.algoPred || '';
    return !a.includes(x.stats.moFav) && a.includes(x.stats.moUnderdog);
  });

  compareFeature("Full Predictors Consensus (Algo + PAA + SubPattern ALL support Fav)", x => {
    const a = x.stats.algoPred || '';
    const p = getPAAPredictionForSeer(x.m, phaStatsMap).paaFinal || '';
    const sub = x.stats.subPatPred || '';
    return a.includes(x.stats.moFav) && p.includes(x.stats.moFav) && sub.includes(x.stats.moFav);
  });

  // Step 6: MULTI-PARAMETRIC OPTIMIZATION SEARCH FOR SEER SLIP WEIGHTINGS & RULES
  console.log(`\n=========================================================================`);
  console.log(`🎯 RULE OPTIMIZATION SEARCH ON ALL ${candidateMatches.length} CANDIDATE MATCHES`);
  console.log(`=========================================================================`);

  const optimizationRules = [
    {
      name: "Baseline Rule (Current System)",
      filter: (m: Match, stats: any) => true
    },
    {
      name: "Rule A: Ban PAA opposing Fav (PAA must NOT be pure Underdog)",
      filter: (m: Match, stats: any) => {
        const p = getPAAPredictionForSeer(m, phaStatsMap).paaFinal || '';
        if (p && !p.includes(stats.moFav) && p.includes(stats.moUnderdog)) return false;
        return true;
      }
    },
    {
      name: "Rule B: Ban Algo opposing Fav (Algo must NOT be pure Underdog)",
      filter: (m: Match, stats: any) => {
        const a = stats.algoPred || '';
        if (a && !a.includes(stats.moFav) && a.includes(stats.moUnderdog)) return false;
        return true;
      }
    },
    {
      name: "Rule C: Dual Predictor Agreement (Both Algo & PAA must contain Fav e.g. 1, 1X)",
      filter: (m: Match, stats: any) => {
        const p = getPAAPredictionForSeer(m, phaStatsMap).paaFinal || '';
        const a = stats.algoPred || '';
        return p.includes(stats.moFav) && a.includes(stats.moFav);
      }
    },
    {
      name: "Rule D: PAA Upset Rate <= 20% & Sample Size (paaTotal) >= 5",
      filter: (m: Match, stats: any) => {
        const upsetRate = stats.paaStats?.upsetRate ?? 100;
        const total = stats.paaStats?.total ?? 0;
        return upsetRate <= 20 && total >= 5;
      }
    },
    {
      name: "Rule E: PAA Upset Rate <= 15% + PAA & Algo contain Fav + Underdog Odds > 3.00",
      filter: (m: Match, stats: any) => {
        const upsetRate = stats.paaStats?.upsetRate ?? 100;
        const p = getPAAPredictionForSeer(m, phaStatsMap).paaFinal || '';
        const a = stats.algoPred || '';
        if (upsetRate > 15) return false;
        if (!p.includes(stats.moFav) || !a.includes(stats.moFav)) return false;
        if (stats.underdogOdds <= 3.00) return false;
        return true;
      }
    },
    {
      name: "Rule F: Strict Seer Composite (Dual Predictor Support + UpsetRate <= 18% + Seer Margin >= 100)",
      filter: (m: Match, stats: any) => {
        const p = getPAAPredictionForSeer(m, phaStatsMap).paaFinal || '';
        const a = stats.algoPred || '';
        const upsetRate = stats.paaStats?.upsetRate ?? 100;
        const res = predictSeerDetailed(m, weights.daily_top_10_value as any, phaStatsMap, {});
        const margin = (res.scores[stats.moFav] || 0) - (res.scores[stats.moUnderdog] || 0);

        if (!p.includes(stats.moFav) || !a.includes(stats.moFav)) return false;
        if (upsetRate > 18) return false;
        if (margin < 100) return false;
        return true;
      }
    },
    {
      name: "Rule G: Ultimate Safety Filter (Dual Agreement + UpsetRate <= 15% + Seer Margin >= 200 + Prob Gap >= 10%)",
      filter: (m: Match, stats: any) => {
        const p = getPAAPredictionForSeer(m, phaStatsMap).paaFinal || '';
        const a = stats.algoPred || '';
        const upsetRate = stats.paaStats?.upsetRate ?? 100;
        const res = predictSeerDetailed(m, weights.daily_top_10_value as any, phaStatsMap, {});
        const margin = (res.scores[stats.moFav] || 0) - (res.scores[stats.moUnderdog] || 0);

        const probs = m.algoReport?.probabilities;
        const pFav = probs ? (stats.moFav === '1' ? probs['1'] : probs['2']) * 100 : 0;
        const pUnd = probs ? (stats.moUnderdog === '1' ? probs['1'] : probs['2']) * 100 : 0;
        const gap = pFav - pUnd;

        if (!p.includes(stats.moFav) || !a.includes(stats.moFav)) return false;
        if (upsetRate > 15) return false;
        if (margin < 200) return false;
        if (gap < 10) return false;
        return true;
      }
    }
  ];

  optimizationRules.forEach(rule => {
    const passed = candidateMatches.filter(m => rule.filter(m, getMatchStats(m, phaStatsMap)));
    let safeCount = 0;
    let favWins = 0;
    let draws = 0;
    let upsets = 0;

    passed.forEach(m => {
      const stats = getMatchStats(m, phaStatsMap);
      const actual = getActualResult(m.result ? String(m.result) : '');
      if (actual === stats.moFav) {
        favWins++;
        safeCount++;
      } else if (actual === 'X') {
        draws++;
        safeCount++;
      } else {
        upsets++;
      }
    });

    const safePct = passed.length > 0 ? (safeCount / passed.length * 100).toFixed(1) : '0.0';
    const favWinPct = passed.length > 0 ? (favWins / passed.length * 100).toFixed(1) : '0.0';
    const drawPct = passed.length > 0 ? (draws / passed.length * 100).toFixed(1) : '0.0';
    const upsetPct = passed.length > 0 ? (upsets / passed.length * 100).toFixed(1) : '0.0';

    console.log(`\n-------------------------------------------------------------------------`);
    console.log(`📌 ${rule.name}`);
    console.log(`   Matches Retained: ${passed.length} / ${candidateMatches.length}`);
    console.log(`   Safe Rate (Fav Win or Draw): ${safePct}% (${safeCount}/${passed.length})`);
    console.log(`   Fav Win Rate: ${favWinPct}% (${favWins}/${passed.length}) | Draw Rate: ${drawPct}% (${draws}/${passed.length})`);
    console.log(`   Upset Rate (Underdog Win): ${upsetPct}% (${upsets}/${passed.length})`);
  });

  console.log(`\n=========================================================================\n`);
}

runAgentAnalysis().catch(err => {
  console.error("Fatal error during agent analysis execution:", err);
});
