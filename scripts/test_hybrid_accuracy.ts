import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';

async function testMLAccuracy() {
    console.log("Fetching matches from Supabase...");
    
    // Fetch a large sample of completed matches
    const { data: res } = await supabase.from('live_matches')
        .select('data, result')
        .neq('result', '')
        .neq('result', '?-?')
        .neq('result', 'Unknown')
        .neq('result', 'pending')
        .limit(2000); // Test on 2000 matches

    if (!res || res.length === 0) {
        console.error("No completed matches found.");
        return;
    }

    console.log(`Loaded ${res.length} completed matches`);

    let correctHybrid = 0;
    let appliedCount = 0;
    let fallbackCount = 0;
    
    let stats = {
        hits: 0,
        total: 0
    };

    for (const r of res) {
        const match = r.data;
        // Inject result into match object just in case
        match.result = r.result;

        const actual = getActualResult(r.result);
        if (!actual || actual === 'pending') continue;
        
        // Data-driven ML prediction
        const mlInfo = predictWithHybridML(match);
        let finalPred = match.paaPrediction || match.rawPrediction || '1';
        
        if (mlInfo.mlApplied) {
            appliedCount++;
            finalPred = mlInfo.mlPrediction;
            stats.total++;
            if (matchesPrediction(finalPred, actual)) {
                stats.hits++;
            }
        } else {
            fallbackCount++;
        }

        if (matchesPrediction(finalPred, actual)) {
            correctHybrid++;
        }
    }

    console.log(`\n--- RESULTS ---`);
    console.log(`Total Evaluated Matches: ${stats.total}`);
    console.log(`Tri-Core Hybrid ML Applied: ${appliedCount} times`);
    console.log(`Fallback (No ML Data): ${fallbackCount} times`);
    console.log(`\nTri-Core Hybrid ML Specific Accuracy:`);
    console.log(`${stats.hits} / ${stats.total} (${(stats.hits / stats.total * 100).toFixed(2)}%)`);
}

testMLAccuracy().catch(console.error);
