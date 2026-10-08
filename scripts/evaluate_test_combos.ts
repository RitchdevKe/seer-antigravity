import fs from 'fs';
import path from 'path';
import { extractMLFeatures, generateSITags } from '../src/utils/mlFeatureExtractor';
import { processMatch } from '../src/utils/matchProcessing';

const rawData = fs.readFileSync(path.resolve(process.cwd(), 'public/embedded_matches.json'), 'utf-8');
const allMatches = JSON.parse(rawData);

const testMatchTitles = ['Mjallby AIF vs Slovan', 'Rodina M vs Rubin', 'Union S vs Bodo/Glimt'];
const testMatches = allMatches.filter((m: any) => m.data?.home && testMatchTitles.some(t => `${m.data.home} vs ${m.data.away}`.includes(t)));

const mlModel = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/ml_model.json'), 'utf-8'));

for (const rawMatch of testMatches) {
    const matchData = rawMatch.data;
    const cleanM = JSON.parse(JSON.stringify(matchData));
    delete cleanM.isPrecalculated;
    const processed = processMatch(cleanM);
    const features = extractMLFeatures(processed);
    if (!features) continue;
    
    const tags = generateSITags(features);
    const subPatterns = tags.filter(t => /\d/.test(t)).sort();
    
    console.log(`\n===========================================`);
    console.log(`MATCH: ${matchData.title}`);
    console.log(`Sub-Patterns: ${subPatterns.join(', ')}`);
    
    const combos = [];
    
    // Pairs
    for (let i = 0; i < subPatterns.length; i++) {
        for (let j = i + 1; j < subPatterns.length; j++) {
            const pair = subPatterns[i] + '+' + subPatterns[j];
            const stats = mlModel.combos[pair];
            if (stats && stats.total >= 10) combos.push({ type: 'Pair', name: pair, ...stats });
        }
    }
    
    // Triplets
    for (let i = 0; i < subPatterns.length; i++) {
        for (let j = i + 1; j < subPatterns.length; j++) {
            for (let k = j + 1; k < subPatterns.length; k++) {
                const triplet = subPatterns[i] + '+' + subPatterns[j] + '+' + subPatterns[k];
                const stats = mlModel.combos[triplet];
                if (stats && stats.total >= 10) combos.push({ type: 'Triplet', name: triplet, ...stats });
            }
        }
    }
    
    // Sort combos by highest prediction percentage
    combos.sort((a, b) => Math.max(b.favPct, b.drawPct, b.undPct) - Math.max(a.favPct, a.drawPct, a.undPct));
    
    console.log(`Found ${combos.length} valid combos in Matrix.`);
    console.log(`Top 5 Most Predictive Combos:`);
    combos.slice(0, 5).forEach(c => {
        console.log(`[${c.name}] (${c.type}) Vol: ${c.total} | Fav: ${c.favPct.toFixed(1)}% | Draw: ${c.drawPct.toFixed(1)}% | Und: ${c.undPct.toFixed(1)}%`);
    });
}
