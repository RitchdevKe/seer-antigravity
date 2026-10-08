import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { Match } from '../src/types';
import { predictWithHybridML } from '../src/utils/hybridMachineLearning';
function getActualResult(result: any): string | null {
    if (!result) return null;
    if (typeof result === 'string') {
        const parts = result.split(/[:\-]/);
        if (parts.length === 2) {
            const h = parseInt(parts[0]);
            const a = parseInt(parts[1]);
            if (h > a) return '1';
            if (a > h) return '2';
            return 'X';
        }
    } else if (result.homeScore !== undefined && result.awayScore !== undefined) {
        if (result.homeScore > result.awayScore) return '1';
        if (result.awayScore > result.homeScore) return '2';
        return 'X';
    }
    return null;
}

function matchesPrediction(prediction: string, actualResult: string): boolean {
    if (!prediction || !actualResult) return false;
    const predUpper = prediction.toUpperCase();
    if (predUpper === '1X' && (actualResult === '1' || actualResult === 'X')) return true;
    if (predUpper === 'X2' && (actualResult === '2' || actualResult === 'X')) return true;
    if (predUpper === '12' && (actualResult === '1' || actualResult === '2')) return true;
    return predUpper === actualResult;
}

async function testMLAccuracy() {
    console.log("Loading matches...");
    const matchesPath = path.resolve(__dirname, '../public/embedded_matches.json');
    if (!fs.existsSync(matchesPath)) {
        console.error("No embedded_matches.json found");
        return;
    }

    const rawMatches = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));
    const matches: Match[] = rawMatches.map((m: any) => m.data || m);
    console.log(`Loaded ${matches.length} matches`);

    const completed = matches.filter(m => {
        if (!m.result) return false;
        const r = getActualResult(m.result);
        return r && r !== 'pending';
    });
    console.log(`Evaluating against ${completed.length} completed matches...`);

    let correctHybrid = 0;
    let appliedCount = 0;
    let fallbackCount = 0;
    
    let stats = {
        hits: 0,
        total: 0
    };

    for (const match of completed) {
        const actual = getActualResult(match.result);
        if (!actual) continue;
        
        // Data-driven ML prediction
        const mlInfo = predictWithHybridML(match);
        let finalPred = match.paaPrediction || match.rawPrediction || '1';
        
        if (mlInfo.mlApplied) {
            appliedCount++;
            finalPred = mlInfo.mlPrediction;
            stats.total++;
            if (matchesPrediction(finalPred, actual)) {
                stats.hits++;
            }
        } else {
            fallbackCount++;
        }

        if (matchesPrediction(finalPred, actual)) {
            correctHybrid++;
        }
    }

    console.log(`\n--- RESULTS ---`);
    console.log(`Total Completed Matches: ${completed.length}`);
    console.log(`Data-Driven ML Applied: ${appliedCount} times`);
    console.log(`Fallback Used: ${fallbackCount} times`);
    console.log(`\nData-Driven ML Specific Accuracy:`);
    console.log(`${stats.hits} / ${stats.total} (${(stats.hits / stats.total * 100).toFixed(2)}%)`);
    console.log(`\nOverall Hybrid Accuracy (ML + Fallback):`);
    console.log(`${correctHybrid} / ${completed.length} (${(correctHybrid / completed.length * 100).toFixed(2)}%)`);
}

testMLAccuracy().catch(console.error);
