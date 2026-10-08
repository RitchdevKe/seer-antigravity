import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';

async function testML() {
  const { data: res } = await supabase.from('live_matches')
    .select('data, result')
    .neq('result', '')
    .neq('result', '?-?')
    .neq('result', 'Unknown')
    .neq('result', 'pending');

  let total = 0;
  let oldHits = 0;
  let newHits = 0;

  res?.forEach(r => {
    const m = r.data;
    const act = getActualResult(r.result);
    if (act === 'pending') return;
    
    total++;
    // Old prediction
    const oldPred = m.finalPrediction || m.paaPrediction || m.rawPrediction || '1';
    if (matchesPrediction(oldPred, act)) oldHits++;
    
    // New prediction
    const ml = predictWithHybridML(m);
    // If ML is applied, it overrides
    let newPred = oldPred;
    if (ml.mlApplied && ml.mlPrediction) {
        newPred = ml.mlPrediction;
    }
    
    if (matchesPrediction(newPred, act)) newHits++;
  });

  console.log(`Total Matches: ${total}`);
  console.log(`Old Hit Rate: ${oldHits}/${total} (${((oldHits/total)*100).toFixed(1)}%)`);
  console.log(`New Hit Rate (w/ User Insights & Deep Mined Traps): ${newHits}/${total} (${((newHits/total)*100).toFixed(1)}%)`);
}

testML();
