import { processMatch } from './src/utils/matchProcessing';
import { calculateMatchProbability } from './src/utils/seerSlipSelection';
import { generateSeerAiCognitiveSlips } from './src/utils/seerAiSlipSelection';
import { getMatchEvaluatorTags } from './src/utils/matchEvaluator';
import * as fs from 'fs';

const phaStatsMap: any = {};
const d = JSON.parse(fs.readFileSync('./supabase_backup/live_matches.json', 'utf8'));
const allMatches: any[] = [];
d.forEach((row: any) => {
    if (row.data) allMatches.push(processMatch(row.data));
});

allMatches.forEach(m => {
    const sub = m.patternAnalysis?.subPattern;
    if (sub && !phaStatsMap[sub]) {
        phaStatsMap[sub] = {
            sub_pattern: sub,
            total: 10,
            favWin: 5,
            draw: 3,
            upsetWin: 2,
            updated_at: new Date().toISOString()
        };
    }
});

const matchStars: any = {};
allMatches.forEach((m: any) => {
    matchStars[m.id.toString()] = calculateMatchProbability(m, phaStatsMap);
});

allMatches.forEach(m => {
    m.evaluatorTags = getMatchEvaluatorTags(m, phaStatsMap, false, false, matchStars);
});

const getOdds = (m: any) => {
    let o1 = 0, oX = 0, o2 = 0;
    if (m.mo) {
        const parts = m.mo.split(/[- ,]+/).map((p: any) => parseFloat(p.trim())).filter((p: any) => !isNaN(p));
        if (parts.length >= 3) {
            o1 = parts[0];
            oX = parts[1];
            o2 = parts[2];
        }
    }
    const favOdds = o1 > 0 && o2 > 0 ? Math.min(o1, o2) : (o1 || o2);
    return { o1, oX, o2, favOdds };
};

const top10Matches = allMatches.filter(m => m.evaluatorTags.some((t: string) => t.startsWith('top10:')));
console.log('Matches with top10 tag:', top10Matches.length);

const validTop10Matches = top10Matches.filter(m => {
    const o = getOdds(m);
    return o.favOdds >= 2.0 && o.favOdds <= 2.49;
});

console.log('Matches with top10 tag and valid odds:', validTop10Matches.length);
if (validTop10Matches.length > 0) {
    console.log('Sample valid odds:', getOdds(validTop10Matches[0]));
} else if (top10Matches.length > 0) {
    console.log('Sample invalid odds:', getOdds(top10Matches[0]));
}
