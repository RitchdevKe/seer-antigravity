import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const stats = JSON.parse(fs.readFileSync(`${outDir}\\bankers_dlive_detailed_stats.json`, 'utf8'));

console.log('=== TOP WIN DRIVERS (WIN RATE >= 55% AND HITS >= 5) ===');
stats
  .filter((r: any) => r.winRate >= 55 && r.totalHits >= 5)
  .sort((a: any, b: any) => b.winRate - a.winRate)
  .forEach((r: any) => {
    console.log(`[#${r.index}] "${r.description}": WinRate=${r.winRate}% (W:${r.mfavHits} D:${r.drawHits} L:${r.udHits}, total=${r.totalHits}) | WinOR=${r.winOR} | CurrentPts=${r.currentPoints}`);
  });
