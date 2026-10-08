import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
import { processMatch } from '../src/utils/matchProcessing';

const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
const rawData = fs.readFileSync(dataPath, 'utf-8');
const matches = JSON.parse(rawData);

const targetMatches = [
    'Mjallby_AIF_vs_Slovan_2026_08_04 19:00',
    'Union_S_vs_Bodo_Glimt_2026_08_04 21:00',
    'Rodina_M_vs_Rubin_2026_08_04 18:30',
    'FC_Aarau_vs_Stade_L_2026_08_01 19:00',
    '1_FC_Koln_vs_Hertha_BSC_2026_07_31 13:00'
];

const mlModel = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/ml_model.json'), 'utf-8'));

for (const matchName of targetMatches) {
    const rawMatch = matches.find((m: any) => m.id === matchName || m.data?.id === matchName);
    if (!rawMatch) {
        console.log(`Match not found: ${matchName}`);
        continue;
    }
    
    const matchData = processMatch(rawMatch.data || rawMatch);
    const features = extractMLFeatures(matchData);
    if (!features) continue;
    
    const tags = generateSITags(features);
    const mlResult = predictWithHybridML(matchData, mlModel);
    
    console.log(`\nMatch: ${matchName}`);
    console.log(`Actual Result: ${matchData.result}`);
    console.log(`Extracted Tags: ${tags.join(', ')}`);
    console.log(`ML Primary: ${mlResult.mlPrimaryPrediction}, ML Fin: ${mlResult.mlPrediction} (${mlResult.mlConfidence}%)`);
    console.log(`Raw Stats: Fav=${mlResult.matrixStats?.exactCombo?.favPct?.toFixed(1) || 'N/A'}% Draw=${mlResult.matrixStats?.exactCombo?.drawPct?.toFixed(1) || 'N/A'}% Und=${mlResult.matrixStats?.exactCombo?.undPct?.toFixed(1) || 'N/A'}%`);
    console.log(`Total Samples: ${mlResult.matrixStats?.exactCombo?.total_matches || mlResult.matrixStats?.exactCombo?.total || 'N/A'}`);
    console.log(`Used Exact Combo: ${mlResult.matrixStats?.exactCombo ? 'YES' : 'NO'}`);
}
