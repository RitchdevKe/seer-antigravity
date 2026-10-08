import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getIntelligenceReport } from '../src/services/seerIntelligenceEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPORT_DIR = path.join(__dirname, '..', 'db_export');
const MATCHES_FILE = path.join(EXPORT_DIR, 'user_uploaded_matches.json');

function main() {
    console.log("Loading historical matches for backtesting...");
    if (!fs.existsSync(MATCHES_FILE)) {
        console.error("Historical data file not found:", MATCHES_FILE);
        return;
    }

    const rawData = fs.readFileSync(MATCHES_FILE, 'utf-8');
    const matches = JSON.parse(rawData);

    let totalValid = 0;
    let primaryWins = 0;
    let hedgeWins = 0;
    let bothWin = 0;

    for (const item of matches) {
        const match = item.data ? item.data : item;
        const resultStr = item.result || match.result;
        
        if (!resultStr || !resultStr.includes(':')) continue;
        const parts = resultStr.split(':');
        const hg = parseInt(parts[0], 10);
        const ag = parseInt(parts[1], 10);
        if (isNaN(hg) || isNaN(ag)) continue;

        let actualResult: '1' | 'X' | '2';
        if (hg > ag) actualResult = '1';
        else if (hg < ag) actualResult = '2';
        else actualResult = 'X';
        
        try {
            const report = getIntelligenceReport(match);
            if (!report) continue;
            
            totalValid++;
            
            let pWin = false;
            let hWin = false;

            if (report.recommendedPrediction === actualResult) {
                primaryWins++;
                pWin = true;
            }
            if (report.recommendedHedge.includes(actualResult)) {
                hedgeWins++;
                hWin = true;
            }
            if (pWin && hWin) {
                bothWin++;
            }
        } catch (e) {
            // Ignore errors for malformed matches
        }
    }

    console.log(`\n--- SEER INTELLIGENCE BACKTEST RESULTS ---`);
    console.log(`Total Matches Evaluated: ${totalValid}`);
    console.log(`Primary Prediction Accuracy: ${((primaryWins / totalValid) * 100).toFixed(2)}% (${primaryWins} wins)`);
    console.log(`Hedge Prediction Accuracy: ${((hedgeWins / totalValid) * 100).toFixed(2)}% (${hedgeWins} wins)`);
    console.log(`Combined Coverage (Primary OR Hedge won): ${(((primaryWins + hedgeWins - bothWin) / totalValid) * 100).toFixed(2)}%`);
}

main();
