import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import mlModelData from '../public/ml_model.json';

const mlModel: any = mlModelData;

async function run() {
    const { data: res } = await supabase.from('live_matches').select('data, result').neq('result', '').neq('result', '?-?').neq('result', 'Unknown').neq('result', 'pending').limit(2000);
    let total = 0, paaHits = 0, algoHits = 0, finalHits = 0;
    
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
        const favWin = isFavHome ? '1' : '2';
        const undWin = isFavHome ? '2' : '1';
        
        const paaPred = match.paaPrediction || favDC;
        const algoPred = match.algoReport?.prediction || match.algoReport?.finalPrediction || match.algoReport?.primaryPrediction || favDC;
        const seerPred = match.seerPrediction || favDC;
        const basePred = match.prediction || favDC;
        
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

        total++;
        if(matchesPrediction(paaPred, actual)) paaHits++;
        if(matchesPrediction(algoPred, actual)) algoHits++;

        // ENSEMBLE LOGIC
        // Start with the most reliable predictor (PAA = 85%) or Algo (83%)
        let prediction = paaPred;
        
        // Let's implement the Pivot Engine strictly:
        // "Pivot engine is a thinking machine that sees volatility in a match that points towards a market favorite."
        
        // Volatility is defined by high Matrix Draw or Underdog percentages when the engines predict a Favorite.
        let isVolatile = (matrixUnd >= 28 || matrixDraw >= 28) && (paaPred === favDC || paaPred === favWin);
        
        if (isVolatile) {
             // Hedge based on where the volatility is pointing
             if (matrixUnd >= 35) {
                 prediction = '12'; // Highly volatile underdog threat
             }
             if (matrixUnd >= 45 || matrixDraw >= 45) {
                 prediction = upsetDC; // Massive threat, pivot completely away from favorite
             }
        }
        
        // Triple consensus lock
        if (paaPred === algoPred && algoPred === seerPred) {
            // If they all agree, it's very solid, but we still apply extreme volatility filter
            if (matrixUnd < 35 && matrixDraw < 35) {
                prediction = paaPred; 
            }
        }

        if(matchesPrediction(prediction, actual)) finalHits++;
    }
    console.log('Total:', total);
    console.log('PAA:', (paaHits/total*100).toFixed(2), '%');
    console.log('Algo:', (algoHits/total*100).toFixed(2), '%');
    console.log('Final ML:', (finalHits/total*100).toFixed(2), '%');
}
run();
