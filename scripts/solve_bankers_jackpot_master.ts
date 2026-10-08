import fs from 'fs';

const outDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch';
const catalog: Array<{ index: number; description: string; currentPoints: number; isBorrowed?: boolean }> = JSON.parse(
  fs.readFileSync(`${outDir}\\augmented_bankers_jackpot_catalog.json`, 'utf8')
);
const matrix: Array<{
  id: string | number;
  teams: string;
  result: string;
  outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
  basePoints: number;
  triggeredIndices: number[];
  triggeredDescriptions: string[];
}> = JSON.parse(fs.readFileSync(`${outDir}\\augmented_bankers_jackpot_matrix.json`, 'utf8'));

console.log(`Master Solver running on ${catalog.length} rules and ${matrix.length} matches...`);

const weights: number[] = new Array(catalog.length).fill(0);

const setRule = (desc: string, pts: number) => {
  const item = catalog.find(r => r.description === desc);
  if (item) {
    weights[item.index] = pts;
  } else {
    console.warn('Rule not found in catalog:', desc);
  }
};

// Guardrails
setRule("Match belongs to israel premier league or other israel teams", -20);
setRule("Match belong to sub pattern G2E5+Mfav GS - Ud GS >= 1.0", -25);
setRule("Seer score on draw >= 40% to <45%", -20);
setRule("Seer score on draw >= 35% to <40%", -15);
setRule("Seer score on draw >= 30% to <35%", -10);
setRule("Seer score on underdog >= 45%", -25);
setRule("Seer primary predicts on underdog", -20);
setRule("Sub pattern primary prediction supports the underdog", -10);
setRule("Algo primary prediction supports the underdog", -15);
setRule("Underdog has >= 5 more points on point system", -10);
setRule("LE (Last encounter) Underdog won with and scored 2 goals or more+ Seer score on draw >= 40%", -25);
setRule("LE (Last encounter) Underdog won with and scored 2 goals or more", -15);
setRule("Underdog was away on LE (Last encounter) and Won", -10);
setRule("A match has GS=GS=GA=GA", -20);
setRule("Match has PHA tie", -15);
setRule("Match has U21,U20 Tag (youth league)", -20);
setRule("Youth league + Banned: Upset risk tag", -20);
setRule("Odds for underdog < 3.0", -15);

// Risk Suppressors (Draws & Underdog losses)
setRule("M.fav has hidden strength", -15);
setRule("Mfav has hidden weakness", -15);
setRule("Underdog GS <= 1.0 but M.fav GS > 2.0", -20);
setRule("Synergy: Both TS <= 1.0 + Volatile match + Draw odds < 3.20", -20);
setRule("H.Bal + Equal GA + AGA=HGS+ M.fav GS>Uderdog GS with more than 0.5", -20);
setRule("Both teams GA => 1.5", -15);
setRule("1X2 Rating =>7", -15);
setRule("1X2 rating(R) =>5 to <7", -10);
setRule("Point system has >= 70 points on M.fav", -15);
setRule("Point system has >= 60 to <70 points on M.fav", -10);
setRule("Point system has >= 50 to <60 points on M.fav", -5);
setRule("Synergy: Point system >= 60 on M.fav + Ud GS < 1.0 & Mfav GS > 1.0 + Ud GA >= 2.0", -20);
setRule("Synergy: Both TS <= 1.0 + Point system >= 60 on M.fav + Ud GS < 1.0 & Mfav GS > 1.0", -15);
setRule("Mfav was away on LE (Last encounter) and Won with 2 or more goals", -15);
setRule("Mfav TS 1.0-1.50 and Ud TS < 0.8", -15);
setRule("Mfav TS 1.0-1.50 and Ud TS < 0.8+Underdog has hidden strength/weakness", -20);
setRule("Mfav TS 1.0-1.50 and Ud TS < 0.8 + Banned: Upset risk tag", -20);
setRule("Seer score on draw >= 35% + Mfav TS 1.0-1.50 and Ud TS < 0.8", -20);
setRule("M.fav and Underdog TS difference <= 0.1", -15);
setRule("Both teams GA > GS and Both team GS <=1.0", -15);
setRule("Both teams GA > GS", -10);
setRule("Volatile match + Both teams GA > GS", -10);
setRule("Both teams GS < 1.0", -15);
setRule("Banned: Upset risk tag", -15);
setRule("Underdog TS > M.fav TS", -10);
setRule("1X2R <= 2.5", -5);
setRule("LE was a draw + Mfav L10= Und L10 (+-1) + 1X2R <= 2.5", -20);
setRule("Underdog has hidden strength/weakness + 1X2R <= 2.5", -15);
setRule("Mfav L10= Und L10", -15);
setRule("Underdog has a higher L10 than Mfav", -15);
setRule("Seer score on draw >= 35% to <40%+Underdog has a higher L10 than Mfav", -20);
setRule("PHA for draw and underdog => 20%", -10);
setRule("PHA for draw and underdog => 20%+M.fav TS >= 2.0 and Underdog TS < 1.0", -15);
setRule("PHA for draw and underdog => 20%+PAA, SubPattern, Algo, and ML agree on 12 hedge", -15);
setRule("M.fav TS >= 2.0 and Underdog TS < 1.0", -10); // Suppresses Anagennisi draw
setRule("M.fav TS >= 2.0 & Ud TS < 1.0 + Odds Ud <= Draw", -15);
setRule("M.fav TS >= 3.0 and Underdog TS < 1.0", -15);
setRule("M.fav TS >= 3.0 and Underdog TS < 1.0+Underdog has hidden strength/weakness", -20);
setRule("Paa fin, sub pattern fin and ML fin is 1X/X2 but Algo and Seer final is 12", -15);
setRule("PAA, SubPattern, Algo, and ML agree on 12 hedge+Both teams GA >= 1.1 (volatile match)+Both teams GA > GS", -20);
setRule("Algo for Mfav support <40%", -15);
setRule("Away favorite + M.fav and Underdog TS difference <= 0.1", -15);
setRule("Away favorite + Mfav GA <= 1.0 & Ud GA > 1.0", -5);
setRule("Underdog has hidden strength/weakness", -15);
setRule("Mfav GA= Und GA (+-0.2)", -10);
setRule("Mfav GS=Underdog GS (+-0.2)", -10);
setRule("HGA=AGS + Equal GS", -10);
setRule("Synergy: PAA s.win 55% to <70% + M.fav hidden strength", -15);

