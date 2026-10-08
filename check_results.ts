import * as fs from 'fs';
import { processMatch } from './src/utils/matchProcessing';

const d = JSON.parse(fs.readFileSync('./supabase_backup/live_matches.json', 'utf8'));
const allMatches: any[] = [];
d.forEach((row: any) => {
    if (row.data) allMatches.push(processMatch(row.data));
});

let finishedCount = 0;
let unknownCount = 0;
let pendingCount = 0;

allMatches.forEach(m => {
    const res = m.result?.toLowerCase() || m.status?.toLowerCase();
    if (res === 'finished' || res === 'played' || (m.homeScore !== undefined && m.awayScore !== undefined)) {
        finishedCount++;
    } else if (res === 'unknown') {
        unknownCount++;
    } else {
        pendingCount++;
    }
});

console.log(`Total: ${allMatches.length}`);
console.log(`Finished: ${finishedCount}`);
console.log(`Unknown: ${unknownCount}`);
console.log(`Pending: ${pendingCount}`);
