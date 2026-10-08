import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const rulesCatalog = JSON.parse(fs.readFileSync(`${outDir}\\bankers_jackpot_rules_catalog.json`, 'utf8'));
const matchesMatrix = JSON.parse(fs.readFileSync(`${outDir}\\bankers_jackpot_matches_matrix.json`, 'utf8'));

const totalMatches = matchesMatrix.length;
const totalMfav = matchesMatrix.filter((m: any) => m.outcome === 'MFAV').length;
const totalDraw = matchesMatrix.filter((m: any) => m.outcome === 'DRAW').length;
const totalUd = matchesMatrix.filter((m: any) => m.outcome === 'UNDERDOG').length;
const totalLoss = totalDraw + totalUd;

console.log(`Analyzing ${rulesCatalog.length} rules over ${totalMatches} matches.`);
console.log(`Global baseline: Mfav=${totalMfav} (${((totalMfav/totalMatches)*100).toFixed(1)}%), Draw=${totalDraw} (${((totalDraw/totalMatches)*100).toFixed(1)}%), Underdog=${totalUd} (${((totalUd/totalMatches)*100).toFixed(1)}%)`);

const analyzed = rulesCatalog.map((r: any) => {
  const hits = r.totalHits;
  const mfav = r.mfavHits;
  const draw = r.drawHits;
  const ud = r.udHits;
  const losses = draw + ud;

  const winRate = hits > 0 ? (mfav / hits) * 100 : 0;
  const drawRate = hits > 0 ? (draw / hits) * 100 : 0;
  const udRate = hits > 0 ? (ud / hits) * 100 : 0;
  const lossRate = hits > 0 ? (losses / hits) * 100 : 0;

  // Non-hit counts
  const nonHitMfav = totalMfav - mfav;
  const nonHitLoss = totalLoss - losses;
  const nonHitDraw = totalDraw - draw;
  const nonHitNonDraw = (totalMatches - totalDraw) - (hits - draw);
  const nonHitUd = totalUd - ud;
  const nonHitNonUd = (totalMatches - totalUd) - (hits - ud);

  // Odds ratios (with Laplace smoothing 0.5)
  const winOR = ((mfav + 0.5) / (losses + 0.5)) / ((nonHitMfav + 0.5) / (nonHitLoss + 0.5));
  const drawOR = ((draw + 0.5) / (hits - draw + 0.5)) / ((nonHitDraw + 0.5) / (nonHitNonDraw + 0.5));
  const udOR = ((ud + 0.5) / (hits - ud + 0.5)) / ((nonHitUd + 0.5) / (nonHitNonUd + 0.5));

  return {
    index: r.index,
    description: r.description,
    currentPoints: r.currentPoints,
    totalHits: hits,
    mfavHits: mfav,
    drawHits: draw,
    udHits: ud,
    winRate: parseFloat(winRate.toFixed(1)),
    drawRate: parseFloat(drawRate.toFixed(1)),
    udRate: parseFloat(udRate.toFixed(1)),
    lossRate: parseFloat(lossRate.toFixed(1)),
    winOR: parseFloat(winOR.toFixed(2)),
    drawOR: parseFloat(drawOR.toFixed(2)),
    udOR: parseFloat(udOR.toFixed(2))
  };
});

fs.writeFileSync(`${outDir}\\bankers_jackpot_detailed_stats.json`, JSON.stringify(analyzed, null, 2));

console.log('\n--- TOP 25 OUTRIGHT WIN DRIVERS (High Win Rate & Hits >= 3) ---');
const topWins = analyzed
  .filter((r: any) => r.totalHits >= 3 && r.winRate >= 55)
  .sort((a: any, b: any) => b.winOR - a.winOR);

topWins.slice(0, 25).forEach((r: any) => {
  console.log(`[#${r.index}] "${r.description}": WinRate=${r.winRate}% (W:${r.mfavHits} D:${r.drawHits} L:${r.udHits}) | Win OR=${r.winOR} | CurrentPts=${r.currentPoints}`);
});

console.log('\n--- TOP 25 DRAW TRAPS (High Draw Rate & Hits >= 3) ---');
const topDraws = analyzed
  .filter((r: any) => r.totalHits >= 3 && r.drawRate >= 30)
  .sort((a: any, b: any) => b.drawOR - a.drawOR);

topDraws.slice(0, 25).forEach((r: any) => {
  console.log(`[#${r.index}] "${r.description}": DrawRate=${r.drawRate}% (W:${r.mfavHits} D:${r.drawHits} L:${r.udHits}) | Draw OR=${r.drawOR} | CurrentPts=${r.currentPoints}`);
});

console.log('\n--- TOP 25 UNDERDOG UPSET TRAPS (High Underdog Rate & Hits >= 3) ---');
const topUpsets = analyzed
  .filter((r: any) => r.totalHits >= 3 && r.udRate >= 28)
  .sort((a: any, b: any) => b.udOR - a.udOR);

topUpsets.slice(0, 25).forEach((r: any) => {
  console.log(`[#${r.index}] "${r.description}": UdRate=${r.udRate}% (W:${r.mfavHits} D:${r.drawHits} L:${r.udHits}) | Ud OR=${r.udOR} | CurrentPts=${r.currentPoints}`);
});

console.log('\n--- WORST OVERALL PERFORMERS (Highest Loss Rate & Hits >= 5) ---');
const worstRules = analyzed
  .filter((r: any) => r.totalHits >= 5 && r.lossRate >= 60)
  .sort((a: any, b: any) => b.lossRate - a.lossRate);

worstRules.slice(0, 25).forEach((r: any) => {
  console.log(`[#${r.index}] "${r.description}": LossRate=${r.lossRate}% (W:${r.mfavHits} D:${r.drawHits} L:${r.udHits} of ${r.totalHits}) | CurrentPts=${r.currentPoints}`);
});
