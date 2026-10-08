import fs from 'fs';
import path from 'path';

const mlModel = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/ml_model.json'), 'utf-8'));

const matchesTags = {
    'Mjallby_AIF_vs_Slovan': ['SIg', 'SIl', 'SIl3', 'SIdd', 'SIdd3', 'SIee', 'SIee3'],
    'Rodina_M_vs_Rubin': ['SIh', 'SIl', 'SIl3'],
    'Union_S_vs_Bodo_Glimt': ['SIb', 'SIb4', 'SIb12', 'SIh', 'SIl', 'SIl4', 'SIl12', 'SIdd', 'SIdd4', 'SIdd12', 'SIee', 'SIee4', 'SIee12']
};

function getCombinations(arr: string[], length: number) {
    const result: string[][] = [];
    const f = (prefix: string[], arr: string[]) => {
        for (let i = 0; i < arr.length; i++) {
            const nextPrefix = [...prefix, arr[i]];
            if (nextPrefix.length === length) {
                result.push(nextPrefix);
            } else {
                f(nextPrefix, arr.slice(i + 1));
            }
        }
    }
    f([], arr);
    return result;
}

for (const [match, tags] of Object.entries(matchesTags)) {
    console.log(`\n===========================================`);
    console.log(`MATCH: ${match}`);
    
    // The matrix only uses tags with digits
    const subPatterns = tags.filter(t => /\d/.test(t)).sort();
    
    console.log(`Sub-Patterns: ${subPatterns.join(', ')}`);
    
    // Look up pairs and triplets
    const pairs = getCombinations(subPatterns, 2).map(c => c.join('+'));
    const triplets = getCombinations(subPatterns, 3).map(c => c.join('+'));
    
    console.log(`\n--- PAIRS (From Matrix Data) ---`);
    for (const pair of pairs) {
        const stats = mlModel.combos[pair];
        if (stats) {
            console.log(`[${pair}] Total: ${stats.total}, Fav: ${stats.favPct.toFixed(1)}%, Draw: ${stats.drawPct.toFixed(1)}%, Und: ${stats.undPct.toFixed(1)}%`);
        } else {
            console.log(`[${pair}] NOT IN MATRIX`);
        }
    }
    
    console.log(`\n--- TRIPLETS (From Matrix Data) ---`);
    for (const triplet of triplets) {
        const stats = mlModel.combos[triplet];
        if (stats) {
            console.log(`[${triplet}] Total: ${stats.total}, Fav: ${stats.favPct.toFixed(1)}%, Draw: ${stats.drawPct.toFixed(1)}%, Und: ${stats.undPct.toFixed(1)}%`);
        } else {
            console.log(`[${triplet}] NOT IN MATRIX`);
        }
    }
}
