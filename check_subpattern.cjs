const fs = require('fs');
const d = JSON.parse(fs.readFileSync('supabase_backup/live_matches.json'));
console.log('Total matches:', d.length);
let hasSubPattern = 0;
d.forEach(x => {
    if (x.data && x.data.patternAnalysis && x.data.patternAnalysis.subPattern) hasSubPattern++;
});
console.log('Has subpattern:', hasSubPattern);
