import fs from 'fs';
import path from 'path';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';

const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
const matches = JSON.parse(fs.readFileSync(dataPath, 'utf-8')).map((d: any) => d.data);

let silMismatchCount = 0;
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
    if (!f) return;
    const tags = generateSITags(f);
    
    let mySil = algoPrim === favWin;
    let featSil = tags.includes('SIl');
    
    if (mySil !== featSil) {
        silMismatchCount++;
        if (silMismatchCount < 5) {
            console.log("Mismatch! mySil:", mySil, "featSil:", featSil, "algoPrim:", algoPrim, "featAlgoPrim:", f.study5_algoPrimary, "favWin:", favWin, "featFav:", f.favIndex === 0 ? '1' : '2');
        }
    }
});

console.log({ silMismatchCount });
