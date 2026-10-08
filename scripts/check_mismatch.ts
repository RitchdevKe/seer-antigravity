import fs from 'fs';
import path from 'path';
import { extractMLFeatures } from '../src/utils/mlFeatureExtractor';

const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
const matches = JSON.parse(fs.readFileSync(dataPath, 'utf-8')).map((d: any) => d.data);

for (const rawMatch of matches) {
    if (!rawMatch) continue;
    const m = JSON.parse(JSON.stringify(rawMatch));
    
    // Simple manual check based on mo
    let favIndex = 1;
    if (m.mo) {
        const parts = m.mo.split(',').map(Number);
        if (parts.length >= 3) {
            favIndex = parts[0] < parts[2] ? 0 : (parts[0] > parts[2] ? 2 : 1);
        }
    }
    const favWin = favIndex === 0 ? '1' : (favIndex === 2 ? '2' : 'X');
    
    let algoPrim = null;
    if (m.algoReport && m.algoReport.probabilities) {
        const p1 = m.algoReport.probabilities['1'];
        const pX = m.algoReport.probabilities['X'];
        const p2 = m.algoReport.probabilities['2'];
        algoPrim = m.algoReport.primaryPrediction;
        if (!algoPrim) {
            if (p1 > pX && p1 > p2) algoPrim = '1';
            else if (p2 > p1 && p2 > pX) algoPrim = '2';
            else if (pX > p1 && pX > p2) algoPrim = 'X';
        }
    }

    const f = extractMLFeatures(m);
    if (!f) continue;
    
    let mySil = algoPrim === favWin;
    let featSil = (f.study5_algoPrimary || '') === (f.favIndex === 0 ? '1' : '2');
    
    if (mySil !== featSil) {
        console.log({
            mo: m.mo,
            myFavIndex: favIndex,
            myFavWin: favWin,
            featFavIndex: f.favIndex,
            myAlgoPrim: algoPrim,
            featAlgoPrim: f.study5_algoPrimary,
            matchId: m.id || m._id
        });
        break;
    }
}
