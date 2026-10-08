import fs from 'fs';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { getMarketFavorite, getOptimizedScoreDetailed } from '../src/utils/optimizedweights';
import { getMatchEvaluatorTags } from '../src/utils/matchEvaluator';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\live_matches_dump.json';
const liveMatches: Match[] = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const phaStatsMap = {};
const matchStars = {};

// ==========================================
// 1. TOP 12 (top_10_value / tag: top10:)
// ==========================================
const top12Matches = liveMatches.filter(m => {
  const tags = m.evaluatorTags && m.evaluatorTags.length > 0 
    ? m.evaluatorTags 
    : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
  return tags.some(t => t.startsWith('top10:'));
});

const completedTop12 = top12Matches.filter(m => {
  const actual = getActualResult(m.result || '');
  return actual === '1' || actual === 'X' || actual === '2';
});

console.log(`\n======================================================`);
console.log(`PRODUCTION VERIFICATION: TOP 12 (top_10_value)`);
console.log(`Total completed matches: ${completedTop12.length}`);
console.log(`======================================================`);

const scoredTop12 = completedTop12.map(match => {
  const actual = getActualResult(match.result || '');
  const mFav = getMarketFavorite(match);
  const outcome: 'MFAV' | 'DRAW' | 'UNDERDOG' = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
  const detail = getOptimizedScoreDetailed(match, 'top_10_value', phaStatsMap);
  return {
    id: match.id,
    teams: match.teams,
    result: match.result,
    actual,
    mFav,
    outcome,
    score: detail.totalScore,
    rulesHit: detail.rulesHit,
    hedgeProtocol: detail.activeHedgingProtocol
  };
});

scoredTop12.sort((a, b) => b.score - a.score);

const calc1XStats = (list: typeof scoredTop12) => {
  const mfav = list.filter(m => m.outcome === 'MFAV').length;
  const draw = list.filter(m => m.outcome === 'DRAW').length;
  const ud = list.filter(m => m.outcome === 'UNDERDOG').length;
  return {
    total: list.length,
    mfav,
    draw,
    ud,
    mfavPct: ((mfav / list.length) * 100).toFixed(1) + '%',
    hedged1XPct: (((mfav + draw) / list.length) * 100).toFixed(1) + '%'
  };
};

console.log('Top 12:', calc1XStats(scoredTop12.slice(0, 12)));
console.log('Top 20:', calc1XStats(scoredTop12.slice(0, 20)));
console.log('Top 30:', calc1XStats(scoredTop12.slice(0, 30)));

let cleanStreak1X = 0;
for (const m of scoredTop12) {
  if (m.outcome === 'MFAV' || m.outcome === 'DRAW') {
    cleanStreak1X++;
  } else {
    break;
  }
}

const firstUd = scoredTop12.find(m => m.outcome === 'UNDERDOG');
const firstUdRank = firstUd ? scoredTop12.findIndex(m => m.id === firstUd.id) + 1 : -1;
const top12MinScore = scoredTop12[11].score;
const maxUdScore = firstUd ? firstUd.score : 0;
const bufferGap = top12MinScore - maxUdScore;

console.log(`\nClean 1X Hedged Streak: ${cleanStreak1X} consecutive matches without underdog loss`);
console.log(`First Underdog Loss: Rank #${firstUdRank} (${firstUd?.teams}, ${firstUd?.result}, ${firstUd?.score} pts)`);
console.log(`Score Cushion Gap: +${bufferGap} pts (Top 12 Min [${top12MinScore} pts] vs Max Underdog [${maxUdScore} pts])`);

console.log(`\nTop 12 Selections:`);
scoredTop12.slice(0, 12).forEach((m, idx) => {
  console.log(`  #${idx + 1} [${m.score} pts] [${m.outcome}] ${m.teams} (Result: ${m.result}) -> Protocol: ${m.hedgeProtocol || 'None'}`);
});

// ==========================================
// 2. REGRESSION CHECKS: OTHER CATEGORIES
// ==========================================
console.log(`\n======================================================`);
console.log(`REGRESSION CHECKS ON EXISTING OPTIMIZED CATEGORIES`);
console.log(`======================================================`);

const runCategoryCheck = (catName: string, tagPrefix: string, topN: number) => {
  const catMatches = liveMatches.filter(m => {
    const tags = m.evaluatorTags && m.evaluatorTags.length > 0 
      ? m.evaluatorTags 
      : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
    return tags.some(t => t.startsWith(tagPrefix));
  });

  const completedCat = catMatches.filter(m => {
    const actual = getActualResult(m.result || '');
    return actual === '1' || actual === 'X' || actual === '2';
  });

  const scoredCat = completedCat.map(match => {
    const actual = getActualResult(match.result || '');
    const mFav = getMarketFavorite(match);
    const outcome: 'MFAV' | 'DRAW' | 'UNDERDOG' = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
    const detail = getOptimizedScoreDetailed(match, catName, phaStatsMap);
    return {
      id: match.id,
      outcome,
      score: detail.totalScore
    };
  });

  scoredCat.sort((a, b) => b.score - a.score);
  const topSlice = scoredCat.slice(0, topN);
  const mfavWins = topSlice.filter(m => m.outcome === 'MFAV').length;
  console.log(`${catName} (Top ${topN}): ${mfavWins}/${topN} Mfav Wins (${((mfavWins/topN)*100).toFixed(1)}%)`);
};

runCategoryCheck('best_bet', 'best_bet:', 10);
runCategoryCheck('bankers_dlive', 'bankers_dlive:', 10);
runCategoryCheck('bankers_jackpot', 'bankers_jackpot:', 10);
