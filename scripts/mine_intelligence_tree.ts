import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractMLFeatures, getMLVariations } from '../src/utils/mlFeatureExtractor';
import { getActualResult } from '../src/utils/matchProcessing';
import { Match } from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXPORT_DIR = path.join(__dirname, '..', 'db_export');
const DATA_FILE = path.join(EXPORT_DIR, 'user_uploaded_matches.json');
const OUTPUT_FILE = path.join(__dirname, '../src/data/seer_intelligence_tree.json');

const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
let matches: Match[] = [];
if (rawData.compressedMatches) {
  const LZString = require('lz-string');
  matches = JSON.parse(LZString.decompressFromUTF16(rawData.compressedMatches));
} else if (Array.isArray(rawData.matches)) {
  matches = rawData.matches.map((r: any) => r.data || r);
} else if (Array.isArray(rawData)) {
  matches = rawData.map((r: any) => r.data || r);
}

const evaluatedMatches = matches
  .filter(m => {
    const r = getActualResult(m.result);
    return r && r !== 'pending';
  })
  .map(m => {
    const f = extractMLFeatures(m);
    const r = getActualResult(m.result);
    let outcome = 'X';
    if (f) {
      const isHomeFav = f.favIndex === 0;
      if (r === '1') outcome = isHomeFav ? 'fav' : 'und';
      else if (r === '2') outcome = isHomeFav ? 'und' : 'fav';
      else outcome = 'draw';
    }
    return { match: m, features: f, outcome };
  })
  .filter(m => m.features !== null);

interface NodeStats {
  fav: number;
  draw: number;
  und: number;
  total: number;
}

interface TreeNode {
  name: string;
  stats: NodeStats;
  children: TreeNode[];
}

function calculateStats(group: any[]): NodeStats {
  let fav = 0, draw = 0, und = 0;
  group.forEach(g => {
    if (g.outcome === 'fav') fav++;
    else if (g.outcome === 'draw') draw++;
    else if (g.outcome === 'und') und++;
  });
  return { fav, draw, und, total: group.length };
}

// Data Points (Level 0)
const dataPoints = [
  { id: 'dp1', name: 'Underdog Odds < Draw Odds', filter: (m) => m.features.study1_underdogLessThanDraw },
  { id: 'dp2', name: 'Hidden Strength (Underdog GS=GA+-2)', filter: (m) => m.features.study8_hiddenStrength },
  { id: 'dp3', name: 'PHA Volatility Tie (Draw=Und+-2)', filter: (m) => m.features.study9_phaTie },
  { id: 'dp4', name: 'Hidden Weakness (Fav GS=GA+-2)', filter: (m) => m.features.study10_hiddenWeakness },
  { id: 'dp5', name: 'Draw Odds < 3.0', filter: (m) => m.features.study21_drawOddsBelow3 },
  { id: 'dp6', name: 'Match Category: Top 12', filter: (m) => m.features.study18_category === 'Top 12' },
  { id: 'dp7', name: 'Match Category: Jackpot', filter: (m) => m.features.study18_category === 'Jackpot' },
  { id: 'dp8', name: 'Match Group 1', filter: (m) => m.features.study17_group === 1 },
  { id: 'dp9', name: 'Match Group 2', filter: (m) => m.features.study17_group === 2 },
  { id: 'dp10', name: 'Match Group 3', filter: (m) => m.features.study17_group === 3 },
  { id: 'dp11', name: 'Match Group 4', filter: (m) => m.features.study17_group === 4 },
  { id: 'dp12', name: 'Extreme Volatility (All < 40%)', filter: (m) => m.features.study16_allPercentagesBelow40 },
  { id: 'dp13', name: 'Fav Points Support', filter: (m) => m.features.study13_pointsSupport === 'Fav' },
  { id: 'dp14', name: 'Underdog Points Support', filter: (m) => m.features.study13_pointsSupport === 'Underdog' },
  { id: 'dp15', name: 'Equal Points Support', filter: (m) => m.features.study13_pointsSupport === 'Equal' },
  { id: 'dp16', name: 'TS Fav > TS Underdog (Strength Diff > 5)', filter: (m) => m.features.study7_tsFavVsUnderdog && m.features.study7_tsFavVsUnderdog > 5 },
  { id: 'dp17', name: 'TS Underdog > TS Fav', filter: (m) => m.features.study7_tsFavVsUnderdog && m.features.study7_tsFavVsUnderdog < -2 },
  { id: 'dp18', name: 'Predictors Agree DC', filter: (m) => m.features.study14_predictorsAgreeDC },
  { id: 'dp19', name: 'Predictors Agree Primary', filter: (m) => m.features.study15_predictorsAgreePrim },
  { id: 'dp20', name: 'Max Draw Percentage > 33%', filter: (m) => m.features.study12_maxDrawPercentage > 33 },
  { id: 'dp21', name: 'PHA Predicts Underdog', filter: (m) => m.features.study2_pha && m.features.study2_pha.underdog > m.features.study2_pha.fav }
];

// Variance Levels to Drill Down
const variationKeys = ['Points', 'TS', 'PHA', 'Algo', 'PAA', 'SEER', 'Agreement'];

function buildTree(matchesGroup: any[], levelIndex: number): TreeNode[] {
  if (levelIndex >= variationKeys.length) return [];
  if (matchesGroup.length < 5) return [];

  const keyName = variationKeys[levelIndex];
  const groups: Record<string, any[]> = {};
  
  matchesGroup.forEach(m => {
    const variations = getMLVariations(m.match, m.features);
    const varValue = variations[keyName] || 'Unknown';
    const groupName = `${keyName}: ${varValue}`;
    
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(m);
  });

  const children: TreeNode[] = [];
  for (const [groupName, group] of Object.entries(groups)) {
    if (group.length >= 5) {
      children.push({
        name: groupName,
        stats: calculateStats(group),
        children: buildTree(group, levelIndex + 1)
      });
    }
  }

  return children.sort((a, b) => b.stats.total - a.stats.total);
}

const finalTree: TreeNode[] = [];

dataPoints.forEach(dp => {
  const group = evaluatedMatches.filter(dp.filter);
  if (group.length >= 5) {
    finalTree.push({
      name: dp.name,
      stats: calculateStats(group),
      children: buildTree(group, 0)
    });
  }
});

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalTree, null, 2));
console.log(`Generated ${finalTree.length} Data Point Trees to ${OUTPUT_FILE}`);
