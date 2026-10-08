import { Pool } from 'pg';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { getMarketFavorite, getOptimizedScoreDetailed, getOptimizedBaseWeight, CODE_DEFAULT_CATEGORY_SETTINGS } from '../src/utils/optimizedweights';
import { getMatchEvaluatorTags } from '../src/utils/matchEvaluator';
import fs from 'fs';

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
    const satDumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\live_matches_dump.json';
    const satMatches: Match[] = JSON.parse(fs.readFileSync(satDumpPath, 'utf8'));

    const sunRes = await pool.query(`
      SELECT data 
      FROM live_matches 
      WHERE (data->>'date') LIKE '2026-09-20%'
    `);
    const sunMatches: Match[] = sunRes.rows.map(r => r.data).filter(Boolean);

    console.log(`Loaded ${satMatches.length} Saturday matches, ${sunMatches.length} Sunday matches.`);

    const phaStatsMap = {};
    const matchStars = {};

    function process(matches: Match[], batchLabel: string) {
      const completed = matches.filter(m => {
        const actual = getActualResult(m.result || '');
        return actual === '1' || actual === 'X' || actual === '2';
      });

      const upsetsEligible = completed.filter(m => {
        const tags = m.evaluatorTags && m.evaluatorTags.length > 0
          ? m.evaluatorTags
          : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
        return tags.some(t => t.startsWith('upsets:'));
      });

      let mFavWins = 0;
      let draws = 0;
      let underdogWins = 0;

      const processed = upsetsEligible.map(m => {
        const actual = getActualResult(m.result || '');
        const mFav = getMarketFavorite(m);
        const moUnderdog = mFav === '1' ? '2' : '1';
        let outcome: 'MFAV' | 'DRAW' | 'UNDERDOG';
        if (actual === mFav) {
          outcome = 'MFAV';
          mFavWins++;
        } else if (actual === 'X') {
          outcome = 'DRAW';
          draws++;
        } else {
          outcome = 'UNDERDOG';
          underdogWins++;
        }

        const baseWeight = getOptimizedBaseWeight(m, phaStatsMap, 'upsets');
        const detail = getOptimizedScoreDetailed(m, 'upsets', phaStatsMap);

        return {
          id: m.id,
          teams: m.teams,
          league: m.league,
          result: m.result,
          actual,
          mFav,
          moUnderdog,
          outcome,
          basePoints: baseWeight.points,
          score: detail.score,
          rulesHit: detail.rulesHit,
          batch: batchLabel,
          match: m
        };
      });

      console.log(`\n--- ${batchLabel} ---`);
      console.log(`Eligible Completed Upsets: ${processed.length}`);
      console.log(`M.fav wins: ${mFavWins} (${(mFavWins/processed.length*100).toFixed(1)}%)`);
      console.log(`Draws:      ${draws} (${(draws/processed.length*100).toFixed(1)}%)`);
      console.log(`Underdogs:  ${underdogWins} (${(underdogWins/processed.length*100).toFixed(1)}%)`);

      return processed;
    }

    const satProcessed = process(satMatches, 'Saturday (2026-09-19)');
    const sunProcessed = process(sunMatches, 'Sunday (2026-09-20)');

    // Search for Brighton vs Arsenal
    const brighton = satProcessed.find(m => m.teams.toLowerCase().includes('brighton') || m.teams.toLowerCase().includes('arsenal'));
    if (brighton) {
      console.log('\n--- Brighton vs Arsenal on Saturday ---');
      console.log(`Teams: ${brighton.teams}, Result: ${brighton.result}, Actual: ${brighton.actual}, MFav: ${brighton.mFav}, Outcome: ${brighton.outcome}`);
      console.log(`Score: ${brighton.score}, Base: ${brighton.basePoints}`);
      console.log('Rules hit:', brighton.rulesHit);
    } else {
      console.log('\nBrighton vs Arsenal not found in Saturday completed upsets eligible.');
      // Check if it was in satMatches
      const bSat = satMatches.find(m => (m.teams || '').toLowerCase().includes('brighton') || (m.teams || '').toLowerCase().includes('arsenal'));
      if (bSat) {
        console.log('Found in raw Saturday matches:', bSat.teams, bSat.result);
        const tags = bSat.evaluatorTags && bSat.evaluatorTags.length > 0 ? bSat.evaluatorTags : getMatchEvaluatorTags(bSat, phaStatsMap, false, true, matchStars);
        console.log('Evaluator tags:', tags);
      }
    }

    // Save combined dataset
    const combined = [...satProcessed, ...sunProcessed];
    const outPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_upsets_matches.json';
    fs.writeFileSync(outPath, JSON.stringify(combined, null, 2));
    console.log(`\nSaved ${combined.length} combined upset matches to ${outPath}`);

  } catch (err: any) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
