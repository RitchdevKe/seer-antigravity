import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
const matches = JSON.parse(fs.readFileSync(dataPath, 'utf-8')).map((d: any) => d.data);

import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import { getActualResult, processMatch } from '../src/utils/matchProcessing';

let totalPairs = 0;
let totalTriplets = 0;
let uniquePairs = new Set();
let uniqueTriplets = new Set();
let totalSubPatternsSum = 0;
let validMatches = 0;

matches.forEach((rawMatch: any) => {
    if (!rawMatch) return;
    const actualResult = getActualResult(rawMatch.result || '');
    if (actualResult === 'pending' || !actualResult) return;
    
    const cleanM = JSON.parse(JSON.stringify(rawMatch));
    delete cleanM.isPrecalculated;
    const processed = processMatch(cleanM);
    const features = extractMLFeatures(processed);
    if (!features) return;

    const tags = generateSITags(features) || [];
    // filter only subpatterns (contains numbers)
    const subPatterns = tags.filter(t => /\d/.test(t)).sort();
    
    totalSubPatternsSum += subPatterns.length;
    validMatches++;

    // Generate pairs
    for (let i = 0; i < subPatterns.length; i++) {
        for (let j = i + 1; j < subPatterns.length; j++) {
            totalPairs++;
            uniquePairs.add(subPatterns[i] + '+' + subPatterns[j]);
            // Generate triplets
            for (let k = j + 1; k < subPatterns.length; k++) {
                totalTriplets++;
                uniqueTriplets.add(subPatterns[i] + '+' + subPatterns[j] + '+' + subPatterns[k]);
            }
        }
    }
});

console.log("Valid Matches:", validMatches);
console.log("Avg sub-patterns per match:", totalSubPatternsSum / validMatches);
console.log("Total Pairs Generated:", totalPairs);
console.log("Unique Pairs:", uniquePairs.size);
console.log("Total Triplets Generated:", totalTriplets);
console.log("Unique Triplets:", uniqueTriplets.size);
