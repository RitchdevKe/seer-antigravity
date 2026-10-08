import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import mlModelData from '../public/ml_model.json';

const mlModel: any = mlModelData;

async function run() {
    const { data: res } = await supabase.from('live_matches').select('data, result').neq('result', '').neq('result', '?-?').neq('result', 'Unknown').neq('result', 'pending').limit(2000);
    let total = 0, paaLosses = 0;
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
        const algoPred = match.algoReport?.prediction || match.algoReport?.finalPrediction || match.algoReport?.primaryPrediction || favDC;
        const seerPred = match.seerPrediction || favDC;
        
        if (!matchesPrediction(paaPred, actual)) {
            paaLosses++;
            const tags = generateSITags(features);
            let matrixUnd = 0, count = 0, matrixDraw = 0, matrixFav = 0;
            tags.forEach((t: string) => {
                const s = mlModel.subPatterns[t];
                if (s && s.total >= 10) {
                    matrixUnd += s.undPct;
                    matrixDraw += s.drawPct;
                    matrixFav += s.favPct;
                    count++;
                }
            });
            if (count > 0) {
                matrixUnd /= count;
                matrixDraw /= count;
                matrixFav /= count;
            }
            console.log(`[LOSS] Actual: ${actual} | PAA: ${paaPred} | Algo: ${algoPred} | Seer: ${seerPred} | MatFav: ${matrixFav.toFixed(1)}% | MatDraw: ${matrixDraw.toFixed(1)}% | MatUnd: ${matrixUnd.toFixed(1)}%`);
        }
    }
    console.log('Total Losses:', paaLosses);
}
run();
