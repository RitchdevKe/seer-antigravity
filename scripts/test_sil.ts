import fs from 'fs';
import path from 'path';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';

const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
const matches = JSON.parse(fs.readFileSync(dataPath, 'utf-8')).map((d: any) => d.data);

let silCount = 0;
let algoFav = 0;
let extractFails = 0;
let totalAlgo = 0;

matches.forEach((m: any) => {
    if (!m) return;
    
    // Simple manual check
    let favIndex = 1;
    if (m.odds && m.odds.home !== 0 && m.odds.away !== 0) {
        favIndex = m.odds.home < m.odds.away ? 0 : (m.odds.home > m.odds.away ? 2 : 1);
    } else {
        favIndex = (m.homePos || 99) < (m.awayPos || 99) ? 0 : 2;
    }
    const favWin = favIndex === 0 ? '1' : (favIndex === 2 ? '2' : 'X');
    
    if (m.algoReport && m.algoReport.probabilities) {
        const p1 = m.algoReport.probabilities['1'];
        const pX = m.algoReport.probabilities['X'];
        const p2 = m.algoReport.probabilities['2'];
        let algoPrim = m.algoReport.primaryPrediction;
        if (!algoPrim) {
            if (p1 > pX && p1 > p2) algoPrim = '1';
            else if (p2 > p1 && p2 > pX) algoPrim = '2';
            else if (pX > p1 && pX > p2) algoPrim = 'X';
        }
        totalAlgo++;
        if (algoPrim === favWin) algoFav++;
    }

    const f = extractMLFeatures(m);
    if (!f) {
        extractFails++;
        return;
    }
    const tags = generateSITags(f);
    if (tags.includes('SIl')) {
        silCount++;
    }
});

console.log({ totalAlgo, algoFav, silCount, extractFails });
