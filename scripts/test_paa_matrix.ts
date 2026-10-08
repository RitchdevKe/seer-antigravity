import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import mlModelData from '../public/ml_model.json';

const mlModel: any = mlModelData;

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
        const upsetDC = isFavHome ? 'X2' : '1X';
        
        const paaPred = match.paaPrediction || favDC;
        const algoPred = match.algoReport?.prediction || match.algoReport?.finalPrediction || match.algoReport?.primaryPrediction || favDC;
        const seerPred = match.seerPrediction || favDC;

        const tags = generateSITags(features);
        let matrixUnd = 0, count = 0, matrixDraw = 0;
        tags.forEach((t: string) => {
            const s = mlModel.subPatterns[t];
            if (s && s.total >= 10) {
                matrixUnd += s.undPct;
                matrixDraw += s.drawPct;
                count++;
            }
        });
        if (count > 0) {
            matrixUnd /= count;
            matrixDraw /= count;
        }

        let prediction = paaPred;
        
        // Pivot Engine logic:
        // If PAA predicts favorite (e.g. 1X), but Algo disagrees OR Matrix sees high risk
        if (paaPred === favDC) {
            // Pivot to 12 if strong underdog threat and Algo agrees there's no draw
            if (matrixUnd > 30 && algoPred === '12') {
                prediction = '12';
            }
            // Pivot to X2 if extreme underdog threat
            if (matrixUnd > 40) {
                prediction = upsetDC;
            }
        }
        if (paaPred === '12') {
            // Hedge draw if Algo predicts 1X and Matrix draw is high
            if (algoPred === favDC && matrixDraw > 25) {
                prediction = favDC;
            }
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
