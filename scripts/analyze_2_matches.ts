import { supabase } from '../src/lib/supabase';
import { processMatch, getActualResult } from '../src/utils/matchProcessing';
import { getMatchStats } from '../src/utils/matchEvaluator';
import { predictSeerDetailed } from '../src/utils/seerLogic';
import { Match } from '../src/types';
import weights from '../src/utils/seerWeights.json';

// Local storage mock
if (typeof global !== 'undefined') {
  (global as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
}

async function main() {
  const queryTeams = ["Posusje vs Sloga Doboj", "Nocerina vs Ischia"];
  const rawMatches: Match[] = [];
  
  const step = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('precalculated_matches').select('id, data').range(from, from + step - 1);
    if (error || !data || data.length === 0) break;
    data.forEach(row => { 
       const m = row.data as Match;
       if (queryTeams.includes(m.teams)) {
           rawMatches.push(m);
       }
    });
    if (data.length < step) break;
    from += step;
  }

  let phaStatsMap: Record<string, any> = {};
  try {
    const { data: phaData } = await supabase.from('pha_stats').select('*');
    if (phaData) phaData.forEach(row => { if (row.sub_pattern) phaStatsMap[row.sub_pattern] = row; });
  } catch (e) {}

  for (const raw of rawMatches) {
      const m = processMatch(raw);
      const stats = getMatchStats(m, phaStatsMap);
      const actual = getActualResult(m.result ? String(m.result) : 'UNKNOWN');
      
      console.log(`\n============================`);
      console.log(`${m.teams} | Actual: ${actual}`);
      console.log(`Fav Odds: ${stats.favOdds}`);
      console.log(`PAA Pred: ${stats.paaStats?.finalPrediction} | PAA Fav: ${stats.paaStats?.favSupport}%`);
      console.log(`Algo Pred: ${stats.algoPred} | Algo Fav: ${stats.algoFavSupport}%`);
      console.log(`PHA Sub: ${stats.phaSubPred} | PHA Fav: ${stats.phaFavSupport}%`);
      console.log(`Upset Rate: ${stats.paaStats?.upsetRate}`);
      console.log(`Main Pattern: ${m.patternAnalysis?.mainPattern} | Sub: ${m.patternAnalysis?.subPattern}`);
      console.log(`Score (from generateSeerSlips point of view) can be seen by checking gating:`);
      
      const paaFinal = stats.paaStats?.finalPrediction || '';
      console.log(`Is PAA opposing market fav (${stats.moFav})? -> ${paaFinal && !paaFinal.includes(stats.moFav)}`);
  }
}

main().catch(console.error);
