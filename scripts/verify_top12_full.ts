// Re-running this locally to capture the output since it was truncated.
import { supabase } from '../src/lib/supabase';
import { processMatch, getActualResult } from '../src/utils/matchProcessing';
import { getMatchEvaluatorTags, getMatchStats } from '../src/utils/matchEvaluator';
import { predictSeerDetailed } from '../src/utils/seerLogic';
import { generateSeerSlips } from '../src/utils/seerSlipSelection';
import { Match } from '../src/types';
import weights from '../src/utils/seerWeights.json';

// Local storage mock
if (typeof global !== 'undefined') {
  (global as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
}

async function main() {
  console.log("Fetching all matches for final verify...");
  const rawMatches: Match[] = [];
  const step = 1000;
  for (let table of ['precalculated_matches', 'user_uploaded_matches']) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase.from(table).select('id, data').range(from, from + step - 1);
      if (error || !data || data.length === 0) break;
      data.forEach(row => { if (row.data) rawMatches.push(row.data as Match); });
      if (data.length < step) break;
      from += step;
    }
  }

  const uniqueMap = new Map();
  rawMatches.forEach(m => { if (m && m.id) uniqueMap.set(m.id.toString(), m); });
  const matches = Array.from(uniqueMap.values());
  console.log(`Loaded ${matches.length} unique matches.`);

  let phaStatsMap: Record<string, any> = {};
  try {
    const { data: phaData } = await supabase.from('pha_stats').select('*');
    if (phaData) phaData.forEach(row => { if (row.sub_pattern) phaStatsMap[row.sub_pattern] = row; });
  } catch (e) {}

  const top10Matches: Match[] = [];
  matches.forEach(rawMatch => {
    const m = processMatch(rawMatch);
    const tags = getMatchEvaluatorTags(m, phaStatsMap);
    const hasTag = tags.some(t => t.startsWith('top10:'));
    const stats = getMatchStats(m, phaStatsMap);
    
    if (hasTag || (stats.favOdds >= 2.0 && stats.favOdds <= 2.49)) {
      top10Matches.push(m);
    }
  });

  const slips = generateSeerSlips(top10Matches, phaStatsMap, {}, false, true);
  const slip = slips.spec.top_10_value || [];
  
  console.log(`\nGenerated Top 12 Value Slip (${slip.length} matches)`);
  let successes = 0, pureFav = 0;
  
  slip.forEach((p, i) => {
    const m = top10Matches.find(x => x.id.toString() === p.match_id);
    if (!m) return;
    const stats = getMatchStats(m, phaStatsMap);
    const actual = getActualResult(m.result ? String(m.result) : 'UNKNOWN');
    if (actual === 'pending' || actual === 'UNKNOWN') {
       console.log(`[Pick ${i+1}] ${m.teams} - PENDING`);
       return;
    }
    
    let isSuccess = false;
    if (actual === stats.moFav) { successes++; pureFav++; isSuccess = true; }
    else if (actual === 'X') { successes++; isSuccess = true; }
    
    console.log(`[Pick ${i+1}] ${m.teams} | Odds: ${stats.favOdds} | Pred: ${p.prediction} | Actual: ${actual} | ${isSuccess ? '✅ SAFE' : '❌ UPSET LOSS'} | UpsetRate: ${stats.paaStats?.upsetRate}`);
  });
  
  const comp = slip.filter(p => {
     const m = top10Matches.find(x => x.id.toString() === p.match_id);
     if(!m) return false;
     const actual = getActualResult(m.result ? String(m.result) : 'UNKNOWN');
     return actual !== 'pending' && actual !== 'UNKNOWN';
  }).length;
  
  console.log(`\nSuccess Rate: ${comp > 0 ? (successes/comp*100).toFixed(1) : 0}% (${successes}/${comp})`);
  console.log(`Pure Fav Win: ${comp > 0 ? (pureFav/comp*100).toFixed(1) : 0}%`);
}

main().catch(console.error);
