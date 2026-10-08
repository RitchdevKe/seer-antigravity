import { supabase } from '../src/lib/supabase';
import { processMatch, getActualResult, getFavoriteAndUnderdog } from '../src/utils/matchProcessing';
import { getMatchEvaluatorTags, getMatchStats } from '../src/utils/matchEvaluator';
import { predictSeerDetailed } from '../src/utils/seerLogic';
import { getPAAPredictionForSeer, generateSeerSlips } from '../src/utils/seerSlipSelection';
import { Match } from '../src/types';
import seerWeights from '../src/utils/seerWeights.json';

// Mock localStorage for Node environment
if (typeof global !== 'undefined') {
  (global as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}

function safeGetResult(m: Match): string {
  if (!m || !m.result) return 'pending';
  const resStr = String(m.result);
  return getActualResult(resStr);
}

async function analyze() {
  console.log("=================================================");
  console.log("🔍 AGENT AUDIT: TOP 12 VALUE SLIP & ALL CANDIDATES");
  console.log("=================================================\n");

  const allMatches: Match[] = [];

  // 1. Fetch precalculated matches
  let from = 0;
  const step = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('precalculated_matches')
      .select('id, data')
      .range(from, from + step - 1);
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach(row => { if (row.data) allMatches.push(row.data as Match); });
      if (data.length < step) hasMore = false;
      else from += step;
    }
  }

  // 2. Fetch user uploaded matches
  from = 0;
  hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('user_uploaded_matches')
      .select('id, data')
      .range(from, from + step - 1);
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach(row => { if (row.data) allMatches.push(row.data as Match); });
      if (data.length < step) hasMore = false;
      else from += step;
    }
  }

  // 3. Fetch live matches
  from = 0;
  hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('live_matches')
      .select('id, data')
      .range(from, from + step - 1);
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach(row => { if (row.data) allMatches.push(row.data as Match); });
      if (data.length < step) hasMore = false;
      else from += step;
    }
  }

  console.log(`Total database matches retrieved: ${allMatches.length}`);

  // Deduplicate by ID or team name + date
  const uniqueMatchesMap = new Map<string, Match>();
  allMatches.forEach(m => {
    if (m && m.id) uniqueMatchesMap.set(m.id.toString(), m);
  });
  const matches = Array.from(uniqueMatchesMap.values());
  console.log(`Unique matches across DB: ${matches.length}`);

  // Fetch PHA stats map
  let phaStatsMap: Record<string, any> = {};
  try {
    const { data: phaData } = await supabase.from('pha_stats').select('*');
    if (phaData && phaData.length > 0) {
      phaData.forEach(row => {
        if (row.sub_pattern) phaStatsMap[row.sub_pattern] = row;
      });
    }
  } catch (e) {
    console.log("No remote pha_stats table");
  }

  // Filter matches with top10 tag or market fav odds 2.00 - 2.49
  const top10TaggedMatches: Match[] = [];
  matches.forEach(m => {
    const processed = processMatch(m);
    const tags = getMatchEvaluatorTags(processed, phaStatsMap);
    const hasTop10Tag = tags.some(t => t.startsWith('top10:'));
    const stats = getMatchStats(processed, phaStatsMap);
    if (hasTop10Tag || (stats.favOdds >= 2.0 && stats.favOdds <= 2.49)) {
      top10TaggedMatches.push(processed);
    }
  });

  console.log(`\nFound ${top10TaggedMatches.length} Top 12 (top10 / 2.00-2.49 odds) candidate matches.`);

  // Analyze actual outcomes distribution among all candidate matches that have completed scores
  let favWins = 0, draws = 0, underdogWins = 0, pending = 0;
  top10TaggedMatches.forEach(m => {
    const actual = safeGetResult(m);
    const stats = getMatchStats(m, phaStatsMap);
    if (!actual || actual === 'pending' || actual === 'UNKNOWN') {
      pending++;
      return;
    }
    if (actual === stats.moFav) favWins++;
    else if (actual === 'X') draws++;
    else if (actual === stats.moUnderdog) underdogWins++;
  });

  console.log(`Completed outcomes among top 12 candidate matches in DB:`);
  console.log(`  - Fav Wins: ${favWins}`);
  console.log(`  - Draws: ${draws}`);
  console.log(`  - Underdog Wins: ${underdogWins}`);
  console.log(`  - Pending/Uncompleted: ${pending}`);
  if (favWins + draws + underdogWins > 0) {
    console.log(`  - Non-Underdog Safe Rate (Fav + Draw): ${((favWins + draws) / (favWins + draws + underdogWins) * 100).toFixed(1)}% (${favWins + draws} / ${favWins + draws + underdogWins})`);
  }

  // Run the full slip generation logic to get the Top 12 slip
  const slips = generateSeerSlips(top10TaggedMatches, phaStatsMap, {}, false, true);
  const top12Slip = slips.spec.top_10_value || slips.live?.top_10_value || [];

  console.log(`\n=================================================`);
  console.log(`📋 CURRENT TOP 12 SLIP SELECTION BREAKDOWN (${top12Slip.length} PICKS)`);
  console.log(`=================================================\n`);

  top12Slip.forEach((pick, idx) => {
    const origMatch = top10TaggedMatches.find(m => m.id.toString() === pick.match_id) || matches.find(m => m.id.toString() === pick.match_id);
    if (!origMatch) {
      console.log(`[${idx+1}] Match ID: ${pick.match_id} | Team: ${pick.team}`);
      return;
    }
    const stats = getMatchStats(origMatch, phaStatsMap);
    const actual = safeGetResult(origMatch);
    const isUnderdogLoss = actual === stats.moUnderdog;
    const isFavWin = actual === stats.moFav;
    const isDraw = actual === 'X';

    const paaObj = getPAAPredictionForSeer(origMatch, phaStatsMap);
    const detailedSeer = predictSeerDetailed(origMatch, (seerWeights as any).daily_top_10_value || {}, phaStatsMap, {});

    console.log(`Pick ${idx+1}: ${origMatch.teams} (${origMatch.league || 'League'})`);
    console.log(`  - Pick Prediction: ${pick.prediction} | Actual Result: ${actual} | Outcome Type: ${isUnderdogLoss ? '❌ UNDERDOG LOSS' : (isFavWin ? '✅ FAV WIN' : (isDraw ? '🤝 DRAW' : 'PENDING'))}`);
    console.log(`  - Fav Odds: ${stats.favOdds} | Underdog Odds: ${stats.underdogOdds}`);
    console.log(`  - Market Fav: ${stats.moFav} | Market Underdog: ${stats.moUnderdog}`);
    console.log(`  - Probabilities: Fav=${(stats.probFav*100).toFixed(1)}%, Underdog=${((stats.probUnderdog||0)*100).toFixed(1)}%, Draw=${((stats.probDraw||0)*100).toFixed(1)}%`);
    console.log(`  - SEER Percentages: 1=${detailedSeer.percentages['1']}%, X=${detailedSeer.percentages['X']}%, 2=${detailedSeer.percentages['2']}%`);
    console.log(`  - PAA Prediction: Final=${paaObj.paaFinal}, Primary=${paaObj.paaPrimary}`);
    console.log(`  - PHA Fav Support: ${(stats.phaFavWinSupport || 0).toFixed(1)}% | Upset Rate: ${(stats.paaStats?.upsetRate || 0).toFixed(1)}% | Sample Size: ${stats.paaStats?.total || stats.totalMatches || 0}`);
    console.log(`  - SubPattern: ${origMatch.patternAnalysis?.subPattern || 'None'} | SubPattern Pred: ${origMatch.patternAnalysis?.subPatternPrediction || 'None'}`);
    console.log(`  - Algo Pred: ${origMatch.algoReport?.prediction || 'None'}`);
    console.log(`  - Selection Reason: ${pick.reason}`);
    console.log(`-------------------------------------------------`);
  });

  // Comprehensive statistical agent study on all candidate matches to discover exact non-underdog metrics
  console.log(`\n=================================================`);
  console.log(`🔬 AGENT FEATURE CORRELATION AUDIT (ALL TOP 12 CANDIDATES)`);
  console.log(`=================================================\n`);

  function evaluateFilter(name: string, predicate: (m: Match, stats: any, detailedSeer: any, paaObj: any) => boolean) {
    let matchCount = 0;
    let safeCount = 0;
    let lossCount = 0;

    top10TaggedMatches.forEach(m => {
      const actual = safeGetResult(m);
      if (!actual || actual === 'pending' || actual === 'UNKNOWN') return;
      const stats = getMatchStats(m, phaStatsMap);
      const detailedSeer = predictSeerDetailed(m, (seerWeights as any).daily_top_10_value || {}, phaStatsMap, {});
      const paaObj = getPAAPredictionForSeer(m, phaStatsMap);

      if (predicate(m, stats, detailedSeer, paaObj)) {
        matchCount++;
        if (actual === stats.moFav || actual === 'X') safeCount++;
        else if (actual === stats.moUnderdog) lossCount++;
      }
    });

    const winRate = matchCount > 0 ? ((safeCount / matchCount) * 100).toFixed(1) : 'N/A';
    console.log(`Filter: [${name}]`);
    console.log(`  Matches Matched: ${matchCount} | Fav/Draw Safe: ${safeCount} (${winRate}%) | Underdog Loss: ${lossCount}\n`);
  }

  evaluateFilter("Fav Prob >= 50%", (m, s) => s.probFav >= 0.50);
  evaluateFilter("Fav Prob >= 55%", (m, s) => s.probFav >= 0.55);
  evaluateFilter("Upset Rate <= 15%", (m, s) => (s.paaStats?.upsetRate || 0) <= 15);
  evaluateFilter("Upset Rate <= 10%", (m, s) => (s.paaStats?.upsetRate || 0) <= 10);
  evaluateFilter("PHA Fav Support >= 60%", (m, s) => (s.phaFavWinSupport || 0) >= 60);
  evaluateFilter("PHA Fav Support >= 70%", (m, s) => (s.phaFavWinSupport || 0) >= 70);
  evaluateFilter("Sample Size (paaTotal) >= 10", (m, s) => (s.paaStats?.total || s.totalMatches || 0) >= 10);
  evaluateFilter("PAA Pred contains Market Fav", (m, s, ds, paa) => paa.paaFinal.includes(s.moFav));
  evaluateFilter("SubPattern Pred contains Market Fav", (m, s) => (m.patternAnalysis?.subPatternPrediction || '').includes(s.moFav));
  evaluateFilter("Algo Pred contains Market Fav", (m, s) => (m.algoReport?.prediction || '').includes(s.moFav));
  evaluateFilter("PAA + Algo BOTH contain Market Fav", (m, s, ds, paa) => paa.paaFinal.includes(s.moFav) && (m.algoReport?.prediction || '').includes(s.moFav));
  evaluateFilter("PAA + SubPattern BOTH contain Market Fav", (m, s, ds, paa) => paa.paaFinal.includes(s.moFav) && (m.patternAnalysis?.subPatternPrediction || '').includes(s.moFav));
  evaluateFilter("TRIPLE CONSENSUS (PAA + Algo + SubPattern all include Fav)", (m, s, ds, paa) => 
    paa.paaFinal.includes(s.moFav) && 
    (m.algoReport?.prediction || '').includes(s.moFav) && 
    (m.patternAnalysis?.subPatternPrediction || '').includes(s.moFav)
  );
  evaluateFilter("SEER Fav Percentage >= 50%", (m, s, ds) => ds.percentages[s.moFav] >= 50);
  evaluateFilter("SEER Fav Percentage >= 55%", (m, s, ds) => ds.percentages[s.moFav] >= 55);
  evaluateFilter("SAFE HARBOR GATEWAY (Fav Prob >= 48% AND Upset Rate <= 12% AND Sample Size >= 6 AND PAA includes Fav)", (m, s, ds, paa) => 
    s.probFav >= 0.48 && 
    (s.paaStats?.upsetRate || 0) <= 12 && 
    (s.paaStats?.total || s.totalMatches || 0) >= 6 && 
    paa.paaFinal.includes(s.moFav)
  );
}

analyze().catch(err => console.error("Error in agent script:", err));
