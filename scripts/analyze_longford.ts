import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getIntelligenceReport } from '../src/services/seerIntelligenceEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '..', 'public', 'embedded_matches.json');

const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
let matches: any[] = [];
if (rawData.compressedMatches) {
  const LZString = require('lz-string');
  matches = JSON.parse(LZString.decompressFromUTF16(rawData.compressedMatches));
} else if (Array.isArray(rawData.matches)) {
  matches = rawData.matches.map((r: any) => r.data || r);
} else if (Array.isArray(rawData)) {
  matches = rawData.map((r: any) => r.data || r);
}

const longfordMatch = matches.find(m => m.teams && m.teams.includes('Treaty United') && m.teams.includes('Longford') && m.result === '0:1');

if (longfordMatch) {
    console.log(`Found Match: ${longfordMatch.teams}`);
    console.log(`Result: ${longfordMatch.result}`);
    const report = getIntelligenceReport(longfordMatch);
    console.log(JSON.stringify(report, null, 2));
} else {
    console.log("Could not find Treaty United vs Longford match in history.");
}
