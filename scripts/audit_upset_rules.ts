import fs from 'fs';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { getMarketFavorite, getOptimizedScoreDetailed, getOptimizedBaseWeight, CODE_DEFAULT_CATEGORY_SETTINGS } from '../src/utils/optimizedweights';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_upsets_matches.json';
const matches: Array<{
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
  match: Match;
}> = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const phaStatsMap = {};

interface RuleStat {
  description: string;
  currentPoints: number;
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
}

const ruleStatsMap = new Map<string, {
  currentPoints: number;
  satTotal: number; satUd: number; satDr: number; satMf: number;
  sunTotal: number; sunUd: number; sunDr: number; sunMf: number;
}>();

// Run detailed evaluation on all matches
matches.forEach(m => {
  const isSat = m.batch.includes('Saturday');
  const isUd = m.outcome === 'UNDERDOG';
  const isDr = m.outcome === 'DRAW';
  const isMf = m.outcome === 'MFAV';

  const detail = getOptimizedScoreDetailed(m.match, 'upsets', phaStatsMap);
  detail.rulesHit.forEach(r => {
    if (!ruleStatsMap.has(r.description)) {
      ruleStatsMap.set(r.description, {
        currentPoints: r.points,
        satTotal: 0, satUd: 0, satDr: 0, satMf: 0,
        sunTotal: 0, sunUd: 0, sunDr: 0, sunMf: 0
      });
    }
    const stat = ruleStatsMap.get(r.description)!;
    if (isSat) {
      stat.satTotal++;
      if (isUd) stat.satUd++;
      else if (isDr) stat.satDr++;
      else stat.satMf++;
    } else {
      stat.sunTotal++;
      if (isUd) stat.sunUd++;
      else if (isDr) stat.sunDr++;
      else stat.sunMf++;
    }
  });
});

const results: RuleStat[] = [];
ruleStatsMap.forEach((val, desc) => {
  const totalTriggers = val.satTotal + val.sunTotal;
  const underdogWins = val.satUd + val.sunUd;
  const draws = val.satDr + val.sunDr;
  const mfavWins = val.satMf + val.sunMf;
  results.push({
    description: desc,
    currentPoints: val.currentPoints,
    totalTriggers,
    underdogWins,
    draws,
    mfavWins,
    underdogWinPct: totalTriggers > 0 ? (underdogWins / totalTriggers) * 100 : 0,
    satTriggers: val.satTotal,
    satUnderdogWins: val.satUd,
    satWinPct: val.satTotal > 0 ? (val.satUd / val.satTotal) * 100 : 0,
    sunTriggers: val.sunTotal,
    sunUnderdogWins: val.sunUd,
    sunWinPct: val.sunTotal > 0 ? (val.sunUd / val.sunTotal) * 100 : 0
  });
});

// Save complete stats to scratch
const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
fs.writeFileSync(`${outDir}\\upsets_native_rules_stats.json`, JSON.stringify(results, null, 2));

console.log(`Audited ${results.length} active native rules in Upsets.\n`);

// Sort by Underdog Win %
results.sort((a, b) => b.underdogWinPct - a.underdogWinPct);

console.log('=== TOP 15 UNDERDOG WIN DRIVERS (High Upset Win Rate) ===');
results.filter(r => r.totalTriggers >= 5 && r.underdogWinPct >= 35).slice(0, 15).forEach(r => {
  console.log(`${r.description.padEnd(65)} | Pts: ${r.currentPoints.toString().padStart(3)} | Tot: ${r.totalTriggers.toString().padStart(3)} | Ud: ${r.underdogWins.toString().padStart(2)} (${r.underdogWinPct.toFixed(1)}%) | Sat: ${r.satWinPct.toFixed(1)}% | Sun: ${r.sunWinPct.toFixed(1)}%`);
});

console.log('\n=== WORST 15 UNDERDOG TRAPS (Low Upset Win Rate, high Mfav/Draw) ===');
results.filter(r => r.totalTriggers >= 10 && r.underdogWinPct <= 25).sort((a, b) => a.underdogWinPct - b.underdogWinPct).slice(0, 15).forEach(r => {
  console.log(`${r.description.padEnd(65)} | Pts: ${r.currentPoints.toString().padStart(3)} | Tot: ${r.totalTriggers.toString().padStart(3)} | Ud: ${r.underdogWins.toString().padStart(2)} (${r.underdogWinPct.toFixed(1)}%) | Sat: ${r.satWinPct.toFixed(1)}% | Sun: ${r.sunWinPct.toFixed(1)}% | MFav: ${r.mfavWins}`);
});
