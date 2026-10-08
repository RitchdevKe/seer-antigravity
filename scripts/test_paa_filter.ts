import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import mlModelData from '../public/ml_model.json';

const mlModel: any = mlModelData;

async function run() {
    const { data: res } = await supabase.from('live_matches').select('data, result').neq('result', '').neq('result', '?-?').neq('result', 'Unknown').neq('result', 'pending').limit(2000);
    let total = 0, paaHits = 0, matrixFilteredHits = 0, seerHits = 0, algoHits = 0;
    
    for (const r of res) {
        const match = r.data;
        match.result = r.result;
        const actual = getActualResult(r.result);
        if (!actual || actual === 'pending') continue;
        const features = extractMLFeatures(match);
        if (!features) continue;
        
        const isFavHome = features.favIndex === 0;
        const favDC = isFavHome ? '1X' : 'X2';
        const upsetDC = isFavHome ? 'X2' : '1X';
        
        const paaPred = match.paaPrediction || favDC;
        const algoPred = match.algoReport?.finalPrediction || match.algoReport?.primaryPrediction || favDC;
        const seerPred = match.seerPrediction || favDC;
        
        const tags = generateSITags(features);
        let matrixUnd = 0, count = 0;
        tags.forEach((t: string) => {
            const s = mlModel.subPatterns[t];
            if (s && s.total >= 10) {
                matrixUnd += s.undPct;
                count++;
            }
        });
        if (count > 0) matrixUnd /= count;

        total++;
        if(matchesPrediction(paaPred, actual)) paaHits++;
        if(matchesPrediction(algoPred, actual)) algoHits++;
        if(matchesPrediction(seerPred, actual)) seerHits++;

        let prediction = paaPred;
        // PAA is usually 1X/X2/12. If prediction is favDC, but matrixUnd > 35, we switch to 12.
        if (prediction === favDC && matrixUnd > 30) {
            prediction = '12';
        }
        if (prediction === favDC && matrixUnd > 40) {
            prediction = upsetDC;
        }
        
        if(matchesPrediction(prediction, actual)) matrixFilteredHits++;
    }
    console.log('Total:', total);
    console.log('PAA:', (paaHits/total*100).toFixed(2), '%');
    console.log('Algo:', (algoHits/total*100).toFixed(2), '%');
    console.log('Seer:', (seerHits/total*100).toFixed(2), '%');
    console.log('Matrix Filtered:', (matrixFilteredHits/total*100).toFixed(2), '%');
}
run();
