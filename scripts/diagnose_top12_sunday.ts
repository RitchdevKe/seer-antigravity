import { Pool } from 'pg';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { getMarketFavorite, getOptimizedScoreDetailed } from '../src/utils/optimizedweights';
import { getMatchEvaluatorTags } from '../src/utils/matchEvaluator';

const rdsConfig = {
  host: 'seer-postgres-db-2.c0jo26icsslj.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'SeerAdmin2026!bp6luu',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

const pool = new Pool(rdsConfig);

async function main() {
  try {
    console.log("Fetching matches from RDS live_matches for 2026-09-20 (Sunday)...");
    const res = await pool.query(`
      SELECT data 
      FROM live_matches 
      WHERE (data->>'date') LIKE '2026-09-20%'
    `);

    const rawMatches: Match[] = res.rows.map(r => r.data).filter(Boolean);
    console.log(`Total live_matches fetched for 2026-09-20: ${rawMatches.length}`);

    const phaStatsMap = {};
    const matchStars = {};

    const completed = rawMatches.filter(m => {
      const actual = getActualResult(m.result || '');
      return actual === '1' || actual === 'X' || actual === '2';
    });

    console.log(`Total completed matches on 2026-09-20: ${completed.length}`);

    // Filter by Top 12 eligibility
    const top12Eligible = completed.filter(m => {
      const tags = m.evaluatorTags && m.evaluatorTags.length > 0
        ? m.evaluatorTags
        : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
      return tags.some(t => t.startsWith('top10:'));
    });

    console.log(`Top 12 eligible matches on 2026-09-20: ${top12Eligible.length}`);

    // Break down overall universe outcomes
    let totalMfav = 0;
    let totalDraw = 0;
    let totalUd = 0;

    const scored = top12Eligible.map(match => {
      const actual = getActualResult(match.result || '');
      const mFav = getMarketFavorite(match);
      const outcome: 'MFAV' | 'DRAW' | 'UNDERDOG' = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
      if (outcome === 'MFAV') totalMfav++;
      else if (outcome === 'DRAW') totalDraw++;
      else totalUd++;

      const detail = getOptimizedScoreDetailed(match, 'top_10_value', phaStatsMap);
      return {
        id: match.id,
        date: match.date,
        teams: match.teams,
        result: match.result,
        actual,
        mFav,
        outcome,
        score: detail.totalScore,
        basePoints: detail.baseInfo?.points ?? 0,
        rulesHit: detail.rulesHit,
        hedgeProtocol: detail.activeHedgingProtocol,
        match
      };
    });

    console.log(`\nOverall 2026-09-20 Top 12 Universe Outcomes:`);
    console.log(`  M.Fav Wins: ${totalMfav} (${((totalMfav/scored.length)*100).toFixed(1)}%)`);
    console.log(`  Draws:      ${totalDraw} (${((totalDraw/scored.length)*100).toFixed(1)}%)`);
    console.log(`  Underdogs:  ${totalUd} (${((totalUd/scored.length)*100).toFixed(1)}%)`);
    console.log(`  1X Safety Pool: ${totalMfav + totalDraw} / ${scored.length} (${(((totalMfav + totalDraw)/scored.length)*100).toFixed(1)}%)`);

    scored.sort((a, b) => b.score - a.score);

    console.log(`\n======================================================`);
    console.log(`SUNDAY (2026-09-20) TOP 12 PRODUCTION PERFORMANCE:`);
    console.log(`======================================================`);

    const top12 = scored.slice(0, 12);
    const mfavTop12 = top12.filter(m => m.outcome === 'MFAV').length;
    const drawTop12 = top12.filter(m => m.outcome === 'DRAW').length;
    const udTop12 = top12.filter(m => m.outcome === 'UNDERDOG').length;
    const successTop12 = mfavTop12 + drawTop12;

    console.log(`Top 12 Accuracy (1X Hedged): ${successTop12} / 12 (${((successTop12/12)*100).toFixed(1)}%)`);
    console.log(`  M.Fav Wins: ${mfavTop12}`);
    console.log(`  Draws:      ${drawTop12}`);
    console.log(`  Underdog Losses: ${udTop12}`);

    console.log(`\nTop 12 Selected Matches:`);
    top12.forEach((m, idx) => {
      const mark = m.outcome === 'UNDERDOG' ? '❌ [UNDERDOG LOSS]' : '✅ [1X SUCCESS]';
      console.log(`  #${idx + 1} [${m.score} pts] ${mark} [${m.outcome}] ${m.teams} (FT: ${m.result})`);
      console.log(`      Protocol: ${m.hedgeProtocol || 'None'}`);
      if (m.outcome === 'UNDERDOG') {
        console.log(`      Rules Hit for this failing match:`);
        m.rulesHit.forEach(r => {
          if (r.points !== 0) {
            console.log(`        - [${r.points > 0 ? '+' : ''}${r.points} pts] ${r.description}`);
          }
        });
      }
    });

    console.log(`\nTop 20 Accuracy: ${scored.slice(0, 20).filter(m => m.outcome !== 'UNDERDOG').length} / 20`);
    console.log(`Top 30 Accuracy: ${scored.slice(0, 30).filter(m => m.outcome !== 'UNDERDOG').length} / 30`);

  } catch (err: any) {
    console.error("Diagnosis error:", err.message);
  } finally {
    await pool.end();
  }
}

main();
