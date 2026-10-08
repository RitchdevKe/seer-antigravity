import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
const matches = JSON.parse(fs.readFileSync(dataPath, 'utf-8')).map((d: any) => d.data);

import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import { getActualResult, processMatch } from '../src/utils/matchProcessing';

let matchesWithCombo = 0;
let totalMatches = 0;
let matchesWithAtLeastOneSubPattern = 0;

matches.forEach((rawMatch: any) => {
    if (!rawMatch) return;
    const actualResult = getActualResult(rawMatch.result || '');
    if (actualResult === 'pending' || !actualResult) return;
    
    const cleanM = JSON.parse(JSON.stringify(rawMatch));
    delete cleanM.isPrecalculated;
    const processed = processMatch(cleanM);
    const features = extractMLFeatures(processed);
    if (!features) return;

    totalMatches++;
    const tags = generateSITags(features) || [];
    const subPatterns = tags.filter(t => /\d/.test(t));
    if (subPatterns.length > 0) matchesWithAtLeastOneSubPattern++;
    if (subPatterns.length >= 2) matchesWithCombo++;
});

console.log("Total valid matches processed:", totalMatches);
console.log("Matches with at least 1 subpattern:", matchesWithAtLeastOneSubPattern);
console.log("Matches with at least 1 combo (>= 2 subpatterns):", matchesWithCombo);
