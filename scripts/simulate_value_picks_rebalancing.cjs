const fs = require('fs');

// Load evaluated matches
const pool = JSON.parse(fs.readFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\sunday_value_picks_pool.json', 'utf8'));

// Helper to compute PHA base points (interval based on phaFavWin)
function getBasePhaPoints(pha) {
  if (pha >= 50) return 30;
  if (pha >= 40) return 20;
  return 10;
}

// Full candidate rules catalog for Value Picks
const candidateRules = [
  // === HIGH-CONFIDENCE SYNERGIES (Bonus + Bonus / Combo) ===
  {
    id: 'syn_algo45_50_ga_close',
    desc: 'SYNERGY: Algo support 45-50% + Mfav GA ≈ Ud GA',
    defaultPts: 20,
    test: m => m.algoProbFav >= 45 && m.algoProbFav <= 50 && m.isMfavGaUndGaClose
  },
  {
    id: 'syn_algo45_50_ga_gt_gs',
    desc: 'SYNERGY: Algo support 45-50% + Both GA > GS',
    defaultPts: 15,
    test: m => m.algoProbFav >= 45 && m.algoProbFav <= 50 && m.bothTeamsGAGtGS
  },
  {
    id: 'syn_away_fav_ts_ge_1',
    desc: 'SYNERGY: Away favorite + TS difference >= 1.0',
    defaultPts: 20,
    test: m => m.isAwayFav && m.tsDiff >= 1.0
  },
  {
    id: 'syn_odds_diff_ge_1_pha_ge_60',
    desc: 'SYNERGY: Odds diff >= 1.0 + PHA Fav Win >= 60%',
    defaultPts: 20,
    test: m => m.oddsDiff >= 1.0 && m.phaFavWin >= 60
  },
  {
    id: 'syn_ud_odds_ge_3_gs_ge_2',
    desc: 'SYNERGY: Ud odds >= 3.0 + Team GS >= 2.0 and GA >= 1.0',
    defaultPts: 15,
    test: m => m.udOdds >= 3.0 && m.bothGSGe2GAGe1
  },
  {
    id: 'syn_away_fav_algo45_50',
    desc: 'SYNERGY: Away favorite + Algo support 45-50%',
    defaultPts: 15,
    test: m => m.isAwayFav && m.algoProbFav >= 45 && m.algoProbFav <= 50
  },
  {
    id: 'syn_odds_diff_ge_1_ga_close',
    desc: 'SYNERGY: Odds diff >= 1.0 + Mfav GA ≈ Ud GA',
    defaultPts: 15,
    test: m => m.oddsDiff >= 1.0 && m.isMfavGaUndGaClose
  },
  {
    id: 'syn_ts_ge_1_odds_diff_ge_1',
    desc: 'SYNERGY: TS diff >= 1.0 + Odds diff >= 1.0',
    defaultPts: 15,
    test: m => m.tsDiff >= 1.0 && m.oddsDiff >= 1.0
  },

  // === STANDALONE BOOSTERS (Diluted to 5-10 pts to prevent inflation) ===
  {
    id: 'algo_mfav_45_50',
    desc: 'Algo support for Mfav is 45-50% (standalone)',
    defaultPts: 5,
    test: m => m.algoProbFav >= 45 && m.algoProbFav <= 50
  },
  {
    id: 'ts_diff_ge_1_0',
    desc: 'TS difference >= 1.0 (standalone)',
    defaultPts: 5,
    test: m => m.tsDiff >= 1.0
  },
  {
    id: 'pha_fav_win_ge_60',
    desc: 'PHA Fav Win >= 60% (standalone)',
    defaultPts: 10,
    test: m => m.phaFavWin >= 60
  },
  {
    id: 'odds_diff_ge_1_0',
    desc: 'Odds difference >= 1.0 (standalone)',
    defaultPts: 5,
    test: m => m.oddsDiff >= 1.0
  },
  {
    id: 'high_conviction_defense_attack',
    desc: 'High Conviction Defense + Attack Dominance',
    defaultPts: 15,
    test: m => m.highConvictionDefenseAttack
  },
  {
    id: 'fav_ts_ge_2_ud_ts_lt_07',
    desc: 'Mfav TS >= 2.0 and Underdog TS < 0.7',
    defaultPts: 15,
    test: m => m.favTsGe2UdTsLt07
  },
  {
    id: 'draw_odds_lt_3_0',
    desc: 'Odds for draw < 3.0 (standalone)',
    defaultPts: 5,
    test: m => m.drawOdds > 0 && m.drawOdds < 3.0
  },
  {
    id: 'ud_odds_ge_3_0',
    desc: 'Odds for underdog >= 3.0 (standalone)',
    defaultPts: 5,
    test: m => m.udOdds >= 3.0
  },
  {
    id: 'mfav_ga_le_1_ud_ga_gt_1',
    desc: 'Mfav GA <= 1.0 but Underdog GA > 1.0',
    defaultPts: 10,
    test: m => m.mFavGA <= 1.0 && m.udGA > 1.0
  },

  // === NEGATIVE PENALTIES / TRAPS (Drop losing matches below top 20/30) ===
  {
    id: 'razor_parity',
    desc: 'Razor parity (oddsDiff < 0.20)',
    defaultPts: -25,
    test: m => m.isRazorParity
  },
  {
    id: 'ud_odds_lt_2_8',
    desc: 'Odds for underdog < 2.8',
    defaultPts: -25,
    test: m => m.udOdds > 0 && m.udOdds < 2.8
  },
  {
    id: 'ts_diff_le_0_1',
    desc: 'TS difference <= 0.1',
    defaultPts: -20,
    test: m => m.tsDiff <= 0.1 + Number.EPSILON
  },
  {
    id: 'mfav_ts_10_15_ud_ts_lt_08',
    desc: 'Mfav TS 1.0-1.50 and Ud TS < 0.8',
    defaultPts: -20,
    test: m => m.favTS >= 1.0 && m.favTS <= 1.5 && m.udTS < 0.8
  },
  {
    id: 'both_ga_ge_1_1_volatile',
    desc: 'Both teams GA >= 1.1 (volatile match)',
    defaultPts: -10,
    test: m => m.isVolatile
  },
  {
    id: 'algo_ud_gt_35',
    desc: 'Algo support for Underdog > 35%',
    defaultPts: -25,
    test: m => m.algoProbUd > 35
  },
  {
    id: 'seer_ud_ge_45',
    desc: 'Seer score on underdog >= 45%',
    defaultPts: -25,
    test: m => m.seerScoreUd >= 45
  },
  {
    id: 'seer_draw_ge_35',
    desc: 'Seer score on draw >= 35%',
    defaultPts: -15,
    test: m => m.seerScoreDraw >= 35
  },
  {
    id: 'ud_points_gt_fav_by_5',
    desc: 'Underdog has >= 5 more points on point system',
    defaultPts: -20,
    test: m => m.pointDiff >= 5
  },
  {
    id: 'both_gs_ge_2_ga_ge_1',
    desc: 'Team A and Team B GS >= 2.0 and GA >= 1.0',
    defaultPts: -15,
    test: m => m.bothGSGe2GAGe1
  }
];

// Evaluate function
function evaluatePool(rules) {
  const scored = pool.map(m => {
    let score = getBasePhaPoints(m.phaFavWin);
    const hits = [];
    rules.forEach(r => {
      if (r.test(m)) {
        score += r.defaultPts;
        hits.push({ desc: r.desc, pts: r.defaultPts });
      }
    });
    return {
      match: m,
      score,
      hits
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

const ranked = evaluatePool(candidateRules);

console.log('=== RANKING SIMULATION RESULTS (Sunday Pool: 184 matches) ===');
console.log(`Top 5:`);
ranked.slice(0, 5).forEach((item, i) => {
  const m = item.match;
  console.log(`  #${i+1} [Score: ${item.score}] Outcome: ${m.outcome} | Teams: ${m.teams} | FavOdds: ${m.favOdds} | UdOdds: ${m.udOdds}`);
});

const top5Wins = ranked.slice(0, 5).filter(r => r.match.outcome === 'MFAV').length;
const top10Wins = ranked.slice(0, 10).filter(r => r.match.outcome === 'MFAV').length;
const top20Wins = ranked.slice(0, 20).filter(r => r.match.outcome === 'MFAV').length;

console.log(`\nAccuracy Metrics:`);
console.log(`  Top 5 Accuracy:  ${top5Wins}/5 (${(top5Wins/5*100).toFixed(1)}%)`);
console.log(`  Top 10 Accuracy: ${top10Wins}/10 (${(top10Wins/10*100).toFixed(1)}%)`);
console.log(`  Top 20 Accuracy: ${top20Wins}/20 (${(top20Wins/20*100).toFixed(1)}%)`);

// Check where draws and losses appear
const drawRanks = ranked.map((r, i) => ({ rank: i + 1, outcome: r.match.outcome })).filter(r => r.outcome === 'DRAW').map(r => r.rank);
const udRanks = ranked.map((r, i) => ({ rank: i + 1, outcome: r.match.outcome })).filter(r => r.outcome === 'UNDERDOG').map(r => r.rank);

console.log(`\nFirst 5 Draw Ranks:`, drawRanks.slice(0, 5));
console.log(`First 5 Underdog Loss Ranks:`, udRanks.slice(0, 5));

fs.writeFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\vp_simulated_ranking.json', JSON.stringify({
  top5Accuracy: `${top5Wins}/5`,
  top10Accuracy: `${top10Wins}/10`,
  top20Accuracy: `${top20Wins}/20`,
  first5DrawRanks: drawRanks.slice(0, 5),
  first5UnderdogRanks: udRanks.slice(0, 5),
  rules: candidateRules.map(r => ({ desc: r.desc, points: r.defaultPts })),
  top20Matches: ranked.slice(0, 20).map(r => ({
    teams: r.match.teams,
    score: r.score,
    outcome: r.match.outcome,
    favOdds: r.match.favOdds,
    udOdds: r.match.udOdds,
    rulesHit: r.hits
  }))
}, null, 2));

console.log('\nSimulation complete and saved to vp_simulated_ranking.json');
