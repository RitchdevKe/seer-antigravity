import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { processMatch, getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { Match } from '../src/types';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';

async function main() {
  console.log("=========================================================================");
  console.log("🧪 HYBRID ML BACKTESTING ON LIVE MATCHES");
  console.log("=========================================================================\n");

  // Fetch live matches from Supabase
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

  const completedMatches = allLiveMatches.filter(m => getActualResult(m.result || '') !== 'pending');

  console.log(`✅ Loaded ${completedMatches.length} completed matches from live_matches\n`);

  if (completedMatches.length === 0) {
    console.log("No completed matches to test.");
    return;
  }

  let paaCorrect = 0;
  let hybridMlCorrect = 0;
  let algoCorrect = 0;
  let subPatternCorrect = 0;
  let paaPlusMlCorrect = 0;
  
  let totalMatches = completedMatches.length;

  let hybridOverridesTriggered = 0;
  let hybridOverridesCorrect = 0;
  const triggerStats: Record<string, { total: number, correct: number }> = {};

  console.log("Analyzing matches...\n");

  completedMatches.forEach((m, idx) => {
    const actualResult = getActualResult(m.result || '');
    
    // Strip precalculated flags to force re-evaluation with current code
    const cleanM = JSON.parse(JSON.stringify(m));
    delete cleanM.isPrecalculated;
    delete cleanM.finalPrediction;
    
    // Process match normally to get base predictions
    const processed = processMatch(cleanM);

    const algoPred = processed.algoReport?.prediction || processed.rawPrediction || '1X';
    const subPatternPred = processed.patternAnalysis?.subPatternPrediction || processed.rawPrediction || '1X';
    const paaPred = processed.paaPrediction || '1X';
    const finalPred = processed.finalPrediction || '1X';

    // The hybrid ML override logic is built into processMatch -> patternAnalysis
    const hybridMlInfo = predictWithHybridML(processed);

    const isAlgoCorrect = matchesPrediction(algoPred, actualResult);
    const isSubCorrect = matchesPrediction(subPatternPred, actualResult);
    const isPaaCorrect = matchesPrediction(paaPred, actualResult);
    const isFinalCorrect = matchesPrediction(finalPred, actualResult);
    
    let paaPlusMlPred = paaPred;
    if (hybridMlInfo.mlApplied && hybridMlInfo.mlPrediction) {
        paaPlusMlPred = hybridMlInfo.mlPrediction;
    }
    const isPaaPlusMlCorrect = matchesPrediction(paaPlusMlPred, actualResult);

    if (isAlgoCorrect) algoCorrect++;
    if (isSubCorrect) subPatternCorrect++;
    if (isPaaCorrect) paaCorrect++;
    if (isFinalCorrect) hybridMlCorrect++;
    if (isPaaPlusMlCorrect) paaPlusMlCorrect++;

    if (hybridMlInfo.mlApplied) {
        hybridOverridesTriggered++;
        const mlCorrect = matchesPrediction(hybridMlInfo.mlPrediction, actualResult);
        if (mlCorrect) hybridOverridesCorrect++;
        
        // Use a regex or prefix to categorize the rule.
        const ruleMatch = hybridMlInfo.mlReasoning.match(/\[(.*?)\]/);
        const ruleName = ruleMatch ? ruleMatch[1] : 'Unknown';
        if (!triggerStats[ruleName]) triggerStats[ruleName] = { total: 0, correct: 0 };
        triggerStats[ruleName].total++;
        if (mlCorrect) triggerStats[ruleName].correct++;
    }
  });

  console.log("=========================================================================");
  console.log("🏆 PERFORMANCE RESULTS");
  console.log("=========================================================================");
  console.log(`Total Completed Matches Scanned:  ${totalMatches}`);
  console.log(`Algo Prediction Accuracy:         ${algoCorrect}/${totalMatches} (${((algoCorrect/totalMatches)*100).toFixed(1)}%)`);
  console.log(`Sub-Pattern Accuracy:             ${subPatternCorrect}/${totalMatches} (${((subPatternCorrect/totalMatches)*100).toFixed(1)}%)`);
  console.log(`PAA Accuracy (Benchmark):         ${paaCorrect}/${totalMatches} (${((paaCorrect/totalMatches)*100).toFixed(1)}%)`);
  console.log(`Hybrid ML SEER Final Accuracy:    ${hybridMlCorrect}/${totalMatches} (${((hybridMlCorrect/totalMatches)*100).toFixed(1)}%)`);
  console.log(`PAA + Hybrid ML Accuracy:         ${paaPlusMlCorrect}/${totalMatches} (${((paaPlusMlCorrect/totalMatches)*100).toFixed(1)}%)`);
  
  console.log("\n-------------------------------------------------------------------------");
  console.log("🎯 HYBRID ML OVERRIDES STATS");
  console.log("-------------------------------------------------------------------------");
  console.log(`Total Overrides Triggered:        ${hybridOverridesTriggered}`);
  if (hybridOverridesTriggered > 0) {
      console.log(`Override Accuracy:                ${hybridOverridesCorrect}/${hybridOverridesTriggered} (${((hybridOverridesCorrect/hybridOverridesTriggered)*100).toFixed(1)}%)`);
      Object.entries(triggerStats).forEach(([rule, stat]) => {
          console.log(`  -> ${rule}: ${stat.correct}/${stat.total} (${((stat.correct/stat.total)*100).toFixed(1)}%)`);
      });
  }
}

main().catch(console.error);
