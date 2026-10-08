const fs = require('fs');
const d = JSON.parse(fs.readFileSync('supabase_backup/live_matches.json'));
const phaStatsMap = {};
JSON.parse(fs.readFileSync('./supabase_backup/pha_stats.json', 'utf8')).forEach(r => {
    if(r.sub_pattern) phaStatsMap[r.sub_pattern] = r;
});
let hasStats = 0;
let has5Stats = 0;
d.forEach(x => {
    const sub = x.data?.patternAnalysis?.subPattern;
    if (sub && phaStatsMap[sub]) {
        hasStats++;
        if (phaStatsMap[sub].total >= 5) has5Stats++;
    }
});
console.log('Has stats:', hasStats);
console.log('Has 5 stats:', has5Stats);
