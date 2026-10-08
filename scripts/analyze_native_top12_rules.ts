import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const stats: Array<{
  index: number;
  description: string;
  currentPoints: number;
  totalHits: number;
  mfavHits: number;
  drawHits: number;
  udHits: number;
  mfavPct: number;
  drawPct: number;
  udPct: number;
  hedged1XPct: number;
}> = JSON.parse(fs.readFileSync(`${outDir}\\top12_detailed_stats.json`, 'utf8'));

console.log('=== TOP 15 NATIVE WIN DRIVERS (Highest Outright M.fav Win %) ===');
const winDrivers = [...stats]
  .filter(s => s.totalHits >= 5 && s.mfavPct >= 50)
  .sort((a, b) => b.mfavPct - a.mfavPct);

winDrivers.forEach(r => {
  console.log(`[#${r.index}] ${r.description} (Cur: ${r.currentPoints} pts) => Total: ${r.totalHits}, Mfav: ${r.mfavHits} (${r.mfavPct}%), Draw: ${r.drawHits} (${r.drawPct}%), Ud: ${r.udHits} (${r.udPct}%), 1X: ${r.hedged1XPct}%`);
});

console.log('\n=== TOP 15 NATIVE 1X HEDGED DRIVERS (Highest M.fav + Draw %) ===');
const hedgedDrivers = [...stats]
  .filter(s => s.totalHits >= 5 && s.hedged1XPct >= 80)
  .sort((a, b) => b.hedged1XPct - a.hedged1XPct);

hedgedDrivers.forEach(r => {
  console.log(`[#${r.index}] ${r.description} (Cur: ${r.currentPoints} pts) => Total: ${r.totalHits}, Mfav: ${r.mfavHits} (${r.mfavPct}%), Draw: ${r.drawHits} (${r.drawPct}%), Ud: ${r.udHits} (${r.udPct}%), 1X: ${r.hedged1XPct}%`);
});

console.log('\n=== TOP 15 LETHAL TRAPS / UNDERDOG LOSS DRIVERS (Highest Ud Loss %) ===');
const traps = [...stats]
  .filter(s => s.totalHits >= 5 && s.udPct >= 35)
  .sort((a, b) => b.udPct - a.udPct);

traps.forEach(r => {
  console.log(`[#${r.index}] ${r.description} (Cur: ${r.currentPoints} pts) => Total: ${r.totalHits}, Mfav: ${r.mfavHits} (${r.mfavPct}%), Draw: ${r.drawHits} (${r.drawPct}%), Ud: ${r.udHits} (${r.udPct}%), 1X: ${r.hedged1XPct}%`);
});

console.log('\n=== TOP DRAW MAGNETS (Highest Draw %) ===');
const drawMagnets = [...stats]
  .filter(s => s.totalHits >= 5 && s.drawPct >= 35)
  .sort((a, b) => b.drawPct - a.drawPct);

drawMagnets.forEach(r => {
  console.log(`[#${r.index}] ${r.description} (Cur: ${r.currentPoints} pts) => Total: ${r.totalHits}, Mfav: ${r.mfavHits} (${r.mfavPct}%), Draw: ${r.drawHits} (${r.drawPct}%), Ud: ${r.udHits} (${r.udPct}%), 1X: ${r.hedged1XPct}%`);
});

console.log('\n=== RULES WITH 0 HITS (Zero Discriminative Value) ===');
const zeroHits = stats.filter(s => s.totalHits === 0);
console.log(`Count: ${zeroHits.length} rules with zero hits:`);
zeroHits.forEach(r => console.log(`[#${r.index}] ${r.description}`));
