import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';

async function testFilter90() {
  const { data: res } = await supabase.from('live_matches')
    .select('data, result')
    .neq('result', '')
    .neq('result', '?-?')
    .neq('result', 'Unknown')
    .neq('result', 'pending');

  let total = 0, correct = 0, skipped = 0;
  
  res?.forEach(r => {
    const m = r.data;
    const act = getActualResult(r.result);
    if (act === 'pending' || !m.paaPrediction) return;
    
    const features = extractMLFeatures(m);
    const tags = generateSITags(features);
    
    // VOLATILITY FILTER (The path to 90%)
    // Skip if Draw Trap tags are present but not strong enough to pivot safely
    if (tags.includes('SIk1') || tags.includes('SIk2') || tags.includes('SIe12') || tags.includes('SIo1')) {
        // Highly volatile, skip
        skipped++;
        return;
    }
    
    // If PAA confidence is very low
    if (m.paaWin < 40 && m.paaUpset < 40) {
        skipped++;
        return;
    }

    const ml = predictWithHybridML(tags, m.paaPrediction, m);
    let fp = ml.mlApplied ? ml.mlPrediction : m.paaPrediction;
    
    total++;
    if (matchesPrediction(fp, act)) correct++;
  });

  console.log('Total Scanned:', total + skipped);
  console.log('Skipped (Volatile):', skipped);
  console.log('Matches Played:', total);
  console.log('Accuracy on Played:', (correct/total*100).toFixed(1)+'%', '('+correct+'/'+total+')');
}

testFilter90();
