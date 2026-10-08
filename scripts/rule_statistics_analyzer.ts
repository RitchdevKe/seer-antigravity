import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\best_bet_rules_catalog.json`, 'utf8'));
const matches = JSON.parse(fs.readFileSync(`${outDir}\\best_bet_matches_matrix.json`, 'utf8'));

const totalMfav = 77;
const totalDraw = 16;
const totalUd = 18;
const totalMatches = 111;

interface RuleStatDetail {
  index: number;
  description: string;
  currentPoints: number;
  mfavHits: number;
  drawHits: number;
  udHits: number;
  totalHits: number;
  mfavHitRate: number;     // % of Mfav matches that triggered this rule
  lossHitRate: number;     // % of Loss matches (draw+ud) that triggered this rule
  precisionMfav: number;   // % of matches triggering this rule that were Mfav wins
  netDiscriminator: number; // mfavHitRate - lossHitRate (+ means favors Mfav, - means favors Loss)
  oddsRatio: number;
  recommendation: 'STRONG_BONUS' | 'MODERATE_BONUS' | 'SLIGHT_BONUS' | 'NEUTRAL_ZERO' | 'SLIGHT_PENALTY' | 'MODERATE_PENALTY' | 'STRONG_PENALTY';
}

const detailedStats: RuleStatDetail[] = rulesCatalog.map((r: any) => {
  const lossHits = r.drawHits + r.udHits;
  const totalLoss = totalDraw + totalUd; // 34

  const mfavHitRate = (r.mfavHits / totalMfav) * 100;
  const lossHitRate = (lossHits / totalLoss) * 100;
  const precisionMfav = r.totalHits > 0 ? (r.mfavHits / r.totalHits) * 100 : 0;
  const netDiscriminator = mfavHitRate - lossHitRate;

  // Simple odds ratio (with Laplace smoothing +0.5)
  const oddsRatio = ((r.mfavHits + 0.5) / (totalMfav - r.mfavHits + 0.5)) /
                    ((lossHits + 0.5) / (totalLoss - lossHits + 0.5));

  let recommendation: RuleStatDetail['recommendation'] = 'NEUTRAL_ZERO';
  if (r.totalHits === 0) {
    recommendation = 'NEUTRAL_ZERO';
  } else if (oddsRatio >= 2.0 && r.mfavHits >= 5) {
    recommendation = oddsRatio >= 3.5 ? 'STRONG_BONUS' : 'MODERATE_BONUS';
  } else if (oddsRatio > 1.3 && r.mfavHits >= 4) {
    recommendation = 'SLIGHT_BONUS';
  } else if (oddsRatio <= 0.4 && lossHits >= 3) {
    recommendation = oddsRatio <= 0.2 ? 'STRONG_PENALTY' : 'MODERATE_PENALTY';
  } else if (oddsRatio < 0.75 && lossHits >= 2) {
    recommendation = 'SLIGHT_PENALTY';
  } else {
    recommendation = 'NEUTRAL_ZERO';
  }

  return {
    index: r.index,
    description: r.description,
    currentPoints: r.currentPoints,
    mfavHits: r.mfavHits,
    drawHits: r.drawHits,
    udHits: r.udHits,
    totalHits: r.totalHits,
    mfavHitRate: parseFloat(mfavHitRate.toFixed(1)),
    lossHitRate: parseFloat(lossHitRate.toFixed(1)),
    precisionMfav: parseFloat(precisionMfav.toFixed(1)),
    netDiscriminator: parseFloat(netDiscriminator.toFixed(1)),
    oddsRatio: parseFloat(oddsRatio.toFixed(2)),
    recommendation
  };
});

fs.writeFileSync(`${outDir}\\detailed_rule_statistics.json`, JSON.stringify(detailedStats, null, 2));

console.log('--- RULES FAVORING MFAV (HIGHEST ODDS RATIO) ---');
const bestBonuses = [...detailedStats].filter(s => s.totalHits >= 3).sort((a, b) => b.oddsRatio - a.oddsRatio);
bestBonuses.slice(0, 15).forEach(s => {
  console.log(`[#${s.index}] ${s.description} | Mfav: ${s.mfavHits}/${totalMfav} | Loss: ${s.drawHits+s.udHits}/${totalDraw+totalUd} | Mfav%: ${s.precisionMfav}% | OR: ${s.oddsRatio} -> ${s.recommendation}`);
});

console.log('\n--- RULES FAVORING LOSSES (LOWEST ODDS RATIO / TRAPS) ---');
const worstTraps = [...detailedStats].filter(s => s.totalHits >= 2).sort((a, b) => a.oddsRatio - b.oddsRatio);
worstTraps.slice(0, 15).forEach(s => {
  console.log(`[#${s.index}] ${s.description} | Mfav: ${s.mfavHits}/${totalMfav} | Loss: ${s.drawHits+s.udHits}/${totalDraw+totalUd} | Mfav%: ${s.precisionMfav}% | OR: ${s.oddsRatio} -> ${s.recommendation}`);
});

console.log(`\nTotal Rules analyzed: ${detailedStats.length}`);
const zeroHits = detailedStats.filter(s => s.totalHits === 0).length;
console.log(`Rules with 0 hits in this 111 match sample: ${zeroHits}`);
console.log(`Rules active in this sample: ${detailedStats.length - zeroHits}`);
