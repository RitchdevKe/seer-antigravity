import { Pool } from 'pg';
import { Match } from '../src/types';
import { getActualResult } from '../src/utils/matchProcessing';
import { getMarketFavorite, getOptimizedScoreDetailed } from '../src/utils/optimizedweights';
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
    // 1. Load Saturday dump matches
    const satDumpPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\live_matches_dump.json';
    const satMatches: Match[] = JSON.parse(fs.readFileSync(satDumpPath, 'utf8'));

    // 2. Fetch Sunday matches from RDS
    const sunRes = await pool.query(`
      SELECT data 
      FROM live_matches 
      WHERE (data->>'date') LIKE '2026-09-20%'
    `);
    const sunMatches: Match[] = sunRes.rows.map(r => r.data).filter(Boolean);

    // 3. Also check Monday matches
    const monRes = await pool.query(`
      SELECT data 
      FROM live_matches 
      WHERE (data->>'date') LIKE '2026-09-21%'
    `);
    const monMatches: Match[] = monRes.rows.map(r => r.data).filter(Boolean);

    console.log(`Saturday raw matches: ${satMatches.length}`);
    console.log(`Sunday raw matches:   ${sunMatches.length}`);
    console.log(`Monday raw matches:   ${monMatches.length}`);

    const phaStatsMap = {};
    const matchStars = {};

    const processBatch = (matches: Match[], label: string) => {
      const completed = matches.filter(m => {
        const actual = getActualResult(m.result || '');
        return actual === '1' || actual === 'X' || actual === '2';
      });

      const top12Eligible = completed.filter(m => {
        const tags = m.evaluatorTags && m.evaluatorTags.length > 0
          ? m.evaluatorTags
          : getMatchEvaluatorTags(m, phaStatsMap, false, true, matchStars);
        return tags.some(t => t.startsWith('top10:'));
      });

      const scored = top12Eligible.map(match => {
        const actual = getActualResult(match.result || '');
        const mFav = getMarketFavorite(match);
        const outcome: 'MFAV' | 'DRAW' | 'UNDERDOG' = actual === mFav ? 'MFAV' : (actual === 'X' ? 'DRAW' : 'UNDERDOG');
        const detail = getOptimizedScoreDetailed(match, 'top_10_value', phaStatsMap);
        return {
          id: match.id,
          teams: match.teams,
          result: match.result,
          actual,
          mFav,
          outcome,
          score: detail.totalScore,
          rulesHit: detail.rulesHit,
          hedgeProtocol: detail.activeHedgingProtocol,
          batch: label,
          match
        };
      });

      scored.sort((a, b) => b.score - a.score);
      return scored;
    };

    const satScored = processBatch(satMatches, 'Saturday (09-19)');
    const sunScored = processBatch(sunMatches, 'Sunday (09-20)');

    console.log(`\n--- SATURDAY TOP 12 EVALUATION ---`);
    console.log(`Total eligible: ${satScored.length}`);
    const satTop12 = satScored.slice(0, 12);
    const satTop12Success = satTop12.filter(m => m.outcome !== 'UNDERDOG').length;
    console.log(`Top 12 Accuracy: ${satTop12Success}/12 (${((satTop12Success/12)*100).toFixed(1)}%) - Mfav: ${satTop12.filter(m => m.outcome === 'MFAV').length}, Draw: ${satTop12.filter(m => m.outcome === 'DRAW').length}, Underdog: ${satTop12.filter(m => m.outcome === 'UNDERDOG').length}`);

    console.log(`\n--- SUNDAY TOP 12 EVALUATION ---`);
    console.log(`Total eligible: ${sunScored.length}`);
    const sunTop12 = sunScored.slice(0, 12);
    const sunTop12Success = sunTop12.filter(m => m.outcome !== 'UNDERDOG').length;
    console.log(`Top 12 Accuracy: ${sunTop12Success}/12 (${((sunTop12Success/12)*100).toFixed(1)}%) - Mfav: ${sunTop12.filter(m => m.outcome === 'MFAV').length}, Draw: ${sunTop12.filter(m => m.outcome === 'DRAW').length}, Underdog: ${sunTop12.filter(m => m.outcome === 'UNDERDOG').length}`);

    // Combined dataset
    // De-duplicate by match teams or ID
    const seen = new Set<string>();
    const combined: typeof satScored = [];

    [...satScored, ...sunScored].forEach(m => {
      const key = `${m.teams}_${m.result}`;
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(m);
      }
    });

    console.log(`\nCombined unique completed Top 12 matches: ${combined.length}`);

    // Save combined dataset to scratch
    fs.writeFileSync('C:\\Users\\USER\\.gemini\\antigravity\\brain\\62622108-f8b0-4990-938d-f0d5003653f7\\scratch\\combined_top12_matches.json', JSON.stringify(combined.map(c => ({
      id: c.id,
      teams: c.teams,
      result: c.result,
      actual: c.actual,
      mFav: c.mFav,
      outcome: c.outcome,
      score: c.score,
      rulesHit: c.rulesHit,
      batch: c.batch,
      match: c.match
    })), null, 2));

    console.log(`Saved combined dataset to scratch/combined_top12_matches.json`);

  } catch (err: any) {
    console.error("Analysis failed:", err.message);
  } finally {
    await pool.end();
  }
}

main();
