import fs from 'fs';
import path from 'path';
const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
const matches = JSON.parse(fs.readFileSync(dataPath, 'utf-8')).map((d: any) => d.data);

let moCount = 0;
let objOddsCount = 0;
matches.forEach((m: any) => {
    if (m && m.mo) moCount++;
    if (m && m.odds && typeof m.odds === 'object') objOddsCount++;
});
console.log({ moCount, objOddsCount });
