import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPORT_DIR = path.join(__dirname, '..', 'db_export');
const MATCHES_FILE = path.join(EXPORT_DIR, 'user_uploaded_matches.json');

const rawData = fs.readFileSync(MATCHES_FILE, 'utf-8');
const matches = JSON.parse(rawData);

let total = 0;
let algoWins = 0;
let paaWins = 0;
let seerWins = 0;
let moWins = 0;

for (const item of matches) {
    const match = item.data ? item.data : item;
    const resultStr = item.result || match.result;
    if (!resultStr || !resultStr.includes(':')) continue;
    
    const parts = resultStr.split(':');
    const hg = parseInt(parts[0], 10);
    const ag = parseInt(parts[1], 10);
    if (isNaN(hg) || isNaN(ag)) continue;

    let actual = hg > ag ? '1' : hg < ag ? '2' : 'X';
    
    total++;
    
    // Check algo
    const algoPred = match.algoReport?.prediction || match.calculatedPrediction || '';
    if (algoPred.includes(actual)) algoWins++;
    
    // Check paa
    const paaPred = match.paaPrediction || match.paaPrimaryPrediction || '';
    if (paaPred.includes(actual)) paaWins++;
    
    // Check seer
    const seerPred = match.seerPrediction || match.seerPrimaryPrediction || '';
    if (seerPred.includes(actual)) seerWins++;
    
    // Check MO
    const moPred = match._moFav || match.moPrediction || (match.favIndex === 0 ? '1' : '2'); // simplified
    if (moPred.includes(actual)) moWins++;
}

console.log(`Total: ${total}`);
console.log(`Algo Accuracy: ${((algoWins/total)*100).toFixed(2)}%`);
console.log(`PAA Accuracy: ${((paaWins/total)*100).toFixed(2)}%`);
console.log(`SEER Accuracy: ${((seerWins/total)*100).toFixed(2)}%`);
console.log(`MO Accuracy: ${((moWins/total)*100).toFixed(2)}%`);
