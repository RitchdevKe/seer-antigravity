import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getIntelligenceReport } from '../src/services/seerIntelligenceEngine';
import { getActualResult } from '../src/utils/matchProcessing';

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
}

let totalDisagreements = 0;
let algoRight = 0;
let subRight = 0;
let bothWrong = 0;

  // Let's find patterns in disagreements
const subWinsWhen = {
  seerAgreesWithSub: { total: 0, subRight: 0 },
  paaAgreesWithSub: { total: 0, subRight: 0 },
  tsPtsAgreesWithSub: { total: 0, subRight: 0 },
  twoPlusConfirmations: { total: 0, subRight: 0 },
  subLeansUnderdogAndTwoPlusConf: { total: 0, subRight: 0 }
};

function predictionCovers(pred: string, result: string) {
  if (!pred || !result) return false;
  const c = pred.trim().toUpperCase();
  const r = result.toUpperCase();
  if (c === r) return true;
  if (c === '1X' && (r === '1' || r === 'X')) return true;
  if (c === 'X2' && (r === '2' || r === 'X')) return true;
  if (c === '12' && (r === '1' || r === '2')) return true;
  return false;
}

matches.forEach(m => {
  const actual = getActualResult(m.result);
  if (!actual) return;
  
  const algoPred = m.algoReport?.prediction || m.calculatedPrediction || '1';
  const subPred = m.finalPrediction || m.rawPrediction || '1';
  
  if (!algoPred || !subPred) return;
  
  if (algoPred !== subPred) {
    totalDisagreements++;
    
    const algoWin = predictionCovers(algoPred, actual);
    const subWin = predictionCovers(subPred, actual);
    
    if (algoWin && !subWin) algoRight++;
    else if (!algoWin && subWin) subRight++;
    else if (!algoWin && !subWin) bothWrong++;
    else if (algoWin && subWin) { algoRight++; subRight++; } // Edge case where both cover
    
    // Analyze Sub wins
    const report = getIntelligenceReport(m);
    if (!report) return;
    
    const isSubRight = (!algoWin && subWin);
    
    const seerPred = m.seerPrediction || '';
    const paaPred = m.paaPrediction || m.calculatedPrediction || '';
    
    // Determine lean
    const oddsStr = m.mo || m.odds || '';
    const parts = oddsStr.split(/[- ,|]+/).map((p: string) => parseFloat(p.trim())).filter((p: number) => !isNaN(p));
    let favResult = '1', undResult = '2';
    if (parts.length >= 3 && parts[0] > parts[2]) {
      favResult = '2'; undResult = '1';
    }
    
    let subLean = '';
    const cleanSub = subPred.trim().toUpperCase();
    if (cleanSub === favResult || (cleanSub.includes(favResult) && cleanSub.includes('X') && !cleanSub.includes(undResult))) subLean = 'fav';
    else if (cleanSub === undResult || (cleanSub.includes(undResult) && cleanSub.includes('X') && !cleanSub.includes(favResult))) subLean = 'und';
    
    let subConfirmations = 0;
    
    if (seerPred && seerPred === subPred) {
      subWinsWhen.seerAgreesWithSub.total++;
      if (isSubRight) subWinsWhen.seerAgreesWithSub.subRight++;
      subConfirmations++;
    }
    if (paaPred && paaPred === subPred) {
      subWinsWhen.paaAgreesWithSub.total++;
      if (isSubRight) subWinsWhen.paaAgreesWithSub.subRight++;
      subConfirmations++;
    }
    
    if (subConfirmations >= 2) {
      subWinsWhen.twoPlusConfirmations.total++;
      if (isSubRight) subWinsWhen.twoPlusConfirmations.subRight++;
      
      if (subLean === 'und') {
        subWinsWhen.subLeansUnderdogAndTwoPlusConf.total++;
        if (isSubRight) subWinsWhen.subLeansUnderdogAndTwoPlusConf.subRight++;
      }
    }
  }
});

console.log(`TOTAL DISAGREEMENTS: ${totalDisagreements}`);
console.log(`Algo Right: ${algoRight} (${((algoRight/totalDisagreements)*100).toFixed(1)}%)`);
console.log(`Sub Right: ${subRight} (${((subRight/totalDisagreements)*100).toFixed(1)}%)`);
console.log(`Both Wrong: ${bothWrong} (${((bothWrong/totalDisagreements)*100).toFixed(1)}%)`);
console.log('\n--- TIE BREAKER SIMULATION ---');
const stat = (obj: any) => `${obj.subRight} / ${obj.total} (${((obj.subRight/obj.total)*100).toFixed(1)}%)`;
console.log(`SEER agrees with Sub: ${stat(subWinsWhen.seerAgreesWithSub)}`);
console.log(`PAA agrees with Sub: ${stat(subWinsWhen.paaAgreesWithSub)}`);
console.log(`2+ Confirmations: ${stat(subWinsWhen.twoPlusConfirmations)}`);
console.log(`2+ Confirmations (AND Sub leans Underdog - UPSETS): ${stat(subWinsWhen.subLeansUnderdogAndTwoPlusConf)}`);

