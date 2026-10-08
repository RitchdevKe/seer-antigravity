import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';

async function run() {
    const { data: res } = await supabase.from('live_matches').select('data, result').neq('result', '').neq('result', '?-?').neq('result', 'Unknown').neq('result', 'pending').limit(2000);
    let total = 0, algoHits = 0;
    for (const r of res) {
        const match = r.data;
        match.result = r.result;
        const actual = getActualResult(r.result);
        if (!actual || actual === 'pending') continue;
        
        const algoPred = match.algoReport?.prediction || match.algoReport?.finalPrediction || match.algoReport?.primaryPrediction;
        
        total++;
        if(algoPred && matchesPrediction(algoPred, actual)) algoHits++;
    }
    console.log('Total:', total);
    console.log('Algo:', (algoHits/total*100).toFixed(2), '%');
}
run();
