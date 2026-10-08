import fs from 'fs';
import path from 'path';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { 
  getMarketFavorite, 
  getOptimizedScoreDetailed, 
  OPTIMIZED_CATEGORY_SETTINGS, 
  CODE_DEFAULT_CATEGORY_SETTINGS 
} from '../src/utils/optimizedweights';
import { getMatchEvaluatorTags } from '../src/utils/matchEvaluator';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\live_matches_dump.json';
const rawData = fs.readFileSync(dumpPath, 'utf8');
const liveMatches: Match[] = JSON.parse(rawData);

console.log(`Loaded ${liveMatches.length} matches from dump.`);

const prefix = 'best_bet:';
const phaStatsMap = {};
const matchStars = {};

const categoryMatches = liveMatches.filter(m => {
  const tags = m.evaluatorTags && m.evaluatorTags.length > 0 
    ? m.evaluatorTags 
    : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
  return tags.some(t => t.startsWith(prefix));
});

console.log(`Best Bet Category Matches count: ${categoryMatches.length}`);

let totalMfav = 0;
let totalDraw = 0;
let totalUnderdog = 0;
let totalPending = 0;

const completedCategoryMatches: Match[] = [];

categoryMatches.forEach(m => {
  const actual = getActualResult(m.result || '');
  if (actual === '1' || actual === 'X' || actual === '2') {
    completedCategoryMatches.push(m);
    const mFav = getMarketFavorite(m);
    if (actual === mFav) totalMfav++;
    else if (actual === 'X') totalDraw++;
    else totalUnderdog++;
  } else {
    totalPending++;
  }
});

console.log(`Completed: ${completedCategoryMatches.length}, Pending: ${totalPending}`);
console.log(`Mfav wins: ${totalMfav} (${((totalMfav/completedCategoryMatches.length)*100).toFixed(1)}%)`);
console.log(`Draws: ${totalDraw} (${((totalDraw/completedCategoryMatches.length)*100).toFixed(1)}%)`);
console.log(`Underdog wins: ${totalUnderdog} (${((totalUnderdog/completedCategoryMatches.length)*100).toFixed(1)}%)`);

// Now compute rule stats
const evalCat = 'best_bet';
const catSettings = OPTIMIZED_CATEGORY_SETTINGS[evalCat] || CODE_DEFAULT_CATEGORY_SETTINGS[evalCat];
const ruleMap = new Map<string, { points: number; mfavHits: number; drawHits: number; underdogHits: number }>();

if (catSettings && catSettings.rules) {
  catSettings.rules.forEach(r => {
    ruleMap.set(r.description, { points: r.points, mfavHits: 0, drawHits: 0, underdogHits: 0 });
  });
}

completedCategoryMatches.forEach(match => {
  const actual = getActualResult(match.result || '');
  const mFav = getMarketFavorite(match);
  const outcome = actual === mFav ? 'mfav' : (actual === 'X' ? 'draw' : 'underdog');

  const detail = getOptimizedScoreDetailed(match, evalCat, phaStatsMap);
  if (detail && detail.rulesHit) {
    const matchHitDescriptions = new Set<string>();
    detail.rulesHit.forEach(hit => {
      if (matchHitDescriptions.has(hit.description)) return;
      matchHitDescriptions.add(hit.description);

      let entry = ruleMap.get(hit.description);
      if (!entry) {
        entry = { points: hit.points, mfavHits: 0, drawHits: 0, underdogHits: 0 };
        ruleMap.set(hit.description, entry);
      }
      if (outcome === 'mfav') entry.mfavHits++;
      else if (outcome === 'draw') entry.drawHits++;
      else entry.underdogHits++;
    });
  }
});

console.log(`\nTotal rules in ruleMap: ${ruleMap.size}`);

// Print top rules sorted by mfavHits desc
const rows = Array.from(ruleMap.entries()).map(([desc, data]) => ({
  desc,
  points: data.points,
  mfavHits: data.mfavHits,
  drawHits: data.drawHits,
  underdogHits: data.underdogHits
}));

rows.sort((a, b) => b.mfavHits - a.mfavHits);
console.log('\nTop 10 rules by Mfav hits:');
rows.slice(0, 10).forEach(r => {
  console.log(`${r.desc} | pts: ${r.points} | Mfav: ${r.mfavHits}/${totalMfav} | Draw: ${r.drawHits}/${totalDraw} | Ud: ${r.underdogHits}/${totalUnderdog}`);
});
