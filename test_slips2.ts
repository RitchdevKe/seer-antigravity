import { getMatchStats, evaluateMatchCategory } from './src/utils/matchEvaluator';
const dummyMatches = [
  { id: '1', mo: '1.4, 3.5, 7.0', teams: 'Team A vs Team B', date: '2026-09-04', rawPrediction: '1', finalPrediction: '1X', patternAnalysis: { subPattern: 'X' }, pred1x2: '1' }
];
const phaStatsMap = {
  'X': {
    total: 100,
    outcomes: { '1': 80, 'X': 10, '2': 10 }
  }
};
const m = dummyMatches[0];
const r = evaluateMatchCategory(m as any, 'best_bet', 'all', phaStatsMap, false, true, {});
console.log('Result for best_bet:', r);
const stats = getMatchStats(m as any, phaStatsMap);
console.log('Stats:', stats.phaFavWinSupport, stats.probFav, stats.favOdds);

