import fs from 'fs';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { 
  getMarketFavorite, 
  getOptimizedScoreDetailed 
} from '../src/utils/optimizedweights';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\live_matches_dump.json';
const liveMatches: Match[] = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const phaStatsMap = {};

// Filter matches that belong to bankers_jackpot
const bjMatches = liveMatches.filter(m => {
  const tags = m.evaluatorTags || [];
  return tags.some(t => t.startsWith('bankers_jackpot:'));
});

const completed = bjMatches.filter(m => {
  const actual = getActualResult(m.result || '');
  return actual === '1' || actual === 'X' || actual === '2';
});

console.log(`Analyzing borrowable rules across ${completed.length} completed Bankers Jackpot matches...`);

// Evaluate each completed BJ match under best_bet and bankers_dlive evaluation blocks
// to see which external rules trigger on BJ matches!
const bestBetRuleStats = new Map<string, { mfav: number; draw: number; ud: number; total: number }>();
const bankersDliveRuleStats = new Map<string, { mfav: number; draw: number; ud: number; total: number }>();

completed.forEach(m => {
  const actual = getActualResult(m.result || '');
  const mFav = getMarketFavorite(m);
  const outcome = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');

  // Best Bet rules
  const bbDetail = getOptimizedScoreDetailed(m, 'best_bet', phaStatsMap);
  const bbSeen = new Set<string>();
  bbDetail.rulesHit.forEach(h => {
    if (bbSeen.has(h.description)) return;
    bbSeen.add(h.description);
    if (!bestBetRuleStats.has(h.description)) {
      bestBetRuleStats.set(h.description, { mfav: 0, draw: 0, ud: 0, total: 0 });
    }
    const stat = bestBetRuleStats.get(h.description)!;
    stat.total++;
    if (outcome === 'MFAV') stat.mfav++;
    else if (outcome === 'DRAW') stat.draw++;
    else stat.ud++;
  });

  // Bankers Dlive rules
  const bdlDetail = getOptimizedScoreDetailed(m, 'bankers_dlive', phaStatsMap);
  const bdlSeen = new Set<string>();
  bdlDetail.rulesHit.forEach(h => {
    if (bdlSeen.has(h.description)) return;
    bdlSeen.add(h.description);
    if (!bankersDliveRuleStats.has(h.description)) {
      bankersDliveRuleStats.set(h.description, { mfav: 0, draw: 0, ud: 0, total: 0 });
    }
    const stat = bankersDliveRuleStats.get(h.description)!;
    stat.total++;
    if (outcome === 'MFAV') stat.mfav++;
    else if (outcome === 'DRAW') stat.draw++;
    else stat.ud++;
  });
});

// Load current BJ rules to find what's missing
const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const bjRulesCatalog: Array<{ description: string }> = JSON.parse(fs.readFileSync(`${outDir}\\bankers_jackpot_rules_catalog.json`, 'utf8'));
const currentBjRuleDescs = new Set(bjRulesCatalog.map(r => r.description));

const borrowableCandidates: any[] = [];

const processCandidates = (map: Map<string, any>, source: string) => {
  map.forEach((stat, desc) => {
    if (currentBjRuleDescs.has(desc)) return; // already in BJ
    if (stat.total < 3) return; // need some sample size

    const winRate = (stat.mfav / stat.total) * 100;
    const drawRate = (stat.draw / stat.total) * 100;
    const udRate = (stat.ud / stat.total) * 100;
    const lossRate = ((stat.draw + stat.ud) / stat.total) * 100;

    borrowableCandidates.push({
      source,
      description: desc,
      totalHits: stat.total,
      mfav: stat.mfav,
      draw: stat.draw,
      ud: stat.ud,
      winRate: parseFloat(winRate.toFixed(1)),
      drawRate: parseFloat(drawRate.toFixed(1)),
      udRate: parseFloat(udRate.toFixed(1)),
      lossRate: parseFloat(lossRate.toFixed(1))
    });
  });
};

processCandidates(bestBetRuleStats, 'best_bet');
processCandidates(bankersDliveRuleStats, 'bankers_dlive');

fs.writeFileSync(`${outDir}\\borrowable_rules_stats.json`, JSON.stringify(borrowableCandidates, null, 2));

console.log('\n--- TOP BORROWABLE WIN DRIVERS (Win Rate >= 60% & Hits >= 5) ---');
const topBorrowWins = borrowableCandidates
  .filter(r => r.winRate >= 60 && r.totalHits >= 5)
  .sort((a, b) => b.winRate - a.winRate);

topBorrowWins.forEach(r => {
  console.log(`[${r.source}] "${r.description}": WinRate=${r.winRate}% (W:${r.mfav} D:${r.draw} L:${r.ud} of ${r.totalHits})`);
});

console.log('\n--- TOP BORROWABLE DRAW / RISK SUPPRESSORS (Loss Rate >= 65% & Hits >= 5) ---');
const topBorrowLosses = borrowableCandidates
  .filter(r => r.lossRate >= 65 && r.totalHits >= 5)
  .sort((a, b) => b.lossRate - a.lossRate);

topBorrowLosses.forEach(r => {
  console.log(`[${r.source}] "${r.description}": LossRate=${r.lossRate}% (W:${r.mfav} D:${r.draw} L:${r.ud} of ${r.totalHits})`);
});
