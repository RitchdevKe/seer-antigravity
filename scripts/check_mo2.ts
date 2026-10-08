import fs from 'fs';
import path from 'path';
const dataPath = path.resolve(process.cwd(), 'public/embedded_matches.json');
const matches = JSON.parse(fs.readFileSync(dataPath, 'utf-8')).map((d: any) => d.data);

const mos = matches.filter((m: any) => m && m.mo).slice(0, 10).map((m: any) => m.mo);
console.log(mos);
