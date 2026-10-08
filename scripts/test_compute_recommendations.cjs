const fs = require('fs');

console.log('Testing computeCategoryRecommendations concept...');
const cachedMatches = JSON.parse(fs.readFileSync('scratch/cached_matches.json', 'utf-8'));
console.log('Loaded cached matches:', cachedMatches.length);

// Verify that tag matching works
const categories = [
  { id: 'top_10_value', label: 'Top 12 Value', tagPrefix: 'top10:', targetObjective: 'mfav_draw', targetCapacity: 12 },
  { id: 'best_bet', label: 'Best Bets', tagPrefix: 'best_bet:', targetObjective: 'mfav_only', targetCapacity: 10 },
  { id: 'bankers_dlive', label: 'Bankers Dlive', tagPrefix: 'bankers_dlive:', targetObjective: 'mfav_only', targetCapacity: 10 },
  { id: 'bankers_jackpot', label: 'Bankers Jackpot', tagPrefix: 'bankers_jackpot:', targetObjective: 'mfav_only', targetCapacity: 5 },
  { id: 'value_picks', label: 'Value Picks', tagPrefix: 'value_picks:', targetObjective: 'mfav_only', targetCapacity: 5 },
  { id: 'upsets', label: 'Upsets', tagPrefix: 'upsets:', targetObjective: 'underdog_only', targetCapacity: 5 },
  { id: 'botb_best', label: 'BOTB', tagPrefix: 'botb_best:', targetObjective: 'mfav_only', targetCapacity: 10 }
];

categories.forEach(cat => {
  const matches = cachedMatches.filter(m => {
    const tags = m.evaluatorTags || [];
    return tags.some(t => t.startsWith(cat.tagPrefix));
  });
  console.log(`Category ${cat.id} (${cat.label}): ${matches.length} tagged matches`);
});
