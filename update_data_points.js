const fs = require('fs');
const path = require('path');

const newBaseDataPoints = 
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
;

let miner = fs.readFileSync('scripts/mine_intelligence_tree.ts', 'utf8');
miner = miner.replace(/const dataPoints = \[[\s\S]*?\];/, newBaseDataPoints.trim());
fs.writeFileSync('scripts/mine_intelligence_tree.ts', miner);

const newEngineDataPoints = 
  const baseDataPoints = [
    { name: 'Underdog Odds < Draw Odds', match: features.study1_underdogLessThanDraw },
    { name: 'Hidden Strength (Underdog GS=GA+-2)', match: features.study8_hiddenStrength },
    { name: 'PHA Volatility Tie (Draw=Und+-2)', match: features.study9_phaTie },
    { name: 'Hidden Weakness (Fav GS=GA+-2)', match: features.study10_hiddenWeakness },
    { name: 'Draw Odds < 3.0', match: features.study21_drawOddsBelow3 },
    { name: 'Match Category: Top 12', match: features.study18_category === 'Top 12' },
    { name: 'Match Category: Jackpot', match: features.study18_category === 'Jackpot' },
    { name: 'Match Group 1', match: features.study17_group === 1 },
    { name: 'Match Group 2', match: features.study17_group === 2 },
    { name: 'Match Group 3', match: features.study17_group === 3 },
    { name: 'Match Group 4', match: features.study17_group === 4 },
    { name: 'Extreme Volatility (All < 40%)', match: features.study16_allPercentagesBelow40 },
    { name: 'Fav Points Support', match: features.study13_pointsSupport === 'Fav' },
    { name: 'Underdog Points Support', match: features.study13_pointsSupport === 'Underdog' },
    { name: 'Equal Points Support', match: features.study13_pointsSupport === 'Equal' },
    { name: 'TS Fav > TS Underdog (Strength Diff > 5)', match: features.study7_tsFavVsUnderdog && features.study7_tsFavVsUnderdog > 5 },
    { name: 'TS Underdog > TS Fav', match: features.study7_tsFavVsUnderdog && features.study7_tsFavVsUnderdog < -2 },
    { name: 'Predictors Agree DC', match: features.study14_predictorsAgreeDC },
    { name: 'Predictors Agree Primary', match: features.study15_predictorsAgreePrim },
    { name: 'Max Draw Percentage > 33%', match: features.study12_maxDrawPercentage > 33 },
    { name: 'PHA Predicts Underdog', match: features.study2_pha && features.study2_pha.underdog > features.study2_pha.fav }
  ];
;

let engine = fs.readFileSync('src/services/seerIntelligenceEngine.ts', 'utf8');
engine = engine.replace(/const baseDataPoints = \[[\s\S]*?\];/, newEngineDataPoints.trim());
fs.writeFileSync('src/services/seerIntelligenceEngine.ts', engine);
console.log('Done replacing');
