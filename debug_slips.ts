import { processMatch } from './src/utils/matchProcessing';
import { calculateMatchProbability } from './src/utils/seerSlipSelection';
import { categories } from './src/utils/seerAiSlipSelection';
import { getMatchEvaluatorTags } from './src/utils/matchEvaluator';
import * as fs from 'fs';

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

const catDef = categories.find((c: any) => c.id === 'top_10_value');

const q = allMatches.filter((m: any) => {
    const tags = matchTagsMap.get(m.id.toString()) || [];
    if (!tags.some((t: string) => t.startsWith(catDef!.tag + ':'))) return false;
    return true;
}).filter((m: any) => catDef!.filter(m));

console.log('Q length:', q.length);
q.slice(0, 1).forEach((m: any) => {
    console.log('Match:', m.teams, 'Tags:', matchTagsMap.get(m.id.toString()));
});
