import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getIntelligenceReport } from '../src/services/seerIntelligenceEngine';
import { getActualResult } from '../src/utils/matchProcessing';
import { extractMLFeatures } from '../src/utils/mlFeatureExtractor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPORT_DIR = path.join(__dirname, '..', 'db_export');
const DATA_FILE = path.join(EXPORT_DIR, 'user_uploaded_matches.json');

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

const matchIdsToTest = [
  'Mushuc_R_vs_Libertad_2026_07_27 22:00',
  'IFK_Skovde_vs_Jonkoping_2026_07_27 20:00',
  'Santos_Laguna_vs_Atlas_2026_07_26 06:00',
  'Vittsjo_W_vs_Malmo_FF_W_2026_07_27 20:00'
];

console.log("Analyzing 4 requested matches...\n");

matches.forEach(m => {
  const mId = m.matchNo || m.id || `${m.teams.replace(/\s+/g, '_')}_${m.date} ${m.time}`;
  
  if (matchIdsToTest.includes(mId) || matchIdsToTest.some(id => id.includes(m.teams.split(' ')[0]))) {
    const report = getIntelligenceReport(m);
    if (!report) return;

    const actualResult = getActualResult(m.result);
    console.log(`MATCH: ${m.teams} (Actual: ${actualResult})`);
    console.log(`  Algo Pred: ${m.algoReport?.prediction || m.calculatedPrediction}`);
    console.log(`  Sub Pred: ${m.finalPrediction || m.rawPrediction}`);
    console.log(`  SEER Draw Dominant? ${report.features.study6_seer?.draw > report.features.study6_seer?.fav && report.features.study6_seer?.draw > report.features.study6_seer?.underdog}`);
    
    if (report.compositeDecision) {
      console.log(`  🔥 COMPOSITE DECISION (${report.compositeDecision.tier})`);
      console.log(`     Primary: ${report.compositeDecision.primaryPrediction}`);
      console.log(`     Hedge:   ${report.compositeDecision.hedge}`);
      console.log(`     Triggers: ${report.compositeDecision.triggers.map((t: any) => t.name).join(', ') || 'None'}`);
      console.log(`     Explanation: ${report.compositeDecision.explanation.join(' | ')}`);
    }
    console.log('-'.repeat(50));
  }
});
