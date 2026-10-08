import fs from 'fs';
import path from 'path';

const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
const matches = JSON.parse(fs.readFileSync(dataPath, 'utf-8')).map((d: any) => d.data);

let silCount = 0;

matches.forEach((match: any) => {
    if (!match) return;

    let homeOdds = 0, drawOdds = 0, awayOdds = 0;
    const parseOddsString = (str: string): [number, number, number] | null => {
        const parts = str.split(/[,|\s]+/).map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
        if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
        return null;
    };
    const oddsStr = match.mo || match.odds || '';
    if (oddsStr && oddsStr !== 'NA' && oddsStr !== 'Unknown') {
        const parsed = parseOddsString(oddsStr);
        if (parsed) {
        [homeOdds, drawOdds, awayOdds] = parsed;
        }
    }

    let favIndex = 0;
    let hasValidOdds = homeOdds > 0 && awayOdds > 0;
    if (hasValidOdds) {
        if (homeOdds <= awayOdds) {
        favIndex = 0;
        } else {
        favIndex = 2;
        }
    } else {
        const tsa = match.tsa || 0;
        const tsb = match.tsb || 0;
        if (tsa >= tsb) {
        favIndex = 0;
        } else {
        favIndex = 2;
        }
    }

    const favWin = favIndex === 0 ? "1" : "2";

    let algoPrim = null;
    if (match.algoReport && match.algoReport.probabilities) {
        const p1 = match.algoReport.probabilities['1'];
        const pX = match.algoReport.probabilities['X'];
        const p2 = match.algoReport.probabilities['2'];
        
        algoPrim = match.algoReport.primaryPrediction;
        if (!algoPrim) {
            if (p1 > pX && p1 > p2) algoPrim = '1';
            else if (p2 > p1 && p2 > pX) algoPrim = '2';
            else if (pX > p1 && pX > p2) algoPrim = 'X';
        }
    }

    if (algoPrim === favWin) {
        silCount++;
    }
});

console.log({ oldSilCount: silCount });
