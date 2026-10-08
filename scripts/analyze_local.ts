import { RAW_MATCHES } from '../src/constants';
import { processMatch, getActualResult, getFavoriteAndUnderdog } from '../src/utils/matchProcessing';
import { getMatchEvaluatorTags, getMatchStats } from '../src/utils/matchEvaluator';
import { predictSeerDetailed } from '../src/utils/seerLogic';
import { getPAAPredictionForSeer, generateSeerSlips } from '../src/utils/seerSlipSelection';
import seerWeights from '../src/utils/seerWeights.json';

// Local storage mock
if (typeof global !== 'undefined') {
  (global as any).localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };
}

console.log("Analyzing local RAW_MATCHES sample set...");
const processedMatches = RAW_MATCHES.map(m => processMatch(m));
const top10Matches = processedMatches.filter(m => {
  const stats = getMatchStats(m, {});
  return stats.favOdds >= 2.0 && stats.favOdds <= 2.49;
});

console.log(`Found ${top10Matches.length} matches in 2.00 - 2.49 odds range from local set.`);

let favWins = 0, draws = 0, underdogWins = 0;
top10Matches.forEach(m => {
  const actual = getActualResult(m);
  const stats = getMatchStats(m, {});
  if (actual === stats.moFav) favWins++;
  else if (actual === 'X') draws++;
  else if (actual === stats.moUnderdog) underdogWins++;
});

console.log(`Outcomes in sample: FavWins=${favWins}, Draws=${draws}, UnderdogWins=${underdogWins}`);

const slips = generateSeerSlips(top10Matches, {}, {}, false, true);
const top12Slip = slips.spec.top_10_value || slips.live?.top_10_value || [];
console.log(`Top 12 Slip generated ${top12Slip.length} picks.`);
top12Slip.forEach((p, idx) => {
  const m = top10Matches.find(x => x.id.toString() === p.match_id);
  if (!m) return;
  const stats = getMatchStats(m, {});
  const actual = getActualResult(m);
  console.log(`[Pick ${idx+1}] ${m.teams} | Pick Pred: ${p.prediction} | Actual: ${actual} | FavOdds: ${stats.favOdds} | FavProb: ${(stats.probFav*100).toFixed(1)}%`);
});
