import 'dotenv/config';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
import { processMatch } from '../src/utils/matchProcessing';
import fs from 'fs';
import path from 'path';

const mlModel = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/ml_model.json'), 'utf-8'));

const mockMatch = {
    id: 'Union_S_vs_Bodo_Glimt_2026_08_04 21:00',
    teams: 'Union S vs Bodo/Glimt',
    date: '2026-08-04',
    time: '21:00',
    result: '3:3',
    mo: '2.48,3.65,2.9',
    group: 1,
    gsHome: 2.8,
    gsAway: 3.0,
    gaHome: 1.6,
    gaAway: 0.5,
    totalPoints: {
        home: 22.0,
        draw: 24.0,
        away: 49.0
    },
    tsa: 1.75,
    tsb: 6.00,
    rawPrediction: '2',
    finalPrediction: '12',
    algoReport: {
        primaryPrediction: '2',
        finalPrediction: '12',
        prediction: '12'
    },
    patternAnalysis: {
        mainPattern: 'J',
        subPattern: 'G1j2',
        activeFlags: ['ESAGA']
    }
};

const processed = processMatch(mockMatch);
const features = extractMLFeatures(processed);
const tags = generateSITags(features);
const mlResult = predictWithHybridML(processed, mlModel);

console.log(`Match: ${mockMatch.teams}`);
console.log(`Extracted Tags: ${tags.join(', ')}`);
console.log(`ML Primary: ${mlResult.mlPrimaryPrediction}, ML Fin: ${mlResult.mlPrediction} (${mlResult.mlConfidence}%)`);
console.log(`Raw Stats: Fav=${mlResult.matrixStats?.exactCombo?.favPct?.toFixed(1) || 'N/A'}% Draw=${mlResult.matrixStats?.exactCombo?.drawPct?.toFixed(1) || 'N/A'}% Und=${mlResult.matrixStats?.exactCombo?.undPct?.toFixed(1) || 'N/A'}%`);
console.log(`Total Samples: ${mlResult.matrixStats?.exactCombo?.total_matches || mlResult.matrixStats?.exactCombo?.total || 'N/A'}`);
console.log(`Used Exact Combo: ${mlResult.matrixStats?.exactCombo ? 'YES' : 'NO'}`);
