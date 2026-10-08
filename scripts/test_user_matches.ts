import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getIntelligenceReport } from '../src/services/seerIntelligenceEngine';
import { getActualResult } from '../src/utils/matchProcessing';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadMatches(filePath: string): any[] {
  if (!fs.existsSync(filePath)) return [];
  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let matches: any[] = [];
  if (rawData.compressedMatches) {
    const LZString = require('lz-string');
    matches = JSON.parse(LZString.decompressFromUTF16(rawData.compressedMatches));
  } else if (Array.isArray(rawData.matches)) {
    matches = rawData.matches.map((r: any) => r.data || r);
  } else if (Array.isArray(rawData)) {
    matches = rawData.map((r: any) => r.data || r);
  }
  return matches;
}

const matches1 = loadMatches(path.join(__dirname, '..', 'db_export', 'user_uploaded_matches.json'));
const matches2 = loadMatches(path.join(__dirname, '..', 'public', 'embedded_matches.json'));
const allMatches = [...matches1, ...matches2];

const matchQueries = [
  'Mushuc R', 'IFK Skovde', 'Santos Laguna', 'Vittsjo', 
  'Floresta', 'Union C', 'Talleres C', 'Guayaquil C', 'Fenix'
];

console.log(`Searching through ${allMatches.length} matches for user test cases...\n`);

const foundMatches = new Map();

allMatches.forEach(m => {
  if (!m || !m.teams) return;
  matchQueries.forEach(q => {
    if (m.teams.includes(q)) {
      // Use matchNo or teams+date to deduplicate
      const key = m.matchNo || `${m.teams}_${m.date}`;
      if (!foundMatches.has(key)) {
        foundMatches.set(key, m);
      }
    }
  });
});

console.log(`Found ${foundMatches.size} related matches.\n`);

foundMatches.forEach((m) => {
  const report = getIntelligenceReport(m);
  if (!report) return;

  const actualResult = getActualResult(m.result);
  console.log(`MATCH: ${m.teams} (Actual: ${actualResult})`);
  console.log(`  Algo Pred: ${m.algoReport?.prediction || m.calculatedPrediction}`);
  console.log(`  Sub Pred: ${m.finalPrediction || m.rawPrediction}`);
  
  if (report.compositeDecision) {
    console.log(`  🔥 COMPOSITE DECISION (${report.compositeDecision.tier})`);
    console.log(`     Primary: ${report.compositeDecision.primaryPrediction}`);
    console.log(`     Hedge:   ${report.compositeDecision.hedge}`);
    console.log(`     Triggers: ${report.compositeDecision.triggers.map((t: any) => t.name).join(', ') || 'None'}`);
    console.log(`     Explanation: ${report.compositeDecision.explanation[report.compositeDecision.explanation.length - 1]}`);
  }
  console.log('-'.repeat(50));
});
