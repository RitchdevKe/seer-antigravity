import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractMLFeatures, getMLVariations } from '../src/utils/mlFeatureExtractor';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import LZString from 'lz-string';

const rawData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'db_export', 'user_uploaded_matches.json'), 'utf-8'));
let matches: any[] = rawData.compressedMatches 
  ? JSON.parse(LZString.decompressFromUTF16(rawData.compressedMatches))
  : (Array.isArray(rawData.matches) ? rawData.matches.map((r: any) => r.data || r) : rawData);

// Check what key data fields are populated
let hasSeerPredCount = 0, hasPaaPredCount = 0, hasPaaWinCount = 0, study6Count = 0, study5Count = 0;
matches.forEach(m => {
  if (m.seerPrediction) hasSeerPredCount++;
  if (m.paaPrediction) hasPaaPredCount++;
  if (m.paaWin !== undefined) hasPaaWinCount++;
  if (m.study6_seer || (m.algoReport?.study6)) study6Count++;
  if (m.study5_algo || (m.algoReport?.study5)) study5Count++;
});

console.log(`Total matches: ${matches.length}`);
console.log(`Has seerPrediction field: ${hasSeerPredCount} (${((hasSeerPredCount/matches.length)*100).toFixed(1)}%)`);
console.log(`Has paaPrediction field: ${hasPaaPredCount} (${((hasPaaPredCount/matches.length)*100).toFixed(1)}%)`);
console.log(`Has paaWin field: ${hasPaaWinCount} (${((hasPaaWinCount/matches.length)*100).toFixed(1)}%)`);
console.log(`Has study6_seer: ${study6Count} (${((study6Count/matches.length)*100).toFixed(1)}%)`);
console.log(`Has study5_algo: ${study5Count} (${((study5Count/matches.length)*100).toFixed(1)}%)`);

// Show a sample match with paaWin to understand structure
const sampleWithPaa = matches.find(m => m.paaWin !== undefined && m.paaWin > 0);
if (sampleWithPaa) {
  console.log('\n--- Sample match with PAA data ---');
  const { teams, seerPrediction, paaPrediction, paaWin, paaDraw, paaUpset, finalPrediction, algoReport, calculatedPrediction } = sampleWithPaa;
  const features = extractMLFeatures(sampleWithPaa);
  const variations = features ? getMLVariations(sampleWithPaa, features) : {};
  console.log({ teams, seerPrediction, paaPrediction, paaWin, paaDraw, paaUpset, finalPrediction, algoPred: algoReport?.prediction || calculatedPrediction });
  console.log('Features study6_seer:', features?.study6_seer);
  console.log('Features study5_algo:', features?.study5_algo);
  console.log('Variations:', variations);
}

// Determine: when paaUpset > paaWin and paaUpset > paaDraw, what is the actual outcome?
let upsetScenarios = 0, upsetCorrect = 0;
matches.forEach(m => {
  if (m.paaUpset !== undefined && m.paaWin !== undefined && m.paaDraw !== undefined) {
    if (m.paaUpset > m.paaWin && m.paaUpset > m.paaDraw) {
      upsetScenarios++;
      const result = m.result?.trim();
      // Determine underdog
      const oddsStr = m.mo || m.odds || '';
      const parts = oddsStr.split(/[- ,|]+/).map((p: string) => parseFloat(p.trim())).filter((p: number) => !isNaN(p));
      if (parts.length >= 3) {
        const undResult = parts[0] < parts[2] ? '2' : '1';
        if (result === undResult) upsetCorrect++;
      }
    }
  }
});
console.log(`\nWhen PAA Upset % is dominant: n=${upsetScenarios}, Upset actually happens: ${upsetCorrect} (${((upsetCorrect/upsetScenarios)*100).toFixed(1)}%)`);
