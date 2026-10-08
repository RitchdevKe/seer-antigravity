import fs from 'fs';
import path from 'path';

const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
const matches = JSON.parse(fs.readFileSync(dataPath, 'utf-8')).map((d: any) => d.data);

let count = 0;
let errors = 0;

for (const m of matches) {
    if (m && m.odds && typeof m.odds === 'string' && m.odds.split(',').length >= 3) {
        count++;
    }
}
console.log({ totalMatchesWithStringOdds: count });
