import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { extractMLFeatures } from '../src/utils/mlFeatureExtractor';

async function run() {
    const { data: res } = await supabase.from('live_matches').select('data, result').neq('result', '').neq('result', '?-?').neq('result', 'Unknown').neq('result', 'pending').limit(2000);
    let total = 0, paaHits = 0, finalHits = 0;
    
    for (const r of res) {
        const match = r.data;
        match.result = r.result;
        const actual = getActualResult(r.result);
        if (!actual || actual === 'pending') continue;
        const features = extractMLFeatures(match);
        if (!features) continue;
        
        const isFavHome = features.favIndex === 0;
        const favDC = isFavHome ? '1X' : 'X2';
        
        const paaPred = match.paaPrediction || favDC;
        const seerPred = match.seerPrediction || favDC;
        const algoPred = match.algoReport?.prediction || match.algoReport?.finalPrediction || match.algoReport?.primaryPrediction || favDC;

        let prediction = paaPred;
        
        // RULE 1: Seer Draw Hedging for PAA 12 misses
        if (paaPred === '12' && (seerPred === '1X' || seerPred === 'X2')) {
            prediction = seerPred;
        }

        total++;
        if(matchesPrediction(paaPred, actual)) paaHits++;
        if(matchesPrediction(prediction, actual)) finalHits++;
    }
    console.log('Total:', total);
    console.log('PAA:', (paaHits/total*100).toFixed(2), '%');
    console.log('Final ML:', (finalHits/total*100).toFixed(2), '%');
}
run();
