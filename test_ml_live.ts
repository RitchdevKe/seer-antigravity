import { supabase } from './src/lib/supabase';
import { processMatch, getActualResult } from './src/utils/matchProcessing';
import { getMatchStats } from './src/utils/matchEvaluator';
import { calculateMatchProbability } from './src/utils/seerSlipSelection';
import { Match } from './src/types';
import dotenv from 'dotenv';

dotenv.config();

function safeGetResult(m: Match): string {
  if (!m || !m.result) return 'pending';
  return getActualResult(String(m.result));
}

async function evaluateLiveMatches() {
  console.log("=================================================");
  console.log("🟢 ML ENGINE EVALUATION ON LIVE MATCHES");
  console.log("=================================================\n");

  const allMatches: Match[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('live_matches')
      .select('id, data')
      .range(from, from + step - 1);
    if (error) {
      console.error("Supabase Error:", error);
      hasMore = false;
    } else if (!data || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach(row => { if (row.data) allMatches.push(row.data as Match); });
      if (data.length < step) hasMore = false;
      else from += step;
    }
  }

  const uniqueMatchesMap = new Map<string, Match>();
  allMatches.forEach(m => {
    if (m && m.id) uniqueMatchesMap.set(m.id.toString(), m);
  });
  let matches = Array.from(uniqueMatchesMap.values()).map(m => processMatch(m));
  
  console.log(`Total Unique LIVE Matches Retrieved: ${matches.length}`);

  let phaStatsMap: Record<string, any> = {};
  try {
    const { data: phaData } = await supabase.from('pha_stats').select('*');
    if (phaData && phaData.length > 0) {
      phaData.forEach(row => {
        if (row.sub_pattern) phaStatsMap[row.sub_pattern] = row;
      });
    }
  } catch (e) {
    console.log("Failed to load PHA stats");
  }

  console.log(`\n⚙️ Scoring live matches via ML Engine Probability...`);
  
  const scoredMatches = matches.map(m => {
    const pScore = calculateMatchProbability(m, phaStatsMap);
    return { match: m, probabilityScore: pScore };
  });

  scoredMatches.sort((a, b) => b.probabilityScore - a.probabilityScore);
  
  const top20MLMatches = scoredMatches.slice(0, 20);
  
  console.log(`\n🏆 TOP 20 LIVE MATCHES BY ML SCORE`);
  console.log(`=================================================`);
  
  let safeBase = 0, lossBase = 0, pending = 0;
  top20MLMatches.forEach((s, idx) => {
    const m = s.match;
    const actual = safeGetResult(m);
    const stats = getMatchStats(m, phaStatsMap);
    
    let outcome = "⏳ PENDING";
    if (actual && actual !== 'pending' && actual !== 'UNKNOWN') {
      if (actual === stats.moFav || actual === 'X') {
        safeBase++;
        outcome = "✅ SAFE (Fav/Draw)";
      } else if (actual === stats.moUnderdog) {
        lossBase++;
        outcome = "❌ LOSS (Underdog)";
      }
    } else {
      pending++;
    }

    console.log(`[${idx+1}] ${m.teams} (ML Score: ${s.probabilityScore.toFixed(1)})`);
    console.log(`  - Fav Odds: ${stats.favOdds} | Market Fav: ${stats.moFav}`);
    console.log(`  - Actual Result: ${actual} | Outcome: ${outcome}`);
    console.log(`-------------------------------------------------`);
  });

  const totalCompleted = safeBase + lossBase;
  console.log(`\n📊 ML ENGINE PERFORMANCE ON LIVE MATCHES (Top 20)`);
  console.log(`  - Completed Matches: ${totalCompleted}`);
  console.log(`  - Fav/Draw Safe: ${safeBase}`);
  console.log(`  - Underdog Loss: ${lossBase}`);
  console.log(`  - Pending: ${pending}`);
  if (totalCompleted > 0) {
    console.log(`  - Safe Rate: ${((safeBase / totalCompleted) * 100).toFixed(1)}%\n`);
  } else {
    console.log(`  - Safe Rate: N/A (All matches pending)\n`);
  }
}

evaluateLiveMatches().catch(console.error);
