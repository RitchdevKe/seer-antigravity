import fs from 'fs';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { getMarketFavorite, getOptimizedScoreDetailed } from '../src/utils/optimizedweights';
import { getMatchEvaluatorTags } from '../src/utils/matchEvaluator';

const dumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\live_matches_dump.json';
const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const liveMatches: Match[] = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const phaStatsMap = {};
const matchStars = {};

const categoryMatches = liveMatches.filter(m => {
  const tags = m.evaluatorTags && m.evaluatorTags.length > 0 
    ? m.evaluatorTags 
    : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
  return tags.some(t => t.startsWith('top10:'));
});

const completed = categoryMatches.filter(m => {
  const actual = getActualResult(m.result || '');
  return actual === '1' || actual === 'X' || actual === '2';
});

// Evaluate all rules triggered across BB, BDL, and BJ on these Top 12 matches
const nativeCatalog: Array<{ index: number; description: string; currentPoints: number }> = JSON.parse(
  fs.readFileSync(`${outDir}\\top12_rules_catalog.json`, 'utf8')
);
const nativeDescs = new Set(nativeCatalog.map(r => r.description));

const borrowedCandidateStats = new Map<string, {
  total: number;
  mfav: number;
  draw: number;
  ud: number;
  source: string;
}>();

completed.forEach(match => {
  const actual = getActualResult(match.result || '');
  const mFav = getMarketFavorite(match);
  const outcome = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');

  const bbDetail = getOptimizedScoreDetailed(match, 'best_bet', phaStatsMap);
  const bdlDetail = getOptimizedScoreDetailed(match, 'bankers_dlive', phaStatsMap);
  const bjDetail = getOptimizedScoreDetailed(match, 'bankers_jackpot', phaStatsMap);

  const seenInMatch = new Set<string>();

  const processHits = (hits: Array<{ description: string }>, source: string) => {
    hits.forEach(h => {
      const d = h.description;
      if (!nativeDescs.has(d) && !seenInMatch.has(d)) {
        seenInMatch.add(d);
        if (!borrowedCandidateStats.has(d)) {
          borrowedCandidateStats.set(d, { total: 0, mfav: 0, draw: 0, ud: 0, source });
        }
        const st = borrowedCandidateStats.get(d)!;
        st.total++;
        if (outcome === 'MFAV') st.mfav++;
        else if (outcome === 'DRAW') st.draw++;
        else st.ud++;
      }
    });
  };

  processHits(bbDetail.rulesHit, 'BB');
  processHits(bdlDetail.rulesHit, 'BDL');
  processHits(bjDetail.rulesHit, 'BJ');
});

const resultList: any[] = [];
borrowedCandidateStats.forEach((st, desc) => {
  if (st.total >= 3) { // At least 3 hits in Top 12 matches
    resultList.push({
      description: desc,
      source: st.source,
      total: st.total,
      mfav: st.mfav,
      draw: st.draw,
      ud: st.ud,
      mfavPct: Number(((st.mfav / st.total) * 100).toFixed(1)),
      drawPct: Number(((st.draw / st.total) * 100).toFixed(1)),
      udPct: Number(((st.ud / st.total) * 100).toFixed(1)),
      hedged1XPct: Number((((st.mfav + st.draw) / st.total) * 100).toFixed(1))
    });
  }
});

resultList.sort((a, b) => b.total - a.total);

fs.writeFileSync(`${outDir}\\borrowable_top12_rules_stats.json`, JSON.stringify(resultList, null, 2));
console.log(`Evaluated ${resultList.length} candidate borrowable rules from BB, BDL, BJ.`);

console.log('\n--- TOP BORROWABLE CANDIDATES FOR WIN DRIVERS (Highest 1X / Mfav Pct) ---');
resultList
  .filter(r => r.hedged1XPct >= 80 || r.mfavPct >= 60)
  .slice(0, 15)
  .forEach(r => console.log(`[${r.source}] ${r.description} => Total: ${r.total}, Mfav: ${r.mfav} (${r.mfavPct}%), Draw: ${r.draw} (${r.drawPct}%), Ud: ${r.ud} (${r.udPct}%), 1X: ${r.hedged1XPct}%`));

console.log('\n--- TOP BORROWABLE CANDIDATES FOR RISK SUPPRESSORS (Highest Underdog Failure Rate) ---');
resultList
  .filter(r => r.udPct >= 40)
  .slice(0, 15)
  .forEach(r => console.log(`[${r.source}] ${r.description} => Total: ${r.total}, Mfav: ${r.mfav} (${r.mfavPct}%), Draw: ${r.draw} (${r.drawPct}%), Ud: ${r.ud} (${r.udPct}%), 1X: ${r.hedged1XPct}%`));
