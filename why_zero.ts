import { processMatch } from './src/utils/matchProcessing';
import { calculateMatchProbability } from './src/utils/seerSlipSelection';
import { getMatchEvaluatorTags } from './src/utils/matchEvaluator';
import * as fs from 'fs';

const getOdds = (m: any): any => {
    const pred = m.finalPrediction || m.patternAnalysis?.primaryPrediction || '1';
    let o1 = parseFloat(m.odds1) || 0;
    let oX = parseFloat(m.oddsX) || 0;
    let o2 = parseFloat(m.odds2) || 0;
    const favOdds = pred.includes('1') ? o1 : pred.includes('2') ? o2 : oX;
    const underdogOdds = o1 > 0 && o2 > 0 ? Math.max(o1, o2) : 0;
    return { o1, oX, o2, favOdds, underdogOdds };
};

const catDef = { id: 'top_10_value', tag: 'top10', size: 12, hedgedSize: 12, 
    filter: (m: any) => { 
        const o = getOdds(m); 
        return o.favOdds >= 2.0 && o.favOdds <= 2.49;
    } 
};

const phaStatsMap: any = {};
JSON.parse(fs.readFileSync('./supabase_backup/pha_stats.json', 'utf8')).forEach((r: any) => {
    if(r.sub_pattern) phaStatsMap[r.sub_pattern] = r;
});

const d = JSON.parse(fs.readFileSync('./supabase_backup/live_matches.json', 'utf8'));
const allMatches: any[] = [];
d.forEach((row: any) => {
    if (row.data) allMatches.push(processMatch(row.data));
});

const matchStars: any = {};
allMatches.forEach((m: any) => {
    matchStars[m.id.toString()] = calculateMatchProbability(m, phaStatsMap);
});

const matchTagsMap = new Map();
allMatches.forEach((m: any) => {
    matchTagsMap.set(m.id.toString(), getMatchEvaluatorTags(m, phaStatsMap, false, false, matchStars));
});

let countTag = 0;
let countFilter = 0;
let favOddsArr = [];
allMatches.forEach((m: any) => {
    const tags = matchTagsMap.get(m.id.toString()) || [];
    const hasTag = tags.some((t: string) => t.startsWith(catDef.tag + ':'));
    if (hasTag) {
        countTag++;
        const o = getOdds(m);
        favOddsArr.push(o.favOdds);
        if (catDef.filter(m)) countFilter++;
    }
});

console.log('Total matches:', allMatches.length);
console.log('Has tag:', countTag);
console.log('Passed filter:', countFilter);
console.log('FavOdds for tagged matches:', favOddsArr.slice(0, 20).join(', '));
