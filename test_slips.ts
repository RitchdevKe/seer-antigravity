import { getMatchEvaluatorTags } from './src/utils/matchEvaluator';
const dummyMatches = [
  { id: '1', mo: '1.4, 3.5, 7.0', teams: 'Team A vs Team B', date: '2026-09-04', rawPrediction: '1', finalPrediction: '1X', patternAnalysis: { subPattern: 'X' }, pred1x2: '1' }
];
const phaStatsMap = {
  'X': {
    total: 100,
    outcomes: { '1': 80, 'X': 10, '2': 10 }
  }
};
const tags = getMatchEvaluatorTags(dummyMatches[0] as any, phaStatsMap, false, true, {});
console.log('Tags:', tags);

