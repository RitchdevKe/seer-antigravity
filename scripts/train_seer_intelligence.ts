import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractMLFeatures } from '../src/utils/mlFeatureExtractor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORT_DIR = path.join(__dirname, '..', 'db_export');
const MODEL_DIR = path.join(__dirname, '..', 'src', 'data');

function getOutcome(result: string, favIndex: number, underdogIndex: number): 'fav' | 'draw' | 'underdog' | null {
  if (!result || !result.includes(':')) return null;
  const parts = result.split(':');
  const hg = parseInt(parts[0], 10);
  const ag = parseInt(parts[1], 10);
  
  if (isNaN(hg) || isNaN(ag)) return null;

  let actualResult: 0 | 1 | 2; // 0=Home, 1=Draw, 2=Away
  if (hg > ag) actualResult = 0;
  else if (hg < ag) actualResult = 2;
  else actualResult = 1;

  if (actualResult === 1) return 'draw';
  if (actualResult === favIndex) return 'fav';
  if (actualResult === underdogIndex) return 'underdog';
  
  return null; // Should not happen
}

async function main() {
  console.log('🧠 Training SEER Intelligence Algorithm...');

  const uploadedMatchesPath = path.join(EXPORT_DIR, 'user_uploaded_matches.json');
  if (!fs.existsSync(uploadedMatchesPath)) {
    console.error('❌ user_uploaded_matches.json not found in db_export!');
    process.exit(1);
  }

  const rawData = fs.readFileSync(uploadedMatchesPath, 'utf-8');
  const matches = JSON.parse(rawData);

  console.log(`📊 Loaded ${matches.length} matches from database.`);

  const model: Record<string, any> = {};

  // Initialize model structure for boolean and categorical studies
  const studies = [
    'study1_underdogLessThanDraw',
    'study3_subPattern',
    'study8_hiddenStrength',
    'study9_phaTie',
    'study10_hiddenWeakness',
    'study13_pointsSupport',
    'study14_predictorsAgreeDC',
    'study15_predictorsAgreePrim',
    'study16_allPercentagesBelow40',
    'study17_group',
    'study18_category',
    'study21_drawOddsBelow3'
  ];

  for (const study of studies) {
    model[study] = {};
  }

  let processedCount = 0;

  for (const item of matches) {
    // Some endpoints wrap match in `data`, some don't.
    const matchObj = item.data ? item.data : item;
    const resultStr = item.result || matchObj.result;

    if (!resultStr) continue;

    const features = extractMLFeatures(matchObj);
    if (!features) continue;

    const outcome = getOutcome(resultStr, features.favIndex, features.underdogIndex);
    if (!outcome) continue;

    processedCount++;

    for (const study of studies) {
      const val = (features as any)[study];
      const key = val === null || val === undefined ? 'Unknown' : String(val);

      if (!model[study][key]) {
        model[study][key] = { total: 0, fav: 0, draw: 0, underdog: 0 };
      }

      model[study][key].total++;
      model[study][key][outcome]++;
    }
  }

  // Calculate percentages
  for (const study of studies) {
    for (const key of Object.keys(model[study])) {
      const stats = model[study][key];
      if (stats.total > 0) {
        stats.favPct = (stats.fav / stats.total) * 100;
        stats.drawPct = (stats.draw / stats.total) * 100;
        stats.underdogPct = (stats.underdog / stats.total) * 100;
      }
    }
  }

  model.metadata = {
    trainedAt: new Date().toISOString(),
    totalMatchesAnalyzed: processedCount
  };

  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }

  const modelPath = path.join(MODEL_DIR, 'seer_intelligence_model.json');
  fs.writeFileSync(modelPath, JSON.stringify(model, null, 2), 'utf-8');

  console.log(`✅ Training complete! Analyzed ${processedCount} matches.`);
  console.log(`📁 Model saved to ${modelPath}`);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
