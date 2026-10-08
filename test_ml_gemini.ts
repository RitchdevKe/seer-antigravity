import { supabase } from './src/lib/supabase';
import { processMatch, getActualResult } from './src/utils/matchProcessing';
import { getMatchStats } from './src/utils/matchEvaluator';
import { generateSeerSlips, calculateMatchProbability } from './src/utils/seerSlipSelection';
import { selectSlipsWithAI } from './src/components/ai/GeminiEngine';
import { Match } from './src/types';
import dotenv from 'dotenv';
import path from 'path';

// Load env from the root of the project
dotenv.config();

if (typeof global !== 'undefined') {
  (global as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
}

function safeGetResult(m: Match): string {
  if (!m || !m.result) return 'pending';
  return getActualResult(String(m.result));
}

async function testMLGemini() {
  console.log("=================================================");
  console.log("🧪 ML ENGINE + GEMINI AGENT INTEGRATION");
  console.log("=================================================\n");

  const allMatches: Match[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('precalculated_matches')
      .select('id, data')
      .range(from, from + step - 1);
    if (error || !data || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach(row => { if (row.data) allMatches.push(row.data as Match); });
      if (data.length < step) hasMore = false;
      else from += step;
    }
  }

  // Deduplicate
  const uniqueMatchesMap = new Map<string, Match>();
  allMatches.forEach(m => {
    if (m && m.id) uniqueMatchesMap.set(m.id.toString(), m);
  });
  let matches = Array.from(uniqueMatchesMap.values()).map(m => processMatch(m));
  
  console.log(`Total Unique Matches: ${matches.length}`);

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

  // Step 1: Run ML Engine Probability Scoring on all matches
  console.log(`\n⚙️ 1. Scoring all matches via ML Engine Probability...`);
  
  const scoredMatches = matches.map(m => {
    const pScore = calculateMatchProbability(m, phaStatsMap);
    return { match: m, probabilityScore: pScore };
  });

  // Sort descending
  scoredMatches.sort((a, b) => b.probabilityScore - a.probabilityScore);
  
  // Take Top 40 as the candidate pool for Gemini
  const top40MLMatches = scoredMatches.slice(0, 40).map(s => s.match);
  
  console.log(`Extracted Top 40 Matches from ML Engine. Lowest Score in Top 40: ${scoredMatches[39].probabilityScore.toFixed(2)}`);

  // Step 2: Evaluate Top 40 matches historical accuracy (baseline before Gemini)
  let safeBase = 0, lossBase = 0;
  top40MLMatches.forEach(m => {
    const actual = safeGetResult(m);
    const stats = getMatchStats(m, phaStatsMap);
    if (!actual || actual === 'pending' || actual === 'UNKNOWN') return;
    if (actual === stats.moFav || actual === 'X') safeBase++;
    else if (actual === stats.moUnderdog) lossBase++;
  });
  const totalBase = safeBase + lossBase;
  console.log(`\n📊 ML ENGINE RAW BASELINE (Top 40 Pool)`);
  console.log(`  - Fav/Draw Safe: ${safeBase}`);
  console.log(`  - Underdog Loss: ${lossBase}`);
  console.log(`  - Safe Rate: ${totalBase > 0 ? ((safeBase / totalBase) * 100).toFixed(1) : 0}%\n`);

  // Step 3: Send the ML pool to Gemini to draft the final 'Top 12 Value' slip
  console.log(`\n🤖 2. Passing Top 40 ML Pool to Gemini Agent...`);
  
  const category = { id: 'top_10_value', label: 'Top 12 Value', maxPicks: 12 };
  
  try {
    const aiPicks = await selectSlipsWithAI(category, top40MLMatches, phaStatsMap, {}, false);
    
    console.log(`\n=================================================`);
    console.log(`✅ GEMINI FINAL SLIP (${aiPicks.length} PICKS)`);
    console.log(`=================================================\n`);
    
    let safeFinal = 0, lossFinal = 0;
    
    aiPicks.forEach((pick, idx) => {
      const origMatch = matches.find(m => m.id.toString() === pick.match_id);
      if (!origMatch) return;
      const actual = safeGetResult(origMatch);
      const stats = getMatchStats(origMatch, phaStatsMap);
      
      const isUnderdogLoss = actual === stats.moUnderdog;
      const isFavWin = actual === stats.moFav;
      const isDraw = actual === 'X';
      
      if (actual && actual !== 'pending' && actual !== 'UNKNOWN') {
        if (actual === stats.moFav || actual === 'X') safeFinal++;
        else if (actual === stats.moUnderdog) lossFinal++;
      }

      const pScore = calculateMatchProbability(origMatch, phaStatsMap);

      console.log(`[${idx+1}] ${pick.team} (ML Score: ${pScore.toFixed(1)})`);
      console.log(`  - Gemini Prediction: ${pick.prediction}`);
      console.log(`  - Reason: ${pick.reason}`);
      console.log(`  - Actual Result: ${actual} | Outcome: ${isUnderdogLoss ? '❌ LOSS' : '✅ SAFE'}`);
      console.log(`-------------------------------------------------`);
    });
    
    const totalFinal = safeFinal + lossFinal;
    console.log(`\n📊 FINAL AI SLIP ACCURACY (From ML Pool)`);
    console.log(`  - Fav/Draw Safe: ${safeFinal}`);
    console.log(`  - Underdog Loss: ${lossFinal}`);
    console.log(`  - Safe Rate: ${totalFinal > 0 ? ((safeFinal / totalFinal) * 100).toFixed(1) : 0}%\n`);
    
  } catch (error) {
    console.error("Error communicating with Gemini Agent:", error);
  }
}

testMLGemini().catch(console.error);
