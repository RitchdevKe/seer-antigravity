import 'dotenv/config';
import { supabase } from '../src/lib/supabase';
import { getActualResult, matchesPrediction } from '../src/utils/matchProcessing';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import mlModelData from '../public/ml_model.json';

const mlModel: any = mlModelData;

async function run() {
    const { data: res } = await supabase.from('live_matches')
        .select('data, result')
        .neq('result', '')
        .neq('result', '?-?')
        .neq('result', 'Unknown')
        .neq('result', 'pending')
        .limit(2000);
        
    let total = 0, ensembleHits = 0;
    
    for (const r of res) {
        const match = r.data;
        match.result = r.result;
        const actual = getActualResult(r.result);
        
        if (!actual || actual === 'pending') continue;
        
        const features = extractMLFeatures(match);
        if (!features) continue;

        const isFavHome = features.favIndex === 0;
        const favWin = isFavHome ? '1' : '2';
        const undWin = isFavHome ? '2' : '1';
        const favDC = isFavHome ? '1X' : 'X2';
        const upsetDC = isFavHome ? 'X2' : '1X';

        const paaPred = match.paaPrediction || favDC;
        const algoPred = match.algoReport?.finalPrediction || match.algoReport?.primaryPrediction || favDC;
        const seerPred = match.seerPrediction || favDC;

        const tags = generateSITags(features);
        const sortedTags = [...tags].sort();
        const comboKey = sortedTags.join('+');
        const combo = mlModel.combos[comboKey] || null;
        
        let matrixUnd = 0;
        if (combo) {
            matrixUnd = combo.undPct;
        } else {
            let tUnd = 0, count = 0;
            tags.forEach((t: string) => {
                const s = mlModel.subPatterns[t];
                if (s && s.total >= 10) {
                    tUnd += s.undPct;
                    count++;
                }
            });
            if (count > 0) matrixUnd = tUnd / count;
        }

        // Ensemble logic
        let prediction = favDC; // Default base prediction

        // If PAA and Algo agree, trust them heavily
        if (paaPred === algoPred) {
            prediction = paaPred;
        } else {
            // Tie breaker: Matrix Underdog percentage
            if (matrixUnd > 30) {
                prediction = upsetDC;
            } else {
                prediction = paaPred; // PAA is most accurate
            }
        }

        // Pivot Engine: "sees volatility in a match that points towards a market favorite"
        // If the prediction points to the Favorite (favDC), BUT the matrix detects high underdog volatility
        if (prediction === favDC && matrixUnd >= 28) { // Volatility threshold
            prediction = '12'; // Hedge against the draw stalemate, play for volatile outcome
        }
        
        // Pivot to upset if matrix is extremely hostile to favorite
        if (prediction === favDC && matrixUnd >= 40) {
            prediction = upsetDC;
        }

        total++;
        if(matchesPrediction(prediction, actual)) {
            ensembleHits++;
        }
    }
    
    console.log('Total:', total);
    console.log('Ensemble:', (ensembleHits/total*100).toFixed(2), '%');
}

run();
