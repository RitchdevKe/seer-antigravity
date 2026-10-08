import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const catalog: Array<{
  id: number;
  description: string;
  category: string;
  defaultPoints: number;
}> = JSON.parse(fs.readFileSync(`${outDir}\\upsets_augmented_catalog.json`, 'utf8'));

const matrix: Array<{
  id: any;
  teams: string;
  league: string;
  result: string;
  actual: string;
  mFav: string;
  moUnderdog: string;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  basePoints: number;
  batch: string;
  triggeredRuleIds: number[];
  triggeredDescriptions: string[];
}> = JSON.parse(fs.readFileSync(`${outDir}\\upsets_augmented_matrix.json`, 'utf8'));

const ruleStats: Array<{
  id: number;
  description: string;
  category: string;
  defaultPoints: number;
  totalTriggers: number;
  underdogWins: number;
  draws: number;
  mfavWins: number;
  underdogWinPct: number;
  satTriggers: number;
  satUnderdogWins: number;
  satWinPct: number;
  sunTriggers: number;
  sunUnderdogWins: number;
  sunWinPct: number;
}> = [];

catalog.forEach(r => {
  let satTot = 0, satUd = 0, satDr = 0, satMf = 0;
  let sunTot = 0, sunUd = 0, sunDr = 0, sunMf = 0;

  matrix.forEach(m => {
    const isSat = m.batch.includes('Saturday');
    if (m.triggeredRuleIds.includes(r.id)) {
      if (isSat) {
        satTot++;
        if (m.outcome === 'UNDERDOG') satUd++;
        else if (m.outcome === 'DRAW') satDr++;
        else satMf++;
      } else {
        sunTot++;
        if (m.outcome === 'UNDERDOG') sunUd++;
        else if (m.outcome === 'DRAW') sunDr++;
        else sunMf++;
      }
    }
  });

  const totalTriggers = satTot + sunTot;
  const underdogWins = satUd + sunUd;
  const draws = satDr + sunDr;
  const mfavWins = satMf + sunMf;

  ruleStats.push({
    id: r.id,
    description: r.description,
    category: r.category,
    defaultPoints: r.defaultPoints,
    totalTriggers,
    underdogWins,
    draws,
    mfavWins,
    underdogWinPct: totalTriggers > 0 ? (underdogWins / totalTriggers) * 100 : 0,
    satTriggers: satTot,
    satUnderdogWins: satUd,
    satWinPct: satTot > 0 ? (satUd / satTot) * 100 : 0,
    sunTriggers: sunTot,
    sunUnderdogWins: sunUd,
    sunWinPct: sunTot > 0 ? (sunUd / sunTot) * 100 : 0
  });
});

fs.writeFileSync(`${outDir}\\upsets_detailed_stats.json`, JSON.stringify(ruleStats, null, 2));

console.log('ID | ' + 'Description'.padEnd(65) + ' | Pts | Tot |  Ud | Drw |  Mf |   Ud% |  Sat% |  Sun%');
console.log('-'.repeat(120));
ruleStats.sort((a, b) => b.underdogWinPct - a.underdogWinPct).forEach(s => {
  console.log(
    s.id.toString().padStart(2) + ' | ' +
    s.description.padEnd(65) + ' | ' +
    s.defaultPoints.toString().padStart(3) + ' | ' +
    s.totalTriggers.toString().padStart(3) + ' | ' +
    s.underdogWins.toString().padStart(3) + ' | ' +
    s.draws.toString().padStart(3) + ' | ' +
    s.mfavWins.toString().padStart(3) + ' | ' +
    s.underdogWinPct.toFixed(1).padStart(5) + '% | ' +
    s.satWinPct.toFixed(1).padStart(5) + '% | ' +
    s.sunWinPct.toFixed(1).padStart(5) + '%'
  );
});
