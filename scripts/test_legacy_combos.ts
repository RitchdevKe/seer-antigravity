import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getActualResult } from '../src/utils/matchProcessing';

const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
const rawData = fs.readFileSync(dataPath, 'utf-8');
const matches = JSON.parse(rawData);

const targetMatches = [
    'Mjallby_AIF_vs_Slovan_2026_08_04 19:00',
    'Rodina_M_vs_Rubin_2026_08_04 18:30',
    'Union_S_vs_Bodo_Glimt_2026_08_04 21:00'
];

console.log('--- Target Matches Analysis ---');

const patternsToTest = new Map<string, string>();

for (const rawMatch of matches) {
    const match = rawMatch.data;
    if (targetMatches.includes(match.id)) {
        const pattern = match.patternAnalysis?.formattedString;
        if (pattern) {
            patternsToTest.set(match.id, pattern);
            console.log(`Found pattern for ${match.id}:`);
            console.log(`  Pattern: ${pattern}`);
        } else {
            console.log(`No pattern found for ${match.id}`);
        }
    }
}

console.log('\n--- Historical Analysis ---');

for (const [id, pattern] of patternsToTest.entries()) {
    let homeWin = 0;
    let draw = 0;
    let awayWin = 0;
    let total = 0;

    for (const rawMatch of matches) {
        const match = rawMatch.data;
        const actualResult = getActualResult(match.result || '');
        if (!actualResult || actualResult === 'pending') continue;

        if (match.patternAnalysis?.formattedString === pattern) {
            total++;
            if (actualResult === '1') homeWin++;
            else if (actualResult === 'X') draw++;
            else if (actualResult === '2') awayWin++;
        }
    }

    console.log(`\nMatch: ${id}`);
    console.log(`Pattern: ${pattern}`);
    console.log(`History: Total=${total}, 1=${homeWin} (${((homeWin/total)*100).toFixed(1)}%), X=${draw} (${((draw/total)*100).toFixed(1)}%), 2=${awayWin} (${((awayWin/total)*100).toFixed(1)}%)`);
}
