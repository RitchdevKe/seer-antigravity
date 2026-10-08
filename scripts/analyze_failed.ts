import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';

async function analyzeFailed() {
  const { data: res } = await supabase.from('live_matches')
    .select('data, result')
    .neq('result', '')
    .neq('result', '?-?')
    .neq('result', 'Unknown')
    .neq('result', 'pending');

  let failedMatches = [];
  
  res?.forEach(r => {
    const m = r.data;
    const act = getActualResult(r.result);
    if (act === 'pending' || !m.paaPrediction) return;
    
    // Simulate Hybrid ML Process
    const features = extractMLFeatures(m);
    const tags = generateSITags(features);
    const ml = predictWithHybridML(tags, m.paaPrediction, m);
    
    let finalPrediction = ml.mlApplied ? ml.mlPrediction : m.paaPrediction;
    
    // Auto-sync logic
    if (!m.patternAnalysis?.primaryPrediction && ['1', 'X', '2'].includes(finalPrediction)) {
        // internal sync, doesn't change DC usually
    }

    if (!matchesPrediction(finalPrediction, act)) {
        failedMatches.push({
            teams: m.teams,
            paaPrediction: m.paaPrediction,
            mlPrediction: ml.mlApplied ? ml.mlPrediction : null,
            finalPrediction,
            actual: act,
            tags,
            pattern: m.patternCode
        });
    }
  });

  console.log(`Failed Matches: ${failedMatches.length}`);
  
  // Count most common tags in failed matches
  const tagCounts: Record<string, number> = {};
  const patternCounts: Record<string, number> = {};
  
  failedMatches.forEach(fm => {
      fm.tags.forEach((t: string) => {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
      patternCounts[fm.pattern] = (patternCounts[fm.pattern] || 0) + 1;
  });

  console.log('\nTop 10 Tags in Failed Matches:');
  Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([tag, count]) => console.log(`${tag}: ${count} (${((count/failedMatches.length)*100).toFixed(1)}%)`));

  console.log('\nTop 5 Patterns in Failed Matches:');
  Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([pat, count]) => console.log(`${pat}: ${count} (${((count/failedMatches.length)*100).toFixed(1)}%)`));
}

analyzeFailed();
