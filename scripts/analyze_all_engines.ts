import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
import { extractMLFeatures } from '../src/utils/mlFeatureExtractor';

async function run() {
    const { data: res } = await supabase.from('live_matches')
        .select('data, result')
        .neq('result', '')
        .neq('result', '?-?')
        .neq('result', 'Unknown')
        .neq('result', 'pending')
        .limit(2000);
        
    let total = 0, algoHits = 0, seerHits = 0, subPatHits = 0, paaHits = 0, hybridHits = 0;
    
    for (const r of res) {
        const match = r.data;
        match.result = r.result;
        const actual = getActualResult(r.result);
        
        if (!actual || actual === 'pending') continue;
        
        total++;
        const mlInfo = predictWithHybridML(match);
        const features = extractMLFeatures(match);
        
        if (!features) continue;

        const isFavHome = features.favIndex === 0;
        const favDC = isFavHome ? '1X' : 'X2';

        const algoPred = match.algoReport?.finalPrediction || match.algoReport?.primaryPrediction || favDC;
        if(matchesPrediction(algoPred, actual)) algoHits++;

        const seerPred = match.seerPrediction || favDC;
        if(matchesPrediction(seerPred, actual)) seerHits++;

        const paaPred = match.paaPrediction || favDC;
        if(matchesPrediction(paaPred, actual)) paaHits++;

        if(mlInfo.mlApplied && matchesPrediction(mlInfo.mlPrediction, actual)) hybridHits++;
    }
    
    console.log('Total:', total);
    console.log('Algo:', (algoHits/total*100).toFixed(2), '%');
    console.log('Seer:', (seerHits/total*100).toFixed(2), '%');
    console.log('PAA:', (paaHits/total*100).toFixed(2), '%');
    console.log('Hybrid:', (hybridHits/total*100).toFixed(2), '%');
}

run();
