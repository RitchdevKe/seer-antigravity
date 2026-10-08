import fs from 'fs';
import path from 'path';

function run() {
    const dataPath = path.join(process.cwd(), 'supabase_backup/precalculated_matches.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    const matches = data.filter((item: any) => {
        const m = item.data || item;
        return m.date && m.date.startsWith('2026-08-08');
    }).map((item: any) => item.data || item);

    const successfulMatches = [];

    matches.forEach((m: any) => {
        let resultOutcome = 'Unknown';
        if (m.result) {
            const parts = m.result.split(':').map(Number);
            if (parts.length === 2) {
                if (parts[0] > parts[1]) resultOutcome = '1';
                else if (parts[0] < parts[1]) resultOutcome = '2';
                else resultOutcome = 'X';
            }
        }
        if (resultOutcome === 'Unknown') return;

        const odds1 = m.odds?.home || 0;
        const odds2 = m.odds?.away || 0;
        let mfav = '1';
        if (odds2 > 0 && odds2 < odds1) mfav = '2';

        if (resultOutcome === mfav || resultOutcome === 'X') {
            successfulMatches.push({
                id: m.id,
                result: m.result,
                mfav: mfav,
                outcome: resultOutcome,
                algoPred: m.algoReport?.prediction || '',
                paaPrimary: m.paaPrimaryPrediction || '',
                subPattern: m.patternAnalysis?.subPattern || '',
                subPatternPred: m.patternAnalysis?.subPatternPrediction || '',
                mlPrediction: m.mlPrediction || '',
                moFav: m._cachedMatchStats?.moFav || mfav,
                upsetRate: m._cachedMatchStats?.paaStats?.upsetRate || 0,
                phaFavSupport: m._cachedMatchStats?.phaFavSupport || 0,
            });
        }
    });

    const output = `Found ${successfulMatches.length} successful matches (Fav/Draw).\n` + JSON.stringify(successfulMatches, null, 2);
    fs.writeFileSync(path.join(process.cwd(), 'scripts', 'successful_indicators_utf8.json'), output, 'utf8');
    console.log('Saved to successful_indicators_utf8.json');
}

run();
