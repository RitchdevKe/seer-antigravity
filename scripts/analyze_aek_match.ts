import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractMLFeatures } from '../src/utils/mlFeatureExtractor';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
import { Match } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.resolve(__dirname, '../public/embedded_matches.json');
const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const matches = rawData.map((r: any) => {
    const m = r.data || r;
    m.result = r.result;
    return m;
});

const targetMatch = matches.find((m: any) => m.id === 'AEK_Larnaca_vs_Beitar_J_2026_07_23 19:30' || m._stableId === 'AEK_Larnaca_vs_Beitar_J_2026_07_23 19:30');

if (targetMatch) {
    console.log(`Found target match: ${targetMatch.id || targetMatch._stableId}`);
    const features = extractMLFeatures(targetMatch);
    
    console.log(`Seer Prim: ${targetMatch.seerPrimaryPrediction}`);
    console.log(`Seer Fin: ${targetMatch.seerPrediction}`);
    console.log(`Algo Prim: ${features?.study5_algoPrimary}`);
    console.log(`Sub Pat Prim: ${features?.study3_subPatPrimary}`);
    console.log(`Odds: ${targetMatch.mo || targetMatch.odds}`);
    
    const mlResult = predictWithHybridML(targetMatch as Match);
    console.log(`\nML Result:`);
    console.log(`Prediction: ${mlResult.mlPrediction}`);
    console.log(`Primary: ${mlResult.mlPrimaryPrediction}`);
    console.log(`Reasoning: ${mlResult.mlReasoning}`);
} else {
    console.log('Match not found.');
}