// Borrowed Risk Suppressors from BB & BDL
setRule("LE, Underdog won the last encounter +Mfav L10= Und L10", -20);
setRule("Synergy: Mfav GS - Ud GS >= 0.5 + M.fav hidden strength", -20);
setRule("Mfav L10 > Underdog L10 with <=2 + R(1X2 rating)<3.0", -15);
setRule("Mfav GA= Und GA (+-0.2) +Mfav TS 1.0-1.50 and Ud TS < 0.8", -15);
setRule("Mfav GS=Underdog GS (+-0.2) + M.fav has hidden strength", -15);

// Positive Drivers (Empirical Win Drivers)
setRule("Both team GS => 1.8", 15);
setRule("1X2 supports the underdog", 10);
setRule("All predictors fin prediction final 1X/X2 but algo final 12", 15);
setRule("Synergy: PAA s.win 55% to <70% + Mfav GS - Ud GS >= 0.5 + Ud hidden strength", 10);
setRule("Mfav GS ≥1.1 over Ud GS", 10);
setRule("Mfav GS ≥0.8 to <1.1 over Ud GS", 0); // Neutral baseline (48.3% win rate, OR 1.01)
setRule("Mfav GS ≥0.5 but <0.8 over Ud GS", 5);
setRule("Underdog GA >= 2.0", 10);
setRule("Underdog GS < 1.0 but M.fav GS > 1.0", 10);
setRule("Algo Mfav >=60%", 10);
setRule("Algo Mfav =>50% to <60%", 5);
setRule("PAA s.win =55% to <70%", 5);
setRule("PAA s.win =>70%", 10);
setRule("1X2 supports 1X/X2", 5);
setRule("PAA, SubPattern, Algo, and ML agree on 12 hedge", 5);

// Borrowed Positive Drivers from BB & BDL
setRule("Both Teams GA > 2.0", 15);
setRule("Mfav L10 >Underdog L10 with >2", 10);
setRule("LE was a draw+ Mfav GA and GS =>1.8", 15);
setRule("Synergy: TS diff >= 1.0 + Ud GA >= 2.0 + Odds Ud <= Draw", 10);

function evaluate(currentWeights: number[]) {
  const scored = matrix.map(m => {
    let score = m.basePoints;
    for (const idx of m.triggeredIndices) {
      if (idx < currentWeights.length) {
        score += currentWeights[idx];
      }
    }
    return {
      id: m.id,
      teams: m.teams,
      result: m.result,
      outcome: m.outcome,
      totalScore: score
    };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);

  const calc = (slice: any[]) => {
    const mfav = slice.filter(x => x.outcome === 'MFAV').length;
    const draw = slice.filter(x => x.outcome === 'DRAW').length;
    const ud = slice.filter(x => x.outcome === 'UNDERDOG').length;
    return { total: slice.length, mfav, draw, ud, pct: ((mfav / slice.length) * 100).toFixed(1) + '%' };
  };

  const top10 = calc(scored.slice(0, 10));
  const top20 = calc(scored.slice(0, 20));
  const top30 = calc(scored.slice(0, 30));

  let cleanStreak = 0;
  for (const m of scored) {
    if (m.outcome === 'MFAV') cleanStreak++;
    else break;
  }

  const failures = scored.filter(x => x.outcome !== 'MFAV');
  const maxFailScore = failures.length > 0 ? failures[0].totalScore : 0;
  const minTop10Score = scored.slice(0, 10)[9]?.totalScore || 0;
  const gap = minTop10Score - maxFailScore;

  return { top10, top20, top30, cleanStreak, minTop10Score, maxFailScore, gap, scored };
}

const res = evaluate(weights);
console.log('\n--- AUGMENTED MODEL EVALUATION ---');
console.log('Top 10:', res.top10);
console.log('Top 20:', res.top20);
console.log('Top 30:', res.top30);
console.log('Clean Streak:', res.cleanStreak);
console.log('Min Top 10 Score:', res.minTop10Score, '| Max Failure Score:', res.maxFailScore, '| Gap:', res.gap);

console.log('\nTop 20 Matches:');
res.scored.slice(0, 20).forEach((m, idx) => {
  console.log(`#${idx + 1} [${m.totalScore} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});

console.log('\nHighest scoring non-mfav outcomes:');
res.scored.filter(x => x.outcome !== 'MFAV').slice(0, 5).forEach((m, idx) => {
  const rank = res.scored.findIndex(x => x.id === m.id) + 1;
  console.log(`Rank #${rank} [${m.totalScore} pts] [${m.outcome}] ${m.teams} (Result: ${m.result})`);
});
