import { supabase } from '../src/lib/supabase';
import { RAW_MATCHES } from '../src/constants';
import { processMatch, getActualResult, getFavoriteAndUnderdog, matchesPrediction } from '../src/utils/matchProcessing';
import { predictSeerDetailed, DEFAULT_WEIGHTS } from '../src/utils/seerLogic';
import { Match } from '../src/types';

async function main() {
  console.log("=========================================================================");
  console.log("🧪 SEER COGNITIVE AGENTS & PROTOCOLS AUDIT ENGINE");
  console.log("=========================================================================\n");

  // 1. Fetch live matches from Supabase
  console.log("Fetching live_matches from Supabase...");
  const { data: liveData, error: liveErr } = await supabase
    .from('live_matches')
    .select('id, data, result, date')
    .order('date', { ascending: false });

  if (liveErr) {
    console.error("❌ Failed to fetch live matches:", liveErr);
    return;
  }

  const allLiveMatches = (liveData || []).map(row => {
    const m = row.data as Match;
    if (row.result) m.result = row.result;
    return m;
  });

  const pendingMatches = allLiveMatches.filter(m => getActualResult(m.result || '') === 'pending');
  const completedMatches = allLiveMatches.filter(m => getActualResult(m.result || '') !== 'pending');

  console.log(`✅ Loaded ${allLiveMatches.length} matches from live_matches:`);
  console.log(`   - Pending/Future Matches: ${pendingMatches.length}`);
  console.log(`   - Completed Matches:      ${completedMatches.length}\n`);

  // 2. Fetch completed/historical matches to reconstruct the full sub-pattern stats (phaStatsMap)
  console.log("Fetching historical matches to build accurate sub-pattern stats...");
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

  const allHistoricalMatches = [...precalcMatches, ...uploadedMatches, ...(RAW_MATCHES as Match[])];
  console.log(`✅ Loaded ${allHistoricalMatches.length} historical database and raw matches.`);

  // Deduplicate and process historical matches
  const uniqueMap = new Map<string | number, Match>();
  allHistoricalMatches.forEach(m => {
    if (m.id) {
      const existing = uniqueMap.get(m.id);
      if (!existing || (getActualResult(existing.result || '') === 'pending' && getActualResult(m.result || '') !== 'pending')) {
        uniqueMap.set(m.id, m);
      }
    }
  });

  console.log("Building pattern analysis map (phaStatsMap)...");
  const processedHistory = Array.from(uniqueMap.values()).map(m => {
    if (m.isPrecalculated && m.totalPoints) return m;
    return processMatch(m);
  });

  const phaStatsMap: Record<string, any> = {};
  processedHistory.forEach(m => {
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
  console.log(`✅ Reconstructed phaStatsMap with ${Object.keys(phaStatsMap).length} sub-patterns.\n`);

  // =========================================================================
  // PART A: FUTURE MATCHES PREDICTION ANALYSIS
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("🔮 PART A: AUDITING UPCOMING/FUTURE MATCHES");
  console.log("-------------------------------------------------------------------------");

  if (pendingMatches.length === 0) {
    console.log("No pending (incomplete) matches currently in live_matches to test.\n");
  } else {
    let hyTriggers = 0;
    let ssTriggers = 0;
    let predictedUdogHedge = 0;
    let predictedUdogPure = 0;

    const futureAuditDetails: any[] = [];

    pendingMatches.forEach(m => {
      const sub = m.patternAnalysis?.subPattern;
      const subPred = m.patternAnalysis?.subPatternPrediction || '';

      // Determine favorite and underdog
      const favInfo = getFavoriteAndUnderdog(m);
      if (!favInfo) return;
      const { fav: moFav, underdog: moUnderdog } = favInfo;

      // Predict Seer
      const seerResult = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, {});
      const finalPred = seerResult.final;

      // High Yield Override Check
      const individualPositiveSubs = ["G1q17","G3ff45","G1i18","G2j4","G3gg1","G1f2","G2dd1","G2ee13","G2o11","G3ff44","G2o7","G1jj1","G3g3","G1t4","G2f7","G3b1","G3m1","G1s8","G1s13","G2s16","G1ff50","G2t1","G2i15","G2ff48","G2q15","G1g6","G1r18","G1j13","G1ff32","G3r13","G2ff34"];
      const hyTriggered = !!(sub && individualPositiveSubs.includes(sub) && subPred.includes(moUnderdog));

      // Dynamic Sovereign Safeguard Check (excluding if HY triggered as per our optimization!)
      const delegateList = [
        "G1g16","G2m14","G2g4","G2f20","G2o2","G3a1","G2i13","G2o8","G1ff53","G1i17","G1ff45","G3j4","G3g1","G3p5","G2a3","G2ee9","G1w4","G2ee7","G3s3","G3f14","G1bb2","G1a7","G3j11","G3t12","G3x3"
      ];
      let ssTriggered = false;
      if (sub && !hyTriggered) {
        if (delegateList.includes(sub)) {
          ssTriggered = true;
        } else {
          let minOdds = 2.0;
          if (m.mo && String(m.mo).trim() !== 'NA') {
            const parts = String(m.mo).split(/[,\s:\/\-]+/).filter(p => p.trim() !== '');
            const o1 = parts.length > 0 ? parseFloat(parts[0]) : 0;
            const o2 = parts.length > 2 ? parseFloat(parts[2]) : 0;
            if (!isNaN(o1) && !isNaN(o2)) minOdds = Math.min(o1, o2);
          }
          if (sub === 'G2p10' && minOdds < 2.3) ssTriggered = true;
          else if (sub === 'G3r13' && minOdds < 2.3) ssTriggered = true;
          else if (sub === 'G2ff43' && minOdds < 2.1) ssTriggered = true;
          else if (sub === 'G3j2' && minOdds < 2.1) ssTriggered = true;
          else if (sub === 'G1r18' && minOdds < 1.5) ssTriggered = true;
        }
      }

      if (hyTriggered) hyTriggers++;
      if (ssTriggered) ssTriggers++;

      if (finalPred.includes(moUnderdog)) predictedUdogHedge++;
      if (finalPred === moUnderdog) predictedUdogPure++;

      futureAuditDetails.push({
        teams: m.teams,
        date: m.date,
        sub,
        subPred,
        seerPred: finalPred,
        moUnderdog,
        hyTriggered,
        ssTriggered,
      });
    });

    console.log(`Upcoming Matches Scanned:      ${pendingMatches.length}`);
    console.log(`High-Yield Overrides Active:    ${hyTriggers} (${((hyTriggers/pendingMatches.length)*100).toFixed(1)}%)`);
    console.log(`Sovereign Safeguards Active:    ${ssTriggers} (${((ssTriggers/pendingMatches.length)*100).toFixed(1)}%)`);
    console.log(`Predicted Underdog Win/Hedge:   ${predictedUdogHedge} (${((predictedUdogHedge/pendingMatches.length)*100).toFixed(1)}%)`);
    console.log(`Predicted Pure Underdog Win:    ${predictedUdogPure} (${((predictedUdogPure/pendingMatches.length)*100).toFixed(1)}%)\n`);

    if (futureAuditDetails.length > 0) {
      console.log("Sample of active protocol triggers on future matches:");
      console.log(JSON.stringify(futureAuditDetails.filter(d => d.hyTriggered || d.ssTriggered).slice(0, 10), null, 2));
    }
    console.log();
  }

  // =========================================================================
  // PART B: COMPLETED MATCHES PERFORMANCE AUDIT
  // =========================================================================
  console.log("-------------------------------------------------------------------------");
  console.log("📊 PART B: BACKTESTING COMPLETED MATCHES & UNDERDOG SUCCESS");
  console.log("-------------------------------------------------------------------------");

  if (completedMatches.length === 0) {
    console.log("No completed matches currently in live_matches to run backtest.\n");
  } else {
    let totalMatches = completedMatches.length;
    let totalUnderdogWins = 0;
    let subPatternCorrect = 0;
    let subPatternUdogCorrect = 0;
    let seerCorrect = 0;
    let seerUdogCorrect = 0;

    let hyTriggersCompleted = 0;
    let ssTriggersCompleted = 0;

    const underdogWinsList: any[] = [];

    completedMatches.forEach(m => {
      const actualResult = getActualResult(m.result || '');
      if (actualResult === 'pending') return;

      const favInfo = getFavoriteAndUnderdog(m);
      if (!favInfo) return;
      const { fav: moFav, underdog: moUnderdog } = favInfo;

      const isUdogWin = actualResult === moUnderdog;
      if (isUdogWin) totalUnderdogWins++;

      // Sub Pattern Prediction
      const sub = m.patternAnalysis?.subPattern;
      const subPred = m.patternAnalysis?.subPatternPrediction || '';
      const isSubCorrect = matchesPrediction(subPred, actualResult);
      if (isSubCorrect) {
        subPatternCorrect++;
        if (isUdogWin) subPatternUdogCorrect++;
      }

      // Seer Prediction
      const seerResult = predictSeerDetailed(m, DEFAULT_WEIGHTS, phaStatsMap, {});
      const finalPred = seerResult.final;
      const isSeerCorrect = matchesPrediction(finalPred, actualResult);
      if (isSeerCorrect) {
        seerCorrect++;
        if (isUdogWin) seerUdogCorrect++;
      }

      // Overrides triggers
      const individualPositiveSubs = ["G1q17","G3ff45","G1i18","G2j4","G3gg1","G1f2","G2dd1","G2ee13","G2o11","G3ff44","G2o7","G1jj1","G3g3","G1t4","G2f7","G3b1","G3m1","G1s8","G1s13","G2s16","G1ff50","G2t1","G2i15","G2ff48","G2q15","G1g6","G1r18","G1j13","G1ff32","G3r13","G2ff34"];
      const hyTriggered = !!(sub && individualPositiveSubs.includes(sub) && subPred.includes(moUnderdog));

      const delegateList = [
        "G1g16","G2m14","G2g4","G2f20","G2o2","G3a1","G2i13","G2o8","G1ff53","G1i17","G1ff45","G3j4","G3g1","G3p5","G2a3","G2ee9","G1w4","G2ee7","G3s3","G3f14","G1bb2","G1a7","G3j11","G3t12","G3x3"
      ];
      let ssTriggered = false;
      if (sub && !hyTriggered) {
        if (delegateList.includes(sub)) {
          ssTriggered = true;
        } else {
          let minOdds = 2.0;
          if (m.mo && String(m.mo).trim() !== 'NA') {
            const parts = String(m.mo).split(/[,\s:\/\-]+/).filter(p => p.trim() !== '');
            const o1 = parts.length > 0 ? parseFloat(parts[0]) : 0;
            const o2 = parts.length > 2 ? parseFloat(parts[2]) : 0;
            if (!isNaN(o1) && !isNaN(o2)) minOdds = Math.min(o1, o2);
          }
          if (sub === 'G2p10' && minOdds < 2.3) ssTriggered = true;
          else if (sub === 'G3r13' && minOdds < 2.3) ssTriggered = true;
          else if (sub === 'G2ff43' && minOdds < 2.1) ssTriggered = true;
          else if (sub === 'G3j2' && minOdds < 2.1) ssTriggered = true;
          else if (sub === 'G1r18' && minOdds < 1.5) ssTriggered = true;
        }
      }

      if (hyTriggered) hyTriggersCompleted++;
      if (ssTriggered) ssTriggersCompleted++;

      if (isUdogWin) {
        underdogWinsList.push({
          teams: m.teams,
          date: m.date,
          actual: actualResult,
          fav: moFav,
          udog: moUnderdog,
          subPattern: sub,
          subPred,
          isSubCorrect,
          seerPred: finalPred,
          isSeerCorrect,
          hyTriggered,
          ssTriggered,
        });
      }
    });

    console.log(`Total Completed Matches Scanned:  ${totalMatches}`);
    console.log(`Sub-Pattern Prediction Accuracy:  ${subPatternCorrect}/${totalMatches} (${((subPatternCorrect/totalMatches)*100).toFixed(1)}%)`);
    console.log(`SEER Prediction Accuracy:         ${seerCorrect}/${totalMatches} (${((seerCorrect/totalMatches)*100).toFixed(1)}%)`);
    console.log(`\nUnderdog Wins in Dataset:         ${totalUnderdogWins}`);
    console.log(`Sub-Pattern Underdog Accuracy:    ${subPatternUdogCorrect}/${totalUnderdogWins} (${((subPatternUdogCorrect/totalUnderdogWins)*100).toFixed(1)}%)`);
    console.log(`SEER Underdog Accuracy:           ${seerUdogCorrect}/${totalUnderdogWins} (${((seerUdogCorrect/totalUnderdogWins)*100).toFixed(1)}%)`);
    console.log(`   - High-Yield Overrides Triggered: ${hyTriggersCompleted}`);
    console.log(`   - Sovereign Safeguards Triggered:  ${ssTriggersCompleted}\n`);

    console.log("-------------------------------------------------------------------------");
    console.log("🔍 UNDERDOG WIN DETAILED PROTOCOL ANALYSIS");
    console.log("-------------------------------------------------------------------------");
    underdogWinsList.forEach((item, idx) => {
      console.log(`[Underdog Win #${idx+1}] ${item.teams} (${item.date})`);
      console.log(`   Actual Outcome:  ${item.actual} (Favorite was ${item.fav}, Underdog was ${item.udog})`);
      console.log(`   Sub-pattern:     ${item.subPattern || 'N/A'} (Prediction: "${item.subPred}", Correct: ${item.isSubCorrect})`);
      console.log(`   SEER Prediction: "${item.seerPred}" (Correct: ${item.isSeerCorrect})`);
      console.log(`   Triggers:        High-Yield: ${item.hyTriggered ? 'YES' : 'NO'} | Sovereign-Safeguard: ${item.ssTriggered ? 'YES' : 'NO'}`);
      
      if (item.isSubCorrect && !item.isSeerCorrect) {
        console.log("   ⚠️  DIAGNOSTIC: Sub-pattern got this right, but SEER failed.");
        if (!item.hyTriggered) {
          console.log(`      👉 Reason: Sub-pattern '${item.subPattern}' is NOT in the Selective High-Yield Override list.`);
          console.log(`         Consider adding '${item.subPattern}' to the individualPositiveSubs list in /src/utils/seerLogic.ts to capture this upset!`);
        } else {
          console.log(`      👉 Reason: Sovereign Safeguard or another constraint overrode the prediction.`);
        }
      }
      console.log();
    });
  }

  console.log("=========================================================================");
  console.log("🏁 AUDIT ENGINE CONCLUDED SUCCESSFULLY");
  console.log("=========================================================================");
}

main().catch(console.error);
